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
    warnings = []
    page.on('console', lambda msg: warnings.append(msg.text) if msg.type == 'warning' else None)
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
    page.goto(URL + 'about')
    expect(page.locator('#about')).to_be_visible()
    page.evaluate('([key, value]) => localStorage.setItem(key, value)', [KEY, original])
    page.goto(URL)
    page.wait_for_selector('#mute[aria-pressed]', state='attached')
    expect(page.locator('#log')).to_be_hidden()
    assert page.locator('#log').text_content() == ''
    assert any('could not be restored' in msg and 'Test quota' in msg for msg in warnings), warnings
    expect(page.locator('#save-recovery')).to_have_count(0)
    expect(page.locator('#map')).to_be_hidden()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) is None
    # Start at the main menu: choose START GAME, then the character.
    # A failed restore still allows play and autosaving a new quest.
    for _ in range(2):
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
    page.wait_for_selector('#mute[aria-pressed]', state='attached')
    expect(page.locator('#log')).to_be_hidden()
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
    page.wait_for_selector('#mute[aria-pressed]', state='attached')
    expect(page.locator('#log')).to_be_hidden()
    expect(page.locator('#map')).to_be_visible()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))['checkpoint']['room'] == record['checkpoint']['room']
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP + '.1') is None

    # Without a checkpoint, preserve the text and start at the menu, console only.
    warnings.clear()
    unusable = json.dumps({**record, 'c64': None, 'engine': 'old'})
    page.add_init_script(f'localStorage.setItem({json.dumps(KEY)}, {json.dumps(unusable)})')
    page.goto(URL + '?debug')
    page.wait_for_selector('#mute[aria-pressed]', state='attached')
    expect(page.locator('#log')).to_be_hidden()
    assert page.locator('#log').text_content() == ''
    assert any('could not be restored' in msg for msg in warnings), warnings
    with page.expect_download() as download:
        page.locator('#download-record').click()
    snapshot = json.loads(open(download.value.path()).read())
    assert snapshot['initial'] == {'mode': 'menu'}
    assert snapshot['checkpoint']['title']
    assert not snapshot['checkpoint']['quest']
    expect(page.locator('#save-recovery')).to_have_count(0)
    expect(page.locator('#map')).to_be_hidden()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == unusable
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP + '.1') == unusable
    assert not errors, errors

    # Reset retires a failed restore and allows the next quest to autosave.
    page.keyboard.press('o')
    page.locator('#opt-reset').click()
    expect(page.locator('#log')).to_contain_text('Game reset')
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

    # Fatal startup errors reach the log even before game data finishes loading.
    startup = browser.new_page()
    startup.route('**/data/*.json', lambda route: route.fulfill(status=500, body='Test load failure'))
    startup.goto(URL + '#play')
    expect(startup.locator('#log')).to_be_visible()
    expect(startup.locator('#log')).to_contain_text('500')
    browser.close()
    print('browser_recovery_test: silent recovery, console-only failure at the menu, continued autosaving, reload, missing checkpoint, reset after failed restore, and startup error passed')
