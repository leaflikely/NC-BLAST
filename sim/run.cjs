#!/usr/bin/env node
// NC BLAST simulator: run fake events with robot judges.
//
//   node run.cjs                      one event: 32 players, 8 judges, 1 Swiss round
//   node run.cjs --rounds 5           play 5 Swiss rounds
//   node run.cjs --runs 20            20 events in a row, each with different robot choices
//   node run.cjs --runs forever       keep going until you press Ctrl+C
//   node run.cjs --runs 20 --mix      also vary the event each time (players, judges, rounds)
//   node run.cjs --parallel 2         run 2 events at the same time (needs a strong computer)
//   node run.cjs --seed 42            start from a different (but repeatable) set of choices
//   node run.cjs --show               watch the browsers (slower)
//   node run.cjs --site live          test the live site (ncblast.pages.dev)
//   node run.cjs --site local         test the app files in the folder above this one
//
// Which site: as sim/run.cjs inside a copy of the NC-BLAST repo it tests those files; anywhere
// else it tests the live site. Either way nothing is sent anywhere: every request the app makes to
// Challonge, the Workers or Google Sheets is answered by fake-worker.cjs. Reports are written to
// reports/<time>/ next to this file.

const fs = require("fs");
const path = require("path");
const { startServer, loadPlaywright, openDevice } = require("./harness.cjs");
const { makeEvent, roundComplete } = require("./fake-event.cjs");
const { FakeWorker } = require("./fake-worker.cjs");
const { RobotJudge, makeRandom } = require("./robot-judge.cjs");
const { writeReport, writeSweep } = require("./report.cjs");

function args() {
  const a = process.argv.slice(2);
  const o = {
    rounds: 1, seed: 1, judges: 8, players: 32, show: false, site: "auto", verbose: false, overlay: true,
    undoRate: 0.05, refreshRate: 0.02, runs: 1, parallel: 1, mix: false, overlayEvery: 0, wifi: "good",
  };
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--/, "");
    const v = a[i + 1];
    if (k === "show") o.show = true;
    else if (k === "verbose") o.verbose = true;
    else if (k === "no-overlay") o.overlay = false;
    else if (k === "mix") o.mix = true;
    else if (k === "new-routes") o.newRoutes = true;
    else if (["rounds", "seed", "judges", "players", "parallel"].includes(k)) { o[k] = parseInt(v, 10); i++; }
    else if (k === "runs") { o.runs = /^(forever|inf|infinite|0)$/i.test(v) ? Infinity : parseInt(v, 10); i++; }
    else if (k === "overlay-every") { o.overlayEvery = parseInt(v, 10); i++; }
    else if (k === "undo-rate") { o.undoRate = parseFloat(v); i++; }
    else if (k === "refresh-rate") { o.refreshRate = parseFloat(v); i++; }
    else if (k === "site") { o.site = v; i++; }
    else if (k === "wifi") { o.wifi = v === "bad" ? "bad" : v === "mixed" ? "mixed" : "good"; o.wifiExplicit = true; i++; }
    else if (["handoff-rate", "clash-rate", "reopen-rate", "reuse-rate"].includes(k)) { o[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = parseFloat(v); i++; }
    else if (k === "chrome") { o.chrome = v; i++; }
    else if (k === "help" || k === "h") { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 19).join("\n")); process.exit(0); }
    else { console.error("Unknown option: " + a[i] + "  (node run.cjs --help lists them)"); process.exit(2); }
  }
  if (!(o.runs >= 1)) o.runs = 1;
  if (!(o.parallel >= 1)) o.parallel = 1;
  // The overlay check is the slowest one. Every battle on a single run; about 1 in 3 in a sweep.
  if (!o.overlayEvery) o.overlayEvery = o.runs > 1 ? 3 : 1;
  return o;
}

// The setup for one event. With --mix each run gets its own (repeatable) mix of sizes.
function eventSetup(o, runSeed) {
  const r = makeRandom(runSeed * 7919 + 13);
  // --wifi mixed (the default in a --mix sweep): about 1 event in 3 has bad wifi.
  const wifi = o.wifi === "mixed" || (o.mix && o.wifi === "good" && o.wifiExplicit !== true) ? (r() < 0.34 ? "bad" : "good") : o.wifi;
  if (!o.mix) return { players: o.players, judges: o.judges, rounds: o.rounds, wifi };
  const players = r.pick([8, 12, 16, 24, 32]);
  const judges = Math.max(1, Math.min(8, Math.floor(players / 2), 1 + Math.floor(r() * 8)));
  const rounds = 1 + Math.floor(r() * (players <= 8 ? 3 : players <= 16 ? 4 : 5));
  return { players, judges, rounds, wifi };
}

// Plays one whole event and writes its report. Returns the result (findings, matches, timing).
async function runEvent(browser, o, site, runSeed, outDir, quiet) {
  const started = Date.now();
  fs.mkdirSync(path.join(outDir, "shots"), { recursive: true });
  const setup = eventSetup(o, runSeed);
  const ev = makeEvent({ players: setup.players, judges: setup.judges });
  const fw = new FakeWorker(ev, { rounds: setup.rounds, wifi: setup.wifi, seed: runSeed, newRoutes: !!o.newRoutes });
  const { baseUrl, siteHost } = site;

  const devices = [];
  // Station A streams to channel 1, watched by an OBS-sized overlay window (Wide shape size).
  let overlayDev = null;
  if (o.overlay) {
    overlayDev = await openDevice(browser, fw, "OBS", { viewport: { width: 1536, height: 194 }, siteHost });
    devices.push(overlayDev);
    await overlayDev.page.goto(baseUrl + "/overlay?slot=1", { waitUntil: "domcontentloaded" });
  }
  const robots = [];
  for (let i = 0; i < ev.judges.length; i++) {
    const j = ev.judges[i];
    const dev = await openDevice(browser, fw, j.station, { siteHost });
    devices.push(dev);
    robots.push(new RobotJudge(dev, fw, j, {
      seed: runSeed * 1000 + i + 1, verbose: o.verbose, undoRate: o.undoRate, refreshRate: o.refreshRate,
      streamSlot: overlayDev && i === 0 ? 1 : 0, overlayPage: overlayDev && i === 0 ? overlayDev.page : null,
      overlayEvery: o.overlayEvery, baseUrl,
      handoffRate: o.handoffRate, clashRate: o.clashRate, reopenRate: o.reopenRate, reuseRate: o.reuseRate,
      openReliefDevice: async who => { const d = await openDevice(browser, fw, who, { siteHost }); devices.push(d); return d; },
    }));
  }

  const isEventOver = () => ev.round >= setup.rounds && roundComplete(ev);
  const failures = [];
  const progress = quiet ? null : setInterval(() => {
    const done = ev.matches.filter(m => m.state === "complete").length;
    console.log(`  round ${ev.round}/${setup.rounds} · ${done}/${ev.matches.length} matches done · ${fw.findings.length} findings · ${Math.round((Date.now() - started) / 1000)}s`);
  }, 15000);

  await Promise.all(robots.map(async r => {
    try {
      await r.run(baseUrl, isEventOver);
    } catch (e) {
      const shot = path.join("shots", `stuck-${r.who}.png`);
      try { await r.page.screenshot({ path: path.join(outDir, shot) }); } catch (_) {}
      let screen = "";
      try { screen = (await r.screen()).replace(/\n+/g, " / ").slice(0, 600); } catch (_) {}
      fw.stuck = true;
      failures.push({ who: r.who, error: String(e && e.message || e).slice(0, 600), shot, screen, lastSteps: r.steps.slice(-25).map(s => s.text) });
      fw.find("bug", r.who, "Robot got stuck", String(e && e.message || e).split("\n")[0].slice(0, 300));
      r.stopped = true;
    }
  }));
  if (progress) clearInterval(progress);

  // Crashes and error messages seen on any device
  robots.forEach(r => r.allDevs.forEach(dev => {
    [...new Set(dev.errors)].forEach(e => fw.find("bug", r.who, "Page crashed with an error", e));
    [...new Set(dev.consoleErrors)].forEach(e => {
      // The page-close "match abandoned" signal is sent with sendBeacon, which always carries browser
      // credentials; the Worker answers with a wildcard origin, so the browser refuses to send it.
      if (/overlay\/push/.test(e) && /credentials mode is 'include'/.test(e)) fw.find("warn", r.who, "\"Match abandoned\" signal on page close/refresh is blocked by the browser (sendBeacon + wildcard CORS)", e.slice(0, 160));
      else if (fw.wifiBad && /Failed to fetch|NetworkError|net::ERR|AbortError|TypeError: Failed/i.test(e)) fw.find("info", r.who, "Network error message in the console (bad wifi, expected)", e.slice(0, 160));
      else fw.find("warn", r.who, "Error message in the browser console", e);
    });
  }));
  // Long shifts: does the app answer more slowly, or use more and more memory, as the day goes on?
  robots.forEach(r => {
    const t = r.saveTimes;
    if (t.length >= 30) {
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const first = avg(t.slice(0, 10)), last = avg(t.slice(-10));
      if (last > Math.max(first * 1.5, first + 250)) fw.find("warn", r.who, "App answers taps more slowly late in a long shift", `saving a battle took ${Math.round(first)} ms on average at the start and ${Math.round(last)} ms by the end (${t.length} battles, no reload)`);
    }
    const h = r.heap;
    if (h.length >= 5 && h[h.length - 1] > Math.max(h[0] * 2.5, h[0] + 60)) fw.find("warn", r.who, "App memory keeps growing during a long shift", `${h[0]} MB after the first match, ${h[h.length - 1]} MB after match ${h.length}`);
  });
  if (overlayDev) {
    try { await overlayDev.page.screenshot({ path: path.join(outDir, "shots", "overlay-channel-1.png") }); } catch (_) {}
    [...new Set(overlayDev.errors)].forEach(e => fw.find("bug", "OBS", "Overlay page crashed with an error", e));
    [...new Set(overlayDev.consoleErrors)].forEach(e => fw.find("warn", "OBS", "Error message in the overlay's console", e));
  }
  Object.entries(fw.unknown).forEach(([k, n]) => fw.find("info", "-", "App called a route the simulator does not know", k + " (" + n + "x)"));

  // Close this event's browser windows so a long sweep does not pile them up.
  await Promise.all(devices.map(d => d.ctx.close().catch(() => {})));

  const result = {
    options: { ...o, runs: o.runs === Infinity ? "forever" : o.runs, seed: runSeed, players: setup.players, judges: setup.judges, rounds: setup.rounds, wifi: setup.wifi },
    wifiStats: fw.wifiBad ? fw.wifiStats : null,
    site: site.label, startedAt: new Date(started).toISOString(), seconds: Math.round((Date.now() - started) / 1000),
    event: { name: ev.name, slug: ev.slug, players: ev.players.length, rounds: ev.round, matches: ev.matches.length, complete: ev.matches.filter(m => m.state === "complete").length },
    findings: fw.findings, failures,
    robots: robots.map(r => ({ who: r.who, judge: r.judge.bracketName, matches: r.matchesDone, refreshes: r.refreshes || 0, overlayDelays: r.overlayDelays || [],
      prevCombos: r.prevStats || { checked: 0, ok: 0 }, reusedPrev: r.reusedPrev || 0, handoffs: r.handoffs || 0, retries: r.retries || 0,
      saveMs: r.saveTimes.length ? Math.round(r.saveTimes.reduce((a, b) => a + b, 0) / r.saveTimes.length) : null, heapMB: r.heap })),
    clashes: fw.clashes || 0,
    overlayShot: overlayDev ? "shots/overlay-channel-1.png" : null,
    requests: fw.log.length,
  };
  result.reportFile = writeReport(outDir, result);
  return result;
}

const kindsOf = (findings, level) => [...new Set(findings.filter(f => f.level === level).map(f => f.what))];

async function main() {
  const o = args();
  const started = Date.now();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outRoot = path.join(__dirname, "reports", stamp);

  const { chromium } = loadPlaywright();
  const { server, url: localUrl } = await startServer();
  // Only a real copy of the repo counts: this file inside a folder named "sim", next to the app files.
  // (A loose folder of robot files tests the live site, even if old BLAST downloads sit nearby.)
  const hasAppFiles = path.basename(__dirname) === "sim" && fs.existsSync(path.join(__dirname, "..", "index.html")) && fs.existsSync(path.join(__dirname, "..", "judge-match.js"));
  if (o.site === "auto") o.site = hasAppFiles ? "local" : "live";
  if (o.site === "local" && !hasAppFiles) { console.error("No app files in the folder above this one. Use --site live to test ncblast.pages.dev."); process.exit(2); }
  const baseUrl = o.site === "local" ? localUrl : o.site === "live" ? "https://ncblast.pages.dev" : o.site.replace(/\/+$/, "");
  const site = { baseUrl, siteHost: o.site === "local" ? null : new URL(baseUrl).host, label: o.site === "local" ? "app files next to the sim folder" : baseUrl };

  // Browser: the Chrome already on this computer if there is one, otherwise Playwright's own.
  const launch = { headless: !o.show };
  if (process.env.SIM_CHROME_ARG) launch.args = [process.env.SIM_CHROME_ARG];   // one extra Chrome setting, for testing
  const chromePath = o.chrome || ["/usr/bin/google-chrome"].find(p => fs.existsSync(p));
  let browser;
  if (chromePath) browser = await chromium.launch({ ...launch, executablePath: chromePath });
  else {
    try { browser = await chromium.launch({ ...launch, channel: "chrome" }); }
    catch (_) {
      try { browser = await chromium.launch(launch); }
      catch (e) { console.error("No browser found. Install Google Chrome, or run:  npx playwright install chromium"); process.exit(2); }
    }
  }

  // ── a single event (the original behaviour) ─────────────────────────────
  if (o.runs === 1) {
    const s = eventSetup(o, o.seed);
    console.log(`NC BLAST simulator: ${s.players} players, ${s.judges} judges, ${s.rounds} round(s), seed ${o.seed}, site ${site.label}`);
    const r = await runEvent(browser, o, site, o.seed, outRoot, false);
    await browser.close(); server.close();
    const bugs = kindsOf(r.findings, "bug"), warns = kindsOf(r.findings, "warn");
    console.log(`\nDone in ${r.seconds}s: ${r.event.complete}/${r.event.matches} matches played, ${bugs.length} kind(s) of bug, ${warns.length} kind(s) of check.`);
    [...bugs.map(w => ["BUG  ", w]), ...warns.map(w => ["CHECK", w])].forEach(([lvl, w]) =>
      console.log(`  ${lvl} ${w} (${r.findings.filter(f => f.what === w).length}x)`));
    console.log("Report: " + r.reportFile);
    process.exit(bugs.length ? 1 : 0);
  }

  // ── a sweep: many events, one combined report ───────────────────────────
  const total = o.runs === Infinity ? "∞" : o.runs;
  console.log(`NC BLAST simulator sweep: ${total} event(s)${o.mix ? " of mixed sizes" : `, each ${o.players} players / ${o.judges} judges / ${o.rounds} round(s)`}, ${o.parallel} at a time, seeds from ${o.seed}, site ${site.label}`);
  console.log(`Combined report (updated after every event): ${path.join(outRoot, "sweep.html")}`);
  console.log(o.runs === Infinity ? "Press Ctrl+C to stop. Events already finished are kept in the report.\n" : "");

  const sweep = { site: site.label, options: { ...o, runs: total }, startedAt: new Date(started).toISOString(), runs: [], seconds: 0 };
  const seen = new Set();
  let next = 0, stopping = false;
  process.on("SIGINT", () => {
    if (stopping) { console.log("\nStopping now."); process.exit(130); }
    stopping = true;
    console.log("\nFinishing the event(s) in progress, then stopping. Press Ctrl+C again to stop at once.");
  });

  const worker = async () => {
    while (!stopping && next < o.runs) {
      const n = ++next;
      const runSeed = o.seed + n - 1;
      const dir = path.join(outRoot, `run-${String(n).padStart(3, "0")}-seed-${runSeed}`);
      let r;
      try {
        r = await runEvent(browser, o, site, runSeed, dir, true);
      } catch (e) {
        r = { options: { seed: runSeed, ...eventSetup(o, runSeed) }, seconds: 0, event: { complete: 0, matches: 0 }, failures: [{ who: "-", error: String(e && e.message || e) }],
          findings: [{ level: "bug", who: "-", what: "Simulator could not run this event", detail: String(e && e.message || e).slice(0, 300) }], robots: [], reportFile: null };
      }
      const kinds = [...kindsOf(r.findings, "bug"), ...kindsOf(r.findings, "warn")];
      const fresh = kinds.filter(k => !seen.has(k));
      kinds.forEach(k => seen.add(k));
      const battles = r.robots.reduce((a, x) => a + x.matches.reduce((b, m) => b + m.battles, 0), 0);
      sweep.runs.push({
        n, seed: runSeed, players: r.options.players, judges: r.options.judges, rounds: r.options.rounds,
        seconds: r.seconds, complete: r.event.complete, matches: r.event.matches, battles,
        undos: r.robots.reduce((a, x) => a + x.matches.reduce((b, m) => b + m.undos, 0), 0),
        refreshes: r.robots.reduce((a, x) => a + (x.refreshes || 0), 0),
        stuck: r.failures.length, findings: r.findings,
        report: r.reportFile ? path.relative(outRoot, r.reportFile).split(path.sep).join("/") : null,
      });
      sweep.seconds = Math.round((Date.now() - started) / 1000);
      writeSweep(outRoot, sweep);
      const bugKinds = kindsOf(r.findings, "bug").length;
      console.log(`event ${n}${o.runs === Infinity ? "" : "/" + o.runs} · seed ${runSeed} · ${r.options.players}p ${r.options.judges}j ${r.options.rounds}r · ${r.event.complete}/${r.event.matches} matches · ${r.seconds}s · ${bugKinds} bug kind(s)` +
        (fresh.length ? `\n   NEW: ${fresh.join(" | ")}` : ""));
    }
  };
  await Promise.all(Array.from({ length: o.parallel }, worker));
  await browser.close(); server.close();

  const matches = sweep.runs.reduce((a, r) => a + r.complete, 0);
  const battles = sweep.runs.reduce((a, r) => a + r.battles, 0);
  const allFindings = sweep.runs.flatMap(r => r.findings);
  const bugs = kindsOf(allFindings, "bug"), warns = kindsOf(allFindings, "warn");
  console.log(`\nSweep done in ${sweep.seconds}s: ${sweep.runs.length} event(s), ${matches} matches, ${battles} battles, ${bugs.length} kind(s) of bug, ${warns.length} kind(s) of check.`);
  [...bugs.map(w => ["BUG  ", w]), ...warns.map(w => ["CHECK", w])].forEach(([lvl, w]) =>
    console.log(`  ${lvl} ${w} (in ${sweep.runs.filter(r => r.findings.some(f => f.what === w)).length} of ${sweep.runs.length} events)`));
  console.log("Report: " + path.join(outRoot, "sweep.html"));
  process.exit(bugs.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
