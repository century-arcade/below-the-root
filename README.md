# Below the Root

Play the 1984 C64 game *Below the Root* (Windham Classics) in your browser,
based on Zilpha Keatley Snyder's Green-sky books.

[Play](https://below-the-root.netlify.app/) ·
[About](https://below-the-root.netlify.app/about) ·
[Resources](https://below-the-root.netlify.app/resources)

## The monitor and desk

The monitor starts powered off unless this tab remembers it on. Turn it on if
needed; at the text-only boot screen, press a movement key or tap to start the
intro or resume your saved quest. Powering off resets the game and deletes its
autosave; it keeps your preferences.
To take a break without losing your quest, use P or browse the desk instead.

The desk below the monitor holds the box, original manual, paper map, game disk
and curator's note. Turn box and manual pages with their arrow buttons,
Left/Right or a click on the page. Browsing holds the game; choose the disk, then
press a movement key or tap the picture to resume. The desk compacts or hides when space is tight.

The monitor has fullscreen and volume controls. Volume starts at 50%; slide it
to zero to mute. Sound needs a keypress or click/tap before the browser allows it.
Fullscreen and short landscape views hide the cabinet and desk; M still opens
the map.

## Controls

| Input | Action |
|-------|--------|
| Arrows or WASD | Move |
| Space or Enter | Joystick button: jump, run or enter |
| F | Open the command menu or select a choice |
| P | Pause; press P again, press a movement key or tap the picture to resume |
| M or Tab | Toggle the map while powered on; Tab works when the game has focus |
| ? or H | Toggle the text-only boot screen, holding gameplay while it is shown |
| − / = (or _ / +) | Lower / raise volume |
| Escape | Dismiss navigation, a chooser or the command menu first; otherwise return to the box |

Escape from the map returns to the monitor in fullscreen or the short landscape
view. Leaving the browser tab holds gameplay; music can keep playing while paused.
Menus move once per direction press. Up/Down browse item and character choices;
item choices wrap through NOTHING to cancel.

Mouse, and touch outside fullscreen and short landscape: hold to steer, tap to
walk, double-tap within leap range to jump (farther targets walk). Tap yourself or the menu area below the scene for the
command menu. Self-tap on a door goes through; self-tap while walking stops first.
Press or drag over menu choices to highlight; tap the highlighted choice to select.
In fullscreen and short landscape, touch is a joystick instead. Each half of
the screen, status panel included, steers and presses the button. Hold a half to
walk that way; swipe while holding to point another way (up or down to climb,
crouch or stand; back to where you started stands still). Tap for the button.
While holding, touch a second finger to jump; each further touch jumps again.
Press two fingers together and hold to open or close the command menu; tap two
fingers together to turn around. In menus, swipe to move and tap to select.
Gamepad: d-pad or left stick moves, any face button fires.

With a shuba, press Left or Right while falling to glide; you don't need to hold
the button.
The idle panel shows day, time, name, stamina, food, rest and spirit. Messages and
menus take its place. INVENTORY follows SELL in the command menu.

## Map

M, Tab or the desk's map opens the paper map, even before starting a quest.
Room pictures appear over the poster as you explore exteriors, caverns and empty
sky; a new quest starts with none revealed, including your home exterior.
Developer mode also shows unexplored areas, dimmed. Interiors stay hidden. The red outline marks your last outdoor location while indoors,
or your nid's exit at the start; there is no marker before a quest.

Use the +/− buttons or scroll to zoom; double-click a room to zoom in on it.
Drag or use arrows/WASD to pan. Opening the map centres your location.

## Saves and recordings

Autosave keeps the latest quest start, room entry or completion. Returning later
restores that point, not unfinished progress within a room.

The version key on the monitor opens developer tools, including recording
download and upload. Upload a JSON recording to watch it from the beginning,
or a C64 `.prg` save to load its position. Watching preserves your live autosave;
reload the page to return to it. The desk's disk returns to the monitor without
ending playback. **Play from here** lets you take control; its latest save point replaces your
previous autosave.

Use the room buttons or Left/Right to move backward or forward through the
recording. Hold Shift to skip ten room changes; hold an arrow to keep skipping.
Backward skips ignore brief visits. Playback speeds through standing still but
shows action and music at normal speed, with short pauses for messages. Press
Space or Enter to skip a tune. Playback stops when the recording ends.

## Completion

Victory shows play time and completion. Time includes REST but excludes menus,
dialogue waits, tunes, pauses and the map, and freezes when Raamo is saved.
C64 saves have no elapsed-time history, so their partial timer is marked `>=`.

| Milestone | Completion |
|-----------|------------|
| Save Raamo | 35% |
| Acquire spirit bell, spirit lamp, temple key and D'ol Falla's key | 5% each, up to 20% |
| Pense animals for spirit | 1% each, up to 10% |
| Speak to spirit-giving leaders | 5% each, up to 25% |
| Consume elixirs | 1% each, up to 5% |
| Acquire the Wand of Befal | 1% |
| Collect world tokens | Up to 4%, proportional to your character's obtainable tokens, rounded down |

Pomma can collect 48 tokens, Neric and Genaa 39, Herd and Charn 41.
Starting spirit and room exploration do not count. Earned points survive dropping
items, spending spirit, and spending or losing tokens. Each world token counts
once; selling items creates no extra collectible tokens. C64 imports recover
spirit gifts, consumed elixirs and carried quest items and tokens, but cannot
recover earlier dropped-item or spent-token history.

## Offline play

In an unpacked release, run `python3 serve.py` (Windows: `py -3 serve.py`).
It opens the game in your browser. Use `--port 8888` if the default port is busy.
Python and a modern browser are all you need. Gameplay, autosave, the map and
recording import/export work offline; external links and GitHub reporting need
an internet connection. The archive's `README.txt` has verification instructions;
`recordings/` contains winning runs for all five characters.

For source, build and release commands, see [Port internals](docs/port.md).
