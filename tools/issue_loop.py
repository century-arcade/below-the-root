#!/usr/bin/env python3
"""Project issue-loop worker: review fixes, then commit locally on master."""

import re
import shutil
import sys
import uuid
from pathlib import Path

# Reuse the installed worker's importer, queue, locking, logs, and controls.
# .meta/issue-loop.conf selects this runner before the shared CLI starts.
worker = shutil.which("issue-loop")
if not worker:
    raise RuntimeError("The workflow issue-loop command must be on PATH")
sys.path.insert(0, str(Path(worker).resolve().parent))
import _issue_loop as shared
from _issue_control import Aborted, Control


def verdict(text: str, expected: str) -> bool:
    """Accept a standalone verdict anywhere, including Markdown emphasis.

    Conflicting verdicts, prose guesses, and fenced examples cannot pass.
    """
    found = set()
    fence = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith(("```", "~~~")):
            marker = line[:3]
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            continue
        if fence is None:
            annotated = re.fullmatch(r"\*\*(VERDICT:\s*[a-z]+)\*\*\s+[—–-]\s+.+", line)
            if annotated:
                line = annotated[1]
            match = re.fullmatch(r"VERDICT:\s*([a-z]+)", line.strip("*`# "))
            if match:
                found.add(match[1])
    return found == {expected}


class LocalQueue(shared.Queue):
    def agent(self, stage, effort, worktree, log, context, output=None):
        if stage in ("triage", "diagnose", "review"):
            context += (f"\n\n## Current stage: {stage}\n\n"
                        "This stage is read-only. Do not implement or commit the fix. "
                        "Follow this stage's output format. The worker will invoke "
                        "the implementing stage separately when appropriate.")
        return super().agent(stage, effort, worktree, log, context, output)

    def unchanged(self, worktree: Path, head: str, stage: str) -> None:
        if (self.git("status", "--porcelain", cwd=worktree)
                or self.git("rev-parse", "HEAD", cwd=worktree) != head):
            raise RuntimeError(f"Read-only {stage} changed {worktree}; inspect the retained work.")

    def master_head(self) -> str:
        if self.git("branch", "--show-current") != "master":
            raise RuntimeError("Local delivery requires the main checkout on master.")
        if self.git("status", "--porcelain"):
            raise RuntimeError("Main checkout has uncommitted changes; preserve them before retrying.")
        return self.git("rev-parse", "HEAD")

    def process(self, task: Path) -> None:
        text = task.read_text()
        history = self.log / "tasks" / task.stem
        shared.atomic_write(history / "task.md", text)
        suffix = uuid.uuid4().hex[:12]
        log = history / suffix
        shared.atomic_write(log / "task.md", text)
        slug = re.sub(r"[^a-z0-9-]+", "-", task.stem.lower()).strip("-")[:60] or "task"
        worktree = self.repo / "_cbox" / f"{slug}-{suffix}"
        self.control = Control(self.meta, task, log, self.repo)
        try:
            base = self.master_head()
            context = (f"## Task\n\n{text}\n\n## Delivery\n\n"
                       "The implementation stage makes, tests, and commits the fix. "
                       "The worker delivers reviewed commits to local master after all stages pass. "
                       "Do not push, create PRs, comment on GitHub, or move task files. "
                       f"Do not modify the main checkout at `{self.repo}`; its generated test fixtures "
                       "may be reused read-only if missing from this worktree.")
            worktree.parent.mkdir(exist_ok=True)
            self.git("worktree", "add", "--detach", str(worktree), base)
            triage = self.agent("triage", "low", worktree, log, context)
            self.unchanged(worktree, base, "triage")
            if not verdict(triage, "ready"):
                self.finish(task, (triage or "Triage returned no verdict; inspect the logs before retrying.")
                                  + f"\n\nWorktree: `{worktree}`")
                return
            plan = self.agent("diagnose", "medium", worktree, log, context)
            self.unchanged(worktree, base, "diagnosis")
            if plan.startswith("NOT ACTIONABLE:"):
                self.finish(task, plan + f"\n\nWorktree: `{worktree}`")
                return
            context += f"\n\n## Plan\n\n{plan}"
            review = ""
            for number in range(1, self.rounds + 1):
                fix = self.agent("fix", "high", worktree, log,
                                 context + (f"\n\n## Prior review\n\n{review}" if review else ""),
                                 f"fix-{number}")
                if verdict(fix, "human"):
                    self.finish(task, fix + f"\n\nWorktree: `{worktree}`")
                    return
                if self.git("status", "--porcelain", cwd=worktree):
                    raise RuntimeError(f"Agent left uncommitted changes in {worktree}.")
                diff = self.git("diff", f"{base}...HEAD", cwd=worktree)
                if not diff:
                    raise RuntimeError("Agent made no committed changes; implementation is still required.")
                head = self.git("rev-parse", "HEAD", cwd=worktree)
                review = self.agent("review", "medium", worktree, log,
                                    context + f"\n\n## Diff\n\n```diff\n{diff}\n```",
                                    f"review-{number}")
                self.unchanged(worktree, head, "review")
                if verdict(review, "pass"):
                    if self.master_head() != base:
                        raise RuntimeError("Local master changed during the run; retain the fix for review.")
                    self.git("merge", "--ff-only", head)
                    self.finish(task, f"Local master commit: `{head}`\n\n{review}", done=True)
                    self.git("worktree", "remove", str(worktree))
                    return
            self.finish(task, f"Needs human review after {self.rounds} fix rounds.\n\n{review}"
                              f"\n\nWorktree: `{worktree}`")
        except (RuntimeError, OSError, ValueError) as error:
            self.halted = isinstance(error, Aborted) or self.control.cancelled
            if task.exists():
                self.finish(task, f"Processing stopped: {error}\n\nInspect logs in `{log}` "
                                  f"and any work at `{worktree}` before retrying.")
            else:
                print(f"issue-loop: {error}", file=sys.stderr, flush=True)
        finally:
            self.control.close()
            self.control = None


if __name__ == "__main__":
    shared.Queue = LocalQueue
    shared.main()
