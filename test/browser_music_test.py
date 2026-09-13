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
    expect(trail.locator('span')).to_have_count(0)
    page.evaluate('''() => {
        window.seenSymbols = [];
        new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) seenSymbols.push(node.dataset.rhythm);
            }
        }).observe(document.getElementById('music-notes'), {childList: true});
    }''')
    page.keyboard.press('-')  # Unlock sound without leaving the demo.
    page.wait_for_function('new Set(seenSymbols).size > 1')
    page.keyboard.press('m')
    expect(page.locator('#volume')).to_have_value('0')
    seen = page.evaluate('seenSymbols.length')
    page.wait_for_function('(seen) => seenSymbols.length > seen', arg=seen)
    page.get_by_role('navigation').get_by_role('link', name='Game', exact=True).click()
    expect(trail.locator('span')).to_have_count(0)

    # Isolate the renderer to check chords, stable glyphs and expiry without timers.
    page.evaluate('''async () => {
        const { createMusicTrail } = await import('/music-trail.js');
        const { noteRhythm } = await import('/music-notation.js');
        const element = document.createElement('span');
        element.id = 'test-notes';
        document.body.append(element);
        window.noteBatch = [
            {voice: 0, rhythm: noteRhythm(0, 36), at: 0},
            {voice: 1, rhythm: noteRhythm(0, 72), at: 0},
        ];
        window.noteSpeaker = {ctx: {currentTime: 0}, recentNotes: () => noteBatch};
        window.updateNotes = createMusicTrail(element);
        updateNotes(noteSpeaker);
        window.firstGlyph = element.firstChild;
    }''')
    glyphs = page.locator('#test-notes span')
    expect(glyphs).to_have_count(2)
    expect(glyphs.nth(0)).to_have_attribute('data-rhythm', 'quarter')
    expect(glyphs.nth(1)).to_have_attribute('data-rhythm', 'half')
    expect(glyphs.locator('svg')).to_have_count(2)
    page.evaluate('updateNotes(noteSpeaker)')
    expect(glyphs).to_have_count(2)
    assert page.evaluate("document.getElementById('test-notes').firstChild === firstGlyph")
    page.evaluate('noteBatch = noteBatch.slice(1); updateNotes(noteSpeaker)')
    expect(glyphs).to_have_count(1)
    page.evaluate('noteBatch = []; updateNotes(noteSpeaker)')
    expect(glyphs).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('browser_music_test: live rhythm, varied symbols, mute, cancellation, chords and expiry passed')
