#!/usr/bin/env python3
"""Total AI tokens and estimated human hours from the session archives in .meta."""
import glob, json, os, sys
from datetime import datetime

META = sys.argv[1] if len(sys.argv) > 1 else '.meta'
GAP_MINUTES = float(os.environ.get('GAP_MINUTES', 30))

def rows(path):
    with open(path, errors='replace') as f:
        for line in f:
            try: yield json.loads(line)
            except ValueError: pass

totals = {'input': 0, 'cache_write': 0, 'cache_read': 0, 'output': 0}
by_harness = {}
seen_claude = set()

def add(harness, inp, cw, cr, out):
    for k, v in zip(totals, (inp, cw, cr, out)):
        totals[k] += v
        by_harness.setdefault(harness, dict.fromkeys(totals, 0))[k] += v

files = [p for p in glob.glob(os.path.join(META, '**', '*.jsonl'), recursive=True) if '/notes/' not in p]
for path in files:
    codex_last = None
    for r in rows(path):
        if not isinstance(r, dict): continue
        if r.get('type') == 'assistant' and isinstance(r.get('message'), dict) and r['message'].get('usage'):
            m = r['message']; key = m.get('id') or (path, r.get('uuid'))
            if key in seen_claude: continue
            seen_claude.add(key); u = m['usage']
            add('claude', u.get('input_tokens', 0), u.get('cache_creation_input_tokens', 0), u.get('cache_read_input_tokens', 0), u.get('output_tokens', 0))
        elif r.get('type') == 'event_msg' and (r.get('payload') or {}).get('type') == 'token_count' and (r['payload'].get('info') or {}).get('total_token_usage'):
            codex_last = r['payload']['info']['total_token_usage']
        elif r.get('type') == 'message' and isinstance(r.get('message'), dict) and isinstance(r['message'].get('usage'), dict) and 'totalTokens' in r['message']['usage']:
            u = r['message']['usage']
            add('pi', u.get('input', 0), u.get('cacheWrite', 0), u.get('cacheRead', 0), u.get('output', 0))
    if codex_last:
        cached = codex_last.get('cached_input_tokens', 0)
        add('codex', codex_last.get('input_tokens', 0) - cached, codex_last.get('cache_write_input_tokens', 0), cached, codex_last.get('output_tokens', 0))

prompts = sys.argv[2] if len(sys.argv) > 2 else os.path.join(META, 'notes/dev-notes/prompts.jsonl')
times = sorted(datetime.fromisoformat(json.loads(l)['date'].replace('Z', '+00:00')).timestamp() for l in open(prompts))
active = sum(min(b - a, GAP_MINUTES * 60) for a, b in zip(times, times[1:]))
bursts = 1 + sum(b - a > GAP_MINUTES * 60 for a, b in zip(times, times[1:]))

detail = {'tokens': totals, 'by_harness': by_harness, 'human_prompts': len(times), 'gap_minutes': GAP_MINUTES}
print(json.dumps(detail, indent=1), file=sys.stderr)
print(f"Human time: {round(active / 3600)} hours ({bursts} sittings); "
      f"LLM tokens: {sum(totals.values()) / 1e9:.1f} billion ({(totals['input'] + totals['cache_write']) / 1e6:.0f}m uncached, {totals['output'] / 1e6:.0f}m output)")
