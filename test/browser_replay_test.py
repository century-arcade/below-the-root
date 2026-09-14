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
    page.evaluate('''async () => {
        const { Session } = await import('/record.js');
        const watch = Session.watch;
        Session.watch = (...args) => window.watchedReplay = watch(...args);
    }''')

    def snapshot():
        with page.expect_download() as result:
            page.locator('#download-record').evaluate('(button) => button.click()')
        return json.loads(Path(result.value.path()).read_text())

    page.keyboard.press('Escape')
    paused = snapshot()
    assert paused['version'] == 2 and 'reads' in paused and 'durations' not in paused
    page.wait_for_timeout(250)
    assert snapshot()['checkpoint']['stats']['milliseconds'] == paused['checkpoint']['stats']['milliseconds']
    page.keyboard.press('Escape')
    page.wait_for_timeout(250)
    assert snapshot()['checkpoint']['stats']['milliseconds'] > paused['checkpoint']['stats']['milliseconds']

    page.locator('#record-file').set_input_files(FIXTURE)
    page.wait_for_function('window.watchedReplay?.playback')
    saved = page.evaluate('(key) => localStorage.getItem(key)', KEY)
    # Each press seeks one transition, leaving recorded input in control.
    for _ in range(2):
        before = page.evaluate('watchedReplay.state.room?.code')
        page.keyboard.press('ArrowRight')
        page.wait_for_function('(before) => watchedReplay.state.room?.code !== before', arg=before)
    assert snapshot() == json.loads(FIXTURE.read_text()), 'download preserves the full uploaded journal'
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == saved

    page.locator('#home').click()
    page.keyboard.press('Escape')
    returned = snapshot()
    assert returned['seed'] == paused['seed']
    assert returned['checkpoint']['player']['name'] == 'NERIC'

    # A short valid recording has no further room change: Right stops at EOF.
    page.locator('#record-file').set_input_files({
        'name': 'short.json', 'mimeType': 'application/json', 'buffer': json.dumps(returned).encode(),
    })
    page.wait_for_function('document.activeElement.id === "screen"', polling=100)
    page.locator('#screen').focus()
    page.keyboard.press('ArrowRight')
    page.wait_for_function('watchedReplay.playbackDone')
    page.keyboard.press('ArrowRight')
    page.wait_for_function('watchedReplay.playbackDone')
    page.locator('#home').click()

    broken = {**returned, 'checkpoint': {**returned['checkpoint'], 'quest': False}}
    page.locator('#record-file').set_input_files({
        'name': 'broken.json', 'mimeType': 'application/json', 'buffer': json.dumps(broken).encode(),
    })
    page.wait_for_function('watchedReplay.sourceRecord.checkpoint.quest === false')
    page.keyboard.press('ArrowRight')
    page.wait_for_function('watchedReplay.playbackError')
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
        const { TICKS_PER_HOUR } = await import('/clock.js');
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
        const days = room('16');
        const late = room('16');
        for (const day of [1, 2]) {
            Object.assign(late.state.clock, { day, hour: 7, ticks: TICKS_PER_HOUR - 3 });
            days.load(exportSave(late.state));
            while (days.state.clock.day === day) days.step();
        }
        const jumps = room('16');
        for (let i = 0; i < 1500; i++) {
            if (i && i % 60 === 0) jumps.load(exportSave(room(i % 120 ? '26' : '16').state));
            jumps.step();
            jumps.state.events.length = 0;
        }
        return { timed: session.snapshot(), idle: idle.snapshot(), days: days.snapshot(), jumps: jumps.snapshot() };
    }''')
    timed = recordings['timed']
    page.locator('#record-file').set_input_files({
        'name': 'timed.json', 'mimeType': 'application/json', 'buffer': json.dumps(timed).encode(),
    })
    page.wait_for_function('document.activeElement.id === "screen"', polling=100)

    def current_frame():
        return page.evaluate('watchedReplay.frame')

    assert current_frame() == 0, 'upload shows the beginning before advancing'
    assert page.evaluate('[watchedReplay.roomChanges, watchedReplay.totalRoomChanges]') == [0, 2]
    page.evaluate('advancePlayback(510)')
    first_frame = current_frame()
    assert 30 <= first_frame < 40, f'movement plays at 60 Hz regardless of recorded duration: {first_frame}'
    assert page.evaluate('watchedReplay.state.room.code') == '16'
    page.evaluate('advancePlayback(600)')
    assert current_frame() == first_frame + 36, 'playback crosses rooms automatically without recorded delays'
    assert page.evaluate('watchedReplay.state.room.code') == '26'
    page.keyboard.press('Space')
    page.evaluate('advancePlayback(10)')
    assert current_frame() < 120, 'Space no longer seeks rooms'
    page.keyboard.press('ArrowRight')
    page.evaluate('advancePlayback(10)')
    assert current_frame() == 121, 'Right skips exactly one room transition'
    assert page.evaluate('watchedReplay.state.room.code') == '25'
    page.evaluate('advancePlayback(200)')
    assert 132 <= current_frame() <= 133, 'continuous playback resumes immediately after seeking'
    before_pause = current_frame()
    page.keyboard.press('Escape')
    page.evaluate('advancePlayback(1000)')
    assert current_frame() == before_pause, 'pause does not consume replay time'
    page.keyboard.press('Escape')
    page.evaluate('advancePlayback(980)')
    assert current_frame() == timed['frames']
    page.wait_for_function('watchedReplay.playbackDone')
    assert snapshot() == timed, 'timed playback preserves and verifies the original journal'

    assert page.evaluate('[watchedReplay.roomChanges, watchedReplay.totalRoomChanges]') == [2, 2]
    page.keyboard.press('ArrowRight')
    page.evaluate('advancePlayback(10)')
    assert page.evaluate('watchedReplay.playbackDone'), 'Right at EOF stays at EOF'
    page.keyboard.press('ArrowLeft')
    assert page.evaluate('watchedReplay.state.room.code') == '26', 'Left restores its destination before any animation frame'
    assert current_frame() == 61, 'rewind never exposes the recording start or intermediate rooms'
    page.evaluate('advancePlayback(10)')
    assert page.evaluate('watchedReplay.state.room.code') == '26', 'Left rewinds from EOF'
    assert page.evaluate('watchedReplay.roomChanges') == 1
    page.keyboard.press('ArrowLeft')
    page.evaluate('advancePlayback(10)')
    assert current_frame() == 0, 'Left reaches the initial room'
    page.keyboard.press('ArrowLeft')
    page.evaluate('advancePlayback(10)')
    assert current_frame() == 0, 'Left at the beginning cannot rewind past it'
    page.keyboard.down('ArrowRight')
    page.evaluate('advancePlayback(350)')
    page.keyboard.up('ArrowRight')
    assert page.evaluate('watchedReplay.roomChanges') == 2, 'holding Right keeps seeking without OS key repeat'
    page.keyboard.down('ArrowLeft')
    page.evaluate('advancePlayback(350)')
    page.keyboard.up('ArrowLeft')
    assert page.evaluate('watchedReplay.roomChanges') == 0, 'holding Left keeps seeking backward'
    page.evaluate('advancePlayback(200)')
    assert current_frame() > 0, 'releasing the arrow resumes continuous playback'
    assert page.evaluate('watchedReplay.roomChanges') == 0, 'release stops repeated room skips'
    page.evaluate('advancePlayback(4000)')
    assert page.evaluate('watchedReplay.playbackDone')
    assert not page.evaluate('watchedReplay.playbackError'), 'rewound playback still verifies at EOF'
    assert snapshot() == timed, 'rewinding preserves the uploaded journal'

    page.locator('#record-file').set_input_files({
        'name': 'idle.json', 'mimeType': 'application/json', 'buffer': json.dumps(recordings['idle']).encode(),
    })
    page.wait_for_function('document.activeElement.id === "screen"', polling=100)
    assert current_frame() == 0
    page.evaluate('advancePlayback(1500)')
    after_idle = current_frame()
    assert 1860 < after_idle < 1920, f'the next input plays without waiting through 30 idle seconds: {after_idle}'
    assert not page.evaluate('watchedReplay.playbackDone')
    page.evaluate('advancePlayback(1000)')
    page.wait_for_function('watchedReplay.playbackDone')
    assert snapshot() == recordings['idle'], 'skipping idle time preserves deterministic playback'
    assert not errors, errors

    page.locator('#record-file').set_input_files({
        'name': 'jumps.json', 'mimeType': 'application/json', 'buffer': json.dumps(recordings['jumps']).encode(),
    })
    page.wait_for_function('document.activeElement.id === "screen"', polling=100)
    for target in [10, 20]:
        page.keyboard.press('Shift+ArrowRight')
        page.evaluate('advancePlayback(10)')
        assert page.evaluate('watchedReplay.roomChanges') == target, 'Shift+Right skips ten transitions, including revisits'
    page.keyboard.press('Shift+ArrowLeft')
    assert page.evaluate('watchedReplay.roomChanges') == 10, 'Shift+Left restores ten rooms back immediately'
    page.keyboard.press('Shift+ArrowRight')
    page.evaluate('advancePlayback(10)')
    page.keyboard.down('Shift')
    page.keyboard.down('ArrowLeft')
    page.evaluate('advancePlayback(260)')
    assert page.evaluate('watchedReplay.roomChanges') == 0, 'holding Shift+Left repeats ten-room jumps'
    page.keyboard.up('ArrowLeft')
    page.keyboard.down('ArrowRight')
    page.evaluate('advancePlayback(260)')
    assert page.evaluate('watchedReplay.roomChanges') == 20, 'holding Shift+Right repeats ten-room jumps'
    page.keyboard.up('Shift')
    page.evaluate('advancePlayback(110)')
    assert page.evaluate('watchedReplay.roomChanges') == 21, 'releasing Shift returns held navigation to one room'
    page.keyboard.up('ArrowRight')
    page.keyboard.press('Shift+ArrowRight')
    page.evaluate('advancePlayback(10)')
    assert page.evaluate('watchedReplay.playbackDone'), 'ten-room jumps stop at EOF when fewer rooms remain'
    for target in [14, 4, 0]:
        page.keyboard.press('Shift+ArrowLeft')
        assert page.evaluate('watchedReplay.roomChanges') == target, 'ten-room rewind clamps at the beginning'
    for _ in range(3):
        page.keyboard.press('Shift+ArrowRight')
        page.evaluate('advancePlayback(10)')
    assert page.evaluate('watchedReplay.playbackDone')
    assert not page.evaluate('watchedReplay.playbackError'), 'ten-room seeking still verifies at EOF'
    assert snapshot() == recordings['jumps']

    page.close()
    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.add_init_script(f'localStorage.setItem({json.dumps(KEY)}, {json.dumps(json.dumps(recordings["days"]))});')
    page.goto(URL + '/play.html?debug')
    page.wait_for_function('document.getElementById("record-file").onchange !== null', polling=100)
    assert not errors, errors
    expect(page.locator('#back-day')).to_be_visible()
    expect(page.locator('#back-day')).to_be_enabled()
    page.locator('#screen').focus()
    page.keyboard.press('Backspace')
    assert snapshot()['checkpoint']['clock']['day'] == 2, 'Backspace restores the previous day'
    page.locator('#back-day').click()
    assert snapshot()['checkpoint']['clock']['day'] == 1, 'the developer icon rewinds another day'
    expect(page.locator('#back-day')).to_be_disabled()
    page.reload()
    page.wait_for_function('document.getElementById("record-file").onchange !== null', polling=100)
    expect(page.locator('#back-day')).to_be_enabled()
    page.locator('#screen').focus()
    page.keyboard.press('Delete')
    assert snapshot()['checkpoint']['clock']['day'] == 2, 'Delete also rewinds a day'
    page.locator('#volume').focus()
    page.keyboard.press('Backspace')
    assert snapshot()['checkpoint']['clock']['day'] == 2, 'editing controls do not rewind the game'
    page.locator('#developer-mode').click()
    expect(page.locator('#back-day')).to_be_hidden()
    page.locator('#screen').focus()
    page.keyboard.press('Delete')
    page.locator('#developer-mode').click()
    assert snapshot()['checkpoint']['clock']['day'] == 2, 'day rewind is restricted to developer mode'
    assert not errors, errors
    browser.close()
print('browser_replay_test: playback, immediate rewind, day controls, verification, pause timing and live quest preservation passed')
