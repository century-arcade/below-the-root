# Time: the clock, food and rest, the economy, the quest and the endings

Everything that changes over a quest rather than over a frame.  Times
are in ticks -- one tick is one video frame, 60 a second.  Tables are in
`data/economy.json`, `data/quest.json`, `data/demo.json` and
`data/save.json`; rooms go by their two-character code.

## The clock

An hour of game time is 8960 ticks: two and a half minutes of play.
Eight hours make a day, so a day is twenty minutes.

The clock only runs while you are moving about the world.  It stops the
moment a menu, a verb, a line of text or any wait-for-input is on screen
-- the manual's promise that time does not pass while the Option Menu is
up -- and it is frozen from the moment you sleep in the sky nid until
the doorway that brings you back from the cloud world.  It also stops
while a room loads: about a hundred ticks on the original for every edge
crossed or doorway taken.  Three things advance it by a whole hour
without waiting: each hour you sleep in a nid, and eating wissenberries,
which costs two.  A forced hour restarts the count of 256-tick wraps but
not the wrap in progress, so the next natural hour is between 8705 and
8960 ticks away; a port that restarts the whole count is within four
seconds of it.

Every new hour, in order:

1. The hour advances; after the eighth it wraps and the day goes up.
2. If that makes it day 51 the quest is over (see The endings), and
   nothing below happens.
3. Food drops by one.  Below zero it clamps at zero and you lose a day.
4. Rest drops by one, the same way.
5. Spirit energy rises by 5, up to your spirit limit.

The eight hours are EARLY MORNING, LATE MORNING, EARLY AFTERNOON, LATE
AFTERNOON, EARLY EVENING, LATE EVENING, MIDNIGHT and LATE NIGHT.  Two
things read the hour: the status display, and the hour each ambusher
favours (`creatures.md`).  There is no day/night cycle to draw -- no
colour, music or lighting change.  A room below the root is as dark at
noon as at midnight, and only a lit honeylamp or the spirit lamp lifts
that.

The day number starts at 1.  Day 51 ends the quest, the final rank is
computed from it, the status display prints it, and a new day re-arms
every gift-giver in the world -- each says COME BACK TOMORROW, MY FRIEND
once it has given you something today.

## Food, rest and fatigue

Food and rest are two small counters.  Both top out at half your stamina
-- 10 for the three strong characters, 7 for Charn, 5 for Pomma -- and
both start full.  Either going below zero costs you a day.

| drain | cost | when |
|-------|------|------|
| the clock | 1 food, 1 rest | every hour |
| fatigue debt | 1 food, 1 rest | every 256 points of effort |
| everything else | nothing | walking and falling are free |

Fatigue is a hidden 256-point reserve, full at the start of a quest.
Effort spends it; when it runs out it refills and takes one food and one
rest with it.  A ladder or vine rung costs 1, a leap 5, a knock-down 64
-- so one lap is 256 rungs, or 51 leaps, or 4 knock-downs.  Against the
clock's one food per two and a half minutes, climbing is the cheap drain
and crashing the expensive one.  Effort is free in the cloud world.

| action | food | rest | cost |
|--------|------|------|------|
| EAT roast lapan, pan bread or fruit & nuts | +5 | -- | the item |
| EAT wissenberries | -- | -- | two hours, 15 spirit energy |
| EAT a strange elixer | full | full | the item |
| HEAL | +2 | +2 | 5 spirit energy, spirit limit 15 |
| REST, per hour slept | -- | +4 | one hour |
| losing a day | full | full | a day |

Everything is capped; nothing overfills.  The elixer also adds 5 stamina
permanently, raising both caps, the carrying limit and possibly your
leap.  Roast lapan costs 15 spirit energy unless you are one of the two
Erdlings, Herd or Charn; the food is the same either way.

You can only collapse while the game is actually running.  During REST
and while eating wissenberries it is paused, so food and rest clamp at
zero silently -- you never collapse in your sleep.  The debt comes due
the moment you are up again, at the next hour or the next rung.

## REST and sleeping

REST needs you indoors, standing under the left half of a hanging nid,
with one of three permissions: it is the sky nid `90`, it is your own
character's nid place, or someone in this room has offered you their nid
this visit.  Otherwise: THERE IS NO NID HERE, or NO ONE OFFERED YOU A
NID.

You shuffle under the nid and lie down.  Then, over and over: the status
panel is drawn, the bell chimes three times with pauses either side, an
hour passes, rest goes up by 4 to the cap, and whatever the owner of the
nid does to sleepers happens.  Each pass makes eight pauses -- two before
the first chime, then one after each chime and each answering blip --
and every pause reads the stick over and over, so any joystick movement
wakes you and ends the verb; you never wake on your own.  Waking clears
the panel and waits only for the button to be up (the usual wait for a
push after a verb is skipped).  That is how you starve in your sleep --
food still drops every hour, silently, and collapses you when you stand
up.

Six of the twelve people who offer a nid are traps, and the trap fires
every hour you sleep, not once.  Banishing that person with the wand of
Befal is the only thing that stops it.

| the host | what happens |
|----------|--------------|
| a token thief | every token you carry is destroyed |
| a shuba thief | every shuba you carry is destroyed |
| a follower of D'ol Salaat | you wake in `S0` and REST ends |
| a member of the Nekom | you wake in `R1` and REST ends |

## The cloud world

Sleep in the sky nid `90`, at the top of the Sky Grund, and you are
marked.  The next doorway you use, whichever one it is -- the check
happens before any lock, so a locked door works too -- puts you in the
clouds at `U5`.  Walk up to D'ol Neshom in `V5`: he blesses you (+5
spirit limit and a vision) and offers the spirit bell, the only one in
the world.  The next doorway after that returns you to `90`.  From the
sleep in the sky nid until that doorway home the clock is frozen, effort
costs no fatigue, and RENEW is refused -- on the way to the door as much
as in the clouds.

The bell is a proximity alarm below the root: stand on a doorway in an
underground room carrying it and the game stops to print THE SPIRIT BELL
RINGS.

## Losing a day

No death, no lives, no health.  Every bad outcome is the same event: you
are back in your own nid, lying down, one day later, spirit energy
restored to your limit, food and rest refilled.

| trigger | text |
|---------|------|
| food ran out | YOU SPENT A DAY RECOVERING FROM A LACK OF FOOD |
| rest ran out | YOU SPENT A DAY RECOVERING FROM A LACK OF REST |
| stepping in water | YOU WERE FOUND NEAR THE WATER.  TIME HAS PASSED. |
| RENEW | YOU WERE FOUND UNCONSCIOUS.  TIME HAS PASSED. |
| attacked by a follower of D'ol Salaat | YOU WERE ATTACKED BY A FOLLOWER OF D'OL SALAAT.  TIME HAS PASSED. |
| attacked by the Nekom | YOU WERE ATTACKED BY A MEMBER OF THE NEKOM.  TIME HAS PASSED. |

The two kidnap ambushes are not this: they drop you in `S0` or `R1` and
cost no time, as do the two kidnapping nid hosts.  Losing a day does not
check the fifty-day limit, so it can push you to day 51 or past it; the
quest then ends at the next hour rather than straight away.

## The economy

A token is an ordinary object lying in the world, like a shuba or a loaf
of bread.  There is no money counter: your purse is the tokens you are
carrying.

- Everything costs one token and everything sells for one token, at
  every merchant, whatever the item.
- The world has room for 75 tokens and starts with 62, so 13 slots are
  free.  Selling needs a free slot -- SORRY, I'M NOT INTERESTED when
  there is none -- and spending a token frees its slot again.  That is
  the hard cap on how much money can exist.
- A token weighs 1, every other object 5, and you can carry your stamina
  + 26.
- Every character's nid place starts with a shuba, one food item and
  three tokens on the floor.

BUY hands over nothing: it takes your token and grants permission to
take the merchant's one kind of stock, and TAKE picks it up.  It refuses,
in order, with THERE IS NO MERCHANT HERE, NO RESPONSE if you are not
next to the merchant and facing them, YOU NEED MORE TOKENS, and SORRY,
YOU'RE CARRYING TOO MUCH if you are within 4 of your limit.  Otherwise:
TAKE WHICHEVER ONE PLEASES YOU.

SELL asks WHAT WILL YOU SELL? and cycles the sellable things you carry
-- honeylamps, roast lapan, pan bread, fruit & nuts, shubas, trencher
beaks, wissenberries and vine rope.  The bell, the spirit lamp, the
wand, the two keys, the elixer and tokens cannot be sold.  You get
HERE'S YOUR TOKEN.

The eight merchants, their rooms and their stock are in
`data/economy.json`.  Two other things destroy tokens: offering one to
the inner gate guard at `01`, and sleeping at a token thief's nid.

## What the quest remembers

Beyond where every object is and your own stats, this is the whole of
the saved state; the fields are listed in `data/quest.json`.

- **A quest is in progress.**  CONTINUE and SAVE refuse without it; both
  endings clear it.
- **Spirit limit**, gating the six skills at 5, 10, 15, 20, 25 and 30.
  Five named figures add 5 each on your first SPEAK; ten animals add 1
  each the first time you pense their message.
- **Visions shown**, 0-5: each spirit gain that still has a vision left
  prints the next one.  Six gains earn visions -- five blessers and the
  five-animal milestone -- but there are only five visions, so the sixth
  gain shows no vision.
- **Animals pensed**, 0-5; the fifth prints a congratulation.
- **Wissenberries offered to the outer gate guard**; the second offering
  opens that gate for good.
- **Two permanent gate flags.**  The outer gate's is set by that second
  offering.  Nothing you can say sets the inner gate's -- only the wand
  of Befal on its guard opens it permanently; otherwise it costs a token
  every visit.
- **D'ol Falla has been spoken to**; without it TAKE refuses her key.
- The **cloud-world flag**, the lit honeylamp and the light left in it,
  the fatigue reserve, whether time has run out, whether the bell has
  rung.
- **Per creature**: whether you have banished it, which day you last
  spoke to it, and whether its once-per-quest gift is spent.  For
  ambushers that same field holds the hour they have settled into.

Two permissions are per-visit and clear whenever you enter a room:
permission to take something offered to you, and permission to walk
through a gate you have just paid for.

## The route through

`data/quest.json` carries the fourteen walkthrough milestones, each with
the walkthrough section it comes from and the fact in the game data that
confirms it.  The spine: pick up your starting kit; buy a trencher beak
and cut your way to the Hermit; reach the Wise Child in the Garden;
carry a vine rope to the sky nid, lay it, crawl over and sleep there for
the cloud world and the spirit bell; buy berries, a token and all the
lamps you can carry and get below the root to Vatar; pense five animals;
speak to Raamo's Mother; get the two temple keys and the spirit lamp;
raise your spirit limit to 30 and buy a spare shuba; find Raamo and
offer it to him.

## The endings

**Winning.**  OFFER a shuba or a vine rope to Raamo, alone in `GE`.  Any
other item gets THAT WON'T HELP; the same offer to anyone else gets NO
RESPONSE.  He says:

> I AM RAAMO, THE SPIRIT GIFTED.
>
> YOU HAVE SAVED MY LIFE AND FULFILLED THE PROPHESY.  THE QUEST IS
> COMPLETE.  GREEN-SKY IS SAVED.

A tune plays out, then YOU HAVE FINISHED THE QUEST IN *n* DAYS. YOU ARE
A -- MASTER QUESTER. under 15 days, HIGHLY GIFTED QUESTER. from 15 to
29, GIFTED QUESTER. from 30 on.  A second tune, a button press, back to
the main menu.  That is the entire score.

**Running out of time.**  Reaching day 51 stops the game and prints:

> THE LIGHT FADES INTO DARKNESS...
>
> THE TIME FOR YOUR QUEST HAS ENDED.
>
> GREEN-SKY AWAITS THE RISE OF ANOTHER QUESTER.

A tune, a button press, back to the main menu.  Fifty complete days, as
the manual says.  Neither ending writes anything to disk; nothing in the
game ever saves by itself.

## The attract demo

The demo is a recorded joystick: a script fed to the game in place of
the stick, so it plays itself with no special code beyond the script
player.  Both scripts are in `data/demo.json` -- an intro that starts
indoors in the title room `T4` and interleaves walking with the four
pages of story text, and a longer quest script that starts outdoors in
`47` and is pure gameplay: it walks, climbs, opens the menu, picks cells
and rests in a nid.  A script can also start a tune, pause for about two
thirds of a second, print a text page, and hand a room over to end
itself.  On a cold start the intro runs once and the game drops into
the main menu; from SAMPLE QUEST the two scripts hand off to each other
forever, and the fire button is the only way out -- the keyboard is
never polled.  While the demo runs the player is a sixth character
record used only by the demo, a shuba is put straight into its
inventory, and TAKE skips its "was it offered to you" check so the
scripted pickups always work.

## Saved games

DISK STORAGE writes one of five slots to a separate disk.  A save holds
the whole world: where each of the 256 objects is and whether you carry
it, the per-creature flags, the quest flags above, your stats and caps,
the day and hour, the clock's own count, and where you stood when you
opened the menu.  It does not hold the world layout, the character's
artwork, or any score.  `data/save.json` gives the byte-exact layout of
the original's 1408-byte image, so a port can read and write real saves;
a fresh port needs only the field list.

Derived from `docs/day-and-quest.md`, `docs/demo.md` and
`docs/menus-and-saves.md`.
