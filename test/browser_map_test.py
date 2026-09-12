"""World map controls and game hold; run against make serve."""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for width in [900, 390]:
        page = browser.new_page(viewport={"width": width, "height": 750})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/?player=0')
        page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")

        def record():
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")

        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for()
        assert page.locator('#map-grid > [role="img"]').count() == 169
        assert page.locator('#map-grid > span > canvas').count() == 169
        assert page.locator('#map-grid [aria-current="location"]').count() == 1
        assert page.locator('#map-grid [aria-current="location"]').get_attribute('aria-label').startswith('M5 ·')
        assert page.locator('#map-grid > span').count() == 32 * 16
        assert page.locator('#map-grid .unseen').count() == 32 * 16 - 169
        assert page.locator('#map-grid button, #map-grid [tabindex]').count() == 0
        assert page.locator('#close-map').text_content() == 'Close'
        for code in ['T1', 'T4', 'U5', 'P2', '0C']:
            assert page.locator(f'#map-grid [role="img"][aria-label^="{code} ·"]').count() == 0
        assert page.get_by_role('button', name='Zoom out', exact=True).is_disabled()
        page.get_by_role('button', name='Zoom in', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '2×'
        viewport = page.locator('#map-viewport')
        page.get_by_role('button', name='Zoom out', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '1×'
        viewport.hover()
        for delta, expected in [(-100, '2×'), (-100, '4×'), (-100, '8×'),
                                (-100, '8×'), (100, '4×'), (100, '2×'),
                                (100, '1×'), (100, '1×')]:
            page.mouse.wheel(0, delta)
            page.wait_for_function("expected => document.getElementById('map-zoom').textContent === expected", arg=expected)
        assert page.locator('#map-grid > span').count() == 32 * 16
        assert 'PAUSED' not in page.locator('#where').inner_text()
        stopped = record()['frames']
        page.wait_for_timeout(300)
        assert record()['frames'] == stopped, 'the map must hold game time'
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for(state='hidden')
        page.wait_for_timeout(200)
        assert record()['frames'] > stopped

        # Outside the map, Tab on a control keeps browser focus navigation.
        page.locator('#map').focus()
        page.keyboard.press('Tab')
        assert not page.locator('#map-screen').is_visible()
        page.locator('#map').press('Enter')
        page.locator('#map-screen').wait_for()
        for control in ['#close-map', '#map-zoom-in']:
            page.locator(control).focus()
            page.keyboard.press('Tab')
            page.locator('#map-screen').wait_for(state='hidden')
            page.keyboard.press('Tab')
            page.locator('#map-screen').wait_for()
        page.locator('#close-map').focus()
        page.keyboard.press('Shift+Tab')
        page.locator('#map-screen').wait_for(state='hidden')
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for()
        room = page.get_by_role('img', name='TO TEMPLE GRUND', exact=False)
        room.click()
        assert page.locator('#map-grid .selected').count() == 0
        room.dblclick()
        assert page.locator('#map-zoom').inner_text() == '2×'
        room.dblclick()
        assert page.locator('#map-zoom').inner_text() == '4×'
        assert page.locator('#map-grid [aria-current="location"]').count() == 1
        page.get_by_role('button', name='Zoom out', exact=True).click()
        page.get_by_role('button', name='Zoom out', exact=True).click()
        assert page.locator('#map-zoom').inner_text() == '1×'
        page.locator('#map-zoom-in').focus()
        stopped = record()['frames']
        page.keyboard.press('Space')
        page.wait_for_timeout(200)
        assert record()['frames'] == stopped, 'map controls must not send game input'
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

        page.locator('#map').press('Enter')
        page.keyboard.press('f')
        page.wait_for_function('document.fullscreenElement !== null')
        assert page.locator('#map-screen').is_visible(), 'the map is available in fullscreen'
        page.keyboard.press('Tab')
        page.locator('#map-screen').wait_for(state='hidden')
        page.evaluate('document.exitFullscreen()')

        # Visiting an area omitted from the paper map reveals it, including
        # after restoring the quest, without revealing its neighbours.
        for code, room_id, hidden_neighbour in [('0C', 384, '1C'), ('P2', 89, 'Q2')]:
            page.goto(BASE + '/?room=' + code)
            page.wait_for_function("""room => {
                const saved = JSON.parse(localStorage.getItem('btr.autosave.v1'));
                return saved?.initial.room === room;
            }""", arg=room_id)
            page.keyboard.press('Tab')
            page.locator('#map-screen').wait_for()
            assert page.locator(f'#map-grid [role="img"][aria-label^="{code} ·"]').count() == 1
            assert page.locator(f'#map-grid [role="img"][aria-label^="{hidden_neighbour} ·"]').count() == 0
            record()
            page.goto(BASE + '/')
            page.wait_for_function("document.getElementById('map').onclick !== null")
            page.keyboard.press('Tab')
            page.locator('#map-screen').wait_for()
            assert page.locator(f'#map-grid [role="img"][aria-label^="{code} ·"]').count() == 1

        for query in ['?menu', '?demo']:
            page.goto(BASE + '/' + query)
            page.wait_for_function("document.getElementById('map').hidden")
            page.keyboard.press('Tab')
            assert not page.locator('#map-screen').is_visible()
        assert not errors, errors
        page.close()
    browser.close()
    print('browser_map_test: full map, exploration, location, zoom, Tab dismissal, hold/resume, input reset, fullscreen, title/demo passed')
