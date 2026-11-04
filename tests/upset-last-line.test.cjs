// Behavioural test for flag 1029 (Upset Alert last line: score + stadium / judge). Runs the real code, no copies.
// Run: node tests/upset-last-line.test.cjs
const assert = require("assert");
const { loadApp, loadText } = require("./load-app.cjs");
const app = loadApp();
const overlay = loadText("overlay.html");
const flagsSrc = loadText("flags.js");
function slice(src, start, endMarker) {
  const i = src.indexOf(start); assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i); assert(j > i, "end not found: " + endMarker);
  return src.slice(i, j);
}
const helpers = slice(app, "function setScoreText(", "function MatchScreen(");
const upsetsFn = slice(app, "function overlaySeedMap(", "function setScoreText(");
const H = new Function(helpers + upsetsFn + "; return { setScoreText, stadiumLetterFor, overlayUpsetsWithNotes, overlayUpsetsFrom, overlaySeedMap };")();
const O = new Function("BD_GOLD", slice(overlay, "function upsetLastLine(", "// Currently Playing") + "; return { upsetLastLine, upsetCard };");
const OV = O("#fc0");

let n = 0; const test = (name, fn) => { fn(); n++; console.log("  ok  " + name); };
console.log("upset alert last line (flag 1029)");

test("score text: sets won for a multi-set match, winner first", () => {
  assert.strictEqual(H.setScoreText("4-2,1-4,4-3", true), "2-1");
  assert.strictEqual(H.setScoreText("4-2,1-4,4-3", false), "1-2");
  assert.strictEqual(H.setScoreText("4-1,4-0", false), "0-2");
});
test("score text: a one-set match shows the points; junk shows nothing", () => {
  assert.strictEqual(H.setScoreText("4-2", true), "4-2");
  assert.strictEqual(H.setScoreText("4-2", false), "2-4");
  assert.strictEqual(H.setScoreText("", true), "");
  assert.strictEqual(H.setScoreText(null, true), "");
  assert.strictEqual(H.setScoreText("abc", true), "");
});
test("upset list carries the score (sc) when the bracket has it", () => {
  const seeds = H.overlaySeedMap([{ participant: { id: 1, display_name: "Low", seed: 8 } }, { participant: { id: 2, display_name: "High", seed: 1 } }]);
  const pairs = [{ id: 10, state: "complete", round: 1, player1_id: 1, player2_id: 2, player1_name: "Low", player2_name: "High", winner_id: 1, scores_csv: "4-2,1-4,4-3" }];
  const u = H.overlayUpsetsFrom(pairs, 1, seeds, null);
  assert.strictEqual(u.length, 1); assert.strictEqual(u[0].sc, "2-1");
  pairs[0].scores_csv = undefined;
  assert.strictEqual("sc" in H.overlayUpsetsFrom(pairs, 1, seeds, null)[0], false);
});
test("stadium lookup: by username, by display name, and not found", () => {
  const assign = { alice: "A", Bob: "B" };
  assert.strictEqual(H.stadiumLetterFor(assign, {}, "ALICE"), "A");
  assert.strictEqual(H.stadiumLetterFor(assign, { bobby99: "bob" }, "bob"), "B");
  assert.strictEqual(H.stadiumLetterFor(assign, { bob: "robert", rob_login: "robert" }, "rob_login"), "B");
  assert.strictEqual(H.stadiumLetterFor(assign, {}, "carol"), "");
  assert.strictEqual(H.stadiumLetterFor(null, {}, "alice"), "");
  assert.strictEqual(H.stadiumLetterFor({}, {}, ""), "");
});
test("notes are merged into upsets by match id; unknown ids and bad data are left alone", () => {
  const ups = [{ id: "10", w: "a" }, { id: "11", w: "b" }];
  const out = H.overlayUpsetsWithNotes(ups, { "10": { j: "Dan", s: "B" } });
  assert.strictEqual(out[0].st, "B"); assert.strictEqual(out[0].j, "Dan"); assert.deepStrictEqual(out[1], ups[1]);
  assert.deepStrictEqual(H.overlayUpsetsWithNotes(ups, null), ups);
  assert.deepStrictEqual(H.overlayUpsetsWithNotes(null, {}), []);
  assert.strictEqual(ups[0].st, undefined, "original not changed");
});
test("overlay line: stadium first, then judge, then just the score, then the old wording", () => {
  assert.strictEqual(OV.upsetLastLine({ sc: "2-1", st: "B", j: "Dan" }), "Wins 2-1 on Stadium B");
  assert.strictEqual(OV.upsetLastLine({ sc: "2-0", j: "Dan" }), "Wins 2-0 judged by Dan");
  assert.strictEqual(OV.upsetLastLine({ sc: "2-0" }), "Wins 2-0");
  assert.strictEqual(OV.upsetLastLine({ st: "B" }), "");
  assert.strictEqual(OV.upsetCard("R1", "x").sub2, "Final result from another stadium");
  assert.strictEqual(OV.upsetCard("R1", "x", "Wins 2-1 on Stadium B").sub2, "Wins 2-1 on Stadium B");
});
test("the judge app saves the note after a sent result and the flag exists", () => {
  assert(/fetchActiveMatches\(\);\r?\n\s*saveMatchNote\(matchId\);/.test(app));
  assert(/\b1029,/.test(slice(flagsSrc, "new Set([", "]);")));
  assert(/1029:\s*\{\s*name:/.test(flagsSrc));
});
console.log("\n" + n + " passed");
