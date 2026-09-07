"""Exercise local delivery against real temporary Git repositories, without AI."""

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("local_loop", ROOT / "tools/issue_loop.py")
loop = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(loop)


class VerdictTests(unittest.TestCase):
    def test_ready_after_analysis_and_markdown(self):
        for output in ("VERDICT: ready", "Analysis.\n\n**VERDICT: ready**\n\nCriteria.",
                       "\n`VERDICT: ready`\n", "## VERDICT: ready"):
            with self.subTest(output=output):
                self.assertTrue(loop.verdict(output, "ready"))

    def test_missing_conflicting_or_quoted_verdict_does_not_pass(self):
        for output in ("", "Sure, ready!", "Not VERDICT: ready", "> VERDICT: ready",
                       "VERDICT: ready\nVERDICT: human", "VERDICT: unknown",
                       "Example:\n```text\nVERDICT: ready\n```", "VERDICT: ready if tests pass"):
            with self.subTest(output=output):
                self.assertFalse(loop.verdict(output, "ready"))


class LocalDeliveryTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.repo = Path(temp.name) / "repo"
        self.repo.mkdir()
        self.q = loop.LocalQueue(self.repo)
        self.q.queue.mkdir(parents=True)
        for repo in (self.repo, self.q.meta):
            loop.shared.command("git", "init", "-q", "-b", "master", cwd=repo)
            loop.shared.command("git", "config", "user.name", "Loop Test", cwd=repo)
            loop.shared.command("git", "config", "user.email", "test@example.invalid", cwd=repo)
        (self.repo / ".gitignore").write_text(".meta/\n_cbox/\n")
        (self.repo / "fixture.txt").write_text("before\n")
        self.q.git("add", ".gitignore", "fixture.txt")
        self.q.git("commit", "-qm", "Initial")
        self.base = self.q.git("rev-parse", "HEAD")
        # A remote exists so an accidental push is observable, even without gh.
        self.origin = self.repo.parent / "origin.git"
        loop.shared.command("git", "clone", "--bare", "-q", str(self.repo), str(self.origin), cwd=self.repo)
        self.q.git("remote", "add", "origin", str(self.origin))
        (self.q.queue / "github-2.md").write_text("# Fix the fixture\n\nReturn to idle after landing.\n")
        self.stages = []

    def agent(self, stage, effort, worktree, log, context, output=None):
        self.stages.append(stage)
        if stage == "triage":
            return "The fix is clear.\n\n**VERDICT: ready**\n\nAcceptance: fix and test."
        if stage == "diagnose":
            return "Change fixture.txt and verify."
        if stage == "fix":
            (worktree / "fixture.txt").write_text("after\n")
            self.q.git("add", "fixture.txt", cwd=worktree)
            self.q.git("commit", "-qm", "Fix fixture", cwd=worktree)
            return "Implemented and committed."
        if stage == "review":
            self.assertEqual((worktree / "fixture.txt").read_text(), "after\n")
            return "Verified the fix.\n\n**VERDICT: pass**"
        self.fail(stage)

    def run_task(self, agent=None):
        with patch.object(self.q, "agent", side_effect=agent or self.agent), \
             patch.object(self.q, "gh", side_effect=AssertionError("No GitHub calls during local delivery")):
            self.q.tick("github-2.md")
        self.assertEqual(loop.shared.command("git", "rev-parse", "master", cwd=self.origin), self.base)

    def test_ready_reaches_fix_review_and_local_master_only(self):
        # Include unpublished local work: the loop must base its fix on this.
        (self.repo / "local.txt").write_text("unpublished\n")
        self.q.git("add", "local.txt")
        self.q.git("commit", "-qm", "Local work")
        local_base = self.q.git("rev-parse", "HEAD")
        self.run_task()
        self.assertEqual(self.stages, ["triage", "diagnose", "fix", "review"])
        self.assertEqual(self.q.git("branch", "--show-current"), "master")
        self.assertEqual(self.q.git("rev-parse", "HEAD^"), local_base)
        self.assertEqual((self.repo / "fixture.txt").read_text(), "after\n")
        self.assertEqual(self.q.git("status", "--porcelain"), "")
        self.assertEqual(list((self.repo / "_cbox").iterdir()), [])
        done = (self.q.meta / "done/github-2.md").read_text()
        self.assertIn(self.q.git("rev-parse", "HEAD"), done)
        self.assertNotIn("Draft PR", done)

    def test_diagnosis_alone_cannot_complete_task(self):
        def agent(stage, *args):
            if stage == "fix":
                return "Diagnosed the issue; add one line to fix it."
            return self.agent(stage, *args)
        self.run_task(agent)
        self.assertIn("no committed changes", (self.q.todo / "github-2.md").read_text())
        self.assertEqual(self.q.git("rev-parse", "HEAD"), self.base)

    def test_uncommitted_fix_is_retained(self):
        def agent(stage, effort, worktree, *args):
            if stage == "fix":
                (worktree / "fixture.txt").write_text("uncommitted\n")
                return "Forgot to commit."
            return self.agent(stage, effort, worktree, *args)
        self.run_task(agent)
        self.assertIn("uncommitted changes", (self.q.todo / "github-2.md").read_text())
        self.assertTrue(list((self.repo / "_cbox").iterdir()))
        self.assertEqual(self.q.git("rev-parse", "HEAD"), self.base)

    def test_master_change_during_review_is_preserved(self):
        def agent(stage, *args):
            result = self.agent(stage, *args)
            if stage == "review":
                (self.repo / "human.txt").write_text("human work\n")
                self.q.git("add", "human.txt")
                self.q.git("commit", "-qm", "Human work")
            return result
        self.run_task(agent)
        self.assertIn("master changed", (self.q.todo / "github-2.md").read_text())
        self.assertEqual((self.repo / "fixture.txt").read_text(), "before\n")
        self.assertEqual((self.repo / "human.txt").read_text(), "human work\n")
        self.assertTrue(list((self.repo / "_cbox").iterdir()))

    def test_dirty_master_or_wrong_branch_stops_before_agent(self):
        for condition in ("dirty", "branch"):
            with self.subTest(condition=condition):
                if condition == "dirty":
                    (self.repo / "human.txt").write_text("uncommitted\n")
                else:
                    (self.repo / "human.txt").unlink()
                    self.q.git("checkout", "-qb", "human")
                    self.q.move(self.q.todo / "github-2.md", self.q.queue)
                self.run_task()
                self.assertEqual(self.stages, [])
                self.assertEqual(self.q.git("rev-parse", "HEAD"), self.base)

    def test_failed_review_keeps_commit_off_master(self):
        self.q.rounds = 1
        def agent(stage, *args):
            if stage == "review":
                return "VERDICT: fail\nMissing regression coverage."
            return self.agent(stage, *args)
        self.run_task(agent)
        self.assertEqual(self.q.git("rev-parse", "HEAD"), self.base)
        self.assertIn("Missing regression coverage", (self.q.todo / "github-2.md").read_text())

    def test_config_hook_selects_local_runner(self):
        # Exercise the real shell entrypoint and project config, without AI.
        (self.repo / "tools").mkdir()
        (self.repo / "tools/issue_loop.py").write_text((ROOT / "tools/issue_loop.py").read_text())
        (self.q.meta / "issue-loop.conf").write_text('exec python3 tools/issue_loop.py "$@"\n')
        result = subprocess.run([loop.worker, "ls"], cwd=self.repo, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("github-2.md", result.stdout)


if __name__ == "__main__":
    unittest.main()
