"""Package the game's extracted 8x8 text glyphs as a web font (requires fonttools)."""
import json
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
chars = json.loads((ROOT / 'assets/charset_text.json').read_text())['chars']
# Other C64 slots contain graphics, not their ASCII counterparts.
codes = [*range(32, 64), *range(65, 92), 93, *range(97, 123)]
cmap = {code: f'char{code}' for code in codes}
for code, source in {
    0xA0: 32, 0xA3: 92, 0x2018: 39, 0x2019: 39, 0x201C: 34,
    0x201D: 34, 0x2013: 45, 0x2014: 45, 0x2190: 95, 0x2191: 94,
}.items():
    cmap[code] = f'char{source}'

glyphs = {'.notdef': TTGlyphPen(None).glyph()}
for name in dict.fromkeys(cmap.values()):
    pen = TTGlyphPen(None)
    for y, bits in enumerate(chars[int(name[4:])]):
        # Merge adjacent pixels into horizontal runs to keep the font small.
        x = 0
        while x < 8:
            if not bits & (0x80 >> x):
                x += 1
                continue
            left = x
            while x < 8 and bits & (0x80 >> x):
                x += 1
            bottom = (7 - y) * 100
            pen.moveTo((left * 100, bottom))
            pen.lineTo((left * 100, bottom + 100))
            pen.lineTo((x * 100, bottom + 100))
            pen.lineTo((x * 100, bottom))
            pen.closePath()
    glyphs[name] = pen.glyph()

font = FontBuilder(800, isTTF=True)
font.setupGlyphOrder(list(glyphs))
font.setupCharacterMap(cmap)
font.setupGlyf(glyphs)
font.setupHorizontalMetrics({name: (800, getattr(glyph, 'xMin', 0)) for name, glyph in glyphs.items()})
font.setupHorizontalHeader(ascent=800, descent=0)
font.setupNameTable({
    'familyName': 'Green-Sky', 'styleName': 'Regular',
    'uniqueFontIdentifier': 'Green-Sky-Regular-1', 'fullName': 'Green-Sky Regular',
    'psName': 'Green-Sky-Regular', 'version': 'Version 1.0',
})
font.setupOS2(sTypoAscender=800, sTypoDescender=0, usWinAscent=800, usWinDescent=0)
font.setupPost(isFixedPitch=1)
# Stable timestamps make regeneration reproducible.
font.font['head'].created = font.font['head'].modified = 2082844800
font.font.recalcTimestamp = False
font.font.flavor = 'woff'
font.save(ROOT / 'assets/game-text.woff')
