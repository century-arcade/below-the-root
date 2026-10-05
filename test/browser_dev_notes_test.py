"""Dev notes navigate dated sections and share the desk's item-switching behaviour."""
from playwright.sync_api import expect
from browser_helpers import browser_page


def paper_days(page):
    return page.locator('.greenbar-paper [data-paper-day]')


for viewport in [{'width': 1440, 'height': 1000}, {'width': 390, 'height': 844}]:
    with browser_page('/play.html', viewport=viewport) as page:
        opener = page.get_by_role('button', name='Dev notes', exact=True)
        opener.click()
        expect(page.locator('#dev-notes')).to_be_visible()
        reader = page.get_by_role('region', name='Dated development prompts', exact=True)
        expect(reader).to_be_focused()
        previous = page.get_by_role('button', name='Previous day', exact=True, include_hidden=True)
        next_day = page.get_by_role('button', name='Next day', exact=True, include_hidden=True)
        expect(previous).to_be_disabled()
        days = paper_days(page).evaluate_all('(nodes) => nodes.map(node => node.dataset.paperDay)')
        current = page.locator('.greenbar-paper [aria-current="true"]')
        expect(current).to_have_attribute('data-paper-day', days[0])
        next_day.click()
        expect(current).to_have_attribute('data-paper-day', days[1])
        previous.click()
        expect(current).to_have_attribute('data-paper-day', days[0])
        reader.press('ArrowLeft')
        expect(current).to_have_attribute('data-paper-day', days[0])
        reader.press('ArrowRight')
        expect(current).to_have_attribute('data-paper-day', days[1])
        page.get_by_role('button', name='Game Manual', exact=True).click()
        expect(page.locator('#dev-notes')).to_be_hidden()
        expect(page.locator('#manual')).to_be_visible()
        opener.click()
        expect(current).to_have_attribute('data-paper-day', days[1])
        expect(page.get_by_role('button', name='Close dev notes', exact=True)).to_have_count(0)
        expect(page.locator('[data-paper-pause]')).to_have_count(0)
        page.get_by_role('button', name="Curator's Note", exact=True).click()
        expect(page.locator('#dev-notes')).to_be_hidden()
        expect(page.locator('#note')).to_be_visible()

with browser_page('/play.html') as page:
    page.get_by_role('button', name='Dev notes', exact=True).click()
    assert page.evaluate('''async () => {
        const prompts = await (await fetch('/assets/dev-notes.json')).json();
        const paper = document.querySelector('.greenbar-paper');
        const articles = [...paper.querySelectorAll('article')];
        const days = [...paper.querySelectorAll('[data-paper-day]')];
        const pacific = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' });
        const day = prompt => pacific.format(new Date(prompt.timestamp));
        return articles.length === prompts.length && articles.every((article, i) =>
            article.querySelector('p').textContent === prompts[i].text &&
            article.querySelector('time').dateTime === prompts[i].timestamp &&
            article.closest('[data-paper-day]').dataset.paperDay === day(prompts[i])) &&
            days.length === new Set(prompts.map(day)).size;
    }''')
    days = paper_days(page).evaluate_all('(nodes) => nodes.map(node => node.dataset.paperDay)')
    current = page.locator('.greenbar-paper [aria-current="true"]')
    next_day = page.get_by_role('button', name='Next day', exact=True, include_hidden=True)
    for day in days[1:]:
        next_day.click()
        expect(current).to_have_attribute('data-paper-day', day)
    expect(next_day).to_be_disabled()
    page.get_by_role('region', name='Dated development prompts', exact=True).press('ArrowRight')
    expect(current).to_have_attribute('data-paper-day', days[-1])
