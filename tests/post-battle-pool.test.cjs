// Tests for the pool of post-battle graphics (was flags 1022-1026, now always on): which graphic is picked after a finish.
// Runs the real functions from overlay.html and judge-match.js - no copies.
// Run: node tests/post-battle-pool.test.cjs
const assert = require("assert");
const { loadApp, loadText } = require("./load-app.cjs");

const app = loadApp();
const overlay = loadText("overlay.html");

function slice(src, start, endMarker) {
  const i = src.indexOf(start);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

// ---------------- the overlay's picker ----------------
const poolSrc = slice(overlay, "function buildRecordsInfo(", "// Size of the OBS source.");
const FIN_POINTS = { SPF: 1, OVR: 2, BST: 2, XTR: 3, OF2: 2, OF3: 3, LER: 1 };
const LIVE = { states: [], complete: new Set(), slug: "", pairAt: 0 };
let upsetDisk = null;   // stands in for the OBS source's saved list of upsets already shown
const upsetLoad = label => (upsetDisk && upsetDisk.label === label ? JSON.parse(JSON.stringify(upsetDisk)) : { label, ids: [] });
const upsetSave = v => { upsetDisk = JSON.parse(JSON.stringify(v)); };
const MU = { cache: new Map() };
const comboTextT = c => c && c.blade ? [c.blade, c.ratchet, c.bit].filter(Boolean).join(" ") : "";
const matchupKey = state => {
  const t = c => c && c.blade ? [c.blade, c.ratchet, c.bit].filter(Boolean).join(" ") : "";
  const a = t(state.p1ActiveCombo), b = t(state.p2ActiveCombo);
  return a && b ? { a, b, key: a.toLowerCase() + "|" + b.toLowerCase() } : null;
};
function load(flags) {
  const ff = id => flags.includes(id);
  return new Function("ff", "FIN_POINTS", "comboLine", "BD_P1", "BD_P2", "LIVE", "upsetLoad", "upsetSave", "MU", "MU_MIN", "matchupKey", "comboText", "localStorage", "UPSET_KEY",
    poolSrc + "; return { choosePoolGraphic, postBattleContent, POOL_BASIC, POOL_PRIORITY, poolUpset, poolCtx, matchupCard, resetPoolMemory, POOL_MEM };")(ff, FIN_POINTS, () => "", "#3d9bff", "#ff6a2b", LIVE, upsetLoad, upsetSave, MU, 10, matchupKey, comboTextT, { removeItem: () => { upsetDisk = null; } }, "k");
}
const P = load([]);
const mem = () => ({ key: null, contextShown: false, lastBasic: null });

const rec = (o = {}) => ({ label: "Swiss Round 2", p1: [2, 1], p2: [1, 2], known: true, swiss: true, pending: 4, ...o });
const st = (o = {}) => ({ p1: "Leaf", p2: "Chan", pts: [1, 0], sets: [0, 0], curSet: 1, setsNeeded: 2, pointLimit: 4, challongeMatchId: 7,
  lastFinish: { type: "SPF", scorerIdx: 0 }, records: rec(), battleCount: 3, ...o });
const pick = (state, prev, m = mem()) => P.choosePoolGraphic(state, prev, m);
const kindOf = g => !g ? null : g.info ? "context" : g.card.big;

console.log("final battle");
test("it becomes 3-3 in the deciding set: FINAL BATTLE! with shaking text", () => {
  const g = pick(st({ sets: [1, 1], curSet: 3, pts: [3, 3] }), st({ sets: [1, 1], curSet: 3, pts: [3, 2] }));
  assert.strictEqual(g.card.big, "Final battle!");
  assert.strictEqual(g.card.shake, true);
});
test("not when it stays 3-3 (a strike after it became 3-3)", () => {
  const s = st({ sets: [1, 1], curSet: 3, pts: [3, 3] });
  assert.notStrictEqual(kindOf(pick(s, s)), "Final battle!");
});
test("no round line on top", () => {
  const g = pick(st({ sets: [1, 1], curSet: 3, pts: [3, 3] }), st({ sets: [1, 1], curSet: 3, pts: [3, 2] }));
  assert.strictEqual(g.card.head, undefined);
});
test("3-3 in the first or second set: SET POINT 3-3, same gold, no shaking, shown once", () => {
  [[0, 0], [1, 0], [0, 1]].forEach(sets => {
    const g = pick(st({ sets, curSet: sets[0] + sets[1] + 1, pts: [3, 3] }), st({ sets, curSet: sets[0] + sets[1] + 1, pts: [3, 2] }));
    assert.strictEqual(g.card.big, "Set point 3-3", JSON.stringify(sets));
    assert.strictEqual(g.card.shake, undefined);
    assert.strictEqual(g.card.bigColor, "#ffd400");
    assert.strictEqual(g.card.head, undefined);
  });
  const s = st({ sets: [0, 0], curSet: 1, pts: [3, 3] });
  assert.notStrictEqual(kindOf(pick(s, s)), "Set point 3-3");   // not again while it stays 3-3
  const sw = st({ sets: [1, 0], curSet: 2, pts: [3, 3] });
  assert.notStrictEqual(kindOf(pick(st({ sets: [1, 1], pts: [0, 0], curSet: 3 }), sw)), "Set point 3-3");
});
test("not at other scores", () => {
  assert.notStrictEqual(kindOf(pick(st({ sets: [1, 1], curSet: 3, pts: [3, 2] }), st({ sets: [1, 1], curSet: 3, pts: [2, 2] }))), "Final battle!");
});

console.log("match point");
test("a player on 3 who has already won a set: MATCH POINT and their name", () => {
  const g = pick(st({ sets: [1, 0], pts: [3, 1] }), st({ sets: [1, 0], pts: [2, 1] }));
  assert.strictEqual(g.card.big, "Match point:");
  assert.strictEqual(g.card.head, undefined);   // no round line on top
  assert.strictEqual(g.card.sub, "Leaf");
  assert.strictEqual(g.card.subColor, "#3d9bff");
  const g2 = pick(st({ sets: [0, 1], pts: [1, 3] }), st({ sets: [0, 1], pts: [1, 2] }));
  assert.strictEqual(g2.card.sub, "Chan");
  assert.strictEqual(g2.card.subColor, "#ff6a2b");
});
test("a player on 3 who has not won a set yet is not match point", () => {
  assert.notStrictEqual(kindOf(pick(st({ sets: [0, 0], pts: [3, 1] }), st({ sets: [0, 0], pts: [2, 1] }))), "Match point:");
});
test("a finish that just won a set does not count (the loser can still show 3)", () => {
  const prev = st({ sets: [0, 1], curSet: 2, pts: [3, 3] });
  const now = st({ sets: [1, 1], curSet: 2, pts: [4, 3] });
  assert.notStrictEqual(kindOf(pick(now, prev)), "Match point:");
});
test("final battle comes before match point", () => {
  const g = pick(st({ sets: [1, 1], curSet: 3, pts: [3, 3] }), st({ sets: [1, 1], curSet: 3, pts: [3, 2] }));
  assert.strictEqual(g.card.big, "Final battle!");
});

console.log("order and the basic pool");
test("round + records come once per match, and a special graphic does not use that turn up", () => {
  const m = mem();
  const plain = st({ pts: [1, 0] });
  assert.strictEqual(kindOf(pick(st({ sets: [1, 0], pts: [3, 1] }), st({ sets: [1, 0], pts: [2, 1] }), m)), "Match point:");   // special first
  assert.strictEqual(m.contextShown, false);
  assert.strictEqual(kindOf(pick(plain, plain, m)), "context");                                  // then the records
  assert.strictEqual(m.contextShown, true);
  assert.strictEqual(pick(plain, plain, m).card.big, "Matches pending: 4");                      // never again this match
});
test("a new match starts over", () => {
  const m = mem();
  pick(st(), null, m);
  assert.strictEqual(kindOf(pick(st({ challongeMatchId: 8 }), null, m)), "context");
});
test("no match id: the pairing names are used as the match", () => {
  const m = mem();
  pick(st({ challongeMatchId: undefined }), null, m);
  assert.strictEqual(m.contextShown, true);
  assert.strictEqual(kindOf(pick(st({ challongeMatchId: undefined, p2: "Zed" }), null, m)), "context");
});
test("basic pool: Currently Playing first, then the other, then back (when both can qualify)", () => {
  P.POOL_BASIC.playing = () => ({ card: { big: "playing" } });
  try {
    const m = mem();
    m.key = "m7"; m.contextShown = true;
    const s = st();
    const seq = [1, 2, 3, 4].map(() => kindOf(pick(s, s, m)));
    assert.deepStrictEqual(seq, ["playing", "Matches pending: 4", "playing", "Matches pending: 4"]);
  } finally {
    delete P.POOL_BASIC.playing;
  }
});
test("basic pool: if Currently Playing does not qualify, the other one is used", () => {
  P.POOL_BASIC.playing = () => null;
  try {
    const m = mem();
    m.key = "m7"; m.contextShown = true;
    const s = st();
    assert.deepStrictEqual([1, 2, 3].map(() => kindOf(pick(s, s, m))), ["Matches pending: 4", "Matches pending: 4", "Matches pending: 4"]);
  } finally {
    delete P.POOL_BASIC.playing;
  }
});
test("pending count shows even at 0, but is skipped when the judge app does not know it", () => {
  const m = mem();
  m.key = "m7"; m.contextShown = true;
  assert.strictEqual(pick(st({ records: rec({ pending: 0 }) }), null, m).card.big, "Matches pending: 0");
  assert.strictEqual(pick(st({ records: rec({ pending: null }) }), null, m), null);
  assert.strictEqual(pick(st({ records: undefined }), null, m), null);
});

console.log("upset alert");
const P24 = load([]);
const pick24 = (state, prev, m) => P24.choosePoolGraphic(state, prev, m);
const up = (id, w, ws, l, ls) => ({ id, w, ws, l, ls });
const withUps = (list, o = {}) => st({ upsets: list, ...o });
test("shows UPSET! with the text, after the records graphic", () => {
  upsetDisk = null;
  const m = mem();
  const s = withUps([up("5", "Sam", 9, "Alex", 2)]);
  assert.strictEqual(kindOf(pick24(s, s, m)), "context");           // records first (once per match)
  const g = pick24(s, s, m);
  assert.strictEqual(g.card.big, "Upset!");
  assert.strictEqual(g.card.sub, "Sam (Seed 9) beats Alex (Seed 2)");
  assert.strictEqual(g.card.head, "Upset alert \u00b7 Swiss Round 2");
  assert.strictEqual(g.card.sub2, "Final result from another stadium");   // says outright it was played elsewhere
});
test("the upset where the best-seeded player lost goes first; each is shown once; the next round starts fresh", () => {
  upsetDisk = null;
  const m = mem(); m.key = "m7"; m.contextShown = true;
  const s = withUps([up("1", "A", 20, "B", 8), up("2", "C", 12, "D", 3), up("3", "E", 15, "F", 3)]);
  assert.strictEqual(pick24(s, s, m).card.sub, "E (Seed 15) beats F (Seed 3)");   // same loser seed 3: the bigger gap first
  assert.strictEqual(pick24(s, s, m).card.sub, "C (Seed 12) beats D (Seed 3)");
  assert.strictEqual(pick24(s, s, m).card.sub, "A (Seed 20) beats B (Seed 8)");
  assert.notStrictEqual(kindOf(pick24(s, s, m)), "Upset!");                         // all shown
  const m2 = mem(); m2.key = "m7"; m2.contextShown = true;
  assert.notStrictEqual(kindOf(pick24(s, s, m2)), "Upset!");                        // remembered on this channel across matches
  const next = withUps([up("1", "A", 20, "B", 8)], { records: rec({ label: "Swiss Round 3" }) });
  const m3 = mem(); m3.key = "m7"; m3.contextShown = true;
  assert.strictEqual(kindOf(pick24(next, next, m3)), "Upset!");                    // new round: same id is fair game again
});
test("no upsets or bad rows: nothing", () => {
  upsetDisk = null;
  const m = mem(); m.key = "m7"; m.contextShown = true;
  const bad = withUps([up("1", "A", 3, "B", 9), up("2", "A", 4, "B", 4), { id: "3" }, null]);
  assert.notStrictEqual(kindOf(pick24(bad, bad, m)), "Upset!");
});
test("order: final battle and match point beat the upset; the upset beats the basic pool", () => {
  upsetDisk = null;
  const m = mem(); m.key = "m7"; m.contextShown = true;
  const fb = withUps([up("5", "Sam", 9, "Alex", 2)], { sets: [1, 1], curSet: 3, pts: [3, 3] });
  assert.strictEqual(kindOf(pick24(fb, withUps([], { sets: [1, 1], curSet: 3, pts: [3, 2] }), m)), "Final battle!");
  const m2 = mem(); m2.key = "m7"; m2.contextShown = true;
  const plain = withUps([up("5", "Sam", 9, "Alex", 2)]);
  assert.strictEqual(kindOf(pick24(plain, plain, m2)), "Upset!");
});

console.log("currently playing");
const live = (o = {}) => ({ p1: "Alex", p2: "Sam", pts: [2, 1], sets: [1, 0], challongeMatchId: 21, tournamentName: "Event", ...o });
const setLive = (list, complete = []) => { LIVE.states = list; LIVE.complete = new Set(complete); };
test("lists other live matches with the set score and the sets", () => {
  setLive([live(), live({ p1: "Jo", p2: "Ri", pts: [0, 3], sets: [0, 1], challongeMatchId: 22 })]);
  const m = mem(); m.key = "m7"; m.contextShown = true;
  const g = pick24(st({ tournamentName: "Event" }), null, m);
  assert.strictEqual(g.card.head, "Currently playing");
  assert.deepStrictEqual(g.card.rows, [{ p1: "Alex", p2: "Sam", pts: [2, 1], sets: [1, 0] }, { p1: "Jo", p2: "Ri", pts: [0, 3], sets: [0, 1] }]);
});
test("leaves out this match, finished matches, other events, repeats and half-empty entries; at most 3", () => {
  setLive([
    live({ p1: "Leaf", p2: "Chan", challongeMatchId: 7 }),                 // this match (by id)
    live({ p1: "chan", p2: "LEAF", challongeMatchId: undefined }),          // this match (same two names)
    live({ p1: "A", p2: "B", matchOver: true, challongeMatchId: 31 }),      // over
    live({ p1: "C", p2: "D", challongeMatchId: 32 }),                       // complete in the bracket
    live({ p1: "E", p2: "F", tournamentName: "Other", challongeMatchId: 33 }),
    live({ p1: "G", p2: "", challongeMatchId: 34 }),
    live({ p1: "H", p2: "I", challongeMatchId: 35 }), live({ p1: "I", p2: "H", challongeMatchId: undefined }),   // same match twice
    live({ p1: "J", p2: "K", challongeMatchId: 36 }), live({ p1: "L", p2: "M", challongeMatchId: 37 }), live({ p1: "N", p2: "O", challongeMatchId: 38 })
  ], ["32"]);
  const m = mem(); m.key = "m7"; m.contextShown = true;
  const g = pick24(st({ tournamentName: "Event" }), null, m);
  assert.deepStrictEqual(g.card.rows.map(r => r.p1 + r.p2), ["HI", "JK", "LM"]);
});
test("nobody else playing: the basic pool falls to Matches Pending", () => {
  setLive([]);
  const m = mem(); m.key = "m7"; m.contextShown = true;
  assert.strictEqual(pick24(st(), null, m).card.big, "Matches pending: 4");
});
test("basic pool takes turns: Currently Playing, Matches Pending, Currently Playing", () => {
  setLive([live()]);
  const m = mem(); m.key = "m7"; m.contextShown = true;
  const seq = [1, 2, 3].map(() => { const g = pick24(st({ tournamentName: "Event" }), null, m); return g.card.rows ? "playing" : g.card.big; });
  assert.deepStrictEqual(seq, ["playing", "Matches pending: 4", "playing"]);
  setLive([]);
});

console.log("match over: winner graphic");
const over = (o = {}) => st({ matchOver: true, sets: [2, 0], pts: [4, 1], battleCount: 5, ...o });
test("winner's name in their colour, set score, battle count and Swiss record", () => {
  const c = pick(over(), st()).card;
  assert.strictEqual(c.big, "Leaf");
  assert.strictEqual(c.bg, "#3d9bff");   // the graphic is filled with the winner colour
  assert.strictEqual(c.outline, true);
  assert.strictEqual(c.sub, "2–0 · 5 battles");
  assert.deepStrictEqual(c.subRuns.map(r => r.t), ["2–0", " · 5 battles"]);
  assert.strictEqual(c.subRuns[0].color, "#3ddc84");   // the set score is green
  assert.strictEqual(c.subRuns[1].color, undefined);
  assert.strictEqual(c.sub2, "Swiss record 3–1");   // was 2-1, plus this win
  assert.strictEqual(c.head, "Swiss Round 2 · Match winner");
});
test("player 2 winning uses player 2's colour and record", () => {
  const c = pick(over({ sets: [1, 2] }), st()).card;
  assert.strictEqual(c.big, "Chan");
  assert.strictEqual(c.bg, "#ff6a2b");
  assert.strictEqual(c.sub2, "Swiss record 2–2");   // was 1-2, plus this win
});
test("Top Cut or a failed lookup: no Swiss record line", () => {
  assert.strictEqual(pick(over({ records: rec({ swiss: false }) }), st()).card.sub2, "");
  assert.strictEqual(pick(over({ records: rec({ known: false }) }), st()).card.sub2, "");
});
test("one battle says 'battle'; no count sent leaves it out", () => {
  assert.strictEqual(pick(over({ battleCount: 1 }), st()).card.sub, "2–0 · 1 battle");
  assert.strictEqual(pick(over({ battleCount: undefined }), st()).card.sub, "2–0");
});
test("the winner graphic does not use up the records turn", () => {
  const m = mem();
  pick(over(), st(), m);
  assert.strictEqual(m.contextShown, false);
});

console.log("wiring in the overlay");
test("the finish content carries the picked graphic", () => {
  const c = P.postBattleContent(st({ sets: [1, 0], pts: [3, 1] }), st({ sets: [1, 0], pts: [2, 1] }));
  assert.strictEqual(c.card.big, "Match point:");
  assert.strictEqual(c.info, null);
  assert.strictEqual(c.finishOnly, false);
});
test("nothing qualifies -> only the finish text", () => {
  const c = load([]);
  const m = c.postBattleContent(st({ records: rec({ pending: null }) }), st());   // first pick: records
  assert.ok(m.info);
  const n = c.postBattleContent(st({ records: rec({ pending: null }) }), st());   // records used up, pending unknown
  assert.strictEqual(n.finishOnly, true);
  assert.strictEqual(n.info, null);
  assert.strictEqual(n.card, null);
});

console.log("judge app side");
const pendSrc = slice(app, "function overlayPendingFrom(", "function MatchScreen({");
const overlayPendingFrom = new Function(pendSrc + "; return overlayPendingFrom;")();
const mm = (id, round, state, p1 = 1, p2 = 2, underway = null) => ({ id, round, state, player1_id: p1, player2_id: p2, underway_at: underway });
test("pending = this round, not finished, not underway, both players known, not this match", () => {
  const list = [mm(1, 3, "open"), mm(2, 3, "open"), mm(3, 3, "complete"), mm(4, 3, "open", 1, 2, "2026-11-03T10:00:00Z"),
    mm(5, 3, "open", 1, null), mm(6, 2, "open"), mm(7, 3, "open")];
  assert.strictEqual(overlayPendingFrom(list, 3, 7), 2);   // 1 and 2 (7 is this match)
});
test("Top Cut rounds count by their own number; no round = unknown; garbage never throws", () => {
  assert.strictEqual(overlayPendingFrom([mm(1, -1, "open"), mm(2, -1, "open"), mm(3, 1, "open")], -1, 9), 2);
  assert.strictEqual(overlayPendingFrom([mm(1, 1, "open")], null, 9), null);
  assert.strictEqual(overlayPendingFrom(null, 2, 9), 0);
  assert.strictEqual(overlayPendingFrom([null, 5, {}], 2, 9), 0);
});

const seedSrc = slice(app, "function overlaySeedMap(", "function MatchScreen({");
const { overlaySeedMap, overlayUpsetsFrom } = new Function(seedSrc + "; return { overlaySeedMap, overlayUpsetsFrom };")();
const pl = (id, name, seed, extra = {}) => ({ participant: { id, name, seed, ...extra } });
const seeds = overlaySeedMap([pl(1, "Alex", 1), pl(2, "Bo", 5), pl(3, "Cy", 9), pl(4, "Di", 12, { display_name: "Dee", group_player_ids: [104] }), pl(5, "NoSeed", null)]);
const done = (id, round, p1, p2, winner) => ({ id, round, state: "complete", player1_id: p1[0], player1_name: p1[1], player2_id: p2[0], player2_name: p2[1], winner_id: winner });
test("seeds are read by name (display name first, ignoring capitals) and by id, including group-stage ids", () => {
  assert.strictEqual(seeds.names["alex"], 1);
  assert.strictEqual(seeds.names["dee"], 12);
  assert.strictEqual(seeds.ids["104"], 12);
  assert.strictEqual(seeds.names["noseed"], undefined);
  assert.deepStrictEqual(overlaySeedMap(null), { names: {}, ids: {} });
});
test("upsets: a bigger seed number beat a smaller one, this round only, best-seeded loser first", () => {
  const list = [
    done(10, 2, [3, "Cy"], [1, "Alex"], 3),     // seed 9 beat seed 1  -> upset
    done(11, 2, [2, "Bo"], [4, "Di"], 2),        // seed 5 beat seed 12 -> normal
    done(12, 2, [104, "Dee"], [2, "Bo"], 104),   // seed 12 beat seed 5 (group id) -> upset
    done(13, 1, [3, "Cy"], [1, "Alex"], 3),     // other round
    { ...done(14, 2, [3, "Cy"], [1, "Alex"], null) },   // no winner yet
    { ...done(15, 2, [3, "Cy"], [1, "Alex"], 3), state: "open" }
  ];
  const u = overlayUpsetsFrom(list, 2, seeds, 99);
  assert.deepStrictEqual(u, [{ id: "10", w: "Cy", ws: 9, l: "Alex", ls: 1 }, { id: "12", w: "Dee", ws: 12, l: "Bo", ls: 5 }]);
});
test("upsets: the current match, unknown seeds, unknown round and garbage are skipped, never throw", () => {
  assert.deepStrictEqual(overlayUpsetsFrom([done(10, 2, [3, "Cy"], [1, "Alex"], 3)], 2, seeds, 10), []);
  assert.deepStrictEqual(overlayUpsetsFrom([done(10, 2, [5, "NoSeed"], [1, "Alex"], 5)], 2, seeds, 99), []);
  assert.deepStrictEqual(overlayUpsetsFrom([done(10, 2, [3, "Cy"], [1, "Alex"], 3)], null, seeds, 99), []);
  assert.deepStrictEqual(overlayUpsetsFrom(null, 2, seeds, 99), []);
  assert.deepStrictEqual(overlayUpsetsFrom([null, 5, {}], 2, seeds, 99), []);
  assert.strictEqual(overlayUpsetsFrom(Array.from({ length: 40 }, (_, i) => done(100 + i, 2, [3, "Cy"], [1, "Alex"], 3)), 2, seeds, 99).length, 16);
});

const pushSrc = slice(app, "  const pushOverlay = (extraState = {}) => {", "\n  pushOverlayLatestRef.current = pushOverlay;");
function sent({ extra = {}, match = [], round = 3, overlayRecords = null }) {
  const out = [];
  const env = {
    standbyRef: { current: false }, setStandbyActive: () => {}, setScores: [], overlaySetWinners: () => [], deckOrderRef: { current: null },
    pushOverlayDebounceRef: { current: 0 }, pushOverlayTrailExtraRef: { current: null },
    pushOverlayTrailTimerRef: { current: null }, pushOverlayLatestRef: { current: null },
    setTimeout: () => 1, r1: 0, r2: 0, d1: [{}], d2: [{}], currentMatch: match, p1: "A", p2: "B",
    currentSides: {}, pts: [0, 0], sets: [0, 0], curSet: 1, need: 2,
    config: { pts: 4, tm: false, tournamentName: "T" }, judge: "J", challongeMatchId: 5, phase: "battle", overlaySlot: 1,
    OVERLAY_WORKER: "https://w", setOverlayStatus: () => {}, console: { log() {}, warn() {}, error() {} },
    challongeRound: round, overlayRecords, overlayRoundLabel: r => "Swiss Round " + r, swapped: false, overlayFlip: false, challongeSlug: "my-event",
    fetch: (url, opts) => { out.push(JSON.parse(opts.body).state); return Promise.resolve({ status: 200 }); }
  };
  const names = Object.keys(env);
  new Function(...names, pushSrc.replace("const pushOverlay =", "return") + ";")(...names.map(n => env[n]))(extra);
  return out[0];
}
const log3 = [{ type: "SPF" }, { type: "LER-STRIKE" }, { type: "XTR" }];
test("battle count (strikes are not battles), Swiss flag, pending count and 'known' are sent", () => {
  const s = sent({ match: log3, overlayRecords: { p1: [1, 0], p2: [0, 1], pending: 6 } });
  assert.strictEqual(s.battleCount, 2);
  assert.deepStrictEqual(s.records, { label: "Swiss Round 3", p1: [1, 0], p2: [0, 1], known: true, swiss: true, pending: 6 });
});
test("lookup not done -> known false, pending unknown; Top Cut is not Swiss", () => {
  const s = sent({ round: -1 });
  assert.strictEqual(s.records.known, false);
  assert.strictEqual(s.records.pending, null);
  assert.strictEqual(s.records.swiss, false);
});
test("a battle count passed by the scoring code wins over the log's count", () => {
  assert.strictEqual(sent({ match: log3, extra: { battleCount: 9 } }).battleCount, 9);
});
test("the tournament link and this round's upsets are sent", () => {
  const ups = [{ id: "4", w: "Cy", ws: 9, l: "Alex", ls: 1 }];
  const on = sent({ overlayRecords: { p1: [0, 0], p2: [0, 0], pending: 1, upsets: ups } });
  assert.strictEqual(on.slug, "my-event");
  assert.deepStrictEqual(on.upsets, ups);
  assert.deepStrictEqual(sent({}).upsets, []);
});
const battleSrc = slice(app, "    const battleExtra = {", '    if (fin.id === "LER") {');
const battleExtra = (match, fin) => new Function("currentMatch", "fin", battleSrc + "; return battleExtra;")(match, fin);
test("scoring push: the battle just scored is counted (the log is one behind), a strike is not", () => {
  assert.deepStrictEqual(battleExtra(log3, { id: "OVR" }), { battleCount: 3 });
  assert.deepStrictEqual(battleExtra(log3, { id: "LER" }), { battleCount: 3 });
  assert.deepStrictEqual(battleExtra(log3, { id: "LER-STRIKE" }), { battleCount: 2 });
});

console.log("matchup stats and graphic memory");
const P6 = load([]);
const combos = { p1ActiveCombo: { blade: "Shark Scale", ratchet: "3-60", bit: "Narrow" }, p2ActiveCombo: { blade: "Dran Sword", ratchet: "3-60", bit: "F" } };
const muKey = "shark scale 3-60 narrow|dran sword 3-60 f";
const setMu = e => MU.cache.set(muKey, Object.assign({ at: Date.now() }, e));
const pick6 = (state, prev, m = mem()) => P6.choosePoolGraphic(state, prev, m);
test("shown once per match, before the round records, after Match Point", () => {
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  const m = mem();
  const g = pick6(st(combos), st(combos), m);
  assert.strictEqual(g.card.headRuns[0].t, "Next battle: ");
  assert.strictEqual(kindOf(pick6(st(combos), st(combos), m)), "context");   // second finish: not again
  const mp = pick6(st({ ...combos, sets: [1, 0], pts: [3, 1] }), st({ ...combos, sets: [1, 0], pts: [2, 1] }));
  assert.strictEqual(mp.card.big, "Match point:");
});
const rowText = k => k.statRow.items.map(i => i.map(r => r.t).join("")).join(" | ") + " | " + k.statRow.right;
const rowColors = k => k.statRow.items.map(i => i[1].color);
test("NEXT BATTLE: line, the favorite's blade name in its player's colour, Battle Win and PPB on one row with the sample size", () => {
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  const k = pick6(st(combos), st(combos)).card;
  assert.strictEqual(k.headRuns.map(r => r.t).join(""), "Next battle: Shark Scale 3-60 Narrow vs Dran Sword 3-60 F");
  assert.strictEqual(k.headRuns[0].color, "#fff");
  assert.strictEqual(k.headRuns[1].color, "#3d9bff"); assert.strictEqual(k.headRuns[3].color, "#ff6a2b");
  assert.strictEqual(k.big, "Shark Scale");   // blade only
  assert.strictEqual(k.bigColor, "#3d9bff");
  assert.strictEqual(rowText(k), "Battle Win: 70% | PPB: +1.00 | 20 battles");
  assert.strictEqual(k.statRow.px, 30);   // both on one row, same size
  setMu({ n: 20, aWins: 6, bWins: 14, aPts: 20, bPts: 40 });
  const k2 = pick6(st(combos), st(combos)).card;
  assert.strictEqual(k2.big, "Dran Sword");
  assert.strictEqual(k2.bigColor, "#ff6a2b");
  assert.strictEqual(rowText(k2), "Battle Win: 70% | PPB: +1.00 | 20 battles");
});
test("the full combo is shown only when both combos use the same blade", () => {
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  const same = { p1ActiveCombo: { blade: "Shark Scale", ratchet: "3-60", bit: "Narrow" }, p2ActiveCombo: { blade: "Shark Scale", ratchet: "5-60", bit: "Rush" } };
  MU.cache.set("shark scale 3-60 narrow|shark scale 5-60 rush", { at: Date.now(), n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  assert.strictEqual(pick6(st(same), st(same)).card.big, "Shark Scale 3-60 Narrow");
  MU.cache.set("shark scale 3-60 narrow|shark scale 5-60 rush", { at: Date.now(), n: 20, aWins: 6, bWins: 14, aPts: 20, bPts: 40 });
  assert.strictEqual(pick6(st(same), st(same)).card.big, "Shark Scale 5-60 Rush");
});
test("win rate and PPB numbers: green above 50% / above 0, red below, white at the line", () => {
  const G = "#3ddc84", R = "#ff5a5a";
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  assert.deepStrictEqual(rowColors(pick6(st(combos), st(combos)).card), [G, G]);
  setMu({ n: 10, aWins: 4, bWins: 6, aPts: 30, bPts: 14 });   // A has the better PPB but wins only 40%
  const k = pick6(st(combos), st(combos)).card;
  assert.strictEqual(rowText(k), "Battle Win: 40% | PPB: +1.60 | 10 battles");
  assert.deepStrictEqual(rowColors(k), [R, G]);
  setMu({ n: 20, aWins: 10, bWins: 10, aPts: 25, bPts: 25 });
  assert.deepStrictEqual(rowColors(pick6(st(combos), st(combos)).card), ["#fff", "#fff"]);
});
test("exactly even (same PPB and win rate) reads Even matchup", () => {
  setMu({ n: 20, aWins: 10, bWins: 10, aPts: 25, bPts: 25 });
  assert.strictEqual(pick6(st(combos), st(combos)).card.big, "Even matchup");
  setMu({ n: 20, aWins: 9, bWins: 11, aPts: 25, bPts: 25 });   // same PPB: the better win rate breaks the tie
  const k = pick6(st(combos), st(combos)).card;
  assert.strictEqual(k.big, "Dran Sword"); assert.strictEqual(k.statRow.items[0][1].t, "55%");
});
test("skipped with fewer than 10 battles, a failed lookup, no lookup yet, missing combos, or a finished match", () => {
  setMu({ n: 9, aWins: 9, bWins: 0, aPts: 20, bPts: 0 });
  assert.strictEqual(kindOf(pick6(st(combos), st(combos))), "context");
  setMu({ err: "E106" });
  assert.strictEqual(kindOf(pick6(st(combos), st(combos))), "context");
  MU.cache.clear();
  assert.strictEqual(kindOf(pick6(st(combos), st(combos))), "context");
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  assert.strictEqual(kindOf(pick6(st(), st())), "context");
  assert.strictEqual(pick6(st({ ...combos, matchOver: true, sets: [2, 1] }), st(combos)).card.head.indexOf("Match winner") > -1, true);
});
test("Clear graphic memory lets once-per-match graphics show again (same match)", () => {
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  upsetDisk = null;
  P6.POOL_MEM.key = null;
  const s1 = st({ ...combos, upsets: [{ id: "4", w: "Cy", ws: 9, l: "Al", ls: 2 }] });
  const first = P6.choosePoolGraphic(s1, s1, P6.POOL_MEM);
  assert.strictEqual(first.card.headRuns[0].t, "Next battle: ");
  assert.strictEqual(kindOf(P6.choosePoolGraphic(s1, s1, P6.POOL_MEM)), "context");
  assert.strictEqual(P6.choosePoolGraphic(s1, s1, P6.POOL_MEM).card.big, "Upset!");
  assert.notStrictEqual(kindOf(P6.choosePoolGraphic(s1, s1, P6.POOL_MEM)), "Upset!");   // upset used up
  P6.resetPoolMemory();
  assert.strictEqual(P6.choosePoolGraphic(s1, s1, P6.POOL_MEM).card.headRuns[0].t, "Next battle: ");
  assert.strictEqual(kindOf(P6.choosePoolGraphic(s1, s1, P6.POOL_MEM)), "context");
  assert.strictEqual(P6.choosePoolGraphic(s1, s1, P6.POOL_MEM).card.big, "Upset!");   // shown again after the reset
});
test("a Test fire (sim) never reads or changes the real memory", () => {
  upsetDisk = null;
  const s1 = st({ upsets: [{ id: "4", w: "Cy", ws: 9, l: "Al", ls: 2 }] });
  const c = P6.poolCtx(s1, null); c.sim = true;
  const memBefore = JSON.stringify(P6.POOL_MEM);
  assert.strictEqual(P6.poolUpset(c, {}).card.big, "Upset!");
  assert.strictEqual(P6.poolUpset(c, {}).card.big, "Upset!");   // again: not used up
  assert.strictEqual(upsetDisk, null);
  assert.strictEqual(JSON.stringify(P6.POOL_MEM), memBefore);
  const none = P6.poolCtx(st({ upsets: [] }), null); none.sim = true;
  assert.strictEqual(P6.poolUpset(none, {}), null);   // nothing to build from: the Test fire falls back to a labelled sample
});

test("deferred pick: nothing is chosen or remembered until later() runs, then it matches a normal pick", () => {
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  const m = P6.POOL_MEM; P6.resetPoolMemory();
  const s1 = st(combos);
  const c = P6.postBattleContent(s1, s1, { defer: true });
  assert.strictEqual(typeof c.later, "function");
  assert.strictEqual(c.info, null); assert.strictEqual(c.card, null);
  assert.strictEqual(m.matchupShown, false); assert.strictEqual(m.key, null);   // nothing remembered yet
  const g = c.later();
  assert.strictEqual(g.card.headRuns[0].t, "Next battle: ");
  assert.strictEqual(m.matchupShown, true);
  // data that arrives between the finish and later() is used: nothing was cached at finish time
  P6.resetPoolMemory(); MU.cache.clear();
  const c2 = P6.postBattleContent(s1, s1, { defer: true });
  setMu({ n: 20, aWins: 14, bWins: 6, aPts: 40, bPts: 20 });
  assert.strictEqual(c2.later().card.headRuns[0].t, "Next battle: ");
  // not deferred (no option): same behaviour as before
  const c3 = P6.postBattleContent(st(), st());
  assert.strictEqual(c3.later, null);
});

console.log("flag registration");
const flags = loadText("flags.js");
test("flags 1022-1026 are retired (the post-battle graphics are always on)", () => {
  [1022, 1023, 1024, 1025, 1026].forEach(id => {
    assert(!new RegExp("^\\s*" + id + ",", "m").test(flags), id + " should be gone from the default-on list");
    assert(!new RegExp(id + ":\\s*\\{\\s*name:").test(flags), id + " should be gone from the menu descriptions");
  });
});

console.log("\n" + passed + " passed");
