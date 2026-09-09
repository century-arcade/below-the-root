#!/home/saul/.venvs/claude/bin/python
"""shot.py [--url URL] [--width 900 --height 750] [--keys k,k,...] [--select CSS] OUT.png [PATH...]; multiple paths produce OUT-slug.png files."""

import argparse
import os
from pathlib import Path
import re
import sys

from playwright.sync_api import Error, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=os.environ.get('BTR_URL', 'http://localhost:8000/'))
    parser.add_argument('--width', type=int, default=900)
    parser.add_argument('--height', type=int, default=750)
    parser.add_argument('--keys', default='', help='comma-separated Playwright key names')
    parser.add_argument('--select', help='CSS selector to capture instead of the viewport')
    parser.add_argument('out', type=Path)
    parser.add_argument('path', nargs='*', help='paths appended to URL; multiple paths add filename slugs')
    args = parser.parse_args()
    paths = args.path or ['']
    errors = []
    outputs = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
        ])
        for path in paths:
            url = args.url + path
            out = args.out
            if len(paths) > 1:
                slug = re.sub(r'[^a-zA-Z0-9_-]+', '-', path).strip('-') or 'root'
                out = args.out.with_name(f'{args.out.stem}-{slug}{args.out.suffix}')
                number = 2
                while out in outputs:
                    out = args.out.with_name(f'{args.out.stem}-{slug}-{number}{args.out.suffix}')
                    number += 1
            outputs.add(out)
            page = browser.new_page(viewport={'width': args.width, 'height': args.height})
            page_errors = []
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            page.on('console', lambda msg: page_errors.append(msg.text) if msg.type == 'error' else None)
            try:
                page.goto(url)
                page.wait_for_selector('#mute[aria-pressed]', state='attached', timeout=15000)
                for key in args.keys.split(',') if args.keys else []:
                    page.keyboard.press(key)
                    page.wait_for_timeout(200)
            except Error as error:
                page_errors.append(str(error))
            # Keep a picture of failures too, including boot failures before readiness.
            try:
                page.wait_for_timeout(200)
                target = page.locator(args.select) if args.select else page
                target.screenshot(path=out, type='png')
            except Error as error:
                page_errors.append(str(error))
            finally:
                page.close()
            errors.extend(f'{url}: {error}' for error in page_errors)
        browser.close()

    for error in errors:
        print(error, file=sys.stderr)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
