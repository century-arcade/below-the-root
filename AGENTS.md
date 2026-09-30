After completing work Saul requests, commit the task's changes without waiting for a separate commit request; leave unrelated changes out of the commit.

Do not add content to project Markdown files without Saul's explicit approval. This does not apply to `.meta` or workflow Markdown files; send those updates via inbox.

Keep layout fixes visual: do not add unrequested loading banners, reload instructions, or other gameplay-page copy; propose new messaging separately.

No gradients anywhere: flat fills only, and shadows or bevels as hard-edged bands with no blur.  Match period hardware colours by sampling a reference photo.

## Completing reviewed work

After review passes, before reporting the work complete:

1. Integrate the reviewed commits into the main checkout's `master`.
   Fast-forward linear history; when a rebase is needed, preserve the individual
   commits rather than squashing them.
2. Run `make build` from the main checkout. A build in the temporary `_cbox`
   worktree does not update the main checkout's `_build/`, which is what the
   existing localhost server serves.
3. Load the served page and confirm that it reflects the integrated change.

This check follows the failure seen with commit `78c5277`: the commit was
fast-forwarded, but `_build/play.html` remained stale because the build had run
only in the temporary worktree, so `localhost:8000` still showed ASCII arrows.

Do not push or open PRs.

Tests assert behaviour, never layout geometry: no pixel positions, element widths, or viewport-dependent coordinates. A test that only breaks when CSS changes is deleted, not updated.

Run `make test` before every commit; the pre-commit hook runs it (`make install-hooks`), and `--no-verify` is not allowed.

Follow [docs/testing.md](docs/testing.md) for the test structure and runners.
