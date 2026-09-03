#!/usr/bin/env python3
"""G64 nibble image decoder: GCR -> sectors, anomaly report, optional .d64 output.

usage: g64.py IMAGE.g64 [--d64 OUT.d64] [--dump-dir DIR] [-v]
"""
import argparse
import struct

GCR_DECODE = {
    0b01010: 0x0, 0b01011: 0x1, 0b10010: 0x2, 0b10011: 0x3,
    0b01110: 0x4, 0b01111: 0x5, 0b10110: 0x6, 0b10111: 0x7,
    0b01001: 0x8, 0b11001: 0x9, 0b11010: 0xA, 0b11011: 0xB,
    0b01101: 0xC, 0b11101: 0xD, 0b11110: 0xE, 0b10101: 0xF,
}

SECTORS_PER_TRACK = [21] * 17 + [19] * 7 + [18] * 6 + [17] * 12   # tracks 1..42


def sectors_on(track):
    return SECTORS_PER_TRACK[track - 1]


class Track:
    def __init__(self, num, data):
        self.num = num          # 1.0, 1.5, 2.0 ... (half-track aware)
        self.data = data
        self.nbits = len(data) * 8
        self.headers = []       # (bitpos, track, sector, id1, id2, checksum_ok)
        self.sectors = {}       # sector -> bytes(256)
        self.bad = []           # messages
        self.syncs = []         # (bitpos, length)

    def bit(self, i):
        i %= self.nbits
        return (self.data[i >> 3] >> (7 - (i & 7))) & 1

    def find_syncs(self):
        run = 0
        start = 0
        # scan twice the length so a sync straddling the wrap is seen once at least
        for i in range(self.nbits + 64):
            if self.bit(i):
                if run == 0:
                    start = i
                run += 1
            else:
                if run >= 10 and start < self.nbits:
                    self.syncs.append((start % self.nbits, run, i))
                run = 0
        # dedupe by end position
        seen = set()
        out = []
        for s, l, e in self.syncs:
            key = e % self.nbits
            if key in seen:
                continue
            seen.add(key)
            out.append((s, l, key))
        self.syncs = out

    def read_gcr_bytes(self, bitpos, n):
        out = bytearray()
        for _ in range(n):
            hi = lo = 0
            for _ in range(5):
                hi = (hi << 1) | self.bit(bitpos)
                bitpos += 1
            for _ in range(5):
                lo = (lo << 1) | self.bit(bitpos)
                bitpos += 1
            h = GCR_DECODE.get(hi)
            l = GCR_DECODE.get(lo)
            if h is None or l is None:
                return None, bitpos
            out.append((h << 4) | l)
        return bytes(out), bitpos

    def decode(self):
        self.find_syncs()
        pending_header = None
        for _start, length, after in self.syncs:
            blk, _ = self.read_gcr_bytes(after, 1)
            if blk is None:
                self.bad.append(f"bad GCR after sync@{after}")
                continue
            kind = blk[0]
            if kind == 0x08:
                hdr, _ = self.read_gcr_bytes(after, 8)
                if hdr is None:
                    self.bad.append(f"bad header GCR @{after}")
                    continue
                _, chk, sec, trk, id2, id1, _g1, _g2 = hdr
                ok = (chk == (sec ^ trk ^ id1 ^ id2))
                self.headers.append((after, trk, sec, id1, id2, ok, length))
                pending_header = (trk, sec, ok)
                if not ok:
                    self.bad.append(f"header checksum bad t{trk} s{sec}")
            elif kind == 0x07:
                blk, _ = self.read_gcr_bytes(after, 258)
                if blk is None:
                    self.bad.append(f"bad data GCR @{after} (hdr={pending_header})")
                    pending_header = None
                    continue
                payload = blk[1:257]
                chk = blk[257]
                calc = 0
                for b in payload:
                    calc ^= b
                if pending_header is None:
                    self.bad.append(f"data block without header @{after}")
                    continue
                trk, sec, _hok = pending_header
                pending_header = None
                if calc != chk:
                    self.bad.append(f"data checksum bad t{trk} s{sec}")
                if sec in self.sectors:
                    self.bad.append(f"duplicate sector t{trk} s{sec}")
                self.sectors[sec] = payload
                self.sectors_meta = getattr(self, 'sectors_meta', {})
                self.sectors_meta[sec] = dict(trk=trk, chk_ok=(calc == chk), sync=length)
            else:
                self.bad.append(f"unknown block id {kind:#04x} after sync@{after} len{length}")


def load_g64(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'GCR-1541', 'not a G64'
    halftracks = d[9]
    maxlen = struct.unpack('<H', d[10:12])[0]
    offs = struct.unpack('<%dI' % halftracks, d[12:12 + 4 * halftracks])
    speeds = struct.unpack('<%dI' % halftracks, d[12 + 4 * halftracks:12 + 8 * halftracks])
    tracks = []
    for i, off in enumerate(offs):
        if not off:
            continue
        ln = struct.unpack('<H', d[off:off + 2])[0]
        tracks.append(Track(1 + i / 2, d[off + 2:off + 2 + ln]))
        tracks[-1].speed = speeds[i]
    return tracks, halftracks, maxlen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('--d64')
    ap.add_argument('--dump-dir')
    ap.add_argument('-v', action='store_true')
    a = ap.parse_args()
    tracks, ht, maxlen = load_g64(a.image)
    print(f"{a.image}: {ht} halftracks, max track len {maxlen}, {len(tracks)} tracks present")
    full = {}
    for t in tracks:
        t.decode()
        ids = {(h[3], h[4]) for h in t.headers}
        hdr_trks = {h[1] for h in t.headers}
        exp = sectors_on(int(t.num)) if t.num <= 42 else '?'
        flag = ''
        if t.num != int(t.num):
            flag = ' HALF'
        line = (f"t{t.num:5.1f} len={len(t.data):5d} spd={t.speed} syncs={len(t.syncs):3d} "
                f"hdrs={len(t.headers):3d} secs={len(t.sectors):2d}/{exp} ids={sorted(ids)} "
                f"hdrtrk={sorted(hdr_trks)}{flag}")
        if t.bad:
            line += f"  BAD:{len(t.bad)}"
        print(line)
        if a.v:
            for b in t.bad[:20]:
                print("     ", b)
            print("      sync lengths:", sorted({s[1] for s in t.syncs}))
        if t.num == int(t.num):
            full[int(t.num)] = t
    if a.d64:
        out = bytearray()
        missing = []
        for trk in range(1, 36):
            t = full.get(trk)
            for s in range(sectors_on(trk)):
                if t and s in t.sectors:
                    out += t.sectors[s]
                else:
                    out += bytes(256)
                    missing.append((trk, s))
        open(a.d64, 'wb').write(out)
        print(f"wrote {a.d64} ({len(out)} bytes); missing sectors: {missing}")
    if a.dump_dir:
        import os
        os.makedirs(a.dump_dir, exist_ok=True)
        for t in tracks:
            for s, data in t.sectors.items():
                open(os.path.join(a.dump_dir, f"t{t.num:04.1f}s{s:02d}.bin"), 'wb').write(data)


if __name__ == '__main__':
    main()
