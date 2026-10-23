// NC BLAST core.js | part 2 of 6 (load order is set in index.html) | last updated: 2026-10-22b | split-from-app.js (top of the old app.js: React setup, feature-flag helpers, bug log, Worker + sign-in helpers, combos, timing, backup tools, parts lists; code moved here unchanged)
const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo
} = React;

/* ═══════════════════════════════════════
   FEATURE FLAGS
   Defaults live in /flags.js (loaded before this file). A judge can override
   any flag on their own device from the home page — those overrides are read
   once here at load, so saving + reloading applies them. localStorage is never
   cached, unlike flags.js itself, so a reload always picks up the change.

   Resolution order: device override -> flags.js default -> off.
   Anything missing or malformed falls through to off, i.e. the old code path.

   Note: hooks cannot be called conditionally, so for flagged changes that
   involve useMemo/useCallback/useEffect, call the hook unconditionally and
   branch on the result instead. --espiiii
═══════════════════════════════════════ */
const FLAG_OVERRIDE_KEY = "ncblast-flag-overrides-v1";
const FLAG_DEFAULTS = (typeof window !== "undefined" && window.FEATURE_FLAGS) || new Set();
const FLAG_INFO = (typeof window !== "undefined" && window.FEATURE_FLAG_INFO) || {};

// { "1001": true|false } — only ids the judge has explicitly set appear here.
function readFlagOverrides() {
  try {
    const raw = localStorage.getItem(FLAG_OVERRIDE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    Object.keys(parsed).forEach(k => {
      if (typeof parsed[k] === "boolean") out[String(k)] = parsed[k];
    });
    return out;
  } catch {
    return {}; // corrupt override — ignore it and use the shipped defaults
  }
}

// Read once at load. Changing a flag requires a reload, which is what we want:
// flipping mid-session would break React (hook order) and confuse judges.
const FLAG_OVERRIDES = readFlagOverrides();

function flagDefault(id) {
  try {
    return FLAG_DEFAULTS.has(id);
  } catch {
    return false;
  }
}

function ff(id) {
  const key = String(id);
  if (Object.prototype.hasOwnProperty.call(FLAG_OVERRIDES, key)) {
    return FLAG_OVERRIDES[key];
  }
  return flagDefault(id);
}

// ── Stadium names beyond H ───────────────────────────────────────────
// stadiumLabel(0) = "A" ... stadiumLabel(25) = "Z", stadiumLabel(26) = "AA",
// stadiumLabel(27) = "AB" and so on (like spreadsheet columns). The first 8 are
// exactly the old A-H, so nothing changes for events with 8 or fewer stadiums.
const MAX_STADIUMS = 99;
function stadiumLabel(i) {
  let n = i, s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
function stadiumLabelList(count) {
  const c = Math.max(0, Math.min(MAX_STADIUMS, Math.floor(Number(count) || 0)));
  return Array.from({ length: c }, (_, i) => stadiumLabel(i));
}
// Position of a name in the list (A = 0, Z = 25, AA = 26), or -1 if it isn't one.
function stadiumLabelIndex(label) {
  if (typeof label !== "string" || !/^[A-Z]+$/.test(label)) return -1;
  let n = 0;
  for (let i = 0; i < label.length; i++) n = n * 26 + (label.charCodeAt(i) - 64);
  return n - 1;
}

// All known flag ids — defaults plus anything described in FLAG_INFO.
function allFlagIds() {
  const ids = new Set();
  try {
    FLAG_DEFAULTS.forEach(id => ids.add(Number(id)));
  } catch {}
  Object.keys(FLAG_INFO).forEach(k => {
    const n = Number(k);
    if (!Number.isNaN(n)) ids.add(n);
  });
  return [...ids].sort((a, b) => a - b);
}

function saveFlagOverrides(map) {
  try {
    localStorage.setItem(FLAG_OVERRIDE_KEY, JSON.stringify(map || {}));
    return true;
  } catch {
    return false;
  }
}

function clearFlagOverrides() {
  try {
    localStorage.removeItem(FLAG_OVERRIDE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════
   BUG REPORTS — FLAG 1005 (recording)
   Nothing here runs unless 1005 is on. Keeps a small rolling list of errors,
   failed network calls and a few app events, saved to localStorage so it
   survives the reload a judge does after something breaks.
   Nothing is ever sent anywhere — the judge chooses to share a report.
   --espiiii
═══════════════════════════════════════ */
const BUGLOG_KEY = "ncblast-buglog-v1";
const BUGREPORTS_KEY = "ncblast-bugreports-v1";
const BUGLOG_MAX = 400; // taps add a lot per match; ~150 bytes each
const BUGLOG = [];
let _bugLogSaveTimer = null;

function _bugLogSave() {
  try {
    localStorage.setItem(BUGLOG_KEY, JSON.stringify(BUGLOG));
  } catch {}
}

function bugLog(kind, msg, extra) {
  if (!ff(1005)) return;
  try {
    const entry = { t: new Date().toISOString(), k: kind, m: String(msg == null ? "" : msg).slice(0, 500) };
    if (extra) entry.x = extra;
    BUGLOG.push(entry);
    if (BUGLOG.length > BUGLOG_MAX) BUGLOG.splice(0, BUGLOG.length - BUGLOG_MAX);
    // Batch writes so an error loop can't hammer localStorage.
    if (!_bugLogSaveTimer) {
      _bugLogSaveTimer = setTimeout(() => {
        _bugLogSaveTimer = null;
        _bugLogSave();
      }, 1000);
    }
  } catch {}
}

function _bugStr(a) {
  try {
    if (a instanceof Error) {
      return a.name + ": " + a.message + (a.stack ? "\n" + a.stack.split("\n").slice(0, 4).join("\n") : "");
    }
    if (typeof a === "string") return a;
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

// Origin + path only. Query strings can carry tokens (handoff, auth) and must
// never end up in a shared report.
function _bugSafeUrl(u) {
  try {
    const raw = typeof u === "string" ? u : (u && u.url) || "";
    const url = new URL(raw, location.href);
    return url.origin + url.pathname;
  } catch {
    return "?";
  }
}

if (ff(1005)) {
  try {
    const prev = JSON.parse(localStorage.getItem(BUGLOG_KEY) || "[]");
    if (Array.isArray(prev)) BUGLOG.push(...prev.slice(-BUGLOG_MAX));
  } catch {}
  bugLog("app", "loaded", { path: location.pathname });
  window.addEventListener("error", e => {
    bugLog("error", e.message || "error", { src: e.filename ? _bugSafeUrl(e.filename) : "", line: e.lineno, col: e.colno });
  });
  window.addEventListener("unhandledrejection", e => bugLog("rejection", _bugStr(e.reason)));
  ["error", "warn"].forEach(level => {
    const orig = console[level];
    if (typeof orig !== "function") return;
    console[level] = function (...args) {
      try {
        bugLog("console." + level, args.map(_bugStr).join(" "));
      } catch {}
      return orig.apply(this, args);
    };
  });
  // Record failed requests only. Successful ones (overlay polling etc.) would
  // flood the buffer. Opaque no-cors replies have status 0 and are skipped.
  if (typeof window.fetch === "function") {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const started = Date.now();
      const method = (init && init.method) || (input && input.method) || "GET";
      const where = _bugSafeUrl(input);
      return origFetch(input, init).then(res => {
        if (res && res.status >= 400) bugLog("net", method + " " + where + " -> " + res.status, { ms: Date.now() - started });
        return res;
      }, err => {
        bugLog("net", method + " " + where + " failed: " + (err && err.name ? err.name : "error"), { ms: Date.now() - started });
        throw err;
      });
    };
  }
  window.addEventListener("pagehide", _bugLogSave);

  // Tap trail. Records WHICH control was tapped and whether it was disabled,
  // so "the button did nothing" shows up in a report. Uses pointerdown because
  // browsers don't fire click on disabled buttons — the exact case we need.
  // Capture + passive: it only reads, it can't block or change a tap.
  // Never records what's typed: text inputs and textareas are skipped.
  // --espiiii
  let _lastTap = { label: "", t: 0 };
  document.addEventListener("pointerdown", e => {
    try {
      const t = e.target && e.target.closest ? e.target.closest('button, a, [role="button"], input[type="checkbox"], input[type="radio"], select, label') : null;
      if (!t) return;
      const tag = t.tagName.toLowerCase();
      // A label around a text box would include what's typed in it. Skip.
      if (tag === "label" && t.querySelector('textarea, input:not([type="checkbox"]):not([type="radio"])')) return;
      // A dropdown's text is every option run together — use its name only.
      let text = tag === "select" ? "" : t.textContent;
      // A checkbox has no text of its own — use the label it sits in.
      if (tag === "input" && !text) {
        const lab = t.closest("label");
        text = lab ? lab.textContent : "";
      }
      let label = (t.getAttribute("aria-label") || t.getAttribute("title") || text || "").replace(/\s+/g, " ").trim();
      if (!label && tag === "select") label = "dropdown";
      if (!label) label = tag === "a" ? "link" : "icon button";
      label = label.slice(0, 50);
      const disabled = !!(t.disabled || t.getAttribute("aria-disabled") === "true");
      let extra = "";
      if (tag === "input") extra = t.checked ? " [was on]" : " [was off]";
      const msg = `tapped "${label}"${disabled ? " (disabled)" : ""}${extra}`;
      // one tap can fire twice on some devices; drop exact repeats within 300ms
      const now = Date.now();
      if (msg === _lastTap.label && now - _lastTap.t < 300) return;
      _lastTap = { label: msg, t: now };
      bugLog("tap", msg);
    } catch {}
  }, { capture: true, passive: true });
}

/* ═══════════════════════════════════════
   VIEWPORT SCALE
═══════════════════════════════════════ */
function useScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    // Use layout width/height only — never the visual viewport (which shrinks when keyboard opens).
    // This means we only ever scale based on the true screen dimensions, not the keyboard-adjusted view.
    function update() {
      const w = window.screen.width;
      const h = window.screen.height;
      // Use the smaller screen dimension as width (handles landscape correctly)
      const sw = Math.min(w, h);
      const sh = Math.max(w, h);
      const wScale = Math.min(sw / 480, 2.2);
      const hScale = Math.min(sh / 700, 2.0);
      const s = Math.min(wScale, hScale);
      const clamped = Math.max(0.7, Math.min(2.0, s));
      setScale(clamped);
      document.documentElement.style.fontSize = 16 * clamped + "px";
    }
    update();
    // Only re-scale on orientation change — resize fires on keyboard open and causes input blur
    window.addEventListener("orientationchange", update);
    return () => window.removeEventListener("orientationchange", update);
  }, []);
  return scale;
}

/* ═══════════════════════════════════════
   PERSISTENT STORAGE — localStorage
═══════════════════════════════════════ */
const KEYS = {
  parts: "bx-library-v10",
  players: "bx-roster-v2",
  combos: "bx-combos-v1",
  matchLog: "bx-matchlog-v1",
  // Must live in localStorage next to matchLog. It used to be restored only
  // from the sessionStorage resume snapshot, so closing the tab left it at 0
  // while the log kept every past battle - every "this match" view then showed
  // the whole device history. --espiiii
  matchStart: "bx-matchstart-v1",
  challongeMap: "bx-challonge-map-v1",
  overlaySlot: "bx-overlay-slot-v1",
  lastJudge: "ncblast-last-judge-v1",
  matchResume: "ncblast-match-resume-v1",
  // FLAG 1014: the per-match timing notebook. localStorage (not session) so it survives a crash.
  matchTiming: "bx-matchtiming-v1",
  orgResume: "ncblast-org-resume-v1"
};
const OVERLAY_WORKER = "https://challonge-proxy.danny61734.workers.dev";
async function workerGet(path, signal) {
  const res = await fetch(`${OVERLAY_WORKER}${path}`, {
    signal
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const COMBO_CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

function useChallongeAuthPopup() {
  const [state, setState] = React.useState("idle");
  const [username, setUsername] = React.useState(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [errorDetail, setErrorDetail] = React.useState("");
  const popupRef = React.useRef(null);
  const pollRef = React.useRef(null); // popup-closed watcher or localStorage poller
  const stateRef = React.useRef(state);
  const pendingRef = React.useRef(null); // holds result while waiting for user to confirm
  // Unique ID per hook instance — routes messages/localStorage entries to the right hook
  // On reload after same-tab fallback, recover the saved sessionId so we can find the result
  const sessionIdRef = React.useRef((() => {
    try {
      // Check sessionStorage first (same-tab popup fallback on desktop)
      const saved = sessionStorage.getItem("ncblast-popup-sessionid");
      if (saved) {
        sessionStorage.removeItem("ncblast-popup-sessionid");
        return saved;
      }
    } catch (_) {}
    try {
      // Check localStorage second — mobile writes it here before the "Return to NC BLAST"
      // link navigates back, since sessionStorage is wiped on navigation
      const saved = localStorage.getItem("ncblast-popup-sessionid");
      if (saved) {
        localStorage.removeItem("ncblast-popup-sessionid");
        return saved;
      }
    } catch (_) {}
    return Math.random().toString(36).slice(2);
  })());
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Handle a completed login result (from either postMessage or localStorage).
  // Goes to "confirm" state so the judge can verify the account before it's accepted.
  const handleResult = React.useCallback(msg => {
    clearInterval(pollRef.current);
    if (!msg.ok) {
      setErrorMsg(msg.error || "Login failed.");
      setErrorDetail(msg.detail || "");
      setState("error");
      return;
    }
    // Store result and token for later — don't finalize until confirmed
    pendingRef.current = msg;
    try {
      // Write to sessionStorage now so org view can reuse the session
      if (msg.token) sessionStorage.setItem("ncblast-auth-token", msg.token);
      if (msg.username) sessionStorage.setItem("ncblast-auth-user", msg.username);
    } catch (_) {}
    setUsername(msg.username);
    setState("confirm"); // show "Log in as X?" screen
  }, []);

  // Judge confirms the detected account — finalize login
  const confirm = React.useCallback(() => {
    if (!pendingRef.current) return;
    setState("done");
  }, []);

  // Judge rejects the detected account — show instructions to switch Challonge accounts
  const retry = React.useCallback(() => {
    pendingRef.current = null;
    setUsername(null);
    setState("wrong");
  }, []);

  // On mount: discard any stale mobile result key left by a previous failed session.
  // The active poller inside start() handles everything during a live login flow.
  React.useEffect(() => {
    try {
      const stale = localStorage.getItem("ncblast-oauth-result-mobile");
      if (stale) {
        const parsed = JSON.parse(stale);
        if (Date.now() - (parsed.ts || 0) > 120000) localStorage.removeItem("ncblast-oauth-result-mobile");
      }
    } catch (_) {}
  }, []);
  React.useEffect(() => {
    const onMessage = e => {
      if (e.origin !== window.location.origin) return;
      if (!e.data || e.data.type !== "ncblast-oauth-result") return;
      if (e.data.sessionId !== sessionIdRef.current) return;
      handleResult(e.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleResult]);

  // OAuth was attempted but blocked at infrastructure level:
  // - Worker exchange: Cloudflare bot-challenge on connect.challonge.com
  // - Browser direct: CORS block on token endpoint
  // - Implicit grant: not supported by Challonge
  // Replaced with direct username entry — whitelist check handles authorization.
  const start = React.useCallback(() => {
    setErrorMsg("");
    setErrorDetail("");
    setState("entering");
  }, []);
  const reset = React.useCallback(() => {
    clearInterval(pollRef.current);
    pendingRef.current = null;
    try {
      localStorage.removeItem("ncblast-oauth-result:" + sessionIdRef.current);
    } catch (_) {}
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch (_) {}
    }
    setState("idle");
    setUsername(null);
    setErrorMsg("");
    setErrorDetail("");
  }, []);

  // Submit a manually-entered username — skips OAuth, goes straight to done.
  const submitUsername = React.useCallback(uname => {
    const u = (uname || "").trim().toLowerCase();
    if (!u) return;
    // Store a placeholder token so downstream sessionStorage reads don't blow up
    const placeholder = "manual-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      sessionStorage.setItem("ncblast-auth-token", placeholder);
      sessionStorage.setItem("ncblast-auth-user", u);
      localStorage.setItem("ncblast-saved-username", u);
    } catch (_) {}
    pendingRef.current = {
      ok: true,
      username: u,
      token: placeholder
    };
    setUsername(u);
    setState("done");
  }, []);
  return {
    state,
    username,
    errorMsg,
    errorDetail,
    start,
    reset,
    confirm,
    retry,
    submitUsername
  };
}
function normalizePlayerKey(name) {
  return (name || "").trim().toLowerCase();
}

// ── Deterministic match-name resolution ──────────────────────────────────────
// The participant map (pmap) has two kinds of entries:
//   "Player Name"   → participant id
//   "__gid__12345"  → participant id   (group-stage alias ids used by Swiss matches)
// buildIdToName flips it into id → name in two passes, so group-stage ids
// borrow the display name of the participant they belong to. (The old one-pass
// flip let __gid__ entries overwrite real names — that bug is why Swiss
// lookups silently failed.)
function buildIdToName(pmap) {
  const idToName = {};
  const gidToPart = {};
  Object.entries(pmap || {}).forEach(([k, v]) => {
    if (typeof k === "string" && k.startsWith("__gid__")) gidToPart[k.slice(7)] = String(v);
    else if (k) idToName[String(v)] = k;
  });
  Object.entries(gidToPart).forEach(([gid, pid]) => {
    if (idToName[pid]) idToName[gid] = idToName[pid];
  });
  return idToName;
}

// Resolve one side of a match to a display name. Returns null when unresolvable.
// Callers may show "ID:<number>" as a *label*, but an unresolved name must never
// become a combo-registry key — that's the cross-round mismatch bug.
function resolveMatchName(rawName, playerId, idToName) {
  if (rawName) return rawName;
  return idToName && idToName[String(playerId)] || null;
}

// True when a name is the display-only "ID:12345" fallback — never save under these.
function isIdFallbackName(name) {
  return /^ID:\d+$/i.test((name || "").trim());
}

// Build a participant map (name → id, plus __gid__ aliases) from a raw
// Challonge participants array. Shared by the import flow and the
// self-heal refetch in the judge view.
function buildPmapFromParticipants(participants) {
  const pmap = {};
  (participants || []).forEach(p => {
    const part = p.participant || p;
    const n = (part.display_name || part.username || part.name || "").trim();
    if (n && part.id) {
      pmap[n] = part.id;
      if (Array.isArray(part.group_player_ids)) {
        part.group_player_ids.forEach(gid => {
          if (gid) pmap[`__gid__${gid}`] = part.id;
        });
      }
    }
  });
  return pmap;
}

// Push one player's combos into the tournament-scoped registry.
// The Worker merges this player's entry without touching other players.
async function pushCombosForTournament(slug, playerName, combos) {
  if (!slug || !playerName) return;
  // Up to 3 tries. A try counts only if the Worker said OK AND a re-read shows this
  // player's combos really are in the registry (another station saving at the same
  // moment can overwrite a save on older Worker versions). Empty list = nothing to verify.
  const comboKey = c => [c && c.blade, c && c.ratchet, c && c.bit].filter(Boolean).join("|");
  const wanted = (combos || []).map(comboKey).filter(Boolean);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 700 + Math.random() * 1500));
      const res = await fetch(`${OVERLAY_WORKER}/combos/slug`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          player: playerName,
          combos: combos || []
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (!wanted.length) return;
      await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
      const back = await fetch(`${OVERLAY_WORKER}/combos/slug?slug=${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!back.ok) return; // saved OK; just could not double-check
      const data = await back.json();
      const saved = data && data.registry && data.registry[playerName.trim().toLowerCase()];
      const savedKeys = Array.isArray(saved) ? saved.map(comboKey) : [];
      if (wanted.every(k => savedKeys.includes(k))) return; // confirmed
      console.warn("[combos] save for " + playerName + " not found on re-read, retrying");
    } catch (e) {
      console.warn("[combos] save for " + playerName + " failed (try " + (attempt + 1) + "):", e && e.message);
    }
  }
}

// Fetch the entire combo registry for a tournament in one request.
// Returns a dict keyed by normalizePlayerKey(name) → [combo, ...].
async function fetchCombosForTournament(slug) {
  if (!slug) return {};
  try {
    const res = await fetch(`${OVERLAY_WORKER}/combos/slug?slug=${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return {};
    const data = await res.json();
    if (!data.registry || typeof data.registry !== "object") return {};
    // Normalize every entry on the way in
    const out = {};
    Object.entries(data.registry).forEach(([k, arr]) => {
      if (Array.isArray(arr)) out[k] = arr.map(normalizeCombo).filter(comboReady);
    });
    return out;
  } catch (_) {
    return {};
  }
}

// Look up a player's combos from an already-fetched registry dict.
function getCombosFromRegistry(registry, playerName) {
  if (!registry || !playerName) return [];
  return registry[normalizePlayerKey(playerName)] || [];
}

// Cap the stored battle log so it cannot grow forever across a whole season.
// Pruning only ever happens at match start - dropping older entries mid-match
// would shift matchStartIdx and silently re-scope the current match. --espiiii
const MATCH_LOG_CAP = 600;
function pruneMatchLog(entries) {
  const arr = Array.isArray(entries) ? entries : [];
  return arr.length > MATCH_LOG_CAP ? arr.slice(arr.length - MATCH_LOG_CAP) : arr;
}

function sGet(key, fb) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}
function sSave(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
// Session-scoped versions (survive a refresh, clear when the tab/window actually closes —
// exactly the lifetime we want for "resume where I left off" state).
function ssGet(key, fb) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}
function ssSave(key, val) {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function ssClear(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
// ── Cloud backup queue (FLAG 1016) ────────────────────────────────────────────────────────────
// Error files (a battles CSV when a send failed, a timing CSV, a bug report) are uploaded to the
// cloud backup folder through the Worker's /backup/upload door instead of being saved on the
// judge's device. Every file waits in a small queue on the device (localStorage) until the
// upload works: it retries every minute, when the connection returns, and after the app is
// reopened. The same file name replaces the earlier copy, so a retry never makes a duplicate.
var CLOUD_BACKUP_KEY = "bx-cloudbackup-v1";
var _cbRun = null;
var _cbAgain = false;
function cloudBackupLoad() {
  try {
    const a = JSON.parse(localStorage.getItem(CLOUD_BACKUP_KEY) || "[]");
    return Array.isArray(a) ? a.filter(x => x && x.id && x.kind && x.fileName && typeof x.content === "string") : [];
  } catch (_) {
    return [];
  }
}
function cloudBackupSave(list) {
  try {
    const keep = list.slice(-40);
    while (keep.length > 1 && JSON.stringify(keep).length > 2500000) keep.shift(); // stay well inside the browser's storage limit
    if (keep.length) localStorage.setItem(CLOUD_BACKUP_KEY, JSON.stringify(keep));else localStorage.removeItem(CLOUD_BACKUP_KEY);
  } catch (_) {}
}
function cloudBackupPending(kind, fileName) {
  return cloudBackupLoad().some(x => x.kind === kind && x.fileName === fileName);
}
async function _cloudBackupPass() {
  for (const item of cloudBackupLoad()) {
    let ok = false;
    try {
      const resp = await fetch(`${OVERLAY_WORKER}/backup/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: item.slug || "",
          kind: item.kind,
          fileName: item.fileName,
          content: item.content
        }),
        signal: AbortSignal.timeout(20000)
      });
      let reply = null;
      try {
        reply = await resp.json();
      } catch (_) {}
      ok = !!(resp.ok && reply && reply.ok === true);
    } catch (_) {}
    const now = cloudBackupLoad();
    if (ok) cloudBackupSave(now.filter(x => x.id !== item.id));else cloudBackupSave(now.map(x => x.id === item.id ? {
      ...x,
      tries: (x.tries || 0) + 1
    } : x).filter(x => (x.tries || 0) <= 300)); // about five hours of trying, then let go
  }
}
function cloudBackupFlush() {
  if (!ff(1016)) return Promise.resolve();
  if (_cbRun) {
    _cbAgain = true; // something new arrived mid-run: go round once more
    return _cbRun;
  }
  _cbRun = (async () => {
    do {
      _cbAgain = false;
      try {
        await _cloudBackupPass();
      } catch (_) {}
    } while (_cbAgain);
  })().then(() => {
    _cbRun = null;
  });
  return _cbRun;
}
// Adds a file to the queue (same kind + name replaces) and tries to upload right away.
function cloudBackupEnqueue(f) {
  const id = f.kind + "|" + f.fileName;
  cloudBackupSave(cloudBackupLoad().filter(x => x.id !== id).concat([{
    id,
    kind: f.kind,
    slug: f.slug || "",
    fileName: f.fileName,
    content: String(f.content),
    addedAt: Date.now(),
    tries: 0
  }]));
  return cloudBackupFlush();
}
if (typeof window !== "undefined") {
  setTimeout(() => {
    cloudBackupFlush().catch(() => {});
  }, 5000);
  setInterval(() => {
    cloudBackupFlush().catch(() => {});
  }, 60000);
  window.addEventListener("online", () => {
    cloudBackupFlush().catch(() => {});
  });
}
// ── Match timing notebook (FLAG 1014) ───────────────────────────────────────
// A small notebook of clock readings for ONE match, saved on the device. The clock starts the
// first time the deck builder is opened. Every reading is a real clock time (so a refresh, a crash
// or a lost connection cannot lose or bend it) and is only turned into "seconds since Start" when
// it is read.
// NOTHING IS EVER ERASED. Battles and launch errors still in the match log are read from it (each
// has its own clock time, entry.time). When Undo or Reset set removes one from the log it is first
// copied into "gone". A marker that an Undo wipes out, or that is pressed again later, moves into
// "old" tagged "undone" or "replaced". Every Undo / Reset set also opens a "fix" window: it starts
// at the confirm click of the most recent entry that was undone and ends when the match is back to
// the same number of entries (or is over). Fixing a mistake is therefore its own category, and
// every second of the match lands in exactly one category, so they add up to the full match time.
function timingClean(t) {
  // Tolerate anything odd read back from storage or from a handoff. No Start = no clock.
  if (!t || typeof t !== "object") return null;
  const num = v => typeof v === "number" && isFinite(v) ? v : null;
  const mapOf = o => {
    const out = {};
    if (o && typeof o === "object") Object.keys(o).forEach(k => {
      const n = num(o[k]);
      if (n !== null) out[k] = n;
    });
    return out;
  };
  const arr = (a, f) => Array.isArray(a) ? a.map(f).filter(Boolean) : [];
  if (num(t.start) === null) return null;
  return {
    start: num(t.start),
    decks: num(t.decks),
    priority: num(t.priority),
    sides: mapOf(t.sides),
    shuffles: mapOf(t.shuffles),
    complete: num(t.complete),
    old: arr(t.old, o => o && typeof o.k === "string" && num(o.ms) !== null ? {
      k: o.k,
      key: o.key === null || o.key === undefined ? null : String(o.key),
      ms: o.ms,
      why: o.why === "undone" ? "undone" : "replaced"
    } : null),
    gone: arr(t.gone, g => g && num(g.ms) !== null ? {
      ms: g.ms,
      kind: g.kind === "launch" ? "launch" : "battle",
      type: typeof g.type === "string" ? g.type : "",
      set: num(g.set)
    } : null),
    fixes: arr(t.fixes, f => f && num(f.startMs) !== null && num(f.firstUndoMs) !== null && num(f.target) !== null ? {
      startMs: f.startMs,
      firstUndoMs: f.firstUndoMs,
      endMs: num(f.endMs),
      target: f.target,
      presses: arr(f.presses, p => p && num(p.ms) !== null ? {
        ms: p.ms,
        kind: p.kind === "reset" ? "reset" : "undo"
      } : null)
    } : null)
  };
}
function timingStampPure(t, kind, key, now) {
  // No clock yet: only opening the deck builder ("start") or pressing Start Match on the deck
  // review ("decks") may start one. Anything else (for example a match handed over from an older
  // app version that sent no clock) stays without timing instead of guessing a wrong Start.
  if (!t && kind !== "start" && kind !== "decks") return t;
  if (kind === "start" && t) return t; // clock already running - same object, no re-render
  const base = t ? {
    ...t,
    sides: {
      ...t.sides
    },
    shuffles: {
      ...t.shuffles
    },
    old: [...(t.old || [])],
    gone: t.gone || [],
    fixes: t.fixes || []
  } : {
    start: null,
    decks: null,
    priority: null,
    sides: {},
    shuffles: {},
    complete: null,
    old: [],
    gone: [],
    fixes: []
  };
  // Pressing a step again keeps the earlier press as "replaced" (a second tap within a second is the
  // same press, not a new one).
  const keep = (k, key2, prev) => {
    if (typeof prev === "number" && now - prev >= 1000) base.old.push({
      k,
      key: key2,
      ms: prev,
      why: "replaced"
    });
  };
  if (base.start === null) base.start = now;
  if (kind === "decks") {
    keep("decks", null, base.decks);
    base.decks = now;
  } else if (kind === "priority") {
    keep("priority", null, base.priority);
    base.priority = now;
  } else if (kind === "side") {
    const k = String(key);
    keep("side", k, base.sides[k]);
    base.sides[k] = now;
  } else if (kind === "shuffle") {
    const k = String(key);
    keep("shuffle", k, base.shuffles[k]);
    base.shuffles[k] = now;
  } else if (kind === "complete" && base.complete === null) base.complete = now;
  return base;
}
// Markers whose step no longer exists (Undo, Reset set and Undo match end all move the match
// backwards) are MOVED to "old" tagged "undone", never deleted. Side Selection N belongs to set N;
// Shuffle "S:N" is shuffle N of set S. When nothing moves, the SAME object comes back, so nothing
// re-renders.
function timingPrune(t, curSet, shuf, phase) {
  if (!t) return t;
  let changed = false;
  const old = [...(t.old || [])];
  const sides = {};
  const shuffles = {};
  Object.keys(t.sides).forEach(k => {
    if (Number(k) <= curSet) sides[k] = t.sides[k];else {
      old.push({
        k: "side",
        key: k,
        ms: t.sides[k],
        why: "undone"
      });
      changed = true;
    }
  });
  Object.keys(t.shuffles).forEach(k => {
    const p = k.split(":").map(Number);
    if (p[0] < curSet || p[0] === curSet && p[1] <= shuf) shuffles[k] = t.shuffles[k];else {
      old.push({
        k: "shuffle",
        key: k,
        ms: t.shuffles[k],
        why: "undone"
      });
      changed = true;
    }
  });
  let complete = t.complete;
  if (complete !== null && phase !== "over") {
    old.push({
      k: "complete",
      key: null,
      ms: complete,
      why: "undone"
    });
    complete = null;
    changed = true;
  }
  return changed ? {
    ...t,
    sides,
    shuffles,
    complete,
    old
  } : t;
}
// An Undo / Reset set happened. "removed" = the log entries it took out, "before" = how many
// entries the match had just before. The removed entries are kept in "gone". If no fix window is
// open, one opens now: it starts at the confirm click of the most recent removed entry (earlier
// entries keep their own real battle lengths) and remembers when the first press happened, so
// "time to notice" and "time to repair" can be told apart. If one is already open (more undos
// while still fixing) it just gets another press.
function timingUndoPure(t, removed, kind, now, before) {
  if (!t) return t;
  const gone = [...(t.gone || [])];
  let latest = -Infinity;
  (Array.isArray(removed) ? removed : []).forEach(e => {
    const ms = e && e.time ? Date.parse(e.time) : NaN;
    if (!isFinite(ms)) return;
    if (ms > latest) latest = ms;
    gone.push({
      ms,
      kind: e.type === "LER" || e.type === "LER-STRIKE" ? "launch" : "battle",
      type: String(e.type || ""),
      set: typeof e.set === "number" ? e.set : null
    });
  });
  const press = {
    ms: now,
    kind: kind === "reset" ? "reset" : "undo"
  };
  const fixes = [...(t.fixes || [])];
  const last = fixes.length ? fixes[fixes.length - 1] : null;
  if (last && last.endMs === null) {
    fixes[fixes.length - 1] = {
      ...last,
      presses: [...(last.presses || []), press]
    };
  } else {
    fixes.push({
      startMs: isFinite(latest) ? Math.min(latest, now) : now,
      firstUndoMs: now,
      endMs: null,
      target: before,
      presses: [press]
    });
  }
  return {
    ...t,
    gone,
    fixes
  };
}
// Close the open fix window once the match has as many entries as it had before the first Undo
// (that entry's confirm click is the end), or when the match is over. Otherwise the SAME object
// comes back.
function timingCloseFixes(t, entries, phase, now) {
  if (!t || !t.fixes || !t.fixes.length) return t;
  const i = t.fixes.length - 1;
  const f = t.fixes[i];
  if (f.endMs !== null) return t;
  const list = Array.isArray(entries) ? entries : [];
  const back = list.length >= f.target;
  if (!back && phase !== "over") return t;
  const idx = back ? f.target - 1 : list.length - 1;
  const ms = idx >= 0 && list[idx] && list[idx].time ? Date.parse(list[idx].time) : NaN;
  const fixes = t.fixes.slice();
  fixes[i] = {
    ...f,
    endMs: isFinite(ms) && ms >= f.firstUndoMs ? ms : now
  };
  return {
    ...t,
    fixes
  };
}
function timingQuartile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
// The standard box-plot rule: take the middle half of the values; anything more than 1.5
// box-widths outside it is an outlier. Under 4 values is too few to judge, so nothing is flagged.
function timingOutlierFences(values) {
  if (values.length < 4) return null;
  const s = [...values].sort((a, b) => a - b);
  const q1 = timingQuartile(s, 0.25);
  const q3 = timingQuartile(s, 0.75);
  const iqr = q3 - q1;
  return {
    low: q1 - 1.5 * iqr,
    high: q3 + 1.5 * iqr
  };
}
function timingShuffleCmp(a, b) {
  const pa = String(a).split(":").map(Number);
  const pb = String(b).split(":").map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1];
}
// Turns the notebook + the match's battles still in the log into one time-ordered list.
// Row fields: label, kind (marker | battle | launch | press | fix), ms, secs (seconds since Start),
// gap (seconds since the row before it that is not inside a fix window), status (undone |
// replaced | correction), inFix (happened inside a fix window), outlier.
// Undone battles keep their real length. A battle re-entered during a fix is a "correction": it
// belongs to the fix window, not to the battle averages. The fix row's gap runs from the last good
// entry to the moment the match was back where it was, and is split into notice (to the first
// Undo press) + repair (the rest). Time lost to launch errors is its own row kind.
function timingBuildLines(t, entries, now) {
  if (!t || t.start === null) return [];
  const nowMs = typeof now === "number" && isFinite(now) ? now : Date.now();
  const old = t.old || [];
  const gone = t.gone || [];
  const fixes = t.fixes || [];
  const rows = [];
  const add = (label, kind, ms, extra) => {
    if (typeof ms === "number" && isFinite(ms)) rows.push({
      label,
      kind,
      ms,
      ...(extra || {})
    });
  };
  // Shuffle numbers count EVERY shuffle that happened in the match, undone ones included.
  const shKeys = [...new Set([...Object.keys(t.shuffles), ...old.filter(o => o.k === "shuffle").map(o => String(o.key))])].sort(timingShuffleCmp);
  const shNo = k => shKeys.indexOf(String(k)) + 1;
  const markerLabel = (k, key) => k === "decks" ? "Decks Recorded" : k === "priority" ? "Priority" : k === "side" ? "Side Selection " + key : k === "shuffle" ? "Shuffle " + shNo(key) : "Match Complete";
  add("Start", "marker", t.start);
  add(markerLabel("decks"), "marker", t.decks);
  add(markerLabel("priority"), "marker", t.priority);
  Object.keys(t.sides).forEach(k => add(markerLabel("side", k), "marker", t.sides[k]));
  Object.keys(t.shuffles).forEach(k => add(markerLabel("shuffle", k), "marker", t.shuffles[k]));
  add(markerLabel("complete"), "marker", t.complete);
  old.forEach(o => add(markerLabel(o.k, o.key), "marker", o.ms, {
    status: o.why
  }));
  (Array.isArray(entries) ? entries : []).forEach(e => {
    const ms = e && e.time ? Date.parse(e.time) : NaN;
    if (!isFinite(ms)) return;
    if (e.type === "LER" || e.type === "LER-STRIKE") add("Launch Error", "launch", ms, {
      set: e.set,
      finish: e.type === "LER-STRIKE" ? "warning" : "scored",
      fromLog: true
    });else add("Battle", "battle", ms, {
      set: e.set,
      finish: e.type,
      fromLog: true
    });
  });
  gone.forEach(g => {
    if (g.kind === "launch") add("Launch Error", "launch", g.ms, {
      set: g.set,
      finish: g.type === "LER-STRIKE" ? "warning" : "scored",
      status: "undone"
    });else add("Battle", "battle", g.ms, {
      set: g.set,
      finish: g.type,
      status: "undone"
    });
  });
  fixes.forEach(f => {
    (f.presses || []).forEach(p => add(p.kind === "reset" ? "Reset set pressed" : "Undo pressed", "press", p.ms));
    add("Fix", "fix", f.endMs !== null ? f.endMs : nowMs, {
      startMs: f.startMs,
      firstUndoMs: f.firstUndoMs,
      open: f.endMs === null
    });
  });
  rows.sort((a, b) => a.ms - b.ms);
  const insideFix = r => fixes.some(f => r.ms > f.startMs && r.ms <= (f.endMs !== null ? f.endMs : Infinity));
  let origNo = 0;
  let finalNo = 0;
  rows.forEach(r => {
    r.secs = Math.max(0, (r.ms - t.start) / 1000);
    r.inFix = r.kind !== "fix" && insideFix(r);
    if (r.kind === "battle") {
      if (r.fromLog) finalNo += 1;
      if (!r.inFix) r.label = "Battle " + ++origNo;else if (r.fromLog) {
        r.label = "Battle " + finalNo;
        if (!r.status) r.status = "correction";
      } else r.label = "Battle (re-entry)";
    } else if (r.kind === "launch" && r.inFix && r.fromLog && !r.status) r.status = "correction";
  });
  let cursor = null;
  rows.forEach(r => {
    if (r.inFix) return;
    if (r.kind === "fix") {
      r.gap = Math.max(0, (r.ms - r.startMs) / 1000);
      r.notice = Math.max(0, (Math.min(r.firstUndoMs, r.ms) - r.startMs) / 1000);
      r.repair = Math.max(0, r.gap - r.notice);
    } else if (cursor !== null) r.gap = Math.max(0, (r.ms - cursor) / 1000);
    cursor = r.ms;
  });
  const fences = timingOutlierFences(rows.filter(r => r.kind === "battle" && !r.inFix && typeof r.gap === "number").map(r => r.gap));
  if (fences) rows.forEach(r => {
    if (r.kind === "battle" && !r.inFix && typeof r.gap === "number" && (r.gap < fences.low || r.gap > fences.high)) r.outlier = true;
  });
  return rows;
}
// Category totals. battles = every original battle (undone ones included); launch errors, setup
// (Decks Recorded / Priority / Side Selection / Shuffle / Match Complete gaps) and fixes are kept
// apart. battleTotal + launchTotal + setupTotal + fixTotal = total (the full match time so far).
function timingSummary(lines) {
  const s = {
    battles: 0,
    battleTotal: 0,
    launches: 0,
    launchTotal: 0,
    setupTotal: 0,
    fixes: 0,
    fixTotal: 0,
    fixNotice: 0,
    fixRepair: 0
  };
  lines.forEach(l => {
    if (l.inFix || typeof l.gap !== "number") return;
    if (l.kind === "battle") {
      s.battles += 1;
      s.battleTotal += l.gap;
    } else if (l.kind === "launch") {
      s.launches += 1;
      s.launchTotal += l.gap;
    } else if (l.kind === "fix") {
      s.fixes += 1;
      s.fixTotal += l.gap;
      s.fixNotice += l.notice;
      s.fixRepair += l.repair;
    } else if (l.kind === "marker") s.setupTotal += l.gap;
  });
  s.avgBattle = s.battles ? s.battleTotal / s.battles : null;
  s.total = lines.length ? Math.max(...lines.map(l => l.secs)) : null;
  s.accounted = s.battleTotal + s.launchTotal + s.setupTotal + s.fixTotal;
  return s;
}
// ── Match timing SEND (FLAG 1015) ──────────────────────────────────────────────────────────────
// Turns the notebook into the agreed "contract" for the Worker's /db/timing door: one line per
// event, in the order it happened. Clock lines (markers, battles, launch errors) carry sincePrev =
// the gap from the previous CLOCK line, so the gaps add up to the full match time; fix and
// fix_press lines are skipped when finding the previous line. Nothing is dropped: undone,
// replaced and correction lines go along with their status. Pure function - changes nothing.
function timingToContract(t, entries, info, now) {
  if (!t || t.start === null || !info || !info.matchKey || !info.slug) return null;
  const lines = timingBuildLines(t, entries, now);
  if (!lines.length || lines.length > 600) return null;
  const timeByMs = {};
  (Array.isArray(entries) ? entries : []).forEach(e => {
    const ms = e && typeof e.time === "string" ? Date.parse(e.time) : NaN;
    if (isFinite(ms)) timeByMs[ms] = e.time;
  });
  const FIN = {
    SPF: "Spin",
    OVR: "Over",
    BST: "Burst",
    XTR: "Xtreme",
    OF2: "Own Finish",
    OF3: "Own Finish"
  };
  const r2 = n => Math.round(n * 100) / 100;
  const out = [];
  let prev = null;
  lines.forEach(l => {
    const tt = r2(l.secs);
    const label = String(l.label || "");
    const o = {
      label: label.slice(0, 80),
      t: tt
    };
    const num = /(\d+)\s*$/.exec(label);
    if (l.kind === "marker") {
      o.kind = label === "Start" ? "start" : label === "Decks Recorded" ? "decks" : label === "Priority" ? "priority" : label === "Match Complete" ? "complete" : label.indexOf("Side Selection") === 0 ? "side" : "shuffle";
      if ((o.kind === "side" || o.kind === "shuffle") && num) o.n = +num[1];
    } else if (l.kind === "battle") {
      o.kind = "battle";
      if (num) o.n = +num[1];
      o.set = Math.max(1, Math.round(Number(l.set)) || 1);
      if (FIN[l.finish]) o.finishType = FIN[l.finish];
      if (l.fromLog && timeByMs[l.ms]) o.battleTs = timeByMs[l.ms];
    } else if (l.kind === "launch") {
      o.kind = "launch_error";
    } else if (l.kind === "press") {
      o.kind = "fix_press";
      o.press = label.indexOf("Reset") === 0 ? "reset" : "undo";
    } else if (l.kind === "fix") {
      o.kind = "fix";
      const fe = tt;
      const fs = Math.min(fe, r2(Math.max(0, (l.startMs - t.start) / 1000)));
      const fp = r2(Math.min(fe, Math.max(fs, (l.firstUndoMs - t.start) / 1000)));
      o.fixStart = fs;
      o.firstPress = fp;
      o.fixEnd = fe;
      o.notice = r2(fp - fs);
      o.repair = r2(fe - fp);
    } else return;
    if (l.status === "undone" || l.status === "replaced" || l.status === "correction") o.status = l.status;
    if (o.kind !== "fix" && o.kind !== "fix_press") {
      o.sincePrev = prev === null ? 0 : r2(Math.max(0, tt - prev));
      prev = tt;
    }
    out.push(o);
  });
  return {
    slug: info.slug,
    tournament: info.tournament || "",
    matchKey: String(info.matchKey),
    ...(info.match ? {
      match: info.match
    } : {}),
    ...(info.judge ? {
      judge: info.judge
    } : {}),
    ...(info.p1 ? {
      p1: info.p1
    } : {}),
    ...(info.p2 ? {
      p2: info.p2
    } : {}),
    startedAt: new Date(t.start).toISOString(),
    lines: out
  };
}
// ── Match timing OUTBOX helpers (FLAG 1015) ───────────────────────────────────────────────────
// A timing send that fails is kept on the device (so closing the app does not lose it), retried
// by itself, and after TIMING_GIVE_UP_MS turned into a CSV and uploaded to the cloud backup
// folder. Only if that upload also fails is the CSV downloaded to the judge's device.
const TIMING_OUTBOX_KEY = "bx-timing-outbox-v1";
const TIMING_GIVE_UP_MS = 10 * 60 * 1000;
function timingOutboxLoad() {
  try {
    const a = JSON.parse(localStorage.getItem(TIMING_OUTBOX_KEY) || "[]");
    return Array.isArray(a) ? a.filter(x => x && x.id && typeof x.payload === "string") : [];
  } catch (_) {
    return [];
  }
}
function timingOutboxSave(list) {
  try {
    if (list.length) localStorage.setItem(TIMING_OUTBOX_KEY, JSON.stringify(list.slice(-10)));else localStorage.removeItem(TIMING_OUTBOX_KEY);
  } catch (_) {}
}
// One row per stopwatch line; the match details repeat on every row so the file stands alone.
function timingCsv(p) {
  const q = v => {
    const t = v === undefined || v === null ? "" : String(v);
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const head = ["tournament", "judge", "match", "matchKey", "startedAt", "label", "kind", "t", "sincePrev", "status", "set", "n", "finishType", "battleTs", "press", "fixStart", "firstPress", "fixEnd", "notice", "repair"];
  const rows = [head.join(",")];
  (p && Array.isArray(p.lines) ? p.lines : []).forEach(l => rows.push([p.tournament, p.judge, p.match, p.matchKey, p.startedAt, l.label, l.kind, l.t, l.sincePrev, l.status || "counted", l.set, l.n, l.finishType, l.battleTs, l.press, l.fixStart, l.firstPress, l.fixEnd, l.notice, l.repair].map(q).join(",")));
  return rows.join("\r\n") + "\r\n";
}
// File name: event, judge, both players, round number (characters that file names cannot hold are removed).
function backupCleanPart(v) {
  return String(v === undefined || v === null ? "" : v).replace(/[\\/:*?"<>|\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim();
}
function backupFileName(event, judge, p1, p2, round, ext) {
  const r = backupCleanPart(round);
  const parts = [backupCleanPart(event) || "Event", backupCleanPart(judge) || "Judge", (backupCleanPart(p1) || "Player 1") + " vs " + (backupCleanPart(p2) || "Player 2"), r ? "Round " + r : "Round unknown"];
  return parts.join(" - ").slice(0, 180) + (ext || ".csv");
}
function timingBackupFileName(p, round) {
  return backupFileName(p && p.tournament, p && p.judge, p && p.p1, p && p.p2, round, ".csv");
}
// Bug reports have no round: "Bug <number> - <event> - <judge>.json".
function bugBackupFileName(report) {
  const live = report && report.live || {};
  const ev = live.match && live.match.config && live.match.config.tournamentName || live.match && live.match.slug || "";
  const judge = live.app && live.app.judge || "";
  return ("Bug " + backupCleanPart(report && report.id) + " - " + (backupCleanPart(ev) || "no event") + " - " + (backupCleanPart(judge) || "no judge")).slice(0, 180) + ".json";
}
function timingDownloadText(name, text) {
  const blob = new Blob([text], {
    type: "text/csv"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const DEFAULT_PARTS = {
  blades: ["Wizard Rod", "Shark Scale", "Cobalt Dragoon", "Aero Pegasus", "Hover Wyvern", "Golem Rock", "Meteor Dragoon", "Phoenix Wing", "Silver Wolf", "Clock Mirage", "Antler", "Arc", "Assault", "Bear Scratch", "Bite Croc", "Black Shell", "Blast", "Blitz", "Brave", "Break", "Brush", "Bullet Griffon", "Bumper", "Bumblebee", "Captain America", "Charge", "Chewbacca", "Cobalt Drake", "Crimson Garuda", "Cutter Shinobi", "Dark", "Darth Vader", "Draciel Shield", "Dragoon Storm", "Dran Buster", "Dran Dagger", "Dran Strike", "Dran Sword", "Dranzer Spiral", "Driger S", "Dual", "Eclipse", "Emperor", "Erase", "Fang", "Flame", "Flare", "Flow", "Fort", "Fortress", "Free", "General Grievous", "Ghost Circle", "Gill Shark", "Goat Tackle", "Green Goblin", "Guard", "Hack Viking", "Heavy", "Hells Chain", "Hells Hammer", "Hells Scythe", "Hunt", "Impact Drake", "Iron Man", "Jaggy", "Knight Lance", "Knight Mail", "Knight Shield", "Knuckle", "Leon Claw", "Leon Crest", "Lightning L-Drago", "Luke Skywalker", "Massive", "Megatron", "Might", "Miles Morales", "Moff Gideon", "Mosasaurus", "Mummy Curse", "Obi-Wan Kenobi", "Optimus Primal", "Optimus Prime", "Orochi Cluster", "Phoenix Feather", "Phoenix Rudder", "Ptera Wing", "Quetzalcoatlus", "Rage", "Rampart Aegis", "Reaper", "Red Hulk", "Rhino Horn", "Ridge Triceratops", "Ring Aether", "Rock Leone", "Round", "Samurai Calibur", "Samurai Saber", "Samurai Steel", "Scorpio Spear", "Shadow Shinobi", "Shark Edge", "Shelter Drake", "Shinobi Knife", "Slash", "Soundwave", "Sphinx Cowl", "Spider-Man", "Spinosaurus", "Standard", "Starscream", "Storm Pegasus", "Storm Spriggan", "Storm Trooper", "Stun Medusa", "Suppress Superion", "T.Rex", "Thanos", "The Mandalorian", "Tricera Press", "Turn", "Tusk Mammoth", "Tyranno Beat", "Tyranno Roar", "Unicorn Sting", "Valor Bison", "Valkyrie", "Venom", "Vertical", "Victory Valkyrie", "Viper Tail", "Volt", "Weiss Tiger", "Whale Wave", "Wheel", "Wizard Arrow", "Wriggle", "Wyvern Gale", "Xeno Xcalibur", "Yell Kong", "Zillion"],
  ratchets: ["1-60", "3-60", "9-60", "7-60", "5-60", "1-70", "1-50", "7-70", "7-55", "8-70", "0-60", "0-70", "0-80", "1-80", "2-60", "2-70", "2-80", "3-70", "3-80", "3-85", "4-50", "4-55", "4-60", "4-70", "4-80", "5-50", "5-70", "5-80", "6-60", "6-70", "6-80", "7-80", "9-65", "9-70", "9-80", "M-85", "Operate", "Turbo"],
  bits: ["Elevate", "Rush", "Low Rush", "Free Ball", "Hexa", "Low Orb", "Kick", "Level", "Ball", "Jolt", "Accel", "Bound Spike", "Cyclone", "Disk Ball", "Disk Spike", "Dot", "Flat", "Free Flat", "Gear Ball", "Gear Flat", "Gear Needle", "Gear Point", "Gear Rush", "Glide", "High Needle", "High Taper", "Ignition", "Low Flat", "Merge", "Narrow", "Needle", "Orb", "Point", "Quake", "Rubber Accel", "Spike", "Taper", "Trans Kick", "Trans Point", "Under Flat", "Under Needle", "Unite", "Vortex", "Wall Ball", "Wall Wedge", "Wedge", "Yielding", "Zap"]
};

// Crossover blades (collapsible section at bottom of blade picker)
const CROSSOVER_BLADES = ["Bumblebee", "Captain America", "Chewbacca", "Darth Vader", "Draciel Shield", "Dragoon Storm", "Dranzer Spiral", "Driger S", "General Grievous", "Green Goblin", "Iron Man", "Lightning L-Drago", "Luke Skywalker", "Megatron", "Miles Morales", "Moff Gideon", "Mosasaurus", "Obi-Wan Kenobi", "Optimus Primal", "Optimus Prime", "Quetzalcoatlus", "Red Hulk", "Rock Leone", "Soundwave", "Spider-Man", "Spinosaurus", "Starscream", "Storm Pegasus", "Storm Spriggan", "Storm Trooper", "T.Rex", "Thanos", "The Mandalorian", "Venom", "Victory Valkyrie", "Xeno Xcalibur"];

// CX (Customize Xtend) system parts
const CX_CHIPS = ["Standard", "Emperor", "Valkyrie"];
const CX_BLADES = ["Blast", "Arc", "Antler", "Brave", "Brush", "Dark", "Eclipse", "Fang", "Flare", "Flame", "Fort", "Hunt", "Might", "Reaper", "Volt", "Wriggle"];
const CXE_BLADES = ["Blitz", "Fortress", "Rage"];
const CXE_OVER_BLADES = ["Break", "Guard", "Flow"];
const CX_ASSISTS = ["Slash", "Round", "Bumper", "Turn", "Charge", "Jaggy", "Assault", "Wheel", "Massive", "Dual", "Free", "Heavy", "Zillion", "Knuckle", "Vertical", "Erase"];
const CX_ASSIST_TOP5 = ["Heavy", "Wheel", "Slash", "Free", "Dual"];

// Split a part name into display lines for buttons
// Splits on space or dash (removing dash), returns array of words
function splitPartName(name, keepDash) {
  // keepDash=true: only split on spaces (ratchets keep their dashes e.g. "1-60")
  // keepDash=false (default): split on spaces; bit names now use spaces not dashes
  if (keepDash) return name.split(" ").filter(Boolean);
  return name.split(" ").filter(Boolean);
}
// Render a part name in a button: multi-line if 2+ words, sized to fill space
function PartLabel({
  name,
  size,
  keepDash
}) {
  const words = splitPartName(name, keepDash);
  if (words.length === 1) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: size || 13,
        fontWeight: 800,
        lineHeight: 1.1,
        textAlign: "center"
      }
    }, name);
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
      lineHeight: 1.1,
      textAlign: "center"
    }
  }, words.map((w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: size || 13,
      fontWeight: 800
    }
  }, w)));
}

// Quick full combos for blade picker shortcuts
// Quick Combos: 5 columns × 2 rows, left-to-right then top-to-bottom
// Row 1: flagship combos | Row 2: secondary combos
const QUICK_COMBOS = [{
  blade: "Wizard Rod",
  ratchet: "1-60",
  bit: "Hexa"
}, {
  blade: "Shark Scale",
  ratchet: "3-60",
  bit: "Low Rush"
}, {
  blade: "Cobalt Dragoon",
  ratchet: "5-60",
  bit: "Elevate"
}, {
  blade: "Aero Pegasus",
  ratchet: "1-60",
  bit: "Rush"
}, {
  blade: "Hover Wyvern",
  ratchet: "9-60",
  bit: "Kick"
}, {
  blade: "Shark Scale",
  ratchet: "9-60",
  bit: "Free Ball"
}, {
  blade: "Shark Scale",
  ratchet: "7-60",
  bit: "Free Flat"
}, {
  blade: "Meteor Dragoon",
  ratchet: "7-70",
  bit: "Level"
}, {
  blade: "Golem Rock",
  ratchet: "9-60",
  bit: "Free Ball"
}, {
  blade: "Clock Mirage",
  ratchet: "7-55",
  bit: "Low Orb"
}];

// Top 10 priority items per category (displayed first as a group)
const TOP10 = {
  // All three lists are in popularity order (most used first).
  blades: ["Wizard Rod", "Shark Scale", "Cobalt Dragoon", "Aero Pegasus", "Meteor Dragoon", "Suppress Superion", "Dran Strike", "Hover Wyvern", "Glory Valkyrie", "Bullet Griffon", "Golem Rock", "Ring Aether", "Silver Wolf", "Phoenix Wing", "Clock Mirage"],
  ratchets: ["1-60", "9-60", "3-60", "1-50", "7-60", "5-60", "1-70", "5-50", "0-60", "7-70"],
  bits: ["Hexa", "Rush", "Elevate", "Low Rush", "Free Ball", "Narrow", "Kick", "Level", "Low Orb", "Orb"]
};

// Individual colors for top 15 blades
// Blades not listed here fall back to grey wherever combos are shown.
const BLADE_COLORS = {
  "Wizard Rod": "#EAB308",
  // yellow
  "Shark Scale": "#7C3AED",
  // purple
  "Cobalt Dragoon": "#1E40AF",
  // dark blue
  "Aero Pegasus": "#0D9488",
  // teal
  "Meteor Dragoon": "#A855F7",
  // bright purple
  "Suppress Superion": "#A16207",
  // darker gold
  "Dran Strike": "#2563EB",
  // bright blue (brighter than Cobalt Dragoon)
  "Hover Wyvern": "#16A34A",
  // bright green
  "Glory Valkyrie": "#1E3A8A",
  // darker blue (darker than Cobalt Dragoon)
  "Bullet Griffon": "#991B1B",
  // dark red (darker than Phoenix Wing)
  "Golem Rock": "#EA580C",
  // orange
  "Ring Aether": "#FDE047",
  // pale yellow (lighter than Wizard Rod)
  "Silver Wolf": "#64748B",
  // grey
  "Phoenix Wing": "#DC2626",
  // pure red
  "Clock Mirage": "#EC4899" // pink
};

// Numerical order for ratchets: by first number, then second ("0-60", "0-70", "1-50" ...).
// Anything that is not a plain number-number name (M-85, Operate, Turbo) goes at the end, A to Z.
function sortRatchetsNumeric(names) {
  const key = n => {
    const m = /^(\d+)-(\d+)$/.exec(n);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
  };
  return [...names].sort((a, b) => {
    const ka = key(a),
      kb = key(b);
    if (ka && kb) return ka[0] - kb[0] || ka[1] - kb[1];
    if (ka) return -1;
    if (kb) return 1;
    return a.localeCompare(b);
  });
}
function mergeWithDefaults(saved) {
  // Merge: defaults keep their order (pinned first), user extras appended alphabetically.
  // new Set deduplicates in case the stored data has duplicate entries.
  function mergeList(defaults, saved) {
    const deduped = [...new Set(saved || [])];
    const extras = deduped.filter(x => !defaults.includes(x)).sort();
    return [...new Set([...defaults, ...extras])];
  }
  // CX sub-lists: each category merges its hardcoded defaults with any saved extras
  const savedCx = saved.cx || {};
  const cx = {
    crossover: mergeList(CROSSOVER_BLADES, savedCx.crossover),
    gear_chips: mergeList(CX_CHIPS, savedCx.gear_chips),
    cx_blades: mergeList(CX_BLADES, savedCx.cx_blades),
    cxe_blades: mergeList(CXE_BLADES, savedCx.cxe_blades),
    cxe_over: mergeList(CXE_OVER_BLADES, savedCx.cxe_over),
    assist: mergeList(CX_ASSISTS, savedCx.assist),
    uxe: mergeList(UXE_BLADES, savedCx.uxe)
  };
  // parts.blades stays as the flat union of everything (used by deck builder logic)
  const allCxParts = [...new Set([...cx.crossover, ...cx.gear_chips, ...cx.cx_blades, ...cx.cxe_blades, ...cx.cxe_over, ...cx.assist, ...cx.uxe])];
  return {
    blades: mergeList(DEFAULT_PARTS.blades, [...(saved.blades || []), ...allCxParts]),
    ratchets: mergeList(DEFAULT_PARTS.ratchets, saved.ratchets),
    bits: mergeList(DEFAULT_PARTS.bits, saved.bits),
    cx // per-category lists for library display and deck builder pickers
  };
}

/* ═══════════════════════════════════════
   ICONS
═══════════════════════════════════════ */
const IC = {
  plus: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })),
  back: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  upload: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 8 12 3 7 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "3",
    x2: "12",
    y2: "15"
  })),
  download: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 10 12 15 17 10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3"
  })),
  trash: /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  })),
  check: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  history: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 6 12 12 16 14"
  })),
  undo: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "1 4 1 10 7 10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
  })),
  redo: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "23 4 23 10 17 10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20.49 15a9 9 0 1 1-2.13-9.36L23 10"
  })),
  editLog: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
  })),
  gear: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  })),
  x: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })),
  db: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("ellipse", {
    cx: "12",
    cy: "5",
    rx: "9",
    ry: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
  }))
};
const FINISH = [{
  id: "SPF",
  p: 1,
  name: "Spin Finish"
}, {
  id: "OVR",
  p: 2,
  name: "Over Finish"
}, {
  id: "BST",
  p: 2,
  name: "Burst Finish"
}, {
  id: "XTR",
  p: 3,
  name: "Xtreme Finish"
}];
// Penalty finishes: listed under the LOSER, points go to OPPONENT
const PENALTY = [{
  id: "OF2",
  p: 2,
  name: "Own Finish",
  penalty: true
}, {
  id: "OF3",
  p: 3,
  name: "Own Finish",
  penalty: true
}, {
  id: "LER",
  p: 1,
  name: "Launch Error",
  penalty: true
}];
const FIN_BY_ID = {};
[...FINISH, ...PENALTY].forEach(f => {
  FIN_BY_ID[f.id] = f;
});
// Win conditions selectable in Misreport Mode (everything except Launch Error,
// which stays locked/uneditable for now).
const MISREPORT_WIN_CONDITIONS = [...FINISH, ...PENALTY.filter(f => f.id !== "LER")];

/* ═══════════════════════════════════════
   MISREPORT ENGINE
   Pure function: takes the current match's battle log (with any in-progress
   edits already merged in) and recomputes scores + finds impossible states.
   Nothing here touches React state directly — MisreportScreen calls this on
   every edit to redraw scores/errors, and MatchScreen calls it once more on
   Save to build the corrected log and the live state to resume the match from.

   Rules baked in on purpose (matches how the live scoring screen behaves):
   - A battle's Set/Shuffle tag is NEVER changed by an edit. Edits can only
     make the recorded outcome of a battle disagree with those tags — when
     that happens we flag it in `errors` instead of silently renumbering.
   - LER-STRIKE (the warning before a real Launch Error) is a pass-through:
     it never appears in Misreport Mode and never changes score or bey usage.
   - A scored Launch Error ("LER") does NOT use up a bey — same as live play.
   - The "winner" on every row already means "whoever gained the points",
     including penalty rows, so no separate flip is needed here.
═══════════════════════════════════════ */
function computeMisreportLog(entries, config, need) {
  let runScore = [0, 0]; // running point total within the current frozen `set` tag
  let curSetTag = null;
  let setsWon = [0, 0];
  let setScoresOut = [];
  const setOverAt = {}; // set tag -> true once someone reached the win target in that set
  let matchOverAtIdx = null; // sequence index after which the match should already be over
  const usageByGroup = {}; // "set-shuffle" -> [Set(p1ComboIdx used), Set(p2ComboIdx used)]
  let lerStrikes = [0, 0];
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const errors = [];
    if (e.type === "LER-STRIKE") {
      // Pass-through — doesn't affect score, bey usage, or set progression.
      const gk = `${e.set}-${e.shuffle}`;
      out.push({
        ...e,
        p1Score: runScore[0],
        p2Score: runScore[1],
        errors,
        _pp: [...runScore],
        _ps: [...setsWon],
        _u1: Array.from(usageByGroup[gk]?.[0] || []),
        _u2: Array.from(usageByGroup[gk]?.[1] || []),
        _ls: [...lerStrikes],
        _ss: [...setScoresOut]
      });
      const strikeFor = e._lerStrikeFor !== undefined ? e._lerStrikeFor : e.scorerIdx;
      lerStrikes = [0, 0];
      lerStrikes[strikeFor] = 1;
      continue;
    }
    if (curSetTag === null || e.set !== curSetTag) {
      runScore = [0, 0];
      curSetTag = e.set;
    }
    if (setOverAt[e.set]) {
      errors.push({
        scope: "row",
        msg: "This set already ended in an earlier battle — this battle happens after that."
      });
    }
    if (matchOverAtIdx !== null && i > matchOverAtIdx) {
      errors.push({
        scope: "row",
        msg: "The match should have already ended before this battle — a player already reached enough sets to win."
      });
    }
    // Snapshot "before this battle" state for undo/redo bookkeeping.
    const beforePts = [...runScore];
    const beforeSets = [...setsWon];
    const groupKey = `${e.set}-${e.shuffle}`;
    if (!usageByGroup[groupKey]) usageByGroup[groupKey] = [new Set(), new Set()];
    const beforeU1 = Array.from(usageByGroup[groupKey][0]);
    const beforeU2 = Array.from(usageByGroup[groupKey][1]);
    const beforeLs = [...lerStrikes];
    const beforeSs = [...setScoresOut];
    const fin = FIN_BY_ID[e.type];
    const scoringPi = e.scorerIdx; // slider = whoever gains the points, directly
    const cap = config.pts > 0 ? config.pts : Infinity;
    const raw = [...runScore];
    raw[scoringPi] = Math.min(raw[scoringPi] + fin.p, cap);
    runScore = raw;
    // Bey-reuse check — a scored Launch Error does not consume a bey.
    if (e.type !== "LER") {
      if (usageByGroup[groupKey][0].has(e.p1ComboIdx)) {
        errors.push({
          scope: "p1combo",
          msg: "This player already used this combo earlier in this shuffle."
        });
      } else {
        usageByGroup[groupKey][0].add(e.p1ComboIdx);
      }
      if (usageByGroup[groupKey][1].has(e.p2ComboIdx)) {
        errors.push({
          scope: "p2combo",
          msg: "This player already used this combo earlier in this shuffle."
        });
      } else {
        usageByGroup[groupKey][1].add(e.p2ComboIdx);
      }
    }
    if (config.pts > 0 && runScore[scoringPi] >= config.pts && !setOverAt[e.set]) {
      setOverAt[e.set] = true;
      setsWon[scoringPi] += 1;
      setScoresOut.push({
        p1: runScore[0],
        p2: runScore[1]
      });
      if (setsWon[scoringPi] >= need && matchOverAtIdx === null) {
        matchOverAtIdx = i;
      }
    }
    lerStrikes = [0, 0];
    out.push({
      ...e,
      scorer: scoringPi === 0 ? e.p1Name : e.p2Name,
      typeName: fin.name,
      points: fin.p,
      penalty: fin.penalty || false,
      winnerCombo: comboStr(scoringPi === 0 ? {
        blade: e.p1Combo?.blade,
        ratchet: e.p1Combo?.ratchet,
        bit: e.p1Combo?.bit
      } : {
        blade: e.p2Combo?.blade,
        ratchet: e.p2Combo?.ratchet,
        bit: e.p2Combo?.bit
      }),
      p1Score: runScore[0],
      p2Score: runScore[1],
      errors,
      _pp: beforePts,
      _ps: beforeSets,
      _u1: beforeU1,
      _u2: beforeU2,
      _ls: beforeLs,
      _ss: beforeSs
    });
  }
  const hasErrors = out.some(r => r.errors.length > 0);
  const last = entries[entries.length - 1];
  let finalState;
  if (!last) {
    finalState = {
      pts: [0, 0],
      sets: [0, 0],
      curSet: 1,
      shuf: 1,
      used1: [],
      used2: [],
      phase: "battle"
    };
  } else if (matchOverAtIdx === entries.length - 1) {
    finalState = {
      pts: runScore,
      sets: setsWon,
      curSet: curSetTag,
      shuf: last.shuffle,
      used1: [],
      used2: [],
      phase: "over"
    };
  } else if (setOverAt[last.set] && last.type !== "LER-STRIKE") {
    finalState = {
      pts: [0, 0],
      sets: setsWon,
      curSet: curSetTag + 1,
      shuf: 1,
      used1: [],
      used2: [],
      phase: "order"
    };
  } else {
    const groupKey = `${last.set}-${last.shuffle}`;
    const u1 = Array.from(usageByGroup[groupKey]?.[0] || []);
    const u2 = Array.from(usageByGroup[groupKey]?.[1] || []);
    if (u1.length >= 3 && u2.length >= 3) {
      finalState = {
        pts: runScore,
        sets: setsWon,
        curSet: curSetTag,
        shuf: last.shuffle + 1,
        used1: [],
        used2: [],
        phase: "order"
      };
    } else {
      finalState = {
        pts: runScore,
        sets: setsWon,
        curSet: curSetTag,
        shuf: last.shuffle,
        used1: u1,
        used2: u2,
        phase: "battle"
      };
    }
  }
  finalState.setScores = setScoresOut;
  finalState.lerStrikes = lerStrikes;
  return {
    rows: out,
    hasErrors,
    finalState
  };
}

// UXE Expanded line: blade + bit only, no ratchet slot.
const UXE_BLADES = ["Bullet Griffon", "Cutter Shinobi", "Rampart Aegis", "Valor Bison", "Glory Valkyrie", "Hells Nether"];
const NO_RATCHET_BLADES = UXE_BLADES;
// Combo ratchets that include a built-in bit — no separate bit needed.
const NO_BIT_RATCHETS = ["Turbo", "Operate"];
const emptyCombo = () => ({
  blade: null,
  ratchet: null,
  bit: null
});
const comboStr = c => {
  if (!c?.blade) return "—";
  if (NO_RATCHET_BLADES.includes(c.blade)) return c.bit ? `${c.blade} ${c.bit}` : "—";
  if (!c.ratchet) return "—";
  if (NO_BIT_RATCHETS.includes(c.ratchet)) return `${c.blade} ${c.ratchet}`;
  return c.bit ? `${c.blade} ${c.ratchet} ${c.bit}` : "—";
};
const comboReady = c => {
  if (!c?.blade) return false;
  if (NO_RATCHET_BLADES.includes(c.blade)) return !!c.bit;
  if (!c.ratchet) return false;
  if (NO_BIT_RATCHETS.includes(c.ratchet)) return true;
  return !!c.bit;
};
// Normalize a combo loaded from storage: replace dashes in bit names with spaces
// Ratchets like "1-60" are intentionally excluded (they contain only digits around the dash)
const normalizeBit = bit => bit ? bit.replace(/-(?![0-9])/g, " ") : bit;
const normalizeCombo = c => c ? {
  ...c,
  bit: normalizeBit(c.bit)
} : c;
// Truncate display names longer than 15 chars to 12 + ellipsis
const tn = name => name && name.length > 15 ? name.slice(0, 12) + "…" : name || "";

(window.__NCB_PARTS = window.__NCB_PARTS || {}).core = true; // ticks this file's box - app.js checks all boxes before starting
