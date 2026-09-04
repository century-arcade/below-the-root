#!/usr/bin/env python3
"""Generate docs/spec/data/{characters,items,skills}.json.

Reads the shipped disk-1 files in build/raw/ (regenerate them with
tools/g64.py) and pulls every number out of the real byte tables:

    game.bin     $8000-$B6FF   character records, class ranges, item
                               names, weights, usable/edible predicates
    gamelow.bin  $3400-$55FF   character-select text, skill names
    tooltab.bin  $C400-$C6FF   initial object table (room/col/flags)

Semantics that are not in a byte table -- which classes EAT accepts,
what each USE case does, what each skill costs -- are inline compares in
the handlers.  They live in the HAND_* dicts below and are listed in the
"hand_curated" field of each JSON, with the docs/ section they came from.

    python3 tools/spec_player.py [--out docs/spec/data]
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'build', 'raw')

GAME_BASE = 0x8000
GAMELOW_BASE = 0x3400

# ---------------------------------------------------------------- loading


class Image:
    def __init__(self, path, base):
        with open(path, 'rb') as f:
            self.data = f.read()
        self.base = base

    def __getitem__(self, addr):
        return self.data[addr - self.base]

    def bytes(self, addr, n):
        off = addr - self.base
        return self.data[off:off + n]

    def text(self, addr, n):
        return self.bytes(addr, n).decode('latin1')

    def inline_string(self, call_addr):
        """Decode the print_inline literal that follows `jsr print_inline`.

        Layout: 20 09 80, then a 2-byte screen address, then characters
        up to (not including) the first byte with bit 7 set.
        """
        off = call_addr - self.base
        assert self.data[off:off + 3] == b'\x20\x09\x80', hex(call_addr)
        p = off + 3
        screen = self.data[p] | (self.data[p + 1] << 8)
        p += 2
        out = []
        while not self.data[p] & 0x80:
            out.append(chr(self.data[p]))
            p += 1
        return screen, ''.join(out)


# ------------------------------------------------------- hand-curated bits

HAND_SOURCE = {
    'characters': 'docs/menus-and-saves.md "Per-character table"; '
                  'docs/player-physics.md "Leaping"',
    'items': 'docs/verbs-and-inventory.md "Verb by verb"',
    'skills': 'docs/menus-and-saves.md "Spirit gift and visions"; '
              'docs/verbs-and-inventory.md HEAL/GRUNSPREKE/KINIPORT',
}

# EAT accepts these classes ($B46B-$B47D, inline cmp chain, no table).
EDIBLE_CLASSES = {4, 5, 6, 10, 14}

# Per-class effects, read out of the handlers.  [src] is the routine.
CLASS_EFFECTS = {
    0: [{'verb': 'walk', 'src': '$9FB3',
         'effect': 'Carrying object 0 and walking onto a door tile ($BB) in '
                   'an underground room rings it: sfx 12, game paused, '
                   'message PM_BELL_RINGS.'}],
    1: [{'verb': 'carry', 'src': '$8C77',
         'effect': 'Carrying object 1 lights an underground room, exactly as '
                   'a lit honeylamp does.  It is never consumed.'}],
    2: [{'verb': 'USE', 'src': '$9098',
         'effect': 'Already lit -> PM_LAMP_ALREADY_LIT.  Else lamp_index := '
                   'this object, lamp_fuel := rnd&3 + 10 (10..13 room '
                   'changes), PM_LAMP_IS_LIT, screen re-blitted lit.'},
        {'verb': 'room change', 'src': '$964A',
         'effect': 'lamp_fuel -= 1; at 0 the object is destroyed and its '
                   'weight removed (the lamp burns out).'},
        {'verb': 'DROP', 'src': '$AF79',
         'effect': 'Dropping the lit lamp destroys it: PM_LAMP_VANISHES.'}],
    3: [{'verb': 'USE', 'src': '$933A',
         'effect': 'A creature within 2 columns / 1 row that is not already '
                   'frozen is frozen and moved off-room (sfx 1), and costs '
                   'spirit limit: -5 if the creature kind is 10 or below 6, '
                   'else -1 (floor 0); spirit energy := 0.  Then, creature or '
                   'not, cut bramble ($1C): PM_WAND_CUTS / PM_WAND_USELESS.  '
                   'The wand is never consumed.'}],
    4: [{'verb': 'EAT', 'src': '$B4AE',
         'effect': 'Herd (2) and Charn (4): PM_LAPAN_GOOD.  Everyone else: '
                   'PM_LAPAN_STRANGE and spirit energy -15 (floor 0).  Both '
                   'then take the +5 food bonus.'}],
    5: [{'verb': 'EAT', 'effect': 'PM_PAN_BREAD_GOOD, food +5.',
         'src': '$B50A'}],
    6: [{'verb': 'EAT', 'effect': 'PM_FRUIT_NUTS_GOOD, food +5.',
         'src': '$B52C'}],
    7: [{'verb': 'carry', 'src': '$A370',
         'effect': 'Carrying any shuba is what makes a mid-air glide '
                   'possible.  A knock-down rolls 1-in-16 to destroy one '
                   '(PM_SHUBA_TORN).'}],
    8: [{'verb': 'BUY', 'src': '$4194',
         'effect': 'One carried token is destroyed and the merchant grants '
                   'the TAKE permission for this room\'s offered class.'},
        {'verb': 'SELL', 'src': '$4234',
         'effect': 'A free slot in the token range is minted as '
                   'exists+carried; the sold object is destroyed.'}],
    9: [{'verb': 'USE', 'src': '$9143',
         'effect': 'Cuts bramble ($1C).  Nothing cut -> PM_BEAK_USELESS.  '
                   'Else 1-in-16 (rnd >= 240) destroys the beak '
                   '(PM_BEAK_BREAKS, sfx 7), otherwise PM_BEAK_CUTS.'}],
    10: [{'verb': 'EAT', 'src': '$B563',
          'effect': 'advance_time twice, PM_FEEL_STRANGE, spirit energy -15 '
                    '(floor 0).  No food bonus.'}],
    11: [{'verb': 'USE', 'src': '$91CE',
          'effect': 'Scan the row below the player in the facing direction '
                    'for the first non-empty cell.  Nothing before the room '
                    'edge -> PM_ROPE_USELESS.  Else fill that span with tile '
                    '$E0 (colour 8) and consume the rope.'}],
    12: [{'verb': 'USE', 'src': '$9272',
          'effect': 'Anywhere except room 74: removes tile $08 in front of / '
                    'above the player.  Success plays a random tune; nothing '
                    'removed -> PM_KEY_USELESS.  Never consumed.'}],
    13: [{'verb': 'USE', 'src': '$9272',
          'effect': 'Only in room 74: removes tile $08; then, facing right, '
                    'PM_ENTER_CHAMBER and a tune.  Never consumed.'},
         {'verb': 'TAKE', 'src': '$AD5D',
          'effect': 'Takeable anywhere once an NPC has revealed it.'}],
    14: [{'verb': 'EAT', 'src': '$B5A2',
          'effect': 'PM_MUCH_STRONGER.  stamina += 5; food = rest = '
                    'stamina/2; food_cap = rest_cap = stamina/2 + 1; carry '
                    'limit += 5.  Permanent: raises the leap arc too.'}],
}

CLASS_NOTES = {
    0: 'Exactly one exists in the world; the glide and bell tests index it '
       'by a literal object number.',
    1: 'Exactly one exists in the world.',
    8: 'The purse.  Everything trades for exactly one token in both '
       'directions; the free slots in the token range are the only place a '
       'sale can put money, so 75 tokens is the hard cap on wealth.',
    12: 'Exactly one exists in the world.',
    13: 'Exactly one exists in the world.',
}

# The six spirit skills, in the order gain_spirit_power announces them.
# limit / cost are the literal compares in the handlers.
SKILLS = [
    {'id': 0, 'key': 'pense_emotions', 'verb': 'PENSE', 'menu_cell': [0, 2],
     'spirit_limit': 5, 'energy_cost': 1, 'range': 'any distance in the room',
     'effect': 'Prints the emotion message the room block names for this '
               'NPC.  Erdlings (Herd, Charn) have this and not messages.',
     'src': '$407B'},
    {'id': 1, 'key': 'pense_messages', 'verb': 'PENSE', 'menu_cell': [0, 2],
     'spirit_limit': 10, 'energy_cost': 1,
     'range': 'adjacent, same test SPEAK uses',
     'effect': 'Prints the message the room block names for this NPC.  An '
               'NPC of type 1 also raises the spirit limit by 1 the first '
               'time; five of those trigger the next vision.',
     'src': '$418E'},
    {'id': 2, 'key': 'heal', 'verb': 'HEAL', 'menu_cell': [2, 2],
     'spirit_limit': 15, 'energy_cost': 5, 'range': 'self',
     'effect': 'food += 2 (capped at food_cap), rest += 2 (capped at '
               'rest_cap).  PM_HEAL_YOURSELF.',
     'src': '$84B5'},
    {'id': 3, 'key': 'grunspreke', 'verb': 'GRUNSPREKE', 'menu_cell': [3, 2],
     'spirit_limit': 20, 'energy_cost': 2,
     'range': 'the cell diagonally in front and one row down',
     'effect': 'Above ground only (tile set 0), floor must be a limb top '
               '($DF or $02-$06) and the target must not already be one.  '
               'Writes tile $DF there, colour 9.  PM_LIMB_GROWS.',
     'src': '$8510'},
    {'id': 4, 'key': 'kiniport_tools', 'verb': 'KINIPORT', 'menu_cell': [3, 3],
     'spirit_limit': 25, 'energy_cost': 5,
     'range': 'anywhere in the room, chosen with a joystick pointer',
     'effect': 'Move one object tile ($E1 and up) to any cell whose two '
               'halves are clear and whose floor has support.  Rewrites the '
               'object\'s column/row.',
     'src': '$85B8'},
    {'id': 5, 'key': 'kiniport_body', 'verb': 'KINIPORT', 'menu_cell': [3, 3],
     'spirit_limit': 30, 'energy_cost': 10,
     'range': 'anywhere in the room, chosen with a joystick pointer',
     'effect': 'Point at your own column on your own row, row-1 or row-2 to '
               'select your body, then pick a destination with support under '
               'it that is not a wall, bramble or object.  Teleports you.',
     'src': '$85B8'},
]

# ------------------------------------------------------------ table readers


def class_ranges(game):
    """$A7A0: 16 boundaries -> 15 class ranges over object numbers."""
    b = game.bytes(0xA7A0, 16)
    return [(b[i], b[i + 1] - 1) for i in range(15)]


def class_names(game):
    """$AFF7: 15 fixed-width 16-char names, indexed by $A780[class]."""
    ofs = game.bytes(0xA780, 15)
    return [game.text(0xAFF7 + o, 16).rstrip() for o in ofs]


def char_records(game):
    """$9CA9 via the end-offset table $9CA3: 14 bytes -> $0A63..$0A70."""
    ends = game.bytes(0x9CA3, 6)
    out = []
    for e in ends:
        out.append(list(game.bytes(0x9CA9 + e - 13, 14)))
    return out


def charsel_text(gamelow):
    """The name / description / trait lines of the character-select screen."""
    calls = [(0x34C0, 0x34CB, 0x34E8), (0x3518, 0x3523, 0x3542),
             (0x3573, 0x357E, 0x359D), (0x35CE, 0x35D9, 0x35F4),
             (0x3622, 0x362D, 0x3647)]
    out = []
    for name, desc, trait in calls:
        out.append(tuple(gamelow.inline_string(a)[1].rstrip() for a in
                         (name, desc, trait)))
    return out


def skill_names(gamelow):
    """$4022, six $FF-terminated names, offsets in $401A[2..7]."""
    ofs = gamelow.bytes(0x401A, 8)
    out = []
    for y in range(2, 8):
        p = 0x4022 + ofs[y]
        s = ''
        while gamelow[p] != 0xFF:
            s += chr(gamelow[p])
            p += 1
        out.append(s)
    return out


def initial_objects(tooltab):
    """$C400 room_lo / $C500 column / $C600 flags, 256 parallel entries."""
    d = tooltab.data
    out = []
    for i in range(256):
        flags = d[512 + i]
        out.append({
            'id': i,
            'room': d[i] | (0x100 if flags & 0x80 else 0),
            'col': d[256 + i],
            'row': flags & 0x1F,
            'exists': bool(flags & 0x40),
            'carried': bool(flags & 0x20),
        })
    return out


def leap_hover(stamina):
    """$A2E7: how many extra hover steps the arc gets."""
    return 3 if stamina >= 30 else 2 if stamina >= 20 else 1


# ------------------------------------------------------------------ builders

CHAR_NAMES = ['Neric', 'Genaa', 'Herd', 'Pomma', 'Charn']
CHAR_PEOPLE = ['Kindar', 'Kindar', 'Erdling', 'Kindar', 'Erdling']
REC_FIELDS = ['spirit_energy', 'food', 'rest', 'stamina', 'spirit_limit',
              'standing_kindar', 'standing_erdling', 'food_cap_plus1',
              'rest_cap_plus1', 'carry_limit', 'nid_room_lo', 'nid_room_hi',
              'nid_col', 'nid_row']


def build_characters(game, gamelow, objects, ranges, names):
    recs = char_records(game)
    text = charsel_text(gamelow)
    out = []
    for i in range(5):
        r = dict(zip(REC_FIELDS, recs[i]))
        room = r['nid_room_lo'] | (r['nid_room_hi'] << 8)
        start_items = [
            {'object': o['id'], 'class': class_of(o['id'], ranges),
             'name': names[class_of(o['id'], ranges)],
             'col': o['col'], 'row': o['row']}
            for o in objects
            if o['exists'] and o['room'] == room
        ]
        hover = leap_hover(r['stamina'])
        out.append({
            'id': i,
            'name': CHAR_NAMES[i],
            'people': CHAR_PEOPLE[i],
            'sprite_sheet': f'player{i}',
            'description': text[i][1],
            'traits': text[i][2],
            'start': {
                'day': 1,
                'time_of_day': 0,
                'spirit_energy': r['spirit_energy'],
                'spirit_limit': r['spirit_limit'],
                'food': r['food'],
                'food_cap': r['food_cap_plus1'] - 1,
                'rest': r['rest'],
                'rest_cap': r['rest_cap_plus1'] - 1,
                'stamina': r['stamina'],
                'carry_limit': r['carry_limit'],
                'carried_weight': 0,
                'fatigue_pool': 255,
                'standing_kindar': r['standing_kindar'],
                'standing_erdling': r['standing_erdling'],
            },
            'nid_place': {'room': room, 'col': r['nid_col'],
                          'row': r['nid_row']},
            'starting_inventory': [],
            'starting_items_in_nid_place': sorted(
                start_items, key=lambda o: o['object']),
            'skills_at_start': [s['key'] for s in SKILLS
                                if s['spirit_limit'] <= r['spirit_limit']],
            'physics': {
                'leap_hover_steps': hover,
                'leap_columns': hover + 3,
                'leap_step_dy': leap_arc(hover),
            },
            'src': f'$9CA9 record {i}; text $34C0-$3647; '
                   f'tooltab room {room}',
        })
    return out


def leap_arc(hover):
    """dy per arc step for a given hover count ($A2A3 table + $A259)."""
    return [-1, -1] + [0] * (hover - 1) + [1, 1]


def class_of(num, ranges):
    for i, (lo, hi) in enumerate(ranges):
        if lo <= num <= hi:
            return i
    return None


def build_items(game, gamelow, objects, ranges, names):
    weight = game.bytes(0xAE32, 15)
    usable = game.bytes(0x9077, 15)
    sellable = gamelow.bytes(0x4329, 15)
    counts = {}
    for o in objects:
        if o['exists']:
            c = class_of(o['id'], ranges)
            counts[c] = counts.get(c, 0) + 1
    out = []
    for c in range(15):
        lo, hi = ranges[c]
        verbs = ['EXAMINE', 'TAKE', 'DROP', 'OFFER', 'INVENTORY']
        if usable[c]:
            verbs.append('USE')
        if sellable[c]:
            verbs.append('SELL')
        if c in EDIBLE_CLASSES:
            verbs.append('EAT')
        out.append({
            'class': c,
            'name': names[c],
            'object_ids': [lo, hi],
            'slots': hi - lo + 1,
            'exists_at_start': counts.get(c, 0),
            'weight': weight[c],
            'usable': bool(usable[c]),
            'sellable': bool(sellable[c]),
            'edible': c in EDIBLE_CLASSES,
            'value_tokens': 1 if sellable[c] else None,
            'verbs': verbs,
            'effects': CLASS_EFFECTS.get(c, []),
            'notes': CLASS_NOTES.get(c),
            'src': f'$A7A0 range; name $AFF7+{c * 16}; weight $AE32+{c}; '
                   f'usable $9077+{c}; sellable $4329+{c}',
        })
    return out


def build_skills(gamelow, characters):
    disp = skill_names(gamelow)
    out = []
    for s in SKILLS:
        d = dict(s)
        d['display_name'] = disp[s['id']]
        d['granted_to_at_start'] = [
            c['name'] for c in characters
            if c['start']['spirit_limit'] >= s['spirit_limit']]
        out.append(d)
    return out


# ---------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'docs/spec/data'))
    args = ap.parse_args()

    game = Image(os.path.join(RAW, 'game.bin'), GAME_BASE)
    gamelow = Image(os.path.join(RAW, 'gamelow.bin'), GAMELOW_BASE)
    tooltab = Image(os.path.join(RAW, 'tooltab.bin'), 0xC400)

    ranges = class_ranges(game)
    names = class_names(game)
    objects = initial_objects(tooltab)

    characters = build_characters(game, gamelow, objects, ranges, names)
    items = build_items(game, gamelow, objects, ranges, names)
    skills = build_skills(gamelow, characters)

    docs = {
        'characters': {
            'generated_by': 'tools/spec_player.py',
            'spec': 'docs/spec/player.md',
            'hand_curated': ['people', 'physics.leap_columns',
                             'starting_inventory'],
            'hand_curated_source': HAND_SOURCE['characters'],
            'notes': [
                'Every character starts carrying nothing: no entry in the '
                'shipped object table has the carried bit set.  The items '
                'the manual calls "provided in your nid-place" are lying on '
                'the floor of that room and must be TAKEn.',
                'food_cap and rest_cap are stored as cap+1 and are always '
                'equal; nothing at run time tells them apart.',
                'carry_limit is always stamina + 26 and moves with stamina '
                'when a strange elixer raises it.',
            ],
            'characters': characters,
        },
        'items': {
            'generated_by': 'tools/spec_player.py',
            'spec': 'docs/spec/player.md',
            'hand_curated': ['edible', 'verbs', 'effects', 'notes'],
            'hand_curated_source': HAND_SOURCE['items'],
            'notes': [
                'The object number IS the class: 255 object slots are cut '
                'into 15 contiguous class ranges, and the class is the only '
                'thing any verb looks at.  Object 255 is the "no object" '
                'sentinel and belongs to no class.',
                'There is no price table.  Everything sellable is worth '
                'exactly one token and BUY costs exactly one token.',
                'Placement of the initial objects per room belongs to the '
                'world spec; only the id -> class mapping is here.',
            ],
            'classes': items,
        },
        'skills': {
            'generated_by': 'tools/spec_player.py',
            'spec': 'docs/spec/player.md',
            'hand_curated': ['energy_cost', 'range', 'effect', 'menu_cell'],
            'hand_curated_source': HAND_SOURCE['skills'],
            'notes': [
                'spirit_limit is the permanent skill level and gates "you '
                'lack the spirit skill"; spirit_energy is the pool that is '
                'spent and gates "you need more spirit energy".',
                'The limit rises only two ways: +5 from an NPC spirit gift '
                '(once per NPC), and +1 per new NPC pensed for a message.  '
                'Both go through the same congratulation/vision path, which '
                'names the skill at floor(limit/5)+1.',
                'The limit is announced in steps of 5, so a character can '
                'hold a skill without ever having seen its announcement '
                '(Pomma starts at 10 with both pense skills).',
            ],
            'skills': skills,
        },
    }

    os.makedirs(args.out, exist_ok=True)
    for name, blob in docs.items():
        path = os.path.join(args.out, f'{name}.json')
        with open(path, 'w') as f:
            json.dump(blob, f, indent=1, sort_keys=False)
            f.write('\n')
        print(path)



if __name__ == '__main__':
    main()
