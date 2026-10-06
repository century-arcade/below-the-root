"""Keyboard and mouse open the command menu without repeated activation."""
from browser_helpers import browser_page, observe, until
from playwright.sync_api import expect


with browser_page('/play?player=0') as page:
    menu_button = page.get_by_role('button', name='Open command menu', exact=True)
    expect(menu_button).to_be_visible()
    for action in ['f', 'click', 'Space', 'Enter']:
        if action == 'f':
            page.keyboard.press('f')
        elif action in ['Space', 'Enter']:
            menu_button.press(action)
        else:
            menu_button.click()
        expect(menu_button).to_be_hidden()
        until(page, 's => String.fromCharCode(...s.state.panel.map(v => v & 127)).includes("GRUNSPREKE")')
        panel = ''.join(chr(value & 127) for value in observe(page)['panel'])
        assert 'PAUSE' in panel and 'GRUNSPREKE' in panel
        page.keyboard.press('Escape')
        expect(menu_button).to_be_visible()
        resumed = observe(page)['frame']
        until(page, '(s, frame) => s.frame > frame', resumed)
    page.keyboard.down('f')
    expect(menu_button).to_be_hidden()
    page.clock.run_for(250)
    page.keyboard.down('f')
    page.clock.run_for(150)
    expect(menu_button).to_be_hidden()
    page.keyboard.up('f')
    page.clock.run_for(100)
    page.keyboard.press('f')
    until(page, 's => !s.state.commandMenuOpen')
    expect(menu_button).to_be_visible()

print('browser_command_menu_test: keyboard, mouse and held-key activation passed')
