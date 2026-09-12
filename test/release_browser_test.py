"""Play the extracted release with external requests blocked; requires Playwright.

Usage: python test/release_browser_test.py [dist/below-the-root-preservation.zip]
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
from zipfile import ZipFile

from playwright.sync_api import expect, sync_playwright

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
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(accept_downloads=True)
            external, failed, errors = [], [], []

            def local_only(route):
                if urlsplit(route.request.url).netloc == urlsplit(address).netloc:
                    route.continue_()
                else:
                    external.append(route.request.url)
                    route.abort()

            page.route('**/*', local_only)
            page.on('response', lambda response: failed.append(response.url) if response.status >= 400 else None)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(address)
            expect(page).to_have_url(address + '/about')
            expect(page.get_by_role('heading', name='Below the Root', exact=True)).to_be_visible()
            page.evaluate('document.fonts.ready')
            page.locator('nav a[href="/links"]').click()
            expect(page).to_have_url(address + '/links')
            page.goto(address + '/?player=0&debug')
            page.wait_for_function("localStorage.getItem('btr.autosave.v1') !== null")
            expect(page.locator('#file-issue')).to_be_disabled()
            page.keyboard.press('ArrowRight')
            page.locator('#map').click()
            expect(page.locator('#map-screen')).to_be_visible()
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
            expect(page.locator('#log')).to_contain_text('Loaded')
            page.locator('nav a[href="/about"]').click()
            before = page.evaluate("localStorage.getItem('btr.autosave.v1')")
            page.goto(address)
            expect(page).to_have_url(address + '/play')
            page.wait_for_selector('#mute[aria-pressed]', state='attached')
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            after = page.evaluate("JSON.parse(localStorage.getItem('btr.autosave.v1'))")
            assert after['initial'] == json.loads(before)['initial'], 'saved quest restored'
            assert not external, external
            assert not failed, failed
            assert not errors, errors
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
        server.stdout.close()
print('release_browser_test: checksums, offline pages, gameplay, map, help, recording and resume passed')
