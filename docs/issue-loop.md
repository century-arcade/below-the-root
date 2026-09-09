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
