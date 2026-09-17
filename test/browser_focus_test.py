"""Pointer focus returns arrows to play; the screen indicator follows game time."""
import os
from browser_helpers import browser_page, observe, held, until
from playwright.sync_api import expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

def setup(page):
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))

with browser_page('/play?player=0', setup=setup, has_touch=True) as page:
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    canvas = page.locator('#screen')
    volume = page.get_by_role('slider', name='Volume', exact=True)
    indicator = page.locator('#screen-focus')

    def record():
        return observe(page)

    for action in ['click', 'tap']:
        volume.click()
        expect(volume).to_be_focused()
        volume.press('Home')
        before = len(record()['events'])
        page.keyboard.press('ArrowRight')
        expect(volume).to_have_value('10')
        page.clock.run_for(160)
        assert all(entry['stick'] == [0, 0, 0] for entry in record()['events'][before:]), 'slider arrows do not steer'
        # Clicking while paused resumes without also sending a pointer gesture.
        getattr(canvas, action)()
        expect(canvas).to_be_focused()
        page.keyboard.press('p')
        volume.click()
        level = volume.input_value()
        getattr(canvas, action)()
        expect(canvas).to_be_focused()
        before = len(record()['events'])
        page.keyboard.down('ArrowRight')
        until(page, '(s, start) => s.record.events.slice(start).some(e => e.stick?.[0] === 1)', before)
        page.keyboard.up('ArrowRight')
        assert any(entry['stick'][0] == 1 for entry in record()['events'][before:]), 'canvas returns arrows to play'
        expect(volume).to_have_value(level)
        until(page, 's => s.lastJoy.dx === 0')

    def running(on):
        if on:
            assert not record()['paused']
            until(page, '(s, frame) => s.frame > frame', record()['frame'])
            expect(indicator).not_to_have_attribute('hidden', '')
        else:
            held(page)
            expect(indicator).to_have_attribute('hidden', '')

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

    # Returning to the window resumes before any key or click is needed.
    page.evaluate("dispatchEvent(new Event('blur'))")
    running(False)
    page.evaluate("dispatchEvent(new Event('focus'))")
    running(True)

    # Even without a window focus event, the first movement or fire tap counts.
    for key, joystick in [('ArrowRight', [1, 0, 0]), ('Space', [0, 0, 1])]:
        page.evaluate("dispatchEvent(new Event('blur'))")
        running(False)
        before = len(record()['events'])
        page.keyboard.press(key)
        until(page, '(s, [start, stick]) => s.record.events.slice(start).some(e => JSON.stringify(e.stick) === JSON.stringify(stick))', [before, joystick])
        assert any(entry['stick'] == joystick for entry in record()['events'][before:]), 'first key after blur reaches play'
        running(True)

    # Hovering back onto the game returns keyboard control from a native slider.
    volume.click()
    volume.hover()
    page.evaluate("dispatchEvent(new Event('blur'))")
    running(False)
    canvas.hover()
    expect(canvas).to_be_focused()
    running(True)

    # Explicit pauses and the map survive both window focus and pointer return.
    for key in ['p', 'm']:
        page.keyboard.press(key)
        running(False)
        page.evaluate("dispatchEvent(new Event('blur')); dispatchEvent(new Event('focus'))")
        canvas.dispatch_event('pointerenter', {'pointerType': 'mouse'})
        running(False)
        if key == 'm':
            expect(page.locator('#map-screen')).to_be_visible()
            page.locator('#close-map').click()
        else:
            page.keyboard.press('p')
        running(True)

    page.goto(BASE + '/about')
    page.evaluate('localStorage.clear()')
    page.goto(BASE + '/play')
    expect(page.get_by_role('button', name='Help', exact=True)).to_be_visible()
    expect(page.locator('#help-screen')).to_be_visible()
    expect(indicator).to_have_attribute('hidden', '')
    page.evaluate("dispatchEvent(new Event('blur')); dispatchEvent(new Event('focus'))")
    canvas.dispatch_event('pointerenter', {'pointerType': 'mouse'})
    held(page, 'startup-help')
    expect(indicator).to_have_attribute('hidden', '')
    expect(page.locator('#help-screen')).to_be_visible()
    page.get_by_role('button', name='Help', exact=True).click()
    until(page, 's => s.frame > 0')
    expect(indicator).not_to_have_attribute('hidden', '')
    print('browser_focus_test: slider isolation, pointer/window focus, first-key input and explicit pauses passed')
