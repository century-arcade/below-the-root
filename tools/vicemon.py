#!/usr/bin/env python3
"""Client for the VICE text remote monitor (x64sc -remotemonitor).

    from vicemon import Mon
    m = Mon()            # connects to 127.0.0.1:6510 (emulator pauses)
    m.cmd('m 0800 0810')
    m.read(0x0400, 0x400) -> bytes
    m.cont()             # resume; emulator runs until next break/interrupt
"""
import re
import socket
import time

PROMPT = re.compile(rb'\(C:\$[0-9a-f]{4}\) $')


class Mon:
    def __init__(self, host='127.0.0.1', port=6510, timeout=30, retries=50):
        for _ in range(retries):
            try:
                self.s = socket.create_connection((host, port), timeout=timeout)
                break
            except OSError:
                time.sleep(0.2)
        else:
            raise RuntimeError('cannot connect to VICE monitor')
        self.timeout = timeout
        self.s.settimeout(timeout)
        self.stop()

    def _read_until_prompt(self):
        buf = b''
        while not PROMPT.search(buf):
            chunk = self.s.recv(65536)
            if not chunk:
                raise EOFError('monitor closed')
            buf += chunk
        return buf.decode('latin-1')

    def cmd(self, line):
        self.s.sendall((line + '\n').encode())
        out = self._read_until_prompt()
        return out

    def pc(self):
        out = self.cmd('r')
        m = re.search(r'\.;([0-9a-f]{4})', out)
        return int(m.group(1), 16) if m else None

    def read(self, start, length):
        out = self.cmd(f'm {start:04x} {start + length - 1:04x}')
        data = bytearray()
        for line in out.splitlines():
            m = re.match(r'>C:([0-9a-f]{4})\s+((?:[0-9a-f]{2}\s+)+)', line)
            if m:
                data += bytes.fromhex(m.group(2).replace(' ', ''))
        return bytes(data[:length])

    def write(self, addr, data):
        for i in range(0, len(data), 16):
            chunk = ' '.join(f'{b:02x}' for b in data[i:i + 16])
            self.cmd(f'> {addr + i:04x} {chunk}')

    def save(self, path, start, end):
        return self.cmd(f'save "{path}" 0 {start:04x} {end:04x}')

    def screen(self):
        return self.cmd('screen')

    def screenshot(self, path):
        return self.cmd(f'screenshot "{path}" 2')

    def attach(self, path, unit=8):
        return self.cmd(f'attach "{path}" {unit}')

    def keybuf(self, text):
        return self.cmd(f'keybuf "{text}"')

    def cont(self):
        self.s.sendall(b'x\n')

    def stop(self):
        # any command wakes the monitor while the emulator runs
        self.s.sendall(b'r\n')
        out = self._read_until_prompt()
        return out + self._drain()

    def _drain(self, quiet=0.3):
        self.s.settimeout(quiet)
        buf = b''
        try:
            while True:
                chunk = self.s.recv(65536)
                if not chunk:
                    break
                buf += chunk
        except OSError:
            pass
        self.s.settimeout(self.timeout)
        return buf.decode('latin-1')

    def quit(self):
        try:
            self.s.sendall(b'quit\n')
        except OSError:
            pass
        self.s.close()
