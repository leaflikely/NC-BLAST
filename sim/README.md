# BLAST simulator (robot judges)

Runs a whole fake tournament through the real NC BLAST app, in real browser windows, far
faster than people can. Eight robot judges log in, take matches from their stations, enter
decks, score battles, make the odd mistake, refresh their phones, and submit results, all at
the same time. Everything they see is checked against the rules, and a report lists anything
that looked wrong.

No real data is touched. Every request the app makes to Challonge, the two Workers, or Google
Sheets is answered by a pretend Worker (`fake-worker.cjs`) from memory, so no real bracket,
spreadsheet, or database ever sees the robots. When testing the live site, the only thing loaded
from the internet is the app itself (its pages and code files).

## Run it on its own (tests the live site)

You don't need a copy of NC-BLAST. With only the robot files in a folder, the simulator tests the
live site, ncblast.pages.dev. The app loads from the real site, but its calls to Challonge, the
Workers and Google Sheets are still all faked.

1. Make a folder anywhere, for example `Documents\blast-sim`.
2. Put these 7 files from this `sim` folder into it: `run.cjs`, `robot-judge.cjs`, `fake-worker.cjs`,
   `fake-event.cjs`, `harness.cjs`, `ui.cjs`, `report.cjs`.
3. In File Explorer, open that folder, click the address bar, type `cmd`, and press Enter.
4. One-time setup (needs Node.js 18 or newer from nodejs.org; check with `node -v`):
   ```
   npm install playwright
   ```
   It uses the Google Chrome already on the computer. With no Chrome installed, also run
   `npx playwright install chromium`.
5. Run it:
   ```
   node run.cjs
   ```

After that, a run is just steps 3 and 5.

## Run it inside a copy of NC-BLAST (tests those files)

Inside a copy of the repo, the same commands test the files in that copy instead of the live
site. That's useful for checking a change before it's pushed. From the NC-BLAST folder:

```
npm install --no-save playwright
node sim/run.cjs
```

## Options

```
node run.cjs                  one Swiss round: 32 players, 8 judges, 16 matches
node run.cjs --rounds 5       a full 5-round Swiss day
node run.cjs --seed 7         different robot choices (same seed = same choices, so a run can be repeated)
node run.cjs --show           watch the browser windows while it runs
node run.cjs --site live      always test ncblast.pages.dev, even inside a copy of the repo
```

## Many events in a row (a sweep)

```
node run.cjs --runs 20                    20 events, each with different robot choices
node run.cjs --runs 20 --rounds 5         20 full 5-round days
node run.cjs --runs 50 --mix              50 events of mixed sizes (8 to 32 players, 1 to 8 judges, 1 to 5 rounds)
node run.cjs --runs forever --mix         keep going until you press Ctrl+C
node run.cjs --runs 50 --parallel 2       two events at a time (only helps on a computer with many cores)
```

A sweep writes one combined report, `sweep.html`, updated after every event, so it is always
safe to stop with Ctrl+C. It lists every kind of problem with the number of events it showed up in,
plus a report for each event. A problem that shows up in only a few events depends on what the
robots happened to do; the report gives the exact command to replay that event.

How fast: one robot plays a match in about 5 seconds. With 8 robots the computer's processor is
the limit: on a 2-core machine a 16-match round takes about 35 seconds; a typical 8-core PC
should be much quicker. Try `--parallel 2` or `3` on a strong computer and keep whichever
finishes events fastest. In a sweep the stream overlay is checked on about 1 battle in 3
(`--overlay-every 1` checks every battle).

Other options: `--judges 4`, `--undo-rate 0.1` (how often a robot presses Undo, default 0.05),
`--refresh-rate 0.05` (how often a robot refreshes mid-match, default 0.02), `--no-overlay`,
`--verbose` (print every tap), `--chrome <path>` (use a specific Chrome).

When it finishes, it prints where the report was saved: `reports\<date-time>\report.html` next to
the robot files. Open it in a browser.
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
