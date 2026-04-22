import type { CSSProperties } from "react";

/**
 * Style factory — rebuilt on each BeyJudgeApp render based on the viewport scale.
 * Mirrors the source `makeS(sc)` exactly. A module-level `S` mutable binding
 * is updated from App.tsx so all components see the current scaled styles.
 */
export interface StyleBag {
  page: CSSProperties;
  logo: CSSProperties;
  title: CSSProperties;
  sub: CSSProperties;
  label: CSSProperties;
  card: CSSProperties;
  row: CSSProperties;
  chip: CSSProperties;
  chipOn: CSSProperties;
  chipBl: CSSProperties;
  chipW: CSSProperties;
  pri: CSSProperties;
  sec: CSSProperties;
  back: CSSProperties;
  tBar: CSSProperties;
  tBtn: CSSProperties;
  bdg: CSSProperties;
  addR: CSSProperties;
  inp: CSSProperties;
  addB: CSSProperties;
  upBtn: CSSProperties;
  hint: CSSProperties;
  chs: CSSProperties;
  ptag: CSSProperties;
  xBtn: CSSProperties;
  empty: CSSProperties;
  pT: CSSProperties;
  pill: CSSProperties;
  barBtn: CSSProperties;
  barLbl: CSSProperties;
  barDiv: CSSProperties;
}

export function makeS(sc: number): StyleBag {
  const p = (n: number) => Math.round(n * sc); // scale pixels
  const f = (n: number) => Math.round(n * sc); // scale font
  const r = (n: number) => Math.round(n * sc); // scale radius
  return {
    page: {
      maxWidth: p(480),
      margin: "0 auto",
      padding: `${p(14)}px ${p(14)}px ${p(80)}px`,
      boxSizing: "border-box",
    },
    logo: {
      fontSize: f(30),
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0,
      letterSpacing: -1,
    },
    title: {
      fontSize: f(22),
      fontWeight: 800,
      color: "var(--text-primary)",
      textAlign: "center",
      margin: `0 0 ${p(4)}px`,
    },
    sub: {
      textAlign: "center",
      color: "var(--text-muted)",
      fontSize: f(13),
      marginBottom: p(20),
      fontWeight: 500,
    },
    label: {
      fontSize: f(14),
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: `0 0 ${p(7)}px`,
    },
    card: {
      background: "var(--surface)",
      borderRadius: r(14),
      padding: `${p(12)}px ${p(12)}px`,
      boxShadow: "0 1px 4px var(--shadow),0 4px 14px var(--shadow)",
      marginBottom: p(12),
    },
    row: { display: "flex", gap: p(8), flexWrap: "wrap" },
    chip: {
      padding: `${p(8)}px ${p(14)}px`,
      borderRadius: r(10),
      border: "2px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: f(13),
      fontWeight: 600,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
    },
    chipOn: { background: "#EA580C", borderColor: "#EA580C", color: "#fff" },
    chipBl: { background: "#1D4ED8", borderColor: "#1D4ED8", color: "#fff" },
    chipW: { flex: 1, textAlign: "center" },
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
      marginBottom: p(8),
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
      cursor: "pointer",
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
      padding: 0,
    },
    tBar: {
      display: "flex",
      borderBottom: "2px solid #F1F5F9",
      marginBottom: p(14),
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
      gap: p(5),
    },
    bdg: {
      display: "inline-block",
      padding: `${p(1)}px ${p(6)}px`,
      borderRadius: r(20),
      color: "#fff",
      fontSize: f(10),
      fontWeight: 700,
    },
    addR: { display: "flex", gap: p(8), marginBottom: p(10) },
    inp: {
      flex: 1,
      padding: `${p(9)}px ${p(12)}px`,
      borderRadius: r(10),
      border: "2px solid var(--border)",
      fontSize: f(13),
      fontFamily: "'Outfit',sans-serif",
      outline: "none",
      background: "var(--input-bg)",
      color: "var(--text-primary)",
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
      flexShrink: 0,
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
      marginBottom: p(6),
    },
    hint: {
      fontSize: f(10),
      color: "var(--text-faint)",
      textAlign: "center",
      margin: `${p(2)}px 0 ${p(10)}px`,
    },
    chs: { display: "flex", flexWrap: "wrap", gap: p(7) },
    ptag: {
      display: "inline-flex",
      alignItems: "center",
      gap: p(5),
      padding: `${p(5)}px ${p(10)}px`,
      borderRadius: r(7),
      border: "1px solid",
      fontSize: f(12),
      fontWeight: 600,
    },
    xBtn: {
      background: "none",
      border: "none",
      color: "#EF4444",
      cursor: "pointer",
      padding: 1,
      display: "flex",
      opacity: 0.5,
    },
    empty: {
      color: "var(--text-disabled)",
      fontSize: f(12),
      fontStyle: "italic",
      padding: `${p(10)}px 0`,
      width: "100%",
      textAlign: "center",
    },
    pT: {
      padding: `${p(7)}px ${p(14)}px`,
      borderRadius: r(8),
      fontSize: f(13),
      fontWeight: 700,
      background: "var(--surface)",
      color: "var(--text-primary)",
    },
    pill: {
      display: "inline-block",
      padding: `${p(3)}px ${p(10)}px`,
      background: "var(--pill-bg)",
      borderRadius: r(6),
      fontSize: f(11),
      fontWeight: 600,
      color: "var(--text-muted)",
      margin: `0 ${p(3)}px ${p(4)}px`,
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
      fontFamily: "'Outfit',sans-serif",
    },
    barLbl: { fontSize: f(13), fontWeight: 600, color: "var(--text-muted)" },
    barDiv: {
      width: 1,
      height: p(24),
      background: "var(--border)",
      margin: `0 ${p(2)}px`,
    },
  };
}

/**
 * Module-level style bag — updated each BeyJudgeApp render from the scale hook,
 * consumed by all screen components. This preserves the original source's
 * pattern exactly.
 */
export const S: { current: StyleBag } = { current: makeS(1) };
