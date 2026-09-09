"""Autosave recovery; run against make serve. No external services are called."""
import json
import os
from playwright.sync_api import sync_playwright, expect

KEY = 'btr.autosave.v1'
BACKUP = KEY + '.recovery'
URL = os.environ.get('BTR_URL', 'http://localhost:8000').rstrip('/') + '/'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    source = browser.new_page()
    source.goto(URL + '?player=0')
    source.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
    source.keyboard.press('Escape')
    source.evaluate("dispatchEvent(new Event('pagehide'))")
    record = json.loads(source.evaluate('(key) => localStorage.getItem(key)', KEY))
    source.close()
    record['checkpoint']['player']['col'] += 1
    original = json.dumps(record)

    context = browser.new_context()
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.add_init_script("""(() => {
        const write = Storage.prototype.setItem;
        window.failBackup = sessionStorage.getItem('failBackup') !== 'false';
        Storage.prototype.setItem = function (key, value) {
            if (window.failBackup && key.startsWith('btr.autosave.v1.recovery')) throw new Error('Test quota');
            return write.call(this, key, value);
        };
    })();""")
    page.goto(URL)
    page.locator('#screen').wait_for()
    page.evaluate('([key, value]) => localStorage.setItem(key, value)', [KEY, original])
    page.reload()
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    expect(page.locator('#notice')).to_have_text('Your saved game could not be restored. Test quota')
    expect(page.locator('#save-recovery')).to_have_count(0)
    expect(page.locator('#map')).to_be_hidden()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) is None
    # Skip the intro, choose START GAME, then choose the character.
    # A failed restore still allows play and autosaving a new quest.
    for _ in range(3):
        page.wait_for_timeout(150)
        page.keyboard.press('Space', delay=120)
    expect(page.locator('#map')).to_be_visible()
    page.wait_for_function("(original) => localStorage.getItem('btr.autosave.v1') !== original", arg=original)

    # Recovery on cold startup is silent and keeps the original before replacing it.
    page.evaluate("sessionStorage.setItem('failBackup', 'false')")
    page.add_init_script(f"""if (!sessionStorage.getItem('recoverySeeded')) {{
        localStorage.setItem({json.dumps(KEY)}, {json.dumps(original)});
        sessionStorage.setItem('recoverySeeded', 'true');
    }}""")
    page.reload()
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    expect(page.locator('#notice')).to_be_hidden()
    expect(page.locator('#save-recovery')).to_have_count(0)
    expect(page.locator('#map')).to_be_visible()
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    recovered = json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))
    assert recovered != record
    assert recovered['checkpoint']['room'] == record['checkpoint']['room']
    assert recovered['checkpoint']['quest']
    assert recovered['checkpoint']['objects'] == record['checkpoint']['objects']
    # Flush snapshots without sending input: recovered play advances on its own.
    page.wait_for_function("""(frames) => {
        dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('btr.autosave.v1')).frames > frames;
    }""", arg=recovered['frames'])
    page.reload()
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    expect(page.locator('#notice')).to_be_hidden()
    expect(page.locator('#map')).to_be_visible()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))['checkpoint']['room'] == record['checkpoint']['room']
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP + '.1') is None

    # Without a checkpoint, preserve the text and start cold with one notice.
    unusable = json.dumps({**record, 'c64': None, 'engine': 'old'})
    page.add_init_script(f'localStorage.setItem({json.dumps(KEY)}, {json.dumps(unusable)})')
    page.goto(URL + '?debug')
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    expect(page.locator('#notice')).to_have_text('Your saved game could not be restored.')
    expect(page.locator('#save-recovery')).to_have_count(0)
    expect(page.locator('#map')).to_be_hidden()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == unusable
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP + '.1') == unusable
    assert not errors, errors

    # Reset retires a failed restore and allows the next quest to autosave.
    page.keyboard.press('o')
    page.locator('#opt-reset').click()
    page.locator('#opt-reset-confirm').click()
    expect(page.locator('#notice')).to_have_text('Game reset')
    expect(page.locator('#map')).to_be_hidden()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) is None
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) is None
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP + '.1') is None
    for _ in range(2):
        page.wait_for_timeout(150)
        page.keyboard.press('Space', delay=120)
    page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
    fresh = json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))
    assert fresh['initial'] == {'mode': 'menu'}
    assert fresh['checkpoint']['quest']
    expect(page.locator('#map')).to_be_visible()
    assert not errors, errors

    # Dismissal is wired even when startup never finishes loading game data.
    startup = browser.new_page()
    startup.route('**/data/*.json', lambda route: route.fulfill(status=500, body='Test load failure'))
    startup.goto(URL)
    startup.get_by_role('button', name='Dismiss notice').click()
    assert not startup.locator('#notice').is_visible()
    browser.close()
    print('browser_recovery_test: silent recovery, backup failure, continued autosaving, reload, missing checkpoint, reset after failed restore, and startup error passed')
