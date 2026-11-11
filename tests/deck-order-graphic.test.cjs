// Behavioural test for the deck order graphic on the stream overlay (was flag 1028, now always on).
// Runs the real code from screens.js / judge-match.js / flags.js - no copies - and checks what the judge app
// sends to the overlay when the judge locks the deck order with Start Match.
// Run: node tests/deck-order-graphic.test.cjs
const assert = require("assert");
const { loadApp, loadText } = require("./load-app.cjs");
const app = loadApp();
const flagsSrc = loadText("flags.js");
const overlay = loadText("overlay.html");

function slice(src, start, endMarker) {
  const i = src.indexOf(start);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

const confirmSrc = slice(app, "  const confirm = () => {", "\n\n  // ── Score summary");
const lockSrc = slice(app, "        let deckExtra = null;", "        if (shuffleTimer) {");
const pushSrc = slice(app, "  const pushOverlay = (extraState = {}) => {", "\n  pushOverlayLatestRef.current = pushOverlay;");

const C = (blade, ratchet, bit) => ({ blade, ratchet, bit, extra: "x" });
const D1 = [C("Dran Sword", "3-60", "F"), C("Wizard Rod", "5-70", "DB"), C("Hells Scythe", "4-60", "T")];
const D2 = [C("Shark Scale", "3-60", "Narrow"), C("Phoenix Wing", "9-60", "GP"), C("Cobalt Dragoon", "2-60", "Elevate")];
const name = c => [c.blade, c.ratchet, c.bit].join(" ");

// The real Start Match handler on the Set Deck Order screen. topOrder/botOrder are the picked orders (indexes into the decks).
function runConfirm({ swapped, topOrder, botOrder }) {
  const out = { top: null, bot: null, locked: undefined };
  const topDeck = swapped ? D2 : D1, botDeck = swapped ? D1 : D2;
  new Function("canStart", "topOrder", "botOrder", "topDeck", "botDeck", "swapped", "topSet", "botSet", "onConfirm",
    confirmSrc.replace("const confirm =", "const confirm =") + "; confirm();")(
    true, topOrder, botOrder, topDeck, botDeck, swapped, v => { out.top = v; }, v => { out.bot = v; }, v => { out.locked = v; });
  return out;
}

// The real lock step in the judge app's onConfirm.
function runLock({ locked, p1 = "Leaf", p2 = "Danny", displayShuf = 1 }) {
  const deckOrderRef = { current: null };
  const deckExtra = new Function("saveDeckLog", "locked", "deckOrderRef", "p1", "p2", "Date", "displayShuf", lockSrc + "; return deckExtra;")(
    () => {}, locked, deckOrderRef, p1, p2, { now: () => 4242 }, displayShuf);
  return { deckExtra, ref: deckOrderRef };
}

// The real pushOverlay, with every sent state captured.
function makePush({ ref, phase = "battle", p1 = "Leaf", p2 = "Danny", matchOver = false }) {
  const sent = [];
  const env = {
    standbyRef: { current: false }, setStandbyActive: () => {},
    overlayFlip: false, overlayRecords: null, overlayRoundLabel: () => "", challongeRound: 1, challongeSlug: "",
    setScores: [], overlaySetWinners: () => [],
    pushOverlayDebounceRef: { current: 0 },
    pushOverlayTrailExtraRef: { current: null },
    pushOverlayTrailTimerRef: { current: null },
    pushOverlayLatestRef: { current: null },
    deckOrderRef: ref,
    setTimeout: () => 1,
    r1: 0, r2: 0, d1: [{}], d2: [{}],
    currentMatch: [], p1, p2,
    currentSides: {}, pts: [0, 0], sets: matchOver ? [2, 0] : [0, 0], curSet: 1, need: 2,
    config: { pts: 4, tm: false, tournamentName: "T" },
    judge: "J", challongeMatchId: 123, phase, overlaySlot: 0,
    OVERLAY_WORKER: "https://w",
    setOverlayStatus: () => {},
    console: { log() {}, warn() {}, error() {} },
    fetch: (url, opts) => { sent.push(JSON.parse(opts.body).state); return Promise.resolve({ status: 200 }); }
  };
  const names = Object.keys(env);
  const push = new Function(...names, pushSrc.replace("const pushOverlay =", "return") + ";")(...names.map(n => env[n]));
  return { push, sent, env };
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }

console.log("deck order graphic");

test("Start Match hands back player 1's and player 2's locked decks (player 1 on top)", () => {
  const r = runConfirm({ swapped: false, topOrder: [2, 0, 1], botOrder: [1, 2, 0] });
  assert.deepStrictEqual(r.locked.p1Deck.map(name), ["Hells Scythe 4-60 T", "Dran Sword 3-60 F", "Wizard Rod 5-70 DB"]);
  assert.deepStrictEqual(r.locked.p2Deck.map(name), ["Phoenix Wing 9-60 GP", "Cobalt Dragoon 2-60 Elevate", "Shark Scale 3-60 Narrow"]);
  assert.deepStrictEqual(r.top.map(name), r.locked.p1Deck.map(name), "the screen's own state still gets the same order");
});

test("Start Match with the sides swapped still returns the right deck for each player", () => {
  const r = runConfirm({ swapped: true, topOrder: [2, 0, 1], botOrder: [1, 2, 0] });
  // swapped: the top block is player 2's deck, the bottom block is player 1's deck
  assert.deepStrictEqual(r.locked.p2Deck.map(name), ["Cobalt Dragoon 2-60 Elevate", "Shark Scale 3-60 Narrow", "Phoenix Wing 9-60 GP"]);
  assert.deepStrictEqual(r.locked.p1Deck.map(name), ["Wizard Rod 5-70 DB", "Hells Scythe 4-60 T", "Dran Sword 3-60 F"]);
});

const locked = { p1Deck: [D1[2], D1[0], D1[1]], p2Deck: [D2[1], D2[2], D2[0]] };

test("lock step stores plain combos in order and the first combos for the scoreboard", () => {
  const { deckExtra, ref } = runLock({ locked });
  assert.strictEqual(ref.current.id, 4242);
  assert.deepStrictEqual(ref.current.p1, [
    { blade: "Hells Scythe", ratchet: "4-60", bit: "T" },
    { blade: "Dran Sword", ratchet: "3-60", bit: "F" },
    { blade: "Wizard Rod", ratchet: "5-70", bit: "DB" }]);
  assert.strictEqual(ref.current.p2[0].blade, "Phoenix Wing");
  assert.deepStrictEqual(deckExtra.p1ActiveCombo, { blade: "Hells Scythe", ratchet: "4-60", bit: "T" });
  assert.deepStrictEqual(deckExtra.p2ActiveCombo, { blade: "Phoenix Wing", ratchet: "9-60", bit: "GP" });
});

test("the shuffle number of the set goes out with the order (second shuffle = 2)", () => {
  const { ref } = runLock({ locked, displayShuf: 2 });
  const { push, sent } = makePush({ ref });
  push({});
  assert.strictEqual(sent[0].deckOrder.shuf, 2);
});

test("an older caller that passes nothing does not break the lock step", () => {
  const { deckExtra, ref } = runLock({ locked: undefined });
  assert.strictEqual(deckExtra, null);
  assert.strictEqual(ref.current, null);
});

test("the push after the lock carries deckOrder and the new first combos (not the old order's)", () => {
  const { deckExtra, ref } = runLock({ locked });
  const { push, sent } = makePush({ ref });
  push({ shuffling: false, p1ComboIdx: 0, p2ComboIdx: 0, ...deckExtra });
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(sent[0].deckOrder, { id: 4242, shuf: 1, p1: ref.current.p1, p2: ref.current.p2 });
  assert.strictEqual(sent[0].p1ActiveCombo.blade, "Hells Scythe");
  assert.strictEqual(sent[0].p2ActiveCombo.blade, "Phoenix Wing");
});

test("a later push that is not a score (side change, judge name...) still carries it", () => {
  const { ref } = runLock({ locked });
  const { push, sent } = makePush({ ref });
  push({ p1Side: "B", p2Side: "X" });
  assert.strictEqual(sent[0].deckOrder.id, 4242);
});

test("the first scored battle clears it, and later pushes no longer carry it", () => {
  const { ref } = runLock({ locked });
  const { push, sent, env } = makePush({ ref });
  push({ lastFinish: { type: "XTR", scorerIdx: 0 }, pts: [3, 0] });
  assert.strictEqual(sent[0].deckOrder, undefined);
  assert.strictEqual(ref.current, null);
  env.pushOverlayDebounceRef.current = 0;
  push({ p1Side: "B" });
  assert.strictEqual(sent[1].deckOrder, undefined);
});

test("a launch error strike also counts as the first scoring push", () => {
  const { ref } = runLock({ locked });
  const { push, sent } = makePush({ ref });
  push({ lastFinish: { type: "LER-STRIKE", scorerIdx: 1 } });
  assert.strictEqual(sent[0].deckOrder, undefined);
  assert.strictEqual(ref.current, null);
});

test("a different pairing (old order left over) never carries it", () => {
  const { ref } = runLock({ locked, p1: "Leaf", p2: "Danny" });
  const { push, sent } = makePush({ ref, p1: "Sam", p2: "Alex" });
  push({});
  assert.strictEqual(sent[0].deckOrder, undefined);
});

test("a finished match never carries it", () => {
  const { ref } = runLock({ locked });
  const { push, sent } = makePush({ ref, phase: "over", matchOver: true });
  push({});
  assert.strictEqual(sent[0].deckOrder, undefined);
});

test("flags.js: flag 1028 is retired (the feature is always on)", () => {
  const set = slice(flagsSrc, "new Set([", "]);");
  assert(!/\b1028,/.test(set), "1028 should be gone from the list");
  assert(!/1028:\s*\{\s*name:/.test(flagsSrc), "1028 should be gone from the descriptions");
});

test("overlay.html: the layer, the trigger and the phase switch are present", () => {
  assert(overlay.includes('id="gfx-deck"'));
  assert(overlay.includes('el("gfx-deck").classList.toggle("off", p !== "deck")'));
  assert(/SPACE && state\.deckOrder && state\.deckOrder\.id && state\.deckOrder\.id !== lastDeckId/.test(overlay));
});

console.log("\n" + passed + " passed");
