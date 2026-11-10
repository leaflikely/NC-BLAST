#!/usr/bin/env node
// NC BLAST simulator: run a whole fake event with robot judges.
//
//   node sim/run.cjs                      32 players, 8 judges, 1 Swiss round
//   node sim/run.cjs --rounds 3           play 3 Swiss rounds
//   node sim/run.cjs --seed 42            different (but repeatable) robot choices
//   node sim/run.cjs --judges 4           fewer judges
//   node sim/run.cjs --show               watch the browsers (slower)
//   node sim/run.cjs --site live          test the live site (ncblast.pages.dev) instead of
//                                         this folder's files; outside calls are still faked
//
// Nothing is sent anywhere: every request the app makes to Challonge, the Workers or Google
// Sheets is answered by sim/fake-worker.cjs. A report is written to sim/reports/<time>/.

const fs = require("fs");
const path = require("path");
const { startServer, loadPlaywright, openDevice } = require("./harness.cjs");
const { makeEvent, roundComplete } = require("./fake-event.cjs");
const { FakeWorker } = require("./fake-worker.cjs");
const { RobotJudge } = require("./robot-judge.cjs");
const { writeReport } = require("./report.cjs");

function args() {
  const a = process.argv.slice(2);
  const o = { rounds: 1, seed: 1, judges: 8, players: 32, show: false, site: "local", verbose: false, overlay: true, undoRate: 0.05, refreshRate: 0.02 };
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--/, "");
    const v = a[i + 1];
    if (k === "show") o.show = true;
    else if (k === "verbose") o.verbose = true;
    else if (k === "no-overlay") o.overlay = false;
    else if (["rounds", "seed", "judges", "players"].includes(k)) { o[k] = parseInt(v, 10); i++; }
    else if (k === "undo-rate") { o.undoRate = parseFloat(v); i++; }
    else if (k === "refresh-rate") { o.refreshRate = parseFloat(v); i++; }
    else if (k === "site") { o.site = v; i++; }
    else if (k === "chrome") { o.chrome = v; i++; }
    else if (k === "help" || k === "h") { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 14).join("\n")); process.exit(0); }
  }
  return o;
}

async function main() {
  const o = args();
  const started = Date.now();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(__dirname, "reports", stamp);
  fs.mkdirSync(path.join(outDir, "shots"), { recursive: true });

  const { chromium } = loadPlaywright();
  const ev = makeEvent({ players: o.players, judges: o.judges });
  const fw = new FakeWorker(ev, { rounds: o.rounds });
  const { server, url: localUrl } = await startServer();
  const baseUrl = o.site === "live" ? "https://ncblast.pages.dev" : localUrl;

  const launch = { headless: !o.show };
  const chrome = o.chrome || ["/usr/bin/google-chrome"].find(p => fs.existsSync(p));
  if (chrome) launch.executablePath = chrome;
  const browser = await chromium.launch(launch);

  console.log(`NC BLAST simulator: ${ev.players.length} players, ${ev.judges.length} judges, ${o.rounds} round(s), seed ${o.seed}, site ${o.site === "live" ? baseUrl : "this folder"}`);

  // Station A streams to channel 1, watched by an OBS-sized overlay window (Wide shape size).
  let overlayDev = null;
  if (o.overlay) {
    overlayDev = await openDevice(browser, fw, "OBS", { viewport: { width: 1536, height: 194 } });
    await overlayDev.page.goto(baseUrl + "/overlay?slot=1", { waitUntil: "domcontentloaded" });
  }
  const robots = [];
  for (let i = 0; i < ev.judges.length; i++) {
    const j = ev.judges[i];
    const dev = await openDevice(browser, fw, j.station);
    robots.push(new RobotJudge(dev, fw, j, {
      seed: o.seed * 1000 + i + 1, verbose: o.verbose, undoRate: o.undoRate, refreshRate: o.refreshRate,
      streamSlot: overlayDev && i === 0 ? 1 : 0, overlayPage: overlayDev && i === 0 ? overlayDev.page : null,
    }));
  }

  const isEventOver = () => ev.round >= o.rounds && roundComplete(ev);
  const failures = [];
  const progress = setInterval(() => {
    const done = ev.matches.filter(m => m.state === "complete").length;
    console.log(`  round ${ev.round}/${o.rounds} · ${done}/${ev.matches.length} matches done · ${fw.findings.length} findings · ${Math.round((Date.now() - started) / 1000)}s`);
  }, 15000);

  await Promise.all(robots.map(async r => {
    try {
      await r.run(baseUrl, isEventOver);
    } catch (e) {
      const shot = path.join("shots", `stuck-${r.who}.png`);
      try { await r.page.screenshot({ path: path.join(outDir, shot) }); } catch (_) {}
      let screen = "";
      try { screen = (await r.screen()).replace(/\n+/g, " / ").slice(0, 600); } catch (_) {}
      failures.push({ who: r.who, error: String(e && e.message || e).slice(0, 600), shot, screen, lastSteps: r.steps.slice(-25).map(s => s.text) });
      fw.find("bug", r.who, "Robot got stuck", String(e && e.message || e).split("\n")[0].slice(0, 300));
    }
  }));
  clearInterval(progress);

  // Crashes and error messages seen on any device
  robots.forEach(r => {
    [...new Set(r.dev.errors)].forEach(e => fw.find("bug", r.who, "Page crashed with an error", e));
    [...new Set(r.dev.consoleErrors)].forEach(e => {
      // The page-close "match abandoned" signal is sent with sendBeacon, which always carries browser
      // credentials; the Worker answers with a wildcard origin, so the browser refuses to send it.
      if (/overlay\/push/.test(e) && /credentials mode is 'include'/.test(e)) fw.find("warn", r.who, "\"Match abandoned\" signal on page close/refresh is blocked by the browser (sendBeacon + wildcard CORS)", e.slice(0, 160));
      else fw.find("warn", r.who, "Error message in the browser console", e);
    });
  });
  if (overlayDev) {
    try { await overlayDev.page.screenshot({ path: path.join(outDir, "shots", "overlay-channel-1.png") }); } catch (_) {}
    [...new Set(overlayDev.errors)].forEach(e => fw.find("bug", "OBS", "Overlay page crashed with an error", e));
    [...new Set(overlayDev.consoleErrors)].forEach(e => fw.find("warn", "OBS", "Error message in the overlay's console", e));
  }
  Object.entries(fw.unknown).forEach(([k, n]) => fw.find("info", "-", "App called a route the simulator does not know", k + " (" + n + "x)"));

  const result = {
    options: o, startedAt: new Date(started).toISOString(), seconds: Math.round((Date.now() - started) / 1000),
    event: { name: ev.name, slug: ev.slug, players: ev.players.length, rounds: ev.round, matches: ev.matches.length, complete: ev.matches.filter(m => m.state === "complete").length },
    findings: fw.findings, failures,
    robots: robots.map(r => ({ who: r.who, judge: r.judge.bracketName, matches: r.matchesDone, refreshes: r.refreshes || 0, overlayDelays: r.overlayDelays || [] })),
    overlayShot: overlayDev ? "shots/overlay-channel-1.png" : null,
    requests: fw.log.length,
  };
  const file = writeReport(outDir, result);
  await browser.close();
  server.close();

  const kinds = l => new Set(fw.findings.filter(f => f.level === l).map(f => f.what)).size;
  const bugs = kinds("bug");
  const warns = kinds("warn");
  console.log(`\nDone in ${result.seconds}s: ${result.event.complete}/${result.event.matches} matches played, ${bugs} kind(s) of bug, ${warns} kind(s) of check.`);
  [...new Set(fw.findings.filter(f => f.level !== "info").map(f => f.level + "|" + f.what))].forEach(k => {
    const [lvl, what] = k.split("|");
    console.log(`  ${lvl === "bug" ? "BUG  " : "CHECK"} ${what} (${fw.findings.filter(f => f.what === what).length}x)`);
  });
  console.log("Report: " + file);
  process.exit(bugs ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
