BELOW THE ROOT — PRESERVATION EDITION

Unzip the entire archive before playing. You need Python 3.9 or newer and a
modern browser. No npm install, emulator, Netlify account, or internet connection
is needed to play the browser port.

From this folder, run:

    python3 serve.py

On Windows, use:

    py -3 serve.py

The launcher opens http://127.0.0.1:8000/ in your browser. Keep its terminal open
while playing; press Ctrl+C there to stop. Use --port 8888 if port 8000 is busy,
or --no-browser to open the address yourself. Use the same address and port each
time to return to your browser's autosave. Saves are stored in that browser,
not in this ZIP; debug tools can export/import a playthrough recording.

Opening site/index.html directly with file:// will not work: the game loads
JavaScript modules and JSON over HTTP. The included server listens only on your
own computer and serves site/, not the source or original materials.

CONTENTS

iso/             Everything supplied in the project's iso/ directory, unchanged:
                 both original G64 disks, the bootable C64 ISO, boot files, box
                 scans, manual, map, walkthrough, credits, and legal notices.
site/            Ready-to-run HTML, CSS, JavaScript, data, art, music, and fonts.
source/          Git-tracked project files as they were on disk when packaged:
                 port source, extracted assets, disassembly, research/specs,
                 build tools, tests, and dependency versions. No Git history.
serve.py         Local server and browser launcher (Python standard library).
release.json     Source revision and any tracked working-tree changes.
SHA256SUMS       SHA-256 hashes of every other file, relative to this folder.

On systems with sha256sum, verify the extracted files with:

    sha256sum -c SHA256SUMS

External articles and GitHub links still need internet access. GitHub login and
issue submission require the hosted site's backend; local recording downloads
and imports work offline. The original disk images require a compatible C64
emulator or hardware; that software is not needed for the browser port.

See source/README.md for development and source/docs/tooling.md for rebuilding
the original-game analysis. To rebuild the browser site, run make build in
source/ (requires Make, Node.js, and npm; installing Marked may need internet).
For tools that expect source/iso/, copy the preserved iso/ directory there.

The original game and materials retain their original copyrights and notices;
see iso/LEGAL and iso/readme.txt. Cinzel's SIL Open Font License is included in
site/assets/cinzel-OFL.txt.
