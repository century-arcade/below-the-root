"""Startup reveals the surround before data loads; failed loads report to console."""
import os
from playwright.sync_api import sync_playwright, expect
from browser_helpers import ready, session_eval


BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for surround in ['dark', 'commodore', 'portable']:
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script(f"localStorage.setItem('btr.surround.v2', '{surround}')")
        modules, data = [], []
        page.route('**/main.js', lambda route: modules.append(route))
        page.route('**/data/rooms.json', lambda route: data.append(route))
        page.goto(BASE + '/play', wait_until='commit')
        expect(page.locator('#monitor')).to_be_hidden()
        expect(page.locator('#screen')).to_be_hidden()
        with page.expect_request('**/data/rooms.json'):
            modules.pop().continue_()
        expect(page.locator('#monitor')).to_be_visible()
        expect(page.locator('#screen')).to_be_visible()
        expect(page.locator('#monitor')).to_have_attribute('data-surround', surround)
        assert session_eval(page, 's => s == null'), 'the monitor appears before game data arrives'
        data.pop().continue_()
        ready(page)
        expect(page.locator('#help-screen')).to_be_visible()
        expect(page.locator('#screen')).to_be_visible()
        assert not errors, errors
        page.close()

    page = browser.new_page()
    page.route('**/data/rooms.json', lambda route: route.fulfill(status=503, body='Unavailable'))
    with page.expect_console_message(predicate=lambda message: 'data/rooms.json: 503' in message.text):
        page.goto(BASE + '/play')
    page.unroute('**/data/rooms.json')
    page.reload()
    ready(page)
    expect(page.locator('#screen')).to_be_visible()
    page.close()

    browser.close()

print('browser_startup_test: early surround, load failure reporting and recovery passed')
