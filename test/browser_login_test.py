"""Login must work even when the background session request is pending or fails.
Run against make serve. OAuth navigation is intercepted; no GitHub login occurs.
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for mode in ['pending', 'failed']:
        context = browser.new_context()
        page = context.new_page()
        if mode == 'pending':
            page.add_init_script("""const originalFetch = window.fetch;
              window.fetch = (url, ...args) => String(url).includes('?op=session')
                ? new Promise(() => {}) : originalFetch(url, ...args);""")
        else:
            page.route('**/.netlify/functions/github?op=session', lambda route: route.abort())
        page.route('**/.netlify/functions/github?op=login', lambda route: route.fulfill(
            content_type='text/html', body='<p>Reached login endpoint</p>'))
        page.goto('http://localhost:8000/?debug&player=0')
        page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
        page.locator('#github-login').click()
        page.get_by_text('Reached login endpoint').wait_for()
        assert page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).checkpoint.quest")
        context.close()
    browser.close()
    print('browser_login_test: pending/failed session checks do not block login; quest is saved first')
