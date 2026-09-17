"""A downloaded recording can be uploaded and replayed through the browser controls."""
from pathlib import Path
from tempfile import TemporaryDirectory
from browser_helpers import browser_page, until

with browser_page('/?player=0&debug') as page, TemporaryDirectory() as directory:
    until(page, "s => localStorage.getItem('btr.autosave.v3') !== null")
    with page.expect_download() as download:
        page.get_by_role('button', name='Download recording', exact=True).click()
    recording = Path(directory) / 'quest.json'
    download.value.save_as(recording)
    page.reload()
    page.get_by_role('button', name='Load recording', exact=True).wait_for()
    page.locator('#record-file').set_input_files(recording)
    page.locator('#log').filter(has_text='Replaying quest.json').wait_for()
    until(page, 's => s.playback')
print('browser_recording_test: download and upload replay passed')
