# Player

How you move, what the command menu does, what you can carry, what you
can spend, and what costs you a day.

Tables: `data/characters.json` (starting numbers, nid-places, and the
items lying on the floor of each), `data/items.json` (the fifteen item
classes), `data/skills.json` (the six spirit skills).  Tile names below
are `data/tiles.json`'s roles; rooms are named by their two-character
code.  `world.md` owns the map, `creatures.md` the people, `time.md`
the clock, the economy and the save.

## Cells, ticks and the figure

The room is 40 cells across and 20 down: columns 0-39 left to right,
rows 0-19 top to bottom.  Below the room is the four-line text panel;
you never stand in it.

You occupy one whole cell.  There is no sub-cell position and no
velocity -- a column, a row, and a facing of left or right.  Everything
called speed here is a number of ticks between one state step and the
next.  A tick is one video frame; 60 ticks to the second.

The figure is three columns wide and about five rows tall, centred on
your cell: it covers the column either side of you and stands with its
feet on the top edge of the cell below.  That is why the rules keep
testing two particular cells -- **the floor**, one row down, and **your
head**, three rows up.

## Tiles that matter to you

| role | what it does to you |
|------|---------------------|
| platform, limb\_top, ground, grown\_limb | solid: you stand on it, and walking into it steps you up onto it.  GRUNSPREKE grows a new limb from a limb\_top |
| climbable | a ladder or vine: holds you up, and up/down climbs it |
| vine\_rope | solid only while you are crawling; empty otherwise |
| wall | entering one, or putting your head in one, throws you back and knocks you down |
| bramble | entering one throws you back and knocks you down; cut by a trencher beak or the wand of Befal |
| water | entering it drowns you |
| door | a doorway; stand on it and press the button to go through |
| nid\_left, nid\_right | the two ends of a hanging nid; REST needs one overhead |
| home\_nid | the shelf over your own nid; DROP puts things there |
| object | the two-cell tile an object lying on the ground paints |

"Support" means solid or climbable: you do not fall through it.  Note
that a wall and a bramble are **not** solid -- the engine lets you move
into one and then pushes you back out, which is why bumping a wall
costs you seconds on the floor instead of merely stopping you.  Off the
edge of the room, and anywhere above the top row, reads as empty.
Everything else -- scenery, signs, letters -- you pass straight through.

## Moving

Movement is one state step at a time.  Each state sets how many ticks
pass before the next step, and that single number is the whole of
movement speed.

| state | ticks per step | works out as |
|-------|----------------|--------------|
| standing still | 8 | -- |
| walking | 6 then 4 | one column per 10 ticks, 6 columns/s |
| running | 3 then 2 | one column per 5 ticks, 12 columns/s |
| crawling | 8 then 8 | one column per 16 ticks, 3.75 columns/s |
| falling | 4 | one row per 4 ticks, 15 rows/s |
| climbing | 10 | one rung per 10 ticks, 6 rungs/s |
| gliding | 8 | one column and one row per 8 ticks |
| leaping | 6 for the first arc step, then 4 | see the leap |
| knocked down | 15 | 11 steps, 165 ticks, 2.75 s |
| stooping or standing up | 5 | one-shot |

The clock, the creatures and the water animation run every tick,
independent of your step rate.  Movement freezes whenever something
hands control back to the outer loop -- the menu, a room edge, a door,
drowning, running out of food or rest, the spirit bell, the end of the
quest -- until that has been dealt with.

### The eleven cells you look at

At the top of every state step, and again after every move, eleven
cells around you are read into a snapshot:

your own cell; the cell left and the cell right; the floor and the two
cells diagonally below; the cells one, two and three rows above you;
and the cells two rows up to the left and to the right.

Every rule below reads that snapshot, not the room.  This matters
twice, and both are rules, not accidents: **the leap's landing test and
the glide's landing test use the cells as they were before that step's
own move.**

### The order of the checks

Each state step, in this order:

1. Take the snapshot.
2. If a stoop or stand-up pose is showing, end it.  Done.
3. If the floor supports you and you have fallen at least one row:
   fallen six rows or more, start the knock-down and stop here;
   otherwise play the landing sound and clear the fall count.
4. If you are half-way through a stride, take the other half.  Done.
5. If you are knocked down, run the next frame of that.  Done.
6. If you are leaping, take the next arc step.  Done.
7. If you are gliding, take the next glide step.  Done.
8. Otherwise read the joystick -- one direction and the button, once
   per step -- and follow the button-held or button-free rules.

Rules 4 through 7 are why gravity never interrupts a stride, a leap or
a glide: the support test in rule 3 only reaches the states that fall
through to rule 8.

### With the button held

First match wins.

1. You have fallen two or more rows, nothing is supporting you, and
   gliding is not inhibited: try to glide.  Carrying a shuba, you begin
   gliding -- fall count cleared, crawl cancelled, glide sound -- and
   take a glide step at once.  Carrying none, fall through to the
   button-free rules.
2. Pushed sideways with nothing supporting you: the button-free rules,
   so you keep falling.
3. Pushed the way you face, supported: leap.
4. Pushed the other way, supported: turn in place, one step.  But if a
   climbing pose is showing, you turn and leap off the ladder or vine
   that way instead -- the manual's "push the button and press the
   joystick sideways".
5. Pulled back while standing on support: the command menu opens.
6. No direction, standing on a doorway: go through the door.
7. Anything else: the button-free rules.

### With the button free

First match wins.

1. Nothing supporting you: fall one row and add one to the fall count,
   4 ticks.  The second row plays the falling sound.  This is the only
   path that does not clear the fall count -- which is exactly how fall
   depth accumulates.
2. Standing in the centre column of a ladder with more ladder below:
   only up and down are read; sideways is ignored.
3. Pushed sideways, not the way you face: turn in place, one step.
4. Pushed the way you face: walk.
5. Up: on a climbable cell, climb one row up.  Otherwise, if crawling,
   stand up (the 5-tick pose).  Otherwise nothing, and the step is
   spent.
6. Down: with a climbable cell below, climb one row down.  Otherwise,
   if standing, stoop into a crawl (the 5-tick pose).  Otherwise
   nothing.
7. Centred: stand still at 8 ticks a step, and running is cleared.
   The figure is not redrawn, so whatever pose was showing stays --
   which is how a climbing pose can still be showing when rule 4 of
   the button-held rules looks for one.

**Ladders snap to the middle.**  Ladders and vines are three cells
wide.  Climbing into the left column moves you one column right, into
the right column one column left, into the centre not at all -- so you
always end up on the centre column.

### Walking

A stride is two half-steps.  The first takes 6 ticks and does not move
you; the second takes 4 and moves you one column in the facing
direction.  Running is 3 and 2; crawling is 8 and 8.

When the moving half-step lands you in a new column, the cell you moved
into -- as it stood before the move -- is tested: if it is solid you
rise one row and stand on it.  **That step-up is the only forward
collision response there is.**  Walking into a wall does not stop you:
you move, and the after-the-move checks throw you back and put you on
the floor.

Running is set only by a leap, and cleared when the stick returns to
centre, or by a climb, or by a knock-down.  So the manual's advice --
leap, then keep holding the direction -- is exactly right.

Carrying the spirit bell and walking onto a doorway tile in a cavern
rings it: a chime, the game pauses, "THE SPIRIT BELL RINGS".

### Leaping

1. A leap from a ladder or vine is refused underground: in the caverns,
   nothing happens.
2. Starting a leap costs 5 fatigue, plays the leap sound, sets running
   and cancels crawling.  The first arc step comes 6 ticks later; every
   later step 4 ticks.
3. Your stamina sets a hover count: 1 below 20, 2 at 20-29, 3 at 30 and
   above.
4. Every arc step moves you one column in the facing direction,
   unconditionally.
5. The row changes by -1, then -1, then nothing for the hover steps
   (hover count minus one of them), then +1, then +1.
6. On each of the two descending steps, the cell diagonally below you
   in the facing direction -- as it stood before that step's move -- is
   tested: if it is solid you rise one row and land on the ledge.
7. At the top of any arc step but the first, if the floor is solid the
   leap ends immediately, with a landing sound, and that same step is
   re-run from the beginning of the order of checks -- so you land and
   gravity or your input takes over without losing a step.

| stamina | hover | rows per step | columns | net rows | ticks |
|---------|-------|---------------|---------|----------|-------|
| under 20 | 1 | -1, -1, +1, +1 | 4 | 0 | 18 |
| 20-29 | 2 | -1, -1, 0, +1, +1 | 5 | 0 | 22 |
| 30 and up | 3 | -1, -1, 0, 0, +1, +1 | 6 | 0 | 26 |

The peak is always two rows above where you launched.  Gravity resumes
the instant the arc ends, so a leap off a ledge turns into a fall.
Only a strange elixer raises stamina, and no character starts above 20,
so the six-column leap is earned, not given.

*Watched in the emulator: hover forced to 1, 2 and 3 from flat ground
moved the player exactly 4, 5 and 6 columns with no net row change.*

### Climbing

A climb step happens after the row has already changed.

1. Running and crawling are cleared.
2. Off the top of the room, or on the bottom row, hands over to the
   room-edge rules.
3. On the top row, just climb.
4. Otherwise look at the cell you are entering and the one past it in
   the same direction.  If the cell you are entering is not climbable
   you have left the ladder: the stoop pose shows and the climb ends.
   If the one beyond is not climbable, the reaching-the-top pose shows.
5. Otherwise animate, play the up or down climb sound, and spend 1
   fatigue -- one unit per rung.

Because climbable counts as support, you never fall off a ladder cell.
Climbing off the top leaves you standing one row above the last rung.

### Gliding

A steerable 45-degree descent: one column and one row every 8 ticks.
Each glide step, in order:

1. If your own cell is solid, rise one row and the glide ends.
2. Otherwise, if the floor is solid, the glide ends.
3. Otherwise read the stick.  Pushed the way you do not face, you turn,
   with a sound, and glide the other way.
4. Move one column in the facing direction and one row down.

Both tests in 1 and 2 read the cells as they stood before the step.
Ending a glide plays the landing sound and hands you back to the normal
fall-and-land rules.  Bumping a wall ends the glide and inhibits
gliding; the knock-down that a wall bump causes clears the inhibit, so
in practice you can glide again once you stand up.

### Crawling

Pull down with no ladder below and you stoop; push up with no ladder
above and you stand.  Each transition is a one-shot 5-tick pose.  While
crawling:

- a stride is 8 and 8 ticks, 16 to the column;
- a laid vine rope becomes solid, so crawl-only surfaces exist -- the
  manual's "CRAWL across the vine rope, or you will fall";
- the head-clearance test is skipped, so you fit under things.

### After every move

Every committed step re-samples the eleven cells and then runs these,
in order:

1. **Bramble.**  Your own cell is a bramble, you have fallen fewer than
   two rows, and you are not gliding: you are put back in the last cell
   that passed these checks and knocked down; leap, glide, stride,
   running and crawling all cancelled.
2. **Wall.**  Your own cell is a wall, or -- unless you are crawling --
   your head is in a wall: you are put back in the last good cell,
   knocked down, leap and glide cancelled, and gliding inhibited.
3. **Water.**  You drown, and the game stops for the outer loop.
4. **Room edge.**  See below.
5. Otherwise the move stands, and this cell becomes the last good cell.

A knock-down is requested by setting the fall count to 10 -- more than
the threshold of 6 -- so the next state step that finds you supported
runs it.  Three unrelated things ask for one this way: a wall, a
bramble, and a creature standing in your cell.

### The knock-down

**Fall damage is one rule: six rows or more.**  Landing after five or
fewer costs a footstep sound and nothing else.

Starting a knock-down clears the fall count and the glide inhibit,
cancels leap, glide, stride, running and crawling, plays the knock-down
sound and spends 64 fatigue.  One roll in sixteen destroys one shuba
you are carrying: "YOUR SHUBA HAS TORN".

Then eleven steps of 15 ticks -- 165 ticks, 2.75 seconds -- with the
two seeing-stars poses alternating for eight of them and the stoop pose
for the tenth, before you stand.  Plus the 64 fatigue, this is the most
expensive thing that can happen to you short of starving.

*Watched in the emulator: a fall of 5 rows cleared with the fatigue
pool untouched; a fall of 6 fired the knock-down and left the pool
exactly 64 lower.*

### Leaving the room

Checked after every committed move.  Vertical wins if both apply, and
either way movement stops until the outer loop has changed rooms.

| you reach | you come out at |
|-----------|-----------------|
| past the left edge | column 39 of the room west, same row |
| past the right edge | column 0 of the room east, same row |
| above the top row | row 18 of the room north, same column |
| the bottom row | row 0 of the room south, same column |

East and west wrap within a row of the map rather than spilling into
the next; north and south do not wrap.  `world.md` owns the grid.

**Doorways.**  Press the button with the stick centred while standing
on a doorway and you request that door -- the command menu cannot be
opened from a doorway tile -- there are up to three per
room, and the tile says which.  The room's own data gives each one a
destination room, column and row.  If the room is locked you get "THE
DOOR IS LOCKED"; otherwise you arrive there **facing the other way**,
and indoors/outdoors flips (which is what changes the look of every
tile).  Locks and destinations are `world.md`'s.

**Water.**  Step into water and the game stops: "YOU WERE FOUND NEAR
THE WATER." / "TIME HAS PASSED.", and you wake in your own nid.

**Waking in your nid** is the game's only respawn -- there is no health
and no death, only lost days.  You are moved to your nid-place room,
lying down, one day later, with spirit energy back to your limit and
food and rest back to their caps.  RENEW is exactly this, and so is
every creature attack, with different text.

### The sounds you make

Two alternating footsteps, climbing up, climbing down, the leap,
landing, the second row of a fall, the glide starting, turning in
mid-glide, the door, the knock-down, the spirit bell, the rest chime,
and the menu's cursor and selection blips.  `assets.md` owns the sounds
and the sprite frame each state shows.

## Stamina, fatigue, food, rest, spirit

Six numbers, all of them shown by STATUS.  Starting values per
character are in `characters.json`.

| number | range | what it does |
|--------|-------|--------------|
| stamina | 10-20 at the start | how far you leap, and your carrying limit |
| food | 0 to its cap | below zero costs you a day |
| rest | 0 to its cap | below zero costs you a day |
| spirit limit | 0 upward | permanent; decides which skills you have |
| spirit energy | 0 to the limit | the pool skills spend |
| standing with Kindar, standing with Erdlings | 0-5 | how people of each kind react (`creatures.md`) |

The food cap and the rest cap are held separately but always set to the
same value, so nothing at run time tells them apart.

### Fatigue

There is no health.  Moving burns a hidden pool of 256 that starts full
and simply wraps round; every wrap costs one food **and** one rest.

Costs: **a leap 5, each rung climbed 1, a knock-down 64.**  Walking,
running, falling and gliding are free.  So one unit of food buys about
51 leaps, or 256 rungs, or 4 knock-downs.

When a wrap takes food or rest below zero, that number is clamped to
zero, the game stops, and you get "YOU SPENT A DAY RECOVERING" / "FROM
A LACK OF" / "FOOD" or "REST", and wake in your nid a day later.
Sleeping in the other world freezes the fatigue drain entirely.

The other drain is the clock: food and rest each drop by one every
hour, and 5 spirit energy comes back, capped at your limit.  That is
`time.md`'s.

### Getting it back

| by | effect |
|----|--------|
| eating roast lapan, pan bread, or fruit & nuts | food +5, capped |
| HEAL | food +2 and rest +2, capped; costs 5 spirit energy |
| REST in a nid | rest +4 per chime, capped, one hour each |
| waking in your nid | food, rest and spirit energy all filled; costs a day |
| eating a strange elixer | stamina +5; food and rest set to half the new stamina, their caps with them; carrying limit +5 |

## What you carry

**There is no inventory list.**  Every object in the world has a slot
holding the room it lies in, its column and row, whether it exists, and
whether you are carrying it.  An object is in your inventory when that
last flag is set.  Clearing a slot destroys the object permanently, and
nothing is ever created except a token from a sale.

**The object number is the class.**  The 255 slots are cut into fifteen
contiguous ranges, one per item class, and every verb looks only at the
class -- see `items.json`.

| rule | value |
|------|-------|
| weight | 1 for a token, 5 for everything else |
| carrying limit | stamina + 26: 46 for Neric, Genaa and Herd, 41 for Charn, 36 for Pomma |
| so | the strong three carry nine full-weight items, Charn eight, Pomma seven |
| refused | when what you carry plus the new item would reach the limit: "YOU CAN CARRY NO MORE" |

**You start carrying nothing.**  What the manual calls "provided in
your nid-place" is lying on the floor of your first room -- one food
item, one shuba and three tokens, per character, listed in
`characters.json` -- and you have to TAKE it.

Money is tokens and nothing else.  Everything sellable is worth exactly
one token and BUY costs exactly one token.  A sale needs a free slot in
the token range, and there are 75 of those against 62 tokens in the
world at the start, so the world can hold only 13 more before sales
start failing.  The economy is `time.md`'s.

## The command menu

Pull the stick back with the button held while standing on support.
The game stops for the whole of the menu **and for the verb it runs**:
the clock and the creatures are frozen until the verb returns.

A grid of names is drawn over the text panel.  The stick walks it,
clamped at the edges with no wrap; the button selects.

| | | | | |
|---|---|---|---|---|
| PAUSE | TAKE | DROP | EXAMINE | STATUS |
| SPEAK | BUY | SELL | INVENTORY | RENEW |
| PENSE | USE | HEAL | GRUNSPREKE | MENU |
| OFFER | EAT | REST | KINIPORT | *(blank)* |

The blank cell does nothing and returns you to the cursor.  PAUSE
closes the menu.  MENU leaves the quest where it is and goes back to the main
menu.

**Picking an item.**  Five verbs share one paging interface: push up to
page forward through what you carry, press the button to choose what is
showing.  Past the last entry comes "NOTHING", and past that the first
entry again; choosing "NOTHING" cancels.  USE, EAT, SELL and OFFER show
one entry per class; DROP and INVENTORY show one entry per object.
USE, EAT and SELL also skip the classes they cannot act on.

**How often the stick is read.**  This matters only to the attract demo,
which feeds one script entry per read (`time.md`).  The menu reads until
the button is up, then once per cursor move or choice.  A verb that pages
reads until the button is up, then once per page or choice.  Every verb
but DROP and PAUSE then reads until the button is up, then until the
button is pressed or the stick moves, and clears the panel before the
room loop resumes -- so a verb's message lasts until your next push.
REST's chime pauses read every iteration and any push wakes you; waking
reads until the button is up and returns without the wait above.  Read
counts watched in VICE; `tools/trace_demo.py`.

## The verbs

Preconditions are checked in the order given; the first failure prints
its message and the verb returns.

**PAUSE** -- clears the text panel.

**INVENTORY** -- prints "YOU HAVE" and pages through every object you
carry.  The button does nothing here, so paging off the end is the only
way out; carrying nothing prints "NOTHING".

**EXAMINE** -- finds the object you are standing over: "IT LOOKS LIKE"
and the item's name, or "THERE IS NOTHING OF INTEREST HERE".  Free, and
needs nobody's permission.

*Finding the object you stand over*: if the cell two rows above you is
an object tile, that is the one; otherwise your own cell; otherwise
nothing.  An object paints two cells side by side and the tile says
which half you are on, so a right-hand half looks one column left.  The
object is the one that exists, is not carried, and sits at that cell.

**TAKE** -- nothing there gives "NOTHING HERE TO TAKE".  Then
permission, first match winning:

| test | |
|------|--|
| it is D'ol Falla's key and she has revealed it | allowed |
| you are outdoors | allowed |
| the sample quest is running | allowed |
| the room is your own nid-place, or `S0`, `R1`, `B2` or `H2` | allowed |
| a merchant or anyone else has just offered exactly this class | allowed |
| otherwise | "IT WAS NOT OFFERED TO YOU" |

Then the weight check, then the object is yours: "YOU FIND" and the
item's name, the room repaints without it, and the offer is spent.

**DROP** -- works out where the thing would land *before* asking what
to drop:

- indoors in your own nid-place, with the shelf over your own nid
  directly above you and the cells above clear of objects, it goes on
  the shelf, two rows up;
- otherwise the floor must be solid, your own cell must be free of
  objects, and the cell in the facing direction must be solid and be
  neither an object, a wall nor a bramble -- that cell is where it
  goes;
- anything else gives "NOT HERE".

Then you page through what you carry.  The chosen object is rewritten
into this room at that cell, the room repaints and the weight comes
off.  Dropping the *lit* honeylamp instead destroys it: "YOUR LAMP
VANISHES".

**USE** -- pages through the honeylamp, the wand of Befal, the trencher
beak, the vine rope and the two keys.  All the cutting tools share one
sweep: for the column in front of you and then your own column, the
five cells from your row up to four rows above are checked, and every
matching tile is erased.

- *A honeylamp*: already lit gives "YOUR LAMP IS ALREADY LIT".
  Otherwise it lights -- "YOUR LAMP IS LIT", the room repaints lit --
  and burns for 10 to 13 room edges crossed, chosen at random, after
  which it is destroyed and its weight comes off.  Doorways do not count.
- *The wand of Befal*: a creature within two columns and one row that
  is not already frozen is frozen and taken out of the room, costing
  you 5 spirit limit (1 for a lapan, sima, snake or spider, never below
  zero) and
  setting your spirit energy to zero.  Then, creature or not, it cuts
  bramble: "THE WAND CUTS SWIFTLY", or "THE WAND IS USELESS HERE" if
  there was none.  Never consumed.
- *A trencher beak*: cuts bramble.  Nothing cut gives "THE BEAK IS
  USELESS HERE".  Otherwise one time in sixteen it breaks -- "THE
  TRENCHER BEAK BREAKS" with the knock-down sound -- and the rest of
  the time "THE BEAK CUTS SLOWLY".
- *A vine rope*: the row below you is scanned in the facing direction
  for the first cell that is not empty.  Reaching the room edge first
  gives "THE ROPE IS USELESS HERE"; otherwise the span is filled with
  rope and the rope is consumed.  You can only cross it crawling.
- *The temple key*: anywhere except `A2`, it removes the temple wall in
  front of or above you.  Success plays a tune from the random pool;
  nothing removed gives
  "THE KEY IS USELESS HERE".  Never consumed.
- *D'ol Falla's key*: only in `A2`, where it removes the wall and, if
  you face right, prints "ENTER THE CHAMBER OF THE FORGOTTEN"; then the
  same random tune.

**EAT** -- pages through roast lapan, pan bread, fruit & nuts,
wissenberries and the strange elixer.  The object is destroyed and its
weight comes off either way.

- *Roast lapan*: Herd and Charn, the two Erdlings, get "THE LAPAN IS
  GOOD"; everyone else gets "THE LAPAN HAS A STRANGE TASTE" and loses
  15 spirit energy, never below zero.  Both then take food +5.
- *Pan bread*: "THE PAN BREAD IS GOOD", food +5.
- *Fruit & nuts*: "THE FRUIT & NUTS ARE GOOD", food +5.
- *Wissenberries*: two hours pass, "YOU FEEL STRANGE.  TIME PASSES.",
  and 15 spirit energy goes.  No food.
- *A strange elixer*: "YOU FEEL MUCH STRONGER".  Stamina +5, food and
  rest set to half the new stamina with their caps to match, and the
  carrying limit up by 5.  Permanent, and it lengthens your leap.

**HEAL** -- spirit limit at least 15, else "YOU LACK THE SPIRIT SKILL";
spirit energy at least 5, else "YOU NEED MORE SPIRIT ENERGY".  Spend 5,
then food +2 and rest +2, each capped: "YOU HEAL YOURSELF".

**GRUNSPREKE** -- spirit limit at least 20 and spirit energy at least
2, and you must be outdoors, else "GRUNSPREKING DOESN'T WORK HERE".
The floor must be a limb top and the cell diagonally in front and one
row down must not already be one.  A new limb grows there, 2 energy
goes: "THE LIMB GROWS".

**KINIPORT** -- spirit limit at least 25 and spirit energy at least 5.
A pointer appears, moving one cell per push, clamped to the room, with
the button to choose.

- Point at your own column on your own row, one row up or two rows up
  and you mean **your body**: that needs spirit limit 30 and 10 energy,
  and then "KINIPORT YOUR BODY WHERE?" repeats until you pick a cell
  with support beneath it that is not a wall, a bramble or an object.
  You appear there; 10 energy goes.
- Otherwise you mean **a tool**: what you point at must be an object
  ("YOU CAN'T KINIPORT THAT" if not), the pointer snaps to the object's
  left half, and "KINIPORT THE OBJECT WHERE?" repeats until both halves
  of the destination are clear of walls and objects, the cell below has
  support, and it is not the last column.  The object moves there; 5
  energy goes.

**STATUS** -- paints four lines and returns; they stay on the panel
until something else writes it:

| | left | right |
|---|------|-------|
| | DAY *n* | your name |
| | the time of day | LEVEL OF REST *n* |
| | SPIRIT LIMIT *n* | LEVEL OF FOOD *n* |
| | STAMINA *n* | LEVEL OF SPIRIT *n* |

**RENEW** -- refused silently while you are in the other world.
Otherwise "YOU WERE FOUND UNCONSCIOUS." / "TIME HAS PASSED.", and you
wake in your nid: a full refill for the price of one day.

**REST** -- you must be indoors with the left end of a nid directly
above you, else "THERE IS NO NID HERE"; and the nid must be your own or
have been offered to you, else "NO ONE OFFERED YOU A NID".  Then you
walk right to the far end of the nid, step back one and lie down, and
loop: paint STATUS, ring the chime, advance one hour, rest +4 up to the
cap.  Any joystick movement aborts the verb -- that is how you wake
(`time.md`, REST and sleeping, has the pauses).
Because food drops one an hour too, oversleeping starves you.  Which
nids give you a dream, or a robbery, instead of a nap is
`creatures.md`'s and `time.md`'s.

**SPEAK** and **PENSE** are `creatures.md`'s.  **BUY**, **SELL** and
**OFFER** need a merchant or a person one or two columns ahead in the
direction you face, within one row, facing back at you, else "NO
RESPONSE"; the prices and the quest ending are `time.md`'s.

**MENU** returns to the main menu; CONTINUE picks the quest up where
you left it (`shell.md`).

## Spirit skills

Two numbers.  **Spirit limit** is permanent and decides which skills
you have: a skill works when your limit reaches its threshold, and
failing that gives "YOU LACK THE SPIRIT SKILL".  **Spirit energy** is
the pool a use spends, refilled by 5 every hour up to the limit;
failing that gives "YOU NEED MORE SPIRIT ENERGY".

| skill | limit | energy | range |
|-------|-------|--------|-------|
| PENSE EMOTIONS | 5 | 1 | anywhere in the room |
| PENSE MESSAGES | 10 | 1 | next to them |
| HEAL YOURSELF | 15 | 5 | yourself |
| GRUNSPREKE | 20 | 2 | the cell in front and one down |
| KINIPORT TOOLS | 25 | 5 | anywhere in the room |
| KINIPORT YOUR BODY | 30 | 10 | anywhere in the room |

Only Pomma, starting at 10, begins with two skills; Neric, Herd and
Charn begin with one; Genaa, at 0, with none.  Neric needs three spirit
gifts to reach HEAL.

The limit rises two ways, both through the same announcement: **+5**
the first time you SPEAK to one of the five blessers, which also
refills your spirit energy to the new limit, and **+1** the first time
you pense a message from each of the ten animals.  It falls only when the wand of Befal
banishes someone (-5, or -1 for an animal).  The announcement names the
skill you have just reached and, for the first five, shows a vision;
both belong to `creatures.md`.

PENSE has its own copy of the skill-gate message, and that copy reads
"YOU LACK THE SPRIT SKILL".  The typo shipped; reproduce it.

## What costs you a day

There is no death and no health.  Everything that goes badly ends the
same way: you wake in your own nid one day older.

| cause | what you see |
|-------|--------------|
| falling six rows, a wall, a bramble, or a creature touching you | 2.75 s knocked down, 64 fatigue, one chance in sixteen of losing a shuba -- no day lost |
| stepping in water | "YOU WERE FOUND NEAR THE WATER." / "TIME HAS PASSED." |
| food or rest going below zero | "YOU SPENT A DAY RECOVERING" / "FROM A LACK OF" / "FOOD" or "REST" |
| being attacked | "YOU WERE ATTACKED BY A FOLLOWER OF D'OL SALAAT.  TIME HAS PASSED." or "...BY A MEMBER OF THE NEKOM." |
| RENEW | "YOU WERE FOUND UNCONSCIOUS." / "TIME HAS PASSED." |
| reaching day 51 | "THE LIGHT FADES INTO DARKNESS..." / "THE TIME FOR YOUR QUEST HAS ENDED." / "GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER." -- the quest is over |

Being kidnapped costs no day: "YOU WERE KIDNAPPED BY THE FOLLOWERS OF
D'OL SALAAT" or "YOU WERE KIDNAPPED BY THE NEKOM", and you wake
somewhere else.

Every message the player and its verbs print is a fixed string at a
fixed place on the text panel; none of them come from the numbered
table of things people say, which is `creatures.md`'s.

## Open questions

- **A sixth character.**  The sample quest runs a character that is not
  one of the five: spirit 10, stamina 20, Herd's nid-place, and a shuba
  already in hand.  `characters.json` lists the playable five only, so a
  port driving its demo from that table needs a sixth entry.
- **Why those four rooms allow taking indoors.**  Three of them hold
  quest items -- the wand of Befal, the spirit lamp, the temple key --
  which explains those.  The Salaat kidnap room is unexplained.
- **The food cap and the rest cap** are held separately and always set
  equal, so nothing in a run tells them apart.  Kept apart in case a
  save from a version that did distinguish them turns up.
- **Two shipped bugs**, in the README's port notes: a breaking trencher
  beak subtracts the vine rope's weight instead of its own (both are 5,
  so it never shows), and BUY reserves 4 units of carrying capacity
  when every non-token item weighs 5, so a merchant can sell you a
  permission you cannot use.

---

Derived from `docs/player-physics.md`, `docs/verbs-and-inventory.md`
and `docs/menus-and-saves.md`.
