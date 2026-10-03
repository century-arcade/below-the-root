"""Portrait touch users can reach navigation, map and help."""
from browser_helpers import browser_page, unfold_map
from playwright.sync_api import expect


for width, height in [(412, 915), (360, 800)]:
    with browser_page('/play?room=B8', viewport={'width': width, 'height': height},
                      is_mobile=True, has_touch=True, device_scale_factor=2.625) as page:
        unfold_map(page)
        page.locator('#paper-map').tap()
        expect(page.get_by_role('dialog', name='World map')).to_be_visible()
        page.get_by_role('button', name='Close', exact=True).tap()
        expect(page.get_by_role('dialog', name='World map')).to_be_hidden()
        page.get_by_role('button', name='Help', exact=True).tap()
        expect(page.get_by_role('complementary', name='Input help')).to_be_visible()
        page.get_by_role('button', name='Help', exact=True).tap()
        expect(page.get_by_role('complementary', name='Input help')).to_be_hidden()
        for name, heading in [('Resources', 'Resources'), ('About', 'Below the Root')]:
            page.get_by_role('navigation').get_by_role('link', name=name, exact=True).tap()
            expect(page.get_by_role('heading', name=heading, exact=True)).to_be_visible()
        page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).tap()
        page.wait_for_selector('#volume[aria-valuetext]', state='attached')

print('browser_portrait_test: touch navigation, map and help passed')
