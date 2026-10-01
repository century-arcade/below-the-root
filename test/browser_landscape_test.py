"""Landscape phones show the bare picture with only site navigation; touch play still works."""
from pathlib import Path
from browser_helpers import browser_page, until, session_eval
from playwright.sync_api import expect


def panel_has(page, text):
    until(page, '(s, text) => String.fromCharCode(...s.state.panel.map(c => c & 127)).includes(text)', arg=text)


def choose_inventory(page):
    for key in ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'f']:
        page.keyboard.press(key)
        page.clock.run_for(32)
    until(page, 's => s.state.itemPicker?.readOnly')


def close_inventory(page):
    page.keyboard.press('ArrowUp')
    until(page, 's => !s.state.verb')


with browser_page('/play?room=B8', viewport={'width': 915, 'height': 350}, has_touch=True) as page:
    navigation = page.get_by_role('button', name='Site navigation', exact=True)
    expect(page.locator('#site-header')).to_be_hidden()
    navigation.tap()
    expect(navigation).to_have_attribute('aria-expanded', 'true')
    page.keyboard.press('Escape')
    expect(navigation).to_have_attribute('aria-expanded', 'false')
    navigation.tap()
    expect(page.get_by_role('link', name='About', exact=True)).to_have_attribute('href', '/about')
    page.get_by_role('link', name='Map', exact=True).tap()
    expect(page.get_by_role('dialog', name='World map')).to_be_visible()
    expect(page.locator('#site-header')).to_be_hidden()
    page.get_by_role('button', name='Close', exact=True).tap()
    expect(page.get_by_role('dialog', name='World map')).to_be_hidden()
    navigation.tap()
    page.locator('#help').tap()
    expect(page.get_by_role('complementary', name='Input help')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('complementary', name='Input help')).to_be_hidden()
    for control in ['Volume', 'Fullscreen', 'Monitor power']:
        expect(page.get_by_label(control, exact=True)).to_be_hidden()
    page.locator('#command-menu').tap()
    panel_has(page, 'INVENTORY')
    choose_inventory(page)
    close_inventory(page)
    page.keyboard.press('f')
    panel_has(page, 'INVENTORY')
    box = page.locator('#screen').bounding_box()
    for _ in range(2):
        page.touchscreen.tap(box['x'] + box['width'] * 24 / 40,
                             box['y'] + box['height'] * 22.5 / 25)
    until(page, 's => s.state.itemPicker?.readOnly')
    page.clock.run_for(32)
    close_inventory(page)

    recording = Path('test/fixtures/neric-win.json').read_text()
    page.evaluate('''text => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([text], 'neric-win.json', {type: 'application/json'}));
        window.dispatchEvent(new DragEvent('drop', {dataTransfer}));
    }''', recording)
    until(page, 's => s.playback')
    expect(page.get_by_role('group', name='Replay room navigation')).to_be_hidden()

with browser_page('/play?room=B8', viewport={'width': 412, 'height': 915}, has_touch=True) as page:
    expect(page.get_by_role('button', name='Site navigation', exact=True)).to_be_hidden()
    page.get_by_role('link', name='Map', exact=True).tap()
    expect(page.get_by_role('dialog', name='World map')).to_be_visible()
    page.get_by_role('button', name='Close', exact=True).tap()
    page.locator('#command-menu').tap()
    panel_has(page, 'INVENTORY')
    choose_inventory(page)

with browser_page('/play?player=0', viewport={'width': 915, 'height': 350}, has_touch=True) as page:
    anchor = page.evaluate('''async () => {
        const {questSession} = await import('/main.js');
        const {figureOrigin} = await import('/video.js');
        const p = questSession().state.player;
        const [x, y] = figureOrigin(p.col, p.row);
        return [x + 12, y + 21];
    }''')
    box = page.locator('#screen').bounding_box()
    page.touchscreen.tap(box['x'] + box['width'] * anchor[0] / 320,
                         box['y'] + box['height'] * anchor[1] / 200)
    until(page, 's => s.state.commandMenuOpen')
    assert session_eval(page, 's => !s.record.events.some(e => e.stick?.[2])')
    page.keyboard.press('Escape')
    page.clock.run_for(300)
    session_eval(page, 's => Object.assign(s.state.player, {col: 26, row: 15})')
    page.touchscreen.tap(box['x'] + box['width'] * 26.5 / 40,
                         box['y'] + box['height'] * 14.5 / 25)
    until(page, 's => !s.state.player.indoors')
    assert session_eval(page, 's => s.state.room.code') == 'M5'

print('browser_landscape_test: bare landscape picture, touch navigation, inventory and door input passed')
