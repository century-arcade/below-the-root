---
name: drive
description: Drive one task through the issue-loop stages by hand, pausing for the user after each stage.
---

Interactive issue-loop for one task.  Same stage prompts, conf, and
delivery as the workflow worker under `PUBLISH=local`
(`~/git/workflow/scripts/_issue_loop.py`; see `docs/issue-loop.md`); the user sees
every stage result and can steer before the next one.  Stop after every
stage and wait unless the user said to run through.

Task: `$ARGUMENTS`

## 1. Task file

If `$ARGUMENTS` names a file in `.meta/todo/`, use it.  Otherwise write
`.meta/todo/<slug>.md` (frontmatter `description:`, body with the desired
result and how to verify it; `github_issue: N` when there is one), commit it
in `.meta`, show it, stop.

Log dir: `.meta/issue-loop/tasks/<slug>/manual-<12 hex>/` (gitignored in
`.meta`).  Save each stage's prompt as `<stage>.prompt.md` and output as
`<stage>.md` there.

## Who runs a stage

`.meta/issue-loop.conf` assigns `STAGE_<NAME>=vendor:model[:effort]`.  A
`claude` vendor means do the stage yourself in this session with the stage
prompt as your brief.  A `codex` vendor means shell out, in the background
(5-20 minutes):

    $ AGENT_CODEX_MODEL=<model> agent -v codex -e <effort> -C <worktree> - \
      < <stage>.prompt.md > <stage>.md 2> <stage>.log

Defaults when the conf sets no effort: medium for diagnose and review, high
for fix.  Read-only stages (diagnose, review) get the worker's "Current
stage" note appended and must leave the worktree unchanged; check with
`git status` afterwards.

## 2. Diagnose

Main checkout must be clean and on `master`; `base=$(git rev-parse HEAD)`.
`git worktree add --detach _cbox/<slug>-<suffix> $base`.

Run `STAGE_DIAGNOSE` in that worktree with the prompt
`~/git/workflow/lib/issue-loop/diagnose.md` + `## Task` + the `## Delivery`
paragraph from `_issue_loop.py`'s `process`.  When another agent diagnosed, check
the plan against the code: file:line claims, whether it is right, nothing
about how to implement it.  Append the plan to the task file under
`## Plan`, commit `.meta`, show plan and verdict, stop.

## 3. Fix

Round 1 uses `STAGE_FIX` from `.meta/issue-loop.conf`, later rounds
`STAGE_REFIX` (`vendor:model[:effort]`).  Prompt =
`~/git/workflow/lib/issue-loop/fix.md` + `## Task` + `## Delivery` +
`## Plan` + `## Prior review` (review text plus the user's notes, verbatim).

A `claude` fix vendor still shells out (`AGENT_CLAUDE_HIGH=<model> agent -v
claude -e high ...`) so the fixer never sees this conversation.  When it
exits: `VERDICT: human` -> show and stop.  Uncommitted changes or no commits
-> show and stop.

## 4. Review

Run `STAGE_REVIEW` in the worktree, prompt
`~/git/workflow/lib/issue-loop/review.md` + `## Task` + `## Plan` +
`## Diff` (`git diff $base...HEAD`).  Run the tests, including the browser
suites against `make serve` when the diff touches `src/`.  Save the review
as `review-<n>.md`, show the verdict and review, stop for the user's
additions.

- fail -> round n+1 at step 3, `MAX_ROUNDS` is advisory here.
- pass -> on the user's go: `git merge --ff-only <head>` on master, close the
  GitHub issue with a comment naming the commit (when `github_issue:` is
  set), append the commit to the task file, `git -C .meta mv todo/<slug>.md
  done/`, commit `.meta`, `git worktree remove` the worktree.
