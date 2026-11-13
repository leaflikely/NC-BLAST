(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // sim/web/stubs/fs.cjs
  var require_fs = __commonJS({
    "sim/web/stubs/fs.cjs"(exports2, module2) {
      var files = /* @__PURE__ */ new Map();
      module2.exports = {
        files,
        writeFileSync(p, data) {
          files.set(String(p), String(data));
        },
        mkdirSync() {
        },
        existsSync(p) {
          return files.has(String(p));
        },
        readFileSync(p) {
          return files.get(String(p)) || "";
        }
      };
    }
  });

  // sim/fake-event.cjs
  var require_fake_event = __commonJS({
    "sim/fake-event.cjs"(exports2, module2) {
      var PLAYER_NAMES = [
        "Ace Ramirez",
        "Bree Tanaka",
        "Alex",
        "Dani Okafor",
        "Alex K.",
        "Zo\xEB Laurent",
        "Milo Grant ",
        "Hana Sato",
        "D'Angelo Brooks",
        "\u{1F525}Blaze",
        "Jos\xE9 \xC1lvarez",
        "Christopher Montgomery-Wellington III",
        "Cole Whitfield",
        "Eli Novak",
        "Faye Lindqvist",
        "Gus Moreno",
        "Ivan Petrov",
        "Jade Collins",
        "Kai Mendoza",
        "Lena Fischer",
        "Nia Adeyemi",
        "Owen Park",
        "Pia Rossi",
        "Quinn Harper",
        "Rafa Delgado",
        "Sage Bennett",
        "Theo Nakamura",
        "Uma Patel",
        "Vic Herrera",
        "Wes Dalton",
        "Mai Nguyen",
        "Finn O'Neil"
      ];
      var RENAME = { from: "Hana Sato", to: "Hana Sato-Kim" };
      var STATIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
      function makeEvent(opts2 = {}) {
        const slug = opts2.slug || "ncbl-simswiss32";
        const name = opts2.name || "SIM Swiss 32 (fake event)";
        const players = PLAYER_NAMES.slice(0, opts2.players || 32).map((n, i) => ({
          id: 1001 + i,
          gid: 2001 + i,
          name: n,
          seed: i + 1
        }));
        const judges = STATIONS.slice(0, opts2.judges || 8).map((st, i) => ({
          username: "simjudge" + (i + 1),
          bracketName: "Sim Judge " + (i + 1),
          station: st
        }));
        const ev = {
          slug,
          name,
          ranked: opts2.ranked !== false,
          loginMode: "solo",
          players,
          judges,
          matches: [],
          // Challonge-shaped match records
          round: 0,
          nextMatchId: 5001
        };
        addSwissRound(ev);
        return ev;
      }
      function participantRecord(p) {
        return {
          participant: {
            id: p.id,
            name: p.name,
            display_name: p.name,
            username: null,
            seed: p.seed,
            group_player_ids: [p.gid],
            active: true,
            final_rank: null
          }
        };
      }
      function records(ev) {
        const rec = {};
        ev.players.forEach((p) => {
          rec[p.id] = { w: 0, l: 0, diff: 0, opp: /* @__PURE__ */ new Set() };
        });
        const byGid = {};
        ev.players.forEach((p) => {
          byGid[p.gid] = p.id;
        });
        ev.matches.forEach((m) => {
          const a = byGid[m.player1_id], b = byGid[m.player2_id];
          if (a && b) {
            rec[a].opp.add(b);
            rec[b].opp.add(a);
          }
          if (m.state !== "complete" || !m.winner_id) return;
          const w = byGid[m.winner_id], l = w === a ? b : a;
          rec[w].w++;
          rec[l].l++;
        });
        return rec;
      }
      function addSwissRound(ev) {
        ev.round++;
        const rec = records(ev);
        const order = ev.players.slice().sort((x, y) => rec[y.id].w - rec[x.id].w || x.seed - y.seed);
        const left = order.slice();
        const pairs = [];
        while (left.length > 1) {
          const a = left.shift();
          let j = left.findIndex((b2) => !rec[a.id].opp.has(b2.id));
          if (j < 0) j = 0;
          const b = left.splice(j, 1)[0];
          pairs.push([a, b]);
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        pairs.forEach(([a, b]) => {
          ev.matches.push({
            id: ev.nextMatchId++,
            round: ev.round,
            state: "open",
            underway_at: null,
            player1_id: a.gid,
            player2_id: b.gid,
            winner_id: null,
            loser_id: null,
            scores_csv: "",
            identifier: "",
            created_at: now,
            updated_at: now,
            group_id: 9001,
            suggested_play_order: ev.matches.length + 1
          });
        });
        return pairs.length;
      }
      function roundComplete(ev) {
        return ev.matches.filter((m) => m.round === ev.round).every((m) => m.state === "complete");
      }
      function renameAfterRound1(ev) {
        const p = ev.players.find((x) => x.name === RENAME.from);
        if (!p) return null;
        p.oldNames = [p.name];
        p.name = RENAME.to;
        return { id: p.id, from: RENAME.from, to: RENAME.to };
      }
      module2.exports = { renameAfterRound1, makeEvent, participantRecord, addSwissRound, roundComplete, records, STATIONS };
    }
  });

  // sim/random.cjs
  var require_random = __commonJS({
    "sim/random.cjs"(exports2, module2) {
      function makeRandom(seed) {
        let a = seed >>> 0;
        const next = () => {
          a = a + 1831565813 >>> 0;
          let t = a;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        next.pick = (list2) => list2[Math.floor(next() * list2.length)];
        next.chance = (p) => next() < p;
        return next;
      }
      module2.exports = { makeRandom };
    }
  });

  // sim/fake-worker.cjs
  var require_fake_worker = __commonJS({
    "sim/fake-worker.cjs"(exports2, module2) {
      var { makeRandom } = require_random();
      var { participantRecord, addSwissRound, roundComplete, renameAfterRound1 } = require_fake_event();
      var FINISH_POINTS = {
        "Xtreme Finish": [3],
        "Over Finish": [2],
        "Burst Finish": [2],
        "Spin Finish": [1],
        "Own Finish": [2, 3],
        "LER Strike": [0],
        "Launch Error": [1]
      };
      var FINISH_FIX = {
        spf: "Spin Finish",
        ovr: "Over Finish",
        bst: "Burst Finish",
        xtr: "Xtreme Finish",
        "own finish": "Own Finish",
        of: "Own Finish",
        of2: "Own Finish",
        of3: "Own Finish",
        "ler strike": "LER Strike",
        "ler-strike": "LER Strike",
        "launch error": "Launch Error",
        ler: "Launch Error"
      };
      var FIELD_ORDER = [
        "Timestamp",
        "Judge",
        "Tournament",
        "Match",
        "P1",
        "P1Side",
        "P2",
        "P2Side",
        "Set",
        "Shuffle",
        "Slot",
        "Winner",
        "WinnerCombo",
        "FinishType",
        "Points",
        "Penalty",
        "P1Score",
        "P2Score",
        "P1Combo",
        "P2Combo"
      ];
      var FakeWorker = class {
        constructor(ev, opts2 = {}) {
          this.ev = ev;
          this.opts = opts2;
          this.log = [];
          this.findings = [];
          this.submits = [];
          this.ingests = [];
          this.sheets = [];
          this.overlay = {};
          this.overlayLive = {};
          this.liveByMatch = {};
          this.combos = {};
          this.scorelog = [];
          this.notify = [];
          this.notes = [];
          this.decks = [];
          this.backups = [];
          this.pings = [];
          this.handoffs = {};
          this.unknown = {};
          this.flags = opts2.flags || {};
          this.autoAdvance = opts2.autoAdvance !== false;
          this.startedAt = Date.now();
          this.truthDecks = {};
          this.renamed = null;
          this.wifiBad = opts2.wifi === "bad";
          this.wifiStats = { slow: 0, lostBefore: 0, lostAfter: 0 };
          if (this.wifiBad) {
            const rnd = makeRandom((opts2.seed || 1) * 104729 + 7);
            const LOGIN = /^\/(list|flags|judge-namemap|judge-whitelist\/check|judges\/get|parts)?$/;
            this.wifiFate = (method, url) => {
              const u = new URL(url);
              if (!/^(challonge-proxy|ncblast-db|script)\./.test(u.hostname)) return null;
              const r = rnd();
              if (method === "POST") {
                if (r < 0.07) {
                  this.wifiStats.lostBefore++;
                  return { fail: "before", delay: 300 + rnd() * 1500 };
                }
                if (r < 0.12) {
                  this.wifiStats.lostAfter++;
                  return { fail: "after", delay: 300 + rnd() * 1500 };
                }
                if (r < 0.37) {
                  this.wifiStats.slow++;
                  return { delay: 400 + rnd() * 2600 };
                }
                return null;
              }
              if (method === "GET") {
                if (!LOGIN.test(u.pathname) && r < 0.04) {
                  this.wifiStats.lostBefore++;
                  return { fail: "before", delay: 200 + rnd() * 1e3 };
                }
                if (r < 0.24) {
                  this.wifiStats.slow++;
                  return { delay: 300 + rnd() * 1700 };
                }
              }
              return null;
            };
          }
        }
        find(level, who, what, detail) {
          this.findings.push({ level, who, what, detail: detail === void 0 ? "" : detail, at: Date.now() });
        }
        // ── helpers ──────────────────────────────────────────────────────────────
        idToName() {
          const map = {};
          this.ev.players.forEach((p) => {
            map[p.id] = p.name;
            map[p.gid] = p.name;
          });
          return map;
        }
        pairing(m) {
          const n = this.idToName();
          return {
            id: m.id,
            round: m.round,
            state: m.state,
            underway_at: m.underway_at || null,
            player1_id: m.player1_id,
            player2_id: m.player2_id,
            winner_id: m.winner_id,
            scores_csv: m.scores_csv || "",
            player1_name: n[m.player1_id] || "",
            player2_name: n[m.player2_id] || ""
          };
        }
        stationQueues() {
          const out = {};
          this.ev.judges.forEach((j) => {
            out[j.station] = [];
          });
          const open = this.ev.matches.filter((m) => m.round === this.ev.round);
          const st = Object.keys(out);
          open.forEach((m, i) => {
            out[st[i % st.length]].push(m.id);
          });
          return out;
        }
        tournamentMeta() {
          const ev = this.ev;
          return {
            slug: ev.slug,
            name: ev.name,
            orgUsername: "simorg",
            ranked: ev.ranked,
            loginMode: ev.loginMode,
            judges: [],
            headJudges: [],
            fetchedAt: Date.now(),
            count: ev.players.length
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
          if (req.body) {
            try {
              body = JSON.parse(req.body);
            } catch (_) {
              body = req.body;
            }
          }
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
          const okSlug = (s) => s === ev.slug;
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
            ev.judges.forEach((j) => {
              map[j.username] = j.bracketName;
            });
            return R({ ok: true, map });
          }
          if (path === "/judge-whitelist/check" && method === "GET") return R({ ok: true, allowed: true, loginMode: ev.loginMode });
          if (path === "/judge-whitelist/get" && method === "GET") return R({ ok: true, usernames: ev.judges.map((j) => j.username) });
          if (path === "/judges/get" && method === "GET") return R({ headJudges: [], orgUsername: "simorg", loginMode: ev.loginMode });
          if (path === "/judges/presence" && method === "GET") return R({ presence: [] });
          if (path === "/auth/confirm" && method === "POST") return R({ ok: true, username: (body && body.username || "").toLowerCase() });
          if (path === "/stadium-assign" && method === "GET") {
            const assign = {};
            ev.judges.forEach((j) => {
              assign[j.username] = j.station;
            });
            return R({ ok: true, data: { count: ev.judges.length, assign } });
          }
          if (path === "/station-queues" && method === "GET") return R({ ok: true, data: this.stationQueues() });
          if (path === "/matches" && method === "GET") {
            if (!okSlug(q.get("slug"))) return R({ error: "Challonge matches error: HTTP 404" }, 404);
            const matches = ev.matches.filter((m) => m.state === "open").map((m) => ({ ...m, ...this.pairing(m) }));
            return R({ matches });
          }
          if (path === "/pairings" && method === "GET") {
            if (!okSlug(q.get("slug"))) return R({ error: "Challonge error: HTTP 404" }, 404);
            return R({ pairings: ev.matches.map((m) => this.pairing(m)), fromCache: false });
          }
          if (path === "/standings" && method === "GET") return R({ standings: this.standings(), fromCache: false });
          if (path === "/match/underway" && method === "POST") {
            const m = ev.matches.find((x) => String(x.id) === String(body && body.matchId));
            if (!m) {
              this.find("bug", who, "Marked a match underway that does not exist", body && body.matchId);
              return R({ ok: false, status: 404 });
            }
            if (m.underway_at && m.state === "open") this.find("info", who, "Match marked underway twice", m.id);
            m.underway_at = (/* @__PURE__ */ new Date()).toISOString();
            return R({ ok: true, status: 200, data: { match: m }, usedToken: false, usedFallback: false });
          }
          if (path === "/submit" && method === "POST") return this.submit(who, body);
          if (!this.opts.newRoutes && /^\/(submit\/verify|notify\/)/.test(path)) return this.unknownRoute(who, method, "challonge-proxy", path);
          if (path === "/submit/verify" && method === "POST") {
            const m = ev.matches.find((x) => String(x.id) === String(body && body.matchId));
            if (!m) return R({ confirmed: false, reason: "match not found" });
            const same = m.state === "complete" && m.scores_csv === (body.scores_csv || "");
            return R({ confirmed: same, reason: same ? "" : "bracket shows " + (m.scores_csv || "no score") });
          }
          if (path === "/scorelog/push" && method === "POST") {
            this.scorelog.push({ who, ...body });
            return R({ ok: true });
          }
          if (path === "/db/ingest" && method === "POST") return this.ingest(who, body);
          if (path === "/db/timing" && method === "POST") {
            if (!body || !Array.isArray(body.lines) || !body.lines.length) this.find("warn", who, "Timing send had no lines", "");
            return R({ ok: true, inserted: body && body.lines ? body.lines.length : 0, replaced: 0 });
          }
          if (path === "/backup/upload" && method === "POST") {
            this.backups.push({ who, kind: body && body.kind, fileName: body && body.fileName });
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
            if (!this.ev.players.some((p) => [p.name, ...p.oldNames || []].some((n) => n.trim().toLowerCase() === key))) this.find("bug", who, "Previous combos saved under a name that is not in the bracket", '"' + body.player + '"');
            const now = Date.now();
            const existing = this.combos[key] || [];
            body.combos.forEach((c) => {
              const s = [c.blade, c.ratchet, c.bit].filter(Boolean).join("|");
              const i = existing.findIndex((e) => [e.blade, e.ratchet, e.bit].filter(Boolean).join("|") === s);
              if (i >= 0) existing[i] = { ...c, updatedAt: now };
              else existing.push({ ...c, updatedAt: now });
            });
            this.combos[key] = existing.filter((c) => c.blade && c.bit).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
            return R({ ok: true });
          }
          if (path === "/pings/send" && method === "POST") {
            this.pings.push({ who, ...body });
            return R({ ok: true });
          }
          if (path === "/pings/poll" && method === "GET") return { status: 200, json: { pings: [] }, delay: 3e3 };
          if (path === "/pings/dismiss" && method === "POST") return R({ ok: true });
          if (path === "/notify/add" && method === "POST") {
            this.notify.push({ who, ...body });
            if (body && body.status !== "sent") this.find("warn", who, "App told the organizer a score did not reach the bracket (" + body.status + ")", (body.p1 || "") + " vs " + (body.p2 || ""));
            return R({ ok: true });
          }
          if (path === "/notify/list" && method === "GET") return R({ ok: true, notifications: this.notify });
          if (path === "/notify/resolve" && method === "POST") return R({ ok: true });
          if (path === "/handoff/create" && method === "POST") {
            this.handoffs[body.token] = body.state;
            return R({ ok: true });
          }
          if (path === "/handoff/get" && method === "GET") {
            const h2 = this.handoffs[q.get("token")];
            return h2 ? R(h2) : R({ error: "Not found" }, 404);
          }
          if (path === "/handoff/claim" && method === "POST") {
            if (this.handoffs[body.token]) this.handoffs[body.token].claimed = true;
            return R({ ok: true });
          }
          if (path === "/handoff/cancel" && method === "DELETE") {
            delete this.handoffs[q.get("token")];
            return R({ ok: true });
          }
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
          const m = ev.matches.find((x) => String(x.id) === String(body.matchId));
          if (!m) {
            this.find("bug", who, "Bracket submit for a match that does not exist", body.matchId);
            return R({ errors: ["Match not found"] }, 404);
          }
          const wid = Number(body.winner_id);
          if (wid !== m.player1_id && wid !== m.player2_id) {
            this.find("bug", who, "Bracket submit named a winner who is not in that match", "match " + m.id + ", winner_id " + body.winner_id + ", players " + m.player1_id + "/" + m.player2_id);
            return R({ errors: ["Winner must be one of the match participants"] }, 422);
          }
          const sets = String(body.scores_csv).split(",").map((s) => s.trim());
          if (!sets.every((s) => /^\d+-\d+$/.test(s))) {
            this.find("bug", who, "Bracket score is not in the 3-1,4-2 format", body.scores_csv);
            return R({ errors: ["Scores csv is invalid"] }, 422);
          }
          let a = 0, b = 0;
          sets.forEach((s) => {
            const [x, y] = s.split("-").map(Number);
            if (x > y) a++;
            else if (y > x) b++;
          });
          const scoreWinner = a > b ? m.player1_id : b > a ? m.player2_id : null;
          if (sets.length > 1 && scoreWinner !== wid) this.find("bug", who, "Bracket score and winner disagree", "match " + m.id + ": " + body.scores_csv + ", winner_id " + wid);
          if (sets.length === 1) {
            const [x, y] = sets[0].split("-").map(Number);
            const w1 = x > y ? m.player1_id : y > x ? m.player2_id : null;
            if (w1 !== wid) this.find("bug", who, "Bracket score and winner disagree", "match " + m.id + ": " + body.scores_csv + ", winner_id " + wid);
          }
          if (m.state === "complete") {
            const first = this.submits.find((x) => x.matchId === m.id);
            if (first && first.who !== who) this.find("bug", who, "Two judges submitted the same match; the second result replaced the first", "match " + m.id + ": station " + first.who + " sent " + m.scores_csv + ", then station " + who + " sent " + body.scores_csv);
            else this.find("warn", who, "Same match submitted to the bracket again", "match " + m.id + " (was " + m.scores_csv + ", now " + body.scores_csv + ")");
          }
          m.state = "complete";
          m.scores_csv = body.scores_csv;
          m.winner_id = wid;
          m.loser_id = wid === m.player1_id ? m.player2_id : m.player1_id;
          m.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          this.submits.push({ who, matchId: m.id, scores_csv: body.scores_csv, winner_id: wid, at: Date.now() });
          if (this.autoAdvance && roundComplete(ev) && ev.round < (this.opts.rounds || 1)) {
            if (ev.round === 1 && this.opts.rename !== false) this.renamed = renameAfterRound1(ev);
            addSwissRound(ev);
          }
          return R({ match: { ...m }, usedToken: false });
        }
        // A bracket call that went to the real Worker (real MatchMason event). Results are recorded
        // just like the fake bracket records them, so every robot check still works.
        onRealBracketCall(who, method, url, postData, status, text) {
          const path = new URL(url).pathname;
          this.log.push({ t: Date.now(), who, method, host: "REAL", path });
          if (!(method === "POST" && path === "/mm/match/result")) return;
          let body = {}, data = {};
          try {
            body = JSON.parse(postData || "{}");
          } catch (_) {
          }
          try {
            data = JSON.parse(text || "{}");
          } catch (_) {
          }
          const m = this.ev.matches.find((x) => String(x.id) === String(body.matchId));
          if (status >= 400 || data.ok === false) {
            this.find("bug", who, "MatchMason refused a result", "match " + body.matchId + " (" + body.scores_csv + "): HTTP " + status + " " + String(data.error || JSON.stringify(data.data || data)).slice(0, 200));
            return;
          }
          if (m && m.state === "complete") {
            const first = this.submits.find((x) => String(x.matchId) === String(m.id));
            this.find(first && first.who !== who ? "bug" : "warn", who, "Same match sent to MatchMason twice", "match " + m.id + " (was " + m.scores_csv + ", now " + body.scores_csv + ")");
          }
          if (m) {
            m.state = "complete";
            m.scores_csv = body.scores_csv;
            m.winner_id = isNaN(Number(body.winner_id)) ? body.winner_id : Number(body.winner_id);
            m.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          }
          this.submits.push({ who, matchId: m ? m.id : body.matchId, scores_csv: body.scores_csv, winner_id: m ? m.winner_id : body.winner_id, at: Date.now() });
        }
        // An organizer typing a result into the bracket by hand (used when the app could not send it).
        enterByHand(matchId, scores_csv, winnerSide) {
          const m = this.ev.matches.find((x) => String(x.id) === String(matchId));
          if (!m || m.state === "complete") return;
          m.state = "complete";
          m.scores_csv = scores_csv;
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
            if (Array.isArray(raw)) FIELD_ORDER.forEach((n, k) => {
              get[n] = raw[k];
            });
            else if (raw && typeof raw === "object") FIELD_ORDER.forEach((n) => {
              get[n] = raw[n];
            });
            const t = (n) => get[n] === null || get[n] === void 0 ? "" : String(get[n]).trim();
            const label = "row " + (i + 1);
            const p1 = t("P1").replace(/~P~$/, "").trim(), p2 = t("P2").replace(/~P~$/, "").trim();
            const known = new Set(this.ev.players.flatMap((pl) => [pl.name, ...pl.oldNames || []].map((x) => x.trim())));
            [["P1", p1], ["P2", p2], ["Winner", t("Winner")]].forEach(([col, v]) => {
              if (v && !known.has(v)) this.find("bug", who, "Database row has a player name that is not in the bracket", col + ' = "' + v + '" (' + label + " of " + p1 + " vs " + p2 + ")");
            });
            ["Timestamp", "Tournament", "Match", "Winner"].forEach((n) => {
              if (!t(n)) this.find("bug", who, "Database row missing " + n, label + " of " + p1 + " vs " + p2);
            });
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
          const first = body.rows[0], g = (i) => String(Array.isArray(first) ? first[i] : "");
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
          this.ev.players.forEach((p) => {
            rec[p.gid] = { id: String(p.id), name: p.name, seed: p.seed, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
          });
          this.ev.matches.forEach((m) => {
            if (m.state !== "complete") return;
            const w = m.winner_id, l = w === m.player1_id ? m.player2_id : m.player1_id;
            rec[w].wins++;
            rec[l].losses++;
            m.scores_csv.split(",").forEach((s) => {
              const [x, y] = s.split("-").map(Number);
              rec[m.player1_id].pointsFor += x;
              rec[m.player1_id].pointsAgainst += y;
              rec[m.player2_id].pointsFor += y;
              rec[m.player2_id].pointsAgainst += x;
            });
          });
          void n;
          return Object.values(rec).map((r) => ({ ...r, finalRank: null, pointDiff: r.pointsFor - r.pointsAgainst })).sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);
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
              const v = Math.max(Date.now(), (this.overlayLive[slot] && this.overlayLive[slot].v || 0) + 1);
              this.overlayLive[slot] = { v, at: Date.now(), state: body && body.state };
              return R({ ok: true, v });
            }
          }
          if (path === "/overlay-config" && method === "GET") return R({ ok: true, config: {}, test: null });
          if (path === "/matchup-stats" && method === "GET") return R({ ok: true, n: 0, aWins: 0, bWins: 0, aPts: 0, bPts: 0 });
          if (path === "/match-notes") {
            if (method === "POST") {
              this.notes.push({ who, ...body });
              return R({ ok: true });
            }
            return R({ ok: true, notes: this.notes });
          }
          if (path === "/deck-log") {
            if (method === "POST") {
              this.decks.push({ who, ...body });
              return R({ ok: true });
            }
            return R({ ok: true, decks: this.decks });
          }
          if (path === "/event-stats" && method === "GET") return R({ ok: true, players: [], combos: [] });
          if (path === "/standings" && method === "GET") return R({ ok: true, groups: [] });
          return this.unknownRoute(who, method, "ncblast-db", path);
        }
      };
      module2.exports = { FakeWorker, FINISH_POINTS };
    }
  });

  // sim/ui.cjs
  var require_ui = __commonJS({
    "sim/ui.cjs"(exports, module) {
      var POLL = 40;
      var SEEN_TEXT = `
  (el) => {
    let t = (el.innerText || "").replace(/\\s+/g, " ").trim();
    if (!t) {
      const parts = [...el.querySelectorAll("[data-label]")].map(x => x.getAttribute("data-label"));
      t = (parts.length ? parts.join(" ") : (el.getAttribute("aria-label") || el.textContent || "")).replace(/\\s+/g, " ").trim();
    }
    return t;
  }`;
      function visibleButtonsFn() {
        return `(() => {
    const seen = ${SEEN_TEXT};
    return [...document.querySelectorAll("button,[role=button]")]
      .filter(b => b.offsetParent !== null || getComputedStyle(b).position === "fixed")
      .map(b => ({ el: b, text: seen(b), disabled: !!b.disabled }));
  })()`;
      }
      async function findButton(page, match, opts = {}) {
        const src = typeof match === "string" ? { kind: "exact", v: match } : match instanceof RegExp ? { kind: "re", v: match.source, f: match.flags } : null;
        if (!src) throw new Error("findButton: use a string or RegExp");
        const h = await page.evaluateHandle(([src, allowDisabled, fn]) => {
          const list = eval(fn);
          const ok = (t) => src.kind === "exact" ? t === src.v : new RegExp(src.v, src.f).test(t);
          const hit = list.find((b) => ok(b.text) && (allowDisabled || !b.disabled));
          return hit ? hit.el : null;
        }, [src, !!opts.allowDisabled, visibleButtonsFn()]);
        const el = h.asElement();
        return el;
      }
      async function tap(page2, match2, opts2 = {}) {
        const timeout2 = opts2.timeout === void 0 ? 8e3 : opts2.timeout;
        const end2 = Date.now() + timeout2;
        for (; ; ) {
          const el2 = await findButton(page2, match2, opts2);
          if (el2) {
            try {
              await el2.scrollIntoViewIfNeeded({ timeout: 2e3 }).catch(() => {
              });
              await el2.click({ timeout: 3e3 });
              return true;
            } catch (e) {
              if (Date.now() > end2) throw new Error('Could not tap "' + match2 + '": ' + String(e.message).split("\n")[0]);
            }
          } else if (Date.now() > end2) {
            if (opts2.optional) return false;
            const seen = await buttons(page2);
            throw new Error('No button "' + match2 + '" on screen. Buttons: ' + seen.slice(0, 40).join(" | "));
          }
          await page2.waitForTimeout(POLL);
        }
      }
      var RELOADING = /context was destroyed|navigation|Cannot read properties of null|Target closed|frame was detached/i;
      async function readPage(page2, fn2, arg, empty) {
        for (let i = 0; ; i++) {
          try {
            return await page2.evaluate(fn2, arg);
          } catch (e) {
            if (!RELOADING.test(String(e && e.message)) || i >= 25) throw e;
            await page2.waitForLoadState("domcontentloaded").catch(() => {
            });
            await page2.waitForTimeout(200);
          }
        }
      }
      async function buttons(page) {
        return readPage(page, (fn) => eval(fn).filter((b) => !b.disabled).map((b) => b.text).filter(Boolean), visibleButtonsFn());
      }
      async function screenText(page2) {
        return readPage(page2, () => (document.body && document.body.innerText || "").replace(/[ \t]+/g, " "));
      }
      async function waitForText(page2, re, timeout2 = 8e3) {
        const end2 = Date.now() + timeout2;
        for (; ; ) {
          const t = await screenText(page2);
          if (re.test(t)) return t;
          if (Date.now() > end2) throw new Error("Timed out waiting for " + re + ". Screen starts: " + t.replace(/\n+/g, " / ").slice(0, 300));
          await page2.waitForTimeout(POLL);
        }
      }
      module.exports = { tap, findButton, buttons, screenText, waitForText };
      async function tapSide(page, side, match, opts = {}) {
        const timeout = opts.timeout === void 0 ? 6e3 : opts.timeout;
        const end = Date.now() + timeout;
        const src = typeof match === "string" ? { kind: "exact", v: match } : { kind: "re", v: match.source, f: match.flags };
        for (; ; ) {
          const h = await page.evaluateHandle(([src, side, fn]) => {
            const list = eval(fn);
            const ok = (t) => src.kind === "exact" ? t === src.v : new RegExp(src.v, src.f).test(t);
            const hits = list.filter((b) => ok(b.text) && !b.disabled).map((b) => ({ b, x: b.el.getBoundingClientRect().left + b.el.getBoundingClientRect().width / 2 }));
            if (!hits.length) return null;
            hits.sort((a, c) => a.x - c.x);
            if (hits.length === 1) return hits[0].b.el;
            return (side === "p1" ? hits[0] : hits[hits.length - 1]).b.el;
          }, [src, side, visibleButtonsFn()]);
          const el = h.asElement();
          if (el) {
            await el.click({ timeout: 3e3, force: !!opts.force });
            return true;
          }
          if (Date.now() > end) {
            if (opts.optional) return false;
            throw new Error('No "' + match + '" button for ' + side + ". Buttons: " + (await buttons(page)).slice(0, 30).join(" | "));
          }
          await page.waitForTimeout(POLL);
        }
      }
      module.exports.tapSide = tapSide;
      async function until(page2, check, timeout2 = 3e3) {
        const end2 = Date.now() + timeout2;
        for (; ; ) {
          let v = false;
          try {
            v = await check();
          } catch (_) {
          }
          if (v) return v;
          if (Date.now() > end2) return false;
          await page2.waitForTimeout(POLL);
        }
      }
      module.exports.until = until;
      module.exports.POLL = POLL;
    }
  });

  // sim/robot-judge.cjs
  var require_robot_judge = __commonJS({
    "sim/robot-judge.cjs"(exports2, module2) {
      var ui = require_ui();
      var { makeRandom } = require_random();
      var BAD_TEXT = [
        [/\bID:\s?\d+/, "Screen shows an ID instead of a player name"],
        [/\bundefined\b/, 'Screen shows the word "undefined"'],
        [/\bNaN\b/, 'Screen shows "NaN" (a broken number)'],
        [/\[object Object\]/, 'Screen shows "[object Object]"']
      ];
      var comboText = (c) => {
        const r = (c.ratchet || "").trim(), b = (c.bit || "").trim();
        return (c.blade || "").trim() + " | " + [r, b].filter(Boolean).join(" \xB7 ");
      };
      var norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
      var shortName = (n) => n && n.length > 15 ? n.slice(0, 12) + "\u2026" : n || "";
      var escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var nameRe = (n) => new RegExp("^(" + escRe(n.trim()) + "|" + escRe(shortName(n)) + ")$");
      var sameName = (shown, n) => norm(shown) === norm(n) || norm(shown) === norm(shortName(n));
      var NOT_PARTS = /* @__PURE__ */ new Set(["", "?", "Back", "Undo", "\u2605 Popular", "# Numerical", "CX Tab", "\u2715"]);
      var isPart = (t) => t && !NOT_PARTS.has(t) && !/·|IN USE|EDITING|Crossover|^[←↩📡👥⚡🏟️↻▶⇄📷]/u.test(t);
      var RobotJudge = class {
        constructor(dev, fw, judge, opts2 = {}) {
          this.dev = dev;
          this.page = dev.page;
          this.fw = fw;
          this.judge = judge;
          this.who = judge.station;
          this.rnd = makeRandom(opts2.seed || 1);
          this.opts = opts2;
          this.steps = [];
          this.matchesDone = [];
          this.current = null;
          this.allDevs = [dev];
          this.saveTimes = [];
          this.heap = [];
        }
        say(text) {
          this.steps.push({ t: Date.now(), text });
          if (this.opts.verbose) console.log("  [" + this.who + "] " + text);
        }
        async tap(match2, opts2) {
          await ui.tap(this.page, match2, opts2);
        }
        async screen() {
          const t = await ui.screenText(this.page);
          this.scan(t);
          return t;
        }
        // Text that should never be on a screen: an id where a name belongs, or a broken value.
        scan(t) {
          for (const [re, what] of BAD_TEXT) {
            const m = re.exec(t);
            if (!m) continue;
            const key = what + "|" + (this.current ? this.current.matchId : "-");
            this.scanned = this.scanned || /* @__PURE__ */ new Set();
            if (this.scanned.has(key)) continue;
            this.scanned.add(key);
            const around = t.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).replace(/\n+/g, " / ");
            this.fw.find("bug", this.who, what, (this.current ? this.current.p1 + " vs " + this.current.p2 + ": " : "") + "\u2026" + around + "\u2026");
          }
        }
        // ── log in ───────────────────────────────────────────────────────────────
        async login(baseUrl, opts2 = {}) {
          const p = this.page;
          if (!opts2.here) {
            this.say("open the app");
            await p.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
          }
          const evName = new RegExp("^" + this.fw.ev.name.replace(/[()]/g, "\\$&"));
          for (let guard = 0; guard < 80; guard++) {
            try {
              const s = await this.screen();
              const btns = await ui.buttons(p);
              if (/Spin Finish|Set Deck Order|Pick a Side|Who Won the Die Roll|Deck Review|Record decks|Check decks|Record blades|Check blades|Both decks are hidden|CONFIRM RESULT|Select Match/.test(s) && !/Select the Challonge event/.test(s)) break;
              if (btns.includes("\u2696\uFE0F A Judge")) {
                await ui.tap(p, "\u2696\uFE0F A Judge", { optional: true, timeout: 1500 });
                continue;
              }
              if (btns.some((t) => evName.test(t))) {
                await ui.tap(p, evName, { optional: true, timeout: 1500 });
                continue;
              }
              if (btns.includes("Log in with Challonge \u2192")) {
                await ui.tap(p, "Log in with Challonge \u2192", { optional: true, timeout: 1500 });
                continue;
              }
              if (/Enter your Challonge username/.test(s)) {
                await p.fill("input", this.judge.username);
                await ui.tap(p, "Confirm \u2192", { optional: true, timeout: 1500 });
                continue;
              }
              if (btns.includes("\u270F\uFE0F Manual Name Entry") && !await p.$("input[placeholder='Enter your name\u2026']")) {
                await ui.tap(p, "\u270F\uFE0F Manual Name Entry", { optional: true, timeout: 1500 });
                continue;
              }
              if (await p.$("input[placeholder='Enter your name\u2026']")) {
                await p.fill("input[placeholder='Enter your name\u2026']", this.judge.bracketName);
                await ui.tap(p, "Confirm", { optional: true, timeout: 1500 });
                continue;
              }
              if (btns.includes("Next: Players \u2192")) {
                await ui.tap(p, "Next: Players \u2192", { optional: true, timeout: 1500 });
                continue;
              }
              await p.waitForTimeout(ui.POLL * 2);
            } catch (e) {
              if (!/context was destroyed|navigation|Target closed/i.test(String(e.message))) throw e;
              await p.waitForLoadState("domcontentloaded").catch(() => {
              });
            }
          }
          await ui.waitForText(p, /Select Match|Spin Finish|Set Deck Order|Pick a Side|Who Won the Die Roll|Deck Review|Record decks|Check decks|Record blades|Check blades|Both decks are hidden|CONFIRM RESULT/, 1e4);
          this.say("logged in as " + this.judge.username + " (" + this.judge.bracketName + ")");
        }
        // ── pick the next match from this judge's station ────────────────────────
        // Returns false when the station has nothing left to play.
        async takeNextMatch() {
          await this.answerStandbyPrompt();
          if (this.opts.streamSlot) {
            const off = await ui.findButton(this.page, "\u{1F4E1} Stream channel Off");
            if (off) {
              await this.tap("\u{1F4E1} Stream channel Off");
              await this.tap("\u{1F4E1} Channel " + this.opts.streamSlot);
              await ui.tap(this.page, "\u2715", { optional: true, timeout: 1e3 });
              this.say("stream to channel " + this.opts.streamSlot);
            }
          }
          this.fw.clashRounds = this.fw.clashRounds || {};
          if (!this.fw.clashRounds[this.fw.ev.round] && this.rnd.chance(this.opts.clashRate === void 0 ? 0.08 : this.opts.clashRate)) {
            this.fw.clashRounds[this.fw.ev.round] = true;
            if (await this.takeOtherStationsMatch()) return true;
          }
          for (let i = 0; i < 20; i++) {
            if (await this.answerStandbyPrompt()) continue;
            if (await ui.tap(this.page, "\u{1F3DF}\uFE0F Station", { optional: true, timeout: 500 })) break;
            if (i === 19) throw new Error("Could not get to the Station list");
          }
          await this.tap("\u21BB Refresh", { optional: true, timeout: 1500 });
          await ui.waitForText(this.page, /STATION [A-H] MATCHES|station/i);
          if (/Pick your station/i.test(await this.screen())) {
            this.say("pick station " + this.judge.station);
            await this.tap(this.judge.station);
            await ui.waitForText(this.page, /STATION [A-H] MATCHES/i, 5e3).catch(() => {
            });
          }
          const btns = await ui.until(this.page, async () => {
            const b = await ui.buttons(this.page);
            return b.some((x) => /^#\d+ /.test(x)) && b;
          }, 1200) || await ui.buttons(this.page);
          const done = new Set(this.matchesDone.map((m) => String(m.matchId)));
          const names = {};
          this.fw.ev.players.forEach((pl) => {
            names[pl.gid] = [pl.name, ...pl.oldNames || []].map((x) => x.trim());
          });
          const byGid = {};
          this.fw.ev.players.forEach((pl) => {
            byGid[pl.gid] = pl;
          });
          const rows = btns.filter((b) => /^#\d+ /.test(b)).map((b) => {
            const flat = b.replace(/^#\d+ /, "").replace(/\s+/g, "");
            for (const m of this.fw.ev.matches) {
              for (const a of names[m.player1_id] || []) for (const c of names[m.player2_id] || []) {
                if ((a + "vs" + c).replace(/\s+/g, "") === flat) return { label: b, m, p1: a, p2: c, pl1: byGid[m.player1_id], pl2: byGid[m.player2_id] };
              }
            }
            return { label: b };
          });
          rows.filter((r) => /^#\d+ \s*vs|vs\s*$/.test(r.label)).forEach((r) => this.fw.find("bug", this.who, "Station list shows a match with a blank player name", r.label));
          rows.filter((r) => !r.m).forEach((r) => this.fw.find("warn", this.who, "Station list shows a match the bracket does not have", r.label));
          rows.filter((r) => r.m && (r.p1 !== r.pl1.name.trim() || r.p2 !== r.pl2.name.trim())).forEach((r) => this.fw.find("warn", this.who, "Station list still shows a player's old name after it was renamed in the bracket", r.label + " (now " + r.pl1.name.trim() + " vs " + r.pl2.name.trim() + ")"));
          const row = rows.find((r) => r.m && !done.has(String(r.m.id)));
          if (!row) return false;
          this.current = { label: row.label, p1: row.p1, p2: row.p2, pl1: row.pl1, pl2: row.pl2, matchId: row.m.id, startedAt: Date.now(), prevChecked: {} };
          this.say("take " + row.label + " (match " + row.m.id + ")");
          for (let i = 0; ; i++) {
            await this.tap(row.label, { timeout: 4e3 }).catch(() => {
            });
            if (await ui.until(this.page, async () => (await ui.buttons(this.page)).includes("Build Decks \u2192"), 6e3)) break;
            if (i >= 2) {
              this.fw.find(this.fw.wifiBad ? "info" : "warn", this.who, "Tapping a match in the Station list did not open it" + (this.fw.wifiBad ? " (bad wifi)" : ""), row.label + " (3 tries)");
              return false;
            }
            this.say("match did not open, tapping again");
            await ui.tap(this.page, "\u21BB Refresh", { optional: true, timeout: 800 });
          }
          this.claim();
          await this.tap("Build Decks \u2192");
          return true;
        }
        // Note who is scoring which match, so two judges on one match can be spotted.
        claim() {
          const id = String(this.current.matchId);
          this.fw.inPlay = this.fw.inPlay || {};
          const other = this.fw.inPlay[id];
          if (other && other !== this.who) {
            this.fw.find("warn", this.who, "Two judges are scoring the same match at the same time (no warning from the app)", this.current.p1 + " vs " + this.current.p2 + ": station " + other + " already has it open" + (this.current.stolen ? " (taken from Active Matches)" : " (taken from the Station list)"));
            this.fw.clashes = (this.fw.clashes || 0) + 1;
            (this.fw.contested = this.fw.contested || {})[id] = true;
          }
          this.fw.inPlay[id] = this.who;
        }
        // Station clash test: open ⚡ Active Matches and take a match that belongs to another station,
        // preferably one another judge is already scoring. Returns false if there is nothing to take.
        async takeOtherStationsMatch() {
          const p = this.page;
          if (!await ui.tap(p, "\u26A1 Active Matches", { optional: true, timeout: 1500 })) return false;
          await ui.tap(p, "\u21BB Refresh", { optional: true, timeout: 800 });
          const rows = await ui.until(p, async () => {
            const b = (await ui.buttons(p)).filter((x) => / Select →$/.test(x));
            return b.length && b;
          }, 2e3) || [];
          const n = this.fw.idToName();
          const mine = new Set((this.fw.stationQueues()[this.judge.station] || []).map(String));
          const inPlay = this.fw.inPlay || {};
          const cands = rows.map((label) => {
            const mm = /^(.+?) vs (.+?) Round \d+ · Match #\d+ Select →$/.exec(label);
            if (!mm) return null;
            const m = this.fw.ev.matches.find((x) => x.state !== "complete" && sameName(mm[1], n[x.player1_id]) && sameName(mm[2], n[x.player2_id]));
            return m && !mine.has(String(m.id)) && inPlay[String(m.id)] !== this.who && !(this.fw.contested || {})[String(m.id)] ? { label, m, p1: mm[1], p2: mm[2] } : null;
          }).filter(Boolean);
          if (!cands.length) {
            await ui.tap(p, "\u{1F3DF}\uFE0F Station", { optional: true, timeout: 800 });
            return false;
          }
          const busy = cands.filter((c) => inPlay[String(c.m.id)]);
          const pick = busy.length ? this.rnd.pick(busy) : this.rnd.pick(cands);
          const byGid = {};
          this.fw.ev.players.forEach((pl) => {
            byGid[pl.gid] = pl;
          });
          this.current = { label: pick.label, p1: n[pick.m.player1_id].trim(), p2: n[pick.m.player2_id].trim(), pl1: byGid[pick.m.player1_id], pl2: byGid[pick.m.player2_id], matchId: pick.m.id, startedAt: Date.now(), prevChecked: {}, stolen: true };
          this.say("CLASH TEST: take another station's match from Active Matches: " + pick.label);
          await this.tap(pick.label);
          this.claim();
          await this.tap("Build Decks \u2192");
          return true;
        }
        // ── enter both players' decks ────────────────────────────────────────────
        async buildDecks() {
          const p = this.page;
          for (let guard = 0; guard < 80; guard++) {
            if (await ui.until(p, () => p.$(".ncbdb"), guard ? 0 : 1500)) return this.buildDecksV2();
            const s = await this.screen();
            if (/Deck Review/.test(s) && !/— (FIRST|SECOND|THIRD) COMBO/.test(s)) {
              if (await ui.findButton(p, "Record Deck \u2192")) {
                await this.tap("Record Deck \u2192");
                continue;
              }
              return;
            }
            if (/Select Blade/.test(s)) {
              await this.pickBlade();
              continue;
            }
            if (/^\s*Back\s*\n\s*(Undo\s*\n\s*)?Ratchet\b/m.test(s) || /\nRatchet\n/.test(s)) {
              await this.pickPart("ratchet");
              continue;
            }
            if (/\nBit\n/.test(s)) {
              await this.pickPart("bit");
              continue;
            }
            await p.waitForTimeout(ui.POLL);
          }
          throw new Error("Deck building did not finish (stuck on: " + (await this.screen()).replace(/\n+/g, " / ").slice(0, 200) + ")");
        }
        // Reads the 🕐 Previous Combos row on the blade picker: [{ text, disabled }], or null when there is none.
        async readPrevCombos() {
          return this.page.evaluate(() => {
            if (document.querySelector(".ncbdb")) {
              const row = [...document.querySelectorAll(".ncbdb .label-row")].find((x) => /^Previous (combos|blades)$/.test((x.querySelector(".label") || {}).textContent || ""));
              if (!row) return null;
              const grid2 = row.nextElementSibling;
              return grid2 ? [...grid2.querySelectorAll("button.cc, button.chip")].map((b) => ({ text: [...b.children].map((x) => x.textContent.trim()).filter(Boolean).join(" | "), disabled: !!b.disabled })) : [];
            }
            const label = [...document.querySelectorAll("p")].find((x) => /Previous Combos/.test(x.textContent));
            if (!label) return null;
            const grid = label.parentElement && label.parentElement.nextElementSibling;
            if (!grid) return [];
            return [...grid.querySelectorAll("button")].map((b) => ({ text: b.innerText.split("\n").map((x) => x.trim()).filter(Boolean).join(" | "), disabled: !!b.disabled }));
          });
        }
        // On a player's first combo, the Previous Combos row must show that player's last deck exactly
        // (or nothing at all if they have not played yet).
        async checkPrevCombos(screenText2) {
          const m = /(^|\n)([^\n]+?) — (FIRST|SECOND|THIRD) COMBO/.exec(screenText2);
          if (!m || m[3] !== "FIRST") return null;
          const who = sameName(m[2], this.current.p1) ? 1 : sameName(m[2], this.current.p2) ? 2 : 0;
          if (!who || this.current.prevChecked[who]) return null;
          this.current.prevChecked[who] = true;
          const pl = who === 1 ? this.current.pl1 : this.current.pl2;
          const name = who === 1 ? this.current.p1 : this.current.p2;
          const truth = this.fw.truthDecks[pl.id];
          const shown = await this.readPrevCombos();
          if (truth && truth.contested) return shown;
          const match2 = this.current.p1 + " vs " + this.current.p2;
          this.prevStats = this.prevStats || { checked: 0, ok: 0 };
          this.prevStats.checked++;
          if (!truth) {
            if (shown && shown.length) this.fw.find("bug", this.who, "Previous Combos shown for a player who has not played yet (someone else's deck?)", name + " in " + match2 + ": " + shown.map((x) => x.text).join(" / "));
            else this.prevStats.ok++;
            return shown;
          }
          const want = truth.combos.map(norm).sort().join(" / ");
          const got = (shown || []).map((x) => norm(x.text)).sort().join(" / ");
          if (want === got) {
            this.prevStats.ok++;
            return shown;
          }
          const renamed = this.fw.renamed && this.fw.renamed.id === pl.id;
          const shownSet = new Set((shown || []).map((x) => norm(x.text)));
          const missing = truth.combos.filter((c) => !shownSet.has(norm(c)));
          const noBit = (c) => truth.raw && truth.raw.some((r) => comboText(r) === c && r.ratchet && !r.bit);
          if (missing.length && missing.every(noBit) && got) {
            const extra = (shown || []).map((x) => x.text).filter((t) => !truth.combos.map(norm).includes(norm(t)));
            this.fw.find("bug", this.who, "Previous Combos leave out combos whose ratchet has a built-in bit (Turbo, Operate\u2026)", name + ": left out " + missing.join(" / ") + (extra.length ? "; an older combo shows instead: " + extra.join(" / ") : "") + ". The Worker's /combos/slug save keeps only combos with a bit.");
            return shown;
          }
          const otherTruths = Object.values(this.fw.truthDecks).filter((t) => t !== truth && t.combos.map(norm).sort().join(" / ") === got);
          let what = !got ? "Previous Combos missing for a player who has played before" : otherTruths.length ? "Previous Combos show another player's deck" : "Previous Combos differ from the player's last deck";
          let level = "bug";
          if (renamed && !got) {
            what = "Previous combos lost after a player was renamed in the bracket";
            level = "warn";
          }
          this.fw.find(level, this.who, what, name + " in " + match2 + " (last played round " + truth.round + ' as "' + truth.name.trim() + '"): expected ' + truth.combos.join(" / ") + "; shown " + (got ? shown.map((x) => x.text).join(" / ") : "nothing") + (otherTruths.length ? " (that is " + otherTruths.map((t) => t.name.trim()).join(", ") + "'s deck)" : ""));
          return shown;
        }
        // ── Flag 1034: the new Record decks screen, then each player checks their own deck ──
        // Reads the screen (stage, prompt), picks parts like a judge would (previous combo, quick combo,
        // typed search, CX steps, or a part button), sometimes fixes a part from a check screen, then
        // taps both "<name> confirms" buttons. The match then starts by itself (no Start Match button).
        async buildDecksV2() {
          const p = this.page;
          this.current.v2 = true;
          this.current.v2Fixed = false;
          for (let guard = 0; guard < 160; guard++) {
            if (guard) await p.waitForTimeout(340);
            const st = await p.evaluate(() => {
              const app = document.querySelector(".ncbdb");
              if (!app) return null;
              const f = app.querySelector(".field");
              return { stage: app.getAttribute("data-stage"), prompt: f && !f.hidden ? f.querySelector(".prompt").innerText.replace(/\s+/g, " ").trim() : "" };
            });
            if (!st) return;
            await this.screen();
            if (st.stage === "check") {
              if (!this.current.v2Fixed && this.rnd.chance(0.08)) {
                const cells = await p.$$(".ncbdb .ck-cell:not(:disabled)");
                if (cells.length) {
                  this.current.v2Fixed = true;
                  this.say("player asks to fix a part on the check screen");
                  await this.rnd.pick(cells).click({ timeout: 3e3 }).catch(() => {
                  });
                  continue;
                }
              }
              const ok2 = await ui.tap(p, /^Looks Good/, { optional: true, timeout: 1500 });
              if (ok2) this.say("deck confirmed by its player");
              continue;
            }
            if (st.stage === "cover") {
              await ui.tap(p, /^Show .+'s (deck|blades)$/, { optional: true, timeout: 1500 });
              continue;
            }
            if (!st.prompt) {
              await ui.tap(p, /^(Check (decks|blades) with the players|Go to .+'s (deck|blades))$/, { optional: true, timeout: 1500 });
              continue;
            }
            const m = /^(.+?) · Combo (\d): (?:pick|change) the (blade|ratchet|bit)$/.exec(st.prompt);
            if (!m) {
              await p.waitForTimeout(ui.POLL);
              continue;
            }
            if (m[3] === "blade") await this.pickBladeV2(m[1], Number(m[2]));
            else await this.pickPartV2(m[3]);
            await p.waitForTimeout(ui.POLL);
          }
          throw new Error("Deck building (new screen) did not finish (stuck on: " + (await this.screen()).replace(/\n+/g, " / ").slice(0, 200) + ")");
        }
        // Clicks one enabled element matching a selector, chosen at random. Returns its text, or null.
        async clickRandom(sel) {
          const els = await this.page.$$(sel);
          const ok2 = [];
          for (const e of els) if (await e.isEnabled().catch(() => false) && await e.isVisible().catch(() => false)) ok2.push(e);
          if (!ok2.length) return null;
          const el2 = this.rnd.pick(ok2);
          const t = (await el2.innerText().catch(() => "") || "").replace(/\s+/g, " ").trim();
          await el2.click({ timeout: 3e3 }).catch(() => {
          });
          return t;
        }
        // Marks the combo cards under one label ("Previous combos", "Quick combos") so clickRandom can find them.
        async markGrid(label) {
          return this.page.evaluate((label2) => {
            document.querySelectorAll("[data-robot-pick]").forEach((x) => x.removeAttribute("data-robot-pick"));
            const row = [...document.querySelectorAll(".ncbdb .label-row")].find((x) => ((x.querySelector(".label") || {}).textContent || "") === label2);
            const grid = row && row.nextElementSibling;
            if (!grid) return 0;
            const bs = [...grid.querySelectorAll("button.cc")];
            bs.forEach((b) => b.setAttribute("data-robot-pick", ""));
            return bs.length;
          }, label);
        }
        async pickBladeV2(name, combo) {
          const p = this.page;
          if (combo === 1) {
            const empty = await p.evaluate(() => !document.querySelector(".ncbdb .deck-row .cell:not(.empty):not(.builtin)"));
            if (empty) await this.checkPrevCombos("\n" + name + " \u2014 FIRST COMBO");
          }
          const r = this.rnd();
          const reuse = this.opts.reuseRate === void 0 ? 0.4 : this.opts.reuseRate;
          if (r < reuse) {
            if (await this.markGrid("Previous combos")) {
              const t2 = await this.clickRandom("[data-robot-pick]");
              if (t2) {
                this.say("previous combo " + t2);
                this.reusedPrev = (this.reusedPrev || 0) + 1;
                return;
              }
            }
          }
          if (r < reuse + 0.2) {
            if (await this.markGrid("Quick combos")) {
              const t2 = await this.clickRandom("[data-robot-pick]");
              if (t2) {
                this.say("quick combo " + t2);
                return;
              }
            }
          }
          if (r < reuse + 0.35) {
            const names = await p.$$eval(".ncbdb .body .chip-blade:not(:disabled) .chip-t", (xs) => xs.map((x) => x.textContent));
            if (names.length) {
              const n = this.rnd.pick(names);
              this.say("search " + n + " + Enter");
              await p.fill(".ncbdb .search input", n);
              await p.press(".ncbdb .search input", "Enter");
              await p.waitForTimeout(ui.POLL);
              await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
              return;
            }
          }
          if (r < reuse + 0.45) {
            await ui.tap(p, "CX", { optional: true, timeout: 1e3 });
            for (let i = 0; i < 6; i++) {
              const still = await p.$(".ncbdb .cx-opt");
              if (!still) break;
              const t2 = await this.clickRandom(".ncbdb .cx-opt:not(:disabled)");
              if (!t2) break;
              this.say("CX piece " + t2);
              await p.waitForTimeout(ui.POLL);
              const pr = await p.evaluate(() => {
                const f = document.querySelector(".ncbdb .field");
                return f && !f.hidden ? f.innerText : "";
              });
              if (!/pick the blade|change the blade/.test(pr)) return;
            }
            await ui.tap(p, "Standard", { optional: true, timeout: 800 });
          }
          const t = await this.clickRandom(".ncbdb .body .chip-blade:not(:disabled)");
          if (t) this.say("blade " + t);
        }
        async pickPartV2(kind) {
          const p = this.page;
          if (kind === "ratchet" && this.rnd.chance(0.3)) {
            const t2 = await this.clickRandom(".ncbdb .pinned .sug:not(:disabled)");
            if (t2) {
              this.say("one-tap finish " + t2);
              return;
            }
          }
          const t = await this.clickRandom(".ncbdb .chip-" + kind + ":not(:disabled)");
          if (!t) throw new Error("No " + kind + " to pick on the new deck screen");
          this.say(kind + " " + t);
        }
        async pickBlade() {
          const p = this.page;
          const shown = await this.checkPrevCombos(await this.screen());
          const usable = (shown || await this.readPrevCombos() || []).map((x, i) => ({ ...x, i })).filter((x) => !x.disabled);
          if (usable.length && this.rnd.chance(this.opts.reuseRate === void 0 ? 0.4 : this.opts.reuseRate)) {
            const pick = this.rnd.pick(usable);
            this.say("previous combo " + pick.text);
            const h2 = await p.evaluateHandle((i) => {
              const label = [...document.querySelectorAll("p")].find((x) => /Previous Combos/.test(x.textContent));
              return label.parentElement.nextElementSibling.querySelectorAll("button")[i];
            }, pick.i);
            await h2.asElement().click({ timeout: 3e3 });
            this.reusedPrev = (this.reusedPrev || 0) + 1;
            return;
          }
          if (this.rnd.chance(0.3)) {
            const quick = await p.$$eval("button:has(.qc-blade)", (bs) => bs.filter((b) => !b.disabled).map((b) => [...b.querySelectorAll("[data-label]")].map((x) => x.getAttribute("data-label")).join(" ")));
            if (quick.length) {
              const q = this.rnd.pick(quick);
              this.say("quick combo " + q);
              await this.tap(q);
              return;
            }
          }
          const list2 = (await ui.buttons(p)).filter(isPart);
          const blade = this.rnd.pick(list2);
          this.say("blade " + blade);
          await this.tap(blade);
        }
        async pickPart(kind) {
          const list2 = (await ui.buttons(this.page)).filter(isPart);
          if (!list2.length) throw new Error("No " + kind + " to pick");
          const part = this.rnd.pick(list2);
          this.say(kind + " " + part);
          await this.tap(part);
        }
      };
      var FINISHES = [
        { label: "Spin Finish +1", pts: 1, weight: 34 },
        { label: "Over Finish +2", pts: 2, weight: 24 },
        { label: "Burst Finish +2", pts: 2, weight: 14 },
        { label: "Xtreme Finish +3", pts: 3, weight: 16 },
        { label: "Own +2", pts: 2, weight: 3, penalty: true },
        { label: "Own +3", pts: 3, weight: 2, penalty: true },
        { label: "Launch Error LER", pts: 0, weight: 7, ler: true }
      ];
      RobotJudge.prototype.state = async function() {
        return this.page.evaluate(() => {
          try {
            return JSON.parse(sessionStorage.getItem("ncblast-match-resume-v1") || "null");
          } catch (_) {
            return null;
          }
        });
      };
      RobotJudge.prototype.pickFinish = function() {
        const total = FINISHES.reduce((a, f) => a + f.weight, 0);
        let r = this.rnd() * total;
        for (const f of FINISHES) {
          if ((r -= f.weight) < 0) return f;
        }
        return FINISHES[0];
      };
      RobotJudge.prototype.playMatch = async function() {
        const sideName = (s) => s === "p1" ? this.current.p1 : this.current.p2;
        this.battles = 0;
        this.undos = 0;
        this.history = [];
        this.expSets = [];
        if (!this.current.v2) await this.tap("Start Match \u2694\uFE0F");
        for (let guard = 0; guard < 400; guard++) {
          const p = this.page;
          const s = await this.screen();
          const btns = await ui.buttons(p);
          if (/Who Won the Die Roll\?/.test(s)) {
            const who = this.rnd.pick(["p1", "p2"]);
            this.say("die roll won by " + sideName(who));
            await this.tap(nameRe(sideName(who)));
            continue;
          }
          if (/Pick a Side/.test(s)) {
            const side2 = this.rnd.pick(["B Side", "X Side"]);
            this.say("picks " + side2);
            await this.tap(side2);
            continue;
          }
          if (await p.$(".ncbdo")) {
            await p.waitForTimeout(340);
            const st = await p.evaluate(() => {
              const a = document.querySelector(".ncbdo");
              if (!a) return null;
              const boxes = [...a.querySelectorAll(".pnl")].map((b) => ({ open: b.querySelectorAll(".bey .badge:not(.on)").length, picked: b.querySelectorAll(".bey .badge.on").length }));
              return { stage: a.getAttribute("data-stage"), fixing: a.getAttribute("data-fixing") === "1", boxes, dock: !!a.querySelector(".dock-btn:not(:disabled)") };
            });
            if (!st) continue;
            if (st.stage === "check") {
              if (!this.current.orderFixed && this.rnd.chance(0.06)) {
                this.current.orderFixed = true;
                this.say("player asks to change their order");
                await ui.tap(p, "Change order", { optional: true, timeout: 1500 });
                continue;
              }
              if (await ui.tap(p, / confirms/, { optional: true, timeout: 1500 })) this.say("order confirmed by its player");
              continue;
            }
            if (st.stage === "cover") {
              await ui.tap(p, /^Show .+'s order$/, { optional: true, timeout: 1500 });
              continue;
            }
            const boxSel = (k) => `.ncbdo .pnl >> nth=${k}`;
            if (st.fixing && st.boxes[0] && st.boxes[0].picked === 3) {
              await p.locator(boxSel(0)).locator(".bey:has(.badge.on)").first().click({ timeout: 2e3 }).catch(() => {
              });
              continue;
            }
            const k1 = st.boxes.findIndex((b) => b.picked === 1);
            if (k1 >= 0 && this.rnd.chance(0.1)) {
              this.say("takes back a 1st pick");
              await p.locator(boxSel(k1)).locator(".bey:has(.badge.on)").first().click({ timeout: 2e3 }).catch(() => {
              });
              continue;
            }
            const todo = st.boxes.map((b, k) => b.picked < 3 && b.open ? k : -1).filter((k) => k >= 0);
            if (todo.length) {
              const k = this.rnd.pick(todo);
              const els = await p.locator(boxSel(k)).locator(".bey:has(.badge:not(.on))").all();
              if (els.length) {
                await this.rnd.pick(els).click({ timeout: 2e3 }).catch(() => {
                });
                continue;
              }
            }
            if (st.dock) {
              if (this.rnd.chance(0.5)) {
                this.say("deck order set, check with players");
                await ui.tap(p, "Check With Players", { optional: true, timeout: 1500 });
              } else {
                this.say("deck order set, start battles");
                await ui.tap(p, "Looks good, start battles.", { optional: true, timeout: 1500 });
              }
              continue;
            }
            await p.waitForTimeout(ui.POLL);
            continue;
          }
          if (/Set Deck Order/.test(s)) {
            const left = btns.filter((t) => t.startsWith("\xB7 "));
            if (left.length) {
              await this.tap(this.rnd.pick(left));
              continue;
            }
            const go = btns.find((t) => /^Start/.test(t));
            if (go) {
              this.say("deck order set");
              await this.tap(go);
              continue;
            }
            await p.waitForTimeout(ui.POLL);
            continue;
          }
          if (btns.includes("Spin Finish +1")) {
            await this.battle();
            continue;
          }
          if (/CONFIRM RESULT|Judge Confirm/.test(s)) return s;
          await p.waitForTimeout(ui.POLL);
        }
        throw new Error("Match did not finish after 400 steps");
      };
      RobotJudge.prototype.battle = async function() {
        const p = this.page;
        const before = await this.state();
        if (!before) throw new Error("No saved match state during battles");
        if (!this.current.decksRecorded && Array.isArray(before.d1) && Array.isArray(before.d2)) {
          this.current.decksRecorded = true;
          [[this.current.pl1, before.d1], [this.current.pl2, before.d2]].forEach(([pl, deck]) => {
            const prev = this.fw.truthDecks[pl.id];
            const round = this.fw.ev.matches.find((x) => x.id === this.current.matchId).round;
            const contested = !!(this.fw.contested || {})[String(this.current.matchId)] || !!(prev && prev.contested && prev.round === round);
            this.fw.truthDecks[pl.id] = { name: pl.name, combos: deck.map(comboText), raw: deck, round, contested };
          });
        }
        const name = this.current.p1 + " vs " + this.current.p2;
        if (this.history.length && this.rnd.chance(this.opts.undoRate === void 0 ? 0.05 : this.opts.undoRate)) {
          const ok2 = await ui.tap(p, "UNDO", { optional: true, timeout: 800 });
          if (ok2) {
            this.undos++;
            this.say("UNDO last battle");
            const was2 = JSON.stringify(before);
            await ui.until(p, async () => JSON.stringify(await this.state()) !== was2, 1500);
            const after2 = await this.state();
            const prev = this.history.pop();
            if (after2 && prev && (after2.pts.join() !== prev.state.pts.join() || after2.sets.join() !== prev.state.sets.join() || after2.curSet !== prev.state.curSet)) {
              this.fw.find("bug", this.who, "Undo did not put the score back", name + ": before the battle " + prev.state.pts.join("-") + " (sets " + prev.state.sets.join("-") + "), after Undo " + after2.pts.join("-") + " (sets " + after2.sets.join("-") + ")");
            }
            if (prev) this.expSets.length = prev.expSetsLen;
            return;
          }
        }
        if (this.opts.openReliefDevice && !this.opts.streamSlot && !this.fw.handoffDone && this.history.length && !this.current.stolen && this.rnd.chance(this.opts.handoffRate === void 0 ? 0.03 : this.opts.handoffRate)) {
          this.fw.handoffDone = true;
          await this.handOff(before);
          return;
        }
        if (this.rnd.chance(this.opts.refreshRate === void 0 ? 0.02 : this.opts.refreshRate)) {
          this.say("REFRESH the page mid-match");
          await p.reload({ waitUntil: "domcontentloaded" });
          await this.login(null, { here: true });
          await ui.until(p, async () => (await ui.buttons(p)).includes("Spin Finish +1"), 3e3);
          const back = await this.state();
          const onPad = (await ui.buttons(p)).includes("Spin Finish +1");
          if (!back || !onPad || back.pts.join() !== before.pts.join() || back.sets.join() !== before.sets.join() || back.curSet !== before.curSet) {
            this.fw.find("bug", this.who, "Match not restored after a refresh", name + ": before " + before.pts.join("-") + " sets " + before.sets.join("-") + ", after " + (back ? back.pts.join("-") + " sets " + back.sets.join("-") : "nothing saved") + (onPad ? "" : " (not back on the score pad)"));
          }
          this.refreshes = (this.refreshes || 0) + 1;
          this.refreshedIn = this.current.p1 + " vs " + this.current.p2;
          return;
        }
        const side2 = this.rnd.chance(0.5) ? "p1" : "p2";
        const f = this.pickFinish();
        const idx = side2 === "p1" ? 0 : 1;
        const exp = before.pts.slice();
        if (f.ler) {
          if ((before.lerStrikes || [0, 0])[idx] === 1) exp[1 - idx] += 1;
        } else if (f.penalty) exp[1 - idx] += f.pts;
        else exp[idx] += f.pts;
        const cap = this.opts.setPoints || 4;
        exp[0] = Math.min(exp[0], cap);
        exp[1] = Math.min(exp[1], cap);
        this.history.push({ state: before, expSetsLen: this.expSets.length });
        this.say("battle: " + (side2 === "p1" ? this.current.p1 : this.current.p2) + " " + f.label + (f.ler ? " (launch error)" : ""));
        const was = JSON.stringify(before);
        const changed = async () => JSON.stringify(await this.state()) !== was;
        const continueOrChanged = async () => (await ui.buttons(p)).includes("Continue") || await changed();
        await ui.tapSide(p, side2, f.label);
        if (f.ler) {
          await ui.until(p, continueOrChanged, 1500);
          await ui.tap(p, "Continue", { optional: true, timeout: 0 });
        } else {
          await ui.tapSide(p, side2, /Confirm/);
          if (f.penalty) {
            await ui.until(p, continueOrChanged, 1500);
            await ui.tap(p, "Continue", { optional: true, timeout: 0 });
          }
        }
        this.battles++;
        const t0 = Date.now();
        if (await ui.until(p, changed, 2e3)) this.saveTimes.push(Date.now() - t0);
        const after = await this.state();
        this.checkScore(before, after, exp, side2, f);
        const every = this.opts.overlayEvery || 1;
        if (this.opts.overlayPage && after && after.phase === "battle" && after.curSet === before.curSet && this.rnd() < 1 / every) await this.checkOverlay(after);
      };
      RobotJudge.prototype.checkOverlay = async function(st) {
        const ov = this.opts.overlayPage;
        const forms = (n) => [n.trim().toUpperCase(), shortName(n).toUpperCase()];
        const want = st.pts[0] + "-" + st.pts[1];
        const started = Date.now();
        let seen = "";
        while (Date.now() - started < 8e3) {
          const t = await ov.evaluate(() => document.body.innerText).catch(() => "");
          const lines = t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
          const a = lines.findIndex((x) => forms(this.current.p1).includes(x)), b = lines.findIndex((x) => forms(this.current.p2).includes(x));
          if (a >= 0 && b > a) {
            const nums = lines.slice(a + 1, b).filter((x) => /^\d+$/.test(x));
            seen = nums.slice(0, 2).join("-");
            if (seen === want) {
              const ms = Date.now() - started;
              this.overlayDelays = this.overlayDelays || [];
              this.overlayDelays.push(ms);
              return;
            }
          } else seen = "names not shown";
          await this.page.waitForTimeout(ui.POLL * 2);
        }
        const name = this.current.p1 + " vs " + this.current.p2;
        this.fw.find(this.fw.wifiBad ? "warn" : "bug", this.who, "Stream overlay did not show the right score within 8 seconds" + (this.fw.wifiBad ? " (bad wifi)" : ""), name + ": judge screen " + want + ", overlay " + (seen || "nothing") + (this.refreshedIn === name ? " (the judge's page was refreshed earlier in this match)" : ""));
      };
      RobotJudge.prototype.checkScore = function(before, after, exp, side2, f) {
        const cap = this.opts.setPoints || 4;
        const name = this.current.p1 + " vs " + this.current.p2;
        const reached = exp[0] >= cap || exp[1] >= cap;
        if (reached) this.expSets.push(exp.slice());
        if (!after) return;
        const setEnded = after.sets[0] + after.sets[1] > before.sets[0] + before.sets[1] || after.curSet !== before.curSet;
        if (setEnded) {
          const w = exp[0] >= cap ? 0 : exp[1] >= cap ? 1 : -1;
          if (w < 0) this.fw.find("bug", this.who, "Set ended before anyone reached " + cap + " points", name + ": expected " + exp.join("-") + ", app moved to set " + after.curSet);
          else if (after.sets[w] !== before.sets[w] + 1) this.fw.find("bug", this.who, "Wrong player was given the set", name + ": points " + exp.join("-") + ", sets now " + after.sets.join("-"));
          const last = after.setScores && after.setScores[after.setScores.length - 1];
          if (last && (last.p1 !== exp[0] || last.p2 !== exp[1])) this.fw.find("bug", this.who, "Saved set score differs from the battles", name + ": battles add to " + exp.join("-") + ", saved " + last.p1 + "-" + last.p2);
          return;
        }
        if (reached) {
          if (after.phase === "battle" && after.curSet === before.curSet) this.fw.find("bug", this.who, "Set did not end at " + cap + " points", name + ": " + exp.join("-"));
          return;
        }
        if (after.pts[0] !== exp[0] || after.pts[1] !== exp[1]) {
          this.fw.find("bug", this.who, "Score is wrong after a battle", name + ": " + f.label + " under " + (side2 === "p1" ? this.current.p1 : this.current.p2) + " from " + before.pts.join("-") + ", expected " + exp.join("-") + ", app shows " + after.pts.join("-"));
        }
      };
      RobotJudge.prototype.finishMatch = async function() {
        const p = this.page;
        const name = this.current.p1 + " vs " + this.current.p2;
        const st = await this.state();
        const matchId = st && st.challongeMatchId;
        const ids = st ? [st.challongeP1ParticipantId, st.challongeP2ParticipantId] : [null, null];
        await this.tap("\u2696\uFE0F Judge Confirm \u2192");
        const confirms = async () => (await ui.buttons(p)).filter((b) => /TAP TO CONFIRM/.test(b)).length;
        for (let i = 0; i < 2; i++) {
          const n = await ui.until(p, confirms, 3e3);
          await this.tap(/TAP TO CONFIRM/);
          await ui.until(p, async () => await confirms() < n, 1500);
        }
        const submitsBefore = this.fw.submits.length;
        const ingestsBefore = this.fw.ingests.length;
        const confirmedAt = Date.now();
        if (!await ui.until(p, async () => (await ui.buttons(p)).includes("Submit"), 8e3)) {
          const t = (await this.screen()).replace(/\n+/g, " / ");
          const where = name + (this.current.handedOff ? " (after a handoff)" : "");
          let diag = "";
          try {
            const all = await p.evaluate(() => [...document.querySelectorAll("button")].map((b) => (b.innerText || b.getAttribute("aria-label") || b.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 40) + (b.disabled ? " [disabled]" : "")).filter((x) => x && x !== " [disabled]"));
            diag = " | All buttons (incl. disabled): " + all.join(" | ") + " | Screen: " + t.slice(0, 700);
          } catch (_) {
          }
          const late = await ui.until(p, async () => (await ui.buttons(p)).includes("Submit"), 25e3);
          if (late) {
            this.fw.find("warn", this.who, "Submit button appeared late (more than 8 seconds after both players confirmed)", name + ": after " + Math.round((Date.now() - confirmedAt) / 1e3) + " s" + diag);
            this.current.reloadTried = null;
          } else {
            if (!this.current.reloadTried) {
              this.current.reloadTried = { judge: (/JUDGE \/ ([^/]+) \//.exec(t) || [])[1] || "?", buttons: (await ui.buttons(p)).join(" | ") + diag };
              this.say("no bracket Submit button: reload, log in again, try once more");
              await this.login(this.opts.baseUrl);
              if ((await ui.buttons(this.page)).includes("\u2696\uFE0F Judge Confirm \u2192")) return this.finishMatch();
            }
            this.fw.find("bug", this.who, "No bracket Submit button at the end of the match", where + ". Judge shown: " + this.current.reloadTried.judge + "; buttons: " + this.current.reloadTried.buttons + (this.current.reloadTried ? " (still none after reloading and logging in again)" : ""));
            const cap2 = this.opts.setPoints || 4;
            const wins2 = this.expSets.reduce((a, x) => {
              if (x[0] >= cap2) a[0]++;
              else if (x[1] >= cap2) a[1]++;
              return a;
            }, [0, 0]);
            this.fw.enterByHand(this.current.matchId, this.expSets.map((x) => x[0] + "-" + x[1]).join(","), wins2[0] > wins2[1] ? 1 : 2);
            this.matchesDone.push({ name, matchId: this.current.matchId, handedOff: !!this.current.handedOff, exp: "(entered by hand)", battles: this.battles, undos: this.undos, ms: Date.now() - this.current.startedAt });
            if (this.fw.inPlay) delete this.fw.inPlay[String(this.current.matchId)];
            await this.login(this.opts.baseUrl);
            return;
          }
        }
        if (this.current.reloadTried) this.fw.find("bug", this.who, "No bracket Submit button at the end of the match until the judge reloads and logs in again", name + (this.current.handedOff ? " (after a handoff)" : "") + ". Before reloading, judge shown: " + this.current.reloadTried.judge + "; buttons: " + this.current.reloadTried.buttons);
        await this.tap("Submit", { timeout: 8e3 });
        this.say("submit " + name);
        let tries = 0;
        for (; ; ) {
          const r = await ui.until(p, async () => {
            const t = await this.screen();
            if (/✓ Submitted to (Challonge|MatchMason|WCB)/.test(t)) return "ok";
            if ((await ui.buttons(p)).some((b) => /Failed — Retry|NOT sent to (Challonge|MatchMason|WCB) — tap to retry/.test(b))) return "failed";
            return false;
          }, 2e4);
          if (r !== "failed" || tries >= 5) break;
          tries++;
          this.retries = (this.retries || 0) + 1;
          this.say("bracket send failed, Retry (" + tries + ")");
          await ui.tap(p, /Failed — Retry|NOT sent to (Challonge|MatchMason|WCB) — tap to retry/);
        }
        for (let d = 0; d < 3; d++) {
          const failed = await ui.until(p, async () => {
            const b = await ui.buttons(p);
            if (b.some((x) => /Database: failed/.test(x))) return "failed";
            return /✓ Database: sent/.test(await this.screen()) ? "ok" : false;
          }, 4e3);
          if (failed !== "failed") break;
          this.say("database send failed, tap to retry");
          await ui.tap(p, /Database: failed/, { optional: true, timeout: 500 });
        }
        await ui.until(p, async () => this.fw.submits.slice(submitsBefore).some((x) => x.who === this.who) && this.fw.ingests.slice(ingestsBefore).some((x) => x.who === this.who) && /✓ Submitted to (Challonge|MatchMason|WCB)/.test(await this.screen()), 2500);
        const s = await this.screen();
        if (!/✓ Submitted to (Challonge|MatchMason|WCB)/.test(s)) this.fw.find("bug", this.who, "Bracket submit did not show success", name + ": " + (s.match(/[^\n]*Challonge[^\n]*/g) || []).join(" / "));
        if (/Database: (failed|error)/i.test(s)) this.fw.find(this.fw.wifiBad ? "warn" : "bug", this.who, "Database send failed" + (this.fw.wifiBad ? " even after retrying (bad wifi)" : ""), name);
        if (/Sheets.*(failed|error)/i.test(s)) this.fw.find(this.fw.wifiBad ? "warn" : "bug", this.who, "Sheets send failed" + (this.fw.wifiBad ? " (bad wifi)" : ""), name);
        const cap = this.opts.setPoints || 4;
        const exp = this.expSets.map((x) => x[0] + "-" + x[1]).join(",");
        const wins = this.expSets.reduce((a, x) => {
          if (x[0] >= cap) a[0]++;
          else if (x[1] >= cap) a[1]++;
          return a;
        }, [0, 0]);
        const expWinner = wins[0] > wins[1] ? ids[0] : ids[1];
        const sub = this.fw.submits.slice(submitsBefore).filter((x) => x.who === this.who);
        if (sub.length > 1 && sub.every((x) => x.scores_csv === sub[0].scores_csv && x.winner_id === sub[0].winner_id))
          this.fw.find("info", this.who, "Result reached the bracket twice after a lost reply (same score both times, harmless)", name);
        else if (sub.length !== 1) this.fw.find("bug", this.who, sub.length ? "Bracket got the result more than once" : "Bracket never got the result", name + " (" + sub.length + " submits)");
        const last = sub[sub.length - 1];
        if (last) {
          if (String(last.matchId) !== String(matchId)) this.fw.find("bug", this.who, "Result went to the wrong bracket match", name + ": sent to " + last.matchId + ", playing " + matchId);
          if (last.scores_csv !== exp) this.fw.find("bug", this.who, "Bracket score differs from the battles played", name + ": battles say " + exp + ", bracket got " + last.scores_csv);
          if (String(last.winner_id) !== String(expWinner)) this.fw.find("bug", this.who, "Bracket winner differs from the battles played", name + ": expected id " + expWinner + ", got " + last.winner_id);
        }
        const ing = this.fw.ingests.slice(ingestsBefore).filter((x) => x.who === this.who);
        if (!ing.length) this.fw.find("warn", this.who, "Database never got the battles", name);
        if (ing.length) {
          const rows = ing[ing.length - 1].rows;
          const judges = [...new Set(rows.map((r) => String(Array.isArray(r) ? r[1] : r.Judge)))];
          this.judgeNames = this.judgeNames || [];
          judges.forEach((j) => {
            if (!this.judgeNames.includes(j)) this.judgeNames.push(j);
          });
          if (this.current.handedOff) this.judgeNames = [];
          else if (this.judgeNames.length > 1) this.fw.find("bug", this.who, "Judge name in the saved battles changed between matches", "logged in as " + this.judge.username + ' / picked "' + this.judge.bracketName + '"; rows used: ' + this.judgeNames.map((j) => '"' + j + '"').join(", ") + " (now on " + name + ")");
          const counted = this.battles - this.undos * 1;
          const nonStrike = rows.filter((r) => !/strike/i.test(String(Array.isArray(r) ? r[13] : r.FinishType)));
          void nonStrike;
          if (rows.length !== counted) this.fw.find("warn", this.who, "Database row count differs from battles played", name + ": " + rows.length + " rows, " + counted + " battles (" + this.undos + " undone)");
          const bySet = {};
          rows.forEach((r) => {
            const a = Array.isArray(r) ? r : null;
            if (a) bySet[a[8]] = a;
          });
          Object.keys(bySet).sort().forEach((k, i) => {
            const a = bySet[k], e = this.expSets[i];
            if (e && (Number(a[16]) !== e[0] || Number(a[17]) !== e[1])) this.fw.find("bug", this.who, "Database set score differs from the battles", name + " set " + k + ": rows end at " + a[16] + "-" + a[17] + ", battles say " + e.join("-"));
          });
        }
        try {
          const mb = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0);
          if (mb) this.heap.push(Math.round(mb));
        } catch (_) {
        }
        this.matchesDone.push({ name, matchId: this.current.matchId, handedOff: !!this.current.handedOff, retries: tries, exp, battles: this.battles, undos: this.undos, ms: Date.now() - this.current.startedAt });
        let viaPopup = false;
        const dlg = '[role="dialog"][aria-label="Next Action?"]';
        if (await ui.until(p, () => p.$(dlg), 1500)) {
          const btn = (t) => p.locator(dlg + " button", { hasText: t }).first();
          const canFinish = await btn("Finished this round.").count();
          const r = this.rnd();
          if (canFinish && r < 0.2) {
            this.say("Next Action: Finished this round.");
            await btn("Finished this round.").click({ timeout: 3e3 });
            const slot = this.opts.streamSlot;
            const ok2 = await ui.until(p, async () => !!(this.fw.overlay[slot] && this.fw.overlay[slot].standby), 5e3);
            if (!ok2) this.fw.find("bug", this.who, "Finished this round. did not put the stream channel into the between-round slides", name + " (channel " + slot + ")");
          } else if (r < 0.35) {
            this.say("Next Action: Stay Here");
            await btn("Stay Here").click({ timeout: 3e3 });
          } else {
            this.say("Next Action: New Match");
            await ui.until(p, async () => await btn("New Match").isEnabled(), 8e3);
            await btn("New Match").click({ timeout: 3e3 });
            viaPopup = true;
          }
          if (!viaPopup && await ui.until(p, () => p.$(dlg), 300)) this.fw.find("bug", this.who, "Next Action popup did not close", name);
        } else {
          this.fw.find("bug", this.who, "Next Action popup did not open after Submit", name);
        }
        if (!viaPopup) await this.tap(/^New Match/);
        const listOrPrompt = async () => {
          const b = await ui.buttons(p);
          return (b.includes("Yes, no more matches here") || b.some((x) => /^#\d+ /.test(x))) && b;
        };
        await ui.until(p, listOrPrompt, 1500);
        if (await this.answerStandbyPrompt()) await ui.until(p, async () => (await ui.buttons(p)).some((x) => /^#\d+ /.test(x)), 1500);
        const btns = await ui.buttons(p);
        const stale = btns.find((b) => /^#\d+ /.test(b) && b.replace(/\s+/g, "").includes((this.current.p1 + "vs" + this.current.p2).replace(/\s+/g, "")));
        if (stale) this.fw.find("warn", this.who, "Station list still offers the match that was just submitted (until Refresh)", name);
        if (this.fw.inPlay && this.fw.inPlay[String(this.current.matchId)] === this.who) delete this.fw.inPlay[String(this.current.matchId)];
        if (stale && this.rnd.chance(this.opts.reopenRate === void 0 ? 0.25 : this.opts.reopenRate)) {
          this.say("CLASH TEST: tap the finished match again");
          await this.tap(stale);
          const s2 = await ui.until(p, async () => {
            const t = await this.screen();
            return /Build Decks|Deck Review|Start Match|already|complete|submitted/i.test(t) && t;
          }, 3e3) || await this.screen();
          if ((await ui.buttons(p)).includes("Build Decks \u2192")) {
            this.fw.find("warn", this.who, "A match that was already submitted can be opened again from the Station list", name + ": the app goes to Build Decks with no warning");
          } else {
            this.reopenBlocked = (this.reopenBlocked || 0) + 1;
            this.say("app stopped it: " + s2.replace(/\n+/g, " / ").slice(0, 120));
          }
          for (let i = 0; i < 6 && !(await ui.buttons(p)).includes("\u{1F3DF}\uFE0F Station"); i++) {
            await ui.tap(p, "Back", { optional: true, timeout: 1e3 });
            await ui.tap(p, /^(Yes|Leave|Discard|OK)/, { optional: true, timeout: 300 });
          }
          if (!(await ui.buttons(p)).includes("\u{1F3DF}\uFE0F Station")) throw new Error("Could not get back to the match list after reopening a finished match");
        }
      };
      var HANDOFF_FIELDS = {
        pts: "points",
        sets: "sets won",
        curSet: "current set",
        setScores: "earlier set scores",
        d1: "player 1's deck",
        d2: "player 2's deck",
        r1: "which combo player 1 has in play",
        r2: "which combo player 2 has in play",
        used1: "player 1's used combos",
        used2: "player 2's used combos",
        currentSides: "B/X sides",
        sideAssign: "B/X side choice",
        lerStrikes: "launch-error strikes",
        set1PriorityName: "Set 1 pick priority (~P~ tag)",
        challongeRound: "round number",
        challongeMatchId: "bracket match",
        shuf: "shuffle number"
      };
      RobotJudge.prototype.handOff = async function(before) {
        const p = this.page;
        const name = this.current.p1 + " vs " + this.current.p2;
        const known = new Set(Object.keys(this.fw.handoffs));
        this.say("HANDOFF: hand the match to a relief judge");
        await p.click('button[title="Settings"]', { timeout: 3e3 });
        await ui.tap(p, /Hand off match/);
        await ui.tap(p, /new device|another device|other phone/i, { optional: true, timeout: 600 });
        const token = await ui.until(p, async () => Object.keys(this.fw.handoffs).find((k) => !known.has(k)), 6e3);
        if (!token) {
          this.fw.find(this.fw.wifiBad ? "info" : "bug", this.who, "Handoff could not be started" + (this.fw.wifiBad ? " (bad wifi)" : ""), name);
          await ui.tap(p, /^(Cancel|✕|Close)$/, { optional: true, timeout: 800 });
          this.fw.handoffDone = false;
          return;
        }
        const old = { dev: this.dev, page: this.page };
        const relief = await this.opts.openReliefDevice(this.who);
        this.allDevs.push(relief);
        this.dev = relief;
        this.page = relief.page;
        this.judge = { ...this.judge, username: this.judge.username + "b", bracketName: this.judge.bracketName + " (relief)" };
        await this.page.goto(this.opts.baseUrl + "/?handoff=" + token, { waitUntil: "domcontentloaded" });
        await this.login(null, { here: true });
        const card = await ui.until(this.page, async () => (await ui.buttons(this.page)).includes("\u2713 Accept Match") && await this.screen(), 8e3);
        if (!card) throw new Error("The handoff link did not show the Accept card on the second phone");
        if (/Not logged in — battles won't have a judge name/.test(card))
          this.fw.find("warn", this.who, "Handoff card says the receiving judge is not logged in, though they are", "relief judge logged in as " + this.judge.username + ' ("' + this.judge.bracketName + '")');
        await this.tap("\u2713 Accept Match");
        const after = await ui.until(this.page, async () => {
          const st = await this.state();
          return st && String(st.challongeMatchId) === String(before.challongeMatchId) && st;
        }, 6e3);
        if (!after) throw new Error("Accepting the handoff did not load the match on the second phone");
        const lost = Object.keys(HANDOFF_FIELDS).filter((k) => JSON.stringify(before[k] === void 0 ? null : before[k]) !== JSON.stringify(after[k] === void 0 ? null : after[k]));
        if (lost.length) this.fw.find("bug", this.who, "Handoff to another phone drops part of the match", name + ": lost or changed " + lost.map((k) => HANDOFF_FIELDS[k] + " (" + JSON.stringify(before[k]) + " \u2192 " + JSON.stringify(after[k]) + ")").join("; "));
        const cleared = await ui.until(old.page, async () => !await old.page.evaluate(() => sessionStorage.getItem("ncblast-match-resume-v1")), 8e3);
        if (!cleared) this.fw.find("warn", this.who, "The first phone still holds the match after handing it off", name);
        this.current.handedOff = true;
        this.handoffs = (this.handoffs || 0) + 1;
        const usable = async () => (await ui.buttons(this.page)).includes("Spin Finish +1") || /Set Deck Order/.test(await this.screen()) || !!await this.page.$(".ncbdo");
        if (!await ui.until(this.page, usable, 3e3)) {
          this.fw.find("bug", this.who, "After a handoff the score pad cannot be used (finish buttons greyed out)", name + ": the relief judge has to Undo back to the deck order to continue, losing this set's battles");
          for (let i = 0; i < 15 && !await usable(); i++) {
            if (!await ui.tap(this.page, "UNDO", { optional: true, timeout: 1e3 })) break;
            const prev = this.history.pop();
            if (prev) this.expSets.length = prev.expSetsLen;
            this.undos++;
            await this.page.waitForTimeout(300);
          }
          if (!await usable()) throw new Error("Could not recover the match after the handoff");
        }
        this.say("HANDOFF done, continuing on the relief phone");
      };
      RobotJudge.prototype.answerStandbyPrompt = async function() {
        const btns = await ui.buttons(this.page);
        if (!btns.includes("Yes, no more matches here")) return false;
        const yes = this.rnd.chance(0.3);
        this.say("stream standby prompt: " + (yes ? "yes, no more matches" : "no, more are coming"));
        await this.tap(yes ? "Yes, no more matches here" : "No, more are coming");
        await ui.until(this.page, async () => !(await ui.buttons(this.page)).includes("Yes, no more matches here"), 1500);
        return true;
      };
      RobotJudge.prototype.run = async function(baseUrl, isEventOver) {
        await this.login(baseUrl);
        let idle = 0;
        while (!this.stopped) {
          const got = await this.takeNextMatch();
          if (!got) {
            if (isEventOver()) break;
            if (this.fw.stuck) {
              this.say("stopping: another station is stuck");
              break;
            }
            idle++;
            const lastSubmit = this.fw.submits.length ? this.fw.submits[this.fw.submits.length - 1].at : this.fw.startedAt;
            const limit = this.opts.maxWaitMs || 12e4;
            if (Date.now() - lastSubmit > limit) throw new Error("Waited " + Math.round(limit / 6e4) + " minutes for a match (another station may be stuck)");
            await this.page.waitForTimeout(1e3);
            continue;
          }
          idle = 0;
          await this.buildDecks();
          await this.playMatch();
          await this.finishMatch();
        }
        this.say("done: " + this.matchesDone.length + " matches");
      };
      module2.exports = { RobotJudge, makeRandom };
    }
  });

  // sim/web/stubs/path.cjs
  var require_path = __commonJS({
    "sim/web/stubs/path.cjs"(exports2, module2) {
      var join = (...a) => a.filter(Boolean).join("/").replace(/\/+/g, "/");
      module2.exports = { join, sep: "/", basename: (p) => String(p).split("/").pop(), relative: (a, b) => String(b).replace(String(a) + "/", ""), dirname: (p) => String(p).split("/").slice(0, -1).join("/") };
    }
  });

  // sim/report.cjs
  var require_report = __commonJS({
    "sim/report.cjs"(exports2, module2) {
      var fs = require_fs();
      var path = require_path();
      var esc = (s) => String(s === void 0 || s === null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      var STYLE = `<style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1d1d1b;--mute:#6b6b66;--line:#e4e3de;--bug:#c2410c;--warn:#a16207;--info:#475569;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecebe6;--mute:#9a9992;--line:#2e2e2b;--bug:#fb923c;--warn:#facc15;--info:#94a3b8;--ok:#4ade80}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}
.sub{color:var(--mute);margin:0 0 18px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}.tile b{display:block;font-size:24px}.tile span{color:var(--mute);font-size:13px}
.f{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 10px;padding:12px 14px}
.f summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:baseline}.f summary::-webkit-details-marker{display:none}
.tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:99px;border:1px solid currentColor;flex:none}
.bug{color:var(--bug)}.warn{color:var(--warn)}.info{color:var(--info)}.n{color:var(--mute);margin-left:auto;flex:none}
.f ul{margin:10px 0 0;padding-left:18px;color:var(--mute);font-size:13px;word-break:break-word}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line)}th{color:var(--mute);font-weight:600}
.stuck{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--bug);border-radius:10px;padding:12px 14px;margin-bottom:10px}
.stuck img{max-width:240px;border:1px solid var(--line);border-radius:6px;margin-top:8px}code{font-size:12px}
.ok{color:var(--ok);font-weight:600}.wrap{overflow-x:auto}
</style>`;
      function group(findings) {
        const g = /* @__PURE__ */ new Map();
        findings.forEach((f) => {
          const k = f.level + "|" + f.what;
          if (!g.has(k)) g.set(k, { level: f.level, what: f.what, items: [] });
          g.get(k).items.push(f);
        });
        const order = { bug: 0, warn: 1, info: 2 };
        return [...g.values()].sort((a, b) => order[a.level] - order[b.level] || b.items.length - a.items.length);
      }
      function writeReport(dir, r) {
        fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(r, null, 2));
        const groups = group(r.findings);
        const count = (l) => groups.filter((g) => g.level === l).length;
        const times = (l) => r.findings.filter((f) => f.level === l).length;
        const label = { bug: "Bug", warn: "Check", info: "Note" };
        const matches = r.robots.flatMap((x) => x.matches.map((m) => ({ ...m, who: x.who })));
        const delays = r.robots.flatMap((x) => x.overlayDelays || []);
        const refreshes = r.robots.reduce((a, x) => a + (x.refreshes || 0), 0);
        const avg = matches.length ? Math.round(matches.reduce((a, m) => a + m.ms, 0) / matches.length / 1e3) : 0;
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BLAST Sim Report</title>
${STYLE}</head><body><main>
<h1>BLAST simulator report</h1>
<p class="sub">${esc(r.event.name)} \xB7 ${r.event.players} players \xB7 ${r.robots.length} robot judges \xB7 seed ${r.options.seed} \xB7 ${esc(r.site || "")} \xB7 ${esc(r.startedAt.replace("T", " ").slice(0, 19))} UTC \xB7 ${r.seconds}s</p>
<div class="tiles">
<div class="tile"><b>${r.event.complete}/${r.event.matches}</b><span>matches played</span></div>
<div class="tile"><b>${r.event.rounds}</b><span>Swiss rounds</span></div>
<div class="tile"><b class="${count("bug") ? "bug" : "ok"}">${count("bug")}</b><span>bugs (seen ${times("bug")}\xD7)</span></div>
<div class="tile"><b class="${count("warn") ? "warn" : "ok"}">${count("warn")}</b><span>checks to look at (seen ${times("warn")}\xD7)</span></div>
<div class="tile"><b>${avg}s</b><span>avg robot match</span></div>
<div class="tile"><b>${refreshes}</b><span>mid-match refreshes</span></div>
<div class="tile"><b>${delays.length ? (delays.reduce((a, b) => a + b, 0) / delays.length / 1e3).toFixed(1) + "s" : "\u2013"}</b><span>overlay catch-up (${delays.length} checks)</span></div>
<div class="tile"><b>${r.requests}</b><span>requests answered</span></div>
</div>
${r.failures.length ? `<h2>Robots that got stuck</h2>` + r.failures.map((f) => `<div class="stuck"><b>Station ${esc(f.who)}</b>: ${esc(f.error)}<br><span class="sub">Screen: ${esc(f.screen)}</span><br><span class="sub">Last steps: ${esc(f.lastSteps.join(" \u2192 "))}</span><br><img src="${esc(f.shot)}" alt="screen when stuck"></div>`).join("") : ""}
<h2>Findings</h2>
${groups.length ? groups.map((g) => `<details class="f"${g.level === "bug" ? " open" : ""}><summary><span class="tag ${g.level}">${label[g.level]}</span><span>${esc(g.what)}</span><span class="n">${g.items.length}\xD7</span></summary><ul>${g.items.slice(0, 12).map((i) => `<li>Station ${esc(i.who)}: ${esc(i.detail)}</li>`).join("")}${g.items.length > 12 ? `<li>\u2026and ${g.items.length - 12} more (see report.json)</li>` : ""}</ul></details>`).join("") : `<p class="ok">Nothing found.</p>`}
${r.overlayShot ? `<h2>Stream overlay (channel 1, station A) at the end</h2><img src="${esc(r.overlayShot)}" alt="overlay" style="max-width:100%;border:1px solid var(--line);border-radius:8px;background:#000">` : ""}
<h2>Matches</h2>
<div class="wrap"><table><tr><th>Station</th><th>Match</th><th>Sets</th><th>Battles</th><th>Undos</th><th>Time</th></tr>
${matches.map((m) => `<tr><td>${esc(m.who)}</td><td>${esc(m.name)}</td><td>${esc(m.exp)}</td><td>${m.battles}</td><td>${m.undos}</td><td>${Math.round(m.ms / 1e3)}s</td></tr>`).join("")}
</table></div>
<p class="sub" style="margin-top:20px">Bug = something the robots proved wrong. Check = worth a look, may be fine. Note = information. Re-run the same choices with <code>node sim/run.cjs --seed ${r.options.seed} --rounds ${r.options.rounds}</code>.</p>
</main></body></html>`;
        const file = path.join(dir, "report.html");
        fs.writeFileSync(file, html);
        return file;
      }
      function writeSweep(dir, sw) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "sweep.json"), JSON.stringify(sw, null, 2));
        const runs = sw.runs.slice().sort((a, b) => a.n - b.n);
        const all = runs.flatMap((r) => r.findings.map((f) => ({ ...f, run: r })));
        const groups = group(all).map((g) => {
          const inRuns = [...new Map(g.items.map((i) => [i.run.n, i.run])).values()].sort((a, b) => a.n - b.n);
          return { ...g, inRuns };
        });
        const label = { bug: "Bug", warn: "Check", info: "Note" };
        const sum = (k) => runs.reduce((a, r) => a + (r[k] || 0), 0);
        const kinds = (l) => groups.filter((g) => g.level === l).length;
        const rerun = (r) => `node run.cjs --seed ${r.seed}${sw.options.mix ? " --mix" : ` --rounds ${r.rounds} --players ${r.players} --judges ${r.judges}`}`;
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BLAST Sim Sweep</title>
${STYLE}
<style>.rare{font-size:12px;color:var(--mute)}td a{color:inherit}</style>
</head><body><main>
<h1>BLAST simulator sweep</h1>
<p class="sub">${runs.length} event(s)${sw.options.mix ? " of mixed sizes" : ""} \xB7 ${esc(sw.site)} \xB7 started ${esc(sw.startedAt.replace("T", " ").slice(0, 19))} UTC \xB7 ${Math.round(sw.seconds / 60)} min so far</p>
<div class="tiles">
<div class="tile"><b>${runs.length}</b><span>events</span></div>
<div class="tile"><b>${sum("complete")}</b><span>matches played</span></div>
<div class="tile"><b>${sum("battles")}</b><span>battles scored</span></div>
<div class="tile"><b>${sum("undos")} / ${sum("refreshes")}</b><span>undos / refreshes</span></div>
<div class="tile"><b class="${kinds("bug") ? "bug" : "ok"}">${kinds("bug")}</b><span>kinds of bug</span></div>
<div class="tile"><b class="${kinds("warn") ? "warn" : "ok"}">${kinds("warn")}</b><span>kinds of check</span></div>
</div>
<h2>Findings across all events</h2>
<p class="sub">Sorted by kind, then by how often. A finding seen in only a few events is the interesting kind: it depends on what the robots happened to do. Re-run that exact event with the command shown.</p>
${groups.length ? groups.map((g) => {
          const few = g.inRuns.length < runs.length;
          return `<details class="f"${g.level === "bug" ? " open" : ""}><summary><span class="tag ${g.level}">${label[g.level]}</span><span>${esc(g.what)}</span><span class="n">${g.inRuns.length} of ${runs.length} events</span></summary>
<ul>${g.items.slice(0, 6).map((i) => `<li>Event ${i.run.n} (seed ${i.run.seed}), station ${esc(i.who)}: ${esc(i.detail)}</li>`).join("")}${g.items.length > 6 ? `<li>\u2026${g.items.length - 6} more</li>` : ""}</ul>
${few ? `<p class="rare">First seen in event ${g.inRuns[0].n}. Repeat it: <code>${esc(rerun(g.inRuns[0]))}</code></p>` : ""}</details>`;
        }).join("") : `<p class="ok">Nothing found.</p>`}
<h2>Events</h2>
<div class="wrap"><table><tr><th>#</th><th>Seed</th><th>Size</th><th>Matches</th><th>Battles</th><th>Time</th><th>Bugs</th><th>Checks</th><th>Stuck</th><th></th></tr>
${runs.map((r) => `<tr><td>${r.n}</td><td>${r.seed}</td><td>${r.players}p \xB7 ${r.judges}j \xB7 ${r.rounds}r</td><td>${r.complete}/${r.matches}</td><td>${r.battles}</td><td>${r.seconds}s</td>
<td class="${r.findings.some((f) => f.level === "bug") ? "bug" : ""}">${new Set(r.findings.filter((f) => f.level === "bug").map((f) => f.what)).size}</td>
<td>${new Set(r.findings.filter((f) => f.level === "warn").map((f) => f.what)).size}</td><td class="${r.stuck ? "bug" : ""}">${r.stuck || ""}</td>
<td>${r.report ? `<a href="${esc(r.report)}">report</a>` : ""}</td></tr>`).join("")}
</table></div>
</main></body></html>`;
        fs.writeFileSync(path.join(dir, "sweep.html"), html);
        return path.join(dir, "sweep.html");
      }
      module2.exports = { writeReport, writeSweep };
    }
  });

  // sim/mm.cjs
  var require_mm = __commonJS({
    "sim/mm.cjs"(exports2, module2) {
      var { STATIONS } = require_fake_event();
      var REAL_WORKER = "https://challonge-proxy.danny61734.workers.dev";
      function parseMmId(raw) {
        const t = String(raw || "").trim();
        const m = /matchmason\.com\/t\/([A-Za-z0-9_-]+)/.exec(t);
        const id = m ? m[1] : t.replace(/^mm-/, "");
        return /^[A-Za-z0-9_-]{4,80}$/.test(id) ? id : null;
      }
      async function getJson(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const text = await res.text();
        let body = null;
        try {
          body = JSON.parse(text);
        } catch (_) {
        }
        return { ok: res.ok, status: res.status, body, text: text.slice(0, 300) };
      }
      function isBracketCall(url, slug) {
        const u = new URL(url);
        if (!/^challonge-proxy\./.test(u.hostname)) return false;
        if (u.pathname.startsWith("/mm/")) return true;
        return ["/", "/pairings", "/standings", "/matches"].includes(u.pathname) && u.searchParams.get("slug") === slug;
      }
      async function loadMmEvent(base, id, judgesWanted) {
        const slug = "mm-" + id;
        const parts = await getJson(`${base}/?slug=${encodeURIComponent(slug)}`);
        if (!parts.ok || !parts.body) throw new Error(`The Worker could not load the MatchMason players (HTTP ${parts.status}): ${parts.body && parts.body.error || parts.text}`);
        const raw = Array.isArray(parts.body.participants) ? parts.body.participants : [];
        const players = raw.map((x) => x.participant || x).filter((p) => p && p.id).map((p, i) => ({
          id: p.id,
          gid: p.id,
          name: String(p.display_name || p.name || p.username || "Player " + (i + 1)),
          seed: p.seed || i + 1
        }));
        if (players.length < 2) throw new Error("The MatchMason event has fewer than 2 players.");
        const open = await getJson(`${base}/mm/open-matches?slug=${encodeURIComponent(slug)}`);
        if (open.status === 404) throw new Error("The live Worker has no /mm/open-matches route yet. Deploy the MatchMason Worker update (the /mm routes and the MM_API_KEY secret) first.");
        if (!open.ok || !open.body) throw new Error(`The Worker could not load MatchMason's open matches (HTTP ${open.status}): ${open.body && open.body.error || open.text}`);
        const list2 = await getJson(`${base}/list`);
        const meta = list2.ok && list2.body && Array.isArray(list2.body.tournaments) ? list2.body.tournaments.find((t) => t.slug === slug) : null;
        const ev = {
          slug,
          name: meta && meta.name || "MatchMason " + id.slice(0, 8),
          ranked: meta ? meta.ranked !== false : true,
          loginMode: "solo",
          players,
          judges: [],
          matches: [],
          round: 0,
          real: "mm",
          nextMatchId: 0
        };
        syncOpen(ev, open.body.matches || []);
        const firstRound = ev.matches.filter((m) => m.round === ev.round).length;
        const n = Math.max(1, Math.min(judgesWanted || 8, STATIONS.length, firstRound || 1));
        ev.judges = STATIONS.slice(0, n).map((st, i) => ({ username: "simjudge" + (i + 1), bracketName: "Sim Judge " + (i + 1), station: st }));
        return ev;
      }
      function syncOpen(ev, openList) {
        let added = 0;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        openList.forEach((o) => {
          if (!o || o.id == null || !o.player1_id || !o.player2_id) return;
          if (ev.matches.some((m) => String(m.id) === String(o.id))) return;
          ev.matches.push({
            id: o.id,
            round: Number(o.round) || 1,
            state: "open",
            underway_at: null,
            player1_id: o.player1_id,
            player2_id: o.player2_id,
            winner_id: null,
            loser_id: null,
            scores_csv: "",
            created_at: now,
            updated_at: now,
            suggested_play_order: ev.matches.length + 1
          });
          added++;
        });
        const openIds = new Set(openList.map((o) => String(o.id)));
        ev.matches.forEach((m) => {
          m.stillOpenOnMm = openIds.has(String(m.id));
        });
        const waiting = ev.matches.filter((m) => m.state !== "complete");
        ev.round = waiting.length ? Math.min(...waiting.map((m) => m.round)) : Math.max(0, ...ev.matches.map((m) => m.round));
        return added;
      }
      module2.exports = { REAL_WORKER, parseMmId, loadMmEvent, syncOpen, isBracketCall, getJson };
    }
  });

  // sim/web/webplay.cjs
  var require_webplay = __commonJS({
    "sim/web/webplay.cjs"(exports2, module2) {
      var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      function frameShim(id) {
        const sim = window.parent.__sim;
        const dev = sim.devs[id];
        const mkStorage = (map) => new Proxy({}, {
          get(_, p) {
            if (p === "getItem") return (k) => map.has(String(k)) ? map.get(String(k)) : null;
            if (p === "setItem") return (k, v) => {
              map.set(String(k), String(v));
            };
            if (p === "removeItem") return (k) => {
              map.delete(String(k));
            };
            if (p === "clear") return () => map.clear();
            if (p === "key") return (i) => [...map.keys()][i] ?? null;
            if (p === "length") return map.size;
            if (typeof p === "symbol") return void 0;
            return map.has(p) ? map.get(p) : void 0;
          },
          set(_, p, v) {
            map.set(String(p), String(v));
            return true;
          },
          deleteProperty(_, p) {
            map.delete(String(p));
            return true;
          },
          has(_, p) {
            return map.has(String(p));
          },
          ownKeys() {
            return [...map.keys()];
          },
          getOwnPropertyDescriptor(_, p) {
            return map.has(String(p)) ? { value: map.get(String(p)), enumerable: true, configurable: true, writable: true } : void 0;
          }
        });
        const L = mkStorage(sim.stores[id].local), S = mkStorage(sim.stores[id].session);
        Object.defineProperty(window, "localStorage", { configurable: true, get: () => L });
        Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => S });
        window.fetch = async function(input, init) {
          const isReq = typeof Request !== "undefined" && input instanceof Request;
          const url = new URL(isReq ? input.url : String(input), location.href).href;
          const method = String(init && init.method || isReq && input.method || "GET").toUpperCase();
          let body = null;
          if (init && init.body != null) body = typeof init.body === "string" ? init.body : await new Response(init.body).text();
          else if (isReq && method !== "GET" && method !== "HEAD") body = await input.clone().text();
          const headers = {};
          const addH = (h2) => {
            if (!h2) return;
            new Headers(h2).forEach((v, k) => {
              headers[k] = v;
            });
          };
          if (isReq) addH(input.headers);
          if (init) addH(init.headers);
          return sim.route(id, { method, url, body, headers });
        };
        if (navigator.sendBeacon) navigator.sendBeacon = function(url, data) {
          new Response(data).text().then((t) => sim.route(id, { method: "POST", url: new URL(url, location.href).href, body: t, headers: { "content-type": "text/plain" } })).catch(() => {
          });
          return true;
        };
        window.addEventListener("error", (e) => dev.errors.push(String(e.message || e.error || e).slice(0, 400)));
        window.addEventListener("unhandledrejection", (e) => dev.errors.push(String(e.reason && e.reason.message || e.reason || "unhandled rejection").slice(0, 400)));
        const ce = console.error.bind(console);
        console.error = function(...a) {
          try {
            dev.consoleErrors.push(a.map((x) => x && x.message || String(x)).join(" ").slice(0, 400));
          } catch (_) {
          }
          return ce(...a);
        };
        window.alert = (m) => {
          dev.lastDialog = String(m);
        };
        window.confirm = (m) => {
          dev.lastDialog = String(m);
          return true;
        };
        window.prompt = (m, d) => {
          dev.lastDialog = String(m);
          return d || "";
        };
        if (window.navigation) {
          window.navigation.addEventListener("navigate", (e) => {
            if (e.destination && e.destination.sameDocument) return;
            if (e.cancelable) {
              e.preventDefault();
              sim.navigate(id, e.destination.url);
            }
          });
        } else {
          dev.errors.push("This browser has no Navigation API (use Chrome): a self-reload could not be kept inside the simulator.");
        }
      }
      function isVisible(el2) {
        const win = el2.ownerDocument.defaultView;
        if (!el2.isConnected) return false;
        const r = el2.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        return win.getComputedStyle(el2).visibility !== "hidden";
      }
      function isEnabled(el2) {
        return !el2.disabled && !el2.closest("fieldset[disabled]") && el2.getAttribute("aria-disabled") !== "true";
      }
      function queryAll(roots, sel) {
        const m = /^(.*?)\s*>>\s*nth=(\d+)\s*$/.exec(sel);
        const css = m ? m[1] : sel;
        let found = [];
        roots.forEach((r) => found.push(...r.querySelectorAll(css)));
        found = [...new Set(found)];
        return m ? found.slice(+m[2], +m[2] + 1) : found;
      }
      var ElementHandle = class {
        constructor(el2) {
          this.el = el2;
        }
        asElement() {
          return this;
        }
        async isVisible() {
          return isVisible(this.el);
        }
        async isEnabled() {
          return isEnabled(this.el);
        }
        async innerText() {
          return this.el.innerText;
        }
        async getAttribute(n) {
          return this.el.getAttribute(n);
        }
        async scrollIntoViewIfNeeded() {
          const r = this.el.getBoundingClientRect(), win = this.el.ownerDocument.defaultView;
          if (r.top < 0 || r.bottom > win.innerHeight || r.left < 0 || r.right > win.innerWidth) this.el.scrollIntoView({ block: "center", inline: "center" });
        }
        async click(opts2 = {}) {
          const el2 = this.el, doc = el2.ownerDocument, win = doc.defaultView;
          const end2 = Date.now() + (opts2.timeout === void 0 ? 3e4 : opts2.timeout);
          let why = "";
          for (; ; ) {
            if (!el2.isConnected) throw new Error("click: element is no longer on the page");
            if (opts2.force || isVisible(el2) && isEnabled(el2)) {
              await this.scrollIntoViewIfNeeded();
              const r = el2.getBoundingClientRect();
              const x = r.left + r.width / 2, y = r.top + r.height / 2;
              const top = doc.elementFromPoint(x, y);
              if (opts2.force || top && (top === el2 || el2.contains(top) || top.contains(el2))) {
                const m = (type, C = win.MouseEvent) => new C(type, { bubbles: true, cancelable: true, composed: true, view: win, clientX: x, clientY: y, button: 0, buttons: type.endsWith("down") ? 1 : 0, pointerType: "mouse", isPrimary: true, detail: type === "click" ? 1 : 0 });
                const P = win.PointerEvent || win.MouseEvent;
                const t = top || el2;
                t.dispatchEvent(m("pointerover", P));
                t.dispatchEvent(m("mouseover"));
                t.dispatchEvent(m("pointermove", P));
                t.dispatchEvent(m("mousemove"));
                t.dispatchEvent(m("pointerdown", P));
                t.dispatchEvent(m("mousedown"));
                try {
                  (el2.matches("input,textarea,select,button,[tabindex],a[href]") ? el2 : t).focus();
                } catch (_) {
                }
                t.dispatchEvent(m("pointerup", P));
                t.dispatchEvent(m("mouseup"));
                t.dispatchEvent(m("click"));
                return;
              }
              why = "another element is on top of it";
            } else why = !isVisible(el2) ? "it is not visible" : "it is disabled";
            if (Date.now() > end2) throw new Error("click timed out: " + why);
            await sleep(30);
          }
        }
      };
      var JSHandle = class {
        constructor(v) {
          this.v = v;
        }
        asElement() {
          return this.v && this.v.nodeType === 1 ? new ElementHandle(this.v) : null;
        }
      };
      var Locator = class _Locator {
        constructor(page2, steps) {
          this.page = page2;
          this.steps = steps;
        }
        // steps: [{sel, hasText, nth}] or [{els}]
        locator(sel, opts2 = {}) {
          return new _Locator(this.page, [...this.steps, { sel, hasText: opts2.hasText }]);
        }
        first() {
          return new _Locator(this.page, [...this.steps.slice(0, -1), { ...this.steps[this.steps.length - 1], nth: 0 }]);
        }
        resolve() {
          let scope = [this.page.doc];
          for (const st of this.steps) {
            if (st.els) {
              scope = st.els;
              continue;
            }
            let found = queryAll(scope, st.sel);
            if (st.hasText != null) {
              const t = String(st.hasText).toLowerCase();
              found = found.filter((e) => (e.textContent || "").toLowerCase().includes(t));
            }
            if (st.nth != null) found = found.slice(st.nth, st.nth + 1);
            scope = found;
          }
          return scope;
        }
        async all() {
          return this.resolve().map((e) => new _Locator(this.page, [{ els: [e] }]));
        }
        async waitOne(timeout2) {
          const end2 = Date.now() + timeout2;
          for (; ; ) {
            const r = this.resolve();
            if (r.length) return r[0];
            if (Date.now() > end2) throw new Error("locator found nothing: " + this.steps.map((s) => s.sel || "(element)").join(" >> "));
            await sleep(30);
          }
        }
        async click(opts2 = {}) {
          const t = opts2.timeout === void 0 ? 5e3 : opts2.timeout;
          const el2 = await this.waitOne(t);
          return new ElementHandle(el2).click({ ...opts2, timeout: t });
        }
        async isEnabled() {
          const el2 = await this.waitOne(500);
          return isEnabled(el2);
        }
        async isVisible() {
          const r = this.resolve();
          return r.length > 0 && isVisible(r[0]);
        }
        async count() {
          return this.resolve().length;
        }
        async innerText() {
          const el2 = await this.waitOne(500);
          return el2.innerText;
        }
        nth(n) {
          return new _Locator(this.page, [...this.steps.slice(0, -1), { ...this.steps[this.steps.length - 1], nth: n }]);
        }
      };
      var Page = class {
        constructor(dev, iframe) {
          this.dev = dev;
          this.iframe = iframe;
          this.loading = false;
          this.url = null;
        }
        get win() {
          return this.iframe.contentWindow;
        }
        get doc() {
          return this.iframe.contentWindow.document;
        }
        async goto(url) {
          await this._load(url);
        }
        async reload() {
          await this._load(this.url);
        }
        async _load(url) {
          const u = new URL(url, location.origin);
          if (u.origin !== location.origin) throw new Error("The in-browser simulator can only open pages on this site, not " + u.origin);
          this.url = u.pathname + u.search + u.hash;
          this.loading = true;
          try {
            if (this.freshFrame) this.freshFrame();
            await new Promise((res2) => {
              const f = () => {
                this.iframe.removeEventListener("load", f);
                res2();
              };
              this.iframe.addEventListener("load", f);
              this.iframe.src = "frame.html?" + Date.now();
            });
            const src2 = u.pathname.replace(/\/+$/, "") === "/overlay" ? "/overlay.html" : u.pathname === "/" || u.pathname === "" ? "/index.html" : u.pathname;
            const res = await fetch(src2, { cache: "no-cache" });
            if (!res.ok) throw new Error("Could not load " + src2 + " (HTTP " + res.status + ")");
            let html = await res.text();
            const inject = `<base href="/"><script>(${frameShim.toString()})(${JSON.stringify(this.dev.id)});<\/script>`;
            html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + inject) : inject + html;
            this.win.history.replaceState(null, "", this.url);
            this.win.__boot(html);
            for (let i = 0; i < 400; i++) {
              await sleep(25);
              if (this.doc.readyState === "complete" && this.doc.body) break;
            }
          } finally {
            this.loading = false;
          }
        }
        async waitForLoadState() {
          while (this.loading) await sleep(25);
        }
        async waitForTimeout(ms) {
          await sleep(ms);
        }
        async screenshot() {
          return null;
        }
        // (no pictures in the in-browser edition)
        _unwrap(a) {
          if (a instanceof ElementHandle) return a.el;
          if (Array.isArray(a)) return a.map((x) => this._unwrap(x));
          return a;
        }
        _fn(fn2) {
          if (this.loading) throw new Error("Execution context was destroyed, most likely because of a navigation");
          if (!this.doc || !this.doc.body) throw new Error("Cannot read properties of null (page is loading)");
          return typeof fn2 === "string" ? this.win.eval(fn2) : this.win.eval("(" + fn2.toString() + ")");
        }
        async evaluate(fn2, arg) {
          const f = this._fn(fn2);
          return typeof fn2 === "string" ? f : f(this._unwrap(arg));
        }
        async evaluateHandle(fn2, arg) {
          return new JSHandle(await this.evaluate(fn2, arg));
        }
        async $(sel) {
          const e = queryAll([this.doc], sel)[0];
          return e ? new ElementHandle(e) : null;
        }
        async $$(sel) {
          return queryAll([this.doc], sel).map((e) => new ElementHandle(e));
        }
        async $$eval(sel, fn2, arg) {
          const f = this._fn(fn2);
          return f(queryAll([this.doc], sel), arg);
        }
        locator(sel, opts2 = {}) {
          return new Locator(this, [{ sel, hasText: opts2.hasText }]);
        }
        async click(sel, opts2 = {}) {
          return this.locator(sel).first().click(opts2);
        }
        async fill(sel, value) {
          const el2 = await this.locator(sel).first().waitOne(5e3);
          const win = this.win;
          el2.focus();
          const proto = el2 instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value").set.call(el2, value);
          el2.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
          el2.dispatchEvent(new win.Event("change", { bubbles: true }));
        }
        async press(sel, key) {
          const el2 = await this.locator(sel).first().waitOne(5e3);
          const win = this.win;
          const codes = { Enter: 13, Escape: 27, Tab: 9 };
          const init = { key, code: key, keyCode: codes[key] || 0, which: codes[key] || 0, bubbles: true, cancelable: true };
          el2.focus();
          el2.dispatchEvent(new win.KeyboardEvent("keydown", init));
          el2.dispatchEvent(new win.KeyboardEvent("keypress", init));
          el2.dispatchEvent(new win.KeyboardEvent("keyup", init));
        }
      };
      module2.exports = { Page, ElementHandle, Locator, frameShim };
    }
  });

  // sim/web/run-web.cjs
  var require_run_web = __commonJS({
    "sim/web/run-web.cjs"(exports2, module2) {
      var fs = require_fs();
      var { makeEvent, roundComplete } = require_fake_event();
      var { FakeWorker } = require_fake_worker();
      var { RobotJudge } = require_robot_judge();
      var { writeReport } = require_report();
      var mm = require_mm();
      var { Page } = require_webplay();
      var counter = 0;
      function openDevice(sim, who, opts2 = {}) {
        const id = who + "-" + ++counter;
        const w = opts2.width || 412, h2 = opts2.height || 915, scale = opts2.scale || 0.3;
        const wrap = document.createElement("div");
        wrap.className = "dev";
        wrap.style.width = Math.round(w * scale) + "px";
        wrap.innerHTML = `<div class="cap">${who}</div><div class="box" style="width:${Math.round(w * scale)}px;height:${Math.round(h2 * scale)}px"></div>`;
        const box = wrap.querySelector(".box");
        sim.grid.appendChild(wrap);
        const mkFrame = () => {
          const f = document.createElement("iframe");
          f.style.cssText = `width:${w}px;height:${h2}px;border:0;background:#fff;transform:scale(${scale});transform-origin:0 0;position:absolute;left:0;top:0`;
          box.innerHTML = "";
          box.appendChild(f);
          return f;
        };
        const dev = { id, who, wrap, errors: [], consoleErrors: [], lastDialog: null };
        sim.devs[id] = dev;
        sim.stores[id] = { local: /* @__PURE__ */ new Map(), session: /* @__PURE__ */ new Map() };
        const page2 = new Page(dev, mkFrame());
        page2.freshFrame = () => {
          page2.iframe = mkFrame();
        };
        dev.page = page2;
        dev.ctx = { close: async () => {
          wrap.remove();
        } };
        return dev;
      }
      function makeSim(fw, siteHost, log) {
        const sim = { devs: {}, stores: {}, grid: document.getElementById("grid") };
        sim.route = async (id, r) => {
          const who = sim.devs[id] ? sim.devs[id].who : id;
          const u = new URL(r.url);
          const noBody = (s) => s === 204 || s === 205 || s === 304;
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
            try {
              fw.onRealBracketCall(who, r.method, r.url, r.body, resp.status, text);
            } catch (_) {
            }
            return reply(resp.status, { "content-type": resp.headers.get("content-type") || "application/json" }, text);
          }
          const fate = fw.wifiFate ? fw.wifiFate(r.method, r.url) : null;
          if (fate && fate.delay) await new Promise((res) => setTimeout(res, fate.delay));
          if (fate && fate.fail === "before") throw new TypeError("Failed to fetch");
          let ans;
          try {
            ans = fw.handle({ method: r.method, url: r.url, body: r.body, who });
          } catch (e) {
            fw.find("bug", who, "Simulator error while answering " + r.url, String(e && e.stack || e).slice(0, 300));
            ans = { status: 500, json: { error: "simulator error" } };
          }
          if (fate && fate.fail === "after") throw new TypeError("Failed to fetch");
          if (ans.delay) await new Promise((res) => setTimeout(res, ans.delay));
          if (ans.json !== void 0) return reply(ans.status, { "content-type": "application/json" }, JSON.stringify(ans.json));
          return reply(ans.status, { "content-type": ans.contentType || "text/plain" }, ans.text || "");
        };
        sim.navigate = (id, url) => {
          const d = sim.devs[id];
          if (d) d.page._load(url).catch((e) => log("A frame could not reload: " + e.message));
        };
        window.__sim = sim;
        return sim;
      }
      async function runEvent(o, log) {
        const started = Date.now();
        const ev = o.mmEvent || makeEvent({ players: o.players, judges: o.judges });
        const fw = new FakeWorker(ev, { rounds: o.rounds, wifi: o.mmEvent ? "good" : "good", seed: o.seed, newRoutes: false, rename: !o.mmEvent, flags: o.mmEvent ? { "1038": true } : void 0 });
        const baseUrl = location.origin, siteHost = location.host;
        const sim = makeSim(fw, siteHost, log);
        window.__fw = fw;
        let mmTimer = null;
        if (o.mmEvent) {
          fw.real = { base: o.workerBase, isBracketCall: (url) => mm.isBracketCall(url, ev.slug) };
          fw.mmQuietSince = Date.now();
          mmTimer = setInterval(async () => {
            try {
              const open = await mm.getJson(`${o.workerBase}/mm/open-matches?slug=${encodeURIComponent(ev.slug)}`);
              if (!open.ok || !open.body) return;
              const before = ev.round;
              const added = mm.syncOpen(ev, open.body.matches || []);
              if (added) {
                fw.mmQuietSince = Date.now();
                log(`MatchMason opened ${added} new match(es) (round ${ev.round})`);
              }
              if (ev.round !== before) fw.mmQuietSince = Date.now();
              ev.matches.filter((m) => m.state !== "complete" && !m.stillOpenOnMm && Date.now() - fw.startedAt > 15e3).forEach((m) => {
                m.state = "complete";
                m.scores_csv = m.scores_csv || "(closed on MatchMason)";
              });
              const left = ev.matches.filter((m) => m.state !== "complete").length;
              if (left) fw.mmQuietSince = Date.now();
              else if (!fw.mmWaitNoted) {
                fw.mmWaitNoted = true;
                log(`Round ${ev.round} is done. Waiting up to ${Math.round(o.roundWait / 60)} min for MatchMason's next round (start it on MatchMason if it does not start by itself).`);
              }
              if (left) fw.mmWaitNoted = false;
            } catch (_) {
            }
          }, 5e3);
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
            seed: o.seed * 1e3 + i + 1,
            verbose: false,
            undoRate: o.undoRate,
            refreshRate: o.refreshRate,
            streamSlot: overlayDev && i === 0 ? 1 : 0,
            overlayPage: overlayDev && i === 0 ? overlayDev.page : null,
            overlayEvery: o.overlayEvery,
            baseUrl,
            handoffRate: 0,
            clashRate: o.mmEvent ? 0 : void 0,
            reopenRate: o.mmEvent ? 0 : void 0,
            reuseRate: void 0,
            maxWaitMs: o.mmEvent ? (o.roundWait + 60) * 1e3 : void 0,
            openReliefDevice: async (who) => {
              const d = openDevice(sim, who);
              devices.push(d);
              return d;
            }
          }));
        }
        const isEventOver = o.mmEvent ? () => !ev.matches.some((m) => m.state !== "complete") && Date.now() - fw.mmQuietSince > o.roundWait * 1e3 : () => ev.round >= o.rounds && roundComplete(ev);
        const failures = [];
        const progress = setInterval(() => {
          const done = ev.matches.filter((m) => m.state === "complete").length;
          log(`round ${ev.round}${o.mmEvent ? "" : "/" + o.rounds} \xB7 ${done}/${ev.matches.length} matches done \xB7 ${fw.findings.length} findings \xB7 ${Math.round((Date.now() - started) / 1e3)}s`);
        }, 15e3);
        if (o.onStop) o.onStop(() => {
          robots.forEach((r) => {
            r.stopped = true;
          });
        });
        await Promise.all(robots.map(async (r) => {
          try {
            await r.run(baseUrl, isEventOver);
          } catch (e) {
            let screen = "";
            try {
              screen = (await r.screen()).replace(/\n+/g, " / ").slice(0, 600);
            } catch (_) {
            }
            fw.stuck = true;
            failures.push({ who: r.who, error: String(e && e.message || e).slice(0, 600), shot: "data:,", screen, lastSteps: r.steps.slice(-25).map((s) => s.text) });
            fw.find("bug", r.who, "Robot got stuck", String(e && e.message || e).split("\n")[0].slice(0, 300));
            r.stopped = true;
          }
        }));
        clearInterval(progress);
        if (mmTimer) clearInterval(mmTimer);
        robots.forEach((r) => r.allDevs.forEach((dev) => {
          [...new Set(dev.errors)].forEach((e) => fw.find("bug", r.who, "Page crashed with an error", e));
          [...new Set(dev.consoleErrors)].forEach((e) => fw.find("warn", r.who, "Error message in the browser console", e));
        }));
        if (overlayDev) {
          [...new Set(overlayDev.errors)].forEach((e) => fw.find("bug", "OBS", "Overlay page crashed with an error", e));
          [...new Set(overlayDev.consoleErrors)].forEach((e) => fw.find("warn", "OBS", "Error message in the overlay's console", e));
        }
        Object.entries(fw.unknown).forEach(([k, n]) => fw.find("info", "-", "App called a route the simulator does not know", k + " (" + n + "x)"));
        fw.find("info", "-", "Run in the browser, not separate windows", "All robots shared one browser tab, so they took turns. Handoff to a second phone, memory-growth and bad-wifi checks, screenshots, and the 'match abandoned' signal check are not part of this edition.");
        await Promise.all(devices.map((d) => d.ctx.close().catch(() => {
        })));
        const result = {
          options: { ...o, mmEvent: void 0, onStop: void 0, runs: 1, players: ev.players.length, judges: ev.judges.length, rounds: o.mmEvent ? ev.round : o.rounds, wifi: "good" },
          wifiStats: null,
          site: baseUrl + " (in the browser)",
          startedAt: new Date(started).toISOString(),
          seconds: Math.round((Date.now() - started) / 1e3),
          event: { name: ev.name, slug: ev.slug, players: ev.players.length, rounds: ev.round, matches: ev.matches.length, complete: ev.matches.filter((m) => m.state === "complete").length },
          findings: fw.findings,
          failures,
          robots: robots.map((r) => ({
            who: r.who,
            judge: r.judge.bracketName,
            matches: r.matchesDone,
            refreshes: r.refreshes || 0,
            overlayDelays: r.overlayDelays || [],
            prevCombos: r.prevStats || { checked: 0, ok: 0 },
            reusedPrev: r.reusedPrev || 0,
            handoffs: r.handoffs || 0,
            retries: r.retries || 0,
            saveMs: r.saveTimes.length ? Math.round(r.saveTimes.reduce((a, b) => a + b, 0) / r.saveTimes.length) : null,
            heapMB: []
          })),
          clashes: fw.clashes || 0,
          overlayShot: null,
          requests: fw.log.length
        };
        result.reportFile = writeReport("report", result);
        return { result, files: fs.files };
      }
      module2.exports = { runEvent };
    }
  });

  // sim/web/main.cjs
  var require_main = __commonJS({
    "sim/web/main.cjs"() {
      var { runEvent } = require_run_web();
      var mm = require_mm();
      var $ = (id) => document.getElementById(id);
      var logEl = () => $("log");
      function log(msg) {
        const t = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        logEl().textContent += `[${t}] ${msg}
`;
        logEl().scrollTop = logEl().scrollHeight;
      }
      var stopFns = [];
      function download(name, text, type) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type }));
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      async function start() {
        const link = $("link").value.trim();
        const o = {
          judges: Math.max(1, Math.min(8, parseInt($("judges").value, 10) || 8)),
          rounds: Math.max(1, parseInt($("rounds").value, 10) || 1),
          players: 32,
          seed: parseInt($("seed").value, 10) || 1,
          undoRate: 0.05,
          refreshRate: 0.02,
          overlay: true,
          overlayEvery: 1,
          roundWait: Math.max(60, (parseFloat($("wait").value) || 10) * 60),
          onStop: (fn2) => stopFns.push(fn2)
        };
        $("go").disabled = true;
        $("stop").disabled = false;
        $("done").hidden = true;
        stopFns = [];
        $("grid").innerHTML = "";
        logEl().textContent = "";
        try {
          if (link) {
            if (!$("ok").checked) {
              log("Tick the box to confirm results will be written to MatchMason for real.");
              $("go").disabled = false;
              $("stop").disabled = true;
              return;
            }
            const id = mm.parseMmId(link);
            if (!id) throw new Error("That is not a MatchMason event link or ID (expected matchmason.com/t/<id>).");
            o.workerBase = (new URLSearchParams(location.search).get("worker") || mm.REAL_WORKER).replace(/\/+$/, "");
            o.mmEvent = await mm.loadMmEvent(o.workerBase, id, o.judges);
            const ev = o.mmEvent;
            log(`REAL MatchMason: "${ev.name}", ${ev.players.length} players, ${ev.judges.length} robot judges, ${ev.matches.length} open match(es) in round ${ev.round}.`);
            log("Results are being written to this MatchMason event for real. Starting in 5 seconds.");
            await new Promise((r) => setTimeout(r, 5e3));
          } else {
            log(`Practice run on a pretend bracket: ${o.players} players, ${o.judges} judges, ${o.rounds} round(s). Nothing real is touched.`);
          }
          log("Keep this tab open and in front. Chrome slows down tabs you are not looking at.");
          const { result, files } = await runEvent(o, log);
          const bugs = [...new Set(result.findings.filter((f) => f.level === "bug").map((f) => f.what))];
          const warns = [...new Set(result.findings.filter((f) => f.level === "warn").map((f) => f.what))];
          log(`Done in ${result.seconds}s: ${result.event.complete}/${result.event.matches} matches played, ${bugs.length} kind(s) of bug, ${warns.length} kind(s) of check.`);
          bugs.forEach((w) => log("  BUG   " + w));
          warns.forEach((w) => log("  CHECK " + w));
          const html = files.get(result.reportFile), json = files.get("report/report.json");
          $("done").hidden = false;
          $("open").onclick = () => window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
          $("dl").onclick = () => download("blast-report.html", html, "text/html");
          $("dlj").onclick = () => download("blast-report.json", json, "application/json");
          window.__lastResult = result;
        } catch (e) {
          log("Stopped: " + (e && e.message || e));
        }
        $("go").disabled = false;
        $("stop").disabled = true;
      }
      document.addEventListener("DOMContentLoaded", () => {
        $("go").onclick = start;
        $("stop").onclick = () => {
          stopFns.forEach((f) => f());
          log("Stopping: the robots finish their current step and stop.");
        };
        $("link").addEventListener("input", () => {
          $("okrow").hidden = !$("link").value.trim();
        });
        document.addEventListener("visibilitychange", () => {
          if (document.hidden && !$("go").disabled === false) log("This tab is in the background: Chrome may be slowing the robots down.");
        });
        window.addEventListener("beforeunload", (e) => {
          if ($("go").disabled) {
            e.preventDefault();
            e.returnValue = "";
          }
        });
      });
    }
  });
  require_main();
})();
