"""World map controls and game hold; run against make serve."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for width in [900, 390]:
        page = browser.new_page(viewport={"width": width, "height": 750})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?player=0')
        page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")

        def record():
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")

        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for()
        assert page.locator('#map-grid').evaluate(
            "grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length") == 25
        assert page.locator('#map-grid > *').count() == 300
        assert page.locator('#map-grid > button').count() == 195
        assert page.locator('#map-grid > button > canvas').count() == 195
        assert page.locator('#map-grid [aria-current="location"]').count() == 1
        assert page.locator('#map-grid [aria-current="location"]').get_attribute('aria-label').startswith('M5 ·')
        assert page.locator('#map-preview, #map-place').count() == 0
        for code in ['T1', 'T4', 'U5', 'P2', '0C']:
            assert page.locator(f'#map-grid button[aria-label^="{code} ·"]').count() == 0
        assert page.get_by_role('button', name='Zoom out', exact=True).is_disabled()
        page.get_by_role('button', name='Zoom in', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '2×'
        viewport = page.locator('#map-viewport')
        viewport.evaluate('v => { v.scrollLeft = 0; }')
        before = viewport.evaluate('v => v.scrollLeft')
        box = viewport.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 120, y, steps=8)
        page.mouse.up()
        assert viewport.evaluate('v => v.scrollLeft') > before, 'mouse drag pans the map'
        released = viewport.evaluate('v => v.scrollLeft')
        page.mouse.move(x, y)
        assert viewport.evaluate('v => v.scrollLeft') == released, 'release ends the drag'
        page.get_by_role('button', name='Zoom out', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '1×'
        assert 'PAUSED' not in page.locator('#where').inner_text()
        stopped = record()['frames']
        page.wait_for_timeout(300)
        assert record()['frames'] == stopped, 'the map must hold game time'
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for(state='hidden')
        page.wait_for_timeout(200)
        assert record()['frames'] > stopped

        # Tab on a control keeps browser focus navigation, including while open.
        page.locator('#map').focus()
        page.keyboard.press('Tab')
        assert not page.locator('#map-screen').is_visible()
        page.locator('#map').click()
        page.locator('#map-screen').wait_for()
        page.locator('#close-map').focus()
        page.keyboard.press('Tab')
        assert page.locator('#map-screen').is_visible()
        room = page.get_by_role('button', name='TO TEMPLE GRUND', exact=False)
        room.click()
        assert page.locator('#map-grid .selected').count() == 0
        room.dblclick()
        assert page.locator('#map-zoom').inner_text() == '2×'
        room.dblclick()
        assert page.locator('#map-zoom').inner_text() == '4×'
        viewport.evaluate('v => { v.scrollLeft = 0; }')
        before = viewport.evaluate('v => v.scrollLeft')
        page.get_by_role('button', name='Your location', exact=True).click()
        assert viewport.evaluate('v => v.scrollLeft') > before, 'Your location returns to the marker'
        assert page.locator('#map-grid [aria-current="location"]').count() == 1
        page.get_by_role('button', name='Zoom out', exact=True).click()
        page.get_by_role('button', name='Zoom out', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '1×'
        room.focus()
        stopped = record()['frames']
        page.keyboard.press('Space')
        page.wait_for_timeout(200)
        assert record()['frames'] == stopped, 'room buttons must not send game input'
        page.keyboard.press('Escape')
        page.locator('#map-screen').wait_for(state='hidden')

        page.keyboard.press('Tab')  # closing returns focus to the canvas
        page.locator('#map-screen').wait_for()
        page.locator('#close-map').click()
        page.locator('#map-screen').wait_for(state='hidden')
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for()
        page.keyboard.press('ArrowRight')
        page.locator('#map-screen').wait_for(state='hidden')
        page.wait_for_timeout(200)
        assert not record()['inputs'], 'resuming from the map drops the movement key'

        page.locator('#map').click()
        page.keyboard.press('f')
        page.wait_for_function('document.fullscreenElement !== null')
        assert page.locator('#map-screen').is_visible(), 'the map is available in fullscreen'
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for(state='hidden')
        page.evaluate('document.exitFullscreen()')

        # Visiting an area omitted from the paper map reveals it, including
        # after restoring the quest, without revealing its neighbours.
        for code, room_id, hidden_neighbour in [('0C', 384, '1C'), ('P2', 89, 'Q2')]:
            page.goto('http://localhost:8000/?room=' + code)
            page.wait_for_function("""room => {
                const saved = JSON.parse(localStorage.getItem('btr.autosave.v1'));
                return saved?.initial.room === room;
            }""", arg=room_id)
            page.keyboard.press('Tab')
            page.locator('#map-screen').wait_for()
            assert page.locator(f'#map-grid button[aria-label^="{code} ·"]').count() == 1
            assert page.locator(f'#map-grid button[aria-label^="{hidden_neighbour} ·"]').count() == 0
            if code == 'P2':
                assert page.locator('#map-grid').evaluate(
                    "grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length") == 26
            record()
            page.goto('http://localhost:8000/')
            page.wait_for_function("document.getElementById('map').onclick !== null")
            page.keyboard.press('Tab')
            page.locator('#map-screen').wait_for()
            assert page.locator(f'#map-grid button[aria-label^="{code} ·"]').count() == 1

        for query in ['?menu', '?demo']:
            page.goto('http://localhost:8000/' + query)
            page.wait_for_function("document.getElementById('map').hidden")
            page.keyboard.press('Tab')
            assert not page.locator('#map-screen').is_visible()
        assert not errors, errors
        page.close()
    context = browser.new_context(has_touch=True, viewport={"width": 390, "height": 750})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?player=0')
    page.wait_for_function("document.getElementById('map').onclick !== null")
    page.locator('#map').tap()
    page.get_by_role('button', name='Zoom in', exact=True).tap()
    viewport = page.locator('#map-viewport')
    viewport.evaluate('v => { v.scrollLeft = 0; }')
    before = viewport.evaluate('v => v.scrollLeft')
    box = viewport.bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    cdp = context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for step in range(1, 9):
        cdp.send('Input.dispatchTouchEvent', {
            'type': 'touchMove', 'touchPoints': [{'x': x - step * 15, 'y': y}]})
        page.wait_for_timeout(20)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.wait_for_function('before => document.getElementById("map-viewport").scrollLeft > before', arg=before)
    assert not errors, errors
    context.close()
    browser.close()
    print('browser_map_test: cropped paper map, exploration, location, zoom, double-click, mouse/touch pan, hold/resume, native Tab, input reset, fullscreen, title/demo passed')
