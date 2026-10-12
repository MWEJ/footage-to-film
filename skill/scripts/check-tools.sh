#!/bin/bash
# Finds the tools the skill needs and tests that each one really works, by running it.
# usage: bash check-tools.sh [<footage folder>]
# Prints PASS / FAIL / NOTE lines and one verdict. If <footage folder>/film-project/logs exists, writes tools.json there.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH"
set -u
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
FOOTAGE="${1:-}"
T="$(mktemp -d "${TMPDIR:-/tmp}/toolcheck.XXXXXX")"
FAILS=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }
note() { echo "NOTE  $1"; }
# try <what> <command ...>: PASS if the command exits 0. Otherwise FAIL, followed by the last lines it printed.
try() {
  local what="$1"
  shift
  if "$@" > "$T/out.txt" 2>&1 < /dev/null; then
    pass "$what"
    return 0
  fi
  fail "$what"
  tail -n 5 "$T/out.txt" | sed 's/^/        /'
  return 1
}

# ffmpeg: the first candidate that has every filter the skill uses. Homebrew's plain ffmpeg is a slim build and lacks some.
NEED="lut3d scale fps setparams loudnorm ebur128 tile blackdetect freezedetect drawtext"
FF=""
for c in /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg "$(command -v ffmpeg || true)"; do
  [ -n "$c" ] && [ -x "$c" ] || continue
  "$c" -hide_banner -filters > "$T/filters.txt" 2> /dev/null < /dev/null || continue
  missing=""
  for f in $NEED; do grep -q " $f " "$T/filters.txt" || missing="$missing $f"; done
  if [ -z "$missing" ]; then FF="$c"; break; fi
  note "$c lacks the filters:$missing"
done
FP=""
if [ -n "$FF" ]; then
  pass "ffmpeg with every filter the skill uses: $FF"
  FP="$(dirname "$FF")/ffprobe"
  try "ffprobe beside it" "$FP" -version
  try "HDR to standard range through the colour table" bash -c 'cd "$1/assets" && "$2" -v error -f lavfi -i testsrc2=s=640x360:d=0.2:r=30 -vf "format=yuv420p10le,setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv,scale=320:180:in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp10le,lut3d=file=hlg2sdr_f.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -frames:v 3 -f null -' _ "$SKILL" "$FF"
  try "H.264 and AAC into MP4, tagged BT.709" "$FF" -v error -y -f lavfi -i testsrc2=s=640x360:d=0.5:r=30 -f lavfi -i sine=f=440:d=0.5 -c:v libx264 -g 15 -pix_fmt yuv420p -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1 -c:a aac "$T/t.mp4"
  try "text on frames (drawtext)" "$FF" -v error -y -f lavfi -i color=c=navy:s=320x180:d=0.1 -vf "drawtext=fontfile=/System/Library/Fonts/Menlo.ttc:text=Test:fontsize=24:fontcolor=white:x=8:y=8" -frames:v 1 "$T/text.jpg"
  try "loudness measurement (loudnorm)" "$FF" -hide_banner -f lavfi -i sine=f=440:d=1 -af loudnorm=print_format=json -f null -
else
  fail "no ffmpeg with the filters: $NEED (install Homebrew's ffmpeg-full)"
fi

# whisper.cpp, tested on a spoken sentence.
WH="$(command -v whisper-cli || true)"
WM="${WHISPER_MODEL:-$HOME/.local/share/whisper.cpp/models/ggml-large-v3-turbo.bin}"
if [ -n "$WH" ] && [ -f "$WM" ] && [ -n "$FF" ]; then
  say -o "$T/say.aiff" "testing one two three" < /dev/null
  "$FF" -v error -y -i "$T/say.aiff" -ac 1 -ar 16000 -c:a pcm_s16le "$T/say.wav" < /dev/null
  if "$WH" -m "$WM" -f "$T/say.wav" -l en -otxt -of "$T/say" -np > "$T/out.txt" 2>&1 < /dev/null && grep -qi "testing" "$T/say.txt"; then
    pass "whisper.cpp transcribes speech: $WH"
  else
    fail "whisper.cpp did not transcribe a spoken test sentence"
  fi
else
  [ -n "$WH" ] || fail "whisper-cli was not found"
  [ -f "$WM" ] || fail "the whisper model is missing: $WM"
fi

EX="$(command -v exiftool || true)"
if [ -n "$EX" ]; then try "exiftool" "$EX" -ver; else fail "exiftool was not found"; fi
NODE="$(command -v node || true)"
if [ -n "$NODE" ]; then try "Node 20 or later" "$NODE" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"; else fail "node was not found"; fi
UV="$(command -v uv || true)"
if [ -n "$UV" ]; then
  try "Python with Pillow and pillow-heif, through uv (fetched from PyPI the first time)" "$UV" run --python 3.12 --with pillow --with pillow-heif python -c "import pillow_heif, PIL; print(PIL.__version__)"
else
  fail "uv was not found"
fi

# Swift with Vision finds the faces in the footage (faces.swift). A tiny script is compiled and run to prove it works.
SW="$(command -v swift || true)"
if [ -n "$SW" ]; then
  printf 'import AVFoundation\nimport Foundation\nimport Vision\nexit(VNDetectFaceRectanglesRequest().revision > 0 ? 0 : 1)\n' > "$T/vision.swift"
  try "Swift with Vision, for finding faces" "$SW" "$T/vision.swift"
else
  fail "swift was not found (install Xcode's command line tools: xcode-select --install)"
fi

# Used by later stages of the skill; reported, not required.
for t in "$HOME/.local/bin/demucs" rubberband; do
  if command -v "$t" > /dev/null 2>&1; then note "found $t"; else note "not found: $t (not needed yet)"; fi
done
if [ -d "$HOME/code/ACE-Step-1.5" ]; then note "found ACE-Step at ~/code/ACE-Step-1.5"; else note "not found: ACE-Step (only needed to generate music)"; fi

if [ -n "$FOOTAGE" ] && [ -d "$FOOTAGE/film-project/logs" ]; then
  node -e 'const [file, ffmpeg, ffprobe, whisper, whisperModel, exiftool, uv, node, swift] = process.argv.slice(1); require("fs").writeFileSync(file, JSON.stringify({ ffmpeg, ffprobe, whisper, whisperModel, exiftool, uv, node, swift, checked: new Date().toISOString() }, null, 1) + "\n");' \
    "$FOOTAGE/film-project/logs/tools.json" "$FF" "$FP" "$WH" "$WM" "$EX" "$UV" "$NODE" "$SW" < /dev/null
  echo "wrote $FOOTAGE/film-project/logs/tools.json"
fi

case "$T" in */toolcheck.*) rm -rf "$T" ;; esac
if [ "$FAILS" -eq 0 ]; then
  echo "TOOLS PASS"
else
  echo "TOOLS FAIL ($FAILS)"
  exit 1
fi
