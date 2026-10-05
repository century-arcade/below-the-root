"""Dev notes preserve literal prompts, offer feed controls, and return focus without powering on."""
from playwright.sync_api import expect
from browser_helpers import browser_page, observe


for viewport in [{'width': 1440, 'height': 1000}, {'width': 390, 'height': 844}]:
    with browser_page('/play.html', viewport=viewport) as page:
        opener = page.get_by_role('button', name='Dev notes', exact=True)
        opener.click()
        expect(page.locator('#dev-notes')).to_be_visible()
        pause = page.get_by_role('button', name='Pause paper feed', exact=True)
        expect(pause).to_be_focused()
        pause.click()
        resume = page.get_by_role('button', name='Resume paper feed', exact=True)
        expect(resume).to_have_attribute('aria-pressed', 'true')
        resume.click()
        expect(pause).to_have_attribute('aria-pressed', 'false')
        page.locator('.greenbar-viewport').press('ArrowDown')
        expect(resume).to_have_attribute('aria-pressed', 'true')
        page.keyboard.press('Escape')
        expect(page.locator('#dev-notes')).to_be_hidden()
        expect(opener).to_be_focused()
        expect(page.locator('#monitor-power')).to_have_attribute('aria-pressed', 'false')
        opener.press('Enter')
        page.get_by_role('button', name='Close dev notes', exact=True).click()
        expect(page.locator('#dev-notes')).to_be_hidden()
        expect(opener).to_be_focused()

with browser_page('/play.html', reduced_motion='reduce') as page:
    before = observe(page)
    page.get_by_role('button', name='Dev notes', exact=True).click()
    expect(page.get_by_role('button', name='Resume paper feed', exact=True)).to_have_attribute('aria-pressed', 'true')
    page.clock.run_for(1000)
    assert observe(page)['checkpoint'] == before['checkpoint']
    assert page.locator('.greenbar-paper[aria-hidden="true"]').count() == 1
    assert page.locator('.greenbar-paper[aria-hidden="true"]').evaluate('(node) => node.inert')
    assert page.evaluate('''async () => {
        const prompts = await (await fetch('/assets/dev-notes.json')).json();
        const articles = [...document.querySelector('.greenbar-paper').querySelectorAll('article')];
        return articles.length === prompts.length && articles.every((article, i) =>
            article.querySelector('p').textContent === prompts[i].text &&
            article.querySelector('time').dateTime === prompts[i].timestamp);
    }''')
