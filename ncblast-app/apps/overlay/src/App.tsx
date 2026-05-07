import { useEffect, useRef, useState, useCallback } from "react";
import type { OverlayState } from "@ncblast/shared";
import { STORAGE_KEYS, FINISH_LABELS } from "@ncblast/shared";
import { useDraggable } from "./hooks/useDraggable";
import { useResizable } from "./hooks/useResizable";
import { usePolling } from "./hooks/usePolling";

// ── CONFIG ──────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const SLOT = parseInt(params.get("slot") || "1");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const EDIT_MODE = params.get("edit") === "1"; // ?edit=1 shows controls

// ── RESIZE ───────────────────────────────────────────────────────
// Supports 3 handles: corner (uniform scale), right edge (width), bottom edge (height)
const BASE_W = 860;
const BASE_H = 160; // approximate natural card height at scale 1

function parsePos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.overlayPos);
    if (!raw) return { x: 30, y: 880 };
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "x" in parsed &&
      "y" in parsed &&
      typeof (parsed as { x: unknown }).x === "number" &&
      typeof (parsed as { y: unknown }).y === "number"
    ) {
      return parsed as { x: number; y: number };
    }
  } catch {
    /* ignore */
  }
  return { x: 30, y: 880 };
}

/**
 * Full overlay app — draggable/resizable scoreboard card with long-poll
 * from the Cloudflare Worker. Preserves the original DOM structure,
 * keyboard shortcuts, localStorage keys, and finish-flash behavior.
 */
export function App() {
  // ── STATE ────────────────────────────────────────────────────────
  const [state, setState] = useState<OverlayState | null>(null);
  const [prevState, setPrevState] = useState<OverlayState | null>(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const [flashLabel, setFlashLabel] = useState("");
  const [flashColor, setFlashColor] = useState("");
  const [flashWinner, setFlashWinner] = useState("");
  const [flashClass, setFlashClass] = useState("");
  const [p1Pop, setP1Pop] = useState(false);
  const [p2Pop, setP2Pop] = useState(false);
  const [pos, setPos] = useState(() => parsePos());
  const [sizeTick, setSizeTick] = useState(0); // trigger re-render when scale/w/h changes

  const scaleRef = useRef<number>(
    parseFloat(localStorage.getItem(STORAGE_KEYS.overlayScale) || "1"),
  );
  const wRef = useRef<number>(
    parseFloat(
      localStorage.getItem(STORAGE_KEYS.overlayW) ||
        String(BASE_W * scaleRef.current),
    ),
  );
  const hRef = useRef<number>(
    parseFloat(localStorage.getItem(STORAGE_KEYS.overlayH) || "0"),
  ); // 0 = auto

  const widgetRef = useRef<HTMLDivElement>(null);
  const scaleWrapRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const rhCornerRef = useRef<HTMLDivElement>(null);
  const rhRightRef = useRef<HTMLDivElement>(null);
  const rhBottomRef = useRef<HTMLDivElement>(null);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p1PopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p2PopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── APPLY SAVED POSITION & SCALE ─────────────────────────────────
  const getCardHeight = useCallback(
    () => mainCardRef.current?.offsetHeight || BASE_H,
    [],
  );

  useDraggable(dragHandleRef, pos, setPos);
  useResizable({
    cornerRef: rhCornerRef,
    rightRef: rhRightRef,
    bottomRef: rhBottomRef,
    baseW: BASE_W,
    baseH: BASE_H,
    getCardHeight,
    scaleRef,
    wRef,
    hRef,
    onChange: () => setSizeTick((t) => t + 1),
  });

  // Render size effect — mirrors applyTransform / applySize
  useEffect(() => {
    const widget = widgetRef.current;
    const scaleWrap = scaleWrapRef.current;
    const card = mainCardRef.current;
    if (!widget || !scaleWrap || !card) return;
    widget.style.left = pos.x + "px";
    widget.style.top = pos.y + "px";
    scaleWrap.style.transform = `scale(${scaleRef.current})`;
    const w = wRef.current > 0 ? wRef.current : BASE_W * scaleRef.current;
    widget.style.width = w + "px";
    if (hRef.current > 0) {
      widget.style.height = hRef.current + "px";
      scaleWrap.style.transformOrigin = "top left";
      const cardH = card.offsetHeight || BASE_H;
      const hScale = hRef.current / cardH;
      const wScale = w / BASE_W;
      const s = Math.min(hScale, wScale);
      scaleRef.current = Math.max(0.3, Math.min(3.0, s));
      scaleWrap.style.transform = `scale(${scaleRef.current})`;
    } else {
      widget.style.height =
        (card.offsetHeight || BASE_H) * scaleRef.current + "px";
    }
  }, [pos.x, pos.y, sizeTick, state]);

  // ── POLLING LOOP ──────────────────────────────────────────────────
  const onPollState = useCallback(
    (s: OverlayState | null, prev: OverlayState | null) => {
      setPrevState(prev);
      setState(s);
    },
    [],
  );
  const { reset: resetPolling } = usePolling(SLOT, onPollState);

  // ── POP ANIMATION on points change ───────────────────────────────
  useEffect(() => {
    if (!state || !prevState) return;
    const p1pts = (state.pts || [0, 0])[0];
    const p2pts = (state.pts || [0, 0])[1];
    const prevP1 = (prevState.pts || [0, 0])[0];
    const prevP2 = (prevState.pts || [0, 0])[1];
    if (p1pts !== prevP1) {
      setP1Pop(true);
      if (p1PopTimerRef.current) clearTimeout(p1PopTimerRef.current);
      p1PopTimerRef.current = setTimeout(() => setP1Pop(false), 200);
    }
    if (p2pts !== prevP2) {
      setP2Pop(true);
      if (p2PopTimerRef.current) clearTimeout(p2PopTimerRef.current);
      p2PopTimerRef.current = setTimeout(() => setP2Pop(false), 200);
    }
  }, [state, prevState]);

  // ── FINISH FLASH — trigger only when lastFinish changes ───────────
  useEffect(() => {
    if (!state || !state.lastFinish || !prevState) return;
    const same =
      prevState.lastFinish &&
      prevState.lastFinish.type === state.lastFinish.type &&
      JSON.stringify(prevState.pts) === JSON.stringify(state.pts);
    if (same) return;
    const p1Color =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--p1-color")
        .trim() || "#60A5FA";
    const p2Color =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--p2-color")
        .trim() || "#FB923C";
    const { type, scorerIdx } = state.lastFinish;
    const label = FINISH_LABELS[type] || type;
    const winner = scorerIdx === 0 ? state.p1 : state.p2;
    const color = scorerIdx === 0 ? p1Color : p2Color;
    setFlashLabel(label);
    setFlashColor(color);
    setFlashWinner((winner || "Player") + " SCORES");
    setFlashClass(scorerIdx === 0 ? "p1-win" : "p2-win");
    setFlashVisible(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashVisible(false), 2200);
  }, [state, prevState]);

  // ── RESET ────────────────────────────────────────────────────────────
  const resetOverlay = useCallback(() => {
    // Null the long-poll closure state first so next /overlay/poll re-fetches fresh state
    resetPolling();
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (p1PopTimerRef.current) clearTimeout(p1PopTimerRef.current);
    if (p2PopTimerRef.current) clearTimeout(p2PopTimerRef.current);
    setFlashVisible(false);
    setState(null);
    setPrevState(null);
  }, [resetPolling]);

  // ── KEYBOARD SHORTCUTS (for streamer convenience) ─────────────────
  // R = reset position to bottom-left
  // +/- = scale up/down
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "r" || e.key === "R") {
        const np = { x: 30, y: 880 };
        setPos(np);
        localStorage.setItem(STORAGE_KEYS.overlayPos, JSON.stringify(np));
        setSizeTick((t) => t + 1);
      }
      if (e.key === "=" || e.key === "+") {
        scaleRef.current = Math.min(3.0, scaleRef.current + 0.05);
        wRef.current = 0;
        hRef.current = 0;
        localStorage.setItem(
          STORAGE_KEYS.overlayScale,
          String(scaleRef.current),
        );
        localStorage.setItem(STORAGE_KEYS.overlayW, "0");
        localStorage.setItem(STORAGE_KEYS.overlayH, "0");
        setSizeTick((t) => t + 1);
      }
      if (e.key === "-") {
        scaleRef.current = Math.max(0.3, scaleRef.current - 0.05);
        wRef.current = 0;
        hRef.current = 0;
        localStorage.setItem(
          STORAGE_KEYS.overlayScale,
          String(scaleRef.current),
        );
        localStorage.setItem(STORAGE_KEYS.overlayW, "0");
        localStorage.setItem(STORAGE_KEYS.overlayH, "0");
        setSizeTick((t) => t + 1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── DERIVED RENDER DATA ────────────────────────────────────────────
  const showOffline = !state;
  const p1pts = (state?.pts || [0, 0])[0];
  const p2pts = (state?.pts || [0, 0])[1];
  const setsNeeded = state?.setsNeeded || 1;
  const p1Sets = (state?.sets || [0, 0])[0];
  const p2Sets = (state?.sets || [0, 0])[1];
  const showSets = setsNeeded > 1;
  const brandText = SLOT > 1 ? `NC BLAST · T${SLOT}` : "NC BLAST";

  function renderCombo(combo: OverlayState["p1ActiveCombo"], cls: "p1" | "p2") {
    if (!combo || !combo.blade) return null;
    const parts = [combo.blade, combo.ratchet, combo.bit].filter(
      Boolean,
    ) as string[];
    return (
      <div className="combo-display">
        <div className="combo-label">Combo</div>
        <div className="combo-parts">
          {parts.map((p, i) => (
            <span key={i}>
              <span className={`combo-part ${cls}`}>{p}</span>
              {i < parts.length - 1 && <span className="combo-dot">·</span>}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function renderDots(won: number, needed: number, cls: "p1-dot" | "p2-dot") {
    const dots = [];
    for (let i = 0; i < needed; i++) {
      const active = i < won ? "won" : "empty";
      dots.push(<div key={i} className={`dot ${cls} ${active}`} />);
    }
    return <div className="set-dots">{dots}</div>;
  }

  return (
    <>
      <button
        id="reset-btn"
        onClick={resetOverlay}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          background: "rgba(220,38,38,0.85)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          zIndex: 9999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        ⟳ Reset Overlay
      </button>

      <div id="widget" ref={widgetRef}>
        <div id="scale-wrap" ref={scaleWrapRef}>
          <div className="card" id="main-card" ref={mainCardRef}>
            {/* Drag indicator */}
            <div
              className="drag-indicator"
              id="drag-handle"
              ref={dragHandleRef}
            >
              <span></span>
              <span></span>
              <span></span>
            </div>

            {/* Finish flash overlay (sits on top of card content) */}
            <div
              id="finish-flash"
              className={flashVisible ? `visible ${flashClass}` : ""}
            >
              <div
                className="flash-type"
                id="flash-type-text"
                style={{
                  color: flashColor,
                  textShadow: `0 0 30px ${flashColor}`,
                }}
              >
                {flashLabel}
              </div>
              <div className="flash-winner" id="flash-winner-text">
                {flashWinner}
              </div>
            </div>

            {/* Tournament bar */}
            <div className="tourney-bar">
              <span className="brand" id="brand-text">
                {brandText}
              </span>
              <span className="tourney-center" id="tourney-name">
                {state?.tournamentName || ""}
              </span>
              <span
                className="judge-label"
                id="judge-label"
                style={{ display: state?.judge ? "" : "none" }}
              >
                Current Judge:{" "}
                <strong id="judge-name">{state?.judge || ""}</strong>
              </span>
            </div>

            {/* Offline message (shown when no data) */}
            <div id="offline-msg" className={showOffline ? "visible" : ""}>
              Waiting for match data…
            </div>

            {/* Main scoreboard */}
            <div
              className="scoreboard"
              id="scoreboard"
              style={{ display: showOffline ? "none" : "" }}
            >
              {/* P1 (left) */}
              <div className="player p1" id="p1-block">
                <div className="player-name" id="p1-name">
                  {state?.p1 || "—"}
                </div>
                <div className="player-side" id="p1-side">
                  {state?.p1Side || ""}
                </div>
                {renderCombo(state?.p1ActiveCombo || null, "p1")}
              </div>

              {/* Center */}
              <div className="center-score">
                <div className="pts-row">
                  <span
                    className={`pts-num p1-pts${p1Pop ? " pop" : ""}`}
                    id="p1-pts"
                  >
                    {p1pts}
                  </span>
                  <span className="pts-divider">–</span>
                  <span
                    className={`pts-num p2-pts${p2Pop ? " pop" : ""}`}
                    id="p2-pts"
                  >
                    {p2pts}
                  </span>
                </div>
                <div className="pts-limit" id="pts-limit">
                  {state?.pointLimit ? `First to ${state.pointLimit} pts` : ""}
                </div>
                <div
                  className="sets-row"
                  id="sets-row"
                  style={{ display: showSets ? "" : "none" }}
                >
                  {renderDots(p1Sets, setsNeeded, "p1-dot")}
                  <div className="sets-label" id="set-label">
                    {showSets ? `SET ${state?.curSet || 1}` : "Sets"}
                  </div>
                  {renderDots(p2Sets, setsNeeded, "p2-dot")}
                </div>
              </div>

              {/* P2 (right) */}
              <div className="player p2 right" id="p2-block">
                <div className="player-name" id="p2-name">
                  {state?.p2 || "—"}
                </div>
                <div className="player-side" id="p2-side">
                  {state?.p2Side || ""}
                </div>
                {renderCombo(state?.p2ActiveCombo || null, "p2")}
              </div>
            </div>
          </div>
          {/* .card */}
        </div>
        {/* #scale-wrap */}
        <div className="resize-handle" id="rh-corner" ref={rhCornerRef}></div>
        <div className="resize-handle" id="rh-right" ref={rhRightRef}></div>
        <div className="resize-handle" id="rh-bottom" ref={rhBottomRef}></div>
      </div>
      {/* #widget */}
    </>
  );
}
