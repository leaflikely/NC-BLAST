// NC BLAST simulator: the pretend Worker.
// Answers every request the app makes to the outside world, in the same shapes the real
// Workers send (copied from challonge-proxy.js and ncblast-db.js), but from memory.
// One FakeWorker is shared by every robot judge in a run, so a result one judge submits
// shows up for everyone else, the same way it does at a real event.
//
// It also keeps a record of everything that came in (fw.log) and anything that looked wrong
// (fw.findings), which the report uses.

const { makeRandom } = require("./random.cjs");
const { participantRecord, addSwissRound, roundComplete, renameAfterRound1 } = require("./fake-event.cjs");

// Same point values as the database Worker's FINISH_POINTS
const FINISH_POINTS = {
  "Xtreme Finish": [3], "Over Finish": [2], "Burst Finish": [2], "Spin Finish": [1],
  "Own Finish": [2, 3], "LER Strike": [0], "Launch Error": [1],
};
const FINISH_FIX = {
  spf: "Spin Finish", ovr: "Over Finish", bst: "Burst Finish", xtr: "Xtreme Finish",
  "own finish": "Own Finish", of: "Own Finish", of2: "Own Finish", of3: "Own Finish",
  "ler strike": "LER Strike", "ler-strike": "LER Strike", "launch error": "Launch Error", ler: "Launch Error",
};
const FIELD_ORDER = ["Timestamp", "Judge", "Tournament", "Match", "P1", "P1Side", "P2", "P2Side", "Set", "Shuffle", "Slot",
  "Winner", "WinnerCombo", "FinishType", "Points", "Penalty", "P1Score", "P2Score", "P1Combo", "P2Combo"];

class FakeWorker {
  constructor(ev, opts = {}) {
    this.ev = ev;
    this.opts = opts;
    this.log = [];        // every request: { t, who, method, host, path }
    this.findings = [];   // { level: "bug" | "warn" | "info", who, what, detail }
    this.submits = [];    // bracket results as received: { who, matchId, scores_csv, winner_id, at }
    this.ingests = [];    // database rows as received: { who, slug, rows }
    this.sheets = [];     // Google Sheets payloads: { who, payload }
    this.overlay = {};    // slot -> latest state
    this.overlayLive = {};// slot -> { v, at, state }
    this.liveByMatch = {};// matchId -> latest state
    this.combos = {};     // normalized player name -> combos
    this.scorelog = [];
    this.notify = [];
    this.notes = [];      // match notes (flag 1029)
    this.decks = [];      // deck log (flag 1030)
    this.backups = [];
    this.pings = [];
    this.handoffs = {};
    this.unknown = {};    // "METHOD host/path" -> count (routes the fake does not know)
    this.flags = opts.flags || {};
    this.autoAdvance = opts.autoAdvance !== false;
    this.startedAt = Date.now();
    this.truthDecks = {};   // player id -> { name, combos: ["Blade | 1-60 · Hexa", ...], round } (each player's real last deck)
    this.renamed = null;    // { id, from, to } once a player has been renamed
    this.wifiBad = opts.wifi === "bad";
    this.wifiStats = { slow: 0, lostBefore: 0, lostAfter: 0 };
    if (this.wifiBad) {
      const rnd = makeRandom((opts.seed || 1) * 104729 + 7);
      // Requests a judge needs just to get logged in are only ever slow, never lost (a person would
      // simply reload; the robots test what happens during scoring).
      const LOGIN = /^\/(list|flags|judge-namemap|judge-whitelist\/check|judges\/get|parts)?$/;
      this.wifiFate = (method, url) => {
        const u = new URL(url);
        if (!/^(challonge-proxy|ncblast-db|script)\./.test(u.hostname)) return null;
        const r = rnd();
        if (method === "POST") {
          if (r < 0.07) { this.wifiStats.lostBefore++; return { fail: "before", delay: 300 + rnd() * 1500 }; }
          if (r < 0.12) { this.wifiStats.lostAfter++; return { fail: "after", delay: 300 + rnd() * 1500 }; }
          if (r < 0.37) { this.wifiStats.slow++; return { delay: 400 + rnd() * 2600 }; }
          return null;
        }
        if (method === "GET") {
          if (!LOGIN.test(u.pathname) && r < 0.04) { this.wifiStats.lostBefore++; return { fail: "before", delay: 200 + rnd() * 1000 }; }
          if (r < 0.24) { this.wifiStats.slow++; return { delay: 300 + rnd() * 1700 }; }
        }
        return null;
      };
    }
  }

  find(level, who, what, detail) {
    this.findings.push({ level, who, what, detail: detail === undefined ? "" : detail, at: Date.now() });
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  idToName() {
    const map = {};
    this.ev.players.forEach(p => { map[p.id] = p.name; map[p.gid] = p.name; });
    return map;
  }
  pairing(m) {
    const n = this.idToName();
    return {
      id: m.id, round: m.round, state: m.state, underway_at: m.underway_at || null,
      player1_id: m.player1_id, player2_id: m.player2_id, winner_id: m.winner_id,
      scores_csv: m.scores_csv || "",
      player1_name: n[m.player1_id] || "", player2_name: n[m.player2_id] || "",
    };
  }
  stationQueues() {
    // Open matches of the current round, dealt across stations A-H in order.
    const out = {};
    this.ev.judges.forEach(j => { out[j.station] = []; });
    const open = this.ev.matches.filter(m => m.round === this.ev.round);
    const st = Object.keys(out);
    open.forEach((m, i) => { out[st[i % st.length]].push(m.id); });
    return out;
  }
  tournamentMeta() {
    const ev = this.ev;
    return {
      slug: ev.slug, name: ev.name, orgUsername: "simorg", ranked: ev.ranked, loginMode: ev.loginMode,
      judges: [], headJudges: [], fetchedAt: Date.now(), count: ev.players.length,
    };
  }

  // ── the router ───────────────────────────────────────────────────────────
  // req = { method, url, body (string|null), who }
  // returns { status, json } or { status, text, contentType } or { delay, ... }
  handle(req) {
    const u = new URL(req.url);
    const host = u.hostname;
    const path = u.pathname;
    const q = u.searchParams;
    const method = req.method;
    let body = null;
    if (req.body) { try { body = JSON.parse(req.body); } catch (_) { body = req.body; } }
    this.log.push({ t: Date.now(), who: req.who, method, host: host.split(".")[0], path });

    if (method === "OPTIONS") return { status: 204, text: "" };
    if (host.startsWith("fonts.")) return { status: 200, text: "", contentType: "text/css" };
    if (host === "script.google.com") return this.sheetsPost(req.who, body);
    if (host.startsWith("challonge-proxy.")) return this.proxy(req.who, method, path, q, body);
    if (host.startsWith("ncblast-db.")) return this.db(req.who, method, path, q, body);
    return this.unknownRoute(req.who, method, host, path);
  }

  unknownRoute(who, method, host, path) {
    const key = method + " " + host.split(".")[0] + path;
    this.unknown[key] = (this.unknown[key] || 0) + 1;
    return { status: 404, json: { error: "Not found (the simulator does not know this route)" } };
  }

  // ── challonge-proxy Worker ───────────────────────────────────────────────
  proxy(who, method, path, q, body) {
    const ev = this.ev;
    const okSlug = s => s === ev.slug;
    const R = (json, status = 200) => ({ status, json });

    if (path === "/" && method === "GET") {
      if (!okSlug(q.get("slug"))) return R({ error: "Not found" }, 404);
      return R({ participants: ev.players.map(participantRecord), fromCache: true });
    }
    if (path === "/list" && method === "GET") return R({ tournaments: [this.tournamentMeta()] });
    if (path === "/flags" && method === "GET") return R({ ok: true, flags: this.flags });
    if (path === "/parts" && method === "GET") return R({ ok: true, parts: null });
    if (path === "/judge-namemap" && method === "GET") {
      const map = {};
      ev.judges.forEach(j => { map[j.username] = j.bracketName; });
      return R({ ok: true, map });
    }
    if (path === "/judge-whitelist/check" && method === "GET") return R({ ok: true, allowed: true, loginMode: ev.loginMode });
    if (path === "/judge-whitelist/get" && method === "GET") return R({ ok: true, usernames: ev.judges.map(j => j.username) });
    if (path === "/judges/get" && method === "GET") return R({ headJudges: [], orgUsername: "simorg", loginMode: ev.loginMode });
    if (path === "/judges/presence" && method === "GET") return R({ presence: [] });
    if (path === "/auth/confirm" && method === "POST") return R({ ok: true, username: (body && body.username || "").toLowerCase() });
    if (path === "/stadium-assign" && method === "GET") {
      const assign = {};
      ev.judges.forEach(j => { assign[j.username] = j.station; });
      return R({ ok: true, data: { count: ev.judges.length, assign } });
    }
    if (path === "/station-queues" && method === "GET") return R({ ok: true, data: this.stationQueues() });

    if (path === "/matches" && method === "GET") {
      if (!okSlug(q.get("slug"))) return R({ error: "Challonge matches error: HTTP 404" }, 404);
      const matches = ev.matches.filter(m => m.state === "open").map(m => ({ ...m, ...this.pairing(m) }));
      return R({ matches });
    }
    if (path === "/pairings" && method === "GET") {
      if (!okSlug(q.get("slug"))) return R({ error: "Challonge error: HTTP 404" }, 404);
      return R({ pairings: ev.matches.map(m => this.pairing(m)), fromCache: false });
    }
    if (path === "/standings" && method === "GET") return R({ standings: this.standings(), fromCache: false });

    if (path === "/match/underway" && method === "POST") {
      const m = ev.matches.find(x => String(x.id) === String(body && body.matchId));
      if (!m) { this.find("bug", who, "Marked a match underway that does not exist", body && body.matchId); return R({ ok: false, status: 404 }); }
      if (m.underway_at && m.state === "open") this.find("info", who, "Match marked underway twice", m.id);
      m.underway_at = new Date().toISOString();
      return R({ ok: true, status: 200, data: { match: m }, usedToken: false, usedFallback: false });
    }

    if (path === "/submit" && method === "POST") return this.submit(who, body);
    // /submit/verify and /notify/* are in the app (flag 1017) but, per the Worker deploy notes, not
    // in the live Worker yet. Like the real Worker, the fake says "not found" unless --new-routes is used.
    if (!this.opts.newRoutes && /^\/(submit\/verify|notify\/)/.test(path)) return this.unknownRoute(who, method, "challonge-proxy", path);
    if (path === "/submit/verify" && method === "POST") {
      const m = ev.matches.find(x => String(x.id) === String(body && body.matchId));
      if (!m) return R({ confirmed: false, reason: "match not found" });
      const same = m.state === "complete" && m.scores_csv === (body.scores_csv || "");
      return R({ confirmed: same, reason: same ? "" : "bracket shows " + (m.scores_csv || "no score") });
    }

    if (path === "/scorelog/push" && method === "POST") { this.scorelog.push({ who, ...body }); return R({ ok: true }); }
    if (path === "/db/ingest" && method === "POST") return this.ingest(who, body);
    if (path === "/db/timing" && method === "POST") {
      if (!body || !Array.isArray(body.lines) || !body.lines.length) this.find("warn", who, "Timing send had no lines", "");
      return R({ ok: true, inserted: body && body.lines ? body.lines.length : 0, replaced: 0 });
    }
    if (path === "/backup/upload" && method === "POST") {
      this.backups.push({ who, kind: body && body.kind, fileName: body && body.fileName });
      // The app only uploads a backup when something else failed, so this is worth a look.
      this.find(body && body.kind === "bug-report" || this.wifiBad ? "info" : "warn", who, "App uploaded a backup file (" + (body && body.kind) + ")" + (this.wifiBad ? " after a failed send (bad wifi)" : ""), body && body.fileName);
      return R({ ok: true, key: (body && body.kind) + "/" + ev.slug + "/" + (body && body.fileName) });
    }

    if (path === "/overlay/push" && method === "POST") {
      if (!body || !body.state) return R({ error: "Missing state" }, 400);
      const st = { ...body.state, pushedAt: Date.now() };
      if (body.slot >= 1 && body.slot <= 4) this.overlay[body.slot] = st;
      if (body.matchId) this.liveByMatch[body.matchId] = st;
      return R({ ok: true, etag: Date.now().toString(36) });
    }
    if ((path === "/overlay/state" || path === "/overlay/poll") && method === "GET") {
      const slot = parseInt(q.get("slot") || "0", 10);
      const st = this.overlay[slot] || null;
      return { status: 200, json: { state: st, etag: st ? String(st.pushedAt) : null }, delay: path === "/overlay/poll" ? 1500 : 0 };
    }
    if (path === "/overlay/all" && method === "GET") {
      return R({ slots: Object.entries(this.liveByMatch).map(([matchId, state]) => ({ matchId, state, etag: String(state.pushedAt) })) });
    }
    if (path === "/matchlog" && method === "GET") return R({ found: false, comboHistory: [] });

    if (path === "/combos/slug" && method === "GET") return R({ registry: this.combos, updatedAt: Date.now() });
    if (path === "/combos/slug" && method === "POST") {
      if (!body || !body.player || !Array.isArray(body.combos)) return R({ error: "Missing slug, player, or combos" }, 400);
      if (/^ID:\d+$/i.test(String(body.player).trim())) this.find("bug", who, "Combos saved under an ID instead of a player name", body.player);
      const key = String(body.player).trim().toLowerCase();
      if (!this.ev.players.some(p => [p.name, ...(p.oldNames || [])].some(n => n.trim().toLowerCase() === key))) this.find("bug", who, "Previous combos saved under a name that is not in the bracket", "\"" + body.player + "\"");
      const now = Date.now();
      const existing = this.combos[key] || [];
      body.combos.forEach(c => {
        const s = [c.blade, c.ratchet, c.bit].filter(Boolean).join("|");
        const i = existing.findIndex(e => [e.blade, e.ratchet, e.bit].filter(Boolean).join("|") === s);
        if (i >= 0) existing[i] = { ...c, updatedAt: now }; else existing.push({ ...c, updatedAt: now });
      });
      this.combos[key] = existing.filter(c => c.blade && c.bit).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
      return R({ ok: true });
    }

    if (path === "/pings/send" && method === "POST") { this.pings.push({ who, ...body }); return R({ ok: true }); }
    if (path === "/pings/poll" && method === "GET") return { status: 200, json: { pings: [] }, delay: 3000 };
    if (path === "/pings/dismiss" && method === "POST") return R({ ok: true });

    if (path === "/notify/add" && method === "POST") {
      this.notify.push({ who, ...body });
      if (body && body.status !== "sent") this.find("warn", who, "App told the organizer a score did not reach the bracket (" + body.status + ")", (body.p1 || "") + " vs " + (body.p2 || ""));
      return R({ ok: true });
    }
    if (path === "/notify/list" && method === "GET") return R({ ok: true, notifications: this.notify });
    if (path === "/notify/resolve" && method === "POST") return R({ ok: true });

    if (path === "/handoff/create" && method === "POST") { this.handoffs[body.token] = body.state; return R({ ok: true }); }
    if (path === "/handoff/get" && method === "GET") {
      const h = this.handoffs[q.get("token")];
      return h ? R(h) : R({ error: "Not found" }, 404);
    }
    if (path === "/handoff/claim" && method === "POST") {
      if (this.handoffs[body.token]) this.handoffs[body.token].claimed = true;
      return R({ ok: true });
    }
    if (path === "/handoff/cancel" && method === "DELETE") { delete this.handoffs[q.get("token")]; return R({ ok: true }); }

    return this.unknownRoute(who, method, "challonge-proxy", path);
  }

  // POST /submit: the bracket result. Checks it the way Challonge would, then records it.
  submit(who, body) {
    const R = (json, status = 200) => ({ status, json });
    const ev = this.ev;
    if (!body || !body.slug || !body.matchId || !body.scores_csv || !body.winner_id) {
      this.find("bug", who, "Bracket submit was missing a field", JSON.stringify(body));
      return R({ error: "Missing fields" }, 400);
    }
    const m = ev.matches.find(x => String(x.id) === String(body.matchId));
    if (!m) { this.find("bug", who, "Bracket submit for a match that does not exist", body.matchId); return R({ errors: ["Match not found"] }, 404); }
    const wid = Number(body.winner_id);
    if (wid !== m.player1_id && wid !== m.player2_id) {
      // Challonge would refuse this. A wrong winner id is a name-lookup bug in the app.
      this.find("bug", who, "Bracket submit named a winner who is not in that match", "match " + m.id + ", winner_id " + body.winner_id + ", players " + m.player1_id + "/" + m.player2_id);
      return R({ errors: ["Winner must be one of the match participants"] }, 422);
    }
    const sets = String(body.scores_csv).split(",").map(s => s.trim());
    if (!sets.every(s => /^\d+-\d+$/.test(s))) {
      this.find("bug", who, "Bracket score is not in the 3-1,4-2 format", body.scores_csv);
      return R({ errors: ["Scores csv is invalid"] }, 422);
    }
    // Who won more sets (p1 score first in each pair)?
    let a = 0, b = 0;
    sets.forEach(s => { const [x, y] = s.split("-").map(Number); if (x > y) a++; else if (y > x) b++; });
    const scoreWinner = a > b ? m.player1_id : b > a ? m.player2_id : null;
    if (sets.length > 1 && scoreWinner !== wid) this.find("bug", who, "Bracket score and winner disagree", "match " + m.id + ": " + body.scores_csv + ", winner_id " + wid);
    if (sets.length === 1) {
      const [x, y] = sets[0].split("-").map(Number);
      const w1 = x > y ? m.player1_id : y > x ? m.player2_id : null;
      if (w1 !== wid) this.find("bug", who, "Bracket score and winner disagree", "match " + m.id + ": " + body.scores_csv + ", winner_id " + wid);
    }
    if (m.state === "complete") {
      const first = this.submits.find(x => x.matchId === m.id);
      if (first && first.who !== who) this.find("bug", who, "Two judges submitted the same match; the second result replaced the first", "match " + m.id + ": station " + first.who + " sent " + m.scores_csv + ", then station " + who + " sent " + body.scores_csv);
      else this.find("warn", who, "Same match submitted to the bracket again", "match " + m.id + " (was " + m.scores_csv + ", now " + body.scores_csv + ")");
    }
    m.state = "complete";
    m.scores_csv = body.scores_csv;
    m.winner_id = wid;
    m.loser_id = wid === m.player1_id ? m.player2_id : m.player1_id;
    m.updated_at = new Date().toISOString();
    this.submits.push({ who, matchId: m.id, scores_csv: body.scores_csv, winner_id: wid, at: Date.now() });
    if (this.autoAdvance && roundComplete(ev) && ev.round < (this.opts.rounds || 1)) {
      if (ev.round === 1 && this.opts.rename !== false) this.renamed = renameAfterRound1(ev);
      addSwissRound(ev);
    }
    return R({ match: { ...m }, usedToken: false });
  }

  // An organizer typing a result into the bracket by hand (used when the app could not send it).
  enterByHand(matchId, scores_csv, winnerSide) {
    const m = this.ev.matches.find(x => String(x.id) === String(matchId));
    if (!m || m.state === "complete") return;
    m.state = "complete"; m.scores_csv = scores_csv;
    m.winner_id = winnerSide === 1 ? m.player1_id : m.player2_id;
    m.loser_id = winnerSide === 1 ? m.player2_id : m.player1_id;
    this.handEntered = (this.handEntered || 0) + 1;
    if (this.autoAdvance && roundComplete(this.ev) && this.ev.round < (this.opts.rounds || 1)) {
      if (this.ev.round === 1 && this.opts.rename !== false) this.renamed = renameAfterRound1(this.ev);
      addSwissRound(this.ev);
    }
  }

  // POST /db/ingest: the database copy of each battle. Checked like the database Worker does.
  ingest(who, body) {
    const R = (json, status = 200) => ({ status, json });
    if (!body || !body.slug || !Array.isArray(body.rows) || !body.rows.length) return R({ error: "Missing slug or rows" }, 400);
    this.ingests.push({ who, slug: body.slug, rows: body.rows, p1Priority: body.p1Priority });
    const noSide = [];
    let tagged = 0;
    body.rows.forEach((raw, i) => {
      const get = {};
      if (Array.isArray(raw)) FIELD_ORDER.forEach((n, k) => { get[n] = raw[k]; });
      else if (raw && typeof raw === "object") FIELD_ORDER.forEach(n => { get[n] = raw[n]; });
      const t = n => (get[n] === null || get[n] === undefined ? "" : String(get[n]).trim());
      const label = "row " + (i + 1);
      const p1 = t("P1").replace(/~P~$/, "").trim(), p2 = t("P2").replace(/~P~$/, "").trim();
      // Every name saved must be a real bracket name (current or earlier), not a shortened or made-up one.
      const known = new Set(this.ev.players.flatMap(pl => [pl.name, ...(pl.oldNames || [])].map(x => x.trim())));
      [["P1", p1], ["P2", p2], ["Winner", t("Winner")]].forEach(([col, v]) => {
        if (v && !known.has(v)) this.find("bug", who, "Database row has a player name that is not in the bracket", col + " = \"" + v + "\" (" + label + " of " + p1 + " vs " + p2 + ")");
      });
      ["Timestamp", "Tournament", "Match", "Winner"].forEach(n => { if (!t(n)) this.find("bug", who, "Database row missing " + n, label + " of " + p1 + " vs " + p2); });
      if (!p1 || !p2) this.find("bug", who, "Database row missing a player name", label);
      if (/^ID:\d+$/i.test(p1) || /^ID:\d+$/i.test(p2)) this.find("bug", who, "Database row has an ID instead of a name", p1 + " vs " + p2);
      const fin = FINISH_FIX[t("FinishType").toLowerCase()] || t("FinishType");
      if (!FINISH_POINTS[fin]) this.find("bug", who, "Database row has an unknown finish type", t("FinishType"));
      const pts = parseInt(t("Points"), 10);
      if (FINISH_POINTS[fin] && !isNaN(pts) && FINISH_POINTS[fin].indexOf(pts) === -1) this.find("bug", who, "Points do not match the finish type", fin + " gave " + pts + " (" + label + ")");
      const w = t("Winner");
      if (w && w !== p1 && w !== p2) this.find("bug", who, "Database row winner is neither player", w + " (" + p1 + " vs " + p2 + ")");
      if (!t("Judge")) this.find("warn", who, "Database row has no judge name", label);
      if (!/^[BX]$/.test(t("P1Side")) || !/^[BX]$/.test(t("P2Side"))) noSide.push(label);
      if (/~P~$/.test(t("P1")) || /~P~$/.test(t("P2"))) tagged++;
    });
    const first = body.rows[0], g = i => String(Array.isArray(first) ? first[i] : "");
    const what = g(4).replace(/~P~$/, "").trim() + " vs " + g(6).replace(/~P~$/, "").trim();
    if (noSide.length) this.find("warn", who, "Database rows are missing the B/X side", what + ": " + noSide.length + " of " + body.rows.length + " rows");
    if (!tagged && body.p1Priority == null) this.find("warn", who, "Database rows carry no Set 1 pick-priority (~P~) tag", what);
    return R({ ok: true, inserted: body.rows.length, skipped: 0, notes: [] });
  }

  sheetsPost(who, body) {
    this.sheets.push({ who, payload: body });
    return { status: 200, text: "ok", contentType: "text/plain" };
  }

  standings() {
    const n = this.idToName();
    const rec = {};
    this.ev.players.forEach(p => { rec[p.gid] = { id: String(p.id), name: p.name, seed: p.seed, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }; });
    this.ev.matches.forEach(m => {
      if (m.state !== "complete") return;
      const w = m.winner_id, l = w === m.player1_id ? m.player2_id : m.player1_id;
      rec[w].wins++; rec[l].losses++;
      m.scores_csv.split(",").forEach(s => {
        const [x, y] = s.split("-").map(Number);
        rec[m.player1_id].pointsFor += x; rec[m.player1_id].pointsAgainst += y;
        rec[m.player2_id].pointsFor += y; rec[m.player2_id].pointsAgainst += x;
      });
    });
    void n;
    return Object.values(rec).map(r => ({ ...r, finalRank: null, pointDiff: r.pointsFor - r.pointsAgainst }))
      .sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
  }

  // ── ncblast-db Worker ────────────────────────────────────────────────────
  db(who, method, path, q, body) {
    const R = (json, status = 200) => ({ status, json });
    if (path === "/overlay-live") {
      const slot = parseInt(q.get("slot") || "", 10);
      if (!(slot >= 1 && slot <= 4)) return R({ error: "Bad channel." }, 400);
      if (method === "GET") {
        const cur = this.overlayLive[slot];
        if (!cur) return R({ ok: true, same: true, v: 0 });
        if (q.get("v") === String(cur.v)) return R({ ok: true, same: true, v: cur.v });
        return R({ ok: true, v: cur.v, at: cur.at, state: cur.state });
      }
      if (method === "POST") {
        const v = Math.max(Date.now(), ((this.overlayLive[slot] && this.overlayLive[slot].v) || 0) + 1);
        this.overlayLive[slot] = { v, at: Date.now(), state: body && body.state };
        return R({ ok: true, v });
      }
    }
    if (path === "/overlay-config" && method === "GET") return R({ ok: true, config: {}, test: null });
    if (path === "/matchup-stats" && method === "GET") return R({ ok: true, n: 0, aWins: 0, bWins: 0, aPts: 0, bPts: 0 });
    if (path === "/match-notes") {
      if (method === "POST") { this.notes.push({ who, ...body }); return R({ ok: true }); }
      return R({ ok: true, notes: this.notes });
    }
    if (path === "/deck-log") {
      if (method === "POST") { this.decks.push({ who, ...body }); return R({ ok: true }); }
      return R({ ok: true, decks: this.decks });
    }
    if (path === "/event-stats" && method === "GET") return R({ ok: true, players: [], combos: [] });
    if (path === "/standings" && method === "GET") return R({ ok: true, groups: [] });
    return this.unknownRoute(who, method, "ncblast-db", path);
  }
}

module.exports = { FakeWorker, FINISH_POINTS };
