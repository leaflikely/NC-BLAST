// Behavioural test for flag 1030 (standby slides between rounds). Runs the real code from judge-match.js / overlay.html / flags.js.
// Run: node tests/standby-slides.test.cjs
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
const H = new Function(slice(app, "function setScoreText(", "function stadiumLetterFor(") + slice(app, "function standbyNeedsAsk(", "function MatchScreen(") + "; return { standbyNeedsAsk, standbyDataFrom };")();
const OV = new Function("el", "space", "SHAPES", slice(overlay, "function sbPpb(", "async function sbLoop(") + "; return { sbSlidesFrom, sbPpb };")(() => ({}), { shape: "wide" }, {});

let n = 0; const test = (name, fn) => { fn(); n++; console.log("  ok  " + name); };
console.log("standby slides (flag 1030)");

const M = (id, round, p1, p2, state, winner, csv) => ({ id, round, state, player1_id: p1 && p1.charCodeAt(0), player2_id: p2 && p2.charCodeAt(0), player1_name: p1, player2_name: p2, winner_id: winner ? winner.charCodeAt(0) : null, scores_csv: csv });

test("question: queue still has an open match -> stay (no question)", () => {
  const pairs = [M(1, 2, "A", "B", "complete", "A", "4-2,4-1"), M(5, 2, "C", "D", "open"), M(6, 2, "E", "F", "open")];
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: ["5"], pairings: pairs, round: 2, currentMatchId: 1 }), "stay");
});
test("question: queue empty but other stations still have matches -> ask", () => {
  const pairs = [M(1, 2, "A", "B", "complete", "A", "4-2,4-1"), M(6, 2, "E", "F", "open")];
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: [], pairings: pairs, round: 2, currentMatchId: 1 }), "ask");
});
test("question: queued matches that are already finished do not count", () => {
  const pairs = [M(1, 2, "A", "B", "complete", "A", "4-2,4-1"), M(5, 2, "C", "D", "complete", "C", "4-0,4-0"), M(6, 2, "E", "F", "open")];
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: ["5", "1"], pairings: pairs, round: 2, currentMatchId: 1 }), "ask");
});
test("question: nothing left in the round anywhere -> standby without asking", () => {
  const pairs = [M(1, 2, "A", "B", "complete", "A", "4-2,4-1"), M(5, 2, "C", "D", "complete", "C", "4-0,4-0"), M(9, 3, "A", "C", "open")];
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: [], pairings: pairs, round: 2, currentMatchId: 1 }), "standby");
});
test("question: the match just played (not yet marked finished) is ignored; unreadable bracket does nothing", () => {
  const pairs = [M(1, 2, "A", "B", "open")];
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: ["1"], pairings: pairs, round: 2, currentMatchId: 1 }), "standby");
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: [], pairings: null, round: 2, currentMatchId: 1 }), "none");
});
test("question: matches whose players are not decided yet do not count as open", () => {
  const pairs = [M(1, 2, "A", "B", "complete", "A", "4-0,4-0"), M(7, 2, "", "", "open")];
  assert.strictEqual(H.standbyNeedsAsk({ queueIds: [], pairings: pairs, round: 2, currentMatchId: 1 }), "standby");
});

const pairs = [
  M(1, 1, "Leaf", "Danny", "complete", "L", "4-2,4-1"),
  M(2, 1, "Sam", "Alex", "complete", "S", "4-3,2-4,4-0"),
  M(3, 2, "Leaf", "Sam", "complete", "L", "4-0,4-0"),
  M(4, 2, "Danny", "Alex", "complete", "D", "4-1,1-4,4-2"),
  M(5, 2, "Riley", "Casey", "open")
];
pairs.forEach(m => { m.player1_id = m.player1_name; m.player2_id = m.player2_name; if (m.winner_id) m.winner_id = ({ L: "Leaf", S: "Sam", D: "Danny" })[String.fromCharCode(m.winner_id)]; });
const stats = { players: { leaf: { n: 6, pf: 20, pa: 6 }, danny: { n: 8, pf: 12, pa: 14 }, sam: { n: 9, pf: 14, pa: 16 }, alex: { n: 8, pf: 10, pa: 16 } },
  combos: { "shark scale 3-60 narrow": { n: 4, pf: 10, pa: 2 }, "dran sword 3-60 f": { n: 5, pf: 4, pa: 9 } } };
const decks = [
  { matchId: "3", d1: ["Shark Scale 3-60 Narrow", "Dran Sword 3-60 F", "Wizard Rod 5-70 DB"], d2: ["shark scale 3-60 narrow", "Phoenix Wing 9-60 GP", "Hells Scythe 4-60 T"] },
  { matchId: "4", d1: ["Dran Sword 3-60 F", "Wizard Rod 5-70 DB", "Cobalt Dragoon 2-60 Elevate"], d2: ["Shark Scale 3-60 Narrow", "x", "y"] }
];
const data = H.standbyDataFrom(pairs, 2, stats, decks);

test("standings: wins first, then fewer losses, then PPB; PPB is points won minus lost per battle", () => {
  assert.deepStrictEqual(data.standings.map(r => r.n + " " + r.w + "-" + r.l), ["Leaf 2-0", "Sam 1-1", "Danny 1-1", "Alex 0-2"]);
  assert.strictEqual(data.standings[0].p, 2.33);
  assert.strictEqual(data.standings[2].p, -0.25);   // Danny: 12 won, 14 lost over 8 battles; Sam's -0.22 puts him one place higher
});
test("standings: a tie on wins and losses is split by PPB (higher first)", () => {
  const d = H.standbyDataFrom(pairs, 2, { players: { danny: { n: 8, pf: 12, pa: 14 }, sam: { n: 9, pf: 18, pa: 16 } } }, []);
  assert.deepStrictEqual(d.standings.map(r => r.n).slice(1, 3), ["Sam", "Danny"]);
});
test("standings: no stats yet -> still listed, PPB empty", () => {
  const d = H.standbyDataFrom(pairs, 2, null, []);
  assert.strictEqual(d.standings[0].p, null);
  assert.strictEqual(d.standings.length, 4);
});
test("results: this round's finished matches, newest first, winner first with the set score", () => {
  assert.deepStrictEqual(data.results, [{ w: "Danny", l: "Alex", sc: "2-1" }, { w: "Leaf", l: "Sam", sc: "2-0" }]);
});
test("results: a loser-listed-first match still shows the winner first", () => {
  const d = H.standbyDataFrom([M(9, 1, "Zed", "Yan", "complete", "S", "1-4,1-4")].map(m => ({ ...m, player1_id: "Zed", player2_id: "Yan", winner_id: "Yan" })), 1, null, []);
  assert.deepStrictEqual(d.results, [{ w: "Yan", l: "Zed", sc: "2-0" }]);
});
test("combos: counted once per deck (not per battle), same combo in different letter case is one", () => {
  const top = data.combos[0];
  assert.strictEqual(top.c, "Shark Scale 3-60 Narrow");
  assert.strictEqual(top.n, 3);
  assert.strictEqual(data.combos[1].c, "Dran Sword 3-60 F");
  assert.strictEqual(data.combos[1].n, 2);
});
test("combos: PPB comes from the event's battles with that combo; unknown combo has none", () => {
  assert.strictEqual(data.combos[0].p, 2);
  assert.strictEqual(data.combos[1].p, -1);
  assert.strictEqual(data.combos.find(c => c.c === "Hells Scythe 4-60 T").p, null);
});
test("lists hold at most 8 entries and bad input never throws", () => {
  const many = []; for (let i = 0; i < 20; i++) many.push({ d1: ["C" + i + " 1-60 X"], d2: [] });
  assert.strictEqual(H.standbyDataFrom(pairs, 2, stats, many).combos.length, 8);
  assert.doesNotThrow(() => H.standbyDataFrom(null, null, null, null));
  assert.deepStrictEqual(H.standbyDataFrom(null, null, null, null), { round: null, standings: [], results: [], combos: [] });
});

test("overlay slides: standings, results, combos in order; empty lists are skipped", () => {
  const s = OV.sbSlidesFrom(data);
  assert.deepStrictEqual(s.map(x => x.title), ["Standings", "Round 2 results", "Most used combos"]);
  assert.strictEqual(s[0].rows[0].b, "2-0");
  assert.strictEqual(s[0].rows[0].c, "PPB +2.33");
  assert.strictEqual(s[2].rows[0].b, "3 decks");
  assert.strictEqual(s[2].rows[2].c, "—");
  const noCombos = OV.sbSlidesFrom({ round: 2, standings: data.standings, results: [], combos: [] });
  assert.deepStrictEqual(noCombos.map(x => x.title), ["Standings"]);
  assert.strictEqual(OV.sbSlidesFrom({}).length, 1);
  assert.strictEqual(OV.sbSlidesFrom({})[0].wait, "Next match coming up");
});
test("overlay: PPB is written with a sign (minus sign for negatives)", () => {
  assert.strictEqual(OV.sbPpb(1.4), "+1.40");
  assert.strictEqual(OV.sbPpb(-0.5), "−0.50");
  assert.strictEqual(OV.sbPpb(null), "");
});

test("judge app wiring: all three New Match buttons use the standby check; a real update ends standby; locking saves the decks", () => {
  assert.strictEqual((app.match(/newMatchTap\(\);/g) || []).length, 3);
  assert(/if \(ff\(1030\)\) \{\r?\n\s*standbyRef\.current = false;\r?\n\s*setStandbyActive\(false\);/.test(app));
  assert(/if \(ff\(1030\) && locked && locked\.p1Deck && locked\.p2Deck\) saveDeckLog\(locked\);/.test(app));
  assert(app.includes("Are there no more matches at this stadium?"));
});
test("flags.js: 1030 is on by default and described; overlay hook is flag-gated", () => {
  assert(/\b1030,/.test(slice(flagsSrc, "new Set([", "]);")));
  assert(/1030:\s*\{\s*name:/.test(flagsSrc));
  assert(/ff\(1030\) && ff\(1021\) && state && state\.standby/.test(overlay));
});
console.log("\n" + n + " passed");
