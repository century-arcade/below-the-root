"""Monitor controls remain operable on desktop and touch phones."""
from browser_helpers import browser_page, observe, held, until, session_eval
from playwright.sync_api import expect


with browser_page('/play?room=B8') as page:
    expect(page.locator('#monitor')).to_have_attribute('data-surround', 'dark')
    power = page.get_by_role('button', name='Monitor power', exact=True)
    until(page, 's => s.state.quest')
    session_eval(page, 's => window.oldSession = s')
    page.keyboard.press('p')
    power.click()
    expect(power).to_have_attribute('aria-pressed', 'false')
    expect(page.locator('#screen')).not_to_be_visible()
    before = observe(page)
    assert before['title'] and not before['quest'], 'power off discards the quest'
    assert session_eval(page, 's => s !== oldSession'), 'power creates a fresh session'
    assert session_eval(page, 's => s.record == null && !s.canBackRoom')
    assert page.evaluate("localStorage.getItem('btr.autosave.v3')") is None
    page.keyboard.press('ArrowRight')
    page.keyboard.press('p')
    held(page, 'power')
    assert observe(page)['checkpoint'] == before['checkpoint'], 'power off leaves the reset game idle'
    assert observe(page)['frame'] == before['frame'], 'power off stops game time'
    volume = page.get_by_role('slider', name='Volume', exact=True)
    volume.fill('70')
    expect(volume).to_have_attribute('aria-valuetext', '70%')
    power.focus()
    page.keyboard.press('Space')
    expect(power).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#screen')).to_be_visible()
    until(page, '(s, frame) => s.frame > frame', arg=before['frame'])
    menu = observe(page)
    assert menu['title'] and not menu['quest'], 'power on resumes at a fresh menu'
    until(page, 's => String.fromCharCode(...s.state.panel.map(value => value & 127)).includes("START GAME")')
    assert 'CONTINUE' not in ''.join(chr(value & 127) for value in observe(page)['panel'])
    expect(volume).to_have_value('70')
    page.get_by_role('button', name='Fullscreen', exact=True).click()
    page.wait_for_function('document.fullscreenElement !== null')
    expect(page.get_by_role('group', name='Monitor controls')).to_be_hidden()
    expect(page.locator('#screen')).to_be_visible()
    page.evaluate('document.exitFullscreen()')
    expect(page.get_by_role('group', name='Monitor controls')).to_be_visible()
print('browser_monitor_test: power and volume passed')

for surround in ['commodore', 'dark']:
    for width, height in [(320, 800), (360, 800), (400, 800), (412, 915)]:
        def setup(page):
            page.add_init_script(f"localStorage.setItem('btr.surround', '{surround}')")

        with browser_page('/play?room=B8', setup=setup, viewport={'width': width, 'height': height},
                          is_mobile=True, has_touch=True, device_scale_factor=2.625) as page:
            power = page.get_by_role('button', name='Monitor power', exact=True)
            power.tap()
            expect(power).to_have_attribute('aria-pressed', 'false')
            power.tap()
            expect(power).to_have_attribute('aria-pressed', 'true')
            volume = page.get_by_role('slider', name='Volume', exact=True)
            volume.tap()
            volume.fill('70')
            expect(volume).to_have_attribute('aria-valuetext', '70%')
            page.evaluate('window.scrollTo(1000, 0)')
            assert page.evaluate('window.scrollX') == 0, 'the clipped case cannot pan the page sideways'
            page.get_by_role('button', name='Fullscreen', exact=True).tap()
            page.wait_for_function('document.fullscreenElement !== null')
            page.evaluate('document.exitFullscreen()')
            page.wait_for_function('document.fullscreenElement === null')
            power.tap()
            expect(power).to_have_attribute('aria-pressed', 'false')
        print(f'browser_monitor_test: {surround} controls at {width}x{height} passed')
