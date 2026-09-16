"""Monitor selection persists, and power clears the game and restarts at the menu."""
import os
from browser_helpers import install_probe, observe
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    install_probe(page)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/play?room=B8&debug')
    surround = page.get_by_role('combobox', name='Monitor surround')
    for style in ['commodore', 'portable', 'dark']:
        surround.select_option(style)
        page.reload()
        expect(surround).to_have_value(style)
    power = page.get_by_role('button', name='Monitor power', exact=True)
    page.wait_for_function('window.questSession && questSession().state.quest')
    page.evaluate('window.oldSession = questSession()')
    page.keyboard.press('p')
    power.click()
    expect(power).to_have_attribute('aria-pressed', 'false')
    expect(page.locator('#screen')).not_to_be_visible()
    before = observe(page)
    assert before['title'] and not before['quest'], 'power off discards the quest'
    assert page.evaluate('questSession() !== oldSession'), 'power creates a fresh session'
    assert page.evaluate('questSession().record == null && !questSession().canBackRoom')
    assert page.evaluate("localStorage.getItem('btr.autosave.v3')") is None
    page.keyboard.press('ArrowRight')
    page.keyboard.press('p')
    page.wait_for_timeout(200)
    assert observe(page)['checkpoint'] == before['checkpoint'], 'power off leaves the reset game idle'
    assert observe(page)['frame'] == before['frame'], 'power off stops game time'
    volume = page.get_by_role('slider', name='Volume', exact=True)
    volume.fill('70')
    expect(volume).to_have_attribute('aria-valuetext', '70%')
    power.focus()
    page.keyboard.press('Space')
    expect(power).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#screen')).to_be_visible()
    page.wait_for_function('(frame) => questSession().frame > frame', arg=before['frame'])
    menu = observe(page)
    assert menu['title'] and not menu['quest'], 'power on resumes at a fresh menu'
    page.wait_for_function('String.fromCharCode(...questSession().state.panel.map(value => value & 127)).includes("START GAME")')
    assert 'CONTINUE' not in ''.join(chr(value & 127) for value in observe(page)['panel'])
    expect(volume).to_have_value('70')
    page.get_by_role('button', name='Fullscreen', exact=True).click()
    page.wait_for_function('document.fullscreenElement !== null')
    expect(page.get_by_role('group', name='Monitor controls')).to_be_hidden()
    expect(page.locator('#screen')).to_be_visible()
    page.evaluate('document.exitFullscreen()')
    expect(page.get_by_role('group', name='Monitor controls')).to_be_visible()
    assert not errors, errors
    browser.close()
print('browser_monitor_test: selection, persistence, power and volume passed')
