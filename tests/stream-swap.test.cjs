// Behavioural test for the Stream swap button (flag 1008) and the battle
// header "?" (flag 1005). Runs the real code sliced from app.js.
// Run: node tests/stream-swap.test.cjs
// --espiiii
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const overlay = fs.readFileSync(path.join(__dirname, "..", "overlay.html"), "utf8");

function slice(src, start, endMarker, from = 0) {
  const i = src.indexOf(start, from);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i + start.length);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

const battle = app.indexOf("Battle screen: position:fixed full viewport");
const helpers = slice(app, "    const showStreamSwap = ", "    return /*#__PURE__*/React.createElement(React.Fragment", battle);
const pushSrc = slice(app, "  const pushOverlay = (extraState = {}) => {", "\n  pushOverlayLatestRef.current = pushOverlay;");
const swapClick = slice(app, "        setSwapped(s => !s);", "      },\n      style:", battle);

// Evaluate the Stream helpers with the given state.
function streamHelpers({ flagOn, overlaySlot, overlaySwapped }) {
  const calls = { set: [], push: [] };
  const ff = id => id === 1008 && flagOn;
  const out = new Function("ff", "overlaySlot", "overlaySwapped", "setOverlaySwapped", "pushOverlay",
    helpers + "; return { showStreamSwap, toggleStreamSwap };")(
    ff, overlaySlot, overlaySwapped, v => calls.set.push(v), x => calls.push.push(x));
  return { ...out, calls };
}

// Build pushOverlay and capture the state it sends.
function pushedState({ flagOn, swapped, overlaySwapped, extra = {} }) {
  let sent = null;
  const env = {
    ff: id => id === 1008 && flagOn,
    pushOverlayDebounceRef: { current: 0 },
    pushOverlayTrailExtraRef: { current: null },
    pushOverlayTrailTimerRef: { current: null },
    setTimeout: () => 0,
    r1: 0, r2: 0, d1: [{}], d2: [{}], currentMatch: [], p1: "A", p2: "B",
    currentSides: {}, pts: [0, 0], sets: [0, 0], curSet: 1, need: 2,
    config: { pts: 4, tm: true, tournamentName: "" }, judge: "J",
    challongeMatchId: 1, phase: "battle", overlaySlot: 1, OVERLAY_WORKER: "w",
    setOverlayStatus: () => {}, console: { log() {}, warn() {}, error() {} },
    swapped, overlaySwapped,
    fetch: (u, o) => { sent = JSON.parse(o.body).state; return Promise.resolve({ status: 200 }); }
  };
  const names = Object.keys(env);
  const push = new Function(...names, pushSrc.replace("const pushOverlay =", "return") + ";")(...names.map(n => env[n]));
  push(extra);
  return sent;
}

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
console.log("stream swap button (1008) + header ? (1005)");

test("Stream button shows only with 1008 on AND a stream slot", () => {
  assert.strictEqual(streamHelpers({ flagOn: true, overlaySlot: 1 }).showStreamSwap, true);
  assert.strictEqual(streamHelpers({ flagOn: true, overlaySlot: 0 }).showStreamSwap, false);
  assert.strictEqual(streamHelpers({ flagOn: false, overlaySlot: 2 }).showStreamSwap, false);
  assert.strictEqual(streamHelpers({ flagOn: false, overlaySlot: 0 }).showStreamSwap, false);
});

test("tapping Stream flips the overlay state and pushes the NEW value", () => {
  const h = streamHelpers({ flagOn: true, overlaySlot: 1, overlaySwapped: false });
  h.toggleStreamSwap();
  assert.deepStrictEqual(h.calls.set, [true]);
  assert.deepStrictEqual(h.calls.push, [{ swapped: true }]);
  const h2 = streamHelpers({ flagOn: true, overlaySlot: 1, overlaySwapped: true });
  h2.toggleStreamSwap();
  assert.deepStrictEqual(h2.calls.push, [{ swapped: false }]);
});

test("overlay gets the overlay-only swap, not the judge's Swap", () => {
  assert.strictEqual(pushedState({ flagOn: true, swapped: true, overlaySwapped: false }).swapped, false);
  assert.strictEqual(pushedState({ flagOn: true, swapped: false, overlaySwapped: true }).swapped, true);
});

test("Stream push overrides the not-yet-updated state", () => {
  // setOverlaySwapped is async, so state is still false when the push runs
  assert.strictEqual(pushedState({ flagOn: true, swapped: false, overlaySwapped: false, extra: { swapped: true } }).swapped, true);
});

test("flag off: no swapped field is sent at all", () => {
  const st = pushedState({ flagOn: false, swapped: true, overlaySwapped: true });
  assert.strictEqual("swapped" in st, false);
});

test("judge's own Swap no longer pushes to the overlay", () => {
  let pushes = 0;
  const run = new Function("setSwapped", "setCurrentSides", "setSideAssign", "pushOverlay", "ff", "swapped", "currentSides", swapClick);
  run(() => {}, () => {}, () => {}, () => { pushes++; }, () => true, false, { p1Side: "B", p2Side: "X" });
  assert.strictEqual(pushes, 0);
});

test("overlay swap resets each match and survives a refresh", () => {
  const resetFn = slice(app, "  const reset = () => {", "\n  };\n");
  assert(resetFn.includes("setOverlaySwapped(false);"), "reset() must clear overlaySwapped");
  assert(/matchStartIdx, swapped, matchKey, overlaySwapped\n\s+\}\);/.test(app), "resume snapshot must save overlaySwapped");
  assert(app.includes("matchStartIdx, swapped, matchKey, overlaySwapped]);"), "snapshot effect must depend on overlaySwapped");
  assert(app.includes("useState(_resume ? !!_resume.overlaySwapped : false)"), "state must restore from the snapshot");
});

test("overlay mirrors only with 1009 on and an explicit swapped:true", () => {
  const line = overlay.match(/scoreboard\.classList\.toggle\("swapped", ([^;]+)\);/)[1];
  const mirrors = (on, st) => new Function("ff", "state", "return " + line)(id => id === 1009 && on, st);
  assert.strictEqual(mirrors(true, { swapped: true }), true);
  assert.strictEqual(mirrors(false, { swapped: true }), false);
  assert.strictEqual(mirrors(true, {}), false);
});

test("battle header renders the ? (1005) next to the cog, before it", () => {
  const right = slice(app, "    return /*#__PURE__*/React.createElement(React.Fragment, null, ff(1005)", "onClick: () => setSettingsMenuOpen(o => !o)", battle);
  assert(right.includes("React.createElement(BugReportInlineButton, null)"));
});

console.log(`\n${passed} passed`);
