#!/usr/bin/env python3
"""Launch x64sc (SDL UI on Xvfb :99, remote monitor) and drive it.

    from emu import Emu
    e = Emu(disk='iso/below_the_root_1.g64')
    e.wait_text('INSERT SIDE 2'); e.mon.keybuf(' '); ...
"""
import os
import subprocess
import time

from vicemon import Mon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISK1 = os.path.join(ROOT, 'iso/below_the_root_1.g64')
DISK2 = os.path.join(ROOT, 'iso/below_the_root_2.g64')


def ensure_xvfb(display=':99'):
    if subprocess.run(['pgrep', '-f', f'Xvfb {display}'], capture_output=True).returncode != 0:
        subprocess.Popen(['Xvfb', display, '-screen', '0', '1024x768x24'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)


class Emu:
    def __init__(self, disk=DISK1, warp=True, extra=(), log='build/vice-run.log', display=':99'):
        ensure_xvfb(display)
        env = dict(os.environ, SDL_AUDIODRIVER='dummy', DISPLAY=display)
        args = ['x64sc', '-default', '-sounddev', 'dummy', '-remotemonitor', '-joydev1', '1', '-joydev2', '1']
        if warp:
            args.append('-warp')
        args += list(extra)
        if disk:
            args += ['-autostart', disk]
        self.log = open(os.path.join(ROOT, log), 'w')
        self.proc = subprocess.Popen(args, env=env, stdout=self.log, stderr=subprocess.STDOUT, cwd=ROOT)
        time.sleep(2)
        self.mon = Mon()
        self.mon.cont()

    def run(self, seconds):
        """Let the emulator run for wall-clock seconds, then re-enter the monitor."""
        time.sleep(seconds)
        return self.mon.stop()

    def screen_text(self):
        self.mon.stop()
        txt = self.mon.screen()
        self.mon.cont()
        return txt

    def wait_text(self, text, timeout=120, poll=1.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            sc = self.screen_text()
            if text.upper() in sc.upper():
                return sc
            time.sleep(poll)
        raise TimeoutError(f'{text!r} not seen; last screen:\n{sc}')

    def shot(self, name):
        path = os.path.join(ROOT, 'build/shots', name)
        self.mon.stop()
        self.mon.screenshot(path)
        self.mon.cont()
        return path

    def close(self):
        try:
            self.mon.quit()
        except Exception:
            pass
        self.proc.kill()
        self.log.close()
