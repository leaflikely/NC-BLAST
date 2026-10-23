// Behavioural tests for flag 1013 (send to database beside the Sheets submit,
// judge name required to submit) and the UXE no-ratchet list fix.
// Runs the real code sliced out of app.js / flags.js - no network is touched,
// fetch is a fake that returns whatever each test tells it to.
// Run: node tests/database-send.test.cjs
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
let helper; try { helper = require("./tests/load-app.cjs"); } catch (_) { helper = require("./load-app.cjs"); } // works from the top folder or from tests/
const app = helper.loadApp(); // all the app script files, in load order
const flags = helper.loadText("flags.js");

function slice(src, start, endMarker) {
  const i = src.indexOf(start);
  assert(i >= 0, "not found: " + start);
  const j = src.indexOf(endMarker, i + start.length);
  assert(j > i, "end not found after: " + start);
  return src.slice(i, j);
}

// The three database functions, exactly as written in app.js.
const dbBlock = slice(app, "  const postDatabasePayload = async", "\n  // Send to Google Sheets only");

// Builds a fresh copy of the database code with a fake network + recording stubs.
function makeDb(fetchImpl) {
  const statuses = [];
  const errors = [];
  const csv = [];
  const fetches = [];
  const logs = [];
  const known = {
    ff: () => true,
    OVERLAY_WORKER: "https://worker.test",
    setDbStatus: s => statuses.push(s),
    setDbError: e => errors.push(e),
    lastDbPayloadRef: { current: null },
    dbPendingRef: { current: null },
    dbCsvPayloadRef: { current: null },
    handleDownloadCSV: (rl, meta) => csv.push([rl, meta]),
    bugLog: () => {},
    console: { log: (...a) => logs.push(a.join(" ")), warn: () => {} },
    fetch: (url, opts) => { fetches.push({ url, opts }); return fetchImpl(url, opts); }
  };
  const scope = new Proxy({}, {
    has: () => true,
    get: (_, name) => {
      if (name === Symbol.unscopables) return undefined;
      if (name in known) return known[name];
      return globalThis[name];
    }
  });
  const fns = new Function("scope", "with (scope) {" + dbBlock + "\nreturn { sendToDatabase, handleRetryDatabase }; }")(scope);
  return { ...fns, statuses, errors, csv, fetches, logs, refs: known };
}

const okReply = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
const ROWS = [["t", "Judge A", "Event", "A vs B", "A~P~", "B", "B", "X", 1, 1, 1, "A", "combo", "XTR", 3, 0, 3, 0, "c1", "c2"]];
const META = { challongeSlug: "ncbl-test", judge: "Judge A" };

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log("  ok  " + name); };

(async () => {
  console.log("send to database (1013), judge name, UXE no-ratchet list");

  await test("success: POSTs to /db/ingest as normal JSON CORS, with slug, the same rows, flagged", async () => {
    const db = makeDb(() => okReply({ ok: true, inserted: 1, skipped: 0, notes: [] }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.strictEqual(db.fetches.length, 1);
    const { url, opts } = db.fetches[0];
    assert.strictEqual(url, "https://worker.test/db/ingest");
    assert.strictEqual(opts.method, "POST");
    assert.strictEqual(opts.headers["Content-Type"], "application/json");
    assert(!("mode" in opts), "must not be no-cors, or the reply cannot be read");
    assert(opts.signal, "needs a timeout signal");
    const sent = JSON.parse(opts.body);
    assert.strictEqual(sent.slug, "ncbl-test");
    assert.deepStrictEqual(sent.rows, ROWS);
    assert.strictEqual(sent.flagged, false);
    assert.deepStrictEqual(db.statuses, ["sending", "sent"]);
    assert.strictEqual(db.csv.length, 0);
  });

  await test("skipped > 0 (a repeat submit the database already had) is still a success", async () => {
    const db = makeDb(() => okReply({ ok: true, inserted: 0, skipped: 1 }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.deepStrictEqual(db.statuses, ["sending", "sent"]);
  });

  await test("notes go to the console only, never to the status", async () => {
    const db = makeDb(() => okReply({ ok: true, inserted: 1, skipped: 0, notes: ["trimmed a space"] }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert(db.logs.some(l => l.includes("notes") && l.includes("trimmed a space")));
    assert.deepStrictEqual(db.statuses, ["sending", "sent"]);
  });

  await test("flagged: true is passed through", async () => {
    const db = makeDb(() => okReply({ ok: true, inserted: 1, skipped: 0 }));
    await db.sendToDatabase(ROWS, true, ROWS, META);
    assert.strictEqual(JSON.parse(db.fetches[0].opts.body).flagged, true);
  });

  await test("no tournament: skipped, nothing sent", async () => {
    const db = makeDb(() => okReply({ ok: true }));
    await db.sendToDatabase(ROWS, false, ROWS, { judge: "Judge A" });
    assert.strictEqual(db.fetches.length, 0);
    assert.deepStrictEqual(db.statuses, ["skipped"]);
  });

  await test("double-send guard: an exact repeat of a send that worked is not sent again", async () => {
    const db = makeDb(() => okReply({ ok: true, inserted: 1, skipped: 0 }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.strictEqual(db.fetches.length, 1);
    assert.strictEqual(db.statuses[db.statuses.length - 1], "sent");
  });

  await test("a different match is never blocked by the guard", async () => {
    const db = makeDb(() => okReply({ ok: true, inserted: 1, skipped: 0 }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    await db.sendToDatabase([[...ROWS[0].slice(0, 12), "other"]], false, ROWS, META);
    assert.strictEqual(db.fetches.length, 2);
  });

  await test("HTTP 500: failed, CSV fallback downloads once", async () => {
    const db = makeDb(() => okReply({ error: "boom" }, 500));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.deepStrictEqual(db.statuses, ["sending", "failed"]);
    assert.strictEqual(db.csv.length, 1);
  });

  await test("HTTP 403 (not a registered event): failed + CSV", async () => {
    const db = makeDb(() => okReply({ error: "not registered" }, 403));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.deepStrictEqual(db.statuses, ["sending", "failed"]);
    assert.strictEqual(db.csv.length, 1);
  });

  await test("200 but { ok: false }: failed", async () => {
    const db = makeDb(() => okReply({ ok: false, error: "unreadable rows" }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.deepStrictEqual(db.statuses, ["sending", "failed"]);
  });

  await test("reply that is not JSON: failed", async () => {
    const db = makeDb(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("bad json")) }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.deepStrictEqual(db.statuses, ["sending", "failed"]);
  });

  await test("network failure / timeout: failed, never throws out of the function", async () => {
    const db = makeDb(() => Promise.reject(new Error("network down")));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.deepStrictEqual(db.statuses, ["sending", "failed"]);
    assert.strictEqual(db.csv.length, 1);
  });

  await test("retry: the same payload is resent; a second failure does not download a second CSV", async () => {
    let n = 0;
    const db = makeDb(() => (++n <= 2 ? okReply({ error: "down" }, 503) : okReply({ ok: true, inserted: 1, skipped: 0 })));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    const first = db.fetches[0].opts.body;
    db.handleRetryDatabase();
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(db.fetches[1].opts.body, first, "retry must resend the kept payload");
    assert.strictEqual(db.csv.length, 1, "no second CSV for the same payload");
    assert.strictEqual(db.statuses[db.statuses.length - 1], "failed");
    db.handleRetryDatabase();
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(db.statuses[db.statuses.length - 1], "sent");
    assert.strictEqual(db.refs.dbPendingRef.current, null, "nothing left to retry after success");
  });

  await test("retry with nothing pending does nothing", async () => {
    const db = makeDb(() => okReply({ ok: true }));
    db.handleRetryDatabase();
    assert.strictEqual(db.fetches.length, 0);
  });

  await test("failure reason carries the HTTP code, the Worker message and what the database said", async () => {
    const db = makeDb(() => okReply({ error: "Database answered with something unreadable.", raw: "error code: 1042" }, 502));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    const reason = db.errors[db.errors.length - 1];
    assert(reason.includes("HTTP 502"), reason);
    assert(reason.includes("Database answered with something unreadable."), reason);
    assert(reason.includes("error code: 1042"), reason);
  });

  await test("missing-secret reply shows its reason; a non-JSON reply says so; network and timeout are named", async () => {
    let db = makeDb(() => okReply({ error: "Database ingest is not set up (no DB_INGEST_KEY secret)." }, 503));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert(/HTTP 503.*DB_INGEST_KEY/.test(db.errors[db.errors.length - 1]));
    db = makeDb(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error("x")) }));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert(/HTTP 502.*not JSON/.test(db.errors[db.errors.length - 1]));
    db = makeDb(() => Promise.reject(new TypeError("Failed to fetch")));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert(/network: Failed to fetch/.test(db.errors[db.errors.length - 1]));
    const t = new Error("t"); t.name = "TimeoutError";
    db = makeDb(() => Promise.reject(t));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert(/timed out after 20 seconds/.test(db.errors[db.errors.length - 1]));
  });

  await test("the reason is cleared when a new send starts and shown on the failed line", async () => {
    let n = 0;
    const db = makeDb(() => (++n === 1 ? okReply({ error: "down" }, 503) : okReply({ ok: true, inserted: 1, skipped: 0 })));
    await db.sendToDatabase(ROWS, false, ROWS, META);
    assert.strictEqual(db.errors[0], "");
    db.handleRetryDatabase();
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(db.errors[db.errors.length - 1], "", "cleared at start of retry");
    assert(/Reason: " \+ dbError/.test(app), "UI must render the reason");
  });

  await test("the database code never touches Sheets or Challonge state", () => {
    assert(!/setSheetsStatus|lastSheetsPayloadRef|submitChallongeScore|SHEETS_URL/.test(dbBlock));
  });

  await test("handleSendSheets: database call is only inside ff(1013), not awaited, and Sheets payload is unchanged", () => {
    const body = slice(app, "  const handleSendSheets = async (roundLog, meta) => {", "\n  // Branch on role in the render");
    const call = body.indexOf("sendToDatabase(");
    assert(call > 0, "call missing");
    assert(/if \(ff\(1013\)\) \{\s*try \{\s*sendToDatabase\(/.test(body), "call must sit inside if (ff(1013))");
    assert(!/await sendToDatabase/.test(body), "must not be awaited (cannot delay Sheets)");
    assert(/const payload = JSON\.stringify\(\{\s*rows,\s*battleRows,\s*judgeLog\s*\}\);/.test(body), "Sheets payload shape must not change");
    // rows array is built once and reused
    assert.strictEqual((body.match(/const rows = /g) || []).length, 1, "rows must be built once");
  });

  await test("submit button: blank judge name is blocked only when 1013 is on", () => {
    assert(/disabled: challongeSubmitStatus === "loading" \|\| ff\(1013\) && !\(judge \|\| ""\)\.trim\(\)/.test(app));
    assert(/if \(ff\(1013\) && !\(judge \|\| ""\)\.trim\(\)\) return;/.test(app));
  });

  await test("UXE no-ratchet list now includes Glory Valkyrie and Hells Nether (and keeps the original four)", () => {
    const line = app.match(/const UXE_BLADES = (\[[^\]]*\]);/);
    assert(line, "UXE_BLADES not found");
    const list = JSON.parse(line[1]);
    ["Bullet Griffon", "Cutter Shinobi", "Rampart Aegis", "Valor Bison", "Glory Valkyrie", "Hells Nether"].forEach(b =>
      assert(list.includes(b), b + " missing"));
    assert(/const NO_RATCHET_BLADES = UXE_BLADES;/.test(app));
  });

  await test("flag 1013 is in the default-on set and has a menu description", () => {
    const set = slice(flags, "window.FEATURE_FLAGS = new Set([", "]);");
    assert(/^\s*1013,/m.test(set), "1013 must be in the default set");
    const info = flags.slice(flags.indexOf("window.FEATURE_FLAG_INFO"));
    assert(/1013:\s*\{[\s\S]*?name:[\s\S]*?desc:[\s\S]*?off:/.test(info), "1013 info (name/desc/off) missing");
  });

  console.log(`\n${passed} passed`);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
