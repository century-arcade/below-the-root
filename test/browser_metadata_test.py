"""Public metadata and locally bundled icons/previews work without page scripts."""
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')
ORIGIN = 'https://below-the-root.netlify.app'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(java_script_enabled=False)
    for path, canonical, title in [('/', '/', 'Play'), ('/play', '/', 'Play'),
                                   ('/about', '/about', 'About'),
                                   ('/links', '/links', 'Links'), ('/map', '/map', 'Map')]:
        response = page.goto(BASE + path)
        assert response.ok
        expect(page).to_have_title(f'{title} — Below the Root')
        expect(page.locator('link[rel="canonical"]')).to_have_attribute('href', ORIGIN + canonical)
        expect(page.locator('meta[property="og:url"]')).to_have_attribute('content', ORIGIN + canonical)
        description = page.locator('meta[name="description"]').get_attribute('content')
        assert description
        for prefix, attribute in [('og', 'property'), ('twitter', 'name')]:
            expect(page.locator(f'meta[{attribute}="{prefix}:title"]')).to_have_attribute('content', page.title())
            expect(page.locator(f'meta[{attribute}="{prefix}:description"]')).to_have_attribute('content', description)
            expect(page.locator(f'meta[{attribute}="{prefix}:image"]')).to_have_attribute('content', ORIGIN + '/assets/box/screen.png')
        expect(page.locator('meta[property="og:type"]')).to_have_attribute('content', 'website')
        expect(page.locator('meta[property="og:site_name"]')).to_have_attribute('content', 'Below the Root')
        expect(page.locator('meta[name="twitter:card"]')).to_have_attribute('content', 'summary_large_image')
        icon = page.locator('link[rel="icon"]')
        expect(icon).to_have_attribute('type', 'image/svg+xml')
        expect(icon).to_have_attribute('href', '/assets/favicon.svg')
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
    print('browser_metadata_test: canonical metadata, favicon and preview loading passed')
