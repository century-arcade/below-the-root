"""Site entry, navigation and uninterrupted background play; run against make serve."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for width in [1200, 390]:
        page = browser.new_page(viewport={'width': width, 'height': 800})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/')
        page.wait_for_selector('#mute[aria-pressed]', state='attached')
        expect(page.locator('#about')).to_be_visible()
        expect(page.locator('#play')).to_be_hidden()
        expect(page.locator('#resources')).to_be_hidden()
        expect(page.locator('#top-controls')).to_be_hidden()
        expect(page.locator('#site-header a[href="#about"]')).to_have_attribute('aria-current', 'page')
        page.locator('#site-header a[href="#resources"]').click()
        expect(page.get_by_role('heading', name='Resources', exact=True)).to_be_visible()
        expect(page.locator('#about')).to_be_hidden()
        expect(page.locator('#play')).to_be_hidden()
        expect(page.locator('#top-controls')).to_be_hidden()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Resources')
        expect(page.locator('#resources').get_by_role('link', name='Phil Salvador: Below the Root', exact=True)).to_be_visible()
        page.go_back()
        expect(page.locator('#about')).to_be_visible()
        page.go_forward()
        expect(page.locator('#resources')).to_be_visible()
        page.reload()
        expect(page.locator('#resources')).to_be_visible()
        page.go_back()
        page.locator('.play-button').click()
        expect(page.locator('#play')).to_be_visible()
        expect(page.locator('#about')).to_be_hidden()
        expect(page.locator('#top-controls')).to_be_visible()
        expect(page.locator('#screen')).to_be_focused()
        expect(page.locator('#site-header a[href="#play"]')).to_have_attribute('aria-current', 'page')
        # A save created after entering Play must not change the initial history entry.
        page.evaluate("localStorage.setItem('btr.autosave.v1', '{}')")
        page.go_back()
        expect(page.locator('#about')).to_be_visible()
        page.evaluate('localStorage.clear()')
        for query in ['?demo', '?room=T1']:
            page.goto(BASE + '/' + query)
            page.wait_for_selector('#mute[aria-pressed]', state='attached')
            expect(page.locator('#play')).to_be_visible()
            expect(page.locator('#top-controls')).to_be_visible()
            expect(page.locator('#screen')).to_be_focused()
        # The player falls into this outdoor room when the quest starts.
        page.goto(BASE + '/?room=B8')
        page.wait_for_selector('#mute[aria-pressed]', state='attached')
        page.locator('#site-header a[href="#about"]').click()
        expect(page.locator('#play')).to_be_hidden()
        frame = page.locator('#screen').evaluate('canvas => canvas.toDataURL()')
        page.wait_for_timeout(1000)
        assert page.locator('#screen').evaluate('canvas => canvas.toDataURL()') != frame, 'About must keep drawing the quest'
        # Reading-page keys must neither open overlays nor steer the quest.
        for tab in ['about', 'resources']:
            page.locator(f'#site-header a[href="#{tab}"]').click()
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            before = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
            for key in ['h', 'o', 'p', 'ArrowRight', 'Space']:
                page.keyboard.press(key)
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            after = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
            assert after['inputs'] == before['inputs'], f'{tab} must not steer the quest'
            assert not page.locator('#options-dialog').evaluate('dialog => dialog.open')
            assert page.locator('#help-screen').evaluate('screen => screen.hidden')
        page.locator('#site-header a[href="#play"]').focus()
        page.keyboard.press('Enter')
        expect(page.locator('#play')).to_be_visible()
        expect(page.locator('#screen')).to_be_focused()
        page.goto(BASE + '/')
        expect(page.locator('#play')).to_be_visible()  # returning player
        page.goto(BASE + '/#about')
        expect(page.locator('#about')).to_be_visible()  # explicit hash wins over save
        page.goto(BASE + '/?room=B8#resources')
        expect(page.locator('#resources')).to_be_visible()  # wins over query and save
        expect(page.locator('#play')).to_be_hidden()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Resources')
        assert not errors, errors
        page.close()
    # Restricted storage must still leave the introduction usable.
    page = browser.new_page()
    page.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked')}})")
    page.goto(BASE + '/')
    expect(page.locator('#about')).to_be_visible()
    page.locator('#site-header a[href="#resources"]').click()
    expect(page.locator('#resources')).to_be_visible()
    page.locator('#site-header a[href="#about"]').click()
    page.locator('.play-button').click()
    expect(page.locator('#screen')).to_be_focused()
    browser.close()
    print('browser_site_test: entry, history, focus, background frames, input isolation and storage passed')
