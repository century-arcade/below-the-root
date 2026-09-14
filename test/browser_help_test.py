"""Markdown Help, startup intro hold, controls; run against make serve."""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for width in [900, 390]:
        page = browser.new_page(viewport={"width": width, "height": 750}, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))

        def record():
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")

        def question_mark():
            # Shift is also a joystick button: exercise the real chord.
            page.keyboard.down('Shift')
            page.keyboard.press('?')
            page.keyboard.up('Shift')

        def snapshot():
            with page.expect_download() as download:
                page.locator('#download-record').evaluate('(button) => button.click()')
            return json.loads(Path(download.value.path()).read_text())

        page.goto(BASE + '/play?debug')
        help_screen = page.locator('#help-screen')
        expect(help_screen).to_be_visible()
        expect(page.get_by_role('button', name='Continue to intro')).to_be_focused()
        stopped = snapshot()
        assert stopped['frames'] == 0, 'Help precedes the first intro frame'
        help_screen.focus()
        page.keyboard.press('ArrowDown')
        page.keyboard.press('Space')
        page.wait_for_timeout(200)
        assert snapshot()['frames'] == 0, 'reading startup Help holds the intro'
        page.get_by_role('button', name='Continue to intro').tap()
        expect(help_screen).to_be_hidden()
        expect(page.locator('#screen')).to_be_focused()
        page.wait_for_timeout(200)
        intro = snapshot()
        assert intro['frames'] > 0
        assert intro['checkpoint']['shell']['demo'] == 'intro', 'Continue starts the intro without skipping it'
        assert all(r['j'] == [0, 0, 0] for r in intro['reads']), 'Continue does not send a joystick press'
        page.locator('#screen').focus()
        expect(page.locator('#screen')).to_have_attribute('aria-label', re.compile(r'Press \? for all controls'))
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        page.keyboard.press('Space')
        page.keyboard.press('ArrowRight')
        expect(help_screen).to_be_visible()
        page.keyboard.press('Tab')
        expect(page.locator('#close-help')).to_be_focused()
        question_mark()
        expect(help_screen).to_be_hidden()
        expect(page.locator('#screen')).to_be_focused()

        question_mark()
        expect(help_screen).to_be_visible()
        question_mark()
        expect(help_screen).to_be_hidden()
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        page.keyboard.press('h')
        expect(help_screen).to_be_hidden()
        page.get_by_role('navigation').get_by_role('link', name='Help', exact=True).tap()
        expect(help_screen).to_be_visible()
        expect(page.locator('#help')).to_have_attribute('aria-current', 'page')
        page.get_by_role('navigation').get_by_role('link', name='Game', exact=True).tap()
        expect(help_screen).to_be_hidden()
        page.keyboard.press('h')
        page.keyboard.press('Escape')
        expect(help_screen).to_be_hidden()

        page.goto(BASE + '/?player=0')
        page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
        expect(page.locator('#map')).to_be_visible()
        page.reload()
        page.wait_for_selector('#volume[aria-valuetext]', state='attached')
        expect(help_screen).to_be_hidden()  # a saved quest resumes directly
        expect(page.locator('#screen')).to_be_focused()
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        stopped = record()
        page.keyboard.press('Space')
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(200)
        assert record()['frames'] == stopped['frames'], 'help must hold game time'
        assert record()['reads'] == stopped['reads'], 'help must block joystick input'
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)
        assert record()['frames'] > stopped['frames'], 'closing help resumes game time'
        page.keyboard.press('Tab')
        expect(page.locator('#map-screen')).to_be_visible()
        page.locator('#close-map').focus()
        question_mark()
        expect(page.locator('#map-screen')).to_be_hidden()
        expect(help_screen).to_be_visible()
        expect(page.locator('#map')).to_have_attribute('aria-expanded', 'false')
        page.locator('#map').click()
        expect(help_screen).to_be_hidden()
        expect(page.locator('#map-screen')).to_be_visible()
        expect(page.locator('#map')).to_have_attribute('aria-current', 'page')
        page.keyboard.press('Escape')
        expect(page.locator('#map-screen')).to_be_hidden()
        expect(page.locator('.github-link')).to_be_hidden()
        page.locator('#developer-mode').click()
        expect(page.locator('.github-link')).to_be_visible()
        page.locator('#developer-mode').click()
        expect(page.locator('#debug-tools')).to_be_hidden()
        expect(page.locator('.github-link')).to_be_hidden()
        page.reload()
        page.wait_for_selector('#volume[aria-valuetext]', state='attached')
        expect(page.locator('.github-link')).to_be_hidden()
        page.locator('#developer-mode').click()
        expect(page.locator('#debug-tools')).to_be_visible()
        expect(page.locator('.github-link')).to_be_visible()
        page.get_by_role('navigation').get_by_role('link', name='About', exact=True).click()
        page.get_by_role('navigation').get_by_role('link', name='Game', exact=True).click()
        expect(page.locator('#screen')).to_be_focused()
        expect(page.locator('#home')).to_have_attribute('aria-current', 'page')
        expect(page.locator('#help-screen')).to_be_hidden()
        menu = record()
        assert menu['checkpoint']['title'] and menu['checkpoint']['quest']
        assert not errors, errors
        page.close()
    browser.close()
    print('browser_help_test: Markdown Help before intro, saved-game resume, keyboard/touch, focus, hold and map switching passed')
