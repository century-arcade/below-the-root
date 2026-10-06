"""Write the den's wall paneling and oak desk tiles into assets/room/.

Colours are sampled from Wikimedia Commons photos: walnut-stained 1970s
paneling (Visbeck US Army quarters, 2019, image 6475) and oak from
"16 wood samples.jpg".
"""
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/room'

GROOVE = '#2a0300'
BOARDS = '#652d0c', '#5e2506', '#6b3413', '#652d0c'
PANEL_GRAIN = '#4c1800', '#4c1800', '#743f1f'
PANEL_LIGHT = '#743f1f'
OAK = '#bb813b'
OAK_GRAIN = '#af742e', '#af742e', '#c68d48', '#985b15'


def streak(x, y, w, h, fill, height):
    rects = [f"<rect x='{x}' y='{y}' width='{w}' height='{h}' fill='{fill}'/>"]
    if y + h > height:
        rects.append(f"<rect x='{x}' y='{y - height}' width='{w}' height='{h}' fill='{fill}'/>")
    return rects


def svg(width, height, body):
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>"
            + ''.join(body) + '</svg>\n')


def paneling():
    rng = random.Random(7)
    width, height = 240, 480
    edges = [0, 56, 104, 176, width]
    body = []
    for tone, (left, right) in zip(BOARDS, zip(edges, edges[1:])):
        body.append(f"<rect x='{left}' width='{right - left}' height='{height}' fill='{tone}'/>")
        for _ in range((right - left) // 7):
            body += streak(rng.randrange(left + 4, right - 1), rng.randrange(height), 1,
                           rng.randrange(60, 300), rng.choice(PANEL_GRAIN), height)
    for left in edges[:-1]:
        body.append(f"<rect x='{left}' width='3' height='{height}' fill='{GROOVE}'/>")
        body.append(f"<rect x='{left + 3}' width='1' height='{height}' fill='{PANEL_LIGHT}'/>")
    return svg(width, height, body)


def oak():
    rng = random.Random(3)
    size = 320
    body = [f"<rect width='{size}' height='{size}' fill='{OAK}'/>"]
    for _ in range(70):
        body += streak(rng.randrange(size), rng.randrange(size), rng.choice((1, 1, 2)),
                       rng.randrange(40, 220), rng.choice(OAK_GRAIN), size)
    return svg(size, size, body)


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / 'paneling.svg').write_text(paneling())
    (OUT / 'oak.svg').write_text(oak())


if __name__ == '__main__':
    main()
