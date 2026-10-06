"""A book page stays hidden until its image is decoded, so alt text never shows; clicking the left page turns back; first/last jump to the ends."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('BTR_URL', 'http://localhost:8000') + '/')
    page.click('[data-desk-go="outside"]')
    left ="document.querySelector('#box [data-book-image] img')"
    page.wait_for_function(f"{left}.style.visibility === 'hidden'", polling=50)
    turned = page.evaluate(f"""() => {{
        document.querySelector('#box [data-book-image]').click();
        return [{left}.getAttribute('src'), {left}.style.visibility];
    }}""")
    assert turned == [None, 'hidden'], turned
    page.wait_for_function(f"{left}.style.visibility === '' && {left}.src.endsWith('inside_l.jpg')", polling=50)
    assert page.evaluate(f"{left}.complete && {left}.naturalWidth > 0")
    page.click('[data-desk-go="manual"]')
    caption = "document.querySelector('#manual output').textContent"
    page.click('#manual [data-book-image] img + img')
    page.wait_for_function(f"{caption} === 'Pages 2–3 / 18'", polling=50)
    page.click('#manual [data-book-image] img')
    page.wait_for_function(f"{caption} === 'Page 1 / 18'", polling=50)
    page.click('#manual [data-book-last]')
    page.wait_for_function(f"{caption} === 'Page 18 / 18'", polling=50)
    page.keyboard.press('Home')
    page.wait_for_function(f"{caption} === 'Page 1 / 18'", polling=50)
    assert not errors, errors
    browser.close()

print('browser_book_test: book pages stay hidden until decoded, the left page turns back, and first/last jump to the ends passed')
