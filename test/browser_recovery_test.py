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
        window.failBackup = true;
        Storage.prototype.setItem = function (key, value) {
            if (window.failBackup && key.startsWith('btr.autosave.v1.recovery')) throw new Error('Test quota');
            return write.call(this, key, value);
        };
    })();""")
    page.goto(URL)
    page.locator('#screen').wait_for()
    page.evaluate('([key, value]) => localStorage.setItem(key, value)', [KEY, original])
    page.reload()
    page.get_by_role('button', name='Recover saved game').wait_for()
    assert 'diverged' in page.locator('#notice').inner_text()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == original
    page.get_by_role('button', name='Dismiss notice').click()
    assert not page.locator('#notice').is_visible()
    assert page.get_by_role('button', name='Recover saved game').is_visible()
    page.get_by_role('button', name='Dismiss', exact=True).click()
    assert not page.locator('#save-recovery').is_visible()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == original
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) is None
    page.reload()
    page.get_by_role('button', name='Recover saved game').wait_for()
    with page.expect_download() as download:
        page.get_by_role('button', name='Download original save').click()
    assert open(download.value.path()).read() == original
    page.get_by_role('button', name='Recover saved game').click()
    assert 'Test quota' in page.locator('#notice').inner_text()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == original
    assert page.get_by_role('button', name='Recover saved game').is_visible()
    page.get_by_role('button', name='Dismiss notice').click()
    assert not page.locator('#notice').is_visible()
    with page.expect_download() as download:
        page.get_by_role('button', name='Download original save').click()
    assert open(download.value.path()).read() == original
    # Recovery must also release a hold that was already active.
    page.keyboard.press('Escape')
    page.evaluate('window.failBackup = false')
    page.get_by_role('button', name='Recover saved game').click()
    page.locator('#save-recovery').wait_for(state='hidden')
    assert page.locator('#notice').inner_text() == 'Saved game recovered'
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    recovered = json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))
    assert recovered['checkpoint']['room'] == record['checkpoint']['room']
    assert recovered['checkpoint']['quest']
    assert recovered['checkpoint']['objects'] == record['checkpoint']['objects']
    # Flush snapshots without sending input: recovered play advances on its own.
    page.wait_for_function("""(frames) => {
        dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('btr.autosave.v1')).frames > frames;
    }""", arg=recovered['frames'])
    page.locator('#notice').wait_for(state='hidden', timeout=5000)
    assert not page.get_by_role('button', name='Dismiss notice').is_visible()
    page.reload()
    page.wait_for_function("document.getElementById('mute').hasAttribute('aria-pressed')")
    assert not page.locator('#save-recovery').is_visible()
    assert 'diverged' not in page.locator('#notice').inner_text()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))['checkpoint']['room'] == record['checkpoint']['room']
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original

    # An unusable checkpoint still offers the original for download in debug mode.
    page.keyboard.press('Escape')
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    record['c64'] = None
    record['engine'] = 'old'
    unusable = json.dumps(record)
    page.add_init_script(f'localStorage.setItem({json.dumps(KEY)}, {json.dumps(unusable)})')
    page.goto(URL + '?debug')
    page.get_by_role('button', name='Recover saved game').click()
    assert 'no recoverable quest checkpoint' in page.locator('#notice').inner_text()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == unusable
    with page.expect_download() as download:
        page.get_by_role('button', name='Download recording', exact=True).click()
    assert open(download.value.path()).read() == unusable
    assert not errors, errors

    # Reset retires a failed restore and allows the next quest to autosave.
    page.keyboard.press('o')
    page.locator('#opt-reset').click()
    page.locator('#opt-reset-confirm').click()
    expect(page.locator('#notice')).to_have_text('Game reset')
    expect(page.locator('#save-recovery')).to_be_hidden()
    expect(page.locator('#map')).to_be_hidden()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) is None
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) is None
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
    print('browser_recovery_test: dismissal, original download, backup failure/retry, resumed recovery, notice expiry, reload, missing checkpoint, reset after failed restore, and startup error passed')
