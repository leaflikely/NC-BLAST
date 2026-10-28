// NC BLAST judge-match.js | part 4 of 6 (load order is set in index.html) | last updated: 2026-10-27a | submit-check-and-notifications (flag 1017: confirm score with the bracket site, lock New Match until confirmed, escape button tells the TO) | previous: 2026-10-22b split-from-app.js (MatchScreen (the judge scoring screen) and its confirm window; code moved here unchanged)
function MatchScreen({
  config,
  parts,
  players,
  judge,
  setJudge,
  sharedJudges,
  sheetsStatus,
  setSheetsStatus,
  dbStatus,
  dbError,
  setDbStatus,
  onRetryDatabase,
  timingSendStatus,
  timingSendError,
  setTimingSendStatus,
  onRetryTiming,
  onBack,
  onMainMenu,
  onDownloadCSV,
  onSendSheets,
  onOpenLib,
  dark,
  toggleDark,
  challongeSlug,
  challongeParticipants,
  onParticipantsRefresh,
  eventRanked = true
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
  const [matchStartIdx, setMatchStartIdx] = useState(() => {
    // FLAG 1001 off: original behaviour — resume snapshot only, else 0.
    if (!ff(1001)) return _resume ? _resume.matchStartIdx : 0;
    // Prefer the resume snapshot, else fall back to the persisted value.
    // Always clamp into the log so a stale index can never expose earlier
    // matches (or point past the end). --espiiii
    const logLen = sGet(KEYS.matchLog, []).length;
    const raw = _resume && Number.isInteger(_resume.matchStartIdx)
      ? _resume.matchStartIdx
      : sGet(KEYS.matchStart, 0);
    const n = Number.isInteger(raw) ? raw : 0;
    return Math.max(0, Math.min(n, logLen));
  });
  // FLAG 1002: identity of the match currently being scored. Every log entry is
  // stamped with it, so "this match" is a filter rather than a position in a
  // shared array. Battles from other matches/tournaments simply never match.
  // Legacy entries have no matchKey, so they drop out on their own — no
  // migration needed and nothing is deleted. --espiiii
  const [matchKey, setMatchKey] = useState(_resume ? _resume.matchKey || null : null);

  // ── Match timing notebook (FLAG 1014) — see timingClean() for the idea ───────
  const [timing, setTiming] = useState(() => {
    if (!ff(1014) || !_resume) return null;
    const saved = sGet(KEYS.matchTiming, null);
    return saved && saved.matchKey && saved.matchKey === (_resume.matchKey || null) ? timingClean(saved.t) : null;
  });
  const [timingOpen, setTimingOpen] = useState(false);
  const stampTiming = (kind, key) => {
    if (!ff(1014)) return;
    const now = Date.now();
    setTiming(t => timingStampPure(t, kind, key, now));
  };
  // An Undo / Reset set is about to remove these log entries: keep them and open (or extend) a
  // fix window. "before" = how many entries the match has right now. Nothing is erased.
  const timingNoteUndo = (removed, kind) => {
    if (!ff(1014)) return;
    const now = Date.now();
    const before = currentMatch.length;
    setTiming(t => timingUndoPure(t, removed, kind, now, before));
  };
  // Move markers whose step was undone / reset into the notebook's "old" list (see timingPrune).
  useEffect(() => {
    if (!ff(1014)) return;
    setTiming(t => timingPrune(t, curSet, shuf, phase));
  }, [curSet, shuf, phase]);
  // Save to the device after every change so a refresh or crash loses nothing.
  useEffect(() => {
    if (!ff(1014)) return;
    if (!timing) {
      try {
        localStorage.removeItem(KEYS.matchTiming);
      } catch (_) {}
      return;
    }
    sSave(KEYS.matchTiming, {
      matchKey: matchKey || null,
      t: timing
    });
  }, [timing, matchKey]);

  // The current match's battles. Falls back to the index when 1002 is off, or
  // when we have no key yet (e.g. resuming a session started on the old build).
  const useKeyScoping = ff(1002) && !!matchKey;
  const currentMatch = useKeyScoping
    ? log.filter(e => e.matchKey === matchKey)
    : log.slice(matchStartIdx);
  // Everything that is NOT this match — used where the current match's entries
  // are replaced wholesale (abandon, misreport edit).
  const otherMatches = useKeyScoping
    ? log.filter(e => e.matchKey !== matchKey)
    : log.slice(0, matchStartIdx);
  const hasCurrentBattles = currentMatch.length > 0;
  // FLAG 1014: close an open fix window once the match is back to the number of entries it had
  // before the Undo / Reset set (or is over). It sits here because it needs currentMatch.
  useEffect(() => {
    if (!ff(1014)) return;
    setTiming(t => timingCloseFixes(t, currentMatch, phase, Date.now()));
  }, [currentMatch.length, phase]);
  // FLAG 1014: read-only "Match timing" window (cog menu). Lists every clock reading (seconds since
  // Start), how long each battle took, the fix windows (time to notice + time to repair a
  // mistake) and the category totals. Undone and replaced lines stay on the list, greyed. Nothing
  // here writes or sends anything.
  const renderTimingModal = () => {
    if (!ff(1014) || !timingOpen) return null;
    const lines = timingBuildLines(timing, currentMatch, Date.now());
    const sum = timingSummary(lines);
    const f2 = n => typeof n === "number" && isFinite(n) ? n.toFixed(2) : "\u2014";
    const line = (key, label, secs, len, color, bold, dim) => React.createElement("div", {
      key,
      style: {
        display: "flex",
        gap: 8,
        padding: "5px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
        fontWeight: bold ? 800 : 600,
        color: color || "var(--text-primary)",
        opacity: dim ? 0.55 : 1,
        fontVariantNumeric: "tabular-nums"
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, label), React.createElement("span", {
      style: {
        width: 62,
        textAlign: "right",
        flexShrink: 0
      }
    }, secs), React.createElement("span", {
      style: {
        width: 70,
        textAlign: "right",
        flexShrink: 0,
        color: color || "var(--text-muted)"
      }
    }, len));
    return React.createElement("div", {
      onClick: () => setTimingOpen(false),
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        background: "var(--surface)",
        borderRadius: 16,
        padding: "16px 18px",
        width: Math.min(400, window.innerWidth - 32),
        maxHeight: "82dvh",
        overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        fontFamily: "'Outfit',sans-serif"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: "var(--text-primary)"
      }
    }, "\u23F1 Match timing"), React.createElement("button", {
      type: "button",
      onClick: () => setTimingOpen(false),
      style: {
        background: "var(--surface3)",
        border: "none",
        borderRadius: 6,
        width: 26,
        height: 26,
        cursor: "pointer",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 700
      }
    }, "\u2715")), !lines.length ? React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)",
        margin: 0
      }
    }, "No clock is running for this match yet. It starts the first time the deck builder is opened.") : React.createElement(React.Fragment, null, line("head", "Marker", "Seconds", "Length", "var(--text-muted)", true), lines.map((r, i) => {
      if (r.kind === "fix") return line("r" + i, "Fix" + (r.open ? " (still open)" : "") + " \u00B7 notice " + f2(r.notice) + " + repair " + f2(r.repair), f2(r.secs), f2(r.gap), "#B45309", true);
      let label = r.label;
      if (r.kind === "battle") label += " \u00B7 " + r.finish + (r.set ? " (set " + r.set + ")" : "");else if (r.kind === "launch") label += " \u00B7 " + r.finish;
      if (r.status) label += " \u00B7 " + r.status;
      const len = typeof r.gap === "number" && (r.kind === "battle" || r.kind === "launch") ? f2(r.gap) + (r.outlier ? " \u2691" : "") : "";
      return line("r" + i, label, f2(r.secs), len, r.outlier ? "#DC2626" : r.kind === "launch" ? "#B45309" : undefined, false, r.inFix || r.kind === "press" || r.status === "undone" || r.status === "replaced");
    }), React.createElement("div", {
      style: {
        height: 8
      }
    }), line("avg", "Average battle (" + sum.battles + ", undone ones included)", "", f2(sum.avgBattle), undefined, true), line("ler", "Launch errors (" + sum.launches + ") \u2014 time lost", "", f2(sum.launchTotal), undefined, true), line("set", "Setup, sides and shuffles", "", f2(sum.setupTotal), undefined, true), line("fix", "Fixing mistakes (" + sum.fixes + "): notice " + f2(sum.fixNotice) + " + repair " + f2(sum.fixRepair), "", f2(sum.fixTotal), "#B45309", true), line("tot", "Time so far (all of the above)", "", f2(sum.total), undefined, true), React.createElement("p", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: "8px 0 0",
        lineHeight: 1.4
      }
    }, "Seconds = time since Start. Length = time since the line above it. A fix runs from the last good entry until the match was back where it was before the Undo. Grey lines were undone, replaced, or happened during a fix; they are kept. \u2691 = an unusually long or short battle (needs 4 or more battles to judge)."))));
  };
  const [picker, setPicker] = useState(null);
  const [qcEditMenu, setQcEditMenu] = useState(null); // { qi, qc } — which quick combo is showing the part-edit menu
  const [pcEditMenu, setPcEditMenu] = useState(null); // { ci, combo } — which prev combo is showing the part-edit menu
  const [orderPreset, setOrderPreset] = useState(false); // true → ShuffleOrderScreen pre-fills from restored undo deck order
  const [pickerHistory, setPickerHistory] = useState([]); // stack of previous picker states for undo
  // useCallback so the part-button grid can stay memoized across renders
  // (identity only changes when `picker` does, not on every keystroke). --espiiii
  const openPicker = useCallback(val => {
    if (ff(1014)) setTiming(t => timingStampPure(t, "start", null, Date.now())); // FLAG 1014: the clock starts the first time the deck builder opens
    setPickerHistory(h => picker ? [...h, picker] : h);
    setPicker(val);
    setPickerSearch("");
    setCrossoverOpen(false);
    setCxPicker(null);
    setQcEditMenu(null); // dismiss any open quick-combo edit menu
  }, [picker]);
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
  const [misreportOpen, setMisreportOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [manualJudge, setManualJudge] = useState(_resume ? _resume.manualJudge : false);
  const [setScores, setSetScores] = useState(_resume ? _resume.setScores : []);
  const [sideAssign, setSideAssign] = useState(_resume ? _resume.sideAssign : null);
  // Name of the player who had pick priority in SET 1 of this match. Stored by name (not
  // P1/P2 position) so a side/position swap can't flip it. Sent to Sheets as a "~P~" tag
  // on that player's name. null = unknown (e.g. match resumed from before this existed).
  const [set1PriorityName, setSet1PriorityName] = useState(_resume ? _resume.set1PriorityName || null : null);
  const [sidePicker, setSidePicker] = useState(null);
  const [currentSides, setCurrentSides] = useState(_resume ? _resume.currentSides : {
    p1Side: "",
    p2Side: ""
  });
  const [pickerSearch, setPickerSearch] = useState("");
  const [ratchetSort, setRatchetSort] = useState("popular"); // ratchet picker: "popular" (Top box first) or "numeric" (one list, lowest number first)
  const [crossoverOpen, setCrossoverOpen] = useState(false);
  const [cxPicker, setCxPicker] = useState(null); // null | {step,who,slot,chip?,blade?,returnToReview?}
  const [cxGuide, setCxGuide] = useState(null); // null | "blade" | "over_blade" | "assist" — reference image overlay
  const [deckReview, setDeckReview] = useState(false); // true = show review screen, false = in picker flow
  const [lerStrikes, setLerStrikes] = useState(_resume ? _resume.lerStrikes : [0, 0]); // launch error strike counter per player [p1,p2]
  const [pickTab, setPickTab] = useState(challongeSlug || config.tm ? "active" : "roster"); // "roster" | "active" | "station"
  const [activeMatches, setActiveMatches] = useState(null); // null | "loading" | []
  const [wcbOpenMatches, setWcbOpenMatches] = useState(null); // null | "loading" | [] — read-only WCB preview
  // Station Matches tab: loaded on first open; { letter, queuedMatches: [{id,p1,p2},...] } | null | "loading" | "no-assign"
  const [stationMatchesData, setStationMatchesData] = useState(null);
  const [challongeMatchId, setChallongeMatchId] = useState(_resume ? _resume.challongeMatchId : null);
  const [challongeRound, setChallongeRound] = useState(_resume ? _resume.challongeRound ?? null : null); // FLAG 1015: round number, for the backup file name
  const [challongeP1ParticipantId, setChallongeP1ParticipantId] = useState(_resume ? _resume.challongeP1ParticipantId : null);
  const [challongeP2ParticipantId, setChallongeP2ParticipantId] = useState(_resume ? _resume.challongeP2ParticipantId : null);
  const [challongeSubmitStatus, setChallongeSubmitStatus] = useState(null);
  const [bracketEscape, setBracketEscape] = useState(null); // FLAG 1017: null | "confirm" | "sending" | "failed" | "done" | "skipped" (done = the TO was told to enter this score by hand; skipped = the TO could not be reached and the judge carried on)
  const bracketFailReportedRef = useRef(false); // FLAG 1017: a send problem for this match was already reported to the org view
  const [underwayStatus, setUnderwayStatus] = useState(null); // null | "checking" | "ok" | "denied" | "error"
  const [pendingFinish, setPendingFinish] = useState(null); // {pi, fin} — selected but not yet confirmed
  const [lerConfirm, setLerConfirm] = useState(null); // {pi, second, run} — a Launch Error waiting for its confirmation window
  const [resetSetConfirm, setResetSetConfirm] = useState(false); // the "restart this set at 0-0?" window
  const [ownConfirm, setOwnConfirm] = useState(null); // {pi, fin} — an Own Over / Own Xtreme waiting for the "award points to ...?" window

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

  // Start a new match at the end of the log, pruning first if it has grown
  // past the cap. This is the only place the log is pruned. --espiiii
  const beginMatchLog = entries => {
    const source = Array.isArray(entries) ? entries : [];
    // FLAG 1002: mint a fresh identity for this match. Kept outside the 1001
    // branch so key scoping works regardless of the older flag. --espiiii
    setMatchKey(`${challongeSlug || "manual"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setTiming(null); // FLAG 1014: a new match always starts with an empty timing notebook
    // FLAG 1001 off: no pruning, just set the boundary like before.
    if (!ff(1001)) {
      setMatchStartIdx(source.length);
      return;
    }
    const pruned = pruneMatchLog(source);
    if (pruned.length !== source.length) {
      setLog(pruned);
      sSave(KEYS.matchLog, pruned);
    }
    setMatchStartIdx(pruned.length);
  };

  // Persist the match boundary in localStorage, same lifetime as the log it
  // indexes into. sessionStorage alone was not enough - see KEYS.matchStart.
  // Hook runs unconditionally; the flag is checked inside. --espiiii
  useEffect(() => {
    if (!ff(1001)) return;
    sSave(KEYS.matchStart, matchStartIdx);
  }, [matchStartIdx]);

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
      challongeMatchId, challongeP1ParticipantId, challongeP2ParticipantId, challongeRound,
      matchStartIdx, swapped, matchKey, set1PriorityName
    });
  }, [phase, p1, p2, d1, d2, r1, r2, used1, used2, pts, sets, curSet, shuf,
      manualJudge, setScores, sideAssign, currentSides, lerStrikes,
      challongeMatchId, challongeP1ParticipantId, challongeP2ParticipantId, challongeRound,
      matchStartIdx, swapped, matchKey, set1PriorityName]);
  const [sideSwapConfirm, setSideSwapConfirm] = useState(false); // swap B/X sides modal
  const [swapStadium, setSwapStadium] = useState(true); // checkbox: swap B/X sides
  const [swapPosition, setSwapPosition] = useState(false); // checkbox: swap p1/p2 in app
  const [historyConfirmClear, setHistoryConfirmClear] = useState(false);
  const [judgeSubmitModal, setJudgeSubmitModal] = useState(false);
  const [confirmOverlay, setConfirmOverlay] = useState(false); // full-screen "tap your half to confirm" screen on the final score page
  const [submitChallongeCheck, setSubmitChallongeCheck] = useState(true);
  const [submitSheetsCheck, setSubmitSheetsCheck] = useState(true); // clear log confirmation in battle screen history panel
  const [judgeEditMode, setJudgeEditMode] = useState(false); // judge name editable on over screen
  const [layoutEditMode, setLayoutEditMode] = useState(false); // height adjustment mode
  const [overlayModal, setOverlayModal] = useState(false); // stream slot picker modal
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false); // cog-wheel settings menu in the top banner (Redo/Fix/Log/Stream/Handoff/Adjust layout)
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
  const [deckLoadingCombos, setDeckLoadingCombos] = useState(false); // true while awaiting combo fetch before opening deck screen
  // shuffleTimer: null = hidden, "active" = counting down, "expired" = time ran out
  const [shuffleTimer, setShuffleTimer] = useState(null);
  // FLAG 1005: screen trail, submit results and live state for bug reports.
  // Placed after every state these read and before any early return, so hook
  // order never changes. The flag is checked inside each one. --espiiii
  useEffect(() => {
    if (ff(1005)) bugLog("screen", "match phase: " + phase);
  }, [phase]);
  // Submit errors are caught and shown on screen, so they never reach the
  // error recorder. And WCB/Challonge often answer HTTP 200 with the error in
  // the body. Watching the status catches every outcome in one place,
  // including the exact message the judge saw.
  useEffect(() => {
    if (ff(1005) && challongeSubmitStatus != null) bugLog("submit", "bracket submit: " + String(challongeSubmitStatus));
  }, [challongeSubmitStatus]);
  useEffect(() => {
    if (ff(1005) && underwayStatus != null) bugLog("submit", "mark underway: " + String(underwayStatus));
  }, [underwayStatus]);
  // Snapshot of what's on screen, read when a report is filed. Only named
  // fields — no tokens, nothing from storage.
  useEffect(() => {
    if (!ff(1005)) return;
    try {
      window.__ncbLiveMatch = {
        at: new Date().toISOString(),
        phase,
        bracketSubmitStatus: challongeSubmitStatus ?? null,
        underwayStatus: underwayStatus ?? null,
        judgeSubmitModalOpen: !!judgeSubmitModal,
        confirmState: confirmState ?? null,
        misreportOpen: !!misreportOpen,
        historyOpen: !!historyOpen,
        abandonConfirmOpen: !!abandonConfirm,
        sidePickerOpen: !!sidePicker,
        picker: picker ? { who: picker.who, slot: picker.slot, cat: picker.cat } : null,
        shuffleTimer: shuffleTimer ?? null,
        pts, sets, curSet, shuf, r1, r2, lerStrikes, overlaySlot,
        slug: challongeSlug || "",
        challongeMatchId: challongeMatchId ?? null,
        challongeRound: challongeRound ?? null,
        matchKey: matchKey ?? null,
        config: config ? { bo: config.bo, pts: config.pts, tm: config.tm, tournamentName: config.tournamentName || "" } : null
      };
    } catch {}
  });
  useEffect(() => () => {
    try {
      delete window.__ncbLiveMatch;
    } catch {}
  }, []);
  // FLAG 1011: show a new matchup on the overlay as soon as both players are
  // picked, not on its first point. Sends once per pairing while on the pick
  // screen, with a clean 0-0 / set 1 / no combos since nothing has been played
  // yet. Leaving the pick screen clears the memory, so a rematch later still
  // sends. --espiiii
  const lastMatchupRef = useRef("");
  useEffect(() => {
    if (!ff(1011)) return;
    if (phase !== "pick") {
      lastMatchupRef.current = "";
      return;
    }
    if (!p1 || !p2) return;
    const pair = p1 + "\u0000" + p2;
    if (pair === lastMatchupRef.current) return;
    lastMatchupRef.current = pair;
    pushOverlay({
      pts: [0, 0],
      sets: [0, 0],
      curSet: 1,
      matchOver: false,
      p1ComboIdx: null,
      p2ComboIdx: null
    });
  }, [p1, p2, phase]);
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
  // FLAG 1006: a push that lands inside the 500ms window used to be dropped.
  // Now the newest one is held and sent when the window opens. The timer calls
  // the newest pushOverlay (via the ref) so it reads current state, not the
  // state from the render that scheduled it. --espiiii
  const pushOverlayTrailExtraRef = useRef(null);
  const pushOverlayTrailTimerRef = useRef(null);
  const pushOverlayLatestRef = useRef(null);
  useEffect(() => () => {
    if (pushOverlayTrailTimerRef.current) clearTimeout(pushOverlayTrailTimerRef.current);
  }, []);
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
      const battlesLogged = currentMatch.filter(en => en.type !== "LER-STRIKE").length;
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
    if (!challongeSlug) return;
    if (challongeSlug.startsWith("wcb-")) fetchWcbOpenMatches();
    else fetchActiveMatches();
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
      // Only replace what this device already has when the Worker actually returned
      // combos. A failed or empty fetch used to blank the player's combos here.
      const fromRegistry = getCombosFromRegistry(registry, name);
      if (fromRegistry.length) results[name] = fromRegistry;
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
      // FLAG 1002: stamps which match (and event) this battle belongs to.
      // Harmless when 1002 is off — nothing reads it. --espiiii
      matchKey: matchKey,
      slug: challongeSlug || "",
      set: curSet,
      shuffle: shuf,
      slot: currentMatch.filter(e => e.set === curSet).length + 1,
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
    const setWon = config.pts > 0 && np[scoringPi] >= config.pts;
    // FLAG 1006: the set count has to go out in the scoring push. pushOverlay fills
    // sets/matchOver from state, which still holds the pre-point values here.
    // When the point ends the match the over screen never pushes again, so
    // without this the overlay keeps the old count and never shows the last
    // set dot. --espiiii
    const setsAfter = setWon ? (() => {
      const n = [sets[0], sets[1]];
      n[scoringPi] += 1;
      return n;
    })() : [sets[0], sets[1]];
    const setsExtra = ff(1006) ? {
      sets: setsAfter,
      matchOver: setWon && setsAfter[scoringPi] >= need
    } : {};

    // LER — 1-strike system: first LER adds a strike, second converts to a point
    // Combos do NOT advance on LER — push overlay now with unchanged r1/r2
    if (fin.id === "LER") {
      pushOverlay({
        lastFinish: {
          type: fin.id,
          scorerIdx: scoringPi
        },
        pts: np,
        ...setsExtra
      });
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
    // Push overlay NOW — after computing nxR1/nxR2 — so the overlay immediately
    // shows the NEXT battle's combos. Pass p1ComboIdx/p2ComboIdx to bypass the
    // stale r1/r2 still held in React state (setState is async).
    // If the set is won, combos reset on the upcoming shuffle screen → send null.
    pushOverlay({
      lastFinish: {
        type: fin.id,
        scorerIdx: scoringPi
      },
      pts: np,
      p1ComboIdx: setWon ? null : (nxR1 !== undefined ? nxR1 : null),
      p2ComboIdx: setWon ? null : (nxR2 !== undefined ? nxR2 : null),
      ...setsExtra
    });
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
    if (!hasCurrentBattles && !lastIsStrike) return;
    const l = log[log.length - 1];
    const undoLog = log.slice(0, -1);
    timingNoteUndo([l], "undo"); // FLAG 1014: keep the undone entry, open / extend a fix window
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
    // Undo pressed from the reshuffle / new-set screens: close them so the judge lands
    // back on the scoring screen (or the fresh deck-order screen below).
    const wasOnShuffleScreens = !!shuffleTimer || !!sidePicker;
    setShuffleTimer(null);
    setSidePicker(null);
    if (wasOnShuffleScreens) {
      // A new set may already have had its sides picked: go back to the sides the
      // undone battle was played on.
      const backSides = {
        p1Side: l.p1Side || "",
        p2Side: l.p2Side || ""
      };
      setCurrentSides(backSides);
      setSideAssign(a => a ? {
        ...a,
        ...backSides
      } : a);
      const bn1 = [0, 1, 2].find(i => !l._u1.includes(i));
      const bn2 = [0, 1, 2].find(i => !l._u2.includes(i));
      pushOverlay({
        shuffling: false,
        pts: l._pp,
        sets: l._ps,
        p1ComboIdx: bn1 !== undefined ? bn1 : null,
        p2ComboIdx: bn2 !== undefined ? bn2 : null,
        ...backSides
      });
    }
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
  // Restart the CURRENT set at 0-0 and go back to its first shuffle. Only this set's
  // battles are removed; earlier sets in the match stay exactly as they were.
  const resetCurrentSet = () => {
    const inSet = currentMatch.filter(e => e.set === curSet);
    if (!inSet.length) return;
    timingNoteUndo(inSet, "reset"); // FLAG 1014: keep the discarded entries, open / extend a fix window
    const e0 = inSet[0];
    const eD = inSet.find(e => e._d1) || e0;
    const drop = new Set(inSet);
    const newLog = log.filter(e => !drop.has(e));
    setLog(newLog);
    sSave(KEYS.matchLog, newLog);
    setFuture([]);
    setPts([0, 0]);
    setSets(e0._ps);
    setCurSet(e0._cs);
    setUsed1([]);
    setUsed2([]);
    setShuf(1);
    setLerStrikes([0, 0]);
    if (e0._ss) setSetScores(e0._ss);
    setPendingFinish(null);
    if (eD._d1) setD1(eD._d1);
    if (eD._d2) setD2(eD._d2);
    setShuffleTimer(null);
    setSidePicker(null);
    setR1(null);
    setR2(null);
    setOrderPreset(true);
    setPhase("order");
    pushOverlay({
      shuffling: false,
      pts: [0, 0],
      sets: e0._ps,
      p1ComboIdx: null,
      p2ComboIdx: null
    });
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
      // Never save under a display-only "ID:x" fallback — that key can never be
      // found again once the real name resolves, so it would poison the registry.
      if (!name || isIdFallbackName(name)) return;
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

  // Read-only preview of a WCB event's open matches — no scoring/selection wired up yet.
  const fetchWcbOpenMatches = async () => {
    if (!challongeSlug) return;
    setWcbOpenMatches("loading");
    try {
      const res = await fetch(`${OVERLAY_WORKER}/wcb/open-matches?slug=${encodeURIComponent(challongeSlug)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWcbOpenMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (err) {
      setWcbOpenMatches([]);
    }
  };

  // Fetch station matches for the Station Matches tab.
  // overrideLetter: if set, skip identity detection and load this station directly
  // (used when the judge manually picks a station from the picker).
  const fetchStationMatches = async (overrideLetter = null) => {
    if (!challongeSlug) return;
    setStationMatchesData("loading");
    try {
      const myRaw = (sessionStorage.getItem("ncblast-auth-user") || "").toLowerCase().trim();

      // Pull name map from localStorage (populated at app start via /judge-namemap)
      let nameMap = {};
      try {
        const cached = localStorage.getItem("ncblast-judge-namemap");
        if (cached) nameMap = JSON.parse(cached);
      } catch (_) {}
      // Normalise all keys to lowercase for reliable comparison
      const nm = {};
      Object.entries(nameMap).forEach(([k, v]) => { nm[k.toLowerCase()] = (v || "").toLowerCase(); });

      // Load stadium assignment to find which station this judge is at
      const assignRes = await fetch(
        `${OVERLAY_WORKER}/stadium-assign?slug=${encodeURIComponent(challongeSlug)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const assignData = assignRes.ok ? await assignRes.json() : {};
      const assign = assignData?.data?.assign || {};
      const stationCount = assignData?.data?.count || 0;

      // Determine station letter: use override if provided (judge picked manually),
      // otherwise auto-detect via three-pass bidirectional lookup.
      let myLetter = overrideLetter || null;
      if (!myLetter) {
        // Pass 1: direct username match (OAuth login stores exact Challonge username)
        for (const [k, letter] of Object.entries(assign)) {
          if (k.toLowerCase() === myRaw) { myLetter = letter; break; }
        }
      }
      if (!myLetter) {
        // Pass 2: sessionStorage holds a display name typed manually.
        for (const [k, letter] of Object.entries(assign)) {
          const mapped = nm[k.toLowerCase()] || "";
          if (mapped && mapped === myRaw) { myLetter = letter; break; }
        }
      }
      if (!myLetter) {
        // Pass 3: resolve myRaw through name map, check assign keys.
        const myDisplayName = nm[myRaw] || "";
        if (myDisplayName) {
          for (const [k, letter] of Object.entries(assign)) {
            if (k.toLowerCase() === myDisplayName) { myLetter = letter; break; }
            const mapped = nm[k.toLowerCase()] || "";
            if (mapped && mapped === myDisplayName) { myLetter = letter; break; }
          }
        }
      }

      if (!myLetter) {
        // Could not auto-detect — show the station picker instead of a dead-end error.
        setStationMatchesData({ noAssign: true, stationCount });
        return;
      }

      // Load the org-persisted queue order for this station
      const queueRes = await fetch(
        `${OVERLAY_WORKER}/station-queues?slug=${encodeURIComponent(challongeSlug)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const queueData = queueRes.ok ? await queueRes.json() : {};
      const queues = queueData?.data || {};
      const orderedIds = (queues[myLetter] || []).map(String);

      // Load pairings so we can look up player names by match ID
      const pairRes = await fetch(
        `${OVERLAY_WORKER}/pairings?slug=${encodeURIComponent(challongeSlug)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const pairData = pairRes.ok ? await pairRes.json() : {};
      const pairings = pairData?.pairings || [];

      // Build a map from match ID → open match object
      const matchById = {};
      pairings.forEach(m => {
        if (m.state !== "complete") matchById[String(m.id)] = m;
      });

      const seen = new Set();
      const queuedMatches = [];
      // gid-aware id → name lookup for any pairing that arrives with blank names
      const idToNameSQ = buildIdToName(challongeParticipants || {});
      const sqName = (raw, pid) => resolveMatchName(raw, pid, idToNameSQ) || `ID:${pid}`;

      if (orderedIds.length > 0) {
        // Saved queue exists — use the org's ordering exactly.
        orderedIds.forEach(id => {
          const m = matchById[id];
          if (m && !seen.has(id)) {
            seen.add(id);
            queuedMatches.push({ id, p1: sqName(m.player1_name, m.player1_id), p2: sqName(m.player2_name, m.player2_id), challongeMatch: m });
          }
        });
      } else {
        // No saved queue yet (org hasn't clicked Generate Queues since deployment,
        // or the queue hasn't been persisted). Fall back to inferring station
        // matches from pairings: find open matches where either player is a judge
        // assigned to THIS station, using the name map as the identity bridge.
        // (Same logic the org uses for "occupied" detection.)
        const judgesAtStation = Object.entries(assign)
          .filter(([, letter]) => letter === myLetter)
          .map(([k]) => {
            const bracketName = nm[k.toLowerCase()] || k.toLowerCase();
            return bracketName;
          });
        pairings.forEach(m => {
          if (m.state === "complete") return;
          const p1l = (m.player1_name || "").toLowerCase();
          const p2l = (m.player2_name || "").toLowerCase();
          const id = String(m.id);
          const p1here = judgesAtStation.some(jn => jn === p1l);
          const p2here = judgesAtStation.some(jn => jn === p2l);
          if ((p1here || p2here) && !seen.has(id)) {
            seen.add(id);
            queuedMatches.push({ id, p1: sqName(m.player1_name, m.player1_id), p2: sqName(m.player2_name, m.player2_id), challongeMatch: m, inferred: true });
          }
        });
      }

      setStationMatchesData({ letter: myLetter, queuedMatches, inferred: orderedIds.length === 0, stationCount, manual: !!overrideLetter });
    } catch (_) {
      setStationMatchesData(null);
    }
  };
  const pushOverlay = (extraState = {}) => {
    // Throttle: never fire more than once per 500ms. Prevents runaway loops
    // if something triggers pushOverlay in a tight re-render cycle.
    const now = Date.now();
    const sinceLast = now - pushOverlayDebounceRef.current;
    if (sinceLast < 500) {
      // FLAG 1006 off: drop it, as before.
      if (!ff(1006)) return;
      // Keep only the newest held push; anything older is out of date.
      pushOverlayTrailExtraRef.current = extraState;
      if (!pushOverlayTrailTimerRef.current) {
        pushOverlayTrailTimerRef.current = setTimeout(() => {
          pushOverlayTrailTimerRef.current = null;
          const held = pushOverlayTrailExtraRef.current;
          pushOverlayTrailExtraRef.current = null;
          if (held && pushOverlayLatestRef.current) pushOverlayLatestRef.current(held);
        }, 500 - sinceLast + 20);
      }
      return;
    }
    pushOverlayDebounceRef.current = now;
    // A push is going out now, so anything held is superseded.
    if (ff(1006)) pushOverlayTrailExtraRef.current = null;
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
    const currentLog = currentMatch.filter(e => e.type !== "LER-STRIKE" && e.type !== "LER");
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
      // FLAG 1008: tells the overlay to mirror left/right when the judge has
      // swapped. Not sent at all with the flag off, so the overlay never flips.
      // --espiiii
      ...(ff(1008) ? { swapped: !!swapped } : {}),
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
  pushOverlayLatestRef.current = pushOverlay;
  // ── FLAG 1017: submit check + notifications ────────────────────────────
  // Tell the org view about a score that has not reached the bracket site (status "failed" while
  // the judge can still retry, "manual" when the TO must enter it), and clear it once it goes through
  // (status "sent"). Returns true when the Worker accepted the note. Never throws.
  const notifyBracket = async (status, matchId, p1Score, p2Score, winnerChallongeId, errText) => {
    if (!ff(1017) || !challongeSlug) return false;
    try {
      const winnerIsP1 = String(winnerChallongeId) === String(challongeP1ParticipantId);
      const scoresCsv = setScores.length > 0 ? setScores.map(s => `${s.p1}-${s.p2}`).join(",") : `${p1Score}-${p2Score}`;
      const res = await fetch(`${OVERLAY_WORKER}/notify/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: challongeSlug,
          type: "bracket-send",
          status,
          matchId,
          round: challongeRound ?? null,
          judge: judge || "",
          p1: p1 || "",
          p2: p2 || "",
          p1Sets: p1Score,
          p2Sets: p2Score,
          winner: winnerIsP1 ? p1 || "" : p2 || "",
          scoresCsv,
          error: errText || ""
        }),
        signal: AbortSignal.timeout(8000)
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  };
  // Ask the Worker to read the match back from the bracket site. confirmed: true | false | null (could not check).
  // A check that fails or is missing on the Worker counts as null, never as false, so it can never block a judge by itself.
  const verifyBracketScore = async (matchId, scoresCsv) => {
    try {
      const res = await fetch(`${OVERLAY_WORKER}/submit/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: challongeSlug,
          matchId,
          scores_csv: scoresCsv
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return {
        confirmed: null,
        reason: ""
      };
      const d = await res.json();
      return {
        confirmed: d.confirmed === true ? true : d.confirmed === false ? false : null,
        reason: d.reason || ""
      };
    } catch (_) {
      return {
        confirmed: null,
        reason: ""
      };
    }
  };
  // One extra look after a short wait, in case the bracket site was a moment slow to update.
  const verifyBracketScoreTwice = async (matchId, scoresCsv) => {
    const first = await verifyBracketScore(matchId, scoresCsv);
    if (first.confirmed !== false) return first;
    await new Promise(r => setTimeout(r, 2500));
    return verifyBracketScore(matchId, scoresCsv);
  };
  // New Match stays locked until the bracket site confirmed the score, or the judge told the TO to enter it by hand.
  const newMatchLocked = ff(1017) && !!challongeSlug && !!challongeMatchId && challongeSubmitStatus !== "ok" && bracketEscape !== "done" && bracketEscape !== "skipped";
  // The "send it again" and "tell the TO" buttons shown under the Challonge/WCB status while New Match is locked.
  const bracketEscapeUI = (bracketLabel, winnerId, showSend) => {
    if (!ff(1017)) return null;
    if (!newMatchLocked) {
      return bracketEscape === "done" || bracketEscape === "skipped" ? /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "10px 14px",
          borderRadius: 10,
          background: bracketEscape === "done" ? "#B4530915" : "#DC262615",
          border: bracketEscape === "done" ? "1px solid #B4530940" : "1px solid #DC262640",
          fontSize: 12,
          fontWeight: 700,
          color: bracketEscape === "done" ? "#B45309" : "#DC2626",
          textAlign: "center",
          marginBottom: 10
        }
      }, bracketEscape === "done" ? "The TO has been told to enter this score by hand." : `This score was NOT sent. Tell the TO yourself: ${p1 || "Player 1"} ${sets[0]}-${sets[1]} ${p2 || "Player 2"}.`) : null;
    }
    const st = challongeSubmitStatus;
    if (st === "loading") return null;
    return /*#__PURE__*/React.createElement(React.Fragment, null, !st && showSend !== false && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => submitChallongeScore(challongeMatchId, sets[0], sets[1], winnerId),
      style: {
        display: "block",
        width: "100%",
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: "#EA580C",
        color: "#fff",
        fontSize: 15,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 6
      }
    }, `Send to ${bracketLabel}`), bracketEscape === "sending" ? /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-muted)",
        textAlign: "center",
        marginBottom: 10
      }
    }, "Telling the TO\u2026") : bracketEscape === "failed" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "#DC2626",
        textAlign: "center",
        marginBottom: 6
      }
    }, `Could not reach the TO's list. Write this down and tell the TO: ${p1 || "Player 1"} ${sets[0]}-${sets[1]} ${p2 || "Player 2"}.`), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setBracketEscape("skipped"),
      style: {
        display: "block",
        width: "100%",
        padding: "10px 0",
        borderRadius: 10,
        border: "2px solid var(--border2)",
        background: "var(--surface2)",
        color: "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 10
      }
    }, "Continue anyway")) : /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setBracketEscape("confirm"),
      style: {
        display: "block",
        width: "100%",
        padding: "10px 0",
        borderRadius: 10,
        border: "2px solid var(--border2)",
        background: "var(--surface2)",
        color: "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 10
      }
    }, "Can't send? Tell the TO to enter it by hand"));
  };
  const submitChallongeScore = async (matchId, p1Score, p2Score, winnerChallongeId, isRetry) => {
    if (!challongeSlug || !matchId) return;
    setChallongeSubmitStatus("loading");
    const scoresCsv = setScores.length > 0 ? setScores.map(s => `${s.p1}-${s.p2}`).join(",") : `${p1Score}-${p2Score}`;
    // WCB events (slug prefixed "wcb-") use a separate Worker route that PUTs to WCB's
    // /result endpoint instead of Challonge's. winnerChallongeId here is already the WCB
    // participant id (set from the flat player1_id/player2_id on the WCB match object when
    // it was selected), so no extra mapping is needed. Everything below this branch is the
    // existing Challonge path.
    if (challongeSlug.startsWith("wcb-")) {
      try {
        const res = await fetch(`${OVERLAY_WORKER}/wcb/match/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: challongeSlug,
            matchId,
            scores_csv: scoresCsv,
            winner_id: winnerChallongeId
          }),
          signal: AbortSignal.timeout(10000)
        });
        const data = await res.json();
        console.log("[BLAST] submitWcbScore response", { status: res.status, data });
        if (!data.ok) {
          // FLAG 1017: WCB refuses a second result for a match it already finished. If WCB really shows it finished, that is a success, not a failure.
          const alreadyDone = ff(1017) && /unfinished/i.test(String(data.data?.message || ""));
          const again = alreadyDone ? await verifyBracketScore(matchId, scoresCsv) : null;
          if (!(again && again.confirmed === true)) throw new Error(data.data?.message || data.data?.code || `HTTP ${data.status || res.status}`);
        }
        if (ff(1017)) {
          const vr = await verifyBracketScoreTwice(matchId, scoresCsv);
          if (vr.confirmed === false) throw new Error("Not confirmed by WCB - " + vr.reason);
        }
        setChallongeSubmitStatus("ok");
        if (ff(1017) && bracketFailReportedRef.current) {
          bracketFailReportedRef.current = false;
          notifyBracket("sent", matchId, p1Score, p2Score, winnerChallongeId, "");
        }
        fetchWcbOpenMatches();
        const winnerIsP1 = String(winnerChallongeId) === String(challongeP1ParticipantId);
        fetch(`${OVERLAY_WORKER}/scorelog/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        if (ff(1017)) {
          bracketFailReportedRef.current = true;
          notifyBracket("failed", matchId, p1Score, p2Score, winnerChallongeId, err.message || "error");
        }
      }
      return;
    }
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
        signal: AbortSignal.timeout(20000)
      });
      const data = await res.json();
      console.log("[BLAST] submitChallongeScore response", {
        status: res.status,
        data
      });
      if (!res.ok || data.errors) throw new Error(data.errors?.[0] || JSON.stringify(data.errors) || `HTTP ${res.status}`);
      if (ff(1017)) {
        // The send was accepted. Now ask the bracket site to confirm the match really shows as finished.
        const vr = await verifyBracketScoreTwice(matchId, scoresCsv);
        if (vr.confirmed === false) throw new Error("Not confirmed by Challonge - " + vr.reason);
      }
      setChallongeSubmitStatus("ok");
      if (ff(1017) && bracketFailReportedRef.current) {
        bracketFailReportedRef.current = false;
        notifyBracket("sent", matchId, p1Score, p2Score, winnerChallongeId, "");
      }
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
      // A busy network (many judges submitting at once) can drop or time out one request.
      // Sending the same score again is harmless, so try once more before giving up.
      const netTrouble = err && (err.name === "TimeoutError" || err.name === "AbortError" || err instanceof TypeError);
      if (netTrouble && !isRetry) {
        await new Promise(r => setTimeout(r, 2500));
        return submitChallongeScore(matchId, p1Score, p2Score, winnerChallongeId, true);
      }
      setChallongeSubmitStatus(netTrouble ? "network problem - " + (err.message || "no connection") : err.message || "error");
      if (ff(1017)) {
        bracketFailReportedRef.current = true;
        notifyBracket("failed", matchId, p1Score, p2Score, winnerChallongeId, netTrouble ? "network problem - " + (err.message || "no connection") : err.message || "error");
      }
    }
  };
  const reset = () => {
    ssClear(KEYS.matchResume);
    setTiming(null); // FLAG 1014: abandon / finish / handoff all start the next match with a blank notebook
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
    if (setDbStatus) setDbStatus(null); // FLAG 1013: clear the Database status line for the next match
    if (setTimingSendStatus) setTimingSendStatus(null); // FLAG 1015: and the Timing status line
    setConfirmState(null);
    setConfirmOverlay(false);
    setJudge("");
    setSetScores([]);
    setSideAssign(null);
    setSet1PriorityName(null);
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
    setChallongeRound(null);
    setChallongeP1ParticipantId(null);
    setChallongeP2ParticipantId(null);
    setChallongeSubmitStatus(null);
    setBracketEscape(null); // FLAG 1017
    bracketFailReportedRef.current = false; // FLAG 1017
    setUnderwayStatus(null);
    setPendingFinish(null);
    // Use in-memory log.length (not sGet(KEYS.matchLog)) — localStorage can be
    // momentarily stale or hold leftover data from a previous match/event on this
    // device, which would set matchStartIdx too low and pull old battles into the
    // next Sheets submission. log.length is the source of truth already in scope.
    // beginMatchLog keeps that behaviour and prunes the log if it hit the cap.
    // --espiiii
    beginMatchLog(log);
    // FLAG 1011: a streaming station stays streaming between matches; the
    // judge turns the slot off in the cog menu. Off = the slot is cleared
    // after every match, as before. --espiiii
    if (!ff(1011)) setOverlaySlot(0);
    setSwapped(false);
    setShuffleTimer(null);
    setSharedJudgePicker(false);
    if (!ff(1011)) {
      try {
        localStorage.setItem(KEYS.overlaySlot, "0");
      } catch {}
    }
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
  // Stable identity keeps the memoized part buttons from re-rendering. --espiiii
  const advanceDeckPicker = useCallback((who, slot, cat, updatedD1, updatedD2, returnToReview, name, qcEdit) => {
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
      // Blade → skip ratchet for NO_RATCHET blades, otherwise go to ratchet
      // Ratchet → skip bit for NO_BIT ratchets (they have a built-in bit), otherwise go to bit
      let nextCat;
      if (cat === "blade" && NO_RATCHET_BLADES.includes(name)) {
        nextCat = "bit";
      } else if (cat === "ratchet" && NO_BIT_RATCHETS.includes(name)) {
        nextCat = null; // combo is complete — fall through to slot/player advance below
      } else {
        nextCat = cats[catIdx + 1];
      }
      if (nextCat !== null) {
        openPicker({
          who,
          slot,
          cat: nextCat
        });
        return;
      }
      // null nextCat means this combo is done — fall through to the slot/player advance logic below
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
  }, [openPicker]);
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
      // FLAG 1001: send only the current match's battles. Off = whole device
      // log, which leaked every past match to the receiving judge. --espiiii
      log: ff(1001) ? currentMatch : [...log],
      matchStartIdx: ff(1001) ? 0 : matchStartIdx,
      // FLAG 1002: the receiving judge keeps scoring the same match, so it has
      // to carry the same identity or its battles would split in two. --espiiii
      matchKey: matchKey,
      challongeMatchId,
      challongeP1ParticipantId,
      challongeP2ParticipantId,
      overlaySlot,
      challongeSlug,
      timing: ff(1014) ? timing : null,
      // FLAG 1014: the clock travels with the match
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
    if (ff(1014)) setTiming(timingClean(preview.timing)); // FLAG 1014: keep the same clock across judges (none if the sender had none)
    // FLAG 1001: keep this judge's own history and append just the handed-off
    // match. Slicing by the sender's matchStartIdx also protects us from
    // tablets still on the old build, which sent their whole log.
    // Off = original behaviour: replace our log with whatever arrived.
    // --espiiii
    if (!ff(1001)) {
      setLog(preview.log || []);
      setMatchStartIdx(preview.matchStartIdx || 0);
    } else {
      const raw = Array.isArray(preview.log) ? preview.log : [];
      const from = Number.isInteger(preview.matchStartIdx) ? preview.matchStartIdx : 0;
      const incoming = raw.slice(from);
      const base = Array.isArray(log) ? log : [];
      const merged = [...base, ...incoming];
      setLog(merged);
      setMatchStartIdx(base.length);
      sSave(KEYS.matchLog, merged);
    }
    // FLAG 1002: adopt the incoming match's identity so we keep scoring the
    // same match. Prefer the explicit field, else read it off the battles we
    // just received. Set it either way — a stale key from our previous match
    // would filter the incoming battles out entirely. Null means no key
    // scoping, which falls back to the index. --espiiii
    (() => {
      const raw = Array.isArray(preview.log) ? preview.log : [];
      const fromEntry = raw.length ? raw[raw.length - 1]?.matchKey : null;
      setMatchKey(preview.matchKey || fromEntry || null);
    })();
    setChallongeMatchId(preview.challongeMatchId || null);
    setChallongeRound(preview.challongeRound ?? null);
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
    if (phase === "battle" && hasCurrentBattles) {
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
    const trimmed = otherMatches;
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
    }, currentMatch.filter(e => e.type !== "LER-STRIKE").length, " battle", currentMatch.filter(e => e.type !== "LER-STRIKE").length !== 1 ? "s" : ""), " in progress."), /*#__PURE__*/React.createElement("p", {
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

  // ── CX Part Reference Guide overlay ──────────────────────────────────────
  if (cxGuide) {
    const guideConfig = {
      blade: {
        title: "CX Blade Reference",
        sections: [
          {
            label: "CX Blades",
            color: "#0F766E",
            items: ["Blast","Arc","Antler","Brave","Brush","Dark","Eclipse","Fang","Flame","Flare","Fort","Hunt","Might","Reaper","Volt","Wriggle"],
            prefix: "MainBlade",
            nameMap: { "Eclipse": "Eclipse__28Upper_Mode_29" }
          },
          {
            label: "CXE Blades",
            color: "#7C3AED",
            items: ["Blitz","Delta","Fortress","Rage","Whip"],
            prefix: "MetalBlade",
            nameMap: {}
          }
        ]
      },
      over_blade: {
        title: "Over Blade Reference",
        sections: [
          {
            label: "Over Blades",
            color: "#7C3AED",
            items: ["Break","Flow","Guard","Outer","Peak"],
            prefix: "OverBlade",
            nameMap: {}
          }
        ]
      },
      assist: {
        title: "Assist Blade Reference",
        sections: [
          {
            label: "Assist Blades",
            color: "#0F766E",
            items: ["Assault","Bumper","Charge","Dual","Erase","Free","Gravity","Heavy","Jaggy","Knuckle","Massive","Odd","Round","Slash","Turn","Vertical","Wheel","Zillion"],
            prefix: "AssistBlade",
            nameMap: { "Dual": "Dual__28Upper_Mode_29" }
          }
        ]
      }
    };
    const cfg = guideConfig[cxGuide];
    return /*#__PURE__*/React.createElement("div", {
      style: { ...S.page, overflowY: "auto" }
    },
      /*#__PURE__*/React.createElement("button", {
        style: S.back,
        onClick: () => setCxGuide(null)
      }, IC.back, " Back"),
      /*#__PURE__*/React.createElement("h1", {
        style: { ...S.title, color: "#0F766E", textAlign: "left", margin: "0 0 16px" }
      }, cfg.title),
      cfg.sections.map(sec =>
        /*#__PURE__*/React.createElement("div", { key: sec.label, style: { marginBottom: 20 } },
          cfg.sections.length > 1 && /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 9, fontWeight: 700, color: sec.color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }
          }, sec.label),
          /*#__PURE__*/React.createElement("div", {
            style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }
          },
            sec.items.map(name => {
              const fileKey = sec.prefix + (sec.nameMap[name] || name);
              const imgSrc = CX_PART_IMAGES[fileKey];
              return /*#__PURE__*/React.createElement("div", {
                key: name,
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "var(--surface2)", borderRadius: 10, padding: "8px 4px", border: `1.5px solid ${sec.color}30` }
              },
                imgSrc
                  ? /*#__PURE__*/React.createElement("img", { src: imgSrc, alt: name, style: { width: "100%", maxWidth: 90, height: 72, objectFit: "contain", borderRadius: 6 } })
                  : /*#__PURE__*/React.createElement("div", { style: { width: "100%", height: 72, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 10 } }, "No image"),
                /*#__PURE__*/React.createElement("span", {
                  style: { fontSize: 10, fontWeight: 700, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }
                }, name)
              );
            })
          )
        )
      )
    );
  }

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
    }, playerName, " \u2014 ", comboLabel, " Combo \xB7 CX"), /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        ...S.title,
        color: "#0F766E",
        textAlign: "left",
        margin: 0,
        flex: 1
      }
    }, "Select ", stepLabels[step]), step !== "chip" && /*#__PURE__*/React.createElement("button", {
      onClick: () => setCxGuide(step),
      style: {
        flexShrink: 0,
        minHeight: 54,
        padding: "10px 14px",
        borderRadius: 10,
        border: "1.5px solid #0F766E60",
        background: "#0F766E14",
        color: "#0F766E",
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        lineHeight: 1.15
      }
    }, "\uD83D\uDDBC\uFE0F Picture Guide", /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        opacity: 0.8
      }
    }, "See photos of each part"))), chip && /*#__PURE__*/React.createElement("p", {
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
    // Skip bit step for ratchets that include a built-in bit (e.g. Turbo, Operate)
    if (cat === "bit") {
      const currentDeck = who === 1 ? d1 : d2;
      if (NO_BIT_RATCHETS.includes(currentDeck[slot]?.ratchet)) {
        const nd = [...currentDeck];
        nd[slot] = {
          ...nd[slot],
          bit: null
        };
        if (who === 1) setD1(nd);else setD2(nd);
        advanceDeckPicker(who, slot, "ratchet", who === 1 ? nd : d1, who === 2 ? nd : d2, picker.returnToReview, currentDeck[slot].ratchet, picker.qcEdit);
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
    // While searching, the popular (Top 15) parts are searchable too and keep their popular colour.
    const filteredRest = pickerSearch ? [...top10, ...rest].filter(n => n.toLowerCase().includes(searchLower)) : rest;
    const PartBtn = ({
      name,
      isTop
    }) => /*#__PURE__*/React.createElement(PartButton, {
      name: name,
      isTop: isTop,
      sel: current === name,
      taken: takenByOtherSlots.includes(name) && current !== name,
      cat: cat,
      cc: cc,
      deck: deck,
      setDeck: setDeck,
      slot: slot,
      who: who,
      d1: d1,
      d2: d2,
      picker: picker,
      advanceDeckPicker: advanceDeckPicker
    });
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
      // Ratchet picker only: "numeric" mode hides the Top box and shows every ratchet in one
      // list, lowest number first. "popular" (the default) is the original Top box + the rest.
      const numericMode = cat === "ratchet" && ratchetSort === "numeric";
      const baseList = numericMode ? sortRatchetsNumeric(list) : list;
      const restItems = numericMode ? baseList : list.filter(n => !top10.includes(n));
      // When searching, show all matching items in one flat grid
      const searchItems = pickerSearch ? baseList.filter(n => n.toLowerCase().includes(pickerSearch.toLowerCase())) : null;
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
      }))), cat === "ratchet" && /*#__PURE__*/React.createElement("div", {
        style: {
          flexShrink: 0,
          display: "flex",
          gap: 6,
          padding: "4px 10px 0"
        }
      }, [["popular", "★ Popular"], ["numeric", "# Numerical"]].map(([mode, label]) => {
        const on = ratchetSort === mode;
        return /*#__PURE__*/React.createElement("button", {
          key: mode,
          type: "button",
          onClick: () => setRatchetSort(mode),
          style: {
            flex: 1,
            padding: "7px 0",
            borderRadius: 9,
            border: `2px solid ${on ? cc : cc + "50"}`,
            background: on ? cc : "transparent",
            color: on ? "#fff" : cc,
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "'Outfit',sans-serif",
            cursor: "pointer"
          }
        }, label);
      })), !pickerSearch && !numericMode && /*#__PURE__*/React.createElement("div", {
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
        const isTop = top10.includes(name);
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
            // In numerical mode the popular ones keep the same light tint they have in the Top box.
            border: sel ? `2px solid ${cc}` : taken ? "2px solid var(--border)" : numericMode && isTop ? `2px solid ${cc}50` : "2px solid var(--border2)",
            background: sel ? cc : taken ? "var(--surface2)" : numericMode && isTop ? cc + "14" : "var(--surface2)",
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
        }, c.ratchet ? (NO_BIT_RATCHETS.includes(c.ratchet) ? c.ratchet : `${c.ratchet} · ${c.bit}`) : c.bit), anyTaken && /*#__PURE__*/React.createElement("span", {
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
        }, "EDITING \u25BE")), isMenuOpen && /*#__PURE__*/React.createElement(PartEditOverlay, {
          combo: c,
          accent: bladeColor,
          onPick: applyAndEditPrevPart,
          onClose: () => setPcEditMenu(null)
        }));
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
        "data-label": qc.ratchet ? (NO_BIT_RATCHETS.includes(qc.ratchet) ? qc.ratchet : `${qc.ratchet} · ${qc.bit}`) : qc.bit,
        "aria-label": qc.ratchet ? (NO_BIT_RATCHETS.includes(qc.ratchet) ? qc.ratchet : `${qc.ratchet} · ${qc.bit}`) : qc.bit
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
      }, "EDITING \u25BE")), isMenuOpen && /*#__PURE__*/React.createElement(PartEditOverlay, {
        combo: qc,
        accent: bladeColor,
        onPick: applyAndEditPart,
        onClose: () => setQcEditMenu(null)
      }));
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
    })))), cat === "blade" && /*#__PURE__*/React.createElement("button", {
      onClick: () => setCxPicker({
        step: "chip",
        who,
        slot,
        returnToReview: picker?.returnToReview || false
      }),
      style: {
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 14px",
        marginBottom: 8,
        borderRadius: 10,
        border: "2px solid #0F766E",
        background: "#0F766E18",
        color: "#0F766E",
        fontSize: 14,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        textAlign: "center"
      }
    }, "CX Tab"), /*#__PURE__*/React.createElement("div", {
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
    }, "\u2715"))), filteredRest.length > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5,1fr)",
        gap: 6
      }
    }, filteredRest.map(name => /*#__PURE__*/React.createElement(PartBtn, {
      key: name,
      name: name,
      isTop: !!pickerSearch && top10.includes(name)
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
    const canProceed = p1 && p2 && judge.trim();
    const hasChallonge = !!challongeSlug;

    // Mark a match as in progress on Challonge using the judge's OAuth token.
    // This attributes the action to the judge's account in the Challonge activity log,
    // and verifies they have admin permissions (non-admins will get a silent failure).
    const markMatchUnderway = async matchId => {
      if (!challongeSlug || !matchId) return;
      setUnderwayStatus("checking");
      // WCB events (slug prefixed "wcb-"): confirmed via a live test match that WCB's own
      // /result endpoint rejects a score with {error: "match_result_error", message: "Only
      // ready, unfinished matches can be scored."} once a match has been PATCHed to
      // "underway" — WCB's scoring endpoint requires the match to still be in its original
      // "ready" state, unlike Challonge where marking underway first is expected. So unlike
      // Challonge, a WCB match is deliberately NOT marked underway here — doing so would
      // lock it out of being scored later. The /wcb/match/start route in the Worker is left
      // in place in case a future flow needs it (e.g. a station "called" display), but
      // nothing calls it automatically anymore.
      if (challongeSlug.startsWith("wcb-")) {
        setUnderwayStatus(null);
        return;
      }
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
      // Deterministic resolution: match name → gid-aware participant map → self-heal.
      // "ID:x" is display-only; combo saves under it are blocked in pushDeckToRegistry.
      const idToName = buildIdToName(challongeParticipants || {});
      const name1 = resolveMatchName(match.player1_name, match.player1_id, idToName);
      const name2 = resolveMatchName(match.player2_name, match.player2_id, idToName);
      const applyNames = (n1, n2) => {
        setP1(tn(n1));
        p1Ref.current = tn(n1);
        setP2(tn(n2));
        p2Ref.current = tn(n2);
      };
      applyNames(name1 || `ID:${match.player1_id}`, name2 || `ID:${match.player2_id}`);
      if (!name1 || !name2) {
        // Self-heal: the local participant map can't resolve this match (usually a
        // Swiss event imported before the stage started, so the group-stage alias
        // ids didn't exist yet). Refetch the participant list fresh, update the
        // stored map, and swap in the real names.
        (async () => {
          try {
            const res = await fetch(`${OVERLAY_WORKER}/?slug=${encodeURIComponent(challongeSlug)}&bypass_cache=1`, {
              signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) return;
            const data = await res.json();
            const freshPmap = buildPmapFromParticipants(data.participants || []);
            if (onParticipantsRefresh) onParticipantsRefresh(freshPmap);
            const freshMap = buildIdToName(freshPmap);
            const f1 = resolveMatchName(match.player1_name, match.player1_id, freshMap);
            const f2 = resolveMatchName(match.player2_name, match.player2_id, freshMap);
            if (f1 && f2) applyNames(f1, f2);
          } catch (_) {}
        })();
      }
      setChallongeMatchId(match.id);
      setChallongeRound(match.round ?? null);
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
    })(), hasChallonge && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 0,
        marginBottom: 12,
        borderRadius: 10,
        overflow: "hidden",
        border: "2px solid var(--border)"
      }
    }, [["roster", "👥 Roster"], ["active", "⚡ Active Matches"], ["station", "🏟️ Station"]].map(([tab, label]) => /*#__PURE__*/React.createElement("button", {
      key: tab,
      type: "button",
      onClick: () => {
        setPickTab(tab);
        if (tab === "active") {
          if ((challongeSlug || "").startsWith("wcb-")) fetchWcbOpenMatches();
          else fetchActiveMatches();
        }
        if (tab === "station") fetchStationMatches();
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
    }))), pickTab === "active" && (challongeSlug || "").startsWith("wcb-") && (() => {
      // WCB event match selection (Phase 2). Tapping a match calls the same
      // selectActivePairing used for Challonge — it already works generically off
      // player1_id/player2_id/player1_name/player2_name — and markMatchUnderway/
      // submitChallongeScore branch internally to WCB's own write routes when the
      // slug is wcb-prefixed, so no separate select function is needed here.
      return /*#__PURE__*/React.createElement("div", {
        style: { ...S.card, marginBottom: 8 }
      }, /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }
      }, /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }
      }, "Select WCB Match"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: fetchWcbOpenMatches,
        style: {
          fontSize: 12, fontWeight: 700, color: "#7C3AED", background: "#7C3AED20",
          border: "2px solid #7C3AED40", borderRadius: 10, padding: "7px 14px",
          cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 5
        }
      }, "\u21BB Refresh")),
      wcbOpenMatches === "loading" && /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
      }, "\u23F3 Loading open matches..."),
      wcbOpenMatches === null && /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
      }, "Tap Refresh to load open matches."),
      Array.isArray(wcbOpenMatches) && wcbOpenMatches.length === 0 && /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
      }, "No open matches found."),
      Array.isArray(wcbOpenMatches) && wcbOpenMatches.map((match, mi) => {
        const isSelected = challongeMatchId === match.id;
        return /*#__PURE__*/React.createElement("div", {
          key: match.id || mi,
          style: { marginBottom: mi < wcbOpenMatches.length - 1 ? 8 : 0 }
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          onClick: () => selectActivePairing(match),
          style: {
            display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            padding: "12px 14px", borderRadius: 10,
            border: `2px solid ${isSelected ? "#7C3AED" : "var(--border)"}`,
            background: isSelected ? "#7C3AED20" : "var(--surface2)",
            cursor: "pointer", fontFamily: "'Outfit',sans-serif", textAlign: "left"
          }
        }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }
        }, match.player1_name || "?", " ", /*#__PURE__*/React.createElement("span", { style: { fontWeight: 400 } }, "vs"), " ", match.player2_name || "?"),
        /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 10, color: "var(--text-muted)", marginTop: 2 }
        }, match.stage_label || `Round ${match.round}`)),
        isSelected ? /*#__PURE__*/React.createElement("span", {
          style: { fontSize: 11, fontWeight: 800, color: "#7C3AED", flexShrink: 0, marginLeft: 8 }
        }, "\u2713 Selected") : /*#__PURE__*/React.createElement("span", {
          style: { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }
        }, "Select \u2192")));
      }), challongeMatchId && /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }
      }, underwayStatus === "checking" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          borderRadius: 9, background: "var(--surface2)", border: "1.5px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--border2)",
          borderTopColor: "#7C3AED", animation: "spin 1s linear infinite", flexShrink: 0
        }
      }), /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, color: "var(--text-muted)", margin: 0, fontWeight: 600 }
      }, "Marking match in progress\u2026")), underwayStatus === "ok" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          borderRadius: 9, background: "#15803D18", border: "1.5px solid #15803D"
        }
      }, /*#__PURE__*/React.createElement("span", { style: { fontSize: 13 } }, "\u2705"), /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, color: "#15803D", margin: 0, fontWeight: 700 }
      }, "WCB access confirmed \u2014 match marked in progress")), underwayStatus === "error" && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          borderRadius: 9, background: "#F59E0B18", border: "1.5px solid #F59E0B"
        }
      }, /*#__PURE__*/React.createElement("span", { style: { fontSize: 13 } }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, color: "#F59E0B", margin: 0, fontWeight: 700 }
      }, "Could not mark match in progress on WCB \u2014 check console for details")), /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.pri,
          margin: 0,
          background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
          opacity: p1 && p2 && !deckLoadingCombos ? 1 : 0.4
        },
        disabled: !(p1 && p2) || deckLoadingCombos,
        onClick: async () => {
          beginMatchLog(log);
          setFuture([]);
          setCurSet(1);
          setShuf(1);
          setPts([0, 0]);
          setSets([0, 0]);
          setUsed1([]);
          setUsed2([]);
          setLerStrikes([0, 0]);
          setSetScores([]);
          if (!eventRanked) {
            setPhase("unranked");
          } else {
            setDeckLoadingCombos(true);
            try { await refreshCombos(); } catch (_) {}
            setDeckLoadingCombos(false);
            setDeckReview(true);
            setPhase("deck");
          }
        }
      }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? "Build Decks \u2192" : "Start Match \u2192")));
    })(), pickTab === "active" && !(challongeSlug || "").startsWith("wcb-") && (() => {
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
          opacity: activeCanProceed && !deckLoadingCombos ? 1 : 0.4
        },
        disabled: !activeCanProceed || deckLoadingCombos,
        onClick: async () => {
          beginMatchLog(log);
          setFuture([]);
          setCurSet(1);
          setShuf(1);
          setPts([0, 0]);
          setSets([0, 0]);
          setUsed1([]);
          setUsed2([]);
          setLerStrikes([0, 0]);
          setSetScores([]);
          if (!eventRanked) {
            setPhase("unranked");
          } else {
            setDeckLoadingCombos(true);
            try { await refreshCombos(); } catch (_) {}
            setDeckLoadingCombos(false);
            setDeckReview(true);
            setPhase("deck");
          }
        }
      }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? "Build Decks \u2192" : "Start Match \u2192")));
    })(), pickTab === "station" && (() => {
      // ── Station Matches tab ─────────────────────────────────────────────
      // Shows the matches queued for this judge's assigned stadium, in the
      // exact top-to-bottom order set by the org, with call guidance text.
      const isLoading  = stationMatchesData === "loading";
      const isNull     = stationMatchesData === null;
      const isNoAssign = stationMatchesData?.noAssign === true;
      const hasData    = stationMatchesData && typeof stationMatchesData === "object" && !stationMatchesData.noAssign;
      // Station letters available for the manual picker
      const SLETTERS = stadiumLabelList(MAX_STADIUMS);
      const pickerCount = stationMatchesData?.stationCount || 0;

      return /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("div", {
          style: { ...S.card, marginBottom: 8 }
        },
          // ── Header row: station label + action buttons ────────────────
          /*#__PURE__*/React.createElement("div", {
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }
          },
            /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              /*#__PURE__*/React.createElement("p", {
                style: { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }
              }, hasData ? `Station ${stationMatchesData.letter} Matches` : "Station Matches"),
              // "change station" link — shown when a station is loaded (auto or manual)
              hasData && /*#__PURE__*/React.createElement("button", {
                type: "button",
                onClick: () => setStationMatchesData({ noAssign: true, stationCount: stationMatchesData.stationCount }),
                style: { fontSize: 10, fontWeight: 700, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }
              }, "\u21C4 Change")
            ),
            /*#__PURE__*/React.createElement("button", {
              type: "button",
              onClick: () => fetchStationMatches(hasData ? stationMatchesData.letter : null),
              style: { fontSize: 12, fontWeight: 700, color: "#1D4ED8", background: "#1D4ED820", border: "2px solid #1D4ED840", borderRadius: 10, padding: "7px 14px", cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 5 }
            }, "\u21BB Refresh")
          ),

          // ── Loading ───────────────────────────────────────────────────
          isLoading && /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
          }, "\u23F3 Loading station matches\u2026"),

          // ── Initial null state ────────────────────────────────────────
          (isNull && !isLoading) && /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
          }, "Tap Refresh to load your station\u2019s match queue."),

          // ── Station picker (auto-detect failed OR judge tapped "Change") ──
          isNoAssign && /*#__PURE__*/React.createElement("div", null,
            pickerCount === 0 && /*#__PURE__*/React.createElement("p", {
              style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
            }, "No stadiums are set up for this event yet. Ask the organizer to configure Stadium Assignment in the org view."),
            pickerCount > 0 && /*#__PURE__*/React.createElement("div", null,
              /*#__PURE__*/React.createElement("p", {
                style: { fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }
              }, "Couldn\u2019t detect your station automatically. Pick your station:"),
              /*#__PURE__*/React.createElement("div", {
                style: { display: "flex", flexWrap: "wrap", gap: 8 }
              }, SLETTERS.slice(0, pickerCount).map(letter =>
                /*#__PURE__*/React.createElement("button", {
                  key: letter,
                  type: "button",
                  onClick: () => fetchStationMatches(letter),
                  style: {
                    width: 52, height: 52, borderRadius: 12,
                    border: "2px solid var(--border)",
                    background: "var(--surface2)",
                    color: "var(--text-primary)",
                    fontSize: 20, fontWeight: 800,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: "pointer"
                  }
                }, letter)
              ))
            )
          ),

          // ── Inferred queue notice ──────────────────────────────────────
          hasData && stationMatchesData.inferred && stationMatchesData.queuedMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
            style: { background: "#1e3a5f", border: "1.5px solid #2563EB", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#93C5FD", lineHeight: 1.5 }
          }, "\u26A0\uFE0F Partial queue \u2014 showing your judge matches only. Once the org clicks \u201cGenerate Queues\u201d, tap Refresh for the full ordered list."),

          // ── Empty queue ────────────────────────────────────────────────
          hasData && stationMatchesData.queuedMatches.length === 0 && /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }
          }, "No open matches queued for Station ", stationMatchesData.letter, stationMatchesData.inferred ? ". Ask the org to click \u201cGenerate Queues\u201d, then Refresh." : ". All matches may be complete, or the org may need to regenerate queues."),

          // ── Match list ────────────────────────────────────────────────
          hasData && stationMatchesData.queuedMatches.length > 0 && /*#__PURE__*/React.createElement("div", null,
            stationMatchesData.queuedMatches.map((m, mi) => {
              const isSelected = challongeMatchId === m.id;
              return /*#__PURE__*/React.createElement("div", {
                key: m.id,
                style: { marginBottom: mi < stationMatchesData.queuedMatches.length - 1 ? 8 : 0 }
              },
                mi === 0 && /*#__PURE__*/React.createElement("div", {
                  style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }
                },
                  /*#__PURE__*/React.createElement("span", {
                    style: { fontSize: 9, fontWeight: 800, color: "#15803D", background: "#D1FAE5", border: "1.5px solid #6EE7B7", borderRadius: 6, padding: "2px 7px", letterSpacing: 0.5, textTransform: "uppercase" }
                  }, "\u25B6 Call Next"),
                  /*#__PURE__*/React.createElement("span", {
                    style: { fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }
                  }, "top of queue")
                ),
                /*#__PURE__*/React.createElement("button", {
                  type: "button",
                  onClick: () => selectActivePairing(m.challongeMatch),
                  style: {
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: `2px solid ${isSelected ? "#1D4ED8" : "var(--border)"}`,
                    background: isSelected ? "#1D4ED820" : "var(--surface2)",
                    cursor: "pointer", fontFamily: "'Outfit',sans-serif", textAlign: "left"
                  }
                },
                  /*#__PURE__*/React.createElement("div", null,
                    /*#__PURE__*/React.createElement("span", {
                      style: { fontSize: 11, fontWeight: 800, color: "var(--text-muted)", display: "block", marginBottom: 2 }
                    }, `#${mi + 1}`),
                    /*#__PURE__*/React.createElement("span", {
                      style: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }
                    }, m.p1),
                    /*#__PURE__*/React.createElement("span", {
                      style: { fontSize: 12, color: "var(--text-muted)", margin: "0 6px" }
                    }, "vs"),
                    /*#__PURE__*/React.createElement("span", {
                      style: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }
                    }, m.p2)
                  ),
                  isSelected && /*#__PURE__*/React.createElement("span", {
                    style: { fontSize: 12, fontWeight: 800, color: "#1D4ED8", flexShrink: 0 }
                  }, "\u2714 Selected")
                )
              );
            })
          )
        ),

        hasData && stationMatchesData.queuedMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
          style: {
            background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: 10,
            padding: "10px 14px", marginBottom: 8,
            display: "flex", gap: 10, alignItems: "flex-start"
          }
        },
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 16, flexShrink: 0, lineHeight: 1.4 } }, "\uD83D\uDCCB"),
          /*#__PURE__*/React.createElement("p", {
            style: { fontSize: 12, fontWeight: 600, color: "#92400E", margin: 0, lineHeight: 1.5 }
          }, "If you are calling your own matches to your stadium, call from the top of the list, going one match down if the top match is unable to be played currently (unless your organizer specified a different order).")
        ),

        hasData && stationMatchesData.queuedMatches.length > 0 && challongeMatchId && p1 && p2 && /*#__PURE__*/React.createElement("button", {
          type: "button",
          onClick: async () => {
            setUsed1([]);
            setUsed2([]);
            setLerStrikes([0, 0]);
            setSetScores([]);
            if (!eventRanked) {
              beginMatchLog(log);
              setFuture([]);
              setCurSet(1);
              setShuf(1);
              setPts([0, 0]);
              setSets([0, 0]);
              setPhase("unranked");
            } else {
              setDeckLoadingCombos(true);
              try { await refreshCombos(); } catch (_) {}
              setDeckLoadingCombos(false);
              setDeckReview(true);
              setPhase("deck");
            }
          },
          disabled: deckLoadingCombos,
          style: { ...S.pri, opacity: deckLoadingCombos ? 0.4 : 1 }
        }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? "Build Decks \u2192" : "Start Match \u2192")
      );
    })(), pickTab === "roster" && /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.pri,
        opacity: canProceed && !deckLoadingCombos ? 1 : 0.4
      },
      disabled: !canProceed || deckLoadingCombos,
      onClick: async () => {
        beginMatchLog(log);
        setFuture([]);
        setCurSet(1);
        setShuf(1);
        setPts([0, 0]);
        setSets([0, 0]);
        setUsed1([]);
        setUsed2([]);
        setLerStrikes([0, 0]);
        setSetScores([]);
        if (!eventRanked) {
          setPhase("unranked");
        } else {
          setDeckLoadingCombos(true);
          try { await refreshCombos(); } catch (_) {}
          setDeckLoadingCombos(false);
          setDeckReview(true);
          setPhase("deck");
        }
      }
    }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? "Build Decks \u2192" : "Start Match \u2192"), pickTab === "roster" && config.tm && playersSelected && !judge.trim() && /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.hint,
        color: "#D97706"
      }
    }, "Select the judge on duty to continue"));
  }

  // ── UNRANKED MATCH PHASE ─────────────────────────────────────────────────
  if (phase === "unranked") {
    return /*#__PURE__*/React.createElement(UnrankedFlow, {
      p1: p1,
      p2: p2,
      dark: dark,
      onMatchComplete: (winnerName, setResults) => {
        const p1Sets = setResults.filter(r => r.winner === p1).length;
        const p2Sets = setResults.filter(r => r.winner === p2).length;
        setSets([p1Sets, p2Sets]);
        const builtSetScores = setResults.map(r => {
          const p1Won = r.winner === p1;
          return { p1: p1Won ? 4 : r.loserScore, p2: p1Won ? r.loserScore : 4 };
        });
        setSetScores(builtSetScores);
        setPhase("over");
      },
      onBack: () => setPhase("pick")
    });
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
        stampTiming("decks"); // FLAG 1014: Decks Recorded marker
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

  // ── Misreport Mode ───────────────────────────────────────────────────────
  if (misreportOpen) {
    return /*#__PURE__*/React.createElement(MisreportScreen, {
      p1: p1,
      p2: p2,
      d1: d1,
      d2: d2,
      entries: currentMatch,
      config: config,
      need: need,
      onClose: () => setMisreportOpen(false),
      onSave: (newRows, finalState) => {
        const cleanRows = newRows.map(r => {
          const {
            errors,
            ...rest
          } = r;
          return rest;
        });
        const newLog = [...otherMatches, ...cleanRows];
        setLog(newLog);
        sSave(KEYS.matchLog, newLog);
        setFuture([]); // edited history invalidates any pending redo stack
        setPts(finalState.pts);
        setSets(finalState.sets);
        setCurSet(finalState.curSet);
        setShuf(finalState.shuf);
        setUsed1(finalState.used1);
        setUsed2(finalState.used2);
        setSetScores(finalState.setScores);
        setLerStrikes(finalState.lerStrikes);
        setPendingFinish(null);
        if (finalState.phase === "order") {
          setR1(null);
          setR2(null);
          setOrderPreset(true);
          setPhase("order");
        } else if (finalState.phase === "over") {
          setPhase("over");
        } else {
          const nxR1 = [0, 1, 2].find(x => !finalState.used1.includes(x));
          const nxR2 = [0, 1, 2].find(x => !finalState.used2.includes(x));
          setR1(nxR1 !== undefined ? nxR1 : null);
          setR2(nxR2 !== undefined ? nxR2 : null);
          setPhase("battle");
        }
        setMisreportOpen(false);
      }
    });
  }

  // ── Shuffle Timer Screen ────────────────────────────────────────────────────
  // ── Combined shuffle timer + deck order screen ──────────────────────────
  if (shuffleTimer || phase === "order") {
    const displayShuf = shuffleTimer === "active" ? shuf + 1 : shuf;
    return /*#__PURE__*/React.createElement(ShuffleOrderScreen, {
      showTimer: !!shuffleTimer,
      onConfirm: () => {
        stampTiming("shuffle", curSet + ":" + displayShuf); // FLAG 1014: Shuffle marker (set:shuffle-in-set)
        if (shuffleTimer) {
          // Pass combo index 0 — deck order may have changed on this screen,
          // but the first bey to play is always slot 0 after a shuffle.
          pushOverlay({
            shuffling: false,
            p1ComboIdx: 0,
            p2ComboIdx: 0
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
      canUndo: hasCurrentBattles || log[log.length - 1]?.type === "LER-STRIKE",
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
      onClick: () => {
        if (curSet === 1) stampTiming("priority"); // FLAG 1014: Priority marker
        setSidePicker({
          priority: pl.pi
        });
      },
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
        stampTiming("side", curSet); // FLAG 1014: Side Selection marker (number = set number)
        const p1Side = sidePicker.priority === 0 ? side : side === "B" ? "X" : "B";
        const p2Side = sidePicker.priority === 0 ? side === "B" ? "X" : "B" : side;
        if (curSet === 1) setSet1PriorityName(sidePicker.priority === 0 ? p1 : p2);
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
    }, otherName), " will be assigned the opposite side automatically."))), hasCurrentBattles && /*#__PURE__*/React.createElement("button", {
      onClick: undo,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        marginTop: 16,
        padding: "14px 0",
        borderRadius: 14,
        border: "2px solid var(--border2)",
        background: "var(--surface2)",
        color: "var(--text-muted)",
        fontFamily: "'Outfit',sans-serif",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, IC.undo, "Undo last battle"));
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
      timingNoteUndo([last], "undo"); // FLAG 1014: keep the undone entry, open / extend a fix window
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
      setConfirmOverlay(false);
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
    }))), eventRanked && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 12
      }
    }, [{
      label: "Battles",
      val: currentMatch.length
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
    }, "Match History"), currentMatch.map((e, i) => {
      const battles = currentMatch;
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
    }))), config.tm && eventRanked && !submitted && /*#__PURE__*/React.createElement("div", {
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
    }, "Judge confirms first, then each player taps their half of the screen."), /*#__PURE__*/React.createElement("button", {
      onClick: () => allPlayersDone ? setJudgeSubmitModal(true) : setConfirmOverlay(true),
      style: {
        display: "block",
        width: "100%",
        padding: "18px 0",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
        color: "#fff",
        fontSize: 16,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "⚖️ Judge Confirm →")), confirmOverlay && (() => {
      // Full-screen confirmation: top half = Player 1, bottom half = Player 2.
      // Big targets so a tap lands easily on a phone. When both have tapped, this
      // screen closes by itself and the Submit Results window opens.
      const tapConfirm = who => {
        if (cs[who]) return;
        const next = {
          ...cs,
          [who]: true
        };
        setConfirmState(next);
        if (next.p1ok && next.p2ok) {
          setTimeout(() => {
            setConfirmOverlay(false);
            setJudgeSubmitModal(true);
          }, 400);
        }
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 99995,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-solid)",
          fontFamily: "'Outfit',sans-serif"
        }
      }, [{
        who: "p1ok",
        name: p1,
        color: "#2563EB"
      }, {
        who: "p2ok",
        name: p2,
        color: "#DC2626"
      }].map((b, bi) => /*#__PURE__*/React.createElement("button", {
        key: bi,
        type: "button",
        disabled: !!cs[b.who],
        onClick: () => tapConfirm(b.who),
        style: {
          flex: 1,
          width: "100%",
          margin: 0,
          padding: "0 24px",
          border: "none",
          borderTop: bi === 1 ? "3px solid var(--bg-solid)" : "none",
          borderRadius: 0,
          background: cs[b.who] ? "#15803D" : b.color,
          color: "#fff",
          fontFamily: "'Outfit',sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          cursor: cs[b.who] ? "default" : "pointer"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1.1,
          textAlign: "center",
          wordBreak: "break-word"
        }
      }, cs[b.who] ? "✓ " + b.name : b.name), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: "uppercase"
        }
      }, cs[b.who] ? "Confirmed" : "Tap to confirm"), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          opacity: 0.85,
          textAlign: "center"
        }
      }, winner, " defeats ", loserName, " \xB7 ", sets[0], "–", sets[1]))), !(cs.p1ok && cs.p2ok) && /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: () => {
          // Start over: clears any taps so far and goes back to the Judge Confirm button.
          setConfirmState({
            ...cs,
            p1ok: false,
            p2ok: false
          });
          setConfirmOverlay(false);
        },
        style: {
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
          padding: "8px 14px",
          borderRadius: 999,
          border: "2px solid #fff",
          background: "rgba(15,23,42,0.85)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "← Cancel"));
    })(), judgeSubmitModal && (() => {
      const winnerIsP1 = sets[0] >= need;
      const winnerId = winnerIsP1 ? challongeP1ParticipantId : challongeP2ParticipantId;
      const p1FinalScore = sets[0];
      const p2FinalScore = sets[1];
      const hasChallonge = !!(challongeSlug && challongeMatchId);
      const isWcbEvent = (challongeSlug || "").startsWith("wcb-");
      const bracketLabel = isWcbEvent ? "WCB" : "Challonge";
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
        label: `Submit to ${bracketLabel}`,
        desc: hasChallonge ? `Reports result to the active bracket match` : "No bracket match selected",
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
      }, `\u2713 ${bracketLabel} submitted`), challongeSubmitStatus && challongeSubmitStatus !== "ok" && challongeSubmitStatus !== "loading" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#DC2626",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, `\u2715 ${bracketLabel}: `, challongeSubmitStatus), (sheetsStatus === "success" || sheetsStatus === "sent" || sheetsStatus === "sending") && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: sheetsStatus === "sending" ? "#B45309" : "#15803D",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, sheetsStatus === "sending" ? "\u2026 Sending to Sheets" : sheetsStatus === "sent" ? "\u2713 Sent to Sheets" : "\u2713 Sheets submitted"), sheetsStatus === "error" && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#DC2626",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, "\u2715 Sheets failed \u2014 CSV downloaded"),
      // FLAG 1013: a judge name is required before anything is submitted. If it is
      // blank, ask for it here (same name box as the Judge field on this screen).
      // Off = no prompt and no check, exactly as before. --espiiii
      ff(1013) && !(judge || "").trim() && /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#DC2626",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 6
        }
      }, "Judge name needed to submit \u2014 type it, then press Enter or tap outside the box"), /*#__PURE__*/React.createElement(JudgeInput, {
        style: {
          ...S.inp,
          width: "100%",
          fontSize: 14
        },
        value: judge,
        onCommit: v => setJudge(v),
        onClear: () => {}
      })), /*#__PURE__*/React.createElement("button", {
        // Do NOT gate this button on sheetsStatus. It submits to Challonge AND
        // Sheets in one click, so keying it off one service's state kills the
        // other — that broke Challonge submits. Duplicate protection lives
        // inside handleSendSheets instead. --espiiii
        disabled: challongeSubmitStatus === "loading" || ff(1013) && !(judge || "").trim(),
        onClick: () => {
          if (ff(1013) && !(judge || "").trim()) return; // FLAG 1013: blank judge name - do not submit
          stampTiming("complete"); // FLAG 1014: Match Complete marker (first Submit press only)
          // FLAG 1015: build the timing lines to send with the match. Same "first press wins" rule
          // as the marker above, worked out here because the saved state is not updated yet.
          let timingPayload = null;
          if (ff(1015) && ff(1014)) {
            try {
              const nowT = Date.now();
              const first = currentMatch[0] || {};
              timingPayload = timingToContract(timingStampPure(timing, "complete", null, nowT), currentMatch, {
                slug: challongeSlug,
                tournament: config && config.tournamentName || "",
                matchKey,
                match: first.p1Name ? first.p1Name + " vs " + first.p2Name : "",
                judge,
                p1,
                p2
              }, nowT);
            } catch (_) {}
          }
          setJudgeSubmitModal(false);
          setConfirmState({
            ...cs,
            judgeok: true
          });
          if (submitSheetsCheck) {
            onSendSheets(currentMatch, {
              p1,
              p2,
              sets,
              config,
              winner,
              shuffles: shuf,
              judge,
              challongeMatchId,
              challongeSlug,
              set1PriorityName,
              timing: timingPayload,
              timingRound: challongeRound
            });
          } else {
            onDownloadCSV(currentMatch, {
              p1,
              p2,
              sets,
              config,
              winner,
              shuffles: shuf,
              set1PriorityName
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
    })(), config.tm && eventRanked && submitted && challongeSlug && challongeMatchId && (() => {
      // The Submit window closes the moment Submit is pressed, so show the Challonge
      // result here too - a failed send must never go unnoticed.
      const winnerIsP1 = sets[0] >= need;
      const winnerId = winnerIsP1 ? challongeP1ParticipantId : challongeP2ParticipantId;
      const bracketLabel = (challongeSlug || "").startsWith("wcb-") ? "WCB" : "Challonge";
      const st = challongeSubmitStatus;
      if (st === "ok") return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "10px 14px",
          borderRadius: 10,
          background: "#15803D15",
          border: "1px solid #15803D40",
          fontSize: 13,
          fontWeight: 700,
          color: "#15803D",
          textAlign: "center",
          marginBottom: 10
        }
      }, `\u2713 Submitted to ${bracketLabel}`);
      if (st === "loading") return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "10px 14px",
          borderRadius: 10,
          background: "#B4530915",
          border: "1px solid #B4530940",
          fontSize: 13,
          fontWeight: 700,
          color: "#B45309",
          textAlign: "center",
          marginBottom: 10
        }
      }, `\u2026 Sending to ${bracketLabel}`);
      if (!st) return bracketEscapeUI(bracketLabel, winnerId, true);
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: () => submitChallongeScore(challongeMatchId, sets[0], sets[1], winnerId),
        style: {
          display: "block",
          width: "100%",
          padding: "14px 0",
          borderRadius: 12,
          border: "none",
          background: "#DC2626",
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer",
          marginBottom: 6
        }
      }, `\u2715 NOT sent to ${bracketLabel} \u2014 tap to retry`), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: "#DC2626",
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 10,
          wordBreak: "break-word"
        }
      }, st), bracketEscapeUI(bracketLabel, winnerId, true));
    })(), config.tm && eventRanked && submitted && /*#__PURE__*/React.createElement("button", {
      style: newMatchLocked ? {
        ...S.pri,
        opacity: 0.4,
        cursor: "not-allowed"
      } : S.pri,
      disabled: newMatchLocked,
      onClick: () => {
        if (newMatchLocked) return;
        setSheetsStatus(null);
        resetAndRestoreJudge();
      }
    }, newMatchLocked ? "New Match (waiting for " + ((challongeSlug || "").startsWith("wcb-") ? "WCB" : "Challonge") + ")" : "New Match"), config.tm && !eventRanked && (() => {
      // ── Unranked over screen: simple bracket submit + New Match ──
      const winnerIsP1 = sets[0] >= need;
      const winnerId = winnerIsP1 ? challongeP1ParticipantId : challongeP2ParticipantId;
      const bracketLabel = (challongeSlug || "").startsWith("wcb-") ? "WCB" : "Challonge";
      return /*#__PURE__*/React.createElement(React.Fragment, null,
        challongeSlug && challongeMatchId && (challongeSubmitStatus === "ok"
          ? /*#__PURE__*/React.createElement("div", {
              style: {
                padding: "10px 14px",
                borderRadius: 10,
                background: "#15803D15",
                border: "1px solid #15803D40",
                fontSize: 13,
                fontWeight: 700,
                color: "#15803D",
                textAlign: "center",
                marginBottom: 10
              }
            }, `\u2713 Submitted to ${bracketLabel}`)
          : /*#__PURE__*/React.createElement("button", {
              type: "button",
              disabled: challongeSubmitStatus === "loading",
              onClick: () => submitChallongeScore(challongeMatchId, sets[0], sets[1], winnerId),
              style: {
                display: "block",
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                background: challongeSubmitStatus === "loading" ? "#CBD5E1" : "#EA580C",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                fontFamily: "'Outfit',sans-serif",
                cursor: challongeSubmitStatus === "loading" ? "not-allowed" : "pointer",
                marginBottom: 10
              }
            }, challongeSubmitStatus === "loading" ? "Submitting\u2026" : challongeSubmitStatus && challongeSubmitStatus !== "loading" ? "\u2715 Failed \u2014 Retry" : (`Submit to ${bracketLabel}` + (winnerId ? "" : " \u26A0\uFE0F")))
        ),
        challongeSubmitStatus && challongeSubmitStatus !== "ok" && challongeSubmitStatus !== "loading" && /*#__PURE__*/React.createElement("p", {
          style: { fontSize: 11, color: "#DC2626", fontWeight: 600, textAlign: "center", marginBottom: 8 }
        }, challongeSubmitStatus),
        bracketEscapeUI(bracketLabel, winnerId, false),
        /*#__PURE__*/React.createElement("button", {
          style: newMatchLocked ? {
            ...S.pri,
            opacity: 0.4,
            cursor: "not-allowed"
          } : S.pri,
          disabled: newMatchLocked,
          onClick: () => {
            if (newMatchLocked) return;
            setSheetsStatus(null);
            resetAndRestoreJudge();
          }
        }, "New Match")
      );
    })(), !config.tm && /*#__PURE__*/React.createElement(React.Fragment, null, challongeSlug && challongeMatchId && (() => {
      const winnerIsP1 = sets[0] >= need;
      const winnerId = winnerIsP1 ? challongeP1ParticipantId : challongeP2ParticipantId;
      const bracketLabel = (challongeSlug || "").startsWith("wcb-") ? "WCB" : "Challonge";
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
      }, `\u2713 Submitted to ${bracketLabel}`) : /*#__PURE__*/React.createElement("button", {
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
      }, challongeSubmitStatus === "loading" ? "Submitting…" : `Submit to ${bracketLabel}${winnerId ? "" : " ⚠️"}`);
    })(), /*#__PURE__*/React.createElement("button", {
      style: S.pri,
      onClick: () => {
        setSheetsStatus(null);
        resetAndRestoreJudge();
      }
    }, "New Match")), eventRanked && /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.sec,
        width: "100%",
        justifyContent: "center"
      },
      onClick: () => onDownloadCSV(currentMatch, {
        p1,
        p2,
        sets,
        config,
        winner,
        shuffles: shuf,
        set1PriorityName
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
    }, "\u2B05 Main Menu"), config.tm && (sheetsStatus === "success" || sheetsStatus === "sent") && /*#__PURE__*/React.createElement("div", {
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
      // FLAG 1003: "sent" means the request went through but the reply could not
      // be read, which is normal for Apps Script. Do not call that a failure.
      // --espiiii
    }, sheetsStatus === "sent" ? "\u2713 Sent to Google Sheets \u2014 confirm the row landed before re-sending" : "\u2713 Results submitted to Google Sheets"), config.tm && sheetsStatus === "error" && /*#__PURE__*/React.createElement("div", {
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
    }, "\u2715 Sheets submission failed \u2014 download CSV manually"),
    // FLAG 1013: separate Database status line. Never changes the Sheets wording above.
    config.tm && ff(1013) && dbStatus && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: dbStatus === "sent" ? "#15803D15" : dbStatus === "failed" ? "#DC262615" : dbStatus === "sending" ? "#B4530915" : "var(--surface2)",
        border: "1px solid " + (dbStatus === "sent" ? "#15803D40" : dbStatus === "failed" ? "#DC262640" : dbStatus === "sending" ? "#B4530940" : "var(--border)"),
        fontSize: 12,
        fontWeight: 600,
        color: dbStatus === "sent" ? "#15803D" : dbStatus === "failed" ? "#DC2626" : dbStatus === "sending" ? "#B45309" : "var(--text-muted)",
        textAlign: "center"
      }
    }, dbStatus === "sending" ? "\u2026 Database: sending" : dbStatus === "sent" ? "\u2713 Database: sent" : dbStatus === "skipped" ? "Database: skipped (no tournament)" : /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onRetryDatabase && onRetryDatabase(),
      style: {
        background: "none",
        border: "none",
        padding: 0,
        color: "#DC2626",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        textDecoration: "underline"
      }
    }, "\u2715 Database: failed \u2014 CSV downloaded \u2014 tap to retry"), dbStatus === "failed" && dbError && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-muted)",
        wordBreak: "break-word",
        userSelect: "text",
        WebkitUserSelect: "text"
      }
    }, "Reason: " + dbError)),
    // FLAG 1015: separate Timing status line (match timing sent to the database).
    config.tm && ff(1015) && timingSendStatus && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: timingSendStatus === "sent" ? "#15803D15" : timingSendStatus === "failed" ? "#DC262615" : timingSendStatus === "sending" ? "#B4530915" : "var(--surface2)",
        border: "1px solid " + (timingSendStatus === "sent" ? "#15803D40" : timingSendStatus === "failed" ? "#DC262640" : timingSendStatus === "sending" ? "#B4530940" : "var(--border)"),
        fontSize: 12,
        fontWeight: 600,
        color: timingSendStatus === "sent" ? "#15803D" : timingSendStatus === "failed" ? "#DC2626" : timingSendStatus === "sending" ? "#B45309" : "var(--text-muted)",
        textAlign: "center"
      }
    }, timingSendStatus === "sending" ? "\u2026 Timing: sending" : timingSendStatus === "sent" ? "\u2713 Timing: sent" : timingSendStatus === "skipped" ? "Timing: nothing to send" : timingSendStatus === "backup" ? "Timing: not sent to the database \u2014 a backup file is going to the cloud folder" : timingSendStatus === "downloaded" ? "Timing: CSV downloaded to this device" : /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onRetryTiming && onRetryTiming(),
      style: {
        background: "none",
        border: "none",
        padding: 0,
        color: "#DC2626",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        textDecoration: "underline"
      }
    }, "\u2715 Timing: not sent yet \u2014 retrying on its own \u2014 tap to retry now"), timingSendStatus === "failed" && timingSendError && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-muted)",
        wordBreak: "break-word",
        userSelect: "text",
        WebkitUserSelect: "text"
      }
    }, "Reason: " + timingSendError)));
  }

  // Battle screen (merged: combo pick + scoring in one view)
  const comboOf = (deck, idx) => deck[idx] || {};
  const battlesInThisSet = currentMatch.filter(e => e.set === curSet && e.type !== "LER-STRIKE" && e.type !== "LER").length + 1;
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
  }, IC.back), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: bp(3),
      minWidth: 0
    }
  }, (() => {
    const canUndo = hasCurrentBattles || log[log.length - 1]?.type === "LER-STRIKE";
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
    }, "Undo")), currentSides.p1Side && /*#__PURE__*/React.createElement("button", {
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
        // FLAG 1008: Swap used to reach the overlay only on the next point.
        // Push now with the post-swap values (the setters above are async).
        // --espiiii
        if (ff(1008)) pushOverlay({
          swapped: !swapped,
          p1Side: currentSides.p2Side || "",
          p2Side: currentSides.p1Side || ""
        });
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
    }, "Swap")), hasCurrentBattles && currentMatch.some(e => e.set === curSet) && /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "Restart this set at 0-0",
      onClick: () => setResetSetConfirm(true),
      style: {
        ...btnBase,
        flex: "0 0 auto",
        width: bp(30),
        color: config.tm ? "#FCA5A5" : "var(--text-secondary)"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: bf(14),
      height: bf(14),
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "23 4 23 10 17 10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: config.tm ? "#FCA5A5" : "var(--text-secondary)"
      }
    }, "Reset")));
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
    const canUndoMenu = hasCurrentBattles || log[log.length - 1]?.type === "LER-STRIKE";
    const cogIcon = React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: 12,
      cy: 12,
      r: 3
    }), React.createElement("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
    }));
    // One row in the settings menu. Closes the menu, then runs the same action the old banner button ran.
    const menuRow = (key, icon, label, onPick, opts = {}) => React.createElement("button", {
      key,
      type: "button",
      disabled: !!opts.disabled,
      onClick: () => {
        setSettingsMenuOpen(false);
        onPick();
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: bp(10),
        width: "100%",
        padding: `${bp(10)}px ${bp(10)}px`,
        borderRadius: bp(7),
        border: "none",
        background: "none",
        textAlign: "left",
        fontFamily: "'Outfit',sans-serif",
        fontSize: bf(13),
        fontWeight: 700,
        color: opts.color || "var(--text-primary)",
        opacity: opts.disabled ? 0.35 : 1,
        cursor: opts.disabled ? "default" : "pointer"
      }
    }, React.createElement("span", {
      style: {
        width: bp(22),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: bf(15),
        lineHeight: 1
      }
    }, icon), React.createElement("span", {
      style: {
        flex: 1
      }
    }, label), opts.hint ? React.createElement("span", {
      style: {
        fontSize: bf(10),
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, opts.hint) : null);
    // FLAG 1005: the "?" report button lives here on the battle screen. While it
    // is mounted the floating "?" hides, so it never covers the cog or the
    // dark-mode toggle in this corner. --espiiii
    return /*#__PURE__*/React.createElement(React.Fragment, null, ff(1005) && /*#__PURE__*/React.createElement(BugReportInlineButton, null), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        flexShrink: 0,
        zIndex: 300
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setSettingsMenuOpen(o => !o),
      style: {
        ...sq,
        position: "relative",
        background: layoutEditMode ? "#7C3AED" : settingsMenuOpen ? config.tm ? "rgba(255,255,255,0.2)" : "var(--surface2)" : "none",
        border: layoutEditMode ? "none" : `1px solid ${config.tm ? "rgba(255,255,255,0.3)" : "var(--border2)"}`,
        color: layoutEditMode ? "#fff" : config.tm ? "#E9D5FF" : "var(--text-muted)"
      },
      title: "Settings"
    }, cogIcon, overlaySlot > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 1,
        right: 1,
        width: bp(7),
        height: bp(7),
        borderRadius: "50%",
        background: "#3B82F6",
        border: "1px solid #fff",
        pointerEvents: "none"
      }
    })), settingsMenuOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      onClick: () => setSettingsMenuOpen(false),
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 299,
        background: "transparent"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        zIndex: 300,
        minWidth: bp(200),
        padding: bp(4),
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border2)",
        borderRadius: bp(10),
        boxShadow: "0 6px 24px rgba(0,0,0,0.28)"
      }
    }, ff(1014) ? null : menuRow("redo", IC.redo, "Redo", redo, {
      disabled: !future.length,
      color: future.length ? "#EA580C" : "var(--text-disabled)"
    }), menuRow("fix", IC.editLog, "Fix", () => setMisreportOpen(true), {
      disabled: !canUndoMenu
    }), menuRow("log", IC.history, "Log", () => setHistoryOpen(true)), menuRow("stream", "\uD83D\uDCE1", "Stream overlay", () => setOverlayModal(true), {
      hint: overlaySlot > 0 ? `Slot ${overlaySlot}` : "Off"
    }), config.tm && challongeMatchId && menuRow("handoff", "\uD83D\uDD00", "Hand off match", () => {
      if (sharedJudges) {
        setHandoffMethodPicker(true);
      } else {
        startHandoff();
      }
    }), ff(1014) && menuRow("timing", "\u23F1", "Match timing", () => setTimingOpen(true)), menuRow("layout", "\u283F", layoutEditMode ? "Exit layout edit" : "Adjust layout", () => setLayoutEditMode(m => !m), {
      color: layoutEditMode ? "#7C3AED" : undefined
    })))), /*#__PURE__*/React.createElement("button", {
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
  }, config.bo > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      ...S.pill,
      margin: 0,
      marginBottom: bp(2),
      padding: `${bp(1)}px ${bp(8)}px`,
      fontSize: Math.max(8, Math.round(bf(10) * scoreFrac)),
      lineHeight: 1.25,
      whiteSpace: "nowrap"
    }
  }, dA.sets, "\u2013", dB.sets), (currentSides.p1Side || currentSides.p2Side) && /*#__PURE__*/React.createElement("span", {
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
      const lerDo = () => {
        if (lerLocked) return;
        if (!hasStrike) {
          const strikeEntry = {
            // FLAG 1002 — see the note on the main entry above. --espiiii
            matchKey: matchKey,
            slug: challongeSlug || "",
            set: curSet,
            shuffle: shuf,
            slot: currentMatch.filter(e => e.set === curSet).length + 1,
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
      // Ask first so a mis-tap cannot give a strike or a point to the wrong player.
      const lerClick = () => {
        if (lerLocked) return;
        setLerConfirm({
          pi: side.ci,
          second: hasStrike,
          run: lerDo
        });
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
            // Own Over / Own Xtreme give the points to the OTHER player, which is easy to
            // misread - ask first, naming who gets them.
            if (side.pending.penalty) {
              setOwnConfirm({
                pi: side.ci,
                fin: side.pending
              });
              return;
            }
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
  }), renderTimingModal(), overlayModal && /*#__PURE__*/React.createElement("div", {
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
      // FLAG 1001: reset the boundary too, or it points past the now-empty
      // log. --espiiii
      if (ff(1001)) setMatchStartIdx(0);
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
  }), ownConfirm && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.7)",
      zIndex: 700,
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
      border: "1px solid var(--border)",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--text-muted)",
      margin: "0 0 6px",
      textAlign: "center"
    }
  }, (ownConfirm.pi === 0 ? p1 : p2) + " \u2014 " + (ownConfirm.fin.p >= 3 ? "Own Xtreme" : "Own Over")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: "0 0 18px",
      textAlign: "center",
      lineHeight: 1.35
    }
  }, "This action will award " + ownConfirm.fin.p + " points to " + (ownConfirm.pi === 0 ? p2 : p1) + ". Continue?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOwnConfirm(null),
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 11,
      border: "2px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-muted)",
      fontSize: 14,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const oc = ownConfirm;
      setOwnConfirm(null);
      doScore(oc.pi, oc.fin);
      setPendingFinish(null);
    },
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 11,
      border: "none",
      background: "#7C3AED",
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Continue")))), lerConfirm && /*#__PURE__*/React.createElement(ConfirmWindow, {
    title: (lerConfirm.pi === 0 ? p1 : p2) + " \u2014 Launch Error",
    text: lerConfirm.second ? "Give " + (lerConfirm.pi === 0 ? p2 : p1) + " 1 point from " + (lerConfirm.pi === 0 ? p1 : p2) + "'s second launch error?" : "Give a Launch Error to " + (lerConfirm.pi === 0 ? p1 : p2) + "?",
    onCancel: () => setLerConfirm(null),
    onOk: () => {
      const lc = lerConfirm;
      setLerConfirm(null);
      lc.run();
    }
  }), resetSetConfirm && /*#__PURE__*/React.createElement(ConfirmWindow, {
    title: "Restart Set " + curSet,
    text: "Restart Set " + curSet + " at 0-0? Every battle scored in this set will be removed and you go back to the first shuffle. Earlier sets are not touched.",
    okLabel: "Restart set",
    onCancel: () => setResetSetConfirm(false),
    onOk: () => {
      setResetSetConfirm(false);
      resetCurrentSet();
    }
  }), bracketEscape === "confirm" && /*#__PURE__*/React.createElement(ConfirmWindow, {
    title: "Enter this score by hand",
    text: "Tell the TO to enter " + (p1 || "Player 1") + " " + sets[0] + "-" + sets[1] + " " + (p2 || "Player 2") + " by hand? Then you can start the next match.",
    okLabel: "Tell the TO",
    onCancel: () => setBracketEscape(null),
    onOk: async () => {
      setBracketEscape("sending");
      const winnerId = sets[0] >= need ? challongeP1ParticipantId : challongeP2ParticipantId;
      const sent = await notifyBracket("manual", challongeMatchId, sets[0], sets[1], winnerId, challongeSubmitStatus && challongeSubmitStatus !== "loading" ? String(challongeSubmitStatus) : "not sent");
      setBracketEscape(sent ? "done" : "failed");
    }
  })));
}
// Small reusable "are you sure?" window (title, question, Cancel / OK).
function ConfirmWindow({
  title,
  text,
  okLabel,
  onCancel,
  onOk
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.7)",
      zIndex: 700,
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
      border: "1px solid var(--border)",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--text-muted)",
      margin: "0 0 6px",
      textAlign: "center"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: "0 0 18px",
      textAlign: "center",
      lineHeight: 1.35
    }
  }, text), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 11,
      border: "2px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-muted)",
      fontSize: 14,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: onOk,
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 11,
      border: "none",
      background: "#7C3AED",
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, okLabel || "Continue"))));
}
(window.__NCB_PARTS = window.__NCB_PARTS || {}).match = true; // ticks this file's box - app.js checks all boxes before starting
