"""Browser integration checks; run against make serve. GitHub is mocked: no issue is posted."""
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={"width": 900, "height": 750})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    posted = []

    def github(route):
        if 'op=issue' in route.request.url:
            posted.append(route.request.post_data_json)
            if len(posted) == 1:
                route.fulfill(status=502, json={"error": "Test network failure; message kept."})
                return
            route.fulfill(status=201, json={"url": "https://github.com/century-arcade/below-the-root/issues/123", "number": 123})
        else:
            route.fulfill(json={"configured": True, "login": "tester"})

    page.route('**/.netlify/functions/github?*', github)
    page.goto('http://localhost:8000/?player=0&debug')
    page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
    assert page.locator('#help').count() == 0
    assert page.locator('#status').count() == 0
    box = page.locator('#screen').bounding_box()
    page.mouse.move(box['x'] + box['width'] * .9, box['y'] + box['height'] * .3)
    page.mouse.down()
    page.dispatch_event('#screen', 'pointercancel', {"pointerId": 1})
    page.wait_for_timeout(350)
    page.mouse.up()
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert not page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).inputs"), 'cancelled pointer must not produce input'
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(350)
    page.keyboard.up('ArrowRight')
    page.locator('#file-issue').click()
    saved = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
    page.locator('#issue-message').fill('wasd and spaces should only type here\nThe doorway did not open.')
    page.wait_for_timeout(150)
    assert page.locator('#issue-message').input_value().startswith('wasd and spaces')
    page.locator('#issue-submit').click()
    page.locator('#issue-result').filter(has_text='Test network failure').wait_for()
    assert page.locator('#issue-message').input_value().startswith('wasd and spaces')
    page.locator('#issue-submit').click()
    page.get_by_role('link', name='Issue #123 filed — open on GitHub').wait_for()
    assert len(posted) == 2
    assert 'recentInputs' in posted[0]['context']
    assert 'player' in posted[0]['context']
    assert page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).frames") == saved['frames'], 'issue dialog must pause game time'
    with page.expect_download() as dl:
        page.locator('#issue-cancel').click()
        page.locator('#download-record').click()
    dl.value.save_as('/tmp/btr-browser-record.json')
    record = json.load(open('/tmp/btr-browser-record.json'))
    assert record['format'] == 'below-the-root-record'
    page.goto('http://localhost:8000/?debug')
    page.locator('#file-issue').wait_for()
    page.wait_for_timeout(200)
    assert 'diverged' not in page.locator('#notice').inner_text()
    assert page.locator('#where').inner_text() == record['checkpoint']['room']
    page.locator('#load-record').set_input_files('/tmp/btr-browser-record.json')
    page.get_by_role('status').filter(has_text='Loaded btr-browser-record.json').wait_for()
    assert not errors, errors
    page.screenshot(path='/tmp/btr-debug.png')
    page.goto('http://localhost:8000/')
    page.wait_for_timeout(200)
    assert not page.locator('#debug').is_visible()
    page.set_viewport_size({"width": 280, "height": 560})
    page.wait_for_timeout(100)
    assert page.locator('#screen').bounding_box()['width'] <= 280
    browser.close()
    print('browser_test: autosave/resume, debug visibility, issue form isolation, mocked issue creation, record download/import, small viewport passed')
