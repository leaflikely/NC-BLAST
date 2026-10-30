// NC BLAST organizer.js | part 5 of 6 (load order is set in index.html) | last updated: 2026-10-30a | station-live-row (each Station Queue module shows its current live match, score and judge) | previous: 2026-10-27a notifications-tab-and-queue-auto-add (flag 1017) | previous: 2026-10-22b split-from-app.js (PIN window, organizer dashboard (OrgApp) and event add/list screen; code moved here unchanged)
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

  // ── Org tab navigation ────────────────────────────────────────────
  const [orgTab, setOrgTab] = useState("dashboard"); // "dashboard" | "combos"

  // ── Combo Registry tab state ──────────────────────────────────────
  const [comboRegistry, setComboRegistry] = useState(null); // null = not loaded, {} = loaded
  const [comboRegistryLoading, setComboRegistryLoading] = useState(false);
  const [comboRegistryUpdatedAt, setComboRegistryUpdatedAt] = useState(null);

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
  const [stadiumCount, setStadiumCount] = useState(null); // null = not set yet, a whole number once chosen (1-8 via buttons; any 1-99 with flag 1012)
  const [stadiumCountText, setStadiumCountText] = useState(""); // what is typed in the flag-1012 number box
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
  const [queueSyncMsg, setQueueSyncMsg] = useState(null); // null | "saving" | "saved" | "error"
  const [lockedMatchIds, setLockedMatchIds] = useState(new Set()); // match IDs locked in place
  const [judgesFirstMode, setJudgesFirstMode] = useState(true); // true=JvP wave1, false=JvP last
  const [ownStadiumsMode, setOwnStadiumsMode] = useState(false); // true=a judge-vs-judge match is placed at one of the judges' OWN stations, and no cross-station "handoff" is suggested
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
  const STADIUM_LABELS = stadiumLabelList(MAX_STADIUMS); // A..Z, AA.. (was A-H only)
  const STADIUM_COLORS_BASE = {
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
  // Stadiums past H reuse the 8 colours in rotation (I = A's colour, J = B's, ...)
  // so a bigger event never hits a missing colour.
  const STADIUM_COLORS = new Proxy(STADIUM_COLORS_BASE, {
    get: (t, k) => {
      if (typeof k !== "string") return t[k];
      if (t[k]) return t[k];
      const idx = stadiumLabelIndex(k);
      return idx >= 0 ? t[Object.keys(t)[idx % 8]] : undefined;
    }
  });
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

  // Load previously saved station queues from KV so the org view restores the last
  // generated queue order without needing to click Regenerate every session.
  const loadStationQueues = async () => {
    if (!slug) return;
    try {
      const data = await workerGet(`/station-queues?slug=${encodeURIComponent(slug)}`);
      if (data.ok && data.data && typeof data.data === "object" && Object.keys(data.data).length > 0) {
        setStationQueues(data.data);
        setQueuesGenerated(true);
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

  // Fire-and-forget: persist the current ordered station queues to KV so the
  // judge view's Station Matches tab can read the same ordering the org sees.
  const saveStationQueues = async queues => {
    if (!slug || !queues) return false;
    const token = sessionStorage.getItem("ncblast-auth-token") || "";
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    const masterKey = sessionStorage.getItem("ncblast-master-key") || localStorage.getItem("ncblast-master-key") || "";
    if (!token && !username && !masterKey) return false;
    try {
      const res = await fetch(`${OVERLAY_WORKER}/station-queues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token,
          ...(masterKey ? { "X-Master-Key": masterKey } : {})
        },
        body: JSON.stringify({ slug, queues, username }),
        signal: AbortSignal.timeout(8000)
      });
      const d = await res.json().catch(() => ({}));
      return res.ok && d.ok;
    } catch (_) { return false; }
  };

  // Explicit sync: saves current queue to KV and shows visible success/error feedback
  const syncQueueToJudges = async () => {
    if (!queuesGenerated || Object.keys(stationQueues).length === 0) return;
    setQueueSyncMsg("saving");
    const ok = await saveStationQueues(stationQueues);
    setQueueSyncMsg(ok ? "saved" : "error");
    if (ok) setTimeout(() => setQueueSyncMsg(null), 3000);
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
    loadStationQueues();

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
        if (pairData) {
          const freshPairings = pairData.pairings || [];
          const completeIds = new Set(freshPairings.filter(m => m.state === 'complete').map(m => String(m.id)));
          // Filter out any KV overlay slots whose Challonge match is already marked complete.
          // This prevents stale slots from showing players as live or stadiums as stranded.
          const freshSlots = (liveData.slots || []).filter(s => {
            const mid = s.state?.challongeMatchId;
            return !mid || !completeIds.has(String(mid));
          });
          setLiveSlots(freshSlots);
          setPairings(freshPairings);
          pruneCompletedFromQueues(freshPairings);
        } else {
          setLiveSlots(liveData.slots || []);
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

  // ── FLAG 1017: Notifications tab + automatic queue fix (Organizer view) ───────────────
  const [notifs, setNotifs] = useState([]); // everything the Worker has filed for this event
  const [notifResolvedOpen, setNotifResolvedOpen] = useState(false);
  const [notifCopied, setNotifCopied] = useState(null); // id of the entry whose score was just copied
  const notifAutoResolvedRef = React.useRef({}); // entries already auto-resolved (so each is only sent once)
  const queueAutoAddRef = React.useRef({}); // matchId -> time it was last auto-added to a queue
  const notifAuth = () => ({
    token: sessionStorage.getItem("ncblast-auth-token") || "",
    username: sessionStorage.getItem("ncblast-auth-user") || "",
    masterKey: sessionStorage.getItem("ncblast-master-key") || localStorage.getItem("ncblast-master-key") || ""
  });
  const loadNotifs = async () => {
    if (!ff(1017) || !slug) return;
    try {
      const d = await workerGet(`/notify/list?slug=${encodeURIComponent(slug)}`);
      if (Array.isArray(d.notifications)) setNotifs(d.notifications);
    } catch (_) {}
  };
  const resolveNotif = async (n, resolved, by) => {
    const a = notifAuth();
    setNotifs(prev => prev.map(x => x.id === n.id ? {
      ...x,
      resolved,
      resolvedAt: resolved ? Date.now() : null,
      resolvedBy: resolved ? by || a.username || "organizer" : ""
    } : x));
    try {
      const res = await fetch(`${OVERLAY_WORKER}/notify/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": a.token,
          ...(a.masterKey ? {
            "X-Master-Key": a.masterKey
          } : {})
        },
        body: JSON.stringify({
          slug,
          id: n.id,
          resolved,
          username: a.username,
          by: by || ""
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
    } catch (_) {
      loadNotifs(); // the save did not go through: show what the Worker really has
    }
  };
  React.useEffect(() => {
    if (!ff(1017) || !slug) return;
    loadNotifs();
    const t = setInterval(loadNotifs, 10000);
    return () => clearInterval(t);
  }, [slug]);
  // A score the judge could not send is done as soon as the bracket shows the match finished (Challonge only:
  // WCB's match list never shows finished matches, so those are marked entered by hand).
  React.useEffect(() => {
    if (!ff(1017) || !slug || slug.startsWith("wcb-") || !Array.isArray(pairings) || notifs.length === 0) return;
    notifs.forEach(n => {
      if (n.resolved || n.type !== "bracket-send" || !n.matchId) return;
      const m = pairings.find(p => String(p.id) === String(n.matchId));
      if (m && m.state === "complete" && !notifAutoResolvedRef.current[n.id]) {
        notifAutoResolvedRef.current[n.id] = true;
        resolveNotif(n, true, "auto: bracket shows finished");
      }
    });
  }, [notifs, pairings]);
  // A waiting match that is missing from every station queue is added to a queue by itself. Only for a round whose
  // queues already exist (otherwise the TO just has not pressed Generate yet), and a hand-placed match is never moved.
  React.useEffect(() => {
    if (!ff(1017) || !slug || !queuesGenerated || !stadiumCount || !Array.isArray(pairings) || pairings.length === 0) return;
    const letters = STADIUM_LABELS.slice(0, stadiumCount);
    if (letters.length === 0) return;
    const open = pairings.filter(m => m.state !== "complete");
    const nums = open.map(m => m.round).filter(r => r != null && r !== 0 && isFinite(Number(r))).map(Number);
    const cur = nums.length > 0 ? Math.min(...nums) : null;
    let rm = cur !== null ? pairings.filter(m => String(m.round) === String(cur)) : pairings;
    if (rm.length === 0 && open.length > 0) rm = open;
    const queued = new Set();
    Object.keys(stationQueues || {}).forEach(l => (stationQueues[l] || []).forEach(id => queued.add(String(id))));
    if (!rm.some(m => queued.has(String(m.id)))) return;
    const liveIds = new Set();
    const livePairs = new Set();
    liveSlots.forEach(s => {
      if (!s.state) return;
      if (s.state.challongeMatchId) liveIds.add(String(s.state.challongeMatchId));
      const a = (s.state.p1 || "").toLowerCase().trim();
      const b = (s.state.p2 || "").toLowerCase().trim();
      if (a && b) livePairs.add([a, b].sort().join("|"));
    });
    const now = Date.now();
    const missing = rm.filter(m => {
      if (m.state === "complete" || !m.id || !m.player1_name || !m.player2_name) return false;
      if (queued.has(String(m.id)) || liveIds.has(String(m.id))) return false;
      if (livePairs.has([m.player1_name.toLowerCase().trim(), m.player2_name.toLowerCase().trim()].sort().join("|"))) return false;
      const last = queueAutoAddRef.current[String(m.id)];
      return !(last && now - last < 30000);
    });
    if (missing.length === 0) return;
    const next = {};
    letters.forEach(l => {
      next[l] = [...(stationQueues[l] || [])];
    });
    const placed = [];
    missing.forEach(m => {
      // a match with a judge in it goes to that judge's own station; anything else to the shortest line
      let target = null;
      [m.player1_name, m.player2_name].forEach(nm => {
        if (target) return;
        const dl = nm.toLowerCase();
        const u = judgeWhitelist.find(x => {
          const mapped = judgeNameMap[x.toLowerCase()];
          return mapped ? mapped.toLowerCase() === dl : x.toLowerCase() === dl;
        });
        if (u && stadiumAssign[u] && letters.includes(stadiumAssign[u])) target = stadiumAssign[u];
      });
      if (!target) target = letters.reduce((best, l) => next[l].length < next[best].length ? l : best, letters[0]);
      next[target].push(m.id);
      queueAutoAddRef.current[String(m.id)] = now;
      placed.push({
        m,
        target
      });
    });
    setStationQueues(prev => {
      const out = {
        ...prev
      };
      placed.forEach(({
        m,
        target
      }) => {
        const arr = [...(out[target] || [])];
        if (!arr.map(String).includes(String(m.id))) arr.push(m.id);
        out[target] = arr;
      });
      return out;
    });
    saveStationQueues({
      ...stationQueues,
      ...next
    });
    placed.forEach(({
      m,
      target
    }) => {
      fetch(`${OVERLAY_WORKER}/notify/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          type: "queue-auto-add",
          matchId: m.id,
          round: m.round,
          p1: m.player1_name,
          p2: m.player2_name,
          message: `${m.player1_name} vs ${m.player2_name} was missing from every station queue and was added to Stadium ${target}.`
        }),
        signal: AbortSignal.timeout(8000)
      }).catch(() => {});
    });
  }, [pairings, liveSlots, stationQueues, queuesGenerated, stadiumCount]);
  // Red number on the Notifications tab: things the TO has to act on (not the quiet "added to a queue" notes).
  const notifBadgeCount = ff(1017) ? notifs.filter(n => !n.resolved && (n.type === "bracket-send" || n.type === "error")).length : 0;
  const renderNotificationsPanel = () => {
    const h = React.createElement;
    const needs = notifs.filter(n => !n.resolved && (n.type === "bracket-send" || n.type === "error"));
    const quiet = notifs.filter(n => !n.resolved && n.type !== "bracket-send" && n.type !== "error");
    const done = notifs.filter(n => n.resolved);
    const isWcb = slug.startsWith("wcb-");
    const bracketUrl = isWcb ? `https://westcoastbladers.com/brackets/view/${slug.slice(4)}` : slug.indexOf("-") > 0 ? `https://${slug.slice(0, slug.indexOf("-"))}.challonge.com/${slug.slice(slug.indexOf("-") + 1)}` : `https://challonge.com/${slug}`;
    const when = t => t ? new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }) : "";
    const scoreLine = n => `${n.p1 || "?"} ${n.p1Sets ?? "?"}-${n.p2Sets ?? "?"} ${n.p2 || "?"}`;
    const copyText = n => `Round ${n.round ?? "?"}: ${scoreLine(n)}. Winner: ${n.winner || "?"}.` + (n.scoresCsv ? ` Set scores to enter: ${n.scoresCsv.replace(/,/g, ", ")}` : "");
    const copyScore = n => {
      try {
        navigator.clipboard.writeText(copyText(n)).then(() => {
          setNotifCopied(n.id);
          setTimeout(() => setNotifCopied(null), 2500);
        }).catch(() => {});
      } catch (_) {}
    };
    const btn = (label, onClick, kind) => h("button", {
      onClick,
      style: {
        padding: "8px 12px",
        borderRadius: 8,
        border: kind === "primary" ? "none" : "1px solid var(--border2)",
        background: kind === "primary" ? "#15803D" : "var(--surface2)",
        color: kind === "primary" ? "#fff" : "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, label);
    const card = n => {
      const manual = n.status === "manual";
      const isSend = n.type === "bracket-send";
      return h("div", {
        key: n.id,
        style: {
          padding: "12px 14px",
          borderRadius: 12,
          background: "var(--surface)",
          border: n.resolved ? "1px solid var(--border)" : isSend && manual ? "2px solid #DC2626" : "1px solid #B45309",
          marginBottom: 10,
          opacity: n.resolved ? 0.75 : 1
        }
      }, h("p", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: n.resolved ? "var(--text-muted)" : isSend && manual ? "#DC2626" : "#B45309",
          margin: "0 0 4px"
        }
      }, isSend ? manual ? `Enter this score on ${isWcb ? "WCB" : "Challonge"} by hand` : "Score not sent yet (the judge is still retrying)" : n.type === "queue-auto-add" ? "Added to a queue automatically" : n.type === "info" ? "Note" : "Error", h("span", {
        style: {
          fontWeight: 600,
          color: "var(--text-muted)"
        }
      }, `  ·  ${when(n.updatedAt)}${n.attempts > 1 ? `  ·  ${n.attempts} tries` : ""}`)), isSend ? h(React.Fragment, null, h("p", {
        style: {
          fontSize: 16,
          fontWeight: 900,
          color: "var(--text-primary)",
          margin: "0 0 2px"
        }
      }, scoreLine(n)), h("p", {
        style: {
          fontSize: 12,
          color: "var(--text-secondary)",
          margin: "0 0 2px"
        }
      }, `Round ${n.round ?? "?"}  ·  Winner: ${n.winner || "?"}${n.judge ? `  ·  Judge: ${n.judge}` : ""}`), n.scoresCsv && h("p", {
        style: {
          fontSize: 12,
          color: "var(--text-secondary)",
          margin: "0 0 2px"
        }
      }, `Set scores to enter: ${n.scoresCsv.replace(/,/g, ", ")}`), n.error && h("p", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "0 0 2px",
          wordBreak: "break-word"
        }
      }, `Why: ${n.error}`)) : h("p", {
        style: {
          fontSize: 12,
          color: "var(--text-secondary)",
          margin: "0 0 2px",
          wordBreak: "break-word"
        }
      }, n.message || n.error || ""), n.resolved && h("p", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "2px 0 0"
        }
      }, `Resolved ${when(n.resolvedAt)}${n.resolvedBy ? ` by ${n.resolvedBy}` : ""}`), h("div", {
        style: {
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 10
        }
      }, !n.resolved && isSend && btn(notifCopied === n.id ? "Copied!" : "Copy score", () => copyScore(n)), !n.resolved && isSend && h("a", {
        href: bracketUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        style: {
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border2)",
          background: "var(--surface2)",
          color: "var(--text-secondary)",
          fontSize: 12,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          textDecoration: "none"
        }
      }, "Open bracket"), !n.resolved && btn(isSend ? "Mark as entered" : "Done", () => resolveNotif(n, true), "primary"), n.resolved && btn("Re-open", () => resolveNotif(n, false))));
    };
    return h("div", null, h("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
      }
    }, h("div", null, h("p", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-primary)",
        margin: "0 0 1px"
      }
    }, "Notifications"), h("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: 0
      }
    }, "Scores that need entering, send errors, and automatic queue fixes")), btn("↻ Refresh", loadNotifs)), needs.length === 0 && h("div", {
      style: {
        padding: "14px",
        borderRadius: 12,
        background: "#15803D12",
        border: "1px solid #15803D40",
        fontSize: 13,
        fontWeight: 700,
        color: "#15803D",
        textAlign: "center",
        marginBottom: 12
      }
    }, "Nothing needs your attention."), needs.map(card), quiet.length > 0 && h("p", {
      style: {
        fontSize: 11,
        fontWeight: 800,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "14px 0 8px"
      }
    }, "Automatic fixes"), quiet.map(card), h("button", {
      onClick: () => setNotifResolvedOpen(o => !o),
      style: {
        width: "100%",
        marginTop: 14,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        textAlign: "left"
      }
    }, `${notifResolvedOpen ? "▾" : "▸"} Resolved (${done.length})`), notifResolvedOpen && h("div", {
      style: {
        marginTop: 10
      }
    }, done.length === 0 ? h("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, "Nothing resolved yet.") : done.map(card)));
  };

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
      display: "flex",
      gap: 6,
      padding: "0 16px 0",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      flexShrink: 0
    }
  }, (ff(1017) ? ["dashboard", "combos", "notifications"] : ["dashboard", "combos"]).map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab,
    onClick: async () => {
      setOrgTab(tab);
      if (tab === "combos" && comboRegistry === null && slug) {
        setComboRegistryLoading(true);
        try {
          // Also ensure participants are loaded for the full player list
          if (nameMapParticipants.length === 0) await loadParticipants();
          const data = await fetchCombosForTournament(slug);
          setComboRegistry(data);
          setComboRegistryUpdatedAt(Date.now());
        } catch (_) { setComboRegistry({}); }
        finally { setComboRegistryLoading(false); }
      }
    },
    style: {
      position: "relative",
      background: "none",
      border: "none",
      borderBottom: orgTab === tab ? "2px solid #7C3AED" : "2px solid transparent",
      padding: "10px 4px 8px",
      fontSize: 11,
      fontWeight: orgTab === tab ? 800 : 600,
      color: orgTab === tab ? "#7C3AED" : "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: -1,
      transition: "color 0.1s, border-color 0.1s"
    }
  }, tab === "dashboard" ? "Dashboard" : tab === "combos" ? "Combos" : "Notifications", tab === "notifications" && notifBadgeCount > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      right: -12,
      minWidth: 18,
      height: 18,
      padding: "0 5px",
      boxSizing: "border-box",
      borderRadius: 9,
      background: "#DC2626",
      color: "#fff",
      fontSize: 11,
      fontWeight: 800,
      lineHeight: "18px",
      textAlign: "center",
      letterSpacing: 0
    }
  }, notifBadgeCount > 99 ? "99+" : notifBadgeCount)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "16px 24px 40px",
      boxSizing: "border-box"
    }
  }, orgTab === "notifications" && ff(1017) ? renderNotificationsPanel() : orgTab === "combos" ? (() => {
    // ── Combo Registry tab ───────────────────────────────────────────
    const refreshComboRegistry = async () => {
      if (!slug) return;
      setComboRegistryLoading(true);
      try {
        const data = await fetchCombosForTournament(slug);
        setComboRegistry(data);
        setComboRegistryUpdatedAt(Date.now());
      } catch (_) { setComboRegistry({}); }
      finally { setComboRegistryLoading(false); }
    };

    // Build full player list: all participants, merged with anyone in KV
    const participantSet = new Set(nameMapParticipants.map(n => n.trim().toLowerCase()));
    const kvNames = comboRegistry ? Object.keys(comboRegistry) : [];
    // Add any KV names not in participant list (edge case: player removed from bracket)
    const extraKvNames = kvNames.filter(k => !participantSet.has(k));
    // Final display list: all participants sorted + extras at end
    const allDisplayNames = [
      ...nameMapParticipants,
      ...extraKvNames.map(k => {
        // Find the original-cased name from the registry if possible; fall back to key
        const combos = comboRegistry[k] || [];
        return combos[0]?.player || k;
      })
    ];

    const timeStr = comboRegistryUpdatedAt
      ? new Date(comboRegistryUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

    return /*#__PURE__*/React.createElement("div", null,
      // Header row: title + refresh button
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }
      },
        /*#__PURE__*/React.createElement("div", null,
          /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 12, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 1px" }
          }, "Combo Registry"),
          /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 10, color: "var(--text-muted)", margin: 0 }
          }, timeStr ? `Last updated ${timeStr}` : "Combos saved by judges during matches")
        ),
        /*#__PURE__*/React.createElement("button", {
          onClick: refreshComboRegistry,
          disabled: comboRegistryLoading,
          style: {
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            fontFamily: "'Outfit',sans-serif",
            cursor: comboRegistryLoading ? "default" : "pointer",
            opacity: comboRegistryLoading ? 0.5 : 1
          }
        }, comboRegistryLoading ? "\u2026" : "\u21BB Refresh")
      ),
      // Loading state
      comboRegistryLoading && comboRegistry === null
        ? /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "32px 0" }
          }, "Loading\u2026")
        : comboRegistry === null
          ? /*#__PURE__*/React.createElement("p", {
              style: { fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "32px 0" }
            }, "Tap Refresh to load combos")
          : allDisplayNames.length === 0
            ? /*#__PURE__*/React.createElement("p", {
                style: { fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "32px 0" }
              }, "No players found for this tournament")
            : /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
                allDisplayNames.map(playerName => {
                  const key = (playerName || "").trim().toLowerCase();
                  const combos = (comboRegistry[key] || []).map(normalizeCombo).filter(comboReady);
                  const hasCombos = combos.length > 0;
                  return /*#__PURE__*/React.createElement("div", {
                    key: playerName,
                    style: {
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: hasCombos ? "var(--surface)" : "var(--surface2)",
                      padding: "10px 12px"
                    }
                  },
                    /*#__PURE__*/React.createElement("div", {
                      style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }
                    },
                      /*#__PURE__*/React.createElement("p", {
                        style: {
                          fontSize: 12,
                          fontWeight: 800,
                          color: hasCombos ? "var(--text-primary)" : "var(--text-muted)",
                          margin: 0,
                          lineHeight: 1.3
                        }
                      }, playerName),
                      !hasCombos && /*#__PURE__*/React.createElement("span", {
                        style: {
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--text-faint)",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          flexShrink: 0
                        }
                      }, "No combos saved")
                    ),
                    hasCombos && /*#__PURE__*/React.createElement("div", {
                      style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }
                    },
                      combos.map((c, ci) => {
                        const bladeColor = BLADE_COLORS[c.blade] || "#64748B";
                        return /*#__PURE__*/React.createElement("div", {
                          key: ci,
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 8px",
                            borderRadius: 7,
                            background: bladeColor + "18",
                            border: `1px solid ${bladeColor}40`
                          }
                        },
                          /*#__PURE__*/React.createElement("span", {
                            style: {
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: bladeColor,
                              flexShrink: 0
                            }
                          }),
                          /*#__PURE__*/React.createElement("span", {
                            style: { fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }
                          }, comboStr(c))
                        );
                      })
                    )
                  );
                })
              )
    );
  })() : (() => {
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
    }, n)), ff(1012) && /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", gap: 6, alignItems: "center", width: "100%", marginTop: 4 }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      inputMode: "numeric",
      min: 1,
      max: MAX_STADIUMS,
      placeholder: "Or type a number (1-" + MAX_STADIUMS + ")",
      value: stadiumCountText,
      onChange: e => setStadiumCountText(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter") {
          const v = Math.floor(Number(stadiumCountText));
          if (v >= 1 && v <= MAX_STADIUMS) setStadiumCount(v);
        }
      },
      style: {
        flex: 1,
        minWidth: 0,
        height: 38,
        borderRadius: 10,
        border: "2px solid var(--border2)",
        background: "var(--input-bg)",
        color: "var(--text-primary)",
        fontSize: 14,
        fontWeight: 700,
        padding: "0 10px",
        fontFamily: "'Outfit',sans-serif"
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const v = Math.floor(Number(stadiumCountText));
        if (v >= 1 && v <= MAX_STADIUMS) setStadiumCount(v);
      },
      disabled: !(Math.floor(Number(stadiumCountText)) >= 1 && Math.floor(Number(stadiumCountText)) <= MAX_STADIUMS),
      style: {
        height: 38,
        padding: "0 16px",
        borderRadius: 10,
        border: "none",
        background: "var(--accent)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        opacity: Math.floor(Number(stadiumCountText)) >= 1 && Math.floor(Number(stadiumCountText)) <= MAX_STADIUMS ? 1 : 0.4
      }
    }, "Set")))), stadiumCount && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
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
        // Prune completed matches from queues so they stop reappearing
        const completeIds = new Set(freshPairings.filter(m => m.state === 'complete').map(m => String(m.id)));
        // Also filter live slots whose Challonge match is already complete — this prevents
        // stale KV overlay data from incorrectly marking players as "in a live match"
        // or stadiums as "stranded" right after a round boundary refresh.
        const freshSlots = (liveData.slots || []).filter(s => {
          const mid = s.state?.challongeMatchId;
          return !mid || !completeIds.has(String(mid));
        });
        setLiveSlots(freshSlots);
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
  }, "Check that the slug is correct and the tournament is public on Challonge.")), (() => {
    // Swiss bye banner: who has no opponent this round. Two ways to tell:
    //  1) a match in this round that has only ONE player (the other slot is empty) = bye
    //  2) a roster player who is in no match at all this round (a bye, or a dropped player)
    if (currentRound === null || roundMatches.length === 0) return null;
    const norm = n => String(n || "").toLowerCase().trim();
    const hasId = v => v !== null && v !== undefined && v !== "";
    const explicit = [];
    const inRound = new Set();
    roundMatches.forEach(m => {
      if (m.player1_name) inRound.add(norm(m.player1_name));
      if (m.player2_name) inRound.add(norm(m.player2_name));
      if (hasId(m.player1_id) !== hasId(m.player2_id)) {
        const nm = hasId(m.player1_id) ? m.player1_name : m.player2_name;
        if (nm) explicit.push(nm);
      }
    });
    const unpaired = explicit.length === 0 ? nameMapParticipants.filter(n => !inRound.has(norm(n))) : [];
    if (explicit.length === 0 && (unpaired.length === 0 || unpaired.length > 3)) return null;
    const names = explicit.length > 0 ? explicit : unpaired;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "10px 14px",
        borderRadius: 10,
        background: "#F59E0B14",
        border: "1px solid #F59E0B50",
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 800,
        color: "#F59E0B",
        textAlign: "center"
      }
    }, "\uD83C\uDFF3\uFE0F " + (explicit.length > 0 ? "Bye this round: " : "No match this round (bye, or dropped): ") + names.join(", "));
  })(), /*#__PURE__*/React.createElement("div", {
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
      jvjMatches.forEach(m => {
        if (!ownStadiumsMode) return pushToShortest(m.id);
        // "Judges play at own stadiums": put it on one of the two judges' home stations
        // (the one with the shorter line). Floaters have no home station.
        const homes = [displayToUsername(m.player1_name), displayToUsername(m.player2_name)].map(u => u ? stadiumAssign[u] : null).filter(l => l && STADIUM_LETTERS.includes(l));
        if (!homes.length) return pushToShortest(m.id);
        const best = homes.reduce((b, l) => queues[l].length < queues[b].length ? l : b, homes[0]);
        queues[best].push(m.id);
      });
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
        const donor = ownStadiumsMode ? null : STADIUM_LETTERS.find(l => l !== homeSt && freeAt(l) >= 2);
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
          const donor = ownStadiumsMode ? null : STADIUM_LETTERS.find(l => l !== st1 && freeAt(l) >= 2);
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
      // Persist new order to KV so the judge view's Station Matches tab stays in
      // sync. Rebuild the updated queues from the latest stationQueues snapshot.
      const updatedQ = {};
      STADIUM_LETTERS.forEach(l => { updatedQ[l] = [...(stationQueues[l] || [])]; });
      updatedQ[fromStation] = updatedQ[fromStation].filter(id => id !== matchId);
      const dest2 = [...(updatedQ[toStation] || [])];
      dest2.splice(Math.min(afterIdx, dest2.length), 0, matchId);
      updatedQ[toStation] = dest2;
      saveStationQueues(updatedQ);
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
    }, judgesFirstMode ? '👨‍⚖️ First' : '👨‍⚖️ Last'), /*#__PURE__*/React.createElement("button", {
      onClick: () => setOwnStadiumsMode(m => !m),
      title: ownStadiumsMode ? "Judges play at their own stadiums - tap to turn off" : "Judges play at their own stadiums - tap to turn on (then press Generate again)",
      style: {
        padding: '5px 10px',
        borderRadius: 8,
        border: `1px solid ${ownStadiumsMode ? '#16A34A' : 'var(--border)'}`,
        background: ownStadiumsMode ? '#14532D' : 'none',
        color: ownStadiumsMode ? '#86EFAC' : 'var(--text-faint)',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: 'pointer'
      }
    }, ownStadiumsMode ? '🏟 Judges at own stadiums: ON' : '🏟 Judges at own stadiums: OFF'), queuesGenerated && /*#__PURE__*/React.createElement("button", {
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
        // Save to KV with visible feedback
        setQueueSyncMsg("saving");
        saveStationQueues(q).then(ok => {
          setQueueSyncMsg(ok ? "saved" : "error");
          if (ok) setTimeout(() => setQueueSyncMsg(null), 3000);
        });
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
    }, queuesGenerated ? '↻ Regenerate' : '⚡ Generate Queues')),
    /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
      queueSyncMsg === "saving" && /*#__PURE__*/React.createElement("span", {
        style: { fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }
      }, "Syncing\u2026"),
      queueSyncMsg === "saved" && /*#__PURE__*/React.createElement("span", {
        style: { fontSize: 10, fontWeight: 700, color: "#22C55E" }
      }, "\u2713 Synced to judges"),
      queueSyncMsg === "error" && /*#__PURE__*/React.createElement("span", {
        style: { fontSize: 10, fontWeight: 700, color: "#F87171" }
      }, "\u26A0 Sync failed \u2014 check org login"),
      queuesGenerated && /*#__PURE__*/React.createElement("button", {
        type: "button",
        disabled: queueSyncMsg === "saving",
        onClick: syncQueueToJudges,
        style: {
          padding: '5px 11px', borderRadius: 8, border: '1.5px solid #6EE7B7',
          background: '#064E3B', color: '#6EE7B7', fontSize: 11, fontWeight: 800,
          fontFamily: "'Outfit',sans-serif", cursor: 'pointer', opacity: queueSyncMsg === "saving" ? 0.5 : 1
        }
      }, "\u{1F4E4} Sync to Judges")
    )), !queuesGenerated && /*#__PURE__*/React.createElement("div", {
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
      // The match being played right now at this station: first queued match that a judge has started scoring.
      const liveMatch = queueIds.map(id => matchById[id]).find(m => m && m.state !== 'complete' && (() => {
        const st = getLiveState(m);
        return st && !st.abandoned;
      })()) || null;
      const liveSt = liveMatch ? getLiveState(liveMatch) : null;
      const liveSets = liveSt && Array.isArray(liveSt.sets) ? liveSt.sets : [0, 0];
      const livePts = liveSt && Array.isArray(liveSt.pts) ? liveSt.pts : [0, 0];
      const liveRow = /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '8px 13px',
          background: sc.bg + '0C',
          borderBottom: `1px solid ${sc.bg}30`,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px 10px'
        }
      }, liveSt ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          fontWeight: 900,
          padding: '2px 6px',
          borderRadius: 5,
          background: liveSt.matchOver ? '#475569' : '#DC2626',
          color: '#fff',
          letterSpacing: 0.5
        }
      }, liveSt.matchOver ? 'DONE' : 'LIVE'), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: 'var(--text-primary)'
        }
      }, liveSt.p1 || liveMatch.player1_name || '?', " ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: sc.bg
        }
      }, liveSets[0], "\u2013", liveSets[1]), " ", liveSt.p2 || liveMatch.player2_name || '?'), !liveSt.matchOver && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)'
        }
      }, "Set ", liveSt.curSet || 1, ": ", livePts[0], "\u2013", livePts[1]), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)',
          marginLeft: 'auto'
        }
      }, "Judge: ", liveSt.judge || '\u2014')) : /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: 'var(--text-faint)',
          fontStyle: 'italic'
        }
      }, "No match in progress"));
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
      }, visibleIds.length, " queued")), liveRow, /*#__PURE__*/React.createElement("div", {
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
              const updatedQ = {};
              STADIUM_LETTERS.forEach(l => { updatedQ[l] = [...(stationQueues[l] || [])]; });
              updatedQ[letter] = updatedQ[letter].filter(x => x !== id);
              updatedQ[dest] = [...updatedQ[dest], id];
              setStationQueues(updatedQ);
              saveStationQueues(updatedQ);
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
  const [authStep, setAuthStep] = useState("checking"); // checking | login | verified | not_org | net_error
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
    }).then(r => {
      if (!r.ok) { setAuthStep("not_org"); return null; }
      return r.json();
    }).then(d => {
      if (!d) return;
      if (d.ok) {
        setOrgUsername(d.username);
        setAuthStep("verified");
      } else {
        setAuthStep("not_org");
      }
    }).catch(() => {
      // Network failure — server was unreachable, not a whitelist rejection.
      // Show a distinct error so the user isn't misled into thinking their account is blocked.
      setAuthStep("net_error");
    });
  }, [auth.state, auth.username]);

  // ── Tournament list state ─────────────────────────────────────────
  const [cachedList, setCachedList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [addStep, setAddStep] = useState(null); // null | "name" | "ranked" | "adding"
  // WCB (West Coast Bladers) event creation — Phase 1, org-only, flagged off by default (flag 1004)
  const [wcbLinkInput, setWcbLinkInput] = useState("");
  const [wcbLinkError, setWcbLinkError] = useState(null);
  const [wcbStep, setWcbStep] = useState(null); // null | "confirm" | "adding"
  const [wcbPendingId, setWcbPendingId] = useState(null);
  const [pendingRanked, setPendingRanked] = useState(true); // true = RANKED, false = UNRANKED
  const [pendingSlug, setPendingSlug] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // slug | null
  const [deleting, setDeleting] = useState(false);
  const [deleteOverrideMasterKey, setDeleteOverrideMasterKey] = useState(""); // master key input when deleting an unowned event
  const [renameSlug, setRenameSlug] = useState(null); // slug being renamed | null
  const [renameDraft, setRenameDraft] = useState(""); // current text in rename field
  const [renaming, setRenaming] = useState(false); // rename in progress
  const [renameError, setRenameError] = useState(null);
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
  const handleConfirmName = () => {
    const name = displayName.trim();
    if (!name) { setLinkError("Enter a display name."); return; }
    setLinkError(null);
    handleAddTournament(true); // all events are ranked - no choice screen
  };
  const handleAddTournament = async (ranked) => {
    const name = displayName.trim();
    if (!name) { setLinkError("Enter a display name."); return; }
    setAddStep("adding");
    setLinkError(null);
    const token = sessionStorage.getItem("ncblast-auth-token");
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/tournament/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: pendingSlug,
          name,
          ranked: ranked,
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
  // ── WCB (West Coast Bladers) event creation ─────────────────────
  // Pulls the tournament ID out of a pasted WCB bracket link, e.g.
  // https://westcoastbladers.com/brackets/view/PlgMioyeR2dwQMMM8CO2 → PlgMioyeR2dwQMMM8CO2
  const parseWcbId = raw => {
    let id = raw.trim();
    try {
      if (id.startsWith("http")) {
        const u = new URL(id);
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        id = parts[parts.length - 1] || id;
      }
    } catch (_) {}
    return id;
  };
  const handleWcbLinkSubmit = () => {
    setWcbLinkError(null);
    const id = parseWcbId(wcbLinkInput);
    if (!id) { setWcbLinkError("Enter a valid WCB bracket link or ID."); return; }
    setWcbPendingId(id);
    setWcbStep("confirm");
  };
  const handleAddWcbTournament = async (ranked) => {
    setWcbStep("adding");
    setWcbLinkError(null);
    const token = sessionStorage.getItem("ncblast-auth-token");
    try {
      const res = await fetch(`${OVERLAY_WORKER}/org/tournament/add-wcb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: wcbPendingId,
          ranked,
          orgToken: token,
          username: sessionStorage.getItem("ncblast-auth-user")
        }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setWcbStep(null);
      setWcbLinkInput("");
      const addedId = wcbPendingId;
      setWcbPendingId(null);
      await refreshList();
      onSelect(data.slug, data.wcbName || addedId);
    } catch (e) {
      setWcbLinkError("Couldn't add WCB event: " + e.message);
      setWcbStep("confirm");
    }
  };
  const handleDelete = async (slug, masterKeyOverride) => {
    setDeleting(true);
    const token = sessionStorage.getItem("ncblast-auth-token");
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    try {
      const headers = { "Content-Type": "application/json" };
      if (masterKeyOverride) {
        headers["X-Master-Key"] = masterKeyOverride;
      } else {
        headers["X-Auth-Token"] = token;
      }
      const res = await fetch(`${OVERLAY_WORKER}/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ slug, username }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Delete failed");
      setCachedList(prev => prev.filter(t => t.slug !== slug));
      setDeleteConfirm(null);
      setDeleteOverrideMasterKey("");
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Whitelist management ─────────────────────────────────────────
  const handleRename = async () => {
    const name = renameDraft.trim();
    if (!name) return;
    setRenaming(true);
    setRenameError(null);
    const token = sessionStorage.getItem("ncblast-auth-token");
    const username = sessionStorage.getItem("ncblast-auth-user") || "";
    try {
      const res = await fetch(`${OVERLAY_WORKER}/name/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ slug: renameSlug, name, username }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCachedList(prev => prev.map(t => t.slug === renameSlug ? { ...t, name } : t));
      setRenameSlug(null);
      setRenameDraft("");
    } catch (e) {
      setRenameError("Rename failed: " + e.message);
    } finally {
      setRenaming(false);
    }
  };

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

  // ── Network error screen ──────────────────────────────────────────
  if (authStep === "net_error") {
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
      style: { fontSize: 40, marginBottom: 12 }
    }, "\uD83D\uDEF0\uFE0F"), /*#__PURE__*/React.createElement("h2", {
      style: {
        fontSize: 20,
        fontWeight: 900,
        color: "var(--text-primary)",
        margin: "0 0 8px",
        textAlign: "center"
      }
    }, "Can't Reach Server"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        textAlign: "center",
        lineHeight: 1.6,
        maxWidth: 320,
        marginBottom: 24
      }
    }, "NC BLAST couldn't connect to the server to verify your account. This is usually a network or security software issue — not an account problem."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        textAlign: "center",
        lineHeight: 1.6,
        maxWidth: 320,
        marginBottom: 24,
        fontStyle: "italic"
      }
    }, "Try a different network (e.g. hotspot), or check if security software is blocking challonge-proxy.danny61734.workers.dev"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        auth.reset();
        setAuthStep("login");
      },
      style: {
        padding: "13px 28px",
        borderRadius: 12,
        border: "none",
        background: "var(--accent)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 12
      }
    }, "Retry"), /*#__PURE__*/React.createElement("button", {
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
      onKeyDown: e => e.key === "Enter" && handleConfirmName(),
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
      style: { fontSize: 11, color: "#EF4444", marginBottom: 8 }
    }, linkError), /*#__PURE__*/React.createElement("button", {
      onClick: handleConfirmName,
      disabled: !displayName.trim() || addStep === "adding",
      style: {
        width: "100%",
        padding: "13px 0",
        borderRadius: 11,
        border: "none",
        background: displayName.trim() ? "#EA580C" : "var(--surface3)",
        color: displayName.trim() ? "#fff" : "var(--text-faint)",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: displayName.trim() ? "pointer" : "not-allowed",
        marginBottom: 10
      }
    }, addStep === "adding" ? "Adding\u2026" : "Add Tournament →"), /*#__PURE__*/React.createElement("button", {
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
  }, (() => {
    const t = cachedList.find(x => x.slug === deleteConfirm);
    const tourneyOwner = (t?.orgUsername || "").trim().toLowerCase();
    const currentUser = (orgUsername || "").trim().toLowerCase();
    const isOwner = !tourneyOwner || currentUser === tourneyOwner;
    const canDelete = isOwner ? true : deleteOverrideMasterKey.trim().length > 0;
    return /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 16, fontWeight: 900, color: "var(--text-primary)", marginBottom: 6 }
      }, "Delete Tournament?"),
      /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 13, color: "var(--text-muted)", marginBottom: isOwner ? 20 : 14, lineHeight: 1.5 }
      }, "This removes ", /*#__PURE__*/React.createElement("strong", null, t?.name || deleteConfirm), " from the NC BLAST cache. Active judges will be notified."),
      !isOwner && /*#__PURE__*/React.createElement("div", {
        style: {
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 14
        }
      },
        /*#__PURE__*/React.createElement("p", {
          style: { fontSize: 11, fontWeight: 800, color: "#EF4444", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.6 }
        }, "\u26A0\uFE0F Not your event"),
        /*#__PURE__*/React.createElement("p", {
          style: { fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px", lineHeight: 1.4 }
        }, "Owned by ", /*#__PURE__*/React.createElement("strong", null, t?.orgUsername || "unknown"), ". Enter the master key to override."),
        /*#__PURE__*/React.createElement("input", {
          type: "password",
          placeholder: "Master key\u2026",
          value: deleteOverrideMasterKey,
          onChange: e => setDeleteOverrideMasterKey(e.target.value),
          onKeyDown: e => e.key === "Enter" && canDelete && !deleting && handleDelete(deleteConfirm, deleteOverrideMasterKey.trim()),
          autoFocus: true,
          style: {
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 11px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface2)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "'Outfit',sans-serif",
            outline: "none"
          }
        })
      ),
      /*#__PURE__*/React.createElement("button", {
        onClick: () => handleDelete(deleteConfirm, isOwner ? null : deleteOverrideMasterKey.trim()),
        disabled: deleting || !canDelete,
        style: {
          width: "100%",
          padding: "13px 0",
          borderRadius: 11,
          border: "none",
          background: canDelete ? "#EF4444" : "var(--surface3)",
          color: canDelete ? "#fff" : "var(--text-faint)",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: deleting || !canDelete ? "not-allowed" : "pointer",
          marginBottom: 10,
          transition: "background 0.15s"
        }
      }, deleting ? "Deleting\u2026" : "Yes, Delete"),
      /*#__PURE__*/React.createElement("button", {
        onClick: () => { setDeleteConfirm(null); setDeleteOverrideMasterKey(""); },
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
      }, "Cancel")
    );
  })())), whitelistPanel && /*#__PURE__*/React.createElement("div", {
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
  }, linkError)), ff(1004) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: 14,
      padding: "14px",
      marginBottom: 20,
      border: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }
  }, "Load from WCB link (test)"), /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }
  }, "West Coast Bladers — read-only import, name and roster pulled automatically."),
  wcbStep === "confirm" || wcbStep === "adding" ? /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 12, color: "var(--text-primary)", marginBottom: 10, fontWeight: 700 }
    }, "Add this WCB event?"),
    /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
      /*#__PURE__*/React.createElement("button", {
        onClick: () => handleAddWcbTournament(true),
        disabled: wcbStep === "adding",
        style: {
          flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
          background: wcbStep === "adding" ? "var(--surface3)" : "#7C3AED",
          color: wcbStep === "adding" ? "var(--text-faint)" : "#fff",
          fontSize: 13, fontWeight: 800, fontFamily: "'Outfit',sans-serif",
          cursor: wcbStep === "adding" ? "not-allowed" : "pointer"
        }
      }, wcbStep === "adding" ? "Adding…" : "Add Event")),
    /*#__PURE__*/React.createElement("button", {
      onClick: () => { setWcbStep(null); setWcbPendingId(null); setWcbLinkError(null); },
      disabled: wcbStep === "adding",
      style: {
        width: "100%", padding: "8px 0", borderRadius: 8,
        border: "1px solid var(--border)", background: "none",
        color: "var(--text-muted)", fontSize: 12, fontWeight: 700,
        fontFamily: "'Outfit',sans-serif", cursor: wcbStep === "adding" ? "not-allowed" : "pointer"
      }
    }, "Cancel")
  ) : /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", gap: 8 }
  }, /*#__PURE__*/React.createElement("input", {
    value: wcbLinkInput,
    onChange: e => setWcbLinkInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && handleWcbLinkSubmit(),
    placeholder: "westcoastbladers.com/brackets/view/...",
    style: {
      flex: 1, borderRadius: 10, border: "1px solid var(--border2)",
      background: "var(--input-bg)", padding: "9px 12px", fontSize: 13,
      fontFamily: "'Outfit',sans-serif", outline: "none", color: "var(--text-primary)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleWcbLinkSubmit,
    disabled: !wcbLinkInput.trim(),
    style: {
      borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff",
      fontSize: 13, fontWeight: 800, fontFamily: "'Outfit',sans-serif",
      padding: "0 16px", cursor: !wcbLinkInput.trim() ? "not-allowed" : "pointer",
      opacity: !wcbLinkInput.trim() ? 0.6 : 1
    }
  }, "Go")), wcbLinkError && /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 11, color: "#EF4444", marginTop: 8 }
  }, wcbLinkError)), /*#__PURE__*/React.createElement("p", {
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
      marginBottom: 8
    }
  }, renameSlug === t.slug ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "10px 12px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)",
      margin: "0 0 6px",
      fontWeight: 700
    }
  }, "Rename \u201C", t.name || t.slug, "\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: renameDraft,
    onChange: e => setRenameDraft(e.target.value),
    onKeyDown: e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setRenameSlug(null); setRenameDraft(""); setRenameError(null); } },
    placeholder: t.name || t.slug,
    style: {
      flex: 1,
      padding: "8px 10px",
      borderRadius: 8,
      border: "1px solid var(--border)",
      background: "var(--bg)",
      color: "var(--text-primary)",
      fontFamily: "'Outfit',sans-serif",
      fontSize: 13,
      fontWeight: 700
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleRename,
    disabled: renaming || !renameDraft.trim(),
    style: {
      padding: "0 14px",
      borderRadius: 8,
      border: "none",
      background: "var(--accent)",
      color: "#fff",
      fontFamily: "'Outfit',sans-serif",
      fontSize: 12,
      fontWeight: 800,
      cursor: renaming || !renameDraft.trim() ? "not-allowed" : "pointer",
      opacity: renaming || !renameDraft.trim() ? 0.5 : 1
    }
  }, renaming ? "Saving…" : "Save"), /*#__PURE__*/React.createElement("button", {
    onClick: () => { setRenameSlug(null); setRenameDraft(""); setRenameError(null); },
    style: {
      padding: "0 12px",
      borderRadius: 8,
      border: "1px solid var(--border)",
      background: "none",
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "Cancel")), renameError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#EF4444",
      margin: "6px 0 0"
    }
  }, renameError)) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
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
  }, t.name || t.slug, t.backend === "wcb" && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9, fontWeight: 800, color: "#7C3AED", background: "rgba(124,58,237,0.12)",
      borderRadius: 6, padding: "2px 6px", marginLeft: 6, verticalAlign: "middle"
    }
  }, "WCB")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "var(--text-faint)",
      margin: "2px 0 0"
    }
  }, t.slug, t.orgUsername ? ` · org: ${t.orgUsername}` : "")), /*#__PURE__*/React.createElement("button", {
    onClick: () => { setRenameSlug(t.slug); setRenameDraft(t.name || t.slug); setRenameError(null); },
    title: "Rename",
    style: {
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--surface)",
      cursor: "pointer",
      color: "var(--text-muted)",
      fontFamily: "'Outfit',sans-serif",
      fontSize: 14,
      flexShrink: 0
    }
  }, "\u270F\uFE0F"), /*#__PURE__*/React.createElement("button", {
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
  }, "Delete"))))));
}

(window.__NCB_PARTS = window.__NCB_PARTS || {}).organizer = true; // ticks this file's box - app.js checks all boxes before starting
