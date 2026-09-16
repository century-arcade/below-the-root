"""Upcoming music symbols disappear at onset time, including muted playback and tune cancellation."""
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
    expect(trail.locator('[data-register="bass"]')).to_have_count(0)
    expect(trail).to_have_attribute('aria-hidden', 'true')
    expect(trail.locator('[data-rhythm]')).to_have_count(0)
    # The whole upcoming score retains its pitch and rhythm.
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
                upcomingNotes: () => noteBatch, recentMeasures: () => [], effectWaveform: () => null};
            window.updateNotes = createMusicTrail(element, document.getElementById('monitor-waveform'));
            updateNotes(noteSpeaker);
            window.firstGlyph = element.querySelector('[data-rhythm="quarter"]');
        }''')
        glyphs = trail.locator('[data-rhythm]')
        treble = trail.locator('[data-register="treble"] [data-rhythm]')
        expect(glyphs).to_have_count(4)
        expect(glyphs.locator('svg')).to_have_count(4)
        assert treble.evaluate_all('(nodes) => nodes.map(n => n.dataset.rhythm)') == ['quarter', 'half', 'eighth', 'whole']
        expect(treble_staff.locator('[data-midi="48"]')).to_have_attribute('data-ledger-lines', '4')
        page.evaluate('updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(4)
        assert page.evaluate("document.querySelector('#music-notes [data-rhythm=quarter]') === firstGlyph")
        page.evaluate('noteBatch = noteBatch.slice(1); updateNotes(noteSpeaker)')
        expect(treble).to_have_count(3)
        page.evaluate('noteBatch = []; updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(0)
        expect(treble_staff).to_be_visible()
        page.evaluate('''async () => {
            const { noteRhythm } = await import('/music-notation.js');
            noteBatch = [{midi: 71, rhythm: noteRhythm(7, 120), at: 1}];
            noteSpeaker.recentMeasures = () => [{measure: 1, at: 1.6}];
            updateNotes(noteSpeaker);
        }''')
        expect(glyphs).to_have_count(1)
        expect(glyphs).to_have_attribute('data-rhythm', 'dotted whole')
        expect(glyphs.locator('ellipse')).to_have_count(1)
        expect(glyphs.locator('circle')).to_have_count(1)
        bars = trail.locator('[data-measure]')
        expect(bars).to_have_count(1)
        expect(bars).to_have_attribute('data-measure', '1')
        page.evaluate('updateNotes(noteSpeaker)')
        expect(bars).to_have_count(1)
        assert treble_staff.locator('[data-at]').evaluate_all(
            '(nodes) => nodes.map(n => n.dataset.rhythm || n.dataset.measure)') == ['dotted whole', '1']
        page.evaluate('noteSpeaker.recentMeasures = () => []; noteBatch = []; updateNotes(noteSpeaker)')
        expect(bars).to_have_count(0)
        page.evaluate('noteSpeaker.playing = null; updateNotes(noteSpeaker)')
        expect(treble_staff).to_be_hidden()

        # Use actual WebAudio samples to check both tonal and noise effects while muted.
        page.evaluate('''async () => {
            const { Speaker } = await import('/audio.js');
            const music = await (await fetch('/data/music.json')).json();
            window.effectSpeaker = new Speaker(music);
            effectSpeaker.unlock({tick: 0});
            await effectSpeaker.ctx.resume();
            effectSpeaker.mute(true);
        }''')
        waveform = page.locator('#monitor-waveform .sound-waveform')
        for sound in [1, 11]:
            page.evaluate('(id) => effectSpeaker.sfx(id)', sound)
            page.wait_for_function('effectSpeaker.effectWaveform()?.some(sample => Math.abs(sample) > 0.001)')
            page.evaluate('updateNotes(effectSpeaker)')
            expect(waveform).to_be_visible()
            expect(treble_staff).to_be_hidden()
            page.wait_for_function('effectSpeaker.effectWaveform() === null')
            page.evaluate('updateNotes(effectSpeaker)')
            expect(waveform).to_be_visible()
            page.evaluate("window.idleTrace = document.querySelector('.sound-waveform').toDataURL()")
            page.evaluate('updateNotes(effectSpeaker)')
            assert page.evaluate("document.querySelector('.sound-waveform').toDataURL() === idleTrace"), 'silence keeps the trace still'
        # A known signal makes the transition independent of short real-time effects.
        page.evaluate("""() => {
            window.traceSpeaker = {muted: true, effect: {}, ctx: {currentTime: 0},
                effectWaveform: () => new Float32Array([0, 0.5, -0.5, 0]),
                upcomingNotes: () => [], recentMeasures: () => []};
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
        assert glyphs.count() == page.evaluate('effectSpeaker.upcomingNotes().length')
        assert glyphs.count() > 1
        # The next measure exists before playback reaches it, even while muted.
        page.evaluate('effectSpeaker.ctx.suspend()')
        page.evaluate('''() => {
            effectSpeaker.playTune(7, 0);
            // Keep the audio clock fixed while exercising the normal ready path.
            Object.defineProperty(effectSpeaker, 'ready', {value: true});
            updateNotes(effectSpeaker);
        }''')
        assert bars.count() == page.evaluate('effectSpeaker.recentMeasures(0, Infinity).length')
        assert bars.count() > 2
        assert glyphs.count() == page.evaluate('effectSpeaker.upcomingNotes().length')
        assert page.evaluate("Number(document.querySelector('#music-notes [data-measure=\"1\"]').dataset.at) > effectSpeaker.ctx.currentTime")
        # Every simultaneous attack uses one stem direction, even across the middle line.
        page.evaluate('''async () => {
            const { noteRhythm } = await import('/music-notation.js');
            noteBatch = [60, 77].map(midi => ({midi, at: 5, rhythm: noteRhythm(0, 18)}));
            noteSpeaker.playing = {};
            updateNotes(noteSpeaker);
        }''')
        assert glyphs.evaluate_all('(nodes) => new Set(nodes.map(n => n.dataset.stem)).size') == 1
        page.evaluate('effectSpeaker.silence(); updateNotes(effectSpeaker); effectSpeaker.ctx.close()')
        expect(glyphs).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('browser_music_test: single treble staff, low notes, dotted endings, measures, waveforms, mute and expiry passed')
