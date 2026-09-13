"""Author and export starting-map visibility without changing a quest."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/map-editor.html')
    room = page.locator('[data-room="M5"]')
    expect(room).to_have_attribute('aria-pressed', 'false')
    expect(page.locator('#editor-grid [aria-pressed="true"]')).to_have_count(0)
    for code in ['P2', '0C']:
        expect(page.locator(f'[data-room="{code}"]')).to_have_count(1)
    expect(page.locator('[data-room="T1"]')).to_have_count(0)
    room.click()
    expect(room).to_have_attribute('aria-pressed', 'true')
    room.press('Space')
    expect(room).to_have_attribute('aria-pressed', 'false')
    room.press('Enter')
    expect(room).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#selection-count')).to_have_text('1 room seen')
    with page.expect_download() as download_info:
        page.get_by_role('button', name='Download JSON').click()
    download = download_info.value
    assert download.suggested_filename == 'initial-map.json'
    assert json.loads(Path(download.path()).read_text()) == {'rooms': ['M5']}
    page.evaluate("""() => {
        window.showSaveFilePicker = async () => ({ createWritable: async () => ({
            write: async text => { window.savedMap = JSON.parse(text); },
            close: async () => { window.mapFileClosed = true; }
        }) });
    }""")
    page.get_by_role('button', name='Save data file').click()
    expect(page.locator('#editor-status')).to_contain_text('Saved.')
    assert page.evaluate('window.savedMap') == {'rooms': ['M5']}
    assert page.evaluate('window.mapFileClosed') is True
    page.get_by_role('button', name='Load saved defaults').click()
    defaults = page.request.get(BASE + '/assets/initial-map.json').json()['rooms']
    selected = page.locator('#editor-grid [aria-pressed="true"]').evaluate_all(
        'buttons => buttons.map(button => button.dataset.room)')
    assert set(selected) == set(defaults)
    page.get_by_role('button', name='All unseen').click()
    expect(page.locator('#editor-grid [aria-pressed="true"]')).to_have_count(0)
    assert page.evaluate("localStorage.getItem('btr.autosave.v1')") is None
    assert not errors, errors
    browser.close()
    print('browser_map_editor_test: selection, keyboard, defaults, clearing and JSON file export passed')
