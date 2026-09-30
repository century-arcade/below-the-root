"""Mouse and touch share self-menu, highlight/confirm and semantic commands."""
from browser_helpers import browser_page, session_eval, until


for device in ['touch', 'mouse']:
    with browser_page('/play?player=0', viewport={'width': 915, 'height': 350}, has_touch=True) as page:
        canvas = page.locator('#screen')
        cdp = page.context.new_cdp_session(page)

        def screen_point(point):
            box = canvas.bounding_box()
            return (box['x'] + box['width'] * point[0] / 320,
                    box['y'] + box['height'] * point[1] / 200)

        def choice_point(name):
            return screen_point(page.evaluate('''async name => {
                const {MENU, menuChoiceAt} = await import('/verbs.js');
                const {PANEL_ROW} = await import('/panel.js');
                for (let row = 0; row < MENU.length; row++) {
                    for (let col = 0; col < 40; col++) {
                        const choice = menuChoiceAt(col, row);
                        if (choice && MENU[choice.row][choice.col] === name)
                            return [(col + 0.5) * 8, (PANEL_ROW + row + 0.5) * 8];
                    }
                }
                throw Error(`No menu choice ${name}`);
            }''', name))

        def pointer(kind, point):
            x, y = point
            if device == 'touch':
                cdp.send('Input.dispatchTouchEvent', {
                    'type': {'down': 'touchStart', 'move': 'touchMove', 'up': 'touchEnd'}[kind],
                    'touchPoints': [] if kind == 'up' else [{'x': x, 'y': y}],
                })
            else:
                page.mouse.move(x, y)
                if kind == 'down':
                    page.mouse.down()
                elif kind == 'up':
                    page.mouse.up()

        def tap(point):
            pointer('down', point)
            pointer('up', point)

        def selected():
            return session_eval(page, '''s => Array.from(s.state.panel)
                .filter(c => c & 128).map(c => String.fromCharCode(c & 127)).join('').trim()''')

        def no_command():
            assert session_eval(page, 's => s.state.commandMenuOpen && !s.record.events.some(e => e.command)')

        anchor = session_eval(page, '''async s => {
            const {figureOrigin} = await import('/video.js');
            const [x, y] = figureOrigin(s.state.player.col, s.state.player.row);
            return [x + 12, y + 21];
        }''')
        tap(screen_point(anchor))
        until(page, 's => s.state.commandMenuOpen')
        page.clock.run_for(160)
        assert selected() == 'PAUSE'
        assert session_eval(page, 's => !s.record.events.some(e => e.stick?.[2])')

        take = choice_point('TAKE')
        pointer('down', take)
        assert selected() == 'TAKE'
        no_command()
        page.clock.run_for(200)
        pointer('up', take)
        page.clock.run_for(160)
        no_command()
        tap(take)
        tap(choice_point('DROP'))
        until(page, 's => s.record.events.some(e => e.command === "TAKE")')
        assert session_eval(page, 's => s.record.events.filter(e => e.command === "TAKE").length') == 1
        assert not session_eval(page, 's => s.state.commandMenuOpen')

        page.keyboard.press('Enter')
        until(page, 's => !s.state.verb')
        page.keyboard.press('f')
        until(page, 's => s.state.commandMenuOpen')
        count = session_eval(page, 's => s.record.events.filter(e => e.command).length')
        for name in ['TAKE', 'DROP']:
            tap(choice_point(name))
            page.clock.run_for(160)
            assert selected() == name
            assert session_eval(page, 's => s.state.commandMenuOpen')
            assert session_eval(page, 's => s.record.events.filter(e => e.command).length') == count

        pointer('down', choice_point('DROP'))
        pointer('move', choice_point('SELL'))
        assert selected() == 'SELL'
        pointer('up', choice_point('SELL'))
        page.clock.run_for(160)
        assert session_eval(page, 's => s.state.commandMenuOpen')
        tap(screen_point([316, 196]))
        page.clock.run_for(250)
        assert selected() == 'SELL'
        page.keyboard.press('ArrowRight')
        until(page, 's => s.state.commandMenuSelection.col === 3')
        assert selected() == 'INVENTORY'
        page.keyboard.press('f')
        until(page, 's => !s.state.commandMenuOpen')
        assert session_eval(page, 's => s.state.itemPicker.readOnly')

        page.keyboard.press('ArrowUp')
        until(page, 's => !s.state.verb')
        page.keyboard.press('p')
        tap(screen_point(anchor))
        assert not session_eval(page, 's => s.state.commandMenuOpen')
        page.keyboard.press('p')
        page.keyboard.press('f')
        until(page, 's => s.state.commandMenuOpen')
        page.keyboard.press('Escape')
        assert not session_eval(page, 's => s.state.commandMenuOpen')

with browser_page('/play?demo=intro', has_touch=True) as page:
    until(page, 's => !!s.state.demo')
    page.locator('#screen').tap()
    until(page, 's => !s.state.demo && s.state.title')
    page.clock.run_for(300)
    assert session_eval(page, 's => s.state.menuSel') == 0

print('browser_touch_test: mouse/touch self-menu, highlight, drag, confirmation, keyboard handoff and demo skip passed')
