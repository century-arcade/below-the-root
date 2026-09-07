# Automated issue fixes

The existing `cbox btr loop` watcher imports GitHub issues into
`.meta/todo/agent-queue/`. This project's `.meta/issue-loop.conf` selects
`tools/issue_loop.py` through the shared command's configuration hook:

```sh
exec python3 tools/issue_loop.py "$@"
```

Keep that config in the project's persistent `.meta` repository. No service
restart is needed: each worker invocation reads it. The runner reuses the
installed workflow's queue, importer, locks, session logs, and attach/abort
controls. Its processing policy lives here because the shared workflow is
mounted read-only in this cbox.

A ready issue proceeds through diagnosis, implementation, tests, commit, and
review. Standalone verdicts may appear after explanatory text or in Markdown
emphasis (including a following dash and explanation); conflicting verdicts
and verdicts inside code blocks do not pass.
An explanation of a fix alone is insufficient: the worker requires committed
changes and a passing review before marking a task done.

Fixes start from local `master` in temporary worktrees under `_cbox/`. After
review, the worker fast-forwards local `master` and records the commit hash in
`.meta/done/`. It does not fetch code from origin, push commits, create PRs, or
comment on issues. GitHub issue import remains read-only and deduplicated.
Triage, diagnosis, and review run in the temporary worktree too, and must leave
its files and commit unchanged. Only the implementation stage writes fixes.

The main checkout must be clean and on `master`. If it changes during a run,
the worker preserves the fix's worktree and returns the task to `.meta/todo/`
with its logs. Unclear tasks, failed reviews, and missing commits also return
there for inspection. Requeue a task by moving its complete Markdown file
into `.meta/todo/agent-queue/`; previously imported issues are not retried
automatically.

Run the local worker regression tests with:

```sh
python3 -m unittest discover -s test -p 'issue_loop_test.py'
```
