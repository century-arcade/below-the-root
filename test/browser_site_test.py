"""Clean page URLs, Markdown content, history and saved-game navigation."""
import json
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
        expect(page).to_have_url(BASE + '/about')
        expect(page.get_by_role('heading', name='Below the Root', exact=True)).to_be_visible()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('About')
        page.get_by_role('navigation').get_by_role('link', name='Resources').click()
        expect(page).to_have_url(BASE + '/resources')
        expect(page.get_by_role('heading', name='Resources', exact=True)).to_be_visible()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Resources')
        expect(page.get_by_role('link', name='Phil Salvador: Below the Root', exact=True)).to_be_visible()
        page.go_back()
        expect(page).to_have_url(BASE + '/about')
        page.go_forward()
        expect(page).to_have_url(BASE + '/resources')
        page.reload()
        expect(page.get_by_role('heading', name='Resources', exact=True)).to_be_visible()
        page.go_back()
        page.locator('.play-button').click()
        expect(page).to_have_url(BASE + '/play')
        page.wait_for_selector('#mute[aria-pressed]', state='attached')
        expect(page.locator('#screen')).to_be_focused()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Play')
        page.go_back()
        expect(page).to_have_url(BASE + '/about')
        # Query entry links still work, with all game assets loaded from the site root.
        for query in ['?demo', '?room=T1']:
            page.goto(BASE + '/' + query)
            expect(page).to_have_url(BASE + '/play' + query)
            page.wait_for_selector('#mute[aria-pressed]', state='attached')
            expect(page.locator('#screen')).to_be_focused()
        page.keyboard.press('ArrowRight')
        page.get_by_role('navigation').get_by_role('link', name='About', exact=True).click()
        before = page.evaluate("localStorage.getItem('btr.autosave.v1')")
        assert before, 'Leaving Play saves the quest'
        for name in ['About', 'Resources']:
            page.get_by_role('navigation').get_by_role('link', name=name, exact=True).click()
            expect(page.locator('#screen')).to_have_count(0)
            for key in ['h', 'o', 'p', 'ArrowRight', 'Space']:
                page.keyboard.press(key)
            assert page.evaluate("localStorage.getItem('btr.autosave.v1')") == before
        page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).focus()
        page.keyboard.press('Enter')
        page.wait_for_selector('#mute[aria-pressed]', state='attached')
        expect(page.locator('#screen')).to_be_focused()
        page.evaluate("dispatchEvent(new Event('pagehide'))")
        restored = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
        saved = json.loads(before)
        assert restored['initial'] == saved['initial'], 'Play restores the previous session'
        assert restored['inputs'][:len(saved['inputs'])] == saved['inputs']
        page.goto(BASE + '/')
        expect(page).to_have_url(BASE + '/play')
        # Explicit pages take precedence over an autosave and game parameters.
        page.goto(BASE + '/about?room=B8')
        expect(page.locator('#about')).to_be_visible()
        expect(page.locator('#screen')).to_have_count(0)
        for legacy, target in [('/#about', '/about'), ('/#play', '/play'),
                               ('/?room=B8#resources', '/resources?room=B8')]:
            page.goto(BASE + legacy)
            expect(page).to_have_url(BASE + target)
        for name in ['about', 'resources', 'play']:
            response = page.goto(BASE + '/' + name + '/')
            assert response.ok
            expect(page).to_have_url(BASE + '/' + name + '/')
            page.reload()
            expect(page.locator('#site-header a[aria-current]')).to_have_text(name.capitalize())
        assert not errors, errors
        page.close()
    # Reading pages are complete HTML and work without JavaScript or storage.
    page = browser.new_page(java_script_enabled=False)
    for name in ['about', 'resources']:
        response = page.goto(BASE + '/' + name)
        assert response.ok
        expect(page.locator('main h1')).to_be_visible()
        expect(page.get_by_role('navigation').get_by_role('link', name='Play')).to_have_attribute('href', '/play')
    page.close()
    page = browser.new_page()
    page.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked')}})")
    page.goto(BASE + '/')
    expect(page).to_have_url(BASE + '/about')
    page.locator('.play-button').click()
    expect(page.locator('#screen')).to_be_focused()
    browser.close()
    print('browser_site_test: URLs, Markdown pages, history, focus, saves and storage passed')
