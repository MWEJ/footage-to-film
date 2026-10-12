#!/usr/bin/env python3
"""Photos for a film project: each as an upright sRGB JPEG (long side at most 2880 px), a thumbnail, and labelled contact sheets.

Run through uv:  uv run --python 3.12 --with pillow --with pillow-heif python photos.py <footage folder>
Reads film-project/notes/inventory.json. Skips photos already converted.
"""
import glob
import io
import json
import os
import sys

import pillow_heif
from PIL import Image, ImageCms, ImageDraw, ImageFont, ImageOps

pillow_heif.register_heif_opener()
LONG = 2880
THUMB = 300
COLS, ROWS = 5, 4


def convert(src, out_jpg, out_meta, out_thumb):
    im = Image.open(src)
    icc = im.info.get("icc_profile")
    im = ImageOps.exif_transpose(im)  # upright pixels, no orientation flag
    if im.mode != "RGB":
        im = im.convert("RGB")
    if icc:
        # Phone photos are Display P3. Convert to sRGB, or they come out dull in a browser-rendered film.
        try:
            profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            if "sRGB" not in ImageCms.getProfileDescription(profile):
                im = ImageCms.profileToProfile(im, profile, ImageCms.createProfile("sRGB"), outputMode="RGB")
        except Exception as e:  # a profile Pillow cannot read: keep the pixels as they are
            print(f"NOTE  {os.path.basename(src)}: colour profile not converted ({e})")
    im.thumbnail((LONG, LONG), Image.LANCZOS)
    im.save(out_jpg, quality=90)
    with open(out_meta, "w") as f:
        json.dump({"w": im.width, "h": im.height}, f)
    im.thumbnail((THUMB, THUMB), Image.LANCZOS)
    im.save(out_thumb, quality=82)


def sheets(ids, thumbs, review):
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 16)
    except Exception:
        font = ImageFont.load_default()
    pad, label = 8, 26
    per = COLS * ROWS
    made = []
    for start in range(0, len(ids), per):
        part = ids[start:start + per]
        rows = (len(part) + COLS - 1) // COLS
        sheet = Image.new("RGB", (COLS * (THUMB + pad) + pad, rows * (THUMB + label + pad) + pad), (26, 26, 26))
        draw = ImageDraw.Draw(sheet)
        for i, pid in enumerate(part):
            x = pad + (i % COLS) * (THUMB + pad)
            y = pad + (i // COLS) * (THUMB + label + pad)
            th = Image.open(os.path.join(thumbs, pid + ".jpg"))
            sheet.paste(th, (x + (THUMB - th.width) // 2, y + (THUMB - th.height) // 2))
            draw.text((x + 4, y + THUMB + 4), pid, fill=(255, 255, 255), font=font)
        name = os.path.join(review, f"photos_{start // per + 1:02d}.jpg")
        sheet.save(name, quality=85)
        made.append(name)
    return made


def main():
    if len(sys.argv) < 2:
        print("PHOTOS FAIL  give the footage folder")
        sys.exit(1)
    footage = os.path.abspath(sys.argv[1])
    root = os.path.join(footage, "film-project")
    with open(os.path.join(root, "notes", "inventory.json")) as f:
        photos = json.load(f)["photos"]
    out = os.path.join(root, "sources", "photos")
    review = os.path.join(root, "review")
    thumbs = os.path.join(review, "thumbs")
    os.makedirs(out, exist_ok=True)
    os.makedirs(thumbs, exist_ok=True)
    made = kept = 0
    errors = []
    for p in photos:
        jpg = os.path.join(out, p["id"] + ".jpg")
        meta = os.path.join(out, p["id"] + ".json")
        thumb = os.path.join(thumbs, p["id"] + ".jpg")
        if os.path.exists(jpg) and os.path.exists(meta) and os.path.exists(thumb):
            kept += 1
            continue
        try:
            convert(os.path.join(footage, p["file"]), jpg, meta, thumb)
            made += 1
        except Exception as e:
            errors.append(f"{p['file']}: {e!r}")
    done = [p["id"] for p in photos if os.path.exists(os.path.join(thumbs, p["id"] + ".jpg"))]
    for old in glob.glob(os.path.join(review, "photos_*.jpg")):
        os.remove(old)
    pages = sheets(done, thumbs, review)
    for e in errors:
        print(f"FAIL  {e}")
    if errors:
        print(f"PHOTOS FAIL  {len(errors)} of {len(photos)} photos could not be converted")
        sys.exit(1)
    print(f"PHOTOS_OK  {made} converted, {kept} already done, {len(pages)} contact sheet{'' if len(pages) == 1 else 's'}")


if __name__ == "__main__":
    main()
