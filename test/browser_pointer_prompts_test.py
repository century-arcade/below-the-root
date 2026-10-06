"""Classic item prompts and live dialogue retain mouse confirmation and steering."""
from browser_helpers import browser_page, session_eval, until


def screen_point(page, point):
    box = page.locator('#screen').bounding_box()
    return (box['x'] + box['width'] * point[0] / 320,
            box['y'] + box['height'] * point[1] / 200)


def anchor(page):
    return session_eval(page, '''async s => {
        const {figureOrigin} = await import('/video.js');
        const [x, y] = figureOrigin(s.state.player.col, s.state.player.row);
        return [x + 12, y + 21];
    }''')


def tap_self(page):
    page.mouse.click(*screen_point(page, anchor(page)))


def panel_has(page, text):
    until(page, '''(s, text) => Array.from(s.state.panel)
        .map(c => String.fromCharCode(c & 127)).join('').includes(text)''', text)


def choose(page, name):
    tap_self(page)
    until(page, 's => s.state.commandMenuOpen')
    page.clock.run_for(160)
    point = screen_point(page, page.evaluate('''async name => {
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
    page.mouse.click(*point)
    page.mouse.click(*point)
    until(page, 's => !s.state.commandMenuOpen')
    page.clock.run_for(160)


def hold_direction(page, dx, dy, predicate):
    x, y = anchor(page)
    x, y = screen_point(page, [x + dx * 48, y + dy * 40])
    page.mouse.move(x, y)
    page.mouse.down()
    until(page, predicate)
    page.mouse.up()
    page.clock.run_for(160)


for cancel in [False, True]:
    with browser_page('/play?player=0',
                      setup=lambda p: p.add_init_script("localStorage.setItem('btr.classic', '1')")) as page:
        item = session_eval(page, '''async s => {
            const {CLASS} = await import('/data.js');
            const item = s.state.objects.find(o => o.exists && o.class === CLASS.BREAD);
            item.carried = true;
            return item.object;
        }''')
        choose(page, 'EAT')
        panel_has(page, 'PAN BREAD')
        if cancel:
            hold_direction(page, 0, -1, '''s => Array.from(s.state.panel)
                .map(c => String.fromCharCode(c & 127)).join('').includes('NOTHING')''')
            page.clock.run_for(300)
            panel_has(page, 'NOTHING')
        tap_self(page)
        if cancel:
            until(page, 's => !s.state.verb')
            assert session_eval(page, '(s, id) => s.state.objects[id].exists', item)
            assert not session_eval(page, 's => s.record.events.some(e => e.command === "EAT")')
        else:
            panel_has(page, 'THE PAN BREAD IS GOOD')
            assert not session_eval(page, '(s, id) => s.state.objects[id].exists', item)
            assert session_eval(page, 's => s.record.events.filter(e => e.command === "EAT").length') == 1
            tap_self(page)
            until(page, 's => !s.state.verb')
        assert not session_eval(page, 's => s.state.commandMenuOpen')
        tap_self(page)
        until(page, 's => s.state.commandMenuOpen')

with browser_page('/play?player=0') as page:
    session_eval(page, '''async s => {
        const {startTune} = await import('/audio.js');
        startTune(s.state, 0);
    }''')
    assert session_eval(page, 's => s.state.tuneWait != null && !s.state.verb')
    tap_self(page)
    until(page, 's => s.state.tuneWait == null', milliseconds=400)
    assert session_eval(page, 's => s.state.stall === 0 && !s.state.commandMenuOpen')
    tap_self(page)
    until(page, 's => s.state.commandMenuOpen')

with browser_page('/play?player=0') as page:
    session_eval(page, '''async s => {
        const {startVerb} = await import('/game.js');
        const {gainSpirit} = await import('/dialog.js');
        s.state.player.spiritLimit = 20;
        startVerb(s.state, gainSpirit(s.state, 5));
    }''')
    panel_has(page, 'GAINED THE POWER TO KINIPORT TOOLS')
    page.clock.run_for(160)
    tap_self(page)
    until(page, 's => s.state.tuneWait == null', milliseconds=400)
    page.clock.run_for(160)
    panel_has(page, 'GAINED THE POWER TO KINIPORT TOOLS')
    assert session_eval(page, 's => s.state.visions') == 0
    tap_self(page)
    panel_has(page, 'A VISION COMES TO YOU')
    assert session_eval(page, 's => s.state.visions') == 1
    page.clock.run_for(160)
    assert session_eval(page, 's => s.state.tuneWait != null')
    tap_self(page)
    until(page, 's => s.state.tuneWait == null', milliseconds=400)
    page.clock.run_for(160)
    assert session_eval(page, 's => !!s.state.verb')
    tap_self(page)
    until(page, 's => !s.state.verb')
    assert not session_eval(page, 's => s.state.commandMenuOpen')

with browser_page('/play?player=0') as page:
    session_eval(page, 's => s.state.player.spiritLimit = s.state.player.spiritEnergy = 50')
    choose(page, 'KINIPORT')
    panel_has(page, 'WHAT DO YOU WANT TO KINIPORT?')
    hold_direction(page, 1, 0, 's => s.state.pointer.col >= s.state.player.col + 3')
    stopped = session_eval(page, 's => ({...s.state.pointer})')
    page.clock.run_for(300)
    assert session_eval(page, 's => s.state.pointer') == stopped
    hold_direction(page, -1, 0, 's => s.state.pointer.col === s.state.player.col')
    tap_self(page)
    panel_has(page, 'KINIPORT YOUR BODY WHERE?')
    page.clock.run_for(300)
    assert not session_eval(page, 's => s.record.events.some(e => e.command === "KINIPORT")')
    hold_direction(page, 1, 0, 's => s.state.pointer.col >= s.state.player.col + 3')
    hold_direction(page, -1, 0, 's => s.state.pointer.col === s.state.player.col')
    tap_self(page)
    until(page, 's => s.record.events.some(e => e.command === "KINIPORT")')
    assert session_eval(page, 's => s.record.events.filter(e => e.command === "KINIPORT").length') == 1
    assert session_eval(page, 's => s.state.player.spiritEnergy') == 40
    assert not session_eval(page, 's => s.state.pointer || s.state.commandMenuOpen')

print('browser_pointer_prompts_test: mouse item confirmation/cancellation, dialogue, tune skips and KINIPORT passed')
