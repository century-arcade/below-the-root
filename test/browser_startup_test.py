"""Failed game-data loads report to the console and can recover on reload."""
import os
from playwright.sync_api import sync_playwright, expect
from browser_helpers import ready, power_on


BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    page.route('**/data/rooms.json', lambda route: route.fulfill(status=503, body='Unavailable'))
    with page.expect_console_message(predicate=lambda message: 'data/rooms.json: 503' in message.text):
        page.goto(BASE + '/play')
    page.unroute('**/data/rooms.json')
    page.reload()
    ready(page)
    power_on(page)
    expect(page.locator('#screen')).to_be_visible()
    page.close()

    browser.close()

print('browser_startup_test: load failure reporting and recovery passed')
