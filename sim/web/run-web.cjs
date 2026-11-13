// NC BLAST simulator, in-browser edition: runs one event with robot judges inside this page.
// Same plan as sim/run.cjs (runEvent), but the "devices" are frames in the page instead of Chrome windows.

const fs = require("fs");
const { makeEvent, roundComplete } = require("../fake-event.cjs");
const { FakeWorker } = require("../fake-worker.cjs");
const { RobotJudge } = require("../robot-judge.cjs");
const { writeReport } = require("../report.cjs");
const mm = require("../mm.cjs");
const { Page } = require("./webplay.cjs");

let counter = 0;

// One "device": a phone-sized frame with its own pretend storage.
function openDevice(sim, who, opts = {}) {
  const id = who + "-" + (++counter);
  const w = opts.width || 412, h = opts.height || 915, scale = opts.scale || 0.3;
  const wrap = document.createElement("div");
  wrap.className = "dev";
  wrap.style.width = Math.round(w * scale) + "px";
  wrap.innerHTML = `<div class="cap">${who}</div><div class="box" style="width:${Math.round(w * scale)}px;height:${Math.round(h * scale)}px"></div>`;
  const box = wrap.querySelector(".box");
  sim.grid.appendChild(wrap);
  const mkFrame = () => {
    const f = document.createElement("iframe");
    f.style.cssText = `width:${w}px;height:${h}px;border:0;background:#fff;transform:scale(${scale});transform-origin:0 0;position:absolute;left:0;top:0`;
    box.innerHTML = ""; box.appendChild(f);
    return f;
  };
  const dev = { id, who, wrap, errors: [], consoleErrors: [], lastDialog: null };
  sim.devs[id] = dev;
  sim.stores[id] = { local: new Map(), session: new Map() };
  const page = new Page(dev, mkFrame());
  page.freshFrame = () => { page.iframe = mkFrame(); };
  dev.page = page;
  dev.ctx = { close: async () => { wrap.remove(); } };
  return dev;
}

function makeSim(fw, siteHost, log) {
  const sim = { devs: {}, stores: {}, grid: document.getElementById("grid") };
  // Answers every request the apps make. The app's own files load normally; MatchMason bracket calls go to the
  // real Worker; everything else is answered by the pretend Worker.
  sim.route = async (id, r) => {
    const who = sim.devs[id] ? sim.devs[id].who : id;
    const u = new URL(r.url);
    const noBody = s => s === 204 || s === 205 || s === 304;
    const reply = (status, headers, body) => new Response(noBody(status) ? null : body, { status, headers });
    if (u.host === siteHost) {
      const init = { method: r.method, headers: r.headers };
      if (r.body != null && r.method !== "GET" && r.method !== "HEAD") init.body = r.body;
      return fetch(r.url, init);
    }
    if (fw.real && fw.real.isBracketCall(r.url)) {
      const target = fw.real.base + u.pathname + u.search;
      let resp, text = "";
      try {
        const init = { method: r.method, headers: r.headers };
        if (r.body != null && r.method !== "GET" && r.method !== "HEAD") init.body = r.body;
        resp = await fetch(target, init);
        text = await resp.text();
      } catch (e) {
        fw.find("bug", who, "Could not reach the real Worker for a MatchMason call", r.method + " " + u.pathname + ": " + String(e.message).slice(0, 160));
        throw new TypeError("Failed to fetch");
      }
      try { fw.onRealBracketCall(who, r.method, r.url, r.body, resp.status, text); } catch (_) {}
      return reply(resp.status, { "content-type": resp.headers.get("content-type") || "application/json" }, text);
    }
    const fate = fw.wifiFate ? fw.wifiFate(r.method, r.url) : null;
    if (fate && fate.delay) await new Promise(res => setTimeout(res, fate.delay));
    if (fate && fate.fail === "before") throw new TypeError("Failed to fetch");
    let ans;
    try { ans = fw.handle({ method: r.method, url: r.url, body: r.body, who }); }
    catch (e) { fw.find("bug", who, "Simulator error while answering " + r.url, String(e && e.stack || e).slice(0, 300)); ans = { status: 500, json: { error: "simulator error" } }; }
    if (fate && fate.fail === "after") throw new TypeError("Failed to fetch");
    if (ans.delay) await new Promise(res => setTimeout(res, ans.delay));
    if (ans.json !== undefined) return reply(ans.status, { "content-type": "application/json" }, JSON.stringify(ans.json));
    return reply(ans.status, { "content-type": ans.contentType || "text/plain" }, ans.text || "");
  };
  sim.navigate = (id, url) => { const d = sim.devs[id]; if (d) d.page._load(url).catch(e => log("A frame could not reload: " + e.message)); };
  window.__sim = sim;
  return sim;
}

async function runEvent(o, log) {
  const started = Date.now();
  const ev = o.mmEvent || makeEvent({ players: o.players, judges: o.judges });
  const fw = new FakeWorker(ev, { rounds: o.rounds, wifi: o.mmEvent ? "good" : "good", seed: o.seed, newRoutes: false, rename: !o.mmEvent, flags: o.mmEvent ? { "1038": true } : undefined });
  const baseUrl = location.origin, siteHost = location.host;
  const sim = makeSim(fw, siteHost, log); window.__fw = fw;
  let mmTimer = null;
  if (o.mmEvent) {
    fw.real = { base: o.workerBase, isBracketCall: url => mm.isBracketCall(url, ev.slug) };
    fw.mmQuietSince = Date.now();
    mmTimer = setInterval(async () => {
      try {
        const open = await mm.getJson(`${o.workerBase}/mm/open-matches?slug=${encodeURIComponent(ev.slug)}`);
        if (!open.ok || !open.body) return;
        const before = ev.round;
        const added = mm.syncOpen(ev, open.body.matches || []);
        if (added) { fw.mmQuietSince = Date.now(); log(`MatchMason opened ${added} new match(es) (round ${ev.round})`); }
        if (ev.round !== before) fw.mmQuietSince = Date.now();
        ev.matches.filter(m => m.state !== "complete" && !m.stillOpenOnMm && Date.now() - fw.startedAt > 15000).forEach(m => { m.state = "complete"; m.scores_csv = m.scores_csv || "(closed on MatchMason)"; });
        const left = ev.matches.filter(m => m.state !== "complete").length;
        if (left) fw.mmQuietSince = Date.now();
        else if (!fw.mmWaitNoted) { fw.mmWaitNoted = true; log(`Round ${ev.round} is done. Waiting up to ${Math.round(o.roundWait / 60)} min for MatchMason's next round (start it on MatchMason if it does not start by itself).`); }
        if (left) fw.mmWaitNoted = false;
      } catch (_) {}
    }, 5000);
  }

  const devices = [];
  let overlayDev = null;
  if (o.overlay) {
    overlayDev = openDevice(sim, "OBS", { width: 1536, height: 194, scale: 0.3 });
    devices.push(overlayDev);
    await overlayDev.page.goto(baseUrl + "/overlay?slot=1");
  }
  const robots = [];
  for (let i = 0; i < ev.judges.length; i++) {
    const j = ev.judges[i];
    const dev = openDevice(sim, j.station);
    devices.push(dev);
    robots.push(new RobotJudge(dev, fw, j, {
      seed: o.seed * 1000 + i + 1, verbose: false, undoRate: o.undoRate, refreshRate: o.refreshRate,
      streamSlot: overlayDev && i === 0 ? 1 : 0, overlayPage: overlayDev && i === 0 ? overlayDev.page : null,
      overlayEvery: o.overlayEvery, baseUrl,
      handoffRate: 0, clashRate: o.mmEvent ? 0 : undefined, reopenRate: o.mmEvent ? 0 : undefined, reuseRate: undefined,
      maxWaitMs: o.mmEvent ? (o.roundWait + 60) * 1000 : undefined,
      openReliefDevice: async who => { const d = openDevice(sim, who); devices.push(d); return d; },
    }));
  }
  const isEventOver = o.mmEvent
    ? () => !ev.matches.some(m => m.state !== "complete") && Date.now() - fw.mmQuietSince > o.roundWait * 1000
    : () => ev.round >= o.rounds && roundComplete(ev);

  const failures = [];
  const progress = setInterval(() => {
    const done = ev.matches.filter(m => m.state === "complete").length;
    log(`round ${ev.round}${o.mmEvent ? "" : "/" + o.rounds} · ${done}/${ev.matches.length} matches done · ${fw.findings.length} findings · ${Math.round((Date.now() - started) / 1000)}s`);
  }, 15000);
  if (o.onStop) o.onStop(() => { robots.forEach(r => { r.stopped = true; }); });

  await Promise.all(robots.map(async r => {
    try { await r.run(baseUrl, isEventOver); }
    catch (e) {
      let screen = "";
      try { screen = (await r.screen()).replace(/\n+/g, " / ").slice(0, 600); } catch (_) {}
      fw.stuck = true;
      failures.push({ who: r.who, error: String(e && e.message || e).slice(0, 600), shot: "data:,", screen, lastSteps: r.steps.slice(-25).map(s => s.text) });
      fw.find("bug", r.who, "Robot got stuck", String(e && e.message || e).split("\n")[0].slice(0, 300));
      r.stopped = true;
    }
  }));
  clearInterval(progress);
  if (mmTimer) clearInterval(mmTimer);

  robots.forEach(r => r.allDevs.forEach(dev => {
    [...new Set(dev.errors)].forEach(e => fw.find("bug", r.who, "Page crashed with an error", e));
    [...new Set(dev.consoleErrors)].forEach(e => fw.find("warn", r.who, "Error message in the browser console", e));
  }));
  if (overlayDev) {
    [...new Set(overlayDev.errors)].forEach(e => fw.find("bug", "OBS", "Overlay page crashed with an error", e));
    [...new Set(overlayDev.consoleErrors)].forEach(e => fw.find("warn", "OBS", "Error message in the overlay's console", e));
  }
  Object.entries(fw.unknown).forEach(([k, n]) => fw.find("info", "-", "App called a route the simulator does not know", k + " (" + n + "x)"));
  fw.find("info", "-", "Run in the browser, not separate windows", "All robots shared one browser tab, so they took turns. Handoff to a second phone, memory-growth and bad-wifi checks, screenshots, and the 'match abandoned' signal check are not part of this edition.");

  await Promise.all(devices.map(d => d.ctx.close().catch(() => {})));
  const result = {
    options: { ...o, mmEvent: undefined, onStop: undefined, runs: 1, players: ev.players.length, judges: ev.judges.length, rounds: o.mmEvent ? ev.round : o.rounds, wifi: "good" },
    wifiStats: null, site: baseUrl + " (in the browser)", startedAt: new Date(started).toISOString(), seconds: Math.round((Date.now() - started) / 1000),
    event: { name: ev.name, slug: ev.slug, players: ev.players.length, rounds: ev.round, matches: ev.matches.length, complete: ev.matches.filter(m => m.state === "complete").length },
    findings: fw.findings, failures,
    robots: robots.map(r => ({ who: r.who, judge: r.judge.bracketName, matches: r.matchesDone, refreshes: r.refreshes || 0, overlayDelays: r.overlayDelays || [],
      prevCombos: r.prevStats || { checked: 0, ok: 0 }, reusedPrev: r.reusedPrev || 0, handoffs: r.handoffs || 0, retries: r.retries || 0,
      saveMs: r.saveTimes.length ? Math.round(r.saveTimes.reduce((a, b) => a + b, 0) / r.saveTimes.length) : null, heapMB: [] })),
    clashes: fw.clashes || 0, overlayShot: null, requests: fw.log.length,
  };
  result.reportFile = writeReport("report", result);
  return { result, files: fs.files };
}

module.exports = { runEvent };
