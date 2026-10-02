// Behavioural test for flag 1006 (overlay set dots).
// Runs the real code from app.js and overlay.html - no copies - and checks how
// many set dots the stream overlay would draw after a set-winning point.
// Run: node tests/overlay-set-dots.test.cjs
// --espiiii
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const overlay = fs.readFileSync(path.join(root, "overlay.html"), "utf8");

function slice(src, start, endMarker) {
  const i = src.indexOf(start);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

// The set-count block in doScore, from its comment to the LER branch.
const setsBlock = slice(app, "    const setsAfter = setWon ?", "    // LER");
// pushOverlay itself.
const pushSrc = slice(app, "  const pushOverlay = (extraState = {}) => {", "\n  pushOverlayLatestRef.current = pushOverlay;");
// The overlay's dot renderer.
const dotsSrc = slice(overlay, "function renderDots(", "// ── POP ANIMATION");

function computeSetsExtra({ flagOn, setWon, sets, scoringPi, need }) {
  const ff = id => id === 1006 && flagOn;
  return new Function("ff", "setWon", "sets", "scoringPi", "need", setsBlock + "; return setsExtra;")(ff, setWon, sets, scoringPi, need);
}

// Build pushOverlay with the given state; every fetch body is captured.
function makePush({ flagOn, sets, phase = "battle", need = 2 }) {
  const sent = [];
  const timers = [];
  const env = {
    ff: id => id === 1006 && flagOn,
    pushOverlayDebounceRef: { current: 0 },
    pushOverlayTrailExtraRef: { current: null },
    pushOverlayTrailTimerRef: { current: null },
    pushOverlayLatestRef: { current: null },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    r1: 0, r2: 0, d1: [{}], d2: [{}],
    currentMatch: [], p1: "A", p2: "B",
    currentSides: {}, pts: [0, 0], sets, curSet: 2, need,
    config: { pts: 4, tm: false, tournamentName: "T" },
    judge: "J", challongeMatchId: 123, phase, overlaySlot: 0,
    OVERLAY_WORKER: "https://w",
    setOverlayStatus: () => {},
    console: { log() {}, warn() {}, error() {} },
    fetch: (url, opts) => { sent.push(JSON.parse(opts.body).state); return Promise.resolve({ status: 200 }); }
  };
  const names = Object.keys(env);
  const push = new Function(...names, pushSrc.replace("const pushOverlay =", "return") + ";")(...names.map(n => env[n]));
  env.pushOverlayLatestRef.current = push;
  return { push, sent, timers, env };
}

// Count the won dots the overlay would draw for each player.
function overlayDots(state) {
  const els = {};
  const el = id => (els[id] = els[id] || { innerHTML: "" });
  const renderDots = new Function("el", dotsSrc + "; return renderDots;")(el);
  const need = state.setsNeeded || 1;
  renderDots("p1", (state.sets || [0, 0])[0], need, "p1-dot");
  renderDots("p2", (state.sets || [0, 0])[1], need, "p2-dot");
  const won = id => (els[id].innerHTML.match(/ won"/g) || []).length;
  return [won("p1"), won("p2")];
}

// The two real scoring push calls in doScore: the Launch Error one and the
// normal one. Run as written, so dropping ...setsExtra from either fails a test.
const lerCall = slice(app, '    if (fin.id === "LER") {\n      pushOverlay({', "      if (setWon) {")
  .replace('    if (fin.id === "LER") {\n', "");
const normalCall = slice(app, "    pushOverlay({\n      lastFinish: {\n        type: fin.id,", "    if (setWon) {\n      const ns");
assert(!normalCall.includes('"LER"'), "normal call slice must not be the LER one");

// One scoring point, through the real call site.
function scorePoint({ flagOn, setsBefore, scoringPi, setWon, ler = false }) {
  const { push, sent } = makePush({ flagOn, sets: setsBefore });
  const setsExtra = computeSetsExtra({ flagOn, setWon, sets: setsBefore, scoringPi, need: 2 });
  const call = ler ? lerCall : normalCall;
  new Function("pushOverlay", "fin", "scoringPi", "np", "setWon", "nxR1", "nxR2", "setsExtra", call)(
    push, { id: ler ? "LER" : "XTR" }, scoringPi, [4, 1], setWon, 0, 0, setsExtra);
  return sent[0];
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

console.log("overlay set dots (flag 1006)");

test("flag OFF reproduces the bug: 2-0 winning point leaves the overlay at 1 dot", () => {
  const s = scorePoint({ flagOn: false, setsBefore: [1, 0], scoringPi: 0, setWon: true });
  assert.deepStrictEqual(overlayDots(s), [1, 0]);
  assert.strictEqual(s.matchOver, false);
});

test("flag ON: 2-0 winning point shows both dots and matchOver", () => {
  const s = scorePoint({ flagOn: true, setsBefore: [1, 0], scoringPi: 0, setWon: true });
  assert.deepStrictEqual(overlayDots(s), [2, 0]);
  assert.strictEqual(s.matchOver, true);
});

test("flag ON: 2-1 decider for player 2 shows 1 and 2 dots", () => {
  const s = scorePoint({ flagOn: true, setsBefore: [1, 1], scoringPi: 1, setWon: true });
  assert.deepStrictEqual(overlayDots(s), [1, 2]);
  assert.strictEqual(s.matchOver, true);
});

test("flag ON: first set won shows its dot right away, match not over", () => {
  const s = scorePoint({ flagOn: true, setsBefore: [0, 0], scoringPi: 0, setWon: true });
  assert.deepStrictEqual(overlayDots(s), [1, 0]);
  assert.strictEqual(s.matchOver, false);
});

test("flag ON: a point that does not win the set changes no dots", () => {
  const s = scorePoint({ flagOn: true, setsBefore: [1, 0], scoringPi: 1, setWon: false });
  assert.deepStrictEqual(overlayDots(s), [1, 0]);
  assert.strictEqual(s.matchOver, false);
});

test("flag ON: Launch Error point that wins the match shows both dots", () => {
  const st = scorePoint({ flagOn: true, setsBefore: [0, 1], scoringPi: 1, setWon: true, ler: true });
  assert.deepStrictEqual(overlayDots(st), [0, 2]);
  assert.strictEqual(st.matchOver, true);
});

test("flag OFF: Launch Error point keeps the old (buggy) count", () => {
  const st = scorePoint({ flagOn: false, setsBefore: [0, 1], scoringPi: 1, setWon: true, ler: true });
  assert.deepStrictEqual(overlayDots(st), [0, 1]);
});

test("flag OFF: a push inside 500ms is dropped (old behaviour)", () => {
  const { push, sent, timers } = makePush({ flagOn: false, sets: [0, 0] });
  push({ pts: [1, 0] });
  push({ pts: [2, 0] });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(timers.length, 0);
});

test("flag ON: pushes inside 500ms are held and only the newest is sent", () => {
  const { push, sent, timers, env } = makePush({ flagOn: true, sets: [0, 0] });
  push({ pts: [1, 0] });
  push({ pts: [2, 0] });
  push({ pts: [3, 0], sets: [1, 0] });
  assert.strictEqual(sent.length, 1, "second and third are held, not sent yet");
  assert.strictEqual(timers.length, 1, "one timer, not one per held push");
  assert(timers[0].ms > 0 && timers[0].ms <= 520);
  env.pushOverlayDebounceRef.current -= 1000; // the window has passed
  timers[0].fn();
  assert.strictEqual(sent.length, 2);
  assert.deepStrictEqual(sent[1].pts, [3, 0]);
  assert.deepStrictEqual(sent[1].sets, [1, 0]);
});

test("flag ON: a push that goes out after the window cancels the held one", () => {
  const { push, sent, timers, env } = makePush({ flagOn: true, sets: [0, 0] });
  push({ pts: [1, 0] });
  push({ pts: [2, 0] }); // held
  env.pushOverlayDebounceRef.current -= 1000;
  push({ pts: [3, 0] }); // goes out now
  // Fire every timer that comes due, with the window passed each time. A stale
  // held push must never go out after the newer one, even on a later timer.
  for (let i = 0; i < timers.length && i < 10; i++) {
    env.pushOverlayDebounceRef.current -= 1000;
    timers[i].fn();
  }
  assert.deepStrictEqual(sent.map(s => s.pts[0]), [1, 3]);
});

console.log(`\n${passed} passed`);
