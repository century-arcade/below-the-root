"""Pausing and resuming gameplay leave already scheduled demo audio playing."""
from browser_helpers import browser_page, until
from playwright.sync_api import expect

with browser_page('/?menu') as page:
    # The demo schedules a tune on WebAudio; pausing must not cut or restart its notes.
    page.add_init_script('''
        window.audioStops = 0;
        const stop = AudioScheduledSourceNode.prototype.stop;
        AudioScheduledSourceNode.prototype.stop = function (...args) {
            window.audioStops++;
            return stop.apply(this, args);
        };
    ''')
    page.goto(page.url.split('?')[0] + '?demo=quest')
    page.wait_for_function("document.getElementById('volume').hasAttribute('aria-valuetext')")
    page.keyboard.press('-')  # Unlock audio without aborting the demo.
    expect(page.locator('#log')).to_be_hidden()
    until(page, 's => window.audioStops > 10')
    scheduled = page.evaluate('window.audioStops')
    for action in ['p', 'ArrowRight', 'blur', 'Escape']:
        if action == 'blur':
            page.evaluate("dispatchEvent(new Event('blur'))")
        else:
            page.keyboard.press(action)
        page.clock.run_for(200)
        assert page.evaluate('window.audioStops') == scheduled, 'pause/resume must leave scheduled music playing'
print('browser_audio_pause_test: pause/resume preserves scheduled music passed')
