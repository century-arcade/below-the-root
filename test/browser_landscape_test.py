"""Portrait touch reaches the inventory; landscape touch works only beside the picture."""
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
    assert box
    cdp = page.context.new_cdp_session(page)
    left = {'x': box['x'] - 20, 'y': box['y'] + box['height'] / 2, 'id': 1}
    right = {'x': box['x'] + box['width'] + 20, 'y': box['y'] + box['height'] / 2, 'id': 2}

    def touch(kind, *points):
        cdp.send('Input.dispatchTouchEvent', {
            'type': kind, 'touchPoints': [{'x': p['x'], 'y': p['y'], 'id': p['id']} for p in points]})

    def side_tap(point):
        touch('touchStart', point)
        touch('touchEnd')

    def chord():
        touch('touchStart', left)
        touch('touchStart', left, right)
        touch('touchEnd')

    session_eval(page, 's => Object.assign(s.state.player, {col: 26, row: 15})')
    page.touchscreen.tap(box['x'] + box['width'] * 26.5 / 40, box['y'] + box['height'] * 14.5 / 25)
    page.clock.run_for(1000)
    assert session_eval(page, 's => s.state.player.indoors'), 'the picture ignores touch in landscape'

    side_tap(left)
    until(page, 's => !s.state.player.indoors')
    assert session_eval(page, 's => s.state.room.code') == 'M5'

    chord()
    until(page, 's => s.state.commandMenuOpen')
    chord()
    until(page, 's => !s.state.commandMenuOpen')

    chord()
    until(page, 's => s.state.commandMenuOpen')
    for key in ['ArrowDown', 'f']:
        page.keyboard.press(key)
        page.clock.run_for(32)
    panel_has(page, 'SPEAK WITH WHOM')
    until(page, 's => !s.state.commandMenuOpen && !!s.state.verb')
    chord()
    until(page, 's => s.state.commandMenuOpen')
    chord()
    until(page, 's => !s.state.commandMenuOpen')

    middle = {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2, 'id': 3}
    chord()
    until(page, 's => s.state.commandMenuOpen')
    touch('touchStart', right)
    for step in range(1, 4):
        touch('touchMove', {**right, 'x': right['x'] + 30 * step})
    touch('touchMove', {**right, 'x': right['x'] + 30 * 3, 'y': right['y'] + 30})
    touch('touchEnd')
    until(page, 's => s.state.commandMenuSelection.row === 1 && s.state.commandMenuSelection.col === 3')
    side_tap(right)
    until(page, 's => s.state.itemPicker?.readOnly')
    side_tap(middle)
    until(page, 's => !s.state.itemPicker')

    page.clock.run_for(500)
    session_eval(page, 's => { s.state.player.facing = 1; }')
    col = session_eval(page, 's => s.state.player.col')
    touch('touchStart', left)
    for _ in range(6):
        page.clock.run_for(16)
    touch('touchStart', left, right)
    page.clock.run_for(32)
    touch('touchEnd', right)
    until(page, 's => s.state.player.leaping')
    touch('touchEnd', left)
    assert session_eval(page, 's => s.state.player.facing') == -1, 'holding the side behind turns before the leap'
    assert session_eval(page, 's => s.state.player.col') in (col, col - 1), 'the leap starts from where the figure stood'

    col = session_eval(page, 's => s.state.player.col')
    touch('touchStart', left)
    page.clock.run_for(1500)
    touch('touchEnd')
    assert session_eval(page, 's => s.state.player.col') < col

    page.locator('#touch-map').tap()
    page.clock.run_for(100)
    assert page.locator('#desk').get_attribute('data-stage') == 'map'
    page.locator('#touch-map').tap()
    page.clock.run_for(100)
    assert page.locator('#desk').get_attribute('data-stage') == 'play'

    assert page.locator('#developer-mode').is_hidden(), 'no version label in landscape play'

    page.evaluate('document.exitFullscreen?.().catch(() => {})')
    page.locator('#fullscreen').tap()
    page.wait_for_function('document.fullscreenElement !== null')
    assert page.locator('#fullscreen').get_attribute('aria-pressed') == 'true'
    page.locator('#fullscreen').tap()
    page.wait_for_function('document.fullscreenElement === null')
    assert page.locator('#fullscreen').get_attribute('aria-pressed') == 'false', 'fullscreen exits from landscape play'

with browser_page('/play?player=0', viewport={'width': 915, 'height': 350}, has_touch=True) as page:
    box = page.locator('#screen').bounding_box()
    assert box
    cdp = page.context.new_cdp_session(page)
    left = {'x': box['x'] - 20, 'y': box['y'] + box['height'] / 2, 'id': 1}

    def touch(kind, *points):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': list(points)})

    page.clock.run_for(500)
    page.evaluate('''async () => {
        const { questSession } = await import('/main.js');
        const { enterRoom } = await import('/world.js');
        const s = questSession().state;
        Object.assign(s.player, { indoors: false, facing: -1 });
        enterRoom(s, [...s.data.roomById.values()].find(r => r.code === 'K0'), 26, 15);
    }''')
    page.clock.run_for(300)
    row, col = session_eval(page, 's => [s.state.player.row, s.state.player.col]')
    touch('touchStart', left)
    page.clock.run_for(48)
    touch('touchMove', {**left, 'y': left['y'] - 40})
    until(page, '(s, row) => s.state.player.row < row - 4', arg=row)
    until(page, '(s, col) => s.state.player.col < col - 2', arg=col)
    touch('touchEnd', left)

    right = {'x': box['x'] + box['width'] + 20, 'y': left['y'], 'id': 2}
    page.evaluate('''async () => {
        const { questSession } = await import('/main.js');
        const { enterRoom } = await import('/world.js');
        const s = questSession().state;
        Object.assign(s.player, { facing: 1 });
        enterRoom(s, [...s.data.roomById.values()].find(r => r.code === 'E4'), 12, 9);
    }''')
    page.clock.run_for(300)
    touch('touchStart', right)
    page.clock.run_for(48)
    touch('touchMove', {**right, 'y': right['y'] - 40})
    until(page, 's => s.state.room.code === "E3"')
    touch('touchEnd', right)
    page.clock.run_for(300)
    col = session_eval(page, 's => s.state.player.col')
    touch('touchStart', left)
    until(page, '(s, col) => s.state.player.col < col - 1', arg=col)
    touch('touchEnd', left)

print('browser_landscape_test: portrait touch inventory, landscape side touches, turn-and-leap, climb then walk on, side hold on a ladder, picture taps outside play, map, version label and fullscreen toggle passed')
