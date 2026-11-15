# BLACKLINE: Relay Protocol

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/banglento/blackline-relay-protocol/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/banglento/blackline-relay-protocol/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A self-contained three.js tactical FPS set in a night freight depot. Secure three relay terminals, break enemy sightlines with cover and smoke, and return to the extraction pad. Seven guards patrol the compact arena and react to visibility, sprinting, and gunfire. The K-9 rifle is semi-automatic, with a 12-round magazine and limited reserves.

This is the public entry repository for the “Make the best three.js tactical FPS” bounty on make.fun. The badges above are live: the rank and reward badges track this repository's standing in the competition.

## Run it

Node.js 22.18 or newer and a desktop browser with WebGL 2 are required. Building and serving need no npm dependencies or network access: three.js is vendored with its MIT license.

```sh
node main.ts
node scripts/serve.mjs
```

Open http://127.0.0.1:4173 and choose BEGIN INSERTION. `npm run build` and `npm start` are aliases. Set `PORT` to use a different local port. To match the grader's output location, set `MAKEFUN_OUTPUT_DIR` to an empty writable directory before running `node main.ts`. The entrypoint copies the complete static game and writes a deterministic SHA-256 manifest, then exits 0. It never installs packages or contacts a service.

## Controls and objective

- WASD: move; mouse: look; left click: fire one round; right mouse: ADS.
- Shift: sprint (audible to guards); Ctrl: crouch (slower, harder to see).
- Q/F: lean left/right (camera roll); R: reload; G: deploy smoke (two charges).
- E: secure a nearby amber relay or extract; Esc: pause.
- Secure relays A, B, C in any order. Cyan relays are secured. Return to the cyan ring at the insertion point and press E to extract.
- Cover blocks movement, bullets, and sight. Smoke breaks enemy sightlines for eight simulation seconds. The minimap shows relay status and alerted guards.
- An unlocked mouse or lost browser focus pauses play. The mission can be restarted after victory or defeat.

## Local verification

```sh
npm ci --cache .cache/npm
npm test
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright" npx playwright install chromium
npm run build
npm start
# In a second terminal in this folder:
CHROME_PATH="$PWD/.playwright/chromium-1208/chrome-linux64/chrome" npm run test:browser
```

`CHROME_PATH` can point to any installed compatible Chromium. `npm test` verifies byte-for-byte deterministic output in two fresh directories and checks local runtime imports. The browser suite uses actual WebGL 2, keyboard/mouse input, and an explicit `?qa=1` inspection interface to place actors for objective and combat regression checks. That interface is absent on the normal URL. The test saves four real browser screenshots in `screenshots/` and its result in `.test-output/browser-results.json`. Objective/combat scenarios use the QA interface to avoid making a full manual skill run a prerequisite for reproducible checks.

## Repository

`main.ts` builds `out/`; `web/` contains the game; `web/vendor/` contains pinned three.js 0.183.2; `scripts/serve.mjs` serves loopback only; `tests/` contains Node and browser verification; `screenshots/` contains the captured entry views; `REPORT.md` records verification and submission blockers. Only the development/browser tests need npm packages. No paid assets, accounts, API keys, external fonts, or runtime CDNs are used.

## License and limits

MIT. The vendored three.js distribution is MIT, with its original notice in `web/vendor/THREE-LICENSE.txt`. All game geometry, UI, and gameplay were authored for this entry. The v1 scope is one arena, one rifle, seven guards, a relay objective and extraction; no multiplayer, mobile touch controls, save data, or navigation mesh. Lean is camera roll rather than a full body/cover system. Hardware rendering is preferred; software GPUs use lower resolution and skip shadows. A 60 FPS target is not a measured guarantee.

## Submission handoff

Public repository creation/push, GitHub About metadata, wallet ownership/signing, and the official transcript bundle/run record remain owner-side handoff items. This history is intended for the public-repository route; it is not a drand-anchored source-bundle history. No wallet file was opened, and no ownership claim file or signature was fabricated. The official close time in the supplied requirements is 2026-11-16T21:30:00.000Z. See REPORT.md before any submission.

---

<sub>Prepared locally for [make.fun](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
