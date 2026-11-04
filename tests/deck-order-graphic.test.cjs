// Behavioural test for flag 1028 (deck order graphic on the stream overlay).
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
function runLock({ flagOn, locked, p1 = "Leaf", p2 = "Danny" }) {
  const deckOrderRef = { current: null };
  const deckExtra = new Function("ff", "locked", "deckOrderRef", "p1", "p2", "Date", lockSrc + "; return deckExtra;")(
    id => id === 1028 && flagOn, locked, deckOrderRef, p1, p2, { now: () => 4242 });
  return { deckExtra, ref: deckOrderRef };
}

// The real pushOverlay, with every sent state captured.
function makePush({ flagOn, ref, phase = "battle", p1 = "Leaf", p2 = "Danny", matchOver = false }) {
  const sent = [];
  const env = {
    ff: id => id === 1028 && flagOn,
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

console.log("deck order graphic (flag 1028)");

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
  const { deckExtra, ref } = runLock({ flagOn: true, locked });
  assert.strictEqual(ref.current.id, 4242);
  assert.deepStrictEqual(ref.current.p1, [
    { blade: "Hells Scythe", ratchet: "4-60", bit: "T" },
    { blade: "Dran Sword", ratchet: "3-60", bit: "F" },
    { blade: "Wizard Rod", ratchet: "5-70", bit: "DB" }]);
  assert.strictEqual(ref.current.p2[0].blade, "Phoenix Wing");
  assert.deepStrictEqual(deckExtra.p1ActiveCombo, { blade: "Hells Scythe", ratchet: "4-60", bit: "T" });
  assert.deepStrictEqual(deckExtra.p2ActiveCombo, { blade: "Phoenix Wing", ratchet: "9-60", bit: "GP" });
});

test("flag OFF: nothing stored, nothing extra sent", () => {
  const { deckExtra, ref } = runLock({ flagOn: false, locked });
  assert.strictEqual(deckExtra, null);
  assert.strictEqual(ref.current, null);
});

test("an older caller that passes nothing does not break the lock step", () => {
  const { deckExtra, ref } = runLock({ flagOn: true, locked: undefined });
  assert.strictEqual(deckExtra, null);
  assert.strictEqual(ref.current, null);
});

test("the push after the lock carries deckOrder and the new first combos (not the old order's)", () => {
  const { deckExtra, ref } = runLock({ flagOn: true, locked });
  const { push, sent } = makePush({ flagOn: true, ref });
  push({ shuffling: false, p1ComboIdx: 0, p2ComboIdx: 0, ...deckExtra });
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(sent[0].deckOrder, { id: 4242, p1: ref.current.p1, p2: ref.current.p2 });
  assert.strictEqual(sent[0].p1ActiveCombo.blade, "Hells Scythe");
  assert.strictEqual(sent[0].p2ActiveCombo.blade, "Phoenix Wing");
});

test("a later push that is not a score (side change, judge name...) still carries it", () => {
  const { ref } = runLock({ flagOn: true, locked });
  const { push, sent } = makePush({ flagOn: true, ref });
  push({ p1Side: "B", p2Side: "X" });
  assert.strictEqual(sent[0].deckOrder.id, 4242);
});

test("the first scored battle clears it, and later pushes no longer carry it", () => {
  const { ref } = runLock({ flagOn: true, locked });
  const { push, sent, env } = makePush({ flagOn: true, ref });
  push({ lastFinish: { type: "XTR", scorerIdx: 0 }, pts: [3, 0] });
  assert.strictEqual(sent[0].deckOrder, undefined);
  assert.strictEqual(ref.current, null);
  env.pushOverlayDebounceRef.current = 0;
  push({ p1Side: "B" });
  assert.strictEqual(sent[1].deckOrder, undefined);
});

test("a launch error strike also counts as the first scoring push", () => {
  const { ref } = runLock({ flagOn: true, locked });
  const { push, sent } = makePush({ flagOn: true, ref });
  push({ lastFinish: { type: "LER-STRIKE", scorerIdx: 1 } });
  assert.strictEqual(sent[0].deckOrder, undefined);
  assert.strictEqual(ref.current, null);
});

test("a different pairing (old order left over) never carries it", () => {
  const { ref } = runLock({ flagOn: true, locked, p1: "Leaf", p2: "Danny" });
  const { push, sent } = makePush({ flagOn: true, ref, p1: "Sam", p2: "Alex" });
  push({});
  assert.strictEqual(sent[0].deckOrder, undefined);
});

test("a finished match never carries it", () => {
  const { ref } = runLock({ flagOn: true, locked });
  const { push, sent } = makePush({ flagOn: true, ref, phase: "over", matchOver: true });
  push({});
  assert.strictEqual(sent[0].deckOrder, undefined);
});

test("flag OFF: pushes are exactly as before (no deckOrder key at all)", () => {
  const { ref } = runLock({ flagOn: true, locked });
  const { push, sent } = makePush({ flagOn: false, ref });
  push({});
  assert.strictEqual("deckOrder" in sent[0], false);
});

test("flags.js: 1028 is on by default and has a menu description", () => {
  const set = slice(flagsSrc, "new Set([", "]);");
  assert(/\b1028,/.test(set), "1028 missing from the default-on list");
  assert(/1028:\s*\{\s*name:/.test(flagsSrc), "1028 missing from the descriptions");
});

test("overlay.html: the layer, the trigger and the phase switch are present", () => {
  assert(overlay.includes('id="gfx-deck"'));
  assert(overlay.includes('el("gfx-deck").classList.toggle("off", p !== "deck")'));
  assert(/ff\(1028\) && state\.deckOrder && state\.deckOrder\.id && state\.deckOrder\.id !== lastDeckId/.test(overlay));
});

console.log("\n" + passed + " passed");
