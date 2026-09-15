"""Verified watch, room seeking, boundary downloads and live quest isolation."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_helpers import install_probe, observe
BASE = os.environ.get('BTR_URL', 'http://localhost:8000')
KEY = 'btr.autosave.v3'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    install_probe(page)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/.netlify/functions/github?*', lambda route: route.fulfill(json={'configured': False}))
    page.goto(BASE + '/?player=0&debug')
    page.wait_for_function('window.questSession && questSession().simticks > 10')
    records = page.evaluate('''async () => {
      const {Session} = await import('/record.js');
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
    page.wait_for_timeout(200)
    assert observe(page)['simticks'] == stopped
    page.locator('#record-file').set_input_files({'name':'visits.json','mimeType':'application/json','buffer':json.dumps(records).encode()})
    page.wait_for_function('questSession().playbackDone')
    assert not page.evaluate('questSession().playbackError')
    assert page.evaluate('questSession().roomChanges') == 24
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
    assert page.evaluate('questSession().roomChanges') == 14
    page.keyboard.press('p')
    page.keyboard.press('Shift+ArrowRight')
    page.wait_for_function('questSession().playbackDone')
    assert not page.evaluate('questSession().playbackError')
    assert download() == records
    page.locator('#home').click()
    assert not page.evaluate('questSession().playback')
    assert observe(page)['checkpoint']['character'] == 0
    assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == before
    # Day rewind branches the runtime history; its next save remains replayable.
    page.evaluate('''() => {
      const s=questSession(); s.command('RENEW'); s.command('RENEW');
    }''')
    page.locator('#back-day').click()
    assert observe(page)['checkpoint']['clock']['day'] == 2
    page.locator('#back-day').click()
    assert observe(page)['checkpoint']['clock']['day'] == 1
    assert not errors, errors
    browser.close()
print('browser_replay_test: verification, room/day rewind, downloads and live autosave isolation passed')
