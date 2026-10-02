"""Manual navigation, lazy page fetching, and native enlargement."""
from browser_helpers import browser_page
from playwright.sync_api import expect


with browser_page('/') as page:
    reader = page.locator('#manual')
    image = reader.locator('img')
    previous = reader.get_by_role('button', name='Previous manual page')
    next_page = reader.get_by_role('button', name='Next manual page')
    select = reader.get_by_role('combobox', name='Manual scan')
    requests = []
    page.on('request', lambda request: requests.append(request.url)
            if '/assets/manual/' in request.url else None)
    expect(previous).to_be_disabled()
    expect(select.locator('option')).to_have_count(20)
    next_page.click()
    expect(image).to_have_attribute('src', '/assets/manual/02.webp')
    expect(previous).to_be_enabled()
    select.select_option('20')
    expect(next_page).to_be_disabled()
    expect(image).to_have_attribute('alt', 'Original Below the Root manual, scan 20 of 20')
    previous.click()
    expect(select).to_have_value('19')
    expect(next_page).to_be_enabled()
    select.select_option('5')
    page.wait_for_function("document.querySelector('#manual img').complete && document.querySelector('#manual img').naturalWidth > 0")
    with page.expect_popup() as popup_info:
        reader.get_by_role('link', name='Enlarge manual page (opens in a new tab)').click()
    popup = popup_info.value
    popup.wait_for_load_state()
    assert popup.url.endswith('/assets/manual/05.webp'), popup.url
    popup.close()
    next_page.focus()
    page.keyboard.press('Space')
    expect(select).to_have_value('6')
    select.focus()
    page.keyboard.press('m')
    expect(page.locator('#map-screen')).to_be_hidden()
    assert not any(url.endswith('/10.webp') for url in requests), requests

print('pass: manual navigation, on-demand scans, and enlargement')
