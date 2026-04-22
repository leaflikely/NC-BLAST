import { useState } from "react";
import type { LogEntry } from "@ncblast/shared";
import { S } from "../styles";
import { IC } from "./Icons";
import { comboStr } from "../utils";

export interface BottomBarProps {
  log: LogEntry[];
  future: LogEntry[];
  undo: () => void;
  redo: () => void;
  historyOpen: boolean;
  setHistoryOpen: (v: boolean) => void;
  p1: string | null;
  p2: string | null;
  onOpenLib: () => void;
  onClearLog: () => void;
  dark: boolean;
  toggleDark: () => void;
  matchStartIdx: number;
  /** Resolve scorer name to its accent color (defined in MatchScreen). */
  colorOf: (name: string) => string;
  /** Per-player launch-error strike counters [p1,p2]. */
  lerStrikes: [number, number];
}

/**
 * BOTTOM BAR + HISTORY — fixed-bottom action bar with undo/redo/history/lib/dark.
 * Ported verbatim from the source; BottomBar is currently defined but the match
 * screen inlines its own history slide-over.
 */
export function BottomBar(props: BottomBarProps) {
  const {
    log,
    future,
    undo,
    redo,
    historyOpen,
    setHistoryOpen,
    p1: _p1,
    p2: _p2,
    onOpenLib,
    onClearLog,
    dark,
    toggleDark,
    matchStartIdx,
    colorOf,
    lerStrikes,
  } = props;
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <>
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
                  onClick={() => setConfirmClear(true)}
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
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748B",
                }}
              >
                {IC.x}
              </button>
            </div>
          </div>
          {log.length === 0 && (
            <p style={{ color: "#CBD5E1", fontSize: 13, fontStyle: "italic" }}>
              No battles yet
            </p>
          )}

          {/* Clear log confirmation modal */}
          {confirmClear && (
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
                    color: "#64748B",
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
                    onClick={() => setConfirmClear(false)}
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
                      onClearLog();
                      setConfirmClear(false);
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
                    R{log.length - i} · Set {e.set} · Shuf {e.shuffle}
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
                    marginTop: 1,
                  }}
                >
                  vs{" "}
                  {e.scorerIdx === 0
                    ? comboStr(e.p2Combo)
                    : comboStr(e.p1Combo)}
                </div>
                {e.p1Side && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      marginTop: 1,
                    }}
                  >
                    {e.p1Name}: {e.p1Side} Side · {e.p2Name}: {e.p2Side} Side
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 2,
                    fontWeight: 600,
                  }}
                >
                  {e.p1Name} {e.p1Score} – {e.p2Score} {e.p2Name}
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
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: "8px 16px 16px",
          background: "linear-gradient(transparent 0%, var(--bg-solid) 45%)",
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "var(--surface)",
            borderRadius: 20,
            padding: "5px 6px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px var(--border)",
          }}
        >
          <button onClick={() => setHistoryOpen(true)} style={S.current.barBtn}>
            {IC.history}
          </button>
          <div style={S.current.barDiv} />
          <button
            onClick={undo}
            disabled={
              log.length <= matchStartIdx &&
              lerStrikes[0] === 0 &&
              lerStrikes[1] === 0
            }
            style={{
              ...S.current.barBtn,
              opacity:
                log.length > matchStartIdx ||
                lerStrikes[0] === 1 ||
                lerStrikes[1] === 1
                  ? 1
                  : 0.3,
            }}
          >
            {IC.undo} <span style={S.current.barLbl}>Undo</span>
          </button>
          <button
            onClick={redo}
            disabled={!future.length}
            style={{
              ...S.current.barBtn,
              opacity: future.length ? 1 : 0.3,
              color: "#EA580C",
            }}
          >
            <span style={{ ...S.current.barLbl, color: "#EA580C" }}>Redo</span>{" "}
            {IC.redo}
          </button>
          <div style={S.current.barDiv} />
          <button
            onClick={toggleDark}
            style={{ ...S.current.barBtn, fontSize: 16, lineHeight: 1 }}
            title="Toggle dark mode"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <div style={S.current.barDiv} />
          <button onClick={onOpenLib} style={S.current.barBtn}>
            {IC.gear}
          </button>
        </div>
      </div>
    </>
  );
}
