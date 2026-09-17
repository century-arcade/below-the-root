After completing work Saul requests, commit the task's changes without waiting for a separate commit request; leave unrelated changes out of the commit.

Do not add content to project Markdown files without Saul's explicit approval. This does not apply to `.meta` or workflow Markdown files; send those updates via inbox.

Issue-loop stages (triage, diagnose, fix, review) run in a temporary worktree and must not modify the main checkout; only the fix stage writes and commits. Do not push or open PRs. Policy and configuration: `docs/issue-loop.md`.

Tests assert behaviour, never layout geometry: no pixel positions, element widths, or viewport-dependent coordinates. A test that only breaks when CSS changes is deleted, not updated.

Run `make test` before every commit; the pre-commit hook runs it (`make install-hooks`), and `--no-verify` is not allowed.

Follow [docs/testing.md](docs/testing.md) for the test structure and runners.
