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
        assert page.locator('#map-grid > button').count() == 438
        assert page.locator('#map-grid > button > canvas').count() == 438
        assert page.locator('#map-grid [aria-current="location"]').count() == 1
        assert 'current room' in page.locator('#map-place').inner_text()
        assert page.get_by_role('button', name='Zoom out', exact=True).is_disabled()
        page.get_by_role('button', name='Zoom in', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '2×'
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
        room = page.get_by_role('button', name='THE LAPAN HOUSE', exact=False)
        room.click()
        assert 'THE LAPAN HOUSE' in page.locator('#map-place').inner_text()
        assert 'THE LAPAN HOUSE' in page.locator('#map-preview').get_attribute('aria-label')
        page.get_by_role('button', name='Current room', exact=True).click()
        assert 'current room' in page.locator('#map-place').inner_text()
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

        for query in ['?menu', '?demo']:
            page.goto('http://localhost:8000/' + query)
            page.wait_for_function("document.getElementById('map').hidden")
            page.keyboard.press('Tab')
            assert not page.locator('#map-screen').is_visible()
        assert not errors, errors
        page.close()
    browser.close()
    print('browser_map_test: room canvases, zoom, preview, hold/resume, native Tab, input reset, fullscreen, title/demo passed')
