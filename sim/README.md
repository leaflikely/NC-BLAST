# BLAST simulator (robot judges)

Runs a whole fake tournament through the real NC BLAST app, in real browser windows, far
faster than people can. Eight robot judges log in, take matches from their stations, enter
decks, score battles, make the odd mistake, refresh their phones, and submit results, all at
the same time. Everything they see is checked against the rules, and a report lists anything
that looked wrong.

Nothing leaves your computer. Every request the app makes to Challonge, the two Workers, or
Google Sheets is answered by a pretend Worker (`fake-worker.cjs`) from memory. No real bracket,
spreadsheet, or database is touched.

## Run it

One-time setup (needs Node.js 18 or newer):

```
npm install --no-save playwright
npx playwright install chromium
```

Then, from the NC-BLAST folder:

```
node sim/run.cjs                  one Swiss round: 32 players, 8 judges, 16 matches (about 40 seconds)
node sim/run.cjs --rounds 5       a full 5-round Swiss day (about 3 minutes)
node sim/run.cjs --seed 7         different robot choices (same seed = same choices, so a run can be repeated)
node sim/run.cjs --show           watch the browser windows while it runs
node sim/run.cjs --site live      test the live site (ncblast.pages.dev) instead of this folder's files
```

Other options: `--judges 4`, `--undo-rate 0.1` (how often a robot presses Undo, default 0.05),
`--refresh-rate 0.05` (how often a robot refreshes mid-match, default 0.02), `--no-overlay`,
`--verbose` (print every tap), `--chrome <path>` (use a specific Chrome).

The report is written to `sim/reports/<date-time>/report.html` (open it in a browser).
`report.json` has the same data for tools. The `reports` folder is not saved to git.

## What the robots do

- Log in as `simjudge1` to `simjudge8` (names "Sim Judge 1" to "Sim Judge 8"), one per station A to H.
- Take the top match from their Station tab, enter both decks (sometimes with Quick Combos,
  sometimes part by part), roll for priority, pick sides, set deck order.
- Score battles with a realistic mix of finishes, including Own finishes and launch errors.
- Press Undo about 1 battle in 20, and refresh the page about 1 battle in 50 (then log back in).
- Confirm, let both players tap, submit, press New Match, repeat until the event is over.
- Station A streams to channel 1, and an OBS-sized overlay window watches that channel.

## What gets checked

- After every battle: the score follows the rules (points capped at 4, sets end at 4, Own finishes
  and launch errors score for the other player, second launch error gives 1 point).
- Undo puts the score back exactly as it was.
- A refresh mid-match brings the match back exactly as it was.
- At submit: the bracket gets the result once, for the right match, with set scores and winner
  that match the battles played. The database rows match the battles (names, finish types, points,
  set scores, judge name). Sheets and database sends report success.
- The stream overlay shows the right names and score within 8 seconds.
- Any page crash or error message in any window.
- Any request the pretend Worker does not know (so the fake stays in step with the real Workers).

Findings are marked **Bug** (proven wrong), **Check** (worth a look, may be fine) or **Note**.

## Files

- `run.cjs`: starts everything and writes the report
- `fake-event.cjs`: the made-up 32-player Swiss event (with Challonge-style group ids)
- `fake-worker.cjs`: the pretend Worker; answers the app and records what it received
- `robot-judge.cjs`: one robot judge (all its taps and checks)
- `harness.cjs`: serves the app files locally and opens the browser windows
- `ui.cjs`: helpers for finding and tapping buttons the way a person sees them
- `report.cjs`: writes report.html / report.json

## Limits

- The pretend Worker copies the real Workers' answers as of November 2026. When a Worker route
  changes, update `fake-worker.cjs` too, or the report will show a "route the simulator does not
  know" note. Real Challonge/Worker problems (slowness, caching, outages) are not tested here.
- The robots follow the screens as they are today. When a screen's buttons are renamed (for
  example the score pad redesign), the robot code that taps them needs the same change.
- Only the judge app and the overlay are driven. The organizer view is not yet.
- In the sandbox Google Fonts are blocked, so text uses a stand-in font; layout checks are not made.
