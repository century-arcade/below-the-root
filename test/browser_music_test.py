"""Music symbols scroll by onset time, including muted playback and tune cancellation."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BTR_URL', 'http://localhost:8000')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/play?demo=quest')
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    trail = page.locator('#music-notes')
    treble_staff = trail.locator('[data-register="treble"]')
    bass_staff = trail.locator('[data-register="bass"]')
    expect(trail).to_have_attribute('aria-hidden', 'true')
    expect(trail.locator('[data-rhythm]')).to_have_count(0)
    # Notes retain pitch and their onset offsets become animation delays.
    for motion in ['no-preference', 'reduce']:
        page.emulate_media(reduced_motion=motion)
        page.evaluate('''async () => {
            const { createMusicTrail } = await import('/music-trail.js');
            const { noteRhythm } = await import('/music-notation.js');
            const element = document.getElementById('music-notes');
            window.noteBatch = [
                {voice: 0, midi: 59, rhythm: noteRhythm(0, 36), at: 2},
                {voice: 1, midi: 60, rhythm: noteRhythm(0, 72), at: 2.3},
                {voice: 0, midi: 61, rhythm: noteRhythm(0, 18), at: 2.9},
                {voice: 1, midi: 48, rhythm: noteRhythm(0, 144), at: 3.8},
            ];
            window.noteSpeaker = {playing: {}, tuneEnd: 20, ctx: {currentTime: 2},
                recentNotes: () => noteBatch, effectWaveform: () => null};
            window.updateNotes = createMusicTrail(element);
            updateNotes(noteSpeaker);
            window.firstGlyph = element.querySelector('[data-rhythm="quarter"]');
        }''')
        glyphs = trail.locator('[data-rhythm]')
        treble = trail.locator('[data-register="treble"] [data-rhythm]')
        bass = trail.locator('[data-register="bass"] [data-rhythm]')
        expect(glyphs).to_have_count(4)
        expect(glyphs.locator('svg')).to_have_count(4)
        assert treble.evaluate_all('(nodes) => nodes.map(n => n.dataset.rhythm)') == ['half', 'eighth']
        assert bass.evaluate_all('(nodes) => nodes.map(n => n.dataset.rhythm)') == ['quarter', 'whole']
        assert glyphs.evaluate_all('(nodes) => nodes.map(n => n.style.animationDelay)') == ['0.3s', '0.9s', '0s', '1.8s']
        page.evaluate('updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(4)
        assert page.evaluate("document.querySelector('#music-notes [data-rhythm=quarter]') === firstGlyph")
        page.evaluate('noteBatch = noteBatch.slice(1); updateNotes(noteSpeaker)')
        expect(bass).to_have_count(1)
        expect(treble).to_have_count(2)
        page.evaluate('noteBatch = []; updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(0)
        expect(treble_staff).to_be_visible()
        expect(bass_staff).to_be_visible()
        page.evaluate('noteSpeaker.playing = null; updateNotes(noteSpeaker)')
        expect(treble_staff).to_be_hidden()
        expect(bass_staff).to_be_hidden()

        # Use actual WebAudio samples to check both tonal and noise effects while muted.
        page.evaluate('''async () => {
            const { Speaker } = await import('/audio.js');
            const music = await (await fetch('/data/music.json')).json();
            window.effectSpeaker = new Speaker(music);
            effectSpeaker.unlock({tick: 0});
            await effectSpeaker.ctx.resume();
            effectSpeaker.mute(true);
        }''')
        waveform = trail.locator('.sound-waveform')
        for sound in [1, 11]:
            page.evaluate('(id) => effectSpeaker.sfx(id)', sound)
            page.wait_for_function('effectSpeaker.effectWaveform()?.some(sample => Math.abs(sample) > 0.001)')
            page.evaluate('updateNotes(effectSpeaker)')
            expect(waveform).to_be_visible()
            expect(treble_staff).to_be_hidden()
            expect(bass_staff).to_be_hidden()
            page.wait_for_function('effectSpeaker.effectWaveform() === null')
            page.evaluate('updateNotes(effectSpeaker)')
            expect(waveform).to_be_visible()
            page.evaluate("window.idleTrace = document.querySelector('.sound-waveform').toDataURL()")
            page.evaluate('updateNotes(effectSpeaker)')
            assert page.evaluate("document.querySelector('.sound-waveform').toDataURL() === idleTrace"), 'silence keeps the trace still'
        # A known signal makes the transition independent of short real-time effects.
        page.evaluate("""() => {
            window.traceSpeaker = {muted: true, effect: {}, ctx: {currentTime: 0},
                effectWaveform: () => new Float32Array([0, 0.5, -0.5, 0]), recentNotes: () => []};
            updateNotes(traceSpeaker);
            window.activeTrace = document.querySelector('.sound-waveform').toDataURL();
            traceSpeaker.effectWaveform = () => null;
            updateNotes(traceSpeaker);
        }""")
        assert page.evaluate("document.querySelector('.sound-waveform').toDataURL() === idleTrace"), 'silence restores the same flatline'
        assert page.evaluate('activeTrace !== idleTrace'), 'effects depart from the flatline'
        page.evaluate('effectSpeaker.mute(false); effectSpeaker.sfx(11); updateNotes(effectSpeaker)')
        expect(waveform).to_be_hidden()
        page.evaluate('effectSpeaker.setVolume(0); updateNotes(effectSpeaker)')
        expect(waveform).to_be_visible()
        page.evaluate('effectSpeaker.mute(true)')
        page.evaluate('effectSpeaker.sfx(11); updateNotes(effectSpeaker)')
        expect(waveform).to_be_visible()
        page.evaluate('effectSpeaker.playTune(0, 0); updateNotes(effectSpeaker)')
        expect(waveform).to_be_hidden()
        expect(treble_staff).to_be_visible()
        expect(bass_staff).to_be_visible()
        expect(glyphs).to_have_count(1)
        page.evaluate('effectSpeaker.silence(); updateNotes(effectSpeaker); effectSpeaker.ctx.close()')
        expect(glyphs).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('browser_music_test: scrolling pitch staves, timing gaps, waveforms, mute and expiry passed')
