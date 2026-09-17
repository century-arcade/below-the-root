"""Pause/resume controls stop game time; menu navigation preserves the quest."""
from browser_helpers import browser_page, observe, held, until

with browser_page('/?player=0') as page:
    def frames():
        return observe(page)['frame']

    page.keyboard.press('Escape')
    stopped = frames()
    held(page, 'pause')
    assert frames() == stopped, 'Escape must stop game time'
    page.keyboard.press('ArrowRight')
    until(page, '(s, frame) => s.frame > frame', stopped)
    assert frames() > stopped, 'a movement key must resume game time'
    page.evaluate("dispatchEvent(new Event('blur'))")
    stopped = frames()
    held(page, 'focus')
    assert frames() == stopped, 'leaving the window must pause game time'
    page.locator('#screen').click()
    until(page, '(s, frame) => s.frame > frame', stopped)
    assert frames() > stopped, 'a tap on the screen must resume game time'

    # The main menu is presentation; returning to Play preserves quest state.
    saved = observe(page)
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    menu = observe(page)
    assert menu['title'] and menu['quest']
    assert menu['checkpoint']['objects'] == saved['checkpoint']['objects']
    page.reload()
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    assert observe(page)['quest'] and not observe(page)['title']
print('browser_pause_test: pause/resume and quest preservation passed')
