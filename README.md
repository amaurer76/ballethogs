# Pas de Notes

A small, responsive ballet ear-training PWA. Play do (C) to start, then identify random do, re, or mi notes within five seconds each. Ten correct notes finish the level, including the starting do. The meadow scrolls continuously while the ballerina dances in place. Correct key presses trigger a jump; wrong presses trigger a brief stumble or near-fall before she resumes dancing. Wrong notes and timeouts accumulate until animated groundhogs pounce over the ballerina on the third miss. No graphic violence. A timeout repeats the target with a fresh five seconds; wrong keys and replaying the target do not extend the current deadline. Scrolling stops at the end of the round. Reduced-motion preferences are respected.

## Run

Requires Node.js 18 or newer. No runtime dependencies; local development and builds work without installing packages.

```sh
npm run dev
```

Open http://127.0.0.1:5173. Play **do** to start; each leap automatically plays the next target. **Hear note again** replays it. White keys: A S D F G H J K. Black keys: W E T Y U. Turn off **Show hints** to practice by ear. **Start over** resets progress, mistakes, and timers.

## Verify and build

```sh
npm test
npm run build
```

Browser tests use Playwright and Microsoft Edge:

```sh
npm install
npm run test:e2e
```

## Host on Netlify

Import this repository into Netlify. The included `netlify.toml` sets build command `npm run build` and publish directory `dist`. Alternatively, run the build locally and drag the `dist` folder into Netlify's manual deploy page.

No server, API keys, database, or environment variables required. Audio is synthesized with Web Audio after a click or key press; no sample downloads. The manifest and service worker support installation in compatible browsers and offline play after the first successful online load. Optional Google Fonts fall back to local fonts offline. Service worker registration is disabled on localhost to keep development fresh. Update the cache version in `sw.js` when changing cached assets.

This prototype has one randomized ten-note level using three pitches. It does not include microphone input or MIDI hardware support.
