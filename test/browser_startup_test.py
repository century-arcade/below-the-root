"""Startup hides the unfitted monitor and reports slow or failed loading."""
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
        page.add_init_script(f"localStorage.setItem('btr.surround', '{surround}')")
        modules, data = [], []
        page.route('**/main.js', lambda route: modules.append(route))
        page.route('**/data/rooms.json', lambda route: data.append(route))
        page.goto(BASE + '/play', wait_until='commit')
        status = page.get_by_role('status')
        expect(status).to_contain_text('Loading game')
        expect(status.get_by_role('link', name='Reload page')).to_be_visible()
        expect(page.locator('#monitor')).to_be_hidden()
        expect(page.locator('#screen')).to_be_hidden()
        with page.expect_request('**/data/rooms.json'):
            modules.pop().continue_()
        expect(page.locator('#monitor')).to_be_visible()
        expect(page.locator('#screen')).to_be_visible()
        expect(page.locator('#monitor')).to_have_attribute('data-surround', surround)
        expect(status).to_contain_text('Loading game')
        assert session_eval(page, 's => s == null'), 'the monitor appears before game data arrives'
        data.pop().continue_()
        ready(page)
        expect(status).to_be_hidden()
        expect(page.locator('#help-screen')).to_be_visible()
        expect(page.locator('#screen')).to_be_visible()
        assert not errors, errors
        page.close()

    page = browser.new_page()
    page.clock.install(time=0)
    page.clock.pause_at(0)
    page.route('**/data/rooms.json', lambda route: route.fulfill(status=503, body='Unavailable'))
    page.goto(BASE + '/play')
    status = page.get_by_role('status')
    expect(status).to_contain_text('The game could not load: data/rooms.json: 503')
    page.clock.run_for(11000)
    expect(page.locator('#log')).to_be_hidden()
    expect(status).to_be_visible()
    expect(status.get_by_role('link', name='Reload page')).to_be_visible()
    page.unroute('**/data/rooms.json')
    status.get_by_role('link', name='Reload page').click()
    ready(page)
    expect(status).to_be_hidden()
    expect(page.locator('#screen')).to_be_visible()
    page.close()

    page = browser.new_page()
    page.route('**/main.js', lambda route: route.abort())
    page.goto(BASE + '/play')
    expect(page.locator('#monitor')).to_be_hidden()
    expect(page.get_by_role('status')).to_contain_text('if it does not start')
    expect(page.get_by_role('link', name='Reload page')).to_be_visible()
    browser.close()

print('browser_startup_test: slow modules, early surround, startup and failure recovery passed')
