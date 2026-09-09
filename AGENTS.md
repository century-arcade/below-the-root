Interactive sessions turn a change request into a task file in `.meta/todo/agent-queue/` for the issue loop (`docs/issue-loop.md`, Codex at the fix stage) instead of implementing it, unless Saul says to do that task in the session.

After completing work Saul requests, commit the task's changes without waiting for a separate commit request; leave unrelated changes out of the commit.

Issue-loop stages (triage, diagnose, fix, review) run in a temporary worktree and must not modify the main checkout; only the fix stage writes and commits. Do not push or open PRs. Policy and configuration: `docs/issue-loop.md`.

Tests assert behaviour, never layout geometry: no pixel positions, element widths, or viewport-dependent coordinates. A test that only breaks when CSS changes is deleted, not updated.
