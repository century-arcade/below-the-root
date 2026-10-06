"""Monitor controls remain operable on desktop and touch phones."""
from browser_helpers import browser_page, observe, held, until, session_eval
from playwright.sync_api import expect


with browser_page('/play?room=B8') as page:
    power = page.get_by_role('button', name='Monitor power', exact=True)
    until(page, 's => s.state.quest')
    session_eval(page, 's => window.oldSession = s')
    page.keyboard.press('p')
    power.click()
    expect(power).to_have_attribute('aria-pressed', 'false')
    expect(page.locator('#screen')).not_to_be_visible()
    before = observe(page)
    assert not before['quest'], 'power off discards the quest'
    assert session_eval(page, 's => s !== oldSession'), 'power creates a fresh session'
    assert session_eval(page, 's => s.record == null && !s.canBackRoom')
    assert page.evaluate("localStorage.getItem('btr.autosave.v3')") is None
    page.keyboard.press('ArrowRight')
    page.keyboard.press('p')
    held(page, 'power')
    assert observe(page)['checkpoint'] == before['checkpoint'], 'power off leaves the reset game idle'
    volume = page.get_by_role('slider', name='Volume', exact=True)
    volume.fill('70')
    expect(volume).to_have_attribute('aria-valuetext', '70%')
    power.focus()
    page.keyboard.press('Space')
    expect(power).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#screen')).to_be_visible()
    held(page, 'title')
    page.locator('#screen').focus()
    page.keyboard.press('Space')
    until(page, '(s, frame) => s.frame > frame', arg=before['frame'])
    fresh = observe(page)
    assert fresh['demo'] == 'intro' and not fresh['quest'], 'power on is a fresh launch'
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
            page.add_init_script(f"localStorage.setItem('btr.surround.v2', '{surround}')")

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
            page.get_by_role('button', name='Fullscreen', exact=True).tap()
            page.wait_for_function('document.fullscreenElement !== null')
            page.evaluate('document.exitFullscreen()')
            page.wait_for_function('document.fullscreenElement === null')
            power.tap()
            expect(power).to_have_attribute('aria-pressed', 'false')
        print(f'browser_monitor_test: {surround} controls at {width}x{height} passed')


with browser_page('/play?room=B8') as page:
    page.get_by_role('button', name='Manual', exact=True).click()
    page.evaluate('document.documentElement.requestFullscreen()')
    page.wait_for_function('document.fullscreenElement !== null')
    expect(page.locator('#manual')).to_be_visible()
    expect(page.locator('#screen')).to_be_hidden()
    page.get_by_role('button', name='Map', exact=True).click()
    expect(page.locator('#paper-map')).to_be_visible()
    expect(page.get_by_role('button', name='Game', exact=True)).to_be_visible()
    page.get_by_role('button', name='Game', exact=True).click()
    expect(page.locator('#screen')).to_be_visible()
    expect(page.get_by_role('group', name='Monitor controls')).to_be_hidden()
    page.locator('#screen').focus()
    page.keyboard.press('m')
    expect(page.locator('#paper-map')).to_be_visible()
    expect(page.get_by_role('button', name='Game', exact=True)).to_be_hidden()
print('browser_monitor_test: fullscreen bares the screen only from the computer, map included')

with browser_page('/play?room=B8', viewport={'width': 915, 'height': 412}) as page:
    page.locator('#screen').click()
    expect(page.get_by_role('group', name='Monitor controls')).to_be_visible()
    assert page.evaluate('document.fullscreenElement') is None, 'a short desktop window never goes fullscreen by itself'
print('browser_monitor_test: a short desktop window keeps the monitor and desk')


def record_locks(page):
    page.add_init_script('''
        window.orientationLocks = [];
        screen.orientation.lock = type => { orientationLocks.push(type); return Promise.resolve(); };
    ''')


with browser_page('/play?room=B8', setup=record_locks, viewport={'width': 915, 'height': 412},
                  is_mobile=True, has_touch=True) as page:
    page.locator('#screen').tap()
    page.wait_for_function('document.fullscreenElement !== null')
    assert page.evaluate('orientationLocks') == ['landscape'], 'landscape fullscreen holds landscape'
print('browser_monitor_test: landscape fullscreen orientation lock passed')


def record_wake_locks(page):
    page.add_init_script('''
        window.wakeLocks = [];
        window.wakeRefusals = 1;
        Object.defineProperty(navigator, 'wakeLock', { value: { request(type) {
            if (wakeRefusals-- > 0) return Promise.reject(new DOMException('no', 'NotAllowedError'));
            const lock = { type, released: false, release() { this.released = true; this.onrelease?.(); } };
            wakeLocks.push(lock);
            return Promise.resolve(lock);
        } } });
    ''')


with browser_page('/play?room=B8', setup=record_wake_locks) as page:
    page.locator('#screen').click()
    page.wait_for_function('wakeLocks.length === 1 && wakeLocks[0].type === "screen"')
    page.evaluate('wakeLocks[0].release()')
    page.locator('#screen').click()
    page.wait_for_function('wakeLocks.length === 2 && !wakeLocks[1].released')
    page.get_by_role('button', name='Monitor power', exact=True).click()
    page.wait_for_function('wakeLocks[1].released')
    page.get_by_role('button', name='Monitor power', exact=True).click()
    page.wait_for_function('wakeLocks.length === 3 && !wakeLocks[2].released')
print('browser_monitor_test: the screen stays awake while the monitor is on')
