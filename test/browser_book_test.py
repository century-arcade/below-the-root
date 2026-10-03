"""A book page stays hidden until its image is decoded, so alt text never shows."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('BTR_URL', 'http://localhost:8000') + '/')
    page.wait_for_selector('#box [data-book-image] img', state='attached')
    left = "document.querySelector('#box [data-book-image] img')"
    turned = page.evaluate(f"""() => {{
        document.querySelector('#box [data-book-image]').click();
        return [{left}.getAttribute('src'), {left}.style.visibility];
    }}""")
    assert turned == [None, 'hidden'], turned
    page.wait_for_function(f"{left}.style.visibility === '' && {left}.src.endsWith('inside_l.jpg')", polling=50)
    assert page.evaluate(f"{left}.complete && {left}.naturalWidth > 0")
    assert not errors, errors
    browser.close()

print('browser_book_test: box pages stay hidden until their images are decoded passed')
