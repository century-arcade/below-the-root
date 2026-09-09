"""Help controls, game hold and first-input hints; run against make serve."""
import os
import re
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for width in [900, 390]:
        page = browser.new_page(viewport={"width": width, "height": 750}, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        def record():
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")

        def question_mark():
            # Shift is also a joystick button: exercise the real chord.
            page.keyboard.down('Shift')
            page.keyboard.press('?')
            page.keyboard.up('Shift')

        page.goto(BASE + '/#play')
        basics = page.locator('#basics')
        help_screen = page.locator('#help-screen')
        expect(basics).to_be_visible()
        expect(page.locator('#screen')).to_have_attribute('aria-label', re.compile(r'Press \? for all controls'))
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        expect(basics).to_be_hidden()
        expect(page.locator('#help')).to_have_attribute('aria-expanded', 'true')
        page.keyboard.press('Space')
        page.keyboard.press('ArrowRight')
        expect(help_screen).to_be_visible()
        page.keyboard.press('Tab')
        expect(page.locator('#close-help')).to_be_focused()
        question_mark()
        expect(help_screen).to_be_hidden()
        expect(basics).to_be_visible()  # browsing help did not use the stick
        expect(page.locator('#screen')).to_be_focused()
        expect(page.locator('#help')).to_have_attribute('aria-expanded', 'false')

        question_mark()
        expect(help_screen).to_be_visible()
        question_mark()
        expect(help_screen).to_be_hidden()
        expect(basics).to_be_hidden()  # Shift outside help is the button
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        page.keyboard.press('h')
        expect(help_screen).to_be_hidden()
        page.locator('#help').tap()
        expect(help_screen).to_be_visible()
        page.locator('#close-help').tap()
        expect(help_screen).to_be_hidden()
        page.keyboard.press('h')
        page.keyboard.press('Escape')
        expect(help_screen).to_be_hidden()

        for input_type in ['keyboard', 'touch', 'gamepad']:
            page.goto(BASE + '/?menu')
            expect(basics).to_be_visible()
            if input_type == 'keyboard':
                page.keyboard.press('ArrowRight')
            elif input_type == 'touch':
                page.locator('#screen').tap()
            else:
                page.evaluate("""navigator.getGamepads = () => [{
                    connected: true, axes: [1, 0], buttons: []
                }]""")
            expect(basics).to_be_hidden()
            page.keyboard.press('h')
            page.keyboard.press('Escape')
            expect(basics).to_be_hidden()

        page.goto(BASE + '/?player=0')
        page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
        expect(page.locator('#map')).to_be_visible()
        expect(basics).to_be_hidden()
        page.keyboard.press('h')
        expect(help_screen).to_be_visible()
        stopped = record()
        page.keyboard.press('Space')
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(200)
        assert record()['frames'] == stopped['frames'], 'help must hold game time'
        assert record()['inputs'] == stopped['inputs'], 'help must block joystick input'
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
        page.keyboard.press('Escape')
        expect(page.locator('#map-screen')).to_be_hidden()
        assert not errors, errors
        page.close()
    browser.close()
    print('browser_help_test: hints, keyboard/touch/gamepad, toggles, focus, hold and map switching passed')
