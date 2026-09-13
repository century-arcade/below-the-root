"""Recording playback, pause timing and returning to the live quest; no external services."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('BTR_URL', 'http://localhost:8000').rstrip('/')
KEY = 'btr.autosave.v1'
FIXTURE = Path(__file__).parent / 'fixtures' / 'pomma-win.json'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.goto(URL + '/play.html?player=0&debug')
    page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
    page.locator('#screen').focus()

    def snapshot():
        with page.expect_download() as result:
            page.locator('#download-record').evaluate('(button) => button.click()')
        return json.loads(Path(result.value.path()).read_text())

    page.keyboard.press('Escape')
    paused = snapshot()
    page.wait_for_timeout(250)
    assert snapshot()['checkpoint']['stats']['milliseconds'] == paused['checkpoint']['stats']['milliseconds']
    page.keyboard.press('Escape')
    page.wait_for_timeout(250)
    assert snapshot()['checkpoint']['stats']['milliseconds'] > paused['checkpoint']['stats']['milliseconds']

    page.locator('#record-file').set_input_files(FIXTURE)
    expect(page.locator('#replay-controls')).to_be_visible()
    expect(page.locator('#replay-status')).to_contain_text('Replaying:')
    saved = page.evaluate('(key) => localStorage.getItem(key)', KEY)
    # Each press seeks one transition, leaving recorded input in control.
    for _ in range(2):
        before = page.locator('#replay-status').text_content()
        page.keyboard.press('Space')
        page.wait_for_function('(before) => document.getElementById("replay-status").textContent !== before', arg=before)
    assert snapshot() == json.loads(FIXTURE.read_text()), 'download preserves the full uploaded journal'
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == saved

    page.locator('#stop-replay').click()
    expect(page.locator('#replay-controls')).to_be_hidden()
    page.keyboard.press('Escape')
    returned = snapshot()
    assert returned['seed'] == paused['seed']
    assert returned['checkpoint']['player']['name'] == 'NERIC'

    # A short valid recording has no further room change: Space stops at EOF.
    page.locator('#record-file').set_input_files({
        'name': 'short.json', 'mimeType': 'application/json', 'buffer': json.dumps(returned).encode(),
    })
    expect(page.locator('#replay-controls')).to_be_visible()
    page.locator('#screen').focus()
    page.keyboard.press('Space')
    expect(page.locator('#replay-status')).to_have_text('Replay finished')
    page.keyboard.press('Space')
    expect(page.locator('#replay-status')).to_have_text('Replay finished')
    page.locator('#stop-replay').click()

    broken = {**returned, 'checkpoint': {**returned['checkpoint'], 'quest': False}}
    page.locator('#record-file').set_input_files({
        'name': 'broken.json', 'mimeType': 'application/json', 'buffer': json.dumps(broken).encode(),
    })
    page.locator('#next-replay-room').click()
    expect(page.locator('#replay-status')).to_have_text('Replay failed')
    expect(page.locator('#log')).to_contain_text('does not replay')
    assert not errors, errors
    page.close()

    # Control animation time to check playback speed without wall-clock races.
    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.add_init_script('''
        let now = 0;
        let callbacks = [];
        performance.now = () => now;
        window.requestAnimationFrame = callback => callbacks.push(callback);
        window.advancePlayback = milliseconds => {
            const end = now + milliseconds;
            while (now < end) {
                now = Math.min(end, now + 10);
                const pending = callbacks;
                callbacks = [];
                for (const callback of pending) callback(now);
            }
        };
    ''')
    page.goto(URL + '/play.html?player=0&debug')
    page.wait_for_function('document.getElementById("record-file").onchange !== null', polling=100)
    recordings = page.evaluate('''async () => {
        const { loadData } = await import('/data.js');
        const { Session } = await import('/record.js');
        const { exportSave } = await import('/save.js');
        const { IDLE } = await import('/input.js');
        const data = await loadData(path => fetch('/' + path).then(r => r.json()));
        const watch = Session.watch;
        Session.watch = (...args) => window.watchedReplay = watch(...args);
        const down = { dx: 0, dy: 1, fire: false };
        const live = { joy: down, read() { return this.joy; } };
        const room = code => new Session(data, live, {
            initial: { mode: 'quest', room: data.roomByCode.get(code).room }, seed: 1,
        });
        const session = room('16');
        for (let i = 0; i < 180; i++) {
            if (i === 60) session.load(exportSave(room('26').state));
            if (i === 120) session.load(exportSave(room('25').state));
            session.step(i < 60 ? 50 : i < 120 ? 100 : 20);
            session.state.events.length = 0;
        }
        const idle = new Session(data, live, { initial: { mode: 'quest' }, seed: 1 });
        for (let i = 0; i < 1920; i++) {
            live.joy = i >= 60 && i < 1860 ? IDLE : down;
            idle.step(500);
            idle.state.events.length = 0;
        }
        return { timed: session.snapshot(), idle: idle.snapshot() };
    }''')
    timed = recordings['timed']
    page.locator('#record-file').set_input_files({
        'name': 'timed.json', 'mimeType': 'application/json', 'buffer': json.dumps(timed).encode(),
    })
    expect(page.locator('#replay-controls')).to_be_visible()

    def current_frame():
        return page.evaluate('watchedReplay.frame')

    assert current_frame() == 0, 'upload shows the beginning before advancing'
    page.evaluate('advancePlayback(510)')
    first_frame = current_frame()
    assert 30 <= first_frame < 40, f'movement plays at 60 Hz regardless of recorded duration: {first_frame}'
    expect(page.locator('#replay-status')).to_have_text('Replaying: 16')
    page.evaluate('advancePlayback(600)')
    assert current_frame() == first_frame + 36, 'playback crosses rooms automatically without recorded delays'
    expect(page.locator('#replay-status')).to_have_text('Replaying: 26')
    page.keyboard.press('Space')
    page.evaluate('advancePlayback(10)')
    assert current_frame() == 121, 'Space skips exactly one room transition'
    expect(page.locator('#replay-status')).to_have_text('Replaying: 25')
    page.evaluate('advancePlayback(200)')
    assert 132 <= current_frame() <= 133, 'continuous playback resumes immediately after seeking'
    before_pause = current_frame()
    page.keyboard.press('Escape')
    page.evaluate('advancePlayback(1000)')
    assert current_frame() == before_pause, 'pause does not consume replay time'
    page.keyboard.press('Escape')
    page.evaluate('advancePlayback(980)')
    assert current_frame() == timed['frames']
    expect(page.locator('#replay-status')).to_have_text('Replay finished')
    assert snapshot() == timed, 'timed playback preserves and verifies the original journal'

    page.locator('#record-file').set_input_files({
        'name': 'idle.json', 'mimeType': 'application/json', 'buffer': json.dumps(recordings['idle']).encode(),
    })
    page.wait_for_function('document.activeElement.id === "screen"', polling=100)
    assert current_frame() == 0
    page.evaluate('advancePlayback(1500)')
    after_idle = current_frame()
    assert 1860 < after_idle < 1920, f'the next input plays without waiting through 30 idle seconds: {after_idle}'
    expect(page.locator('#replay-status')).to_contain_text('Replaying:')
    page.evaluate('advancePlayback(1000)')
    expect(page.locator('#replay-status')).to_have_text('Replay finished')
    assert snapshot() == recordings['idle'], 'skipping idle time preserves deterministic playback'
    assert not errors, errors
    browser.close()
print('browser_replay_test: upload, continuous playback, idle skipping, room seeking, EOF, verification, pause timing and live quest preservation passed')
