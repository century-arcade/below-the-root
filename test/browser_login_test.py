"""Login and reporting must work while logged out.
Run against make serve. OAuth navigation is intercepted; no GitHub login occurs.
"""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for action in ['r', 'R']:
        context = browser.new_context()
        page = context.new_page()
        page.route('**/.netlify/functions/github?op=session', lambda route: route.fulfill(
            json={"configured": True, "login": None}))
        page.route('**/.netlify/functions/github?op=login', lambda route: route.fulfill(
            content_type='text/html', body='<p>Reached login endpoint</p>'))
        page.goto(BASE + '/?debug&player=0')
        page.wait_for_function("localStorage.getItem('btr.autosave.v3') !== null")
        assert page.locator('#file-issue').count() == 0
        page.keyboard.press(action)
        page.get_by_text('Reached login endpoint').wait_for()
        assert page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v3')).initial.mode")
        context.close()
    browser.close()
    print('browser_login_test: R saves and starts login while logged out')
