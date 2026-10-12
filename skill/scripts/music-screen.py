#!/usr/bin/env python3
"""Measures music candidates before anyone listens, and makes level-matched MP3s to choose from by ear.

Run through uv:
    uv run --python 3.12 --with librosa --with soundfile python music-screen.py <footage folder> --bpm 120 [--no-vocals] [--fetch]

Candidates are the audio files in film-project/audio/candidates/. Written there: report.json, report.md, matched/<name>.mp3.
These numbers are a screen, not a judgement of how the music sounds.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import librosa
import numpy as np

MATCH_LUFS = -17.0
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Demucs's default model (htdemucs), about 84 MB. Demucs downloads it when it is missing; this script does not let it
# unless --fetch is given. Demucs 4.1 keeps it in the Hugging Face cache, earlier versions in torch's (lib/demucs.mjs
# has the same lookup for music-stems.mjs).
HF_REPO = "adefossez/HTDemucs"
HF_FILE = "955717e8.safetensors"
TORCH_FILE = "955717e8-8726e21a.th"
DEMUCS_SOURCE = f"https://huggingface.co/{HF_REPO} ({HF_FILE} and htdemucs.yaml), about 84 MB"


def fail(message):
    print(f"SCREEN FAIL  {message}")
    sys.exit(1)


def demucs_model():
    """The copy of Demucs's default model on this Mac (or None), and the two files looked for."""
    env = os.environ
    cache = env.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache")
    hub = env.get("HF_HUB_CACHE") or env.get("HUGGINGFACE_HUB_CACHE") or os.path.join(env.get("HF_HOME") or os.path.join(cache, "huggingface"), "hub")
    snapshots = os.path.join(hub, "models--" + HF_REPO.replace("/", "--"), "snapshots")
    torch = os.path.join(env.get("TORCH_HOME") or os.path.join(cache, "torch"), "hub", "checkpoints", TORCH_FILE)
    found = None
    for weights in sorted(glob.glob(os.path.join(snapshots, "*", HF_FILE))):
        # The weights alone are half a download: Demucs also reads the list that names them.
        if os.path.exists(os.path.join(os.path.dirname(weights), "htdemucs.yaml")):
            found = weights
    if not found and os.path.exists(torch):
        found = torch
    return found, [os.path.join(snapshots, "<snapshot>", HF_FILE), torch]


def key_of(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
    scored = []
    for i in range(12):
        scored.append((float(np.corrcoef(np.roll(MAJOR, i), chroma)[0, 1]), NOTES[i] + " major"))
        scored.append((float(np.corrcoef(np.roll(MINOR, i), chroma)[0, 1]), NOTES[i] + " minor"))
    scored.sort(reverse=True)
    return scored[0][1], round(scored[0][0], 2)


def phase_track(env, fps, bpm, win_s=16.0, step_s=4.0):
    """The phase of a beat grid at `bpm` in a window sliding over the onset envelope."""
    period = 60.0 / bpm
    out = []
    t = 0.0
    while (t + win_s) * fps <= len(env):
        seg = env[int(t * fps): int((t + win_s) * fps)]
        best, best_phi = -1.0, 0.0
        for phi in np.arange(0.0, period, 0.004):
            idx = ((phi + np.arange(0, win_s - phi, period)) * fps).astype(int)
            idx = idx[idx < len(seg)]
            score = float(seg[idx].mean()) if len(idx) else 0.0
            if score > best:
                best, best_phi = score, phi
        out.append((t, (t + best_phi) % period, best / (float(seg.mean()) + 1e-9)))
        t += step_s
    return out


def grid(y, sr, target):
    """Does the track hold a steady grid within 3 BPM of the target? Returns its exact tempo and how far the beats stray."""
    hop = 128
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    fps = sr / hop
    best = None
    for bpm in np.arange(target - 3.0, target + 3.01, 0.25):
        period = 60.0 / bpm
        good = [(t, p) for t, p, c in phase_track(env, fps, bpm) if c > 1.6]
        if len(good) < 6:
            continue
        ts = np.array([g[0] for g in good])
        ph = np.unwrap(np.array([g[1] for g in good]) / period * 2 * np.pi) / (2 * np.pi) * period
        slope, icpt = np.polyfit(ts, ph, 1)
        stray = float((ph - (slope * ts + icpt)).std())
        if best is None or stray < best["stray_ms"] / 1000.0:
            true_bpm = bpm / (1.0 + slope)
            best = {"bpm": round(float(true_bpm), 2), "stray_ms": round(stray * 1000, 1), "first_beat_s": round(float(icpt % (60.0 / true_bpm)), 3)}
    return best


def confirmed(beat_bpm, grid_bpm, tolerance=0.06):
    """Do the track's own beats run at the grid's tempo, or at half or double it? librosa's tempo comes in coarse steps (117.5 for 120)."""
    return any(abs(beat_bpm - grid_bpm * k) <= tolerance * grid_bpm * k for k in (0.5, 1.0, 2.0))


def loudness(ffmpeg, path):
    r = subprocess.run([ffmpeg, "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    found = re.findall(r"^\s*I:\s+(-?[\d.]+) LUFS", r.stderr, flags=re.M)
    return float(found[-1]) if found else None


def vocals_db(demucs, path, y_rms, fetch=False):
    """How loud a voice is in the track: the level of Demucs's vocal stem against the whole mix, in dB. None if Demucs cannot run."""
    with tempfile.TemporaryDirectory() as tmp:
        # Offline unless the user agreed to the download: with its model on this Mac, Demucs then fetches nothing.
        env = os.environ if fetch else {**os.environ, "HF_HUB_OFFLINE": "1"}
        r = subprocess.run([demucs, "--two-stems", "vocals", "-d", "mps", "-o", tmp, path], stdin=subprocess.DEVNULL, capture_output=True, text=True, env=env)
        stems = glob.glob(os.path.join(tmp, "*", "*", "vocals.wav"))
        if r.returncode != 0 or not stems:
            return None
        v, _ = librosa.load(stems[0], sr=22050, mono=True)
        return round(float(20 * np.log10((np.sqrt(np.mean(v ** 2)) + 1e-9) / (y_rms + 1e-9))), 1)


def analyse(path, target, ffmpeg, demucs, fetch=False):
    y, sr = librosa.load(path, sr=22050, mono=True)
    out = {"file": os.path.basename(path), "seconds": round(len(y) / sr, 1)}
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=target, tightness=100)
    out["beat_bpm"] = round(float(np.atleast_1d(tempo)[0]), 1)
    out["grid"] = grid(y, sr, target)
    # A grid that the track's own beats do not confirm is where two tempos meet, not the track's pulse:
    # a track at 150 BPM lands on every fourth beat of a 120 BPM grid, as steadily as a track at 120.
    if out["grid"] and not confirmed(out["beat_bpm"], out["grid"]["bpm"]):
        out["grid"] = None
    out["key"], out["key_fit"] = key_of(y, sr)
    out["lufs"] = loudness(ffmpeg, path)
    win = int(4 * sr)
    rms = np.array([np.sqrt(np.mean(y[i:i + win] ** 2) + 1e-12) for i in range(0, max(1, len(y) - win // 2), win)])
    out["energy_db_per_4s"] = [int(round(v)) for v in 20 * np.log10(rms / rms.max())]
    frames = librosa.feature.rms(y=y, frame_length=2048, hop_length=1024)[0]
    quiet = frames < frames.max() * 10 ** (-50 / 20)
    out["lead_silence_s"] = round(int(np.argmax(~quiet)) * 1024 / sr, 2)
    out["trail_silence_s"] = round(int(np.argmax(~quiet[::-1])) * 1024 / sr, 2)
    out["vocals_db"] = vocals_db(demucs, path, float(np.sqrt(np.mean(y ** 2))), fetch) if demucs else None
    return out


def verdict(c, target):
    g = c["grid"]
    if g is None:
        return f"does not hold a steady grid near {target:g} BPM (its beats suggest {c['beat_bpm']} BPM): cut to its own tempo, or leave it"
    off = abs(g["bpm"] - target) / target * 100
    steady = "steady" if g["stray_ms"] <= 15 else f"loose ({g['stray_ms']} ms)"
    if off < 0.2:
        return f"on the grid at {g['bpm']} BPM, {steady}"
    return f"{g['bpm']} BPM, {off:.1f}% from the film's {target:g}, {steady}: stretch it with Rubber Band"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args or "--bpm" not in sys.argv:
        fail("usage: music-screen.py <footage folder> --bpm <film tempo> [--no-vocals] [--fetch]")
    target = float(sys.argv[sys.argv.index("--bpm") + 1])
    root = os.path.join(os.path.abspath(args[0]), "film-project")
    folder = os.path.join(root, "audio", "candidates")
    files = sorted(f for ext in ("wav", "flac", "mp3", "m4a") for f in glob.glob(os.path.join(folder, f"*.{ext}")))
    if not files:
        fail(f"no audio files in {folder}")
    try:
        with open(os.path.join(root, "logs", "tools.json")) as f:
            ffmpeg = json.load(f)["ffmpeg"]
    except Exception:
        fail(f"{root}/logs/tools.json is missing; run check-tools.sh first")
    demucs = None if "--no-vocals" in sys.argv else (shutil.which("demucs") or os.path.expanduser("~/.local/bin/demucs"))
    if demucs and not os.path.exists(demucs):
        demucs = None
    fetch = "--fetch" in sys.argv
    if demucs and not fetch:
        found, places = demucs_model()
        if not found:
            print(f"NOTE  voices are not measured: Demucs's model is not on this Mac (looked for {' and '.join(places)}). Demucs would fetch it from {DEMUCS_SOURCE}: ask the user first, then run this again with --fetch.")
            demucs = None

    results = [analyse(f, target, ffmpeg, demucs, fetch) for f in files]
    matched = os.path.join(folder, "matched")
    os.makedirs(matched, exist_ok=True)
    for path, c in zip(files, results):
        # Levels are matched downwards only: raising a quiet track hits the peak ceiling and leaves them unequal.
        gain = min(0.0, MATCH_LUFS - c["lufs"]) if c["lufs"] is not None else 0.0
        c["matched_gain_db"] = round(gain, 1)
        mp3 = os.path.join(matched, os.path.splitext(c["file"])[0] + ".mp3")
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", path, "-af", f"volume={gain:.2f}dB", "-c:a", "libmp3lame", "-q:a", "2", mp3], stdin=subprocess.DEVNULL, check=True)
        c["verdict"] = verdict(c, target)

    with open(os.path.join(folder, "report.json"), "w") as f:
        json.dump({"bpm": target, "candidates": results}, f, indent=1)
    lines = ["# Music candidates", "", f"Measured against the film's {target:g} BPM. Nobody has listened: these numbers are a screen, not a judgement.", "",
             "| Candidate | Length | Tempo and grid | Key | Loudness | Voice | Silence at start, end | For listening |", "|---|---|---|---|---|---|---|---|"]
    for c in results:
        voice = "not measured" if c["vocals_db"] is None else (f"{-c['vocals_db']:.1f} dB under the mix" +(" (a voice may be audible)" if c["vocals_db"] > -20 else ""))
        level = "unknown" if c["lufs"] is None else f"{c['lufs']:.1f} LUFS"
        lines.append(f"| {c['file']} | {c['seconds']} s | {c['verdict']} | {c['key']} ({c['key_fit']}) | {level} | {voice} | {c['lead_silence_s']} s, {c['trail_silence_s']} s | matched/{os.path.splitext(c['file'])[0]}.mp3 ({c['matched_gain_db']} dB) |")
    lines += ["", "Energy in 4-second steps, in dB under the loudest step:", ""]
    lines += [f"- {c['file']}: {' '.join(str(v) for v in c['energy_db_per_4s'])}" for c in results]
    report = os.path.join(folder, "report.md")
    with open(report, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"SCREEN_OK  {len(results)} candidates: {report}")


if __name__ == "__main__":
    main()
