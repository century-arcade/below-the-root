"""Boundary autosaves, obsolete-key disposal, invalid imports and quota reporting."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_helpers import install_probe, observe
BASE=os.environ.get('BTR_URL','http://localhost:8000')
KEY='btr.autosave.v3'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page()
    install_probe(page)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/.netlify/functions/github?*',lambda route:route.fulfill(json={'configured':False}))
    page.add_init_script('''
      localStorage.setItem('btr.autosave.v1','obsolete');
      localStorage.setItem('btr.autosave.v1.recovery.8','obsolete');
      localStorage.setItem('unrelated-preference','keep');
    ''')
    page.goto(BASE+'/?player=0&debug')
    page.wait_for_function('window.questSession && questSession().simticks>20')
    assert page.evaluate("localStorage.getItem('btr.autosave.v1')") is None
    assert page.evaluate("localStorage.getItem('btr.autosave.v1.recovery.8')") is None
    assert page.evaluate("localStorage.getItem('unrelated-preference')")=='keep'
    start=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
    page.keyboard.press('ArrowLeft')
    page.wait_for_timeout(300)
    page.evaluate("dispatchEvent(new Event('pagehide'))")
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==start
    page.reload()
    page.wait_for_function('window.questSession && questSession().simticks>10')
    assert observe(page)['checkpoint']['player']['col']==json.loads(start)['checkpoint']['player']['col']
    page.evaluate('questSession().command("RENEW")')
    page.wait_for_function('(key)=>JSON.parse(localStorage.getItem(key)).endpoint.kind==="room"',arg=KEY)
    saved=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
    page.locator('#record-file').set_input_files({'name':'old.json','mimeType':'application/json','buffer':b'{"format":"below-the-root-record","version":2}'})
    expect(page.locator('#log')).to_contain_text('Unsupported playthrough recording version')
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==saved
    page.evaluate('''() => {
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value) {
        if(key==='btr.autosave.v3') throw Error('Test quota');
        return set.call(this,key,value);
      };
      questSession().command('RENEW');
    }''')
    expect(page.locator('#log')).to_contain_text('Autosave failed: Test quota')
    assert page.evaluate('(key)=>localStorage.getItem(key)',KEY)==saved
    assert not errors,errors
    browser.close()
print('browser_autosave_test: boundaries, reload, obsolete keys, unsupported uploads and quota failures passed')
