"""Serve the unpacked preservation edition using only Python's standard library."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import webbrowser


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.json': 'application/json', '.woff': 'font/woff', '.ttf': 'font/ttf'}

    def do_GET(self):
        if urlsplit(self.path).path == '/.netlify/functions/github':
            body = b'{"configured":false,"error":"GitHub issue reporting requires the hosted site."}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def send_head(self):
        url = urlsplit(self.path)
        if url.path in ('/resources', '/resources/', '/resources.html'):
            self.send_response(301)
            self.send_header('Location', '/links' + ('?' + url.query if url.query else ''))
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        if url.path.rstrip('/') in ('/about', '/play', '/links'):
            self.path = url.path.rstrip('/') + '.html' + ('?' + url.query if url.query else '')
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    site = Path(__file__).resolve().parent / 'site'
    if not (site / 'index.html').is_file():
        parser.error('site/index.html is missing; extract the entire ZIP beside serve.py')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(site)))
    except OSError as error:
        parser.error(f'{error}; try --port 8888')
    with server:
        address = f'http://127.0.0.1:{server.server_port}/'
        print(f'Below the Root: {address}\nPress Ctrl+C to stop.', flush=True)
        if not args.no_browser:
            webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
