"""Verified watch, room seeking, boundary downloads and live quest isolation."""
import json
from pathlib import Path
from playwright.sync_api import expect
from browser_helpers import browser_page, observe, held, until, session_eval
KEY = 'btr.autosave.v3'
def setup(page):
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))

with browser_page('/?player=0&debug', setup=setup, has_touch=True) as page:
    until(page, 's => s.simticks > 10')
    records = page.evaluate('''async () => {
      const {Session} = await import('/record.js');
      const { questSession } = await import('/main.js');
      const data = questSession().state.data;
      const idle = {read: () => ({dx:0,dy:0,fire:false})};
      const s = new Session(data, idle, {initial:{mode:'quest',character:2},seed:29});
      for (let visit=0;visit<24;visit++) {
        for (let i=0;i<120;i++) s.step();
        s.command('RENEW');
      }
      return s.snapshot();
    }''')
    before = page.evaluate('(key) => localStorage.getItem(key)', KEY)
    def download():
        with page.expect_download() as result:
            page.locator('#download-record').click()
        return json.loads(Path(result.value.path()).read_text())
    assert download() == json.loads(before), 'mid-room download is the last save boundary'
    page.keyboard.press('p')
    stopped = observe(page)['simticks']
    held(page, 'pause')
    assert observe(page)['simticks'] == stopped
    page.locator('#record-file').set_input_files({'name':'visits.json','mimeType':'application/json','buffer':json.dumps(records).encode()})
    expect(page.locator('#replay-progress')).to_have_text('1/25')
    until(page, 's => s.playbackDone', milliseconds=30000)
    assert not session_eval(page, 's => s.playbackError')
    assert session_eval(page, 's => s.roomChanges') == 24
    expect(page.locator('#play-from-replay')).to_be_visible()
    expect(page.locator('#play-from-replay')).to_be_enabled()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == before
    assert download() == records
    expect(page.locator('#replay-progress')).to_have_text('25/25')
    expect(page.get_by_role('button', name='Forward one room', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Forward ten rooms', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Back ten rooms', exact=True).tap()
    assert session_eval(page, 's => s.roomChanges') == 14
    expect(page.locator('#replay-progress')).to_have_text('15/25')
    page.get_by_role('button', name='Forward one room', exact=True).click()
    until(page, 's => s.roomChanges === 15')
    page.get_by_role('button', name='Back one room', exact=True).click()
    assert session_eval(page, 's => s.roomChanges') == 14
    for expected in [4, 0]:
        page.get_by_role('button', name='Back ten rooms', exact=True).click()
        assert session_eval(page, 's => s.roomChanges') == expected
    expect(page.locator('#replay-progress')).to_have_text('1/25')
    expect(page.get_by_role('button', name='Back one room', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Back ten rooms', exact=True)).to_be_disabled()
    for expected in [10, 20, 24]:
        page.get_by_role('button', name='Forward ten rooms', exact=True).click()
        until(page, 's => s.roomChanges === ' + str(expected))
    expect(page.locator('#replay-progress')).to_have_text('25/25')
    page.locator('#screen').focus()
    # Seek and pause in the same browser task; idle playback can otherwise
    # advance several rooms between Playwright round trips.
    page.evaluate("""() => {
      const canvas = document.querySelector('#screen');
      for (const type of ['keydown', 'keyup']) canvas.dispatchEvent(new KeyboardEvent(type,
        {key:'ArrowLeft',code:'ArrowLeft',shiftKey:true,bubbles:true}));
      canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'p',code:'KeyP',bubbles:true}));
    }""")
    assert session_eval(page, 's => s.roomChanges') == 14
    replay_tick = session_eval(page, 's => s.simticks')
    expect(page.locator('#play-from-replay')).to_be_visible()
    expect(page.locator('#play-from-replay')).to_be_enabled()
    page.locator('#play-from-replay').click()
    assert not session_eval(page, 's => s.playback')
    expect(page.locator('#play-from-replay')).to_be_hidden()
    expect(page.locator('#replay-controls')).to_be_hidden()
    expect(page.locator('#log')).to_have_count(0)
    assert session_eval(page, 's => s.roomChanges') == 14
    assert observe(page)['checkpoint']['character'] == 2
    assert session_eval(page, 's => s.simticks') >= replay_tick
    resumed = page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)
    assert resumed['checkpoint']['character'] == 2
    assert resumed['checkpoint']['simticks'] <= replay_tick
    assert download() == resumed
    # Room rewind branches the runtime history; its next save remains replayable.
    resumed_visit = observe(page)['checkpoint']['visit']
    page.evaluate('''async () => {
      const { questSession } = await import('/main.js');
      const s=questSession(); s.command('RENEW'); s.command('RENEW');
    }''')
    page.locator('#rewind-room').click()
    assert observe(page)['checkpoint']['visit'] == resumed_visit + 1
    page.keyboard.press('Backspace')
    assert observe(page)['checkpoint']['visit'] == resumed_visit
with browser_page('/?player=0&debug', setup=setup) as page:
    records = page.evaluate("""async () => {
      const {Session} = await import('/record.js');
      const {questSession} = await import('/main.js');
      const s = new Session(questSession().state.data, {read: () => ({dx:0,dy:0,fire:false})},
        {initial:{mode:'quest',character:0},seed:29});
      const start = s.snapshot();
      s.command('SPEAK');
      s.command('HEAL');
      for (let i=0;i<120;i++) s.step();
      s.command('RENEW');
      return {start, messages:s.snapshot()};
    }""")
    def load(record):
        page.locator('#record-file').set_input_files({
            'name':'messages.json', 'mimeType':'application/json', 'buffer':json.dumps(record).encode()})
    def message():
        return session_eval(page, 's => Array.from(s.state.panel).map(c => String.fromCharCode(c & 127)).join("")')
    load(records['messages'])
    page.clock.run_for(16)
    assert 'SPEAK WITH WHOM?' in message()
    assert session_eval(page, 's => s.simticks') == 0
    page.clock.run_for(400)
    assert 'SPEAK WITH WHOM?' in message()
    page.locator('#screen').focus()
    page.keyboard.press('p')
    held(page, 'pause')
    page.clock.run_for(2000)
    page.keyboard.press('p')
    page.clock.run_for(300)
    assert 'SPEAK WITH WHOM?' in message()
    page.clock.run_for(64)
    assert 'YOU LACK THE SPIRIT SKILL' in message()
    page.clock.run_for(400)
    assert 'YOU LACK THE SPIRIT SKILL' in message()
    assert session_eval(page, 's => s.simticks') == 0
    page.evaluate("""() => {
      Object.defineProperty(document, 'hidden', {configurable:true, value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    held(page, 'hidden')
    page.clock.run_for(2000)
    page.evaluate("""() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    page.clock.run_for(50)
    assert 'YOU LACK THE SPIRIT SKILL' in message()
    page.clock.run_for(320)
    assert 'YOU LACK THE SPIRIT SKILL' not in message()
    load(records['start'])
    expect(page.locator('#replay-progress')).to_have_text('1/1')
    expect(page.get_by_role('button', name='Back one room', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Forward one room', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Play from here', exact=True).click()
    page.clock.run_for(32)
    assert session_eval(page, 's => !s.playback && s.simticks > 0')
    expect(page.get_by_label('Message delay', exact=True)).to_have_count(0)
with browser_page('/?player=0&debug', setup=setup) as page:
    fixture = session_eval(page, """async current => {
        const {Session} = await import('/record.js');
        const {newState, startQuest} = await import('/game.js');
        const {enterRoom} = await import('/world.js');
        const {exportSave} = await import('/save.js');
        const {CLASS} = await import('/data.js');
        const {IDLE} = await import('/input.js');
        const {facingCreature} = await import('/creatures.js');
        const data = current.state.data, idle = {read: () => IDLE};
        const state = newState(data, idle);
        startQuest(state, data.characters[0]);
        enterRoom(state, data.roomByCode.get('32'), 1, 3);
        Object.assign(state.player, {spiritLimit:10, spiritEnergy:10});
        state.objects.find(o => o.exists && o.class === CLASS.SHUBA).carried = true;
        const s = new Session(data, idle, {initial:{mode:'quest', character:0}, seed:123});
        s.load(exportSave(state));
        const advanceUntil = (done, what) => {
            for (let i=0; i<2000 && !done(); i++) {
                s.step();
                s.state.events.length = 0;
            }
            if (!done()) throw Error(`Never ${what}; tick ${s.simticks}, ${JSON.stringify(s.place())}`);
        };
        advanceUntil(() => s.state.player.fallen >= 2, 'fell before steering');
        s.live = {read: () => ({...IDLE, dx:1})};
        advanceUntil(() => s.state.player.gliding && facingCreature(s.state), 'glided facing animal');
        s.live = idle;
        const eventIndex = s.record.events.length;
        s.command('PENSE');
        if (s.state.animalsPensed !== 1) throw Error('Airborne PENSE did not grant animal gift');
        advanceUntil(() => !s.airborne && !s.state.stall, 'finished song and landed');
        for (let i=0; i<30; i++) s.step();
        s.command('RENEW');
        return {record:s.snapshot(), eventIndex};
    }""")
    page.locator('#record-file').set_input_files({
        'name': 'landing.json', 'mimeType': 'application/json',
        'buffer': json.dumps(fixture['record']).encode()})
    session_eval(page, '''(s, eventIndex) => {
        for (let i=0; i<500 && s.eventIndex < eventIndex; i++) s.step({presentation:false});
        if (s.eventIndex !== eventIndex) throw Error(`Never reached airborne PENSE; tick ${s.simticks}`);
        s.state.events.length = 0;
    }''', fixture['eventIndex'])
    assert session_eval(page, 's => s.state.player.gliding')
    until(page, 's => s.state.tuneWait != null')
    assert not session_eval(page, 's => s.state.player.gliding')
    landed = session_eval(page, 's => s.simticks')
    remaining = session_eval(page, 's => s.state.stall')
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    held(page, 'focus')
    page.clock.run_for(int(remaining * 1000 / 60) + 1000)
    assert session_eval(page, 's => s.simticks') == landed
    assert session_eval(page, 's => s.state.tuneWait') is None
    page.locator('#screen').dispatch_event('pointerenter', {'pointerType': 'mouse'})
    until(page, 's => s.simticks > ' + str(landed))
    assert not session_eval(page, 's => s.playbackError')
print('browser_replay_test: room controls, pacing, landing, song resume and live continuation passed')
