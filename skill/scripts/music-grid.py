#!/usr/bin/env python3
"""Finds a song's own tempo and where its bars start, so that a film can be cut to it.

Run through uv:
    uv run --python 3.12 --with librosa --with soundfile python music-grid.py <footage folder> <file in audio/> [--near 97] [--bar-shift 2]

Writes film-project/audio/<name>.grid.json, and film-project/audio/<name>_click.mp3: the song with a tick on every beat
and a higher tick on the first beat of each bar. (Not in audio/candidates/, where music-screen.py would take it for a
candidate.) Nobody has listened: the user confirms by ear that the ticks
sit on the beat and that the high tick is the "one". If the high tick is on the wrong beat, run again with --bar-shift 1, 2 or 3.

The tempo is measured on the song's onsets by autocorrelation, refined over many beats: the k-th multiple of the beat
measures it k times more finely, which is what makes a three-minute film stay on the beat.
"""
import json
import os
import subprocess
import sys
import tempfile

import librosa
import numpy as np
import soundfile as sf

SR = 22050
HOP = 64
FPS = SR / HOP  # frames of the onset envelope per second


def fail(message):
    print(f"GRID FAIL  {message}")
    sys.exit(1)


def envelope(y, low=False):
    """How strongly sound starts, frame by frame. low: only what is under about 160 Hz (kick and bass), for finding the bar."""
    if low:
        mel = librosa.feature.melspectrogram(y=y, sr=SR, n_fft=2048, hop_length=HOP, n_mels=6, fmin=30, fmax=160)
        env = librosa.onset.onset_strength(S=librosa.power_to_db(mel), sr=SR, hop_length=HOP)
    else:
        env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    return env - env.mean()


def autocorr(env, max_lag):
    n = len(env)
    f = np.fft.rfft(env, 2 * n)
    ac = np.fft.irfft(f * np.conj(f))[:max_lag]
    return ac / (ac[0] + 1e-12)


def peak(ac, centre, half):
    """The highest point of ac within `half` frames of `centre`, placed between frames by a parabola. None if out of range."""
    lo, hi = max(1, int(round(centre - half))), min(len(ac) - 2, int(round(centre + half)))
    if hi <= lo:
        return None
    i = lo + int(np.argmax(ac[lo:hi + 1]))
    a, b, c = ac[i - 1], ac[i], ac[i + 1]
    d = a - 2 * b + c
    return i + (0.5 * (a - c) / d if d < 0 else 0.0), float(b)


def beat_period(env, near):
    """The length of a beat in seconds."""
    max_lag = int(min(len(env) // 2, 120 * FPS))
    ac = autocorr(env, max_lag)
    lo, hi = (60 / (near * 1.06), 60 / (near * 0.94)) if near else (60 / 180.0, 60 / 70.0)
    first = peak(ac, (lo + hi) / 2 * FPS, (hi - lo) / 2 * FPS)
    if first is None:
        fail("the track is too short to find a tempo")
    est, strength = first
    ks, lags = [1.0], [est]
    k = 2
    while k * est < max_lag - 2:
        hit = peak(ac, k * est, 0.2 * est)
        if hit is not None and hit[1] > 0.3 * strength:
            ks.append(float(k))
            lags.append(hit[0])
            est = float(np.dot(ks, lags) / np.dot(ks, ks))  # the line through the origin that fits every multiple so far
        k += 1
    return est / FPS


def comb_phase(env, period, t0=0.0, t1=None, contrast=False):
    """Where the beats fall between t0 and t1: the offset (0 to one beat) at which a comb of beats collects the most onsets.
    contrast: also how clearly that offset stands out from the others (standard deviations over their mean)."""
    t1 = len(env) / FPS if t1 is None else t1
    frames = np.arange(len(env))
    phis = np.arange(0.0, period, 0.001)
    values = np.full(len(phis), -1e18)
    for i, phi in enumerate(phis):
        t = np.arange(t0 + phi, t1, period)
        if len(t) >= 4:
            values[i] = float(np.interp(t * FPS, frames, env).mean())
    best = int(np.argmax(values))
    at = (t0 + phis[best]) % period
    if not contrast:
        return at
    ok = values > -1e17
    return at, float((values[best] - values[ok].mean()) / (values[ok].std() + 1e-12))


def detector_lag():
    """How late this detector reports a click, measured on clicks whose times are known."""
    y = np.zeros(SR * 20, dtype=np.float32)
    burst = (np.sin(2 * np.pi * 1000 * np.arange(441) / SR) * np.exp(-np.arange(441) / 80.0)).astype(np.float32)
    for k in range(38):
        i = int(round((0.123 + 0.5 * k) * SR))
        y[i:i + len(burst)] += burst
    found = comb_phase(envelope(y), 0.5)
    return (found - 0.123 + 0.25) % 0.5 - 0.25


def steadiness(env, period, phase, win=8.0, step=4.0):
    """How far the beats stray from one steady grid over the song (ms), and the correction to the beat length if they drift
    one way. The beats are placed in windows of `win` seconds, short enough that a tempo that changes halfway shows as a
    bend and is not averaged away; windows where the beat is too weak to place are left out."""
    points = []
    t, total = 0.0, len(env) / FPS
    while t + win <= total:
        p, clear = comb_phase(env, period, t, t + win, contrast=True)
        if clear >= 3:
            points.append((t + win / 2, (p - phase + period / 2) % period - period / 2))
        t += step
    if len(points) < 3:
        return 0.0, 0.0
    ts = np.array([p[0] for p in points])
    ds = np.unwrap(np.array([p[1] for p in points]) / period * 2 * np.pi) / (2 * np.pi) * period
    slope, icpt = np.polyfit(ts, ds, 1)
    return float(np.std(ds - (slope * ts + icpt)) * 1000), float(slope)


def bar_start(low_env, period, first_beat):
    """Which of four beats starts the bar: the one where the low end (kick, bass) most often comes in."""
    t = np.arange(first_beat, len(low_env) / FPS, period)
    v = np.interp(t * FPS, np.arange(len(low_env)), low_env)
    sums = np.array([float(v[j::4].mean()) if len(v[j::4]) else -1e9 for j in range(4)])
    order = np.argsort(sums)[::-1]
    spread = sums - sums.mean()
    return int(order[0]), round(float(spread[order[0]] / (abs(spread[order[1]]) + 1e-9)), 2)


def click_track(wav, period, first_bar, out_mp3, ffmpeg):
    y, sr = sf.read(wav, always_2d=True, dtype="float32")
    n = int(0.03 * sr)
    tick = lambda f, level: (level * np.sin(2 * np.pi * f * np.arange(n) / sr) * np.exp(-np.arange(n) / (0.006 * sr))).astype(np.float32)
    high, low = tick(1760, 0.7), tick(880, 0.45)
    out = y * 0.5
    k = -int(first_bar / period)  # ticks before the first bar too, counted so that the first bar is a multiple of four
    while True:
        i = int(round((first_bar + k * period) * sr))
        if i >= len(out):
            break
        if i >= 0:
            c = high if k % 4 == 0 else low
            m = min(len(c), len(out) - i)
            out[i:i + m] += c[:m, None]
        k += 1
    with tempfile.TemporaryDirectory() as tmp:
        mixed = os.path.join(tmp, "click.wav")
        sf.write(mixed, np.clip(out, -1, 1), sr)
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", mixed, "-c:a", "libmp3lame", "-q:a", "3", out_mp3], stdin=subprocess.DEVNULL, check=True)


def options(argv):
    """The positional arguments, and the values of --near and --bar-shift."""
    args, near, shift = [], None, 0
    i = 0
    while i < len(argv):
        if argv[i] in ("--near", "--bar-shift"):
            if i + 1 >= len(argv):
                fail(f"{argv[i]} needs a number")
            try:
                value = float(argv[i + 1])
            except ValueError:
                fail(f"{argv[i]} needs a number, not {argv[i + 1]}")
            if argv[i] == "--near":
                near = value
            else:
                shift = int(value)
            i += 2
        elif argv[i].startswith("--"):
            fail(f"unknown option {argv[i]}")
        else:
            args.append(argv[i])
            i += 1
    return args, near, shift


def main():
    args, near, shift = options(sys.argv[1:])
    if len(args) != 2:
        fail("usage: music-grid.py <footage folder> <file in audio/> [--near <bpm>] [--bar-shift <beats>]")
    root = os.path.join(os.path.abspath(args[0]), "film-project")
    song = os.path.join(root, "audio", args[1])
    if not os.path.exists(song):
        fail(f"{song} does not exist")
    try:
        with open(os.path.join(root, "logs", "tools.json")) as f:
            ffmpeg = json.load(f)["ffmpeg"]
    except Exception:
        fail(f"{root}/logs/tools.json is missing; run check-tools.sh first")

    name = os.path.splitext(os.path.basename(args[1]))[0]
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "song.wav")
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", song, "-ar", "44100", "-ac", "2", wav], stdin=subprocess.DEVNULL, check=True)
        y, _ = librosa.load(wav, sr=SR, mono=True)
        if len(y) < 20 * SR:
            fail("the track is shorter than 20 s: too short to measure a tempo that holds")
        env = envelope(y)
        period = beat_period(env, near)
        lag = detector_lag()
        phase = (comb_phase(env, period) - lag) % period
        stray, slope = steadiness(env, period, (phase + lag) % period)
        if abs(slope) > 1e-6:  # the beats drift one way: the beat is that much longer or shorter
            period *= 1 + slope
            phase = (comb_phase(env, period) - lag) % period
            stray, slope = steadiness(env, period, (phase + lag) % period)
        which, confidence = bar_start(envelope(y, low=True), period, (phase + lag) % period)
        first_bar = phase + ((which + shift) % 4) * period
        steady = stray <= 15.0
        grid = {"file": args[1], "bpm": round(60 / period, 3), "beat_s": round(period, 6), "bar_s": round(4 * period, 6), "first_beat_s": round(phase, 4),
                "first_bar_s": round(first_bar, 4), "stray_ms": round(stray, 1), "steady": steady, "bar_confidence": confidence,
                "bars": int((len(y) / SR - first_bar) // (4 * period))}
        out_json = os.path.join(root, "audio", name + ".grid.json")
        with open(out_json, "w") as f:
            json.dump(grid, f, indent=1)
        out_mp3 = os.path.join(root, "audio", name + "_click.mp3")
        click_track(wav, period, first_bar, out_mp3, ffmpeg)
    print(f"GRID_OK  {args[1]}: {grid['bpm']:.2f} BPM, {'steady' if steady else 'NOT steady'} (beats stray {grid['stray_ms']} ms), bar 1 at {grid['first_bar_s']:.3f} s (confidence {confidence}): {out_json}, {out_mp3}")


if __name__ == "__main__":
    main()
