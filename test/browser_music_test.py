"""One-measure music symbols follow note events, fading after their measure."""
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
    voice_zero = trail.locator('[data-voice="0"]')
    voice_one = trail.locator('[data-voice="1"]')
    expect(trail).to_have_attribute('aria-hidden', 'true')
    expect(trail.locator('[data-rhythm]')).to_have_count(0)
    expect(voice_zero).to_be_hidden()
    expect(voice_one).to_be_hidden()
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
    page.locator('#volume').fill('0')
    expect(page.locator('#volume')).to_have_value('0')
    seen = page.evaluate('seenSymbols.length')
    page.wait_for_function('(seen) => seenSymbols.length > seen', arg=seen)
    page.get_by_role('navigation').get_by_role('link', name='Play', exact=True).click()
    expect(trail.locator('[data-rhythm]')).to_have_count(0)

    # Notes occupy beat positions in one fixed measure in both motion modes.
    for motion in ['no-preference', 'reduce']:
        page.emulate_media(reduced_motion=motion)
        page.evaluate('''async () => {
            const { createMusicTrail } = await import('/music-trail.js');
            const { noteRhythm } = await import('/music-notation.js');
            const element = document.getElementById('music-notes');
            window.noteBatch = [
                {voice: 0, midi: 59, rhythm: noteRhythm(0, 36), at: 0, measureFrames: 144, measureOffset: 0},
                {voice: 1, midi: 60, rhythm: noteRhythm(0, 72), at: .6, measureFrames: 144, measureOffset: 36},
                {voice: 0, midi: 61, rhythm: noteRhythm(0, 18), at: 1.2, measureFrames: 144, measureOffset: 72},
                {voice: 1, midi: 48, rhythm: noteRhythm(0, 144), at: 1.8, measureFrames: 144, measureOffset: 108},
            ];
            window.noteSpeaker = {playing: {}, tuneEnd: 20, ctx: {currentTime: 2},
                recentNotes: () => noteBatch, effectWaveform: () => null};
            window.updateNotes = createMusicTrail(element);
            updateNotes(noteSpeaker);
            window.firstGlyph = element.querySelector('[data-rhythm="quarter"]');
        }''')
        glyphs = trail.locator('[data-rhythm]')
        first_voice = voice_zero.locator('[data-rhythm]')
        second_voice = voice_one.locator('[data-rhythm]')
        expect(glyphs).to_have_count(4)
        expect(glyphs.locator('svg')).to_have_count(4)
        assert first_voice.evaluate_all('(nodes) => nodes.map(n => n.dataset.rhythm)') == ['quarter', 'eighth']
        assert second_voice.evaluate_all('(nodes) => nodes.map(n => n.dataset.rhythm)') == ['half', 'whole']
        assert glyphs.evaluate_all('(nodes) => nodes.map(n => n.dataset.measurePosition)') == ['0', '0.5', '0.25', '0.75']
        assert glyphs.evaluate_all('(nodes) => nodes.every(n => getComputedStyle(n).animationName === "none")')
        page.evaluate('updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(4)
        assert page.evaluate("document.querySelector('#music-notes [data-rhythm=quarter]') === firstGlyph")
        page.evaluate('noteBatch = noteBatch.slice(1); updateNotes(noteSpeaker)')
        expect(first_voice).to_have_count(1)
        expect(second_voice).to_have_count(2)
        page.evaluate('noteSpeaker.ctx.currentTime = 3.6; updateNotes(noteSpeaker)')
        assert 0.49 < float(glyphs.first.get_attribute('style').split('opacity: ')[1].split(';')[0]) < 0.51
        page.evaluate('noteSpeaker.ctx.currentTime = 4.8; updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(0)
        page.evaluate('noteSpeaker.ctx.currentTime = 2; noteBatch = []; updateNotes(noteSpeaker)')
        expect(glyphs).to_have_count(0)
        expect(voice_zero).to_be_visible()
        expect(voice_one).to_be_visible()
        page.evaluate('noteSpeaker.playing = null; updateNotes(noteSpeaker)')
        expect(voice_zero).to_be_hidden()
        expect(voice_one).to_be_hidden()

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
            expect(voice_zero).to_be_hidden()
            expect(voice_one).to_be_hidden()
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
        expect(voice_zero).to_be_visible()
        expect(voice_one).to_be_visible()
        expect(glyphs).to_have_count(1)
        page.evaluate('effectSpeaker.silence(); updateNotes(effectSpeaker); effectSpeaker.ctx.close()')
        expect(glyphs).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('browser_music_test: fixed measure, voice lanes, fading, waveforms, mute and expiry passed')
