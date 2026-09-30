"""Modern inventory dismissal and direct touch/mouse item choices preserve input ownership."""
from browser_helpers import browser_page, session_eval, until


def screen_point(page, point):
    box = page.locator('#screen').bounding_box()
    return (box['x'] + box['width'] * point[0] / 320,
            box['y'] + box['height'] * point[1] / 200)


def choose(page, name):
    page.keyboard.press('f')
    until(page, 's => s.state.commandMenuOpen')
    session_eval(page, '''async (s, name) => {
        const {MENU, highlightMenuChoice} = await import('/verbs.js');
        const row = MENU.findIndex(r => r.includes(name));
        highlightMenuChoice(s.state, {row, col: MENU[row].indexOf(name)});
    }''', name)
    page.keyboard.press('f')
    until(page, 's => !!s.state.itemPicker')
    page.clock.run_for(160)


def item_point(page, item):
    point = session_eval(page, '''async (s, id) => {
        const {itemChoiceAt} = await import('/inventory.js');
        const {PANEL_ROW} = await import('/panel.js');
        const p = s.state.itemPicker;
        for (let row = 0; row < 4; row++) for (let col = 0; col < 40; col++) {
            const choice = itemChoiceAt(s.state, col, row);
            if ((id === 'more' && choice?.col === 2)
                || (choice?.col < 2 && p.entries[choice.col * p.rows + choice.row]?.item?.object === id))
                return [(col + 0.5) * 8, (PANEL_ROW + row + 0.5) * 8];
        }
        throw Error('Item not visible');
    }''', item)
    return screen_point(page, point)


def pack(page):
    return session_eval(page, '''async s => {
        const {CLASS} = await import('/data.js');
        const {paintScreen} = await import('/world.js');
        const items = [CLASS.BREAD, CLASS.FRUIT].map(cls => {
            const item = s.state.objects.find(o => o.exists && o.class === cls);
            item.carried = true;
            return item.object;
        });
        for (const o of s.state.objects) {
            if (!o.carried && o.room === s.state.room.room) o.exists = false;
        }
        s.state.player.col = 23;
        paintScreen(s.state);
        return items;
    }''')


def selected(page):
    return session_eval(page, '''s => {
        const p = s.state.itemPicker;
        return p.entries[p.selected.col * p.rows + p.selected.row]?.item?.object;
    }''')


with browser_page('/play?player=0', has_touch=True) as page:
    bread, fruit = pack(page)
    choose(page, 'EAT')
    assert selected(page) == bread
    point = item_point(page, fruit)
    cdp = page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchStart', 'touchPoints': [{'x': point[0], 'y': point[1]}],
    })
    assert selected(page) == fruit
    page.clock.run_for(200)
    assert session_eval(page, '(s, id) => s.state.objects[id].exists', fruit)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.clock.run_for(160)
    assert session_eval(page, '(s, id) => s.state.objects[id].exists', fruit)
    page.touchscreen.tap(*screen_point(page, [160, 80]))
    page.clock.run_for(300)
    assert session_eval(page, 's => !!s.state.itemPicker')
    assert selected(page) == fruit
    page.touchscreen.tap(*point)
    until(page, '(s, id) => !s.state.objects[id].exists', fruit)
    assert session_eval(page, '(s, id) => s.state.objects[id].exists', bread)
    assert session_eval(page, 's => s.record.events.filter(e => e.command === "EAT").map(e => e.item)') == [fruit]
    cdp.detach()

with browser_page('/play?player=0') as page:
    bread, fruit = pack(page)
    choose(page, 'DROP')
    page.mouse.move(*item_point(page, fruit))
    assert selected(page) == fruit
    assert session_eval(page, '(s, id) => s.state.objects[id].carried', fruit)
    page.mouse.click(*item_point(page, fruit))
    until(page, '(s, id) => !s.state.objects[id].carried', fruit)
    assert session_eval(page, '(s, id) => s.state.objects[id].carried', bread)
    assert session_eval(page, 's => s.record.events.filter(e => e.command === "DROP").map(e => e.item)') == [fruit]
    until(page, 's => !s.state.verb')
    choose(page, 'EAT')
    page.keyboard.press('Escape')
    until(page, 's => !s.state.verb')
    assert session_eval(page, '(s, id) => s.state.objects[id].exists', bread)
    assert not session_eval(page, 's => s.record.events.some(e => e.command === "EAT")')

for key in ['ArrowRight', 'q', 'Escape', 'f', 'Tab']:
    with browser_page('/play?player=0') as page:
        pack(page)
        choose(page, 'INVENTORY')
        assert session_eval(page, '''async s => {
            const {statusRows} = await import('/status.js');
            return !statusRows(s.state).length;
        }''')
        count = session_eval(page, 's => s.record.events.length')
        page.keyboard.down(key)
        until(page, 's => !s.state.verb')
        page.clock.run_for(500)
        assert session_eval(page, '''async s => {
            const {statusRows} = await import('/status.js');
            return statusRows(s.state).length > 0;
        }''')
        assert not session_eval(page, '''(s, count) => s.record.events.slice(count)
            .some(e => e.command || e.stick?.some(Boolean))''', count)
        page.keyboard.up(key)
        page.keyboard.press('ArrowRight')
        until(page, '(s, count) => s.record.events.slice(count).some(e => e.stick?.[0] === 1)', count)

with browser_page('/play?player=0', has_touch=True) as page:
    labels = session_eval(page, '''async s => {
        const {inventoryEntries} = await import('/inventory.js');
        const {CLASS} = await import('/data.js');
        s.state.player.stamina += 25;
        for (const type of s.state.data.items.filter(i => i.class !== CLASS.ELIXER)) {
            const item = s.state.objects.find(o => o.exists && o.class === type.class);
            item.carried = true;
        }
        for (const item of s.state.objects.filter(o => o.class === CLASS.TOKEN)) {
            item.exists = item.carried = true;
        }
        return inventoryEntries(s.state).map(e => e.label);
    }''')
    choose(page, 'USE')
    point = item_point(page, 'more')
    page.touchscreen.tap(*point)
    page.clock.run_for(160)
    assert session_eval(page, 's => s.state.itemPicker.selected.col === 2 && s.state.itemPicker.offset === 0')
    page.touchscreen.tap(*point)
    until(page, 's => s.state.itemPicker.offset > 0')
    assert not session_eval(page, 's => s.record.events.some(e => e.command === "USE")')
    page.keyboard.press('Escape')
    until(page, 's => !s.state.verb')
    choose(page, 'INVENTORY')
    shown = set()
    for _ in range(3):
        text = session_eval(page, 's => String.fromCharCode(...s.state.panel.map(c => c & 127))')
        shown.update(label for label in labels if label in text)
        page.touchscreen.tap(*item_point(page, 'more'))
        page.clock.run_for(160)
        assert session_eval(page, 's => s.state.itemPicker?.readOnly')
    assert shown == set(labels)
    assert 'TOKEN x75' in shown
    page.touchscreen.tap(*screen_point(page, [160, 80]))
    until(page, 's => !s.state.verb')
    assert not session_eval(page, 's => s.record.events.some(e => e.command || e.stick?.some(Boolean))')

print('browser_inventory_test: touch EAT, mouse DROP, Escape, consumed dismissal and overflow paging passed')
