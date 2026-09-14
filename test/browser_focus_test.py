"""Pointer focus returns arrows to play; the screen indicator follows game time."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.goto(BASE + '/play?player=0')
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    canvas = page.locator('#screen')
    volume = page.get_by_role('slider', name='Volume', exact=True)
    indicator = page.locator('#screen-focus')

    def record():
        page.evaluate("dispatchEvent(new Event('pagehide'))")
        return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")

    for action in ['click', 'tap']:
        volume.click()
        expect(volume).to_be_focused()
        volume.press('Home')
        before = len(record()['reads'])
        page.keyboard.press('ArrowRight')
        expect(volume).to_have_value('10')
        page.wait_for_timeout(150)
        assert all(entry['j'] == [0, 0, 0] for entry in record()['reads'][before:]), 'slider arrows do not steer'
        # Clicking while paused resumes without also sending a pointer gesture.
        getattr(canvas, action)()
        expect(canvas).to_be_focused()
        page.keyboard.press('p')
        volume.click()
        level = volume.input_value()
        getattr(canvas, action)()
        expect(canvas).to_be_focused()
        before = len(record()['reads'])
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(200)
        page.keyboard.up('ArrowRight')
        assert any(entry['j'][0] == 1 for entry in record()['reads'][before:]), 'canvas returns arrows to play'
        expect(volume).to_have_value(level)
        page.wait_for_timeout(100)

    def running(on):
        if on:
            expect(indicator).not_to_have_attribute('hidden', '')
        else:
            expect(indicator).to_have_attribute('hidden', '')
        before = record()['frames']
        page.wait_for_timeout(150)
        after = record()['frames']
        assert (after > before) if on else (after == before), 'indicator follows game time'

    running(True)
    volume.click()
    running(True)  # Native slider focus does not pause the game.
    canvas.focus()
    page.keyboard.press('p')
    running(False)  # Canvas still has focus while paused.
    page.keyboard.press('Space')
    running(True)
    page.keyboard.press('m')
    running(False)
    page.locator('#close-map').click()
    running(True)
    page.keyboard.press('h')
    running(True)  # Help permits live play.
    page.keyboard.press('Escape')
    page.evaluate("dispatchEvent(new Event('blur'))")
    running(False)
    canvas.click()
    expect(canvas).to_be_focused()
    running(True)

    page.goto(BASE + '/about')
    page.evaluate('localStorage.clear()')
    page.goto(BASE + '/play')
    expect(page.get_by_role('button', name='Continue to intro')).to_be_visible()
    expect(indicator).to_have_attribute('hidden', '')
    page.get_by_role('button', name='Continue to intro').click()
    expect(indicator).not_to_have_attribute('hidden', '')
    assert not errors, errors
    browser.close()
    print('browser_focus_test: slider isolation, click/tap focus and running indicator passed')
