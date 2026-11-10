# Guitar Practice

A personal practice app: a list of the songs and exercises being worked on, a tempo log for each section, a metronome, and a tab player.

It is a plain static web app with no build step and no server. All data stays on the device, in the browser's IndexedDB.

## What it does

- **Practice list** — songs and exercises, grouped as Learning, Polishing, Keeping up or Shelved.
- **Sections and tempo log** — each item is split into sections (intro, solo, one hard bar). Each section has an optional target tempo and a history of the tempo it was played cleanly at, with a small chart.
- **Metronome** — time signature, subdivisions, accent, tap tempo. Opens from any section at its last tempo; logging the result is one tap.
- **Tab player** — Guitar Pro (.gp, .gp3, .gp4, .gp5, .gpx) and MusicXML files open as a scrolling tab with synthesized playback, slow-down, bar-range looping, track switching and muting, and an optional click and count-in.
- **Scanned tabs** — PDFs and images open as pages with a metronome bar underneath.
- **Links** — saved against the item, opened in a new tab.
- **Backup** — one JSON file holds the list, the history and the uploaded files. It is also how data moves to another device.
- **Offline** — installable to the home screen; works without a connection once loaded.

## Running it

Serve the folder with any static file server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from the file system will not work, because the app uses JavaScript modules.

## Hosting on GitHub Pages

Repository Settings, then Pages, then "Deploy from a branch", branch `main`, folder `/ (root)`. The app uses relative paths throughout, so it works from a sub-path.

## Layout

```
index.html              app shell
css/app.css             all styling (dark and light follow the device)
js/main.js              router and start-up
js/store.js             IndexedDB data layer and backup
js/metronome.js         metronome engine (Web Audio look-ahead scheduler)
js/log.js               the shared "log a tempo" sheet
js/views/               one file per screen
sw.js                   offline cache
vendor/alphatab/        alphaTab 1.9.0: tab rendering and playback (MPL-2.0), Bravura font (OFL), SONiVOX sound font
vendor/pdfjs/           PDF.js 4.10.38 (Apache-2.0)
```

When changing app files, bump `VERSION` in `sw.js` so installed copies drop their old cache.

## Not built yet

Speed trainer (tempo climbs automatically), audio slow-downer for mp3s, session builder with timers and a practice streak, tuner, and reminders for neglected repertoire.
