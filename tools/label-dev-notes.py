#!/usr/bin/env python3
"""Label each unlabeled dev-notes prompt in place as nonpublic/junk/core/design/bug/meta, one claude -p call per message with its session as context."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

SYSTEM = """You classify one message that a developer (Saul) typed to an AI coding agent while restoring the 1984 C64 game "Below the Root" as a JavaScript/canvas port.  The messages may be published on the game's website as development notes.

Reply with exactly one word, one of:
nonpublic -- should not be shared publicly: credentials, tokens, client ids, private emails/addresses, personal or third-party private matters, complaints about named people, internal account/billing/infrastructure details, or anything embarrassing or legally sensitive.
junk -- no interesting content on its own: approvals, acknowledgements, bare commands or slash commands, "yes", "go ahead", "draft plan, then /close", "fold them in", "continue", "commit it", short process steering.
core -- a major direction-setting message: project goals, milestones, architecture, big pivots, the overall approach, significant discoveries or problem reports that shaped the work.
design -- a smaller concrete design decision or feedback: UI/visual/sound tweaks, gameplay behaviour details, naming, layout choices.
bug -- a bug or problem report, or a follow-up to one: "it's broken", "still loading forever", "works in chromium but not firefox", "the deployed site still fails".

meta -- only about the development process, not the game: which AI model or agent to use and how it performs ("i'm curious if the text from opus is as reasonable as with fable"), where notes, summaries, plans or todos live and how they are kept ("where is the summary of where we're at, on disk? we should have it in the toplevel README"), picking up a plan or todo file ("let's do @.meta/todo/m6-js-port.md"), agent workflow and tooling.

If nonpublic applies, it wins over the others.  meta is the weakest label: use it only when the message is purely about process; if it also carries any game, site or project content, pick core, design or bug instead.

You are given every message Saul typed in the same session, for context only.  Classify only the message marked TARGET; use the others to understand what it refers to (for example, whether it continues a bug report)."""

LABELS = {'nonpublic', 'junk', 'core', 'design', 'bug', 'meta'}
MODEL = os.environ.get('MODEL', 'sonnet')
env = {k: v for k, v in os.environ.items() if k not in ('CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION')}

def prompt(row):
    ctx = sessions[row['sessionfn']]
    parts = ['Session messages (context only):']
    for i, r in enumerate(ctx, 1):
        mark = 'TARGET' if r is row else 'context'
        parts.append(f'--- {i} [{mark}] {r["date"]}\n{r["msg"]}')
    parts.append('--- end of session\n\nTARGET message to classify:\n<<<\n' + row['msg'] + '\n>>>')
    return '\n'.join(parts)

def label(row):
    for _ in range(3):
        try:
            r = subprocess.run(['claude', '-p', '--model', MODEL, '--system-prompt', SYSTEM, '--tools', ''],
                               input=prompt(row), capture_output=True, text=True, env=env, timeout=180)
        except subprocess.TimeoutExpired:
            continue
        word = r.stdout.strip().lower().strip('.').split()[:1]
        if word and word[0] in LABELS:
            return {**row, 'label': word[0]}
    return {**row, 'label': None}

work = sys.argv[1]
rows = [json.loads(l) for l in open(work)]
sessions = {}
for r in rows: sessions.setdefault(r['sessionfn'], []).append(r)
todo = [r for r in rows if not r.get('label')]
print(f'labeling {len(todo)} of {len(rows)} prompts', file=sys.stderr)

def save():
    tmp = work + '.tmp'
    with open(tmp, 'w') as out:
        out.writelines(json.dumps(r, ensure_ascii=False) + '\n' for r in rows)
    os.replace(tmp, work)

with ThreadPoolExecutor(int(os.environ.get('JOBS', 8))) as pool:
    for i, (r, labeled) in enumerate(zip(todo, pool.map(label, todo)), 1):
        r['label'] = labeled['label']
        if i % 25 == 0: save(); print(f'{i}/{len(todo)}', file=sys.stderr)
save()
