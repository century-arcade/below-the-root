#!/usr/bin/env python3
"""Launch x64sc (SDL UI on Xvfb, remote monitor) and drive it.

    from emu import Emu
    e = Emu()                 # boots disk 1
    e.boot_game()             # through the side-2 swap, into the demo
    e.joy('f'); e.shot('x.png'); e.peek(0xdc00, 2)
"""
import os
import re
import subprocess
import time

from vicemon import Mon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISK1 = os.path.join(ROOT, 'iso/below_the_root_1.g64')
DISK2 = os.path.join(ROOT, 'iso/below_the_root_2.g64')
SHOTS = os.path.join(ROOT, 'build/shots')
DUMPS = os.path.join(ROOT, 'build/dumps')

# numpad keyset: -joydev 1
JOYKEYS = {
    'u': ['KP_8'], 'd': ['KP_2'], 'l': ['KP_4'], 'r': ['KP_6'],
    'ul': ['KP_7'], 'ur': ['KP_9'], 'dl': ['KP_1'], 'dr': ['KP_3'],
    'f': ['KP_0'],
}


def ensure_xvfb(display):
    if subprocess.run(['pgrep', '-f', f'Xvfb {display}'], capture_output=True).returncode != 0:
        subprocess.Popen(['Xvfb', display, '-screen', '0', '1024x768x24'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)


class Emu:
    def __init__(self, disk=DISK1, warp=True, extra=(), log='build/vice-run.log', display=':99'):
        subprocess.run(['pkill', '-x', 'x64sc'], capture_output=True)
        ensure_xvfb(display)
        self.env = dict(os.environ, SDL_AUDIODRIVER='dummy', DISPLAY=display)
        args = ['x64sc', '-default', '-sounddev', 'wav', '-soundarg', '/dev/null', '-remotemonitor',
                '-joydev1', '0', '-joydev2', '1', '-soundwarpmode', '1']
        if warp:
            args.append('-warp')
        args += list(extra)
        if disk:
            args += ['-autostart', disk]
        os.makedirs(SHOTS, exist_ok=True)
        os.makedirs(DUMPS, exist_ok=True)
        self.log = open(os.path.join(ROOT, log), 'w')
        self.proc = subprocess.Popen(args, env=self.env, stdout=self.log, stderr=subprocess.STDOUT, cwd=ROOT)
        time.sleep(2)
        self.mon = Mon()
        self.mon.cont()
        self._win = None

    # -- monitor wrappers (emulator resumes after each) --------------------
    def paused(self, fn):
        self.mon.stop()
        try:
            return fn()
        finally:
            self.mon.cont()

    def cmd(self, line):
        return self.paused(lambda: self.mon.cmd(line))

    def screen_text(self):
        return self.paused(self.mon.screen)

    def peek(self, addr, length=1):
        return self.paused(lambda: self.mon.read(addr, length))

    def poke(self, addr, data):
        return self.paused(lambda: self.mon.write(addr, data))

    def pc(self):
        return self.paused(self.mon.pc)

    def shot(self, name):
        path = os.path.join(SHOTS, name)
        self.paused(lambda: self.mon.screenshot(path))
        return path

    def snapshot(self, name):
        path = os.path.join(DUMPS, name + '.vsf')
        self.paused(lambda: self.mon.cmd(f'dump "{path}"'))
        return path

    def save_ram(self, name, start=0x0000, end=0xffff):
        path = os.path.join(DUMPS, name + '.bin')
        self.paused(lambda: self.mon.save(path, start, end))
        return path

    def attach(self, path, unit=8):
        return self.paused(lambda: self.mon.attach(path, unit))

    def keybuf(self, text):
        return self.paused(lambda: self.mon.keybuf(text))

    def wait_text(self, text, timeout=120, poll=1.0):
        deadline = time.time() + timeout
        sc = ''
        while time.time() < deadline:
            sc = self.screen_text()
            if text.upper() in sc.upper():
                return sc
            time.sleep(poll)
        raise TimeoutError(f'{text!r} not seen; last screen:\n{sc}')

    # -- X11 input (XTEST to the focused VICE window) ----------------------
    def win(self):
        if self._win is None:
            for _ in range(20):
                out = subprocess.run(['xwininfo', '-root', '-tree'], capture_output=True, text=True, env=self.env).stdout
                m = re.search(r'(0x[0-9a-f]+) "VICE', out)
                if m:
                    self._win = m.group(1)
                    subprocess.run(['xdotool', 'windowfocus', '--sync', self._win], env=self.env, capture_output=True)
                    break
                time.sleep(0.5)
        return self._win

    def _xdo(self, *args):
        self.win()
        subprocess.run(['xdotool', *args], env=self.env, capture_output=True)

    def key(self, name, hold=0.25):
        self._xdo('keydown', name)
        time.sleep(hold)
        self._xdo('keyup', name)

    def joy(self, direction, hold=0.25, settle=0.5):
        keys = JOYKEYS[direction]
        for k in keys:
            self._xdo('keydown', k)
        time.sleep(hold)
        for k in keys:
            self._xdo('keyup', k)
        time.sleep(settle)

    # -- scenarios ---------------------------------------------------------
    def boot_game(self):
        """Disk 1 loader -> side-2 prompt -> swap -> game entry ($8400)."""
        self.wait_text('INSERT SIDE 2')
        self.mon.stop()
        self.mon.keybuf(' ')
        self.mon.attach(DISK2)
        self.mon.cont()
        time.sleep(6)

    def close(self):
        try:
            self.mon.quit()
        except Exception:
            pass
        self.proc.kill()
        self.log.close()
