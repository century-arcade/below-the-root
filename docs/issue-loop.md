# Automated issue fixes

`cbox btr loop` imports GitHub issues into `.meta/todo/agent-queue/` and runs
the workflow's issue-loop worker on each queued task (its own doc:
`~/git/workflow/docs/issue-loop.md`).  `.meta/issue-loop.conf` holds this
project's settings:

```sh
PUBLISH=local
STAGE_TRIAGE=claude:fable
STAGE_DIAGNOSE=claude:fable
STAGE_FIX=codex:gpt-6-astra
STAGE_REFIX=claude:opus
STAGE_REVIEW=claude:fable
```

`PUBLISH=local`: fixes start from local `master` in a detached worktree
under `_cbox/`; every stage runs there and only the fix stage writes and
commits; a passing review fast-forwards `master`, records the commit in
`.meta/done/`, and closes the task's GitHub issue (frontmatter
`github_issue:`) with a comment naming the commit.  The worker never
fetches, pushes, or opens PRs.  A `STAGE_<NAME>` value is
`vendor:model[:effort]`; `REFIX` is the fix stage on rounds after a failed
review; `MAX_ROUNDS` (default 2) caps the rounds.  Each worker invocation
reads the conf, so edits apply to the next task.

The main checkout must be clean and on `master`.  A run that finds it
changed, an unclear task, a failed review, or an uncommitted fix returns the
task to `.meta/todo/` with its worktree and logs referenced.  Requeue by
moving the complete Markdown file back into `.meta/todo/agent-queue/`;
imported issues are not retried automatically.

## Waiting for the loop

A session that queued tasks should not poll.  Arm one background
watcher that exits when both the queue and the active slot are empty,
then read `.meta/done/` (landed, with the commit), `.meta/todo/`
(returned, with the agent's questions under "Agent result") and
`git log`:

```sh
until [ -z "$(find .meta/todo/agent-queue .meta/issue-loop/active -mindepth 1 -print -quit 2>/dev/null)" ]; do sleep 30; done
```

While a task is active, leave `master` alone: the loop needs the
checkout clean and fast-forwards `master` when a review passes, so a
commit made meanwhile returns the task.

## Completing reviewed work

These steps belong to the supervising session after review passes, not to an
issue-loop stage. Before reporting the work complete:

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
