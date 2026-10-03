"""Touch inventory and doorway input work in both phone orientations."""
from browser_helpers import browser_page, until, session_eval


def panel_has(page, text):
    until(page, '(s, text) => String.fromCharCode(...s.state.panel.map(c => c & 127)).includes(text)', arg=text)


def choose_inventory(page):
    for key in ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'f']:
        page.keyboard.press(key)
        page.clock.run_for(32)
    until(page, 's => s.state.itemPicker?.readOnly')


with browser_page('/play?room=B8', viewport={'width': 412, 'height': 915}, has_touch=True) as page:
    page.locator('#command-menu').tap()
    panel_has(page, 'INVENTORY')
    choose_inventory(page)

with browser_page('/play?player=0', viewport={'width': 915, 'height': 350}, has_touch=True) as page:
    box = page.locator('#screen').bounding_box()
    session_eval(page, 's => Object.assign(s.state.player, {col: 26, row: 15})')
    page.touchscreen.tap(box['x'] + box['width'] * 26.5 / 40,
                         box['y'] + box['height'] * 14.5 / 25)
    until(page, 's => !s.state.player.indoors')
    assert session_eval(page, 's => s.state.room.code') == 'M5'

print('browser_landscape_test: touch inventory and door input passed')
