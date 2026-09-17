"""World map controls and game hold; run against make serve."""
import os
from browser_helpers import install_probe, observe
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={"width": 900, "height": 750})
    # Keep authored-map experiments independent of the exploration scenarios.
    page.route('**/assets/initial-map.json', lambda route: route.fulfill(
        json={'rooms': ['M5', 'M8', 'B8']}))
    install_probe(page)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/play#map')
    page.locator('#map-screen').wait_for()
    assert page.locator('#map').is_visible()
    assert page.locator('#map-grid [aria-current="location"]').count() == 0
    page.locator('#home').click()
    assert page.locator('#map').is_visible()
    page.locator('#map').press('Enter')
    page.locator('#map-screen').wait_for()
    page.locator('#close-map').click()
    page.goto(BASE + '/?player=0')
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')

    def record():
        return observe(page)

    page.keyboard.press('Tab')
    page.locator('#map-screen').wait_for()
    stopped = record()['frame']
    page.wait_for_timeout(300)
    assert record()['frame'] == stopped, 'the map must hold game time'
    page.keyboard.press('Tab')
    page.locator('#map-screen').wait_for(state='hidden')
    page.wait_for_timeout(200)
    assert record()['frame'] > stopped

    # Outside the map, Tab on a control keeps browser focus navigation.
    page.locator('#map').focus()
    page.keyboard.press('Tab')
    assert not page.locator('#map-screen').is_visible()
    page.locator('#map').press('Enter')
    page.locator('#map-screen').wait_for()
    page.locator('#map-zoom-in').focus()
    stopped = record()['frame']
    page.keyboard.press('Space')
    page.wait_for_timeout(200)
    assert record()['frame'] == stopped, 'map controls must not send game input'
    page.keyboard.press('Escape')
    page.locator('#map-screen').wait_for(state='hidden')

    page.keyboard.press('Tab')  # closing returns focus to the canvas
    page.locator('#map-screen').wait_for()
    page.locator('#close-map').click()
    page.locator('#map-screen').wait_for(state='hidden')
    page.keyboard.press('Tab')
    page.locator('#map-screen').wait_for()
    # Observe pan requests, without depending on CSS or viewport geometry.
    page.evaluate('''() => {
        window.mapPans = [];
        const viewport = document.getElementById('map-viewport');
        const scrollBy = viewport.scrollBy.bind(viewport);
        viewport.scrollBy = options => {
            window.mapPans.push([Math.sign(options.left), Math.sign(options.top)]);
            scrollBy(options);
        };
    }''')
    stopped = record()['frame']
    for control in ['#screen', '#close-map', '#map-zoom-in']:
        page.locator(control).focus()
        for key in ['ArrowRight', 'd', 'ArrowLeft', 'a', 'ArrowUp', 'w', 'ArrowDown', 's', 'Shift+D']:
            page.keyboard.press(key)
        assert page.locator('#map-screen').is_visible(), 'movement pans without dismissing the map'
    assert page.evaluate('window.mapPans') == [[1, 0], [1, 0], [-1, 0], [-1, 0],
                                               [0, -1], [0, -1], [0, 1], [0, 1], [1, 0]] * 3
    # Physical keys retain their direction when the typed character changes,
    # including repeats while focus moves among map controls.
    page.evaluate('window.mapPans = []')
    for control in ['#close-map', '#map-zoom-in', '#map-viewport']:
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
    assert record()['frame'] == stopped, 'map navigation keeps the game held'
    page.keyboard.press('Escape')
    page.locator('#map-screen').wait_for(state='hidden')
    page.wait_for_timeout(200)
    assert all(r['stick'] == [0, 0, 0] for r in record()['events']), 'resuming from the map drops the movement key'

    page.locator('#map').press('Enter')
    page.get_by_role('button', name='Fullscreen', exact=True).click()
    page.wait_for_function('document.fullscreenElement !== null')
    assert page.locator('#map-screen').is_visible(), 'the map is available in fullscreen'
    page.keyboard.press('Tab')
    page.locator('#map-screen').wait_for(state='hidden')
    page.evaluate('document.exitFullscreen()')

    page.locator('#home').click()
    page.locator('#map').click()
    page.locator('#map-screen').wait_for()
    assert page.locator('#map-grid [aria-current="location"]').get_attribute('aria-label').startswith('M5 ·')

    for query in ['?menu', '?demo']:
        page.goto(BASE + '/' + query)
        page.wait_for_selector('#volume[aria-valuetext]', state='attached')
        assert page.locator('#map').is_visible()
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for()
        assert page.locator('#map-grid [aria-current="location"]').count() == 0
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for(state='hidden')
    page.goto(BASE + '/?player=1')
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    page.keyboard.press('Tab')
    page.locator('#map-screen').wait_for()
    assert page.locator('#map-grid [aria-current="location"]').get_attribute('aria-label').startswith('E6 ·')
    assert page.locator('#map-grid [aria-label^="I5 ·"]').count() == 0
    assert not errors, errors
    page.close()
    browser.close()
    print('browser_map_test: Tab dismissal, hold/resume, control isolation, panning and location passed')
