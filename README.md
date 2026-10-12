# footage-to-film

A Claude Code skill that turns a folder of phone videos and photos into a finished short film, rendered on this Mac: a story, cuts on the beat, titles, captions for spoken lines, music under a mastered mix.

## Install

This repository is a Claude Code plugin marketplace. In Claude Code, run:

```
/plugin marketplace add MWEJ/footage-to-film
/plugin install footage-to-film@footage-to-film
```

Or from a terminal:

```bash
claude plugin marketplace add MWEJ/footage-to-film
```

```bash
claude plugin install footage-to-film@footage-to-film --scope user
```

On Claude Code 2.1.275 or later, one line does both: `/plugin install footage-to-film --marketplace MWEJ/footage-to-film`.

Start a new session and type `/footage-to-film:footage-to-film`, or just ask for a film from a folder of footage. To get updates, run `/plugin marketplace update footage-to-film`.

The edit kit's packages (about 700 MB, including the browser Remotion renders with) are not part of the plugin. The first film installs them with `npm ci`, which needs a network connection and takes a few minutes.

### From a clone

To work on the skill itself, clone the repository and link it instead:

```bash
bash install.sh
```

This links `skill/` into `~/.claude/skills/footage-to-film` and installs the edit kit's packages once, so every film clones them instantly. Then type `/footage-to-film`. Because the folder is linked, changes take effect without installing again; with `bash install.sh --copy` they do not, and it must be run again.

## Use

Open Claude Code, point it at a folder of footage, and ask for a film. The skill asks a few questions once, then works in a `film-project/` folder inside the footage folder. It never changes the originals. `skill/SKILL.md` describes the ten steps.

## What is here

| Folder | What it is |
|---|---|
| `skill/SKILL.md`, `skill/references/` | the workflow and what it has learned |
| `skill/scripts/` | preparing a film: tool check, project, inventory, strips, transcripts, conversion |
| `skill/kit/` | the Remotion project that every film's `edit/` folder is a copy of |
| `skill/assets/` | the HDR-to-standard colour table |
| `.claude-plugin/` | the marketplace and plugin manifests |

## Tests

```bash
node --test "skill/scripts/lib/*.test.mjs"
npm --prefix skill/kit ci
npm --prefix skill/kit test
```

## What it needs

macOS, Node 20 or later, Homebrew's `ffmpeg-full`, `whisper.cpp` with the `large-v3-turbo` model, `exiftool` and `uv`. `bash skill/scripts/check-tools.sh` tests each of them.

## Licence note

The film is rendered with [Remotion](https://www.remotion.dev), which is free for individuals and for companies of up to three people. Larger companies need a Remotion licence.

## License

MIT, see [LICENSE](LICENSE).
