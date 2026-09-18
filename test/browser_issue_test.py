"""Issue drafts survive failed submissions; retry and cancellation resume gameplay. GitHub is mocked."""
import json
from browser_helpers import browser_page, observe, held, until

with browser_page('/?player=0&debug') as page:
    posted = []

    def github(route):
        if 'op=issue' in route.request.url:
            posted.append(route.request.post_data_json)
            recording = json.loads(posted[-1]['recording'])
            assert posted[-1]['meta'] == {'simticks': recording['checkpoint']['simticks'], 'room': recording['checkpoint']['room']}
            if len(posted) == 1:
                route.fulfill(status=502, json={"error": "Test network failure; message kept."})
                return
            route.fulfill(status=201, json={"url": "https://github.com/century-arcade/below-the-root/issues/123", "number": 123,
                                          "gist": "https://gist.github.com/tester/456" if len(posted) == 2 else None})
        else:
            route.fulfill(json={"configured": True, "login": "tester"})

    page.route('**/.netlify/functions/github?*', github)
    page.reload()
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    until(page, "s => localStorage.getItem('btr.autosave.v3') !== null")

    def frames():
        return observe(page)['frame']

    page.keyboard.press('r')
    assert page.locator('#issue-dialog').evaluate("e => e.open && !e.matches(':modal')")
    saved = observe(page)
    draft = 'wasd and spaces should only type here\nThe doorway did not open.'
    page.locator('#issue-message').fill(draft)
    assert page.locator('#issue-message').input_value() == draft
    page.locator('#issue-submit').click()
    page.locator('#issue-result').filter(has_text='Test network failure').wait_for()
    assert page.locator('#issue-dialog').evaluate('e => e.open')
    assert page.locator('#issue-message').input_value() == draft
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") == draft
    held(page, 'dialog')
    assert frames() == saved['frame'], 'a failed submission must keep game time paused'
    page.locator('#issue-submit').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.wait_for_function('consoleMessages.includes("Issue #123 filed with playthrough")')
    assert len(posted) == 2
    context = json.loads(posted[0]['context'])
    assert 'recentEvents' in context
    assert 'player' in context
    assert context['simticks'] >= json.loads(posted[0]['recording'])['checkpoint']['simticks']
    assert posted[1] == posted[0], 'retry must retain the message and captured context'
    assert page.locator('#issue-message').input_value() == ''
    assert page.evaluate("sessionStorage.getItem('btr.issue-draft')") is None
    page.wait_for_function("document.activeElement === document.getElementById('screen')")
    until(page, '(s, frame) => s.frame > frame', saved['frame'])
    assert frames() > saved['frame'], 'successful submission must resume game time'
    before_events = len(observe(page)['events'])
    page.keyboard.press('ArrowRight')
    until(page, '(s, start) => s.record.events.slice(start).some(e => e.stick?.[0] === 1)', before_events)
    assert any(e.get('stick') == [1, 0, 0] for e in observe(page)['events'][before_events:])
    page.keyboard.press('r')
    assert page.locator('#issue-message').input_value() == ''
    stopped = frames()
    held(page, 'dialog')
    assert frames() == stopped
    page.locator('#issue-cancel').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.wait_for_function("document.activeElement === document.getElementById('screen')")
    until(page, '(s, frame) => s.frame > frame', stopped)
    assert frames() > stopped, 'manual close must resume game time'
    page.keyboard.press('r')
    page.locator('#issue-message').fill('Report with failed playthrough upload')
    page.locator('#issue-submit').click()
    page.locator('#issue-dialog').wait_for(state='hidden')
    page.wait_for_function('consoleMessages.includes("Issue #123 filed; playthrough upload failed")')
print('browser_issue_test: draft isolation, retry and resume passed')
