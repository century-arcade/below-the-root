"""Manual save slots in DISK STORAGE persist independently of autosave and monitor power."""
import json
from browser_helpers import browser_page, observe, until
from playwright.sync_api import expect

SAVES_KEY = 'btr.saves.v1'
AUTOSAVE_KEY = 'btr.autosave.v3'


def panel_text(page):
    return ''.join(chr(value & 127) for value in observe(page)['panel'])


def panel_has(page, text):
    until(
        page,
        '(s, needle) => String.fromCharCode(...s.state.panel.map(v => v & 127)).includes(needle)',
        text,
    )


def tap_key(page, key):
    page.keyboard.press(key)
    page.clock.run_for(120)


with browser_page('/play?player=1') as page:
    until(page, 's => s.state.quest && s.state.active')
    tap_key(page, 'ArrowLeft')
    until(page, '() => localStorage.getItem("btr.autosave.v3") !== null')

    page.locator('#home').click()
    until(page, 's => s.state.title && s.state.menuSel === 0')
    panel_has(page, 'DISK STORAGE')

    # Move from START GAME -> CONTINUE -> DISK STORAGE and verify Escape cancels cleanly.
    tap_key(page, 'ArrowDown')
    tap_key(page, 'ArrowDown')
    until(page, 's => s.state.menuSel === 2')
    tap_key(page, 'Enter')
    until(page, 's => s.state.diskStorage')
    panel_has(page, 'SAVE GAME')

    tap_key(page, 'Escape')
    until(page, 's => !s.state.diskStorage && s.state.title')
    expect(page.locator('#screen')).to_be_visible()

    # Re-enter DISK STORAGE -> SAVE GAME -> QUEST 1 and save to an empty slot.
    tap_key(page, 'Enter')
    until(page, 's => s.state.diskStorage')
    panel_has(page, 'SAVE GAME')
    tap_key(page, 'Enter')
    panel_has(page, 'EMPTY')
    tap_key(page, 'Enter')
    panel_has(page, 'SAVING QUEST...')
    panel_has(page, 'GAME SAVED')
    until(page, 's => !s.state.diskStorage && s.state.menuSel === 1 && s.state.verbWait === 0')
    panel_has(page, 'CONTINUE')

    raw = page.evaluate('localStorage.getItem(arguments[0])', SAVES_KEY)
    assert raw is not None
    payload = json.loads(raw)
    assert payload['version'] == 1
    assert len(payload['slots']) == 5
    assert payload['slots'][0] is not None
    assert payload['slots'][0]['meta']['character'] == 1

    # Verify OVERWRITE prompt: Escape and default NO preserve slot; YES overwrites.
    tap_key(page, 'ArrowDown')
    until(page, 's => s.state.menuSel === 2')
    tap_key(page, 'Enter')
    until(page, 's => s.state.diskStorage')
    tap_key(page, 'Enter')
    panel_has(page, 'QUEST')
    tap_key(page, 'Enter')
    panel_has(page, 'OVERWRITE QUEST 1?')

    tap_key(page, 'Escape')
    panel_has(page, 'QUEST')
    tap_key(page, 'Enter')
    panel_has(page, 'OVERWRITE QUEST 1?')
    tap_key(page, 'Enter')  # Default NO cancels overwrite and returns to slot picker.
    panel_has(page, 'QUEST')

    tap_key(page, 'Enter')
    panel_has(page, 'OVERWRITE QUEST 1?')
    tap_key(page, 'ArrowRight')
    tap_key(page, 'Enter')  # Confirm YES.
    panel_has(page, 'SAVING QUEST...')
    panel_has(page, 'GAME SAVED')
    until(page, 's => !s.state.diskStorage && s.state.menuSel === 1 && s.state.verbWait === 0')
    panel_has(page, 'CONTINUE')

    # Power off monitor: autosave is cleared while manual DISK STORAGE slots survive.
    power = page.get_by_role('button', name='Monitor power', exact=True)
    power.click()
    expect(power).to_have_attribute('aria-pressed', 'false')
    assert page.evaluate('localStorage.getItem(arguments[0])', AUTOSAVE_KEY) is None
    assert page.evaluate('localStorage.getItem(arguments[0])', SAVES_KEY) is not None

    # Power back on to a questless launch, open menu, load QUEST 1, and CONTINUE.
    power.click()
    expect(power).to_have_attribute('aria-pressed', 'true')
    until(page, "s => s.state.demo === 'intro' && !s.state.quest")
    page.locator('#home').click()
    until(page, 's => s.state.title && !s.state.quest')
    assert 'CONTINUE' not in panel_text(page)

    tap_key(page, 'ArrowDown')  # Skips hidden CONTINUE -> DISK STORAGE.
    until(page, 's => s.state.menuSel === 2')
    tap_key(page, 'Enter')
    until(page, 's => s.state.diskStorage')
    panel_has(page, 'LOAD GAME')  # Default mode when questless.
    tap_key(page, 'Enter')
    panel_has(page, 'GENAA')
    tap_key(page, 'Enter')
    panel_has(page, 'LOADING QUEST...')
    panel_has(page, 'GAME LOADED')

    until(page, 's => !s.state.diskStorage && s.state.quest && s.state.menuSel === 1 && s.state.verbWait === 0')
    panel_has(page, 'CONTINUE')
    assert 'CONTINUE' in panel_text(page)
    tap_key(page, 'Enter')
    until(page, 's => !s.state.title && s.state.active && s.state.character === 1')

print('browser_save_slots_test: save, overwrite, power-off isolation and load passed')
