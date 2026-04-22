import { useRef, useState } from "react";
import type { Parts } from "@ncblast/shared";
import { sSave, STORAGE_KEYS as KEYS } from "@ncblast/shared";
import { S } from "../styles";
import { IC } from "./Icons";

export interface LibraryManagerProps {
  parts: Parts;
  setParts: (p: Parts) => void;
  onClose: () => void;
}

type TabKey = "blades" | "ratchets" | "bits";

/**
 * LIBRARY MANAGER — full-screen modal for managing the saved parts library.
 * Supports manual add, file import (JSON / text), per-tab search, and delete.
 */
export function LibraryManager({
  parts,
  setParts,
  onClose,
}: LibraryManagerProps) {
  const [tab, setTab] = useState<TabKey>("blades");
  const [inp, setInp] = useState("");
  const [libSearch, setLibSearch] = useState("");
  const fRef = useRef<HTMLInputElement>(null);
  const TABS: Array<{ k: TabKey; l: string; c: string }> = [
    { k: "blades", l: "Blades", c: "#EA580C" },
    { k: "ratchets", l: "Ratchets", c: "#1D4ED8" },
    { k: "bits", l: "Bits", c: "#15803D" },
  ];
  const ac = TABS.find((t) => t.k === tab)?.c || "#EA580C";
  const add = () => {
    const v = inp.trim();
    if (!v || parts[tab].includes(v)) return;
    const n: Parts = { ...parts, [tab]: [...parts[tab], v].sort() };
    setParts(n);
    sSave(KEYS.parts, n);
    setInp("");
  };
  const del = (cat: TabKey, i: number) => {
    const n: Parts = { ...parts, [cat]: parts[cat].filter((_, j) => j !== i) };
    setParts(n);
    sSave(KEYS.parts, n);
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const txt = String(ev.target?.result || "");
      try {
        const j: unknown = JSON.parse(txt);
        if (
          j &&
          typeof j === "object" &&
          ("blades" in j || "ratchets" in j || "bits" in j)
        ) {
          const jo = j as Partial<Parts>;
          const m: Parts = {
            blades: [
              ...new Set([...parts.blades, ...(jo.blades || [])]),
            ].sort(),
            ratchets: [
              ...new Set([...parts.ratchets, ...(jo.ratchets || [])]),
            ].sort(),
            bits: [...new Set([...parts.bits, ...(jo.bits || [])])].sort(),
          };
          setParts(m);
          sSave(KEYS.parts, m);
          return;
        }
      } catch {
        /* fall through to text parsing */
      }
      const lines = txt
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const np: Parts = {
        blades: [...parts.blades],
        ratchets: [...parts.ratchets],
        bits: [...parts.bits],
      };
      lines.forEach((line) => {
        const [pre, ...rest] = line.split(":");
        if (rest.length) {
          const c = pre.toLowerCase().trim();
          const name = rest.join(":").trim();
          if (c.startsWith("blade") && !np.blades.includes(name))
            np.blades.push(name);
          else if (c.startsWith("ratchet") && !np.ratchets.includes(name))
            np.ratchets.push(name);
          else if (c.startsWith("bit") && !np.bits.includes(name))
            np.bits.push(name);
        } else {
          if (!np[tab].includes(line)) np[tab].push(line);
        }
      });
      np.blades.sort();
      np.ratchets.sort();
      np.bits.sort();
      setParts(np);
      sSave(KEYS.parts, np);
    };
    r.readAsText(f);
    e.target.value = "";
  };
  const total = parts.blades.length + parts.ratchets.length + parts.bits.length;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-solid)",
        zIndex: 200,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          maxWidth: S.current.page.maxWidth,
          margin: "0 auto",
          padding: `20px 16px 40px`,
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#EA580C" }}>{IC.db}</span>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              Parts Library
            </h1>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
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
        <div
          style={{
            background: "#EA580C10",
            border: "1px solid #EA580C30",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#9A3412",
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          <strong>{total} parts</strong> saved in your library.
        </div>
        <div style={S.current.tBar}>
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                setLibSearch("");
              }}
              style={{
                ...S.current.tBtn,
                color: tab === t.k ? t.c : "#94A3B8",
                fontWeight: tab === t.k ? 700 : 500,
                borderBottom:
                  tab === t.k ? `3px solid ${t.c}` : "3px solid transparent",
              }}
            >
              {t.l}{" "}
              <span
                style={{
                  ...S.current.bdg,
                  background: t.c,
                  opacity: tab === t.k ? 1 : 0.3,
                }}
              >
                {parts[t.k].length}
              </span>
            </button>
          ))}
        </div>
        {/* Search bar */}
        <div style={{ marginBottom: 10, position: "relative" }}>
          <input
            style={{
              ...S.current.inp,
              width: "100%",
              paddingLeft: 32,
              borderColor: ac + "40",
            }}
            placeholder={`Search ${tab}...`}
            value={libSearch}
            onChange={(e) => setLibSearch(e.target.value)}
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
            stroke={ac}
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {libSearch && (
            <button
              onClick={() => setLibSearch("")}
              style={{
                position: "absolute",
                right: 10,
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
        <div style={S.current.addR}>
          <input
            style={S.current.inp}
            placeholder={`Add ${tab.slice(0, -1)}...`}
            value={inp}
            onChange={(e) => setInp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button style={{ ...S.current.addB, background: ac }} onClick={add}>
            {IC.plus}
          </button>
        </div>
        <input
          type="file"
          ref={fRef}
          accept=".json,.csv,.txt"
          style={{ display: "none" }}
          onChange={onFile}
        />
        <button style={S.current.upBtn} onClick={() => fRef.current?.click()}>
          {IC.upload} Import Parts File
        </button>
        <p style={S.current.hint}>
          {'JSON: {"blades":[], "ratchets":[], "bits":[]} or text one per line'}
        </p>
        <div style={{ ...S.current.card, marginTop: 8 }}>
          {(() => {
            const filtered = libSearch
              ? parts[tab].filter((p) =>
                  p.toLowerCase().includes(libSearch.toLowerCase()),
                )
              : parts[tab];
            if (filtered.length === 0)
              return (
                <p style={S.current.empty}>
                  {libSearch
                    ? `No matches for "${libSearch}"`
                    : `No ${tab} in library`}
                </p>
              );
            return (
              <div style={S.current.chs}>
                {filtered.map((p, i) => {
                  const realIdx = parts[tab].indexOf(p);
                  return (
                    <span
                      key={i}
                      style={{
                        ...S.current.ptag,
                        borderColor: ac + "40",
                        background: ac + "0C",
                        color: ac,
                      }}
                    >
                      {p}
                      <button
                        style={S.current.xBtn}
                        onClick={() => del(tab, realIdx)}
                      >
                        {IC.trash}
                      </button>
                    </span>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <button style={{ ...S.current.pri, marginTop: 12 }} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
