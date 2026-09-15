"""Browser integration checks; run against make serve. GitHub is mocked: no issue is posted."""
import json
import os
from browser_helpers import install_probe, observe
import re
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={"width": 900, "height": 750})
    install_probe(page)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    logged = []
    page.on('console', lambda msg: logged.append(msg.text) if msg.type == 'log' else None)
    posted = []

    def github(route):
        if 'op=issue' in route.request.url:
            posted.append(route.request.post_data_json)
            recording = json.loads(posted[-1]['recording'])
            assert recording['version'] == 3 and 'endpoint' in recording
            assert posted[-1]['meta'] == {'simticks': recording['checkpoint']['simticks'], 'room': recording['checkpoint']['room']}
            if len(posted) == 1:
                route.fulfill(status=502, json={"error": "Test network failure; message kept."})
                return
            route.fulfill(status=201, json={"url": "https://github.com/century-arcade/below-the-root/issues/123", "number": 123,
                                          "gist": "https://gist.github.com/tester/456" if len(posted) == 2 else None})
        else:
            route.fulfill(json={"configured": True, "login": "tester"})

    page.route('**/.netlify/functions/github?*', github)
    page.goto(BASE + '/?player=0&debug')
    page.wait_for_function("localStorage.getItem('btr.autosave.v3') !== null")
    for name in ['Download recording', 'Load recording', 'Report issue']:
        assert page.locator('#debug-tools').get_by_role('button', name=name, exact=True).is_visible(), name
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(350)
    page.keyboard.up('ArrowRight')

    def frames():
        return observe(page)['frame']

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
    saved = observe(page)
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
    assert frames() == saved['frame'], 'a failed submission must keep game time paused'
    page.locator('#issue-submit').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.locator('#log').filter(has_text='Issue #123 filed with playthrough').wait_for()
    assert len(posted) == 2
    context = json.loads(posted[0]['context'])
    assert 'recentEvents' in context
    assert 'player' in context
    assert context['simticks'] >= json.loads(posted[0]['recording'])['checkpoint']['simticks']
    assert posted[1] == posted[0], 'retry must retain the message and captured context'
    assert page.locator('#issue-message').input_value() == ''
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") is None
    page.wait_for_function("document.activeElement === document.getElementById('file-issue')")
    page.wait_for_timeout(300)
    assert frames() > saved['frame'], 'successful submission must resume game time'
    before_events = len(observe(page)['events'])
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(300)
    assert any(e.get('stick') == [1, 0, 0] for e in observe(page)['events'][before_events:])
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
    page.keyboard.press('r')
    page.locator('#issue-message').fill('Report with failed playthrough upload')
    page.locator('#issue-submit').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.locator('#log').filter(has_text='Issue #123 filed; playthrough upload failed').wait_for()
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
    page.locator('#log').filter(has_text='Replaying btr-browser-record.json').wait_for()
    # Imports display timestamps while the console retains the original text.
    logged.clear()
    replay_message = 'from the beginning, skipping idle time. Left/Right goes back/forward one room, Shift+Left/Right ten; hold to keep skipping.'
    for n in range(101):
        page.locator('#record-file').set_input_files({
            'name': f'log-{n}.json', 'mimeType': 'application/json',
            'buffer': json.dumps(record).encode(),
        })
        expect(page.locator('#log')).to_contain_text(f'Replaying log-{n}.json {replay_message}')
    expect(page.locator('#log > div').last).to_have_text(re.compile(r'^\d\d:\d\d:\d\d ' + re.escape(f'Replaying log-100.json {replay_message}') + '$'))
    assert logged == [f'Replaying log-{n}.json {replay_message}' for n in range(101)]
    assert not errors, errors
    page.screenshot(path='/tmp/btr-debug.png')
    page.goto(BASE + '/')
    page.wait_for_function("document.getElementById('volume').hasAttribute('aria-valuetext')")
    assert not page.locator('#debug-tools').is_visible()
    assert not page.locator('#file-issue').is_visible()
    assert page.locator('#where').text_content() == ''
    assert not page.locator('#where').is_visible()
    assert page.locator('#top-controls #fullscreen').count() == 1
    volume = page.get_by_role('slider', name='Volume', exact=True)
    expect(volume).to_have_value('50')
    page.keyboard.press('m')
    expect(volume).to_have_value('50')
    expect(page.locator('#map-screen')).to_be_visible()
    page.keyboard.press('m')
    expect(page.locator('#map-screen')).to_be_hidden()
    page.keyboard.press('-')
    expect(volume).to_have_value('40')
    page.keyboard.press('+')
    expect(volume).to_have_value('50')
    volume.press('Home')
    for _ in range(3):
        volume.press('ArrowRight')
    assert page.evaluate("localStorage.getItem('btr.volume.v2')") == '0.3'
    volume.press('Home')
    expect(volume).to_have_value('0')
    volume.press('ArrowRight')
    expect(volume).to_have_value('10')
    volume.press('Home')
    for _ in range(3):
        volume.press('ArrowRight')
    page.reload()
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    expect(volume).to_have_value('30')
    # Developer mode toggles directly, persists, and gates the report shortcut.
    developer = page.get_by_role('button', name='Developer mode', exact=True)
    expect(developer).to_have_attribute('aria-pressed', 'false')
    developer.focus()
    page.keyboard.press('Enter')
    expect(developer).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#file-issue')).to_be_visible()
    crt = page.get_by_role('button', name='CRT effect', exact=True)
    crt.click()
    expect(crt).to_have_attribute('aria-pressed', 'true')
    assert page.evaluate("localStorage.getItem('btr.crt')") == '1'
    page.reload()
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    expect(developer).to_have_attribute('aria-pressed', 'true')
    expect(crt).to_have_attribute('aria-pressed', 'true')
    crt.click()
    developer.click()
    expect(page.locator('#debug-tools')).to_be_hidden()
    page.keyboard.press('r')
    expect(page.locator('#issue-dialog')).to_be_hidden()
    assert page.evaluate("localStorage.getItem('btr.debug')") == '0'
    page.get_by_role('button', name='Fullscreen', exact=True).click()
    page.wait_for_function('document.fullscreenElement === document.documentElement')
    page.keyboard.press('f')
    assert page.evaluate('document.fullscreenElement !== null'), 'F does not toggle fullscreen'
    page.evaluate('document.exitFullscreen()')
    page.wait_for_function('document.fullscreenElement === null')
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    assert not errors, errors
    # The main menu is presentation; returning to Play preserves quest state.
    saved = observe(page)
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    menu = observe(page)
    assert menu['title'] and menu['quest']
    assert menu['checkpoint']['objects'] == saved['checkpoint']['objects']
    page.reload()
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    assert observe(page)['quest'] and not observe(page)['title']
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
    page.wait_for_function("document.getElementById('volume').hasAttribute('aria-valuetext')")
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
    assert not errors, errors
    browser.close()
    print('browser_test: boundary downloads, issue form isolation, mocked issue retry, debug controls, preferences and music during pause passed')
