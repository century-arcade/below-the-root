"""Browser integration checks; run against make serve. GitHub is mocked: no issue is posted."""
import json
import os
import re
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={"width": 900, "height": 750})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    logged = []
    page.on('console', lambda msg: logged.append(msg.text) if msg.type == 'log' else None)
    posted = []

    def github(route):
        if 'op=issue' in route.request.url:
            posted.append(route.request.post_data_json)
            if len(posted) == 1:
                route.fulfill(status=502, json={"error": "Test network failure; message kept."})
                return
            route.fulfill(status=201, json={"url": "https://github.com/century-arcade/below-the-root/issues/123", "number": 123})
        else:
            route.fulfill(json={"configured": True, "login": "tester"})

    page.route('**/.netlify/functions/github?*', github)
    page.goto(BASE + '/?player=0&debug')
    page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
    for name in ['Download recording', 'Load recording', 'Report issue']:
        assert page.locator('#top-controls').get_by_role('button', name=name, exact=True).is_visible(), name
    box = page.locator('#screen').bounding_box()
    page.mouse.move(box['x'] + box['width'] * .9, box['y'] + box['height'] * .3)
    page.mouse.down()
    page.dispatch_event('#screen', 'pointercancel', {"pointerId": 1})
    page.wait_for_timeout(350)
    page.mouse.up()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert not page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).inputs"), 'cancelled pointer must not produce input'
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(350)
    page.keyboard.up('ArrowRight')

    def frames():
        page.evaluate("dispatchEvent(new Event('pagehide'))")
        return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).frames")

    page.keyboard.press('Escape')
    stopped = frames()
    page.wait_for_timeout(300)
    assert frames() == stopped, 'Escape must stop game time'
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(300)
    assert frames() > stopped, 'a movement key must resume game time'
    page.evaluate("dispatchEvent(new Event('blur'))")
    stopped = frames()
    page.wait_for_timeout(300)
    assert frames() == stopped, 'leaving the window must pause game time'
    page.locator('#screen').click()
    page.wait_for_timeout(300)
    assert frames() > stopped, 'a tap on the screen must resume game time'
    page.wait_for_timeout(350)

    page.keyboard.press('r')
    assert page.locator('#issue-dialog').evaluate("e => e.open && !e.matches(':modal')")
    saved = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
    draft = 'wasd and spaces should only type here\nThe doorway did not open.'
    page.locator('#issue-message').fill(draft)
    page.wait_for_timeout(150)
    assert page.locator('#issue-message').input_value() == draft
    page.locator('#issue-submit').click()
    page.locator('#issue-result').filter(has_text='Test network failure').wait_for()
    assert page.locator('#issue-dialog').evaluate('e => e.open')
    assert page.locator('#issue-message').input_value() == draft
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") == draft
    page.wait_for_timeout(300)
    assert frames() == saved['frames'], 'a failed submission must keep game time paused'
    page.locator('#issue-submit').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.locator('#log').filter(has_text='Issue #123 filed').wait_for()
    assert len(posted) == 2
    assert 'recentInputs' in posted[0]['context']
    assert 'player' in posted[0]['context']
    assert posted[1] == posted[0], 'retry must retain the message and captured context'
    assert page.locator('#issue-message').input_value() == ''
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") is None
    page.wait_for_function("document.activeElement === document.getElementById('file-issue')")
    page.wait_for_timeout(300)
    assert frames() > saved['frames'], 'successful submission must resume game time'
    gestures = len(saved['gestures'])
    page.keyboard.press('ArrowRight')
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    recorded = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).gestures")
    assert [g[1:] for g in recorded[gestures:]] == [['keydown', 'ArrowRight'], ['keyup', 'ArrowRight']], 'filing an issue must return keyboard input to the game without another click'
    page.keyboard.press('r')
    assert page.locator('#issue-message').input_value() == ''
    stopped = frames()
    page.wait_for_timeout(300)
    assert frames() == stopped
    page.locator('#issue-cancel').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.wait_for_function("document.activeElement === document.getElementById('file-issue')")
    page.wait_for_timeout(300)
    assert frames() > stopped, 'manual close must resume game time'
    with page.expect_download() as dl:
        page.locator('#download-record').click()
    dl.value.save_as('/tmp/btr-browser-record.json')
    record = json.load(open('/tmp/btr-browser-record.json'))
    assert record['format'] == 'below-the-root-record'
    page.goto(BASE + '/?debug')
    page.locator('#file-issue').wait_for()
    page.wait_for_timeout(200)
    expect(page.locator('#log')).to_be_hidden()
    assert page.locator('#where').inner_text() == record['checkpoint']['room']
    page.locator('#record-file').set_input_files('/tmp/btr-browser-record.json')
    page.locator('#log').filter(has_text='Loaded btr-browser-record.json').wait_for()
    # Imports display timestamps while the console retains the original text.
    logged.clear()
    for n in range(101):
        page.locator('#record-file').set_input_files({
            'name': f'log-{n}.json', 'mimeType': 'application/json',
            'buffer': json.dumps(record).encode(),
        })
        expect(page.locator('#log')).to_contain_text(f'Loaded log-{n}.json')
    expect(page.locator('#log > div').last).to_have_text(re.compile(r'^\d\d:\d\d:\d\d Loaded log-100.json$'))
    assert logged == [f'Loaded log-{n}.json' for n in range(101)]
    assert not errors, errors
    page.screenshot(path='/tmp/btr-debug.png')
    page.evaluate('(save) => localStorage.setItem("btr.quest2", save)', record['c64'])
    page.goto(BASE + '/')
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    assert not page.locator('#debug-tools').is_visible()
    assert not page.locator('#file-issue').is_visible()
    assert page.locator('#where').text_content() == ''
    assert not page.locator('#where').is_visible()
    assert page.locator('#top-controls #fullscreen').count() == 1
    mute = page.get_by_role('button', name='Mute', exact=True)
    assert mute.inner_text() == '🔊'
    assert mute.get_attribute('aria-pressed') == 'false'
    mute.click()
    unmute = page.get_by_role('button', name='Unmute', exact=True)
    assert unmute.inner_text() == '🔇'
    assert unmute.get_attribute('aria-pressed') == 'true'
    assert page.evaluate("localStorage.getItem('btr.muted')") == '1'
    page.keyboard.press('m')
    assert mute.get_attribute('aria-pressed') == 'false'
    assert page.evaluate("localStorage.getItem('btr.muted')") == '0'
    page.get_by_role('button', name='Fullscreen', exact=True).click()
    page.wait_for_function('document.fullscreenElement !== null')
    page.keyboard.press('f')
    page.wait_for_function('document.fullscreenElement === null')
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    assert not errors, errors
    # Reset deletes the quest on one click, preserving slots and options.
    page.keyboard.press('o')
    saved = page.evaluate("localStorage.getItem('btr.autosave.v1')")
    page.evaluate('''(save) => {
        localStorage.setItem('btr.autosave.v1.recovery', save);
        localStorage.setItem('btr.autosave.v1.recovery.1', save);
    }''', saved)
    # A failed deletion must not claim success or replace the running quest.
    page.evaluate('''() => {
        window.removeItem = Storage.prototype.removeItem;
        Storage.prototype.removeItem = () => { throw new Error('Test storage failure'); };
    }''')
    page.locator('#opt-reset').click()
    expect(page.locator('#log')).to_contain_text('Reset failed: Test storage failure')
    expect(page.locator('#options-dialog')).to_be_visible()
    expect(page.locator('#map')).to_be_visible()
    assert page.evaluate("localStorage.getItem('btr.autosave.v1')") == saved
    page.evaluate('() => { Storage.prototype.removeItem = window.removeItem; }')
    page.locator('#opt-reset').click()
    expect(page.locator('#log')).to_contain_text('Game reset')
    expect(page.locator('#log')).to_contain_text('Reset failed: Test storage failure')
    assert page.evaluate("localStorage.getItem('btr.autosave.v1')") is None
    assert page.evaluate("localStorage.getItem('btr.autosave.v1.recovery')") is None
    assert page.evaluate("localStorage.getItem('btr.autosave.v1.recovery.1')") is None
    assert page.evaluate("localStorage.getItem('btr.quest2')") == record['c64']
    assert page.evaluate("localStorage.getItem('btr.muted')") == '0'
    expect(page.locator('#options-dialog')).to_be_hidden()
    expect(page.locator('#map')).to_be_hidden()
    page.reload()
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    page.wait_for_timeout(300)
    assert page.evaluate("localStorage.getItem('btr.autosave.v1')") is None
    expect(page.locator('#map')).to_be_hidden()
    assert not errors, errors
    # The demo schedules a tune on WebAudio; pausing must not cut or restart its notes.
    page.add_init_script('''
        window.audioStops = 0;
        const stop = AudioScheduledSourceNode.prototype.stop;
        AudioScheduledSourceNode.prototype.stop = function (...args) {
            window.audioStops++;
            return stop.apply(this, args);
        };
    ''')
    page.goto(BASE + '/?demo=quest')
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    page.keyboard.press('-')  # Unlock audio without aborting the demo.
    expect(page.locator('#log')).to_be_hidden()
    page.wait_for_function('window.audioStops > 10')
    scheduled = page.evaluate('window.audioStops')
    for action in ['p', 'ArrowRight', 'blur', 'Escape']:
        if action == 'blur':
            page.evaluate("dispatchEvent(new Event('blur'))")
        else:
            page.keyboard.press(action)
        page.wait_for_timeout(200)
        assert page.evaluate('window.audioStops') == scheduled, 'pause/resume must leave scheduled music playing'
    assert not errors, errors
    # Pomma can PENSE messages; this seed puts the U3 animal in front of her start.
    page.add_init_script('crypto.getRandomValues = array => { array.fill(1); return array; };')
    page.goto(BASE + '/?room=U3&player=3')
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    page.evaluate('''async () => {
        window.facingCreature = (await import('./creatures.js')).facingCreature;
        window.readQuest = () => {
            dispatchEvent(new Event('pagehide'));
            return JSON.parse(localStorage.getItem('btr.autosave.v1'));
        };
        window.selectedVerb = () => String.fromCharCode(
            ...readQuest().checkpoint.panel.filter(c => c & 128).map(c => c & 127)
        ).trim();
    }''')
    page.wait_for_function('''() => {
        const s = readQuest().checkpoint;
        return !s.player.fallen && !s.player.knockdown && facingCreature(s) !== null;
    }''')
    page.keyboard.down('ArrowDown')
    page.keyboard.down('Space')
    page.wait_for_function('readQuest().checkpoint.timing[6]')
    page.keyboard.up('Space')
    page.keyboard.up('ArrowDown')
    page.wait_for_function("selectedVerb() === 'PAUSE'")
    page.keyboard.press('ArrowDown')
    page.wait_for_function("selectedVerb() === 'SPEAK'")
    page.keyboard.press('ArrowDown')
    page.wait_for_function("selectedVerb() === 'PENSE'")
    page.keyboard.down('Space')
    page.wait_for_function('readQuest().checkpoint.progress[3] === 1')
    reward_frame = frames()
    page.wait_for_function('(frame) => readQuest().frames >= frame + 18', arg=reward_frame)
    reward = page.evaluate('readQuest()')
    assert reward['checkpoint']['timing'][1] > 0, 'the reward tune must still be waiting while Space is held'
    assert not reward['actions'], 'the verb press must not skip its reward tune'
    page.keyboard.up('Space')
    released_frame = frames()
    page.wait_for_function('(frame) => readQuest().frames >= frame + 2', arg=released_frame)
    page.keyboard.press('Space')
    page.wait_for_function("readQuest().actions.some(a => a.type === 'skip')")
    skipped = page.evaluate('readQuest()')
    assert [a['type'] for a in skipped['actions']] == ['skip'], 'a fresh press skips exactly once'
    assert skipped['checkpoint']['timing'][1] == 0, 'skipping clears the tune wait'
    assert not errors, errors
    browser.close()
    print('browser_test: autosave/resume, one-click reset/deletion/reload, pause/resume with continuing music, held-button reward tune and fresh-press skip, icon controls, debug visibility, issue form isolation, mocked issue creation, record download/import passed')
