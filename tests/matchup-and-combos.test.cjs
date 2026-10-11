// Behavioural tests for flag 1011 (new matchup reaches the overlay, stream
// slot kept between matches) and flag 1010 (2x overlay combos).
// Runs the real code sliced from app.js / overlay.html.
// Run: node tests/matchup-and-combos.test.cjs
// --espiiii
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const overlay = fs.readFileSync(path.join(root, "overlay.html"), "utf8");

function slice(src, start, endMarker, from = 0) {
  const i = src.indexOf(start, from);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i + start.length);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

// reset() body, run inside a scope where every identifier is a recording stub.
const resetBody = slice(app, "  const reset = () => {", "\n  };\n").replace("  const reset = () => {", "");
function runReset(flagOn) {
  const calls = [];
  const storage = {};
  const known = {
    ff: id => id === 1011 && flagOn,
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
function makeMatchupEffect(flagOn) {
  const ref = { current: "" };
  const pushes = [];
  const run = new Function("ff", "lastMatchupRef", "pushOverlay", "phase", "p1", "p2", effectBody);
  return {
    render: (phase, p1, p2) => run(id => id === 1011 && flagOn, ref, x => pushes.push(x), phase, p1, p2),
    pushes
  };
}

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
console.log("new matchup + stream slot (1011), 2x combos (1010)");

test("1011 off: reset() turns the stream slot off, as before", () => {
  const { calls, storage } = runReset(false);
  assert(calls.some(c => c[0] === "setOverlaySlot" && c[1] === 0));
  assert.strictEqual(storage["bx-overlay-slot-v1"], "0");
});

test("1011 on: reset() keeps the stream slot", () => {
  const { calls, storage } = runReset(true);
  assert(!calls.some(c => c[0] === "setOverlaySlot"), "must not touch the slot");
  assert(!("bx-overlay-slot-v1" in storage), "must not save slot 0");
});

test("1011 on: reset() still resets the rest of the match", () => {
  const { calls } = runReset(true);
  for (const fn of ["setP1", "setP2", "setPts", "setSets", "setSwapped"]) {
    assert(calls.some(c => c[0] === fn), fn + " should still run");
  }
});

test("picking a new matchup pushes it once, at 0-0 / set 1 / no combos", () => {
  const e = makeMatchupEffect(true);
  e.render("pick", "A", null);   // only one player picked: nothing yet
  e.render("pick", "A", "B");    // both picked: push
  e.render("pick", "A", "B");    // re-render, same pair: no repeat
  assert.strictEqual(e.pushes.length, 1);
  assert.deepStrictEqual(e.pushes[0], { pts: [0, 0], sets: [0, 0], curSet: 1, matchOver: false, p1ComboIdx: null, p2ComboIdx: null });
});

test("changing the pairing on the pick screen pushes the new one", () => {
  const e = makeMatchupEffect(true);
  e.render("pick", "A", "B");
  e.render("pick", "A", "C");
  assert.strictEqual(e.pushes.length, 2);
});

test("no push once the match has started", () => {
  const e = makeMatchupEffect(true);
  e.render("battle", "A", "B");
  e.render("over", "A", "B");
  assert.strictEqual(e.pushes.length, 0);
});

test("a later rematch of the same pair still pushes", () => {
  const e = makeMatchupEffect(true);
  e.render("pick", "A", "B");
  e.render("battle", "A", "B");
  e.render("pick", "A", "B");
  assert.strictEqual(e.pushes.length, 2);
});

test("1011 off: never pushes", () => {
  const e = makeMatchupEffect(false);
  e.render("pick", "A", "B");
  e.render("pick", "C", "D");
  assert.strictEqual(e.pushes.length, 0);
});

test("1010: overlay turns the 2x class on only with the flag", () => {
  const line = overlay.match(/if \(ff\(1010\)\) document\.body\.classList\.add\("ff-1010"\);/);
  assert(line, "1010 class toggle missing");
  const css = slice(overlay, "body.ff-1010 .combo-part {", "}");
  assert(/font-size:\s*24px/.test(css), "combo chips must be 24px (2x of 12px)");
  const base = slice(overlay, "  .combo-part {", "}");
  assert(/font-size:\s*12px/.test(base), "base size must stay 12px with the flag off");
});

console.log(`\n${passed} passed`);
