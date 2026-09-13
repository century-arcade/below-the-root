"""Music symbols follow note events, including muted playback and tune cancellation."""
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
    expect(trail).to_have_attribute('aria-hidden', 'true')
    expect(trail.locator('[data-rhythm]')).to_have_count(0)
    page.evaluate('''() => {
        window.seenSymbols = [];
        new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.dataset?.rhythm) seenSymbols.push(node.dataset.rhythm);
                }
            }
        }).observe(document.getElementById('music-notes'), {childList: true, subtree: true});
    }''')
    page.keyboard.press('-')  # Unlock sound without leaving the demo.
    page.wait_for_function('new Set(seenSymbols).size > 1')
    page.keyboard.press('m')
    expect(page.locator('#volume')).to_have_value('0')
    seen = page.evaluate('seenSymbols.length')
    page.wait_for_function('(seen) => seenSymbols.length > seen', arg=seen)
    page.get_by_role('navigation').get_by_role('link', name='Game', exact=True).click()
    expect(trail.locator('[data-rhythm]')).to_have_count(0)

    # Check register membership around middle C, crossing voices and chords in both modes.
    for motion in ['no-preference', 'reduce']:
        page.emulate_media(reduced_motion=motion)
        page.evaluate('''async () => {
            const { createMusicTrail } = await import('/music-trail.js');
            const { noteRhythm } = await import('/music-notation.js');
            const element = document.getElementById('music-notes');
            window.noteBatch = [
                {voice: 0, midi: 59, rhythm: noteRhythm(0, 36), at: 0},
                {voice: 1, midi: 60, rhythm: noteRhythm(0, 72), at: 0},
                {voice: 0, midi: 61, rhythm: noteRhythm(0, 18), at: 0},
                {voice: 1, midi: 48, rhythm: noteRhythm(0, 144), at: 0},
            ];
            window.noteSpeaker = {ctx: {currentTime: 0}, recentNotes: () => noteBatch, effectWaveform: () => null};
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
        page.evaluate('updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(4)
        assert page.evaluate("document.querySelector('#music-notes [data-rhythm=quarter]') === firstGlyph")
        page.evaluate('noteBatch = noteBatch.slice(1); updateNotes(noteSpeaker)')
        expect(bass).to_have_count(1)
        expect(treble).to_have_count(2)
        page.evaluate('noteBatch = []; updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(0)
        expect(trail.locator('[data-register]')).to_have_count(2)

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
            expect(trail.locator('[data-register="treble"]')).to_be_hidden()
            expect(trail.locator('[data-register="bass"]')).to_be_hidden()
            page.wait_for_function('effectSpeaker.effectWaveform() === null')
            page.evaluate('updateNotes(effectSpeaker)')
            expect(waveform).to_be_hidden()
        page.evaluate('effectSpeaker.sfx(11); updateNotes(effectSpeaker)')
        expect(waveform).to_be_visible()
        page.evaluate('effectSpeaker.playTune(0, 0); updateNotes(effectSpeaker)')
        expect(waveform).to_be_hidden()
        expect(trail.locator('[data-register="treble"]')).to_be_visible()
        expect(trail.locator('[data-register="bass"]')).to_be_visible()
        expect(glyphs).to_have_count(1)
        page.evaluate('effectSpeaker.silence(); updateNotes(effectSpeaker); effectSpeaker.ctx.close()')
        expect(glyphs).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('browser_music_test: live rhythm, pitch registers, chords, tone/noise waveforms, mute, expiry and both motion modes passed')
