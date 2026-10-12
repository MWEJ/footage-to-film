#!/bin/bash
# Makes the skill available to Claude Code: links this repository's skill/ folder into the skills folder,
# and installs the kit's packages so that new films can clone them.
# usage: bash install.sh [--copy]
#   --copy   copy instead of linking (if a linked folder is not picked up). Run it again after every change to skill/.
#   SKILLS_DIR=<folder>   install somewhere other than ~/.claude/skills
#   SKILL_NAME=<name>     install under another folder name (also change "name:" in skill/SKILL.md to match)
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
SKILLS="${SKILLS_DIR:-$HOME/.claude/skills}"
NAME="${SKILL_NAME:-footage-to-film}"
TARGET="$SKILLS/$NAME"

if [ ! -f "$REPO/skill/SKILL.md" ]; then
  echo "INSTALL FAIL  $REPO/skill/SKILL.md is missing"
  exit 1
fi
if [ ! -x "$REPO/skill/kit/node_modules/.bin/remotion" ]; then
  npm ci --prefix "$REPO/skill/kit"
fi

mkdir -p "$SKILLS"
if [ "${1:-}" = "--copy" ]; then
  if [ -L "$TARGET" ]; then rm "$TARGET"; fi
  mkdir -p "$TARGET"
  rsync -a --delete --exclude node_modules --exclude out "$REPO/skill/" "$TARGET/"
  # new-film.mjs clones the kit's installed packages into each film. Give the copy its own, as a clone
  # (instant, no extra space on this Mac's file system), or every new film would download them again.
  # rsync --delete leaves the excluded folder alone, so this is done once.
  if [ ! -e "$TARGET/kit/node_modules" ]; then cp -Rc "$REPO/skill/kit/node_modules" "$TARGET/kit/node_modules"; fi
  HOW="copied to"
else
  if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
    echo "INSTALL FAIL  $TARGET exists and is not a link; move it away first"
    exit 1
  fi
  ln -sfn "$REPO/skill" "$TARGET"
  HOW="linked at"
fi
if [ ! -f "$TARGET/SKILL.md" ]; then
  echo "INSTALL FAIL  $TARGET/SKILL.md cannot be read"
  exit 1
fi
echo "INSTALL_OK  skill $HOW $TARGET"
echo "Start a new Claude Code session and type /$NAME. If that opens the older Cowork skill instead, install under another name: SKILL_NAME=make-film bash install.sh, and change \"name:\" in skill/SKILL.md to make-film."
