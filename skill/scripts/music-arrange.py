#!/usr/bin/env python3
"""Cuts a song to a film: which bars of the song play at which bars of the film.

Run through uv:
    uv run --python 3.12 --with soundfile --with numpy python music-arrange.py <footage folder> [<plan file in audio/>]

The plan (audio/arrange.json unless another is named):
    { "file": "song.wav", "grid": "song.grid.json", "out": "song_cut.wav", "stems": "song.stems",
      "parts": [ { "bar": 1, "bars": 8, "from": 1 }, { "bar": 9, "bars": 16, "from": 33 } ] }
"bar" is the film's bar, "from" the song's bar (1 is the bar at first_bar_s in the grid file), "bars" how many.
Writes audio/<out>, which starts at the film's bar 1, and the stems cut the same way when "stems" is given.

Where the song jumps, the join sits 15 ms before the downbeat, so the downbeat's attack is whole, and the two sides
are crossfaded over 20 ms. Parts that follow on in the song are not cut at all.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

PRE = 0.015
XF = 0.020
TAIL = 0.6
STEMS = ["vocals", "drums", "bass", "other"]


def fail(message):
    print(f"ARRANGE FAIL  {message}")
    sys.exit(1)


def cut(src, dst, parts, bar_s, first):
    y, sr = sf.read(src, always_2d=True, dtype="float64")
    pre, xf = int(round(PRE * sr)), int(round(XF * sr))
    film = lambda bar: int(round((bar - 1) * bar_s * sr))             # the sample where a bar of the film starts
    song = lambda bar: int(round((first + (bar - 1) * bar_s) * sr))    # the sample where a bar of the song starts
    total = film(parts[-1]["bar"] + parts[-1]["bars"])
    out = np.zeros((total, y.shape[1]))
    joins = []
    for i, p in enumerate(parts):
        a, b = film(p["bar"]), film(p["bar"] + p["bars"])
        # A part runs from just before its first downbeat to just before the next part's. At a join both sides overlap
        # by the crossfade: this one fades in, the one before fades out.
        lo = a - pre - xf if i > 0 else a
        hi = b - pre if i < len(parts) - 1 else b
        idx = np.arange(lo, hi)
        srci = song(p["from"]) + (idx - a)
        ok = (srci >= 0) & (srci < len(y)) & (idx >= 0)
        piece = np.zeros((len(idx), y.shape[1]))
        piece[ok] = y[srci[ok]]
        gain = np.ones(len(idx))
        if i > 0:
            gain[:xf] = np.sin(0.5 * np.pi * (np.arange(xf) + 0.5) / xf)
            joins.append(round((a - pre) / sr, 3))
        if i < len(parts) - 1:
            gain[-xf:] *= np.cos(0.5 * np.pi * (np.arange(xf) + 0.5) / xf)
        keep = idx >= 0
        out[idx[keep]] += piece[keep] * gain[keep, None]
    n = min(int(round(0.005 * sr)), total)
    out[:n] *= (np.arange(n) / n)[:, None]
    t = min(int(round(TAIL * sr)), total)
    out[-t:] *= np.cos(0.5 * np.pi * np.arange(t) / t)[:, None] ** 2
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sf.write(dst, out, sr, subtype="PCM_24")
    return total / sr, joins


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        fail("usage: music-arrange.py <footage folder> [<plan file in audio/>]")
    audio = os.path.join(os.path.abspath(args[0]), "film-project", "audio")
    plan_file = os.path.join(audio, args[1] if len(args) > 1 else "arrange.json")
    if not os.path.exists(plan_file):
        fail(f"{plan_file} is missing")
    with open(plan_file) as f:
        plan = json.load(f)
    for key in ("file", "grid", "out", "parts"):
        if key not in plan:
            fail(f'the plan has no "{key}"')
    with open(os.path.join(audio, plan["grid"])) as f:
        grid = json.load(f)
    bar_s, first = float(grid["bar_s"]), float(grid["first_bar_s"])
    expected = 1
    for p in plan["parts"]:
        if p["bar"] != expected:
            fail(f"the film's bars must follow on without a gap: a part starts at bar {p['bar']} where bar {expected} is next")
        if p["bars"] < 1 or p["from"] < 1:
            fail(f"a part needs at least one bar, from bar 1 or later of the song: {json.dumps(p)}")
        if p["from"] + p["bars"] - 1 > grid.get("bars", 10 ** 9):
            fail(f"the song has {grid['bars']} bars; a part asks for bars {p['from']} to {p['from'] + p['bars'] - 1}")
        expected += p["bars"]
    # Parts that follow on in the song are one stretch of it: there is nothing to join.
    parts = []
    for p in plan["parts"]:
        if parts and parts[-1]["from"] + parts[-1]["bars"] == p["from"]:
            parts[-1]["bars"] += p["bars"]
        else:
            parts.append(dict(p))

    seconds, joins = cut(os.path.join(audio, plan["file"]), os.path.join(audio, plan["out"]), parts, bar_s, first)
    if plan.get("stems"):
        base = os.path.splitext(plan["out"])[0] + ".stems"
        for s in STEMS:
            src = os.path.join(audio, plan["stems"], s + ".wav")
            if not os.path.exists(src):
                fail(f"{src} is missing")
            cut(src, os.path.join(audio, base, s + ".wav"), parts, bar_s, first)
    where = f" (at {', '.join(f'{j} s' for j in joins)})" if joins else ""
    print(f"ARRANGE_OK  {plan['out']}: {expected - 1} bars, {seconds:.2f} s, {len(joins)} join{'' if len(joins) == 1 else 's'}{where}")


if __name__ == "__main__":
    main()
