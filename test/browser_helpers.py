"""Observe live gameplay without changing autosave or exposing a production API."""
from contextlib import contextmanager
import os
from playwright.sync_api import sync_playwright


def install_probe(page):
    def main(route):
        response = route.fetch()
        source = response.text().replace('  let state = session.state;',
            '  let state = session.state; window.questSession = () => session;')
        route.fulfill(response=response, body=source)
    page.route('**/main.js', main)


def observe(page):
    page.wait_for_function('typeof window.questSession === "function"')
    return page.evaluate('''async () => {
        const session = questSession(), s = session.state;
        const { checkpoint } = await import('/record.js');
        return {frame: session.frame, simticks: s.simticks,
            events: session.record?.events ?? [], demo: s.demo?.name ?? null,
            checkpoint: checkpoint(s), panel: Array.from(s.panel),
            title: s.title, quest: s.quest};
    }''')


@contextmanager
def browser_page(path):
    """Open the running game with a session probe and fail on browser errors."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        install_probe(page)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(os.environ.get('BTR_URL', 'http://localhost:8000') + path)
            page.wait_for_selector('#volume[aria-valuetext]', state='attached')
            yield page
            assert not errors, errors
        finally:
            browser.close()
