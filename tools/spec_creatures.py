#!/usr/bin/env python3
"""Generate the creature and message tables for docs/spec/.

    tools/spec_creatures.py            -> docs/spec/data/creatures.json
                                          docs/spec/data/messages.json
    tools/spec_creatures.py --print    -> a readable dump of both

Sources: the 121 creature descriptors in the disk-2 room blocks (offsets
$E0-$F1, see docs/room-format.md) and the $4500 message table plus the item
names and dialog strings in build/dumps/loaded.bin.

Rules and pseudocode: docs/spec/creatures.md.
"""
import argparse
import os
import sys
from typing import Any

from common import ROOT, LOADED, load_ram, write_json, FPS_NTSC, FPS_PAL
from objects import item_name, GATE_STATS as STANDINGS
from messages import inline_string, screen_rowcol
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import room as R                                                    # noqa: E402
import messages as M                                                # noqa: E402

OUTDIR = os.path.join(ROOT, 'docs', 'spec', 'data')

N_ITEM_CLASSES = 15
NO_ITEM_CLASS = 0x10     # $3D51: not a class at all -- the creature offers a nid

# --- species ------------------------------------------------------------
# $E0 high nibble; sprite source pointers are species_sprite_lo/hi ($994F/$995A)
SPECIES = [
    dict(id=0,  name='kindar_adult_long_hair',  role='person',
         race='kindar', label='long-haired adult'),
    dict(id=1,  name='kindar_adult_short_hair', role='person',
         race='kindar', label='short-haired adult'),
    dict(id=2,  name='erdling_adult_long_hair', role='person',
         race='erdling', label='long-haired adult'),
    dict(id=3,  name='erdling_adult_short_hair', role='person',
         race='erdling', label='short-haired adult'),
    dict(id=4,  name='child_long_hair',  role='person', race='either',
         label='long-haired child'),
    dict(id=5,  name='child_short_hair', role='person', race='either',
         label='short-haired child'),
    dict(id=6,  name='lapan',  role='animal', race=None,
         label='rabbit-like animal (manual: lapan)'),
    dict(id=7,  name='sima',   role='animal', race=None,
         label='curl-tailed climbing animal (manual: sima)'),
    dict(id=8,  name='snake',  role='hostile_animal', race=None,
         label='snake (walkthrough: snake)'),
    dict(id=9,  name='spider', role='hostile_animal', race=None,
         label='many-legged crawler (walkthrough: spider)'),
    dict(id=10, name='ol_zhaan', role='person', race='kindar',
         label='robed figure with a staff'),
]
# --- $F1 creature kinds -------------------------------------------------
KINDS = {
    0x00: 'gift_giver',
    0x01: 'pensable_animal',
    0x02: 'hostile_animal',
    0x20: 'rest_trap_steal_tokens',
    0x21: 'rest_trap_kidnap_salaat',
    0x22: 'rest_trap_steal_shubas',
    0x23: 'rest_trap_kidnap_nekom',
    0x30: 'plain_talker',
    0x40: 'blesser',
    0x80: 'merchant',
    0x90: 'plain_talker',
    0xC0: 'gate_guard_pass',
    0xC1: 'gate_guard_token',
    0xD0: 'key_revealer',
    0xE0: 'ambusher_kidnap_salaat',
    0xE1: 'ambusher_attack_salaat',
    0xE2: 'ambusher_kidnap_nekom',
    0xE3: 'ambusher_attack_nekom',
    0xF0: 'plain_talker',
}

KIND_RULES = {
    'gift_giver': dict(
        speak_offers_item=True, once_per_day=True, sets_take_permission=True,
        note='SPEAK checks that some object is still on the ground in the room, '
             'refuses a second time on the same day, and grants permission to '
             'TAKE one object of the offered class (or to REST in the nid).'),
    'pensable_animal': dict(
        pense_message_gain=1, once_per_quest=True,
        note='PENSE MESSAGES raises the spirit limit by 1, once per quest per '
             'creature, and counts towards the five that trigger a vision.'),
    'hostile_animal': dict(
        contact_knockdown_rows=10, silent=True,
        note='Touch pushes 10 rows of accumulated fall onto the player, which '
             'trips the fall-damage test on the player\'s next step.'),
    'rest_trap_steal_tokens': dict(
        offers='nid', on_rest='steal_all_carried_tokens'),
    'rest_trap_steal_shubas': dict(
        offers='nid', on_rest='steal_all_carried_shubas'),
    'rest_trap_kidnap_salaat': dict(
        offers='nid', on_rest='kidnap_salaat'),
    'rest_trap_kidnap_nekom': dict(
        offers='nid', on_rest='kidnap_nekom'),
    'plain_talker': dict(
        note='No special case anywhere: talks like any creature, never offers '
             'anything, and has no once-a-day limit.'),
    'blesser': dict(
        speak_spirit_limit_gain=5, once_per_quest=True,
        sets_take_permission=True),
    'merchant': dict(
        buy_price_tokens=1, sell_price_tokens=1,
        note='BUY and SELL refuse anywhere else.  BUY grants permission to '
             'TAKE one object of the stock class.'),
    'gate_guard_pass': dict(
        blocks_door=True, permanent_flag='gate_a_open',
        accepts_item_class=10, offers_needed_for_permanent=2),
    'gate_guard_token': dict(
        blocks_door=True, permanent_flag='gate_b_open',
        accepts_item_class=8, offers_needed_for_permanent=None),
    'key_revealer': dict(
        sets_take_permission=True, reveals_item_class=13,
        note="SPEAK sets the flag that lets TAKE lift D'ol Falla's key."),
    'ambusher_kidnap_salaat': dict(silent_except_emotion=True,
                                   on_contact='kidnap_salaat'),
    'ambusher_attack_salaat': dict(silent_except_emotion=True,
                                   on_contact='attack_salaat'),
    'ambusher_kidnap_nekom': dict(silent_except_emotion=True,
                                  on_contact='kidnap_nekom'),
    'ambusher_attack_nekom': dict(silent_except_emotion=True,
                                  on_contact='attack_nekom'),
}

# creatures OFFER dispatches on ($4472), keyed by state id, not by kind
OFFER_TARGETS = {
    0x49: dict(accepts_item_classes=[7, 11], result='quest_complete'),
    0x34: dict(accepts_item_classes=[10], result='open_gate_a'),
    0x35: dict(accepts_item_classes=[8], result='open_gate_b'),
}

GATE_STATS = {k: 'standing_' + name for k, name in STANDINGS.items()}

TURN_PAUSE = 0x9A68        # frames to wait after turning, by gait
STEP_SLOW = 0x9AF4         # frames to the next half-step, by the phase entered
STEP_FAST = 0x9AF6
WALK_FRAME = 0x9AF8        # sprite pointer base per phase

# $E7-$EE, in block order; ($3CB3-$3CC1, $40FB/$4103, $414E/$4156)
SLOTS = [
    (0xE7, 'speak_line1', 'pass', 'SPEAK'),
    (0xE8, 'speak_line2', 'pass', 'SPEAK'),
    (0xE9, 'emotion',     'pass', 'PENSE EMOTIONS'),
    (0xEA, 'message',     'pass', 'PENSE MESSAGES'),
    (0xEB, 'speak_line1', 'fail', 'SPEAK'),
    (0xEC, 'speak_line2', 'fail', 'SPEAK'),
    (0xED, 'emotion',     'fail', 'PENSE EMOTIONS'),
    (0xEE, 'message',     'fail', 'PENSE MESSAGES'),
]

# print_message call sites ($3C15), named by what they draw
MESSAGE_SINKS = [
    dict(name='speak_line1', verb='SPEAK', row=21, col=1, src='$3CCE'),
    dict(name='speak_line2', verb='SPEAK', row=22, col=1, src='$3CD8'),
    dict(name='emotion', verb='PENSE EMOTIONS', row=21, col=10, src='$410F'),
    dict(name='message', verb='PENSE MESSAGES', row=24, col=1, src='$4162'),
]

FIXED = [
    (0x3C50, 'speak_with_whom', 'SPEAK', 'no creature in the room, or none adjacent'),
    (0x3C88, 'come_back_tomorrow', 'SPEAK',
     'gift-giver already spoken to today'),
    (0x3D5F, 'nothing_more_to_give', 'SPEAK',
     'gift-giver whose room has no object left on the ground'),
    (0x439A, 'no_response_line1', 'SPEAK / PENSE EMOTIONS',
     'the selected speech or emotion slot is empty; also BUY/SELL/OFFER with no adjacent creature'),
    (0x43AE, 'no_response_message', 'PENSE MESSAGES',
     'the selected message slot is empty'),
    (0x4083, 'pense_whom', 'PENSE', 'no creature in the room'),
    (0x409E, 'pense_lacks_skill', 'PENSE', 'spirit limit below 5'),
    (0x40C4, 'pense_needs_energy', 'PENSE', 'spirit energy is 0'),
    (0x40E8, 'emotion_label', 'PENSE EMOTIONS', 'always, before the emotion word'),
    (0x413B, 'message_label', 'PENSE MESSAGES', 'when the message half runs'),
    (0x41AF, 'buy_needs_tokens', 'BUY', 'no token carried'),
    (0x41D7, 'buy_too_heavy', 'BUY', 'carrying too much to add a purchase'),
    (0x420D, 'buy_granted', 'BUY', 'token spent; TAKE is now permitted for the stock class'),
    (0x4242, 'sell_prompt', 'SELL', 'the inventory cycle opens'),
    (0x4275, 'sell_nothing', 'SELL', 'the inventory cycle wrapped past the last item'),
    (0x42D6, 'sell_refused', 'SELL', 'no free carried slot for the token'),
    (0x430F, 'sell_paid', 'SELL', 'the item became a token'),
    (0x433F, 'no_merchant_here', 'BUY / SELL', 'the creature is not a merchant'),
    (0x43D4, 'offer_to_whom', 'OFFER', 'no creature in the room, or none adjacent'),
    (0x43F0, 'offer_what', 'OFFER', 'the inventory cycle opens'),
    (0x441B, 'offer_nothing', 'OFFER', 'the inventory cycle wrapped past the last item'),
    (0x4484, 'offer_refused', 'OFFER', 'wrong item class for this creature'),
    (0x44D2, 'offer_gate_accepted', 'OFFER', 'a gate guard took the item'),
    (0x96CE, 'door_is_locked', 'walk into a door', 'a gate guard blocks it and neither flag is set'),
    (0xAC50, 'no_nid_offered', 'REST', 'away from home without an offered nid'),
    (0xAD96, 'not_offered_to_you', 'TAKE',
     'indoors, of an object whose class is not the one offered'),
    (0xAAF5, 'kidnapped_salaat', 'ambush contact / REST trap', 'kind kidnap_salaat'),
    (0xAB5F, 'kidnapped_nekom', 'ambush contact / REST trap', 'kind kidnap_nekom'),
    (0xB33C, 'attacked_salaat', 'ambush contact', 'kind attack_salaat'),
    (0xB398, 'attacked_nekom', 'ambush contact', 'kind attack_nekom'),
]


def movement_class(species, kind_raw):
    """$99C4-$99D8 dispatch order: species first, then the $E0 kind nibble."""
    if species in (8, 9):
        return 'hostile_animal'
    if kind_raw & 0xF0 == 0xE0:
        return 'ambusher'
    return 'walker'


def creature(mem, room, blk):
    kind_raw = blk[0xF1]
    kind = KINDS[kind_raw]
    sp = blk[0xE0] >> 4
    spread = blk[0xE2] >> 4
    rec: dict[str, Any] = dict(
        room=room,
        state_id=blk[0xF0],
        species=sp,
        species_name=SPECIES[sp]['name'],
        sprite_color=blk[0xE0] & 0x0F,
        kind=kind,
        kind_raw=kind_raw,
        movement=movement_class(sp, kind_raw),
        start=dict(col=blk[0xE3], row=blk[0xE4], col_random_span=spread),
        patrol=dict(turn_col_low=blk[0xE5], turn_col_high=blk[0xE6]),
        gait='fast' if blk[0xE2] & 0x0F else 'slow',
        gate=dict(stat=GATE_STATS[blk[0xE1] & 0x0F],
                  level=blk[0xE1] >> 4),
        dialog=dict(
            gate_passed=dict(speak=[blk[0xE7], blk[0xE8]], emotion=blk[0xE9], message=blk[0xEA]),
            gate_failed=dict(speak=[blk[0xEB], blk[0xEC]], emotion=blk[0xED], message=blk[0xEE]),
        ),
        src='room block $%03X offsets $E0-$F1' % room,
        gait_raw=blk[0xE2] & 0x0F,
        messages_emitted=sorted({blk[o] for o, *_ in SLOTS if blk[o]}),
    )

    params = dict(KIND_RULES[kind])
    gift = blk[0xEF]
    # $EF only reaches TAKE/REST for the kinds that can set the permission flag
    if kind in ('gift_giver', 'blesser', 'key_revealer', 'merchant') or \
            kind.startswith('rest_trap'):
        if gift == NO_ITEM_CLASS:
            params['offers'] = 'nid'
        else:
            params['offers_item_class'] = gift
            params['offers_item'] = item_name(mem, gift)
    if kind == 'merchant':
        params['stock_item_class'] = gift
        params['stock_item'] = item_name(mem, gift)
        params.pop('offers_item_class', None)
        params.pop('offers_item', None)
        params.pop('offers', None)
    if blk[0xF0] in OFFER_TARGETS:
        params['offer_target'] = dict(OFFER_TARGETS[blk[0xF0]])
    params['wand_of_befal_spirit_cost'] = 1 if kind == 'hostile_animal' or sp in (6, 7) else 5
    rec['params'] = params
    return rec


def movement_rules(mem):
    def frame(p):
        return (p - 0xF4) // 2      # $F4/$F6/$F8 -> left-facing frame 0/1/2

    return dict(
        ticks_per_second=dict(pal=FPS_PAL, ntsc=FPS_NTSC,
                              note='the AI runs once per video frame, from the '
                                   'raster interrupt, independently of the '
                                   "player's own step period"),
        spawn_frame_period=4,
        fall_frame_period=4,
        turn_pause_frames=dict(slow=mem[TURN_PAUSE], fast=mem[TURN_PAUSE + 1]),
        half_step_frames=dict(
            slow={'entering_phase_0': mem[STEP_SLOW], 'entering_phase_1': mem[STEP_SLOW + 1]},
            fast={'entering_phase_0': mem[STEP_FAST], 'entering_phase_1': mem[STEP_FAST + 1]}),
        walk_frame_by_phase={'phase_0': frame(mem[WALK_FRAME]),
                             'phase_1': frame(mem[WALK_FRAME + 1])},
        phase_1_frame_offset=[0, 2],
        idle_chance_one_in=8,
        idle_max_frames=127,
        random_turn_chance_one_in=16,
        stop_for_player_cells_ahead=[1, 2],
        contact_cells_ahead=[0, 1, 2],
        ambush_cells=[-2, -1, 0, 1],
        row_tolerance=1,
        src='$9971 creature_step, $9A94 half step, $9A06 contact, $9AFA ambush')


def persistent_state():
    return dict(
        banished=dict(
            array='one byte per creature state id, 0-127',
            bit7='the creature was hit with the wand of Befal: it never spawns '
                 'again, its REST event is dead, and if it was a gate guard the '
                 'door behind it is permanently open',
            cleared_when='a new quest starts',
            saved=True,
            src='$2300 + state_id'),
        contact=dict(
            array='one byte per creature state id, 0-127',
            bits_0_6='for creatures that talk: the day this creature was last '
                     'spoken to (0 = never; day counts from 1 and is capped at 51)',
            bits_0_4='for ambushers only: the time-of-day slot in which this '
                     'ambusher last appeared',
            bit7='the once-per-quest spirit gift has been taken: set by SPEAK '
                 'for a blesser, by PENSE MESSAGES for a pensable animal',
            note='the two readings of the low bits never collide, because '
                 'ambushers have no dialogue and so never get a day stamped',
            cleared_when='a new quest starts',
            saved=True,
            src='$2380 + state_id'),
        gate_flags=dict(
            gate_a_open='banished[52]; also set outright by offering a second '
                        'wissenberry to the guard with that state id',
            gate_b_open='banished[53]; no dialogue path ever sets it',
            src='$2334 / $2335'),
        per_visit=dict(
            take_permission='something has been offered; cleared by a successful TAKE',
            door_permission='a gate guard was paid this visit; cleared on every room load',
            falla_key_revealed="D'ol Falla has been spoken to; lets TAKE lift her key",
            src='$CC / $CD / $CE'),
    )


def build(mem):
    blocks = M.npc_rooms()
    creatures = [creature(mem, r, blk) for r, blk in blocks]

    msgs = M.messages(mem)
    emitters = {m['n']: [] for m in msgs}
    for c, (_, blk) in zip(creatures, blocks):
        for off, slot, gate, verb in SLOTS:
            n = blk[off]
            if n:
                emitters[n].append(dict(room=c['room'], creature_kind=c['kind'],
                                        species=c['species_name'], slot=slot,
                                        gate=gate, verb=verb))

    def group(n):
        slots = {e['slot'] for e in emitters[n]}
        if not slots:
            return 'unused'
        if slots <= {'emotion'}:
            return 'emotion'
        if slots <= {'speak_line1', 'speak_line2'}:
            return 'speech'
        if slots <= {'message'}:
            return 'pense_message'
        return 'speech_and_pense_message'

    message_table = [dict(id=m['n'], text=m['text'], group=group(m['n']),
                          emitters=emitters[m['n']]) for m in msgs]

    fixed = []
    for addr, name, verb, when in FIXED:
        text, dest, _ = inline_string(mem, addr)
        row, col = screen_rowcol(dest)
        fixed.append(dict(name=name, text=text, verb=verb, printed_when=when,
                          row=row, col=col, src='$%04X' % addr))

    species = []
    for s in SPECIES:
        rooms = [c['room'] for c in creatures if c['species'] == s['id']]
        rec = dict(s)
        rec.update(
            rooms=rooms,
            colors_used=sorted({c['sprite_color'] for c in creatures
                                if c['species'] == s['id']}),
            sprite=dict(
                file='extras',
                frames=[[2 + 6 * s['id'] + 2 * f, 3 + 6 * s['id'] + 2 * f]
                        for f in range(3)],
                facing='records are the left-facing frames; right-facing is a '
                       'horizontal mirror generated at load time',
                size=[24, 42],
                note='each frame is a top and a bottom 24x21 sprite record',
                src='$994F/$995A -> $E080 + species*$180'),
        )
        species.append(rec)

    creatures_json: dict[str, Any] = dict(
        generated_by='tools/spec_creatures.py',
        rules='docs/spec/creatures.md',
        source='disk 2 room blocks, offsets $E0-$F1',
        naming=dict(
            hand_curated=['species[].name', 'species[].label', 'species[].role',
                          'species[].race', 'creatures[].kind', 'kinds[].*'],
            note='every number below is read from the disk; the names attached '
                 'to species and to creature kinds are chosen in this script '
                 'from the behaviour in docs/spec/creatures.md, the manual '
                 'dictionary and iso/spoilers/walkthru.txt.  The raw bytes are '
                 'kept alongside as species, sprite_color and kind_raw so any '
                 'name can be re-derived.'),
        count=len(creatures),
        item_classes=[dict(id=k, name=item_name(mem, k)) for k in range(N_ITEM_CLASSES)],
        no_item_class=NO_ITEM_CLASS,
        gate_stats=GATE_STATS,
        kinds={name: KIND_RULES[name] for name in sorted(set(KINDS.values()))},
        movement_rules=movement_rules(mem),
        persistent_state=persistent_state(),
        species=species,
        creatures=creatures,
    )

    messages_json: dict[str, Any] = dict(
        generated_by='tools/spec_creatures.py',
        rules='docs/spec/creatures.md',
        source='the $4500 string table (187 entries) and the print_inline sites',
        naming=dict(
            hand_curated=['fixed_strings[].name', 'fixed_strings[].verb',
                          'fixed_strings[].printed_when', 'sinks[].name'],
            note='all text and screen positions are read from the binary; the '
                 'names and trigger descriptions are chosen in this script and '
                 'match the rules in docs/spec/creatures.md.'),
        encoding='uppercase ASCII, one byte per screen cell',
        count=len(message_table),
        sinks=MESSAGE_SINKS,
        messages=message_table,
        fixed_strings=fixed,
    )
    return creatures_json, messages_json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ram', default=LOADED)
    ap.add_argument('--outdir', default=OUTDIR)
    ap.add_argument('--print', dest='dump', action='store_true')
    a = ap.parse_args()

    mem = load_ram(a.ram)
    cj, mj = build(mem)

    if a.dump:
        for c in cj['creatures']:
            print('room $%03X id $%02X %-24s %-22s %s'
                  % (c['room'], c['state_id'], c['species_name'], c['kind'],
                     c['messages_emitted']))
        for m in mj['messages']:
            print('%3d %-12s %s' % (m['id'], m['group'], m['text']))
        return

    os.makedirs(a.outdir, exist_ok=True)
    for name, obj in (('creatures.json', cj), ('messages.json', mj)):
        write_json(os.path.join(a.outdir, name), obj)
    print('%d creatures, %d messages, %d fixed strings'
          % (cj['count'], mj['count'], len(mj['fixed_strings'])))


if __name__ == '__main__':
    main()
