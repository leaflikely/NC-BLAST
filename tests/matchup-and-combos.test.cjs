// Behavioural tests for the new matchup reaching the overlay and the stream slot being kept
// between matches (was flag 1011, now always on).
// Runs the real code sliced from the app files.
// Run: node tests/matchup-and-combos.test.cjs
// --espiiii
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const { loadApp, loadText, root: ROOT } = require("./load-app.cjs");
const app = loadApp(); // all the app script files, in load order
const overlay = loadText("overlay.html");

function slice(src, start, endMarker, from = 0) {
  const i = src.indexOf(start, from);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i + start.length);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

// reset() body, run inside a scope where every identifier is a recording stub.
const resetBody = slice(app, "  const reset = () => {", "\n  };\n").replace("  const reset = () => {", "");
function runReset() {
  const calls = [];
  const storage = {};
  const known = {
    KEYS: { overlaySlot: "bx-overlay-slot-v1", matchResume: "ncblast-match-resume-v1" },
    localStorage: { setItem: (k, v) => { storage[k] = v; } },
    log: [], emptyCombo: () => ({}), p1Ref: {}, p2Ref: {}
  };
  const scope = new Proxy({}, {
    has: () => true,
    get: (_, name) => {
      if (name === Symbol.unscopables) return undefined;
      if (name in known) return known[name];
      if (name in globalThis) return globalThis[name];
      return (...args) => { calls.push([name, ...args]); };
    }
  });
  new Function("scope", "with (scope) {" + resetBody + "}")(scope);
  return { calls, storage };
}

// The 1011 matchup effect, run against a sequence of renders.
const effectSrc = slice(app, "  const lastMatchupRef = useRef(\"\");", "  }, [p1, p2, phase]);");
// effectSrc already stops before the closing "}, [deps]", so the body is
// everything after the opening of the effect callback.
const effectBody = effectSrc.slice(effectSrc.indexOf("useEffect(() => {") + "useEffect(() => {".length);
function makeMatchupEffect() {
  const ref = { current: "" };
  const pushes = [];
  const run = new Function("lastMatchupRef", "pushOverlay", "phase", "p1", "p2", effectBody);
  return {
    render: (phase, p1, p2) => run(ref, x => pushes.push(x), phase, p1, p2),
    pushes
  };
}

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
console.log("new matchup + stream slot");

test("reset() keeps the stream slot", () => {
  const { calls, storage } = runReset();
  assert(!calls.some(c => c[0] === "setOverlaySlot"), "must not touch the slot");
  assert(!("bx-overlay-slot-v1" in storage), "must not save slot 0");
});

test("reset() still resets the rest of the match", () => {
  const { calls } = runReset();
  for (const fn of ["setP1", "setP2", "setPts", "setSets", "setSwapped"]) {
    assert(calls.some(c => c[0] === fn), fn + " should still run");
  }
});

test("picking a new matchup pushes it once, at 0-0 / set 1 / no combos", () => {
  const e = makeMatchupEffect();
  e.render("pick", "A", null);   // only one player picked: nothing yet
  e.render("pick", "A", "B");    // both picked: push
  e.render("pick", "A", "B");    // re-render, same pair: no repeat
  assert.strictEqual(e.pushes.length, 1);
  assert.deepStrictEqual(e.pushes[0], { pts: [0, 0], sets: [0, 0], curSet: 1, matchOver: false, p1ComboIdx: null, p2ComboIdx: null });
});

test("changing the pairing on the pick screen pushes the new one", () => {
  const e = makeMatchupEffect();
  e.render("pick", "A", "B");
  e.render("pick", "A", "C");
  assert.strictEqual(e.pushes.length, 2);
});

test("no push once the match has started", () => {
  const e = makeMatchupEffect();
  e.render("battle", "A", "B");
  e.render("over", "A", "B");
  assert.strictEqual(e.pushes.length, 0);
});

test("a later rematch of the same pair still pushes", () => {
  const e = makeMatchupEffect();
  e.render("pick", "A", "B");
  e.render("battle", "A", "B");
  e.render("pick", "A", "B");
  assert.strictEqual(e.pushes.length, 2);
});


console.log(`\n${passed} passed`);
