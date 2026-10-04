"""World map keyboard controls, game hold and quest location."""
import os
from browser_helpers import browser_page, observe, held, until
from playwright.sync_api import expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')


def setup(page):
    page.route('**/assets/initial-map.json', lambda route: route.fulfill(
        json={'rooms': ['M5', 'M8', 'B8']}))


with browser_page('/map', setup=setup, viewport={"width": 900, "height": 750}) as page:
    paper = page.locator('#paper-map')
    expect(paper).to_be_visible()
    assert page.url.endswith('/map')
    expect(page.locator('#map-grid [aria-current="location"]')).to_have_count(0)
    page.goto(BASE + '/?player=0')
    until(page, 's => s.frame > 0')
    page.keyboard.press('Tab')
    expect(paper).to_be_visible()
    held(page, 'map')
    expect(page.locator('#map-zoom-out')).to_be_disabled()
    page.locator('#map-zoom-in').press('Space')
    expect(page.locator('#map-zoom-out')).to_be_enabled()
    held(page, 'map')
    page.evaluate('''() => {
        window.mapPans = [];
        const viewport = document.getElementById('map-viewport');
        const scrollBy = viewport.scrollBy.bind(viewport);
        viewport.scrollBy = options => {
            window.mapPans.push([Math.sign(options.left), Math.sign(options.top)]);
            scrollBy(options);
        };
    }''')
    stopped = observe(page)['frame']
    for control in ['#map-zoom-in', '#map-zoom-out']:
        page.locator(control).focus()
        for key in ['ArrowRight', 'd', 'ArrowLeft', 'a', 'ArrowUp', 'w', 'ArrowDown', 's', 'Shift+D']:
            page.keyboard.press(key)
        expect(paper).to_be_visible()
    assert page.evaluate('window.mapPans') == [[1, 0], [1, 0], [-1, 0], [-1, 0],
                                               [0, -1], [0, -1], [0, 1], [0, 1], [1, 0]] * 2
    page.evaluate('window.mapPans = []')
    for control in ['#map-zoom-in', '#map-zoom-out', '#map-viewport']:
        page.locator(control).evaluate("""target => {
            for (const [code, key] of [['KeyD', 's'], ['KeyS', 'd']]) {
                for (const repeat of [false, true, true]) {
                    target.dispatchEvent(new KeyboardEvent('keydown', {
                        code, key, repeat, bubbles: true, cancelable: true,
                    }));
                }
                target.dispatchEvent(new KeyboardEvent('keyup', {
                    code, key, bubbles: true, cancelable: true,
                }));
            }
        }""")
    assert page.evaluate('window.mapPans') == ([[1, 0]] * 3 + [[0, 1]] * 3) * 3
    assert observe(page)['frame'] == stopped, 'map navigation keeps the game held'
    page.keyboard.press('Tab')
    expect(paper).to_be_hidden()
    expect(page.locator('#screen')).to_be_focused()
    page.keyboard.press('p')
    until(page, '(s, frame) => s.frame > frame', stopped)
    assert all(r['stick'] == [0, 0, 0] for r in observe(page)['events']), 'map keys do not steer'

    for key in ['m', 'Shift+M']:
        page.keyboard.press('m')
        expect(paper).to_be_visible()
        page.locator('#map-zoom-in').focus()
        page.keyboard.press(key)
        expect(paper).to_be_hidden()
        expect(page.locator('#screen')).to_be_focused()

    page.get_by_role('button', name='Fullscreen', exact=True).click()
    page.wait_for_function('document.fullscreenElement !== null')
    page.locator('#screen').focus()
    page.keyboard.press('Tab')
    expect(paper).to_be_visible()
    page.keyboard.press('Tab')
    expect(paper).to_be_hidden()
    page.evaluate('document.exitFullscreen()')
    page.wait_for_function('document.fullscreenElement === null')

    page.keyboard.press('m')
    expect(paper).to_be_visible()
    assert page.locator('#map-grid [aria-current="location"]').get_attribute('aria-label').startswith('M5 ·')
    for query in ['?menu', '?demo']:
        page.goto(BASE + '/' + query)
        until(page, 's => !!s')
        page.keyboard.press('Tab')
        expect(paper).to_be_visible()
        expect(page.locator('#map-grid [aria-current="location"]')).to_have_count(0)
    page.goto(BASE + '/?player=1')
    until(page, 's => s.state.quest')
    page.keyboard.press('Tab')
    expect(paper).to_be_visible()
    assert page.locator('#map-grid [aria-current="location"]').get_attribute('aria-label').startswith('E6 ·')
    expect(page.locator('#map-grid [aria-label^="I5 ·"]')).to_have_count(0)

with browser_page('/map', setup=setup, viewport={"width": 412, "height": 915}, has_touch=True) as page:
    viewport = page.locator('#map-viewport').bounding_box()
    assert viewport
    cdp = page.context.new_cdp_session(page)
    cx, cy = viewport['x'] + viewport['width'] / 2, viewport['y'] + viewport['height'] / 2

    def pinch(start, end):
        for i, spread in enumerate([start, (start + end) / 2, end]):
            cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchStart' if i == 0 else 'touchMove',
                'touchPoints': [{'x': cx - spread, 'y': cy, 'id': 1}, {'x': cx + spread, 'y': cy, 'id': 2}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

    expect(page.locator('#map-zoom-out')).to_be_disabled()
    pinch(20, 80)
    expect(page.locator('#map-zoom-out')).to_be_enabled()
    pinch(80, 10)
    expect(page.locator('#map-zoom-out')).to_be_disabled()
    print('browser_map_test: keyboard dismissal, hold, control isolation, panning, location and pinch zoom passed')
