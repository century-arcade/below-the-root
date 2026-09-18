"""Boundary autosaves, obsolete-key disposal, invalid imports and quota reporting."""
import json
from pathlib import Path
from playwright.sync_api import expect
from browser_helpers import browser_page, observe, until, session_eval
KEY='btr.autosave.v3'
def setup(page):
    page.route('**/.netlify/functions/github?*',lambda route:route.fulfill(json={'configured':False}))
    page.add_init_script('''
      localStorage.setItem('btr.autosave.v1','obsolete');
      localStorage.setItem('btr.autosave.v1.recovery.8','obsolete');
      localStorage.setItem('unrelated-preference','keep');
    ''')

with browser_page('/?player=0&debug', setup=setup) as page:
    until(page, 's => s.simticks>20')
    assert page.evaluate("localStorage.getItem('btr.autosave.v1')") is None
    assert page.evaluate("localStorage.getItem('btr.autosave.v1.recovery.8')") is None
    assert page.evaluate("localStorage.getItem('unrelated-preference')")=='keep'
    start=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
    page.keyboard.press('ArrowLeft')
    until(page, 's => s.record.events.some(e => e.stick?.[0] === -1)')
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==start
    page.reload()
    until(page, 's => s.simticks>10')
    assert observe(page)['checkpoint']['player']['col']==json.loads(start)['checkpoint']['player']['col']
    session_eval(page, 's => s.command("RENEW")')
    until(page, '(s, key) => JSON.parse(localStorage.getItem(key)).endpoint.kind==="room"', KEY)
    saved=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
    page.locator('#record-file').set_input_files({'name':'old.json','mimeType':'application/json','buffer':b'{"format":"below-the-root-record","version":2}'})
    page.wait_for_function('consoleMessages.some(s => s.includes("Unsupported playthrough recording version"))')
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==saved
    page.evaluate('''async () => {
      const { questSession } = await import('/main.js');
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value) {
        if(key==='btr.autosave.v3') throw Error('Test quota');
        return set.call(this,key,value);
      };
      questSession().command('RENEW');
    }''')
    until(page, 's => consoleMessages.some(message => message.includes("Autosave failed: Test quota"))')
    expect(page.locator('#log')).to_have_count(0)
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==saved
print('browser_autosave_test: boundaries, reload, obsolete keys, unsupported uploads and quota failures passed')
