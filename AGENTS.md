After completing work Saul requests, commit the task's changes without waiting for a separate commit request; leave unrelated changes out of the commit.

Automated issue fixes must be implemented, verified, and committed to local `master`. Do not push or open PRs. The issue worker may use a temporary worktree for implementation and review, then fast-forward local `master` to the tested commits. A diagnosis or TODO entry alone does not complete an actionable issue. See `docs/issue-loop.md` for the runner and configuration.
