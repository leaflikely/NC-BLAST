// Behavioural tests for the Report-a-problem feature (flag 1005).
// Runs the real code sliced from app.js against fake storage and elements.
// Committed on purpose: this feature was silently deleted once by an upload of
// an older app.js, and nothing failed. These tests fail if it disappears again.
// Run: node tests/bug-report.test.cjs
// --espiiii
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const { loadApp, loadText, root: ROOT } = require("./load-app.cjs");
const app = loadApp(); // all the app script files, in load order

function slice(start, endMarker) {
  const i = app.indexOf(start);
  assert(i >= 0, "not found: " + start);
  const j = app.indexOf(endMarker, i);
  assert(j > i, "end not found after: " + start);
  return app.slice(i, j);
}

const flagsBlk = slice("const FLAG_OVERRIDE_KEY", "/* ═══════════════════════════════════════\n   BUG REPORTS — FLAG 1005 (recording)");
const recBlk = slice("const BUGLOG_KEY", "/* ═══════════════════════════════════════\n   VIEWPORT SCALE");
const repBlk = slice("function _bugId()", "const _bugFont");

function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i],
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k)
  };
}

// Minimal element for the tap recorder: closest/getAttribute/querySelector.
function el(tag, { text = "", attrs = {}, disabled = false, checked = false, children = [] } = {}) {
  const e = {
    tagName: tag.toUpperCase(), textContent: text, disabled, checked, attrs, parent: null, children,
    getAttribute: k => (k in attrs ? attrs[k] : null),
    matches(sel) {
      return sel.split(",").map(s => s.trim()).some(s => {
        const m = s.match(/^([a-z]+)?(?:\[([a-z-]+)(?:="([^"]+)")?\])?$/);
        if (!m) return false;
        const [, t, a, v] = m;
        if (t && t !== tag) return false;
        if (a) { if (!(a in attrs)) return false; if (v && attrs[a] !== v) return false; }
        return !!(t || a);
      });
    },
    closest(sel) { for (let n = this; n; n = n.parent) if (n.matches(sel)) return n; return null; },
    querySelector() {
      const hit = c => c.tagName === "TEXTAREA" || (c.tagName === "INPUT" && !["checkbox", "radio"].includes(c.attrs.type));
      const walk = n => n.children.some(c => hit(c) || walk(c));
      return walk(this) ? {} : null;
    }
  };
  children.forEach(c => (c.parent = e));
  return e;
}

function boot(flagOn, extra = {}) {
  const winListeners = {};
  const docListeners = [];
  const win = Object.assign({
    FEATURE_FLAGS: new Set(flagOn ? [1005] : []), FEATURE_FLAG_INFO: { 1005: {} },
    addEventListener: (t, f) => (winListeners[t] = (winListeners[t] || []).concat(f)),
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
    fetch: async u => (String(u).includes("fail") ? Promise.reject(Object.assign(new Error("x"), { name: "TypeError" })) : { status: String(u).includes("404") ? 404 : 200 })
  }, extra.win || {});
  const doc = { addEventListener: (t, f, o) => docListeners.push({ t, f, o }) };
  const local = store(extra.local || {});
  const session = store(extra.session || {});
  const con = { error() {}, warn() {} };
  const api = new Function("window", "document", "localStorage", "sessionStorage", "console", "location", "navigator", "screen",
    flagsBlk + recBlk + repBlk + "; return { ff, bugLog, BUGLOG, buildBugReport };")(
    win, doc, local, session, con,
    { origin: "https://ncblast.pages.dev", pathname: "/", href: "https://ncblast.pages.dev/?handoff=SECRETHANDOFF" },
    { userAgent: "test", language: "en", onLine: true }, { width: 390, height: 844 });
  const tap = target => docListeners.filter(l => l.t === "pointerdown").forEach(l => l.f({ target }));
  return { api, win, con, winListeners, docListeners, tap };
}

let passed = 0;
const test = (name, fn) => { const r = fn(); return Promise.resolve(r).then(() => { passed++; console.log("  ok  " + name); }); };

(async () => {
  console.log("report a problem (1005)");

  await test("the feature exists: recorder, report builder, ? button, mount", () => {
    for (const marker of ["function bugLog(", "function buildBugReport(", "function BugReporter(", "function BugReportInlineButton(", "ReactDOM.createRoot(el).render(/*#__PURE__*/React.createElement(BugReporter"]) {
      assert(app.includes(marker), "missing: " + marker);
    }
  });

  await test("every component the ? uses is defined (no crash with 1005 on)", () => {
    for (const name of ["BugReporter", "BugReportInlineButton"]) {
      const used = app.includes(`React.createElement(${name}`);
      const defined = new RegExp(`^function ${name}\\(`, "m").test(app);
      assert(!used || defined, `${name} is rendered but never defined`);
    }
  });

  await test("battle header shows the ? before the cog", () => {
    const i = app.indexOf("ff(1005) && /*#__PURE__*/React.createElement(BugReportInlineButton, null)");
    const cog = app.indexOf("onClick: () => setSettingsMenuOpen(o => !o)");
    assert(i > 0 && cog > i && cog - i < 1500, "? must sit just before the cog button");
  });

  await test("flag off: no listeners, fetch untouched, nothing recorded", () => {
    const b = boot(false);
    const orig = b.win.fetch;
    b.api.bugLog("x", "y");
    assert.strictEqual(Object.keys(b.winListeners).length, 0);
    assert.strictEqual(b.docListeners.length, 0);
    assert.strictEqual(b.win.fetch, orig);
    assert.strictEqual(b.api.BUGLOG.length, 0);
  });

  await test("flag on: records errors and failed requests, passes responses through", async () => {
    const b = boot(true);
    b.con.error(new Error("boom"));
    const ok = await b.win.fetch("https://w/overlay/poll?slot=1&token=abc");
    const nf = await b.win.fetch("https://w/404?auth=zzz");
    let threw = false;
    try { await b.win.fetch("https://w/fail?x=1"); } catch { threw = true; }
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(nf.status, 404);
    assert(threw, "failed fetch must still throw");
    const kinds = b.api.BUGLOG.map(e => e.k + ":" + e.m.split("\n")[0]);
    assert(kinds.some(k => k.startsWith("console.error:Error: boom")));
    assert(kinds.some(k => k === "net:GET https://w/404 -> 404"));
    assert(kinds.some(k => k.startsWith("net:GET https://w/fail failed")));
    assert(!kinds.some(k => k.includes("overlay/poll")), "successful polls must not be recorded");
  });

  await test("taps: label + (disabled); typed text never recorded", () => {
    const b = boot(true);
    const span = el("span", { text: "Submit results" });
    el("button", { text: " Submit\n results ", children: [span] });
    b.tap(span);
    b.tap(el("button", { text: "Submit results", disabled: true }));
    b.tap(el("textarea", { text: "MY SECRET CODE 1234" }));
    b.tap(el("label", { text: "Password MY SECRET CODE 1234", children: [el("input", { attrs: { type: "password" } })] }));
    const u = el("button", { text: "Undo" });
    b.tap(u); b.tap(u);
    const taps = b.api.BUGLOG.filter(e => e.k === "tap").map(e => e.m);
    assert(taps.includes('tapped "Submit results"'));
    assert(taps.includes('tapped "Submit results" (disabled)'));
    assert.strictEqual(taps.filter(t => t === 'tapped "Undo"').length, 1, "double fire collapses");
    assert(!JSON.stringify(b.api.BUGLOG).includes("SECRET"), "typed text leaked");
  });

  await test("report: bug id, live state, current match only, no secrets", () => {
    const b = boot(true, {
      local: { "bx-matchlog-v1": JSON.stringify([{ matchKey: "K1", p1Name: "A" }, { matchKey: "OLD", p1Name: "Z" }]), "ncblast-master-key": "MASTER_KEY_XYZ" },
      session: { "ncblast-auth-token": "tok_SUPERSECRET_123", "ncblast-match-resume-v1": JSON.stringify({ phase: "battle", matchKey: "K1" }) },
      win: { __ncbLiveMatch: { phase: "over", bracketSubmitStatus: "match already complete" }, __ncbLiveApp: { area: "judge" } }
    });
    const r = b.api.buildBugReport("Submit did nothing");
    const json = JSON.stringify(r);
    assert(/^NCB-\d{4}-[A-Z2-9]{4}$/.test(r.id), "bad id " + r.id);
    assert.strictEqual(r.reportVersion, 2);
    assert.strictEqual(r.live.match.bracketSubmitStatus, "match already complete");
    assert.strictEqual(r.battles.currentMatch.length, 1);
    for (const secret of ["tok_SUPERSECRET_123", "MASTER_KEY_XYZ", "SECRETHANDOFF"]) {
      assert(!json.includes(secret), "leaked " + secret);
    }
  });

  console.log(`\n${passed} passed`);
})().catch(e => { console.error(e); process.exit(1); });
