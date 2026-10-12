#!/usr/bin/env python3
"""Generates music takes for a film with ACE-Step 1.5.

Run with ACE-Step's own Python, from ACE-Step's folder:
    cd ~/code/ACE-Step-1.5 && .venv/bin/python <this file> <footage folder> [--dry-run] [take name ...]

Reads film-project/audio/candidates/takes.json:
    [{ "name": "A_indie_pop", "caption": "Upbeat indie pop instrumental ...", "bpm": 120, "duration": 176, "seed": 1101,
       "keyscale": "D Major", "lyrics": "[Instrumental]" }]
Writes film-project/audio/candidates/<name>.flac. A 3-minute take needs about 2.5 minutes on this Mac.

What worked on the first film: give bpm, keyscale and duration as parameters, not in the caption. With
lyrics "[Instrumental]" the takes locked to the requested tempo; a written section plan in the lyrics gave more
light and shade but loose timing. The requested key is not followed reliably: measure it with music-screen.py.
"""
import json
import os
import shutil
import sys
import time

ACE = os.path.expanduser(os.environ.get("ACE_STEP_DIR", "~/code/ACE-Step-1.5"))
DIT = "acestep-v15-turbo"
LM = "acestep-5Hz-lm-1.7B"


def fail(message):
    print(f"TAKES FAIL  {message}")
    sys.exit(1)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        fail("give the footage folder as the first argument")
    folder = os.path.join(os.path.abspath(args[0]), "film-project", "audio", "candidates")
    list_file = os.path.join(folder, "takes.json")
    if not os.path.exists(list_file):
        fail(f"{list_file} is missing")
    with open(list_file) as f:
        takes = json.load(f)
    for t in takes:
        for key in ("name", "caption", "bpm", "duration", "seed"):
            if key not in t:
                fail(f"a take in takes.json has no \"{key}\": {json.dumps(t)[:120]}")
    wanted = args[1:] or [t["name"] for t in takes]
    unknown = [n for n in wanted if n not in {t["name"] for t in takes}]
    if unknown:
        fail(f"takes.json has no take named {', '.join(unknown)}")
    if not os.path.isdir(os.path.join(ACE, "acestep")) or not os.path.isdir(os.path.join(ACE, "checkpoints")):
        fail(f"ACE-Step was not found at {ACE} (expected its acestep/ and checkpoints/ folders)")
    # A model that is missing would be downloaded when ACE-Step starts. Ask the user first.
    missing = [m for m in (DIT, LM) if not os.path.isdir(os.path.join(ACE, "checkpoints", m))]
    if missing:
        fail(f"ACE-Step's checkpoints folder lacks {', '.join(missing)}; starting it would download them, so ask the user first")
    if dry:
        print(f"TAKES_DRY_OK  {len(wanted)} takes would be generated into {folder}")
        return

    os.environ.setdefault("ACESTEP_LM_BACKEND", "mlx")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    sys.path.insert(0, ACE)
    os.chdir(ACE)
    from acestep.handler import AceStepHandler
    from acestep.inference import GenerationConfig, GenerationParams, generate_music
    from acestep.llm_inference import LLMHandler

    dit = AceStepHandler()
    message, ok = dit.initialize_service(project_root=ACE, config_path=DIT, device="auto", offload_to_cpu=False)
    if not ok:
        fail(f"ACE-Step did not start: {str(message)[:300]}")
    llm = LLMHandler()
    message, ok = llm.initialize(checkpoint_dir=os.path.join(ACE, "checkpoints"), lm_model_path=LM, backend="mlx", device="auto", offload_to_cpu=False, dtype=None)
    if not ok:
        fail(f"ACE-Step's language model did not start: {str(message)[:300]}")

    made = 0
    for t in takes:
        if t["name"] not in wanted:
            continue
        target = os.path.join(folder, t["name"] + ".flac")
        if os.path.exists(target):
            print(f"kept  {t['name']}")
            continue
        params = GenerationParams(task_type="text2music", thinking=True, caption=t["caption"], lyrics=t.get("lyrics", "[Instrumental]"), seed=t["seed"],
                                  bpm=t["bpm"], keyscale=t.get("keyscale", "C Major"), timesignature="4", duration=float(t["duration"]), inference_steps=8, shift=3.0)
        config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[t["seed"]], audio_format="flac")
        save_dir = os.path.join(folder, "raw", t["name"])
        os.makedirs(save_dir, exist_ok=True)
        t0 = time.time()
        result = generate_music(dit, llm, params=params, config=config, save_dir=save_dir)
        paths = [a.get("path") for a in (result.audios or [])] if result.success else []
        if not paths or not paths[0] or not os.path.exists(paths[0]):
            fail(f"take {t['name']} was not generated: {str(getattr(result, 'error', '') or getattr(result, 'status_message', ''))[:300]}")
        shutil.copyfile(paths[0], target)
        made += 1
        print(f"made  {t['name']} in {time.time() - t0:.0f} s", flush=True)
    print(f"TAKES_OK  {made} generated: {folder}")


if __name__ == "__main__":
    main()
