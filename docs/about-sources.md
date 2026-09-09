# About-page source audit

Checked 2026-09-09 against `src/index.html`, local task history, and the
linked websites. This records research and editorial findings; it does not
replace the public copy.

The reading links now live on the top-level Resources tab (`#resources`).
[Archive verification](resources-archive.json) records the capture URLs,
dates and results for its 23 external destinations. Twenty-two have verified
archived content. The Retronauts Patreon page has no matching successful
capture; Save Page Now's browser job failed and its API required login.
That capture remains outstanding. Page captures do not establish that
embedded audio, video, or every image has also been preserved.

## Where the copy came from

The immediate source is the agent-written front-page task brief, preserved
locally at `.meta/done/front-page.md`. Its opening paragraph (lines 97–100)
is reproduced verbatim in `src/index.html`. The screenshot caption, fine
print, section plan, and link annotations also came from that brief.

The earlier conversation in
`.meta/transcripts/f0270ec0-1508-424a-8e65-28671f334a9e.md`
records Claude replacing its first promotional draft after Saul requested
plain copy (around lines 654–734). Claude wrote the replacement into the
task. Codex implemented it in commit `6fdd4dc18872ab9b43e139b3d9daf36996d948ac`,
qualifying the fidelity claims for gliding, tune skipping, and unfinished
walkthrough verification.

The brief identifies the ingredients of the lower sections:

- Credits: `iso/readme.txt`, the bundled credits transcription.
- Character differences: `docs/spec/overview.md`.
- Reconstruction and validation: the README milestone table.
- History and genre descriptions: facts specified by the brief, without
  sentence-level external citations.

This establishes agent authorship and local reuse. It does not establish
that every phrase is unique across the web. The record does not support
attributing the opening to an original advertisement or a particular
linked essay.

## Existing external reading links

“Read” means the page text was available, not that downloads, embedded
audio, or videos were played. An access failure does not establish a dead link.

| Link | Finding and editorial use |
| --- | --- |
| [Justin Stahlman, lifelong obsession](https://blog.stahlmandesign.com/below-the-root-a-story-a-computer-game-and-my-lifelong-obsession/) (2015, subsequently updated) | Read. Personal memories, the cloud-world discovery, correspondence about a proposed remake, extracted graphics, and the complete map. Much more than a map download. Contains spoilers. |
| [John Szczepaniak, Time Extension](https://www.timeextension.com/features/the-making-of-below-the-root-the-1984-metroidvania-masterpiece-that-predates-metroid-and-castlevania) (2024) | Read. Strongest linked production history: Groetzinger's recollections, earlier DeSharone interview material, and Snyder's own account. Distinguishes C64 artwork development from the timing of platform releases. |
| [Phil Salvador, The Obscuritory](https://obscuritory.com/platform/below-the-root/) (2020) | Read. Strongest concise account of the game's emotional character: hospitality, trust, pensing, and powers used for exploration. Add the author's name and date. Contains quest details. |
| [Altus, Below the Root](https://altusmusic.bandcamp.com/album/below-the-root) (2017) | Album page read. Music inspired by the game; not the original game soundtrack. A useful example of its continuing creative influence. |
| [Mark Krepela, Lemon64 review](https://www.lemon64.com/review/below-the-root/377) (2004) | Read. Personal appreciation of atmosphere and exploration, with practical frustrations. The books' availability and prices are historical statements. Shares the game's comment thread with the main entry. |
| [Wingnut, My all time favourite video games](https://bestretrogames.blogspot.com/2012/03/below-root-commodore-64-1984.html) (2012) | Read through a direct HTTPS fetch after the browser service returned 429. A later discovery of the game, praising joystick control and clue-based exploration; includes a map and ending spoilers. Prefer HTTPS in the page link. |
| [Zack Smith, Weird Children's Books](https://zacksmithwriter.wordpress.com/2013/04/18/weird-childrens-books-zilpha-keatley-snyder-and-below-the-root/) (2013) | Read. Specifically about the game changing the trilogy's ending, rather than a general introduction to the novels. Its annotation should flag spoilers. |
| [Wikipedia](https://en.wikipedia.org/wiki/Below_the_Root_(video_game)) | Read. Useful bibliography and historical overview; follow its citations for disputed claims. |
| [MobyGames](https://www.mobygames.com/game/602/below-the-root/) | Direct access blocked; indexed description and review pages available. Useful platform/credit catalogue, but the indexed novel dates disagree with the original manual. Avoid using it alone for bibliographic dates. |
| [Lemon64 game entry](https://www.lemon64.com/game/below-the-root) | Read. C64 catalogue, community memories, and links to the manual and review. Overlaps the separately linked review. |
| [The Cutting Room Floor](https://tcrf.net/Below_the_Root) | Direct access blocked with 403. Its editor coverage is corroborated by Stahlman and the GameFAQs author; the current article could not be independently reviewed. Retain as a technical reference, with this verification limit. |
| [Original manual, Internet Archive](https://archive.org/details/below-the-root-game-manual-1984) | Archive item available. Manual content cross-checked against the local transcription and the [Museum scan](https://www.mocagh.org/spinnaker/belowtheroot-manual.pdf). Includes Snyder's account of designing the world and dialogue. |
| [TarynB93, GameFAQs guide](https://gamefaqs.gamespot.com/c64/581563-below-the-root/faqs/57342) | Read. This URL is one particular guide, not a walkthrough index. Includes maps and a firsthand account of discovering the hidden editor, as well as solutions. Label it accordingly. |

The three distinct GitHub destinations (repository, specification, issues)
returned HTTP 200. About, Play, demo, and box-image links are local navigation
or assets, not further reading.

## Additional sources worth considering

| Source | What it adds |
| --- | --- |
| [Data Driven Gamer: Game 373](https://datadrivengamer.blogspot.com/2023/07/game-373-below-root.html), [concluding assessment](https://datadrivengamer.blogspot.com/2023/07/below-root-won.html) (2023) | A documented C64 playthrough, map, and candid assessment of exploration, controls, exhaustion, and unclear terrain. Useful counterweight to childhood recollections. Spoilers. |
| [The Adventurers' Guild: introduction](https://advgamer.blogspot.com/2011/11/game-1-below-root-1984.html), [completion](https://advgamer.blogspot.com/2011/12/game-1-below-root-won.html) (2011) | A multi-post PC playthrough. Records how a new player follows clues and gets stuck. Spoilers. |
| [Darby McDevitt: Digital Future, Invisible Past](https://www.gamedeveloper.com/design/digital-future-invisible-past-what-lives-on-when-a-good-game-dies-) (2014) | An essay about returning to Below the Root and the difficulty of keeping old games playable. Particularly relevant context for why this browser reconstruction matters. |
| [Museum of Computer Adventure Game History](https://www.mocagh.org/loadpage.php?getgame=belowtheroot) | Original packaging, map, manual, and disk images of the physical materials. A better destination for someone interested in the complete boxed object. |
| [Retronauts episode 536](https://www.patreon.com/posts/episode-536-root-83357354) (2023) | A dedicated podcast episode. Listing verified; audio not reviewed. The Patreon page is locked, so identify that access limitation if linked. |

Two further historical leads need a better accessible copy before detailed use:

- [Nick Piazza Jr., Compute!, September 1985 index](https://www.atarimagazines.com/compute/index/index.php?issue=issue64)
  identifies a contemporary review; indexed scan text confirms discussion of
  its graphics and spirit abilities. Full scan retrieval failed during this audit.
- [Dale DeSharone — an unspoken legend](https://blog.hardcoregaming101.net/2012/09/dale-desharone-unspoken-legend.html)
  is the earlier interview linked by Time Extension. Direct retrieval failed;
  use the accessible 2024 article's attributed excerpts for now.

## Copy findings

The current introduction leads with author, character count, deadline, room
count, and an absence of combat. The next history paragraph lists credits;
the following one compresses the character-selection table into prose. The
port paragraph reads like a development report. Short sentences have made
the copy terse without giving a newcomer much sense of playing.

Specific points to preserve or reconsider:

- **438 rooms is grounded in this project.** `docs/spec/world.md` counts 438
  populated slots out of 512. External references to 512 describe the full
  grid, including blank slots. These are different counts, not necessarily
  conflicting discoveries.
- **Release order is overstated.** In the Time Extension interview,
  Groetzinger describes creating the art on C64 first but recalls the three
  versions reaching sale around the same time. Say which versions existed
  without asserting a staggered release unless stronger evidence is found.
- **Pacifism deserves precise wording.** Hostile creatures and kidnappers
  exist. The wand can permanently remove creatures at a cost to spirit
  (`docs/spec/creatures.md`, “The wand of Befal”). Describe how players make
  progress through exploration and learning instead of making an absolute
  claim that there is nothing to fight.
- **The opening reveals the mystery.** The manual begins with a threatening
  dream and a missing Raamo; the page immediately states where he is. A
  newcomer introduction can describe searching for him without resolving it.
- **Book dates need care.** The manual explicitly gives 1975–77, as our page
  does; the 2024 article quotes Snyder giving 1975, 1976, and 1978. Do not
  casually “correct” the page without checking edition records. These dates
  need not be in the opening at all.
- **Distinguish platform credits.** `iso/readme.txt` explicitly credits
  Vince Mills for IBM PC/jr and Jim Graham for Apple II. The current combined
  programmer list loses that information.

For a rewrite, lead with a few concrete actions: gliding between trees,
reading a stranger's emotions, growing a branch across a gap, and finding
food or a safe bed. State that this is the 1984 C64 game rebuilt for browsers,
then describe the conveniences a player will notice. Keep engineering
evidence accessible further down. Plain language can carry those specific
experiences without promotional claims or borrowed reviewer phrasing.
