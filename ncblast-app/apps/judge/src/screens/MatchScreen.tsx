import { useEffect, useRef, useState } from "react";
import type {
  Combo,
  Finish,
  MatchConfig,
  Parts,
  LogEntry,
  ChallongeParticipantMap,
  ChallongeMatch,
  Side,
} from "@ncblast/shared";
import {
  FINISH,
  PENALTY,
  sGet,
  sSave,
  STORAGE_KEYS as KEYS,
  WORKER_BASE_URL,
  OVERLAY_WORKER,
} from "@ncblast/shared";
import { S } from "../styles";
import { IC } from "../components/Icons";
import { JudgeInput } from "../components/JudgeInput";
import { PartLabel } from "../components/PartLabel";
import {
  CROSSOVER_BLADES,
  CX_CHIPS,
  CX_BLADES,
  CXE_BLADES,
  CXE_OVER_BLADES,
  CX_ASSISTS,
  CX_ASSIST_TOP5,
  TOP10,
  BLADE_COLORS,
  QUICK_COMBOS,
} from "../data/parts";
import { emptyCombo, comboStr, comboReady, tn, splitPartName } from "../utils";
import {
  pushComboCacheToWorker,
  fetchComboCacheFromWorker,
  COMBO_CACHE_TTL,
} from "../comboCache";
import { enqueue, remove as removeFromQueue } from "../submitQueue";

type Phase = "pick" | "deck" | "battle" | "over";

interface PickerState {
  who: 1 | 2;
  slot: number;
  cat: "blade" | "ratchet" | "bit";
  returnToReview?: boolean;
}

interface CxPickerState {
  step: "chip" | "blade" | "over_blade" | "assist";
  who: 1 | 2;
  slot: number;
  chip?: string;
  blade?: string;
  overBlade?: string;
  isCXE?: boolean;
  returnToReview?: boolean;
}

interface SideAssign {
  pickPriority: 0 | 1 | null;
  p1Side?: Side;
  p2Side?: Side;
}

interface SidePicker {
  priority: 0 | 1 | null;
}

interface ConfirmState {
  p1ok: boolean;
  p2ok: boolean;
  judgeok: boolean;
  voidConfirm: boolean;
}

interface PendingFinish {
  pi: 0 | 1;
  fin: Finish;
}

export interface DownloadCsvMeta {
  p1: string | null;
  p2: string | null;
  sets: [number, number];
  config: MatchConfig;
  winner: string | null;
  shuffles: number;
}

export interface SendSheetsMeta extends DownloadCsvMeta {
  flagged?: boolean;
  comment?: string;
}

export interface MatchScreenProps {
  config: MatchConfig;
  parts: Parts;
  players: string[];
  judge: string;
  setJudge: (v: string) => void;
  sheetsStatus: null | "success" | "error" | "queued";
  setSheetsStatus: (s: null | "success" | "error" | "queued") => void;
  onBack: () => void;
  onMainMenu: () => void;
  onDownloadCSV: (log: LogEntry[], meta: DownloadCsvMeta) => void;
  onSendSheets: (log: LogEntry[], meta: SendSheetsMeta) => void;
  onOpenLib: () => void;
  dark: boolean;
  toggleDark: () => void;
  challongeSlug: string;
  challongeParticipants: ChallongeParticipantMap;
}

function hasKey<K extends string>(o: unknown, k: K): o is Record<K, unknown> {
  return typeof o === "object" && o !== null && k in o;
}

/**
 * SCREEN 3 — MATCH. The large match screen: pick players/judge/side,
 * build decks (linear picker + review), battle scoring + confirm-step,
 * match over, CX/CXE picker, stream overlay push, Challonge submit, etc.
 */
export function MatchScreen(props: MatchScreenProps) {
  const {
    config,
    parts,
    players,
    judge,
    setJudge,
    sheetsStatus,
    setSheetsStatus,
    onBack,
    onMainMenu,
    onDownloadCSV,
    onSendSheets,
    dark,
    toggleDark,
    challongeSlug,
    challongeParticipants,
  } = props;

  const [phase, setPhase] = useState<Phase>("pick");
  const [abandonConfirm, setAbandonConfirm] = useState(false);
  const [overBackConfirm, setOverBackConfirm] = useState(false);
  const [p1, setP1] = useState<string | null>(null);
  const [p2, setP2] = useState<string | null>(null);
  // Colors assigned at match start and stay with the player name through swaps
  const [p1Color, setP1Color] = useState("#2563EB");
  const [p2Color, setP2Color] = useState("#DC2626");
  // Returns the color originally assigned to a player name
  const colorOf = (name: string): string =>
    name === p1 ? p1Color : name === p2 ? p2Color : "#64748B";
  const [d1, setD1] = useState<Combo[]>([
    emptyCombo(),
    emptyCombo(),
    emptyCombo(),
  ]);
  const [d2, setD2] = useState<Combo[]>([
    emptyCombo(),
    emptyCombo(),
    emptyCombo(),
  ]);
  const [r1, setR1] = useState<number | null>(null);
  const [r2, setR2] = useState<number | null>(null);
  const [used1, setUsed1] = useState<number[]>([]);
  const [used2, setUsed2] = useState<number[]>([]);
  const [pts, setPts] = useState<[number, number]>([0, 0]);
  const [sets, setSets] = useState<[number, number]>([0, 0]);
  const [curSet, setCurSet] = useState(1);
  const [shuf, setShuf] = useState(0);
  const [log, setLog] = useState<LogEntry[]>(() =>
    sGet(KEYS.matchLog, [] as LogEntry[]),
  );
  const [future, setFuture] = useState<LogEntry[]>([]);
  const [matchStartIdx, setMatchStartIdx] = useState(0);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pickerHistory, setPickerHistory] = useState<PickerState[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [crossoverOpen, setCrossoverOpen] = useState(false);
  const [cxPicker, setCxPicker] = useState<CxPickerState | null>(null);
  const openPicker = (val: PickerState): void => {
    setPickerHistory((h) => (picker ? [...h, picker] : h));
    setPicker(val);
    setPickerSearch("");
    setCrossoverOpen(false);
    setCxPicker(null);
  };
  const undoPicker = (): void => {
    if (!pickerHistory.length) return;
    const prev = pickerHistory[pickerHistory.length - 1];
    setPickerHistory((h) => h.slice(0, -1));
    // Clear the part that was just picked at the current step
    if (picker && !picker.returnToReview) {
      const { who, slot, cat } = picker;
      const deck = who === 1 ? d1 : d2;
      const setDeck = who === 1 ? setD1 : setD2;
      const nd = [...deck];
      nd[slot] = { ...nd[slot], [cat]: null };
      setDeck(nd);
    }
    setPicker(prev);
    setPickerSearch("");
    setCrossoverOpen(false);
    setCxPicker(null);
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [manualJudge, setManualJudge] = useState(false);
  const [setScores, setSetScores] = useState<Array<Record<string, number>>>([]);
  const [sideAssign, setSideAssign] = useState<SideAssign | null>(null);
  const [sidePicker, setSidePicker] = useState<SidePicker | null>(null);
  const [currentSides, setCurrentSides] = useState<{
    p1Side: Side;
    p2Side: Side;
  }>({ p1Side: "", p2Side: "" });
  const [deckReview, setDeckReview] = useState(false);
  const [lerStrikes, setLerStrikes] = useState<[number, number]>([0, 0]);
  const [pickTab, setPickTab] = useState<"roster" | "active">(
    challongeSlug ? "active" : "roster",
  );
  const [activeMatches, setActiveMatches] = useState<
    "loading" | ChallongeMatch[] | null
  >(null);
  const [challongeMatchId, setChallongeMatchId] = useState<number | null>(null);
  const [challongeP1ParticipantId, setChallongeP1ParticipantId] = useState<
    number | null
  >(null);
  const [challongeP2ParticipantId, setChallongeP2ParticipantId] = useState<
    number | null
  >(null);
  const [challongeSubmitStatus, setChallongeSubmitStatus] = useState<
    null | "loading" | "ok" | string
  >(null);
  const [pendingFinish, setPendingFinish] = useState<PendingFinish | null>(
    null,
  );
  const [overlaySlot, setOverlaySlot] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(KEYS.overlaySlot) || "0", 10) || 0;
    } catch {
      return 0;
    }
  });
  const [workerCombos, setWorkerCombos] = useState<Record<string, Combo[]>>({});
  const [overlayStatus, setOverlayStatus] = useState<null | "ok" | "error">(
    null,
  );
  const [historyConfirmClear, setHistoryConfirmClear] = useState(false);
  const [judgeSubmitModal, setJudgeSubmitModal] = useState(false);
  const [submitChallongeCheck, setSubmitChallongeCheck] = useState(true);
  const [submitSheetsCheck, setSubmitSheetsCheck] = useState(true);
  const [sheetsComment, setSheetsComment] = useState("");
  const [judgeEditMode, setJudgeEditMode] = useState(false);
  // Portrait vs landscape for combo button layout — recomputed on each render via sc trigger
  const comboAreaRef = useRef<HTMLDivElement>(null); // kept for legacy ref safety, not used for measurement
  // Silence unused refs / setters we only keep for parity with source state:
  void comboAreaRef;
  void sideAssign;
  void setSideAssign;

  const fetchActiveMatches = async (): Promise<void> => {
    if (!challongeSlug) return;
    setActiveMatches("loading");
    try {
      const res = await fetch(
        `${WORKER_BASE_URL}/matches?slug=${encodeURIComponent(challongeSlug)}`,
        {
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (
        hasKey(data, "errors") &&
        Array.isArray(data.errors) &&
        data.errors.length
      ) {
        throw new Error(String(data.errors[0]));
      }
      if (hasKey(data, "matches") && Array.isArray(data.matches)) {
        setActiveMatches(data.matches as ChallongeMatch[]);
      } else {
        setActiveMatches([]);
      }
    } catch {
      setActiveMatches([]);
    }
  };

  // Auto-fetch active matches if we default to active tab
  useEffect(() => {
    if (challongeSlug) fetchActiveMatches();
  }, []);

  // Load combos from Worker KV when player names are known (cross-device cache)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results: Record<string, Combo[]> = {};
      await Promise.all(
        [p1, p2]
          .filter((x): x is string => Boolean(x))
          .map(async (name) => {
            const combos = await fetchComboCacheFromWorker(name);
            if (combos.length) results[name] = combos;
          }),
      );
      if (!cancelled) setWorkerCombos((prev) => ({ ...prev, ...results }));
    }
    if (p1 || p2) load();
    return () => {
      cancelled = true;
    };
  }, [p1, p2]);

  const need = Math.ceil(config.bo / 2);
  const cReady = d1.every(comboReady) && d2.every(comboReady);

  const pushOverlay = (extraState: Record<string, unknown> = {}): void => {
    if (!overlaySlot) return; // streaming disabled
    const activeComboOf = (
      deck: Combo[],
      idx: number | null,
    ): { blade: string; ratchet: string | null; bit: string | null } | null => {
      const c = idx !== null ? deck[idx] : null;
      return c?.blade
        ? { blade: c.blade, ratchet: c.ratchet, bit: c.bit }
        : null;
    };
    // extraState can supply p1ComboIdx / p2ComboIdx to override stale r1/r2
    // (React setState is async so r1/r2 may not reflect the tap that just happened)
    const r1eff =
      "p1ComboIdx" in extraState
        ? (extraState.p1ComboIdx as number | null)
        : r1;
    const r2eff =
      "p2ComboIdx" in extraState
        ? (extraState.p2ComboIdx as number | null)
        : r2;
    const { p1ComboIdx: _pi, p2ComboIdx: _pj, ...rest } = extraState;
    void _pi;
    void _pj;
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
      p1ActiveCombo: activeComboOf(d1, r1eff),
      p2ActiveCombo: activeComboOf(d2, r2eff),
      ...rest,
    };
    fetch(`${OVERLAY_WORKER}/overlay/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: overlaySlot, state }),
      signal: AbortSignal.timeout(5000),
    })
      .then(() => setOverlayStatus("ok"))
      .catch(() => setOverlayStatus("error"));
  };

  const saveCombosToStorage = (): void => {
    const saved = sGet(KEYS.combos, {} as Record<string, Combo[]>);
    (
      [
        [p1, d1],
        [p2, d2],
      ] as Array<[string | null, Combo[]]>
    ).forEach(([name, deck]) => {
      if (!name) return;
      const prev = saved[name] || [];
      // Add new complete combos, refresh updatedAt for ones already seen
      deck.forEach((combo) => {
        if (!comboReady(combo)) return;
        const str = comboStr(combo);
        const existing = prev.findIndex((c) => comboStr(c) === str);
        if (existing >= 0) {
          prev[existing] = { ...combo, updatedAt: Date.now() };
        } else {
          prev.push({ ...combo, updatedAt: Date.now() });
        }
      });
      // Expire combos older than 1hr
      const fresh = prev.filter(
        (c) => !c.updatedAt || Date.now() - c.updatedAt < COMBO_CACHE_TTL,
      );
      saved[name] = fresh;
      // Push fresh list to Worker KV for cross-device access
      pushComboCacheToWorker(name, fresh);
    });
    sSave(KEYS.combos, saved);
  };

  const doScore = (pi: 0 | 1, fin: Finish): void => {
    // penalty: listed under loser pi, points go to opponent
    const scoringPi: 0 | 1 = fin.penalty ? ((1 - pi) as 0 | 1) : pi;

    // Clear any pending finish selection
    setPendingFinish(null);

    // ── Normal scoring ───────────────────────────────────────────────────────
    const raw: [number, number] = [pts[0], pts[1]];
    raw[scoringPi] += fin.p;
    const cap = config.pts > 0 ? config.pts : Infinity;
    const np: [number, number] = [Math.min(raw[0], cap), Math.min(raw[1], cap)];

    const entry: LogEntry = {
      set: curSet,
      shuffle: shuf,
      round: log.slice(matchStartIdx).length + 1,
      scorer: scoringPi === 0 ? p1 || "" : p2 || "",
      scorerIdx: scoringPi,
      judge: judge,
      penalty: fin.penalty || false,
      type: fin.id,
      typeName: fin.name,
      points: fin.p,
      p1Score: np[0],
      p2Score: np[1],
      p1Name: p1 || "",
      p2Name: p2 || "",
      p1Combo: { ...(r1 !== null ? d1[r1] : emptyCombo()) },
      p2Combo: { ...(r2 !== null ? d2[r2] : emptyCombo()) },
      p1ComboIdx: r1,
      p2ComboIdx: r2,
      p1Side: currentSides.p1Side || "",
      p2Side: currentSides.p2Side || "",
      winnerCombo: comboStr(
        scoringPi === 0
          ? r1 !== null
            ? d1[r1]
            : null
          : r2 !== null
            ? d2[r2]
            : null,
      ),
      time: new Date().toISOString(),
      _pp: [...pts],
      _ps: [...sets],
      _cs: curSet,
      _u1: [...used1],
      _u2: [...used2],
      _sh: shuf,
      _ls: [...lerStrikes],
    };
    const newLog = [...log, entry];
    setLog(newLog);
    sSave(KEYS.matchLog, newLog);
    setFuture([]);
    setPts(np);
    // Push to stream overlay (fire and forget)
    pushOverlay({
      lastFinish: { type: fin.id, scorerIdx: scoringPi },
      pts: np,
    });

    const setWon = config.pts > 0 && np[scoringPi] >= config.pts;

    // LER — 1-strike system: first LER adds a strike, second converts to a point
    if (fin.id === "LER") {
      if (setWon) {
        const ns: [number, number] = [sets[0], sets[1]];
        ns[scoringPi] += 1;
        setSets(ns);
        setSetScores((ss) => [...ss, { [p1 || ""]: np[0], [p2 || ""]: np[1] }]);
        if (ns[scoringPi] >= need) {
          saveCombosToStorage();
          setPhase("over");
        } else {
          if (config.tm) {
            const loserPi: 0 | 1 = (1 - scoringPi) as 0 | 1;
            setSideAssign({ pickPriority: loserPi });
            setSidePicker({ priority: loserPi });
          }
          setCurSet((c) => c + 1);
          setPts([0, 0]);
          setUsed1([]);
          setUsed2([]);
          setShuf((s) => s + 1);
          setLerStrikes([0, 0]);
        }
      }
      // stay on battle screen — combos do not advance
      return;
    }

    // Any score change clears all LER strikes
    setLerStrikes([0, 0]);
    const nu1 = [...used1, r1].filter((x): x is number => x !== null);
    const nu2 = [...used2, r2].filter((x): x is number => x !== null);
    setUsed1(nu1);
    setUsed2(nu2);
    setR1(null);
    setR2(null);
    if (setWon) {
      const ns: [number, number] = [sets[0], sets[1]];
      ns[scoringPi] += 1;
      setSets(ns);
      setSetScores((ss) => [...ss, { [p1 || ""]: np[0], [p2 || ""]: np[1] }]);
      if (ns[scoringPi] >= need) {
        saveCombosToStorage();
        setPhase("over");
      } else {
        if (config.tm) {
          const loserPi: 0 | 1 = (1 - scoringPi) as 0 | 1;
          setSideAssign({ pickPriority: loserPi });
          setSidePicker({ priority: loserPi });
        }
        setCurSet((c) => c + 1);
        setPts([0, 0]);
        setUsed1([]);
        setUsed2([]);
        setShuf((s) => s + 1);
      }
    } else {
      if (nu1.length >= 3 && nu2.length >= 3) {
        setUsed1([]);
        setUsed2([]);
        setShuf((s) => s + 1);
      }
      // stay on battle screen — combos reset via setR1/setR2 null above
    }
  };

  const undo = (): void => {
    // Allow undoing a pending LER-STRIKE (in-memory only, not in log)
    const lastIsStrike = lerStrikes[0] === 1 || lerStrikes[1] === 1;
    if (log.length <= matchStartIdx && !lastIsStrike) return;
    // If a strike is pending, just clear it — no log entry to remove
    if (lastIsStrike && log.length <= matchStartIdx) {
      setLerStrikes([0, 0]);
      return;
    }
    if (lastIsStrike && log[log.length - 1]?.type !== "LER-STRIKE") {
      setLerStrikes([0, 0]);
      return;
    }
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
    setPendingFinish(null);
    // preserve r1/r2 — do not reset combo selection on undo
    setPhase("battle");
  };

  const redo = (): void => {
    if (!future.length) return;
    const n = future[0];
    setFuture(future.slice(1));
    const redoLog = [...log, n];
    setLog(redoLog);
    sSave(KEYS.matchLog, redoLog);
    setPts([n.p1Score, n.p2Score]);
    const nu1 = [...n._u1, n.p1ComboIdx].filter((x): x is number => x !== null);
    const nu2 = [...n._u2, n.p2ComboIdx].filter((x): x is number => x !== null);
    if (nu1.length >= 3 && nu2.length >= 3) {
      setUsed1([]);
      setUsed2([]);
      setShuf(n._sh + 1);
    } else {
      setUsed1(nu1);
      setUsed2(nu2);
      setShuf(n._sh);
    }
    if (
      config.pts > 0 &&
      (n.p1Score >= config.pts || n.p2Score >= config.pts)
    ) {
      const ns: [number, number] = [sets[0], sets[1]];
      ns[n.scorerIdx] += 1;
      setSets(ns);
      if (ns[n.scorerIdx] >= need) setPhase("over");
      else {
        setCurSet((c) => c + 1);
        setPts([0, 0]);
        setUsed1([]);
        setUsed2([]);
        setShuf((s) => s + 1);
      }
    }
  };

  const submitChallongeScore = async (
    matchId: number,
    p1Score: number,
    p2Score: number,
    winnerChallongeId: number | null,
  ): Promise<void> => {
    if (!challongeSlug || !matchId) return;
    setChallongeSubmitStatus("loading");
    const scoresCsv =
      setScores.length > 0
        ? setScores
            .map((s) => `${s[p1 || ""] ?? 0}-${s[p2 || ""] ?? 0}`)
            .join(",")
        : `${p1Score}-${p2Score}`;
    const payload = {
      slug: challongeSlug,
      matchId,
      scores_csv: scoresCsv,
      winner_id: winnerChallongeId,
    };
    // Write-ahead: persist to outbox FIRST, then try to submit.
    const queueId = enqueue({ kind: "challonge", type: "challonge", payload });
    try {
      const res = await fetch(`${WORKER_BASE_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const data: unknown = await res.json();
      const errMsg =
        hasKey(data, "errors") &&
        Array.isArray(data.errors) &&
        data.errors.length
          ? String(data.errors[0])
          : "";
      if (!res.ok || errMsg) throw new Error(errMsg || `HTTP ${res.status}`);
      removeFromQueue(queueId);
      setChallongeSubmitStatus("ok");
      fetchActiveMatches();
    } catch (err) {
      // Leave queued — retry loop will pick it up.
      setChallongeSubmitStatus(
        `Saved — will retry when back online (${(err as Error).message || "error"})`,
      );
    }
  };

  const reset = (): void => {
    setP1(null);
    setP2(null);
    setD1([emptyCombo(), emptyCombo(), emptyCombo()]);
    setD2([emptyCombo(), emptyCombo(), emptyCombo()]);
    setPts([0, 0]);
    setSets([0, 0]);
    setCurSet(1);
    setShuf(0);
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
    setCurrentSides({ p1Side: "", p2Side: "" });
    setPickerSearch("");
    setDeckReview(false);
    setManualJudge(false);
    setLerStrikes([0, 0]);
    setChallongeMatchId(null);
    setChallongeP1ParticipantId(null);
    setChallongeP2ParticipantId(null);
    setChallongeSubmitStatus(null);
    setPendingFinish(null);
    setMatchStartIdx(sGet(KEYS.matchLog, [] as LogEntry[]).length);
    setOverlaySlot(0);
    try {
      localStorage.setItem(KEYS.overlaySlot, "0");
    } catch {
      /* ignore */
    }
    setP1Color("#2563EB");
    setP2Color("#DC2626");
  };

  // Navigation helpers — Unified back navigation — context-aware, no stale closure issues
  const goBack = (): void => {
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

  const abandonMatch = (): void => {
    // Void match: remove its battles from the log and return to pick
    const trimmed = log.slice(0, matchStartIdx);
    setLog(trimmed);
    sSave(KEYS.matchLog, trimmed);
    setAbandonConfirm(false);
    reset();
  };

  // ── Abandon confirm overlay — rendered first so it always shows instantly ──
  if (abandonConfirm) {
    return (
      <div
        style={{
          ...S.current.page,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          maxHeight: "100dvh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 18,
            padding: "24px 20px",
            maxWidth: 340,
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            border: "2px solid var(--border)",
          }}
        >
          <p
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Abandon Match?
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              textAlign: "center",
              marginBottom: 6,
              lineHeight: 1.5,
            }}
          >
            This match has{" "}
            <strong style={{ color: "#EF4444" }}>
              {log.slice(matchStartIdx).length} battle
              {log.slice(matchStartIdx).length !== 1 ? "s" : ""}
            </strong>{" "}
            in progress.
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-faint)",
              textAlign: "center",
              marginBottom: 20,
              lineHeight: 1.4,
            }}
          >
            Abandoning will void all battles from this match and return to
            player selection.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setAbandonConfirm(false)}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 10,
                border: "2px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
              }}
            >
              Keep Playing
            </button>
            <button
              onClick={abandonMatch}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 10,
                border: "none",
                background: "#EF4444",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
              }}
            >
              Void & Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CX Picker ──────────────────────────────────────────────────────────────
  if (cxPicker) {
    const { step, who, slot, chip, blade, returnToReview } = cxPicker;
    const deck = who === 1 ? d1 : d2;
    const setDeck = who === 1 ? setD1 : setD2;
    const pColor = who === 1 ? "#2563EB" : "#DC2626";
    const playerName = who === 1 ? p1 : p2;
    const comboLabel = ["First", "Second", "Third"][slot];

    // Parse all CX/CXE parts already used in OTHER slots for this player
    const otherBlades = deck
      .map((c, i) => (i !== slot ? c.blade : null))
      .filter((x): x is string => Boolean(x));
    const usedCxParts = {
      chips: [] as string[],
      blades: [] as string[],
      overBlades: [] as string[],
      assists: [] as string[],
    };
    otherBlades.forEach((name) => {
      const p = name.split(" ");
      // Determine if this is a CXE combo by checking if any word is a CXE blade
      const cxeIdx = p.findIndex((w) => CXE_BLADES.includes(w));
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
    const takenChips = usedCxParts.chips.filter(
      (ch) => ch !== "Standard" && CX_CHIPS.includes(ch),
    );

    const overBlade = cxPicker.overBlade;
    const isCXE = cxPicker.isCXE;
    const advance = (finalName: string): void => {
      const nd = [...deck];
      nd[slot] = { ...nd[slot], blade: finalName };
      setDeck(nd);
      setCxPicker(null);
      if (returnToReview) {
        setPicker(null);
        setDeckReview(true);
        return;
      }
      openPicker({ who, slot, cat: "ratchet" });
    };
    // Build final name helper for assist step
    const buildFinalName = (a: string): string => {
      if (isCXE) {
        return chip === "Standard"
          ? `${blade} ${overBlade} ${a}`
          : `${chip} ${blade} ${overBlade} ${a}`;
      }
      return chip === "Standard" ? `${blade} ${a}` : `${chip} ${blade} ${a}`;
    };

    const stepLabels: Record<string, string> = {
      chip: "Gear Chip",
      blade: "Blade",
      over_blade: "Over Blade",
      assist: "Assist",
    };
    const stepOrder = ["chip", "blade", "over_blade", "assist"];
    const progress = stepOrder.indexOf(step);
    const totalStepsInFlow = cxPicker.isCXE ? 4 : 3;

    return (
      <div style={S.current.page}>
        <button style={S.current.back} onClick={goBack}>
          {IC.back} Back to Blades
        </button>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            background: "#E2E8F0",
            borderRadius: 2,
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round((progress / totalStepsInFlow) * 100)}%`,
              background: "#0F766E",
              borderRadius: 2,
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: pColor,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {playerName} — {comboLabel} Combo · CX
          </p>
          <h1
            style={{
              ...S.current.title,
              color: "#0F766E",
              textAlign: "left",
              margin: 0,
            }}
          >
            Select {stepLabels[step]}
          </h1>
          {chip && (
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
              {chip === "Standard" ? "Standard chip" : chip + " chip"}
              {blade ? ` · ${blade}` : ""}
              {cxPicker.overBlade ? ` · ${cxPicker.overBlade}` : ""}
            </p>
          )}
        </div>

        {step === "chip" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CX_CHIPS.map((ch) => {
              const isTaken = takenChips.includes(ch); // Standard never taken
              return (
                <button
                  key={ch}
                  disabled={isTaken}
                  onClick={() =>
                    setCxPicker({ ...cxPicker, step: "blade", chip: ch })
                  }
                  style={{
                    padding: "18px 20px",
                    borderRadius: 12,
                    border: `2px solid ${isTaken ? "#E2E8F0" : "#0F766E40"}`,
                    background: isTaken ? "#F1F5F9" : "#F0FDF9",
                    color: isTaken
                      ? "var(--text-disabled)"
                      : "var(--text-primary)",
                    fontSize: 16,
                    fontWeight: 800,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: isTaken ? "not-allowed" : "pointer",
                    textAlign: "left",
                    opacity: isTaken ? 0.45 : 1,
                  }}
                >
                  {ch}
                  {ch === "Standard" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        display: "block",
                        marginTop: 2,
                      }}
                    >
                      Multiple allowed per deck
                    </span>
                  )}
                  {isTaken && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        display: "block",
                        marginTop: 2,
                      }}
                    >
                      Already used
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {step === "blade" && (
          <div>
            {/* Blast is priority */}
            <div
              style={{
                marginBottom: 10,
                background: "#0D948818",
                borderRadius: 10,
                padding: "8px 10px 6px",
                border: "1px solid #0D948830",
              }}
            >
              <p
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#0D9488",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                ★ Most Popular
              </p>
              {(() => {
                // Extract CX blade names already used in other slots for this player
                const blastTaken = usedCxParts.blades.includes("Blast");
                return (
                  <button
                    disabled={blastTaken}
                    onClick={() =>
                      !blastTaken &&
                      setCxPicker({
                        ...cxPicker,
                        step: "assist",
                        blade: "Blast",
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 9,
                      border: "2px solid #0D9488",
                      background: blastTaken ? "#F1F5F9" : "#0D948822",
                      color: blastTaken
                        ? "var(--text-disabled)"
                        : "var(--text-primary)",
                      fontSize: 14,
                      fontWeight: 800,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: blastTaken ? "not-allowed" : "pointer",
                      opacity: blastTaken ? 0.45 : 1,
                    }}
                  >
                    Blast{blastTaken ? " — IN USE" : ""}
                  </button>
                );
              })()}
              {/* Blast quick combos */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                {["Heavy", "Wheel"].map((assist) => {
                  const finalName =
                    chip === "Standard"
                      ? `Blast ${assist}`
                      : `${chip} Blast ${assist}`;
                  const blastTaken = usedCxParts.blades.includes("Blast");
                  const assistTaken = usedCxParts.assists.includes(assist);
                  const anyTaken = blastTaken || assistTaken;
                  return (
                    <button
                      key={assist}
                      disabled={anyTaken}
                      onClick={() => {
                        if (anyTaken) return;
                        const nd = [...deck];
                        nd[slot] = { ...nd[slot], blade: finalName };
                        setDeck(nd);
                        setCxPicker(null);
                        if (returnToReview) {
                          setPicker(null);
                          setDeckReview(true);
                          return;
                        }
                        openPicker({ who, slot, cat: "ratchet" });
                      }}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: `2px solid ${anyTaken ? "#E2E8F0" : "#0D948860"}`,
                        background: anyTaken ? "#F1F5F9" : "#0D948818",
                        color: anyTaken
                          ? "var(--text-disabled)"
                          : "var(--text-primary)",
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: "'Outfit',sans-serif",
                        cursor: anyTaken ? "not-allowed" : "pointer",
                        opacity: anyTaken ? 0.45 : 1,
                      }}
                    >
                      Blast {assist}
                      {anyTaken && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 7,
                            color: "var(--text-faint)",
                          }}
                        >
                          IN USE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 6,
              }}
            >
              {CX_BLADES.filter((b) => b !== "Blast").map((b) => {
                // Grey out if this CX blade name appears in any other combo slot
                const bladeTaken = usedCxParts.blades.includes(b);
                return (
                  <button
                    key={b}
                    disabled={bladeTaken}
                    onClick={() =>
                      !bladeTaken &&
                      setCxPicker({ ...cxPicker, step: "assist", blade: b })
                    }
                    style={{
                      padding: "10px 4px",
                      borderRadius: 9,
                      border: `2px solid ${bladeTaken ? "#E2E8F0" : "#CBD5E1"}`,
                      background: bladeTaken ? "#F1F5F9" : "#F8FAFC",
                      color: bladeTaken
                        ? "var(--text-disabled)"
                        : "var(--text-primary)",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: bladeTaken ? "not-allowed" : "pointer",
                      minHeight: 40,
                      textAlign: "center",
                      opacity: bladeTaken ? 0.45 : 1,
                    }}
                  >
                    {b}
                    {bladeTaken && (
                      <span
                        style={{
                          display: "block",
                          fontSize: 7,
                          fontWeight: 700,
                          color: "var(--text-faint)",
                          marginTop: 2,
                        }}
                      >
                        IN USE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* CXE Blades section */}
            <div
              style={{
                marginTop: 12,
                borderTop: "2px dashed #E2E8F0",
                paddingTop: 12,
              }}
            >
              <p
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#7C3AED",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                CXE Blades
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 8,
                }}
              >
                {CXE_BLADES.map((b) => {
                  const bladeTaken = usedCxParts.blades.includes(b);
                  return (
                    <button
                      key={b}
                      disabled={bladeTaken}
                      onClick={() =>
                        !bladeTaken &&
                        setCxPicker({
                          ...cxPicker,
                          step: "over_blade",
                          blade: b,
                          isCXE: true,
                        })
                      }
                      style={{
                        padding: "12px 4px",
                        borderRadius: 9,
                        border: `2px solid ${bladeTaken ? "#E2E8F0" : "#7C3AED60"}`,
                        background: bladeTaken ? "#F1F5F9" : "#F5F3FF",
                        color: bladeTaken
                          ? "var(--text-disabled)"
                          : "var(--text-primary)",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "'Outfit',sans-serif",
                        cursor: bladeTaken ? "not-allowed" : "pointer",
                        minHeight: 44,
                        textAlign: "center",
                        opacity: bladeTaken ? 0.45 : 1,
                      }}
                    >
                      {b}
                      {bladeTaken && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 7,
                            fontWeight: 700,
                            color: "var(--text-faint)",
                            marginTop: 2,
                          }}
                        >
                          IN USE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === "over_blade" && (
          <div>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 12 }}>
              Selected CXE Blade:{" "}
              <strong style={{ color: "#7C3AED" }}>{blade}</strong>
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
              }}
            >
              {CXE_OVER_BLADES.map((ob) => {
                const taken = usedCxParts.overBlades.includes(ob);
                return (
                  <button
                    key={ob}
                    disabled={taken}
                    onClick={() =>
                      !taken &&
                      setCxPicker({
                        ...cxPicker,
                        step: "assist",
                        overBlade: ob,
                      })
                    }
                    style={{
                      padding: "16px 4px",
                      borderRadius: 12,
                      border: `2px solid ${taken ? "#E2E8F0" : "#7C3AED60"}`,
                      background: taken ? "#F1F5F9" : "#F5F3FF",
                      color: taken
                        ? "var(--text-disabled)"
                        : "var(--text-primary)",
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: taken ? "not-allowed" : "pointer",
                      minHeight: 56,
                      textAlign: "center",
                      opacity: taken ? 0.45 : 1,
                    }}
                  >
                    {ob}
                    {taken && (
                      <span
                        style={{
                          display: "block",
                          fontSize: 7,
                          fontWeight: 700,
                          color: "var(--text-faint)",
                          marginTop: 2,
                        }}
                      >
                        IN USE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "assist" && (
          <div>
            {/* Top 5 assists */}
            <div
              style={{
                marginBottom: 10,
                background: "#0F766E0D",
                borderRadius: 10,
                padding: "8px 10px 6px",
                border: "1px solid #0F766E30",
              }}
            >
              <p
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#0F766E",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                ★ Top 5
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5,1fr)",
                  gap: 6,
                }}
              >
                {CX_ASSIST_TOP5.map((a) => {
                  const finalName = buildFinalName(a);
                  const taken = usedCxParts.assists.includes(a);
                  return (
                    <button
                      key={a}
                      disabled={taken}
                      onClick={() => !taken && advance(finalName)}
                      style={{
                        padding: "10px 4px",
                        borderRadius: 9,
                        border: `2px solid ${taken ? "#E2E8F0" : "#0F766E"}`,
                        background: taken ? "#F1F5F9" : "#0F766E18",
                        color: taken
                          ? "var(--text-disabled)"
                          : "var(--text-primary)",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "'Outfit',sans-serif",
                        cursor: taken ? "not-allowed" : "pointer",
                        minHeight: 40,
                        textAlign: "center",
                        position: "relative",
                        opacity: taken ? 0.45 : 1,
                      }}
                    >
                      {a}
                      {taken && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 2,
                            fontSize: 7,
                            fontWeight: 700,
                            color: "var(--text-faint)",
                            letterSpacing: 0.3,
                          }}
                        >
                          IN USE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Rest of assists */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 6,
              }}
            >
              {CX_ASSISTS.filter((a) => !CX_ASSIST_TOP5.includes(a)).map(
                (a) => {
                  const finalName = buildFinalName(a);
                  const taken = usedCxParts.assists.includes(a);
                  return (
                    <button
                      key={a}
                      disabled={taken}
                      onClick={() => !taken && advance(finalName)}
                      style={{
                        padding: "10px 4px",
                        borderRadius: 9,
                        border: `2px solid ${taken ? "#E2E8F0" : "#CBD5E1"}`,
                        background: taken ? "#F1F5F9" : "#F8FAFC",
                        color: taken
                          ? "var(--text-disabled)"
                          : "var(--text-primary)",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "'Outfit',sans-serif",
                        cursor: taken ? "not-allowed" : "pointer",
                        minHeight: 40,
                        textAlign: "center",
                        position: "relative",
                        opacity: taken ? 0.45 : 1,
                      }}
                    >
                      {a}
                      {taken && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 2,
                            fontSize: 7,
                            fontWeight: 700,
                            color: "var(--text-faint)",
                            letterSpacing: 0.3,
                          }}
                        >
                          IN USE
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (picker) {
    const { who, slot, cat } = picker;
    const listKey: "blades" | "ratchets" | "bits" = (cat + "s") as
      | "blades"
      | "ratchets"
      | "bits";
    const list = parts[listKey];
    const cc: string =
      (
        { blade: "#EA580C", ratchet: "#1D4ED8", bit: "#15803D" } as Record<
          string,
          string
        >
      )[cat] || "#EA580C";
    const deck = who === 1 ? d1 : d2;
    const setDeck = who === 1 ? setD1 : setD2;
    const current: string | null = deck[slot][cat];
    const takenByOtherSlots = deck
      .map((c, i) => (i !== slot ? c[cat] : null))
      .filter((x): x is string => Boolean(x));
    const top10: string[] = TOP10[listKey] || [];
    const allCxNames: string[] = [
      ...CX_BLADES,
      ...CXE_BLADES,
      ...CX_ASSISTS,
      ...CXE_OVER_BLADES,
    ];
    // Only filter CX names for blades; bits/ratchets with matching names should still show
    const rest = list.filter(
      (n) =>
        !top10.includes(n) &&
        !CROSSOVER_BLADES.includes(n) &&
        (cat !== "blade" || !allCxNames.includes(n)),
    );

    const searchLower = pickerSearch.toLowerCase();
    const filteredRest = pickerSearch
      ? rest.filter((n) => n.toLowerCase().includes(searchLower))
      : rest;

    interface PartBtnProps {
      name: string;
      isTop?: boolean;
    }
    const PartBtn = ({ name, isTop }: PartBtnProps) => {
      const sel = current === name;
      const taken = takenByOtherSlots.includes(name) && !sel;
      // Determine button accent color
      const bladeColor = cat === "blade" && isTop ? BLADE_COLORS[name] : null;
      const accent = bladeColor || (isTop ? cc : null);
      // Non-top, non-selected: black text/border. Top 10: individual accent color.
      const idleColor = "var(--text-primary)";
      const idleBorder: string = accent
        ? `2px solid ${accent}`
        : "2px solid #CBD5E1";
      const idleBg: string = accent ? accent + "18" : "var(--surface2)";
      return (
        <button
          disabled={taken}
          onClick={() => {
            if (taken) return;
            const nd = [...deck];
            nd[slot] = { ...nd[slot], [cat]: name };
            setDeck(nd);
            // If editing a single part from review screen, return to review
            if (picker.returnToReview) {
              setPicker(null);
              setDeckReview(true);
              return;
            }
            // Auto-advance to next step in linear flow
            const cats: Array<"blade" | "ratchet" | "bit"> = [
              "blade",
              "ratchet",
              "bit",
            ];
            const catIdx = cats.indexOf(cat);
            if (catIdx < 2) {
              openPicker({ who, slot, cat: cats[catIdx + 1] });
            } else if (slot < 2) {
              openPicker({ who, slot: slot + 1, cat: "blade" });
            } else if (who === 1) {
              openPicker({ who: 2, slot: 0, cat: "blade" });
            } else {
              setPicker(null);
              setDeckReview(true);
            }
          }}
          style={{
            padding: "8px 4px",
            borderRadius: 9,
            border: sel
              ? `2px solid ${accent || cc}`
              : taken
                ? "2px solid #E2E8F0"
                : idleBorder,
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
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          {sel && (
            <span style={{ fontSize: 9, marginBottom: 1 }}>{IC.check}</span>
          )}
          <PartLabel
            name={name}
            size={splitPartName(name, cat !== "bit").length > 1 ? 12 : 13}
            keepDash={cat !== "bit"}
          />
          {taken && (
            <span
              style={{
                position: "absolute",
                bottom: 2,
                fontSize: 7,
                fontWeight: 700,
                color: "var(--text-faint)",
                letterSpacing: 0.3,
              }}
            >
              IN USE
            </span>
          )}
        </button>
      );
    };

    const comboLabel = ["First", "Second", "Third"][slot];
    const playerName = who === 1 ? p1 : p2;
    const pColor = who === 1 ? "#2563EB" : "#DC2626";
    const catLabels: Record<string, string> = {
      blade: "Blade",
      ratchet: "Ratchet",
      bit: "Bit",
    };
    // Progress: 0-5 for P1 combos, 6-11 for P2
    const stepNum =
      (who === 1 ? 0 : 9) + slot * 3 + ["blade", "ratchet", "bit"].indexOf(cat);
    const totalSteps = 18;
    const pct = Math.round((stepNum / totalSteps) * 100);

    // Ratchet and bit pickers use a viewport-filling fixed layout
    if (cat === "ratchet" || cat === "bit") {
      const COLS = 5;
      const restItems = list.filter((n) => !top10.includes(n));
      // When searching, show all matching items in one flat grid
      const searchItems = pickerSearch
        ? list.filter((n) =>
            n.toLowerCase().includes(pickerSearch.toLowerCase()),
          )
        : null;
      // Rows helper
      const toRows = (items: string[]): string[][] => {
        const r: string[][] = [];
        for (let i = 0; i < items.length; i += COLS)
          r.push(items.slice(i, i + COLS));
        return r;
      };
      const top10Rows = toRows(top10);
      const restRows = toRows(restItems);
      const searchRows = searchItems ? toRows(searchItems) : null;

      // Single stable layout: header fixed, search bar always visible,
      // grid below always scrollable. No branch switch on search so the
      // input never remounts and the keyboard never dismisses.
      const displayRows = searchItems ? searchRows : null;
      const ROW_H = 52; // fixed px height per button row — never changes

      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-solid)",
            boxSizing: "border-box",
          }}
        >
          {/* ── Header strip — always fixed height, never reflowed ── */}
          <div
            style={{
              flexShrink: 0,
              padding: "6px 14px 4px",
              background: "var(--bg-solid)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <button
                style={{ ...S.current.back, marginBottom: 0 }}
                onClick={goBack}
              >
                {IC.back} Back
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: cc }}>
                  {catLabels[cat]}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {playerName} · {comboLabel}
                </span>
                {!picker.returnToReview && pickerHistory.length > 0 && (
                  <button
                    onClick={undoPicker}
                    style={{
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
                      gap: 4,
                    }}
                  >
                    {IC.undo}
                  </button>
                )}
              </div>
            </div>
            <div
              style={{
                height: 3,
                background: "var(--border)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: pColor,
                  borderRadius: 2,
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>

          {/* ── Top 10 block — always rendered, always fixed height ── */}
          {!pickerSearch && (
            <div
              style={{
                flexShrink: 0,
                background: cc + "0D",
                borderRadius: 10,
                border: `1px solid ${cc}30`,
                padding: "4px 6px",
                margin: "4px 10px 0",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <p
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: cc,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  flexShrink: 0,
                  margin: "0 0 2px 2px",
                }}
              >
                ★ Top 10
              </p>
              {top10Rows.map((row, ri) => (
                <div
                  key={ri}
                  style={{ height: ROW_H, display: "flex", gap: 4 }}
                >
                  {row.map((name) => {
                    const sel = current === name;
                    const taken = takenByOtherSlots.includes(name) && !sel;
                    return (
                      <button
                        key={name}
                        disabled={taken}
                        onClick={() => {
                          if (taken) return;
                          const nd = [...deck];
                          nd[slot] = { ...nd[slot], [cat]: name };
                          setDeck(nd);
                          if (picker.returnToReview) {
                            setPicker(null);
                            setDeckReview(true);
                            return;
                          }
                          const cats: Array<"blade" | "ratchet" | "bit"> = [
                            "blade",
                            "ratchet",
                            "bit",
                          ];
                          const catIdx = cats.indexOf(cat);
                          if (catIdx < 2) {
                            openPicker({ who, slot, cat: cats[catIdx + 1] });
                          } else if (slot < 2) {
                            openPicker({ who, slot: slot + 1, cat: "blade" });
                          } else if (who === 1) {
                            openPicker({ who: 2, slot: 0, cat: "blade" });
                          } else {
                            setPicker(null);
                            setDeckReview(true);
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: "100%",
                          borderRadius: 9,
                          border: sel
                            ? `2px solid ${cc}`
                            : taken
                              ? "2px solid var(--border)"
                              : `2px solid ${cc}50`,
                          background: sel
                            ? cc
                            : taken
                              ? "var(--surface2)"
                              : cc + "14",
                          color: sel
                            ? "#fff"
                            : taken
                              ? "var(--text-disabled)"
                              : "var(--text-primary)",
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
                          fontWeight: 800,
                        }}
                      >
                        {sel && (
                          <span style={{ fontSize: 9, marginBottom: 1 }}>
                            {IC.check}
                          </span>
                        )}
                        <PartLabel
                          name={name}
                          size={null}
                          keepDash={cat !== "bit"}
                        />
                        {taken && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 2,
                              fontSize: 8,
                              fontWeight: 700,
                              color: "var(--text-faint)",
                              letterSpacing: 0.3,
                            }}
                          >
                            IN USE
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {row.length < COLS &&
                    Array.from({ length: COLS - row.length }).map((_, ei) => (
                      <div key={ei} style={{ flex: 1 }} />
                    ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Search bar — always present, always same position ── */}
          <div
            style={{
              flexShrink: 0,
              padding: "6px 10px 4px",
              position: "relative",
            }}
          >
            <input
              style={{
                ...S.current.inp,
                width: "100%",
                paddingLeft: 28,
                fontSize: 12,
                borderColor: cc + "40",
              }}
              placeholder={`Search ${catLabels[cat].toLowerCase()}s…`}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoComplete="off"
            />
            <svg
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.35,
              }}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={cc}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {pickerSearch && (
              <button
                onClick={() => setPickerSearch("")}
                style={{
                  position: "absolute",
                  right: 18,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* ── Scrollable rest grid — always overflowY:auto, fixed-height rows ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 8px" }}>
            {pickerSearch && searchItems && searchItems.length === 0 && (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  padding: "20px 0",
                }}
              >
                No matches for "{pickerSearch}"
              </p>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                paddingTop: 4,
              }}
            >
              {(displayRows || restRows).map((row, ri) => (
                <div
                  key={ri}
                  style={{ height: ROW_H, display: "flex", gap: 4 }}
                >
                  {row.map((name) => {
                    const sel = current === name;
                    const taken = takenByOtherSlots.includes(name) && !sel;
                    return (
                      <button
                        key={name}
                        disabled={taken}
                        onClick={() => {
                          if (taken) return;
                          const nd = [...deck];
                          nd[slot] = { ...nd[slot], [cat]: name };
                          setDeck(nd);
                          if (picker.returnToReview) {
                            setPicker(null);
                            setDeckReview(true);
                            return;
                          }
                          const cats: Array<"blade" | "ratchet" | "bit"> = [
                            "blade",
                            "ratchet",
                            "bit",
                          ];
                          const catIdx = cats.indexOf(cat);
                          if (catIdx < 2) {
                            openPicker({ who, slot, cat: cats[catIdx + 1] });
                          } else if (slot < 2) {
                            openPicker({ who, slot: slot + 1, cat: "blade" });
                          } else if (who === 1) {
                            openPicker({ who: 2, slot: 0, cat: "blade" });
                          } else {
                            setPicker(null);
                            setDeckReview(true);
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: "100%",
                          borderRadius: 9,
                          border: sel
                            ? `2px solid ${cc}`
                            : taken
                              ? "2px solid var(--border)"
                              : "2px solid var(--border2)",
                          background: sel
                            ? cc
                            : taken
                              ? "var(--surface2)"
                              : "var(--surface2)",
                          color: sel
                            ? "#fff"
                            : taken
                              ? "var(--text-disabled)"
                              : "var(--text-primary)",
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
                          fontWeight: 800,
                        }}
                      >
                        {sel && (
                          <span style={{ fontSize: 9, marginBottom: 1 }}>
                            {IC.check}
                          </span>
                        )}
                        <PartLabel
                          name={name}
                          size={null}
                          keepDash={cat !== "bit"}
                        />
                        {taken && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 2,
                              fontSize: 8,
                              fontWeight: 700,
                              color: "var(--text-faint)",
                              letterSpacing: 0.3,
                            }}
                          >
                            IN USE
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {row.length < COLS &&
                    Array.from({ length: COLS - row.length }).map((_, ei) => (
                      <div key={ei} style={{ flex: 1 }} />
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={S.current.page}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 0,
          }}
        >
          <button style={S.current.back} onClick={goBack}>
            {IC.back} Back
          </button>
          {!picker.returnToReview && pickerHistory.length > 0 && (
            <button
              onClick={undoPicker}
              style={{
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
                gap: 5,
              }}
            >
              {IC.undo} Undo
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            background: "#E2E8F0",
            borderRadius: 2,
            marginBottom: 14,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pColor,
              borderRadius: 2,
              transition: "width 0.2s",
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: pColor,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {playerName} — {comboLabel} Combo
          </p>
          <h1
            style={{
              ...S.current.title,
              color: cc,
              textAlign: "left",
              margin: 0,
            }}
          >
            Select {catLabels[cat]}
          </h1>
        </div>

        {/* Previous Combos — blade screen only, merged from localStorage + Worker KV */}
        {cat === "blade" &&
          (() => {
            const playerName2 = who === 1 ? p1 : p2;
            if (!playerName2) return null;
            const savedAll = sGet(KEYS.combos, {} as Record<string, Combo[]>);
            const localCombos: Combo[] = (savedAll[playerName2] || []).filter(
              (c) => comboReady(c),
            );
            const remoteCombos: Combo[] = (
              workerCombos[playerName2] || []
            ).filter((c) => comboReady(c));
            // Merge: prefer local, add any remote ones not already in local
            const seen = new Set(localCombos.map((c) => comboStr(c)));
            const merged = [
              ...localCombos,
              ...remoteCombos.filter((c) => !seen.has(comboStr(c))),
            ];
            // Sort newest first by updatedAt
            merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            const prevCombos = merged.filter((c) => comboReady(c));
            if (!prevCombos.length) return null;
            return (
              <div style={{ marginBottom: 12 }}>
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#7C3AED",
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  🕐 Previous Combos
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 6,
                  }}
                >
                  {prevCombos.map((c, ci) => {
                    const bTaken = takenByOtherSlots.includes(c.blade || "");
                    const rTaken = (who === 1 ? d1 : d2)
                      .map((dc, i) => (i !== slot ? dc.ratchet : null))
                      .filter((x): x is string => Boolean(x))
                      .includes(c.ratchet || "");
                    const bitTaken = (who === 1 ? d1 : d2)
                      .map((dc, i) => (i !== slot ? dc.bit : null))
                      .filter((x): x is string => Boolean(x))
                      .includes(c.bit || "");
                    const anyTaken = bTaken || rTaken || bitTaken;
                    const bladeColor =
                      (c.blade && BLADE_COLORS[c.blade]) || "#64748B";
                    return (
                      <button
                        key={ci}
                        disabled={anyTaken}
                        onClick={() => {
                          if (anyTaken) return;
                          const nd = who === 1 ? [...d1] : [...d2];
                          nd[slot] = {
                            blade: c.blade,
                            ratchet: c.ratchet,
                            bit: c.bit,
                          };
                          if (who === 1) setD1(nd);
                          else setD2(nd);
                          if (picker.returnToReview) {
                            setPicker(null);
                            setDeckReview(true);
                            return;
                          }
                          if (slot < 2) {
                            openPicker({ who, slot: slot + 1, cat: "blade" });
                          } else if (who === 1) {
                            openPicker({ who: 2, slot: 0, cat: "blade" });
                          } else {
                            setPicker(null);
                            setDeckReview(true);
                          }
                        }}
                        style={{
                          padding: "8px 4px",
                          borderRadius: 9,
                          border: `2px solid ${anyTaken ? "#E2E8F0" : bladeColor + "50"}`,
                          background: anyTaken ? "#F1F5F9" : bladeColor + "10",
                          color: anyTaken
                            ? "var(--text-disabled)"
                            : "var(--text-primary)",
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
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800 }}>
                          {c.blade}
                        </span>
                        <span style={{ fontSize: 11, opacity: 0.65 }}>
                          {c.ratchet} · {c.bit}
                        </span>
                        {anyTaken && (
                          <span
                            style={{ fontSize: 9, color: "var(--text-faint)" }}
                          >
                            IN USE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* Quick Combos — blade screen only */}
        {cat === "blade" && !pickerSearch && (
          <div style={{ marginBottom: 12 }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: cc,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              ⚡ Quick Combos
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 6,
              }}
            >
              {QUICK_COMBOS.map((qc, qi) => {
                const bTaken = takenByOtherSlots.includes(qc.blade || "");
                const rTaken = (who === 1 ? d1 : d2)
                  .map((c, i) => (i !== slot ? c.ratchet : null))
                  .filter((x): x is string => Boolean(x))
                  .includes(qc.ratchet || "");
                const bitTaken = (who === 1 ? d1 : d2)
                  .map((c, i) => (i !== slot ? c.bit : null))
                  .filter((x): x is string => Boolean(x))
                  .includes(qc.bit || "");
                const anyTaken = bTaken || rTaken || bitTaken;
                const bladeColor = (qc.blade && BLADE_COLORS[qc.blade]) || cc;
                return (
                  <button
                    key={qi}
                    disabled={anyTaken}
                    onClick={() => {
                      if (anyTaken) return;
                      const nd = who === 1 ? [...d1] : [...d2];
                      nd[slot] = {
                        blade: qc.blade,
                        ratchet: qc.ratchet,
                        bit: qc.bit,
                      };
                      if (who === 1) setD1(nd);
                      else setD2(nd);
                      // advance past this combo entirely
                      if (picker.returnToReview) {
                        setPicker(null);
                        setDeckReview(true);
                        return;
                      }
                      if (slot < 2) {
                        openPicker({ who, slot: slot + 1, cat: "blade" });
                      } else if (who === 1) {
                        openPicker({ who: 2, slot: 0, cat: "blade" });
                      } else {
                        setPicker(null);
                        setDeckReview(true);
                      }
                    }}
                    style={{
                      padding: "8px 4px",
                      borderRadius: 9,
                      border: `2px solid ${anyTaken ? "#E2E8F0" : bladeColor + "60"}`,
                      background: anyTaken ? "#F1F5F9" : bladeColor + "12",
                      color: anyTaken
                        ? "var(--text-disabled)"
                        : "var(--text-primary)",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: anyTaken ? "not-allowed" : "pointer",
                      textAlign: "center",
                      lineHeight: 1.3,
                      opacity: anyTaken ? 0.4 : 1,
                      minHeight: 52,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      {qc.blade}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      {qc.ratchet} · {qc.bit}
                    </span>
                    {anyTaken && (
                      <span style={{ fontSize: 9, color: "var(--text-faint)" }}>
                        IN USE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Top 10 group */}
        <div
          style={{
            marginBottom: 8,
            background: cc + "0D",
            borderRadius: 12,
            padding: "10px 10px 8px",
            border: `1px solid ${cc}30`,
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: cc,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            ★ Top 10
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 6,
            }}
          >
            {top10.map((name) => (
              <PartBtn key={name} name={name} isTop={true} />
            ))}
          </div>
        </div>

        {/* Search bar + CX button (blades only) */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <input
              style={{
                ...S.current.inp,
                width: "100%",
                paddingLeft: 32,
                borderColor: cc + "40",
              }}
              placeholder={`Search ${cat}s...`}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoComplete="off"
            />
            <svg
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.35,
              }}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={cc}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {pickerSearch && (
              <button
                onClick={() => setPickerSearch("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
          {cat === "blade" && (
            <button
              onClick={() =>
                setCxPicker({
                  step: "chip",
                  who,
                  slot,
                  returnToReview: picker.returnToReview || false,
                })
              }
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: "2px solid #0F766E",
                background: "#F0FDF9",
                color: "#0F766E",
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              CX
            </button>
          )}
        </div>

        {/* Rest of parts */}
        {filteredRest.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 6,
            }}
          >
            {filteredRest.map((name) => (
              <PartBtn key={name} name={name} />
            ))}
          </div>
        ) : pickerSearch ? (
          <p style={{ ...S.current.empty, marginTop: 8 }}>
            No matches for "{pickerSearch}"
          </p>
        ) : null}

        {/* Crossover Blades dropdown — blades only */}
        {cat === "blade" && (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => setCrossoverOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "2px solid #7C3AED40",
                background: crossoverOpen ? "#7C3AED" : "#F5F3FF",
                color: crossoverOpen ? "#fff" : "#7C3AED",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
              }}
            >
              <span>🌐 Crossover Blades ({CROSSOVER_BLADES.length})</span>
              <span style={{ fontSize: 16, lineHeight: 1 }}>
                {crossoverOpen ? "▲" : "▼"}
              </span>
            </button>
            {crossoverOpen && (
              <div
                style={{
                  marginTop: 8,
                  padding: "10px",
                  background: "#F5F3FF",
                  borderRadius: 10,
                  border: "1px solid #7C3AED30",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5,1fr)",
                    gap: 6,
                  }}
                >
                  {CROSSOVER_BLADES.filter(
                    (n) =>
                      !pickerSearch ||
                      n.toLowerCase().includes(pickerSearch.toLowerCase()),
                  ).map((name) => (
                    <PartBtn key={name} name={name} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === "pick") {
    const playersSelected = p1 && p2;
    const step: 1 | 2 | 3 | "done" = !p1
      ? 1
      : !p2
        ? 2
        : config.tm && !judge.trim()
          ? 3
          : "done";
    const stepLabel =
      step === 1
        ? "Select P1"
        : step === 2
          ? "Select P2"
          : step === 3
            ? "Select Judge on Duty"
            : "Ready";
    const stepColor =
      step === 1
        ? "#2563EB"
        : step === 2
          ? "#DC2626"
          : step === 3
            ? "#B45309"
            : "#15803D";

    const handleNameClick = (name: string): void => {
      const tname = tn(name);
      const isP1 = tname === p1 || name === p1;
      const isP2 = tname === p2 || name === p2;
      const isJudge = config.tm && (name === judge || tname === judge);

      // Always deselect if already assigned — never affects other roles
      if (isP1) {
        setP1(null);
        return;
      }
      if (isP2) {
        setP2(null);
        return;
      }
      if (isJudge) {
        setJudge("");
        setManualJudge(false);
        return;
      }

      // Unassigned name: fill first open slot in priority order p1 → p2 → judge
      if (!p1) {
        setP1(tname);
        setP1Color("#2563EB");
        return;
      }
      if (!p2) {
        setP2(tname);
        setP2Color("#DC2626");
        return;
      }
      if (config.tm && !judge.trim()) {
        setJudge(tname);
        return;
      }
      // All slots full — do nothing
    };

    const getButtonStyle = (name: string): React.CSSProperties => {
      const tname = tn(name);
      const isP1 = tname === p1 || name === p1;
      const isP2 = tname === p2 || name === p2;
      const isJudge = config.tm && (name === judge || tname === judge);
      if (isP1)
        return {
          border: "2px solid #2563EB",
          background: "#2563EB",
          color: "#fff",
        };
      if (isP2)
        return {
          border: "2px solid #DC2626",
          background: "#DC2626",
          color: "#fff",
        };
      if (isJudge)
        return {
          border: "2px solid #B45309",
          background: "#F59E0B",
          color: "#fff",
        };
      return {
        border: "2px solid var(--border)",
        background: "var(--surface2)",
        color: "var(--text-primary)",
      };
    };

    const canProceed: boolean = Boolean(
      p1 && p2 && (!config.tm || judge.trim()),
    );
    const hasChallonge = !!challongeSlug;

    // Select a pairing from an active Challonge match
    const selectActivePairing = (match: ChallongeMatch): void => {
      const idMap = challongeParticipants || {};
      const reverseMap: Record<string, string> = {};
      Object.entries(idMap).forEach(([name, id]) => {
        reverseMap[String(id)] = name;
      });
      const name1 =
        match.player1_name ||
        reverseMap[String(match.player1_id)] ||
        `ID:${match.player1_id}`;
      const name2 =
        match.player2_name ||
        reverseMap[String(match.player2_id)] ||
        `ID:${match.player2_id}`;
      setP1(tn(name1));
      setP1Color("#2563EB");
      setP2(tn(name2));
      setP2Color("#DC2626");
      setChallongeMatchId(match.id);
      // For group stage tournaments, winner_id must be player1_id/player2_id (the group player IDs),
      // NOT the real participant.id — Challonge validates winner_id against the match's player IDs directly.
      setChallongeP1ParticipantId(match.player1_id || null);
      setChallongeP2ParticipantId(match.player2_id || null);
    };

    return (
      <div
        style={{ ...S.current.page, maxHeight: "100dvh", overflowY: "auto" }}
      >
        <button style={S.current.back} onClick={goBack}>
          {IC.back} Back
        </button>
        <h1 style={S.current.title}>Select Match</h1>

        {/* Step indicator */}
        <div
          style={{
            background: "var(--surface2)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 12,
            border: `2px solid ${stepColor}30`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: stepColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: stepColor }}>
            {stepLabel}
          </span>
          {step !== 1 && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginLeft: "auto",
              }}
            >
              {p1 && (
                <span style={{ color: p1Color, fontWeight: 600 }}>{p1} </span>
              )}
              {p1 && p2 && (
                <span style={{ color: "var(--text-muted)" }}>vs </span>
              )}
              {p2 && (
                <span style={{ color: p2Color, fontWeight: 600 }}>{p2}</span>
              )}
              {config.tm && judge && (
                <span style={{ color: "#B45309", fontWeight: 600 }}>
                  {" "}
                  · ⚖️{judge}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Tabs — only show Active Matches if a Challonge tournament is loaded */}
        {hasChallonge && (
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 12,
              borderRadius: 10,
              overflow: "hidden",
              border: "2px solid var(--border)",
            }}
          >
            {(
              [
                ["roster", "👥 Roster"],
                ["active", "⚡ Active Matches"],
              ] as Array<["roster" | "active", string]>
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setPickTab(tab);
                  if (tab === "active") fetchActiveMatches();
                }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  border: "none",
                  background: pickTab === tab ? "#1D4ED8" : "var(--surface)",
                  color: pickTab === tab ? "#fff" : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── ROSTER TAB ── */}
        {pickTab === "roster" && (
          <div style={S.current.card}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                gap: 8,
              }}
            >
              {[...players]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => {
                  const btnStyle = getButtonStyle(name);
                  const tname = tn(name);
                  const tag =
                    p1 === name || tname === p1
                      ? "P1"
                      : p2 === name || tname === p2
                        ? "P2"
                        : judge === name && config.tm
                          ? "Judge"
                          : null;
                  return (
                    <button
                      key={name}
                      onClick={() => handleNameClick(name)}
                      style={{
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
                        ...btnStyle,
                      }}
                    >
                      {tn(name)}
                      {tag && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: 1,
                            opacity: 0.85,
                          }}
                        >
                          {tag}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
            {config.tm && step === 3 && (
              <div
                style={{
                  marginTop: 10,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 10,
                }}
              >
                {!manualJudge ? (
                  <button
                    onClick={() => setManualJudge(true)}
                    style={{
                      ...S.current.upBtn,
                      marginBottom: 0,
                      justifyContent: "center",
                    }}
                  >
                    Name not present — enter manually
                  </button>
                ) : (
                  <JudgeInput
                    style={{
                      ...S.current.inp,
                      width: "100%",
                      borderColor: "#F59E0B60",
                      color: "var(--text-primary)",
                    }}
                    value={judge}
                    onCommit={(v) => {
                      setJudge(v);
                      setManualJudge(false);
                    }}
                    onClear={() => {
                      setJudge("");
                      setManualJudge(false);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE MATCHES TAB ── */}
        {pickTab === "active" &&
          (() => {
            // Judge conflict: judge is one of the selected players
            const judgeIsPlayer: boolean = Boolean(
              judge.trim() &&
              (judge === p1 ||
                judge === p2 ||
                tn(judge) === p1 ||
                tn(judge) === p2),
            );

            // canProceed: match selected + judge chosen (if tm) + no conflict
            const activeCanProceed: boolean = Boolean(
              challongeMatchId &&
              p1 &&
              p2 &&
              (!config.tm || judge.trim()) &&
              !judgeIsPlayer,
            );

            return (
              <div>
                {/* ── Judge picker — always shown first ── */}
                <div style={{ ...S.current.card, marginBottom: 8 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      letterSpacing: 1,
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    {config.tm ? "1. Select Judge on Duty" : "Judge (optional)"}
                  </p>
                  {!manualJudge ? (
                    <div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill,minmax(110px,1fr))",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        {[...players]
                          .sort((a, b) => a.localeCompare(b))
                          .map((name) => {
                            const isJudge = judge === name;
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setJudge(isJudge ? "" : name)}
                                style={{
                                  padding: "10px 6px",
                                  borderRadius: 9,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  fontFamily: "'Outfit',sans-serif",
                                  cursor: "pointer",
                                  border: `2px solid ${isJudge ? "#B45309" : "var(--border)"}`,
                                  background: isJudge
                                    ? "#F59E0B"
                                    : "var(--surface2)",
                                  color: isJudge
                                    ? "#fff"
                                    : "var(--text-primary)",
                                }}
                              >
                                {tn(name)}
                              </button>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setManualJudge(true)}
                        style={{
                          ...S.current.upBtn,
                          marginBottom: 0,
                          justifyContent: "center",
                          fontSize: 11,
                        }}
                      >
                        Name not present — enter manually
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <JudgeInput
                        style={{
                          ...S.current.inp,
                          flex: 1,
                          borderColor: "#F59E0B60",
                          color: "var(--text-primary)",
                        }}
                        value={judge}
                        onCommit={(v) => {
                          setJudge(v);
                        }}
                        onClear={() => {
                          setJudge("");
                          setManualJudge(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setManualJudge(false);
                          setJudge("");
                        }}
                        style={{
                          padding: "0 12px",
                          borderRadius: 9,
                          border: "2px solid var(--border)",
                          background: "var(--surface2)",
                          color: "var(--text-muted)",
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "'Outfit',sans-serif",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {judge.trim() && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#B45309",
                        fontWeight: 600,
                        marginTop: 8,
                      }}
                    >
                      ⚖️ Judge: {judge}
                    </p>
                  )}
                </div>

                {/* ── Match list ── */}
                <div style={{ ...S.current.card, marginBottom: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        margin: 0,
                      }}
                    >
                      {config.tm ? "2. Select Match" : "Select Match"}
                    </p>{" "}
                    <button
                      type="button"
                      onClick={fetchActiveMatches}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1D4ED8",
                        background: "#EFF6FF",
                        border: "2px solid #BFDBFE",
                        borderRadius: 10,
                        padding: "7px 14px",
                        cursor: "pointer",
                        fontFamily: "'Outfit',sans-serif",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      ↻ Refresh
                    </button>
                  </div>
                  {activeMatches === "loading" && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        textAlign: "center",
                        padding: "12px 0",
                      }}
                    >
                      ⏳ Loading active matches...
                    </p>
                  )}
                  {Array.isArray(activeMatches) &&
                    (() => {
                      const vis = activeMatches.filter((m) => {
                        const n1 = m.player1_name || "";
                        const n2 = m.player2_name || "";
                        const inR = (n: string) =>
                          players.some(
                            (p) =>
                              p === n ||
                              tn(p) === n ||
                              p === tn(n) ||
                              tn(p) === tn(n),
                          );
                        return n1 && n2 && inR(n1) && inR(n2);
                      });
                      return vis.length === 0 ? (
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            fontStyle: "italic",
                            textAlign: "center",
                            padding: "12px 0",
                          }}
                        >
                          {activeMatches.length === 0
                            ? "No open matches found."
                            : "No matches found involving your current roster."}
                        </p>
                      ) : null;
                    })()}
                  {!activeMatches && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        textAlign: "center",
                        padding: "12px 0",
                      }}
                    >
                      Tap Refresh to load open matches.
                    </p>
                  )}
                  {Array.isArray(activeMatches) &&
                    activeMatches
                      .filter((match) => {
                        const n1 = match.player1_name || "";
                        const n2 = match.player2_name || "";
                        const inR = (n: string) =>
                          players.some(
                            (p) =>
                              p === n ||
                              tn(p) === n ||
                              p === tn(n) ||
                              tn(p) === tn(n),
                          );
                        return n1 && n2 && inR(n1) && inR(n2);
                      })
                      .map((match, mi) => {
                        const name1 =
                          match.player1_name || `ID:${match.player1_id}`;
                        const name2 =
                          match.player2_name || `ID:${match.player2_id}`;
                        const isSelected = challongeMatchId === match.id;
                        const judgeConflict: boolean = Boolean(
                          judge.trim() &&
                          (judge === name1 ||
                            judge === name2 ||
                            tn(judge) === tn(name1) ||
                            tn(judge) === tn(name2)),
                        );
                        return (
                          <div
                            key={mi}
                            style={{
                              marginBottom:
                                mi < activeMatches.length - 1 ? 8 : 0,
                            }}
                          >
                            <button
                              type="button"
                              disabled={judgeConflict}
                              onClick={() =>
                                !judgeConflict && selectActivePairing(match)
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: 10,
                                border: `2px solid ${judgeConflict ? "var(--border)" : isSelected ? "#1D4ED8" : "var(--border)"}`,
                                background: judgeConflict
                                  ? "var(--surface3)"
                                  : isSelected
                                    ? "#EFF6FF"
                                    : "var(--surface2)",
                                opacity: judgeConflict ? 0.5 : 1,
                                cursor: judgeConflict
                                  ? "not-allowed"
                                  : "pointer",
                                fontFamily: "'Outfit',sans-serif",
                                textAlign: "left",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: judgeConflict
                                      ? "var(--text-disabled)"
                                      : "var(--text-primary)",
                                  }}
                                >
                                  {tn(name1)}{" "}
                                  <span style={{ fontWeight: 400 }}>vs</span>{" "}
                                  {tn(name2)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "var(--text-muted)",
                                    marginTop: 2,
                                  }}
                                >
                                  Round {match.round} · Match #
                                  {match.suggested_play_order || mi + 1}
                                </div>
                                {judgeConflict && (
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: "#DC2626",
                                      fontWeight: 700,
                                      marginTop: 3,
                                    }}
                                  >
                                    ⚠️ Judge is a player in this match
                                  </div>
                                )}
                              </div>
                              {!judgeConflict &&
                                (isSelected ? (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 800,
                                      color: "#1D4ED8",
                                      flexShrink: 0,
                                      marginLeft: 8,
                                    }}
                                  >
                                    ✓ Selected
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: "var(--text-muted)",
                                      flexShrink: 0,
                                      marginLeft: 8,
                                    }}
                                  >
                                    Select →
                                  </span>
                                ))}
                            </button>
                          </div>
                        );
                      })}
                </div>

                {/* ── Build Decks — shown as soon as a match is selected ── */}
                {challongeMatchId && (
                  <div>
                    {judgeIsPlayer && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "#FEF2F2",
                          border: "1px solid #FECACA",
                          marginBottom: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#DC2626",
                          textAlign: "center",
                        }}
                      >
                        ⚠️ The selected judge is playing in this match. Please
                        select a different judge.
                      </div>
                    )}
                    <button
                      style={{
                        ...S.current.pri,
                        margin: 0,
                        opacity: activeCanProceed ? 1 : 0.4,
                      }}
                      disabled={!activeCanProceed}
                      onClick={() => {
                        setMatchStartIdx(log.length);
                        setFuture([]);
                        setDeckReview(false);
                        setPhase("deck");
                      }}
                    >
                      Build Decks →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

        {pickTab === "roster" && (
          <button
            style={{ ...S.current.pri, opacity: canProceed ? 1 : 0.4 }}
            disabled={!canProceed}
            onClick={() => {
              setMatchStartIdx(log.length);
              setFuture([]);
              setDeckReview(false);
              setPhase("deck");
            }}
          >
            Build Decks →
          </button>
        )}
        {pickTab === "roster" &&
          config.tm &&
          playersSelected &&
          !judge.trim() && (
            <p style={{ ...S.current.hint, color: "#D97706" }}>
              Select the judge on duty to continue
            </p>
          )}
      </div>
    );
  }

  if (phase === "deck") {
    // If not in review mode and picker is not open, auto-start on P1 first blade
    if (!deckReview && !picker) {
      openPicker({ who: 1, slot: 0, cat: "blade" });
      return null;
    }

    // Review screen — shown when deckReview=true or picker is closed after finishing
    // Show a summary of what has been built so far with option to start or edit
    const comboNames = ["First", "Second", "Third"];
    const allDone = cReady;
    return (
      <div
        style={{ ...S.current.page, maxHeight: "100dvh", overflowY: "auto" }}
      >
        <button style={S.current.back} onClick={goBack}>
          {IC.back} Back
        </button>
        <h1 style={S.current.title}>Deck Review</h1>
        <p style={S.current.sub}>Tap any part to change it</p>
        {[
          { who: 1 as const, name: p1, deck: d1, setDeck: setD1, cl: p1Color },
          { who: 2 as const, name: p2, deck: d2, setDeck: setD2, cl: p2Color },
        ].map((pl) => (
          <div
            key={pl.who}
            style={{
              ...S.current.card,
              borderLeft: `4px solid ${pl.cl}`,
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: pl.cl,
                marginBottom: 8,
              }}
            >
              {pl.name}
            </p>
            {[0, 1, 2].map((slot) => (
              <div key={slot} style={{ marginBottom: slot < 2 ? 8 : 0 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {comboNames[slot].toUpperCase()} COMBO
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["blade", "ratchet", "bit"] as const).map((cat) => {
                    const cc: string = {
                      blade: "#EA580C",
                      ratchet: "#1D4ED8",
                      bit: "#15803D",
                    }[cat];
                    const val = pl.deck[slot][cat];
                    return (
                      <button
                        key={cat}
                        onClick={() =>
                          openPicker({
                            who: pl.who,
                            slot,
                            cat,
                            returnToReview: true,
                          })
                        }
                        style={{
                          flex: 1,
                          padding: "8px 4px",
                          borderRadius: 8,
                          border: `2px solid ${val ? cc : "#E2E8F0"}`,
                          background: val ? cc + "14" : "var(--surface2)",
                          color: val ? cc : "var(--text-faint)",
                          fontFamily: "'Outfit',sans-serif",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 44,
                          gap: 0,
                        }}
                      >
                        {val ? (
                          <PartLabel
                            name={val}
                            size={
                              splitPartName(val, cat !== "bit").length > 1
                                ? 10
                                : 12
                            }
                            keepDash={cat !== "bit"}
                          />
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            —
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
        <button
          style={{ ...S.current.pri, opacity: allDone ? 1 : 0.4 }}
          disabled={!allDone}
          onClick={() => {
            if (config.tm) {
              setSideAssign({ pickPriority: null });
              setSidePicker({ priority: null });
            }
            setPhase("battle");
          }}
        >
          Start Match ⚔️
        </button>
        {!allDone && (
          <p style={S.current.hint}>Tap any missing part above to continue</p>
        )}
      </div>
    );
  }

  // ── Side Assignment Modal ──────────────────────────────────────────────────
  if (phase === "battle" && sidePicker) {
    const priorityKnown = sidePicker.priority !== null;
    const priorityName = priorityKnown
      ? sidePicker.priority === 0
        ? p1
        : p2
      : null;
    const priorityColor = priorityKnown
      ? sidePicker.priority === 0
        ? "#2563EB"
        : "#DC2626"
      : "#475569";
    const otherName = priorityKnown
      ? sidePicker.priority === 0
        ? p2
        : p1
      : null;

    return (
      <div
        style={{
          ...S.current.page,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          maxHeight: "100dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Set {curSet} · Assign Sides
          </p>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: "var(--text-primary)",
              margin: "0 0 10px",
              lineHeight: 1,
            }}
          >
            {priorityKnown ? "Pick a Side" : "Who Has Priority?"}
          </h1>
          {!priorityKnown && (
            <p
              style={{
                fontSize: 16,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Judge: select the player with pick priority
            </p>
          )}
          {priorityKnown && (
            <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
              <span style={{ color: priorityColor, fontWeight: 800 }}>
                {priorityName}
              </span>{" "}
              has pick priority
            </p>
          )}
        </div>

        {/* Step 1: pick priority player */}
        {!priorityKnown && (
          <div style={{ width: "100%", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { name: p1, pi: 0 as const, cl: p1Color },
                { name: p2, pi: 1 as const, cl: p2Color },
              ].map((pl) => (
                <button
                  key={pl.pi}
                  onClick={() => setSidePicker({ priority: pl.pi })}
                  style={{
                    width: "100%",
                    padding: "28px 0",
                    borderRadius: 20,
                    border: `3px solid ${pl.cl}40`,
                    background: `${pl.cl}0D`,
                    color: pl.cl,
                    fontSize: 26,
                    fontWeight: 900,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {pl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: priority player picks side */}
        {priorityKnown && (
          <>
            <div style={{ width: "100%", marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: priorityColor,
                  textAlign: "center",
                  marginBottom: 14,
                  letterSpacing: 0.5,
                }}
              >
                {priorityName} — choose your side:
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {(["B", "X"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => {
                      const p1Side: Side =
                        sidePicker.priority === 0
                          ? side
                          : side === "B"
                            ? "X"
                            : "B";
                      const p2Side: Side =
                        sidePicker.priority === 0
                          ? side === "B"
                            ? "X"
                            : "B"
                          : side;
                      setSideAssign({
                        pickPriority: sidePicker.priority,
                        p1Side,
                        p2Side,
                      });
                      setCurrentSides({ p1Side, p2Side });
                      setSidePicker(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "36px 0",
                      borderRadius: 20,
                      border: `3px solid ${priorityColor}40`,
                      background: `${priorityColor}0D`,
                      color: priorityColor,
                      fontSize: 48,
                      fontWeight: 900,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {side} Side
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                width: "100%",
                background: "var(--surface2)",
                borderRadius: 14,
                padding: "16px 20px",
                border: "1px solid var(--border)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-primary)" }}>
                  {otherName}
                </strong>{" "}
                will be assigned the opposite side automatically.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === "over") {
    const winner: string = (sets[0] >= need ? p1 : p2) || "";
    const loserName: string = (winner === p1 ? p2 : p1) || "";
    const cs: ConfirmState = confirmState || {
      p1ok: false,
      p2ok: false,
      judgeok: false,
      voidConfirm: false,
    };
    const allPlayersDone = cs.p1ok && cs.p2ok;
    const submitted = cs.judgeok;

    // Undo the deciding battle and return to active play
    const undoMatchEnd = (): void => {
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
      setSetScores((ss) => ss.slice(0, -1));
      setConfirmState(null);
      setOverBackConfirm(false);
      setR1(null);
      setR2(null);
      setPendingFinish(null);
      setPhase("battle");
    };

    return (
      <div style={{ ...S.current.page, paddingBottom: 80 }}>
        {/* ── Back button + confirm modal ── */}
        {!submitted && (
          <button
            style={S.current.back}
            onClick={() => setOverBackConfirm(true)}
          >
            {IC.back} Back
          </button>
        )}
        {overBackConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.6)",
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 24px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 18,
                padding: "24px 20px",
                maxWidth: 320,
                width: "100%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              }}
            >
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                Go Back?
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  marginBottom: 6,
                  lineHeight: 1.5,
                }}
              >
                This will undo the last battle and return to the Pick Combo
                screen for the deciding set.
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  marginBottom: 20,
                  lineHeight: 1.4,
                }}
              >
                The match result will be reversed. Use this only if a scoring
                error was made.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setOverBackConfirm(false)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 10,
                    border: "2px solid #E2E8F0",
                    background: "#fff",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Stay Here
                </button>
                <button
                  onClick={undoMatchEnd}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 10,
                    border: "none",
                    background: "#EA580C",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Undo & Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Winner hero ── */}
        <div
          style={{
            background: `linear-gradient(135deg,${colorOf(winner)}CC,${colorOf(winner)})`,
            borderRadius: 20,
            padding: "28px 20px 24px",
            textAlign: "center",
            marginBottom: 12,
            boxShadow: `0 8px 24px ${colorOf(winner)}55`,
          }}
        >
          {config.tm && config.tournamentName && (
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.55)",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              {config.tournamentName}
            </p>
          )}
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 3,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Winner
          </p>
          <p
            style={{
              fontSize: winner && winner.length > 10 ? 48 : 72,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1,
              margin: "0 0 10px",
              fontFamily: "'Outfit',sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 8px",
            }}
          >
            {winner}
          </p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 4,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            defeats
          </p>
          <p
            style={{
              fontSize: loserName && loserName.length > 10 ? 28 : 42,
              fontWeight: 900,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1,
              fontFamily: "'Outfit',sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 8px",
            }}
          >
            {loserName}
          </p>
        </div>

        {/* ── Match score ── */}
        {config.bo > 1 && (
          <div
            style={{
              ...S.current.card,
              padding: "16px 20px",
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                color: "var(--text-muted)",
                textAlign: "center",
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              Match Score
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {(() => {
                // Count sets won by name from setScores — immune to position swaps
                const winnerSets = setScores.filter(
                  (ss) => (ss[winner] ?? 0) > (ss[loserName] ?? 0),
                ).length;
                const loserSets = setScores.filter(
                  (ss) => (ss[loserName] ?? 0) > (ss[winner] ?? 0),
                ).length;
                return (
                  <>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <p
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: colorOf(winner),
                          marginBottom: 4,
                        }}
                      >
                        {winner} 🏆
                      </p>
                      <p
                        style={{
                          fontSize: 52,
                          fontWeight: 900,
                          color: colorOf(winner),
                          lineHeight: 1,
                        }}
                      >
                        {winnerSets}
                      </p>
                    </div>
                    <p
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "var(--border2)",
                        minWidth: 32,
                        textAlign: "center",
                      }}
                    >
                      –
                    </p>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <p
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: colorOf(loserName),
                          marginBottom: 4,
                        }}
                      >
                        {loserName}
                      </p>
                      <p
                        style={{
                          fontSize: 52,
                          fontWeight: 900,
                          color: "var(--text-faint)",
                          lineHeight: 1,
                        }}
                      >
                        {loserSets}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
            {setScores.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 14,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {setScores.map((ss, i) => {
                  // Scores keyed by player name — immune to swaps
                  const wScore = ss[winner] ?? 0;
                  const lScore = ss[loserName] ?? 0;
                  const wColor = colorOf(winner);
                  const lColor = colorOf(loserName);
                  const setWon = wScore > lScore;
                  const bubbleColor = setWon ? wColor : lColor;
                  return (
                    <div
                      key={i}
                      style={{
                        textAlign: "center",
                        background: bubbleColor + "18",
                        borderRadius: 10,
                        padding: "8px 14px",
                        border: `1px solid ${bubbleColor}50`,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          color: bubbleColor,
                          letterSpacing: 1,
                          marginBottom: 4,
                        }}
                      >
                        SET {i + 1}
                      </p>
                      <p
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          lineHeight: 1,
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "center",
                          gap: 2,
                        }}
                      >
                        <span style={{ color: wColor }}>{wScore}</span>
                        <span
                          style={{
                            color: "#CBD5E1",
                            margin: "0 3px",
                            fontSize: 14,
                          }}
                        >
                          –
                        </span>
                        <span style={{ color: "var(--text-faint)" }}>
                          {lScore}
                        </span>
                      </p>
                      <p
                        style={{
                          fontSize: 7,
                          color: bubbleColor,
                          fontWeight: 700,
                          marginTop: 3,
                          letterSpacing: 0.5,
                        }}
                      >
                        {tn(winner)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Stats row ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Battles", val: log.slice(matchStartIdx).length },
            { label: "Shuffles", val: shuf },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: "var(--surface2)",
                borderRadius: 12,
                padding: "10px 8px",
                textAlign: "center",
                border: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  letterSpacing: 1,
                  marginBottom: 3,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </p>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--text-secondary)",
                }}
              >
                {s.val}
              </p>
            </div>
          ))}
          <div
            style={{
              flex: 2,
              background: "var(--surface2)",
              borderRadius: 12,
              padding: "8px",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Judge
            </p>
            {judgeEditMode ? (
              <div style={{ display: "flex", gap: 4, width: "100%" }}>
                <JudgeInput
                  style={{
                    ...S.current.inp,
                    flex: 1,
                    fontSize: 12,
                    padding: "3px 6px",
                    borderRadius: 6,
                    minWidth: 0,
                  }}
                  value={judge}
                  onCommit={(v) => {
                    setJudge(v);
                    setJudgeEditMode(false);
                  }}
                  onClear={() => setJudgeEditMode(false)}
                />
                <button
                  onClick={() => setJudgeEditMode(false)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563EB",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: "pointer",
                  }}
                >
                  ✓
                </button>
              </div>
            ) : (
              <button
                onClick={() => !submitted && setJudgeEditMode(true)}
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: submitted ? "default" : "pointer",
                  fontFamily: "'Outfit',sans-serif",
                  padding: 0,
                  textDecoration: submitted ? "none" : "underline dotted",
                }}
              >
                {judge || "—"}
              </button>
            )}
          </div>
        </div>

        {/* ── Match history ── */}
        <div style={{ ...S.current.card, marginBottom: 12 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Match History
          </p>
          {log.slice(matchStartIdx).map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "5px 0",
                borderBottom:
                  i < log.slice(matchStartIdx).length - 1
                    ? "1px solid #F1F5F9"
                    : "none",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                B{e.round} · Set {e.set}
                {e.p1Side ? ` · ${e.p1Side}/${e.p2Side}` : ""}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colorOf(e.scorer),
                }}
              >
                {e.scorer} — {e.typeName} +{e.points}
                {e.penalty ? " (pen)" : ""}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {e.p1Score}–{e.p2Score}
              </span>
            </div>
          ))}
        </div>

        {/* ── Tournament mode: player confirms + judge submit modal trigger ── */}
        {config.tm && !submitted && (
          <div
            style={{
              ...S.current.card,
              border: "2px solid #7C3AED30",
              background: "#F5F3FF",
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#7C3AED",
                marginBottom: 10,
                textAlign: "center",
                letterSpacing: 1,
              }}
            >
              CONFIRM RESULT
            </p>
            <p
              style={{
                fontSize: 11,
                color: "#64748B",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Both players confirm, then the judge submits.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => setConfirmState({ ...cs, p1ok: true })}
                disabled={cs.p1ok}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "none",
                  background: cs.p1ok ? "#15803D" : p1Color,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: cs.p1ok ? "default" : "pointer",
                  opacity: cs.p1ok ? 0.75 : 1,
                }}
              >
                {cs.p1ok ? "✓ " + p1 : p1 + " — Confirm"}
              </button>
              <button
                onClick={() => setConfirmState({ ...cs, p2ok: true })}
                disabled={cs.p2ok}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "none",
                  background: cs.p2ok ? "#15803D" : p2Color,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: cs.p2ok ? "default" : "pointer",
                  opacity: cs.p2ok ? 0.75 : 1,
                }}
              >
                {cs.p2ok ? "✓ " + p2 : p2 + " — Confirm"}
              </button>
            </div>
            {allPlayersDone && (
              <button
                onClick={() => setJudgeSubmitModal(true)}
                style={{
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
                  cursor: "pointer",
                }}
              >
                ⚖️ Judge Confirms →
              </button>
            )}
            {!allPlayersDone && (
              <p style={{ ...S.current.hint, marginTop: 8 }}>
                Both players must confirm before judge can act
              </p>
            )}
          </div>
        )}

        {/* ── Judge submit modal (checkboxes for Challonge + Sheets) ── */}
        {judgeSubmitModal &&
          (() => {
            const winnerIsP1 = sets[0] >= need;
            const winnerId = winnerIsP1
              ? challongeP1ParticipantId
              : challongeP2ParticipantId;
            const p1FinalScore = sets[0];
            const p2FinalScore = sets[1];
            const hasChallonge = !!(challongeSlug && challongeMatchId);
            return (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15,23,42,0.7)",
                  zIndex: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 24px",
                }}
              >
                <div
                  style={{
                    background: "var(--surface)",
                    borderRadius: 18,
                    padding: "22px 20px",
                    maxWidth: 340,
                    width: "100%",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "var(--text-primary)",
                        margin: 0,
                      }}
                    >
                      Submit Results
                    </p>
                    <button
                      onClick={() => setJudgeSubmitModal(false)}
                      style={{
                        background: "var(--surface3)",
                        border: "none",
                        borderRadius: 8,
                        width: 30,
                        height: 30,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                      }}
                    >
                      {IC.x}
                    </button>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginBottom: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: "var(--text-primary)" }}>
                      {winner}
                    </strong>{" "}
                    defeats {loserName} · {p1FinalScore}–{p2FinalScore}
                  </p>
                  {[
                    {
                      val: submitSheetsCheck,
                      set: (fn: (v: boolean) => boolean) => {
                        setSubmitSheetsCheck(fn(submitSheetsCheck));
                        if (!fn(submitSheetsCheck)) setSheetsComment("");
                      },
                      label: "Submit to Sheets Database",
                      desc: submitSheetsCheck
                        ? "Sends match data to the NC BLAST stat tracker"
                        : "Will post with red flag — add a reason below",
                      disabled: false,
                    },
                    {
                      val: submitChallongeCheck,
                      set: (fn: (v: boolean) => boolean) =>
                        setSubmitChallongeCheck(fn(submitChallongeCheck)),
                      label: "Submit to Challonge",
                      desc: hasChallonge
                        ? "Reports result to the active bracket match"
                        : "No bracket match selected",
                      disabled: !hasChallonge,
                    },
                  ].map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && opt.set((v) => !v)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        width: "100%",
                        padding: "11px 13px",
                        borderRadius: 11,
                        border: `2px solid ${opt.val && !opt.disabled ? "#2563EB" : "var(--border)"}`,
                        background:
                          opt.val && !opt.disabled
                            ? "#EFF6FF"
                            : "var(--surface2)",
                        cursor: opt.disabled ? "not-allowed" : "pointer",
                        marginBottom: 8,
                        textAlign: "left",
                        fontFamily: "'Outfit',sans-serif",
                        opacity: opt.disabled ? 0.45 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: `2px solid ${opt.val && !opt.disabled ? "#2563EB" : "var(--border2)"}`,
                          background:
                            opt.val && !opt.disabled
                              ? "#2563EB"
                              : "transparent",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1,
                        }}
                      >
                        {opt.val && !opt.disabled && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            margin: "0 0 2px",
                          }}
                        >
                          {opt.label}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            margin: 0,
                            lineHeight: 1.4,
                          }}
                        >
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                  {!submitSheetsCheck && (
                    <div style={{ marginBottom: 8 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#DC2626",
                          marginBottom: 4,
                        }}
                      >
                        Reason for excluding from active data:
                      </p>
                      <textarea
                        value={sheetsComment}
                        onChange={(e) => setSheetsComment(e.target.value)}
                        placeholder="e.g. disputed result, test match, re-do..."
                        style={{
                          width: "100%",
                          minHeight: 56,
                          borderRadius: 8,
                          border: "1px solid #FCA5A5",
                          background: "#FEF2F2",
                          padding: "8px 10px",
                          fontSize: 12,
                          fontFamily: "'Outfit',sans-serif",
                          color: "var(--text-primary)",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  )}
                  {challongeSubmitStatus === "ok" && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#15803D",
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: 6,
                      }}
                    >
                      ✓ Challonge submitted
                    </p>
                  )}
                  {challongeSubmitStatus &&
                    challongeSubmitStatus !== "ok" &&
                    challongeSubmitStatus !== "loading" && (
                      <p
                        style={{
                          fontSize: 11,
                          color: "#DC2626",
                          fontWeight: 600,
                          textAlign: "center",
                          marginBottom: 6,
                        }}
                      >
                        ✕ Challonge: {challongeSubmitStatus}
                      </p>
                    )}
                  {sheetsStatus === "success" && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#15803D",
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: 6,
                      }}
                    >
                      ✓ Sheets submitted
                    </p>
                  )}
                  {sheetsStatus === "error" && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#DC2626",
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: 6,
                      }}
                    >
                      ✕ Sheets failed — CSV downloaded
                    </p>
                  )}
                  {sheetsStatus === "queued" && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#D97706",
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: 6,
                      }}
                    >
                      📶 Offline — will submit when reconnected
                    </p>
                  )}
                  <button
                    disabled={challongeSubmitStatus === "loading"}
                    onClick={() => {
                      setJudgeSubmitModal(false);
                      setConfirmState({ ...cs, judgeok: true });
                      // Always post to sheets — flagged:true + comment when unchecked
                      onSendSheets(log.slice(matchStartIdx), {
                        p1,
                        p2,
                        sets,
                        config,
                        winner,
                        shuffles: shuf,
                        flagged: !submitSheetsCheck,
                        comment: sheetsComment,
                      });
                      if (!submitSheetsCheck) {
                        onDownloadCSV(log.slice(matchStartIdx), {
                          p1,
                          p2,
                          sets,
                          config,
                          winner,
                          shuffles: shuf,
                        });
                      }
                      if (
                        submitChallongeCheck &&
                        hasChallonge &&
                        challongeMatchId
                      ) {
                        submitChallongeScore(
                          challongeMatchId,
                          p1FinalScore,
                          p2FinalScore,
                          winnerId,
                        );
                      }
                    }}
                    style={{
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
                      marginTop: 4,
                    }}
                  >
                    {challongeSubmitStatus === "loading"
                      ? "Submitting…"
                      : "Submit"}
                  </button>
                </div>
              </div>
            );
          })()}

        {/* ── Actions ── */}
        {submitted && (
          <button
            style={S.current.pri}
            onClick={() => {
              setSheetsStatus(null);
              reset();
            }}
          >
            New Match
          </button>
        )}
        {!config.tm && (
          <>
            {challongeSlug &&
              challongeMatchId &&
              (() => {
                const winnerIsP1 = sets[0] >= need;
                const winnerId = winnerIsP1
                  ? challongeP1ParticipantId
                  : challongeP2ParticipantId;
                return challongeSubmitStatus === "ok" ? (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#F0FDF4",
                      border: "1px solid #86EFAC",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#15803D",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    ✓ Submitted to Challonge
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={challongeSubmitStatus === "loading"}
                    onClick={() =>
                      submitChallongeScore(
                        challongeMatchId,
                        sets[0],
                        sets[1],
                        winnerId,
                      )
                    }
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "11px 0",
                      borderRadius: 10,
                      border: "none",
                      background:
                        challongeSubmitStatus === "loading"
                          ? "#CBD5E1"
                          : "#EA580C",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Outfit',sans-serif",
                      cursor:
                        challongeSubmitStatus === "loading"
                          ? "not-allowed"
                          : "pointer",
                      marginBottom: 8,
                    }}
                  >
                    {challongeSubmitStatus === "loading"
                      ? "Submitting…"
                      : `Submit to Challonge${winnerId ? "" : " ⚠️"}`}
                  </button>
                );
              })()}
            <button
              style={S.current.pri}
              onClick={() => {
                setSheetsStatus(null);
                reset();
              }}
            >
              New Match
            </button>
          </>
        )}
        <button
          style={{ ...S.current.sec, width: "100%", justifyContent: "center" }}
          onClick={() =>
            onDownloadCSV(log.slice(matchStartIdx), {
              p1,
              p2,
              sets,
              config,
              winner,
              shuffles: shuf,
            })
          }
        >
          {IC.download} Download CSV
        </button>
        <button
          style={{
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
            textAlign: "center",
          }}
          onClick={() => {
            setSheetsStatus(null);
            reset();
            onMainMenu();
          }}
        >
          ⬅ Main Menu
        </button>

        {config.tm && sheetsStatus === "success" && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "#F0FDF4",
              border: "1px solid #86EFAC",
              fontSize: 12,
              fontWeight: 600,
              color: "#15803D",
              textAlign: "center",
            }}
          >
            ✓ Results submitted to Google Sheets
          </div>
        )}
        {config.tm && sheetsStatus === "error" && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              fontSize: 12,
              fontWeight: 600,
              color: "#DC2626",
              textAlign: "center",
            }}
          >
            ✕ Sheets submission failed — download CSV manually
          </div>
        )}
      </div>
    );
  }

  // Battle screen (merged: combo pick + scoring in one view)
  const comboOf = (deck: Combo[], idx: number): Combo =>
    deck[idx] || emptyCombo();
  const battlesInThisSet =
    log
      .slice(matchStartIdx)
      .filter(
        (e) => e.set === curSet && e.type !== "LER-STRIKE" && e.type !== "LER",
      ).length + 1;
  const maxW =
    typeof S.current.page.maxWidth === "number" ? S.current.page.maxWidth : 480;
  const sc2 = maxW / 480;
  const bp = (n: number): number => Math.round(n * sc2);
  const bf = (n: number): number => Math.round(n * sc2);

  const bothCombosSelected = r1 !== null && r2 !== null;
  const pending1 = pendingFinish?.pi === 0 ? pendingFinish.fin : null;
  const pending2 = pendingFinish?.pi === 1 ? pendingFinish.fin : null;

  // Battle screen: position:fixed full viewport, combo row pinned at bottom
  const COMBO_ROW_H = bp(54); // fixed height for combo picker row at bottom
  const STRIP_H = bp(36); // top strip height
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-solid)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* ── Top strip: Back · pills · mini action bar · Swap ── */}
      <div
        style={{
          height: STRIP_H,
          display: "flex",
          alignItems: "center",
          gap: bp(5),
          padding: `0 ${bp(10)}px`,
          flexShrink: 0,
          borderBottom: `1px solid ${config.tm ? "#6D28D9" : "var(--border)"}`,
          background: config.tm ? "#4C1D95" : "var(--surface)",
        }}
      >
        <button
          style={{
            ...S.current.back,
            marginBottom: 0,
            flexShrink: 0,
            fontSize: bf(12),
            color: config.tm ? "#E9D5FF" : "var(--text-secondary)",
          }}
          onClick={goBack}
        >
          {IC.back}
        </button>
        {config.bo > 1 && (
          <span
            style={{
              ...S.current.pill,
              flexShrink: 0,
              margin: 0,
              fontSize: bf(9),
              background: config.tm
                ? "rgba(255,255,255,0.15)"
                : "var(--pill-bg)",
              color: config.tm ? "#E9D5FF" : "var(--text-secondary)",
              border: config.tm
                ? "1px solid rgba(255,255,255,0.2)"
                : "1px solid var(--border2)",
            }}
          >
            Set {curSet}/{config.bo}
          </span>
        )}
        <span
          style={{
            ...S.current.pill,
            flexShrink: 0,
            margin: 0,
            fontSize: bf(9),
            background: config.tm ? "rgba(255,255,255,0.15)" : "var(--pill-bg)",
            color: config.tm ? "#E9D5FF" : "var(--text-secondary)",
            border: config.tm
              ? "1px solid rgba(255,255,255,0.2)"
              : "1px solid var(--border2)",
          }}
        >
          B{battlesInThisSet}
        </span>
        {config.bo > 1 && (
          <span
            style={{
              ...S.current.pill,
              flexShrink: 0,
              margin: 0,
              fontSize: bf(9),
              background: config.tm
                ? "rgba(255,255,255,0.15)"
                : "var(--pill-bg)",
              color: config.tm ? "#E9D5FF" : "var(--text-secondary)",
              border: config.tm
                ? "1px solid rgba(255,255,255,0.2)"
                : "1px solid var(--border2)",
            }}
          >
            {sets[0]}–{sets[1]}
          </span>
        )}
        {/* Mini action bar — history, undo, redo, dark, settings */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: bp(2),
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          {/* Stream overlay: cycle button + connect button */}
          <button
            type="button"
            onClick={() => {
              const next = (overlaySlot + 1) % (4 + 1);
              setOverlaySlot(next);
              setOverlayStatus(null);
              try {
                localStorage.setItem(KEYS.overlaySlot, String(next));
              } catch {
                /* ignore */
              }
            }}
            style={{
              background: overlaySlot > 0 ? "#1D4ED8" : "none",
              border: overlaySlot > 0 ? "none" : "1px solid var(--border2)",
              color: overlaySlot > 0 ? "#fff" : "var(--text-muted)",
              borderRadius: bp(6),
              padding: `${bp(2)}px ${bp(6)}px`,
              fontSize: bf(9),
              fontWeight: 800,
              fontFamily: "'Outfit',sans-serif",
              cursor: "pointer",
              flexShrink: 0,
            }}
            title="Stream overlay slot (0=off)"
          >
            {overlaySlot > 0 ? `📡 T${overlaySlot}` : "📡"}
          </button>
          {overlaySlot > 0 && (
            <button
              type="button"
              onClick={() => {
                pushOverlay();
              }}
              style={{
                background: overlayStatus === "ok" ? "#15803D" : "#EA580C",
                border: "none",
                color: "#fff",
                borderRadius: bp(6),
                padding: `${bp(2)}px ${bp(6)}px`,
                fontSize: bf(9),
                fontWeight: 800,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
                flexShrink: 0,
              }}
              title="Connect overlay / push live state"
            >
              {overlayStatus === "ok" ? "🟢 LIVE" : "▶ Connect"}
            </button>
          )}
          <button
            onClick={() => setHistoryOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: `${bp(3)}px ${bp(5)}px`,
              display: "flex",
              alignItems: "center",
            }}
          >
            {IC.history}
          </button>
          <button
            onClick={undo}
            disabled={
              log.length <= matchStartIdx &&
              lerStrikes[0] === 0 &&
              lerStrikes[1] === 0
            }
            style={{
              background: "none",
              border: "none",
              color:
                log.length > matchStartIdx ||
                lerStrikes[0] === 1 ||
                lerStrikes[1] === 1
                  ? "var(--text-muted)"
                  : "var(--text-disabled)",
              cursor:
                log.length > matchStartIdx ||
                log[log.length - 1]?.type === "LER-STRIKE"
                  ? "pointer"
                  : "default",
              padding: `${bp(3)}px ${bp(5)}px`,
              display: "flex",
              alignItems: "center",
            }}
          >
            {IC.undo}
          </button>
          <button
            onClick={redo}
            disabled={!future.length}
            style={{
              background: "none",
              border: "none",
              color: future.length ? "#EA580C" : "var(--text-disabled)",
              cursor: future.length ? "pointer" : "default",
              padding: `${bp(3)}px ${bp(5)}px`,
              display: "flex",
              alignItems: "center",
            }}
          >
            {IC.redo}
          </button>
          <button
            onClick={toggleDark}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: `${bp(3)}px ${bp(4)}px`,
              fontSize: bf(14),
              lineHeight: 1,
            }}
          >
            {dark ? "☀️" : "🌙"}
          </button>
          {currentSides.p1Side && (
            <button
              type="button"
              onClick={() => {
                // Capture ALL current values before any setState call
                const snapP1 = p1,
                  snapP2 = p2;
                const snapD1 = d1,
                  snapD2 = d2;
                const snapR1 = r1,
                  snapR2 = r2;
                const snapU1 = used1,
                  snapU2 = used2;
                const snapS1 = currentSides.p1Side,
                  snapS2 = currentSides.p2Side;
                const snapC1 = p1Color,
                  snapC2 = p2Color;
                const snapPts0 = pts[0],
                  snapPts1 = pts[1];
                const snapSets0 = sets[0],
                  snapSets1 = sets[1];
                const snapLer0 = lerStrikes[0],
                  snapLer1 = lerStrikes[1];
                const snapCId1 = challongeP1ParticipantId,
                  snapCId2 = challongeP2ParticipantId;
                // Apply all swaps atomically
                setP1(snapP2);
                setP2(snapP1);
                setD1(snapD2);
                setD2(snapD1);
                setR1(snapR2);
                setR2(snapR1);
                setUsed1(snapU2);
                setUsed2(snapU1);
                setCurrentSides({ p1Side: snapS2, p2Side: snapS1 });
                setSideAssign((a) =>
                  a ? { ...a, p1Side: snapS2, p2Side: snapS1 } : a,
                );
                setP1Color(snapC2);
                setP2Color(snapC1);
                setPts([snapPts1, snapPts0]);
                setSets([snapSets1, snapSets0]);
                setLerStrikes([snapLer1, snapLer0]);
                setChallongeP1ParticipantId(snapCId2);
                setChallongeP2ParticipantId(snapCId1);
                // Push overlay with swapped state explicitly
                setTimeout(
                  () =>
                    pushOverlay({
                      p1ComboIdx: snapR2,
                      p2ComboIdx: snapR1,
                      pts: [snapPts1, snapPts0],
                      sets: [snapSets1, snapSets0],
                    }),
                  0,
                );
              }}
              style={{
                padding: `${bp(2)}px ${bp(6)}px`,
                borderRadius: bp(6),
                border: "1px solid var(--border2)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                fontSize: bf(9),
                fontWeight: 700,
                fontFamily: "'Outfit',sans-serif",
                cursor: "pointer",
                marginLeft: bp(2),
              }}
            >
              ⇄ Swap
            </button>
          )}
        </div>
      </div>

      {/* ── Score block ── */}
      <div
        style={{
          background: "var(--surface)",
          borderRadius: bp(12),
          padding: `${bp(8)}px ${bp(12)}px ${bp(6)}px`,
          marginBottom: bp(5),
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {/* Set label centered above score row */}
        <div style={{ textAlign: "center", marginBottom: bp(3) }}>
          <span
            style={{
              fontSize: bf(9),
              fontWeight: 700,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {["First", "Second", "Third", "Fourth", "Fifth"][curSet - 1] ||
              `Set ${curSet}`}{" "}
            Set
          </span>
        </div>
        {/* Names centered directly above their scores */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            marginBottom: bp(2),
          }}
        >
          <div
            style={{
              flex: 1,
              textAlign: "center",
              minWidth: 0,
              paddingRight: bp(20),
            }}
          >
            <span
              style={{
                fontSize: bf(p1 && p1.length > 10 ? 13 : 17),
                fontWeight: 900,
                color: p1Color,
                fontFamily: "'Outfit',sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {p1}
            </span>
            {currentSides.p1Side && (
              <span
                style={{
                  fontSize: bf(8),
                  fontWeight: 700,
                  color: p1Color + "CC",
                  lineHeight: 1.2,
                  display: "block",
                }}
              >
                {currentSides.p1Side} Side
              </span>
            )}
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              minWidth: 0,
              paddingLeft: bp(20),
            }}
          >
            <span
              style={{
                fontSize: bf(p2 && p2.length > 10 ? 13 : 17),
                fontWeight: 900,
                color: p2Color,
                fontFamily: "'Outfit',sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {p2}
            </span>
            {currentSides.p2Side && (
              <span
                style={{
                  fontSize: bf(8),
                  fontWeight: 700,
                  color: p2Color + "CC",
                  lineHeight: 1.2,
                  display: "block",
                }}
              >
                {currentSides.p2Side} Side
              </span>
            )}
          </div>
        </div>
        {/* Scores centered under names */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ flex: 1, textAlign: "center" }}>
            <span
              style={{
                fontSize: bf(52),
                fontWeight: 900,
                color: p1Color,
                lineHeight: 1,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {pts[0]}
            </span>
          </div>
          <div style={{ textAlign: "center", minWidth: bp(40) }}>
            <span
              style={{
                fontSize: bf(22),
                fontWeight: 800,
                color: "var(--border2)",
              }}
            >
              –
            </span>
            {config.pts > 0 && (
              <p
                style={{
                  fontSize: bf(8),
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginTop: bp(2),
                  letterSpacing: 1,
                }}
              >
                TO {config.pts}
              </p>
            )}
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <span
              style={{
                fontSize: bf(52),
                fontWeight: 900,
                color: p2Color,
                lineHeight: 1,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {pts[1]}
            </span>
          </div>
        </div>
      </div>

      {/* ── Active combo display — updates live as combos are selected ── */}
      <div
        style={{
          display: "flex",
          gap: bp(6),
          marginBottom: bp(5),
          flexShrink: 0,
        }}
      >
        {[
          { name: p1, deck: d1, ri: r1, cl: p1Color },
          { name: p2, deck: d2, ri: r2, cl: p2Color },
        ].map((side, si) => {
          const c: Combo | null =
            side.ri !== null ? comboOf(side.deck, side.ri) : null;
          const bladeText = c?.blade || "—";
          const rbText =
            c?.ratchet && c?.bit
              ? `${c.ratchet} ${c.bit}`
              : c
                ? "—"
                : "Pick combo ↓";
          const bladeFz = bf(
            bladeText.length > 14 ? 13 : bladeText.length > 10 ? 15 : 18,
          );
          const rbFz = bf(rbText.length > 10 ? 11 : 13);
          const hasCombo = side.ri !== null;
          return (
            <div
              key={si}
              style={{
                flex: 1,
                borderRadius: bp(12),
                border: `2px solid ${hasCombo ? side.cl + "60" : "var(--border)"}`,
                background: hasCombo ? `${side.cl}0D` : "var(--surface2)",
                padding: `${bp(8)}px ${bp(6)}px`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: bp(44),
                gap: bp(2),
              }}
            >
              <span
                style={{
                  fontSize: bladeFz,
                  fontWeight: 900,
                  color: hasCombo ? side.cl : "var(--text-muted)",
                  textAlign: "center",
                  lineHeight: 1.15,
                  fontFamily: "'Outfit',sans-serif",
                }}
              >
                {bladeText}
              </span>
              <span
                style={{
                  fontSize: rbFz,
                  fontWeight: 600,
                  color: hasCombo ? side.cl : "var(--text-faint)",
                  textAlign: "center",
                  lineHeight: 1.2,
                  opacity: 0.9,
                  fontFamily: "'Outfit',sans-serif",
                }}
              >
                {rbText}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Two-column scoring (fills remaining space; buttons scale to fit) ── */}
      <div
        style={{
          display: "flex",
          gap: bp(6),
          flex: 1,
          minHeight: 0,
          padding: `${bp(4)}px ${bp(10)}px 0`,
        }}
      >
        {[
          {
            i: 0 as const,
            cl: p1Color,
            name: p1,
            dk: d1,
            sel: r1,
            setSel: setR1,
            used: used1,
            pending: pending1,
          },
          {
            i: 1 as const,
            cl: p2Color,
            name: p2,
            dk: d2,
            sel: r2,
            setSel: setR2,
            used: used2,
            pending: pending2,
          },
        ].map((side) => {
          const canConfirm = side.sel !== null && side.pending;
          return (
            <div
              key={side.i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: bp(2),
                minHeight: 0,
              }}
            >
              {/* Finish buttons + LER + Confirm — each flex:1 so they share available height equally */}
              {[...FINISH, ...PENALTY.filter((f) => f.id !== "LER")].map(
                (f) => {
                  const isSel = side.pending?.id === f.id;
                  const isFinish = !f.penalty;
                  const label =
                    f.id === "OF2"
                      ? "Own ×2"
                      : f.id === "OF3"
                        ? "Own ×3"
                        : f.name;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!bothCombosSelected}
                      onClick={() => {
                        if (bothCombosSelected)
                          setPendingFinish(
                            isSel ? null : { pi: side.i, fin: f },
                          );
                      }}
                      style={{
                        flex: 1,
                        minHeight: 0,
                        borderRadius: bp(7),
                        border: `2px solid ${!bothCombosSelected ? "var(--border)" : isSel ? side.cl : isFinish ? `${side.cl}50` : "var(--border2)"}`,
                        background: !bothCombosSelected
                          ? "var(--surface2)"
                          : isSel
                            ? side.cl
                            : isFinish
                              ? `${side.cl}10`
                              : "var(--surface2)",
                        color: !bothCombosSelected
                          ? "var(--text-disabled)"
                          : isSel
                            ? "#fff"
                            : "var(--text-primary)",
                        fontFamily: "'Outfit',sans-serif",
                        cursor: bothCombosSelected ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: `0 ${bp(7)}px`,
                        opacity: bothCombosSelected ? 1 : 0.45,
                      }}
                    >
                      <span
                        style={{
                          fontSize: bf(9),
                          fontWeight: 800,
                          lineHeight: 1,
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          background: !bothCombosSelected
                            ? "var(--border2)"
                            : isSel
                              ? "rgba(255,255,255,0.3)"
                              : side.cl,
                          color: "#fff",
                          padding: `${bp(1)}px ${bp(4)}px`,
                          borderRadius: bp(3),
                          fontSize: bf(8),
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        +{f.p}
                      </span>
                    </button>
                  );
                },
              )}

              {/* LER — strike system, flex:1 like the other buttons */}
              {(() => {
                const lerLocked = !bothCombosSelected;
                const hasStrike = lerStrikes[side.i] === 1;
                const lerFin = PENALTY.find((f) => f.id === "LER");
                return (
                  <button
                    type="button"
                    disabled={lerLocked}
                    onClick={() => {
                      if (lerLocked) return;
                      if (!hasStrike) {
                        // LER-STRIKE: warn only — not logged to match history or data
                        // Undo is handled by setLerStrikes alone (no log entry needed)
                        setLerStrikes((s) => {
                          const n: [number, number] = [...s];
                          n[side.i] = 1;
                          return n;
                        });
                        pushOverlay({
                          lastFinish: { type: "LER-STRIKE", scorerIdx: side.i },
                        });
                      } else {
                        setLerStrikes([0, 0]);
                        if (lerFin) doScore(side.i, lerFin);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: `0 ${bp(7)}px`,
                      borderRadius: bp(7),
                      border: hasStrike
                        ? `2px solid #F59E0B`
                        : "1px dashed var(--border2)",
                      background: hasStrike ? "#FEF9C3" : "var(--surface2)",
                      color: lerLocked
                        ? "var(--text-disabled)"
                        : "var(--text-primary)",
                      fontFamily: "'Outfit',sans-serif",
                      cursor: lerLocked ? "not-allowed" : "pointer",
                      boxSizing: "border-box",
                      opacity: lerLocked ? 0.5 : 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: bf(9),
                        fontWeight: 700,
                        color: hasStrike ? "#B45309" : "inherit",
                      }}
                    >
                      {hasStrike ? "⚠️ Strike — tap again" : "Launch Error"}
                    </span>
                    <span
                      style={{
                        background: hasStrike ? "#F59E0B" : "var(--surface3)",
                        color: "#fff",
                        padding: `${bp(1)}px ${bp(4)}px`,
                        borderRadius: bp(3),
                        fontSize: bf(8),
                        fontWeight: 800,
                      }}
                    >
                      LER
                    </span>
                  </button>
                );
              })()}

              {/* Confirm button — flex:1, slightly more weight visually */}
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => {
                  if (canConfirm && side.pending) {
                    doScore(side.i, side.pending);
                    setPendingFinish(null);
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  borderRadius: bp(7),
                  border: "none",
                  background: canConfirm ? side.cl : "var(--surface3)",
                  color: canConfirm ? "#fff" : "var(--text-disabled)",
                  fontSize: bf(10),
                  fontWeight: 900,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: canConfirm ? "pointer" : "not-allowed",
                  boxSizing: "border-box",
                  transition: "background 0.15s",
                }}
              >
                {canConfirm
                  ? `Confirm ${side.pending?.name} →`
                  : side.pending
                    ? "Pick combo ↓"
                    : side.sel !== null
                      ? "Pick finish ↑"
                      : "Pick combo ↓"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Combo picker row — ALWAYS pinned at bottom, exactly COMBO_ROW_H tall ── */}
      <div
        style={{
          height: COMBO_ROW_H,
          display: "flex",
          gap: bp(6),
          padding: `${bp(4)}px ${bp(10)}px`,
          flexShrink: 0,
        }}
      >
        {[
          {
            i: 0 as const,
            cl: p1Color,
            dk: d1,
            sel: r1,
            setSel: setR1,
            used: used1,
          },
          {
            i: 1 as const,
            cl: p2Color,
            dk: d2,
            sel: r2,
            setSel: setR2,
            used: used2,
          },
        ].map((side) => (
          <div key={side.i} style={{ flex: 1, display: "flex", gap: bp(4) }}>
            {side.dk.map((c, i) => {
              const isUsed = side.used.includes(i);
              const isSel = side.sel === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isUsed}
                  onClick={() => {
                    if (!isUsed) {
                      const newIdx = isSel ? null : i;
                      side.setSel(newIdx);
                      if (side.i === 0) pushOverlay({ p1ComboIdx: newIdx });
                      else pushOverlay({ p2ComboIdx: newIdx });
                    }
                  }}
                  style={{
                    flex: 1,
                    height: "100%",
                    borderRadius: bp(7),
                    position: "relative",
                    border: `2px solid ${isUsed ? "var(--border)" : isSel ? side.cl : "var(--border2)"}`,
                    background: isUsed
                      ? "var(--surface2)"
                      : isSel
                        ? side.cl
                        : "var(--surface)",
                    color: isUsed
                      ? "var(--text-disabled)"
                      : isSel
                        ? "#fff"
                        : "var(--text-primary)",
                    fontFamily: "'Outfit',sans-serif",
                    cursor: isUsed ? "not-allowed" : "pointer",
                    opacity: isUsed ? 0.4 : 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: bp(1),
                    padding: `${bp(2)}px`,
                    boxSizing: "border-box",
                  }}
                >
                  {isUsed && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 40 40"
                        fill="none"
                        stroke="#DC2626"
                        strokeWidth="4"
                        strokeLinecap="round"
                        opacity="0.5"
                      >
                        <line x1="8" y1="8" x2="32" y2="32" />
                        <line x1="32" y1="8" x2="8" y2="32" />
                      </svg>
                    </div>
                  )}
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: bf(10),
                      lineHeight: 1.1,
                      textAlign: "center",
                    }}
                  >
                    {c.blade || "—"}
                  </span>
                  <span
                    style={{
                      fontSize: bf(8),
                      fontWeight: 600,
                      opacity: 0.8,
                      textAlign: "center",
                    }}
                  >
                    {c.ratchet && c.bit ? `${c.ratchet} ${c.bit}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Match history slide-over (kept from BottomBar, triggered by strip button) */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: historyOpen ? Math.min(340, window.innerWidth - 40) : 0,
          background: "var(--surface)",
          boxShadow: historyOpen ? "-4px 0 24px rgba(0,0,0,0.25)" : "none",
          transition: "width 0.25s ease",
          overflow: "hidden",
          zIndex: 100,
        }}
      >
        <div
          style={{
            width: Math.min(340, window.innerWidth - 40),
            padding: "20px 16px",
            overflowY: "auto",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              Match Log
            </h2>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {log.length > 0 && (
                <button
                  onClick={() => setHistoryConfirmClear(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#EF4444",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "'Outfit',sans-serif",
                    cursor: "pointer",
                    opacity: 0.7,
                    padding: "4px 6px",
                  }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setHistoryOpen(false)}
                style={{
                  background: "var(--surface3)",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                {IC.x}
              </button>
            </div>
          </div>
          {historyConfirmClear && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.5)",
                zIndex: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 24px",
              }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  padding: "24px 20px",
                  maxWidth: 320,
                  width: "100%",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                  border: "1px solid var(--border)",
                }}
              >
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  Clear Match Log?
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    marginBottom: 20,
                    lineHeight: 1.5,
                  }}
                >
                  This will permanently delete all{" "}
                  <strong style={{ color: "#EF4444" }}>
                    {log.length} battle records
                  </strong>{" "}
                  from the log. This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setHistoryConfirmClear(false)}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      borderRadius: 10,
                      border: "2px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-secondary)",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setLog([]);
                      sSave(KEYS.matchLog, []);
                      setHistoryConfirmClear(false);
                      setHistoryOpen(false);
                    }}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      borderRadius: 10,
                      border: "none",
                      background: "#EF4444",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
          {log.length === 0 && (
            <p
              style={{
                color: "var(--text-disabled)",
                fontSize: 13,
                fontStyle: "italic",
              }}
            >
              No battles yet
            </p>
          )}
          {log
            .slice()
            .reverse()
            .map((e, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  marginBottom: 8,
                  background: colorOf(e.scorer) + "22",
                  borderLeft: `4px solid ${colorOf(e.scorer)}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: colorOf(e.scorer),
                      fontSize: 14,
                    }}
                  >
                    {e.scorer}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                    }}
                  >
                    R{log.length - i} · Set {e.set}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 700, color: colorOf(e.scorer) }}>
                    {e.typeName}
                  </span>{" "}
                  (+{e.points})
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Won with:{" "}
                  <span style={{ fontWeight: 600 }}>{e.winnerCombo}</span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 2,
                    fontWeight: 600,
                  }}
                >
                  {e.p1Name} {e.p1Score}–{e.p2Score} {e.p2Name}
                </div>
              </div>
            ))}
        </div>
      </div>
      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            zIndex: 99,
          }}
        />
      )}
    </div>
  );
}
