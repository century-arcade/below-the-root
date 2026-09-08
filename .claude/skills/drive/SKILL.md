---
name: drive
description: Drive one task through the issue-loop stages by hand, pausing for the user after each stage.
---

Interactive issue-loop for one task.  Same stage prompts, runner, conf, and
delivery as `tools/issue_loop.py` (see `docs/issue-loop.md`); the user sees
every stage result and can steer before the next one.  Stop after every
stage and wait unless the user said to run through.

Task: `$ARGUMENTS`

## 1. Task file

If `$ARGUMENTS` names a file in `.meta/todo/`, use it.  Otherwise write
`.meta/todo/<slug>.md` (frontmatter `description:`, body with the desired
result and how to verify it; `github_issue: N` when there is one), commit it
in `.meta`, show it, stop.

Log dir: `.meta/issue-loop/tasks/<slug>/manual-<12 hex>/`.  Save each stage's
prompt as `<stage>.prompt.md` and output as `<stage>.md` there.

## 2. Diagnose

Main checkout must be clean and on `master`; `base=$(git rev-parse HEAD)`.
`git worktree add --detach _cbox/<slug>-<suffix> $base`.

Do the `diagnose` stage yourself, read-only, in that worktree, with the
prompt `~/git/workflow/lib/issue-loop/diagnose.md` + `## Task` + the
`## Delivery` paragraph from `tools/issue_loop.py`.  Append the plan to the
task file under `## Plan`, commit `.meta`, show it, stop.

## 3. Fix

Round 1 uses `STAGE_FIX` from `.meta/issue-loop.conf`, later rounds
`STAGE_REFIX` (`vendor:model[:effort]`).  Prompt =
`~/git/workflow/lib/issue-loop/fix.md` + `## Task` + `## Delivery` +
`## Plan` + `## Prior review` (review text plus the user's notes, verbatim).

    $ AGENT_VENDOR=<vendor> AGENT_CODEX_MODEL=<model> \
      agent -v <vendor> -e high -C _cbox/<slug>-<suffix> - \
      < fix-<n>.prompt.md > fix-<n>.md 2> fix-<n>.log

(For claude vendors set `AGENT_CLAUDE_HIGH=<model>` instead.)  Run it in the
background; codex takes 5-20 minutes.  When it exits: `VERDICT: human` ->
show and stop.  Uncommitted changes or no commits -> show and stop.

## 4. Review

Do the `review` stage yourself, read-only, in the worktree, prompt
`~/git/workflow/lib/issue-loop/review.md` + `## Task` + `## Plan` +
`## Diff` (`git diff $base...HEAD`).  Run the tests.  Show the verdict and
review, stop for the user's additions.

- fail -> round n+1 at step 3, `MAX_ROUNDS` is advisory here.
- pass -> on the user's go: `git merge --ff-only <head>` on master, close the
  GitHub issue with a comment naming the commit (when `github_issue:` is
  set), append the commit to the task file, `git -C .meta mv todo/<slug>.md
  done/`, commit `.meta`, `git worktree remove` the worktree.
