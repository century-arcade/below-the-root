"""Pause/resume controls stop game time; menu navigation preserves the quest."""
from browser_helpers import browser_page, observe, held, until

with browser_page('/?player=0') as page:
    def frames():
        return observe(page)['frame']

    page.keyboard.press('Escape')
    stopped = frames()
    held(page, 'pause')
    page.keyboard.press('ArrowRight')
    until(page, '(s, frame) => s.frame > frame', stopped)

    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    menu = observe(page)
    assert menu['title'] and menu['quest']
    page.reload()
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    assert observe(page)['quest'] and not observe(page)['title']
print('browser_pause_test: pause/resume and quest preservation passed')
