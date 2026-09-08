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
    assert ' tick ' not in page.locator('#debug-status').inner_text()
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

    def frames():
        page.evaluate("dispatchEvent(new Event('pagehide'))")
        return page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).frames")

    page.keyboard.press('Escape')
    assert page.locator('#game').evaluate("e => e.classList.contains('paused')")
    page.wait_for_function("document.getElementById('where').textContent.includes('PAUSED')")
    stopped = frames()
    page.wait_for_timeout(300)
    assert frames() == stopped, 'Escape must stop game time'
    page.keyboard.press('ArrowRight')
    assert not page.locator('#game').evaluate("e => e.classList.contains('paused')")
    page.wait_for_function("!document.getElementById('where').textContent.includes('PAUSED')")
    page.wait_for_timeout(300)
    assert frames() > stopped, 'a movement key must resume game time'
    page.evaluate("dispatchEvent(new Event('blur'))")
    assert page.locator('#game').evaluate("e => e.classList.contains('paused')"), 'leaving the window must pause'
    stopped = frames()
    page.wait_for_timeout(300)
    assert frames() == stopped
    page.locator('#screen').click()
    assert not page.locator('#game').evaluate("e => e.classList.contains('paused')"), 'a tap on the screen must resume'
    page.wait_for_timeout(300)
    assert frames() > stopped
    page.wait_for_timeout(350)

    page.keyboard.press('r')
    assert page.locator('#issue-dialog').evaluate("e => e.open && !e.matches(':modal')")
    saved = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
    draft = 'wasd and spaces should only type here\nThe doorway did not open.'
    page.locator('#issue-message').fill(draft)
    page.wait_for_timeout(150)
    assert page.locator('#issue-message').input_value() == draft
    page.locator('#issue-submit').click()
    page.locator('#issue-result').filter(has_text='Test network failure').wait_for()
    assert page.locator('#issue-dialog').evaluate('e => e.open')
    assert page.locator('#issue-message').input_value() == draft
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") == draft
    page.wait_for_timeout(300)
    assert frames() == saved['frames'], 'a failed submission must keep game time paused'
    page.locator('#issue-submit').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.locator('#notice').filter(has_text='Issue #123 filed').wait_for()
    assert len(posted) == 2
    assert 'recentInputs' in posted[0]['context']
    assert 'player' in posted[0]['context']
    assert posted[1] == posted[0], 'retry must retain the message and captured context'
    assert page.locator('#issue-message').input_value() == ''
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") is None
    page.wait_for_function("document.activeElement === document.getElementById('file-issue')")
    page.wait_for_timeout(300)
    assert frames() > saved['frames'], 'successful submission must resume game time'
    gestures = len(saved['gestures'])
    page.keyboard.press('ArrowRight')
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    recorded = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1')).gestures")
    assert [g[1:] for g in recorded[gestures:]] == [['keydown', 'ArrowRight'], ['keyup', 'ArrowRight']], 'filing an issue must return keyboard input to the game without another click'
    page.keyboard.press('r')
    assert page.locator('#issue-message').input_value() == ''
    stopped = frames()
    page.wait_for_timeout(300)
    assert frames() == stopped
    page.locator('#issue-cancel').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.wait_for_function("document.activeElement === document.getElementById('file-issue')")
    page.wait_for_timeout(300)
    assert frames() > stopped, 'manual close must resume game time'
    with page.expect_download() as dl:
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
    browser.close()
    print('browser_test: autosave/resume, pause and resume, debug visibility, issue form isolation, mocked issue creation, record download/import passed')
