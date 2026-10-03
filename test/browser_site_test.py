"""Clean page URLs, reading-page links, history and saved-game restoration."""
import json
import os
from playwright.sync_api import sync_playwright, expect
from browser_helpers import power_on, ready, until

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    page.clock.install(time=0)
    page.clock.pause_at(0)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/resources')
    expect(page.get_by_role('heading', name='Resources', exact=True)).to_be_visible()
    expect(page.locator('#main-nav a[aria-current]')).to_have_text('Resources')
    expect(page.get_by_role('link', name='Phil Salvador: Below the Root', exact=True)).to_be_visible()
    mocagh = page.locator('#resources .cards li').filter(has_text='Museum of Computer Adventure')
    mocagh.get_by_role('link', name='manual as a PDF').click(trial=True)
    page.get_by_role('navigation').get_by_role('link', name='About', exact=True).click()
    expect(page).to_have_url(BASE + '/about')
    page.go_back()
    expect(page).to_have_url(BASE + '/resources')
    page.go_forward()
    expect(page).to_have_url(BASE + '/about')
    page.reload()
    expect(page.locator('#about')).to_be_visible()
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    expect(page).to_have_url(BASE + '/')
    ready(page)
    power_on(page)
    expect(page.locator('#screen')).to_be_focused()
    for query in ['?demo', '?room=T1']:
        page.goto(BASE + '/' + query)
        expect(page).to_have_url(BASE + '/' + query)
        ready(page)
        expect(page.locator('#screen')).to_be_focused()
    page.keyboard.press('ArrowRight')
    until(page, 's => s.frame > 0')
    page.goto(BASE + '/about')
    before = page.evaluate("localStorage.getItem('btr.autosave.v3')")
    assert before, 'Leaving Play saves the quest'
    for name in ['About', 'Resources']:
        page.get_by_role('navigation').get_by_role('link', name=name, exact=True).click()
        expect(page.locator('#screen')).to_have_count(0)
        expect(page.get_by_role('slider', name='Volume', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='Fullscreen', exact=True)).to_have_count(0)
        for key in ['h', 'o', 'p', 'ArrowRight', 'Space']:
            page.keyboard.press(key)
        assert page.evaluate("localStorage.getItem('btr.autosave.v3')") == before
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).press('Enter')
    expect(page).to_have_url(BASE + '/')
    ready(page)
    expect(page.locator('#screen')).to_be_focused()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    restored = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v3'))")
    saved = json.loads(before)
    assert restored['initial'] == saved['initial'], 'Play restores the previous session'
    assert restored['events'][:len(saved['events'])] == saved['events']
    page.goto(BASE + '/about?room=B8')
    expect(page.locator('#about')).to_be_visible()
    expect(page.locator('#screen')).to_have_count(0)
    for name in ['about', 'resources', 'play']:
        response = page.goto(BASE + '/' + name + '/')
        assert response.ok
        expect(page).to_have_url(BASE + '/' + name + '/')
        page.reload()
        expect(page.locator('#main-nav a[aria-current]')).to_have_text(name.capitalize())
    assert not errors, errors
    page.close()

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
    for source, tool in [('about', 'download-record'), ('resources', 'load-record')]:
        page.goto(BASE + '/' + source)
        page.locator('#' + tool).click()
        expect(page).to_have_url(BASE + '/play?debug#' + tool)
        expect(page.locator('#' + tool)).to_be_focused()
    assert not errors, errors
    page.close()

    page = browser.new_page(java_script_enabled=False)
    for name in ['about', 'resources']:
        response = page.goto(BASE + '/' + name)
        assert response.ok
        expect(page.locator('main h1')).to_be_visible()
        expect(page.get_by_role('navigation').get_by_role('link', name='Play')).to_have_attribute('href', '/')
    page.close()
    page = browser.new_page()
    page.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked')}})")
    page.goto(BASE + '/')
    expect(page).to_have_url(BASE + '/')
    ready(page)
    power_on(page)
    expect(page.locator('#screen')).to_be_visible()
    browser.close()
    print('browser_site_test: URLs, reading pages, history, focus, saves and storage passed')
