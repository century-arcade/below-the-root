# Below the Root -- functional spec

## The quest

You have fifty days to find Raamo, who is trapped on a ledge in the
caverns below the root, and give him a shuba or a vine rope.  Do that and
the game tells you how many days it took and ranks you: under 15 days a
Master Quester, under 30 Highly Gifted, otherwise Gifted.  Reach day 51
and the quest ends unfinished.  Nothing else is scored.

You play one of five characters -- Neric, Genaa, Herd, Pomma or Charn --
who differ in stamina, starting spirit, and how the two peoples of
Green-Sky (Kindar and Erdlings) regard them.  Each starts in their own
nid with a shuba, one item of food and three tokens on the floor.

There is no health and no dying.  Everything that goes badly -- starving,
exhaustion, drowning, being attacked -- costs you a day: you wake in your
own nid, fully fed and rested, one day later.

## The characters

| | people | as the game puts it | stamina | spirit limit | food & rest | standing Kindar / Erdling | starts able to | home nid |
|---|---|---|---|---|---|---|---|---|
| Neric | Kindar | strong, impulsive, moderate spirit | 20 | 5 | 10 | 3 / 0 | pense emotions | T1, off M5 |
| Genaa | Kindar | strong, charismatic, no spirit skill | 20 | 0 | 10 | 4 / 2 | nothing | C1, off E6 |
| Herd | Erdling | strong, rational, moderate spirit | 20 | 5 | 10 | 0 / 3 | pense emotions | V0, off A6 |
| Pomma | Kindar | delicate, greatly spirit gifted | 10 | 10 | 5 | 5 / 3 | pense emotions and messages | 50, off 16 |
| Charn | Erdling | sturdy, alert, moderate spirit gift | 15 | 5 | 7 | 2 / 5 | pense emotions | L1, off I5 |

Stamina sets the leap -- 4 cells below 20, 5 from 20, 6 from 30, and
since nobody starts above 20 the 6-cell leap takes two strange elixers
-- and the carrying limit
(stamina + 26: nine full-weight items for the three strong ones, eight
for Charn, seven for Pomma).  Spirit energy starts equal to the limit.
Food and rest start full; their maximum is half the stamina.  Standing
is fixed for the game and decides who will talk to you.  Room codes are
explained under The screen.

## The screen

The room fills the top four-fifths of the screen; the bottom strip is
for text: the menu, your status, and whatever anyone says.  Rooms are
one screen each and the world is a grid of them: walk off any edge and
you are in the neighbouring room.  Doorways lead to interiors and other
places; stand in one and press the button to go through.

The map that came in the box is the world above ground, one square per
room.  The caverns are not on it; you map those yourself.  Caverns are
pitch dark unless you carry a lit honeylamp or the spirit lamp.

The world is 32 rooms wide and 16 tall.  This spec names a room by a
two-character code, column then row, each a digit in `0-9` then `A-V`:
`00` is the top-left room, `VF` the bottom-right.  Rows `0`-`2` are
mostly house and shop interiors (they are not places on the map -- you
reach them through doorways), rows `3`-`A` are the seven trees, row `B`
is the ground, rows `C`-`F` are the caverns.  `assets/world_map.png` is
every room drawn at half size with its code in the corner.

## Moving

Everything is in whole character cells: your figure stands on a cell and
moves by cells.  Joystick and one button.

- **Walk** left or right.  A step up onto a ledge one cell high is
  automatic.  Walking into a wall or a bramble bush knocks you flat.
- **Climb** ladders and vines with up and down.  Push sideways with the
  button held to jump off one -- except underground, where that is not
  allowed.
- **Leap**: hold the button and push the way you are facing.  The leap
  is 4, 5 or 6 cells long depending on stamina (under 20, 20-29, 30+),
  rising two rows then coming back down; keep holding the direction on
  landing and you are running.
- **Glide**: if you carry a shuba, hold the button once you have fallen
  two rows and you sail down at 45 degrees, steerable left and right.
  Bumping a wall cancels gliding until you next stand up.
  Port: the button is optional when the stick is pushed sideways.
- **Crawl**: pull down to stoop, push up to stand.  Crawling gets you
  under low things and is the only way across a laid vine rope.
- **Fall** six rows or more and you are knocked down: just under three
  seconds on the floor, a big chunk of fatigue, and a one-in-sixteen chance your
  shuba tears.  Five rows or fewer is free.
- **Water** is fatal-ish: step in and you are found near the water a day
  later.

Snakes and spiders knock you down if they reach you.  You never bump
into anyone else; people simply stop and wait when you are near.

Moving tires you.  Fatigue is hidden; leaping and climbing spend it,
being knocked down spends a lot of it, walking spends none, and every so
often the debt comes due as one point each of food and rest.

## The world

Green-Sky is seven giant trees -- the Sky, Garden, Broad, Grand, Silk,
Star and Temple Grunds -- with branches, houses and shops in the canopy,
trunks you climb, and the ground far below.  Signs name the places.
Below the ground are the caverns, entered through two guarded doors in
series: the outer guard wants wissenberries (a second offering ever
opens her door for good), the inner guard wants a token every single
time.  Using the wand of Befal on a guard also opens the door
permanently.

Doorways are two-way; every door you go through has a door back.  A few
doorways in the shipped game are broken and would dump you in `00`
(the spec flags them; a port should just not paint them).

One special place: sleep in the highest nid of the Sky Grund and the next
doorway you use takes you to the clouds, where D'ol Neshom blesses you
and grants the spirit bell.  The doorway after that brings you back.
Time does not pass while you are there.

### Where things are

"off" means the interior is entered by a doorway from that outdoor room.

| what | where |
|------|-------|
| the sky nid (to the clouds) | `90`, off `10` at the top of the Sky Grund; the clouds are `U5`-`V5` |
| the gate to the caverns | outer guard at `0B` on the ground; inner guard at `01`; first cavern `0C` |
| Raamo | `GE` |
| the Bottomless Lake | `ID` |
| Broad Grund shops (fruit & nuts, trencher beaks, honeylamps) | `51`, `61`, `71`, off `B8` |
| Star Grund shops (shubas, vine rope, pan bread) | `02`, `42`, `52`, off `M8` |
| the Lapan House (roast lapan) | `Q0`, off `9B` |
| wissenberries for sale | `E1`, off `G6`; also growing wild at `D5`, `O5`, `97`, `V7`, `08`, `89` |
| the Wise Child | `J0`, off `86` in the Garden |
| the Hermit | `91`, off `F0` |
| Raamo's Mother | `K3` |
| D'ol Neshom | `V5`, in the clouds, with the only spirit bell |
| Vatar | `CF`, off `DE` in the caverns |
| D'ol Falla and her key | `72` and `62`, off `R9` by the Vine Palace |
| the temple key | `H2`, off `P4` |
| the spirit lamp | `B2`, the Chamber of the Forgotten (opened with a key) |
| the wand of Befal | `R1` -- the Nekom's room, where their kidnaps take you |
| strange elixers (five) | `S0` (the Salaat kidnap room), `12`, `P2`, `64`, `AE` |
| the Vine Palace, the Grand Hall, the Temple | `P6`, `F8`, `R7` on the map; interiors `82`, `S2`, `K4` |
| the ten animals | `32`, `23`, `U3`, `64`, `U4`, `06`, `L6`, `89`, `S9`, `GF` |

## Things

Fifteen kinds of thing exist: the spirit bell, the spirit lamp, the wand
of Befal, a honeylamp, roast lapan, pan bread, fruit & nuts, wissenberries,
a strange elixer, a shuba, a trencher beak, a vine rope, tokens, and the
two temple keys.  Every one is a real object lying somewhere in the world
at the start; nothing is ever created, so what you see is all there is.

- **TAKE** what you are standing over.  Outdoors anything may be taken.
  Indoors you may take what is in your own nid, in a handful of public
  rooms, or what someone has just offered you (by SPEAK, or by BUY).
  The offer lapses if you leave the room.
- **DROP** puts a thing on the floor in front of you, or on the shelf in
  your own nid.
- **Carrying**: a token weighs 1, everything else 5, and you can carry
  `stamina + 26` -- nine full-weight things for the strongest characters,
  seven for Pomma.
- **USE**: a honeylamp lights (and burns out; a lit lamp dropped is
  lost); a trencher beak cuts brambles slowly and eventually breaks; the
  wand of Befal cuts brambles instantly and banishes a creature standing
  by you, at a cost of 5 spirit limit (1 for an animal); a vine rope is
  laid across a gap for crawling; the two keys open the two temple
  walls.
- **EAT**: roast lapan, pan bread and fruit & nuts each give 5 food
  (lapan also drains 15 spirit energy unless you are an Erdling);
  wissenberries pass two hours and cost 15 spirit energy; the strange
  elixer permanently adds 5 stamina (more carrying, and a longer leap
  once you pass 20 or 30)
  and refills food and rest.
- **EXAMINE** and **INVENTORY** tell you what is there and what you have.

Money is tokens.  Everything costs one token and everything sells for
one token, at every merchant.  There are 62 tokens in the world and
room for only 13 more, so selling can fail with "sorry, I'm not
interested" when the world is full of tokens.  BUY gives you permission
to take the merchant's one kind of stock; you then TAKE it off the floor.
Merchants deal in roast lapan, fruit & nuts, trencher beaks, honeylamps,
wissenberries, shubas, vine rope and pan bread -- eight shops.

## People and animals

121 inhabitants, at most one per room, each always in the same room.
Eleven looks: Kindar and Erdling adults, children, the robed Ol-zhaan,
lapans (rabbit-like), simas (small tree climbers), snakes and spiders.
They patrol back and forth along their stretch of floor, pausing and
turning at random, and stop to face you when you approach.

Each has a role:

- **Talkers** -- most people.  Say a line or two, have an emotion, may
  have a message.
- **Gift-givers** -- offer you something from their room, once a day
  each, as long as anything is still lying there.
- **Merchants** -- the eight shops.
- **Blessers** -- five named figures (the Wise Child, the Hermit, Raamo's
  Mother, D'ol Neshom, Vatar) who raise your spirit limit by 5 the first
  time you speak to them.
- **Animals** -- ten lapans and simas that raise your spirit limit by 1
  the first time you read their message (which takes the second pense
  skill, and standing next to them).
- **The two gate guards.**
- **D'ol Falla**, who must be spoken to before her key can be taken.
- **Nid-offerers** -- twelve people who let you sleep in their nid.  Six
  of them are traps: two steal every token you carry, one every shuba,
  and three kidnap you in your sleep.  Their emotions give them away.
- **Ambushers** -- twelve followers of D'ol Salaat and members of the
  Nekom.  They are only sometimes in their room (each has an hour of the
  day they favour).  Touch one and you are either kidnapped -- you wake
  elsewhere, no time lost -- or attacked, which costs a day.
- **Snakes and spiders** -- silent; contact knocks you down.
- **Raamo**, alone in the caverns.

How people respond depends on your standing with their people: each
character has a Kindar standing and an Erdling standing, fixed for the
game, and a dozen inhabitants say something different -- or nothing --
to a character they think little of.

## Talking

Open the menu (button plus pull back) and pick a verb.  Talking needs
you to be next to someone and facing them.

- **SPEAK**: they say their piece.  Gift-givers and blessers also grant
  their gift.
- **PENSE**: read their **emotion** (from anywhere in the room) and, if
  you are skilled enough and next to them, their **message**.  Each half
  costs one spirit energy.  Pense a stranger from a distance first: rage
  or deceit means avoid them.
- **BUY** / **SELL**: merchants only.
- **OFFER**: give an item.  Only three people accept anything --
  wissenberries to the outer guard, a token to the inner guard, a shuba
  or rope to Raamo.

Everything anyone says is fixed text: 187 lines in all, plus the
verbs' own responses.

## Spirit

Two numbers.  **Spirit limit** is permanent progress: it starts at 0-10
depending on character, rises by 5 per blesser and 1 per animal (35 in
all), and drops by 5 when you banish a person with the wand.  **Spirit
energy** is what you spend; it refills by 5 every hour up to the limit.

Skills unlock as the limit passes a threshold:

| limit | skill | cost | does |
|-------|-------|------|------|
| 5 | Pense emotions | 1 | read an emotion from anywhere in the room |
| 10 | Pense messages | 1 | read a message, standing next to them |
| 15 | Heal yourself | 5 | +2 food, +2 rest |
| 20 | Grunspreke | 2 | grow a new limb one cell out from the branch you stand on |
| 25 | Kiniport tools | 5 | move an object in the room to a cell of your choosing |
| 30 | Kiniport your body | 10 | move yourself to any cell in the room with floor under it |

Each new threshold is announced, and the first five gains also show one
of five visions about Raamo.

## Food, rest and sleep

Food and rest are two meters, 5-10 at the start depending on character.
Both drop by one every hour of game time and by one each time your
fatigue debt comes due.  Either reaching zero and going below costs a
day.  You watch them with STATUS.

**REST** in a nid -- your own, the sky nid, or one you have been offered:
each hour asleep is +4 rest and a chime; any joystick movement wakes
you.  Sleep too long and you starve in your sleep (food still drops every
hour).  **HEAL** gives +2/+2 for 5 spirit energy.  **RENEW** gives up and
takes the day: full food, rest and spirit, back in your nid.

## Time

A day is eight hours -- early morning, late morning, early afternoon,
late afternoon, early evening, late evening, midnight, late night -- and
each hour is two and a half minutes of real play.  The clock only runs
while you are in the world: it stops for the menu and for every verb.
Sleeping an hour and eating wissenberries advance it by whole hours.

Nothing looks different at night.  The hour matters for exactly two
things: the status display, and which hour the ambushers keep.

## Menus and saving

The main menu offers START GAME, CONTINUE, DISK STORAGE and SAMPLE
QUEST, drawn over the title picture.  START GAME shows the five
characters with a description each and puts you in your nid.  CONTINUE
returns to a quest you left with the menu.  DISK STORAGE saves or loads
one of five slots; a save holds the whole world (where every object is,
who you have spoken to and when, whom you have banished) plus your
stats and position.  SAMPLE QUEST plays a scripted demonstration until
you press the button, as the game also does on its own before the menu
first appears.  The menus, the save slots and what happens between
rooms are `shell.md`.

## Look and sound

Sixteen colours, one per character cell, black background.  Two tile
sets -- one for outdoors, one for interiors and caverns -- with a
different glyph and colour for most scenery, so the same room drawn with
the other set is a different picture.  Water ripples.  Figures are
single-colour sprites about three cells wide and five tall; each of the
five characters has their own sheet (walk, climb, glide, leap, knocked
down, crawl, asleep), and each of the eleven creature looks has three
frames.

Eleven short tunes played on a music-box voice -- one for winning and
timing out, one for the demo, and a pool the game draws from when you
are blessed or enter certain rooms -- and fourteen sound effects:
footsteps, climbing, leaping, landing, gliding, the door, the knock-down,
the rest chime, the spirit bell.

---

## Status of the spec

The six area files (`world`, `player`, `creatures`, `time`, `assets`,
`shell`) carry the rules above at full precision, with data tables in
`data/*.json` regenerated from the original disk by script;
`tools/spec_check.py` confirms the tables agree with each other.

**Checked against the running game:** room decoding is byte-exact; the
attract screen and the first room with the player in it are pixel
matches; the fall threshold and the leap lengths; the demo reaching the
REST verb; the hour is 8960 ticks; the dead doorways, both kidnaps, both
REST traps, the outer gate, and that a blank grid slot hangs the game.

**Read from the code but never watched happen:** creature movement and
all of the dialogue tree, both endings, the save layout, the cloud world.

**Twenty-three open questions** remain, listed at the end of each area
file.  None blocks building the world, movement, creatures or the
economy.

**Original bugs a port must choose to keep or fix** are listed in the
README under port notes, with the decisions made so far.
