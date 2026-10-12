# Mistakes already made once

Add to this after every film.

## Footage and tools

- A tool check that pipes into `head` or sits inside `$(…)` reports the wrong exit status. Demucs "passed" that way while it could not start. Judge a tool by running it.
- In a shell loop, give every ffmpeg `< /dev/null`, or it eats the loop's input.
- A standard-range file still tagged HLG renders oversaturated and harsh. Converted files must be tagged BT.709; `convert.mjs` checks this.
- Whisper invents words on clips where nobody speaks. Read transcripts against the frame strips.
- Before telling the user what is safe to delete, check that the originals still exist (`originals.mjs`).
- A finished film in the footage folder was once at risk of being inventoried as a clip. Films are recognised by the versions the kit keeps and by "(render N)" in their name; a film copied in by hand under another name is footage to the inventory, so do not rename films inside the footage folder.

## Editing

- Telephoto clips shot from far away fall apart beyond about 1.6 times zoom. Put them in a panel.
- Natural-sound beds can contain strangers' names, such as an announcer reading other graduates. Read the transcript of any bed before using it.
- A shot that starts on the very first sample of its converted file loses about 12 ms of sound. Selects are converted with a handle so this does not happen; do not hand-make converted files without one.
- In a custom element, give the top-level drawing `position: absolute`, or wrap it in `AbsoluteFill`. An unpositioned element is painted underneath a positioned sibling such as the backdrop, and the text vanishes.
- Do not name two modules so that they differ only in letter case. macOS resolves `./Layers` to `layers.ts`.

## Music and sound

- Composing music from code took 2.5 hours and nobody could hear the result. Use a real track or generated takes.
- When the user says a film has no sound, measure the file first. The app's file preview can play video silently while the file is fine.

## Reviewing

- Studio shown in a hidden browser pane drops frames. Do not judge playback from screenshots of it; ask the user to watch.
- Studio is for timing and sound. It plays video through a different path than the render, so judge framing and colour from stills.
