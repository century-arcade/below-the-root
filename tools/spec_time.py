#!/usr/bin/env python3
"""Generate the docs/spec/data tables for the `time` area of the port spec.

    tools/spec_time.py [--bin build/dumps/loaded.bin] [--image build/btr2.d64]
                       [--out docs/spec/data]

Writes economy.json, quest.json, demo.json and save.json.  The clock, food,
rest, quest and save-format constants come from the disassembly and are
literals here with a `src` tag; everything list-shaped (items, merchants,
world stock, blessers, animals, demo scripts) is read out of the RAM dump and
disk image so it stays honest.  Prose and pseudocode: docs/spec/time.md.
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import objects as O                                     # noqa: E402
import room as R                                        # noqa: E402
import demo as D                                        # noqa: E402

FRAMES = {'ntsc': 59.826, 'pal': 50.125}

TIME_OF_DAY = ['EARLY MORNING', 'LATE MORNING', 'EARLY AFTERNOON',
               'LATE AFTERNOON', 'EARLY EVENING', 'LATE EVENING',
               'MIDNIGHT', 'LATE NIGHT']

EDIBLE = {4, 5, 6, 10, 14}          # $B46B-$B47D

CHARACTERS = ['neric', 'genaa', 'herd', 'pomma', 'charn', 'demo']

# $9CA9 through $9CA3, one record per character: $0A63-$0A70.
CHAR_STATS = 0x9CA9
CHAR_ENDS = 0x9CA3
CHAR_FIELDS = ['spirit_energy', 'food', 'rest', 'stamina', 'spirit_limit',
               'standing_kindar', 'standing_erdling', 'food_cap_plus1',
               'rest_cap_plus1', 'carry_limit', 'nid_room_lo', 'nid_room_hi',
               'nid_col', 'nid_row']


def rd(bin_path):
    return O.load_ram(bin_path)


# ---------------------------------------------------------------- economy

def item_table(game):
    tbl = O.class_table(game)
    counts = {}
    for o in O.objects(game):
        if o['exists']:
            counts[o['cls']] = counts.get(o['cls'], 0) + 1
    out = []
    for k in range(15):
        out.append({
            'item': k,
            'class': k,          # the player spec's items.json calls it `class`
            'name': O.item_name(game, k),
            'object_codes': [tbl[k], tbl[k + 1] - 1],
            'slots': tbl[k + 1] - tbl[k],
            'weight': game[O.ITEM_WEIGHT + k],
            'usable': bool(game[O.ITEM_USABLE + k]),
            'sellable': bool(game[O.ITEM_SELLABLE + k]),
            'edible': k in EDIBLE,
            'placed_in_world': counts.get(k, 0),
        })
    return out


def merchants(game, image):
    msg = O.messages(game)

    def m(n):
        return msg[n - 1] if n else None

    out = []
    for n, b in O.npcs(image=image):
        if b[17] != 0x80:
            continue
        out.append({
            'room': n,
            'npc_id': b[16],
            'species': b[0] >> 4,
            'stock_item': b[15],
            'stock_item_name': O.item_name(game, b[15]),
            'gate': {'standing': ['kindar', 'erdling'][b[1] & 0x0F],
                     'min_level': b[1] >> 4},
            'speak_lines': [x for x in (m(b[7]), m(b[8])) if x],
            'pense_emotion': m(b[9]),
            'pense_message': m(b[10]),
        })
    return sorted(out, key=lambda e: e['room'])


def economy(game, image):
    items = item_table(game)
    tok = items[8]
    return {
        'generated_by': 'tools/spec_time.py',
        'area': 'time',
        'money': {
            'unit': 'token',
            'item': 8,
            'representation': 'tokens are ordinary world objects of item class '
                              '8; there is no separate money counter',
            'object_code_range': tok['object_codes'],
            'total_slots': tok['slots'],
            'placed_at_quest_start': tok['placed_in_world'],
            'free_slots_at_quest_start': tok['slots'] - tok['placed_in_world'],
            'purse': 'the tokens you carry are the slots in the token range '
                     'whose carried bit is set',
            'hard_cap': 'no more than total_slots tokens can exist anywhere in '
                        'the world at once, carried or on the ground',
            'weight': tok['weight'],
            'src': '$4194 $4234 $A7A0'
        },
        'prices': {
            'buy': 1, 'sell': 1,
            'per_item': False,
            'per_merchant': False,
            'note': 'there is no price table: every purchase costs exactly one '
                    'token and every sale pays exactly one token, whatever the '
                    'item and whatever the merchant',
            'src': '$4194 $4234'
        },
        'buy': {
            'requires_merchant': True,
            'requires_adjacent': True,
            'cost': 1,
            'weight_reserved': 4,
            'grants': 'take_permission for the merchant stock item only; BUY '
                      'hands over nothing, TAKE does',
            'messages': {
                'no_merchant': 'THERE IS NO MERCHANT HERE',
                'no_money': 'YOU NEED MORE TOKENS',
                'too_heavy': "SORRY, YOU'RE CARRYING TOO MUCH",
                'ok': 'TAKE WHICHEVER ONE PLEASES YOU'},
            'src': '$4194'
        },
        'sell': {
            'requires_merchant': True,
            'requires_adjacent': True,
            'pays': 1,
            'sellable_items': [i['item'] for i in items if i['sellable']],
            'needs_free_token_slot': True,
            'weight_delta': 'minus the sold item\'s weight, plus 1 for the token',
            'messages': {
                'prompt': 'WHAT WILL YOU SELL?',
                'no_room': "SORRY, I'M NOT INTERESTED",
                'ok': "HERE'S YOUR TOKEN"},
            'src': '$4234 $4329'
        },
        'carrying': {
            'carry_limit_start': 'stamina + 26',
            'take_refused_when': 'carried_weight + item_weight >= carry_limit',
            'buy_refused_when': 'carried_weight + 4 >= carry_limit',
            'src': '$ADBC $41CC $B5D6'
        },
        'items': items,
        'merchants': merchants(game, image),
        'other_token_sinks': [
            {'what': 'OFFER a token to the room 32 gate guard',
             'effect': 'the token is destroyed, the door opens for this visit '
                       'only', 'src': '$44C3'},
            {'what': 'REST in a room whose creature kind is the token thief',
             'effect': 'every carried token is destroyed', 'src': '$AAAB'},
        ],
    }


# ------------------------------------------------------------------ quest


VISIONS = [
    'THE BODY OF RAAMO, THE SPIRIT BLESSED, SINKS DEEP BENEATH THE SURFACE OF '
    'THE BOTTOMLESS LAKE.',
    'ALL OF GREEN-SKY MOURN FOR RAAMO, THEIR LOST SPIRIT-LEADER.',
    'RAAMO, THE LOST SON, RISES TO REUNITE THE ERDLINGS AND KINDAR OF GREEN-SKY.',
    "A BODY WASHES UP FROM THE BOTTOMLESS LAKE. THE BOY APPEARS DEAD BUT YOU "
    "CAN'T BE SURE...",
    'ON A NARROW ROCK LEDGE RAAMO LIVES, TRAPPED IN THE CAVERNS DEEP BELOW THE '
    'ROOT.',
]

SKILLS = [
    {'spirit_limit': 5, 'skill': 'PENSE EMOTIONS'},
    {'spirit_limit': 10, 'skill': 'PENSE MESSAGES'},
    {'spirit_limit': 15, 'skill': 'HEAL YOURSELF'},
    {'spirit_limit': 20, 'skill': 'GRUNSPREKE'},
    {'spirit_limit': 25, 'skill': 'KINIPORT TOOLS'},
    {'spirit_limit': 30, 'skill': 'KINIPORT YOUR BODY'},
]

FLAGS = [
    {'name': 'quest_active', 'src': '$D7', 'saved': True, 'width': 1,
     'set_by': 'starting a quest from character select',
     'cleared_by': 'SAMPLE QUEST, the MENU cell, winning, running out of time',
     'read_by': 'CONTINUE and DISK STORAGE SAVE both refuse when it is clear'},
    {'name': 'vision_count', 'src': '$DC', 'saved': True, 'width': 1,
     'range': [0, 5],
     'set_by': 'one per gain_spirit_power that still has a vision left',
     'cleared_by': 'starting a quest'},
    {'name': 'pense_message_count', 'src': '$DD', 'saved': True, 'width': 1,
     'range': [0, 5],
     'set_by': 'PENSE MESSAGES on an animal, once each',
     'note': 'reaching 5 runs the congratulation/vision path once'},
    {'name': 'wissenberries_offered', 'src': '$D0', 'saved': True, 'width': 1,
     'set_by': 'OFFER wissenberries to the room 352 gate guard',
     'note': 'the second offering permanently unlocks that gate'},
    {'name': 'gate_352_open', 'src': '$2334', 'saved': True, 'width': 1,
     'note': 'the banished-flags entry for gate guard id $34; permanent'},
    {'name': 'gate_32_open', 'src': '$2335', 'saved': True, 'width': 1,
     'note': 'never written by any code -- the room 32 gate must be paid for '
             'with a token on every visit'},
    {'name': 'door_permission', 'src': '$CD', 'saved': True, 'width': 1,
     'note': 'one-shot gate override, cleared on every room load'},
    {'name': 'take_permission', 'src': '$CC', 'saved': True, 'width': 1,
     'note': 'set by SPEAK to a gift-giver and by BUY, cleared on every room '
             'load and by a successful TAKE'},
    {'name': 'falla_key_revealed', 'src': '$CE', 'saved': True, 'width': 1,
     'set_by': "SPEAK to D'ol Falla (room 71)",
     'note': "without it TAKE refuses D'ol Falla's key"},
    {'name': 'dream_state', 'src': '$C8', 'saved': True, 'width': 1,
     'values': {'0': 'normal', '1': 'rested in the sky nid, next door leads out',
                '255': 'in the cloud world, next door leads back'},
     'note': 'freezes the clock and the fatigue drain and blocks RENEW'},
    {'name': 'lamp_index', 'src': '$CA', 'saved': True, 'width': 1,
     'note': 'object number of the lit honeylamp, 0 = none'},
    {'name': 'lamp_fuel', 'src': '$CB', 'saved': True, 'width': 1,
     'note': 'room changes of light left in the lit honeylamp'},
    {'name': 'fatigue', 'src': '$C5', 'saved': True, 'width': 1,
     'note': 'down-counter, $FF at quest start; one lap costs one food and one rest'},
    {'name': 'fatigue_cause', 'src': '$C4', 'saved': True, 'width': 1,
     'values': {'0': 'none', '1': 'out of food', '2': 'out of rest'}},
    {'name': 'quest_time_up', 'src': '$DE', 'saved': True, 'width': 1,
     'set_by': 'the clock reaching day 51'},
    {'name': 'spirit_bell_rang', 'src': '$DF', 'saved': True, 'width': 1,
     'set_by': 'standing on a doorway tile underground while carrying the bell'},
    {'name': 'creature_banished', 'src': '$2300 + npc_id', 'saved': True,
     'width': 128, 'note': 'bit 7 set by the wand of Befal; the creature never '
     'spawns again and its REST event and key unlock go dead'},
    {'name': 'creature_day_stamp', 'src': '$2380 + npc_id', 'saved': True,
     'width': 128,
     'note': 'bits 0-6 = the day this creature was last spoken to (COME BACK '
             'TOMORROW while it equals today); bit 7 = its once-per-quest '
             'spirit gift is spent.  For ambushers bits 0-4 instead hold the '
             'time-of-day slot they settled in'},
]


def quest(game, image):
    msg = O.messages(game)

    def m(n):
        return msg[n - 1] if n else None

    blessers, animals, gates, raamo = [], [], [], None
    for n, b in O.npcs(image=image):
        rec = {'room': n, 'npc_id': b[16], 'species': b[0] >> 4,
               'speak_lines': [x for x in (m(b[7]), m(b[8])) if x],
               'pense_emotion': m(b[9]), 'pense_message': m(b[10])}
        if b[17] == 0x40:
            rec['grants'] = 'spirit_limit += 5, once per quest'
            blessers.append(rec)
        elif b[17] == 0x01:
            rec['grants'] = 'spirit_limit += 1 on PENSE MESSAGES, once per quest'
            animals.append(rec)
        elif b[17] in (0xC0, 0xC1):
            rec['gate'] = 'permanent flag gate_352_open' if b[17] == 0xC0 \
                else 'permanent flag gate_32_open (set only by the wand of Befal on the guard)'
            gates.append(rec)
        elif b[17] == 0xF0:
            raamo = rec
    for lst in (blessers, animals, gates):
        lst.sort(key=lambda e: e['room'])

    return {
        'generated_by': 'tools/spec_time.py',
        'area': 'time',
        'clock': {
            'frames_per_prescaler_wrap': 256,
            'prescaler_wraps_per_time_slot': 0x23,
            'frames_per_time_slot': 256 * 0x23,
            'time_slots_per_day': 8,
            'time_of_day_names': TIME_OF_DAY,
            'seconds_per_time_slot': {k: round(256 * 0x23 / v, 1)
                                      for k, v in FRAMES.items()},
            'seconds_per_day': {k: round(8 * 256 * 0x23 / v, 1)
                                for k, v in FRAMES.items()},
            'runs_only_while': 'the game loop is running (not in menus, verbs, '
                               'text prompts or the dream state)',
            'src': '$B26F $B287'
        },
        'start': {
            'day': 1, 'time_of_day': 0, 'fatigue': 255,
            'per_character': 'docs/spec/data/characters.json; the attract-demo record is demo.json demo_character',
            'src': '$9C6E $9CA9 $975C'
        },
        'spirit_skills': SKILLS,
        'visions': [{'index': i, 'text': t} for i, t in enumerate(VISIONS)],
        'vision_triggers': {
            'blessers': 'each of the five +5 blessers, first SPEAK only',
            'animals': 'the fifth distinct animal PENSE MESSAGES',
            'cap': 'only five visions exist; the sixth trigger prints the '
                   'congratulation but no vision',
            'src': '$3DA9 $3E13 $418E'
        },
        'blessers': blessers,
        'animals': animals,
        'gates': gates,
        'goal_npc': raamo,
        'win_condition': {
            'who': 'the creature whose state index is $49 -- Raamo, and he is '
                   'the only creature in the world with it',
            'room': raamo['room'] if raamo else None,
            'verb': 'OFFER',
            'accepts_items': [7, 11],
            'accepts_item_names': [O.item_name(game, 7), O.item_name(game, 11)],
            'wrong_item': "THAT WON'T HELP",
            'src': '$43CC $4475 $449C'
        },
        'ending_win': {
            'text': ['I AM RAAMO, THE SPIRIT GIFTED.',
                     'YOU HAVE SAVED MY LIFE AND FULFILLED THE PROPHESY.  THE '
                     'QUEST IS COMPLETE.  GREEN-SKY IS SAVED.',
                     'YOU HAVE FINISHED THE QUEST IN nn DAYS. YOU ARE A'],
            'music': [0, 2],
            'score': 'the day counter and nothing else',
            'ranks': [{'max_day': 14, 'rank': 'MASTER QUESTER.'},
                      {'min_day': 15, 'max_day': 29,
                       'rank': 'HIGHLY GIFTED QUESTER.'},
                      {'min_day': 30, 'rank': 'GIFTED QUESTER.'}],
            'after': 'quest_active cleared, back to the main menu; nothing is '
                     'written to disk',
            'src': '$9E17'
        },
        'ending_timeout': {
            'day': 0x33,
            'text': ['THE LIGHT FADES INTO DARKNESS...',
                     'THE TIME FOR YOUR QUEST HAS ENDED.',
                     'GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER.'],
            'music': [0],
            'after': 'quest_active cleared, back to the main menu',
            'src': '$B299 $8E76'
        },
        'flags': FLAGS,
        'milestones': MILESTONES,
    }


# Ordered walkthrough milestones, cross-checked against iso/spoilers/walkthru.txt.
MILESTONES = [
    {'n': 1, 'what': 'Choose a character and pick up the shuba, the one food '
     'item and the three tokens lying in your own nid place.',
     'walkthru': 'STARTING THE GAME', 'verified': 'object table: every nid room '
     'holds one shuba, one food item and three tokens'},
    {'n': 2, 'what': 'Explore, SPEAK and PENSE widely; note which houses offer '
     'food or a nid, and where the shops are.',
     'walkthru': 'STARTING THE GAME', 'verified': 'gift-givers reset once per '
     'game day (creature_day_stamp)'},
    {'n': 3, 'what': 'Buy a trencher beak in the Broad Grund and cut your way '
     'to the Hermit at the top of the Grand Grund.  SPEAK: +5 spirit, vision 0.',
     'walkthru': 'GAINING SPIRIT AND MESSAGES / HERMIT',
     'verified': 'room 41, creature kind $40; room 38 sells trencher beaks'},
    {'n': 4, 'what': 'Reach the Child in the Garden in the small nid place on '
     'the right of the Garden Grund.  SPEAK: +5 spirit, vision 1.',
     'walkthru': 'CHILD IN THE GARDEN',
     'verified': 'room 19, creature kind $40, species 4 (a child)'},
    {'n': 5, 'what': 'Take a vine rope to the highest nid place in the Sky '
     'Grund, use it across a gap and CRAWL over.  REST in that nid; the next '
     'doorway puts you in the cloud world.',
     'walkthru': 'GIVER OF THE SPIRIT BELL',
     'verified': 'REST in room 9 sets dream_state; the next door leads to room '
                 '190 and back'},
    {'n': 6, 'what': "Walk up the clouds to D'ol Neshom.  SPEAK: +5 spirit, "
     'vision 2, and she offers the spirit bell -- TAKE it in room 191.  Leave '
     'by entering and leaving the nid place again.',
     'walkthru': 'GIVER OF THE SPIRIT BELL',
     'verified': 'room 191 creature kind $40, gift item 0 (A SPIRIT BELL); the '
                 'only spirit bell in the world is in room 191'},
    {'n': 7, 'what': 'Gather wissenberries, a token and as many honeylamps as '
     'you can carry.  Get to the surface below the Sky Grund.',
     'walkthru': 'VATAR', 'verified': 'rooms 46 and 39 sell wissenberries and '
                                      'honeylamps'},
    {'n': 8, 'what': 'OFFER wissenberries to the outer gate guard twice -- the '
     'second offering unlocks that gate for good.  OFFER a token to the inner '
     'guard, which opens his door for this visit only.',
     'walkthru': 'VATAR',
     'verified': 'room 352 guard sets gate_352_open on the second berry; room '
                 '32 guard only ever sets the one-visit override'},
    {'n': 9, 'what': 'USE a honeylamp and work right and down through the '
     'caverns to Vatar.  SPEAK: +5 spirit, vision 3.',
     'walkthru': 'VATAR', 'verified': 'room 492, creature kind $40'},
    {'n': 10, 'what': 'PENSE MESSAGES with five distinct animals.  The fifth '
     'gives the congratulation and vision 4.',
     'walkthru': 'GAINING SPIRIT AND MESSAGES',
     'verified': 'ten animals exist, creature kind $01'},
    {'n': 11, 'what': "SPEAK to Raamo's Mother in the Temple Grund for the "
     'clue about the spirit lamp (in code this is a fifth +5 blesser).',
     'walkthru': 'TEMPLE GRUND', 'verified': 'room 116, creature kind $40'},
    {'n': 12, 'what': 'Get the temple key (hidden hole in the leftmost temple '
     "Grund) and, after speaking to D'ol Falla, D'ol Falla's key.  The second "
     'opens the forgotten chamber and the spirit lamp inside it.',
     'walkthru': 'TEMPLE GRUND',
     'verified': "room 71 creature kind $D0 sets falla_key_revealed; the only "
                 "spirit lamp is in room 75"},
    {'n': 13, 'what': 'Raise the spirit limit to 30 so you can kiniport your '
     'body; buy a spare shuba.',
     'walkthru': 'HOW TO WIN', 'verified': 'skill thresholds at $401A/$4022; '
                                           'room 64 sells shubas'},
    {'n': 14, 'what': 'Go below the root with the spirit lamp (or a lit '
     'honeylamp) and the spirit bell, find Raamo near the Bottomless Lake, and '
     'OFFER him a shuba (a vine rope also works).',
     'walkthru': 'HOW TO WIN',
     'verified': 'OFFER to state index $49 accepts item 7 or item 11'},
]


# ------------------------------------------------------------------- demo

OPCODES = [
    {'byte': [0x00, 0x7F], 'op': 'tap', 'operands': [],
     'effect': 'return this joystick value for exactly one step'},
    {'byte': [0x80, 0xBF], 'op': 'hold', 'operands': ['steps'],
     'effect': 'return this joystick value for `steps` steps'},
    {'byte': [0xC6, 0xFE], 'op': 'hold', 'operands': ['steps'],
     'effect': 'same as $80-$BF; the opcode band is split by the $C0-$C5 cases'},
    {'byte': [0xC0, 0xC0], 'op': 'music', 'operands': ['tune'],
     'effect': 'start tune `tune`, then decode the next opcode in the same call'},
    {'byte': [0xC1, 0xC1], 'op': 'delay', 'operands': [],
     'effect': 'one busy-wait of about two thirds of a second, then one idle step'},
    {'byte': [0xC2, 0xC2], 'op': 'delay', 'operands': ['units'],
     'effect': '`units` such busy-waits, then one idle step'},
    {'byte': [0xC3, 0xC3], 'op': 'goto_room', 'operands': ['room'],
     'effect': 'end the script: hand `room` to the outer loop, stop the game '
               'loop, return one idle step.  The pointer is deliberately left '
               'on the operand'},
    {'byte': [0xC4, 0xC4], 'op': 'text_page', 'operands': ['page'],
     'effect': 'ask the outer loop to print intro text page `page`, stop the '
               'game loop, return one idle step'},
    {'byte': [0xC5, 0xC5], 'op': 'end_rest_delay', 'operands': [],
     'effect': 'force the REST bell delay currently running to finish on its '
               'next iteration, then one idle step'},
    {'byte': [0xFF, 0xFF], 'op': 'end_demo', 'operands': [],
     'effect': 'clear the demo flag and return "no input"; neither script uses it'},
]

TEXT_PAGES = {
    1: ['WINDHAM CLASSICS', 'COPYRIGHT (C) 1984', 'ALL RIGHTS RESERVED'],
    2: ['CHOOSE TO BE ERDLING OR KINDAR, MALE OR FEMALE, CHILD OR ADULT.  SET '
        'FORTH TO SOLVE THE RIDDLE OF THE PROPHESY AND SAVE GREEN-SKY FROM '
        'DESTRUCTION.'],
    3: ['SEEK EVERYWHERE, FROM THE THIN FRONDS OF THE HIGHEST GRUND TO THE '
        'DEEPEST CAVERN BELOW THE ROOT.  BEWARE THE NEKOM AND SALITE.'],
    4: ['TO DO THIS YOU MUST GROW STRONG IN SPIRIT AND SKILL.  ONLY THEN CAN '
        'YOU SAVE GREEN-SKY.'],
    5: ['(clears the text rows)'],
}


def demo(bin_path):
    scripts = []
    mem = open(bin_path, 'rb').read()[2:]
    for s in D.SCRIPTS:
        steps, end = D.decode(mem, s['addr'])
        for st in steps:
            if st['op'] == 'set_84_85':
                st['op'] = 'end_rest_delay'
            if st['op'] == 'text_page':
                st['lines'] = TEXT_PAGES.get(st['page'], TEXT_PAGES[4])
        scripts.append({
            'name': s['name'],
            'room': s['room'],
            'indoors': s['name'] == 'intro',
            'start_col': s['start_col'],
            'start_row': s['start_row'],
            'facing': 'left',
            'crawling': s['name'] == 'intro',
            'bytes': end - s['addr'] + 1,
            'steps': [{k: v for k, v in st.items() if k != 'at'}
                      for st in steps],
            'src': '$%04X (setup $%04X)' % (s['addr'], s['setup']),
        })
    return {
        'generated_by': 'tools/spec_time.py',
        'area': 'time',
        'player': {
            'replaces': 'the joystick read, while the demo flag is set',
            'value_shape': 'one byte shaped like the joystick port: bit 0 up, '
                           '1 down, 2 left, 3 right, 4 fire, all active low.  '
                           'Bits 5-7 are never tested, which is what leaves '
                           'room for the two-byte opcodes',
            'idle_value': 0x1F,
            'step': 'one input read by the player state machine, i.e. one pass '
                    'of the state step, which runs every step_period frames '
                    '(8 walking, 6 leaping, 15 knocked down)',
            'countdown': 'each read decrements the step counter; while it is '
                         'non-zero the held value is returned unchanged',
            'abort': 'the real fire button is polled first; pressing it stops '
                     'the game loop and asks for the main menu.  The keyboard '
                     'is never polled',
            'src': '$3000'
        },
        'opcodes': OPCODES,
        'text_pages': TEXT_PAGES,
        'attract_flow': {
            'cold_boot': 'attract state 0 -> run the intro script once, then '
                         'fall into the main menu',
            'sample_quest': 'attract state $FF -> the two scripts chase each '
                            "other's goto_room forever until fire is pressed",
            'goto_room_157': 'run the intro script again',
            'goto_room_other': 'main menu if the attract state is 1, else run '
                               'the quest script',
            'src': '$952B $93C0'
        },
        'demo_character': {
            'character_slot': 5,
            'extras': 'a shuba is placed in the first shuba slot, marked '
                      'carried',
            'take_rule': 'TAKE skips the "IT WAS NOT OFFERED TO YOU" check',
            'src': '$9C6E $AD6D'
        },
        'scripts': scripts,
    }


# ------------------------------------------------------------------- save

SAVE_ZP = [
    (0x86, 1, 'room_lo', 'current room, low byte'),
    (0x87, 1, 'room_hi', 'current room, high bit'),
    (0xC2, 1, 'kiniport_index', 'scratch; not meaningful across a save'),
    (0xC4, 1, 'fatigue_cause', '0 none, 1 out of food, 2 out of rest'),
    (0xC5, 1, 'fatigue', 'down-counter; one lap costs one food and one rest'),
    (0xC8, 1, 'dream_state', '0 normal, 1 rested in the sky nid, 255 in the clouds'),
    (0xCA, 1, 'lamp_index', 'object number of the lit honeylamp, 0 = none'),
    (0xCB, 1, 'lamp_fuel', 'room changes of light left'),
    (0xCC, 1, 'take_permission', 'an item was offered; cleared on room load'),
    (0xCD, 1, 'door_permission', 'a gate was paid for; cleared on room load'),
    (0xCE, 1, 'falla_key_revealed', "D'ol Falla's key may be taken"),
    (0xD0, 1, 'wissenberries_offered', 'count offered to the room 352 guard'),
    (0xD1, 1, 'creature_hit', 'pending ambush effect; normally 0'),
    (0xD3, 1, 'saved_room_lo', 'room to return to; SAVE copies it into room_lo first'),
    (0xD4, 1, 'saved_room_hi', 'room high bit to return to'),
    (0xD5, 1, 'character', 'selected character 0-4'),
    (0xD6, 1, 'menu_item', 'main-menu highlight; not quest state'),
    (0xD7, 1, 'quest_active', 'a quest is in progress'),
    (0xD8, 1, 'attract_state', 'attract/menu state; not quest state'),
    (0xDA, 1, 'storage_item', 'DISK STORAGE highlight; not quest state'),
    (0xDB, 1, 'quest_slot', 'save slot 0-4; not quest state'),
    (0xDC, 1, 'vision_count', 'visions already shown, 0-5'),
    (0xDD, 1, 'pense_message_count', 'animals pensed, 0-5'),
    (0xDE, 1, 'quest_time_up', 'the day-51 timeout fired'),
    (0xDF, 1, 'spirit_bell_rang', 'the bell is ringing in this cell'),
]

SAVE_VARS = [
    (0x0A0E, 1, 'indoor_flag', '1 indoors, 0 outdoors'),
    (0x0A10, 1, 'player_col', 'player column 0-39'),
    (0x0A18, 1, 'player_row', 'player row 0-19'),
    (0x0A37, 1, 'facing', '1 right, 255 left'),
    (0x0A3D, 1, 'crawling', 'crawl pose'),
    (0x0A48, 1, 'tileset', 'tile set of the current room'),
    (0x0A60, 1, 'loaded_player', 'which character sprite file is in memory; '
     'LOAD deliberately restores the pre-load value instead of the saved one'),
    (0x0A61, 1, 'time_of_day', '0-7'),
    (0x0A62, 1, 'day', '1-based; 51 ends the quest'),
    (0x0A63, 1, 'spirit_energy', 'current spirit energy'),
    (0x0A64, 1, 'food', 'level of food'),
    (0x0A65, 1, 'rest', 'level of rest'),
    (0x0A66, 1, 'stamina', 'stamina'),
    (0x0A67, 1, 'spirit_limit', 'spirit limit; also the skill gate'),
    (0x0A68, 1, 'standing_kindar', 'standing with the Kindar, 0-5'),
    (0x0A69, 1, 'standing_erdling', 'standing with the Erdlings, 0-5'),
    (0x0A6A, 1, 'food_cap_plus1', 'food is capped at this minus 1'),
    (0x0A6B, 1, 'rest_cap_plus1', 'rest is capped at this minus 1'),
    (0x0A6C, 1, 'carry_limit', 'weight limit'),
    (0x0A6D, 1, 'nid_room_lo', 'home nid place, room low byte'),
    (0x0A6E, 1, 'nid_room_hi', 'home nid place, room high bit'),
    (0x0A6F, 1, 'nid_col', 'home nid column'),
    (0x0A70, 1, 'nid_row', 'home nid row'),
    (0x0A78, 1, 'clock_prescale', 'frame prescaler; free-running'),
    (0x0A79, 1, 'clock_period', 'prescaler wraps left in this time slot'),
    (0x0A7A, 1, 'carried_weight', 'total weight carried'),
    (0x0A95, 1, 'music_on', 'music playing; not quest state'),
]


def save():
    return {
        'generated_by': 'tools/spec_time.py',
        'area': 'time',
        'file': {
            'device': 'disk drive 8, secondary address 255 -- an ordinary PRG '
                      'save through the KERNAL, not the game\'s own block I/O',
            'save_name': '0:QUESTn', 'load_name': 'QUESTn',
            'scratch_before_save': 'S0:QUESTn on the command channel, wrapped '
                                   'in I0 initialise commands',
            'slots': 5, 'slot_digit': 'n = 1..5, the selected slot + 1',
            'load_address': 0x2000,
            'payload_bytes': 0x580,
            'file_bytes': 0x582,
            'note': 'the two-byte little-endian load address comes first, then '
                    'the payload; the game saves the range $2000-$257F',
            'src': '$3968 $39C6'
        },
        'regions': [
            {'offset': 0, 'size': 2, 'name': 'load_address',
             'value': 0x2000, 'meaning': 'PRG header, little endian'},
            {'offset': 2, 'size': 256, 'name': 'object_room_lo',
             'meaning': 'for each of the 256 object numbers, the low byte of '
                        'the room it is in'},
            {'offset': 258, 'size': 256, 'name': 'object_col',
             'meaning': 'screen column of each object'},
            {'offset': 514, 'size': 256, 'name': 'object_flags',
             'meaning': 'bits 0-4 screen row, bit 5 carried by the player, '
                        'bit 6 the object exists, bit 7 the high bit of its '
                        'room number.  A flags byte of 0 is a free slot',
             'bits': {'row': [0, 4], 'carried': 5, 'exists': 6, 'room_hi': 7}},
            {'offset': 770, 'size': 128, 'name': 'creature_banished',
             'meaning': 'indexed by creature id 1-127; bit 7 = banished by the '
                        'wand of Befal.  Entries $34 and $35 double as the two '
                        'permanent gate flags'},
            {'offset': 898, 'size': 128, 'name': 'creature_day_stamp',
             'meaning': 'indexed by creature id 1-127; bits 0-6 = day last '
                        'spoken to, bit 7 = spirit gift spent.  For ambushers '
                        'bits 0-4 are the time-of-day slot they settled in'},
            {'offset': 1026, 'size': 256, 'name': 'variables',
             'meaning': 'a copy of the $0A00 variable page; the fields that '
                        'matter are listed under `variables`.  Everything else '
                        'is per-frame scratch and is overwritten before it is '
                        'read'},
            {'offset': 1282, 'size': 128, 'name': 'zero_page',
             'meaning': 'a copy of zero page $80-$FF; the fields that matter '
                        'are listed under `zero_page`'},
        ],
        'variables': [{'offset': 1026 + (a - 0x0A00), 'addr': '$%04X' % a,
                       'size': n, 'name': nm, 'meaning': d}
                      for a, n, nm, d in SAVE_VARS],
        'zero_page': [{'offset': 1282 + (a - 0x80), 'addr': '$%02X' % a,
                       'size': n, 'name': nm, 'meaning': d}
                      for a, n, nm, d in SAVE_ZP],
        'flow': {
            'save': ['room_lo/room_hi <- saved_room_lo/saved_room_hi so the '
                     'room the player left is what gets written',
                     'copy the live object table into the buffer',
                     'copy the live variable page into the buffer',
                     'copy zero page $80-$FF into the buffer',
                     'the creature flag arrays already live inside the range, '
                     'so nothing is copied for them',
                     'scratch the old file, then write the whole range'],
            'load': ['stash which character sprite file is in memory, because '
                     'the variable page is about to be overwritten',
                     'load the file at its own address',
                     'copy the three regions back into the live locations',
                     'restore the stashed sprite-file id',
                     'return to the main menu; CONTINUE then reloads the '
                     'character file if the saved character differs'],
            'src': '$3968 $39C6'
        },
        'not_saved': [
            'the room block itself -- it is re-read from the data disk',
            'anything about the world layout; only object placement moves',
            'the character sprite file, which is reloaded by name',
            'the score: nothing is written on either ending',
        ],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default=os.path.join(ROOT, 'build/dumps/loaded.bin'))
    ap.add_argument('--image', default=R.D64)
    ap.add_argument('--out', default=os.path.join(ROOT, 'docs/spec/data'))
    a = ap.parse_args()
    game = rd(a.bin)
    os.makedirs(a.out, exist_ok=True)
    tables = {'economy': economy(game, a.image),
              'quest': quest(game, a.image),
              'demo': demo(a.bin),
              'save': save()}
    for name, data in tables.items():
        path = os.path.join(a.out, name + '.json')
        with open(path, 'w') as f:
            json.dump(data, f, indent=1)
            f.write('\n')
        print('wrote %s' % path)


if __name__ == '__main__':
    main()
