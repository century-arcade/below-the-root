"""Every desk item keeps its controls usable on phones, tablets and desktops, including a phone turned sideways after opening it, and a spread gives way to single pages where it would be too small."""
from contextlib import contextmanager
import os
from playwright.sync_api import expect, sync_playwright

PHONE = {'is_mobile': True, 'has_touch': True}
SCREENS = [
    ('phone portrait', {'width': 390, 'height': 844}, PHONE),
    ('small phone', {'width': 320, 'height': 640}, PHONE),
    ('phone turned to landscape', {'width': 844, 'height': 390}, PHONE),
    ('tablet', {'width': 768, 'height': 1024}, PHONE),
    ('desktop', {'width': 1280, 'height': 720}, {}),
]
BOOKS = [('Foreword', '#note', '[data-book-image]'), ('Box', '#box', '[data-book-image]'), ('Manual', '#manual', '[data-book-image]')]


# Live clock: the desk lays out from resize observations, which a frozen clock withholds.
@contextmanager
def desk_page(browser, viewport, device):
    page = browser.new_page(viewport=viewport, **device)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('BTR_URL', 'http://localhost:8000') + '/play.html')
    yield page
    assert not errors, errors
    page.close()


def turn_phone(page, viewport):
    page.context.new_cdp_session(page).send('Emulation.setDeviceMetricsOverride', {
        **viewport, 'deviceScaleFactor': 1, 'mobile': True,
        'screenOrientation': {'type': 'landscapePrimary' if viewport['width'] > viewport['height'] else 'portraitPrimary',
                              'angle': 90 if viewport['width'] > viewport['height'] else 0}})


def assert_usable(page, section, content):
    expect(page.locator(f'{section} {content}')).to_be_visible()
    for button in page.locator(f'{section} .page-turns button:enabled').all():
        button.click(trial=True, timeout=2000)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for name, viewport, device in SCREENS:
        with desk_page(browser, viewport, device) as page:
            for label, section, content in BOOKS:
                turned = viewport['width'] > viewport['height'] and device
                if turned:
                    turn_phone(page, {'width': viewport['height'], 'height': viewport['width']})
                page.get_by_role('button', name=label, exact=True).click()
                if turned:
                    turn_phone(page, viewport)
                expect(page.locator(f'{section} [data-book-previous]')).to_be_disabled()
                assert_usable(page, section, content)
                zoom = page.locator(f'{section} [data-book-zoom]')
                zoom.click()
                expect(zoom).to_have_attribute('aria-pressed', 'true')
                assert_usable(page, section, content)
                zoom.click()
        print(f'browser_desk_test: foreword, box and manual controls usable on {name} passed')

    for name, viewport, device, after_next in [
        ('phone portrait', {'width': 390, 'height': 844}, PHONE, 'Page 2 / 18'),
        ('desktop', {'width': 1280, 'height': 720}, {}, 'Pages 2–3 / 18'),
    ]:
        with desk_page(browser, viewport, device) as page:
            page.get_by_role('button', name='Manual', exact=True).click()
            page.locator('#manual [data-book-next]').click()
            expect(page.locator('#manual output')).to_have_text(after_next)
        print(f'browser_desk_test: the manual turns to {after_next.lower()} on {name} passed')

    with desk_page(browser, {'width': 390, 'height': 844}, PHONE) as page:
        page.get_by_role('button', name='Foreword', exact=True).click()
        expect(page.locator('#note [data-book-image] > .sheet').first).to_contain_text('Arcade')
        expect(page.locator('#note [data-book-previous]')).to_be_disabled()
    print('browser_desk_test: on a phone the foreword opens on its cover alone passed')
    browser.close()
