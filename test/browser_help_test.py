"""Input help, startup intro hold, toggles and keyboard/touch controls."""
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
        expect(page.locator('#developer-help')).to_be_visible()
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
        page.get_by_role('button', name='Help', exact=True).tap()
        expect(help_screen).to_be_visible()
        expect(page.locator('#help')).to_have_attribute('aria-expanded', 'true')
        page.get_by_role('button', name='Help', exact=True).tap()
        expect(help_screen).to_be_hidden()
        page.get_by_role('button', name='Help', exact=True).tap()
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
        menu_button = page.get_by_role('button', name='Open command menu', exact=True)
        expect(menu_button).to_be_visible()
        for action in ['f', 'click', 'tap', 'Space', 'Enter']:
            if action == 'f':
                page.keyboard.press('f')
            elif action in ['Space', 'Enter']:
                menu_button.press(action)
            else:
                getattr(menu_button, action)()
            expect(menu_button).to_be_hidden()
            page.wait_for_timeout(150)
            panel = ''.join(chr(value & 127) for value in record()['checkpoint']['panel'])
            assert 'PAUSE' in panel and 'GRUNSPREKE' in panel, 'command menu opens'
            page.keyboard.press('Escape')
            expect(menu_button).to_be_visible()
            resumed = record()['frames']
            page.wait_for_timeout(100)
            assert record()['frames'] > resumed, 'Escape dismisses the menu and leaves play running'
        page.keyboard.down('f')
        expect(menu_button).to_be_hidden()
        page.wait_for_timeout(250)
        page.keyboard.down('f')  # browser repeat while held
        page.wait_for_timeout(150)
        expect(menu_button).to_be_hidden()
        page.keyboard.up('f')
        page.wait_for_timeout(100)
        for key, choice in [('ArrowRight', 'TAKE'), ('ArrowDown', 'BUY'), ('ArrowUp', 'TAKE'), ('ArrowLeft', 'PAUSE')]:
            page.keyboard.down(key)
            page.wait_for_timeout(300)
            selected = ''.join(chr(value & 127) for value in record()['checkpoint']['panel'] if value & 128).strip()
            assert selected == choice, 'held directions move one command in either direction'
            page.keyboard.up(key)
            page.wait_for_timeout(100)
        page.keyboard.press('f')
        expect(menu_button).to_be_visible()  # F selects PAUSE and returns to play
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        expect(page.locator('#replay-help')).to_be_hidden()
        stopped = record()
        for key, axis, direction in [('ArrowRight', 0, 1), ('a', 0, -1), ('w', 1, -1), ('s', 1, 1), ('Space', 2, 1)]:
            before = len(record()['reads'])
            page.keyboard.down(key)
            page.wait_for_timeout(200)
            page.keyboard.up(key)
            assert any(entry['j'][axis] == direction for entry in record()['reads'][before:]), 'help focus allows movement'
        assert record()['frames'] > stopped['frames'], 'game time continues with help open'
        page.locator('#screen').focus()
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(200)
        page.keyboard.up('ArrowRight')
        assert any(entry['j'][0] == 1 for entry in record()['reads']), 'canvas controls work while help stays open'
        expect(help_screen).to_be_visible()
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)
        assert record()['frames'] > stopped['frames'], 'closing help resumes game time'
        page.keyboard.press('Tab')
        expect(page.locator('#map-screen')).to_be_visible()
        page.locator('#close-map').focus()
        question_mark()
        expect(page.locator('#map-screen')).to_be_visible()
        expect(help_screen).to_be_visible()
        expect(page.locator('#map')).to_have_attribute('aria-expanded', 'true')
        page.locator('#map').click()
        expect(help_screen).to_be_visible()
        expect(page.locator('#map-screen')).to_be_visible()
        expect(page.locator('#map')).to_have_attribute('aria-current', 'page')
        page.keyboard.press('Escape')
        expect(page.locator('#map-screen')).to_be_hidden()
        expect(page.locator('.github-link')).to_be_hidden()
        expect(page.locator('#developer-help')).to_be_hidden()
        page.locator('#developer-mode').click()
        expect(page.locator('#developer-help')).to_be_visible()
        expect(page.locator('.github-link')).to_be_visible()
        page.locator('#developer-mode').click()
        expect(page.locator('#developer-help')).to_be_hidden()
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
        page.wait_for_timeout(150)
        page.keyboard.press('f')
        page.wait_for_timeout(150)
        panel = ''.join(chr(value & 127) for value in record()['checkpoint']['panel'])
        assert 'CHOOSE YOUR PLAYER' in panel, 'F selects START GAME on the title menu'
        page.wait_for_timeout(150)  # the character chooser samples the released trigger
        page.keyboard.press('f')
        expect(menu_button).to_be_visible()
        assert not record()['checkpoint']['title'], 'F selects the character and starts play'
        assert not errors, errors
        page.close()
    browser.close()
    print('browser_help_test: startup help, live play with help, keyboard/touch toggles, focus and map coexistence passed')
