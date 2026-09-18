"""Play the extracted release with external requests blocked; requires Playwright.

Usage: python test/browser_release_test.py [dist/below-the-root-preservation.zip]
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
from zipfile import ZipFile

from playwright.sync_api import expect
from browser_helpers import browser_page, observe, held, until

archive_path = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/below-the-root-preservation.zip')
with tempfile.TemporaryDirectory(prefix='btr-offline-test-') as temporary:
    with ZipFile(archive_path) as archive:
        archive.extractall(temporary)
    root = Path(temporary) / 'below-the-root'
    for line in (root / 'SHA256SUMS').read_text().splitlines():
        digest, name = line.split('  ', 1)
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
    server = subprocess.Popen(
        [sys.executable, str(root / 'serve.py'), '--port', '0', '--no-browser'],
        cwd=temporary, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        address = server.stdout.readline().strip().removeprefix('Below the Root: ').rstrip('/')
        assert address.startswith('http://127.0.0.1:'), address
        external, failed = [], []

        def setup(page):
            def local_only(route):
                if urlsplit(route.request.url).netloc == urlsplit(address).netloc:
                    route.continue_()
                else:
                    external.append(route.request.url)
                    route.abort()

            page.route('**/*', local_only)
            page.on('response', lambda response: failed.append(response.url) if response.status >= 400 else None)

        with browser_page('/', base=address, setup=setup, accept_downloads=True) as page:
            held(page, 'startup-help')
            assert observe(page)['frame'] == 0
            expect(page).to_have_url(address + '/')
            expect(page.locator('#screen')).to_be_visible()
            page.evaluate('document.fonts.ready')
            page.locator('nav a[href="/links"]').click()
            expect(page).to_have_url(address + '/links')
            page.goto(address + '/?player=0&debug')
            until(page, "s => localStorage.getItem('btr.autosave.v3') !== null")
            assert observe(page)['quest']
            expect(page.locator('#file-issue')).to_have_count(0)
            page.keyboard.press('r')
            expect(page.locator('#issue-dialog')).to_be_hidden()
            page.keyboard.press('ArrowRight')
            page.locator('#map').click()
            expect(page.locator('#map-screen')).to_be_visible()
            held(page, 'map')
            page.keyboard.press('Escape')
            expect(page.locator('#map-screen')).to_be_hidden()
            page.locator('#help').click()
            expect(page.locator('#help-screen')).to_be_visible()
            page.keyboard.press('Escape')
            expect(page.locator('#help-screen')).to_be_hidden()
            page.keyboard.press('p')
            with page.expect_download() as download:
                page.locator('#download-record').click()
            recording = Path(download.value.path()).read_text()
            checkpoint = json.loads(recording)['checkpoint']
            assert checkpoint['player'], checkpoint
            page.locator('#record-file').set_input_files({
                'name': 'playthrough.json', 'mimeType': 'application/json', 'buffer': recording.encode()})
            expect(page.locator('#log')).to_contain_text('Replaying')
            until(page, 's => s.playback')
            assert observe(page)['quest']
            page.locator('nav a[href="/about"]').click()
            before = page.evaluate("localStorage.getItem('btr.autosave.v3')")
            page.goto(address)
            expect(page).to_have_url(address + '/')
            page.wait_for_selector('#volume[aria-valuetext]', state='attached')
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            after = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v3'))")
            assert after['initial'] == json.loads(before)['initial'], 'saved quest restored'
            assert not external, external
            assert not failed, failed
    finally:
        server.terminate()
        server.wait(timeout=10)
        server.stdout.close()
print('browser_release_test: checksums, offline pages, gameplay, map, help, recording and resume passed')
