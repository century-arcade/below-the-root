"""Bundled icons and previews load with the right content types and decode."""
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(java_script_enabled=False)
    for path in ['/', '/play', '/resources', '/map']:
        response = page.goto(BASE + path)
        assert response.ok
        icon = page.locator('link[rel="icon"]')
        preview = page.locator('meta[property="og:image"]').get_attribute('content')
        for asset, content_type in [(icon.get_attribute('href'), 'image/svg+xml'),
                                    (urlsplit(preview).path, 'image/png')]:
            response = page.request.get(BASE + asset)
            assert response.ok
            assert response.headers['content-type'].split(';')[0] == content_type
            page.evaluate('''async url => {
                const image = new Image();
                image.src = url;
                await image.decode();
            }''', BASE + asset)
    browser.close()
    print('browser_metadata_test: favicon and preview content types and decoding passed')
