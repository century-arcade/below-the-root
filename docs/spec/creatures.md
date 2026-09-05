# Creatures

A room holds at most one creature: one moving figure that is not you.  121
rooms have one, and each creature stays in its room for the whole quest.
`docs/spec/data/creatures.json` is the table -- one entry per room: figure,
colour, where it starts and patrols, what it says, what it is for.
`docs/spec/data/messages.json` is the text: the 187 numbered lines the
creatures draw from, plus the fixed lines the verbs print themselves.

## The eleven looks

Long- and short-haired Kindar adults (19 rooms each), long- and
short-haired Erdling adults (12 and 17), long- and short-haired children
(7 each), lapans (5, rabbit-like), simas (5, curl-tailed climbers), snakes
(9), spiders (15), and the robed Ol-zhaan with his staff (6).  The Kindar
and Erdling adults are the same two figures in different colours: race
shows in which standing the response gate tests, never in the shape.  Each
figure is one flat colour, three cells wide and about five tall, with
three walking frames.  The six Ol-zhaan are the Hermit (`91`), D'ol Falla
(`72`), D'ol Neshom (`V5`), Vatar (`CF`), and two who are only there to
talk (`41`, `V1`).

Only two rules branch on the figure rather than the role: snakes and
spiders use the contact rule below instead of stopping for you, and never
take the long idle pause; and the wand of Befal costs 1 spirit limit
against a lapan, sima, snake or spider instead of 5.

## The roles

| role | count | rooms |
|------|-------|-------|
| plain talker | 31 | scattered; includes Raamo at `GE` |
| snake or spider | 24 | nine snakes and fifteen spiders, mostly in the caverns |
| gift-giver | 22 | 16 who give an item, 6 who offer a nid |
| ambusher | 12 | see Ambush |
| pensable animal | 10 | `32` `23` `U3` `64` `U4` `06` `L6` `89` `S9` `GF` |
| merchant | 8 | `Q0` `51` `61` `71` `E1` `02` `42` `52` |
| nid trap | 6 | `K0` `U1` `H1` `T0` `81` `A1` |
| blesser | 5 | the Wise Child `J0`, the Hermit `91`, Raamo's Mother `K3`, D'ol Neshom `V5`, Vatar `CF` |
| gate guard | 2 | `0B` and `01` |
| D'ol Falla | 1 | `72` |

A plain talker has a line, an emotion and usually a message, and no other
effect: no once-a-day limit, nothing to give.

## Where and when they appear

A creature is placed fresh every time you enter its room, and again when
you come back through a door.  Nothing carries over between visits except
the three things listed under What each creature remembers.

1. A creature you banished with the wand of Befal does not appear, ever
   again.
2. An ambusher only sometimes appears.  Each remembers the hour of the day
   it was last seen in, and that memory starts at early morning.  If the
   current hour matches, it appears.  If not, it appears one time in four
   -- and when it does, it starts remembering this hour instead.  So an
   ambusher you have never met is certain to be there in early morning and
   there one time in four otherwise; once you meet it in some hour it
   keeps that hour until a one-in-four roll moves it on.
3. It stands on its starting cell, shifted right by a random number of
   columns less than its spread (a spread of 2 means the starting cell
   or the next one; `col_random_span` in the table), facing left or
   right at random; the first move comes 4 ticks later.  Every spread
   lies strictly inside the creature's own patrol columns, so it always
   starts where it can walk, and never on a turning column -- a creature
   standing on one turns whichever way it faces, and one born there
   facing inward would turn outward and walk off its ledge.

Leaving the room hides the creature.  Nothing else removes one: talking to
it, paying it, sleeping in its nid and the passage of time all leave it
where it is.  Only the wand of Befal takes one out of the game.

## How they move

Creatures move on their own clock, once per tick (60 ticks a second),
independent of how fast you are moving.  Each carries a cell, a facing, a
stride phase and a countdown.  Every tick, count down; when the countdown
runs out, do exactly one of these, in this order:

1. If the creature is mid-stride, finish the stride (rule 7) and stop.
2. If the cell under it is not support (solid or climbable -- the same
   test that keeps you from falling), drop one row and wait 4 ticks.
   Gravity is the only piece of your physics a creature obeys -- they
   never swim, glide, climb, take falling damage or touch objects.  They
   do walk off ledges: the child in `0D` climbs the two stair steps
   beside its nid and drops off the far side every lap, and that is what
   the original does too (`tools/creature_watch.py`).
3. Snakes and spiders run the contact test below; ambushers run the ambush
   test.  Everyone else stops for you: if you are 1 or 2 cells ahead of
   the way it faces and within one row, it waits and does nothing more
   this tick.  That is why you never collide with a person.
4. If the creature stands on either of its two patrol columns and did not
   turn on its last move: turn around, show the standing frame, and wait
   12 ticks if it walks slowly, 8 if it walks quickly.
5. One time in eight, skip the step.  A snake or spider simply loses the
   move; anyone else stands still for a random 1 to 127 ticks, up to two
   seconds -- and one such roll in 128 comes out as 256 ticks, four whole
   seconds of standing there.
6. If the creature turned on its last move, take a stride half (rule 7).
   Otherwise, one time in sixteen turn around anyway (as rule 4); the rest
   of the time take a stride half.
7. A stride is two halves and moves the creature one column.  The first
   half lifts a foot: walking frame 1, then frame 2 next stride,
   alternating.  The second half puts it down: standing frame, one column
   the way it faces -- and if the cell it walked into was solid, one row
   up as well, so creatures step up single ledges the way you do.

Waits, in ticks:

| gait | after a turn | first stride half | second stride half | one column |
|------|--------------|-------------------|--------------------|------------|
| slow | 12 | 12 | 8 | 20 ticks (a third of a second) |
| quick | 8 | 10 | 6 | 16 ticks (about a quarter second) |

Twenty-seven creatures walk slowly, ninety-four quickly.  Nothing stops a
creature at the edge of the room; its patrol columns are the only thing
keeping it inside, and in every shipped room they do.

## Snakes and spiders

Snakes and spiders never speak and never stop for you.  Every time one
would move, it checks whether it has you: on its row or the row above it,
and on its cell, one cell ahead of it, or two cells ahead of it.  If so it
knocks you down -- it counts as a ten-row fall, so you get the same
knock-down: just under three seconds on the floor, 64 fatigue, and one
chance in sixteen of tearing a shuba.  A player already lying down is left alone.

They have nothing to say: SPEAK and PENSE both answer `NO RESPONSE`.

## Ambush

Twelve people are waiting for you: six followers of D'ol Salaat (Kindar)
and six of the Nekom (Erdlings), who look like anyone else.  Every time
one would move, it checks whether you are within one row of it and in one
of the four columns from two left of it to one right -- it does not care
which way it is facing.  If so the scene ends at once.

| where | what happens |
|-------|--------------|
| `35` `H7` `D8` | `YOU WERE KIDNAPPED BY THE FOLLOWERS OF D'OL SALAAT`; you wake in `S0` at (21,15) |
| `L5` `BB` `SB` | `YOU WERE KIDNAPPED BY THE NEKOM`; you wake in `R1` at (19,15), the Nekom's room, where the wand of Befal lies |
| `A4` `05` `H5` | `YOU WERE ATTACKED BY A FOLLOWER OF D'OL SALAAT.  TIME HAS PASSED.`; you wake in your own nid |
| `4C` `QC` `LF` | `YOU WERE ATTACKED BY A MEMBER OF THE NEKOM.  TIME HAS PASSED.`; you wake in your own nid |

A kidnap costs no time; an attack costs you a day.  The two kidnap
destinations are the same two rooms the nid traps use.

Ambushers have no speech and no message -- only an emotion, and the
emotion is the whole warning: `DEVIOUSNESS`, `INSANE FANATICISM`,
`HOSTILITY`, `RAGE`.  Pense a stranger from across the room before you
walk up to them.

## Being next to someone, and the gate

SPEAK, BUY, SELL, OFFER and the message half of PENSE all need you to be
next to the creature: it stands one or two cells ahead of the way you
face, within one row of you, and not facing the same way you are -- you
are looking at each other.  Reading an emotion needs none of that; it
works from anywhere in the room.

Every creature also tests one of your two standings -- with the Kindar or
with the Erdlings -- against a level, and says one of two things depending
on the answer.  Your standings are fixed when you pick your character.

109 creatures test for level 0, which every character passes.  Only twelve
can ever turn you away: eleven gift-givers (`40` `60` `70` `80` `B0` `E0`
`P0` `J1` `N1` `O1` `S1`, at levels 1 to 4) and one plain talker (`I2`, at
level 4).  Which of the twelve snub you depends on who you play: Pomma
passes every gate in the game, Herd and Charn are turned away by nearly
every Kindar gate, Neric by all four Erdling ones.  Those same twelve are
the only creatures with any gate-failed lines, so nothing in the data goes
unused.

## SPEAK

1. If there is no creature, or you are not next to it: `SPEAK WITH WHOM?`
   and nothing else happens.
2. If it is a gift-giver and your standing passes its gate, two extra
   checks run.  Only for gift-givers; every other role talks
   unconditionally.
   1. If it gives an item and nothing at all is lying on the floor of this
      room, it says `I HAVE NOTHING MORE TO GIVE` and stops.  The test is
      for any object, not one of the kind it gives: strip a room bare and
      its gift-giver has nothing to offer, whatever it was offering.  A
      gift-giver offering a nid skips this check.
   2. If it has already been spoken to today: `COME BACK TOMORROW, MY
      FRIEND`, and stop.
3. Take the pair of speech lines the gate chose.  If the first is empty:
   `NO RESPONSE`, and stop.  Otherwise say the first line, and the second
   if there is one.
4. Stamp today onto the creature.  Every creature that says anything is
   stamped, but only gift-givers ever read it back, so plain talkers,
   blessers and merchants can be spoken to as often as you like.
5. If the gate passed and it is a gift-giver, a blesser, D'ol Falla or one
   of the nid traps, you now have permission to take -- see Permission
   below.  D'ol Falla also unlocks her key permanently at this point.
6. If it is a blesser and it has not blessed you before: mark it, add 5 to
   your spirit limit, refill spirit energy to the new limit, play a tune
   from the random pool, and run the new-skill and vision sequence.

Step 6 sits outside the gate test, but never comes up: all five blessers
have a level-0 gate.  Only SPEAK blesses -- pensing a blesser costs energy
and gives nothing back.  Five blessers at +5 and ten animals at +1 is +35
of spirit limit over a quest, on top of a start of 0 to 10; the skill
ladder tops out at 30, so a player who finds everyone has room to spare,
and each person banished with the wand costs 5 of it back.

## PENSE

1. If there is no creature in the room: `PENSE WHOM?`.
2. If your spirit limit is under 5: `YOU LACK THE SPRIT SKILL` (the
   misspelling is the game's).
3. If your spirit energy is 0: `YOU NEED MORE SPIRIT ENERGY`.
4. Print the `EMOTION:` label and take the emotion the gate chose.  If it
   is empty: `NO RESPONSE`, and this half costs nothing.  Otherwise print
   the emotion and spend 1 spirit energy.  Distance does not matter.
5. The message half is a stricter skill, and simply stops -- no text -- if
   your spirit limit is under 10, your energy has run out, you are not
   next to the creature, or it is an animal you have already pensed.
6. Print the `MESSAGE:` label and take the message the gate chose.  If it
   is empty: `NO RESPONSE` under the label, and the emotion still cost its
   1.  Otherwise print it and spend a second spirit energy.
7. If it is one of the ten animals: mark it, add 1 to your spirit limit,
   refill energy to the new limit, play a tune from the random pool.
   The fifth animal you
   pense, whichever it turns out to be, also runs the vision sequence.

A full pense costs 2 spirit energy, one per half.  All ten animals say the
same thing -- emotion `WARMTH`, message `THE SPIRIT RISES WITHIN` -- and
each is worth +1 once per quest.

## BUY and SELL

1. If the creature is not a merchant: `THERE IS NO MERCHANT HERE`.
2. If you are not next to it: `NO RESPONSE`.
3. BUY: with no token, `YOU NEED MORE TOKENS`; carrying too much,
   `SORRY, YOU'RE CARRYING TOO MUCH`; otherwise a token is spent and the
   merchant says `TAKE WHICHEVER ONE PLEASES YOU`.  BUY hands over
   nothing -- it grants permission to TAKE one of that shop's stock off
   the floor, and TAKE is what moves the item.
4. SELL: `WHAT WILL YOU SELL?` and your inventory cycles.  If there is no
   room for the token you would be paid, `SORRY, I'M NOT INTERESTED`;
   otherwise the item becomes a token and the merchant says
   `HERE'S YOUR TOKEN`.

Everything costs a token and everything sells for a token, at every shop.
The eight are `Q0` roast lapan (`WOULD YOU LIKE A ROASTED LAPAN?`), `51`
fruit & nuts, `61` trencher beaks, `71` honeylamps (`HAVE A NICE HONEY
LAMP?`), `E1` wissenberries, `02` shubas, `42` vine rope (`VINE ROPE IS
VERY USEFUL`) and `52` pan bread (`I'VE FRESH PAN BREAD`).  Every one of
them says `ONLY A TOKEN` as its second line.

## OFFER

With nobody next to you, OFFER asks `OFFER TO WHOM?`.  Otherwise it asks
`OFFER WHAT?` and cycles your inventory, then looks at which creature this
is -- not at its role.  Exactly three creatures accept anything.

| who | accepts | result |
|-----|---------|--------|
| Raamo, `GE` | a shuba or a vine rope | the quest ends and is scored |
| the outer gate guard, `0B` | wissenberries | one passage through her door now; the second wissenberry she is ever offered opens it for good |
| the inner gate guard, `01` | a token | one passage through his door, every single time |

Offering one of those three the wrong thing: `THAT WON'T HELP`.  Offering
anything to any other creature: `NO RESPONSE`.  A guard who accepts says
`YOU MAY ENTER` and swallows what you gave her.

## Permission

Creatures never hand anything over.  All they do is grant permission, and
your own verbs spend it.  Permission is cleared by a successful TAKE and
by every room load, so an offer has to be spoken for and used in the same
visit -- walk out and it lapses, though you can come back and ask again.

- **TAKE** always works outdoors, and indoors in your own nid-place and in
  four rooms: `S0`, `R1`, `B2` (the Chamber of the Forgotten) and `H2`.
  Anywhere else indoors it needs permission, and the object must be of the
  kind that creature offers, else `IT WAS NOT OFFERED TO YOU`.
- **REST** away from your own nid needs permission from a creature that
  offers a nid, else `NO ONE OFFERED YOU A NID` -- on top of REST's own
  requirement that you stand indoors under a nid.  Resting does not use
  the permission up, so one offer lasts as long as you stay.
- **D'ol Falla's key** is the exception to the matching rule: once she has
  been spoken to it can be taken regardless, and that lasts the quest.

The 22 gift-givers give once a day each, as long as anything is still
lying on their floor.  Sixteen give an item -- pan bread, roast lapan,
fruit & nuts, a shuba, tokens, and the temple key at `H2` -- and six offer
a nid instead (`70` `80` `B0` `M0` `P0` `D2`).  Four of the five blessers
nominally offer a spirit bell, but only D'ol Neshom's room holds one,
which is why his line is `I GRANT YOU THE SPIRIT BELL`.

## Nid traps

Six of the twelve people who offer you a nid are lying.  The trap springs
after you have slept and been restored, and only if you have not banished
them.

| where | what they do |
|-------|--------------|
| `K0`, `U1` | every token you carry is gone, and nothing is said |
| `H1` | every shuba you carry is gone |
| `T0` | kidnapped by the followers of D'ol Salaat; you wake in `S0` at (21,15) |
| `81`, `A1` | kidnapped by the Nekom; you wake in `R1` at (19,15) |

Their emotions give them away -- `AVARICE`, `GREED`, `DECEIT`, `GUILE`,
`FURTIVENESS` -- and their pense messages are blunter still: `SLEEP WELL,
FOOL`, `THE NEKOM WILL PAY ME WELL`, `D'OL SOLAAT'S MEN ARE WAITING`.

## The two gate guards

The two doors into the caverns are in series, each with a guard in front
of it.  The outer guard is on the ground at `0B` (`MAY I SEE YOUR PASS?`);
her door leads to `00`, and from there you walk south into `01`, where the
inner guard (`WAIT A MINUTE.  I WANT TOKENS.`) stands before the door to
`0C`, the first room below the root.

A guarded door opens only if that guard has been banished with the wand of
Befal (which opens it permanently), or -- the outer guard only -- has been
offered a second wissenberry at some point (which marks her banished just
as the wand would: her door opens for good and she never appears again),
or you have paid this visit, which buys exactly one passage.
Otherwise: `THE DOOR IS LOCKED`.  The check looks at the room's guard
whether or not she is standing there, so banishing one does not sneak you
past the lock -- it sets the flag that opens the door instead.

## The wand of Befal

USE a wand of Befal while a creature is next to you and it is gone from
the game.  The rule for "next to" is looser here than for talking: the
creature may be in your own column, one cell ahead or two, within one row,
and it need not be facing you.

Banishing is permanent and survives a save: the creature never appears
again, its nid trap and its ambush are dead, and if it was a gate guard
its door is open for the rest of the quest.  The cost is 5 off your spirit
limit for a person, 1 for a lapan, sima, snake or spider, plus all your
current energy -- a whole blessing undone.

## The spirit gift announcement

Every rise in your spirit limit -- the +5 of a blesser's first SPEAK,
and the fifth animal's +1 -- runs the same two screens.

1. Unless the limit is 35 or more, the panel prints `CONGRATULATIONS
   QUESTER, YOU HAVE` on its first row and `GAINED THE POWER TO` and a
   skill name on its second.  The skill named is the one at the limit's
   current step of five, whether or not the rise reached it: PENSE
   EMOTIONS at 5-9, PENSE MESSAGES at 10-14, HEAL YOURSELF at 15-19,
   GRUNSPREKE at 20-24, KINIPORT TOOLS at 25-29, KINIPORT YOUR BODY at
   30-34.  The first four animals raise the limit by one without any
   announcement.
2. If fewer than five visions have been shown this quest, `A VISION
   COMES TO YOU:` on the first row and the next vision's text from the
   second (`quest.json` `visions`, in order), and the count goes up.

Each screen prints, a tune from the random pool plays out, and then the
button is waited for like every other message.

## What each creature remembers

Three things per creature, all saved with the game and all cleared when a
new quest starts:

- **Banished** -- hit with the wand of Befal.  Read when the creature
  would appear, when a nid trap would spring, and by the two guarded
  doors.
- **The day it was last spoken to** -- stamped on every creature that says
  anything, read only by gift-givers, for their once-a-day rule.  An
  ambusher never talks, so for one of those this same memory holds the
  hour it last appeared instead; the two never collide.
- **Its once-a-quest gift taken** -- set when a blesser blesses you, or
  when you pense an animal's message.

Three more flags sit outside that, one per kind of permission: what has
been offered you and whether you have paid a guard this visit (both wiped
on every room load), and whether D'ol Falla has been spoken to (which
lasts the whole quest).

## Open questions

- **Creatures can walk out of the room.** Nothing clamps a creature to the
  playfield; its patrol columns are all that keep it inside, and every
  shipped room sets them safely.  But the step-up rule moves a creature's
  row with no range test, so a creature that drifts out of range reads
  cells that do not exist.  Beyond the edges the original reports empty
  space, which has no support: such a creature falls forever.
- **One tile means different things depending on what you are doing.** The
  tile for an object resting in a nid counts as solid ground only while
  *you* are crawling, and creatures share that test, so one standing over
  it would gain and lose its footing with your posture.  No shipped room
  seems to place a creature there; treating the tile as never supporting a
  creature is the safer choice.
- **Is the inner guard's toll meant to be permanent?** Nothing you can say
  to him opens his door for good, so the token is due every single visit
  unless you banish him.  His line -- `WAIT A MINUTE.  I WANT TOKENS.`,
  plural -- reads as if that is deliberate, and so does the shape of the
  world: the door you unlock for good is the outer one on a route you walk
  over and over, and the toll is the last step down.  The manual does not
  say, and a one-line omission is just as likely.
- **Three blessers offer a spirit bell that is not there.** Four of the
  five nominally offer one, but only D'ol Neshom's room holds a bell, so
  for the other three the permission their SPEAK grants can never be
  spent.  A port that adds a second bell would find three more places to
  pick one up.
- **The pause between the congratulation and the vision** is read from
  the code as a wait for input; nobody has watched the two screens go
  by.
- **Three lines of dialogue nobody says.** The numbered text table has an
  unused `NOTHING` and two placeholders.  They stay in place to keep the
  numbering, but nothing refers to them and what they were for is not
  recoverable.

Derived from `docs/npcs-and-objects.md` and `docs/messages-and-dialog.md`.
