// Tests for the round + match records on the stream overlay's post-battle graphic (was flag 1022, now always on).
// Runs the real functions from judge-match.js, overlay.html and flags.js - no copies.
// Run: node tests/post-battle-records.test.cjs
const assert = require("assert");
const { loadApp, loadText } = require("./load-app.cjs");

const app = loadApp();
const overlay = loadText("overlay.html");
const flags = loadText("flags.js");

function slice(src, start, endMarker) {
  const i = src.indexOf(start);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

const recSrc = slice(app, "function overlayRecordsFrom(", "function MatchScreen({");
const { overlayRecordsFrom, overlayRoundLabel } = new Function(recSrc + "; return { overlayRecordsFrom, overlayRoundLabel };")();

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

const m = (id, p1, p2, w, state = "complete", n1 = "", n2 = "") => ({ id, state, player1_id: p1, player2_id: p2, player1_name: n1, player2_name: n2, winner_id: w });

console.log("records from the bracket's match list");
test("counts wins and losses of finished matches by participant id", () => {
  const list = [m(1, 10, 20, 10), m(2, 30, 10, 30), m(3, 10, 40, 10), m(4, 20, 30, 20)];
  assert.deepStrictEqual(overlayRecordsFrom(list, 10, 20, "A", "B", 99), { p1: [2, 1], p2: [1, 1] });
});
test("unfinished matches and matches with no winner are not counted", () => {
  const list = [m(1, 10, 20, null, "open"), m(2, 10, 20, null), m(3, 10, 20, "", "complete"), m(4, 10, 20, 10, "pending")];
  assert.deepStrictEqual(overlayRecordsFrom(list, 10, 20, "A", "B", 99), { p1: [0, 0], p2: [0, 0] });
});
test("the match being played now is skipped even if the bracket lists it as finished", () => {
  const list = [m(7, 10, 20, 10), m(8, 10, 30, 30)];
  assert.deepStrictEqual(overlayRecordsFrom(list, 10, 20, "A", "B", 7), { p1: [0, 1], p2: [0, 0] });
});
test("ids compare as text (number vs string)", () => {
  assert.deepStrictEqual(overlayRecordsFrom([m("1", "10", "20", "10")], 10, 20, "A", "B", null), { p1: [1, 0], p2: [0, 1] });
});
test("with no id, the name matches ignoring capitals and spaces", () => {
  const list = [m(1, 10, 20, 10, "complete", " leaf ", "Chandler")];
  assert.deepStrictEqual(overlayRecordsFrom(list, null, null, "Leaf", "chandler", 99), { p1: [1, 0], p2: [0, 1] });
});
test("empty names never match each other", () => {
  const list = [m(1, 10, 20, 10, "complete", "", "")];
  assert.deepStrictEqual(overlayRecordsFrom(list, null, null, "", "", 99), { p1: [0, 0], p2: [0, 0] });
});
test("garbage in gives 0-0, never throws", () => {
  assert.deepStrictEqual(overlayRecordsFrom(null, 1, 2, "A", "B", 3), { p1: [0, 0], p2: [0, 0] });
  assert.deepStrictEqual(overlayRecordsFrom([null, undefined, 5, {}], 1, 2, "A", "B", 3), { p1: [0, 0], p2: [0, 0] });
});

console.log("round label");
test("Swiss, Top Cut and no round", () => {
  assert.strictEqual(overlayRoundLabel(1), "Swiss Round 1");
  assert.strictEqual(overlayRoundLabel("3"), "Swiss Round 3");
  assert.strictEqual(overlayRoundLabel(-2), "Top Cut Round 2");
  assert.strictEqual(overlayRoundLabel(null), "");
  assert.strictEqual(overlayRoundLabel(0), "");
  assert.strictEqual(overlayRoundLabel("x"), "");
});

console.log("what the judge app sends");
const pushSrc = slice(app, "  const pushOverlay = (extraState = {}) => {", "\n  pushOverlayLatestRef.current = pushOverlay;");
function sendWith({ challongeRound, overlayRecords }) {
  const sent = [];
  const env = {
    standbyRef: { current: false }, setStandbyActive: () => {}, overlayFlip: false, challongeSlug: "", setScores: [], overlaySetWinners: () => [], deckOrderRef: { current: null },
    pushOverlayDebounceRef: { current: 0 }, pushOverlayTrailExtraRef: { current: null },
    pushOverlayTrailTimerRef: { current: null }, pushOverlayLatestRef: { current: null },
    setTimeout: () => 1, r1: 0, r2: 0, d1: [{}], d2: [{}], currentMatch: [], p1: "A", p2: "B",
    currentSides: {}, pts: [0, 0], sets: [0, 0], curSet: 1, need: 2,
    config: { pts: 4, tm: false, tournamentName: "T" }, judge: "J", challongeMatchId: 5, phase: "battle", overlaySlot: 1,
    OVERLAY_WORKER: "https://w", setOverlayStatus: () => {}, console: { log() {}, warn() {}, error() {} },
    challongeRound, overlayRecords, overlayRoundLabel,
    fetch: (url, opts) => { sent.push(JSON.parse(opts.body).state); return Promise.resolve({ status: 200 }); }
  };
  const names = Object.keys(env);
  new Function(...names, pushSrc.replace("const pushOverlay =", "return") + ";")(...names.map(n => env[n]))();
  return sent[0];
}
test("round label and records are sent", () => {
  const s = sendWith({ challongeRound: 2, overlayRecords: { p1: [2, 0], p2: [1, 1] } });
  assert.deepStrictEqual(s.records, { label: "Swiss Round 2", p1: [2, 0], p2: [1, 1], known: true, swiss: true, pending: null });
});
test("lookup not done or failed: 0-0 and the round still shows", () => {
  const s = sendWith({ challongeRound: 1, overlayRecords: null });
  assert.deepStrictEqual(s.records, { label: "Swiss Round 1", p1: [0, 0], p2: [0, 0], known: false, swiss: true, pending: null });
});

console.log("the overlay's graphic");
const pbSrc = slice(overlay, "function buildRecordsInfo(", "// ── POST-BATTLE GRAPHIC POOL");
const buildRecordsInfo = new Function(pbSrc + "; return buildRecordsInfo;")();
function content(state) { return { info: buildRecordsInfo(state, state.sets || [0, 0]) }; }
const st = (o = {}) => ({ p1: "Leaf", p2: "Chan", pts: [3, 0], sets: [0, 0], curSet: 1, lastFinish: { type: "XTR", scorerIdx: 0 }, records: { label: "Swiss Round 2", p1: [1, 0], p2: [0, 1] }, ...o });
test("records graphic content comes from what the judge app sent", () => {
  const i = content(st()).info;
  assert.deepStrictEqual(i, { label: "Swiss Round 2", p1: "Leaf", p2: "Chan", r1: [1, 0], r2: [0, 1], swapped: false });
});
test("no records sent: shows 0-0", () => {
  const i = content(st({ records: undefined })).info;
  assert.deepStrictEqual([i.r1, i.r2, i.label], [[0, 0], [0, 0], ""]);
});
test("match just ended: that match is counted for the winner and loser", () => {
  const over = st({ matchOver: true, sets: [0, 2], pts: [1, 4], lastFinish: { type: "SPF", scorerIdx: 1 } });
  const i = content(over).info;
  assert.deepStrictEqual([i.r1, i.r2], [[1, 1], [1, 1]]);
});
test("the records sent by the judge app are not changed by the overlay (a second finish does not add twice)", () => {
  const s = st({ matchOver: true, sets: [2, 0] });
  content(s);
  content(s);
  assert.deepStrictEqual(s.records, { label: "Swiss Round 2", p1: [1, 0], p2: [0, 1] });
});
test("stream position flipped: the records graphic is flipped too", () => {
  assert.strictEqual(content(st({ swapped: true })).info.swapped, true);
});

console.log("flag registration");
test("flag 1022 is retired (the records are always sent)", () => {
  assert(!/^\s*1022,/m.test(flags), "1022 should be gone from the default-on list");
  assert(!/1022:\s*\{\s*name:/.test(flags), "1022 should be gone from the menu descriptions");
});

console.log("\n" + passed + " passed");
