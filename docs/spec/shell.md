# The shell: the menus, saved games, and the loop around the room

Everything outside the room.  The room loop moves you and the creatures
and runs the clock; it stops whenever something has happened that it
cannot deal with by itself and hands the reason out here: the title
screen, the four menu options, picking a character, the five save
slots, and the ten reasons the room loop gives up control.

The panel strings and where they sit are in `data/shell.json`; the
character strings are in `data/characters.json`; rooms go by their
two-character code.  Times are in ticks, one tick being one video frame,
60 a second.

## Starting up

The room area draws room `T4`: the words BELOW THE ROOT and STORY BY
ZILPHA KEATLEY SNYDER are spelled out of the tile set's own letter
tiles, and the rooms next to it carry the rest of the credits, PROGRAM
BY DALE DISHAROON in `U4` and ARTWORK BY BILL GROETZINGER in `U3`.

Over that, the attract demo runs once: a scripted figure walks around
those rooms while four pages of story text come up in the panel in turn
(`time.md`, The attract demo).  When the script ends the main menu
appears over the same picture.  Pressing the button during the demo
skips the rest of it and brings the menu up at once.

The menu is drawn over room `T4` every time you come back to it,
whatever room you were standing in.

## The main menu

Four options, one per panel row, at column 13.  The selected one is
fourteen cells of reverse video, padding included.  Push up and down to
move; the cursor stops at the ends and does not wrap.  In the port, a
push moves the cursor once and blips; the stick must centre before the
next push counts.  The original instead counted down a busy loop of
roughly a fifth of a second after each move.  The button chooses.
Arriving at the menu, by any route, turns the music off.

| option | what it does |
|--------|--------------|
| START GAME | the character select screen |
| CONTINUE | back into the quest in progress, in the room and the cell you left |
| DISK STORAGE | the save and load screen |
| SAMPLE QUEST | the demo, played until you press the button |

A quest is in progress from the moment START GAME drops you in your nid
until something ends it.  Three things end it: winning, reaching day 51,
and SAMPLE QUEST.  LOAD GAME brings one back.  Going back to the menu
from inside the game does not end it.

CONTINUE with no quest in progress does nothing: no message, no redraw;
the cursor stays where it is and the menu goes on reading the stick.
That is the case before your first game, after either ending, and after
SAMPLE QUEST.

You get back here from the game through the MENU cell of the command
menu (`player.md`).  It drops out of the room immediately, with no
confirmation, and the quest stays in progress, so CONTINUE picks it up
in the same room, the same cell, with the same clock.  SAVE GAME writes
that room, not the title room.

## Character select

START GAME replaces the panel with one character at a time: the prompt
CHOOSE YOUR PLAYER: on the first row, the name beside it, and the
description and trait line on the two rows below.  Push up to cycle;
down does nothing.  The order is Neric, Genaa, Herd, Pomma, Charn, then
a sixth entry that reads only RETURN TO MENU, and then back to Neric.
Nothing is highlighted; the record on screen is the choice, and the
button takes it.

Each record blips and, in the port, the screen waits for the stick to
centre and the button to be up, then for the next push or the button;
holding up does not walk the entries.  The original used a busy loop of
roughly four tenths of a second after each redraw, then waited for the
button to be released and counted down a further sixth of a second.

The screen opens on the character you already have loaded: Neric the
first time, and afterwards whoever you last played or last loaded from
disk.  RETURN TO MENU puts that selection back the way it was and
returns to the main menu.

The five records (the name, the one-line description and the trait
line, exactly as the game prints them) are in `characters.json` as
`name`, `description` and `traits`.  Neric's, for instance, is NERIC /
A KINDAR-BORN YOUNG MAN / STRONG--IMPULSIVE--MODERATE SPIRIT.

Choosing a character starts a new quest:

1. Every object in the world goes back where the shipped table puts it,
   and every creature's flags (banished, day last spoken to, gift spent,
   ambusher's chosen hour) are cleared.
2. Your stats come from that character's `start` block in
   `characters.json`: spirit energy and limit, food and rest and their
   caps, stamina, carrying limit and the two standings.  Day 1, early
   morning, fatigue reserve full.
3. Visions shown and animals pensed go to zero, so the five visions are
   one per quest.
4. The lit lamp, the cloud-world state, D'ol Falla's permission and any
   pass through a gate are all cleared.
5. You are put in that character's `nid_place` (the room and the cell)
   and the room is loaded as an interior.  A shuba, one item of food and
   three tokens are lying on the floor of that room; you start carrying
   nothing.
6. The quest is now in progress.

START GAME over a quest in progress overwrites it without asking.

## DISK STORAGE

One line: SAVE GAME, LOAD GAME, RETURN TO MENU.  Left and right move
between them, clamped at the ends, no wrap; the selected one is reverse
video across its whole width including the space either side.

- RETURN TO MENU goes back to the main menu.
- SAVE GAME with no quest in progress goes back to the main menu too,
  with no message.
- Otherwise a second line appears on the third panel row: QUEST 1 2 3 4
  5, with the current slot in reverse video.  Left and right move
  between the five slots, again clamped and not wrapping.

The button on a slot commits.  The panel clears, the game asks for the
storage disk and waits for one more button press, and then it saves or
loads.  There is no cancel past the SAVE/LOAD line: the slot screen has
no way out but choosing a slot, and the disk prompt has no way out but
the button.

Both operations end by returning to the main menu.  The SAVE-or-LOAD
choice and the slot number are remembered, so the next visit opens where
you left it.

A save holds the whole quest: where every object is and whether you
carry it, every creature's flags, the quest flags, your stats, the day
and hour and the clock's own count, and the room and cell you were
standing in when you opened the menu.  It does not hold the world
layout, the character artwork, or any score.  The field list and the
byte-exact layout of the original's 1408-byte file are in `time.md` and
`data/save.json`.

Loading replaces everything, including which character you are: the
loaded quest brings its own character back with it, sprites and all,
swapped in when you CONTINUE rather than at the load itself.  A load
also restores the quest-in-progress flag and the saved room; CONTINUE
afterwards is what puts you back in the world.

The original loads a never-written slot by copying the stale save buffer
into the quest.  The port leaves the quest untouched and returns to the
menu with no message.

## SAMPLE QUEST

SAMPLE QUEST starts with the outdoor script in room `47`.  When a script
ends it hands off to the other, and the two alternate for as long as you
leave them.  The button is the only way out, and it goes straight back to the
main menu.  Both scripts are in `data/demo.json`.

SAMPLE QUEST ends the quest in progress: it clears the quest-in-progress
flag, puts every object back where the shipped table puts it, and clears
every creature's flags, because the demo plays in the real world with a
sixth character record of its own.  Anything not written to a save slot
is gone, and CONTINUE does nothing afterwards.

## The outer loop

Each time the room loop stops it has set exactly one reason.  The shell
checks them in this order, does the one thing that reason calls for, and
starts the room loop again.  Nothing moves and the clock does not run
while the shell is doing that.

| reason | what the shell does |
|--------|---------------------|
| you walked off a room edge | works out the neighbouring room from the grid, leaves this one, loads that one and puts you at the matching cell (`world.md`) |
| you pressed the button on a doorway | resolves the doorway: the cloud-world teleport first, then the gate lock, then the destination cell (`world.md`) |
| you pulled back with the button held | runs the command menu and the verb you pick, then puts you back exactly where you were (`player.md`) |
| you stepped in water | prints YOU WERE FOUND NEAR THE WATER. TIME HAS PASSED. and sends you home a day later (`time.md`, Losing a day) |
| the demo script asked for a room | ends the script and starts the next one, or returns to the main menu (`time.md`, The attract demo) |
| the demo script asked for a text page | prints that page of story text and carries on |
| the day reached 51 | ends the quest: the closing text, two tunes, a button press, back to the main menu (`time.md`, The endings) |
| food or rest ran out | prints YOU SPENT A DAY RECOVERING FROM A LACK OF FOOD or ... REST and sends you home a day later (`time.md`) |
| you stood on a doorway underground carrying the spirit bell | stops and prints THE SPIRIT BELL RINGS (`time.md`, The cloud world) |
| none of the above | a creature reached your cell |

An ambusher reaching you is the only other thing that stops the room
loop, so the shell treats "no reason matched" as that: it reads which of
the twelve ambushers caught you and acts on it.  Two outcomes, both in
`creatures.md`: a kidnap moves you to `S0` or `R1` and costs no time; an
attack prints YOU WERE ATTACKED BY A FOLLOWER OF D'OL SALAAT. TIME HAS
PASSED. or the Nekom's version and sends you home a day later.  A snake
or a spider touching you knocks you down inside the room loop and never
reaches the shell.

Every message the shell prints waits for a button press or a stick push
before the room loop resumes.

Walking off a room edge burns one unit off a lit honeylamp, and a lamp
that runs out is destroyed on the spot with its weight coming off what
you carry (`player.md`).  Doorways, the cloud-world teleport and being
sent home cost it nothing: a honeylamp counts edges crossed, not time.
CONTINUE from the main menu burns one too.

Two things skip the loop and go straight to the main menu: the MENU cell
of the command menu, which leaves the quest in progress, and offering
Raamo a shuba or a vine rope, which wins and ends it.

## Unknowns

- The disk-storage screen has no cancel.  Whether that was deliberate or
  an oversight cannot be told from the code.

Derived from `docs/menus-and-saves.md`, `docs/boot-flow.md`,
`docs/engine.md`, `docs/day-and-quest.md`, `docs/demo.md`,
`docs/player-physics.md` and `docs/verbs-and-inventory.md`.
