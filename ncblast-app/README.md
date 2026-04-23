# NC BLAST — Monorepo

NC BLAST is the **NorCal Battle Log and Stat Tracker** — a Beyblade X tournament
judging tool with a live broadcast overlay. This monorepo refactors the original
two-file prototype (`index.html` + `overlay.html`) into a Vite + React +
TypeScript workspace.

## What it does

- **apps/judge** — The judge-facing scoring app (formerly `index.html`). Pick
  format, import roster from Challonge, build 3-combo decks from a parts
  library, score battles (XTR / OVR / BST / SPF + Own Finish + Launch Error
  strikes), undo/redo, submit to Challonge and Google Sheets.
- **apps/overlay** — A 1920×1080 transparent OBS overlay (formerly
  `overlay.html`). Draggable/resizable in edit mode, long-polls the Cloudflare
  Worker for live state pushed by the judge app.
- **packages/shared** — Types (`OverlayState`, `LogEntry`, …), constants
  (`FINISH`, `PENALTY`, `STORAGE_KEYS`, `WORKER_BASE_URL`), localStorage
  helpers, and the Worker client used by both apps.

## Prerequisites

- Node.js **18+** (required for `AbortSignal.timeout`).
- npm **8+** (workspaces).

## Install

```sh
cd ncblast-app
npm install
```

## Development

Run the judge and overlay together in two terminals:

```sh
# Terminal 1
npm run dev:judge      # http://localhost:5173

# Terminal 2
npm run dev:overlay    # http://localhost:5174
```

Open the overlay with URL params for OBS testing:

```
http://localhost:5174/?slot=1         # normal view
http://localhost:5174/?slot=1&edit=1  # edit mode
```

The judge app pushes to the Cloudflare Worker at `WORKER_BASE_URL`; the overlay
long-polls the same worker. They coordinate via the Worker's KV store — no
direct communication.

## Build

```sh
npm run build          # builds both apps + typechecks shared
```

Outputs:
- `apps/judge/dist/`
- `apps/overlay/dist/`

Either app can be deployed as a static site (Cloudflare Pages, Netlify, etc.).

## Typecheck

```sh
npm run typecheck
```

## Environment variables

The Cloudflare Worker URL can be overridden per build via an env var:

```sh
# .env in apps/judge or apps/overlay
VITE_WORKER_URL=https://your-worker.example.workers.dev
```

If unset, both apps fall back to the production default
`https://challonge-proxy.danny61734.workers.dev`.

## Architecture

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│   apps/judge                │    │   apps/overlay              │
│   (React + Vite + TS)       │    │   (React + Vite + TS)       │
│   Scoring / roster / decks  │    │   1920×1080 OBS overlay     │
│                             │    │                             │
│   - Format / Players /      │    │   - Draggable + 3 resize    │
│     Match / Library screens │    │     handles                 │
│   - useState / useEffect    │    │   - Keyboard R / + / -      │
│   - localStorage (bx-*)     │    │   - localStorage (ncblast-*)│
│                             │    │                             │
│   pushOverlay() ───────┐    │    │   ┌──── pollOverlay()       │
└────────────────────────┼────┘    └───┼─────────────────────────┘
                         │             │
                         │             │
                         ▼             ▼
                ┌──────────────────────────────┐
                │  Cloudflare Worker           │
                │  challonge-proxy...workers.dev│
                │  - /overlay/push /poll /state │
                │  - /list /matches /submit     │
                │  - /combos/push /get          │
                │  - / (Challonge slug proxy)   │
                └──────────────────────────────┘
                         │
                         ▼
         ┌─────────────────────────┐   ┌──────────────────────┐
         │  Challonge API v1       │   │  Google Apps Script  │
         │  brackets / participants│   │  Sheets SHEETS_URL   │
         └─────────────────────────┘   └──────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│   packages/shared                                            │
│   - types.ts      OverlayState, LogEntry, Combo, Parts, …    │
│   - constants.ts  FINISH, PENALTY, STORAGE_KEYS, URLs        │
│   - storage.ts    sGet / sSave (typed JSON localStorage)     │
│   - worker.ts     pushOverlay, pollOverlay, listMatches, …   │
└──────────────────────────────────────────────────────────────┘
```

## Running judge + overlay simultaneously

The judge app has a 📡 button on the battle screen that cycles through
overlay slots 1–4. Once a slot is active, a ▶ Connect button pushes current
state to the Worker. Open `apps/overlay?slot=N` in OBS (or a browser) to see
live updates.

State flows one-way: judge → Worker KV → overlay. Refreshing the overlay is
safe — it re-fetches the latest state on load.

## Preserved compatibility

- All `bx-*` and `ncblast-*` localStorage keys are preserved verbatim so
  existing user data carries over.
- All network endpoints and payload shapes match the original.
- Offline submission queue retries Sheets posts on `online` event.

## License

Internal project — not published.
