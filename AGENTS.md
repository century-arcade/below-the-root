After completing work Saul requests, commit the task's changes without waiting for a separate commit request; leave unrelated changes out of the commit.

Automated issue fixes must be implemented, verified, and committed to local `master`. Do not push or open PRs. The worker runs each stage in a temporary worktree: triage and diagnosis only inspect, implementation makes and commits the fix, and review only verifies. These agents must not modify the main checkout. The worker then fast-forwards local `master` to the tested commits. A diagnosis or TODO entry alone does not complete an actionable issue. See `docs/issue-loop.md` for the runner and configuration.

Tests assert behaviour, never layout geometry: no pixel positions, element widths, or viewport-dependent coordinates. A test that only breaks when CSS changes is deleted, not updated.
