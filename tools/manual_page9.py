"""Rewrite manual page 9 (scan 11) for this port's controls.

The right column shows arrows or WASD with the Apple keys erased and "On
IBM:" cut; its capital U comes from page 5.  The left column trades the
joystick for the touchscreen.  New words are spliced from the scans: whole
words where the manual prints them, letters cut from other words where it
does not.  W, A and S on the keycaps are rendered to match the scanned D.
Requires Liberation Sans Bold.
"""
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFont

KEY_FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
INK = 128
GLYPH = 185


def ink_box(a, box):
    x0, y0, x1, y1 = box
    ys, xs = np.nonzero(a[y0:y1, x0:x1] < INK)
    return int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max() + 1), int(y0 + ys.max() + 1)


def render_letter(letter, height, xscale):
    font = ImageFont.truetype(KEY_FONT, 400)
    l, t, r, b = (round(v) for v in font.getbbox(letter))
    big = Image.new('L', (r - l + 40, b - t + 40), 255)
    ImageDraw.Draw(big).text((20 - l, 20 - t), letter, font=font, fill=0)
    big = big.crop(ink_box(np.asarray(big), (0, 0, big.width, big.height)))
    scale = height / big.height
    return big.resize((max(1, round(big.width * scale * xscale)), height), Image.Resampling.LANCZOS)


def relabel(page, cap, letter, xscale, glyph=None):
    """Replace the letter inside the keycap whose inner area is cap."""
    a = np.asarray(page)
    old = ink_box(a, cap)
    page.paste(255, cap)
    glyph = glyph or render_letter(letter, old[3] - old[1], xscale)
    cx, cy = (old[0] + old[2]) / 2, (old[1] + old[3]) / 2
    page.paste(glyph, (round(cx - glyph.width / 2), round(cy - glyph.height / 2)))


def keyboard(page, use_page):
    """Arrows or WASD in the right column, Apple keys erased, no platform names."""
    page = page.copy()
    page.paste(255, (715, 220, 1400, 440))
    rest = page.crop((890, 445, 1290, 484))
    page.paste(255, (725, 445, 1300, 484))
    u = use_page.crop((330, 637, 354, 676))
    page.paste(u, (733 - 2, 445))
    page.paste(rest, (733 + 354 - 332, 445))
    keys = (725, 528, 1400, 670)
    a = np.asarray(page)
    d_old = ink_box(a, (1000, 586, 1022, 614))
    d_glyph = page.crop(d_old)
    probe = render_letter('D', d_glyph.height, 1)
    xscale = d_glyph.width / probe.width
    relabel(page, (1023, 545, 1047, 569), 'W', xscale)
    relabel(page, (1000, 586, 1022, 614), 'A', xscale)
    relabel(page, (1023, 631, 1047, 655), 'S', xscale)
    relabel(page, (1041, 586, 1070, 614), 'D', xscale, d_glyph)
    group = page.crop((730, 528, 1080, 670))
    page.paste(255, keys)
    left = 733 + (1343 - 733 - (1074 - 734)) // 2
    page.paste(group, (left - 4, 528))
    return centre(page, (715, 220, 1400, 680))


def centre(page, area):
    """Move the ink inside area to sit midway between the ink above and below it."""
    x0, y0, x1, y1 = area
    rows = np.nonzero((np.asarray(page)[:, x0:x1] < INK).any(1))[0]
    inside = rows[(rows >= y0) & (rows < y1)]
    above, below = rows[rows < y0].max(), rows[rows >= y1].min()
    top = (above + below - (inside.max() - inside.min())) // 2
    block = page.crop((x0, int(inside.min()), x1, int(inside.max()) + 1))
    page.paste(255, area)
    page.paste(block, (x0, int(top)))
    return page



SOURCES = {
    'Climb': (11, (43, 1048, 133, 1073)),
    'Crawl': (11, (42, 1165, 129, 1190)),
    'Fall': (11, (41, 1360, 95, 1385)),
    'Glide': (11, (40, 1439, 121, 1464)),
    'Gliding': (11, (141, 1441, 249, 1473)),
    'Hold': (12, (93, 394, 158, 419)),
    'Joystick:': (11, (130, 465, 269, 496)),
    'Jump@549': (11, (44, 549, 130, 579)),
    'Jump@895': (11, (124, 895, 203, 925)),
    'Jumping': (11, (470, 780, 596, 812)),
    'Keyboard:': (11, (789, 186, 950, 217)),
    'Once': (11, (49, 183, 127, 208)),
    'Position': (11, (432, 1635, 549, 1660)),
    'Return': (11, (156, 971, 254, 995)),
    'Run': (11, (44, 895, 106, 919)),
    'Then': (11, (566, 1206, 642, 1231)),
    'To': (11, (292, 703, 325, 727)),
    'Walk@1361': (11, (113, 1361, 184, 1386)),
    'Walk@506': (11, (46, 506, 121, 532)),
    'While@546': (11, (149, 547, 231, 572)),
    'While@664': (11, (46, 664, 127, 689)),
    'With': (11, (48, 465, 121, 490)),
    'a': (11, (504, 712, 519, 728)),
    'and': (11, (48, 336, 101, 360)),
    'another': (12, (1051, 245, 1166, 270)),
    'are': (11, (392, 1097, 436, 1113)),
    'begins,': (11, (177, 1554, 280, 1586)),
    'briefly.': (11, (196, 1007, 293, 1039)),
    'by': (11, (411, 971, 446, 1002)),
    'carrying': (11, (40, 1480, 163, 1510)),
    'character': (11, (43, 1007, 185, 1032)),
    'crawl': (11, (350, 1322, 428, 1346)),
    'door': (11, (230, 1670, 297, 1695)),
    'down': (11, (283, 585, 362, 610)),
    'down.': (11, (465, 1205, 552, 1230)),
    'end': (11, (302, 1362, 354, 1387)),
    'falling.': (11, (441, 1516, 537, 1550)),
    'from': (11, (423, 702, 492, 728)),
    'glide': (11, (97, 1552, 165, 1584)),
    'glide,': (11, (352, 1479, 429, 1511)),
    'hold': (11, (465, 549, 530, 574)),
    'if': (11, (499, 1442, 517, 1467)),
    'in': (11, (251, 225, 278, 247)),
    'is': (11, (124, 413, 144, 435)),
    'jump': (11, (333, 705, 411, 734)),
    'keep': (11, (279, 894, 348, 927)),
    'ladder': (11, (531, 704, 623, 729)),
    'ladders': (11, (126, 814, 230, 840)),
    'left': (11, (412, 506, 458, 532)),
    'limb.': (11, (110, 1398, 183, 1424)),
    'not': (11, (429, 822, 477, 841)),
    'of': (11, (502, 260, 529, 287)),
    'off': (11, (196, 1361, 233, 1387)),
    'on': (11, (449, 1097, 484, 1113)),
    'only': (11, (423, 1442, 487, 1473)),
    'or': (11, (470, 517, 499, 533)),
    'or@673': (11, (275, 673, 307, 689)),
    'over': (11, (99, 1678, 161, 1695)),
    'position': (11, (205, 1206, 323, 1235)),
    'position.': (11, (440, 1325, 566, 1353)),
    'possible': (11, (489, 817, 606, 848)),
    'push@1240': (11, (41, 1240, 112, 1271)),
    'ramp': (11, (431, 1372, 506, 1395)),
    'right': (11, (1235, 969, 1304, 1001)),
    'right.': (11, (511, 508, 587, 540)),
    'run.': (11, (84, 978, 141, 994)),
    'running:': (11, (317, 667, 450, 696)),
    'screen': (6, (465, 1395, 560, 1411)),
    'screen.': (12, (735, 826, 836, 842)),
    'self': (11, (38, 1668, 89, 1694)),
    'shuba.': (11, (200, 1479, 295, 1504)),
    'sideways.': (11, (318, 778, 457, 810)),
    'standing@1203': (11, (68, 1203, 194, 1235)),
    'standing@548': (11, (242, 548, 375, 579)),
    'still:': (11, (387, 549, 452, 573)),
    'stoop': (11, (375, 1210, 453, 1236)),
    'stopping': (11, (457, 975, 584, 1004)),
    'the': (11, (149, 260, 194, 286)),
    'the@1206': (11, (919, 1241, 965, 1267)),
    'to': (11, (116, 227, 143, 247)),
    'toward': (11, (44, 932, 145, 956)),
    'tree': (11, (41, 1403, 97, 1423)),
    'underground.': (11, (44, 852, 241, 884)),
    'up': (11, (1024, 1448, 1060, 1470)),
    'vine.': (11, (83, 1127, 153, 1149)),
    'vine:': (11, (86, 742, 156, 764)),
    'vines': (11, (307, 819, 382, 841)),
    'walk': (11, (332, 971, 400, 996)),
    'walking': (11, (139, 664, 263, 695)),
    'when': (11, (512, 1168, 591, 1193)),
    'which': (11, (400, 933, 489, 959)),
    'while': (11, (238, 1087, 316, 1112)),
    'wish': (11, (435, 624, 502, 649)),
    'with': (11, (495, 338, 559, 362)),
    'you': (11, (139, 192, 191, 215)),
    'your': (11, (289, 193, 354, 216)),
    'your-': (11, (561, 1644, 637, 1666)),
    'touching,': (10, (498, 571, 635, 603)),
    'find': (15, (382, 359, 438, 384)),
    'longer': (15, (1257, 359, 1348, 392)),
    'staple': (15, (293, 751, 378, 782)),
    'Some': (16, (777, 587, 855, 612)),
    'Continue:': (8, (62, 1311, 248, 1342)),
    'To@8': (8, (63, 542, 105, 572)),
}


ENTRIES = [
    ('Walk@506', 'Hold a finger on the left or right side of the screen.'),
    ('Jump@549', 'While@546 standing@548 still: hold the side you wish to jump toward and tap with another finger. '
                 'While@664 walking or@673 running: tap with another finger. To jump from a ladder or vine: '
                 'hold a side and tap with another finger. Jumping from ladders and vines is not possible underground.'),
    ('Run', 'Jump@895 and keep your finger on the side toward which you wish to run. '
            'Return to a walk by stopping the character briefly.'),
    ('Climb', 'Swipe up or down while you are on a ladder or vine.'),
    ('Crawl', 'Swipe down when in a standing@1203 position to stoop down. Then swipe left or right.'),
    ((42, 1282, 181, 1314), 'Swipe up when you are in the crawl position.'),
    ('Fall', 'Walk@1361 off the end of a ramp or a tree limb.'),
    ('Glide', 'Gliding is possible only if you are carrying a shuba. To glide, tap the screen while you are falling. '
              'Once the glide begins, touch the left or right side to glide left or right.'),
    ((39, 1632, 413, 1666), 'Position yourself over the door and tap the screen.'),
]
COLUMN = (28, 455, 668, 1742)
HEADING_BASE, HEADING_LEFT = 490, 48
TOP_BASE, BOTTOM_BASE = 531, 1727
LEFT_TOP, LEFT_BOTTOM = 46, 38
WIDTH, PITCH, ENTRY_GAP = 618, 37.6, 3.0
WORD_GAP, HEAD_GAP, LETTER_GAP = 11, 18, 3


class Piece:
    """Grey ink (255 is paper) with its baseline row."""

    def __init__(self, g, base):
        rows = np.nonzero((g < GLYPH).any(1))[0]
        self.g = g[rows.min():rows.max() + 1]
        self.base = base - rows.min()


def components(mask):
    labels = np.zeros(mask.shape, int)
    count = 0
    h, w = mask.shape
    for y, x in np.argwhere(mask):
        if labels[y, x]:
            continue
        count += 1
        labels[y, x] = count
        queue = deque([(y, x)])
        while queue:
            cy, cx = queue.popleft()
            for ny in (cy - 1, cy, cy + 1):
                for nx in (cx - 1, cx, cx + 1):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = count
                        queue.append((ny, nx))
    return labels, count


def halo(mask):
    grown = mask.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return grown


class Word:
    """A scanned word: ink whose components centre inside its box, minus specks."""

    def __init__(self, scans, scan, box, pad=14):
        x0, y0, x1, y1 = box
        left, top = max(0, x0 - 6), max(0, y0 - pad)
        region = scans[scan][top:y1 + pad, left:x1 + 6]
        labels, count = components(region < GLYPH)
        keep = np.zeros(labels.shape, bool)
        for i in range(1, count + 1):
            ys, xs = np.nonzero(labels == i)
            cy, cx = (ys.min() + ys.max()) / 2 + top, (xs.min() + xs.max()) / 2 + left
            if len(ys) >= 8 and y0 - 3 <= cy <= y1 + 3 and x0 - 2 <= cx <= x1 + 2:
                keep |= labels == i
        inked = np.argwhere(keep)
        first, last = inked.min(0), inked.max(0) + 1
        crop = np.s_[first[0]:last[0], first[1]:last[1]]
        self.g = np.where(halo(keep), region, 255).astype(np.uint8)[crop]
        self.keep = keep[crop]
        counts = self.keep.sum(1)
        self.base = int(np.nonzero(counts >= 0.4 * counts.max())[0].max())
        cols = list(self.keep.any(0)) + [False]
        self.glyphs, start = [], None
        for i, ink in enumerate(cols):
            if ink and start is None:
                start = i
            if not ink and start is not None:
                self.glyphs.append((start, i - 1))
                start = None

    def piece(self, a=0, b=None):
        """Glyphs a..b-1, cut at the blank columns between them."""
        glyphs = self.glyphs[a:b]
        return Piece(self.g[:, glyphs[0][0]:glyphs[-1][1] + 1], self.base)

    def parts(self, starts, scale=1.0):
        """The components whose left edge is in one of starts, for overlapping italic letters."""
        labels, count = components(self.keep)
        chosen = np.zeros(self.keep.shape, bool)
        for i in range(1, count + 1):
            left = np.nonzero(labels == i)[1].min()
            if any(a <= left <= b for a, b in starts):
                chosen |= labels == i
        cols = np.nonzero(chosen.any(0))[0]
        g = np.where(halo(chosen), self.g, 255).astype(np.uint8)[:, cols.min():cols.max() + 1]
        return transform(g, self.base, scale) if scale != 1.0 else Piece(g, self.base)


def transform(g, base, scale, shear=0.0):
    image = Image.fromarray(g)
    if shear:
        pad = int(shear * g.shape[0]) + 2
        wide = Image.new('L', (g.shape[1] + pad, g.shape[0]), 255)
        wide.paste(image, (pad, 0))
        image = wide.transform(wide.size, Image.Transform.AFFINE, (1, shear, 0, 0, 1, 0),
                               Image.Resampling.BICUBIC, fillcolor=255)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    a = np.asarray(image)
    cols = np.nonzero((a < GLYPH).any(0))[0]
    return Piece(a[:, cols.min():cols.max() + 1], round(base * scale))


def join(*pieces, gap=LETTER_GAP):
    ascent = max(p.base for p in pieces)
    descent = max(p.g.shape[0] - p.base for p in pieces)
    out = np.full((ascent + descent, sum(p.g.shape[1] for p in pieces) + gap * (len(pieces) - 1)), 255, np.uint8)
    x = 0
    for p in pieces:
        h, w = p.g.shape
        top = ascent - p.base
        out[top:top + h, x:x + w] = np.minimum(out[top:top + h, x:x + w], p.g)
        x += w + gap
    return Piece(out, ascent)


class Type:
    """Scanned words by name, with the words the manual never prints assembled from letters."""

    def __init__(self, scans):
        self.scans = scans
        self.words = {}

    def word(self, name):
        if name not in self.words:
            box = name if isinstance(name, tuple) else SOURCES[name][1]
            scan = 11 if isinstance(name, tuple) else SOURCES[name][0]
            self.words[name] = Word(self.scans, scan, box)
        return self.words[name]

    def last(self, name):
        w = self.word(name)
        return w.piece(len(w.glyphs) - 1)

    def __call__(self, name):
        made = getattr(self, 'make_' + name.rstrip('.').replace('@', '_'), None)
        if made:
            piece = made()
            return join(piece, self.last('down.'), gap=2) if name.endswith('.') else piece
        w = self.word(name)
        return Piece(w.g, w.base)

    def make_side(self):
        return self.word('sideways.').piece(0, 4)

    def make_touch(self):
        return self.word('touching,').piece(0, 5)

    def make_finger(self):
        return join(self.word('find').piece(0, 2), self.word('longer').piece(3, 6))

    def make_tap(self):
        return self.word('staple').piece(1, 4)

    def ipe(self):
        return [self.word('wish').piece(0, 2), self.word('push@1240').piece(0, 1), self.word('the@1206').piece(2, 3)]

    def make_swipe(self):
        return join(self.word('stoop').piece(0, 1), *self.ipe())

    def make_Swipe(self):
        return join(self.word('Some').piece(0, 1), *self.ipe())

    def make_yourself(self):
        your = self.word('your-')
        return join(your.piece(0, len(your.glyphs) - 1), self.word('self'), gap=2)

    def heading(self):
        """With Touchscreen: in the bold italic of With Joystick:, T slanted from a bold roman heading."""
        joystick, keyboard, continue_ = self.word('Joystick:'), self.word('Keyboard:'), self.word('Continue:')
        to = self.word('To@8')
        t = to.g[:, :25].copy()
        t[6:, 17:] = 255
        letters = [
            join(transform(t, to.base, 0.8, 0.2), joystick.parts([(18, 20)]), gap=-3),
            continue_.parts([(129, 132)], 0.77),
            joystick.parts([(94, 96)]),
            self.word('With').parts([(52, 54)]),
            joystick.parts([(54, 56), (63, 65)]),
            joystick.parts([(94, 96)]),
            keyboard.parts([(116, 118)]),
            keyboard.parts([(23, 25)]),
            keyboard.parts([(23, 25)]),
            continue_.parts([(51, 53)], 0.77),
            joystick.parts([(132, 135)]),
        ]
        with_ = self.word('With')
        return join(Piece(with_.g, with_.base), join(*letters, gap=1), gap=9)


def stamp(page, piece, x, base):
    h, w = piece.g.shape
    top = base - piece.base
    page[top:top + h, x:x + w] = np.minimum(page[top:top + h, x:x + w], piece.g)


def touch(page, scans):
    """Replace the joystick column with touchscreen instructions set from scanned type."""
    type_ = Type(scans)
    lines = []
    for head, text in ENTRIES:
        first = type_(head) if isinstance(head, str) else Piece(type_.word(head).g, type_.word(head).base)
        line, width, opens = [(0, first)], first.g.shape[1], True
        for name in text.split():
            word = type_(name)
            gap = HEAD_GAP if len(line) == 1 and opens else WORD_GAP
            if width + gap + word.g.shape[1] > WIDTH:
                lines.append((line, opens))
                line, width, gap, opens = [], 0, 0, False
            line.append((gap, word))
            width += gap + word.g.shape[1]
        lines.append((line, opens))
    x0, y0, x1, y1 = COLUMN
    page[y0:y1, x0:x1] = 255
    stamp(page, type_.heading(), HEADING_LEFT, HEADING_BASE)
    y = base = TOP_BASE
    for i, (line, opens) in enumerate(lines):
        y += ENTRY_GAP if opens and i else 0
        base = round(y)
        x = round(LEFT_TOP + (LEFT_BOTTOM - LEFT_TOP) * (base - TOP_BASE) / (BOTTOM_BASE - TOP_BASE))
        for gap, word in line:
            stamp(page, word, x + gap, base)
            x += gap + word.g.shape[1]
        y += PITCH
    if base > BOTTOM_BASE:
        raise ValueError('Touch instructions overflow the column')


def edit_page9(scans):
    page = scans[11].copy()
    page = np.asarray(keyboard(Image.fromarray(page), Image.fromarray(scans[7]))).copy()
    touch(page, scans)
    return Image.fromarray(page)
