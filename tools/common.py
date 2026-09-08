"""Shared paths, RAM loading, JSON output and video timing."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOADED = os.path.join(ROOT, 'build', 'dumps', 'loaded.bin')
FPS_NTSC = 59.826
FPS_PAL = 50.125


def load_ram(path=LOADED):
    with open(path, 'rb') as f:
        return f.read()[2:]


def write_json(path, obj):
    with open(path, 'w') as f:
        json.dump(obj, f, indent=1)
        f.write('\n')
