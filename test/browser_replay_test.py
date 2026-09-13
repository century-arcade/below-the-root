"""Recording playback, pause timing and returning to the live quest; no external services."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('BTR_URL', 'http://localhost:8000').rstrip('/')
KEY = 'btr.autosave.v1'
FIXTURE = Path(__file__).parent / 'fixtures' / 'pomma-win.json'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.goto(URL + '/play.html?player=0&debug')
    page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
    page.locator('#screen').focus()

    def snapshot():
        with page.expect_download() as result:
            page.locator('#download-record').evaluate('(button) => button.click()')
        return json.loads(Path(result.value.path()).read_text())

    page.keyboard.press('Escape')
    paused = snapshot()
    page.wait_for_timeout(250)
    assert snapshot()['checkpoint']['stats']['milliseconds'] == paused['checkpoint']['stats']['milliseconds']
    page.keyboard.press('Escape')
    page.wait_for_timeout(250)
    assert snapshot()['checkpoint']['stats']['milliseconds'] > paused['checkpoint']['stats']['milliseconds']

    page.locator('#record-file').set_input_files(FIXTURE)
    expect(page.locator('#replay-controls')).to_be_visible()
    expect(page.locator('#replay-status')).to_contain_text('Replaying:')
    saved = page.evaluate('(key) => localStorage.getItem(key)', KEY)
    # Each press seeks one transition, leaving recorded input in control.
    for _ in range(2):
        before = page.locator('#replay-status').text_content()
        page.keyboard.press('Space')
        page.wait_for_function('(before) => document.getElementById("replay-status").textContent !== before', arg=before)
    assert snapshot() == json.loads(FIXTURE.read_text()), 'download preserves the full uploaded journal'
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == saved

    page.locator('#stop-replay').click()
    expect(page.locator('#replay-controls')).to_be_hidden()
    page.keyboard.press('Escape')
    returned = snapshot()
    assert returned['seed'] == paused['seed']
    assert returned['checkpoint']['player']['name'] == 'NERIC'

    # A short valid recording has no further room change: Space stops at EOF.
    page.locator('#record-file').set_input_files({
        'name': 'short.json', 'mimeType': 'application/json', 'buffer': json.dumps(returned).encode(),
    })
    expect(page.locator('#replay-controls')).to_be_visible()
    page.locator('#screen').focus()
    page.keyboard.press('Space')
    expect(page.locator('#replay-status')).to_have_text('Replay finished')
    page.keyboard.press('Space')
    expect(page.locator('#replay-status')).to_have_text('Replay finished')
    page.locator('#stop-replay').click()

    broken = {**returned, 'checkpoint': {**returned['checkpoint'], 'quest': False}}
    page.locator('#record-file').set_input_files({
        'name': 'broken.json', 'mimeType': 'application/json', 'buffer': json.dumps(broken).encode(),
    })
    page.locator('#next-replay-room').click()
    expect(page.locator('#replay-status')).to_have_text('Replay failed')
    expect(page.locator('#log')).to_contain_text('does not replay')
    assert not errors, errors
    browser.close()
print('browser_replay_test: upload, room seeking, EOF, verification, pause timing and live quest preservation passed')
