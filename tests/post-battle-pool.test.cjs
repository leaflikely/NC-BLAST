// Tests for flag 1023 (the pool of post-battle graphics, stage 1): which graphic is picked after a finish.
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
function load(flags) {
  const ff = id => flags.includes(id);
  return new Function("ff", "FIN_POINTS", "comboLine", "BD_P1", "BD_P2",
    poolSrc + "; return { choosePoolGraphic, postBattleContent, POOL_BASIC, POOL_PRIORITY };")(ff, FIN_POINTS, () => "", "#3d9bff", "#ff6a2b");
}
const P = load([1009, 1022, 1023]);
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
test("not in a set that is not the deciding one, or at other scores", () => {
  assert.notStrictEqual(kindOf(pick(st({ sets: [1, 0], pts: [3, 3] }), st({ sets: [1, 0], pts: [3, 2] }))), "Final battle!");
  assert.notStrictEqual(kindOf(pick(st({ sets: [1, 1], curSet: 3, pts: [3, 2] }), st({ sets: [1, 1], curSet: 3, pts: [2, 2] }))), "Final battle!");
});

console.log("match point");
test("a player on 3 who has already won a set: MATCH POINT and their name", () => {
  const g = pick(st({ sets: [1, 0], pts: [3, 1] }), st({ sets: [1, 0], pts: [2, 1] }));
  assert.strictEqual(g.card.big, "Match point");
  assert.strictEqual(g.card.sub, "Leaf!");
  assert.strictEqual(g.card.subColor, "#3d9bff");
  const g2 = pick(st({ sets: [0, 1], pts: [1, 3] }), st({ sets: [0, 1], pts: [1, 2] }));
  assert.strictEqual(g2.card.sub, "Chan!");
  assert.strictEqual(g2.card.subColor, "#ff6a2b");
});
test("a player on 3 who has not won a set yet is not match point", () => {
  assert.notStrictEqual(kindOf(pick(st({ sets: [0, 0], pts: [3, 1] }), st({ sets: [0, 0], pts: [2, 1] }))), "Match point");
});
test("a finish that just won a set does not count (the loser can still show 3)", () => {
  const prev = st({ sets: [0, 1], curSet: 2, pts: [3, 3] });
  const now = st({ sets: [1, 1], curSet: 2, pts: [4, 3] });
  assert.notStrictEqual(kindOf(pick(now, prev)), "Match point");
});
test("final battle comes before match point", () => {
  const g = pick(st({ sets: [1, 1], curSet: 3, pts: [3, 3] }), st({ sets: [1, 1], curSet: 3, pts: [3, 2] }));
  assert.strictEqual(g.card.big, "Final battle!");
});

console.log("order and the basic pool");
test("round + records come once per match, and a special graphic does not use that turn up", () => {
  const m = mem();
  const plain = st({ pts: [1, 0] });
  assert.strictEqual(kindOf(pick(st({ sets: [1, 0], pts: [3, 1] }), st({ sets: [1, 0], pts: [2, 1] }), m)), "Match point");   // special first
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

console.log("match over: winner graphic");
const over = (o = {}) => st({ matchOver: true, sets: [2, 0], pts: [4, 1], battleCount: 5, ...o });
test("winner's name in their colour, set score, battle count and Swiss record", () => {
  const c = pick(over(), st()).card;
  assert.strictEqual(c.big, "Leaf");
  assert.strictEqual(c.bigColor, "#3d9bff");
  assert.strictEqual(c.sub, "2–0 · 5 battles");
  assert.strictEqual(c.sub2, "Swiss record 3–1");   // was 2-1, plus this win
  assert.strictEqual(c.head, "Swiss Round 2 · Match winner");
});
test("player 2 winning uses player 2's colour and record", () => {
  const c = pick(over({ sets: [1, 2] }), st()).card;
  assert.strictEqual(c.big, "Chan");
  assert.strictEqual(c.bigColor, "#ff6a2b");
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
test("flag 1023: the finish content carries the picked graphic", () => {
  const c = P.postBattleContent(st({ sets: [1, 0], pts: [3, 1] }), st({ sets: [1, 0], pts: [2, 1] }));
  assert.strictEqual(c.card.big, "Match point");
  assert.strictEqual(c.info, null);
  assert.strictEqual(c.finishOnly, false);
});
test("flag 1023: nothing qualifies -> only the finish text", () => {
  const c = load([1009, 1022, 1023]);
  const m = c.postBattleContent(st({ records: rec({ pending: null }) }), st());   // first pick: records
  assert.ok(m.info);
  const n = c.postBattleContent(st({ records: rec({ pending: null }) }), st());   // records used up, pending unknown
  assert.strictEqual(n.finishOnly, true);
  assert.strictEqual(n.info, null);
  assert.strictEqual(n.card, null);
});
test("flag 1023 off, 1022 on: records after every finish, as before", () => {
  const c = load([1009, 1022]);
  assert.ok(c.postBattleContent(st(), st()).info);
  assert.ok(c.postBattleContent(st(), st()).info);
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

const pushSrc = slice(app, "  const pushOverlay = (extraState = {}) => {", "\n  pushOverlayLatestRef.current = pushOverlay;");
function sent({ flags, extra = {}, match = [], round = 3, overlayRecords = null }) {
  const out = [];
  const env = {
    ff: id => flags.includes(id),
    pushOverlayDebounceRef: { current: 0 }, pushOverlayTrailExtraRef: { current: null },
    pushOverlayTrailTimerRef: { current: null }, pushOverlayLatestRef: { current: null },
    setTimeout: () => 1, r1: 0, r2: 0, d1: [{}], d2: [{}], currentMatch: match, p1: "A", p2: "B",
    currentSides: {}, pts: [0, 0], sets: [0, 0], curSet: 1, need: 2,
    config: { pts: 4, tm: false, tournamentName: "T" }, judge: "J", challongeMatchId: 5, phase: "battle", overlaySlot: 1,
    OVERLAY_WORKER: "https://w", setOverlayStatus: () => {}, console: { log() {}, warn() {}, error() {} },
    challongeRound: round, overlayRecords, overlayRoundLabel: r => "Swiss Round " + r, swapped: false, overlayFlip: false,
    fetch: (url, opts) => { out.push(JSON.parse(opts.body).state); return Promise.resolve({ status: 200 }); }
  };
  const names = Object.keys(env);
  new Function(...names, pushSrc.replace("const pushOverlay =", "return") + ";")(...names.map(n => env[n]))(extra);
  return out[0];
}
const log3 = [{ type: "SPF" }, { type: "LER-STRIKE" }, { type: "XTR" }];
test("flag 1023: battle count (strikes are not battles), Swiss flag, pending count and 'known' are sent", () => {
  const s = sent({ flags: [1022, 1023], match: log3, overlayRecords: { p1: [1, 0], p2: [0, 1], pending: 6 } });
  assert.strictEqual(s.battleCount, 2);
  assert.deepStrictEqual(s.records, { label: "Swiss Round 3", p1: [1, 0], p2: [0, 1], known: true, swiss: true, pending: 6 });
});
test("flag 1023: lookup not done -> known false, pending unknown; Top Cut is not Swiss", () => {
  const s = sent({ flags: [1022, 1023], round: -1 });
  assert.strictEqual(s.records.known, false);
  assert.strictEqual(s.records.pending, null);
  assert.strictEqual(s.records.swiss, false);
});
test("a battle count passed by the scoring code wins over the log's count", () => {
  assert.strictEqual(sent({ flags: [1022, 1023], match: log3, extra: { battleCount: 9 } }).battleCount, 9);
});
test("flag 1023 off: nothing new is sent", () => {
  const s = sent({ flags: [1022], match: log3, overlayRecords: { p1: [1, 0], p2: [0, 1], pending: 6 } });
  assert.strictEqual("battleCount" in s, false);
  assert.deepStrictEqual(Object.keys(s.records).sort(), ["label", "p1", "p2"]);
});
const battleSrc = slice(app, "    const battleExtra = ff(1023)", '    if (fin.id === "LER") {');
const battleExtra = (flags, match, fin) => new Function("ff", "currentMatch", "fin", battleSrc + "; return battleExtra;")(id => flags.includes(id), match, fin);
test("scoring push: the battle just scored is counted (the log is one behind), a strike is not", () => {
  assert.deepStrictEqual(battleExtra([1023], log3, { id: "OVR" }), { battleCount: 3 });
  assert.deepStrictEqual(battleExtra([1023], log3, { id: "LER" }), { battleCount: 3 });
  assert.deepStrictEqual(battleExtra([1023], log3, { id: "LER-STRIKE" }), { battleCount: 2 });
  assert.deepStrictEqual(battleExtra([], log3, { id: "OVR" }), {});
});

console.log("flag registration");
const flags = loadText("flags.js");
test("1023 is on by default and has a menu description", () => {
  assert(/^\s*1023,/m.test(flags));
  assert(/1023:\s*\{\s*name:/.test(flags));
});

console.log("\n" + passed + " passed");
