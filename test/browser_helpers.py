"""Observe the site's module instance and control browser simulation time."""
from contextlib import contextmanager
import os
from playwright.sync_api import sync_playwright


def session_eval(page, expression, arg=None):
    """Evaluate a function of the current session, including after replacement."""
    return page.evaluate('''async arg => {
        const { questSession } = await import('/main.js');
        return (''' + expression + ''')(questSession(), arg);
    }''', arg)


def ready(page):
    page.wait_for_selector('#volume[aria-valuetext]', state='attached')
    page.wait_for_function('''async () => {
        const { questSession } = await import('/main.js');
        return !!questSession();
    }''')


def observe(page):
    ready(page)
    return page.evaluate('''async () => {
        const { questSession, questPaused } = await import('/main.js');
        const session = questSession(), s = session.state;
        const { checkpoint } = await import('/record.js');
        return {frame: session.frame, simticks: s.simticks,
            paused: questPaused(), active: s.active,
            events: session.record?.events ?? [], demo: s.demo?.name ?? null,
            checkpoint: checkpoint(s), panel: Array.from(s.panel),
            title: s.title, quest: s.quest};
    }''')


def until(page, predicate, arg=None, milliseconds=10000):
    """Advance rAF and timers until a session condition holds, with a time bound."""
    ready(page)
    for _ in range(milliseconds // 16 + 1):
        if session_eval(page, predicate, arg):
            return
        page.clock.run_for(16)
    state = observe(page)
    raise AssertionError(f'Session condition not reached in {milliseconds} ms: {predicate}; '
                         f'frame={state["frame"]}, simticks={state["simticks"]}, paused={state["paused"]}')


def held(page, reason=None):
    before = observe(page)
    assert before['paused'], before
    if reason:
        assert reason in before['paused'], before['paused']
    page.clock.run_for(300)
    after = observe(page)
    assert after['paused'] == before['paused'], after['paused']
    assert (after['frame'], after['simticks']) == (before['frame'], before['simticks'])


@contextmanager
def browser_page(path, *, setup=None, base=None, **options):
    """Open the game with a frozen clock and fail on browser errors."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page(**options)
        page.clock.install(time=0)
        page.clock.pause_at(0)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            if setup:
                setup(page)
            page.goto((base or os.environ.get('BTR_URL', 'http://localhost:8000')) + path)
            ready(page)
            yield page
            assert not errors, errors
        finally:
            browser.close()
