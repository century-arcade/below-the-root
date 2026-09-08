#!/usr/bin/env python3
"""Cross-check docs/spec/data/*.json against each other.

Exit status is the number of failed checks; every failure prints one line.
"""
import json
import os
import sys

from common import ROOT
DATA = os.path.join(ROOT, 'docs/spec/data')

fails = 0


def load(name):
    with open(os.path.join(DATA, name + '.json')) as f:
        return json.load(f)


def check(ok, msg):
    global fails
    if not ok:
        fails += 1
        print('FAIL', msg)


def main():
    rooms = load('rooms')['rooms']
    by_room = {r['room']: r for r in rooms}
    tiles = {t['code']: t for t in load('tiles')['tiles']}
    creatures = load('creatures')
    messages = load('messages')
    items = load('items')['classes']
    economy = load('economy')
    chars = load('characters')['characters']
    quest = load('quest')
    assets = load('assets')
    skills = load('skills')['skills']
    demo = load('demo')

    # rooms: doors, exits, objects, tiles
    for r in rooms:
        for d in r['doors']:
            if d is None or d['to_room'] is None:
                continue
            check(d['to_room'] in by_room,
                  f"room {r['room']} door {d['door']} -> missing room {d['to_room']}")
            check(0 <= d['arrive_x'] < 40 and 0 <= d['arrive_y'] < 20,
                  f"room {r['room']} door {d['door']} arrival off-screen")
        for side, n in r['exits'].items():
            if n is not None:
                check(n in by_room or side in r['exits_missing'],
                      f"room {r['room']} exit {side} -> missing room {n}")
        for o in r['objects']:
            check(any(c['class'] == o['class'] for c in items),
                  f"room {r['room']} object {o['object']} unknown class {o['class']}")
        for row in r['tiles']:
            for code in row:
                check(code in tiles, f"room {r['room']} uses tile {code} not in tiles.json")

    # creatures <-> rooms, messages, sprites
    msg_ids = {m['id'] for m in messages['messages']}
    creature_rooms = {c['room'] for c in creatures['creatures']}
    for c in creatures['creatures']:
        r = by_room.get(c['room'])
        check(r is not None, f"creature in missing room {c['room']}")
        if r:
            check(any(r['creature_block']), f"room {c['room']} creature but zero block")
        for m in c['messages_emitted']:
            check(m in msg_ids, f"room {c['room']} emits unknown message {m}")
    for r in rooms:
        if any(r['creature_block']):
            check(r['room'] in creature_rooms,
                  f"room {r['room']} has a creature block but no creatures.json entry")
    for m in messages['messages']:
        for e in m['emitters']:
            check(e['room'] in creature_rooms,
                  f"message {m['id']} emitter room {e['room']} has no creature")
    sheets = {s['id']: s for s in assets['sprite_sheets']}
    extras = sheets['sprites_extras']['records']
    for sp in creatures['species']:
        for top, bottom in sp['sprite']['frames']:
            check(0 <= top < extras and 0 <= bottom < extras,
                  f"species {sp['id']} frame records {top},{bottom} out of {extras}")
        for room in sp['rooms']:
            check(room in creature_rooms, f"species {sp['id']} lists room {room} with no creature")

    # items <-> economy
    econ = {e['item']: e for e in economy['items']}
    for c in items:
        e = econ.get(c['class'])
        check(e is not None, f"item {c['class']} missing from economy.json")
        if e:
            check(e['name'] == c['name'], f"item {c['class']} name differs: {c['name']} / {e['name']}")
            check(e['weight'] == c['weight'], f"item {c['class']} weight differs")
    check(len(econ) == len(items), 'economy/items class count differs')
    for m in economy['merchants']:
        check(m['stock_item'] in econ, f"merchant room {m['room']} stocks unknown item {m['stock_item']}")
        c = next((c for c in creatures['creatures'] if c['room'] == m['room']), None)
        check(c is not None and c['kind'] == 'merchant',
              f"merchant room {m['room']} has no merchant creature")

    # characters <-> rooms objects, sprite sheets, skills
    skill_keys = {s['key'] for s in skills}
    for ch in chars:
        nid = ch['nid_place']['room']
        check(nid in by_room, f"{ch['name']} nid room {nid} missing")
        placed = sorted(o['object'] for o in by_room[nid]['objects']) if nid in by_room else []
        mine = sorted(o['object'] for o in ch['starting_items_in_nid_place'])
        check(placed == mine, f"{ch['name']} nid objects differ: rooms {placed} vs characters {mine}")
        check('sprites_' + ch['sprite_sheet'] in sheets, f"{ch['name']} sprite sheet unknown")
        for k in ch['skills_at_start']:
            check(k in skill_keys, f"{ch['name']} unknown skill {k}")

    # quest <-> creatures
    def kind(room):
        c = next((c for c in creatures['creatures'] if c['room'] == room), None)
        return c and c['kind']
    for g in quest['gates']:
        check((kind(g['room']) or '').startswith('gate_guard'),
              f"gate room {g['room']} creature kind is {kind(g['room'])}")
    for b in quest['blessers']:
        check(kind(b['room']) == 'blesser', f"blesser room {b['room']} kind is {kind(b['room'])}")
    for a in quest['animals']:
        check(kind(a['room']) == 'pensable_animal', f"animal room {a['room']} kind is {kind(a['room'])}")
    check(kind(quest['goal_npc']['room']) is not None, 'Raamo room has no creature')

    # player animations use frames the sheets have
    nframes = sheets['sprites_player0']['frames']
    for name, anim in assets['player_animations'].items():
        if not isinstance(anim, dict) or 'steps' not in anim:
            continue
        for facing, steps in anim['steps'].items():
            for s in steps:
                check(s['frame'] is None or 0 <= s['frame'] < nframes, f"animation {name}/{facing} frame {s['frame']} >= {nframes}")

    # demo script rooms
    for script in demo['scripts']:
        check(script['room'] in by_room, f"demo {script['name']} starts in missing room {script['room']}")

    print(f'{fails} failures' if fails else 'all checks pass')
    return fails


if __name__ == '__main__':
    sys.exit(main())
