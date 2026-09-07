# Automated issue fixes

`cbox btr loop` imports GitHub issues into `.meta/todo/agent-queue/` and runs
the worker on each queued task.  `.meta/issue-loop.conf` (sourced by the
shared `issue-loop` wrapper) selects this project's runner and assigns a model
to each stage:

```sh
STAGE_TRIAGE=claude:fable
STAGE_DIAGNOSE=claude:fable
STAGE_FIX=codex:gpt-6-astra
STAGE_REFIX=claude:opus
STAGE_REVIEW=claude:fable
exec python3 tools/issue_loop.py "$@"
```

A `STAGE_<NAME>` value is `vendor:model[:effort]`; an unset stage uses the
shared defaults (`AGENT_VENDOR`, effort low for triage, medium for diagnose
and review, high for fix).  `REFIX` is the fix stage on rounds after a failed
review; `MAX_ROUNDS` (default 2) caps the rounds.  Each worker invocation
reads the conf, so edits apply to the next task.

`tools/issue_loop.py` reuses the workflow's importer, queue, locks, logs, and
attach/abort controls, and replaces its delivery: fixes start from local
`master` in a detached worktree under `_cbox/`; triage, diagnose, and review
run there too and must leave it unchanged; only the fix stage writes and
commits.  A verdict line (`VERDICT: ready|human|pass|fail`) must stand alone,
emphasis allowed; fenced or hedged verdicts do not count.  A passing review
fast-forwards local `master`, records the commit in `.meta/done/`, and closes
the task's GitHub issue (frontmatter `github_issue:`) with a comment naming
the commit; a failed close is noted there and the delivery stands.  The
worker never fetches, pushes, or opens PRs.

The main checkout must be clean and on `master`.  A run that finds it
changed, an unclear task, a failed review, or an uncommitted fix returns the
task to `.meta/todo/` with its worktree and logs referenced.  Requeue by
moving the complete Markdown file back into `.meta/todo/agent-queue/`;
imported issues are not retried automatically.

Tests (no AI): `python3 -m unittest discover -s test -p 'issue_loop_test.py'`.
