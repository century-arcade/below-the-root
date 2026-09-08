"""Autosave recovery; run against make serve. No external services are called."""
import json
from playwright.sync_api import sync_playwright

KEY = 'btr.autosave.v1'
BACKUP = KEY + '.recovery'
URL = 'http://localhost:8000/'

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
    with page.expect_download() as download:
        page.get_by_role('button', name='Download original save').click()
    assert open(download.value.path()).read() == original
    page.get_by_role('button', name='Recover saved game').click()
    assert 'Test quota' in page.locator('#notice').inner_text()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == original
    assert page.get_by_role('button', name='Recover saved game').is_visible()
    page.evaluate('window.failBackup = false')
    page.get_by_role('button', name='Recover saved game').click()
    page.locator('#save-recovery').wait_for(state='hidden')
    page.wait_for_function("document.getElementById('where').textContent.includes('PAUSED')")
    assert page.locator('#where').inner_text() == record['checkpoint']['room'] + ' PAUSED'
    assert page.evaluate('(key) => localStorage.getItem(key)', BACKUP) == original
    recovered = json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))
    assert recovered['frames'] == 0
    assert recovered['checkpoint']['quest']
    assert recovered['checkpoint']['objects'] == record['checkpoint']['objects']
    page.reload()
    page.wait_for_function("document.getElementById('where').textContent.length > 0")
    assert not page.locator('#save-recovery').is_visible()
    assert 'diverged' not in page.locator('#notice').inner_text()
    assert page.locator('#where').inner_text() == record['checkpoint']['room']
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
    browser.close()
    print('browser_recovery_test: original download, backup failure/retry, checkpoint recovery, reload, and missing checkpoint passed')
