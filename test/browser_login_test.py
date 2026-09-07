"""Login and reporting must work while logged out or session lookup is unavailable.
Run against make serve. OAuth navigation is intercepted; no GitHub login occurs.
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for mode in ['pending', 'failed', 'logged-out', 'logout']:
        for action in ['login', 'report', 'shortcut']:
            context = browser.new_context()
            page = context.new_page()
            if mode == 'pending':
                page.add_init_script("""const originalFetch = window.fetch;
                  window.fetch = (url, ...args) => String(url).includes('?op=session')
                    ? new Promise(() => {}) : originalFetch(url, ...args);""")
            elif mode == 'failed':
                page.route('**/.netlify/functions/github?op=session', lambda route: route.abort())
            else:
                page.route('**/.netlify/functions/github?op=session', lambda route: route.fulfill(
                    json={"configured": True, "login": "tester" if mode == 'logout' else None}))
            page.route('**/.netlify/functions/github?op=logout', lambda route: route.fulfill(json={}))
            page.route('**/.netlify/functions/github?op=login', lambda route: route.fulfill(
                content_type='text/html', body='<p>Reached login endpoint</p>'))
            page.goto('http://localhost:8000/?debug&player=0')
            page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
            if mode == 'logout':
                page.locator('#github-logout').click()
                page.locator('#github-login').wait_for()
            assert page.locator('#file-issue').is_visible(), mode
            # Remove the initial autosave to verify the action itself saves the quest.
            page.evaluate("localStorage.removeItem('btr.autosave.v1')")
            if action == 'shortcut':
                page.keyboard.press('r')
            else:
                page.locator('#github-login' if action == 'login' else '#file-issue').click()
            page.get_by_text('Reached login endpoint').wait_for()
            assert page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).checkpoint.quest")
            context.close()
    browser.close()
    print('browser_login_test: login/report/R save and start login with pending, failed, logged-out, and cleared sessions')
