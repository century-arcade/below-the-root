# Browser input behavior

This is the browser port's input contract. It defines intended behavior,
including requirements awaiting implementation. It takes precedence over
original-game timing rules for live input; recorded demos retain their
existing playback contract. Movement mechanics remain in [player.md](player.md).

## Action policies

Choose a policy by action and context. A physical key has no universal
repeat policy: Right walks continuously, moves a menu selection once,
or repeatedly seeks through a replay.

| Policy | Behavior |
| --- | --- |
| Continuous | Read held state at the consumer's movement cadence. Release stops supplying movement. Preserve short taps between reads. |
| Once per press | Consume each observed physical press once, in order. Holding and keyboard auto-repeat add no actions. Release/repress counts even when both happen between reads. |
| Repeat while held | Act once immediately, then repeat at a controlled cadence until release. Repetition does not manufacture physical presses for other consumers. |

No cooldown may discard distinct keyboard presses. Pointer double-tap
recognition is a separate gesture delay, not keyboard debounce.

## Controls by context

| Context/action | Policy and effect |
| --- | --- |
| Walking, climbing, directional steering | Continuous arrows/WASD, including diagonals. Held movement survives ordinary room transitions and the spirit-bell message/tune. |
| Jumping and gliding | Preserve the existing direction-plus-trigger and held-trigger mechanics. Door debouncing must not turn all gameplay fire into a single pulse. |
| KINIPORT source and destination cursor | Continuous arrows/WASD until release or the cursor reaches its allowed boundary. Trigger confirms each selection once; source confirmation cannot also confirm the destination. |
| Command menu, main menu, character and item choosers | Once per press. Both Up and Down work in every chooser; retain each chooser's existing ordering and bounds/wrapping. Command menus also use Left/Right. |
| Confirming a choice | Once per press. Space, Enter (including numpad Enter), Shift and Control remain trigger aliases. F selects while a chooser/prompt is active. |
| Command menu opening/closing | F opens it during play; a second fresh F can select. Escape closes it. Existing trigger-plus-Down and pointer menu activation remain available. |
| Choosing NOTHING/cancelling an item choice | One confirmation finishes cancellation. No extra dismissal press. |
| Door entry/exit | Once per trigger press; holding cannot shuttle between rooms. A subsequent release/repress allows another transit. |
| Spirit-bell message | Existing held movement is sufficient to continue. Walking across a door must not require release/repress. |
| Dialogue, pages, kidnapping and other control-seizing messages | Fresh accepted input dismisses one stage. Input already held when control was seized cannot immediately erase the message. Retain whether each prompt accepts trigger only or direction/trigger. |
| Reward music | Where skipping is enabled, a fresh trigger skips once. The press that selected SPEAK/PENSE or started the reward cannot also skip its music. |
| Attract/demo interruption | One fresh trigger interrupts; it cannot also select the next menu item. |
| REST | Direction or trigger wakes the character. The input that selected REST cannot immediately wake them. |
| Replay Left/Right | Repeat while held, one room per action; Shift changes the increment to ten. Left within one second of the current room's start goes to the previous room. Seeking stops on release and at replay bounds. |
| Map arrows/WASD | Pan while held; D always means right. These inputs belong to the map and cannot move the character or seek the replay. Preserve current panning speed; exact repeat timing is not a new requirement. |
| Map/help/pause toggles and developer shortcuts | Once per press. Preserve current bindings and context restrictions. F is not fullscreen and M is not mute. |
| Volume keyboard shortcuts | Preserve one adjustment per press. No new hold-to-repeat behavior is required. Native focused controls retain their own keyboard behavior. |

## Ownership and transitions

Maintain held state and ordered press/release events together. Keyboard,
pointer/touch and gamepad adapters must share their delivery and consumption
rules. Gamepad polling can only preserve transitions the browser exposes.

Track physical sources separately. Releasing one alias or device must not
release another source that remains held. Distinct physical menu presses
count separately. Opposite held directions cancel on their axis; ordered
menu presses remain ordered moves. A direction-plus-trigger pointer tap
must reach its consumer as one coherent gesture.

An input belongs to the context that consumes it. Confirmation, dismissal,
tune skipping and demo interruption must not reuse the same press in the
next context. Fresh subsequent presses must survive, including when release
and repress occur between consumer reads. Opening a menu must preserve the
first navigation press made during its opening.

Held movement carries across gameplay interruptions that allow it, especially
spirit bells and room boundaries. Clearing consumed trigger input must not
clear unrelated movement. A message that requires fresh input has a different
transition rule from the spirit bell; neither rule applies to all verbs.

Focus loss clears stale input and stops repeat timers. Pointer cancellation
and device disconnect clear that source's input. Returning focus must not
sacrifice the first fresh gameplay press. Pause/resume and overlay changes
must prevent stale actions from leaking into play without swallowing the
next fresh press. Input help permits play after startup; map navigation and
editing fields own their inputs. Clicking the canvas restores gameplay focus.

## Pointer gestures

Hold steers toward the pointer. A directional single tap supplies direction
and trigger. Double-tap walking must not also perform the first tap's jump;
the recognition window is approximately 200 ms. A door tap walks to the door
and triggers on arrival. Tapping the figure acts immediately, or stops an
active walk; tapping elsewhere during a walk re-aims it. Preserve existing
walk cancellation and stopping rules while fixing input delivery.

## Recording and verification

Input delivery must remain independent of rendering and consumer read
timing. Preserve deterministic effective gameplay input, semantic command
choices and existing demo playback. This contract does not require recording
raw browser events or changing the save format.

Behavioral regressions must exercise actual adapters through their consumers:

- Hold an arrow through spirit-door contact and its message/tune; movement
  continues without another press.
- Hold directions in both KINIPORT selection stages; the cursor continues
  moving, release stops it, and confirmation advances only one stage.
- Rapid menu taps, including release/repress between reads, each move once;
  holds and browser repeat do not. Navigation followed by confirmation
  selects the intended item in order.
- Hold trigger through door transit, music start, message appearance and
  menu transitions; no duplicate transit, immediate skip or dismissal occurs.
  The next fresh press works, and NOTHING requires no extra press.
- Exercise aliases, overlapping devices, opposite directions, pointer
  gestures, focus return, cancellation, map ownership and replay seeking.
- Vary input/read timing and verify live recording/replay and original demos.

Assert gameplay effects and input ownership, never layout geometry.
