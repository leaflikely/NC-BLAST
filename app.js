// NC BLAST app.js | last updated: 2026-07-04 | feature: Undo button added to the Set Deck Order screen (hidden on the very first order screen of a match, and hidden while the shuffle countdown timer is showing), reusing the existing undo() logic so it can drop straight back into the previous battle
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;

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
  challongeMap: "bx-challonge-map-v1",
  overlaySlot: "bx-overlay-slot-v1",
  lastJudge: "ncblast-last-judge-v1",
  matchResume: "ncblast-match-resume-v1",
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

// Push one player's combos into the tournament-scoped registry.
// The Worker merges this player's entry without touching other players.
async function pushCombosForTournament(slug, playerName, combos) {
  if (!slug || !playerName) return;
  try {
    await fetch(`${OVERLAY_WORKER}/combos/slug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        slug,
        player: playerName,
        combos: combos || []
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (_) {}
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
const DEFAULT_PARTS = {
  blades: ["Wizard Rod", "Shark Scale", "Cobalt Dragoon", "Aero Pegasus", "Hover Wyvern", "Golem Rock", "Meteor Dragoon", "Phoenix Wing", "Silver Wolf", "Clock Mirage", "Antler", "Arc", "Assault", "Bear Scratch", "Bite Croc", "Black Shell", "Blast", "Blitz", "Brave", "Break", "Brush", "Bullet Griffon", "Bumper", "Bumblebee", "Captain America", "Charge", "Chewbacca", "Cobalt Drake", "Crimson Garuda", "Cutter Shinobi", "Dark", "Darth Vader", "Draciel Shield", "Dragoon Storm", "Dran Buster", "Dran Dagger", "Dran Strike", "Dran Sword", "Dranzer Spiral", "Driger S", "Dual", "Eclipse", "Emperor", "Erase", "Fang", "Flame", "Flare", "Flow", "Fort", "Fortress", "Free", "General Grievous", "Ghost Circle", "Gill Shark", "Goat Tackle", "Green Goblin", "Guard", "Hack Viking", "Heavy", "Hells Chain", "Hells Hammer", "Hells Scythe", "Hunt", "Impact Drake", "Iron Man", "Jaggy", "Knight Lance", "Knight Mail", "Knight Shield", "Knuckle", "Leon Claw", "Leon Crest", "Lightning L-Drago", "Luke Skywalker", "Massive", "Megatron", "Might", "Miles Morales", "Moff Gideon", "Mosasaurus", "Mummy Curse", "Obi-Wan Kenobi", "Optimus Primal", "Optimus Prime", "Orochi Cluster", "Phoenix Feather", "Phoenix Rudder", "Ptera Wing", "Quetzalcoatlus", "Rage", "Rampart Aegis", "Reaper", "Red Hulk", "Rhino Horn", "Ridge Triceratops", "Ring Aether", "Rock Leone", "Round", "Samurai Calibur", "Samurai Saber", "Samurai Steel", "Scorpio Spear", "Shadow Shinobi", "Shark Edge", "Shelter Drake", "Shinobi Knife", "Slash", "Soundwave", "Sphinx Cowl", "Spider-Man", "Spinosaurus", "Standard", "Starscream", "Storm Pegasus", "Storm Spriggan", "Storm Trooper", "Stun Medusa", "T.Rex", "Thanos", "The Mandalorian", "Tricera Press", "Turn", "Tusk Mammoth", "Tyranno Beat", "Tyranno Roar", "Unicorn Sting", "Valor Bison", "Valkyrie", "Venom", "Vertical", "Victory Valkyrie", "Viper Tail", "Volt", "Weiss Tiger", "Whale Wave", "Wheel", "Wizard Arrow", "Wriggle", "Wyvern Gale", "Xeno Xcalibur", "Yell Kong", "Zillion"],
  ratchets: ["1-60", "3-60", "9-60", "7-60", "5-60", "1-70", "1-50", "7-70", "7-55", "8-70", "0-60", "0-70", "0-80", "1-80", "2-60", "2-70", "2-80", "3-70", "3-80", "3-85", "4-50", "4-55", "4-60", "4-70", "4-80", "5-70", "5-80", "6-60", "6-70", "6-80", "7-80", "9-65", "9-70", "9-80", "M-85", "Operate", "Turbo"],
  bits: ["Elevate", "Rush", "Low Rush", "Free Ball", "Hexa", "Low Orb", "Kick", "Level", "Ball", "Jolt", "Accel", "Bound Spike", "Cyclone", "Disk Ball", "Disk Spike", "Dot", "Flat", "Free Flat", "Gear Ball", "Gear Flat", "Gear Needle", "Gear Point", "Gear Rush", "Glide", "High Needle", "High Taper", "Ignition", "Low Flat", "Merge", "Needle", "Orb", "Point", "Quake", "Rubber Accel", "Spike", "Taper", "Trans Kick", "Trans Point", "Under Flat", "Under Needle", "Unite", "Vortex", "Wall Ball", "Wall Wedge", "Wedge", "Yielding", "Zap"]
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
  blades: ["Shark Scale", "Wizard Rod", "Aero Pegasus", "Cobalt Dragoon", "Hover Wyvern", "Meteor Dragoon", "Phoenix Wing", "Dran Strike", "Golem Rock", "Silver Wolf", "Clock Mirage", "Tyranno Beat", "Dran Buster", "Knight Mail", "Bullet Griffon"],
  ratchets: ["1-50", "1-60", "1-70", "3-60", "5-60", "7-55", "7-60", "7-70", "8-70", "9-60"],
  bits: ["Ball", "Elevate", "Free Ball", "Hexa", "Jolt", "Kick", "Level", "Low Orb", "Low Rush", "Rush"]
};

// Individual colors for top 15 blades
const BLADE_COLORS = {
  "Shark Scale": "#7C3AED",
  // purple
  "Wizard Rod": "#EAB308",
  // yellow
  "Aero Pegasus": "#0D9488",
  // teal
  "Cobalt Dragoon": "#1E40AF",
  // dark blue
  "Hover Wyvern": "#16A34A",
  // bright green
  "Meteor Dragoon": "#A855F7",
  // bright purple
  "Phoenix Wing": "#DC2626",
  // pure red
  "Dran Strike": "#2563EB",
  // bright blue (brighter than Cobalt Dragoon)
  "Golem Rock": "#EA580C",
  // orange
  "Silver Wolf": "#64748B",
  // grey
  "Clock Mirage": "#EC4899",
  // pink
  "Tyranno Beat": "#166534",
  // dark green
  "Dran Buster": "#1E3A8A",
  // darker blue (darker than Cobalt Dragoon)
  "Knight Mail": "#4ADE80",
  // mid green (between Hover and Tyranno)
  "Bullet Griffon": "#991B1B" // dark red (darker than Phoenix Wing)
};
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

// UXE Expanded line: blade + bit only, no ratchet slot.
const UXE_BLADES = ["Bullet Griffon", "Cutter Shinobi", "Rampart Aegis", "Valor Bison"];
const NO_RATCHET_BLADES = UXE_BLADES;
const emptyCombo = () => ({
  blade: null,
  ratchet: null,
  bit: null
});
const comboStr = c => {
  if (!c?.blade || !c?.bit) return "—";
  if (NO_RATCHET_BLADES.includes(c.blade)) return `${c.blade} ${c.bit}`;
  return c.ratchet ? `${c.blade} ${c.ratchet} ${c.bit}` : "—";
};
const comboReady = c => {
  if (!c?.blade || !c?.bit) return false;
  if (NO_RATCHET_BLADES.includes(c.blade)) return true;
  return !!c.ratchet;
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

/* ═══════════════════════════════════════
   STYLES
═══════════════════════════════════════ */
let S = {}; // module-level, updated each BeyJudgeApp render
function makeS(sc) {
  const p = n => Math.round(n * sc); // scale pixels
  const f = n => Math.round(n * sc); // scale font
  const r = n => Math.round(n * sc); // scale radius
  return {
    page: {
      maxWidth: p(480),
      margin: "0 auto",
      padding: `${p(14)}px ${p(14)}px ${p(80)}px`,
      boxSizing: "border-box"
    },
    logo: {
      fontSize: f(30),
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0,
      letterSpacing: -1
    },
    title: {
      fontSize: f(22),
      fontWeight: 800,
      color: "var(--text-primary)",
      textAlign: "center",
      margin: `0 0 ${p(4)}px`
    },
    sub: {
      textAlign: "center",
      color: "var(--text-muted)",
      fontSize: f(13),
      marginBottom: p(20),
      fontWeight: 500
    },
    label: {
      fontSize: f(14),
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: `0 0 ${p(7)}px`
    },
    card: {
      background: "var(--surface)",
      borderRadius: r(14),
      padding: `${p(12)}px ${p(12)}px`,
      boxShadow: "0 1px 4px var(--shadow),0 4px 14px var(--shadow)",
      marginBottom: p(12)
    },
    row: {
      display: "flex",
      gap: p(8),
      flexWrap: "wrap"
    },
    chip: {
      padding: `${p(8)}px ${p(14)}px`,
      borderRadius: r(10),
      border: "2px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: f(13),
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    },
    chipOn: {
      background: "#EA580C",
      borderColor: "#EA580C",
      color: "#fff"
    },
    chipBl: {
      background: "#1D4ED8",
      borderColor: "#1D4ED8",
      color: "#fff"
    },
    chipW: {
      flex: 1,
      textAlign: "center"
    },
    pri: {
      display: "block",
      width: "100%",
      padding: `${p(11)}px 0`,
      borderRadius: r(12),
      border: "none",
      background: "linear-gradient(135deg,#1D4ED8,#2563EB)",
      color: "#fff",
      fontSize: f(15),
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
      marginBottom: p(8)
    },
    sec: {
      display: "inline-flex",
      alignItems: "center",
      gap: p(6),
      padding: `${p(11)}px ${p(18)}px`,
      borderRadius: r(10),
      border: "2px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: f(13),
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    },
    back: {
      display: "inline-flex",
      alignItems: "center",
      gap: p(4),
      background: "none",
      border: "none",
      color: "var(--text-muted)",
      fontSize: f(13),
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      marginBottom: p(14),
      padding: 0
    },
    tBar: {
      display: "flex",
      borderBottom: "2px solid #F1F5F9",
      marginBottom: p(14)
    },
    tBtn: {
      flex: 1,
      padding: `${p(6)}px 0 ${p(8)}px`,
      border: "none",
      background: "none",
      fontSize: f(13),
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: p(5)
    },
    bdg: {
      display: "inline-block",
      padding: `${p(1)}px ${p(6)}px`,
      borderRadius: r(20),
      color: "#fff",
      fontSize: f(10),
      fontWeight: 700
    },
    addR: {
      display: "flex",
      gap: p(8),
      marginBottom: p(10)
    },
    inp: {
      flex: 1,
      padding: `${p(9)}px ${p(12)}px`,
      borderRadius: r(10),
      border: "2px solid var(--border)",
      fontSize: f(13),
      fontFamily: "'Outfit',sans-serif",
      outline: "none",
      background: "var(--input-bg)",
      color: "var(--text-primary)"
    },
    addB: {
      width: p(40),
      height: p(40),
      borderRadius: r(10),
      border: "none",
      color: "#fff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    },
    upBtn: {
      display: "flex",
      alignItems: "center",
      gap: p(7),
      width: "100%",
      padding: `${p(9)}px ${p(12)}px`,
      borderRadius: r(10),
      border: "2px dashed var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-muted)",
      fontSize: f(12),
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      marginBottom: p(6)
    },
    hint: {
      fontSize: f(10),
      color: "var(--text-faint)",
      textAlign: "center",
      margin: `${p(2)}px 0 ${p(10)}px`
    },
    chs: {
      display: "flex",
      flexWrap: "wrap",
      gap: p(7)
    },
    ptag: {
      display: "inline-flex",
      alignItems: "center",
      gap: p(5),
      padding: `${p(5)}px ${p(10)}px`,
      borderRadius: r(7),
      border: "1px solid",
      fontSize: f(12),
      fontWeight: 600
    },
    xBtn: {
      background: "none",
      border: "none",
      color: "#EF4444",
      cursor: "pointer",
      padding: 1,
      display: "flex",
      opacity: 0.5
    },
    empty: {
      color: "var(--text-disabled)",
      fontSize: f(12),
      fontStyle: "italic",
      padding: `${p(10)}px 0`,
      width: "100%",
      textAlign: "center"
    },
    pT: {
      padding: `${p(7)}px ${p(14)}px`,
      borderRadius: r(8),
      fontSize: f(13),
      fontWeight: 700,
      background: "var(--surface)",
      color: "var(--text-primary)"
    },
    pill: {
      display: "inline-block",
      padding: `${p(3)}px ${p(10)}px`,
      background: "var(--pill-bg)",
      borderRadius: r(6),
      fontSize: f(11),
      fontWeight: 600,
      color: "var(--text-muted)",
      margin: `0 ${p(3)}px ${p(4)}px`
    },
    barBtn: {
      display: "flex",
      alignItems: "center",
      gap: p(4),
      background: "none",
      border: "none",
      color: "var(--text-muted)",
      cursor: "pointer",
      padding: `${p(8)}px ${p(12)}px`,
      borderRadius: r(12),
      fontSize: f(13),
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif"
    },
    barLbl: {
      fontSize: f(13),
      fontWeight: 600,
      color: "var(--text-muted)"
    },
    barDiv: {
      width: 1,
      height: p(24),
      background: "var(--border)",
      margin: `0 ${p(2)}px`
    }
  };
} // end makeS

/* ═══════════════════════════════════════
   LIBRARY MANAGER
═══════════════════════════════════════ */
function LibraryManager({
  parts,
  setParts,
  onClose
}) {
  const [tab, setTab] = useState("blades");
  const [inp, setInp] = useState("");
  const [libSearch, setLibSearch] = useState("");
  const fRef = useRef();

  // Master key gate state
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [saving, setSaving] = useState(false);

  // Pending change waiting for key confirmation
  const [pending, setPending] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const [dupError, setDupError] = useState("");

  // All 9 tabs. CX tabs all read/write from parts.blades underneath.
  const TABS = [{
    k: "blades",
    l: "Blades",
    c: "#EA580C",
    src: "blades"
  }, {
    k: "crossover",
    l: "Crossover",
    c: "#EA580C",
    src: "blades"
  }, {
    k: "gear_chips",
    l: "Gear Chips",
    c: "#7C3AED",
    src: "blades"
  }, {
    k: "cx_blades",
    l: "CX Blades",
    c: "#7C3AED",
    src: "blades"
  }, {
    k: "cxe_blades",
    l: "CXE Blades",
    c: "#7C3AED",
    src: "blades"
  }, {
    k: "cxe_over",
    l: "CXE Over",
    c: "#7C3AED",
    src: "blades"
  }, {
    k: "assist",
    l: "Assist Blades",
    c: "#7C3AED",
    src: "blades"
  }, {
    k: "uxe",
    l: "UXE",
    c: "#D97706",
    src: "blades"
  }, {
    k: "ratchets",
    l: "Ratchets",
    c: "#1D4ED8",
    src: "ratchets"
  }, {
    k: "bits",
    l: "Bits",
    c: "#15803D",
    src: "bits"
  }];
  const curTab = TABS.find(t => t.k === tab) || TABS[0];
  const ac = curTab.c;
  const partsSrc = curTab.src;

  // Push parts to Worker with master key
  const pushToServer = async (newParts, key) => {
    const res = await fetch(`${OVERLAY_WORKER}/parts/set`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": key
      },
      body: JSON.stringify({
        parts: newParts
      }),
      signal: AbortSignal.timeout(8000)
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || "Save failed");
  };

  // Apply a confirmed change to server + local state
  const applyChange = async newParts => {
    setSaving(true);
    setKeyError("");
    try {
      await pushToServer(newParts, keyInput.trim());
      setParts(newParts);
      sSave(KEYS.parts, newParts);
      setPending(null);
      setKeyInput("");
      setInp("");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) {
      if (e.message === "Invalid master key") {
        setKeyError("Wrong master key — try again.");
      } else {
        setKeyError("Save failed: " + e.message);
      }
    } finally {
      setSaving(false);
    }
  };
  const CX_TAB_KEYS = ["crossover", "gear_chips", "cx_blades", "cxe_blades", "cxe_over", "assist", "uxe"];
  const requestAdd = () => {
    const v = inp.trim();
    if (!v) return;
    const isCxTab = CX_TAB_KEYS.includes(tab);
    // Duplicate check against the right list
    const currentList = isCxTab ? (parts.cx || {})[tab] || [] : parts[partsSrc] || [];
    if (currentList.includes(v)) {
      setDupError(`"${v}" is already in this category.`);
      setTimeout(() => setDupError(""), 3000);
      return;
    }
    setDupError("");
    let n;
    if (isCxTab) {
      // Add to the specific CX sub-list and also to parts.blades (for deck builder logic)
      const newCxList = [...new Set([...currentList, v])].sort();
      const newCx = {
        ...(parts.cx || {}),
        [tab]: newCxList
      };
      const newBlades = [...new Set([...parts.blades, v])].sort();
      n = {
        ...parts,
        cx: newCx,
        blades: newBlades
      };
    } else {
      // Standard blades, ratchets, bits — write directly to the flat list
      n = {
        ...parts,
        [partsSrc]: [...new Set([...parts[partsSrc], v])].sort()
      };
    }
    setPending({
      preview: n,
      label: `Add "${v}" to ${curTab.l}`
    });
  };
  const requestDel = (cat, name) => {
    // cat is the tab key for CX tabs, or "blades"/"ratchets"/"bits" for standard tabs
    let n;
    if (CX_TAB_KEYS.includes(cat)) {
      // Remove from the CX sub-list and from parts.blades
      const newCxList = ((parts.cx || {})[cat] || []).filter(x => x !== name);
      const newCx = {
        ...(parts.cx || {}),
        [cat]: newCxList
      };
      // Only remove from parts.blades if no other CX category still uses this part
      const stillUsed = CX_TAB_KEYS.some(k => k !== cat && ((parts.cx || {})[k] || []).includes(name));
      const newBlades = stillUsed ? parts.blades : parts.blades.filter(x => x !== name);
      n = {
        ...parts,
        cx: newCx,
        blades: newBlades
      };
    } else {
      n = {
        ...parts,
        [cat]: parts[cat].filter(x => x !== name)
      };
    }
    setPending({
      preview: n,
      label: `Remove "${name}"`
    });
  };
  const requestImport = newParts => {
    const count = newParts.blades.length + newParts.ratchets.length + newParts.bits.length;
    setPending({
      preview: newParts,
      label: `Save ${count} parts to shared library`
    });
  };
  const onFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const txt = ev.target.result;
      try {
        const j = JSON.parse(txt);
        if (j.blades || j.ratchets || j.bits) {
          const m = {
            blades: [...new Set([...parts.blades, ...(j.blades || [])])].sort(),
            ratchets: [...new Set([...parts.ratchets, ...(j.ratchets || [])])].sort(),
            bits: [...new Set([...parts.bits, ...(j.bits || [])])].sort()
          };
          requestImport(m);
          return;
        }
      } catch {}
      const lines2 = txt.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      const np = {
        blades: [...parts.blades],
        ratchets: [...parts.ratchets],
        bits: [...parts.bits]
      };
      lines2.forEach(line => {
        const [pre, ...rest] = line.split(":");
        if (rest.length) {
          const c = pre.toLowerCase().trim();
          const name = rest.join(":").trim();
          if (c.startsWith("blade") && !np.blades.includes(name)) np.blades.push(name);else if (c.startsWith("ratchet") && !np.ratchets.includes(name)) np.ratchets.push(name);else if (c.startsWith("bit") && !np.bits.includes(name)) np.bits.push(name);
        } else {
          if (!np[tab].includes(line)) np[tab].push(line);
        }
      });
      np.blades.sort();
      np.ratchets.sort();
      np.bits.sort();
      requestImport(np);
    };
    r.readAsText(f);
    e.target.value = "";
  };
  const total = parts.blades.length + parts.ratchets.length + parts.bits.length;

  // CX part grouping — read from parts.cx which merges hardcoded defaults with user additions
  const cx = parts.cx || {};
  const libCrossover = cx.crossover || CROSSOVER_BLADES;
  const libChips = cx.gear_chips || CX_CHIPS;
  const libCxBlades = cx.cx_blades || CX_BLADES;
  const libCxeBlades = cx.cxe_blades || CXE_BLADES;
  const libCxeOver = cx.cxe_over || CXE_OVER_BLADES;
  const libAssists = cx.assist || CX_ASSISTS;
  const libUxeBlades = cx.uxe || UXE_BLADES;
  // Standard blades = everything in parts.blades not claimed by any CX/crossover/UXE category
  const allCxNames = new Set([...libChips, ...libCxBlades, ...libCxeBlades, ...libCxeOver, ...libAssists, ...libUxeBlades]);
  const allXoverNames = new Set(libCrossover);
  const standardBlades = parts.blades.filter(p => !allCxNames.has(p) && !allXoverNames.has(p));
  const tabCount = t => {
    if (t.k === "blades") return standardBlades.length;
    if (t.k === "crossover") return libCrossover.length;
    if (t.k === "gear_chips") return libChips.length;
    if (t.k === "cx_blades") return libCxBlades.length;
    if (t.k === "cxe_blades") return libCxeBlades.length;
    if (t.k === "cxe_over") return libCxeOver.length;
    if (t.k === "assist") return libAssists.length;
    if (t.k === "uxe") return libUxeBlades.length;
    return parts[t.src]?.length || 0;
  };
  const renderTag = (p, cat = "blades") => /*#__PURE__*/React.createElement("span", {
    key: p,
    style: {
      ...S.ptag,
      borderColor: ac + "40",
      background: ac + "0C",
      color: ac
    }
  }, p, /*#__PURE__*/React.createElement("button", {
    style: S.xBtn,
    onClick: () => requestDel(cat, p)
  }, IC.trash));
  const SectionHeader = ({
    label,
    count,
    color
  }) => /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      color: color || ac,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      margin: "16px 0 6px",
      paddingBottom: 4,
      borderBottom: `1px solid ${color || ac}30`
    }
  }, label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      opacity: 0.7
    }
  }, "(", count, ")"));

  // ── Master key confirmation screen ──
  if (pending) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        background: "var(--bg-solid)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        maxWidth: 340
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginBottom: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 36,
        marginBottom: 8
      }
    }, "\uD83D\uDD10"), /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: "0 0 6px"
      }
    }, "Confirm Change"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        margin: 0,
        lineHeight: 1.5
      }
    }, pending.label)), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 14,
        padding: "16px",
        border: "1px solid var(--border)",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-primary)",
        margin: "0 0 10px"
      }
    }, "Enter Master Key to save for all devices"), /*#__PURE__*/React.createElement("input", {
      type: "password",
      placeholder: "Master key\u2026",
      value: keyInput,
      onChange: e => {
        setKeyInput(e.target.value);
        setKeyError("");
      },
      onKeyDown: e => {
        if (e.key === "Enter" && keyInput.trim()) applyChange(pending.preview);
      },
      autoFocus: true,
      style: {
        ...S.inp,
        width: "100%",
        boxSizing: "border-box",
        marginBottom: keyError ? 8 : 0
      }
    }), keyError && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "#EF4444",
        fontWeight: 600,
        margin: "6px 0 0"
      }
    }, keyError)), /*#__PURE__*/React.createElement("button", {
      onClick: () => applyChange(pending.preview),
      disabled: saving || !keyInput.trim(),
      style: {
        width: "100%",
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: saving || !keyInput.trim() ? "var(--border2)" : "#EA580C",
        color: "#fff",
        fontSize: 15,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: saving || !keyInput.trim() ? "not-allowed" : "pointer",
        marginBottom: 10
      }
    }, saving ? "Saving…" : "Save to All Devices →"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setPending(null);
        setKeyInput("");
        setKeyError("");
      },
      disabled: saving,
      style: {
        width: "100%",
        padding: "12px 0",
        borderRadius: 12,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Cancel")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "var(--bg-solid)",
      zIndex: 200,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: S.page.maxWidth,
      margin: "0 auto",
      padding: `20px 16px 40px`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#EA580C"
    }
  }, IC.db), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: "var(--text-primary)"
    }
  }, "Parts Library")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "#F1F5F9",
      border: "none",
      borderRadius: 10,
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "#64748B"
    }
  }, IC.x)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#7C3AED10",
      border: "1px solid #7C3AED30",
      borderRadius: 10,
      padding: "10px 14px",
      marginBottom: 12,
      fontSize: 12,
      color: "#5B21B6",
      fontWeight: 500,
      lineHeight: 1.5
    }
  }, "\uD83C\uDF10 ", /*#__PURE__*/React.createElement("strong", null, "Shared library"), " \u2014 changes apply to all devices. Master key required to add or remove parts."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#EA580C10",
      border: "1px solid #EA580C30",
      borderRadius: 10,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: "#9A3412",
      fontWeight: 500,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("strong", null, total, " parts"), " in the shared library."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, [TABS.slice(0, 3), TABS.slice(3, 6), TABS.slice(6)].map((row, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "flex",
      borderBottom: ri === 2 ? "2px solid #F1F5F9" : "none"
    }
  }, row.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    onClick: () => {
      setTab(t.k);
      setLibSearch("");
    },
    style: {
      ...S.tBtn,
      flex: 1,
      color: tab === t.k ? t.c : "#94A3B8",
      fontWeight: tab === t.k ? 700 : 500,
      fontSize: 10,
      padding: "5px 2px 7px",
      borderBottom: tab === t.k ? `3px solid ${t.c}` : "3px solid transparent",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, t.l, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      ...S.bdg,
      background: t.c,
      opacity: tab === t.k ? 1 : 0.3,
      marginTop: 2
    }
  }, tabCount(t))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.inp,
      width: "100%",
      paddingLeft: 32,
      borderColor: ac + "40"
    },
    placeholder: `Search ${curTab.l}...`,
    value: libSearch,
    onChange: e => setLibSearch(e.target.value),
    autoComplete: "off"
  }), /*#__PURE__*/React.createElement("svg", {
    style: {
      position: "absolute",
      left: 10,
      top: "50%",
      transform: "translateY(-50%)",
      opacity: 0.35
    },
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: ac,
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  })), libSearch && /*#__PURE__*/React.createElement("button", {
    onClick: () => setLibSearch(""),
    style: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: "#94A3B8",
      cursor: "pointer",
      fontSize: 14,
      lineHeight: 1
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: S.addR
  }, /*#__PURE__*/React.createElement("input", {
    style: S.inp,
    placeholder: `Add to ${curTab.l}…`,
    value: inp,
    onChange: e => {
      setInp(e.target.value);
      setDupError("");
    },
    onKeyDown: e => e.key === "Enter" && requestAdd()
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.addB,
      background: ac
    },
    onClick: requestAdd
  }, IC.plus)), dupError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "#EF4444",
      fontWeight: 600,
      margin: "4px 0 0"
    }
  }, dupError), saveOk && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "#22C55E",
      fontWeight: 700,
      margin: "4px 0 0"
    }
  }, "\u2713 Saved to library"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    ref: fRef,
    accept: ".json,.csv,.txt",
    style: {
      display: "none"
    },
    onChange: onFile
  }), /*#__PURE__*/React.createElement("button", {
    style: S.upBtn,
    onClick: () => fRef.current.click()
  }, IC.upload, " Import Parts File"), /*#__PURE__*/React.createElement("p", {
    style: S.hint
  }, "JSON: {\"blades\":[], \"ratchets\":[], \"bits\":[]} or text one per line"), (() => {
    const search = libSearch.toLowerCase();
    const f = list => search ? list.filter(p => p.toLowerCase().includes(search)) : list;
    // For all CX blade sub-tabs: look up the right list, render flat
    const cxTabMap = {
      blades: {
        list: standardBlades,
        label: "Standard Blades",
        empty: "No standard blades in library"
      },
      crossover: {
        list: libCrossover,
        label: "Crossover Blades",
        empty: "No crossover blades in library"
      },
      gear_chips: {
        list: libChips,
        label: "Gear Chips",
        empty: "No gear chips in library"
      },
      cx_blades: {
        list: libCxBlades,
        label: "CX Blades",
        empty: "No CX blades in library"
      },
      cxe_blades: {
        list: libCxeBlades,
        label: "CXE Blades",
        empty: "No CXE blades in library"
      },
      cxe_over: {
        list: libCxeOver,
        label: "CXE Over Blades",
        empty: "No CXE Over Blades in library"
      },
      assist: {
        list: libAssists,
        label: "Assist Blades",
        empty: "No assist blades in library"
      },
      uxe: {
        list: libUxeBlades,
        label: "UXE Blades",
        empty: "No UXE blades in library"
      }
    };
    if (cxTabMap[tab]) {
      const {
        list,
        label,
        empty
      } = cxTabMap[tab];
      const filtered = f(list);
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...S.card,
          marginTop: 8
        }
      }, filtered.length === 0 ? /*#__PURE__*/React.createElement("p", {
        style: S.empty
      }, libSearch ? `No matches for "${libSearch}"` : empty) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHeader, {
        label: label,
        count: filtered.length,
        color: tab === "blades" || tab === "crossover" ? "#EA580C" : "#7C3AED"
      }), /*#__PURE__*/React.createElement("div", {
        style: S.chs
      }, filtered.map(p => renderTag(p, tab)))));
    }
    // Ratchets / Bits — read from their own parts key
    const filtered = f(parts[tab] || []);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.card,
        marginTop: 8
      }
    }, filtered.length === 0 ? /*#__PURE__*/React.createElement("p", {
      style: S.empty
    }, libSearch ? `No matches for "${libSearch}"` : `No ${curTab.l.toLowerCase()} in library`) : /*#__PURE__*/React.createElement("div", {
      style: S.chs
    }, filtered.map(p => renderTag(p, tab))));
  })(), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.pri,
      marginTop: 12
    },
    onClick: onClose
  }, "Done")));
}
function CachedEventPicker({
  config,
  setConfig,
  challongeSlug,
  onChallongeImport,
  onJudgeVerified
}) {
  const [cachedList, setCachedList] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [selectedName, setSelectedName] = useState("");
  const [deviceMode, setDeviceMode] = useState(null); // null | "solo" | "shared"
  const [judgeAChallonge, setJudgeAChallonge] = useState(null); // Challonge username from OAuth (used for API calls)
  const [judgeAName, setJudgeAName] = useState(null); // bracket display name chosen from roster
  const [judgeBName, setJudgeBName] = useState(null); // bracket display name chosen from roster
  const [soloName, setSoloName] = useState(null); // bracket display name chosen in solo mode
  const [duoStep, setDuoStep] = useState(null); // null | "pickA" | "pickB"
  const [duoManual, setDuoManual] = useState(false); // show manual name entry input
  const [duoManualInput, setDuoManualInput] = useState(""); // manual entry value
  const [duoRoster, setDuoRoster] = useState(null); // {names, pmap} loaded after Judge A login
  const [duoRosterLoading, setDuoRosterLoading] = useState(false);
  const [eventLoginMode, setEventLoginMode] = useState(null); // "solo" | "duo" | null — set by org, read from cached list

  // Popup-based auth — Judge A only. Judge B is selected from the player roster.
  const authA = useChallongeAuthPopup();
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [whitelistConfirm, setWhitelistConfirm] = useState(null); // username string shown on successful whitelist check

  useEffect(() => {
    workerGet("/list").then(d => setCachedList(d.tournaments || [])).catch(() => setCachedList([]));
    // Fetch global judge name map and cache to localStorage so the name picker can use it
    workerGet("/judge-namemap").then(d => {
      try {
        localStorage.setItem("ncblast-judge-namemap", JSON.stringify(d.map || {}));
      } catch (_) {}
    }).catch(() => {});
  }, []);

  // Fetch participant list from Worker — used both for Judge B picker and final import
  const fetchParticipants = async slug => {
    const data = await workerGet(`/?slug=${encodeURIComponent(slug)}`);
    const extractP = p => p.participant || p;
    const names = (data.participants || []).map(p => (extractP(p).display_name || extractP(p).username || extractP(p).name || "").trim()).filter(Boolean);
    const pmap = {};
    (data.participants || []).forEach(p => {
      const part = extractP(p);
      const n = (part.display_name || part.username || part.name || "").trim();
      const id = part.id;
      if (n && id) {
        pmap[n] = id;
        if (Array.isArray(part.group_player_ids)) {
          part.group_player_ids.forEach(gid => {
            if (gid) pmap[`__gid__${gid}`] = id;
          });
        }
      }
    });
    return {
      names,
      pmap,
      raw: data
    };
  };
  const finalizeLogin = async (slug, name, usernameA, usernameB, preloadedRoster) => {
    setVerifying(true);
    setAuthError(null);
    try {
      // Ping presence so org view can show login status, and store token in KV
      const challongeUser = sessionStorage.getItem("ncblast-auth-user");
      const challongeToken = sessionStorage.getItem("ncblast-auth-token");
      if (challongeUser && challongeToken) {
        fetch(`${OVERLAY_WORKER}/auth/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token: challongeToken,
            username: challongeUser,
            slug
          })
        }).catch(() => {});
      }

      // Whitelist check — only run if the judge is logged in via OAuth.
      // If no Challonge login, skip the check (non-OAuth judges aren't verified).
      if (challongeUser && challongeToken) {
        try {
          const wlRes = await fetch(`${OVERLAY_WORKER}/judge-whitelist/check?slug=${encodeURIComponent(slug)}&username=${encodeURIComponent(challongeUser)}`, {
            signal: AbortSignal.timeout(6000)
          });
          const wlData = await wlRes.json();
          if (wlData.ok && !wlData.allowed) {
            throw new Error(`Your Challonge account (${challongeUser}) is not on the judge list for this tournament.`);
          }
          // Whitelist check passed — show confirmation with the matched username
          if (wlData.ok && wlData.allowed) {
            setWhitelistConfirm(challongeUser);
            setTimeout(() => setWhitelistConfirm(null), 4000);
          }
          // If whitelist is empty (no usernames set), we allow through — org hasn't configured it yet.
        } catch (e) {
          if (e.name === "AbortError") {
            // Whitelist check timed out — allow through to avoid blocking judges on network issues
            console.warn("[BLAST] Whitelist check timed out — allowing through");
          } else {
            throw e; // Blocked — surface the error
          }
        }
      }
      try {
        localStorage.setItem(KEYS.lastJudge, usernameA);
      } catch (_) {}
      if (onJudgeVerified) onJudgeVerified(usernameB ? {
        mode: "shared",
        judgeA: usernameA,
        judgeB: usernameB
      } : usernameA);
      let participants, participantMap;
      if (preloadedRoster) {
        participants = preloadedRoster.names;
        participantMap = preloadedRoster.pmap;
      } else {
        const loaded = await fetchParticipants(slug);
        participants = loaded.names;
        participantMap = loaded.pmap;
      }
      if (!participants.length) throw new Error("No participants found.");
      if (onChallongeImport) onChallongeImport(slug, participantMap, participants);
      setConfig(c => ({
        ...c,
        tournamentName: name
      }));
    } catch (e) {
      setAuthError(e.message || "Failed to load participants.");
    }
    setVerifying(false);
  };

  // Solo: when authA completes, fetch roster and show name picker
  useEffect(() => {
    if (deviceMode !== "solo" || authA.state !== "done" || !selectedSlug || duoRoster || duoRosterLoading) return;
    setDuoRosterLoading(true);
    fetchParticipants(selectedSlug).then(r => {
      setDuoRoster(r);
      setDuoRosterLoading(false);
    }).catch(() => {
      setDuoRoster(null);
      setDuoRosterLoading(false);
    });
  }, [authA.state, deviceMode, selectedSlug]);

  // Solo: finalize when name is chosen
  useEffect(() => {
    if (deviceMode !== "solo" || !soloName || !selectedSlug) return;
    finalizeLogin(selectedSlug, selectedName, soloName, null, duoRoster);
  }, [soloName, deviceMode, selectedSlug]);

  // Shared: when authA completes, record Challonge username, fetch roster, start name-picker
  useEffect(() => {
    if (deviceMode !== "shared" || authA.state !== "done" || judgeAChallonge) return;
    setJudgeAChallonge(authA.username);
    setDuoStep("pickA");
    setDuoRosterLoading(true);
    fetchParticipants(selectedSlug).then(r => {
      setDuoRoster(r);
      setDuoRosterLoading(false);
    }).catch(() => {
      setDuoRoster(null);
      setDuoRosterLoading(false);
    });
  }, [authA.state, deviceMode]);

  // Shared: finalize when both bracket names are chosen
  useEffect(() => {
    if (deviceMode !== "shared" || !judgeAName || !judgeBName || !judgeAChallonge || !selectedSlug) return;
    finalizeLogin(selectedSlug, selectedName, judgeAName, judgeBName, duoRoster);
  }, [judgeAName, judgeBName, judgeAChallonge, deviceMode, selectedSlug]);
  const resetDuoState = () => {
    setJudgeAChallonge(null);
    setJudgeAName(null);
    setJudgeBName(null);
    setSoloName(null);
    setDuoStep(null);
    setDuoManual(false);
    setDuoManualInput("");
    setDuoRoster(null);
  };
  const handleSelect = t => {
    setSelectedSlug(t.slug);
    setSelectedName(t.name || t.slug);
    setAuthError(null);
    setDeviceMode(null);
    resetDuoState();
    authA.reset();
    const mode = t.loginMode || null;
    setEventLoginMode(mode);
    // If the org has set a mode, apply it immediately — skip the picker screen
    if (mode === "solo") setDeviceMode("solo");
    if (mode === "duo") setDeviceMode("shared");
  };
  const handleCancel = () => {
    setSelectedSlug(null);
    setSelectedName("");
    setDeviceMode(null);
    setEventLoginMode(null);
    resetDuoState();
    setAuthError(null);
    authA.reset();
  };

  // ── Device mode picker ──────────────────────────────────────────────────
  if (selectedSlug && !deviceMode) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "12px",
        borderRadius: 12,
        background: "var(--surface2)",
        marginBottom: 16,
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 2px"
      }
    }, selectedName), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: 0
      }
    }, selectedSlug)), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: 4,
        textAlign: "center"
      }
    }, "How is this device being used?"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "#F59E0B",
        marginBottom: 12,
        textAlign: "center"
      }
    }, "\u26A0 Your organizer hasn't set a login mode for this event yet."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setDeviceMode("solo"),
      style: {
        padding: "18px 8px",
        borderRadius: 14,
        border: "2px solid var(--border2)",
        background: "var(--surface2)",
        cursor: "pointer",
        fontFamily: "'Outfit',sans-serif",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 32,
        marginBottom: 6
      }
    }, "\uD83D\uDCF1"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 3px"
      }
    }, "Solo Device"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: 0
      }
    }, "One judge per device")), /*#__PURE__*/React.createElement("button", {
      onClick: () => setDeviceMode("shared"),
      style: {
        padding: "18px 8px",
        borderRadius: 14,
        border: "2px solid var(--border2)",
        background: "var(--surface2)",
        cursor: "pointer",
        fontFamily: "'Outfit',sans-serif",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 32,
        marginBottom: 6
      }
    }, "\uD83D\uDC8A"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 3px"
      }
    }, "Shared Tablet"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: 0
      }
    }, "Two judges share one device"))), /*#__PURE__*/React.createElement("button", {
      onClick: handleCancel,
      style: {
        width: "100%",
        marginTop: 10,
        padding: "10px 0",
        borderRadius: 10,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2190 Back to event list"));
  }

  // ── Inline login step UI ────────────────────────────────────────────────
  const LoginStep = ({
    auth,
    label,
    sub,
    showADone
  }) => {
    const [enteredName, setEnteredName] = React.useState(() => {
      try {
        return localStorage.getItem("ncblast-saved-username") || "";
      } catch (_) {
        return "";
      }
    });
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "14px",
        borderRadius: 12,
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        marginBottom: 10
      }
    }, showADone && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "#15803D",
        fontWeight: 700,
        margin: "0 0 8px"
      }
    }, "\u2696\uFE0F Judge A: ", judgeAUsername, " \u2713"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 4px"
      }
    }, label), sub && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        margin: "0 0 10px",
        lineHeight: 1.4
      }
    }, sub), auth.state === "idle" && /*#__PURE__*/React.createElement("button", {
      onClick: auth.start,
      style: {
        width: "100%",
        padding: "13px 0",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg,#EA580C,#DC2626)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Log in with Challonge \u2192"), auth.state === "entering" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        margin: "0 0 8px",
        lineHeight: 1.4
      }
    }, "Enter your Challonge username:"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "challonge-username",
      value: enteredName,
      onChange: e => setEnteredName(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter" && enteredName.trim()) auth.submitUsername(enteredName.trim());
      },
      style: {
        width: "100%",
        padding: "11px 12px",
        borderRadius: 10,
        boxSizing: "border-box",
        border: "1.5px solid var(--border2)",
        background: "var(--surface2)",
        color: "var(--text-primary)",
        fontSize: 14,
        fontFamily: "'Outfit',sans-serif",
        outline: "none",
        marginBottom: 10
      },
      autoFocus: true
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (enteredName.trim()) auth.submitUsername(enteredName.trim());
      },
      disabled: !enteredName.trim(),
      style: {
        width: "100%",
        padding: "13px 0",
        borderRadius: 12,
        border: "none",
        background: enteredName.trim() ? "#EA580C" : "var(--border2)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: enteredName.trim() ? "pointer" : "default"
      }
    }, "Confirm \u2192")), auth.state === "waiting" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "2px solid var(--border2)",
        borderTopColor: "#EA580C",
        animation: "spin 1s linear infinite",
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        margin: 0
      }
    }, "Waiting for Challonge login\u2026")), auth.state === "confirm" && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 10,
        padding: "12px",
        border: "2px solid #EA580C"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 4px"
      }
    }, "Log in as this account?"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        color: "#EA580C",
        margin: "0 0 10px"
      }
    }, auth.username), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: auth.confirm,
      style: {
        flex: 1,
        padding: "9px 0",
        borderRadius: 9,
        border: "none",
        background: "#EA580C",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2713 Yes, that's me"), /*#__PURE__*/React.createElement("button", {
      onClick: auth.retry,
      style: {
        flex: 1,
        padding: "9px 0",
        borderRadius: 9,
        border: "2px solid var(--border2)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2717 Wrong account"))), auth.state === "wrong" && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 10,
        padding: "12px",
        border: "2px solid var(--border2)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 6px"
      }
    }, "Switch Challonge accounts first"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        margin: "0 0 12px",
        lineHeight: 1.5
      }
    }, "Open ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--text-secondary)"
      }
    }, "challonge.com"), " in another tab, log out, then log into the correct account. Come back here when done."), /*#__PURE__*/React.createElement("button", {
      onClick: auth.reset,
      style: {
        width: "100%",
        padding: "9px 0",
        borderRadius: 9,
        border: "none",
        background: "linear-gradient(135deg,#EA580C,#DC2626)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Try Again \u2192")), auth.state === "done" && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "#15803D",
        fontWeight: 700,
        margin: 0
      }
    }, "\u2705 ", auth.username), auth.state === "error" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "#EF4444",
        margin: "0 0 4px"
      }
    }, "\u26A0 ", auth.errorMsg), auth.errorDetail && auth.errorDetail !== auth.errorMsg && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "#94a3b8",
        margin: "0 0 6px",
        wordBreak: "break-all",
        fontFamily: "monospace",
        lineHeight: 1.3,
        background: "var(--surface)",
        borderRadius: 6,
        padding: "4px 6px"
      }
    }, auth.errorDetail), /*#__PURE__*/React.createElement("button", {
      onClick: auth.reset,
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "#EA580C",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0
      }
    }, "Try again")));
  };
  if (selectedSlug && deviceMode) {
    if (verifying || authError || whitelistConfirm) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "14px",
          borderRadius: 12,
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          marginTop: 12
        }
      }, verifying && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid var(--border2)",
          borderTopColor: "#EA580C",
          animation: "spin 1s linear infinite",
          flexShrink: 0
        }
      }), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          margin: 0
        }
      }, "Loading tournament\u2026")), whitelistConfirm && !verifying && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: "#14532D",
          border: "1.5px solid #22C55E",
          marginBottom: authError ? 8 : 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 18,
          flexShrink: 0
        }
      }, "\u2705"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: "#22C55E",
          margin: "0 0 1px"
        }
      }, "Verified on whitelist"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#86EFAC",
          margin: 0
        }
      }, "Logged in as ", /*#__PURE__*/React.createElement("strong", null, whitelistConfirm)))), authError && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          color: "#EF4444",
          fontWeight: 600,
          marginBottom: 8
        }
      }, "\u26A0 ", authError), /*#__PURE__*/React.createElement("button", {
        onClick: handleCancel,
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "\u2190 Back")));
    }
    // Solo mode — name picker (after authA completes, before finalizing)
    if (deviceMode === "solo" && authA.state === "done" && !soloName) {
      const roster = duoRoster && duoRoster.names || [];
      const handleSoloPick = name => {
        setSoloName(name);
      };
      const handleSoloManualConfirm = () => {
        const v = duoManualInput.trim();
        if (!v) return;
        setSoloName(v);
      };

      // Look up bracket name from global name map using judge's Challonge username
      const mappedBracketName = (() => {
        if (!authA.username) return null;
        try {
          const raw = localStorage.getItem("ncblast-judge-namemap");
          const map = raw ? JSON.parse(raw) : {};
          return map[authA.username.toLowerCase()] || null;
        } catch (_) {
          return null;
        }
      })();
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 12
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--surface2)",
          marginBottom: 12,
          border: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: 0
        }
      }, selectedName), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: "#94A3B8",
          margin: "3px 0 0"
        }
      }, "Logged in as ", authA.username)), mappedBracketName && roster.includes(mappedBracketName) ? /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "0 0 8px",
          lineHeight: 1.5
        }
      }, "Your bracket name was found automatically. Confirm to continue."), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "12px 14px",
          borderRadius: 12,
          border: "2px solid #EA580C",
          background: "#EA580C0D",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-faint)",
          margin: "0 0 2px"
        }
      }, "Bracket name"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 16,
          fontWeight: 900,
          color: "#EA580C",
          margin: 0
        }
      }, mappedBracketName)), /*#__PURE__*/React.createElement("button", {
        onClick: () => handleSoloPick(mappedBracketName),
        style: {
          width: "100%",
          padding: "12px 0",
          borderRadius: 10,
          border: "none",
          background: "#EA580C",
          color: "#fff",
          fontSize: 14,
          fontWeight: 900,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          marginBottom: 6
        }
      }, "\u2713 Yes, that's me"), /*#__PURE__*/React.createElement("button", {
        onClick: () => {/* fall through to manual list below by clearing — show divider */},
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border2)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          marginBottom: 10
        },
        onClick: () => setDuoManual(true)
      }, "\u270F\uFE0F Pick a different name")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 8
        }
      }, "Who are you in the bracket?"), duoRosterLoading ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 0",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid var(--border2)",
          borderTopColor: "#EA580C",
          animation: "spin 1s linear infinite",
          flexShrink: 0
        }
      }), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          margin: 0
        }
      }, "Loading roster\u2026")) : roster.length > 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 260,
          overflowY: "auto",
          marginBottom: 10
        }
      }, roster.map(name => /*#__PURE__*/React.createElement("button", {
        key: name,
        onClick: () => handleSoloPick(name),
        style: {
          width: "100%",
          padding: "11px 14px",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "var(--surface2)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          textAlign: "left"
        }
      }, name))) : !duoManual && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          margin: "0 0 10px"
        }
      }, "No roster loaded.")), duoManual ? /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("input", {
        autoFocus: true,
        type: "text",
        placeholder: "Enter your name\u2026",
        value: duoManualInput,
        onChange: e => setDuoManualInput(e.target.value),
        onKeyDown: e => {
          if (e.key === "Enter") handleSoloManualConfirm();
        },
        style: {
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1.5px solid var(--border2)",
          background: "var(--surface2)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontFamily: "'Outfit',sans-serif",
          outline: "none",
          marginBottom: 6
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setDuoManual(false);
          setDuoManualInput("");
        },
        style: {
          flex: 1,
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "Cancel"), /*#__PURE__*/React.createElement("button", {
        onClick: handleSoloManualConfirm,
        disabled: !duoManualInput.trim(),
        style: {
          flex: 2,
          padding: "10px 0",
          borderRadius: 10,
          border: "none",
          background: duoManualInput.trim() ? "#EA580C" : "var(--border2)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: duoManualInput.trim() ? "pointer" : "default"
        }
      }, "Confirm"))) : /*#__PURE__*/React.createElement("button", {
        onClick: () => setDuoManual(true),
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px dashed var(--border2)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          marginBottom: 10
        }
      }, "\u270F\uFE0F Manual Name Entry"), /*#__PURE__*/React.createElement("button", {
        onClick: handleCancel,
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "\u2190 Back to event list"));
    }

    // Shared mode — two-step name picker (after Judge A logged in via Challonge)
    if (deviceMode === "shared" && judgeAChallonge && (duoStep === "pickA" || duoStep === "pickB")) {
      const roster = duoRoster && duoRoster.names || [];
      const pickingA = duoStep === "pickA";
      const exclude = pickingA ? null : judgeAName; // hide already-chosen name in step 2
      const visibleRoster = exclude ? roster.filter(n => n !== exclude) : roster;
      const handlePick = name => {
        if (pickingA) {
          setJudgeAName(name);
          setDuoStep("pickB");
          setDuoManual(false);
          setDuoManualInput("");
        } else {
          setJudgeBName(name);
        }
      };
      const handleManualConfirm = () => {
        const v = duoManualInput.trim();
        if (!v) return;
        handlePick(v);
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 12
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--surface2)",
          marginBottom: 12,
          border: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: 0
        }
      }, selectedName), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: "#94A3B8",
          margin: "3px 0 0"
        }
      }, "Logged in as ", judgeAChallonge)), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6,
          marginBottom: 12
        }
      }, ["Judge A", "Judge B"].map((label, i) => {
        const done = i === 0 && judgeAName || i === 1 && judgeBName;
        const active = i === 0 && pickingA || i === 1 && !pickingA;
        return /*#__PURE__*/React.createElement("div", {
          key: label,
          style: {
            flex: 1,
            padding: "7px 0",
            borderRadius: 9,
            textAlign: "center",
            background: done ? "#15803D18" : active ? "#EA580C18" : "var(--surface2)",
            border: `2px solid ${done ? "#15803D" : active ? "#EA580C" : "var(--border)"}`
          }
        }, /*#__PURE__*/React.createElement("p", {
          style: {
            fontSize: 10,
            fontWeight: 800,
            color: done ? "#15803D" : active ? "#EA580C" : "var(--text-faint)",
            margin: 0
          }
        }, done ? `✓ ${i === 0 ? judgeAName : judgeBName}` : label));
      })), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 8
        }
      }, pickingA ? "Who are you in the bracket?" : `Who is ${judgeAName}'s partner?`), duoRosterLoading ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 0",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid var(--border2)",
          borderTopColor: "#EA580C",
          animation: "spin 1s linear infinite",
          flexShrink: 0
        }
      }), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          color: "var(--text-muted)",
          margin: 0
        }
      }, "Loading roster\u2026")) : visibleRoster.length > 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 220,
          overflowY: "auto",
          marginBottom: 10
        }
      }, visibleRoster.map(name => /*#__PURE__*/React.createElement("button", {
        key: name,
        onClick: () => handlePick(name),
        style: {
          width: "100%",
          padding: "11px 14px",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "var(--surface2)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          textAlign: "left"
        }
      }, name))) : !duoManual && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          margin: "0 0 10px"
        }
      }, "No roster loaded."), duoManual ? /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("input", {
        autoFocus: true,
        type: "text",
        placeholder: "Enter name\u2026",
        value: duoManualInput,
        onChange: e => setDuoManualInput(e.target.value),
        onKeyDown: e => {
          if (e.key === "Enter") handleManualConfirm();
        },
        style: {
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1.5px solid var(--border2)",
          background: "var(--surface2)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontFamily: "'Outfit',sans-serif",
          outline: "none",
          marginBottom: 6
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setDuoManual(false);
          setDuoManualInput("");
        },
        style: {
          flex: 1,
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "Cancel"), /*#__PURE__*/React.createElement("button", {
        onClick: handleManualConfirm,
        disabled: !duoManualInput.trim(),
        style: {
          flex: 2,
          padding: "10px 0",
          borderRadius: 10,
          border: "none",
          background: duoManualInput.trim() ? "#EA580C" : "var(--border2)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: duoManualInput.trim() ? "pointer" : "default"
        }
      }, "Confirm"))) : /*#__PURE__*/React.createElement("button", {
        onClick: () => setDuoManual(true),
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px dashed var(--border2)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          marginBottom: 10
        }
      }, "\u270F\uFE0F Manual Name Entry"), /*#__PURE__*/React.createElement("button", {
        onClick: handleCancel,
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "\u2190 Back to event list"));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--surface2)",
        marginBottom: 12,
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: 0
      }
    }, selectedName)), deviceMode === "solo" ? /*#__PURE__*/React.createElement(LoginStep, {
      auth: authA,
      label: "Judge Login",
      sub: `Log in with your Challonge account to access "${selectedName}".`
    }) : /*#__PURE__*/React.createElement(LoginStep, {
      auth: authA,
      label: "Challonge Login",
      sub: `One judge logs in for this tablet. You'll both pick your bracket names next.`
    }), /*#__PURE__*/React.createElement("button", {
      onClick: handleCancel,
      style: {
        width: "100%",
        marginTop: 4,
        padding: "10px 0",
        borderRadius: 10,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2190 Back to event list"));
  }

  // Show currently linked event
  if (config.tournamentName && challongeSlug) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 10,
        border: "2px solid #7C3AED40",
        background: "#7C3AED08"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "#7C3AED",
        margin: 0
      }
    }, config.tournamentName), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: "2px 0 0"
      }
    }, challongeSlug, " \xB7 \u2713 Linked")), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setConfig(c => ({
          ...c,
          tournamentName: ""
        }));
        if (onChallongeImport) onChallongeImport("", {});
      },
      style: {
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-muted)",
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Change")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)",
      marginBottom: 8
    }
  }, "Select the Challonge event for this tournament:"), cachedList === null && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-faint)",
      padding: "8px 0"
    }
  }, "\u23F3 Loading events\u2026"), Array.isArray(cachedList) && cachedList.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-faint)",
      lineHeight: 1.6,
      padding: "6px 0"
    }
  }, "No events cached yet. Ask your TO to add one via Organizer View."), Array.isArray(cachedList) && cachedList.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.slug,
    onClick: () => handleSelect(t),
    style: {
      display: "block",
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid var(--border)",
      background: "var(--surface2)",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "'Outfit',sans-serif",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: 0
    }
  }, t.name || t.slug), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-faint)",
      margin: "2px 0 0"
    }
  }, t.slug, t.loginMode === "solo" && " · 📱 Solo mode", t.loginMode === "duo" && " · 💊 Duo mode", !t.loginMode && " · 🔗 Challonge login required"))), !config.tournamentName?.trim() && /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.hint,
      color: "#7C3AED",
      marginTop: 6
    }
  }, "Select an event to continue"));
}
/* ═══════════════════════════════════════
   SCREEN 1 — FORMAT
═══════════════════════════════════════ */
function FormatScreen({
  config,
  setConfig,
  parts,
  onNext,
  onOpenLib,
  dark,
  toggleDark,
  onSwitchRole,
  challongeSlug,
  onChallongeImport,
  onJudgeVerified
}) {
  const [showGuide, setShowGuide] = useState(false);
  const total = parts.blades.length + parts.ratchets.length + parts.bits.length;
  const hasLib = total > 0;
  const GUIDE_SECTIONS = [{
    icon: "⚔️",
    title: "What is NC BLAST?",
    body: "NC BLAST (NorCal Battle Log and Stat Tracker) is a judging and match tracking tool built for competitive Beyblade X. It lets judges score battles in real time, track combos, log match history, and export results to Google Sheets. It was built by and for the NorCal Beyblade League."
  }, {
    icon: "🏗️",
    title: "Setting Up",
    body: "Before your first match, tap the Parts Library button on the main screen to load your Beyblade X parts. You can add blades, ratchets, and bits manually or import from a file. Your library is saved between sessions so you only need to do this once."
  }, {
    icon: "🎯",
    title: "Match Modes",
    body: "Casual mode lets you score freely with no data sent anywhere — great for practice or unofficial matches. Ranked mode requires a tournament name and sends completed match data to the NC BLAST Google Sheets for stat tracking. Choose your point limit (4, 5, 7, or custom) and number of sets before starting."
  }, {
    icon: "👥",
    title: "Adding Players",
    body: "On the Players screen, type names manually or paste a comma-separated list to add multiple at once. You can also import directly from a Challonge tournament bracket by pasting the tournament URL — NC BLAST will pull the participant list automatically. Previously imported tournaments appear in the cached dropdown and load instantly."
  }, {
    icon: "🔨",
    title: "Building Decks",
    body: "Each player builds 3 combos before a match. Tap a Quick Combo to fill all 3 parts in one tap, or build manually by selecting blade → ratchet → bit in sequence. Previously used combos are saved per player and appear at the top for quick reuse. No two combos for the same player can share parts."
  }, {
    icon: "⚡",
    title: "Scoring a Battle",
    body: "Select which combo each player is using at the start of each battle. Then tap the finish type when the battle ends: XTR (Xtreme Finish) +3, OVR (Over Finish) +2, BST (Burst Finish) +2, or SPF (Spin Finish) +1. Penalty buttons handle Own Finish and Launch Errors — these are listed under the player who committed the error and award points to their opponent."
  }, {
    icon: "↩️",
    title: "Undo & Match Log",
    body: "Every battle is logged and can be undone using the Undo button in the bottom bar. The match log panel (clock icon) shows a full history of every battle this session. Undo and redo are scoped to the current match — you cannot accidentally undo into a previous match."
  }, {
    icon: "📤",
    title: "Exporting Results",
    body: "After a match ends, tap Send to Sheets to submit the results to the NC BLAST stat tracker (Ranked mode only). You can also download a CSV of the match at any time. The CSV includes every battle with full combo data, sides, finish types, scores, and timestamps."
  }, {
    icon: "🌙",
    title: "Dark Mode",
    body: "Toggle dark mode from the main screen or the bottom bar at any time. Your preference is saved and restored automatically on your next visit."
  }, {
    icon: "⚡",
    title: "Challonge Cache",
    body: "When a Challonge tournament is imported, the participant list is cached on the NC BLAST server for 30 minutes. Any device that imports the same tournament within that window loads from cache instantly with no API call. The cached tournaments dropdown on the Players screen shows all currently cached tournaments so you can load them without re-pasting the link."
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, showGuide && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.7)",
      zIndex: 300,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "20px 16px",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      padding: "24px 20px",
      maxWidth: 480,
      width: "100%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 900,
      color: "var(--text-primary)"
    }
  }, "NC BLAST Guide"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: "var(--text-faint)"
    }
  }, "How to use NC BLAST")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowGuide(false),
    style: {
      background: "var(--surface3)",
      border: "none",
      borderRadius: 10,
      width: 34,
      height: 34,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "var(--text-muted)",
      fontSize: 18
    }
  }, IC.x)), GUIDE_SECTIONS.map((sec, si) => /*#__PURE__*/React.createElement("div", {
    key: si,
    style: {
      marginBottom: 20,
      paddingBottom: 20,
      borderBottom: si < GUIDE_SECTIONS.length - 1 ? "1px solid var(--border)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, sec.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "var(--text-primary)"
    }
  }, sec.title)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-secondary)",
      lineHeight: 1.7,
      margin: 0
    }
  }, sec.body))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowGuide(false),
    style: {
      ...S.pri,
      marginTop: 4
    }
  }, "Close"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.page,
      height: "100dvh",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      marginBottom: 4
    }
  }, "\u2694\uFE0F"), /*#__PURE__*/React.createElement("h1", {
    style: S.logo
  }, "NC ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#EA580C"
    }
  }, "BLAST")), /*#__PURE__*/React.createElement("p", {
    style: S.sub
  }, "NorCal Battle Log and Stat Tracker"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowGuide(true),
    style: {
      background: "none",
      border: "none",
      color: "var(--text-faint)",
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Guide & Intro"))), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenLib,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: hasLib ? "2px solid #15803D40" : "2px dashed #EA580C",
      background: hasLib ? "#15803D08" : "#EA580C0D",
      cursor: "pointer",
      marginBottom: 14,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: hasLib ? "#15803D" : "#EA580C"
    }
  }, IC.db), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: hasLib ? "#15803D" : "#EA580C"
    }
  }, hasLib ? `Library: ${parts.blades.length} blades · ${parts.ratchets.length} ratchets · ${parts.bits.length} bits` : "No parts loaded — tap to set up"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)",
      marginTop: 1
    }
  }, hasLib ? "Tap to manage" : "Import your Beyblade X parts first"))), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("h2", {
    style: S.label
  }, "Match Type"), /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, [[4, "4 Pts."], [5, "5 Pts."], [7, "7 Pts."], [0, "No Limit"]].map(([v, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    style: {
      ...S.chip,
      ...(config.pts === v ? S.chipOn : {})
    },
    onClick: () => setConfig({
      ...config,
      pts: v
    })
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.chip,
      ...(config.pts > 7 ? S.chipOn : {})
    },
    onClick: () => {
      const n = prompt("Custom point limit:");
      if (n && !isNaN(+n) && +n > 0) setConfig({
        ...config,
        pts: +n
      });
    }
  }, config.pts > 7 ? config.pts + " Pts." : "Custom")), /*#__PURE__*/React.createElement("h2", {
    style: {
      ...S.label,
      marginTop: 20
    }
  }, "Sets"), /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, [1, 3, 5].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    style: {
      ...S.chip,
      ...S.chipW,
      ...(config.bo === v ? S.chipBl : {})
    },
    onClick: () => setConfig({
      ...config,
      bo: v
    })
  }, v === 1 ? "Best-of-1" : `Best-of-${v}`))), /*#__PURE__*/React.createElement("h2", {
    style: {
      ...S.label,
      marginTop: 20
    }
  }, "Tournament Mode"), /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, [false, true].map(v => /*#__PURE__*/React.createElement("button", {
    key: String(v),
    style: {
      ...S.chip,
      ...(config.tm === v ? v ? {
        background: "#7C3AED",
        borderColor: "#7C3AED",
        color: "#fff"
      } : S.chipOn : {})
    },
    onClick: () => setConfig({
      ...config,
      tm: v
    })
  }, v ? "On" : "Off"))), config.tm && /*#__PURE__*/React.createElement(CachedEventPicker, {
    config: config,
    setConfig: setConfig,
    challongeSlug: challongeSlug,
    onChallongeImport: onChallongeImport,
    onJudgeVerified: onJudgeVerified
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-muted)"
    }
  }, "Dark Mode"), /*#__PURE__*/React.createElement("button", {
    onClick: toggleDark,
    style: {
      width: 44,
      height: 24,
      borderRadius: 12,
      border: "none",
      background: dark ? "#2563EB" : "var(--border2)",
      cursor: "pointer",
      position: "relative",
      transition: "background 0.2s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: dark ? 22 : 2,
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "#fff",
      transition: "left 0.2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
    }
  }))), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.pri,
      opacity: hasLib && (!config.tm || config.tournamentName?.trim()) ? 1 : 0.4
    },
    disabled: !hasLib || config.tm && !config.tournamentName?.trim(),
    onClick: onNext
  }, "Next: Players \u2192"), !hasLib && /*#__PURE__*/React.createElement("p", {
    style: S.hint
  }, "Set up your parts library first"), onSwitchRole && /*#__PURE__*/React.createElement("button", {
    onClick: onSwitchRole,
    style: {
      display: "block",
      width: "100%",
      marginTop: 10,
      padding: "10px 0",
      borderRadius: 10,
      border: "2px solid var(--border)",
      background: "transparent",
      color: "var(--text-faint)",
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\u21A9 Switch View")));
}
function BottomBar({
  log,
  future,
  undo,
  redo,
  historyOpen,
  setHistoryOpen,
  p1,
  p2,
  onOpenLib,
  onClearLog,
  dark,
  toggleDark,
  matchStartIdx
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: historyOpen ? Math.min(340, window.innerWidth - 40) : 0,
      background: "var(--surface)",
      boxShadow: historyOpen ? "-4px 0 24px rgba(0,0,0,0.25)" : "none",
      transition: "width 0.25s ease",
      overflow: "hidden",
      zIndex: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: Math.min(340, window.innerWidth - 40),
      padding: "20px 16px",
      overflowY: "auto",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      color: "var(--text-primary)"
    }
  }, "Match Log"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, log.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmClear(true),
    style: {
      background: "none",
      border: "none",
      color: "#EF4444",
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      opacity: 0.7,
      padding: "4px 6px"
    }
  }, "Clear"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryOpen(false),
    style: {
      background: "#F1F5F9",
      border: "none",
      borderRadius: 8,
      width: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "#64748B"
    }
  }, IC.x))), log.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#CBD5E1",
      fontSize: 13,
      fontStyle: "italic"
    }
  }, "No battles yet"), confirmClear && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.5)",
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      padding: "24px 20px",
      maxWidth: 320,
      width: "100%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: "var(--text-primary)",
      marginBottom: 8,
      textAlign: "center"
    }
  }, "Clear Match Log?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#64748B",
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, "This will permanently delete all ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "#EF4444"
    }
  }, log.length, " battle records"), " from the log. This cannot be undone."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmClear(false),
    style: {
      flex: 1,
      padding: "12px 0",
      borderRadius: 10,
      border: "2px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onClearLog();
      setConfirmClear(false);
    },
    style: {
      flex: 1,
      padding: "12px 0",
      borderRadius: 10,
      border: "none",
      background: "#EF4444",
      color: "#fff",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Clear All")))), log.slice().reverse().map((e, i) => {
    const winnerName = e.scorerIdx === 0 ? e.p1Name : e.p2Name;
    const loserName = e.scorerIdx === 0 ? e.p2Name : e.p1Name;
    const loserCombo = e.scorerIdx === 0 ? comboStr(e.p2Combo) : comboStr(e.p1Combo);
    const winnerColor = e.scorerIdx === 0 ? "#2563EB" : "#DC2626";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: "10px 12px",
        borderRadius: 10,
        marginBottom: 8,
        background: e.scorerIdx === 0 ? "#EFF6FF22" : "#FEF2F222",
        borderLeft: `4px solid ${winnerColor}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: winnerColor,
        fontSize: 14
      }
    }, e.scorer), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "R", log.length - i, " \xB7 Set ", e.set, " \xB7 Shuf ", e.shuffle)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-secondary)",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: winnerColor
      }
    }, e.typeName), " (+", e.points, ")"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: winnerColor
      }
    }, "\u25B2 ", winnerName, ":"), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, e.winnerCombo)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: "var(--text-faint)"
      }
    }, "\u25BC ", loserName, ":"), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, loserCombo)), e.p1Side && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, e.p1Name, ": ", e.p1Side, " Side \xB7 ", e.p2Name, ": ", e.p2Side, " Side"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        fontWeight: 600
      }
    }, e.p1Name, " ", e.p1Score, " \u2013 ", e.p2Score, " ", e.p2Name));
  }))), historyOpen && /*#__PURE__*/React.createElement("div", {
    onClick: () => setHistoryOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.2)",
      zIndex: 99
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      padding: "8px 16px 16px",
      background: "linear-gradient(transparent 0%, var(--bg-solid) 45%)",
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      background: "var(--surface)",
      borderRadius: 20,
      padding: "5px 6px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px var(--border)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryOpen(true),
    style: S.barBtn
  }, IC.history), /*#__PURE__*/React.createElement("div", {
    style: S.barDiv
  }), /*#__PURE__*/React.createElement("button", {
    onClick: undo,
    disabled: log.length <= matchStartIdx && log[log.length - 1]?.type !== "LER-STRIKE",
    style: {
      ...S.barBtn,
      opacity: log.length > matchStartIdx || log[log.length - 1]?.type === "LER-STRIKE" ? 1 : 0.3
    }
  }, IC.undo, " ", /*#__PURE__*/React.createElement("span", {
    style: S.barLbl
  }, "Undo")), /*#__PURE__*/React.createElement("button", {
    onClick: redo,
    disabled: !future.length,
    style: {
      ...S.barBtn,
      opacity: future.length ? 1 : 0.3,
      color: "#EA580C"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...S.barLbl,
      color: "#EA580C"
    }
  }, "Redo"), " ", IC.redo), /*#__PURE__*/React.createElement("div", {
    style: S.barDiv
  }), /*#__PURE__*/React.createElement("button", {
    onClick: toggleDark,
    style: {
      ...S.barBtn,
      fontSize: 16,
      lineHeight: 1
    },
    title: "Toggle dark mode"
  }, dark ? "☀️" : "🌙"), /*#__PURE__*/React.createElement("div", {
    style: S.barDiv
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenLib,
    style: S.barBtn
  }, IC.gear))));
}

/* ═══════════════════════════════════════
   JUDGE INPUT — local state so parent re-renders don't blur it
═══════════════════════════════════════ */
function JudgeInput({
  value,
  onCommit,
  onClear,
  style,
  placeholder
}) {
  const [local, setLocal] = React.useState(value || "");
  // Sync if parent clears it externally
  React.useEffect(() => {
    if (!value) setLocal("");
  }, [value]);
  return /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    style: style,
    placeholder: placeholder || "Enter judge name...",
    value: local,
    onChange: e => setLocal(e.target.value),
    onBlur: () => {
      if (local.trim()) onCommit(local.trim());
    },
    onKeyDown: e => {
      if (e.key === "Enter" && local.trim()) {
        onCommit(local.trim());
      }
    }
  });
}

/* ═══════════════════════════════════════
   SCREEN 3 — MATCH
═══════════════════════════════════════ */
/* ═══════════════════════════════════════
   ERROR BOUNDARY — catches render crashes so the app shows
   a recovery UI instead of a blank white screen.
═══════════════════════════════════════ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(e) {
    return {
      err: e
    };
  }
  componentDidCatch(e, info) {
    console.error("NC BLAST render error:", e, info);
  }
  render() {
    if (this.state.err) return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        background: "#F8FAFC",
        fontFamily: "'Outfit',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 36
      }
    }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 800,
        fontSize: 18,
        color: "#1E293B"
      }
    }, "Something went wrong"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
        maxWidth: 280
      }
    }, String(this.state.err?.message || this.state.err)), /*#__PURE__*/React.createElement("button", {
      onClick: () => this.setState({
        err: null
      }),
      style: {
        background: "#2563EB",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "10px 24px",
        fontWeight: 700,
        fontSize: 14,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Try Again"));
    return this.props.children;
  }
}

/* ═══════════════════════════════════════
   SCALED BUTTON CONTENT
   Fills 100% of its parent button's height with the largest
   possible text, no clipping, no kerning overflow.
   Pass children as a render function: children(scaledFontSize)
═══════════════════════════════════════ */
/* ScaledBtn — button whose renderContent(frac) receives a multiplier
   frac = currentHeight / naturalHeight, where naturalHeight is the first
   measured height (the "designed" size before any drag resize).
   Text should be written at frac=1 sizes; everything scales from there. */
function ScaledBtn({
  baseStyle,
  disabled,
  onClick,
  renderContent
}) {
  const btnRef = useRef(null);
  const naturalH = useRef(null); // first measured height = designed baseline
  const [frac, setFrac] = useState(1);
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h <= 0) return;
      if (naturalH.current === null) {
        naturalH.current = h;
        return;
      } // record baseline on first paint
      const f = h / naturalH.current;
      setFrac(Math.max(0.25, Math.min(4, f)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return /*#__PURE__*/React.createElement("button", {
    ref: btnRef,
    type: "button",
    disabled: disabled,
    onClick: onClick,
    style: baseStyle
  }, renderContent(frac));
}

/* FitText — scales text to fill its container.
   ratio: fraction of container height → starting font-size target.
   wrap: allow line-breaks at spaces only. NEVER splits within a word.
   Uses canvas.measureText so the longest word always provably fits in width. */
const _fitCanvas = document.createElement("canvas");
function measureWordPx(word, fontPx, fontFamily) {
  const ctx = _fitCanvas.getContext("2d");
  ctx.font = `900 ${fontPx}px ${fontFamily}`;
  return ctx.measureText(word).width;
}
function FitText({
  children,
  style,
  ratio = 0.38,
  wrap = false
}) {
  const ref = useRef(null);
  const [fs, setFs] = useState(null);
  const childStr = typeof children === "string" ? children : String(children ?? "");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function compute() {
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      if (h <= 0 || w <= 0) return;
      // Start from height-based target
      let size = Math.max(7, h * ratio);
      if (wrap && childStr.length > 0) {
        // Binary-search the largest size where every word fits in width
        const words = childStr.split(/\s+/).filter(Boolean);
        const fontFamily = "'Outfit',sans-serif";
        const availW = w - 4; // 2px each side
        let lo = 7,
          hi = size,
          best = lo;
        for (let iter = 0; iter < 14; iter++) {
          const mid = (lo + hi) / 2;
          const maxWordW = Math.max(...words.map(wd => measureWordPx(wd, mid, fontFamily)));
          if (maxWordW <= availW) {
            best = mid;
            lo = mid;
          } else {
            hi = mid;
          }
        }
        size = best;
      }
      setFs(Math.max(7, size));
    }
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio, wrap, childStr]);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: fs || "inherit",
      lineHeight: wrap ? 1.2 : 1,
      whiteSpace: wrap ? "normal" : "nowrap",
      wordBreak: "normal",
      // never break within a word
      overflowWrap: "normal",
      // never break within a word
      overflow: "hidden",
      maxWidth: "100%",
      display: "block",
      textAlign: "center"
    }
  }, children));
}

/* ComboLabel — renders blade / ratchet / bit as one tight proportional block.
   Binary-searches blade font size to fit width, then caps so all 3 lines
   fit in height. Sub (ratchet+bit) is 72% of blade. Gap is 0 — line-height
   provides the only breathing room, keeping the combo as one visual unit. */
const _comboCanvas = document.createElement("canvas");
function comboMeasureWord(word, fontPx, weight) {
  const ctx = _comboCanvas.getContext("2d");
  ctx.font = `${weight} ${fontPx}px 'Outfit',sans-serif`;
  return ctx.measureText(word).width;
}
function ComboLabel({
  blade,
  ratchet,
  bit,
  color,
  color2,
  empty,
  emptyText
}) {
  const ref = useRef(null);
  const [sizes, setSizes] = useState(null);

  // Pure measurement function — reads DOM dimensions, calculates font sizes
  const computeSizes = React.useCallback(el => {
    if (!el) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    if (h <= 0 || w <= 0) return;
    const pad = 8;
    const availW = w - pad;
    const lineH = 1.15;
    const bladeWords = (blade || "\u2014").split(/\s+/).filter(Boolean);
    let lo = 7,
      hi = h * 0.5,
      bestBlade = lo;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const maxW = Math.max(...bladeWords.map(wd => comboMeasureWord(wd, mid, "900")));
      if (maxW <= availW) {
        bestBlade = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    let sub = bestBlade * 0.72;
    const bladeLines = bladeWords.length > 1 && comboMeasureWord(bladeWords.join(" "), bestBlade, "900") > availW ? 2 : 1;
    const bitWords = (bit || "").split(/\s+/).filter(Boolean);
    const bitLines = bitWords.length > 1 && comboMeasureWord(bitWords.join(" "), sub, "600") > availW ? 2 : 1;
    const totalLines = bladeLines + (ratchet ? 1 : 0) + bitLines;
    if (bestBlade * totalLines * lineH > h - pad) {
      bestBlade = Math.max(7, (h - pad) / (totalLines * lineH));
      sub = bestBlade * 0.72;
    }
    setSizes({
      blade: Math.max(7, bestBlade),
      sub: Math.max(7, sub)
    });
  }, [blade, ratchet, bit]);

  // Fires synchronously before the browser paints — eliminates visible resize flash on combo select
  React.useLayoutEffect(() => {
    computeSizes(ref.current);
  }, [computeSizes]);

  // Also watch container resize for drag-handle and orientation changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => computeSizes(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeSizes]);
  const fs = sizes || {
    blade: 14,
    sub: 10
  };
  const lineH = 1.15;
  if (empty) return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      padding: "4px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: fs.sub,
      fontWeight: 600,
      color: color2 || "var(--text-faint)",
      textAlign: "center",
      lineHeight: lineH,
      wordBreak: "normal",
      overflowWrap: "normal"
    }
  }, emptyText || "—"));
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      padding: "6px 4px",
      gap: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: fs.blade,
      fontWeight: 900,
      color,
      textAlign: "center",
      lineHeight: lineH,
      whiteSpace: "normal",
      wordBreak: "normal",
      overflowWrap: "normal",
      maxWidth: "100%"
    }
  }, blade || "—"), ratchet && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: fs.sub,
      fontWeight: 700,
      color: color2 || color,
      textAlign: "center",
      lineHeight: lineH,
      whiteSpace: "nowrap",
      maxWidth: "100%",
      opacity: 0.9
    }
  }, ratchet), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: fs.sub,
      fontWeight: 600,
      color: color2 || color,
      textAlign: "center",
      lineHeight: lineH,
      whiteSpace: "normal",
      wordBreak: "normal",
      overflowWrap: "normal",
      maxWidth: "100%",
      opacity: 0.8
    }
  }, bit || ""));
}

/* ═══════════════════════════════════════
   SHUFFLE ORDER SCREEN
   Combined shuffle timer + deck order setting.
   Timer is a compact countdown in the header (no clock, no pause).
   Expired → non-blocking red banner only. Deck order can be set at any time.
═══════════════════════════════════════ */
function ShuffleOrderScreen({
  showTimer,
  onConfirm,
  p1,
  p2,
  d1,
  d2,
  setD1,
  setD2,
  sets,
  pts,
  need,
  curSet,
  shuf,
  config,
  swapped,
  presetOrder,
  canUndo,
  onUndo
}) {
  // ── Timer ──────────────────────────────────────────────────────────────────
  const TOTAL = 60;
  const [seconds, setSeconds] = React.useState(TOTAL);
  const [expired, setExpired] = React.useState(false);
  const timerRef = React.useRef(null);
  React.useEffect(() => {
    if (!showTimer) return;
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [showTimer]);
  const timerColor = seconds > 20 ? "#22C55E" : seconds > 10 ? "#F59E0B" : "#EF4444";

  // ── Deck order ──────────────────────────────────────────────────────────────
  // presetOrder=true → coming from undo; previous order already in d1/d2,
  // so start both as [0,1,2] (ordered) so judge can drag-adjust or tap to reset.
  const [topOrder, setTopOrder] = React.useState(() => presetOrder ? [0, 1, 2] : []);
  const [botOrder, setBotOrder] = React.useState(() => presetOrder ? [0, 1, 2] : []);
  const [drag, setDrag] = React.useState(null);
  // drag={side:"top"|"bot", fromIdx, toIdx, startY, hasMoved}

  const topName = swapped ? p2 : p1;
  const botName = swapped ? p1 : p2;
  const topDeck = swapped ? d2 : d1;
  const botDeck = swapped ? d1 : d2;
  const topColor = swapped ? "#DC2626" : "#2563EB";
  const botColor = swapped ? "#2563EB" : "#DC2626";
  const topSet = swapped ? setD2 : setD1;
  const botSet = swapped ? setD1 : setD2;
  const topDone = topOrder.length === 3;
  const botDone = botOrder.length === 3;
  const topInProgress = topOrder.length > 0 && !topDone;
  const botInProgress = botOrder.length > 0 && !botDone;
  const topLocked = botInProgress && !topDone;
  const botLocked = topInProgress && !botDone;

  // Click handler — auto-completes 3rd combo after 2nd click
  const clickCombo = (order, setOrder, isLocked, isDone) => i => {
    if (isLocked) return;
    if (isDone) {
      setOrder([]);
      return;
    } // tap on done player = reset
    if (order.includes(i)) {
      setOrder([]);
      return;
    } // tap already-picked = reset
    const next = [...order, i];
    if (next.length === 2) {
      const rem = [0, 1, 2].find(x => !next.includes(x));
      setOrder([...next, rem]); // auto-select the only remaining combo
    } else {
      setOrder(next);
    }
  };

  // Drag handlers (only active when player's order is set)
  const CARD_H = 68;
  const startDrag = (side, idx, e) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    setDrag({
      side,
      fromIdx: idx,
      toIdx: idx,
      startY: e.clientY,
      currentY: e.clientY,
      hasMoved: false
    });
  };
  const moveDrag = (side, e) => {
    if (!drag || drag.side !== side) return;
    const dy = e.clientY - drag.startY;
    const toIdx = Math.max(0, Math.min(2, Math.round(drag.fromIdx + dy / CARD_H)));
    setDrag(d => d ? {
      ...d,
      toIdx,
      currentY: e.clientY,
      hasMoved: d.hasMoved || Math.abs(dy) > 8
    } : d);
  };
  const endDrag = (side, setter, e) => {
    if (!drag || drag.side !== side) return;
    if (drag.hasMoved && drag.fromIdx !== drag.toIdx) {
      setter(o => {
        const n = [...o];
        const [item] = n.splice(drag.fromIdx, 1);
        n.splice(drag.toIdx, 0, item);
        return n;
      });
    } else if (!drag.hasMoved) {
      setter([]); // tap while done = reset to empty (re-pick)
    }
    setDrag(null);
  };
  // Drag visual: use original order + translateY so the dragged card truly follows the finger.
  // Other cards shift via CSS translate when the dragged card passes over them.
  const getDragOffset = (side, visIdx) => {
    if (!drag || drag.side !== side || !drag.hasMoved) return 0;
    const dy = drag.currentY - drag.startY;
    const clampedDy = Math.max((-drag.fromIdx - 0.5) * CARD_H, Math.min((2 - drag.fromIdx + 0.5) * CARD_H, dy));
    if (visIdx === drag.fromIdx) return clampedDy; // dragged card follows finger
    // Other cards shift to fill the gap
    if (drag.toIdx > drag.fromIdx && visIdx > drag.fromIdx && visIdx <= drag.toIdx) return -CARD_H;
    if (drag.toIdx < drag.fromIdx && visIdx < drag.fromIdx && visIdx >= drag.toIdx) return CARD_H;
    return 0;
  };
  const canStart = topDone && botDone;
  const confirm = () => {
    if (!canStart) return;
    topSet(topOrder.map(i => topDeck[i]));
    botSet(botOrder.map(i => botDeck[i]));
    onConfirm();
  };

  // ── Score summary ──────────────────────────────────────────────────────────
  const summary = () => {
    if (!p1 || !p2) return null;
    const isBO3 = config && config.bo > 1;
    const ptLimit = config && config.pts > 0 ? config.pts : null;
    const lName = swapped ? p2 : p1;
    const rName = swapped ? p1 : p2;
    const lSets = swapped ? sets[1] : sets[0];
    const rSets = swapped ? sets[0] : sets[1];
    const lPts = swapped ? pts[1] : pts[0];
    const rPts = swapped ? pts[0] : pts[1];
    const lCol = swapped ? "#EF4444" : "#3B82F6";
    const rCol = swapped ? "#3B82F6" : "#EF4444";
    return /*#__PURE__*/React.createElement("div", {
      style: {
        margin: "10px 14px 4px",
        background: "var(--surface)",
        border: "1px solid var(--border2)",
        borderRadius: 12,
        overflow: "hidden"
      }
    }, isBO3 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px 5px",
        borderBottom: "1px solid var(--border2)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: lCol,
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 100
      }
    }, lName), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: lCol,
        minWidth: 20,
        textAlign: "center"
      }
    }, lSets), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "var(--text-faint)",
        letterSpacing: 1
      }
    }, "SETS"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: rCol,
        minWidth: 20,
        textAlign: "center"
      }
    }, rSets)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: rCol,
        flex: 1,
        textAlign: "right",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 100
      }
    }, rName)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isBO3 ? "6px 12px 8px" : "8px 12px"
      }
    }, !isBO3 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: lCol,
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 100
      }
    }, lName), isBO3 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-muted)",
        flex: 1
      }
    }, "Set ", curSet), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 24,
        fontWeight: 900,
        color: lCol,
        minWidth: 24,
        textAlign: "center"
      }
    }, lPts), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "var(--text-faint)",
        letterSpacing: 1
      }
    }, ptLimit ? "PTS" : "–"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 24,
        fontWeight: 900,
        color: rCol,
        minWidth: 24,
        textAlign: "center"
      }
    }, rPts)), !isBO3 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: rCol,
        flex: 1,
        textAlign: "right",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 100
      }
    }, rName), isBO3 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-muted)",
        flex: 1,
        textAlign: "right"
      }
    }, "First to ", ptLimit || "∞")));
  };

  // ── Player section ──────────────────────────────────────────────────────────
  const section = (name, deck, order, setter, isDone, color, isLocked) => {
    const side = name === topName ? "top" : "bot";
    const statusText = isDone ? "drag to reorder · tap to reset" : isLocked ? "wait…" : order.length === 0 ? "tap in play order" : order.length === 2 ? "auto-selecting last…" : `${3 - order.length} left`;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px 8px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        color,
        margin: 0
      }
    }, name), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: isDone ? "var(--text-faint)" : "var(--text-faint)",
        margin: 0,
        fontStyle: "italic"
      }
    }, statusText)), isDone
    // ── ORDER SET: draggable cards — follow-the-finger animation ─────────
    ? order.map((deckIdx, visIdx) => {
      const combo = deck[deckIdx];
      const isDraggingThis = drag?.side === side && drag.fromIdx === visIdx && drag.hasMoved;
      const offset = getDragOffset(side, visIdx);
      return /*#__PURE__*/React.createElement("div", {
        key: deckIdx,
        onPointerDown: e => startDrag(side, visIdx, e),
        onPointerMove: e => moveDrag(side, e),
        onPointerUp: e => endDrag(side, setter, e),
        onPointerCancel: () => setDrag(null),
        onContextMenu: e => e.preventDefault(),
        style: {
          width: "100%",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderBottom: "1px solid var(--border)",
          background: isDraggingThis ? color + "28" : color + "14",
          cursor: isDraggingThis ? "grabbing" : "grab",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          boxShadow: isDraggingThis ? `0 8px 24px ${color}40` : "none",
          transform: `translateY(${offset}px)${isDraggingThis ? " scale(1.03)" : ""}`,
          transition: isDraggingThis ? "box-shadow 0.1s" : "transform 0.12s ease,box-shadow 0.1s",
          zIndex: isDraggingThis ? 10 : 1,
          position: "relative",
          fontFamily: "'Outfit',sans-serif",
          boxSizing: "border-box"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 26,
          height: 26,
          borderRadius: 7,
          flexShrink: 0,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1
        }
      }, visIdx + 1)), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color,
          lineHeight: 1.2
        }
      }, combo.blade || "—"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.4
        }
      }, combo.ratchet ? `${combo.ratchet} · ${combo.bit}` : combo.bit || "")), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 18,
          opacity: 0.3,
          color: "var(--text-muted)",
          lineHeight: 1,
          flexShrink: 0
        }
      }, "\u283F"));
    })
    // ── ORDER NOT SET: tappable buttons ──────────────────────────────────
    : deck.map((combo, deckIdx) => {
      const pos = order.indexOf(deckIdx);
      const isPicked = pos !== -1;
      const handler = clickCombo(order, setter, isLocked, isDone);
      return /*#__PURE__*/React.createElement("button", {
        key: deckIdx,
        onClick: () => handler(deckIdx),
        disabled: isLocked,
        style: {
          width: "100%",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          border: "none",
          borderBottom: "1px solid var(--border)",
          background: isPicked ? color + "14" : isLocked ? "var(--surface3)" : "var(--surface2)",
          color: isLocked ? "var(--text-disabled)" : "var(--text-primary)",
          cursor: isLocked ? "not-allowed" : "pointer",
          opacity: isLocked ? 0.4 : 1,
          fontFamily: "'Outfit',sans-serif",
          textAlign: "left"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 26,
          height: 26,
          borderRadius: 7,
          flexShrink: 0,
          background: isPicked ? color : "var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 900,
          color: isPicked ? "#fff" : "var(--text-faint)",
          lineHeight: 1
        }
      }, isPicked ? pos + 1 : "·")), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: isPicked ? color : "var(--text-primary)",
          lineHeight: 1.2
        }
      }, combo.blade || "—"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.4
        }
      }, combo.ratchet ? `${combo.ratchet} · ${combo.bit}` : combo.bit || "")));
    }));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "var(--bg-solid)",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      fontFamily: "'Outfit',sans-serif",
      zIndex: 600
    }
  }, expired && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#DC2626",
      padding: "7px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 900,
      color: "#fff"
    }
  }, "\u23F1 Time's up"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(255,255,255,0.8)",
      marginLeft: "auto"
    }
  }, "continue when ready")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px 10px",
      borderBottom: "1px solid var(--border)",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: "var(--text-muted)",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      margin: "0 0 2px"
    }
  }, "SET ", curSet, " \xB7 SHUFFLE ", shuf), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0
    }
  }, "Set Deck Order")), !showTimer && canUndo && /*#__PURE__*/React.createElement("button", {
    onClick: onUndo,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, IC.undo, "Undo"), showTimer && !expired && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flexShrink: 0,
      minWidth: 44
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 34,
      fontWeight: 900,
      color: timerColor,
      lineHeight: 1,
      fontVariantNumeric: "tabular-nums"
    }
  }, seconds), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 600,
      color: "var(--text-faint)"
    }
  }, "sec"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto"
    }
  }, summary(), section(topName, topDeck, topOrder, setTopOrder, topDone, topColor, topLocked), section(botName, botDeck, botOrder, setBotOrder, botDone, botColor, botLocked)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px 16px",
      borderTop: "1px solid var(--border)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: confirm,
    disabled: !canStart,
    style: {
      width: "100%",
      padding: "16px 0",
      borderRadius: 14,
      border: "none",
      background: canStart ? "linear-gradient(135deg,#7C3AED,#4C1D95)" : "var(--border2)",
      color: "#fff",
      fontSize: 16,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: canStart ? "pointer" : "not-allowed"
    }
  }, "Start Match")));
}
function MatchScreen({
  config,
  parts,
  players,
  judge,
  setJudge,
  sharedJudges,
  sheetsStatus,
  setSheetsStatus,
  onBack,
  onMainMenu,
  onDownloadCSV,
  onSendSheets,
  onOpenLib,
  dark,
  toggleDark,
  challongeSlug,
  challongeParticipants
}) {
  // Resume snapshot — if a match was mid-flight (past the initial player pick) when the
  // page refreshed, restore it. Computed once on mount; sessionStorage clears itself when
  // the tab actually closes, so there's no risk of resuming something stale days later.
  const [_resume] = useState(() => {
    const snap = ssGet(KEYS.matchResume, null);
    return snap && snap.phase && snap.phase !== "pick" ? snap : null;
  });
  const [phase, setPhase] = useState(_resume ? _resume.phase : "pick");
  const [abandonConfirm, setAbandonConfirm] = useState(false);
  const [overBackConfirm, setOverBackConfirm] = useState(false);
  const [sharedJudgePicker, setSharedJudgePicker] = useState(false); // show who-is-judging prompt
  const [p1, setP1] = useState(_resume ? _resume.p1 : null);
  const [p2, setP2] = useState(_resume ? _resume.p2 : null);
  const [d1, setD1] = useState(_resume ? _resume.d1 : [emptyCombo(), emptyCombo(), emptyCombo()]);
  const [d2, setD2] = useState(_resume ? _resume.d2 : [emptyCombo(), emptyCombo(), emptyCombo()]);
  const [r1, setR1] = useState(_resume ? _resume.r1 : null);
  const [r2, setR2] = useState(_resume ? _resume.r2 : null);
  const [used1, setUsed1] = useState(_resume ? _resume.used1 : []);
  const [used2, setUsed2] = useState(_resume ? _resume.used2 : []);
  const [pts, setPts] = useState(_resume ? _resume.pts : [0, 0]);
  const [sets, setSets] = useState(_resume ? _resume.sets : [0, 0]);
  const [curSet, setCurSet] = useState(_resume ? _resume.curSet : 1);
  const [shuf, setShuf] = useState(_resume ? _resume.shuf : 1);
  const [log, setLog] = useState(() => sGet(KEYS.matchLog, []));
  const [future, setFuture] = useState([]);
  const [matchStartIdx, setMatchStartIdx] = useState(_resume ? _resume.matchStartIdx : 0);
  const [picker, setPicker] = useState(null);
  const [qcEditMenu, setQcEditMenu] = useState(null); // { qi, qc } — which quick combo is showing the part-edit menu
  const [pcEditMenu, setPcEditMenu] = useState(null); // { ci, combo } — which prev combo is showing the part-edit menu
  const [orderPreset, setOrderPreset] = useState(false); // true → ShuffleOrderScreen pre-fills from restored undo deck order
  const [pickerHistory, setPickerHistory] = useState([]); // stack of previous picker states for undo
  const openPicker = val => {
    setPickerHistory(h => picker ? [...h, picker] : h);
    setPicker(val);
    setPickerSearch("");
    setCrossoverOpen(false);
    setCxPicker(null);
    setQcEditMenu(null); // dismiss any open quick-combo edit menu
  };
  const undoPicker = () => {
    if (!pickerHistory.length) return;
    const prev = pickerHistory[pickerHistory.length - 1];
    setPickerHistory(h => h.slice(0, -1));
    // Clear the part that was just picked at the current step
    if (picker && !picker.returnToReview) {
      const {
        who,
        slot,
        cat
      } = picker;
      const deck = who === 1 ? d1 : d2;
      const setDeck = who === 1 ? setD1 : setD2;
      const nd = [...deck];
      nd[slot] = {
        ...nd[slot],
        [cat]: null
      };
      setDeck(nd);
    }
    setPicker(prev);
    setPickerSearch("");
    setCrossoverOpen(false);
    setCxPicker(null);
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [manualJudge, setManualJudge] = useState(_resume ? _resume.manualJudge : false);
  const [setScores, setSetScores] = useState(_resume ? _resume.setScores : []);
  const [sideAssign, setSideAssign] = useState(_resume ? _resume.sideAssign : null);
  const [sidePicker, setSidePicker] = useState(null);
  const [currentSides, setCurrentSides] = useState(_resume ? _resume.currentSides : {
    p1Side: "",
    p2Side: ""
  });
  const [pickerSearch, setPickerSearch] = useState("");
  const [crossoverOpen, setCrossoverOpen] = useState(false);
  const [cxPicker, setCxPicker] = useState(null); // null | {step,who,slot,chip?,blade?,returnToReview?}
  const [deckReview, setDeckReview] = useState(false); // true = show review screen, false = in picker flow
  const [lerStrikes, setLerStrikes] = useState(_resume ? _resume.lerStrikes : [0, 0]); // launch error strike counter per player [p1,p2]
  const [pickTab, setPickTab] = useState(challongeSlug || config.tm ? "active" : "roster"); // "roster" | "active"
  const [activeMatches, setActiveMatches] = useState(null); // null | "loading" | []
  const [challongeMatchId, setChallongeMatchId] = useState(_resume ? _resume.challongeMatchId : null);
  const [challongeP1ParticipantId, setChallongeP1ParticipantId] = useState(_resume ? _resume.challongeP1ParticipantId : null);
  const [challongeP2ParticipantId, setChallongeP2ParticipantId] = useState(_resume ? _resume.challongeP2ParticipantId : null);
  const [challongeSubmitStatus, setChallongeSubmitStatus] = useState(null);
  const [underwayStatus, setUnderwayStatus] = useState(null); // null | "checking" | "ok" | "denied" | "error"
  const [pendingFinish, setPendingFinish] = useState(null); // {pi, fin} — selected but not yet confirmed

  const [overlaySlot, setOverlaySlot] = useState(() => {
    try {
      return parseInt(localStorage.getItem(KEYS.overlaySlot) || "0", 10) || 0;
    } catch {
      return 0;
    }
  }); // 0 = disabled, 1-4 = slot number
  const [workerCombos, setWorkerCombos] = useState({}); // { playerName: [combo,...] } loaded from Worker KV
  const workerCombosRef = useRef({}); // mirrors workerCombos — always current, avoids stale closure in saveCombosToStorage
  const p1Ref = useRef(null); // mirrors p1 state — always current inside async/closure callbacks
  const p2Ref = useRef(null); // mirrors p2 state — always current inside async/closure callbacks
  const [overlayStatus, setOverlayStatus] = useState(null); // null | "ok" | "error"
  // swapped: purely a display-order flip. When true, p2 is shown on the left (blue side) and p1 on right (red side).
  // sets[], pts[], setScores[] always use canonical index 0=p1 1=p2 regardless of swap.
  const [swapped, setSwapped] = useState(_resume ? _resume.swapped : false);

  // Keep a running snapshot of the in-progress match in sessionStorage, so an accidental
  // refresh drops the judge back into the same match instead of a blank picker. Only saves
  // once a match is actually underway (past "pick") — nothing worth resuming before that.
  useEffect(() => {
    if (phase === "pick") {
      ssClear(KEYS.matchResume);
      return;
    }
    ssSave(KEYS.matchResume, {
      phase, p1, p2, d1, d2, r1, r2, used1, used2, pts, sets, curSet, shuf,
      manualJudge, setScores, sideAssign, currentSides, lerStrikes,
      challongeMatchId, challongeP1ParticipantId, challongeP2ParticipantId,
      matchStartIdx, swapped
    });
  }, [phase, p1, p2, d1, d2, r1, r2, used1, used2, pts, sets, curSet, shuf,
      manualJudge, setScores, sideAssign, currentSides, lerStrikes,
      challongeMatchId, challongeP1ParticipantId, challongeP2ParticipantId,
      matchStartIdx, swapped]);
  const [sideSwapConfirm, setSideSwapConfirm] = useState(false); // swap B/X sides modal
  const [swapStadium, setSwapStadium] = useState(true); // checkbox: swap B/X sides
  const [swapPosition, setSwapPosition] = useState(false); // checkbox: swap p1/p2 in app
  const [historyConfirmClear, setHistoryConfirmClear] = useState(false);
  const [judgeSubmitModal, setJudgeSubmitModal] = useState(false);
  const [submitChallongeCheck, setSubmitChallongeCheck] = useState(true);
  const [submitSheetsCheck, setSubmitSheetsCheck] = useState(true); // clear log confirmation in battle screen history panel
  const [judgeEditMode, setJudgeEditMode] = useState(false); // judge name editable on over screen
  const [layoutEditMode, setLayoutEditMode] = useState(false); // height adjustment mode
  const [overlayModal, setOverlayModal] = useState(false); // stream slot picker modal
  const [pingModal, setPingModal] = useState(false); // Contact TO ping modal
  const [handoffModal, setHandoffModal] = useState(false); // Match handoff QR generator
  const [handoffToken, setHandoffToken] = useState(null); // 6-char token written to KV
  const [handoffPhase, setHandoffPhase] = useState(null); // null | "generating" | "claimed"
  const handoffQrRef = useRef(null); // div where QR code renders
  const handoffPollRef = useRef(null); // setInterval handle for claim polling
  const [scannerOpen, setScannerOpen] = useState(false); // camera QR scanner open
  const [handoffPreview, setHandoffPreview] = useState(null); // { p1, p2, pts, sets, curSet, token } preview card before accept
  const scanVideoRef = useRef(null); // <video> for getUserMedia stream
  const [handoffMethodPicker, setHandoffMethodPicker] = useState(false); // duo mode: show "new device vs same device" choice
  const [handoffSameDeviceConfirm, setHandoffSameDeviceConfirm] = useState(null); // name of judge who just took over
  const scanCanvasRef = useRef(null); // offscreen canvas for frame sampling
  const scanIntervalRef = useRef(null); // kept for cleanup compat
  const scanStreamRef = useRef(null); // MediaStream ref so we can stop it
  const scanRafRef = useRef(null); // requestAnimationFrame handle for scan loop
  const scanFoundRef = useRef(false); // prevents double-firing when QR is detected
  const [pingComment, setPingComment] = useState("");
  const [pingReason, setPingReason] = useState(null); // selected reason chip
  const [pingStadium, setPingStadium] = useState(null); // selected stadium number
  const [pingSending, setPingSending] = useState(false);
  const [pingSent, setPingSent] = useState(false);
  // shuffleTimer: null = hidden, "active" = counting down, "expired" = time ran out
  const [shuffleTimer, setShuffleTimer] = useState(null);
  // Section heights in px — null = auto/flex
  const [sectionH, setSectionH] = useState({
    score: null,
    combo: null,
    picker: null,
    finish: null
  });
  // Drag state for height sliders
  const dragRef = useRef(null); // {section, startY, startH, startH2} — startH2 = neighbour below
  const rafRef = useRef(null); // requestAnimationFrame handle for drag throttling
  const pushOverlayDebounceRef = useRef(0); // timestamp of last pushOverlay call — throttles to 1/500ms
  const scoreBlockSectionRef = useRef(null); // for reliable height read on drag start
  const comboDisplaySectionRef = useRef(null);
  const comboPickerSectionRef = useRef(null);
  const finishSectionRef = useRef(null);
  const scoreBlockRef = useRef(null);
  const scoreBlockCbRef = React.useCallback(el => {
    scoreBlockRef.current = el;
    scoreBlockSectionRef.current = el;
  }, []);
  // Portrait vs landscape for combo button layout — recomputed on each render via sc trigger
  const comboAreaRef = useRef(null); // kept for legacy ref safety, not used for measurement

  // ── beforeunload: warn before accidental close, and mark match as abandoned in KV
  //    so the overlay/organizer live view stops showing it as live.
  useEffect(() => {
    const handler = e => {
      const battlesLogged = log.slice(matchStartIdx).filter(en => en.type !== "LER-STRIKE").length;
      const matchActive = phase === "battle" && battlesLogged > 0;

      // Push an abandoned marker so the overlay/organizer live view knows to hide this match.
      // Use sendBeacon so the request survives the page unload.
      if (challongeMatchId && matchActive) {
        const body = JSON.stringify({
          matchId: challongeMatchId,
          ...(overlaySlot ? {
            slot: overlaySlot
          } : {}),
          state: {
            p1,
            p2,
            abandoned: true,
            pushedAt: Date.now()
          }
        });
        navigator.sendBeacon ? navigator.sendBeacon(`${OVERLAY_WORKER}/overlay/push`, new Blob([body], {
          type: "application/json"
        })) : fetch(`${OVERLAY_WORKER}/overlay/push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body,
          keepalive: true
        }).catch(() => {});
      }

      // Show the browser's "are you sure?" dialog for desktop
      if (matchActive) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [log, matchStartIdx, phase, challongeMatchId, overlaySlot, p1, p2]);

  // Auto-fetch active matches if we default to active tab
  useEffect(() => {
    if (challongeSlug) fetchActiveMatches();
  }, []);

  // On mount: if a handoff token was stashed from the URL (native camera scan),
  // auto-fetch its payload and show the accept card — judge picks up where they left off
  useEffect(() => {
    const token = (() => {
      try {
        return sessionStorage.getItem("ncblast-pending-handoff");
      } catch (_) {
        return null;
      }
    })();
    if (!token) return;
    try {
      sessionStorage.removeItem("ncblast-pending-handoff");
    } catch (_) {}
    // Switch to active tab so the preview card appears in context
    setPickTab("active");
    handleHandoffScan(token);
  }, []);

  // ── Handoff QR render + poll effects ────────────────────────────────────
  // When the modal opens with "generating" phase: render the QR code and start polling
  useEffect(() => {
    if (!handoffModal || handoffPhase !== "generating" || !handoffToken) return;
    // Small delay so the div is mounted before we try to render into it
    const timer = setTimeout(() => {
      const el = handoffQrRef.current;
      if (!el) return;
      el.innerHTML = ""; // clear any previous render
      try {
        new QRCode(el, {
          text: `https://ncblast.pages.dev?handoff=${handoffToken}`,
          width: 240,
          height: 240,
          colorDark: "#1E293B",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {
        el.innerHTML = "<p style='color:red;font-size:12px'>QR error</p>";
      }
      startHandoffPoll(handoffToken);
    }, 150);
    return () => clearTimeout(timer);
  }, [handoffModal, handoffPhase, handoffToken]);

  // Cleanup: stop poll interval when modal closes
  useEffect(() => {
    if (!handoffModal && handoffPollRef.current) {
      clearInterval(handoffPollRef.current);
      handoffPollRef.current = null;
    }
  }, [handoffModal]);
  // ── End handoff effects ──────────────────────────────────────────────────

  // Load combo registry for this tournament when player names are known.
  // One fetch returns all players — no per-player round trips.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!challongeSlug) return;
      const registry = await fetchCombosForTournament(challongeSlug);
      if (!cancelled) {
        // Build a display-name-keyed dict for the two current players
        const results = {};
        [p1, p2].filter(Boolean).forEach(name => {
          const combos = getCombosFromRegistry(registry, name);
          if (combos.length) results[name] = combos;
        });
        setWorkerCombos(prev => {
          const next = {
            ...prev,
            ...results
          };
          workerCombosRef.current = next;
          return next;
        });
      }
    }
    if ((p1 || p2) && challongeSlug) load();
    return () => {
      cancelled = true;
    };
  }, [p1, p2, challongeSlug]);

  // Re-fetch registry on demand (called when Build Decks is tapped).
  const refreshCombos = async () => {
    if (!challongeSlug) return;
    const registry = await fetchCombosForTournament(challongeSlug);
    const results = {};
    [p1, p2].filter(Boolean).forEach(name => {
      results[name] = getCombosFromRegistry(registry, name);
    });
    setWorkerCombos(prev => {
      const next = {
        ...prev,
        ...results
      };
      workerCombosRef.current = next;
      return next;
    });
  };
  const need = Math.ceil(config.bo / 2);
  const cReady = d1.every(comboReady) && d2.every(comboReady);
  const doScore = (pi, fin) => {
    // penalty: listed under loser pi, points go to opponent
    const scoringPi = fin.penalty ? 1 - pi : pi;

    // Clear any pending finish selection
    setPendingFinish(null);

    // ── Normal scoring ───────────────────────────────────────────────────────
    const raw = [pts[0], pts[1]];
    raw[scoringPi] += fin.p;
    const cap = config.pts > 0 ? config.pts : Infinity;
    const np = [Math.min(raw[0], cap), Math.min(raw[1], cap)];
    const entry = {
      set: curSet,
      shuffle: shuf,
      slot: log.slice(matchStartIdx).filter(e => e.set === curSet).length + 1,
      scorer: scoringPi === 0 ? p1 : p2,
      scorerIdx: scoringPi,
      judge: judge,
      penalty: fin.penalty || false,
      type: fin.id,
      typeName: fin.name,
      points: fin.p,
      p1Score: np[0],
      p2Score: np[1],
      p1Name: p1,
      p2Name: p2,
      p1Combo: {
        ...d1[r1]
      },
      p2Combo: {
        ...d2[r2]
      },
      p1ComboIdx: r1,
      p2ComboIdx: r2,
      p1Side: currentSides.p1Side || "",
      p2Side: currentSides.p2Side || "",
      winnerCombo: comboStr(scoringPi === 0 ? d1[r1] : d2[r2]),
      time: new Date().toISOString(),
      _pp: [...pts],
      _ps: [...sets],
      _cs: curSet,
      _u1: [...used1],
      _u2: [...used2],
      _sh: shuf,
      _ls: [...lerStrikes],
      _ss: [...setScores],
      _d1: d1.map(c => ({
        ...c
      })),
      _d2: d2.map(c => ({
        ...c
      })) // deck order snapshot for undo
    };
    const newLog = [...log, entry];
    setLog(newLog);
    sSave(KEYS.matchLog, newLog);
    setFuture([]);
    setPts(np);
    // Push to stream overlay (fire and forget)
    pushOverlay({
      lastFinish: {
        type: fin.id,
        scorerIdx: scoringPi
      },
      pts: np
    });
    const setWon = config.pts > 0 && np[scoringPi] >= config.pts;

    // LER — 1-strike system: first LER adds a strike, second converts to a point
    if (fin.id === "LER") {
      if (setWon) {
        const ns = [sets[0], sets[1]];
        ns[scoringPi] += 1;
        setSets(ns);
        setSetScores(ss => [...ss, {
          p1: np[0],
          p2: np[1]
        }]);
        if (ns[scoringPi] >= need) {
          saveCombosToStorage();
          setPhase("over");
        } else {
          if (config.tm) {
            const loserPi = 1 - scoringPi;
            setSideAssign({
              pickPriority: loserPi
            });
            setSidePicker({
              priority: loserPi
            });
          } else {
            setPhase("order");
          }
          setCurSet(c => c + 1);
          setPts([0, 0]);
          setUsed1([]);
          setUsed2([]);
          setShuf(1);
          setLerStrikes([0, 0]);
        }
      }
      // stay on battle screen — combos do not advance
      return;
    }

    // Any score change clears all LER strikes
    setLerStrikes([0, 0]);
    const nu1 = [...used1, r1];
    const nu2 = [...used2, r2];
    setUsed1(nu1);
    setUsed2(nu2);
    // Auto-advance to next unused bey; null if all used (shuffle triggers)
    const nxR1 = [0, 1, 2].find(i => !nu1.includes(i));
    const nxR2 = [0, 1, 2].find(i => !nu2.includes(i));
    setR1(nxR1 !== undefined ? nxR1 : null);
    setR2(nxR2 !== undefined ? nxR2 : null);
    if (setWon) {
      const ns = [sets[0], sets[1]];
      ns[scoringPi] += 1;
      setSets(ns);
      setSetScores(ss => [...ss, {
        p1: np[0],
        p2: np[1]
      }]);
      if (ns[scoringPi] >= need) {
        saveCombosToStorage();
        setPhase("over");
      } else {
        if (config.tm) {
          const loserPi = 1 - scoringPi;
          setSideAssign({
            pickPriority: loserPi
          });
          setSidePicker({
            priority: loserPi
          });
        } else {
          setPhase("order");
        }
        setCurSet(c => c + 1);
        setPts([0, 0]);
        setUsed1([]);
        setUsed2([]);
        setShuf(1);
      }
    } else {
      if (nu1.length >= 3 && nu2.length >= 3) {
        if (config.tm) {
          setShuffleTimer("active");
          pushOverlay({
            shuffling: true
          });
        } else {
          setUsed1([]);
          setUsed2([]);
          setShuf(s => s + 1);
          setPhase("order");
        }
      }
      // stay on battle screen — combos reset via setR1/setR2 null above
    }
  };
  const undo = () => {
    // Always allow undoing a LER-STRIKE, even across the matchStartIdx boundary
    const lastIsStrike = log.length > 0 && log[log.length - 1]?.type === "LER-STRIKE";
    if (log.length <= matchStartIdx && !lastIsStrike) return;
    const l = log[log.length - 1];
    const undoLog = log.slice(0, -1);
    setFuture([l, ...future]);
    setLog(undoLog);
    sSave(KEYS.matchLog, undoLog);
    setPts(l._pp);
    setSets(l._ps);
    setCurSet(l._cs);
    setUsed1(l._u1);
    setUsed2(l._u2);
    setShuf(l._sh);
    if (l._ls) setLerStrikes(l._ls);
    if (l._ss) setSetScores(l._ss);
    setPendingFinish(null);
    // Restore deck order (ShuffleOrderScreen may have reordered d1/d2)
    if (l._d1) setD1(l._d1);
    if (l._d2) setD2(l._d2);
    // If undo lands at the start of a shuffle (no beys used yet),
    // re-show ShuffleOrderScreen so the judge can re-set the deck order.
    if (l._u1.length === 0 && l._u2.length === 0) {
      setR1(null);
      setR2(null);
      setOrderPreset(true); // restore previous shuffle order on the order screen
      setPhase("order");
    } else {
      // Auto-advance to next unused bey (combo picker was removed)
      const nxR1 = [0, 1, 2].find(i => !l._u1.includes(i));
      const nxR2 = [0, 1, 2].find(i => !l._u2.includes(i));
      setR1(nxR1 !== undefined ? nxR1 : null);
      setR2(nxR2 !== undefined ? nxR2 : null);
      setPhase("battle");
    }
  };
  const redo = () => {
    if (!future.length) return;
    const n = future[0];
    setFuture(future.slice(1));
    const redoLog = [...log, n];
    setLog(redoLog);
    sSave(KEYS.matchLog, redoLog);
    setPts([n.p1Score, n.p2Score]);
    // Restore deck order from the redone entry
    if (n._d1) setD1(n._d1);
    if (n._d2) setD2(n._d2);
    const nu1 = [...n._u1, n.p1ComboIdx];
    const nu2 = [...n._u2, n.p2ComboIdx];
    const allUsed = nu1.length >= 3 && nu2.length >= 3;
    const setWon = config.pts > 0 && (n.p1Score >= config.pts || n.p2Score >= config.pts);
    if (setWon) {
      const ns = [sets[0], sets[1]];
      ns[n.scorerIdx] += 1;
      setSets(ns);
      setSetScores(ss => [...ss, {
        p1: n.p1Score,
        p2: n.p2Score
      }]);
      if (ns[n.scorerIdx] >= need) {
        setPhase("over");
      } else {
        setCurSet(c => c + 1);
        setPts([0, 0]);
        setUsed1([]);
        setUsed2([]);
        setShuf(1);
        setR1(null);
        setR2(null);
        setPhase("order");
      }
    } else if (allUsed) {
      // All beys used — need a new shuffle order
      setUsed1([]);
      setUsed2([]);
      setShuf(n._sh + 1);
      setR1(null);
      setR2(null);
      setPhase("order");
    } else {
      setUsed1(nu1);
      setUsed2(nu2);
      setShuf(n._sh);
      const nxR1 = [0, 1, 2].find(i => !nu1.includes(i));
      const nxR2 = [0, 1, 2].find(i => !nu2.includes(i));
      setR1(nxR1 !== undefined ? nxR1 : null);
      setR2(nxR2 !== undefined ? nxR2 : null);
      setPhase("battle");
    }
  };

  // pushDeckToRegistry: writes both players' ready combos into the tournament registry.
  // Called at deck confirmation (early) and again at match completion (ensures nothing lost).
  // The Worker merges per-player so parallel calls from different stations don't race.
  const pushDeckToRegistry = (d1override, d2override) => {
    if (!challongeSlug) return;
    const deck1 = d1override || d1;
    const deck2 = d2override || d2;
    // Use refs instead of state so this always gets the current player names,
    // even when called from inside a callback where state may be stale.
    const curP1 = p1Ref.current;
    const curP2 = p2Ref.current;
    [[curP1, deck1], [curP2, deck2]].forEach(([name, deck]) => {
      if (!name) return;
      const readyCombos = deck.filter(comboReady).map(c => ({
        ...normalizeCombo(c),
        updatedAt: Date.now()
      }));
      if (!readyCombos.length) return;
      // Update in-memory cache immediately so this session sees it without a re-fetch
      setWorkerCombos(prev => {
        const next = {
          ...prev,
          [name]: readyCombos
        };
        workerCombosRef.current = next;
        return next;
      });
      // Push to Worker — each player is a separate merge, no race condition
      pushCombosForTournament(challongeSlug, name, readyCombos);
    });
  };

  // saveCombosToStorage: alias called at match completion — same logic, kept for clarity
  const saveCombosToStorage = () => pushDeckToRegistry();
  const fetchActiveMatches = async () => {
    if (!challongeSlug) return;
    setActiveMatches("loading");
    try {
      const res = await fetch(`https://challonge-proxy.danny61734.workers.dev/matches?slug=${challongeSlug}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0]);
      setActiveMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (err) {
      setActiveMatches([]);
    }
  };
  const pushOverlay = (extraState = {}) => {
    // Throttle: never fire more than once per 500ms. Prevents runaway loops
    // if something triggers pushOverlay in a tight re-render cycle.
    const now = Date.now();
    if (now - pushOverlayDebounceRef.current < 500) return;
    pushOverlayDebounceRef.current = now;
    const activeComboOf = (deck, idx) => {
      const c = idx !== null ? deck[idx] : null;
      return c?.blade ? {
        blade: c.blade,
        ratchet: c.ratchet,
        bit: c.bit
      } : null;
    };
    // extraState can supply p1ComboIdx / p2ComboIdx to override stale r1/r2
    // (React setState is async so r1/r2 may not reflect the tap that just happened)
    const r1eff = "p1ComboIdx" in extraState ? extraState.p1ComboIdx : r1;
    const r2eff = "p2ComboIdx" in extraState ? extraState.p2ComboIdx : r2;
    const {
      p1ComboIdx,
      p2ComboIdx,
      ...rest
    } = extraState;
    // Build combo history: completed battles from this match (no LER strikes)
    const currentLog = log.slice(matchStartIdx).filter(e => e.type !== "LER-STRIKE" && e.type !== "LER");
    const historyFull = currentLog.map(e => ({
      scorer: e.scorerIdx === 0 ? p1 || "" : p2 || "",
      scorerIdx: e.scorerIdx,
      typeName: e.typeName || "",
      points: e.p || e.points || 0,
      winnerCombo: e.winnerCombo || "",
      set: e.set || 1
    }));
    // For live view: send last 5 only (keeps the overlay payload small)
    // For matchOver: send full history so it can be saved to the log store
    const comboHistory = phase === "over" ? historyFull : historyFull.slice(-5);
    const state = {
      p1,
      p2,
      p1Side: currentSides.p1Side || "",
      p2Side: currentSides.p2Side || "",
      pts: [...pts],
      sets: [...sets],
      curSet,
      setsNeeded: need,
      pointLimit: config.pts,
      tournamentName: config.tournamentName || "",
      judge,
      challongeMatchId: challongeMatchId || null,
      matchOver: phase === "over",
      comboHistory,
      p1ActiveCombo: activeComboOf(d1, r1eff),
      p2ActiveCombo: activeComboOf(d2, r2eff),
      ...rest
    };

    // Always push via matchId for overlay/live tracking (no channel required)
    // Also push via slot number if OBS streaming is enabled
    const body = {
      state
    };
    if (challongeMatchId) body.matchId = challongeMatchId;
    if (overlaySlot) body.slot = overlaySlot;
    if (!challongeMatchId && !overlaySlot) {
      console.warn("[BLAST] pushOverlay bailed — no challongeMatchId and no overlaySlot", {
        challongeMatchId,
        overlaySlot,
        p1,
        p2
      });
      if (config.tm) setOverlayStatus("error");
      return;
    }
    console.log("[BLAST] pushOverlay firing", {
      matchId: challongeMatchId,
      slot: overlaySlot,
      p1,
      p2
    });
    fetch(`${OVERLAY_WORKER}/overlay/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(r => {
      console.log("[BLAST] push response", r.status);
      setOverlayStatus("ok");
    }).catch(e => {
      console.error("[BLAST] push failed", e);
      setOverlayStatus("error");
    });
  };
  const submitChallongeScore = async (matchId, p1Score, p2Score, winnerChallongeId) => {
    if (!challongeSlug || !matchId) return;
    setChallongeSubmitStatus("loading");
    const scoresCsv = setScores.length > 0 ? setScores.map(s => `${s.p1}-${s.p2}`).join(",") : `${p1Score}-${p2Score}`;
    try {
      const judgeToken = sessionStorage.getItem("ncblast-auth-token") || "";
      const judgeUser = sessionStorage.getItem("ncblast-auth-user") || "";
      const res = await fetch(`https://challonge-proxy.danny61734.workers.dev/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": judgeToken,
          "X-Auth-User": judgeUser
        },
        body: JSON.stringify({
          slug: challongeSlug,
          matchId,
          scores_csv: scoresCsv,
          winner_id: winnerChallongeId
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      console.log("[BLAST] submitChallongeScore response", {
        status: res.status,
        data
      });
      if (!res.ok || data.errors) throw new Error(data.errors?.[0] || JSON.stringify(data.errors) || `HTTP ${res.status}`);
      setChallongeSubmitStatus("ok");
      fetchActiveMatches();
      // Push to judge accountability log in Worker KV (fire-and-forget, never blocks submit)
      const winnerIsP1 = String(winnerChallongeId) === String(challongeP1ParticipantId);
      fetch(`${OVERLAY_WORKER}/scorelog/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: challongeSlug,
          judge: judge || "",
          p1: p1 || "",
          p2: p2 || "",
          p1Sets: p1Score,
          p2Sets: p2Score,
          winner: winnerIsP1 ? p1 || "" : p2 || "",
          challongeMatchId: matchId,
          scoredAt: Date.now()
        })
      }).catch(() => {}); // ignore errors — log is best-effort
    } catch (err) {
      setChallongeSubmitStatus(err.message || "error");
    }
  };
  const reset = () => {
    ssClear(KEYS.matchResume);
    setP1(null);
    p1Ref.current = null;
    setP2(null);
    p2Ref.current = null;
    setD1([emptyCombo(), emptyCombo(), emptyCombo()]);
    setD2([emptyCombo(), emptyCombo(), emptyCombo()]);
    setPts([0, 0]);
    setSets([0, 0]);
    setCurSet(1);
    setShuf(1);
    setFuture([]);
    setR1(null);
    setR2(null);
    setUsed1([]);
    setUsed2([]);
    setPhase("pick");
    setSheetsStatus(null);
    setConfirmState(null);
    setJudge("");
    setSetScores([]);
    setSideAssign(null);
    setSidePicker(null);
    setCurrentSides({
      p1Side: "",
      p2Side: ""
    });
    setPickerSearch("");
    setDeckReview(false);
    setManualJudge(false);
    setLerStrikes([0, 0]);
    setChallongeMatchId(null);
    setChallongeP1ParticipantId(null);
    setChallongeP2ParticipantId(null);
    setChallongeSubmitStatus(null);
    setUnderwayStatus(null);
    setPendingFinish(null);
    setMatchStartIdx(sGet(KEYS.matchLog, []).length);
    setOverlaySlot(0);
    setSwapped(false);
    setShuffleTimer(null);
    setSharedJudgePicker(false);
    try {
      localStorage.setItem(KEYS.overlaySlot, "0");
    } catch {}
    ;
  };
  // After reset(), restore judge from session storage for solo mode.
  // Duo mode intentionally leaves judge blank — the per-match picker handles it.
  const resetAndRestoreJudge = () => {
    reset();
    if (!sharedJudges) {
      const fromSession = (() => {
        try {
          return sessionStorage.getItem("ncblast-auth-user") || "";
        } catch {
          return "";
        }
      })();
      if (fromSession) setJudge(fromSession);
    }
  };

  // ── Handoff helpers ──────────────────────────────────────────────────────
  // Generates a random 6-character token (letters + numbers)

  // ── Deck builder advance helper ──────────────────────────────────────────
  // Called after a part is selected. Advances to the next step in the linear
  // build flow regardless of which player started first.
  // `who` = 1|2 (who we just finished a step for), `slot` = 0-2, `cat` = current category.
  // `updatedD1`/`updatedD2` are the deck arrays AFTER the current pick is applied
  // (state updates are async so we pass the fresh values directly).
  const advanceDeckPicker = (who, slot, cat, updatedD1, updatedD2, returnToReview, name, qcEdit) => {
    // returnToReview: go straight to deck review (review-mode edits, or review-mode qcEdit)
    if (returnToReview) {
      setPicker(null);
      setDeckReview(true);
      return;
    }
    // qcEdit: the other two parts of this combo are already locked in — skip to next slot/player
    // rather than stepping through the remaining parts of the current combo
    if (qcEdit) {
      if (slot < 2) {
        openPicker({
          who,
          slot: slot + 1,
          cat: "blade"
        });
        return;
      }
      const otherWho = who === 1 ? 2 : 1;
      const otherDeck = otherWho === 1 ? updatedD1 : updatedD2;
      if (!otherDeck.every(comboReady)) {
        const firstUnfinished = otherDeck.findIndex(c => !comboReady(c));
        openPicker({
          who: otherWho,
          slot: firstUnfinished >= 0 ? firstUnfinished : 0,
          cat: "blade"
        });
      } else {
        setPicker(null);
        setDeckReview(true);
      }
      return;
    }
    const cats = ["blade", "ratchet", "bit"];
    const catIdx = cats.indexOf(cat);
    // Still steps remaining in this combo
    if (catIdx < 2) {
      const nextCat = cat === "blade" && NO_RATCHET_BLADES.includes(name) ? "bit" : cats[catIdx + 1];
      openPicker({
        who,
        slot,
        cat: nextCat
      });
      return;
    }
    // More combos remaining for this player
    if (slot < 2) {
      openPicker({
        who,
        slot: slot + 1,
        cat: "blade"
      });
      return;
    }
    // This player just finished their last combo — check the other player
    const otherWho = who === 1 ? 2 : 1;
    const otherDeck = otherWho === 1 ? updatedD1 : updatedD2;
    if (!otherDeck.every(comboReady)) {
      // Other player still needs combos — jump to their first unfinished one
      const firstUnfinished = otherDeck.findIndex(c => !comboReady(c));
      openPicker({
        who: otherWho,
        slot: firstUnfinished >= 0 ? firstUnfinished : 0,
        cat: "blade"
      });
    } else {
      // Both players are done — go to review
      setPicker(null);
      setDeckReview(true);
    }
  };
  const makeHandoffToken = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let t = "";
    for (let i = 0; i < 6; i++) t += chars[Math.floor(Math.random() * chars.length)];
    return t;
  };

  // Opens the handoff QR screen: writes state to KV, starts polling for claim
  const startHandoff = async () => {
    const token = makeHandoffToken();
    const state = {
      p1,
      p2,
      d1: d1.map(c => ({
        ...c
      })),
      d2: d2.map(c => ({
        ...c
      })),
      pts: [...pts],
      sets: [...sets],
      curSet,
      shuf,
      log: [...log],
      matchStartIdx,
      challongeMatchId,
      challongeP1ParticipantId,
      challongeP2ParticipantId,
      overlaySlot,
      challongeSlug,
      claimed: false
    };
    try {
      const res = await fetch("https://challonge-proxy.danny61734.workers.dev/handoff/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          state
        })
      });
      if (!res.ok) {
        alert("Could not create handoff. Try again.");
        return;
      }
    } catch (e) {
      alert("Network error creating handoff.");
      return;
    }
    setHandoffToken(token);
    setHandoffPhase("generating");
    setHandoffModal(true);
  };

  // Cancels the handoff: deletes KV token, closes modal
  const cancelHandoff = async token => {
    if (token) {
      try {
        await fetch(`https://challonge-proxy.danny61734.workers.dev/handoff/cancel?token=${token}`, {
          method: "DELETE"
        });
      } catch (e) {/* best effort */}
    }
    if (handoffPollRef.current) {
      clearInterval(handoffPollRef.current);
      handoffPollRef.current = null;
    }
    setHandoffToken(null);
    setHandoffPhase(null);
    setHandoffModal(false);
  };

  // Polls KV every 2.5s to check if the receiving judge has claimed the handoff
  const startHandoffPoll = token => {
    if (handoffPollRef.current) clearInterval(handoffPollRef.current);
    handoffPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`https://challonge-proxy.danny61734.workers.dev/handoff/get?token=${token}`);
        if (!res.ok) return; // token expired or gone — keep waiting
        const data = await res.json();
        if (data.claimed) {
          clearInterval(handoffPollRef.current);
          handoffPollRef.current = null;
          setHandoffPhase("claimed");
          setTimeout(() => {
            setHandoffModal(false);
            setHandoffToken(null);
            setHandoffPhase(null);
            reset();
          }, 2000);
        }
      } catch (e) {/* network hiccup — keep polling */}
    }, 2500);
  };

  // Stops the camera scanner and clears all its resources
  const stopScanner = () => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(t => t.stop());
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) {
      scanVideoRef.current.srcObject = null;
    }
    scanFoundRef.current = false;
    setScannerOpen(false);
  };

  // Opens the scanner: gets camera permission, stores the stream, then shows the modal.
  // The useEffect below watches scannerOpen and wires everything up once the video element exists.
  const startScanner = async () => {
    setHandoffPreview(null);
    scanFoundRef.current = false;
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment"
            }
          }
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }
      scanStreamRef.current = stream;
      setScannerOpen(true);
    } catch (e) {
      alert("Camera access denied or unavailable.");
    }
  };

  // Wires up the video + rAF scan loop whenever the scanner modal opens.
  // Runs AFTER the modal renders so the video element is guaranteed to exist in the DOM.
  useEffect(() => {
    if (!scannerOpen) return;
    const video = scanVideoRef.current;
    const canvas = scanCanvasRef.current;
    const stream = scanStreamRef.current;
    if (!video || !stream) return;

    // Attach stream and play
    video.srcObject = stream;
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => {});
    scanFoundRef.current = false;
    let lastScan = 0;
    const scanFrame = now => {
      if (scanFoundRef.current) return; // already found — stop the loop
      scanRafRef.current = requestAnimationFrame(scanFrame);
      if (now - lastScan < 300) return; // throttle to ~3 checks/sec
      if (!video || !canvas) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return; // no frame yet

      lastScan = now;

      // Draw downsampled frame into canvas
      const MAX_W = 640;
      const scale = Math.min(1, MAX_W / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);
      let imgData;
      try {
        imgData = ctx.getImageData(0, 0, w, h);
      } catch (_) {
        return;
      }
      let code;
      try {
        code = jsQR(imgData.data, w, h);
      } catch (_) {
        return;
      }
      if (code && code.data) {
        const m = code.data.match(/[?&]handoff=([A-Za-z0-9]{6})/);
        if (m) {
          scanFoundRef.current = true;
          if (scanRafRef.current) {
            cancelAnimationFrame(scanRafRef.current);
            scanRafRef.current = null;
          }
          // stopScanner and handleHandoffScan are called via setTimeout so we're
          // outside the rAF callback when state updates fire — avoids React warnings
          setTimeout(() => {
            stopScanner();
            handleHandoffScan(m[1]);
          }, 0);
        }
      }
    };
    scanRafRef.current = requestAnimationFrame(scanFrame);
    return () => {
      if (scanRafRef.current) {
        cancelAnimationFrame(scanRafRef.current);
        scanRafRef.current = null;
      }
    };
  }, [scannerOpen]);

  // Called when a valid handoff token is scanned — fetches preview from KV
  const handleHandoffScan = async token => {
    try {
      const res = await fetch(`https://challonge-proxy.danny61734.workers.dev/handoff/get?token=${token}`);
      if (!res.ok) {
        alert("Handoff expired or not found. Ask the other judge to try again.");
        return;
      }
      const data = await res.json();
      if (data.claimed) {
        alert("This handoff has already been claimed.");
        return;
      }
      setHandoffPreview({
        ...data,
        token
      });
    } catch (e) {
      alert("Could not load handoff data.");
    }
  };

  // Called when receiving judge taps Accept — claims the token and loads the match state
  const acceptHandoff = async preview => {
    try {
      const res = await fetch("https://challonge-proxy.danny61734.workers.dev/handoff/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: preview.token
        })
      });
      if (!res.ok) {
        alert("Could not claim handoff. Try again.");
        return;
      }
    } catch (e) {
      alert("Network error claiming handoff.");
      return;
    }

    // Restore all match state from the payload
    const judgeFromSession = (() => {
      try {
        return sessionStorage.getItem("ncblast-auth-user") || "";
      } catch {
        return "";
      }
    })();
    setP1(preview.p1);
    p1Ref.current = preview.p1;
    setP2(preview.p2);
    p2Ref.current = preview.p2;
    setD1(preview.d1 || [emptyCombo(), emptyCombo(), emptyCombo()]);
    setD2(preview.d2 || [emptyCombo(), emptyCombo(), emptyCombo()]);
    setPts(preview.pts || [0, 0]);
    setSets(preview.sets || [0, 0]);
    setCurSet(preview.curSet || 1);
    setShuf(preview.shuf || 1);
    setLog(preview.log || []);
    setMatchStartIdx(preview.matchStartIdx || 0);
    setChallongeMatchId(preview.challongeMatchId || null);
    setChallongeP1ParticipantId(preview.challongeP1ParticipantId || null);
    setChallongeP2ParticipantId(preview.challongeP2ParticipantId || null);
    setOverlaySlot(preview.overlaySlot || 0);
    if (judgeFromSession) setJudge(judgeFromSession);
    setHandoffPreview(null);
    setFuture([]);
    setUnderwayStatus("ok"); // already marked underway by the generating judge
    setPhase("battle");
  };
  // ── End handoff helpers ──────────────────────────────────────────────────

  // Navigation helpers
  // Unified back navigation — context-aware, no stale closure issues
  const pushPhase = newPhase => {
    setPhase(newPhase);
  }; // kept for call-site compat
  const goBack = () => {
    // Layer 1: CX picker open — close it, return to blade picker
    if (cxPicker) {
      setCxPicker(null);
      return;
    }
    // Layer 2: part picker open — close it, return to deck review
    if (picker) {
      setPicker(null);
      setDeckReview(true);
      return;
    }
    // Layer 3: deck review open — go back to pick phase
    if (phase === "deck" && deckReview) {
      setDeckReview(false);
      setPhase("pick");
      return;
    }
    // Layer 4: side picker modal - dismiss it
    if (sidePicker) {
      setSidePicker(null);
      setSideAssign(null);
      return;
    }
    // Layer 5: in battle with battles logged — warn before abandoning
    if (phase === "battle" && log.slice(matchStartIdx).length > 0) {
      setAbandonConfirm(true);
      return;
    }
    // Layer 6: in battle with no battles yet — safe to go back to deck
    if (phase === "order") {
      setPhase("deck");
      setDeckReview(true);
      setOrderPreset(false);
      return;
    }
    if (phase === "battle") {
      setPhase("deck");
      setDeckReview(true);
      return;
    }
    // Layer 8: in deck phase — back to pick
    if (phase === "deck") {
      setPhase("pick");
      return;
    }
    // Layer 9: in pick — back to players screen
    if (phase === "pick") {
      onBack();
      return;
    }
    // Layer 10: over screen handled separately via overBackConfirm
    onBack();
  };
  const abandonMatch = () => {
    // Void match: remove its battles from the log and return to pick
    const trimmed = log.slice(0, matchStartIdx);
    setLog(trimmed);
    sSave(KEYS.matchLog, trimmed);
    setAbandonConfirm(false);
    resetAndRestoreJudge();
  };

  // ── Abandon confirm overlay — rendered first so it always shows instantly ──
  if (abandonConfirm) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        maxHeight: "100dvh",
        overflowY: "auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 18,
        padding: "24px 20px",
        maxWidth: 340,
        width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        border: "2px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: "var(--text-primary)",
        marginBottom: 8,
        textAlign: "center"
      }
    }, "Abandon Match?"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        textAlign: "center",
        marginBottom: 6,
        lineHeight: 1.5
      }
    }, "This match has ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "#EF4444"
      }
    }, log.slice(matchStartIdx).filter(e => e.type !== "LER-STRIKE").length, " battle", log.slice(matchStartIdx).filter(e => e.type !== "LER-STRIKE").length !== 1 ? "s" : ""), " in progress."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-faint)",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 1.4
      }
    }, "Abandoning will void all battles from this match and return to player selection."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setAbandonConfirm(false),
      style: {
        flex: 1,
        padding: "12px 0",
        borderRadius: 10,
        border: "2px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Keep Playing"), /*#__PURE__*/React.createElement("button", {
      onClick: abandonMatch,
      style: {
        flex: 1,
        padding: "12px 0",
        borderRadius: 10,
        border: "none",
        background: "#EF4444",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Void & Exit"))));
  }

  // ── CX/picker shared vars — read from parts.cx which includes user additions ──
  const _pcx = parts.cx || {};
  const _deckCxBlades = _pcx.cx_blades || CX_BLADES;
  const _deckCxeBlades = _pcx.cxe_blades || CXE_BLADES;
  const _deckCxeOver = _pcx.cxe_over || CXE_OVER_BLADES;
  const _deckAssists = _pcx.assist || CX_ASSISTS;

  // ── CX Picker ──────────────────────────────────────────────────────────────
  if (cxPicker) {
    const {
      step,
      who,
      slot,
      chip,
      blade,
      returnToReview
    } = cxPicker;
    const deck = who === 1 ? d1 : d2;
    const setDeck = who === 1 ? setD1 : setD2;
    const pColor = who === 1 ? "#2563EB" : "#DC2626";
    const playerName = who === 1 ? p1 : p2;
    const comboLabel = ["First", "Second", "Third"][slot];

    // Parse all CX/CXE parts already used in OTHER slots for this player
    const otherBlades = deck.map((c, i) => i !== slot ? c.blade : null).filter(Boolean);
    const usedCxParts = {
      chips: [],
      blades: [],
      overBlades: [],
      assists: []
    };
    otherBlades.forEach(name => {
      const p = name.split(" ");
      // Determine if this is a CXE combo by checking if any word is a CXE blade
      const _allCxeBlades = (parts.cx || {}).cxe_blades || CXE_BLADES;
      const cxeIdx = p.findIndex(w => _allCxeBlades.includes(w));
      if (cxeIdx >= 0) {
        // CXE: [Chip?] CxeBlade OverBlade Assist
        if (cxeIdx > 0) usedCxParts.chips.push(p[0]);
        usedCxParts.blades.push(p[cxeIdx]);
        if (p[cxeIdx + 1]) usedCxParts.overBlades.push(p[cxeIdx + 1]);
        if (p[cxeIdx + 2]) usedCxParts.assists.push(p[cxeIdx + 2]);
      } else if (p.length === 3) {
        usedCxParts.chips.push(p[0]);
        usedCxParts.blades.push(p[1]);
        usedCxParts.assists.push(p[2]);
      } else if (p.length === 2) {
        usedCxParts.blades.push(p[0]);
        usedCxParts.assists.push(p[1]);
      }
    });
    // Taken non-Standard chips
    const takenChips = usedCxParts.chips.filter(ch => ch !== "Standard" && CX_CHIPS.includes(ch));
    const {
      overBlade,
      isCXE
    } = cxPicker || {};
    const advance = finalName => {
      const nd = [...deck];
      nd[slot] = {
        ...nd[slot],
        blade: finalName
      };
      setDeck(nd);
      setCxPicker(null);
      if (returnToReview) {
        setPicker(null);
        setDeckReview(true);
        return;
      }
      openPicker({
        who,
        slot,
        cat: "ratchet"
      });
    };
    // Build final name helper for assist step
    const buildFinalName = a => {
      if (isCXE) {
        return chip === "Standard" ? `${blade} ${overBlade} ${a}` : `${chip} ${blade} ${overBlade} ${a}`;
      }
      return chip === "Standard" ? `${blade} ${a}` : `${chip} ${blade} ${a}`;
    };
    const stepLabels = {
      chip: "Gear Chip",
      blade: "Blade",
      over_blade: "Over Blade",
      assist: "Assist"
    };
    const stepOrder = ["chip", "blade", "over_blade", "assist"];
    const progress = stepOrder.indexOf(step);
    const totalStepsInFlow = cxPicker?.isCXE ? 4 : 3;
    return /*#__PURE__*/React.createElement("div", {
      style: S.page
    }, /*#__PURE__*/React.createElement("button", {
      style: S.back,
      onClick: goBack
    }, IC.back, " Back to Blades"), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 4,
        background: "#E2E8F0",
        borderRadius: 2,
        marginBottom: 14,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: `${Math.round(progress / totalStepsInFlow * 100)}%`,
        background: "#0F766E",
        borderRadius: 2
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: pColor,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 2
      }
    }, playerName, " \u2014 ", comboLabel, " Combo \xB7 CX"), /*#__PURE__*/React.createElement("h1", {
      style: {
        ...S.title,
        color: "#0F766E",
        textAlign: "left",
        margin: 0
      }
    }, "Select ", stepLabels[step]), chip && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 4
      }
    }, chip === "Standard" ? "Standard chip" : chip + " chip", blade ? ` · ${blade}` : "", cxPicker?.overBlade ? ` · ${cxPicker.overBlade}` : "")), step === "chip" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, CX_CHIPS.map(ch => {
      const isTaken = takenChips.includes(ch); // Standard never taken
      return /*#__PURE__*/React.createElement("button", {
        key: ch,
        disabled: isTaken,
        onClick: () => setCxPicker({
          ...cxPicker,
          step: "blade",
          chip: ch
        }),
        style: {
          padding: "18px 20px",
          borderRadius: 12,
          border: `2px solid ${isTaken ? "var(--border)" : "#0F766E40"}`,
          background: isTaken ? "var(--surface3)" : "var(--surface2)",
          color: isTaken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 16,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: isTaken ? "not-allowed" : "pointer",
          textAlign: "left",
          opacity: isTaken ? 0.45 : 1
        }
      }, ch, ch === "Standard" && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-secondary)",
          display: "block",
          marginTop: 2
        }
      }, "Multiple allowed per deck"), isTaken && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          display: "block",
          marginTop: 2
        }
      }, "Already used"));
    })), step === "blade" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 10,
        background: "#0D948818",
        borderRadius: 10,
        padding: "8px 10px 6px",
        border: "1px solid #0D948830"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "#0D9488",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 6
      }
    }, "\u2605 Most Popular"), (() => {
      // Extract CX blade names already used in other slots for this player
      const blastTaken = usedCxParts.blades.includes("Blast");
      return /*#__PURE__*/React.createElement("button", {
        disabled: blastTaken,
        onClick: () => !blastTaken && setCxPicker({
          ...cxPicker,
          step: "assist",
          blade: "Blast"
        }),
        style: {
          width: "100%",
          padding: "12px",
          borderRadius: 9,
          border: "2px solid #0D9488",
          background: blastTaken ? "var(--surface3)" : "#0D948822",
          color: blastTaken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: blastTaken ? "not-allowed" : "pointer",
          opacity: blastTaken ? 0.45 : 1
        }
      }, "Blast", blastTaken ? " — IN USE" : "");
    })(), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        marginTop: 6
      }
    }, ["Heavy", "Wheel"].map(assist => {
      const finalName = chip === "Standard" ? `Blast ${assist}` : `${chip} Blast ${assist}`;
      const blastTaken = usedCxParts.blades.includes("Blast");
      const assistTaken = usedCxParts.assists.includes(assist);
      const anyTaken = blastTaken || assistTaken;
      return /*#__PURE__*/React.createElement("button", {
        key: assist,
        disabled: anyTaken,
        onClick: () => {
          if (anyTaken) return;
          const nd = [...deck];
          nd[slot] = {
            ...nd[slot],
            blade: finalName
          };
          setDeck(nd);
          setCxPicker(null);
          if (returnToReview) {
            setPicker(null);
            setDeckReview(true);
            return;
          }
          openPicker({
            who,
            slot,
            cat: "ratchet"
          });
        },
        style: {
          padding: "8px 4px",
          borderRadius: 8,
          border: `2px solid ${anyTaken ? "var(--border)" : "#0D948860"}`,
          background: anyTaken ? "var(--surface3)" : "#0D948818",
          color: anyTaken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: anyTaken ? "not-allowed" : "pointer",
          opacity: anyTaken ? 0.45 : 1
        }
      }, "Blast ", assist, anyTaken && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 7,
          color: "var(--text-faint)"
        }
      }, "IN USE"));
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, _deckCxBlades.filter(b => b !== "Blast").map(b => {
      // Grey out if this CX blade name appears in any other combo slot
      const bladeTaken = usedCxParts.blades.includes(b);
      return /*#__PURE__*/React.createElement("button", {
        key: b,
        disabled: bladeTaken,
        onClick: () => !bladeTaken && setCxPicker({
          ...cxPicker,
          step: "assist",
          blade: b
        }),
        style: {
          padding: "10px 4px",
          borderRadius: 9,
          border: `2px solid ${bladeTaken ? "var(--border)" : "var(--border2)"}`,
          background: bladeTaken ? "var(--surface3)" : "var(--surface2)",
          color: bladeTaken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: bladeTaken ? "not-allowed" : "pointer",
          minHeight: 40,
          textAlign: "center",
          opacity: bladeTaken ? 0.45 : 1
        }
      }, b, bladeTaken && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 7,
          fontWeight: 700,
          color: "var(--text-faint)",
          marginTop: 2
        }
      }, "IN USE"));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        borderTop: "2px dashed #E2E8F0",
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "#7C3AED",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 6
      }
    }, "CXE Blades"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: 8
      }
    }, _deckCxeBlades.map(b => {
      const bladeTaken = usedCxParts.blades.includes(b);
      return /*#__PURE__*/React.createElement("button", {
        key: b,
        disabled: bladeTaken,
        onClick: () => !bladeTaken && setCxPicker({
          ...cxPicker,
          step: "over_blade",
          blade: b,
          isCXE: true
        }),
        style: {
          padding: "12px 4px",
          borderRadius: 9,
          border: `2px solid ${bladeTaken ? "var(--border)" : "#7C3AED60"}`,
          background: bladeTaken ? "var(--surface3)" : "#7C3AED15",
          color: bladeTaken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: bladeTaken ? "not-allowed" : "pointer",
          minHeight: 44,
          textAlign: "center",
          opacity: bladeTaken ? 0.45 : 1
        }
      }, b, bladeTaken && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 7,
          fontWeight: 700,
          color: "var(--text-faint)",
          marginTop: 2
        }
      }, "IN USE"));
    })))), step === "over_blade" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 12
      }
    }, "Selected CXE Blade: ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "#7C3AED"
      }
    }, blade)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: 10
      }
    }, _deckCxeOver.map(ob => {
      const taken = usedCxParts.overBlades.includes(ob);
      return /*#__PURE__*/React.createElement("button", {
        key: ob,
        disabled: taken,
        onClick: () => !taken && setCxPicker({
          ...cxPicker,
          step: "assist",
          overBlade: ob
        }),
        style: {
          padding: "16px 4px",
          borderRadius: 12,
          border: `2px solid ${taken ? "var(--border)" : "#7C3AED60"}`,
          background: taken ? "var(--surface3)" : "#7C3AED15",
          color: taken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: taken ? "not-allowed" : "pointer",
          minHeight: 56,
          textAlign: "center",
          opacity: taken ? 0.45 : 1
        }
      }, ob, taken && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 7,
          fontWeight: 700,
          color: "var(--text-faint)",
          marginTop: 2
        }
      }, "IN USE"));
    }))), step === "assist" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 10,
        background: "#0F766E0D",
        borderRadius: 10,
        padding: "8px 10px 6px",
        border: "1px solid #0F766E30"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "#0F766E",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 6
      }
    }, "\u2605 Top 5"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, CX_ASSIST_TOP5.map(a => {
      const finalName = buildFinalName(a);
      const taken = usedCxParts.assists.includes(a);
      return /*#__PURE__*/React.createElement("button", {
        key: a,
        disabled: taken,
        onClick: () => !taken && advance(finalName),
        style: {
          padding: "10px 4px",
          borderRadius: 9,
          border: `2px solid ${taken ? "var(--border)" : "#0F766E"}`,
          background: taken ? "var(--surface3)" : "#0F766E18",
          color: taken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: taken ? "not-allowed" : "pointer",
          minHeight: 40,
          textAlign: "center",
          position: "relative",
          opacity: taken ? 0.45 : 1
        }
      }, a, taken && /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          bottom: 2,
          fontSize: 7,
          fontWeight: 700,
          color: "var(--text-faint)",
          letterSpacing: 0.3
        }
      }, "IN USE"));
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, _deckAssists.filter(a => !CX_ASSIST_TOP5.includes(a)).map(a => {
      const finalName = buildFinalName(a);
      const taken = usedCxParts.assists.includes(a);
      return /*#__PURE__*/React.createElement("button", {
        key: a,
        disabled: taken,
        onClick: () => !taken && advance(finalName),
        style: {
          padding: "10px 4px",
          borderRadius: 9,
          border: `2px solid ${taken ? "var(--border)" : "var(--border2)"}`,
          background: taken ? "var(--surface3)" : "var(--surface2)",
          color: taken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: taken ? "not-allowed" : "pointer",
          minHeight: 40,
          textAlign: "center",
          position: "relative",
          opacity: taken ? 0.45 : 1
        }
      }, a, taken && /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          bottom: 2,
          fontSize: 7,
          fontWeight: 700,
          color: "var(--text-faint)",
          letterSpacing: 0.3
        }
      }, "IN USE"));
    }))));
  }
  if (picker) {
    const {
      who,
      slot,
      cat
    } = picker;
    // Skip ratchet step for blades that use none (e.g. Bullet Griffon)
    if (cat === "ratchet") {
      const currentDeck = who === 1 ? d1 : d2;
      if (NO_RATCHET_BLADES.includes(currentDeck[slot]?.blade)) {
        const nd = [...currentDeck];
        nd[slot] = {
          ...nd[slot],
          ratchet: null
        };
        if (who === 1) setD1(nd);else setD2(nd);
        openPicker({
          who,
          slot,
          cat: "bit",
          returnToReview: picker.returnToReview
        });
        return null;
      }
    }
    const list = parts[cat + "s"];
    const cc = {
      blade: "#EA580C",
      ratchet: "#1D4ED8",
      bit: "#15803D"
    }[cat];
    const deck = who === 1 ? d1 : d2;
    const setDeck = who === 1 ? setD1 : setD2;
    const current = deck[slot][cat];
    const takenByOtherSlots = deck.map((c, i) => i !== slot ? c[cat] : null).filter(Boolean);
    const top10 = TOP10[cat + "s"] || [];
    const allCxNames = [..._deckCxBlades, ..._deckCxeBlades, ..._deckAssists, ..._deckCxeOver];
    // Only filter CX names for blades; bits/ratchets with matching names should still show
    const rest = list.filter(n => !top10.includes(n) && !CROSSOVER_BLADES.includes(n) && (cat !== "blade" || !allCxNames.includes(n)));
    const searchLower = pickerSearch.toLowerCase();
    const filteredRest = pickerSearch ? rest.filter(n => n.toLowerCase().includes(searchLower)) : rest;
    const PartBtn = ({
      name,
      isTop
    }) => {
      const sel = current === name;
      const taken = takenByOtherSlots.includes(name) && !sel;
      // Determine button accent color
      const bladeColor = cat === "blade" && isTop ? BLADE_COLORS[name] : null;
      const accent = bladeColor || (isTop ? cc : null);
      // Non-top, non-selected: black text/border. Top 10: individual accent color.
      const idleColor = "var(--text-primary)";
      const idleBorder = accent ? `2px solid ${accent}` : "2px solid #CBD5E1";
      const idleBg = accent ? accent + "18" : "var(--surface2)";
      return /*#__PURE__*/React.createElement("button", {
        disabled: taken,
        onClick: () => {
          if (taken) return;
          const nd = [...deck];
          // Hard rule: NO_RATCHET_BLADES (e.g. Bullet Griffon) cannot physically hold a ratchet.
          // Null it out in the same state update so it never persists in the deck.
          const noRatchet = cat === "blade" && NO_RATCHET_BLADES.includes(name);
          nd[slot] = {
            ...nd[slot],
            [cat]: name,
            ...(noRatchet ? {
              ratchet: null
            } : {})
          };
          setDeck(nd);
          // Build fresh deck refs to pass to advanceDeckPicker (state updates are async)
          const freshD1 = who === 1 ? nd : d1;
          const freshD2 = who === 2 ? nd : d2;
          advanceDeckPicker(who, slot, cat, freshD1, freshD2, picker.returnToReview, name, picker.qcEdit);
        },
        style: {
          padding: "8px 4px",
          borderRadius: 9,
          border: sel ? `2px solid ${accent || cc}` : taken ? "2px solid #E2E8F0" : idleBorder,
          background: sel ? accent || cc : taken ? "var(--surface3)" : idleBg,
          color: sel ? "#fff" : taken ? "#CBD5E1" : idleColor,
          cursor: taken ? "not-allowed" : "pointer",
          opacity: taken ? 0.45 : 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          lineHeight: 1.1,
          position: "relative",
          width: "100%",
          fontFamily: "'Outfit',sans-serif"
        }
      }, sel && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          marginBottom: 1
        }
      }, IC.check), /*#__PURE__*/React.createElement(PartLabel, {
        name: name,
        size: splitPartName(name, cat !== "bit").length > 1 ? 12 : 13,
        keepDash: cat !== "bit"
      }), taken && /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          bottom: 2,
          fontSize: 7,
          fontWeight: 700,
          color: "var(--text-faint)",
          letterSpacing: 0.3
        }
      }, "IN USE"));
    };
    const comboLabel = ["First", "Second", "Third"][slot];
    const playerName = who === 1 ? p1 : p2;
    const pColor = who === 1 ? "#2563EB" : "#DC2626";
    const catLabels = {
      blade: "Blade",
      ratchet: "Ratchet",
      bit: "Bit"
    };
    // Progress: 0-5 for P1 combos, 6-11 for P2
    const stepNum = (who === 1 ? 0 : 9) + slot * 3 + ["blade", "ratchet", "bit"].indexOf(cat);
    const totalSteps = 18;
    const pct = Math.round(stepNum / totalSteps * 100);

    // Ratchet and bit pickers use a viewport-filling fixed layout
    if (cat === "ratchet" || cat === "bit") {
      const COLS = 5;
      const restItems = list.filter(n => !top10.includes(n));
      // When searching, show all matching items in one flat grid
      const searchItems = pickerSearch ? list.filter(n => n.toLowerCase().includes(pickerSearch.toLowerCase())) : null;
      // Rows helper
      const toRows = items => {
        const r = [];
        for (let i = 0; i < items.length; i += COLS) r.push(items.slice(i, i + COLS));
        return r;
      };
      const top10Rows = toRows(top10);
      const restRows = toRows(restItems);
      const searchRows = searchItems ? toRows(searchItems) : null;
      // Total rows determines per-row height in the body
      const totalRows = searchItems ? searchRows.length : top10Rows.length + 1 /*search*/ + restRows.length;
      const PartRow = ({
        row,
        isTopGroup
      }) => /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          gap: 4
        }
      }, row.map(name => {
        const sel = current === name;
        const taken = takenByOtherSlots.includes(name) && !sel;
        const accent = isTopGroup ? cc : null;
        return /*#__PURE__*/React.createElement("button", {
          key: name,
          disabled: taken,
          onClick: () => {
            if (taken) return;
            const nd = [...deck];
            nd[slot] = {
              ...nd[slot],
              [cat]: name
            };
            setDeck(nd);
            const freshD1 = who === 1 ? nd : d1;
            const freshD2 = who === 2 ? nd : d2;
            advanceDeckPicker(who, slot, cat, freshD1, freshD2, picker.returnToReview, name, picker.qcEdit);
          },
          style: {
            flex: 1,
            minWidth: 0,
            borderRadius: 9,
            border: sel ? `2px solid ${cc}` : taken ? "2px solid var(--border)" : isTopGroup ? `2px solid ${cc}50` : "2px solid var(--border2)",
            background: sel ? cc : taken ? "var(--surface2)" : isTopGroup ? cc + "14" : "var(--surface2)",
            color: sel ? "#fff" : taken ? "var(--text-disabled)" : "var(--text-primary)",
            cursor: taken ? "not-allowed" : "pointer",
            opacity: taken ? 0.45 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            lineHeight: 1.05,
            position: "relative",
            fontFamily: "'Outfit',sans-serif",
            padding: "2px",
            fontSize: "clamp(9px, 1.8vh, 15px)",
            fontWeight: 800
          }
        }, sel && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: "0.65em",
            marginBottom: "0.1em"
          }
        }, IC.check), /*#__PURE__*/React.createElement(PartLabel, {
          name: name,
          size: null,
          keepDash: cat !== "bit"
        }), taken && /*#__PURE__*/React.createElement("span", {
          style: {
            position: "absolute",
            bottom: 2,
            fontSize: "0.55em",
            fontWeight: 700,
            color: "var(--text-faint)",
            letterSpacing: 0.3
          }
        }, "IN USE"));
      }), row.length < COLS && Array.from({
        length: COLS - row.length
      }).map((_, ei) => /*#__PURE__*/React.createElement("div", {
        key: ei,
        style: {
          flex: 1
        }
      })));

      // Single stable layout: header fixed, search bar always visible,
      // grid below always scrollable. No branch switch on search so the
      // input never remounts and the keyboard never dismisses.
      const displayRows = searchItems ? searchRows : null;
      const ROW_H = 52; // fixed px height per button row — never changes

      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-solid)",
          boxSizing: "border-box"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          flexShrink: 0,
          padding: "6px 14px 4px",
          background: "var(--bg-solid)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4
        }
      }, /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.back,
          marginBottom: 0
        },
        onClick: goBack
      }, IC.back, " Back"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: cc
        }
      }, catLabels[cat]), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)"
        }
      }, playerName, " \xB7 ", comboLabel), !picker?.returnToReview && pickerHistory.length > 0 && /*#__PURE__*/React.createElement("button", {
        onClick: undoPicker,
        style: {
          background: "none",
          border: "1px solid var(--border2)",
          borderRadius: 7,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4
        }
      }, IC.undo))), /*#__PURE__*/React.createElement("div", {
        style: {
          height: 3,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          height: "100%",
          width: `${pct}%`,
          background: pColor,
          borderRadius: 2,
          transition: "width 0.2s"
        }
      }))), !pickerSearch && /*#__PURE__*/React.createElement("div", {
        style: {
          flexShrink: 0,
          background: cc + "0D",
          borderRadius: 10,
          border: `1px solid ${cc}30`,
          padding: "4px 6px",
          margin: "4px 10px 0",
          display: "flex",
          flexDirection: "column",
          gap: 4
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 8,
          fontWeight: 700,
          color: cc,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          flexShrink: 0,
          margin: "0 0 2px 2px"
        }
      }, "\u2605 Top 15"), top10Rows.map((row, ri) => /*#__PURE__*/React.createElement("div", {
        key: ri,
        style: {
          height: ROW_H,
          display: "flex",
          gap: 4
        }
      }, row.map(name => {
        const sel = current === name;
        const taken = takenByOtherSlots.includes(name) && !sel;
        return /*#__PURE__*/React.createElement("button", {
          key: name,
          disabled: taken,
          onClick: () => {
            if (taken) return;
            const nd = [...deck];
            nd[slot] = {
              ...nd[slot],
              [cat]: name
            };
            setDeck(nd);
            const freshD1 = who === 1 ? nd : d1;
            const freshD2 = who === 2 ? nd : d2;
            advanceDeckPicker(who, slot, cat, freshD1, freshD2, picker.returnToReview, name, picker.qcEdit);
          },
          style: {
            flex: 1,
            minWidth: 0,
            height: "100%",
            borderRadius: 9,
            border: sel ? `2px solid ${cc}` : taken ? "2px solid var(--border)" : `2px solid ${cc}50`,
            background: sel ? cc : taken ? "var(--surface2)" : cc + "14",
            color: sel ? "#fff" : taken ? "var(--text-disabled)" : "var(--text-primary)",
            cursor: taken ? "not-allowed" : "pointer",
            opacity: taken ? 0.45 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            lineHeight: 1.05,
            position: "relative",
            fontFamily: "'Outfit',sans-serif",
            padding: "2px",
            fontSize: 13,
            fontWeight: 800
          }
        }, sel && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            marginBottom: 1
          }
        }, IC.check), /*#__PURE__*/React.createElement(PartLabel, {
          name: name,
          size: null,
          keepDash: cat !== "bit"
        }), taken && /*#__PURE__*/React.createElement("span", {
          style: {
            position: "absolute",
            bottom: 2,
            fontSize: 8,
            fontWeight: 700,
            color: "var(--text-faint)",
            letterSpacing: 0.3
          }
        }, "IN USE"));
      }), row.length < COLS && Array.from({
        length: COLS - row.length
      }).map((_, ei) => /*#__PURE__*/React.createElement("div", {
        key: ei,
        style: {
          flex: 1
        }
      }))))), /*#__PURE__*/React.createElement("div", {
        style: {
          flexShrink: 0,
          padding: "6px 10px 4px",
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("input", {
        style: {
          ...S.inp,
          width: "100%",
          paddingLeft: 28,
          fontSize: 12,
          borderColor: cc + "40"
        },
        placeholder: `Search ${catLabels[cat].toLowerCase()}s…`,
        value: pickerSearch,
        onChange: e => setPickerSearch(e.target.value),
        autoComplete: "off"
      }), /*#__PURE__*/React.createElement("svg", {
        style: {
          position: "absolute",
          left: 18,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: 0.35
        },
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: cc,
        strokeWidth: "2.5",
        strokeLinecap: "round"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "11",
        r: "8"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "21",
        y1: "21",
        x2: "16.65",
        y2: "16.65"
      })), pickerSearch && /*#__PURE__*/React.createElement("button", {
        onClick: () => setPickerSearch(""),
        style: {
          position: "absolute",
          right: 18,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          color: "#94A3B8",
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1
        }
      }, "\u2715")), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          overflowY: "auto",
          padding: "0 10px 8px"
        }
      }, pickerSearch && searchItems && searchItems.length === 0 && /*#__PURE__*/React.createElement("p", {
        style: {
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
          padding: "20px 0"
        }
      }, "No matches for \"", pickerSearch, "\""), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingTop: 4
        }
      }, (displayRows || restRows).map((row, ri) => /*#__PURE__*/React.createElement("div", {
        key: ri,
        style: {
          height: ROW_H,
          display: "flex",
          gap: 4
        }
      }, row.map(name => {
        const sel = current === name;
        const taken = takenByOtherSlots.includes(name) && !sel;
        const isTop = !pickerSearch && top10.includes(name);
        return /*#__PURE__*/React.createElement("button", {
          key: name,
          disabled: taken,
          onClick: () => {
            if (taken) return;
            const nd = [...deck];
            nd[slot] = {
              ...nd[slot],
              [cat]: name
            };
            setDeck(nd);
            const freshD1 = who === 1 ? nd : d1;
            const freshD2 = who === 2 ? nd : d2;
            advanceDeckPicker(who, slot, cat, freshD1, freshD2, picker.returnToReview, name, picker.qcEdit);
          },
          style: {
            flex: 1,
            minWidth: 0,
            height: "100%",
            borderRadius: 9,
            border: sel ? `2px solid ${cc}` : taken ? "2px solid var(--border)" : "2px solid var(--border2)",
            background: sel ? cc : taken ? "var(--surface2)" : "var(--surface2)",
            color: sel ? "#fff" : taken ? "var(--text-disabled)" : "var(--text-primary)",
            cursor: taken ? "not-allowed" : "pointer",
            opacity: taken ? 0.45 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            lineHeight: 1.05,
            position: "relative",
            fontFamily: "'Outfit',sans-serif",
            padding: "2px",
            fontSize: 13,
            fontWeight: 800
          }
        }, sel && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            marginBottom: 1
          }
        }, IC.check), /*#__PURE__*/React.createElement(PartLabel, {
          name: name,
          size: null,
          keepDash: cat !== "bit"
        }), taken && /*#__PURE__*/React.createElement("span", {
          style: {
            position: "absolute",
            bottom: 2,
            fontSize: 8,
            fontWeight: 700,
            color: "var(--text-faint)",
            letterSpacing: 0.3
          }
        }, "IN USE"));
      }), row.length < COLS && Array.from({
        length: COLS - row.length
      }).map((_, ei) => /*#__PURE__*/React.createElement("div", {
        key: ei,
        style: {
          flex: 1
        }
      })))))));
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "picker-page",
      style: S.page
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 0
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: S.back,
      onClick: goBack
    }, IC.back, " Back"), !picker?.returnToReview && pickerHistory.length > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: undoPicker,
      style: {
        background: "none",
        border: "1px solid var(--border2)",
        borderRadius: 8,
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-muted)",
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, IC.undo, " Undo")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 4,
        background: "#E2E8F0",
        borderRadius: 2,
        marginBottom: 14,
        overflow: "hidden",
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: `${pct}%`,
        background: pColor,
        borderRadius: 2,
        transition: "width 0.2s"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: pColor,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 2
      }
    }, playerName, " \u2014 ", comboLabel, " Combo"), /*#__PURE__*/React.createElement("h1", {
      style: {
        ...S.title,
        color: cc,
        textAlign: "left",
        margin: 0
      }
    }, picker?.editingPart ? "Select New" : "Select", " ", catLabels[cat])), cat === "blade" && (() => {
      const playerName = who === 1 ? p1 : p2;
      const prevCombos = (workerCombos[playerName] || []).map(normalizeCombo).filter(c => comboReady(c));
      if (!prevCombos.length) return null;
      const clearCombos = () => {
        setWorkerCombos(prev => {
          const n = {
            ...prev
          };
          delete n[playerName];
          workerCombosRef.current = n;
          return n;
        });
        // Push empty array to the tournament registry to clear this player's entry
        if (challongeSlug) pushCombosForTournament(challongeSlug, playerName, []);
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 9,
          fontWeight: 700,
          color: "#7C3AED",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          margin: 0
        }
      }, "\uD83D\uDD50 Previous Combos ", /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 400,
          opacity: 0.7,
          letterSpacing: 0
        }
      }, "\xB7 hold to edit one part")), /*#__PURE__*/React.createElement("button", {
        onClick: clearCombos,
        style: {
          background: "none",
          border: "1px solid #EF444450",
          borderRadius: 6,
          padding: "2px 8px",
          fontSize: 9,
          fontWeight: 700,
          color: "#EF4444",
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          letterSpacing: 0.3
        }
      }, "Clear Previous Combos")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6
        }
      }, prevCombos.map((c, ci) => {
        const bTaken = takenByOtherSlots.includes(c.blade);
        const rTaken = c.ratchet ? (who === 1 ? d1 : d2).map((dc, i) => i !== slot ? dc.ratchet : null).filter(Boolean).includes(c.ratchet) : false;
        const bitTaken = (who === 1 ? d1 : d2).map((dc, i) => i !== slot ? dc.bit : null).filter(Boolean).includes(c.bit);
        const anyTaken = bTaken || rTaken || bitTaken;
        const bladeColor = BLADE_COLORS[c.blade] || "#64748B";
        const isMenuOpen = pcEditMenu?.ci === ci;
        let pcLpTimer = null;
        const startPcLongPress = () => {
          if (anyTaken) return;
          pcLpTimer = setTimeout(() => {
            setPcEditMenu({
              ci,
              combo: c
            });
            pcLpTimer = null;
          }, 300);
        };
        const cancelPcLongPress = () => {
          if (pcLpTimer) {
            clearTimeout(pcLpTimer);
            pcLpTimer = null;
          }
        };
        const applyAndEditPrevPart = partCat => {
          setPcEditMenu(null);
          const nd = who === 1 ? [...d1] : [...d2];
          nd[slot] = {
            blade: c.blade,
            ratchet: c.ratchet,
            bit: c.bit
          };
          if (who === 1) setD1(nd);else setD2(nd);
          const wasReview = picker?.returnToReview || false;
          openPicker({
            who,
            slot,
            cat: partCat,
            returnToReview: wasReview,
            qcEdit: true,
            editingPart: true
          });
        };
        return /*#__PURE__*/React.createElement("div", {
          key: ci,
          style: {
            position: "relative"
          }
        }, /*#__PURE__*/React.createElement("button", {
          className: "no-select",
          disabled: anyTaken,
          onClick: () => {
            if (anyTaken || isMenuOpen) return;
            const nd = who === 1 ? [...d1] : [...d2];
            nd[slot] = {
              blade: c.blade,
              ratchet: c.ratchet,
              bit: c.bit
            };
            if (who === 1) setD1(nd);else setD2(nd);
            const freshD1 = who === 1 ? nd : d1;
            const freshD2 = who === 2 ? nd : d2;
            advanceDeckPicker(who, slot, "bit", freshD1, freshD2, picker?.returnToReview, c.bit, false);
          },
          onMouseDown: startPcLongPress,
          onMouseUp: cancelPcLongPress,
          onMouseLeave: cancelPcLongPress,
          onTouchStart: e => {
            e.preventDefault();
            startPcLongPress();
          },
          onTouchEnd: cancelPcLongPress,
          onTouchCancel: cancelPcLongPress,
          onContextMenu: e => e.preventDefault(),
          style: {
            width: "100%",
            padding: "8px 4px",
            borderRadius: isMenuOpen ? "9px 9px 0 0" : 9,
            border: `2px solid ${isMenuOpen ? bladeColor : anyTaken ? "var(--border)" : bladeColor + "50"}`,
            borderBottom: isMenuOpen ? `2px solid ${bladeColor}` : undefined,
            background: isMenuOpen ? bladeColor + "22" : anyTaken ? "var(--surface3)" : bladeColor + "10",
            color: anyTaken ? "var(--text-disabled)" : "var(--text-primary)",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Outfit',sans-serif",
            cursor: anyTaken ? "not-allowed" : "pointer",
            textAlign: "center",
            lineHeight: 1.3,
            opacity: anyTaken ? 0.4 : 1,
            minHeight: 56,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            touchAction: "none"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 13,
            fontWeight: 800
          }
        }, c.blade), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            opacity: 0.65
          }
        }, c.ratchet ? `${c.ratchet} · ${c.bit}` : c.bit), anyTaken && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            color: "var(--text-faint)"
          }
        }, "IN USE"), isMenuOpen && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 8,
            color: bladeColor,
            marginTop: 1,
            fontWeight: 800
          }
        }, "EDITING \u25BE")), isMenuOpen && /*#__PURE__*/React.createElement("div", {
          style: {
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            border: `2px solid ${bladeColor}`,
            borderTop: "none",
            borderRadius: "0 0 9px 9px",
            background: "var(--surface)",
            overflow: "hidden",
            boxShadow: `0 6px 20px ${bladeColor}30`
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 8px",
            background: bladeColor + "18",
            borderBottom: `1px solid ${bladeColor}30`
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 8,
            fontWeight: 700,
            color: bladeColor,
            textTransform: "uppercase",
            letterSpacing: 0.5
          }
        }, "Edit one part:"), /*#__PURE__*/React.createElement("button", {
          onClick: e => {
            e.stopPropagation();
            setPcEditMenu(null);
          },
          style: {
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-faint)",
            fontSize: 12,
            lineHeight: 1,
            padding: "0 2px"
          }
        }, "\u2715")), /*#__PURE__*/React.createElement("button", {
          onClick: () => applyAndEditPrevPart("blade"),
          style: {
            width: "100%",
            padding: "9px 10px",
            border: "none",
            borderBottom: `1px solid ${bladeColor}20`,
            background: "none",
            cursor: "pointer",
            textAlign: "center",
            fontFamily: "'Outfit',sans-serif"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 800,
            color: "#EA580C",
            textTransform: "uppercase",
            letterSpacing: 0.5
          }
        }, "Blade")), c.ratchet && /*#__PURE__*/React.createElement("button", {
          onClick: () => applyAndEditPrevPart("ratchet"),
          style: {
            width: "100%",
            padding: "9px 10px",
            border: "none",
            borderBottom: `1px solid ${bladeColor}20`,
            background: "none",
            cursor: "pointer",
            textAlign: "center",
            fontFamily: "'Outfit',sans-serif"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 800,
            color: "#1D4ED8",
            textTransform: "uppercase",
            letterSpacing: 0.5
          }
        }, "Ratchet")), /*#__PURE__*/React.createElement("button", {
          onClick: () => applyAndEditPrevPart("bit"),
          style: {
            width: "100%",
            padding: "9px 10px",
            border: "none",
            background: "none",
            cursor: "pointer",
            textAlign: "center",
            fontFamily: "'Outfit',sans-serif"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 800,
            color: "#15803D",
            textTransform: "uppercase",
            letterSpacing: 0.5
          }
        }, "Bit"))));
      })), pcEditMenu && /*#__PURE__*/React.createElement("div", {
        onClick: () => setPcEditMenu(null),
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 40
        }
      }));
    })(), cat === "blade" && !pickerSearch && !picker?.editingPart && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: cc,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        margin: 0
      }
    }, "\u26A1 Quick Combos"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 8,
        color: "var(--text-faint)",
        margin: 0,
        fontStyle: "italic"
      }
    }, "Hold to edit one part")), /*#__PURE__*/React.createElement("div", {
      className: "no-select",
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gridAutoRows: "1fr",
        gap: 6
      }
    }, QUICK_COMBOS.map((qc, qi) => {
      const bTaken = takenByOtherSlots.includes(qc.blade);
      const rTaken = qc.ratchet ? (who === 1 ? d1 : d2).map((c, i) => i !== slot ? c.ratchet : null).filter(Boolean).includes(qc.ratchet) : false;
      const bitTaken = (who === 1 ? d1 : d2).map((c, i) => i !== slot ? c.bit : null).filter(Boolean).includes(qc.bit);
      const anyTaken = bTaken || rTaken || bitTaken;
      const bladeColor = BLADE_COLORS[qc.blade] || cc;
      const isMenuOpen = qcEditMenu?.qi === qi;

      // Long-press timer ref scoped to this item
      let lpTimer = null;
      const startLongPress = () => {
        if (anyTaken) return;
        lpTimer = setTimeout(() => {
          setQcEditMenu({
            qi,
            qc
          });
          lpTimer = null;
        }, 300);
      };
      const cancelLongPress = () => {
        if (lpTimer) {
          clearTimeout(lpTimer);
          lpTimer = null;
        }
      };

      // Apply the whole combo to deck state, then open the picker for just one part.
      // qcEdit:true tells advanceDeckPicker to skip the remaining parts of this combo
      // (since the other two are already locked in) and advance to the next slot/player.
      // editingPart:true tells the blade screen to hide quick combos and change the title.
      const applyAndEditPart = partCat => {
        setQcEditMenu(null);
        const nd = who === 1 ? [...d1] : [...d2];
        nd[slot] = {
          blade: qc.blade,
          ratchet: qc.ratchet,
          bit: qc.bit
        };
        if (who === 1) setD1(nd);else setD2(nd);
        // Honor the original flow mode: linear stays linear, review-mode stays review-mode
        const wasReview = picker?.returnToReview || false;
        openPicker({
          who,
          slot,
          cat: partCat,
          returnToReview: wasReview,
          qcEdit: true,
          editingPart: true
        });
      };
      return /*#__PURE__*/React.createElement("div", {
        key: qi,
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "no-select",
        disabled: anyTaken,
        onClick: () => {
          if (anyTaken || isMenuOpen) return;
          const nd = who === 1 ? [...d1] : [...d2];
          nd[slot] = {
            blade: qc.blade,
            ratchet: qc.ratchet,
            bit: qc.bit
          };
          if (who === 1) setD1(nd);else setD2(nd);
          const freshD1 = who === 1 ? nd : d1;
          const freshD2 = who === 2 ? nd : d2;
          advanceDeckPicker(who, slot, "bit", freshD1, freshD2, picker?.returnToReview, qc.bit, false);
        },
        onMouseDown: startLongPress,
        onMouseUp: cancelLongPress,
        onMouseLeave: cancelLongPress,
        onTouchStart: e => {
          e.preventDefault();
          startLongPress();
        },
        onTouchEnd: cancelLongPress,
        onTouchCancel: cancelLongPress,
        onContextMenu: e => e.preventDefault(),
        style: {
          width: "100%",
          padding: "8px 4px",
          borderRadius: isMenuOpen ? "9px 9px 0 0" : 9,
          border: `2px solid ${isMenuOpen ? bladeColor : anyTaken ? "var(--border)" : bladeColor + "60"}`,
          borderBottom: isMenuOpen ? `2px solid ${bladeColor}` : undefined,
          background: isMenuOpen ? bladeColor + "22" : anyTaken ? "var(--surface3)" : bladeColor + "12",
          color: anyTaken ? "var(--text-disabled)" : "var(--text-primary)",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: anyTaken ? "not-allowed" : "pointer",
          textAlign: "center",
          lineHeight: 1.3,
          opacity: anyTaken ? 0.4 : 1,
          minHeight: 56,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "none"
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "qc-blade",
        "data-label": qc.blade,
        "aria-label": qc.blade
      }), /*#__PURE__*/React.createElement("div", {
        className: "qc-parts",
        "data-label": qc.ratchet ? `${qc.ratchet} · ${qc.bit}` : qc.bit,
        "aria-label": qc.ratchet ? `${qc.ratchet} · ${qc.bit}` : qc.bit
      }), anyTaken && /*#__PURE__*/React.createElement("div", {
        "aria-hidden": "true",
        style: {
          fontSize: 9,
          color: "var(--text-faint)",
          userSelect: "none",
          WebkitUserSelect: "none"
        }
      }, "IN USE"), isMenuOpen && /*#__PURE__*/React.createElement("div", {
        "aria-hidden": "true",
        style: {
          fontSize: 8,
          color: bladeColor,
          marginTop: 1,
          fontWeight: 800,
          userSelect: "none",
          WebkitUserSelect: "none"
        }
      }, "EDITING \u25BE")), isMenuOpen && /*#__PURE__*/React.createElement("div", {
        style: {
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          zIndex: 50,
          border: `2px solid ${bladeColor}`,
          borderTop: "none",
          borderRadius: "0 0 9px 9px",
          background: "var(--surface)",
          overflow: "hidden",
          boxShadow: `0 6px 20px ${bladeColor}30`
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px",
          background: bladeColor + "18",
          borderBottom: `1px solid ${bladeColor}30`
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 8,
          fontWeight: 700,
          color: bladeColor,
          textTransform: "uppercase",
          letterSpacing: 0.5
        }
      }, "Edit one part:"), /*#__PURE__*/React.createElement("button", {
        onClick: e => {
          e.stopPropagation();
          setQcEditMenu(null);
        },
        style: {
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-faint)",
          fontSize: 12,
          lineHeight: 1,
          padding: "0 2px"
        }
      }, "\u2715")), /*#__PURE__*/React.createElement("button", {
        onClick: () => applyAndEditPart("blade"),
        style: {
          width: "100%",
          padding: "9px 10px",
          border: "none",
          borderBottom: `1px solid ${bladeColor}20`,
          background: "none",
          cursor: "pointer",
          textAlign: "center",
          fontFamily: "'Outfit',sans-serif"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 800,
          color: "#EA580C",
          textTransform: "uppercase",
          letterSpacing: 0.5
        }
      }, "Blade")), qc.ratchet && /*#__PURE__*/React.createElement("button", {
        onClick: () => applyAndEditPart("ratchet"),
        style: {
          width: "100%",
          padding: "9px 10px",
          border: "none",
          borderBottom: `1px solid ${bladeColor}20`,
          background: "none",
          cursor: "pointer",
          textAlign: "center",
          fontFamily: "'Outfit',sans-serif"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 800,
          color: "#1D4ED8",
          textTransform: "uppercase",
          letterSpacing: 0.5
        }
      }, "Ratchet")), /*#__PURE__*/React.createElement("button", {
        onClick: () => applyAndEditPart("bit"),
        style: {
          width: "100%",
          padding: "9px 10px",
          border: "none",
          background: "none",
          cursor: "pointer",
          textAlign: "center",
          fontFamily: "'Outfit',sans-serif"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 800,
          color: "#15803D",
          textTransform: "uppercase",
          letterSpacing: 0.5
        }
      }, "Bit"))));
    })), qcEditMenu && /*#__PURE__*/React.createElement("div", {
      onClick: () => setQcEditMenu(null),
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 40
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8,
        background: cc + "0D",
        borderRadius: 12,
        padding: "10px 10px 8px",
        border: `1px solid ${cc}30`
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: cc,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 8
      }
    }, "\u2605 Top 15"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, top10.map(name => /*#__PURE__*/React.createElement(PartBtn, {
      key: name,
      name: name,
      isTop: true
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 10,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("input", {
      style: {
        ...S.inp,
        width: "100%",
        paddingLeft: 32,
        borderColor: cc + "40"
      },
      placeholder: `Search ${cat}s...`,
      value: pickerSearch,
      onChange: e => setPickerSearch(e.target.value),
      autoComplete: "off"
    }), /*#__PURE__*/React.createElement("svg", {
      style: {
        position: "absolute",
        left: 10,
        top: "50%",
        transform: "translateY(-50%)",
        opacity: 0.35
      },
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: cc,
      strokeWidth: "2.5",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "8"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65"
    })), pickerSearch && /*#__PURE__*/React.createElement("button", {
      onClick: () => setPickerSearch(""),
      style: {
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        color: "#94A3B8",
        cursor: "pointer",
        fontSize: 14,
        lineHeight: 1
      }
    }, "\u2715")), cat === "blade" && /*#__PURE__*/React.createElement("button", {
      onClick: () => setCxPicker({
        step: "chip",
        who,
        slot,
        returnToReview: picker?.returnToReview || false
      }),
      style: {
        padding: "9px 14px",
        borderRadius: 10,
        border: "2px solid #0F766E",
        background: "#0F766E18",
        color: "#0F766E",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        flexShrink: 0,
        whiteSpace: "nowrap"
      }
    }, "CX")), filteredRest.length > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, filteredRest.map(name => /*#__PURE__*/React.createElement(PartBtn, {
      key: name,
      name: name
    }))) : pickerSearch ? /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.empty,
        marginTop: 8
      }
    }, "No matches for \"", pickerSearch, "\"") : null, cat === "blade" && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setCrossoverOpen(o => !o),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "10px 14px",
        borderRadius: 10,
        border: "2px solid #7C3AED40",
        background: crossoverOpen ? "#7C3AED" : "#7C3AED15",
        color: crossoverOpen ? "#fff" : "#7C3AED",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", null, "\uD83C\uDF10 Crossover Blades (", CROSSOVER_BLADES.length, ")"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        lineHeight: 1
      }
    }, crossoverOpen ? "▲" : "▼")), crossoverOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        padding: "10px",
        background: "#7C3AED15",
        borderRadius: 10,
        border: "1px solid #7C3AED30"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, CROSSOVER_BLADES.filter(n => !pickerSearch || n.toLowerCase().includes(pickerSearch.toLowerCase())).map(name => /*#__PURE__*/React.createElement(PartBtn, {
      key: name,
      name: name
    }))))));
  }
  if (phase === "pick") {
    // ── Shared tablet: who is judging this match? ──────────────────────────
    if (sharedJudges && config.tm && sharedJudgePicker) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...S.page,
          maxHeight: "100dvh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "32px 24px"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 1,
          margin: 0
        }
      }, "Shared Tablet"), /*#__PURE__*/React.createElement("h1", {
        style: {
          fontSize: 22,
          fontWeight: 900,
          color: "var(--text-primary)",
          margin: 0,
          textAlign: "center"
        }
      }, "Who is judging this match?"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          margin: "0 0 8px",
          textAlign: "center"
        }
      }, p1, " vs ", p2), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          width: "100%",
          maxWidth: 360
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setJudge(sharedJudges.judgeA);
          setSharedJudgePicker(false);
        },
        style: {
          padding: "24px 12px",
          borderRadius: 16,
          border: "2px solid var(--border2)",
          background: "var(--surface2)",
          cursor: "pointer",
          fontFamily: "'Outfit',sans-serif",
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 28,
          marginBottom: 6
        }
      }, "\u2696\uFE0F"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: "0 0 2px"
        }
      }, "Judge A"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          margin: 0
        }
      }, sharedJudges.judgeA)), /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          setJudge(sharedJudges.judgeB);
          setSharedJudgePicker(false);
        },
        style: {
          padding: "24px 12px",
          borderRadius: 16,
          border: "2px solid var(--border2)",
          background: "var(--surface2)",
          cursor: "pointer",
          fontFamily: "'Outfit',sans-serif",
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 28,
          marginBottom: 6
        }
      }, "\u2696\uFE0F"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: "0 0 2px"
        }
      }, "Judge B"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          margin: 0
        }
      }, sharedJudges.judgeB))));
    }
    const playersSelected = p1 && p2;
    const step = !p1 ? 1 : !p2 ? 2 : "done";
    const stepLabel = step === 1 ? "Select P1" : step === 2 ? "Select P2" : "Ready";
    const stepColor = step === 1 ? "#2563EB" : step === 2 ? "#DC2626" : "#15803D";
    const handleNameClick = name => {
      const tname = tn(name);
      const isP1 = tname === p1 || name === p1;
      const isP2 = tname === p2 || name === p2;
      // Always deselect if already assigned — never affects other roles
      if (isP1) {
        setP1(null);
        p1Ref.current = null;
        return;
      }
      if (isP2) {
        setP2(null);
        p2Ref.current = null;
        return;
      }

      // Unassigned name: fill first open slot p1 → p2
      if (!p1) {
        setP1(tname);
        p1Ref.current = tname;
        return;
      }
      if (!p2) {
        setP2(tname);
        p2Ref.current = tname;
        return;
      }
      // All slots full — do nothing
    };
    const getButtonStyle = name => {
      const tname = tn(name);
      const isP1 = tname === p1 || name === p1;
      const isP2 = tname === p2 || name === p2;
      const isJudge = config.tm && (name === judge || tname === judge);
      if (isP1) return {
        border: "2px solid #2563EB",
        background: "#2563EB",
        color: "#fff"
      };
      if (isP2) return {
        border: "2px solid #DC2626",
        background: "#DC2626",
        color: "#fff"
      };
      if (isJudge) return {
        border: "2px solid #B45309",
        background: "#F59E0B",
        color: "#fff"
      };
      return {
        border: "2px solid var(--border)",
        background: "var(--surface2)",
        color: "var(--text-primary)"
      };
    };
    const canProceed = p1 && p2 && (!config.tm || judge.trim());
    const hasChallonge = !!challongeSlug;

    // Mark a match as in progress on Challonge using the judge's OAuth token.
    // This attributes the action to the judge's account in the Challonge activity log,
    // and verifies they have admin permissions (non-admins will get a silent failure).
    const markMatchUnderway = async matchId => {
      if (!challongeSlug || !matchId) return;
      setUnderwayStatus("checking");
      try {
        const judgeToken = sessionStorage.getItem("ncblast-auth-token") || "";
        const judgeUser = sessionStorage.getItem("ncblast-auth-user") || "";
        const res = await fetch(`${OVERLAY_WORKER}/match/underway`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Token": judgeToken,
            "X-Auth-User": judgeUser
          },
          body: JSON.stringify({
            slug: challongeSlug,
            matchId
          }),
          signal: AbortSignal.timeout(4000)
        });
        const d = await res.json();
        if (d.ok) {
          setUnderwayStatus("ok");
          console.log("[BLAST] markMatchUnderway ok —", JSON.stringify(d));
        } else {
          setUnderwayStatus("error");
          console.warn("[BLAST] markMatchUnderway failed:", d.status, d.data);
        }
      } catch (e) {
        setUnderwayStatus("error");
        console.warn("[BLAST] markMatchUnderway exception:", e.message);
      }
    };

    // Select a pairing from an active Challonge match
    const selectActivePairing = match => {
      const idMap = challongeParticipants || {};
      const reverseMap = {};
      Object.entries(idMap).forEach(([name, id]) => {
        reverseMap[String(id)] = name;
      });
      const name1 = match.player1_name || reverseMap[String(match.player1_id)] || `ID:${match.player1_id}`;
      const name2 = match.player2_name || reverseMap[String(match.player2_id)] || `ID:${match.player2_id}`;
      setP1(tn(name1));
      p1Ref.current = tn(name1);
      setP2(tn(name2));
      p2Ref.current = tn(name2);
      setChallongeMatchId(match.id);
      // For group stage tournaments, winner_id must be player1_id/player2_id (the group player IDs),
      // NOT the real participant.id — Challonge validates winner_id against the match's player IDs directly.
      setChallongeP1ParticipantId(match.player1_id || null);
      setChallongeP2ParticipantId(match.player2_id || null);
      // Mark match as in progress on Challonge — verifies admin access and logs judge's name
      setUnderwayStatus(null);
      markMatchUnderway(match.id);
      // Shared tablet: ask which judge is handling this match
      if (sharedJudges && config.tm) {
        setJudge("");
        setSharedJudgePicker(true);
      }
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.page,
        maxHeight: "100dvh",
        overflowY: "auto"
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: S.back,
      onClick: goBack
    }, IC.back, " Back"), /*#__PURE__*/React.createElement("h1", {
      style: S.title
    }, "Select Match"), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface2)",
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 12,
        border: `2px solid ${stepColor}30`,
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: stepColor,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: stepColor
      }
    }, stepLabel), step !== 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginLeft: "auto"
      }
    }, p1 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#2563EB",
        fontWeight: 600
      }
    }, p1, " "), p1 && p2 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-muted)"
      }
    }, "vs "), p2 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#DC2626",
        fontWeight: 600
      }
    }, p2), config.tm && judge && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#B45309",
        fontWeight: 600
      }
    }, " \xB7 \u2696\uFE0F", judge))), handoffMethodPicker && sharedJudges && (() => {
      const otherJudge = judge === sharedJudges.judgeA ? sharedJudges.judgeB : sharedJudges.judgeA;
      const doSameDevice = () => {
        setHandoffMethodPicker(false);
        setJudge(otherJudge);
        setHandoffSameDeviceConfirm(otherJudge);
        setTimeout(() => setHandoffSameDeviceConfirm(null), 3000);
      };
      const doNewDevice = () => {
        setHandoffMethodPicker(false);
        startHandoff();
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.92)",
          zIndex: 500,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: "100%",
          maxWidth: 340,
          background: "var(--card)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          margin: "0 0 4px"
        }
      }, "Hand Off Match"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 18,
          fontWeight: 900,
          color: "var(--text-primary)",
          margin: "0 0 4px"
        }
      }, p1, " vs ", p2), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "var(--text-faint)",
          margin: 0
        }
      }, "Currently: ", /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text-secondary)"
        }
      }, judge || "–"))), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: doSameDevice,
        style: {
          width: "100%",
          padding: "16px 14px",
          borderRadius: 14,
          border: "2px solid var(--border2)",
          background: "var(--surface2)",
          cursor: "pointer",
          fontFamily: "'Outfit',sans-serif",
          textAlign: "left"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: "0 0 2px"
        }
      }, "\uD83D\uDC8A Same Device"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          margin: 0
        }
      }, "Hand off to ", /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text-secondary)"
        }
      }, otherJudge), " \u2014 continue on this tablet")), /*#__PURE__*/React.createElement("button", {
        onClick: doNewDevice,
        style: {
          width: "100%",
          padding: "16px 14px",
          borderRadius: 14,
          border: "2px solid var(--border2)",
          background: "var(--surface2)",
          cursor: "pointer",
          fontFamily: "'Outfit',sans-serif",
          textAlign: "left"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: "0 0 2px"
        }
      }, "\uD83D\uDCF2 New Device"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          margin: 0
        }
      }, "Generate a QR code for another judge's device"))), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "0 20px 20px"
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => setHandoffMethodPicker(false),
        style: {
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: "2px solid var(--border)",
          background: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "Cancel"))));
    })(), handoffSameDeviceConfirm && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 600,
        background: "#15803D",
        color: "#fff",
        borderRadius: 12,
        padding: "10px 20px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        textAlign: "center",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u2705"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 800
      }
    }, "Handed off to ", handoffSameDeviceConfirm)), scannerOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.96)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        fontWeight: 900,
        color: "#fff",
        marginBottom: 12
      }
    }, "\uD83D\uDCF7 Scan Handoff QR"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "#94A3B8",
        marginBottom: 16,
        textAlign: "center"
      }
    }, "Point your camera at the QR code on the other judge's screen."), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        width: 260,
        height: 260,
        borderRadius: 16,
        overflow: "hidden",
        background: "#000",
        border: "3px solid #1D4ED8",
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("video", {
      ref: scanVideoRef,
      autoPlay: true,
      playsInline: true,
      muted: true,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block"
      }
    }), /*#__PURE__*/React.createElement("canvas", {
      ref: scanCanvasRef,
      style: {
        display: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 8,
        left: 8,
        width: 28,
        height: 28,
        borderTop: "3px solid #60A5FA",
        borderLeft: "3px solid #60A5FA",
        pointerEvents: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderTop: "3px solid #60A5FA",
        borderRight: "3px solid #60A5FA",
        pointerEvents: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 8,
        left: 8,
        width: 28,
        height: 28,
        borderBottom: "3px solid #60A5FA",
        borderLeft: "3px solid #60A5FA",
        pointerEvents: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 8,
        right: 8,
        width: 28,
        height: 28,
        borderBottom: "3px solid #60A5FA",
        borderRight: "3px solid #60A5FA",
        pointerEvents: "none"
      }
    })), /*#__PURE__*/React.createElement("button", {
      onClick: stopScanner,
      style: {
        padding: "13px 32px",
        borderRadius: 12,
        border: "none",
        background: "rgba(255,255,255,0.1)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Cancel")), handoffPreview && (() => {
      const incomingJudge = (() => {
        try {
          return sessionStorage.getItem("ncblast-auth-user") || "";
        } catch (_) {
          return "";
        }
      })();
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.92)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          background: "var(--surface)",
          borderRadius: 20,
          padding: "24px 20px",
          maxWidth: 320,
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          border: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 16,
          fontWeight: 900,
          color: "var(--text-primary)",
          textAlign: "center",
          marginBottom: 4
        }
      }, "\uD83D\uDD00 Accept Handoff?"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-secondary)",
          textAlign: "center",
          marginBottom: 16
        }
      }, "Review the match before accepting."), /*#__PURE__*/React.createElement("div", {
        style: {
          background: "var(--surface2)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 10,
          border: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-primary)"
        }
      }, handoffPreview.p1), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: "#1D4ED8"
        }
      }, handoffPreview.pts ? handoffPreview.pts[0] : 0, " \u2013 ", handoffPreview.pts ? handoffPreview.pts[1] : 0), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text-primary)"
        }
      }, handoffPreview.p2)), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)"
        }
      }, /*#__PURE__*/React.createElement("span", null, "Sets: ", handoffPreview.sets ? handoffPreview.sets[0] : 0, " \u2013 ", handoffPreview.sets ? handoffPreview.sets[1] : 0), /*#__PURE__*/React.createElement("span", null, "Set ", handoffPreview.curSet || 1, " \xB7 Shuffle ", handoffPreview.shuf || 1))), /*#__PURE__*/React.createElement("div", {
        style: {
          background: incomingJudge ? "#1D4ED810" : "#F59E0B10",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 16,
          border: `1px solid ${incomingJudge ? "#1D4ED840" : "#F59E0B40"}`,
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 16
        }
      }, "\u2696\uFE0F"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          margin: "0 0 1px",
          textTransform: "uppercase",
          letterSpacing: 0.5
        }
      }, "Recording judge as"), incomingJudge ? /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: 0
        }
      }, incomingJudge) : /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "#F59E0B",
          margin: 0
        }
      }, "Not logged in \u2014 battles won't have a judge name"))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => setHandoffPreview(null),
        style: {
          flex: 1,
          padding: "13px 0",
          borderRadius: 12,
          border: "none",
          background: "var(--surface2)",
          color: "var(--text-secondary)",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "Cancel"), /*#__PURE__*/React.createElement("button", {
        onClick: () => acceptHandoff(handoffPreview),
        style: {
          flex: 2,
          padding: "13px 0",
          borderRadius: 12,
          border: "none",
          background: "#1D4ED8",
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "\u2713 Accept Match"))));
    })(), hasChallonge && !config.tm && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 0,
        marginBottom: 12,
        borderRadius: 10,
        overflow: "hidden",
        border: "2px solid var(--border)"
      }
    }, [["roster", "👥 Roster"], ["active", "⚡ Active Matches"]].map(([tab, label]) => /*#__PURE__*/React.createElement("button", {
      key: tab,
      type: "button",
      onClick: () => {
        setPickTab(tab);
        if (tab === "active") fetchActiveMatches();
      },
      style: {
        flex: 1,
        padding: "9px 0",
        border: "none",
        background: pickTab === tab ? "#1D4ED8" : "var(--surface)",
        color: pickTab === tab ? "#fff" : "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, label))), pickTab === "roster" && /*#__PURE__*/React.createElement("div", {
      style: S.card
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
        gap: 8
      }
    }, [...players].sort((a, b) => a.localeCompare(b)).map(name => {
      const btnStyle = getButtonStyle(name);
      const tname = tn(name);
      const tag = p1 === name || tname === p1 ? "P1" : p2 === name || tname === p2 ? "P2" : judge === name && config.tm ? "Judge" : null;
      return /*#__PURE__*/React.createElement("button", {
        key: name,
        onClick: () => handleNameClick(name),
        style: {
          padding: "12px 8px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          ...btnStyle
        }
      }, tn(name), tag && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1,
          opacity: 0.85
        }
      }, tag));
    }))), pickTab === "active" && (() => {
      // canProceed: match selected only (judge is handled by sharedJudgePicker per match)
      const activeCanProceed = challongeMatchId && p1 && p2;
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          ...S.card,
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1,
          textTransform: "uppercase",
          margin: 0
        }
      }, "Select Match"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: fetchActiveMatches,
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "#1D4ED8",
          background: "#1D4ED820",
          border: "2px solid #1D4ED840",
          borderRadius: 10,
          padding: "7px 14px",
          cursor: "pointer",
          fontFamily: "'Outfit',sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 5
        }
      }, "\u21BB Refresh")), activeMatches === "loading" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          fontStyle: "italic",
          textAlign: "center",
          padding: "12px 0"
        }
      }, "\u23F3 Loading active matches..."), Array.isArray(activeMatches) && (() => {
        const vis = activeMatches.filter(m => {
          const n1 = m.player1_name || "";
          const n2 = m.player2_name || "";
          const inR = n => players.some(p => p === n || tn(p) === n || p === tn(n) || tn(p) === tn(n));
          return n1 && n2 && inR(n1) && inR(n2);
        });
        return vis.length === 0 ? /*#__PURE__*/React.createElement("p", {
          style: {
            fontSize: 12,
            color: "var(--text-muted)",
            fontStyle: "italic",
            textAlign: "center",
            padding: "12px 0"
          }
        }, activeMatches.length === 0 ? "No open matches found." : "No matches found involving your current roster.") : null;
      })(), !activeMatches && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          fontStyle: "italic",
          textAlign: "center",
          padding: "12px 0"
        }
      }, "Tap Refresh to load open matches."), Array.isArray(activeMatches) && activeMatches.filter(match => {
        const n1 = match.player1_name || "";
        const n2 = match.player2_name || "";
        const inR = n => players.some(p => p === n || tn(p) === n || p === tn(n) || tn(p) === tn(n));
        return n1 && n2 && inR(n1) && inR(n2);
      }).map((match, mi) => {
        const name1 = match.player1_name || `ID:${match.player1_id}`;
        const name2 = match.player2_name || `ID:${match.player2_id}`;
        const isSelected = challongeMatchId === match.id;
        return /*#__PURE__*/React.createElement("div", {
          key: mi,
          style: {
            marginBottom: mi < activeMatches.length - 1 ? 8 : 0
          }
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          onClick: () => selectActivePairing(match),
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `2px solid ${isSelected ? "#1D4ED8" : "var(--border)"}`,
            background: isSelected ? "#1D4ED820" : "var(--surface2)",
            cursor: "pointer",
            fontFamily: "'Outfit',sans-serif",
            textAlign: "left"
          }
        }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 13,
            fontWeight: 800,
            color: "var(--text-primary)"
          }
        }, tn(name1), " ", /*#__PURE__*/React.createElement("span", {
          style: {
            fontWeight: 400
          }
        }, "vs"), " ", tn(name2)), /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 10,
            color: "var(--text-muted)",
            marginTop: 2
          }
        }, "Round ", match.round, " \xB7 Match #", match.suggested_play_order || mi + 1)), isSelected ? /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 800,
            color: "#1D4ED8",
            flexShrink: 0,
            marginLeft: 8
          }
        }, "\u2713 Selected") : /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            flexShrink: 0,
            marginLeft: 8
          }
        }, "Select \u2192")));
      })), !challongeMatchId && config.tm && /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: startScanner,
        style: {
          width: "100%",
          padding: "13px 0",
          borderRadius: 12,
          border: "2px dashed var(--border2)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 8
        }
      }, "\uD83D\uDCF7 Scan Handoff"), challongeMatchId && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 4
        }
      }, underwayStatus === "checking" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          borderRadius: 9,
          background: "var(--surface2)",
          border: "1.5px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: "2px solid var(--border2)",
          borderTopColor: "#EA580C",
          animation: "spin 1s linear infinite",
          flexShrink: 0
        }
      }), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          margin: 0,
          fontWeight: 600
        }
      }, "Marking match in progress\u2026")), underwayStatus === "ok" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          borderRadius: 9,
          background: "#15803D18",
          border: "1.5px solid #15803D"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13
        }
      }, "\u2705"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "#15803D",
          margin: 0,
          fontWeight: 700
        }
      }, "Challonge access confirmed \u2014 match marked in progress")), underwayStatus === "error" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          borderRadius: 9,
          background: "#F59E0B18",
          border: "1.5px solid #F59E0B"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13
        }
      }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "#F59E0B",
          margin: 0,
          fontWeight: 700
        }
      }, "Could not verify access \u2014 check console for details")), /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.pri,
          margin: 0,
          opacity: activeCanProceed ? 1 : 0.4
        },
        disabled: !activeCanProceed,
        onClick: () => {
          refreshCombos();
          setMatchStartIdx(log.length);
          setFuture([]);
          setCurSet(1);
          setShuf(1);
          setPts([0, 0]);
          setSets([0, 0]);
          setUsed1([]);
          setUsed2([]);
          setLerStrikes([0, 0]);
          setSetScores([]);
          setDeckReview(true);
          setPhase("deck");
        }
      }, "Build Decks \u2192")));
    })(), pickTab === "roster" && /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.pri,
        opacity: canProceed ? 1 : 0.4
      },
      disabled: !canProceed,
      onClick: () => {
        refreshCombos();
        setMatchStartIdx(log.length);
        setFuture([]);
        setCurSet(1);
        setShuf(1);
        setPts([0, 0]);
        setSets([0, 0]);
        setUsed1([]);
        setUsed2([]);
        setLerStrikes([0, 0]);
        setSetScores([]);
        setDeckReview(true);
        setPhase("deck");
      }
    }, "Build Decks \u2192"), pickTab === "roster" && config.tm && playersSelected && !judge.trim() && /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.hint,
        color: "#D97706"
      }
    }, "Select the judge on duty to continue"));
  }
  if (phase === "deck") {
    // (Auto-start removed: deck review screen now shows first, players tap "Record Deck" per player)

    // Review screen — shown when deckReview=true or picker is closed after finishing
    // Show a summary of what has been built so far with option to start or edit
    const comboNames = ["First", "Second", "Third"];
    const allDone = cReady;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.page,
        maxHeight: "100dvh",
        overflowY: "auto"
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: S.back,
      onClick: goBack
    }, IC.back, " Back"), /*#__PURE__*/React.createElement("h1", {
      style: S.title
    }, "Deck Review"), /*#__PURE__*/React.createElement("p", {
      style: S.sub
    }, "Tap any part to change it"), [{
      who: 1,
      name: p1,
      deck: d1,
      setDeck: setD1,
      cl: "#2563EB"
    }, {
      who: 2,
      name: p2,
      deck: d2,
      setDeck: setD2,
      cl: "#DC2626"
    }].map(pl => {
      // A deck is fully blank when every combo has no parts at all submitted
      const isBlank = pl.deck.every(c => !c.blade && !c.ratchet && !c.bit);
      return /*#__PURE__*/React.createElement("div", {
        key: pl.who,
        style: {
          ...S.card,
          borderLeft: `4px solid ${pl.cl}`,
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: pl.cl,
          margin: 0
        }
      }, pl.name), !pl.deck.every(comboReady) && /*#__PURE__*/React.createElement("button", {
        onClick: () => openPicker({
          who: pl.who,
          slot: 0,
          cat: "blade"
        }),
        style: {
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 10px",
          borderRadius: 7,
          border: `1.5px solid ${pl.cl}`,
          background: `${pl.cl}14`,
          color: pl.cl,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          whiteSpace: "nowrap"
        }
      }, "Record Deck \u2192"), pl.deck.every(comboReady) && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "#15803D",
          padding: "4px 10px",
          borderRadius: 7,
          border: "1.5px solid #15803D",
          background: "#15803D14"
        }
      }, "\u2713 Done")), isBlank && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: "var(--text-faint)",
          fontStyle: "italic",
          margin: "0 0 8px",
          lineHeight: 1.4
        }
      }, "Use ", /*#__PURE__*/React.createElement("strong", {
        style: {
          color: pl.cl
        }
      }, "Record Deck \u2192"), " to enter this player's deck. Individual part buttons become available once recording has started."), [0, 1, 2].map(slot => /*#__PURE__*/React.createElement("div", {
        key: slot,
        style: {
          marginBottom: slot < 2 ? 8 : 0
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1,
          marginBottom: 4
        }
      }, comboNames[slot].toUpperCase(), " COMBO"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6
        }
      }, ["blade", "ratchet", "bit"].map(cat => {
        const cc = {
          blade: "#EA580C",
          ratchet: "#1D4ED8",
          bit: "#15803D"
        }[cat];
        const val = pl.deck[slot][cat];
        const disabled = isBlank;
        return /*#__PURE__*/React.createElement("button", {
          key: cat,
          onClick: disabled ? undefined : () => openPicker({
            who: pl.who,
            slot,
            cat,
            returnToReview: true
          }),
          style: {
            flex: 1,
            padding: "8px 4px",
            borderRadius: 8,
            border: `2px solid ${disabled ? "var(--border)" : val ? cc : "#E2E8F0"}`,
            background: disabled ? "var(--surface)" : val ? cc + "14" : "var(--surface2)",
            color: disabled ? "var(--text-faint)" : val ? cc : "var(--text-faint)",
            fontFamily: "'Outfit',sans-serif",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            gap: 0,
            opacity: disabled ? 0.35 : 1,
            userSelect: "none"
          }
        }, val ? /*#__PURE__*/React.createElement(PartLabel, {
          name: val,
          size: splitPartName(val, cat !== "bit").length > 1 ? 10 : 12,
          keepDash: cat !== "bit"
        }) : /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 12,
            fontWeight: 700
          }
        }, "\u2014"));
      })))));
    }), /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.pri,
        opacity: allDone ? 1 : 0.4
      },
      disabled: !allDone,
      onClick: () => {
        // Save decks to registry NOW so the next judge can see them immediately,
        // before the match has finished. Also saved again at match completion as a backup.
        pushDeckToRegistry();
        if (config.tm) {
          setSideAssign({
            pickPriority: null
          });
          setSidePicker({
            priority: null
          });
          setPhase("battle");
        } else {
          setPhase("order");
        }
      }
    }, "Start Match \u2694\uFE0F"), !allDone && /*#__PURE__*/React.createElement("p", {
      style: S.hint
    }, "Tap any missing part above to continue"));
  }

  // ── Shuffle Timer Screen ────────────────────────────────────────────────────
  // ── Combined shuffle timer + deck order screen ──────────────────────────
  if (shuffleTimer || phase === "order") {
    const displayShuf = shuffleTimer === "active" ? shuf + 1 : shuf;
    return /*#__PURE__*/React.createElement(ShuffleOrderScreen, {
      showTimer: !!shuffleTimer,
      onConfirm: () => {
        if (shuffleTimer) {
          pushOverlay({
            shuffling: false
          });
          if (shuffleTimer === "active") {
            setUsed1([]);
            setUsed2([]);
            setShuf(s => s + 1);
          }
          setShuffleTimer(null);
        }
        setOrderPreset(false);
        setPhase("battle");
        setR1(0);
        setR2(0);
      },
      p1: p1,
      p2: p2,
      d1: d1,
      d2: d2,
      setD1: setD1,
      setD2: setD2,
      sets: sets,
      pts: pts,
      need: need,
      curSet: curSet,
      shuf: displayShuf,
      config: config,
      swapped: swapped,
      presetOrder: orderPreset,
      canUndo: log.length > matchStartIdx || log[log.length - 1]?.type === "LER-STRIKE",
      onUndo: undo
    });
  }

  // ── Side Assignment Modal ──────────────────────────────────────────────────
  if (phase === "battle" && sidePicker) {
    const priorityKnown = sidePicker.priority !== null;
    const priorityName = priorityKnown ? sidePicker.priority === 0 ? p1 : p2 : null;
    const priorityColor = priorityKnown ? sidePicker.priority === 0 ? "#2563EB" : "#DC2626" : "#475569";
    const otherName = priorityKnown ? sidePicker.priority === 0 ? p2 : p1 : null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        maxHeight: "100dvh",
        overflowY: "auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginBottom: 36
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 2,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        marginBottom: 12
      }
    }, "Set ", curSet, " \xB7 Assign Sides"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 38,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: "0 0 10px",
        lineHeight: 1
      }
    }, priorityKnown ? "Pick a Side" : "Who Has Priority?"), !priorityKnown && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        color: "var(--text-secondary)",
        fontWeight: 500
      }
    }, "Judge: select the player with pick priority"), priorityKnown && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        color: "var(--text-secondary)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: priorityColor,
        fontWeight: 800
      }
    }, priorityName), " has pick priority")), !priorityKnown && /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, [{
      name: p1,
      pi: 0,
      cl: "#2563EB"
    }, {
      name: p2,
      pi: 1,
      cl: "#DC2626"
    }].map(pl => /*#__PURE__*/React.createElement("button", {
      key: pl.pi,
      onClick: () => setSidePicker({
        priority: pl.pi
      }),
      style: {
        width: "100%",
        padding: "28px 0",
        borderRadius: 20,
        border: `3px solid ${pl.cl}40`,
        background: `${pl.cl}0D`,
        color: pl.cl,
        fontSize: 26,
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, pl.name)))), priorityKnown && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        marginBottom: 24
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: priorityColor,
        textAlign: "center",
        marginBottom: 14,
        letterSpacing: 0.5
      }
    }, priorityName, " \u2014 choose your side:"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, ["B", "X"].map(side => /*#__PURE__*/React.createElement("button", {
      key: side,
      onClick: () => {
        const p1Side = sidePicker.priority === 0 ? side : side === "B" ? "X" : "B";
        const p2Side = sidePicker.priority === 0 ? side === "B" ? "X" : "B" : side;
        setSideAssign({
          pickPriority: sidePicker.priority,
          p1Side,
          p2Side
        });
        setCurrentSides({
          p1Side,
          p2Side
        });
        setSidePicker(null);
        setShuffleTimer("newset");
        pushOverlay({
          shuffling: true,
          p1Side,
          p2Side
        });
      },
      style: {
        width: "100%",
        padding: "36px 0",
        borderRadius: 20,
        border: `3px solid ${priorityColor}40`,
        background: `${priorityColor}0D`,
        color: priorityColor,
        fontSize: 48,
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, side, " Side")))), /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        background: "var(--surface2)",
        borderRadius: 14,
        padding: "16px 20px",
        border: "1px solid var(--border)",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--text-primary)"
      }
    }, otherName), " will be assigned the opposite side automatically."))));
  }
  if (phase === "over") {
    const winner = sets[0] >= need ? p1 : p2;
    const loserName = winner === p1 ? p2 : p1;
    const cs = confirmState || {
      p1ok: false,
      p2ok: false,
      judgeok: false,
      voidConfirm: false
    };
    const allPlayersDone = cs.p1ok && cs.p2ok;
    const submitted = cs.judgeok;

    // Undo the deciding battle and return to active play
    const undoMatchEnd = () => {
      if (!log.length) return;
      const last = log[log.length - 1];
      // Restore all state from the last entry snapshot
      const restoredLog = log.slice(0, -1);
      setLog(restoredLog);
      sSave(KEYS.matchLog, restoredLog);
      setFuture([last, ...future]);
      setPts(last._pp);
      setSets(last._ps);
      setCurSet(last._cs);
      setUsed1(last._u1);
      setUsed2(last._u2);
      setShuf(last._sh);
      if (last._ss) setSetScores(last._ss);else setSetScores(ss => ss.slice(0, -1));
      setConfirmState(null);
      setOverBackConfirm(false);
      setPendingFinish(null);
      if (last._d1) setD1(last._d1);
      if (last._d2) setD2(last._d2);
      if (last._u1.length === 0 && last._u2.length === 0) {
        setR1(null);
        setR2(null);
        setOrderPreset(true);
        setPhase("order");
      } else {
        const nxR1 = [0, 1, 2].find(i => !last._u1.includes(i));
        const nxR2 = [0, 1, 2].find(i => !last._u2.includes(i));
        setR1(nxR1 !== undefined ? nxR1 : null);
        setR2(nxR2 !== undefined ? nxR2 : null);
        setPhase("battle");
      }
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.page,
        paddingBottom: 80
      }
    }, !submitted && /*#__PURE__*/React.createElement("button", {
      style: S.back,
      onClick: () => setOverBackConfirm(true)
    }, IC.back, " Back"), overBackConfirm && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 18,
        padding: "24px 20px",
        maxWidth: 320,
        width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: "var(--text-primary)",
        marginBottom: 8,
        textAlign: "center"
      }
    }, "Go Back?"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        textAlign: "center",
        marginBottom: 6,
        lineHeight: 1.5
      }
    }, "This will undo the last battle and return to the Pick Combo screen for the deciding set."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 1.4
      }
    }, "The match result will be reversed. Use this only if a scoring error was made."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOverBackConfirm(false),
      style: {
        flex: 1,
        padding: "12px 0",
        borderRadius: 10,
        border: "2px solid #E2E8F0",
        background: "#fff",
        color: "#475569",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Stay Here"), /*#__PURE__*/React.createElement("button", {
      onClick: undoMatchEnd,
      style: {
        flex: 1,
        padding: "12px 0",
        borderRadius: 10,
        border: "none",
        background: "#EA580C",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Undo & Go Back")))), (() => {
      const winnerIsP1 = winner === p1;
      const winnerColor = winnerIsP1 ? {
        g: "linear-gradient(135deg,#1D4ED8 0%,#2563EB 100%)",
        shadow: "rgba(37,99,235,0.35)"
      } : {
        g: "linear-gradient(135deg,#B91C1C 0%,#DC2626 100%)",
        shadow: "rgba(220,38,38,0.35)"
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          background: winnerColor.g,
          borderRadius: 20,
          padding: "28px 20px 24px",
          textAlign: "center",
          marginBottom: 12,
          boxShadow: `0 8px 24px ${winnerColor.shadow}`
        }
      }, config.tm && config.tournamentName && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 10,
          textTransform: "uppercase"
        }
      }, config.tournamentName), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 3,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 8,
          textTransform: "uppercase"
        }
      }, "Winner"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: winner && winner.length > 10 ? 48 : 72,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          margin: "0 0 10px",
          fontFamily: "'Outfit',sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 8px"
        }
      }, winner), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          marginBottom: 4,
          letterSpacing: 1,
          textTransform: "uppercase"
        }
      }, "defeats"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: loserName && loserName.length > 10 ? 28 : 42,
          fontWeight: 900,
          color: "rgba(255,255,255,0.75)",
          lineHeight: 1,
          fontFamily: "'Outfit',sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 8px"
        }
      }, loserName));
    })(), config.bo > 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.card,
        padding: "16px 20px",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        color: "var(--text-muted)",
        textAlign: "center",
        marginBottom: 12,
        textTransform: "uppercase"
      }
    }, "Match Score"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: "#2563EB",
        marginBottom: 4
      }
    }, p1, winner === p1 ? " 🏆" : ""), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 52,
        fontWeight: 900,
        color: winner === p1 ? "#2563EB" : "var(--text-faint)",
        lineHeight: 1
      }
    }, sets[0])), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 22,
        fontWeight: 800,
        color: "var(--border2)",
        minWidth: 32,
        textAlign: "center"
      }
    }, "\u2013"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: "#DC2626",
        marginBottom: 4
      }
    }, winner === p2 ? "🏆 " : "", p2), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 52,
        fontWeight: 900,
        color: winner === p2 ? "#DC2626" : "var(--text-faint)",
        lineHeight: 1
      }
    }, sets[1]))), setScores.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 14,
        justifyContent: "center",
        flexWrap: "wrap"
      }
    }, setScores.map((ss, i) => {
      const p1w = ss.p1 > ss.p2;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          textAlign: "center",
          background: p1w ? "#2563EB15" : "#DC262615",
          borderRadius: 10,
          padding: "8px 14px",
          border: `1px solid ${p1w ? "#2563EB40" : "#DC262640"}`
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 8,
          fontWeight: 700,
          color: p1w ? "#3B82F6" : "#EF4444",
          letterSpacing: 1,
          marginBottom: 4
        }
      }, "SET ", i + 1), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: p1w ? "#2563EB" : "var(--text-faint)"
        }
      }, ss.p1), /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#CBD5E1",
          margin: "0 4px",
          fontSize: 14
        }
      }, "\u2013"), /*#__PURE__*/React.createElement("span", {
        style: {
          color: !p1w ? "#DC2626" : "var(--text-faint)"
        }
      }, ss.p2)));
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 12
      }
    }, [{
      label: "Battles",
      val: log.slice(matchStartIdx).length
    }, {
      label: "Shuffles",
      val: shuf
    }].map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        background: "var(--surface2)",
        borderRadius: 12,
        padding: "10px 8px",
        textAlign: "center",
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "var(--text-muted)",
        letterSpacing: 1,
        marginBottom: 3,
        textTransform: "uppercase"
      }
    }, s.label), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: "var(--text-secondary)"
      }
    }, s.val))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 2,
        background: "var(--surface2)",
        borderRadius: 12,
        padding: "8px",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "var(--text-muted)",
        letterSpacing: 1,
        textTransform: "uppercase"
      }
    }, "Judge"), judgeEditMode ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        width: "100%"
      }
    }, /*#__PURE__*/React.createElement(JudgeInput, {
      style: {
        ...S.inp,
        flex: 1,
        fontSize: 12,
        padding: "3px 6px",
        borderRadius: 6,
        minWidth: 0
      },
      value: judge,
      onCommit: v => {
        setJudge(v);
        setJudgeEditMode(false);
      },
      onClear: () => setJudgeEditMode(false)
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => setJudgeEditMode(false),
      style: {
        padding: "3px 8px",
        borderRadius: 6,
        border: "none",
        background: "#2563EB",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2713")) : /*#__PURE__*/React.createElement("button", {
      onClick: () => !submitted && setJudgeEditMode(true),
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: "var(--text-secondary)",
        background: "none",
        border: "none",
        cursor: submitted ? "default" : "pointer",
        fontFamily: "'Outfit',sans-serif",
        padding: 0,
        textDecoration: submitted ? "none" : "underline dotted"
      }
    }, judge || "—"))), /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.card,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: 8
      }
    }, "Match History"), log.slice(matchStartIdx).map((e, i) => {
      const battles = log.slice(matchStartIdx);
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          padding: "6px 0",
          borderBottom: i < battles.length - 1 ? "1px solid #F1F5F9" : "none"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: e.p1Combo ? 3 : 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          flex: 1
        }
      }, "S", e.slot, " \xB7 Set ", e.set, e.p1Side ? ` · ${e.p1Side}/${e.p2Side}` : ""), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: e.scorerIdx === 0 ? "#2563EB" : "#DC2626",
          flex: 2,
          textAlign: "center"
        }
      }, e.scorer, " \u2014 ", e.typeName, " +", e.points, e.penalty ? " (pen)" : ""), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          flex: 1,
          textAlign: "right"
        }
      }, e.p1Score, "\u2013", e.p2Score)), e.p1Combo && e.p2Combo && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6,
          alignItems: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          color: "#2563EB",
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, e.p1Combo.blade || "?", e.p1Combo.ratchet ? ` ${e.p1Combo.ratchet}` : "", e.p1Combo.bit ? ` · ${e.p1Combo.bit}` : ""), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          color: "var(--text-faint)",
          flexShrink: 0
        }
      }, "vs"), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          color: "#DC2626",
          fontWeight: 600,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right"
        }
      }, e.p2Combo.blade || "?", e.p2Combo.ratchet ? ` ${e.p2Combo.ratchet}` : "", e.p2Combo.bit ? ` · ${e.p2Combo.bit}` : "")));
    })), config.tm && !submitted && /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.card,
        border: "2px solid #7C3AED30",
        background: "#7C3AED0A",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#7C3AED",
        marginBottom: 10,
        textAlign: "center",
        letterSpacing: 1
      }
    }, "CONFIRM RESULT"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 12
      }
    }, "Both players confirm, then the judge submits."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmState({
        ...cs,
        p1ok: true
      }),
      disabled: cs.p1ok,
      style: {
        flex: 1,
        padding: "11px 0",
        borderRadius: 10,
        border: "none",
        background: cs.p1ok ? "#15803D" : "#2563EB",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: cs.p1ok ? "default" : "pointer",
        opacity: cs.p1ok ? 0.75 : 1
      }
    }, cs.p1ok ? "✓ " + p1 : p1 + " — Confirm"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmState({
        ...cs,
        p2ok: true
      }),
      disabled: cs.p2ok,
      style: {
        flex: 1,
        padding: "11px 0",
        borderRadius: 10,
        border: "none",
        background: cs.p2ok ? "#15803D" : "#DC2626",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: cs.p2ok ? "default" : "pointer",
        opacity: cs.p2ok ? 0.75 : 1
      }
    }, cs.p2ok ? "✓ " + p2 : p2 + " — Confirm")), allPlayersDone && /*#__PURE__*/React.createElement("button", {
      onClick: () => setJudgeSubmitModal(true),
      style: {
        display: "block",
        width: "100%",
        padding: "12px 0",
        borderRadius: 10,
        border: "none",
        background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2696\uFE0F Judge Confirms \u2192"), !allPlayersDone && /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.hint,
        marginTop: 8
      }
    }, "Both players must confirm before judge can act")), judgeSubmitModal && (() => {
      const winnerIsP1 = sets[0] >= need;
      const winnerId = winnerIsP1 ? challongeP1ParticipantId : challongeP2ParticipantId;
      const p1FinalScore = sets[0];
      const p2FinalScore = sets[1];
      const hasChallonge = !!(challongeSlug && challongeMatchId);
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.7)",
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          background: "var(--surface)",
          borderRadius: 18,
          padding: "22px 20px",
          maxWidth: 340,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          border: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 16,
          fontWeight: 800,
          color: "var(--text-primary)",
          margin: 0
        }
      }, "Submit Results"), /*#__PURE__*/React.createElement("button", {
        onClick: () => setJudgeSubmitModal(false),
        style: {
          background: "var(--surface3)",
          border: "none",
          borderRadius: 8,
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-muted)"
        }
      }, IC.x)), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 14,
          lineHeight: 1.5
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text-primary)"
        }
      }, winner), " defeats ", loserName, " \xB7 ", p1FinalScore, "\u2013", p2FinalScore), [{
        val: submitSheetsCheck,
        set: setSubmitSheetsCheck,
        label: "Submit to Sheets Database",
        desc: "Sends match data to the NC BLAST stat tracker",
        disabled: false
      }, {
        val: submitChallongeCheck,
        set: setSubmitChallongeCheck,
        label: "Submit to Challonge",
        desc: hasChallonge ? "Reports result to the active bracket match" : "No bracket match selected",
        disabled: !hasChallonge
      }].map((opt, oi) => /*#__PURE__*/React.createElement("button", {
        key: oi,
        type: "button",
        disabled: opt.disabled,
        onClick: () => !opt.disabled && opt.set(v => !v),
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          width: "100%",
          padding: "11px 13px",
          borderRadius: 11,
          border: `2px solid ${opt.val && !opt.disabled ? "#2563EB" : "var(--border)"}`,
          background: opt.val && !opt.disabled ? "#2563EB20" : "var(--surface2)",
          cursor: opt.disabled ? "not-allowed" : "pointer",
          marginBottom: 8,
          textAlign: "left",
          fontFamily: "'Outfit',sans-serif",
          opacity: opt.disabled ? 0.45 : 1
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `2px solid ${opt.val && !opt.disabled ? "#2563EB" : "var(--border2)"}`,
          background: opt.val && !opt.disabled ? "#2563EB" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1
        }
      }, opt.val && !opt.disabled && /*#__PURE__*/React.createElement("svg", {
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#fff",
        strokeWidth: "3",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, /*#__PURE__*/React.createElement("polyline", {
        points: "20 6 9 17 4 12"
      }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "0 0 2px"
        }
      }, opt.label), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          margin: 0,
          lineHeight: 1.4
        }
      }, opt.desc)))), challongeSubmitStatus === "ok" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#15803D",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, "\u2713 Challonge submitted"), challongeSubmitStatus && challongeSubmitStatus !== "ok" && challongeSubmitStatus !== "loading" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#DC2626",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, "\u2715 Challonge: ", challongeSubmitStatus), sheetsStatus === "success" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#15803D",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, "\u2713 Sheets submitted"), sheetsStatus === "error" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#DC2626",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, "\u2715 Sheets failed \u2014 CSV downloaded"), /*#__PURE__*/React.createElement("button", {
        disabled: challongeSubmitStatus === "loading",
        onClick: () => {
          setJudgeSubmitModal(false);
          setConfirmState({
            ...cs,
            judgeok: true
          });
          if (submitSheetsCheck) {
            onSendSheets(log.slice(matchStartIdx), {
              p1,
              p2,
              sets,
              config,
              winner,
              shuffles: shuf,
              judge,
              challongeMatchId,
              challongeSlug
            });
          } else {
            onDownloadCSV(log.slice(matchStartIdx), {
              p1,
              p2,
              sets,
              config,
              winner,
              shuffles: shuf
            });
          }
          if (submitChallongeCheck && hasChallonge) {
            submitChallongeScore(challongeMatchId, p1FinalScore, p2FinalScore, winnerId);
          }
        },
        style: {
          display: "block",
          width: "100%",
          padding: "13px 0",
          borderRadius: 11,
          border: "none",
          background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          marginTop: 4
        }
      }, challongeSubmitStatus === "loading" ? "Submitting…" : "Submit")));
    })(), submitted && /*#__PURE__*/React.createElement("button", {
      style: S.pri,
      onClick: () => {
        setSheetsStatus(null);
        resetAndRestoreJudge();
      }
    }, "New Match"), !config.tm && /*#__PURE__*/React.createElement(React.Fragment, null, challongeSlug && challongeMatchId && (() => {
      const winnerIsP1 = sets[0] >= need;
      const winnerId = winnerIsP1 ? challongeP1ParticipantId : challongeP2ParticipantId;
      return challongeSubmitStatus === "ok" ? /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "10px 14px",
          borderRadius: 10,
          background: "#15803D15",
          border: "1px solid #15803D40",
          fontSize: 12,
          fontWeight: 600,
          color: "#15803D",
          textAlign: "center",
          marginBottom: 8
        }
      }, "\u2713 Submitted to Challonge") : /*#__PURE__*/React.createElement("button", {
        type: "button",
        disabled: challongeSubmitStatus === "loading",
        onClick: () => submitChallongeScore(challongeMatchId, sets[0], sets[1], winnerId),
        style: {
          display: "block",
          width: "100%",
          padding: "11px 0",
          borderRadius: 10,
          border: "none",
          background: challongeSubmitStatus === "loading" ? "#CBD5E1" : "#EA580C",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: challongeSubmitStatus === "loading" ? "not-allowed" : "pointer",
          marginBottom: 8
        }
      }, challongeSubmitStatus === "loading" ? "Submitting…" : `Submit to Challonge${winnerId ? "" : " ⚠️"}`);
    })(), /*#__PURE__*/React.createElement("button", {
      style: S.pri,
      onClick: () => {
        setSheetsStatus(null);
        resetAndRestoreJudge();
      }
    }, "New Match")), /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.sec,
        width: "100%",
        justifyContent: "center"
      },
      onClick: () => onDownloadCSV(log.slice(matchStartIdx), {
        p1,
        p2,
        sets,
        config,
        winner,
        shuffles: shuf
      })
    }, IC.download, " Download CSV"), /*#__PURE__*/React.createElement("button", {
      style: {
        display: "block",
        width: "100%",
        padding: "10px 0",
        borderRadius: 10,
        border: "2px solid var(--border)",
        background: "var(--surface2)",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginTop: 6,
        textAlign: "center"
      },
      onClick: () => {
        setSheetsStatus(null);
        reset();
        onMainMenu();
      }
    }, "\u2B05 Main Menu"), config.tm && sheetsStatus === "success" && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "#15803D15",
        border: "1px solid #15803D40",
        fontSize: 12,
        fontWeight: 600,
        color: "#15803D",
        textAlign: "center"
      }
    }, "\u2713 Results submitted to Google Sheets"), config.tm && sheetsStatus === "error" && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "#DC262615",
        border: "1px solid #DC262640",
        fontSize: 12,
        fontWeight: 600,
        color: "#DC2626",
        textAlign: "center"
      }
    }, "\u2715 Sheets submission failed \u2014 download CSV manually"));
  }

  // Battle screen (merged: combo pick + scoring in one view)
  const comboOf = (deck, idx) => deck[idx] || {};
  const battlesInThisSet = log.slice(matchStartIdx).filter(e => e.set === curSet && e.type !== "LER-STRIKE" && e.type !== "LER").length + 1;
  const sc2 = S.page.maxWidth / 480;
  const bp = n => Math.round(n * sc2);
  const bf = n => Math.round(n * sc2);
  // Font scale multipliers — derived directly from sectionH pixel values so text
  // always matches the current bubble size. Natural heights are the defaults when
  // sectionH is null (score ~90px, combo ~44px at base scale).
  const SCORE_NATURAL_H = bp(90);
  const COMBO_NATURAL_H = bp(44);
  const scoreFrac = sectionH.score ? Math.max(0.2, Math.min(4.0, sectionH.score / SCORE_NATURAL_H)) : 1;
  const comboFrac = sectionH.combo ? Math.max(0.2, Math.min(4.0, sectionH.combo / COMBO_NATURAL_H)) : 1;

  // Portrait = taller than wide → stack combos vertically; landscape → side by side
  const comboLayout = window.innerHeight > window.innerWidth ? "column" : "row";

  // Display-order mapping: when swapped, left slot = p2 (canonical), right = p1.
  // Colors ALWAYS stay with the canonical player: p1=blue, p2=red.
  // All scoring state (pts, sets, setScores, scorerIdx) uses canonical indices 0=p1, 1=p2.
  const dA = swapped ? {
    name: p2,
    deck: d2,
    ri: r2,
    setRi: setR2,
    used: used2,
    setUsed: setUsed2,
    ci: 1,
    cl: "#DC2626",
    pts: pts[1],
    sets: sets[1],
    pending: pendingFinish?.pi === 1 ? pendingFinish.fin : null
  } : {
    name: p1,
    deck: d1,
    ri: r1,
    setRi: setR1,
    used: used1,
    setUsed: setUsed1,
    ci: 0,
    cl: "#2563EB",
    pts: pts[0],
    sets: sets[0],
    pending: pendingFinish?.pi === 0 ? pendingFinish.fin : null
  };
  const dB = swapped ? {
    name: p1,
    deck: d1,
    ri: r1,
    setRi: setR1,
    used: used1,
    setUsed: setUsed1,
    ci: 0,
    cl: "#2563EB",
    pts: pts[0],
    sets: sets[0],
    pending: pendingFinish?.pi === 0 ? pendingFinish.fin : null
  } : {
    name: p2,
    deck: d2,
    ri: r2,
    setRi: setR2,
    used: used2,
    setUsed: setUsed2,
    ci: 1,
    cl: "#DC2626",
    pts: pts[1],
    sets: sets[1],
    pending: pendingFinish?.pi === 1 ? pendingFinish.fin : null
  };
  const bothCombosSelected = r1 !== null && r2 !== null;
  const pending1 = pendingFinish?.pi === 0 ? pendingFinish.fin : null;
  const pending2 = pendingFinish?.pi === 1 ? pendingFinish.fin : null;

  // Battle screen: position:fixed full viewport
  const COMBO_ROW_H = bp(54); // fixed height for combo picker row
  const STRIP_H = bp(36); // top strip height
  return /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-solid)",
      boxSizing: "border-box",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: STRIP_H,
      display: "flex",
      alignItems: "center",
      gap: bp(4),
      padding: `0 ${bp(8)}px`,
      flexShrink: 0,
      borderBottom: "1px solid var(--border)",
      background: config.tm ? "#6D28D9" : "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.back,
      marginBottom: 0,
      flexShrink: 0,
      fontSize: bf(12),
      color: config.tm ? "#E9D5FF" : undefined
    },
    onClick: goBack
  }, IC.back), config.bo > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      ...S.pill,
      flexShrink: 0,
      margin: 0,
      fontSize: bf(9),
      ...(config.tm ? {
        background: "rgba(255,255,255,0.18)",
        color: "#E9D5FF",
        border: "1px solid rgba(255,255,255,0.2)"
      } : {})
    }
  }, dA.sets, "\u2013", dB.sets), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: bp(3),
      minWidth: 0
    }
  }, (() => {
    const canUndo = log.length > matchStartIdx || log[log.length - 1]?.type === "LER-STRIKE";
    const btnBase = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      flex: 1,
      height: bp(30),
      borderRadius: bp(6),
      border: `1px solid ${config.tm ? "rgba(255,255,255,0.25)" : "var(--border2)"}`,
      background: config.tm ? "rgba(255,255,255,0.1)" : "var(--surface2)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    };
    const lbl = {
      fontSize: Math.max(6, bf(8)),
      fontWeight: 700,
      letterSpacing: 0.4,
      lineHeight: 1,
      textTransform: "uppercase",
      marginTop: 1
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      onClick: () => setHistoryOpen(true),
      style: {
        ...btnBase,
        color: config.tm ? "#C4B5FD" : "var(--text-muted)"
      }
    }, IC.history, /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: config.tm ? "#C4B5FD" : "var(--text-muted)"
      }
    }, "Log")), /*#__PURE__*/React.createElement("button", {
      onClick: undo,
      disabled: !canUndo,
      style: {
        ...btnBase,
        color: canUndo ? config.tm ? "#C4B5FD" : "var(--text-muted)" : "var(--text-disabled)",
        opacity: canUndo ? 1 : 0.3,
        cursor: canUndo ? "pointer" : "default"
      }
    }, IC.undo, /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: canUndo ? config.tm ? "#C4B5FD" : "var(--text-muted)" : "var(--text-disabled)"
      }
    }, "Undo")), /*#__PURE__*/React.createElement("button", {
      onClick: redo,
      disabled: !future.length,
      style: {
        ...btnBase,
        color: future.length ? "#EA580C" : "var(--text-disabled)",
        opacity: future.length ? 1 : 0.3,
        cursor: future.length ? "pointer" : "default"
      }
    }, IC.redo, /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: future.length ? "#EA580C" : "var(--text-disabled)"
      }
    }, "Redo")), currentSides.p1Side && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        setSwapped(s => !s);
        setCurrentSides(cs => ({
          p1Side: cs.p2Side,
          p2Side: cs.p1Side
        }));
        setSideAssign(a => a ? {
          ...a,
          p1Side: a.p2Side || "",
          p2Side: a.p1Side || ""
        } : a);
      },
      style: {
        ...btnBase,
        color: config.tm ? "#E9D5FF" : "var(--text-secondary)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: bf(12),
        lineHeight: 1
      }
    }, "\u21C4"), /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: config.tm ? "#E9D5FF" : "var(--text-secondary)"
      }
    }, "Swap")));
  })()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: bp(3),
      flexShrink: 0
    }
  }, (() => {
    const sq = {
      width: bp(28),
      height: bp(28),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: bp(6),
      cursor: "pointer",
      fontSize: bf(13),
      lineHeight: 1,
      flexShrink: 0
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setOverlayModal(true),
      style: {
        ...sq,
        background: overlaySlot > 0 ? "#1D4ED8" : "none",
        border: overlaySlot > 0 ? "none" : `1px solid ${config.tm ? "rgba(255,255,255,0.3)" : "var(--border2)"}`,
        color: overlaySlot > 0 ? "#fff" : config.tm ? "#E9D5FF" : "var(--text-muted)",
        fontSize: bf(overlaySlot > 0 ? 8 : 13),
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif"
      },
      title: "Stream overlay"
    }, overlaySlot > 0 ? `📡${overlaySlot}` : "📡"), config.tm && challongeMatchId && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        if (sharedJudges) {
          setHandoffMethodPicker(true);
        } else {
          startHandoff();
        }
      },
      style: {
        ...sq,
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.3)",
        color: "#E9D5FF"
      },
      title: "Hand off match to another judge"
    }, "\uD83D\uDD00"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setLayoutEditMode(m => !m),
      style: {
        ...sq,
        background: layoutEditMode ? "#7C3AED" : "none",
        border: layoutEditMode ? "none" : `1px solid ${config.tm ? "rgba(255,255,255,0.3)" : "var(--border2)"}`,
        color: layoutEditMode ? "#fff" : config.tm ? "#E9D5FF" : "var(--text-muted)",
        position: "relative",
        zIndex: 160
      },
      title: layoutEditMode ? "Exit layout edit" : "Adjust layout heights"
    }, "\u283F"), /*#__PURE__*/React.createElement("button", {
      onClick: toggleDark,
      style: {
        ...sq,
        background: "none",
        border: "none",
        fontSize: bf(14)
      }
    }, dark ? "☀️" : "🌙"));
  })())), /*#__PURE__*/React.createElement("div", {
    ref: scoreBlockCbRef,
    style: {
      background: "var(--surface)",
      borderRadius: bp(12),
      padding: `${bp(4)}px ${bp(12)}px`,
      marginBottom: 0,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      border: "1px solid var(--border)",
      flexShrink: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      ...(sectionH.score ? {
        height: sectionH.score
      } : {})
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      marginBottom: bp(1)
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(dA.name && dA.name.length > 10 ? 13 : 17) * scoreFrac),
      fontWeight: 900,
      color: dA.cl,
      fontFamily: "'Outfit',sans-serif",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      maxWidth: "100%",
      textAlign: "center",
      lineHeight: 1
    }
  }, dA.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      minWidth: Math.round(bp(56) * scoreFrac),
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, (currentSides.p1Side || currentSides.p2Side) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(7) * scoreFrac),
      fontWeight: 700,
      color: "var(--text-muted)",
      whiteSpace: "nowrap",
      lineHeight: 1.2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: dA.cl === "#2563EB" ? "#93C5FD" : "#FCA5A5"
    }
  }, currentSides.p1Side || "—"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-faint)"
    }
  }, " \xB7 "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: dB.cl === "#DC2626" ? "#FCA5A5" : "#93C5FD"
    }
  }, currentSides.p2Side || "—"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(dB.name && dB.name.length > 10 ? 13 : 17) * scoreFrac),
      fontWeight: 900,
      color: dB.cl,
      fontFamily: "'Outfit',sans-serif",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      maxWidth: "100%",
      textAlign: "center",
      lineHeight: 1
    }
  }, dB.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(48) * scoreFrac),
      fontWeight: 900,
      color: dA.cl,
      lineHeight: 1,
      fontFamily: "'Outfit',sans-serif"
    }
  }, dA.pts)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      minWidth: Math.round(bp(56) * scoreFrac),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(22) * scoreFrac),
      fontWeight: 800,
      color: "var(--border2)",
      lineHeight: 1
    }
  }, "\u2013"), config.pts > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(8) * scoreFrac),
      fontWeight: 700,
      color: "var(--text-primary)",
      letterSpacing: 1,
      lineHeight: 1
    }
  }, "TO ", config.pts), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(7) * scoreFrac),
      fontWeight: 700,
      color: "var(--text-muted)",
      whiteSpace: "nowrap",
      lineHeight: 1.3
    }
  }, ["First", "Second", "Third", "Fourth", "Fifth"][curSet - 1] || `Set ${curSet}`, " Set")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(bf(48) * scoreFrac),
      fontWeight: 900,
      color: dB.cl,
      lineHeight: 1,
      fontFamily: "'Outfit',sans-serif"
    }
  }, dB.pts)))), layoutEditMode && /*#__PURE__*/React.createElement("div", {
    onPointerDown: e => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      const hScore = scoreBlockSectionRef.current?.offsetHeight || sectionH.score || 80;
      const hCombo = comboDisplaySectionRef.current?.offsetHeight || sectionH.combo || 44;
      dragRef.current = {
        section: "score",
        startY: e.clientY,
        startH: hScore,
        startH2: hCombo
      };
    },
    onPointerMove: e => {
      if (!dragRef.current || dragRef.current.section !== "score") return;
      const raw = e.clientY - dragRef.current.startY;
      const {
        startH: sH,
        startH2: cH
      } = dragRef.current;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const d = Math.min(Math.max(raw, 44 - sH, cH - 300), 400 - sH, cH - 24);
        if (!isFinite(d)) return;
        setSectionH(h => ({
          ...h,
          score: sH + d,
          combo: cH - d
        }));
      });
    },
    onPointerUp: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      dragRef.current = null;
    },
    onPointerCancel: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      dragRef.current = null;
    },
    style: {
      height: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "ns-resize",
      flexShrink: 0,
      touchAction: "none",
      userSelect: "none",
      position: "relative",
      zIndex: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "40%",
      height: 4,
      borderRadius: 2,
      background: "#7C3AED",
      opacity: 0.7
    }
  })), !layoutEditMode && /*#__PURE__*/React.createElement("div", {
    style: {
      height: bp(5),
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    ref: comboDisplaySectionRef,
    style: {
      display: "flex",
      gap: bp(6),
      marginBottom: 0,
      flexShrink: 0,
      ...(sectionH.combo ? {
        height: sectionH.combo
      } : {
        minHeight: bp(44)
      }),
      overflow: "hidden"
    }
  }, [dA, dB].map((side, si) => {
    const c = side.ri !== null ? comboOf(side.deck, side.ri) : null;
    const hasCombo = side.ri !== null;
    return /*#__PURE__*/React.createElement("div", {
      key: si,
      style: {
        flex: 1,
        minWidth: 0,
        borderRadius: bp(12),
        border: `2px solid ${hasCombo ? side.cl + "60" : "var(--border)"}`,
        background: hasCombo ? `${side.cl}0D` : "var(--surface2)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${bp(4)}px ${bp(6)}px`
      }
    }, hasCombo ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        width: "100%",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: Math.round(bf(13) * comboFrac),
        fontWeight: 900,
        color: side.cl,
        textAlign: "center",
        lineHeight: 1.15,
        whiteSpace: "normal",
        wordBreak: "normal",
        overflowWrap: "normal",
        maxWidth: "100%"
      }
    }, c?.blade || "—"), c?.ratchet && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: Math.round(bf(9) * comboFrac),
        fontWeight: 700,
        color: side.cl,
        textAlign: "center",
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        maxWidth: "100%",
        opacity: 0.9
      }
    }, c.ratchet), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: Math.round(bf(9) * comboFrac),
        fontWeight: 600,
        color: side.cl,
        textAlign: "center",
        lineHeight: 1.15,
        whiteSpace: "normal",
        wordBreak: "normal",
        overflowWrap: "normal",
        maxWidth: "100%",
        opacity: 0.8
      }
    }, c?.bit || "")) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: Math.round(bf(10) * comboFrac),
        fontWeight: 600,
        color: "var(--text-faint)",
        textAlign: "center"
      }
    }));
  })), layoutEditMode && /*#__PURE__*/React.createElement("div", {
    onPointerDown: e => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      const hCombo = comboDisplaySectionRef.current?.offsetHeight || sectionH.combo || 44;
      const hPicker = comboPickerSectionRef.current?.offsetHeight || sectionH.picker || COMBO_ROW_H;
      dragRef.current = {
        section: "combo",
        startY: e.clientY,
        startH: hCombo,
        startH2: hPicker
      };
    },
    onPointerMove: e => {
      if (!dragRef.current || dragRef.current.section !== "combo") return;
      const raw = e.clientY - dragRef.current.startY;
      const {
        startH: cH,
        startH2: pH
      } = dragRef.current;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const d = Math.min(Math.max(raw, 24 - cH, pH - 250), 300 - cH, pH - 30);
        if (!isFinite(d)) return;
        setSectionH(h => ({
          ...h,
          combo: cH + d,
          picker: pH - d
        }));
      });
    },
    onPointerUp: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      dragRef.current = null;
    },
    onPointerCancel: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      dragRef.current = null;
    },
    style: {
      height: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "ns-resize",
      flexShrink: 0,
      touchAction: "none",
      userSelect: "none",
      position: "relative",
      zIndex: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "40%",
      height: 4,
      borderRadius: 2,
      background: "#7C3AED",
      opacity: 0.7
    }
  })), !layoutEditMode && /*#__PURE__*/React.createElement("div", {
    style: {
      height: bp(5),
      flexShrink: 0
    }
  }), layoutEditMode && /*#__PURE__*/React.createElement("div", {
    onPointerDown: e => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      const hPicker = comboPickerSectionRef.current?.offsetHeight || sectionH.picker || COMBO_ROW_H;
      const hFinish = finishSectionRef.current?.offsetHeight || sectionH.finish || 200;
      dragRef.current = {
        section: "picker",
        startY: e.clientY,
        startH: hPicker,
        startH2: hFinish
      };
    },
    onPointerMove: e => {
      if (!dragRef.current || dragRef.current.section !== "picker") return;
      const raw = e.clientY - dragRef.current.startY;
      const {
        startH: pH,
        startH2: fH
      } = dragRef.current;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const d = Math.min(Math.max(raw, 30 - pH, fH - 600), 250 - pH, fH - 80);
        if (!isFinite(d)) return;
        setSectionH(h => ({
          ...h,
          picker: pH + d,
          finish: fH - d
        }));
      });
    },
    onPointerUp: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      dragRef.current = null;
    },
    onPointerCancel: () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      dragRef.current = null;
    },
    style: {
      height: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "ns-resize",
      flexShrink: 0,
      touchAction: "none",
      userSelect: "none",
      position: "relative",
      zIndex: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "40%",
      height: 4,
      borderRadius: 2,
      background: "#7C3AED",
      opacity: 0.7
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: layoutEditMode ? "#7C3AED" : "var(--border)",
      margin: `${layoutEditMode ? bp(0) : bp(5)}px ${bp(10)}px`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    ref: finishSectionRef,
    style: {
      display: "flex",
      gap: bp(6),
      padding: `0 ${bp(10)}px 0`,
      ...(sectionH.finish ? {
        height: sectionH.finish,
        flexShrink: 0
      } : {
        flex: 1,
        minHeight: 0
      })
    }
  }, [dA, dB].map(side => {
    const canConfirm = side.ri !== null && side.pending;
    return /*#__PURE__*/React.createElement("div", {
      key: side.ci,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: bp(2),
        minHeight: 0
      }
    }, [...FINISH, ...PENALTY.filter(f => f.id !== "LER")].map(f => {
      const isSel = side.pending?.id === f.id;
      const isFinish = !f.penalty;
      const label = f.id === "OF2" ? "Own ×2" : f.id === "OF3" ? "Own ×3" : f.name;
      const active = bothCombosSelected && !layoutEditMode;
      return /*#__PURE__*/React.createElement(ScaledBtn, {
        key: f.id,
        disabled: layoutEditMode || !bothCombosSelected,
        onClick: () => {
          if (active) setPendingFinish(isSel ? null : {
            pi: side.ci,
            fin: f
          });
        },
        baseStyle: {
          flex: 1,
          minHeight: 0,
          borderRadius: bp(7),
          border: `2px solid ${!active ? "var(--border)" : isSel ? side.cl : isFinish ? `${side.cl}50` : "var(--border2)"}`,
          background: !active ? "var(--surface2)" : isSel ? side.cl : isFinish ? `${side.cl}10` : "var(--surface2)",
          color: !active ? "var(--text-disabled)" : isSel ? "#fff" : "var(--text-primary)",
          fontFamily: "'Outfit',sans-serif",
          cursor: active ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${bp(4)}px`,
          opacity: active ? 1 : 0.45,
          overflow: "hidden",
          boxSizing: "border-box"
        },
        renderContent: frac => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
          style: {
            width: "72%",
            minWidth: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            overflow: "hidden"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.38,
          wrap: true,
          style: {
            fontWeight: 800,
            textAlign: "left",
            justifyContent: "flex-start"
          }
        }, label)), /*#__PURE__*/React.createElement("div", {
          style: {
            flexShrink: 0,
            height: "60%",
            width: "24%",
            marginLeft: Math.round(bp(2) * frac),
            background: !active ? "var(--border2)" : isSel ? "rgba(255,255,255,0.3)" : side.cl,
            borderRadius: bp(3),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.55,
          style: {
            color: "#fff",
            fontWeight: 900
          }
        }, "+", f.p)))
      });
    }), (() => {
      const lerLocked = layoutEditMode || !bothCombosSelected;
      const hasStrike = lerStrikes[side.ci] === 1;
      const lerFin = PENALTY.find(f => f.id === "LER");
      const lerClick = () => {
        if (lerLocked) return;
        if (!hasStrike) {
          const strikeEntry = {
            set: curSet,
            shuffle: shuf,
            slot: log.slice(matchStartIdx).filter(e => e.set === curSet).length + 1,
            scorer: side.ci === 0 ? p1 : p2,
            scorerIdx: side.ci,
            judge: judge,
            penalty: true,
            type: "LER-STRIKE",
            typeName: "LER Strike",
            points: 0,
            p1Score: pts[0],
            p2Score: pts[1],
            p1Name: p1,
            p2Name: p2,
            p1Combo: {
              ...d1[r1]
            },
            p2Combo: {
              ...d2[r2]
            },
            p1ComboIdx: r1,
            p2ComboIdx: r2,
            p1Side: currentSides.p1Side || "",
            p2Side: currentSides.p2Side || "",
            winnerCombo: "",
            time: new Date().toISOString(),
            _pp: [...pts],
            _ps: [...sets],
            _cs: curSet,
            _u1: [...used1],
            _u2: [...used2],
            _sh: shuf,
            _ls: [...lerStrikes],
            _ss: [...setScores],
            _lerStrikeFor: side.ci
          };
          const newLog = [...log, strikeEntry];
          setLog(newLog);
          sSave(KEYS.matchLog, newLog);
          setFuture([]);
          setLerStrikes(s => {
            const n = [...s];
            n[side.ci] = 1;
            return n;
          });
          pushOverlay({
            lastFinish: {
              type: "LER-STRIKE",
              scorerIdx: side.ci
            }
          });
        } else {
          setLerStrikes([0, 0]);
          doScore(side.ci, lerFin);
        }
      };
      return /*#__PURE__*/React.createElement(ScaledBtn, {
        key: "ler",
        disabled: lerLocked,
        onClick: lerClick,
        baseStyle: {
          flex: 1,
          minHeight: 0,
          width: "100%",
          padding: `0 ${bp(4)}px`,
          borderRadius: bp(7),
          border: hasStrike ? `2px solid #F59E0B` : "2px dashed var(--border2)",
          background: hasStrike ? "#FEF9C3" : "var(--surface2)",
          color: lerLocked ? "var(--text-disabled)" : "var(--text-primary)",
          fontFamily: "'Outfit',sans-serif",
          cursor: lerLocked ? "not-allowed" : "pointer",
          boxSizing: "border-box",
          opacity: lerLocked ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          overflow: "hidden"
        },
        renderContent: frac => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
          style: {
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            overflow: "hidden"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.35,
          style: {
            fontWeight: 700,
            color: hasStrike ? "#B45309" : "inherit",
            textAlign: "left",
            justifyContent: "flex-start"
          }
        }, "Launch Error")), /*#__PURE__*/React.createElement("div", {
          style: {
            flexShrink: 0,
            height: "60%",
            minWidth: "20%",
            marginLeft: Math.round(bp(2) * frac),
            background: hasStrike ? "#F59E0B" : "var(--surface3)",
            borderRadius: bp(3),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.55,
          style: {
            color: "#fff",
            fontWeight: 800
          }
        }, "LER")))
      });
    })(), (() => {
      const canConfirm = side.ri !== null && side.pending;
      return /*#__PURE__*/React.createElement(ScaledBtn, {
        key: "confirm",
        disabled: layoutEditMode || !canConfirm,
        onClick: () => {
          if (!layoutEditMode && canConfirm) {
            doScore(side.ci, side.pending);
            setPendingFinish(null);
          }
        },
        baseStyle: {
          flex: 1,
          minHeight: 0,
          width: "100%",
          borderRadius: bp(7),
          border: "2px solid transparent",
          background: canConfirm ? side.cl : "var(--surface3)",
          color: canConfirm ? "#fff" : "var(--text-disabled)",
          fontFamily: "'Outfit',sans-serif",
          cursor: canConfirm ? "pointer" : "not-allowed",
          boxSizing: "border-box",
          transition: "background 0.15s",
          overflow: "hidden",
          position: "relative"
        },
        renderContent: frac => /*#__PURE__*/React.createElement("div", {
          style: {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: canConfirm ? 0 : 1,
            pointerEvents: "none"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.40,
          style: {
            fontWeight: 900
          }
        }, "Pick finish \u2191")), /*#__PURE__*/React.createElement("div", {
          style: {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: canConfirm ? 1 : 0,
            pointerEvents: "none"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.40,
          style: {
            fontWeight: 900
          }
        }, `Confirm ${(side.pending?.name || "").replace(/ Finish$/, "").replace(/ Error$/, "")}`)))
      });
    })());
  })), layoutEditMode && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#7C3AED",
      color: "#fff",
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `${bp(5)}px ${bp(12)}px`,
      boxShadow: "0 -2px 12px rgba(124,58,237,0.4)",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: bf(9),
      fontWeight: 700,
      opacity: 0.9
    }
  }, "\u283F Layout Edit \u2014 drag purple lines \xB7 tap \u283F to exit")), layoutEditMode && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 150,
      touchAction: "none"
    },
    onPointerDown: e => e.stopPropagation(),
    onClick: e => e.stopPropagation()
  }), overlayModal && /*#__PURE__*/React.createElement("div", {
    onClick: () => setOverlayModal(false),
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--surface)",
      borderRadius: bp(16),
      padding: `${bp(16)}px ${bp(20)}px`,
      width: Math.min(300, window.innerWidth - 40),
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: bp(12)
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: bf(13),
      fontWeight: 800,
      color: "var(--text-primary)"
    }
  }, "\uD83D\uDCE1 Stream Overlay"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOverlayModal(false),
    style: {
      background: "var(--surface3)",
      border: "none",
      borderRadius: bp(6),
      width: bp(24),
      height: bp(24),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "var(--text-muted)",
      fontSize: bf(11),
      fontWeight: 700
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: bf(8),
      color: "var(--text-muted)",
      marginBottom: bp(10)
    }
  }, "Pick a channel for this device. Each device must use a different channel."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: bp(6)
    }
  }, [0, 1, 2, 3, 4].map(slot => /*#__PURE__*/React.createElement("button", {
    key: slot,
    type: "button",
    onClick: () => {
      setOverlaySlot(slot);
      setOverlayStatus(null);
      try {
        localStorage.setItem(KEYS.overlaySlot, String(slot));
      } catch {}
      ;
      setOverlayModal(false);
    },
    style: {
      display: "flex",
      alignItems: "center",
      gap: bp(8),
      padding: `${bp(8)}px ${bp(12)}px`,
      borderRadius: bp(8),
      border: `2px solid ${overlaySlot === slot ? "#1D4ED8" : "var(--border)"}`,
      background: overlaySlot === slot ? "#EFF6FF" : "var(--surface2)",
      cursor: "pointer",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: bf(14),
      lineHeight: 1
    }
  }, slot === 0 ? "🔇" : "📡"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: bf(10),
      fontWeight: 700,
      color: overlaySlot === slot ? "#1D4ED8" : "var(--text-primary)"
    }
  }, slot === 0 ? "Off (no streaming)" : `Channel ${slot}`)), overlaySlot === slot && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: bf(8),
      fontWeight: 700,
      color: "#1D4ED8"
    }
  }, "\u2713 Active")))), overlaySlot > 0 && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      pushOverlay();
      setOverlayModal(false);
    },
    style: {
      marginTop: bp(12),
      width: "100%",
      padding: `${bp(8)}px`,
      borderRadius: bp(8),
      border: "none",
      background: overlayStatus === "ok" ? "#15803D" : "#EA580C",
      color: "#fff",
      fontSize: bf(10),
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, overlayStatus === "ok" ? "🟢 Push Update" : "▶ Connect Channel " + overlaySlot))), pingModal && (() => {
    const closePing = () => {
      setPingModal(false);
      setPingComment("");
      setPingReason(null);
      setPingStadium(null);
      setPingSent(false);
    };
    const PING_REASONS = ["Challenge", "Rules Question", "General Escalation", "Other"];
    // Build the comment that gets sent: reason + stadium + any typed note
    const buildComment = () => {
      const parts = [];
      if (pingReason) parts.push(`Reason: ${pingReason}`);
      if (pingStadium) parts.push(`Stadium: ${pingStadium}`);
      if (pingComment.trim()) parts.push(pingComment.trim());
      return parts.join(" | ");
    };
    return /*#__PURE__*/React.createElement("div", {
      onClick: () => {
        if (!pingSending) closePing();
      },
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        background: "var(--surface)",
        borderRadius: bp(18),
        padding: `${bp(20)}px ${bp(20)}px`,
        width: "100%",
        maxWidth: 340,
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        border: "2px solid #DC2626"
      }
    }, pingSent ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: `${bp(12)}px 0`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 40,
        marginBottom: bp(10)
      }
    }, "\u2705"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(14),
        fontWeight: 900,
        color: "var(--text-primary)",
        marginBottom: bp(6)
      }
    }, "TO Notified"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(10),
        color: "var(--text-muted)",
        marginBottom: bp(16)
      }
    }, "Your ping has been sent."), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: closePing,
      style: {
        width: "100%",
        padding: `${bp(10)}px`,
        borderRadius: bp(10),
        border: "none",
        background: "var(--surface3)",
        color: "var(--text-primary)",
        fontSize: bf(11),
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Close")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: bp(14)
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(14),
        fontWeight: 900,
        color: "#DC2626",
        margin: 0
      }
    }, "\uD83D\uDEA8 Contact TO"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(9),
        color: "var(--text-muted)",
        margin: 0,
        marginTop: 2
      }
    }, "Ping the tournament organizer")), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: closePing,
      style: {
        background: "var(--surface3)",
        border: "none",
        borderRadius: bp(6),
        width: bp(26),
        height: bp(26),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text-muted)",
        fontSize: bf(11),
        fontWeight: 700
      }
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface2)",
        borderRadius: bp(10),
        padding: `${bp(10)}px ${bp(12)}px`,
        marginBottom: bp(14),
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(8),
        color: "var(--text-faint)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 4px"
      }
    }, "Match Info (auto-included)"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(10),
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: 0
      }
    }, p1 || "?", " vs ", p2 || "?"), judge && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(9),
        color: "var(--text-muted)",
        margin: "2px 0 0"
      }
    }, "Judge: ", judge)), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(9),
        fontWeight: 700,
        color: "var(--text-secondary)",
        marginBottom: bp(6),
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "Reason"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        marginBottom: bp(14)
      }
    }, PING_REASONS.map(r => {
      const sel = pingReason === r;
      return /*#__PURE__*/React.createElement("button", {
        key: r,
        type: "button",
        onClick: () => setPingReason(sel ? null : r),
        style: {
          padding: `${bp(8)}px ${bp(6)}px`,
          borderRadius: bp(9),
          border: `2px solid ${sel ? "#DC2626" : "var(--border2)"}`,
          background: sel ? "#DC262618" : "var(--surface2)",
          color: sel ? "#DC2626" : "var(--text-secondary)",
          fontSize: bf(9),
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          textAlign: "center",
          lineHeight: 1.2
        }
      }, r);
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(9),
        fontWeight: 700,
        color: "var(--text-secondary)",
        marginBottom: bp(6),
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "Stadium"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(6,1fr)",
        gap: 5,
        marginBottom: bp(14)
      }
    }, [1, 2, 3, 4, 5, 6].map(n => {
      const sel = pingStadium === n;
      return /*#__PURE__*/React.createElement("button", {
        key: n,
        type: "button",
        onClick: () => setPingStadium(sel ? null : n),
        style: {
          padding: `${bp(8)}px 0`,
          borderRadius: bp(9),
          border: `2px solid ${sel ? "#DC2626" : "var(--border2)"}`,
          background: sel ? "#DC262618" : "var(--surface2)",
          color: sel ? "#DC2626" : "var(--text-secondary)",
          fontSize: bf(13),
          fontWeight: 900,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          textAlign: "center"
        }
      }, n);
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: bf(9),
        fontWeight: 700,
        color: "var(--text-secondary)",
        marginBottom: bp(6),
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "Additional Note (optional)"), /*#__PURE__*/React.createElement("textarea", {
      value: pingComment,
      onChange: e => setPingComment(e.target.value),
      placeholder: "Any extra details\u2026",
      rows: 2,
      style: {
        width: "100%",
        borderRadius: bp(10),
        border: "1px solid var(--border2)",
        background: "var(--input-bg)",
        color: "var(--text-primary)",
        fontSize: bf(10),
        fontFamily: "'Outfit',sans-serif",
        padding: `${bp(8)}px ${bp(10)}px`,
        resize: "none",
        outline: "none",
        boxSizing: "border-box"
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      disabled: pingSending,
      onClick: async () => {
        setPingSending(true);
        try {
          await fetch(`${OVERLAY_WORKER}/pings/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              slug: challongeSlug,
              judge,
              p1,
              p2,
              comment: buildComment()
            })
          });
          setPingSent(true);
        } catch (_) {
          alert("Failed to send ping. Check your connection.");
        } finally {
          setPingSending(false);
        }
      },
      style: {
        marginTop: bp(12),
        width: "100%",
        padding: `${bp(12)}px`,
        borderRadius: bp(10),
        border: "none",
        background: pingSending ? "#991B1B" : "#DC2626",
        color: "#fff",
        fontSize: bf(12),
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: pingSending ? "not-allowed" : "pointer",
        opacity: pingSending ? 0.7 : 1
      }
    }, pingSending ? "Sending…" : "🚨 Send Ping to TO"))));
  })(), handoffModal && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.92)",
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 20,
      padding: "28px 22px",
      maxWidth: 320,
      width: "100%",
      boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      border: "1px solid var(--border)",
      textAlign: "center"
    }
  }, handoffPhase === "claimed" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 48,
      marginBottom: 12
    }
  }, "\u2705"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      fontWeight: 900,
      color: "var(--text-primary)",
      marginBottom: 6
    }
  }, "Handed off!"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-secondary)"
    }
  }, "Match transferred to the other judge.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 900,
      color: "var(--text-primary)",
      marginBottom: 4
    }
  }, "\uD83D\uDD00 Hand Off Match"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-secondary)",
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "Have the receiving judge scan this QR code. This screen will close automatically once they accept."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: handoffQrRef,
    style: {
      background: "#fff",
      padding: 8,
      borderRadius: 10,
      display: "inline-block",
      lineHeight: 0
    }
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-muted)",
      marginBottom: 16,
      fontFamily: "'JetBrains Mono',monospace",
      letterSpacing: 1
    }
  }, "TOKEN: ", handoffToken), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      border: "2px solid #1D4ED8",
      borderTopColor: "transparent",
      animation: "spin 1s linear infinite",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      margin: 0
    }
  }, "Waiting for receiving judge\u2026")), /*#__PURE__*/React.createElement("button", {
    onClick: () => cancelHandoff(handoffToken),
    style: {
      width: "100%",
      padding: "13px 0",
      borderRadius: 12,
      border: "none",
      background: "var(--surface2)",
      color: "var(--text-secondary)",
      fontSize: 14,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: historyOpen ? Math.min(340, window.innerWidth - 40) : 0,
      background: "var(--surface)",
      boxShadow: historyOpen ? "-4px 0 24px rgba(0,0,0,0.25)" : "none",
      transition: "width 0.25s ease",
      overflow: "hidden",
      zIndex: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: Math.min(340, window.innerWidth - 40),
      padding: "20px 16px",
      overflowY: "auto",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      color: "var(--text-primary)"
    }
  }, "Match Log"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, log.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryConfirmClear(true),
    style: {
      background: "none",
      border: "none",
      color: "#EF4444",
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      opacity: 0.7,
      padding: "4px 6px"
    }
  }, "Clear"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryOpen(false),
    style: {
      background: "var(--surface3)",
      border: "none",
      borderRadius: 8,
      width: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "var(--text-muted)"
    }
  }, IC.x))), historyConfirmClear && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.5)",
      zIndex: 300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      padding: "24px 20px",
      maxWidth: 320,
      width: "100%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: "var(--text-primary)",
      marginBottom: 8,
      textAlign: "center"
    }
  }, "Clear Match Log?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-secondary)",
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, "This will permanently delete all ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "#EF4444"
    }
  }, log.length, " battle records"), " from the log. This cannot be undone."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryConfirmClear(false),
    style: {
      flex: 1,
      padding: "12px 0",
      borderRadius: 10,
      border: "2px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setLog([]);
      sSave(KEYS.matchLog, []);
      setHistoryConfirmClear(false);
      setHistoryOpen(false);
    },
    style: {
      flex: 1,
      padding: "12px 0",
      borderRadius: 10,
      border: "none",
      background: "#EF4444",
      color: "#fff",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Clear All")))), log.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-disabled)",
      fontSize: 13,
      fontStyle: "italic"
    }
  }, "No battles yet"), log.slice().reverse().map((e, i) => {
    const winnerName = e.scorerIdx === 0 ? e.p1Name : e.p2Name;
    const loserName = e.scorerIdx === 0 ? e.p2Name : e.p1Name;
    const loserCombo = e.scorerIdx === 0 ? comboStr(e.p2Combo) : comboStr(e.p1Combo);
    const winnerColor = e.scorerIdx === 0 ? "#2563EB" : "#DC2626";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: "10px 12px",
        borderRadius: 10,
        marginBottom: 8,
        background: e.scorerIdx === 0 ? "#EFF6FF22" : "#FEF2F222",
        borderLeft: `4px solid ${winnerColor}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: winnerColor,
        fontSize: 14
      }
    }, e.scorer), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, "R", log.length - i, " \xB7 Set ", e.set)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-secondary)",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: winnerColor
      }
    }, e.typeName), " (+", e.points, ")"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: winnerColor
      }
    }, "\u25B2 ", winnerName, ":"), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, e.winnerCombo)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: "var(--text-faint)"
      }
    }, "\u25BC ", loserName, ":"), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, loserCombo)), e.p1Side && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, e.p1Name, ": ", e.p1Side, " \xB7 ", e.p2Name, ": ", e.p2Side), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        fontWeight: 600
      }
    }, e.p1Name, " ", e.p1Score, "\u2013", e.p2Score, " ", e.p2Name));
  }))), historyOpen && /*#__PURE__*/React.createElement("div", {
    onClick: () => setHistoryOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.2)",
      zIndex: 99
    }
  })));
}
function PinModal({
  title,
  subtitle,
  onSubmit,
  onCancel,
  error,
  loading
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const pressDigit = d => {
    setDigits(prev => {
      const filled = prev.filter(x => x !== "").length;
      if (filled >= 4) return prev;
      const next = [...prev];
      next[filled] = String(d);
      return next;
    });
  };
  const pressBack = () => {
    setDigits(prev => {
      const next = [...prev];
      for (let i = 3; i >= 0; i--) {
        if (next[i] !== "") {
          next[i] = "";
          break;
        }
      }
      return next;
    });
  };
  const pin = digits.join("");
  const ready = pin.length === 4;
  const handleSubmit = () => {
    if (ready && !loading) onSubmit(pin);
  };
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.8)",
      zIndex: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 20,
      padding: "24px 20px 20px",
      maxWidth: 300,
      width: "100%",
      boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: "0 0 4px",
      textAlign: "center"
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)",
      textAlign: "center",
      margin: "0 0 20px",
      lineHeight: 1.5
    }
  }, subtitle), !subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      justifyContent: "center",
      marginBottom: 16
    }
  }, digits.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: d ? "#EA580C" : "var(--border2)",
      transition: "background 0.1s",
      border: error ? "2px solid #EF4444" : "none"
    }
  }))), error && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "#EF4444",
      textAlign: "center",
      marginBottom: 12,
      fontWeight: 600
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 8,
      marginBottom: 14
    }
  }, keys.map((k, i) => {
    const isEmpty = k === "";
    const isBack = k === "⌫";
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: isEmpty ? undefined : isBack ? pressBack : () => pressDigit(k),
      disabled: loading || isEmpty,
      style: {
        height: 52,
        borderRadius: 12,
        border: isBack ? "2px solid var(--border2)" : "2px solid var(--border)",
        background: isEmpty ? "transparent" : isBack ? "var(--surface2)" : "var(--surface3)",
        color: isBack ? "var(--text-secondary)" : "var(--text-primary)",
        fontSize: isBack ? 20 : 22,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: isEmpty || loading ? "default" : "pointer",
        opacity: isEmpty ? 0 : 1
      }
    }, k);
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleSubmit,
    disabled: !ready || loading,
    style: {
      display: "block",
      width: "100%",
      padding: "13px 0",
      borderRadius: 12,
      border: "none",
      background: ready && !loading ? "#EA580C" : "var(--surface3)",
      color: ready && !loading ? "#fff" : "var(--text-disabled)",
      fontSize: 15,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: ready && !loading ? "pointer" : "not-allowed",
      marginBottom: 8
    }
  }, loading ? "Checking…" : "Confirm"), /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    disabled: loading,
    style: {
      display: "block",
      width: "100%",
      padding: "9px 0",
      borderRadius: 12,
      border: "2px solid var(--border)",
      background: "none",
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: loading ? "not-allowed" : "pointer"
    }
  }, "Cancel")));
}

/* ═══════════════════════════════════════
   ORGANIZER APP
═══════════════════════════════════════ */
function OrgConfirmUsername({
  auth
}) {
  if (auth.state === "wrong") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14,
        background: "var(--surface)",
        borderRadius: 14,
        padding: "16px",
        border: "2px solid var(--border2)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 6px"
      }
    }, "Switch Challonge accounts first"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        margin: "0 0 14px",
        lineHeight: 1.5
      }
    }, "Open ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--text-secondary)"
      }
    }, "challonge.com"), " in another tab, log out, then log into the correct account. Come back here when ready."), /*#__PURE__*/React.createElement("button", {
      onClick: auth.reset,
      style: {
        width: "100%",
        padding: "12px 0",
        borderRadius: 10,
        border: "none",
        background: "linear-gradient(135deg,#EA580C,#DC2626)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Try Again \u2192"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 14,
      padding: "16px",
      border: "2px solid #EA580C",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: "0 0 4px"
    }
  }, "Log in as this account?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 900,
      color: "#EA580C",
      margin: "0 0 14px"
    }
  }, auth.username), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: auth.confirm,
    style: {
      flex: 1,
      padding: "12px 0",
      borderRadius: 10,
      border: "none",
      background: "#EA580C",
      color: "#fff",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\u2713 Yes, that's me"), /*#__PURE__*/React.createElement("button", {
    onClick: auth.retry,
    style: {
      flex: 1,
      padding: "12px 0",
      borderRadius: 10,
      border: "2px solid var(--border2)",
      background: "none",
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\u2717 Wrong account"))));
}
function OrgApp({
  onSwitchRole
}) {
  const [slug, setSlug] = useState(() => ssGet(KEYS.orgResume, {}).slug || null); // active tournament slug
  const [tourneyName, setTourneyName] = useState(() => ssGet(KEYS.orgResume, {}).tourneyName || ""); // display name
  const [pings, setPings] = useState([]); // queued ping list
  const [activePing, setActivePing] = useState(null); // currently shown ping notification
  const [liveSlots, setLiveSlots] = useState([]); // active judged matches
  const [pairings, setPairings] = useState(null); // all matches for current round
  const [loadingPairings, setLoadingPairings] = useState(false);
  const [pairingsError, setPairingsError] = useState(null);
  const [scoreLog, setScoreLog] = useState([]); // judge accountability log entries
  const [scoreLogLoading, setScoreLogLoading] = useState(false);
  const [scoreLogOpen, setScoreLogOpen] = useState(false); // collapsed by default

  // ── Head judge management state ───────────────────────────────────
  const [headJudges, setHeadJudges] = useState([]);
  const [orgOwnerUsername, setOrgOwnerUsername] = useState(null); // the tournament owner
  const [hjLoading, setHjLoading] = useState(false);
  const [hjError, setHjError] = useState(null);
  const [newHJInput, setNewHJInput] = useState("");

  // ── Emergency ownership claim (master key only, shown when orgOwnerUsername is null) ─
  const [claimInput, setClaimInput] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState(null);

  // ── Judge whitelist state ─────────────────────────────────────────
  const [judgeWhitelist, setJudgeWhitelist] = useState([]); // usernames allowed to score
  const [jwLoading, setJwLoading] = useState(false);
  const [jwError, setJwError] = useState(null);
  const [jwInput, setJwInput] = useState(""); // textarea paste input

  // ── Stadium assignment state ──────────────────────────────────────────
  const [stadiumCount, setStadiumCount] = useState(null); // null = not set yet, 1-8 once chosen
  const [stadiumAssign, setStadiumAssign] = useState({}); // { challongeUsername: "A"|"B"|... }
  const [stadiumDragOver, setStadiumDragOver] = useState(null);
  const [stadiumSaving, setStadiumSaving] = useState(false);
  const [stadiumSaveMsg, setStadiumSaveMsg] = useState(null); // null | "saved" | "error"

  // ── Per-station queue state ────────────────────────────────────────
  // { "A": [matchId, matchId, ...], "B": [...], ... }
  // Match IDs in priority order — org can drag to reorder
  const [stationQueues, setStationQueues] = useState({});
  const [queueDragItem, setQueueDragItem] = useState(null); // { matchId, fromStation }
  const [queueDragOver, setQueueDragOver] = useState(null); // { station, afterIdx }
  const [queuesGenerated, setQueuesGenerated] = useState(false); // true once algo has run
  const [lockedMatchIds, setLockedMatchIds] = useState(new Set()); // match IDs locked in place
  const [judgesFirstMode, setJudgesFirstMode] = useState(true); // true=JvP wave1, false=JvP last
  const [moveMenuOpen, setMoveMenuOpen] = useState(null); // matchId currently showing move picker, or null

  // ── Judge name map state (global KV: Challonge username → bracket display name) ────
  const [judgeNameMap, setJudgeNameMap] = useState({}); // { "nghia2daizzo": "Nghia", ... }
  const [nameMapOpen, setNameMapOpen] = useState(false);
  const [nameMapLoading, setNameMapLoading] = useState(false);
  const [nameMapSaving, setNameMapSaving] = useState(false);
  const [nameMapError, setNameMapError] = useState(null);
  // Draft state while mapping tab is open — keyed by challonge username
  const [nameMapDraft, setNameMapDraft] = useState({}); // { username: bracketName | null }
  const [nameMapDragOver, setNameMapDragOver] = useState(null); // username slot being dragged over
  const [nameMapAssignMenu, setNameMapAssignMenu] = useState(null); // bracket name currently showing judge picker
  // Participants pulled for the current tournament (used as the bracket name pool)
  const [nameMapParticipants, setNameMapParticipants] = useState([]);

  // ── Login mode state ──────────────────────────────────────────────
  const [loginMode, setLoginMode] = useState(null); // null | "solo" | "duo"
  const [loginModeSaving, setLoginModeSaving] = useState(false);
  const [loginModeError, setLoginModeError] = useState(null);

  // Derived: get bracket display name for a Challonge username (from saved map)
  const getBracketName = challongeUsername => {
    if (!challongeUsername) return null;
    return judgeNameMap[challongeUsername.toLowerCase()] || null;
  };
  const STADIUM_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const STADIUM_COLORS = {
    A: {
      bg: "#0D9488",
      border: "#14B8A6",
      text: "#fff",
      faint: "#99F6E4"
    },
    B: {
      bg: "#7C3AED",
      border: "#8B5CF6",
      text: "#fff",
      faint: "#DDD6FE"
    },
    C: {
      bg: "#D97706",
      border: "#F59E0B",
      text: "#fff",
      faint: "#FDE68A"
    },
    D: {
      bg: "#DB2777",
      border: "#EC4899",
      text: "#fff",
      faint: "#FBCFE8"
    },
    E: {
      bg: "#2563EB",
      border: "#3B82F6",
      text: "#fff",
      faint: "#BFDBFE"
    },
    F: {
      bg: "#DC2626",
      border: "#EF4444",
      text: "#fff",
      faint: "#FECACA"
    },
    G: {
      bg: "#059669",
      border: "#10B981",
      text: "#fff",
      faint: "#A7F3D0"
    },
    H: {
      bg: "#9333EA",
      border: "#A855F7",
      text: "#fff",
      faint: "#E9D5FF"
    }
  };
  const getStadiumLetter = displayName => {
    if (!displayName) return null;
    const key = Object.keys(stadiumAssign).find(k => k.toLowerCase() === displayName.toLowerCase());
    return key ? stadiumAssign[key] : null;
  };
  const getStadiumColor = displayName => {
    const letter = getStadiumLetter(displayName);
    return letter ? STADIUM_COLORS[letter] : null;
  };

  // ── Roster refresh state ───────────────────────────────────────────
  const [rosterRefreshing, setRosterRefreshing] = useState(false);
  const [rosterRefreshMsg, setRosterRefreshMsg] = useState(null); // null | { ok: bool, text: string }
  const liveSlotRef = useRef(null);
  const pingPollRef = useRef(null);
  const loadHeadJudges = async s => {
    setHjLoading(true);
    setHjError(null);
    try {
      const res = await workerGet(`/judges/get?slug=${encodeURIComponent(s)}`);
      setHeadJudges(res.headJudges || []);
      setOrgOwnerUsername(res.orgUsername || null);
      setLoginMode(res.loginMode || null);
    } catch (e) {
      setHjError(e.message || "Failed to load head judges.");
    } finally {
      setHjLoading(false);
    }
  };
  const claimOwnership = async () => {
    if (!claimInput.trim() || !slug) return;
    setClaimLoading(true);
    setClaimError(null);
    try {
      const currentUser = (sessionStorage.getItem("ncblast-auth-user") || "").trim().toLowerCase();
      if (!currentUser) {
        setClaimError("No logged-in username found. Please re-login first.");
        return;
      }
      const res = await fetch(`${OVERLAY_WORKER}/org/tournament/set-owner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": claimInput.trim()
        },
        body: JSON.stringify({
          slug,
          orgUsername: currentUser
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Claim failed");
      setOrgOwnerUsername(data.orgUsername);
      setClaimInput("");
    } catch (e) {
      setClaimError(e.message || "Failed to claim ownership.");
    } finally {
      setClaimLoading(false);
    }
  };
  const saveHeadJudges = async newList => {
    const token = sessionStorage.getItem("ncblast-auth-token");
    setHjLoading(true);
    setHjError(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/judges/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token || ""
        },
        body: JSON.stringify({
          slug,
          headJudges: newList,
          username: sessionStorage.getItem("ncblast-auth-user")
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setHeadJudges(newList);
    } catch (e) {
      setHjError(e.message);
    } finally {
      setHjLoading(false);
    }
  };
  const loadJudgeWhitelist = async s => {
    setJwLoading(true);
    setJwError(null);
    try {
      const res = await workerGet(`/judge-whitelist/get?slug=${encodeURIComponent(s)}`);
      setJudgeWhitelist(res.usernames || []);
      setJwInput((res.usernames || []).join("\n"));
    } catch (e) {
      setJwError(e.message || "Failed to load judge whitelist.");
    } finally {
      setJwLoading(false);
    }
  };

  // Parse a raw participant array into a sorted name list
  const parseParticipantNames = participants => (participants || []).map(p => {
    const part = p.participant || p;
    return (part.display_name || part.username || part.name || "").trim();
  }).filter(Boolean).sort((a, b) => a.localeCompare(b));

  // Auto-load participant names into nameMapParticipants (uses KV cache — fast)
  const loadParticipants = async () => {
    if (!slug) return;
    try {
      const data = await workerGet(`/?slug=${encodeURIComponent(slug)}`);
      const names = parseParticipantNames(data.participants);
      setNameMapParticipants(names);
    } catch (_) {}
  };
  const refreshRoster = async () => {
    if (!slug) return;
    setRosterRefreshing(true);
    setRosterRefreshMsg(null);
    try {
      // Step 1: bust the participant KV cache — hits Challonge directly and rewrites KV
      const partRes = await fetch(`${OVERLAY_WORKER}/?slug=${encodeURIComponent(slug)}&bypass_cache=1`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!partRes.ok) throw new Error(`Participants fetch failed: HTTP ${partRes.status}`);
      const partData = await partRes.json();
      if (partData.fromCache) throw new Error("Worker still returned cached data — deploy may not have applied.");

      // Step 2: bust the pairings KV cache so name resolution uses the fresh participant list
      const pairRes = await fetch(`${OVERLAY_WORKER}/pairings?slug=${encodeURIComponent(slug)}&bypass_cache=1`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!pairRes.ok) throw new Error(`Pairings fetch failed: HTTP ${pairRes.status}`);
      const pairData = await pairRes.json();

      // Update local pairings state so org view reflects changes immediately
      setPairings(pairData.pairings || []);

      // Build the name list to display and store for name map use
      const names = parseParticipantNames(partData.participants);
      setNameMapParticipants(names);
      setRosterRefreshMsg({
        ok: true,
        names,
        count: names.length
      });
    } catch (e) {
      setRosterRefreshMsg({
        ok: false,
        text: e.message
      });
    } finally {
      setRosterRefreshing(false);
    }
  };

  // ── Stadium assignment load / save ───────────────────────────────────
  const loadStadiumAssign = async () => {
    if (!slug) return;
    try {
      const data = await workerGet(`/stadium-assign?slug=${encodeURIComponent(slug)}`);
      if (data.data) {
        if (data.data.count) setStadiumCount(data.data.count);
        if (data.data.assign) setStadiumAssign(data.data.assign);
      }
    } catch (_) {}
  };
  const saveStadiumAssign = async () => {
    const token = sessionStorage.getItem("ncblast-auth-token") || "";
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    setStadiumSaving(true);
    setStadiumSaveMsg(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/stadium-assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token
        },
        body: JSON.stringify({
          slug,
          count: stadiumCount,
          assign: stadiumAssign,
          username
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setStadiumSaveMsg("saved");
      setTimeout(() => setStadiumSaveMsg(null), 2500);
    } catch (e) {
      setStadiumSaveMsg("error");
    } finally {
      setStadiumSaving(false);
    }
  };

  // ── Judge name map fetch / save ──────────────────────────────────────
  const loadNameMap = async () => {
    setNameMapLoading(true);
    setNameMapError(null);
    try {
      const data = await workerGet("/judge-namemap");
      setJudgeNameMap(data.map || {});
    } catch (e) {
      setNameMapError("Failed to load name map");
    } finally {
      setNameMapLoading(false);
    }
  };
  const openNameMap = async () => {
    // nameMapParticipants is auto-loaded on slug mount; if still empty, try once more
    let parts = nameMapParticipants;
    if (!parts || parts.length === 0) {
      try {
        const data = await workerGet(`/?slug=${encodeURIComponent(slug)}`);
        parts = parseParticipantNames(data.participants);
        setNameMapParticipants(parts);
      } catch (_) {
        parts = [];
      }
    }
    setNameMapLoading(true);
    try {
      const data = await workerGet("/judge-namemap");
      const map = data.map || {};
      setJudgeNameMap(map);
      // Build draft: for each whitelisted judge, use saved mapping or null
      const draft = {};
      judgeWhitelist.forEach(u => {
        draft[u] = map[u.toLowerCase()] || null;
      });
      // Auto-match: exact case-insensitive match between username and a participant name
      judgeWhitelist.forEach(u => {
        if (!draft[u]) {
          const match = parts.find(p => p.toLowerCase() === u.toLowerCase());
          if (match) draft[u] = match; // suggestion — not yet saved
        }
      });
      setNameMapDraft(draft);
    } catch (e) {
      setNameMapError("Failed to load");
    } finally {
      setNameMapLoading(false);
      setNameMapOpen(true);
    }
  };
  const saveNameMap = async () => {
    const token = sessionStorage.getItem("ncblast-auth-token") || "";
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    setNameMapSaving(true);
    setNameMapError(null);
    try {
      // Only save entries that have a value
      const map = {};
      Object.entries(nameMapDraft).forEach(([u, v]) => {
        if (v) map[u.toLowerCase()] = v;
      });
      const res = await fetch(`${OVERLAY_WORKER}/judge-namemap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token
        },
        body: JSON.stringify({
          map,
          username
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setJudgeNameMap(data.map || {});
      // Also cache to localStorage so judges on this device get the update immediately
      try {
        localStorage.setItem("ncblast-judge-namemap", JSON.stringify(data.map || {}));
      } catch (_) {}
      setNameMapOpen(false);
    } catch (e) {
      setNameMapError(e.message);
    } finally {
      setNameMapSaving(false);
    }
  };
  const saveJudgeWhitelist = async () => {
    const usernames = jwInput.split(/[\n,]+/).map(u => u.trim().toLowerCase()).filter(Boolean);
    const token = sessionStorage.getItem("ncblast-auth-token") || "";
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    setJwLoading(true);
    setJwError(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/judge-whitelist/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token
        },
        body: JSON.stringify({
          slug,
          usernames,
          username
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setJudgeWhitelist(data.usernames);
      setJwInput(data.usernames.join("\n"));
    } catch (e) {
      setJwError(e.message);
    } finally {
      setJwLoading(false);
    }
  };
  const saveLoginMode = async mode => {
    if (!slug || !mode) return;
    const token = sessionStorage.getItem("ncblast-auth-token") || "";
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    setLoginModeSaving(true);
    setLoginModeError(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/tournament/set-login-mode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          loginMode: mode,
          token,
          username
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setLoginMode(mode);
    } catch (e) {
      setLoginModeError(e.message);
    } finally {
      setLoginModeSaving(false);
    }
  };
  useEffect(() => {
    if (!slug) return;
    // Load pairings and judge meta once
    const loadPairings = async () => {
      setLoadingPairings(true);
      setPairingsError(null);
      try {
        const data = await workerGet(`/pairings?slug=${encodeURIComponent(slug)}`);
        setPairings(data.pairings || []);
      } catch (e) {
        setPairingsError(e.message || "Failed to load pairings.");
        setPairings([]);
      } finally {
        setLoadingPairings(false);
      }
    };
    loadPairings();

    // Load judge accountability log
    const loadScoreLog = async () => {
      setScoreLogLoading(true);
      try {
        const data = await workerGet(`/scorelog/list?slug=${encodeURIComponent(slug)}`);
        setScoreLog((data.entries || []).slice().reverse()); // newest first
      } catch (_) {
        setScoreLog([]);
      } finally {
        setScoreLogLoading(false);
      }
    };
    loadScoreLog();
    loadHeadJudges(slug);
    loadJudgeWhitelist(slug);
    loadNameMap();
    loadParticipants();
    loadStadiumAssign();

    // Prune completed matches out of station queues.
    // Called whenever fresh pairings arrive, whether from the manual button or the poll.
    const pruneCompletedFromQueues = freshPairings => {
      const completeIds = new Set((freshPairings || []).filter(m => m.state === "complete").map(m => String(m.id)));
      if (completeIds.size === 0) return;
      setStationQueues(prev => {
        const next = {};
        Object.keys(prev).forEach(l => {
          next[l] = (prev[l] || []).filter(id => !completeIds.has(String(id)));
        });
        return next;
      });
      setLockedMatchIds(prev => {
        const n = new Set(prev);
        completeIds.forEach(id => n.delete(id));
        return n;
      });
    };

    // Poll live match slots AND fresh pairings every 5s so completed matches
    // disappear from the queue automatically without needing a manual refresh.
    const pollLive = async () => {
      try {
        const [liveData, pairData] = await Promise.all([workerGet("/overlay/all"), workerGet(`/pairings?slug=${encodeURIComponent(slug)}`).catch(() => null)]);
        if ((liveData.slots || []).length > 0) console.log("[BLAST] org liveSlots", liveData.slots);
        setLiveSlots(liveData.slots || []);
        if (pairData) {
          const freshPairings = pairData.pairings || [];
          setPairings(freshPairings);
          pruneCompletedFromQueues(freshPairings);
        }
      } catch (e) {
        console.error("[BLAST] pollLive failed", e);
      }
    };
    pollLive();
    liveSlotRef.current = setInterval(pollLive, 5000);

    // Poll judge presence every 15s

    // Long-poll for pings
    const pollPings = async () => {
      try {
        const data = await workerGet(`/pings/poll?slug=${encodeURIComponent(slug)}&after=${afterRef.current}`);
        const fresh = data.pings || [];
        if (fresh.length > 0) {
          // Move afterRef forward so we don't re-receive these
          afterRef.current = Math.max(...fresh.map(p => p.sentAt));
          setPings(prev => {
            // Deduplicate by id
            const ids = new Set(prev.map(p => p.id));
            return [...prev, ...fresh.filter(p => !ids.has(p.id))];
          });
        }
      } catch (_) {}
      // Immediately re-open the long-poll
      pingPollRef.current = setTimeout(pollPings, 2000);
    };
    pingPollRef.current = setTimeout(pollPings, 0);
    return () => {
      clearInterval(liveSlotRef.current);
      clearTimeout(pingPollRef.current);
    };
  }, [slug]);

  // ── When pings arrive, surface the first one if none showing ─────
  useEffect(() => {
    if (!activePing && pings.length > 0) {
      setActivePing(pings[0]);
    }
  }, [pings, activePing]);

  // ── Dismiss a ping ───────────────────────────────────────────────
  const dismissPing = async ping => {
    // Remove from local queue immediately
    setPings(prev => prev.filter(p => p.id !== ping.id));
    setActivePing(null);
    // Tell the server to remove it too (fire and forget)
    try {
      await fetch(`${OVERLAY_WORKER}/pings/dismiss`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          id: ping.id
        })
      });
    } catch (_) {}
  };

  // Poll for event deletion every 20s
  const [orgEventDeleted, setOrgEventDeleted] = React.useState(false);
  const orgDeletionRef = React.useRef(null);
  React.useEffect(() => {
    if (!slug) return;
    const check = async () => {
      try {
        const data = await workerGet("/list");
        const slugs = (data.tournaments || []).map(t => t.slug);
        if (!slugs.includes(slug)) setOrgEventDeleted(true);
      } catch (_) {}
    };
    orgDeletionRef.current = setInterval(check, 20000);
    return () => clearInterval(orgDeletionRef.current);
  }, [slug]);

  // ── Tournament select screen ──────────────────────────────────────
  if (!slug) {
    return /*#__PURE__*/React.createElement(OrgTournamentSelect, {
      onSelect: (s, name) => {
        setSlug(s);
        setTourneyName(name);
        ssSave(KEYS.orgResume, { slug: s, tourneyName: name });
      },
      onSwitchRole: onSwitchRole
    });
  }

  // ── Figure out the current round from pairings ───────────────────
  // Treat anything that isn't explicitly "complete" as still in play
  const openMatches = (pairings || []).filter(m => m.state !== "complete");
  // Use Number() to avoid type mismatches (KV/JSON can return strings or numbers)
  const openRoundNums = openMatches.map(m => m.round).filter(r => r != null && r !== 0 && isFinite(Number(r))).map(Number);
  const currentRound = openRoundNums.length > 0 ? Math.min(...openRoundNums) : null;
  // Show all matches in the current round (including completed ones in that round)
  // String comparison guards against "1" === 1 type mismatches
  let roundMatches = currentRound !== null ? (pairings || []).filter(m => String(m.round) === String(currentRound)) : pairings || [];
  // Safety fallback: if round filter yields nothing but open matches exist, show them
  if (roundMatches.length === 0 && openMatches.length > 0) roundMatches = openMatches;

  // Build live lookups: by Challonge match ID (exact, preferred) and by name pair (fallback)
  const liveByMatchId = {};
  const liveByPlayersOrg = {};
  liveSlots.forEach(s => {
    if (!s.state) return;
    if (s.state.challongeMatchId) {
      liveByMatchId[String(s.state.challongeMatchId)] = s.state;
    }
    const p1 = (s.state.p1 || "").toLowerCase().trim();
    const p2 = (s.state.p2 || "").toLowerCase().trim();
    if (p1 && p2) {
      const key = [p1, p2].sort().join("|");
      liveByPlayersOrg[key] = s.state;
    }
  });
  const getLiveState = m => {
    if (m.id && liveByMatchId[String(m.id)]) return liveByMatchId[String(m.id)];
    const key = [(m.player1_name || "").toLowerCase().trim(), (m.player2_name || "").toLowerCase().trim()].sort().join("|");
    return liveByPlayersOrg[key] || null;
  };
  const roundLabel = currentRound !== null ? currentRound < 0 ? `Top Cut Round ${Math.abs(currentRound)}` : `Swiss Round ${currentRound}` : pairings && pairings.length > 0 ? "All Matches" : "No matches loaded";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'Outfit',sans-serif",
      display: "flex",
      flexDirection: "column"
    }
  }, orgEventDeleted && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.85)",
      zIndex: 900,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 20,
      padding: "28px 22px",
      maxWidth: 320,
      width: "100%",
      boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      border: "2px solid #EF4444",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDDD1\uFE0F"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      fontWeight: 900,
      color: "var(--text-primary)",
      marginBottom: 8
    }
  }, "Event Removed"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-secondary)",
      marginBottom: 22,
      lineHeight: 1.5
    }
  }, "This tournament has been removed from the NC BLAST cache."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOrgEventDeleted(false);
      setSlug(null);
      setTourneyName("");
      ssClear(KEYS.orgResume);
    },
    style: {
      width: "100%",
      padding: "13px 0",
      borderRadius: 12,
      border: "none",
      background: "#EA580C",
      color: "#fff",
      fontSize: 15,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Back to Event Select"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onSwitchRole,
    style: {
      background: "none",
      border: "none",
      fontSize: 20,
      cursor: "pointer",
      lineHeight: 1,
      padding: "2px 4px"
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      margin: 0
    }
  }, "Organizer View"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, tourneyName || slug)), pings.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#DC2626",
      color: "#fff",
      borderRadius: "50%",
      width: 22,
      height: 22,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      fontWeight: 900,
      flexShrink: 0
    }
  }, pings.length), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setSlug(null);
      ssClear(KEYS.orgResume);
    },
    style: {
      background: "none",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "5px 10px",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\u21C4 Switch")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "16px 24px 40px",
      boxSizing: "border-box"
    }
  }, (() => {
    // Names shown: after a manual refresh use the fresh list, otherwise the auto-loaded list
    const displayNames = rosterRefreshMsg?.ok ? rosterRefreshMsg.names || [] : nameMapParticipants;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--surface2)",
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: 0
      }
    }, "Roster Sync"), displayNames.length > 0 && !rosterRefreshMsg && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        color: "var(--text-faint)",
        margin: "1px 0 0"
      }
    }, displayNames.length, " players from cache")), /*#__PURE__*/React.createElement("button", {
      onClick: refreshRoster,
      disabled: rosterRefreshing,
      style: {
        padding: "5px 12px",
        borderRadius: 8,
        border: "none",
        background: rosterRefreshing ? "var(--surface3)" : "#0F766E",
        color: rosterRefreshing ? "var(--text-muted)" : "#fff",
        fontSize: 11,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: rosterRefreshing ? "not-allowed" : "pointer"
      }
    }, rosterRefreshing ? "Refreshing…" : "↻ Refresh Roster")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: "0 0 8px",
        lineHeight: 1.5
      }
    }, "If players dropped or registered on Challonge after you imported this event, tap Refresh Roster to pull the latest list and update the pairings cache."), rosterRefreshMsg?.ok && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#22C55E",
        margin: "0 0 6px"
      }
    }, "\u2713 ", rosterRefreshMsg.count, " player", rosterRefreshMsg.count === 1 ? "" : "s", " synced from Challonge \u2014 KV updated"), rosterRefreshMsg && !rosterRefreshMsg.ok && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#EF4444",
        margin: "0 0 6px"
      }
    }, "\u26A0 ", rosterRefreshMsg.text), displayNames.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4
      }
    }, displayNames.map(n => /*#__PURE__*/React.createElement("span", {
      key: n,
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-secondary)",
        background: "var(--surface3)",
        borderRadius: 6,
        padding: "2px 7px"
      }
    }, n))), displayNames.length === 0 && !rosterRefreshing && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-faint)",
        margin: 0,
        fontStyle: "italic"
      }
    }, "No roster loaded yet \u2014 tap Refresh Roster."));
  })(), (() => {
    const currentUser = (() => {
      try {
        return (sessionStorage.getItem("ncblast-auth-user") || "").toLowerCase();
      } catch (_) {
        return "";
      }
    })();
    const isOwner = orgOwnerUsername && currentUser === orgOwnerUsername.toLowerCase();
    // Build participant name list from pairings data
    const rosterNames = [...new Set((pairings || []).flatMap(m => [m.player1_name, m.player2_name].filter(Boolean)))].sort();
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 16,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--surface2)",
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: 0
      }
    }, "Head Judges"), orgOwnerUsername && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: 0
      }
    }, "Organizer: ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: currentUser === orgOwnerUsername.toLowerCase() ? "#22C55E" : "var(--text-muted)"
      }
    }, orgOwnerUsername), currentUser === orgOwnerUsername.toLowerCase() && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#22C55E"
      }
    }, " \u2713")), !orgOwnerUsername && !hjLoading && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "#F59E0B",
        margin: 0,
        fontWeight: 700
      }
    }, "\u26A0 No owner recorded")), !orgOwnerUsername && !hjLoading && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#78350F20",
        border: "1px solid #F59E0B60",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "#92400E",
        fontWeight: 700,
        margin: "0 0 4px"
      }
    }, "\u26A0 No organizer on record"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "#92400E",
        margin: "0 0 10px",
        lineHeight: 1.5
      }
    }, "This event has no recorded organizer. You can claim ownership using the master key \u2014 your logged-in Challonge username will be set as organizer."), claimError && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "#EF4444",
        margin: "0 0 6px",
        fontWeight: 700
      }
    }, "\u26A0 ", claimError), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: claimInput,
      onChange: e => setClaimInput(e.target.value),
      placeholder: "Enter master key\u2026",
      type: "password",
      style: {
        flex: 1,
        padding: "8px 10px",
        borderRadius: 9,
        border: "1px solid #F59E0B",
        background: "var(--input-bg)",
        color: "var(--text-primary)",
        fontSize: 12,
        fontFamily: "'Outfit',sans-serif",
        outline: "none"
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: claimOwnership,
      disabled: claimLoading || !claimInput.trim(),
      style: {
        padding: "0 14px",
        borderRadius: 9,
        border: "none",
        background: "#D97706",
        color: "#fff",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: claimLoading || !claimInput.trim() ? "not-allowed" : "pointer",
        opacity: claimLoading || !claimInput.trim() ? 0.5 : 1,
        flexShrink: 0
      }
    }, claimLoading ? "…" : "Claim"))), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: "0 0 10px",
        lineHeight: 1.5
      }
    }, "Can access Organizer View for this event. Only the tournament owner can manage this list."), hjLoading && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, "Saving\u2026"), hjError && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "#EF4444",
        marginBottom: 6
      }
    }, "\u26A0 ", hjError), headJudges.length === 0 && !hjLoading && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-faint)",
        marginBottom: 8
      }
    }, "No head judges set."), headJudges.map(u => /*#__PURE__*/React.createElement("div", {
      key: u,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 10px",
        borderRadius: 8,
        background: "var(--surface)",
        marginBottom: 5,
        border: "1.5px solid var(--border2)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, u), isOwner && /*#__PURE__*/React.createElement("button", {
      onClick: () => saveHeadJudges(headJudges.filter(x => x !== u)),
      disabled: hjLoading,
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#EF4444",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 6px"
      }
    }, "Remove"))), isOwner && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, rosterNames.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 6px"
      }
    }, "Add from roster"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 10
      }
    }, rosterNames.filter(n => !headJudges.includes(n.toLowerCase())).map(n => /*#__PURE__*/React.createElement("button", {
      key: n,
      onClick: () => {
        const u = n.toLowerCase();
        if (!headJudges.includes(u)) saveHeadJudges([...headJudges, u]);
      },
      disabled: hjLoading,
      style: {
        padding: "6px 12px",
        borderRadius: 9,
        border: "1.5px solid var(--border2)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "+ ", n)), rosterNames.filter(n => !headJudges.includes(n.toLowerCase())).length === 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-faint)",
        margin: 0
      }
    }, "All roster players are already head judges."))), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 6px"
      }
    }, "Add by Challonge username"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: newHJInput,
      onChange: e => setNewHJInput(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter" && newHJInput.trim()) {
          const u = newHJInput.trim().toLowerCase();
          if (!headJudges.includes(u)) saveHeadJudges([...headJudges, u]);
          setNewHJInput("");
        }
      },
      placeholder: "challonge username",
      style: {
        flex: 1,
        padding: "8px 10px",
        borderRadius: 9,
        border: "1px solid var(--border2)",
        background: "var(--input-bg)",
        color: "var(--text-primary)",
        fontSize: 12,
        fontFamily: "'Outfit',sans-serif",
        outline: "none"
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const u = newHJInput.trim().toLowerCase();
        if (u && !headJudges.includes(u)) saveHeadJudges([...headJudges, u]);
        setNewHJInput("");
      },
      disabled: !newHJInput.trim() || hjLoading,
      style: {
        padding: "0 12px",
        borderRadius: 9,
        border: "none",
        background: "#22C55E",
        color: "#fff",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Add"))), !isOwner && orgOwnerUsername && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        marginTop: 6,
        fontStyle: "italic"
      }
    }, "Only ", orgOwnerUsername, " can edit this list."));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
      gap: 12,
      marginBottom: 14,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      borderRadius: 14,
      padding: "16px 14px",
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: "0 0 4px"
    }
  }, "Judge Login Mode"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-muted)",
      margin: "0 0 12px",
      lineHeight: 1.5
    }
  }, "Choose how judges log in at this event. ", /*#__PURE__*/React.createElement("strong", null, "Solo"), " \u2014 each judge uses their own device and Challonge account. ", /*#__PURE__*/React.createElement("strong", null, "Duo"), " \u2014 two judges share one tablet per station, no individual Challonge logins needed."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 8
    }
  }, [["solo", "📱", "Solo Device", "One judge, one device"], ["duo", "💊", "Duo Tablet", "Two judges share a tablet"]].map(([mode, icon, title, sub]) => /*#__PURE__*/React.createElement("button", {
    key: mode,
    onClick: () => {
      if (loginMode !== mode) saveLoginMode(mode);
    },
    disabled: loginModeSaving || !orgOwnerUsername,
    style: {
      padding: "12px 8px",
      borderRadius: 12,
      cursor: loginModeSaving || !orgOwnerUsername ? "not-allowed" : "pointer",
      fontFamily: "'Outfit',sans-serif",
      textAlign: "center",
      border: `2px solid ${loginMode === mode ? "#3B82F6" : "var(--border2)"}`,
      background: loginMode === mode ? "#3B82F60F" : "var(--surface2)",
      opacity: loginModeSaving || !orgOwnerUsername ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      marginBottom: 4
    }
  }, icon), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: loginMode === mode ? "#3B82F6" : "var(--text-primary)",
      margin: "0 0 2px"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-muted)",
      margin: 0
    }
  }, sub), loginMode === mode && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      color: "#3B82F6",
      margin: "4px 0 0",
      letterSpacing: 0.5
    }
  }, "ACTIVE")))), loginModeError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#EF4444",
      margin: "4px 0 0"
    }
  }, "\u26A0 ", loginModeError), !loginMode && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "#F59E0B",
      margin: "4px 0 0"
    }
  }, "\u26A0 No mode set \u2014 judges will be prompted to choose at login."), !orgOwnerUsername && !hjLoading && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-faint)",
      margin: "6px 0 0",
      fontStyle: "italic"
    }
  }, "Only the tournament owner can change this.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      borderRadius: 14,
      padding: "16px 14px",
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: "0 0 4px"
    }
  }, "Judge Whitelist"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-muted)",
      margin: "0 0 10px",
      lineHeight: 1.5
    }
  }, "Only judges on this list can log in and score matches. One Challonge username per line. Only the tournament organizer can save changes."), !orgOwnerUsername && !hjLoading && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#78350F20",
      border: "1px solid #F59E0B60",
      borderRadius: 8,
      padding: "8px 10px",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "#92400E",
      fontWeight: 700,
      margin: "0 0 2px"
    }
  }, "Editing unavailable \u2014 no owner recorded"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "#92400E",
      margin: 0,
      lineHeight: 1.5
    }
  }, "Use the \"Claim Ownership\" tool in the Head Judges section above to restore access.")), jwLoading && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      margin: "0 0 6px"
    }
  }, "Saving\u2026"), jwError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#EF4444",
      margin: "0 0 6px"
    }
  }, "\u26A0 ", jwError), judgeWhitelist.length === 0 && !jwLoading && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      margin: "0 0 8px"
    }
  }, "No judges whitelisted \u2014 all logins will be blocked."), judgeWhitelist.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10
    }
  }, judgeWhitelist.map(u => /*#__PURE__*/React.createElement("div", {
    key: u,
    style: {
      padding: "4px 10px",
      borderRadius: 20,
      background: "var(--surface)",
      border: "1.5px solid var(--border2)",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-secondary)"
    }
  }, u))), /*#__PURE__*/React.createElement("textarea", {
    value: jwInput,
    onChange: e => setJwInput(e.target.value),
    placeholder: "challongeusername1\nchallongeusername2\nchallongeusername3",
    rows: 4,
    style: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 9,
      border: "1px solid var(--border2)",
      background: "var(--input-bg)",
      color: "var(--text-primary)",
      fontSize: 12,
      fontFamily: "'Outfit',sans-serif",
      outline: "none",
      resize: "vertical",
      boxSizing: "border-box",
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: saveJudgeWhitelist,
    disabled: jwLoading || !orgOwnerUsername,
    style: {
      flex: 2,
      padding: "9px 0",
      borderRadius: 9,
      border: "none",
      background: "#3B82F6",
      color: "#fff",
      fontSize: 12,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: jwLoading || !orgOwnerUsername ? "not-allowed" : "pointer",
      opacity: jwLoading || !orgOwnerUsername ? 0.4 : 1
    }
  }, "Save Whitelist"), judgeWhitelist.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => openNameMap(),
    style: {
      flex: 1,
      padding: "9px 0",
      borderRadius: 9,
      border: "2px solid var(--border2)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: 12,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\uD83D\uDD17 Name Map"))), nameMapOpen && (() => {
    const allParticipants = nameMapParticipants; // populated on mount
    // Which bracket names are already claimed in the draft
    const claimed = new Set(Object.values(nameMapDraft).filter(Boolean));
    // Unmatched bracket names (available to drag from)
    const unmatched = allParticipants.filter(p => !claimed.has(p));
    const handleDragStartName = (e, bracketName) => {
      e.dataTransfer.setData("text/plain", bracketName);
    };
    const handleDropOnJudge = (e, judgeUsername) => {
      e.preventDefault();
      const bracketName = e.dataTransfer.getData("text/plain");
      if (!bracketName) return;
      setNameMapDraft(prev => {
        const next = {
          ...prev
        };
        // If this bracketName is already assigned to another judge, clear it there first
        Object.keys(next).forEach(u => {
          if (next[u] === bracketName) next[u] = null;
        });
        next[judgeUsername] = bracketName;
        return next;
      });
      setNameMapDragOver(null);
    };
    const handleDropOnPool = e => {
      e.preventDefault();
      const bracketName = e.dataTransfer.getData("text/plain");
      if (!bracketName) return;
      setNameMapDraft(prev => {
        const next = {
          ...prev
        };
        Object.keys(next).forEach(u => {
          if (next[u] === bracketName) next[u] = null;
        });
        return next;
      });
      setNameMapDragOver(null);
    };
    const handleDragOver = (e, target) => {
      e.preventDefault();
      setNameMapDragOver(target);
    };
    const handleDragLeave = () => setNameMapDragOver(null);
    const allMapped = judgeWhitelist.every(u => !!nameMapDraft[u]);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 600,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "20px 16px",
        overflowY: "auto"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 18,
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "16px 18px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 1,
        margin: "0 0 2px"
      }
    }, "Global \u2014 persists across events"), /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: 18,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: 0
      }
    }, "Judge Name Mapping"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        margin: "4px 0 0",
        lineHeight: 1.5
      }
    }, "Link each judge's Challonge login to their bracket display name. Drag a bracket name onto a judge row to assign it.")), /*#__PURE__*/React.createElement("button", {
      onClick: () => setNameMapOpen(false),
      style: {
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        cursor: "pointer",
        fontSize: 22,
        fontFamily: "'Outfit',sans-serif",
        paddingTop: 2,
        flexShrink: 0
      }
    }, "\xD7")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "14px 18px 18px"
      }
    }, nameMapError && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "#EF4444",
        margin: "0 0 8px"
      }
    }, "\u26A0 ", nameMapError), nameMapLoading && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        margin: "0 0 8px"
      }
    }, "Loading\u2026"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 6px"
      }
    }, "Bracket Names \u2014 drag onto a judge row"), /*#__PURE__*/React.createElement("div", {
      onDrop: handleDropOnPool,
      onDragOver: e => {
        e.preventDefault();
        setNameMapDragOver("__pool__");
      },
      onDragLeave: handleDragLeave,
      style: {
        minHeight: 44,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 10,
        border: `2px dashed ${nameMapDragOver === "__pool__" ? "var(--text-muted)" : "var(--border)"}`,
        background: nameMapDragOver === "__pool__" ? "var(--surface2)" : "transparent",
        marginBottom: 14,
        transition: "background 0.15s"
      }
    }, unmatched.length === 0 && allMapped && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: "auto 0",
        fontStyle: "italic"
      }
    }, "All names assigned \u2014 drag here to unassign"), unmatched.length === 0 && !allMapped && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: "auto 0",
        fontStyle: "italic"
      }
    }, "No bracket names loaded \u2014 check tournament connection"), unmatched.map(p => {
      const isAssignOpen = nameMapAssignMenu === p;
      const unmappedJudges = judgeWhitelist.filter(u => !nameMapDraft[u]);
      return /*#__PURE__*/React.createElement("div", {
        key: p,
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: "4px 10px 4px 14px",
          borderRadius: isAssignOpen ? '20px 20px 6px 6px' : '20px',
          background: "var(--surface2)",
          border: "1.5px solid var(--border2)"
        }
      }, /*#__PURE__*/React.createElement("span", {
        draggable: true,
        onDragStart: e => handleDragStartName(e, p),
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-primary)",
          cursor: "grab",
          userSelect: "none",
          flex: 1
        }
      }, p), /*#__PURE__*/React.createElement("button", {
        onClick: () => setNameMapAssignMenu(isAssignOpen ? null : p),
        style: {
          background: isAssignOpen ? '#3B82F6' : 'none',
          border: `1px solid ${isAssignOpen ? '#3B82F6' : 'var(--border2)'}`,
          borderRadius: 5,
          padding: '2px 6px',
          cursor: 'pointer',
          fontSize: 9,
          fontWeight: 800,
          color: isAssignOpen ? '#fff' : 'var(--text-faint)',
          fontFamily: "'Outfit',sans-serif",
          flexShrink: 0
        }
      }, isAssignOpen ? '✕' : 'Assign →')), isAssignOpen && /*#__PURE__*/React.createElement("div", {
        style: {
          background: 'var(--surface)',
          border: '1.5px solid var(--border2)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--text-faint)',
          margin: '0 0 3px',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        }
      }, "Assign to judge:"), unmappedJudges.length === 0 && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: 'var(--text-faint)',
          fontStyle: 'italic',
          margin: 0
        }
      }, "All judges already have a name assigned"), unmappedJudges.map(u => /*#__PURE__*/React.createElement("button", {
        key: u,
        onClick: () => {
          setNameMapDraft(prev => ({
            ...prev,
            [u]: p
          }));
          setNameMapAssignMenu(null);
        },
        style: {
          padding: '5px 10px',
          borderRadius: 7,
          border: '1px solid var(--border2)',
          background: 'var(--surface2)',
          color: 'var(--text-primary)',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: 'pointer',
          textAlign: 'left'
        }
      }, u))));
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 8px"
      }
    }, "Judges"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 16
      }
    }, judgeWhitelist.map(u => {
      const mapped = nameMapDraft[u] || null;
      const savedMapped = judgeNameMap[u.toLowerCase()] || null;
      const isAutoMatch = !savedMapped && mapped; // suggested but not yet saved
      const isOver = nameMapDragOver === u;
      return /*#__PURE__*/React.createElement("div", {
        key: u,
        onDrop: e => handleDropOnJudge(e, u),
        onDragOver: e => handleDragOver(e, u),
        onDragLeave: handleDragLeave,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          borderRadius: 10,
          border: `2px solid ${isOver ? "#3B82F6" : mapped ? "var(--border2)" : "var(--border)"}`,
          background: isOver ? "#3B82F620" : mapped ? "var(--surface2)" : "var(--surface)",
          transition: "background 0.12s, border-color 0.12s"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: "0 0 auto",
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-secondary)",
          margin: 0,
          whiteSpace: "nowrap"
        }
      }, u), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 9,
          color: "var(--text-faint)",
          margin: 0
        }
      }, "Challonge")), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: "var(--text-faint)",
          flexShrink: 0
        }
      }, "\u2192"), mapped ? /*#__PURE__*/React.createElement("div", {
        draggable: true,
        onDragStart: e => handleDragStartName(e, mapped),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flex: 1,
          padding: "4px 10px",
          borderRadius: 20,
          background: isAutoMatch ? "#FEF3C7" : "#1E3A5F",
          border: `1.5px solid ${isAutoMatch ? "#F59E0B" : "#3B82F6"}`,
          cursor: "grab",
          userSelect: "none"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: isAutoMatch ? "#78350F" : "#93C5FD",
          flex: 1
        }
      }, mapped), isAutoMatch && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          fontWeight: 800,
          color: "#92400E",
          letterSpacing: 0.5
        }
      }, "AUTO"), /*#__PURE__*/React.createElement("button", {
        onClick: () => setNameMapDraft(prev => ({
          ...prev,
          [u]: null
        })),
        style: {
          background: "none",
          border: "none",
          color: isAutoMatch ? "#92400E" : "#60A5FA",
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
          padding: 0,
          fontFamily: "'Outfit',sans-serif"
        }
      }, "\xD7")) : /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          padding: "6px 10px",
          borderRadius: 20,
          border: `2px dashed ${isOver ? "#3B82F6" : "var(--border)"}`,
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: "var(--text-faint)",
          margin: 0,
          fontStyle: "italic"
        }
      }, "Drop bracket name here")));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setNameMapOpen(false),
      style: {
        flex: 1,
        padding: "11px 0",
        borderRadius: 10,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Cancel"), /*#__PURE__*/React.createElement("button", {
      onClick: saveNameMap,
      disabled: nameMapSaving,
      style: {
        flex: 2,
        padding: "11px 0",
        borderRadius: 10,
        border: "none",
        background: nameMapSaving ? "var(--border2)" : "#3B82F6",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: nameMapSaving ? "not-allowed" : "pointer"
      }
    }, nameMapSaving ? "Saving…" : "💾 Save Name Map")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: "8px 0 0",
        textAlign: "center",
        lineHeight: 1.5
      }
    }, "Saved globally \u2014 carries over to future events automatically."))));
  })(), judgeWhitelist.length > 0 && (() => {
    const activeMatcher = name => {
      if (!name) return false;
      const nl = name.toLowerCase();
      return judgeWhitelist.some(u => u.toLowerCase() === nl);
    };
    const stadiumLetters = STADIUM_LABELS.slice(0, stadiumCount || 0);
    // Names not yet assigned to any stadium
    const assigned = new Set(Object.values(stadiumAssign));
    const unassigned = judgeWhitelist.filter(u => !stadiumAssign[u]);
    const handleDragStart = (e, name) => {
      e.dataTransfer.setData("text/plain", name);
    };
    const handleDrop = (e, bucket) => {
      e.preventDefault();
      const name = e.dataTransfer.getData("text/plain");
      if (!name) return;
      setStadiumAssign(prev => ({
        ...prev,
        [name]: bucket
      }));
      setStadiumDragOver(null);
    };
    const handleDropUnassigned = e => {
      e.preventDefault();
      const name = e.dataTransfer.getData("text/plain");
      if (!name) return;
      setStadiumAssign(prev => {
        const next = {
          ...prev
        };
        delete next[name];
        return next;
      });
      setStadiumDragOver(null);
    };
    const handleDragOver = (e, bucket) => {
      e.preventDefault();
      setStadiumDragOver(bucket);
    };
    const handleDragLeave = () => setStadiumDragOver(null);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--card)",
        borderRadius: 14,
        padding: "16px 14px",
        marginBottom: 14,
        border: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 1px"
      }
    }, "Stadium Assignment"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: 0
      }
    }, "Drag judges into their stadium. Judge names are highlighted in matches.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        alignItems: "center",
        flexShrink: 0
      }
    }, stadiumSaveMsg === "saved" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "#22C55E"
      }
    }, "\u2713 Saved"), stadiumSaveMsg === "error" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "#EF4444"
      }
    }, "\u26A0 Failed"), stadiumCount && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      onClick: saveStadiumAssign,
      disabled: stadiumSaving,
      style: {
        background: "#3B82F6",
        border: "none",
        borderRadius: 8,
        padding: "4px 11px",
        fontSize: 10,
        fontWeight: 800,
        color: "#fff",
        fontFamily: "'Outfit',sans-serif",
        cursor: stadiumSaving ? "not-allowed" : "pointer",
        opacity: stadiumSaving ? 0.5 : 1
      }
    }, stadiumSaving ? "…" : "Save"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setStadiumCount(null);
        setStadiumAssign({});
        setStadiumSaveMsg(null);
      },
      style: {
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "4px 9px",
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Reset")))), !stadiumCount && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-secondary)",
        margin: "0 0 8px"
      }
    }, "How many stadiums are you running?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }
    }, [1, 2, 3, 4, 5, 6, 7, 8].map(n => /*#__PURE__*/React.createElement("button", {
      key: n,
      onClick: () => setStadiumCount(n),
      style: {
        width: 38,
        height: 38,
        borderRadius: 10,
        border: "2px solid var(--border2)",
        background: "var(--surface)",
        color: "var(--text-primary)",
        fontSize: 16,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, n)))), stadiumCount && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 6px"
      }
    }, "Judges"), /*#__PURE__*/React.createElement("div", {
      onDrop: handleDropUnassigned,
      onDragOver: e => {
        e.preventDefault();
        setStadiumDragOver("__unassigned__");
      },
      onDragLeave: handleDragLeave,
      style: {
        minHeight: 38,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 10,
        border: `2px dashed ${stadiumDragOver === "__unassigned__" ? "var(--text-muted)" : "var(--border)"}`,
        background: stadiumDragOver === "__unassigned__" ? "var(--surface2)" : "transparent",
        marginBottom: 14,
        transition: "background 0.15s"
      }
    }, unassigned.length === 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: "auto 0",
        fontStyle: "italic"
      }
    }, "All judges assigned \u2014 drag here to unassign"), unassigned.map(u => {
      const bracketName = judgeNameMap[u.toLowerCase()];
      return /*#__PURE__*/React.createElement("div", {
        key: u,
        draggable: true,
        onDragStart: e => handleDragStart(e, u),
        style: {
          padding: "5px 12px",
          borderRadius: 20,
          background: "var(--surface)",
          border: "1.5px solid var(--border2)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-secondary)",
          cursor: "grab",
          userSelect: "none"
        }
      }, bracketName || u, bracketName && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          color: "var(--text-faint)",
          fontWeight: 500,
          marginLeft: 4
        }
      }, "(", u, ")"));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
        gap: 8
      }
    }, stadiumLetters.map(letter => {
      const sc = STADIUM_COLORS[letter];
      const membersInBucket = judgeWhitelist.filter(u => stadiumAssign[u] === letter);
      const isOver = stadiumDragOver === letter;
      return /*#__PURE__*/React.createElement("div", {
        key: letter,
        onDrop: e => handleDrop(e, letter),
        onDragOver: e => handleDragOver(e, letter),
        onDragLeave: handleDragLeave,
        style: {
          borderRadius: 10,
          padding: "8px 10px",
          minHeight: 60,
          border: `2px solid ${isOver ? sc.border : sc.bg + "60"}`,
          background: isOver ? sc.bg + "25" : sc.bg + "12",
          transition: "background 0.15s, border-color 0.15s"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          fontWeight: 800,
          color: sc.bg,
          margin: "0 0 6px",
          letterSpacing: 0.8
        }
      }, "STADIUM ", letter), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 5
        }
      }, membersInBucket.length === 0 && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: sc.bg + "90",
          margin: 0,
          fontStyle: "italic"
        }
      }, "Drop here"), membersInBucket.map(u => {
        const bracketName = judgeNameMap[u.toLowerCase()];
        return /*#__PURE__*/React.createElement("div", {
          key: u,
          draggable: true,
          onDragStart: e => handleDragStart(e, u),
          style: {
            padding: "3px 8px",
            borderRadius: 20,
            background: sc.bg,
            border: `1.5px solid ${sc.border}`,
            fontSize: 10,
            fontWeight: 700,
            color: sc.text,
            cursor: "grab",
            userSelect: "none",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        }, bracketName || u);
      })));
    }))));
  })()), /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: 1,
      margin: 0
    }
  }, "Current Round"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 18,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0
    }
  }, roundLabel)), /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      setLoadingPairings(true);
      try {
        const [pairData, liveData] = await Promise.all([workerGet(`/pairings?slug=${encodeURIComponent(slug)}&bypass_cache=1`), workerGet(`/overlay/all`).catch(() => ({
          slots: []
        }))]);
        const freshPairings = pairData.pairings || [];
        setPairings(freshPairings);
        setLiveSlots(liveData.slots || []);
        // Prune completed matches from queues so they stop reappearing
        const completeIds = new Set(freshPairings.filter(m => m.state === 'complete').map(m => String(m.id)));
        if (completeIds.size > 0) {
          setStationQueues(prev => {
            const next = {};
            Object.keys(prev).forEach(l => {
              next[l] = (prev[l] || []).filter(id => !completeIds.has(String(id)));
            });
            return next;
          });
          setLockedMatchIds(prev => {
            const n = new Set(prev);
            completeIds.forEach(id => n.delete(id));
            return n;
          });
        }
      } catch (_) {} finally {
        setLoadingPairings(false);
      }
    },
    disabled: loadingPairings,
    style: {
      background: "none",
      border: "2px solid var(--border)",
      borderRadius: 8,
      padding: "5px 10px",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, loadingPairings ? "…" : "↻")), roundMatches.length > 0 && (() => {
    const judgedCount = roundMatches.filter(m => getLiveState(m) !== null).length;
    const doneCount = roundMatches.filter(m => m.state === "complete").length;
    const openCount = roundMatches.filter(m => m.state !== "complete").length;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 14
      }
    }, [{
      label: "Total",
      val: roundMatches.length,
      color: "var(--text-secondary)"
    }, {
      label: "Live",
      val: judgedCount,
      color: "#22C55E"
    }, {
      label: "Waiting",
      val: openCount - judgedCount,
      color: "#F59E0B"
    }, {
      label: "Done",
      val: doneCount,
      color: "var(--text-faint)"
    }].map(s => /*#__PURE__*/React.createElement("div", {
      key: s.label,
      style: {
        flex: 1,
        padding: "8px 0",
        borderRadius: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 18,
        fontWeight: 900,
        color: s.color,
        margin: 0
      }
    }, s.val), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        color: "var(--text-faint)",
        fontWeight: 700,
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: 0.5
      }
    }, s.label))));
  })(), loadingPairings && !pairings && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13
    }
  }, "Loading matches\u2026"), pairingsError && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "24px 0"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#EF4444",
      fontWeight: 600,
      marginBottom: 8
    }
  }, "\u26A0 ", pairingsError), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)"
    }
  }, "Check that the slug is correct and the tournament is public on Challonge.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
      gap: 8,
      marginBottom: 4
    }
  }, roundMatches.map(m => {
    const live = getLiveState(m);
    const done = m.state === "complete";
    const isShuffling = live && !!live.shuffling;
    const borderColor = live ? "#22C55E" : done ? "var(--border)" : "var(--border2)";
    const bgColor = live ? "#22C55E0A" : "var(--surface)";

    // Judge-player warning: highlight player names that belong to judges
    // Match by mapped bracket name first, fall back to raw Challonge username
    const isJudgeByName = displayName => {
      if (!displayName) return false;
      const dl = displayName.toLowerCase();
      return judgeWhitelist.some(u => {
        const mapped = judgeNameMap[u.toLowerCase()];
        return mapped ? mapped.toLowerCase() === dl : u.toLowerCase() === dl;
      });
    };
    const p1IsJudge = isJudgeByName(m.player1_name);
    const p2IsJudge = isJudgeByName(m.player2_name);

    // Stadium colors for players (by display name)
    const p1Color = getStadiumColor(m.player1_name);
    const p2Color = getStadiumColor(m.player2_name);

    // Helper: render a player name with judge highlight and optional stadium badge
    const renderPlayerName = (name, isJudge, stColor) => {
      if (!name) return /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-faint)"
        }
      }, "?");
      return /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 4
        }
      }, stColor && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          fontWeight: 900,
          padding: "1px 5px",
          borderRadius: 6,
          background: stColor.bg,
          color: stColor.text,
          letterSpacing: 0.5
        }
      }, getStadiumLetter(name)), /*#__PURE__*/React.createElement("span", {
        style: {
          color: isJudge ? "#F59E0B" : "var(--text-primary)",
          fontWeight: isJudge ? 900 : 800
        }
      }, name), isJudge && /*#__PURE__*/React.createElement("span", {
        title: "This player is also a judge",
        style: {
          fontSize: 10
        }
      }, "\u2696\uFE0F"));
    };

    // Judge chip color based on stadium assignment
    const judgeStColor = live?.judge ? getStadiumColor(live.judge) : null;
    const judgeStLetter = live?.judge ? getStadiumLetter(live.judge) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      style: {
        borderRadius: 12,
        marginBottom: 8,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        padding: "11px 13px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 3
      }
    }, live && !isShuffling && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "live-dot"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        color: "#22C55E",
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "LIVE")), isShuffling && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        color: "#F59E0B",
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "\u23F1 SHUFFLE TIME"), done && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "Complete"), !live && !done && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: "#F59E0B",
        textTransform: "uppercase",
        letterSpacing: 0.8
      }
    }, "Waiting")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, renderPlayerName(m.player1_name, p1IsJudge, p1Color), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-faint)",
        fontWeight: 400
      }
    }, " vs "), renderPlayerName(m.player2_name, p2IsJudge, p2Color)), live && !isShuffling && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 5,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        padding: "2px 9px",
        borderRadius: 8,
        background: "#1E3A5F",
        color: "#60A5FA",
        border: "1.5px solid #2563EB",
        lineHeight: 1.3
      }
    }, (live.sets || [0, 0])[0]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)"
      }
    }, "\u2013"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        padding: "2px 9px",
        borderRadius: 8,
        background: "#450A0A",
        color: "#F87171",
        border: "1.5px solid #DC2626",
        lineHeight: 1.3
      }
    }, (live.sets || [0, 0])[1]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-faint)",
        marginLeft: 3
      }
    }, "sets")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#22C55E"
      }
    }, (live.pts || [0, 0])[0], "\u2013", (live.pts || [0, 0])[1], " pts"), live.judge && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: judgeStColor ? judgeStColor.bg : "var(--text-muted)"
      }
    }, "\u2696\uFE0F", judgeStLetter ? ` [${judgeStLetter}]` : "", " ", live.judge)), isShuffling && live && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 5,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        padding: "2px 9px",
        borderRadius: 8,
        background: "#1E3A5F",
        color: "#60A5FA",
        border: "1.5px solid #2563EB",
        lineHeight: 1.3
      }
    }, (live.sets || [0, 0])[0]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)"
      }
    }, "\u2013"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        padding: "2px 9px",
        borderRadius: 8,
        background: "#450A0A",
        color: "#F87171",
        border: "1.5px solid #DC2626",
        lineHeight: 1.3
      }
    }, (live.sets || [0, 0])[1]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-faint)",
        marginLeft: 3
      }
    }, "sets")), live.judge && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: judgeStColor ? judgeStColor.bg : "var(--text-muted)"
      }
    }, "\u2696\uFE0F", judgeStLetter ? ` [${judgeStLetter}]` : "", " ", live.judge)), done && m.scores_csv && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        margin: "2px 0 0"
      }
    }, "Final: ", m.scores_csv))));
  })), pairings && roundMatches.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 32,
      marginBottom: 12
    }
  }, "\uD83C\uDFC1"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, "No open matches found."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-faint)"
    }
  }, "All matches may be complete, or the round hasn't started yet.")), stadiumCount && pairings && (() => {
    const STADIUM_LETTERS = STADIUM_LABELS.slice(0, stadiumCount);

    // ── Helpers ────────────────────────────────────────────────
    const getBN = u => judgeNameMap[u.toLowerCase()] || u;
    const isJudgeName = displayName => {
      if (!displayName) return false;
      const dl = displayName.toLowerCase();
      return judgeWhitelist.some(u => {
        const mapped = judgeNameMap[u.toLowerCase()];
        return mapped ? mapped.toLowerCase() === dl : u.toLowerCase() === dl;
      });
    };
    const displayToUsername = displayName => {
      if (!displayName) return null;
      const dl = displayName.toLowerCase();
      return judgeWhitelist.find(u => {
        const mapped = judgeNameMap[u.toLowerCase()];
        return mapped ? mapped.toLowerCase() === dl : u.toLowerCase() === dl;
      }) || null;
    };

    // Which players are in a live match right now
    const playersLive = new Set();
    liveSlots.forEach(s => {
      if (s.state?.p1) playersLive.add(s.state.p1.toLowerCase());
      if (s.state?.p2) playersLive.add(s.state.p2.toLowerCase());
    });
    const isLive = name => name && playersLive.has(name.toLowerCase());

    // Judges at each station (challonge usernames)
    const judgesAt = letter => judgeWhitelist.filter(u => stadiumAssign[u] === letter);
    // Floaters: judges with no station
    const floaterUsers = judgeWhitelist.filter(u => !stadiumAssign[u]);

    // Free judges at a station (not currently in a live match as a player)
    const freeAt = letter => judgesAt(letter).filter(u => !isLive(getBN(u))).length;
    const floatersFree = floaterUsers.filter(u => !isLive(getBN(u))).length;

    // Match classification (used for display badges)
    const classifyM = m => {
      const p1j = isJudgeName(m.player1_name);
      const p2j = isJudgeName(m.player2_name);
      if (p1j && p2j) return 'JvJ';
      if (p1j || p2j) return 'JvP';
      return 'PvP';
    };

    // Classification for queue priority ordering.
    // Floaters have no station to staff, so their matches are treated like player
    // matches for scheduling — a floater vs floater match isn't held until last.
    const isFloater = displayName => {
      if (!displayName) return false;
      const u = displayToUsername(displayName);
      return u ? floaterUsers.includes(u) : false;
    };
    const classifyForPriority = m => {
      const p1j = isJudgeName(m.player1_name);
      const p2j = isJudgeName(m.player2_name);
      if (!p1j && !p2j) return 'PvP';
      // If both players are judges, check if either is an assigned-station judge
      if (p1j && p2j) {
        const p1float = isFloater(m.player1_name);
        const p2float = isFloater(m.player2_name);
        // Both are floaters → treat as PvP for priority (no station to staff)
        if (p1float && p2float) return 'PvP';
        // At least one is a station judge → JvJ scheduling still applies
        return 'JvJ';
      }
      // One judge, one player
      const judgeIsFloater = p1j ? isFloater(m.player1_name) : isFloater(m.player2_name);
      // Floater JvP still needs queue placement — treat same as station JvP
      // (Step 1b handles the unassigned routing)
      return 'JvP';
    };

    // All matches by id
    const matchById = {};
    roundMatches.forEach(m => {
      matchById[m.id] = m;
    });

    // Waiting matches (not live, not complete)
    const waitingIds = new Set(roundMatches.filter(m => !getLiveState(m) && m.state !== 'complete').map(m => m.id));

    // ── Queue generator ─────────────────────────────────────────
    // Builds a suggested ordered list of match IDs for each station.
    // Only runs if queues haven't been manually set or algo needs reset.
    const generateQueues = () => {
      // Seed queues: preserve locked matches in their current stations first
      const queues = {};
      STADIUM_LETTERS.forEach(l => {
        queues[l] = (stationQueues[l] || []).filter(id => lockedMatchIds.has(id));
      });
      const lockedSet = new Set(STADIUM_LETTERS.flatMap(l => queues[l]));
      const pending = roundMatches.filter(m => {
        if (m.state === 'complete') return false;
        if (getLiveState(m)) return false;
        if (lockedSet.has(m.id)) return false; // already placed as locked
        return true;
      });

      // Use priority classification (floater matches treated as PvP, not JvJ)
      const jvjMatches = pending.filter(m => classifyForPriority(m) === 'JvJ');
      const jvpMatches = pending.filter(m => classifyForPriority(m) === 'JvP');
      const pvpMatches = pending.filter(m => classifyForPriority(m) === 'PvP');

      // Helper: push to the station whose queue is currently shortest
      const pushToShortest = matchId => {
        const shortest = STADIUM_LETTERS.reduce((best, l) => queues[l].length < queues[best].length ? l : best, STADIUM_LETTERS[0]);
        queues[shortest].push(matchId);
      };
      if (judgesFirstMode) {
        // Step 1 — JvP matches go to the station whose judges are playing in them (wave 1).
        STADIUM_LETTERS.forEach(letter => {
          const judges = judgesAt(letter);
          const stationJvP = jvpMatches.filter(m => {
            const p1u = displayToUsername(m.player1_name);
            const p2u = displayToUsername(m.player2_name);
            return p1u && judges.includes(p1u) || p2u && judges.includes(p2u);
          });
          stationJvP.sort((a, b) => {
            const juA = displayToUsername(a.player1_name) || displayToUsername(a.player2_name);
            const juB = displayToUsername(b.player1_name) || displayToUsername(b.player2_name);
            return getBN(juA || '').localeCompare(getBN(juB || ''));
          });
          stationJvP.forEach(m => queues[letter].push(m.id));
        });
        // Step 1b — floater JvP matches
        const assignedJvP = new Set(STADIUM_LETTERS.flatMap(l => queues[l]));
        jvpMatches.filter(m => !assignedJvP.has(m.id)).forEach(m => pushToShortest(m.id));
        // Step 2 — PvP matches
        pvpMatches.forEach(m => pushToShortest(m.id));
      } else {
        // Judges Last mode — PvP first, then JvP, then JvJ
        pvpMatches.forEach(m => pushToShortest(m.id));
        // JvP: station-aware placement
        STADIUM_LETTERS.forEach(letter => {
          const judges = judgesAt(letter);
          const stationJvP = jvpMatches.filter(m => {
            const p1u = displayToUsername(m.player1_name);
            const p2u = displayToUsername(m.player2_name);
            return p1u && judges.includes(p1u) || p2u && judges.includes(p2u);
          });
          stationJvP.sort((a, b) => {
            const juA = displayToUsername(a.player1_name) || displayToUsername(a.player2_name);
            const juB = displayToUsername(b.player1_name) || displayToUsername(b.player2_name);
            return getBN(juA || '').localeCompare(getBN(juB || ''));
          });
          stationJvP.forEach(m => queues[letter].push(m.id));
        });
        const assignedJvP2 = new Set(STADIUM_LETTERS.flatMap(l => queues[l]));
        jvpMatches.filter(m => !assignedJvP2.has(m.id)).forEach(m => pushToShortest(m.id));
      }

      // JvJ matches always go last
      jvjMatches.forEach(m => pushToShortest(m.id));
      return queues;
    };

    // Use saved queues if they exist, otherwise show generate button result
    const activeQueues = queuesGenerated ? stationQueues : {};

    // ── Coverage check for a match at a given station ──────────
    const coverageFor = (m, stationLetter) => {
      if (!m) return {
        ok: true,
        flags: []
      };
      const type = classifyM(m);
      const flags = [];
      const isBlocked = isLive(m.player1_name) || isLive(m.player2_name);
      if (isBlocked) return {
        ok: false,
        flags: ['Player already in a live match']
      };
      if (type === 'PvP') return {
        ok: true,
        flags
      };
      if (type === 'JvP') {
        const judgePlayer = isJudgeName(m.player1_name) ? displayToUsername(m.player1_name) : displayToUsername(m.player2_name);
        const homeSt = judgePlayer ? stadiumAssign[judgePlayer] : null;
        const remainAfter = homeSt ? freeAt(homeSt) - 1 : 0;
        if (homeSt && remainAfter >= 1) return {
          ok: true,
          flags
        };
        if (floatersFree > 0) {
          flags.push(`Floater covers Stadium ${homeSt || '?'}`);
          return {
            ok: true,
            flags
          };
        }
        const donor = STADIUM_LETTERS.find(l => l !== homeSt && freeAt(l) >= 2);
        if (donor) {
          flags.push(`Handoff from Stadium ${donor}`);
          return {
            ok: true,
            flags
          };
        }
        return {
          ok: false,
          flags: [`Stadium ${homeSt || '?'} would be stranded`]
        };
      }
      if (type === 'JvJ') {
        const p1u = displayToUsername(m.player1_name);
        const p2u = displayToUsername(m.player2_name);
        const st1 = p1u ? stadiumAssign[p1u] : null;
        const st2 = p2u ? stadiumAssign[p2u] : null;
        if (st1 && st1 === st2) {
          if (floatersFree > 0) {
            flags.push('Same-station JvJ — floater needed');
            return {
              ok: true,
              flags
            };
          }
          const donor = STADIUM_LETTERS.find(l => l !== st1 && freeAt(l) >= 2);
          if (donor) {
            flags.push(`Same-station JvJ — handoff from Stadium ${donor}`);
            return {
              ok: true,
              flags
            };
          }
          return {
            ok: false,
            flags: ['Same-station JvJ — no coverage available']
          };
        }
        const st1ok = !st1 || freeAt(st1) >= 2;
        const st2ok = !st2 || freeAt(st2) >= 2;
        if (st1ok && st2ok) return {
          ok: true,
          flags
        };
        const problems = [];
        if (!st1ok) problems.push(`Stadium ${st1} stranded`);
        if (!st2ok) problems.push(`Stadium ${st2} stranded`);
        return {
          ok: false,
          flags: problems
        };
      }
      return {
        ok: true,
        flags
      };
    };

    // ── Drag handlers for queue reordering ─────────────────────
    const onQueueDragStart = (e, matchId, fromStation) => {
      e.dataTransfer.setData('text/plain', matchId);
      setQueueDragItem({
        matchId,
        fromStation
      });
    };
    const onQueueDragOver = (e, station, afterIdx) => {
      e.preventDefault();
      setQueueDragOver({
        station,
        afterIdx
      });
    };
    const onQueueDrop = (e, toStation, afterIdx) => {
      e.preventDefault();
      if (!queueDragItem) return;
      const {
        matchId,
        fromStation
      } = queueDragItem;
      setStationQueues(prev => {
        const next = {};
        STADIUM_LETTERS.forEach(l => {
          next[l] = [...(prev[l] || [])];
        });
        // Remove from source
        next[fromStation] = next[fromStation].filter(id => id !== matchId);
        // Insert into destination
        const dest = [...(next[toStation] || [])];
        const insertAt = Math.min(afterIdx, dest.length);
        dest.splice(insertAt, 0, matchId);
        next[toStation] = dest;
        return next;
      });
      setQueueDragItem(null);
      setQueueDragOver(null);
    };
    const onQueueDragEnd = () => {
      setQueueDragItem(null);
      setQueueDragOver(null);
    };
    const typeColor = type => type === 'JvJ' ? '#F59E0B' : type === 'JvP' ? '#3B82F6' : 'var(--text-faint)';
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        flexWrap: 'wrap',
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-faint)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        margin: '0 0 1px'
      }
    }, "Match Call Helper"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        fontWeight: 900,
        color: 'var(--text-primary)',
        margin: 0
      }
    }, "Station Queues")), floaterUsers.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-faint)',
        whiteSpace: 'nowrap'
      }
    }, "Floaters:"), floaterUsers.map(u => /*#__PURE__*/React.createElement("span", {
      key: u,
      style: {
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 10,
        background: isLive(getBN(u)) ? '#450A0A' : 'var(--surface2)',
        color: isLive(getBN(u)) ? '#FCA5A5' : 'var(--text-secondary)',
        border: `1px solid ${isLive(getBN(u)) ? '#DC2626' : 'var(--border2)'}`,
        whiteSpace: 'nowrap'
      }
    }, getBN(u), isLive(getBN(u)) ? ' ▶' : '')), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--text-faint)'
      }
    }, floatersFree, "/", floaterUsers.length, " free"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setJudgesFirstMode(m => !m),
      title: judgesFirstMode ? "Judges play their matches first (wave 1) — tap to flip" : "Judges play their matches last — tap to flip",
      style: {
        padding: '5px 10px',
        borderRadius: 8,
        border: `1px solid ${judgesFirstMode ? '#3B82F6' : 'var(--border)'}`,
        background: judgesFirstMode ? '#1E3A5F' : 'none',
        color: judgesFirstMode ? '#93C5FD' : 'var(--text-faint)',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: 'pointer'
      }
    }, judgesFirstMode ? '👨‍⚖️ First' : '👨‍⚖️ Last'), queuesGenerated && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setQueuesGenerated(false);
        setStationQueues({});
        setLockedMatchIds(new Set());
        setMoveMenuOpen(null);
      },
      style: {
        padding: '5px 11px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'none',
        color: 'var(--text-faint)',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: 'pointer'
      }
    }, "Reset"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const q = generateQueues();
        setStationQueues(q);
        setQueuesGenerated(true);
        setMoveMenuOpen(null);
      },
      style: {
        padding: '5px 13px',
        borderRadius: 8,
        border: 'none',
        background: '#3B82F6',
        color: '#fff',
        fontSize: 11,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: 'pointer'
      }
    }, queuesGenerated ? '↻ Regenerate' : '⚡ Generate Queues'))), !queuesGenerated && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '20px',
        borderRadius: 12,
        border: '2px dashed var(--border)',
        textAlign: 'center',
        color: 'var(--text-muted)'
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 24,
        margin: '0 0 6px'
      }
    }, "\uD83D\uDCCB"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        margin: '0 0 3px'
      }
    }, "No queues generated yet"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: 'var(--text-faint)',
        margin: 0
      }
    }, "Tap Generate Queues to build a suggested match order for each station based on judge assignments.")), queuesGenerated && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2,1fr)',
        gap: 10,
        alignItems: 'start'
      }
    }, STADIUM_LETTERS.map(letter => {
      const sc = STADIUM_COLORS[letter];
      const queueIds = stationQueues[letter] || [];
      // Only show waiting matches (skip completed/live)
      const visibleIds = queueIds.filter(id => waitingIds.has(id));
      const nextId = visibleIds[0] || null;
      const nextMatch = nextId ? matchById[nextId] : null;
      const nextCoverage = coverageFor(nextMatch, letter);
      const stationJudges = judgesAt(letter);
      return /*#__PURE__*/React.createElement("div", {
        key: letter,
        style: {
          borderRadius: 12,
          border: `2px solid ${sc.bg}40`,
          overflow: 'hidden'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          background: sc.bg + '18',
          borderBottom: `1px solid ${sc.bg}30`,
          padding: '9px 13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 900,
          color: sc.bg,
          letterSpacing: 0.5
        }
      }, "STADIUM ", letter), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 4
        }
      }, stationJudges.map(u => /*#__PURE__*/React.createElement("span", {
        key: u,
        style: {
          fontSize: 9,
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: 10,
          background: isLive(getBN(u)) ? '#450A0A' : sc.bg + '30',
          color: isLive(getBN(u)) ? '#FCA5A5' : sc.bg,
          border: `1px solid ${isLive(getBN(u)) ? '#DC2626' : sc.bg + '50'}`
        }
      }, getBN(u), isLive(getBN(u)) ? ' ▶' : '')), stationJudges.length === 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          color: 'var(--text-faint)',
          fontStyle: 'italic'
        }
      }, "No judges assigned"))), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          color: sc.bg,
          fontWeight: 700
        }
      }, visibleIds.length, " queued")), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '8px 10px',
          background: 'var(--surface)'
        }
      }, visibleIds.length === 0 && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: 'var(--text-faint)',
          margin: '4px 0',
          fontStyle: 'italic',
          textAlign: 'center'
        }
      }, "Queue empty \u2014 move matches here using the Move \u2192 button"), visibleIds.map((id, idx) => {
        const m = matchById[id];
        if (!m) return null;
        const type = classifyM(m);
        // Floater matches display with generic non-judge labels (PvP / JvP / JvJ)
        const badgeLabel = (() => {
          if (type === 'PvP') return 'PvP';
          if (type === 'JvJ') {
            // Both are judges (floaters or stationed) — show JvJ
            return 'JvJ';
          }
          // JvP — floaters still show as JvP (they are judges)
          return 'JvP';
        })();
        const isNext = idx === 0;
        const cov = isNext ? nextCoverage : {
          ok: true,
          flags: []
        };
        const isBlocked = isNext && !cov.ok;
        const isDragging = queueDragItem?.matchId === id;
        const isDropTarget = queueDragOver?.station === letter && queueDragOver?.afterIdx === idx;
        const isLocked = lockedMatchIds.has(id);
        const isMoveOpen = moveMenuOpen === id;
        const otherStations = STADIUM_LETTERS.filter(l => l !== letter);
        return /*#__PURE__*/React.createElement(React.Fragment, {
          key: id
        }, isDropTarget && /*#__PURE__*/React.createElement("div", {
          style: {
            height: 3,
            borderRadius: 2,
            background: '#3B82F6',
            margin: '2px 0'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            marginBottom: 4
          }
        }, /*#__PURE__*/React.createElement("div", {
          draggable: !isLocked,
          onDragStart: e => !isLocked && onQueueDragStart(e, id, letter),
          onDragEnd: onQueueDragEnd,
          onDragOver: e => onQueueDragOver(e, letter, idx),
          onDrop: e => onQueueDrop(e, letter, idx),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 8px',
            borderRadius: 9,
            border: `1.5px solid ${isLocked ? sc.bg + '90' : isBlocked ? '#DC2626' : isNext ? sc.bg + '60' : 'var(--border)'}`,
            background: isBlocked ? '#450A0A' : isNext ? sc.bg + '10' : 'var(--surface2)',
            opacity: isDragging ? 0.4 : 1,
            cursor: isLocked ? 'default' : 'grab'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 10,
            fontWeight: 800,
            color: isNext ? sc.bg : 'var(--text-faint)',
            width: 14,
            textAlign: 'center',
            flexShrink: 0
          }
        }, idx + 1), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            fontWeight: 800,
            padding: '2px 5px',
            borderRadius: 5,
            border: `1px solid ${typeColor(type)}50`,
            color: typeColor(type),
            flexShrink: 0
          }
        }, badgeLabel), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 700,
            color: isBlocked ? '#FCA5A5' : 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }
        }, m.player1_name || '?', " ", /*#__PURE__*/React.createElement("span", {
          style: {
            fontWeight: 400,
            color: 'var(--text-faint)'
          }
        }, "vs"), " ", m.player2_name || '?'), cov.flags.length > 0 && !isMoveOpen && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            fontWeight: 700,
            color: '#F59E0B',
            flexShrink: 0,
            textAlign: 'right',
            maxWidth: 80,
            lineHeight: 1.3
          }
        }, cov.flags[0]), isBlocked && !isMoveOpen && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            fontWeight: 700,
            color: '#EF4444',
            flexShrink: 0
          }
        }, "BLOCKED"), /*#__PURE__*/React.createElement("button", {
          onClick: () => setLockedMatchIds(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);else n.add(id);
            return n;
          }),
          title: isLocked ? 'Unlock — allow regenerate to move this match' : 'Lock — keep this match here on regenerate',
          style: {
            background: 'none',
            border: 'none',
            padding: '0 2px',
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            flexShrink: 0,
            opacity: isLocked ? 1 : 0.45
          }
        }, isLocked ? '🔒' : '🔓'), otherStations.length > 0 && /*#__PURE__*/React.createElement("button", {
          onClick: () => setMoveMenuOpen(isMoveOpen ? null : id),
          style: {
            background: isMoveOpen ? '#3B82F6' : 'none',
            border: `1px solid ${isMoveOpen ? '#3B82F6' : 'var(--border2)'}`,
            borderRadius: 5,
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: 9,
            fontWeight: 800,
            color: isMoveOpen ? '#fff' : 'var(--text-faint)',
            fontFamily: "'Outfit',sans-serif",
            flexShrink: 0
          }
        }, isMoveOpen ? '✕' : 'Move →')), isMoveOpen && /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 5,
            padding: '5px 8px',
            background: 'var(--surface)',
            borderRadius: '0 0 8px 8px',
            border: '1px solid var(--border)',
            borderTop: 'none',
            flexWrap: 'wrap'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--text-faint)',
            alignSelf: 'center',
            marginRight: 2
          }
        }, "Move to:"), otherStations.map(dest => {
          const dsc = STADIUM_COLORS[dest];
          return /*#__PURE__*/React.createElement("button", {
            key: dest,
            onClick: () => {
              setStationQueues(prev => {
                const next = {};
                STADIUM_LETTERS.forEach(l => {
                  next[l] = [...(prev[l] || [])];
                });
                next[letter] = next[letter].filter(x => x !== id);
                next[dest] = [...next[dest], id];
                return next;
              });
              setMoveMenuOpen(null);
            },
            style: {
              padding: '3px 10px',
              borderRadius: 6,
              border: `1.5px solid ${dsc.bg}`,
              background: dsc.bg + '18',
              color: dsc.bg,
              fontSize: 10,
              fontWeight: 800,
              fontFamily: "'Outfit',sans-serif",
              cursor: 'pointer'
            }
          }, dest);
        }))));
      }), /*#__PURE__*/React.createElement("div", {
        onDragOver: e => onQueueDragOver(e, letter, visibleIds.length),
        onDrop: e => onQueueDrop(e, letter, visibleIds.length),
        style: {
          height: queueDragOver?.station === letter && queueDragOver?.afterIdx === visibleIds.length ? 6 : 2,
          borderRadius: 3,
          background: queueDragOver?.station === letter && queueDragOver?.afterIdx === visibleIds.length ? '#3B82F6' : 'transparent',
          margin: '2px 0 0',
          transition: 'height 0.1s, background 0.1s'
        }
      })));
    })));
  })()), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      const opening = !scoreLogOpen;
      setScoreLogOpen(opening);
      if (opening && scoreLog.length === 0) {
        setScoreLogLoading(true);
        try {
          const d = await workerGet(`/scorelog/list?slug=${encodeURIComponent(slug)}`);
          setScoreLog((d.entries || []).slice().reverse());
        } catch (_) {} finally {
          setScoreLogLoading(false);
        }
      }
    },
    style: {
      width: "100%",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: scoreLogOpen ? "12px 12px 0 0" : 12,
      padding: "11px 14px",
      cursor: "pointer",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: 1,
      margin: 0
    }
  }, "Judge Log"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: 0
    }
  }, "Scored Matches", scoreLog.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-muted)",
      marginLeft: 6
    }
  }, "(", scoreLog.length, ")"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, scoreLogOpen && /*#__PURE__*/React.createElement("button", {
    onClick: async e => {
      e.stopPropagation();
      setScoreLogLoading(true);
      try {
        const d = await workerGet(`/scorelog/list?slug=${encodeURIComponent(slug)}`);
        setScoreLog((d.entries || []).slice().reverse());
      } catch (_) {} finally {
        setScoreLogLoading(false);
      }
    },
    disabled: scoreLogLoading,
    style: {
      background: "none",
      border: "1.5px solid var(--border2)",
      borderRadius: 7,
      padding: "3px 9px",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, scoreLogLoading ? "…" : "↻"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: "var(--text-muted)",
      lineHeight: 1
    }
  }, scoreLogOpen ? "▲" : "▼"))), scoreLogOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border)",
      borderTop: "none",
      borderRadius: "0 0 12px 12px",
      padding: "10px 12px 12px",
      background: "var(--surface)"
    }
  }, scoreLogLoading && scoreLog.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      margin: "8px 0"
    }
  }, "Loading\u2026"), !scoreLogLoading && scoreLog.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 24,
      marginBottom: 6
    }
  }, "\uD83D\uDCCB"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      margin: "0 0 3px"
    }
  }, "No matches logged yet."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      margin: 0
    }
  }, "Entries appear after judges submit scores to Challonge.")), scoreLog.map(e => {
    const t = new Date(e.scoredAt);
    const timeStr = t.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        borderRadius: 9,
        marginBottom: 6,
        border: "1px solid var(--border2)",
        background: "var(--surface2)",
        padding: "9px 11px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 2px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, e.p1, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-faint)",
        fontWeight: 400
      }
    }, "vs"), " ", e.p2), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-secondary)",
        margin: "0 0 3px"
      }
    }, e.p1Sets, "\u2013", e.p2Sets, " \xB7 Winner: ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#22C55E"
      }
    }, e.winner)), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: 0
      }
    }, "\u2696\uFE0F ", e.judge || "Unknown judge", e.challongeMatchId ? ` · Match #${e.challongeMatchId}` : "")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        margin: 0,
        flexShrink: 0,
        paddingTop: 2
      }
    }, timeStr)));
  })))), activePing && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.75)",
      zIndex: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      width: "100%",
      maxWidth: 360,
      boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
      border: "3px solid #DC2626",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#DC2626",
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 24
    }
  }, "\uD83D\uDEA8"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 900,
      color: "#fff",
      margin: 0
    }
  }, "Judge Calling TO"), pings.length > 1 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "rgba(255,255,255,0.75)",
      margin: 0
    }
  }, pings.length - 1, " more ping", pings.length > 2 ? "s" : "", " waiting"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface2)",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 12,
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      margin: "0 0 4px"
    }
  }, "Match"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0
    }
  }, activePing.p1 || "?", " vs ", activePing.p2 || "?"), activePing.judge && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)",
      margin: "3px 0 0"
    }
  }, "Judge: ", activePing.judge)), activePing.comment && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FEF3C7",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 12,
      border: "1px solid #FCD34D"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: "#92400E",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      margin: "0 0 4px"
    }
  }, "Note from Judge"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#78350F",
      margin: 0,
      lineHeight: 1.5
    }
  }, activePing.comment)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-faint)",
      margin: "0 0 12px",
      textAlign: "right"
    }
  }, new Date(activePing.sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dismissPing(activePing),
    style: {
      width: "100%",
      padding: "12px",
      borderRadius: 10,
      border: "none",
      background: "var(--surface3)",
      color: "var(--text-primary)",
      fontSize: 13,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\u2715 Dismiss ", pings.length > 1 ? `(${pings.length - 1} more)` : "")))));
}

/* ── Org Tournament Select ────────────────────────────────────────── */
function OrgTournamentSelect({
  onSelect,
  onSwitchRole
}) {
  // ── Auth state ────────────────────────────────────────────────────
  // On mount, check if there's already a valid session from this browser session.
  const [authStep, setAuthStep] = useState("checking"); // checking | login | verified | not_org
  const [orgUsername, setOrgUsername] = useState(null);
  // Use popup variant so OAuth doesn't replace the current page with "close this tab" message
  const auth = useChallongeAuthPopup();

  // On mount, try to reuse a session token if one was stored
  useEffect(() => {
    const token = sessionStorage.getItem("ncblast-auth-token");
    const user = sessionStorage.getItem("ncblast-auth-user");
    if (token && user) {
      // Verify it's still an authorized org user
      fetch(`${OVERLAY_WORKER}/org/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          username: user
        }),
        signal: AbortSignal.timeout(8000)
      }).then(r => r.json()).then(d => {
        if (d.ok) {
          setOrgUsername(d.username);
          setAuthStep("verified");
        } else {
          sessionStorage.removeItem("ncblast-auth-token");
          sessionStorage.removeItem("ncblast-auth-user");
          setAuthStep("login");
        }
      }).catch(() => setAuthStep("login"));
    } else {
      setAuthStep("login");
    }
  }, []);

  // When the OAuth flow completes, verify the user is on the org whitelist
  useEffect(() => {
    if (auth.state !== "done" || !auth.username) return;
    const token = sessionStorage.getItem("ncblast-auth-token");
    fetch(`${OVERLAY_WORKER}/org/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        username: auth.username
      }),
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json()).then(d => {
      if (d.ok) {
        setOrgUsername(d.username);
        setAuthStep("verified");
      } else {
        setAuthStep("not_org");
      }
    }).catch(() => {
      setAuthStep("not_org");
    });
  }, [auth.state, auth.username]);

  // ── Tournament list state ─────────────────────────────────────────
  const [cachedList, setCachedList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [addStep, setAddStep] = useState(null); // null | "name" | "adding"
  const [pendingSlug, setPendingSlug] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // slug | null
  const [deleting, setDeleting] = useState(false);
  // Whitelist management
  const [whitelistPanel, setWhitelistPanel] = useState(false);
  const [whitelistData, setWhitelistData] = useState(null);
  const [masterKeyInput, setMasterKeyInput] = useState("");
  const [wlError, setWlError] = useState(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [newOrgInput, setNewOrgInput] = useState("");
  const [orgAuthInput, setOrgAuthInput] = useState("");
  const refreshList = async () => {
    setLoadingList(true);
    try {
      const d = await workerGet("/list");
      setCachedList(d.tournaments || []);
    } catch (_) {
      setCachedList([]);
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => {
    if (authStep === "verified") refreshList();
  }, [authStep]);

  // ── Parse slug from Challonge URL ────────────────────────────────
  const parseSlug = raw => {
    let slug = raw.trim();
    try {
      const u = new URL(slug.startsWith("http") ? slug : "https://" + slug);
      const cleanPath = u.pathname.replace(/\/(participants|standings|teams|matches).*$/i, "");
      const parts = cleanPath.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
      const subdomain = u.hostname.split(".")[0];
      const isCommunity = subdomain !== "challonge" && subdomain !== "www";
      const pathSlug = parts[parts.length - 1] || parts[0];
      slug = isCommunity ? `${subdomain}-${pathSlug}` : pathSlug;
    } catch (_) {}
    return slug;
  };
  const handleLinkSubmit = () => {
    setLinkError(null);
    const slug = parseSlug(linkInput);
    if (!slug) {
      setLinkError("Enter a valid Challonge link.");
      return;
    }
    setPendingSlug(slug);
    setDisplayName("");
    setAddStep("name");
  };
  const handleAddTournament = async () => {
    const name = displayName.trim();
    if (!name) {
      setLinkError("Enter a display name.");
      return;
    }
    setAddStep("adding");
    setLinkError(null);
    const token = sessionStorage.getItem("ncblast-auth-token");
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/tournament/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: pendingSlug,
          name,
          orgToken: token,
          username: sessionStorage.getItem("ncblast-auth-user")
        }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAddStep(null);
      setLinkInput("");
      setPendingSlug(null);
      setDisplayName("");
      await refreshList();
      onSelect(pendingSlug, name);
    } catch (e) {
      setLinkError("Couldn't add tournament: " + e.message);
      setAddStep("name");
    }
  };
  const handleDelete = async slug => {
    setDeleting(true);
    const token = sessionStorage.getItem("ncblast-auth-token");
    try {
      const res = await fetch(`${OVERLAY_WORKER}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token
        },
        body: JSON.stringify({
          slug
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Delete failed");
      setCachedList(prev => prev.filter(t => t.slug !== slug));
      setDeleteConfirm(null);
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Whitelist management ─────────────────────────────────────────
  const loadWhitelist = async key => {
    setWlLoading(true);
    setWlError(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/whitelist`, {
        headers: {
          "X-Master-Key": key
        },
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unauthorized");
      setWhitelistData(data.whitelist || []);
    } catch (e) {
      setWlError(e.message);
      setWhitelistData(null);
    } finally {
      setWlLoading(false);
    }
  };
  const handleWlAdd = async () => {
    const username = newOrgInput.trim().toLowerCase();
    if (!username) return;
    setWlLoading(true);
    setWlError(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/whitelist/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": masterKeyInput
        },
        body: JSON.stringify({
          username
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      setNewOrgInput("");
      await loadWhitelist(masterKeyInput);
    } catch (e) {
      setWlError(e.message);
      setWlLoading(false);
    }
  };
  const handleWlRemove = async username => {
    setWlLoading(true);
    setWlError(null);
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/whitelist/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": masterKeyInput
        },
        body: JSON.stringify({
          username
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      await loadWhitelist(masterKeyInput);
    } catch (e) {
      setWlError(e.message);
      setWlLoading(false);
    }
  };

  // ── Auth screens ──────────────────────────────────────────────────
  if (authStep === "checking") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--text-muted)",
        fontSize: 14
      }
    }, "Checking session\u2026"));
  }
  if (authStep === "login") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        fontFamily: "'Outfit',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        maxWidth: 340
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 40,
        marginBottom: 10
      }
    }, "\uD83D\uDD17"), /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: 22,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: "0 0 6px"
      }
    }, "Organizer Login"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        margin: 0,
        lineHeight: 1.5
      }
    }, "Enter your Challonge username to access Organizer View.")), auth.state === "idle" && /*#__PURE__*/React.createElement("button", {
      onClick: auth.start,
      style: {
        width: "100%",
        padding: "18px 0",
        borderRadius: 14,
        border: "none",
        background: "linear-gradient(135deg,#EA580C,#DC2626)",
        color: "#fff",
        fontSize: 16,
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(234,88,12,0.35)",
        marginBottom: 14
      }
    }, "Enter Username"), auth.state === "entering" && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        margin: "0 0 10px",
        lineHeight: 1.5
      }
    }, "Enter your Challonge username:"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "challonge-username",
      value: orgAuthInput,
      onChange: e => setOrgAuthInput(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter" && orgAuthInput.trim()) auth.submitUsername(orgAuthInput.trim());
      },
      style: {
        width: "100%",
        padding: "13px 14px",
        borderRadius: 12,
        boxSizing: "border-box",
        border: "1.5px solid var(--border2)",
        background: "var(--surface2)",
        color: "var(--text-primary)",
        fontSize: 15,
        fontFamily: "'Outfit',sans-serif",
        outline: "none",
        marginBottom: 12
      },
      autoFocus: true
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (orgAuthInput.trim()) auth.submitUsername(orgAuthInput.trim());
      },
      disabled: !orgAuthInput.trim(),
      style: {
        width: "100%",
        padding: "15px 0",
        borderRadius: 12,
        border: "none",
        background: orgAuthInput.trim() ? "#EA580C" : "var(--border2)",
        color: "#fff",
        fontSize: 15,
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: orgAuthInput.trim() ? "pointer" : "default",
        marginBottom: 4
      }
    }, "Confirm \u2192")), auth.state === "waiting" && /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        margin: "0 auto 12px",
        borderRadius: "50%",
        border: "3px solid var(--border2)",
        borderTopColor: "#EA580C",
        animation: "spin 1s linear infinite"
      }
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "Logging in\u2026")), (auth.state === "confirm" || auth.state === "wrong") && /*#__PURE__*/React.createElement(OrgConfirmUsername, {
      auth: auth
    }), auth.state === "error" && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "#EF4444",
        textAlign: "center",
        fontWeight: 600,
        marginBottom: auth.errorDetail ? 6 : 12
      }
    }, "\u26A0 ", auth.errorMsg), auth.errorDetail && auth.errorDetail !== auth.errorMsg && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "#94a3b8",
        marginBottom: 12,
        wordBreak: "break-all",
        fontFamily: "monospace",
        lineHeight: 1.3,
        background: "var(--surface2)",
        borderRadius: 6,
        padding: "6px 8px"
      }
    }, auth.errorDetail), /*#__PURE__*/React.createElement("button", {
      onClick: auth.start,
      style: {
        width: "100%",
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: "#EA580C",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 10
      }
    }, "Try Again")), auth.state === "done" && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "#22C55E",
        textAlign: "center",
        fontWeight: 700,
        marginBottom: 14
      }
    }, "\u2705 ", auth.username, " \u2014 verifying\u2026"), /*#__PURE__*/React.createElement("button", {
      onClick: onSwitchRole,
      style: {
        width: "100%",
        padding: "12px 0",
        borderRadius: 12,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2190 Back")));
  }
  if (authStep === "not_org") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "32px 24px",
        fontFamily: "'Outfit',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 40,
        marginBottom: 12
      }
    }, "\uD83D\uDEAB"), /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: "0 0 8px",
        textAlign: "center"
      }
    }, "Not Authorized"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        textAlign: "center",
        lineHeight: 1.6,
        maxWidth: 300,
        marginBottom: 24
      }
    }, "Your Challonge account (", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--text-primary)"
      }
    }, auth.username), ") is not on the organizer list. Ask a dev team member to add you."), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        auth.reset();
        setAuthStep("login");
      },
      style: {
        padding: "13px 28px",
        borderRadius: 12,
        border: "none",
        background: "#EA580C",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 12
      }
    }, "Try a Different Account"), /*#__PURE__*/React.createElement("button", {
      onClick: onSwitchRole,
      style: {
        padding: "10px 28px",
        borderRadius: 12,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "\u2190 Back"));
  }

  // ── "Name tournament" modal ───────────────────────────────────────
  if (addStep === "name" || addStep === "adding") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "32px 24px",
        fontFamily: "'Outfit',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        maxWidth: 340
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: "0 0 6px"
      }
    }, "Name This Tournament"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        marginBottom: 6,
        lineHeight: 1.5
      }
    }, "Slug: ", /*#__PURE__*/React.createElement("code", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 11,
        color: "#EA580C"
      }
    }, pendingSlug)), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        marginBottom: 16,
        lineHeight: 1.5
      }
    }, "This name is shown to judges in the app."), /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      value: displayName,
      onChange: e => setDisplayName(e.target.value),
      onKeyDown: e => e.key === "Enter" && handleAddTournament(),
      placeholder: "e.g. NorCal Spring Open 2025",
      style: {
        width: "100%",
        padding: "11px 13px",
        borderRadius: 10,
        border: `2px solid ${linkError ? "#EF4444" : "var(--border2)"}`,
        background: "var(--surface2)",
        color: "var(--text-primary)",
        fontSize: 14,
        fontFamily: "'Outfit',sans-serif",
        outline: "none",
        marginBottom: 8,
        boxSizing: "border-box"
      }
    }), linkError && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "#EF4444",
        marginBottom: 8
      }
    }, linkError), /*#__PURE__*/React.createElement("button", {
      onClick: handleAddTournament,
      disabled: !displayName.trim() || addStep === "adding",
      style: {
        width: "100%",
        padding: "13px 0",
        borderRadius: 11,
        border: "none",
        background: displayName.trim() && addStep !== "adding" ? "#EA580C" : "var(--surface3)",
        color: displayName.trim() && addStep !== "adding" ? "#fff" : "var(--text-faint)",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: displayName.trim() && addStep !== "adding" ? "pointer" : "not-allowed",
        marginBottom: 10
      }
    }, addStep === "adding" ? "Adding…" : "Add to NC BLAST →"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setAddStep(null);
        setLinkError(null);
      },
      style: {
        width: "100%",
        padding: "10px 0",
        borderRadius: 10,
        border: "2px solid var(--border)",
        background: "none",
        color: "var(--text-muted)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Cancel")));
  }

  // ── Main select screen ────────────────────────────────────────────
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'Outfit',sans-serif",
      display: "flex",
      flexDirection: "column"
    }
  }, deleteConfirm && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.8)",
      zIndex: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      padding: "24px 20px",
      maxWidth: 320,
      width: "100%",
      boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      border: "2px solid #EF4444"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 900,
      color: "var(--text-primary)",
      marginBottom: 8
    }
  }, "Delete Tournament?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, "This removes ", /*#__PURE__*/React.createElement("strong", null, cachedList.find(t => t.slug === deleteConfirm)?.name || deleteConfirm), " from the NC BLAST cache. Active judges will be notified."), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDelete(deleteConfirm),
    disabled: deleting,
    style: {
      width: "100%",
      padding: "13px 0",
      borderRadius: 11,
      border: "none",
      background: "#EF4444",
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: deleting ? "not-allowed" : "pointer",
      marginBottom: 10
    }
  }, deleting ? "Deleting…" : "Yes, Delete"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteConfirm(null),
    style: {
      width: "100%",
      padding: "10px 0",
      borderRadius: 10,
      border: "2px solid var(--border)",
      background: "none",
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel"))), whitelistPanel && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.85)",
      zIndex: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 20px",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 18,
      width: "100%",
      maxWidth: 360,
      padding: "24px 20px",
      boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 900,
      color: "var(--text-primary)",
      marginBottom: 4
    }
  }, "Organizer Whitelist"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "Paste the master key to view and manage who can access Organizer View."), !whitelistData ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: masterKeyInput,
    onChange: e => setMasterKeyInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && loadWhitelist(masterKeyInput),
    placeholder: "Master Key",
    style: {
      width: "100%",
      padding: "11px 13px",
      borderRadius: 10,
      border: `2px solid ${wlError ? "#EF4444" : "var(--border2)"}`,
      background: "var(--surface2)",
      color: "var(--text-primary)",
      fontSize: 14,
      fontFamily: "'JetBrains Mono',monospace",
      outline: "none",
      marginBottom: 8,
      boxSizing: "border-box"
    }
  }), wlError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#EF4444",
      marginBottom: 8
    }
  }, wlError), /*#__PURE__*/React.createElement("button", {
    onClick: () => loadWhitelist(masterKeyInput),
    disabled: !masterKeyInput.trim() || wlLoading,
    style: {
      width: "100%",
      padding: "12px 0",
      borderRadius: 11,
      border: "none",
      background: "#EA580C",
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      marginBottom: 10
    }
  }, wlLoading ? "Loading…" : "Unlock")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, whitelistData.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-faint)"
    }
  }, "No organizers listed yet."), whitelistData.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.username,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderRadius: 8,
      background: "var(--surface2)",
      marginBottom: 6,
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, e.username), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleWlRemove(e.username),
    disabled: wlLoading,
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "#EF4444",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "2px 6px"
    }
  }, "Remove")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: newOrgInput,
    onChange: e => setNewOrgInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && handleWlAdd(),
    placeholder: "challonge username",
    style: {
      flex: 1,
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid var(--border2)",
      background: "var(--input-bg)",
      color: "var(--text-primary)",
      fontSize: 13,
      fontFamily: "'Outfit',sans-serif",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleWlAdd,
    disabled: !newOrgInput.trim() || wlLoading,
    style: {
      padding: "0 14px",
      borderRadius: 10,
      border: "none",
      background: "#22C55E",
      color: "#fff",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Add")), wlError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#EF4444",
      marginBottom: 8
    }
  }, wlError)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setWhitelistPanel(false);
      setMasterKeyInput("");
      setWhitelistData(null);
      setWlError(null);
      setNewOrgInput("");
    },
    style: {
      width: "100%",
      padding: "10px 0",
      borderRadius: 10,
      border: "2px solid var(--border)",
      background: "none",
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Close"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onSwitchRole,
    style: {
      background: "none",
      border: "none",
      fontSize: 20,
      cursor: "pointer",
      lineHeight: 1,
      padding: "2px 4px"
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      margin: 0
    }
  }, "Organizer View"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, "Select Tournament ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#EA580C",
      fontWeight: 700
    }
  }, "(", orgUsername, ")"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setWhitelistPanel(true),
    title: "Manage organizer access",
    style: {
      background: "none",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "5px 10px",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\uD83D\uDD11 Access")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: "16px 14px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 14,
      padding: "14px",
      marginBottom: 20,
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: "var(--text-primary)",
      marginBottom: 4
    }
  }, "Load from Challonge link"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)",
      marginBottom: 8
    }
  }, "Logged in as ", /*#__PURE__*/React.createElement("strong", null, orgUsername), " \xB7 Will be set as organizer"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: linkInput,
    onChange: e => setLinkInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && handleLinkSubmit(),
    placeholder: "challonge.com/ncbl-eventname",
    style: {
      flex: 1,
      borderRadius: 10,
      border: "1px solid var(--border2)",
      background: "var(--input-bg)",
      padding: "9px 12px",
      fontSize: 13,
      fontFamily: "'Outfit',sans-serif",
      outline: "none",
      color: "var(--text-primary)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleLinkSubmit,
    disabled: loadingLink || !linkInput.trim(),
    style: {
      borderRadius: 10,
      border: "none",
      background: "#EA580C",
      color: "#fff",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      padding: "0 16px",
      cursor: loadingLink || !linkInput.trim() ? "not-allowed" : "pointer",
      opacity: loadingLink || !linkInput.trim() ? 0.6 : 1
    }
  }, loadingLink ? "…" : "Go")), linkError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#EF4444",
      marginTop: 8
    }
  }, linkError)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: "var(--text-primary)",
      marginBottom: 10
    }
  }, "Recently cached"), loadingList && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)"
    }
  }, "Loading\u2026"), !loadingList && cachedList.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-faint)"
    }
  }, "No cached tournaments. Use the link field above to add one."), cachedList.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.slug,
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8,
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onSelect(t.slug, t.name || t.slug),
    style: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--surface)",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: 0
    }
  }, t.name || t.slug), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-faint)",
      margin: "2px 0 0"
    }
  }, t.slug, t.orgUsername ? ` · org: ${t.orgUsername}` : "")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteConfirm(t.slug),
    style: {
      padding: "0 14px",
      borderRadius: 12,
      border: "1px solid #EF444440",
      background: "#EF444408",
      cursor: "pointer",
      color: "#EF4444",
      fontFamily: "'Outfit',sans-serif",
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0
    }
  }, "Delete")))));
}

/* ─── Match History Tab ───────────────────────────────────────── */
function HistoryTab({
  slug,
  myName
}) {
  const [pairings, setPairings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({}); // matchId -> true/false
  const [battleLogs, setBattleLogs] = useState({}); // matchId -> {loading, data, error}

  const load = useCallback(async () => {
    if (!slug || !myName) {
      setError(!slug ? "No tournament loaded." : "Select your name to view history.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await workerGet(`/pairings?slug=${encodeURIComponent(slug)}`);
      setPairings(data.pairings || []);
    } catch (e) {
      setError("Couldn't load match history.");
    } finally {
      setLoading(false);
    }
  }, [slug, myName]);
  useEffect(() => {
    load();
  }, [load]);
  const myMatches = (pairings || []).filter(m => {
    if (!myName) return false;
    return m.player1_name && m.player1_name.toLowerCase() === myName.toLowerCase() || m.player2_name && m.player2_name.toLowerCase() === myName.toLowerCase();
  }).filter(m => m.state === "complete").sort((a, b) => (a.round || 0) - (b.round || 0));
  const wins = myMatches.filter(m => {
    const isP1 = myName && m.player1_name && m.player1_name.toLowerCase() === myName.toLowerCase();
    const myId = isP1 ? m.player1_id : m.player2_id;
    return String(m.winner_id) === String(myId);
  }).length;
  const losses = myMatches.length - wins;
  const toggleExpand = async m => {
    const id = m.id;
    const nowExpanded = !expanded[id];
    setExpanded(prev => ({
      ...prev,
      [id]: nowExpanded
    }));
    // If opening and not yet fetched, fetch the battle log
    if (nowExpanded && !battleLogs[id]) {
      setBattleLogs(prev => ({
        ...prev,
        [id]: {
          loading: true,
          data: null,
          error: null
        }
      }));
      try {
        const params = new URLSearchParams();
        if (m.id) params.set("matchId", m.id);
        if (m.player1_name) params.set("p1", m.player1_name);
        if (m.player2_name) params.set("p2", m.player2_name);
        // Use raw fetch instead of workerGet so we can handle 404 gracefully
        const res = await fetch(`${OVERLAY_WORKER}/matchlog?${params.toString()}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const data = await res.json();
          setBattleLogs(prev => ({
            ...prev,
            [id]: {
              loading: false,
              data: data.found ? data : null,
              error: null
            }
          }));
        } else {
          // 404 or other error from worker — treat as no log available
          setBattleLogs(prev => ({
            ...prev,
            [id]: {
              loading: false,
              data: null,
              error: null
            }
          }));
        }
      } catch (e) {
        // Network error — treat as no log rather than showing a scary error
        setBattleLogs(prev => ({
          ...prev,
          [id]: {
            loading: false,
            data: null,
            error: null
          }
        }));
      }
    }
  };
  if (!slug || !myName) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "32px 16px",
      textAlign: "center",
      color: "var(--text-muted)"
    }
  }, !slug ? "No tournament loaded." : "Select your name to view your match history.");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px",
      paddingBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 18,
      fontWeight: 900,
      margin: 0
    }
  }, "My Matches"), /*#__PURE__*/React.createElement("button", {
    onClick: load,
    disabled: loading,
    style: {
      background: "none",
      border: "2px solid var(--border)",
      borderRadius: 8,
      padding: "5px 10px",
      color: "var(--text-muted)",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, loading ? "..." : "↻")), myMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 16
    }
  }, [{
    label: "Wins",
    val: wins,
    color: "#22C55E"
  }, {
    label: "Losses",
    val: losses,
    color: "#EF4444"
  }, {
    label: "Matches",
    val: myMatches.length,
    color: "var(--text-secondary)"
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      flex: 1,
      padding: "10px 0",
      borderRadius: 10,
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 22,
      fontWeight: 900,
      color: s.color,
      margin: 0
    }
  }, s.val), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-faint)",
      fontWeight: 600,
      margin: 0
    }
  }, s.label)))), error && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#EF4444",
      fontSize: 13,
      marginBottom: 12
    }
  }, error), loading && !pairings && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13
    }
  }, "Loading\u2026"), myMatches.map((m, i) => {
    const isP1 = myName && m.player1_name && m.player1_name.toLowerCase() === myName.toLowerCase();
    const opponent = isP1 ? m.player2_name : m.player1_name;
    const myId = isP1 ? m.player1_id : m.player2_id;
    const won = String(m.winner_id) === String(myId);
    const roundLabel = m.round < 0 ? `Top Cut R${Math.abs(m.round)}` : `Swiss R${m.round}`;
    const isOpen = !!expanded[m.id];
    const logEntry = battleLogs[m.id];
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      className: "fade-in",
      style: {
        borderRadius: 12,
        marginBottom: 8,
        border: `2px solid ${won ? "#22C55E40" : "#EF444430"}`,
        background: won ? "#22C55E08" : "#EF444408",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleExpand(m),
      style: {
        display: "block",
        width: "100%",
        padding: "12px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "'Outfit',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 3
      }
    }, roundLabel), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: won ? "#22C55E" : "#EF4444",
        marginRight: 6
      }
    }, won ? "W" : "L"), "vs ", opponent || "Unknown"), m.scores_csv && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginTop: 3
      }
    }, "Score: ", m.scores_csv)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        marginLeft: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22
      }
    }, won ? "🏆" : "💢"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        color: "var(--text-faint)",
        lineHeight: 1
      }
    }, isOpen ? "▲" : "▼")))), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: `1px solid ${won ? "#22C55E30" : "#EF444430"}`,
        padding: "10px 14px 12px"
      }
    }, logEntry?.loading && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-faint)",
        margin: 0
      }
    }, "Loading battle log\u2026"), logEntry?.error && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "#EF4444",
        margin: 0
      }
    }, logEntry.error), logEntry && !logEntry.loading && !logEntry.data && !logEntry.error && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-faint)",
        margin: 0,
        lineHeight: 1.5
      }
    }, "No battle log available \u2014 this match wasn't scored through NC BLAST."), logEntry?.data?.comboHistory?.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        color: "var(--text-faint)",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 8
      }
    }, "Battle Log"), logEntry.data.comboHistory.map((h, bi) => {
      const meta = FINISH_META[h.typeName] || FINISH_META[h.type] || {
        emoji: "🌀",
        color: "var(--text-muted)",
        label: h.typeName || "?"
      };
      const isMyBattle = myName && h.scorer && h.scorer.toLowerCase() === myName.toLowerCase();
      return /*#__PURE__*/React.createElement("div", {
        key: bi,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 0",
          borderBottom: bi < logEntry.data.comboHistory.length - 1 ? "1px solid var(--border)" : "none"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 16,
          flexShrink: 0,
          width: 22,
          textAlign: "center"
        }
      }, meta.emoji), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: isMyBattle ? "var(--accent2)" : "var(--text-primary)",
          margin: 0
        }
      }, h.scorer || "?", /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-muted)",
          marginLeft: 5
        }
      }, meta.label, " ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#22C55E",
          fontWeight: 800
        }
      }, "+", h.points))), h.winnerCombo && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 10,
          color: "var(--text-faint)",
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, h.winnerCombo)), h.set > 1 && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          fontWeight: 700,
          color: "var(--text-faint)",
          flexShrink: 0
        }
      }, "S", h.set));
    }), logEntry.data.judge && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-faint)",
        marginTop: 8,
        margin: 0
      }
    }, "Judged by ", logEntry.data.judge))));
  }), pairings && myMatches.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "32px 0",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 32,
      marginBottom: 8
    }
  }, "\u23F3"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, "No completed matches yet"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      marginTop: 4
    }
  }, "Your results will appear here as matches finish.")));
}

/* ─── Name Picker ─────────────────────────────────────────────── */
function NamePicker({
  participants,
  onSelect,
  currentName
}) {
  const [search, setSearch] = useState("");
  const filtered = participants.filter(n => n.toLowerCase().includes(search.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 14px"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 18,
      fontWeight: 900,
      marginBottom: 4
    }
  }, "Who are you?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      marginBottom: 12
    }
  }, "Select your name from the tournament roster."), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search your name...",
    style: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "2px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-primary)",
      fontSize: 13,
      fontFamily: "'Outfit',sans-serif",
      outline: "none",
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 7,
      maxHeight: 320,
      overflowY: "auto"
    }
  }, filtered.map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    onClick: () => onSelect(n),
    style: {
      padding: "12px 14px",
      borderRadius: 11,
      border: `2px solid ${currentName === n ? "var(--accent)" : "var(--border)"}`,
      background: currentName === n ? "#EA580C15" : "var(--surface2)",
      color: currentName === n ? "var(--accent2)" : "var(--text-primary)",
      fontSize: 14,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      textAlign: "left"
    }
  }, currentName === n && /*#__PURE__*/React.createElement("span", {
    style: {
      marginRight: 6
    }
  }, "\u2713"), n)), filtered.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-faint)",
      fontSize: 13
    }
  }, "No results.")));
}

/* ─── Tournament Loader ───────────────────────────────────────── */
function RolePicker({
  onSelect,
  judge,
  sharedJudges,
  onLogout,
  reading,
  toggleReading
}) {
  const loggedIn = sharedJudges ? `${sharedJudges.judgeA} & ${sharedJudges.judgeB}` : judge || null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: "32px 24px",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 48,
      marginBottom: 12
    }
  }, "\u2694\uFE0F"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: "0 0 6px"
    }
  }, "NC ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#EA580C"
    }
  }, "BLAST")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      margin: 0
    }
  }, "NorCal Battle Log and Stat Tracker")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: "var(--text-primary)",
      marginBottom: 24,
      textAlign: "center"
    }
  }, "I am\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      width: "100%",
      maxWidth: 320
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onSelect("judge"),
    style: {
      padding: "20px 0",
      borderRadius: 16,
      border: "none",
      background: "linear-gradient(135deg,#EA580C,#DC2626)",
      color: "#fff",
      fontSize: 18,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      boxShadow: "0 8px 24px rgba(234,88,12,0.35)"
    }
  }, "\u2696\uFE0F A Judge"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSelect("org"),
    style: {
      padding: "20px 0",
      borderRadius: 16,
      border: "2px solid var(--border2)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: 18,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "\uD83D\uDCCB An Organizer"), onLogout && /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    style: {
      padding: "12px 0",
      borderRadius: 12,
      border: "2px solid var(--border)",
      background: "transparent",
      color: "var(--text-faint)",
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      marginTop: 4
    }
  }, loggedIn ? `🚪 Log out (${loggedIn})` : "🚪 Log out / Reset Session"), /*#__PURE__*/React.createElement("button", {
    onClick: toggleReading,
    style: {
      padding: "14px 16px",
      borderRadius: 14,
      cursor: "pointer",
      border: `2px solid ${reading ? "#7C3AED" : "var(--border)"}`,
      background: reading ? "#7C3AED18" : "var(--surface)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 4,
      transition: "border-color 0.15s, background 0.15s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      flexShrink: 0
    }
  }, "\uD83D\uDCD6"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      flex: 1,
      textAlign: "left",
      margin: 0,
      color: reading ? "#7C3AED" : "var(--text-primary)"
    }
  }, "Reading Mode ", reading ? "ON" : "OFF"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 20,
      borderRadius: 10,
      flexShrink: 0,
      background: reading ? "#7C3AED" : "var(--border2)",
      position: "relative",
      transition: "background 0.2s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 3,
      borderRadius: "50%",
      width: 14,
      height: 14,
      background: "#fff",
      left: reading ? 19 : 3,
      transition: "left 0.2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
    }
  })))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      marginTop: 32,
      textAlign: "center",
      lineHeight: 1.6
    }
  }, "Your choice is saved on this device.", /*#__PURE__*/React.createElement("br", null), "You can switch anytime from inside the app."));
}

/* ═══════════════════════════════════════
   MAIN APP
═══════════════════════════════════════ */
function BeyJudgeApp() {
  const sc = useScale();
  S = makeS(sc);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("ncblast-dark") === "1";
    } catch {
      return false;
    }
  });
  const toggleDark = () => setDark(d => {
    const next = !d;
    try {
      localStorage.setItem("ncblast-dark", next ? "1" : "0");
    } catch {}
    return next;
  });
  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);
  const [reading, setReading] = useState(() => {
    try {
      return localStorage.getItem("ncblast-reading") === "1";
    } catch {
      return false;
    }
  });
  const toggleReading = () => setReading(r => {
    const next = !r;
    try {
      localStorage.setItem("ncblast-reading", next ? "1" : "0");
    } catch {}
    return next;
  });
  useEffect(() => {
    document.body.classList.toggle("reading", reading);
  }, [reading]);

  // Role — restore from sessionStorage if we just came back from OAuth redirect
  const [role, setRole] = useState(() => {
    try {
      return sessionStorage.getItem("ncblast-pending-role") || null;
    } catch (_) {
      return null;
    }
  });
  const chooseRole = r => {
    setRole(r);
    try {
      sessionStorage.setItem("ncblast-pending-role", r);
    } catch (_) {}
  };

  // All judge-side state declared unconditionally (React rules require this)
  const [screen, setScreen] = useState("format");
  const [config, setConfig] = useState({
    pts: 4,
    bo: 3,
    tm: true,
    tournamentName: ""
  });
  const [parts, setParts] = useState({
    blades: [],
    ratchets: [],
    bits: []
  });
  const [players, setPlayers] = useState([]);
  const [libOpen, setLibOpen] = useState(false);
  const [judge, setJudge] = useState(""); // Never pre-populate from storage — only set after a successful login in this session
  const [sharedJudges, setSharedJudges] = useState(null); // null | { judgeA:string, judgeB:string }
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [challongeSlug, setChallongeSlug] = useState("");
  const [challongeParticipants, setChallongeParticipants] = useState({});
  const [judgeEventDeleted, setJudgeEventDeleted] = useState(false);
  const judgeDeletionRef = useRef(null);
  useEffect(() => {
    if (!challongeSlug) return;
    const check = async () => {
      try {
        const res = await fetch(`${OVERLAY_WORKER}/list`, {
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return;
        const data = await res.json();
        const slugs = (data.tournaments || []).map(t => t.slug);
        if (!slugs.includes(challongeSlug)) setJudgeEventDeleted(true);
      } catch (_) {}
    };
    judgeDeletionRef.current = setInterval(check, 20000);
    return () => clearInterval(judgeDeletionRef.current);
  }, [challongeSlug]);
  useEffect(() => {
    // Check for ?handoff=TOKEN in URL — native camera QR scans land here
    // Stash the token so MatchScreen can pick it up on mount, then clean the URL
    const startupParams = new URLSearchParams(window.location.search);
    const pendingHandoffToken = startupParams.get("handoff");
    if (pendingHandoffToken) {
      try {
        sessionStorage.setItem("ncblast-pending-handoff", pendingHandoffToken);
      } catch (_) {}
      // Remove ?handoff= from URL bar so it doesn't linger or confuse refreshes
      window.history.replaceState({}, document.title, "/");
      // Auto-select judge role AND jump straight to match screen
      // (MatchScreen's on-mount effect will read the token and show the accept card)
      chooseRole("judge");
      setScreen("match");
    }

    // Load local cache immediately so the app is usable right away
    const saved = sGet(KEYS.parts, {});
    const merged = mergeWithDefaults(saved);
    setParts(merged);
    sSave(KEYS.parts, merged);
    setPlayers(sGet(KEYS.players, []));
    const savedMap = sGet(KEYS.challongeMap, {});
    if (savedMap.slug) setChallongeSlug(savedMap.slug);
    if (savedMap.participants) setChallongeParticipants(savedMap.participants);
    // Then fetch the shared parts list from the Worker and replace local if found
    fetch(`${OVERLAY_WORKER}/parts`, {
      signal: AbortSignal.timeout(6000)
    }).then(r => r.json()).then(d => {
      if (d.ok && d.parts) {
        const fresh = mergeWithDefaults(d.parts);
        setParts(fresh);
        sSave(KEYS.parts, fresh);
      }
    }).catch(() => {}); // silently fall back to local cache on network failure
  }, []);
  const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzvb5LkqMDXaMVJNFNQSf7dsUJK_0vbTfQ4gRRISGsRWg4mINvawLROxn0SaPqJ5o9E/exec";

  // Download CSV to device — always available, never sends to sheets
  const handleDownloadCSV = (roundLog, meta) => {
    let csv = "Slot,Set,Shuffle,Judge,Tournament,Winner,WinnerCombo,FinishType,Points,Penalty,P1,P1Side,P1Score,P1Combo,P2,P2Side,P2Score,P2Combo,Timestamp\n";
    roundLog.forEach(r => {
      csv += `${r.slot},${r.set},${r.shuffle},"${r.judge || ""}","${meta.config?.tournamentName || ""}","${r.scorer}","${r.winnerCombo}",${r.type},${r.points},${r.penalty ? 1 : 0},"${r.p1Name}",${r.p1Side || ""},"${r.p1Score}","${comboStr(r.p1Combo)}","${r.p2Name}",${r.p2Side || ""},"${r.p2Score}","${comboStr(r.p2Combo)}",${r.time}\n`;
    });
    const blob = new Blob([csv], {
      type: "text/csv"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ncblast_${meta.p1 || "p1"}_vs_${meta.p2 || "p2"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Send to Google Sheets only — no CSV download
  const handleSendSheets = async (roundLog, meta) => {
    // Sheet 1: existing summary rows
    const rows = roundLog.map(r => [r.time, r.judge || "", meta.config?.tournamentName || "", `${r.p1Name} vs ${r.p2Name}`, r.p1Name, r.p1Side || "", r.p2Name, r.p2Side || "", r.set, r.shuffle, r.slot, r.scorer, r.winnerCombo, r.typeName, r.points, r.penalty ? 1 : 0, r.p1Score, r.p2Score, comboStr(r.p1Combo), comboStr(r.p2Combo)]);

    // Sheet 2: one row per battle with specific battle-level detail
    const battleRows = roundLog.map(r => {
      // Format time as PST XX:XXam/pm
      const d = new Date(r.time);
      const pst = new Date(d.toLocaleString("en-US", {
        timeZone: "America/Los_Angeles"
      }));
      const h = pst.getHours();
      const m = pst.getMinutes();
      const ampm = h >= 12 ? "pm" : "am";
      const h12 = h % 12 || 12;
      const mm = String(m).padStart(2, "0");
      const mo = String(pst.getMonth() + 1).padStart(2, "0");
      const dy = String(pst.getDate()).padStart(2, "0");
      const yr = pst.getFullYear();
      const dateTime = `${mo}/${dy}/${yr} ${h12}:${mm}${ampm}`;

      // Win condition: e.g. "XTR+3", "OVR+2", "OF+2", "LER+1"
      const winCondition = r.penalty ? `${r.type === "OF2" || r.type === "OF3" ? "OF" : "LER"}+${r.points}` : `${r.type}+${r.points}`;
      const winnerIsP1 = r.scorerIdx === 0;
      const winnerName = winnerIsP1 ? r.p1Name : r.p2Name;
      const loserName = winnerIsP1 ? r.p2Name : r.p1Name;
      const winnerSide = winnerIsP1 ? r.p1Side || "" : r.p2Side || "";
      const loserSide = winnerIsP1 ? r.p2Side || "" : r.p1Side || "";
      const winnerCombo = r.winnerCombo;
      const loserCombo = winnerIsP1 ? comboStr(r.p2Combo) : comboStr(r.p1Combo);
      return [dateTime, r.judge || "", r.p1Name, r.p1Side || "", comboStr(r.p1Combo), r.p2Name, r.p2Side || "", comboStr(r.p2Combo), winnerName, winnerCombo, winCondition, loserCombo, loserName];
    });

    // Sheet 3: one row per match for judge accountability
    // Format the submission timestamp as PST
    const now = new Date();
    const nowPST = new Date(now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles"
    }));
    const ph = nowPST.getHours(),
      pm = nowPST.getMinutes();
    const pampm = ph >= 12 ? "pm" : "am",
      ph12 = ph % 12 || 12;
    const pmm = String(pm).padStart(2, "0");
    const pmo = String(nowPST.getMonth() + 1).padStart(2, "0");
    const pdy = String(nowPST.getDate()).padStart(2, "0");
    const pyr = nowPST.getFullYear();
    const submitTime = `${pmo}/${pdy}/${pyr} ${ph12}:${pmm}${pampm}`;
    const judgeLog = [[submitTime, meta.judge || "", meta.config?.tournamentName || "", meta.p1 || "", meta.p2 || "", (meta.sets || [0, 0])[0], (meta.sets || [0, 0])[1], meta.winner || "", meta.challongeMatchId || "", meta.challongeSlug || ""]];
    try {
      const resp = await fetch(SHEETS_URL, {
        method: "POST",
        body: JSON.stringify({
          rows,
          battleRows,
          judgeLog
        })
      });
      const result = await resp.json();
      setSheetsStatus(result.status === "ok" ? "success" : "error");
    } catch (err) {
      setSheetsStatus("error");
    }
  };

  // Branch on role in the render — no early returns before hooks
  if (!role) return /*#__PURE__*/React.createElement(RolePicker, {
    onSelect: chooseRole,
    judge: judge,
    sharedJudges: sharedJudges,
    reading: reading,
    toggleReading: toggleReading,
    onLogout: () => {
      setJudge("");
      setSharedJudges(null);
      setChallongeSlug("");
      setChallongeParticipants({});
      setConfig(c => ({
        ...c,
        tournamentName: ""
      }));
      sSave(KEYS.challongeMap, {});
      try {
        sessionStorage.removeItem("ncblast-auth-token");
        sessionStorage.removeItem("ncblast-auth-user");
      } catch {}
    }
  });
  if (role === "org") return /*#__PURE__*/React.createElement(OrgApp, {
    onSwitchRole: () => chooseRole(null)
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg)",
      minHeight: "100vh",
      fontFamily: "'Outfit',sans-serif"
    }
  }, libOpen && /*#__PURE__*/React.createElement(LibraryManager, {
    parts: parts,
    setParts: setParts,
    onClose: () => setLibOpen(false)
  }), judgeEventDeleted && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.85)",
      zIndex: 900,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 20,
      padding: "28px 22px",
      maxWidth: 320,
      width: "100%",
      boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      border: "2px solid #EF4444",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDDD1\uFE0F"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      fontWeight: 900,
      color: "var(--text-primary)",
      marginBottom: 8
    }
  }, "Event Removed"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-secondary)",
      marginBottom: 22,
      lineHeight: 1.5
    }
  }, "This tournament has been removed from the NC BLAST cache by the organizer."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setJudgeEventDeleted(false);
      setChallongeSlug("");
      setChallongeParticipants({});
      sSave(KEYS.challongeMap, {});
      setPlayers([]);
      sSave(KEYS.players, []);
      setScreen("format");
    },
    style: {
      width: "100%",
      padding: "13px 0",
      borderRadius: 12,
      border: "none",
      background: "#EA580C",
      color: "#fff",
      fontSize: 15,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Back to Main Menu"))), screen === "format" && /*#__PURE__*/React.createElement(FormatScreen, {
    config: config,
    setConfig: setConfig,
    parts: parts,
    onNext: () => setScreen("match"),
    onOpenLib: () => setLibOpen(true),
    dark: dark,
    toggleDark: toggleDark,
    onSwitchRole: () => chooseRole(null),
    challongeSlug: challongeSlug,
    onChallongeImport: (slug, pmap, names) => {
      setJudgeEventDeleted(false);
      setChallongeSlug(slug);
      setChallongeParticipants(pmap);
      sSave(KEYS.challongeMap, {
        slug,
        participants: pmap
      });
      if (names && names.length) {
        const fresh = [...new Set(names)];
        setPlayers(fresh);
        sSave(KEYS.players, fresh);
      }
    },
    onJudgeVerified: payload => {
      if (payload && typeof payload === "object" && payload.mode === "shared") {
        setSharedJudges({
          judgeA: payload.judgeA,
          judgeB: payload.judgeB
        });
        setJudge(""); // will be chosen per-match
        try {
          localStorage.setItem(KEYS.lastJudge, payload.judgeA);
        } catch {}
      } else {
        setSharedJudges(null);
        setJudge(payload || "");
        try {
          localStorage.setItem(KEYS.lastJudge, payload || "");
        } catch {}
      }
    }
  }), screen === "match" && /*#__PURE__*/React.createElement(MatchScreen, {
    config: config,
    parts: parts,
    players: players,
    judge: judge,
    setJudge: setJudge,
    sharedJudges: sharedJudges,
    sheetsStatus: sheetsStatus,
    setSheetsStatus: setSheetsStatus,
    onBack: () => setScreen("format"),
    onMainMenu: () => setScreen("format"),
    onDownloadCSV: handleDownloadCSV,
    onSendSheets: handleSendSheets,
    onOpenLib: () => setLibOpen(true),
    dark: dark,
    toggleDark: toggleDark,
    challongeSlug: challongeSlug,
    challongeParticipants: challongeParticipants
  }));
}
if (!window.__NCBLAST_OAUTH_CALLBACK__) {
  ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(BeyJudgeApp, null));
}
