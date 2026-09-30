After completing work Saul requests, commit the task's changes without waiting for a separate commit request; leave unrelated changes out of the commit.

Do not add content to project Markdown files without Saul's explicit approval. This does not apply to `.meta` or workflow Markdown files; send those updates via inbox.

Keep layout fixes visual: do not add unrequested loading banners, reload instructions, or other gameplay-page copy; propose new messaging separately.

Issue-loop stages (triage, diagnose, fix, review) run in a temporary worktree and must not modify the main checkout; only the fix stage writes and commits. After review, the supervising session follows the main-checkout completion steps in `docs/issue-loop.md`. Do not push or open PRs.

Tests assert behaviour, never layout geometry: no pixel positions, element widths, or viewport-dependent coordinates. A test that only breaks when CSS changes is deleted, not updated.

Run `make test` before every commit; the pre-commit hook runs it (`make install-hooks`), and `--no-verify` is not allowed.

Follow [docs/testing.md](docs/testing.md) for the test structure and runners.
