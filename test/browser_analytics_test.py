"""Public pageviews, redirect deduplication and offline isolation with mocked analytics."""
import mimetypes
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright, expect
from browser_helpers import ready, observe, until

BUILD = Path(__file__).resolve().parents[1] / '_build'
ORIGIN = 'https://below-the-root.netlify.app'
SCRIPT = 'https://gc.zgo.at/count.js'
ENDPOINT = 'https://saulpw.goatcounter.com/count'
MOCK = '''
const endpoint = document.currentScript.dataset.goatcounter;
window.analyticsInitializations = (window.analyticsInitializations || 0) + 1;
window.goatcounter = {count() {
    const path = new URL(document.querySelector('link[rel="canonical"]').href).pathname;
    const pixel = new Image();
    pixel.src = endpoint + '?p=' + encodeURIComponent(path);
}};
window.goatcounter.count();
'''


def intercept(page, origin=ORIGIN, mode='mock'):
    scripts, counts, unexpected, pending, errors = [], [], [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def route_request(route):
        url = route.request.url
        parsed = urlsplit(url)
        if url == SCRIPT:
            scripts.append(url)
            if mode == 'blocked':
                route.abort()
            elif mode == 'stalled':
                pending.append(route)
            else:
                route.fulfill(content_type='text/javascript', body=MOCK)
        elif url.startswith(ENDPOINT + '?'):
            counts.append(parse_qs(parsed.query)['p'][0])
            route.fulfill(status=204)
        elif f'{parsed.scheme}://{parsed.netloc}' == origin:
            if parsed.path == '/.netlify/functions/github':
                route.fulfill(json={'configured': False})
                return
            path = parsed.path.strip('/') or 'index'
            if path in ('index', 'play', 'map', 'about', 'links'):
                path += '.html'
            target = BUILD / path
            assert target.is_file(), url
            route.fulfill(path=target, content_type=mimetypes.guess_type(target)[0]
                          or 'application/octet-stream')
        else:
            unexpected.append(url)
            route.abort()

    page.route('**/*', route_request)
    return scripts, counts, unexpected, pending, errors


def restart_analytics(page):
    page.evaluate('''async () => {
        const { startAnalytics } = await import('/analytics.js');
        startAnalytics();
        startAnalytics();
    }''')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for path, canonical in [('/', '/'), ('/index.html', '/'), ('/play', '/'),
                            ('/play.html', '/'), ('/map', '/map'), ('/map.html', '/map'),
                            ('/about', '/about'), ('/links', '/links')]:
        page = browser.new_page()
        scripts, counts, unexpected, pending, errors = intercept(page)
        with page.expect_request(ENDPOINT + '?*'):
            page.goto(ORIGIN + path)
        restart_analytics(page)
        assert page.evaluate('window.analyticsInitializations') == 1
        expect(page.locator('script[data-goatcounter]')).to_have_count(1)
        assert scripts == [SCRIPT] and counts == [canonical], (scripts, counts)
        assert not unexpected and not errors, (unexpected, errors)
        page.close()

    for entry in ['/', '/index.html']:
        for fragment, destination in [('about', 'about'), ('links', 'links'), ('resources', 'links')]:
            page = browser.new_page()
            scripts, counts, unexpected, pending, errors = intercept(page)
            with page.expect_request(ENDPOINT + '?*'):
                page.goto(f'{ORIGIN}{entry}?source=legacy#{fragment}')
            expect(page).to_have_url(f'{ORIGIN}/{destination}?source=legacy')
            page.wait_for_load_state('load')
            assert scripts == [SCRIPT] and counts == ['/' + destination], (scripts, counts)
            assert not unexpected and not errors, (unexpected, errors)
            page.close()

    for mode in ['mock', 'blocked', 'stalled']:
        page = browser.new_page()
        page.clock.install(time=0)
        page.clock.pause_at(0)
        scripts, counts, unexpected, pending, errors = intercept(page, mode=mode)
        page.goto(ORIGIN + '/?player=0', wait_until='domcontentloaded')
        ready(page)
        until(page, 's => s.frame > 0')
        assert observe(page)['quest']
        page.locator('#map').click()
        expect(page.locator('#map-screen')).to_be_visible()
        page.keyboard.press('Escape')
        page.locator('#help').click()
        expect(page.locator('#help-screen')).to_be_visible()
        page.keyboard.press('Escape')
        restart_analytics(page)
        page.clock.run_for(1000)
        assert scripts == [SCRIPT], scripts
        assert counts == (['/'] if mode == 'mock' else []), counts
        assert len(pending) == (1 if mode == 'stalled' else 0)
        assert not unexpected and not errors, (unexpected, errors)
        for route in pending:
            route.abort()
        page.close()

    for origin in ['http://localhost:8000', 'http://127.0.0.1', 'http://[::1]',
                   'http://192.168.1.1', 'http://10.0.0.1', 'http://172.16.0.1',
                   'https://preview.netlify.app', 'http://below-the-root.netlify.app']:
        page = browser.new_page()
        scripts, counts, unexpected, pending, errors = intercept(page, origin)
        page.goto(origin + '/')
        ready(page)
        restart_analytics(page)
        assert not scripts and not counts and not unexpected and not errors
        page.close()
    browser.close()

print('browser_analytics_test: mocked pageviews, redirects, idempotency, local isolation and unavailable script passed')
