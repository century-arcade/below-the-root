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
        expect(page).to_have_url(BASE + '/')
        expect(page.locator('#screen')).to_be_visible()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Play')
        expect(page.get_by_role('navigation').get_by_role('link')).to_have_text(['Play', 'Map', 'About', 'Links'])
        page.get_by_role('navigation').get_by_role('link', name='Links').click()
        expect(page).to_have_url(BASE + '/links')
        expect(page.get_by_role('heading', name='Links', exact=True)).to_be_visible()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Links')
        expect(page.get_by_role('link', name='Phil Salvador: Below the Root', exact=True)).to_be_visible()
        page.go_back()
        expect(page).to_have_url(BASE + '/')
        page.go_forward()
        expect(page).to_have_url(BASE + '/links')
        page.reload()
        expect(page.get_by_role('heading', name='Links', exact=True)).to_be_visible()
        page.goto(BASE + '/play#help')
        expect(page).to_have_url(BASE + '/play#help')
        expect(page.locator('#help-screen')).to_be_visible()
        page.get_by_role('navigation').get_by_role('link', name='About', exact=True).click()
        page.locator('.play-button').click()
        expect(page).to_have_url(BASE + '/play')
        page.wait_for_selector('#volume[aria-valuetext]', state='attached')
        expect(page.get_by_role('button', name='Help', exact=True)).to_be_focused()
        page.keyboard.press('Enter')
        expect(page.locator('#help-screen')).to_be_hidden()
        expect(page.locator('#help')).to_be_focused()
        expect(page.locator('#site-header a[aria-current]')).to_have_text('Play')
        page.go_back()
        expect(page).to_have_url(BASE + '/about')
        # Query entry links still work, with all game assets loaded from the site root.
        for query in ['?demo', '?room=T1']:
            page.goto(BASE + '/' + query)
            expect(page).to_have_url(BASE + '/' + query)
            page.wait_for_selector('#volume[aria-valuetext]', state='attached')
            expect(page.locator('#screen')).to_be_focused()
        page.keyboard.press('ArrowRight')
        page.get_by_role('navigation').get_by_role('link', name='About', exact=True).click()
        before = page.evaluate("localStorage.getItem('btr.autosave.v3')")
        assert before, 'Leaving Play saves the quest'
        for name in ['About', 'Links']:
            page.get_by_role('navigation').get_by_role('link', name=name, exact=True).click()
            expect(page.locator('#screen')).to_have_count(0)
            expect(page.get_by_role('slider', name='Volume', exact=True)).to_have_count(0)
            expect(page.get_by_role('button', name='Fullscreen', exact=True)).to_have_count(0)
            for key in ['h', 'o', 'p', 'ArrowRight', 'Space']:
                page.keyboard.press(key)
            assert page.evaluate("localStorage.getItem('btr.autosave.v3')") == before
        page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).focus()
        page.keyboard.press('Enter')
        expect(page).to_have_url(BASE + '/')
        page.wait_for_selector('#volume[aria-valuetext]', state='attached')
        expect(page.locator('#screen')).to_be_focused()
        page.evaluate("dispatchEvent(new Event('pagehide'))")
        restored = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v3'))")
        saved = json.loads(before)
        assert restored['initial'] == saved['initial'], 'Play restores the previous session'
        assert restored['events'][:len(saved['events'])] == saved['events']
        page.goto(BASE + '/')
        expect(page).to_have_url(BASE + '/')
        # Explicit pages take precedence over an autosave and game parameters.
        page.goto(BASE + '/about?room=B8')
        expect(page.locator('#about')).to_be_visible()
        expect(page.locator('#screen')).to_have_count(0)
        expect(page.get_by_role('slider', name='Volume', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='Fullscreen', exact=True)).to_have_count(0)
        for name in ['about', 'links', 'play']:
            response = page.goto(BASE + '/' + name + '/')
            assert response.ok
            expect(page).to_have_url(BASE + '/' + name + '/')
            page.reload()
            expect(page.locator('#site-header a[aria-current]')).to_have_text(name.capitalize())
        assert not errors, errors
        page.close()
    # Reading-page developer controls work without loading a game.
    page = browser.new_page()
    errors = []
    data_requests = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: data_requests.append(request.url) if '/data/' in request.url else None)
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': True, 'login': 'tester'}))
    page.goto(BASE + '/about')
    developer = page.get_by_role('button', name='Developer mode', exact=True)
    expect(developer).to_have_attribute('aria-pressed', 'false')
    developer.click()
    expect(developer).to_have_attribute('aria-pressed', 'true')
    expect(page.get_by_role('slider', name='Volume')).to_have_count(0)
    expect(page.get_by_role('link', name='Source on GitHub')).to_be_visible()
    assert not data_requests, 'reading-page controls must not load or start the game'
    for source, tool in [('about', 'download-record'), ('links', 'load-record'), ('about', 'file-issue')]:
        page.goto(BASE + '/' + source)
        page.locator('#' + tool).click()
        expect(page).to_have_url(BASE + '/play?debug#' + tool)
        expect(page.locator('#' + tool)).to_be_focused()
    assert not errors, errors
    page.close()
    # Reading pages are complete HTML and work without JavaScript or storage.
    page = browser.new_page(java_script_enabled=False)
    for name in ['about', 'links']:
        response = page.goto(BASE + '/' + name)
        assert response.ok
        expect(page.locator('main h1')).to_be_visible()
        expect(page.get_by_role('navigation').get_by_role('link', name='Play')).to_have_attribute('href', '/')
    page.close()
    page = browser.new_page()
    page.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked')}})")
    page.goto(BASE + '/')
    expect(page).to_have_url(BASE + '/')
    expect(page.get_by_role('button', name='Help', exact=True)).to_be_focused()
    page.keyboard.press('Enter')
    expect(page.locator('#help-screen')).to_be_hidden()
    expect(page.locator('#help')).to_be_focused()
    browser.close()
    print('browser_site_test: URLs, Markdown pages, history, focus, saves and storage passed')
