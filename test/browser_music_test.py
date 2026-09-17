"""The staff follows tune playback and muted effects show a waveform in either motion mode."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/?menu')
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    for motion in ['no-preference', 'reduce']:
        page.emulate_media(reduced_motion=motion)
        page.evaluate('''async () => {
            const { createMusicTrail } = await import('/music-trail.js');
            const { Speaker } = await import('/audio.js');
            const music = await (await fetch('/data/music.json')).json();
            window.speaker = new Speaker(music);
            speaker.unlock({tick: 0});
            await speaker.ctx.resume();
            window.updateNotes = createMusicTrail(document.getElementById('music-notes'),
                document.getElementById('monitor-waveform'));
            updateNotes(speaker);
        }''')
        staff = page.locator('#music-notes [data-register]')
        expect(staff).to_be_hidden()
        page.evaluate('speaker.playTune(0, 0); updateNotes(speaker)')
        expect(staff).to_be_visible()
        page.evaluate('speaker.silence(); updateNotes(speaker)')
        expect(staff).to_be_hidden()
        page.evaluate('speaker.mute(true); speaker.sfx(11); updateNotes(speaker)')
        expect(page.locator('#monitor-waveform .sound-waveform')).to_be_visible()
        expect(staff).to_be_hidden()
        page.evaluate('speaker.silence(); speaker.ctx.close()')
    assert not errors, errors
    browser.close()
print('browser_music_test: staff playback/idle and muted effect waveform passed')
