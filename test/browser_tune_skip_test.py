"""Any non-movement, non-shortcut key skips a skippable tune; movement keys keep steering."""
from browser_helpers import browser_page, session_eval, until


def start_tune(page):
    session_eval(page, '''async s => {
        const {startTune} = await import('/audio.js');
        startTune(s.state, 0);
    }''')
    assert session_eval(page, 's => s.state.tuneWait != null && !s.state.verb')


def tap(page, key):
    page.keyboard.press(key)
    page.clock.run_for(160)


with browser_page('/play?player=0') as page:
    page.locator('#screen').click()
    for key in ['x', 'f', '1']:
        start_tune(page)
        tap(page, key)
        until(page, 's => s.state.tuneWait == null', milliseconds=400)
        assert not session_eval(page, 's => s.state.commandMenuOpen'), key

    start_tune(page)
    for key in ['ArrowLeft', 'r', '-', '=']:
        tap(page, key)
    assert session_eval(page, 's => s.state.tuneWait != null')

print('browser_tune_skip_test: letter, F and digit skips; movement and shortcuts do not passed')
