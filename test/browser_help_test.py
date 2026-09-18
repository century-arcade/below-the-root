"""Input help, startup intro hold, toggles and keyboard/touch controls."""
import json
import os
from browser_helpers import browser_page, observe, held, until
import re
from pathlib import Path
from playwright.sync_api import expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

def setup(page):
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))

with browser_page('/play?debug', setup=setup, viewport={"width": 900, "height": 750}, has_touch=True) as page:
    def record():
        return observe(page)

    def question_mark():
        # Shift is also a joystick button: exercise the real chord.
        page.keyboard.down('Shift')
        page.keyboard.press('?')
        page.keyboard.up('Shift')

    def snapshot():
        return observe(page)

    help_screen = page.locator('#help-screen')
    expect(help_screen).to_be_visible()
    expect(page.locator('#developer-help')).to_be_visible()
    expect(page.get_by_role('button', name='Help', exact=True)).to_be_focused()
    stopped = snapshot()
    assert stopped['frame'] == 0, 'Help precedes the first intro frame'
    help_screen.focus()
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Space')
    held(page, 'startup-help')
    assert snapshot()['frame'] == 0, 'reading startup Help holds the intro'
    page.get_by_role('button', name='Help', exact=True).tap()
    expect(help_screen).to_be_hidden()
    expect(page.locator('#help')).to_be_focused()
    until(page, 's => s.frame > 0')
    intro = snapshot()
    assert intro['frame'] > 0
    assert intro['demo'] == 'intro', 'Closing startup help starts the intro without skipping it'
    assert all(r['stick'] == [0, 0, 0] for r in intro['events']), 'Toggling help does not send a joystick press'
    page.locator('#screen').focus()
    expect(page.locator('#screen')).to_have_attribute('aria-label', re.compile(r'Press \? for all controls'))
    page.keyboard.press('h')
    expect(help_screen).to_be_visible()
    page.keyboard.press('Space')
    page.keyboard.press('ArrowRight')
    expect(help_screen).to_be_visible()
    expect(help_screen.get_by_role('button')).to_have_count(0)
    question_mark()
    expect(help_screen).to_be_hidden()
    expect(page.locator('#screen')).to_be_focused()

    question_mark()
    expect(help_screen).to_be_visible()
    page.locator('#map').click()
    expect(page.locator('#map-screen')).to_be_visible()
    expect(page.locator('#help')).to_be_hidden()
    expect(help_screen).to_be_hidden()
    question_mark()
    expect(help_screen).to_be_hidden()
    page.keyboard.press('h')
    expect(help_screen).to_be_hidden()
    page.locator('#close-map').click()
    expect(page.locator('#help')).to_be_visible()
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
    for key in ['Enter', 'Space']:
        page.locator('#help').press(key)
        expect(help_screen).to_be_visible()
        expect(page.locator('#help')).to_be_focused()
        expect(page.locator('#help')).to_have_attribute('aria-expanded', 'true')
        page.keyboard.press(key)
        expect(help_screen).to_be_hidden()
        expect(page.locator('#help')).to_be_focused()
        expect(page.locator('#help')).to_have_attribute('aria-expanded', 'false')
    page.get_by_role('button', name='Help', exact=True).tap()
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).tap()
    expect(help_screen).to_be_hidden()
    page.keyboard.press('h')
    page.keyboard.press('Escape')
    expect(help_screen).to_be_hidden()

    page.goto(BASE + '/?player=0')
    until(page, "s => localStorage.getItem('btr.autosave.v3') !== null")
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
        until(page, 's => String.fromCharCode(...s.state.panel.map(v => v & 127)).includes("GRUNSPREKE")')
        panel = ''.join(chr(value & 127) for value in record()['panel'])
        assert 'PAUSE' in panel and 'GRUNSPREKE' in panel, 'command menu opens'
        page.keyboard.press('Escape')
        expect(menu_button).to_be_visible()
        resumed = record()['frame']
        until(page, '(s, frame) => s.frame > frame', resumed)
        assert record()['frame'] > resumed, 'Escape dismisses the menu and leaves play running'
    page.keyboard.down('f')
    expect(menu_button).to_be_hidden()
    page.clock.run_for(250)
    page.keyboard.down('f')  # browser repeat while held
    page.clock.run_for(150)
    expect(menu_button).to_be_hidden()
    page.keyboard.up('f')
    page.clock.run_for(100)
    page.keyboard.press('f')
    until(page, 's => !s.state.commandMenuOpen')
    expect(menu_button).to_be_visible()  # F selects PAUSE and returns to play
    page.keyboard.press('h')
    expect(help_screen).to_be_visible()
    expect(page.locator('#replay-help')).to_be_hidden()
    stopped = record()
    for key, axis, direction in [('ArrowRight', 0, 1), ('a', 0, -1), ('w', 1, -1), ('s', 1, 1), ('Space', 2, 1)]:
        before = len(record()['events'])
        page.keyboard.down(key)
        until(page, '(s, [start, axis, direction]) => s.record.events.slice(start).some(e => e.stick?.[axis] === direction)', [before, axis, direction])
        page.keyboard.up(key)
        assert any(entry['stick'][axis] == direction for entry in record()['events'][before:]), 'help focus allows movement'
    assert record()['frame'] > stopped['frame'], 'game time continues with help open'
    page.locator('#screen').focus()
    before = len(record()['events'])
    page.keyboard.down('ArrowRight')
    until(page, '(s, start) => s.record.events.slice(start).some(e => e.stick?.[0] === 1)', before)
    page.keyboard.up('ArrowRight')
    assert any(entry['stick'][0] == 1 for entry in record()['events']), 'canvas controls work while help stays open'
    expect(help_screen).to_be_visible()
    stopped = record()
    page.keyboard.press('Escape')
    until(page, '(s, frame) => s.frame > frame', stopped['frame'])
    assert record()['frame'] > stopped['frame'], 'closing help resumes game time'
    page.keyboard.press('Tab')
    expect(page.locator('#map-screen')).to_be_visible()
    page.locator('#close-map').focus()
    question_mark()
    expect(page.locator('#map-screen')).to_be_visible()
    expect(help_screen).to_be_hidden()
    expect(page.locator('#help')).to_be_hidden()
    expect(page.locator('#map')).to_have_attribute('aria-expanded', 'true')
    page.locator('#map').click()
    expect(help_screen).to_be_hidden()
    expect(page.locator('#map-screen')).to_be_visible()
    held(page, 'map')
    expect(page.locator('#map')).to_have_attribute('aria-current', 'page')
    page.keyboard.press('Escape')
    expect(page.locator('#map-screen')).to_be_hidden()
    expect(page.locator('#help')).to_be_visible()
    question_mark()
    expect(help_screen).to_be_visible()
    expect(page.locator('.github-link')).to_be_hidden()
    expect(page.locator('#developer-help')).to_be_hidden()
    page.locator('#developer-mode').click()
    expect(page.locator('#developer-help')).to_be_visible()
    expect(page.locator('.github-link')).to_be_visible()
    page.locator('#developer-mode').click()
    expect(page.locator('#developer-help')).to_be_hidden()
    expect(page.locator('#debug-tools')).to_be_hidden()
    expect(page.locator('.github-link')).to_be_hidden()
    page.locator('#developer-mode').click()
    expect(page.locator('#debug-tools')).to_be_visible()
    expect(page.locator('.github-link')).to_be_visible()
    page.get_by_role('navigation').get_by_role('link', name='About', exact=True).click()
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    expect(page.locator('#screen')).to_be_focused()
    expect(page.locator('#home')).to_have_attribute('aria-current', 'page')
    expect(page.locator('#help-screen')).to_be_hidden()
    assert record()['quest'], 'Play restores the saved quest at /'
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    menu = record()
    assert menu['title'] and menu['quest']
    until(page, 's => String.fromCharCode(...s.state.panel.map(v => v & 127)).includes("START GAME")')
    page.keyboard.press('f')
    until(page, 's => String.fromCharCode(...s.state.panel.map(v => v & 127)).includes("CHOOSE YOUR PLAYER")')
    panel = ''.join(chr(value & 127) for value in record()['panel'])
    assert 'CHOOSE YOUR PLAYER' in panel, 'F selects START GAME on the title menu'
    until(page, 's => !s.uiFire')  # the chooser samples the released trigger
    page.keyboard.press('f')
    until(page, 's => !s.state.title')
    expect(menu_button).to_be_visible()
    assert not record()['title'], 'F selects the character and starts play'
# At touch width the command-menu button remains an available input path.
with browser_page('/?player=0', viewport={"width": 390, "height": 750}, has_touch=True) as page:
    menu_button = page.get_by_role('button', name='Open command menu', exact=True)
    expect(menu_button).to_be_visible()
    menu_button.tap()
    expect(menu_button).to_be_hidden()
    page.keyboard.press('Escape')
    expect(menu_button).to_be_visible()
print('browser_help_test: startup help, live play with help, keyboard/touch toggles, focus and map coexistence passed')
