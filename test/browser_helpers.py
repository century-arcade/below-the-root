"""Observe live gameplay without changing autosave or exposing a production API."""
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
