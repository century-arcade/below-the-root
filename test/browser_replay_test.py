"""Verified watch, room seeking, boundary downloads and live quest isolation."""
import json
from pathlib import Path
from playwright.sync_api import expect
from browser_helpers import browser_page, observe, held, until, session_eval
KEY = 'btr.autosave.v3'
def setup(page):
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))

with browser_page('/?player=0&debug', setup=setup) as page:
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
    until(page, 's => s.playbackDone')
    assert not session_eval(page, 's => s.playbackError')
    assert session_eval(page, 's => s.roomChanges') == 24
    expect(page.locator('#play-from-replay')).to_be_visible()
    expect(page.locator('#play-from-replay')).to_be_enabled()
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == before
    assert download() == records
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
    expect(page.locator('#log > div').last).to_contain_text('Playing from here. Progress will be saved.')
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
print('browser_replay_test: verification, room rewind, downloads and live autosave isolation passed')
