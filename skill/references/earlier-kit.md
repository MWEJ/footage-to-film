# A film made with the earlier kit

Before this skill had its own Remotion kit, films were made with a canvas render engine that lives inside each film's project. You can tell such a project by its folders: `film-project/render/` (with `engine.js`, `comp.js`, `render.mjs` and `sections/s1.js …`), and no `film-project/edit/` and no `STATUS.md`. It usually has a `HANDOFF.md` or a `README.md` written by the session that made it.

**Continue such a film with its own tools.** Do not run `new-film.mjs` on it (it refuses), and do not use this skill's ten steps, its scripts or the edit's `npm run` commands: none of them apply. The film's graphics are drawn in canvas code and its sound is built by its own mix script; moving it to the new kit would mean rebuilding it.

## How to work on it

1. Read the project's `HANDOFF.md` from top to bottom, then its `README.md`. They say where the film stands, what the user has asked for and decided, how the edit is laid out, how to build and check, and what went wrong before. Follow them.
2. Those papers were written for a cloud session that reached the Mac through remote tools. In Claude Code you are on the Mac already, so:
   - Where they say to use `device_bash`, the `osascript` tool or a wrapper such as `tools/x.sh`, run the command directly with Bash, from the folder they name (usually `film-project/render/`). Start a long job (a build, a mix) as a background command and read its log when it ends.
   - Where they say to stage a file in order to look at it, read the file directly.
   - Where they say to send a preview through the chat, send the file to the user.
   - Ignore anything about a three-minute limit, split transfers, or not being able to delete.
3. Quote paths: footage folders often have spaces, commas or a curly apostrophe in their names.
4. The ground rules of this skill still hold: you cannot watch or listen, so judge from stills and measurements and say so; only facts from the footage or the user go on screen; never change or delete originals; a new render never overwrites a finished film.
5. Keep the project's own papers up to date after every delivery, as they ask.

## If the user wants the film in the new kit

Say what it takes before starting: every section rewritten as layers for the new kit, every drawn graphic rebuilt as a component, and the sound either kept as the finished mix (which fixes the timing of every spoken line) or rebuilt. It is a project of hours, not an edit. A new film is the better place to start using the new kit.
