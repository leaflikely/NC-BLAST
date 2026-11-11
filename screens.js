// NC BLAST screens.js | part 3 of 6 (load order is set in index.html) | last updated: 2026-11-11a | deck-order-redesign (flag 1035, on by default: new Deck order screen from the teammate mock-up for the first order of a set and every reshuffle - one player at a time with taps only, then each player checks and confirms their own order, with a hidden screen between them; top-bar Undo still undoes the last battle; the old Set Deck Order screen stays as the flag-off path) | previous: 2026-11-10b | retired flags 1001-1006, 1012, 1027 (now permanent) | previous:2026-10-22b | split-from-app.js (styles, library manager, event picker, format screen, shuffle and misreport screens, other shared screens; code moved here unchanged)
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
  onJudgeVerified,
  onRankedChange,
  onFastChange
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
    if (onRankedChange) onRankedChange(t.ranked !== false); // false only when org explicitly marked UNRANKED
    if (onFastChange) onFastChange(ff(1031) && t.fast === true); // Fast Blast event (flag 1031)
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
  }, t.slug, t.loginMode === "solo" && " · 📱 Solo mode", t.loginMode === "duo" && " · 💊 Duo mode", !t.loginMode && " · 🔗 Challonge login required"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-block",
        marginLeft: 6,
        padding: "1px 6px",
        borderRadius: 5,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        background: ff(1031) && t.fast === true ? "#EA580C22" : t.ranked !== false ? "#2563EB22" : "#64748B18",
        color: ff(1031) && t.fast === true ? "#EA580C" : t.ranked !== false ? "#2563EB" : "#64748B",
        verticalAlign: "middle"
      }
    }, ff(1031) && t.fast === true ? "Fast Blast" : t.ranked !== false ? "Ranked" : "Unranked"))), !config.tournamentName?.trim() && /*#__PURE__*/React.createElement("p", {
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
  onJudgeVerified,
  onRankedChange,
  onFastChange
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
    body: "Ranked mode is always on — every match is tracked and submitted to the NC BLAST Google Sheets. Connect to a tournament event from the event picker on the main screen. The match format is fixed at first to 4 points in a Best-of-3 set."
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
    body: "After a match ends, tap Send to Sheets to submit the results to the NC BLAST stat tracker. You can also download a CSV of the match at any time. The CSV includes every battle with full combo data, sides, finish types, scores, and timestamps."
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
  }, /*#__PURE__*/React.createElement(CachedEventPicker, {
    config: config,
    setConfig: setConfig,
    challongeSlug: challongeSlug,
    onChallongeImport: onChallongeImport,
    onJudgeVerified: onJudgeVerified,
    onRankedChange: onRankedChange,
    onFastChange: onFastChange
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
      opacity: hasLib && config.tournamentName?.trim() ? 1 : 0.4
    },
    disabled: !hasLib || !config.tournamentName?.trim(),
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
// ── FLAG 1035: deck order redesign (one player at a time, then each player checks their own order) ──
// Ported from a teammate's mock-up (deck-order-redesign.html). Shown instead of the old Set Deck Order
// screen (first order of a set and every reshuffle). Same props and the same onConfirm hand-back as the
// old screen, so everything after it (overlay deck order graphic, deck log, timing marks) is unchanged.
// Ordering is taps only (no dragging). The top-bar Undo is the old one: it undoes the last battle.
// Taking back a place is done by tapping a numbered combo.
const NCBDO_CSS = `
  .ncbdo-wrap {
    --page: #E6EAF1; --bg: #F4F6FA; --card: #FFFFFF; --ink: #0F172A; --ink-2: #334155; --ink-3: #475569; --muted: #5B6578;
    --line: #E3E8F0; --line-2: #D5DCE7; --track: #E7EBF2; --night: #0F172A; --edge: #94A3B8; --dash: #64748B; --hover-bg: #EEF1F6;
    --ready-bg: #DCFCE7; --ready-ink: #166534; --low-bg: #FEF3C7; --low-ink: #92400E; --out-bg: #FEE2E2; --out-ink: #991B1B; --danger: #B91C1C;
    --font: 'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    position: fixed; inset: 0; z-index: 20; overflow: hidden; background: var(--page); color: var(--ink); font-family: var(--font);
    -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; overscroll-behavior: none;
  }
  body.dark .ncbdo-wrap {
    --page: #0B1120; --bg: #0F172A; --card: #1E293B; --ink: #F1F5F9; --ink-2: #CBD5E1; --ink-3: #B4C0D3; --muted: #94A3B8;
    --line: #2A3650; --line-2: #3A4762; --track: #0B1120; --night: #020617; --edge: #475569; --dash: #94A3B8; --hover-bg: #334155;
    --ready-bg: rgba(34, 197, 94, 0.18); --ready-ink: #86EFAC; --low-bg: rgba(245, 158, 11, 0.2); --low-ink: #FCD34D; --out-bg: rgba(239, 68, 68, 0.22); --out-ink: #FCA5A5; --danger: #F87171;
  }

  .ncbdo button { margin: 0; font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; -webkit-appearance: none; appearance: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .ncbdo button:disabled { cursor: default; }
  .ncbdo button:active:not(:disabled) { transform: scale(0.985); filter: brightness(0.97); }
  .ncbdo h1, .ncbdo h2, .ncbdo p { margin: 0; }
  .ncbdo svg { display: block; flex: none; }
  .ncbdo :focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
  .ncbdo [hidden] { display: none !important; }
  .ncbdo .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .ncbdo {
    --pc: #2563EB; --pc-ink: #1D4ED8; --tint: #EEF4FF;
    --bar-h: 52px; --gap: 10px; --row-h: 88px; --row-f: 22px; --badge: 56px; --ask-f: 24px;
    --ck-h: 84px; --name-f: 28px; --dock-h: 62px; --dock-pad: 12px;
    position: relative; height: 100%; max-width: 480px; margin: 0 auto;
    padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
    display: flex; flex-direction: column; overflow: hidden; background: var(--bg);
  }
  @media (max-height: 699px) {
  .ncbdo { --bar-h: 48px; --gap: 8px; --row-h: 76px; --row-f: 20px; --badge: 50px; --ask-f: 22px; --ck-h: 72px; --name-f: 24px; --dock-h: 58px; --dock-pad: 10px; }

  }
  @media (max-height: 619px) {
  .ncbdo { --row-h: 64px; --row-f: 19px; --badge: 44px; --ask-f: 20px; --ck-h: 60px; --name-f: 20px; --dock-h: 54px; --dock-pad: 8px; }

  }
  .ncbdo[data-stage="cover"] { background: var(--night); }
  .ncbdo .top { flex: none; }
  .ncbdo .main { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .ncbdo .bar { height: calc(var(--bar-h) + env(safe-area-inset-top)); padding: env(safe-area-inset-top) 6px 0 2px; display: flex; align-items: center; gap: 4px; background: var(--card); border-bottom: 1px solid var(--line); }
  .ncbdo .icon-btn { width: 44px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: 10px; background: transparent; color: var(--ink-2); }
  .ncbdo .titles { flex: 1 1 auto; min-width: 0; }
  .ncbdo .bar-title { font-size: 18px; line-height: 22px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdo .bar-sub { font-size: 12px; line-height: 15px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdo .pill { flex: none; margin-right: 4px; padding: 4px 10px; border-radius: 999px; background: var(--track); color: var(--ink-2); font-size: 13px; font-weight: 700; white-space: nowrap; }
  .ncbdo .timer { flex: none; display: flex; align-items: center; gap: 5px; margin-right: 4px; padding: 5px 10px; border-radius: 999px; background: var(--ready-bg); color: var(--ready-ink); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ncbdo .timer.low { background: var(--low-bg); color: var(--low-ink); }
  .ncbdo .timer.out { background: var(--out-bg); color: var(--out-ink); }
  .ncbdo .bar-btn { height: 40px; flex: none; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--card); color: var(--ink); font-size: 15px; font-weight: 600; }
  .ncbdo .bar-btn:disabled { color: var(--edge); }
  .ncbdo .score { flex: none; margin: 8px 12px 0; padding: 7px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--ink-3); white-space: nowrap; }
  .ncbdo .score span { display: flex; align-items: baseline; gap: 5px; }
  .ncbdo .score b { font-size: 16px; font-weight: 800; }
  .ncbdo .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 0 12px 12px; }
  .ncbdo .tabs { display: grid; grid-template-columns: minmax(0, auto) minmax(0, auto); gap: 4px; margin-top: 8px; padding: 4px; border-radius: 14px; background: var(--track); }
  .ncbdo .tab { min-width: 0; height: 40px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; border: none; border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 15px; font-weight: 700; }
  .ncbdo .tab.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14); }
  .ncbdo .tab-dot { width: 10px; height: 10px; flex: none; border-radius: 50%; }
  .ncbdo .tab-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdo .tab-count { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--line-2); color: var(--ink-2); font-size: 12px; font-weight: 700; }
  .ncbdo .tab.on .tab-count { background: var(--track); }
  .ncbdo .tab .tab-count.ready { background: var(--ready-bg); color: var(--ready-ink); }
  .ncbdo .banner { margin-top: 10px; padding: 12px 16px; border-radius: 16px; background: var(--tint); border: 2px solid var(--pc); }
  .ncbdo .who { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 16px; font-weight: 800; color: var(--pc-ink); }
  .ncbdo .who span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ncbdo .dot { width: 12px; height: 12px; flex: none; border-radius: 50%; background: var(--pc); }
  .ncbdo .ask { margin-top: 4px; font-size: var(--ask-f); line-height: 1.2; font-weight: 800; }
  .ncbdo .ask:focus, .ncbdo .ck-name:focus, .ncbdo .cover-title:focus, .ncbdo .card-title:focus { outline: none; }
  .ncbdo .ask-sub { margin-top: 2px; font-size: 15px; color: var(--ink-2); }
  .ncbdo .beys { display: flex; flex-direction: column; gap: var(--gap); margin-top: 12px; }
  .ncbdo .bey { min-height: var(--row-h); display: flex; align-items: center; gap: 12px; padding: 6px 14px 6px 18px; border-radius: 16px; border: 2px solid var(--edge); background: var(--card); color: var(--ink); text-align: left; }
  .ncbdo .bey-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ncbdo .bey-name { font-size: var(--row-f); line-height: 1.2; font-weight: 700; overflow-wrap: anywhere; }
  .ncbdo .bey-sub { font-size: 15px; font-weight: 500; color: var(--ink-2); }
  .ncbdo .badge { width: var(--badge); height: var(--badge); flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px dashed var(--dash); background: var(--card); color: var(--ink-2); font-size: 16px; font-weight: 700; }
  .ncbdo .badge.on { border: none; background: var(--pc); color: #FFFFFF; font-size: 19px; font-weight: 800; }
  .ncbdo .ck-banner { margin-top: 10px; padding: 14px 16px; border-radius: 16px; background: var(--tint); border: 2px solid var(--pc); }
  .ncbdo .ck-who { display: flex; align-items: center; gap: 10px; }
  .ncbdo .ck-who .dot { width: 14px; height: 14px; }
  .ncbdo .ck-name { min-width: 0; font-size: var(--name-f); line-height: 1.15; font-weight: 800; overflow-wrap: anywhere; }
  .ncbdo .ck-q { margin-top: 4px; font-size: 16px; color: var(--ink-2); }
  .ncbdo .ck-card { min-height: var(--ck-h); display: flex; align-items: center; gap: 14px; padding: 6px 16px 6px 12px; border-radius: 16px; border: 2px solid var(--edge); background: var(--card); }
  .ncbdo .fixrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 15px; color: var(--ink-2); }
  .ncbdo .outline-btn { height: 46px; flex: none; padding: 0 18px; border-radius: 12px; border: 1.5px solid var(--pc-ink); background: var(--card); color: var(--pc-ink); font-size: 15px; font-weight: 700; }
  .ncbdo .cover { padding: min(64px, 8vh) 8px 0; display: flex; flex-direction: column; align-items: center; text-align: center; color: #FFFFFF; }
  .ncbdo .cover-eye { width: 76px; height: 76px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #1E293B; color: #E2E8F0; }
  .ncbdo .cover-title { margin-top: 22px; max-width: 100%; font-size: 30px; line-height: 1.2; font-weight: 800; overflow-wrap: anywhere; }
  .ncbdo .cover-text { margin-top: 10px; font-size: 18px; line-height: 1.4; color: #E2E8F0; }
  .ncbdo .cover-done { margin-top: 24px; max-width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: #1E293B; color: #BBF7D0; font-size: 15px; font-weight: 600; }
  .ncbdo .cover-done span { min-width: 0; overflow-wrap: anywhere; }
  .ncbdo[data-stage="cover"] :focus-visible { outline-color: #FFFFFF; }
  .ncbdo .card { margin-top: min(48px, 6vh); padding: 28px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; border-radius: 16px; background: var(--card); border: 1px solid var(--line); }
  .ncbdo .ok-ring { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #DCFCE7; color: #15803D; }
  .ncbdo .card-title { margin-top: 16px; font-size: 22px; font-weight: 700; }
  .ncbdo .card-text { margin-top: 6px; font-size: 15px; line-height: 1.45; color: var(--ink-2); }
  .ncbdo .card-btn { margin-top: 18px; width: 100%; height: 48px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card); color: var(--ink); font-size: 16px; font-weight: 700; }
  .ncbdo .card-note { margin-top: 8px; font-size: 13px; line-height: 1.4; color: var(--ink-3); }
  .ncbdo .toast-slot { flex: none; position: relative; height: 0; }
  .ncbdo .notice { position: absolute; left: 0; right: 0; bottom: 0; margin: 0 12px 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; border-radius: 14px; background: var(--night); color: #FFFFFF; font-size: 15px; line-height: 1.3; font-weight: 600; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25); }
  .ncbdo .notice svg { color: #4ADE80; }
  .ncbdo .notice.info svg { color: #93C5FD; }
  .ncbdo[data-stage="cover"] .notice { background: #1E293B; }
  .ncbdo .dock { flex: none; display: flex; flex-direction: column; gap: 10px; padding: var(--dock-pad) 12px calc(var(--dock-pad) + env(safe-area-inset-bottom)); background: var(--card); border-top: 1px solid var(--line); }
  .ncbdo[data-stage="cover"] .dock { background: var(--night); border-top-color: var(--night); }
  .ncbdo .dock-btn { width: 100%; min-height: var(--dock-h); display: flex; align-items: center; justify-content: center; gap: 10px; padding: 6px 18px; border: none; border-radius: 14px; background: var(--night); color: #FFFFFF; font-size: 19px; line-height: 1.2; font-weight: 700; text-align: left; }
  .ncbdo .dock-btn span { min-width: 0; overflow-wrap: anywhere; }
  .ncbdo .dock-btn.confirm { justify-content: space-between; background: var(--pc); }
  .ncbdo .confirm-text { display: flex; flex-direction: column; min-width: 0; }
  .ncbdo .confirm-title { display: flex; max-width: 100%; white-space: pre; }
  .ncbdo .confirm-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .ncbdo .confirm-verb { flex: none; }
  .ncbdo .confirm-sub { font-size: 13px; line-height: 1.35; font-weight: 500; }
  .ncbdo .menu-backdrop { position: fixed; inset: 0; z-index: 5; cursor: pointer; }
  .ncbdo .menu { position: absolute; top: calc(env(safe-area-inset-top) + var(--bar-h) - 2px); right: 8px; z-index: 6; width: 264px; max-width: calc(100% - 16px); padding: 6px; display: flex; flex-direction: column; border-radius: 14px; background: var(--card); border: 1px solid var(--line); box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18); }
  .ncbdo .menu-item { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 6px 12px; border: none; border-radius: 10px; background: transparent; color: var(--ink); font-size: 15px; line-height: 1.25; font-weight: 600; text-align: left; }
  .ncbdo .menu-item.danger { color: var(--danger); }
  .ncbdo .mi-text { flex: 1 1 auto; min-width: 0; }
  .ncbdo .switch { position: relative; width: 36px; height: 22px; flex: none; border-radius: 999px; background: #94A3B8; }
  .ncbdo .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF; }
  .ncbdo .switch.on { background: #15803D; }
  .ncbdo .switch.on::after { left: 16px; }
  @media (hover: hover) {
  .ncbdo .menu-item:hover, .ncbdo .icon-btn:hover { background: var(--hover-bg); }

  }
  @media (max-width: 379px) {
  .ncbdo .timer svg { display: none; }

  }
  @media (max-width: 359px) {
  .ncbdo .bar { gap: 2px; }
  .ncbdo .bar-title { font-size: 16px; line-height: 20px; }
  .ncbdo .bar-btn .t { display: none; }
  .ncbdo .bar-btn { padding: 0 10px; }
  .ncbdo .tab { gap: 5px; padding: 0 6px; font-size: 14px; }

  }
  @media (prefers-reduced-motion: no-preference) {
  .ncbdo button { transition: transform 0.06s ease-out; }
  .ncbdo .notice { animation: ncbdoRise 0.18s ease-out both; }
  .ncbdo .dock-btn { animation: ncbdoArm var(--arm, 600ms) ease-out both; }

  }
  @keyframes ncbdoRise {
 from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } 
  }
  @keyframes ncbdoArm {
 from { opacity: 0.45; } to { opacity: 1; } 
  }
`;
function ncbdoEnsureCss() {
  try {
    if (document.getElementById("ncbdo-css")) return;
    const st = document.createElement("style");
    st.id = "ncbdo-css";
    st.textContent = NCBDO_CSS;
    document.head.appendChild(st);
  } catch (e) {}
}
const NCBDO_COLORS = {
  light: [
    { color: "#2563EB", ink: "#1D4ED8", tint: "#EEF4FF" },
    { color: "#DC2626", ink: "#B91C1C", tint: "#FEF2F2" }
  ],
  dark: [
    { color: "#3B82F6", ink: "#93C5FD", tint: "rgba(59, 130, 246, 0.16)" },
    { color: "#EF4444", ink: "#FCA5A5", tint: "rgba(239, 68, 68, 0.16)" }
  ]
};
const NCBDO_ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  dots: '<path d="M12 5h.01"/><path d="M12 12h.01"/><path d="M12 19h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
};
function ncbdoIcon(name, size, stroke) {
  return React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true",
    dangerouslySetInnerHTML: { __html: NCBDO_ICONS[name] }
  });
}
const NCBDO_CFG = {
  timerSeconds: 60,   // reshuffle countdown, same as the old screen (shown only when showTimer)
  tapGuardMs: 300,    // a second tap on the same spot inside this window is ignored
  stageGuardMs: 600,  // a new screen ignores taps for this long, so a double tap cannot carry over
  beatMs: 600,        // how long 1st, 2nd and 3rd stay on screen before it moves on
  noticeMs: 3200,
  hideKey: "ncblast.deckHideBetween" // same device setting as the new deck builder: blank screen between players
};
const NCBDO_ORD = ["1st", "2nd", "3rd"];
function ncbdoReadHide() {
  try { return localStorage.getItem(NCBDO_CFG.hideKey) !== "0"; } catch (e) { return true; }
}

function DeckOrderV2(props) {
  const h = React.createElement;
  const { p1, p2, d1, d2, setD1, setD2, sets, pts, curSet, shuf, config, swapped, showTimer } = props;
  ncbdoEnsureCss();
  const dark = !!props.dark;
  const pal = NCBDO_COLORS[dark ? "dark" : "light"];
  // Index 0 is always player 1 (blue), 1 is player 2 (red). Tabs follow the table sides, like the old top/bottom.
  const P = [p1, p2].map((n, i) => Object.assign({ name: String(n || "Player " + (i + 1)) }, pal[i]));
  const decks = [d1 || [], d2 || []];
  const tabOrder = swapped ? [1, 0] : [0, 1];
  const other = i => (i === 0 ? 1 : 0);

  /* ---------- State ----------
     stage : 'pick'  the judge enters the orders (tabs switch player)
             'check' one player looks at their own order and confirms it
             'cover' both orders hidden while the phone goes to the other player
     order : per player, the indexes of their combos in play order
     ck    : the check in progress, { order: [first, second], i }
     fixing: an order is being changed from a check screen (no tabs, Back cancels) */
  const [S, setS] = useState(() => ({
    who: tabOrder[0],
    // Coming back from an undo: the previous order is already in d1/d2, so both start as 1st, 2nd, 3rd (same as the old screen).
    order: props.presetOrder ? [[0, 1, 2], [0, 1, 2]] : [[], []],
    stage: "pick", ck: null, fixing: false, fixSnap: null
  }));
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hide, setHide] = useState(ncbdoReadHide);
  const [notice, setNotice] = useState(null);
  const noticeId = useRef(0);
  const SRef = useRef(S);
  SRef.current = S;
  const bothSet = st => st.order[0].length === 3 && st.order[1].length === 3;
  const stageKey = S.stage + (S.ck ? ":" + S.ck.i : "") + (S.fixing ? ":fix" : "");
  const stageRef = useRef({ key: "", at: performance.now() });
  if (stageRef.current.key !== stageKey) stageRef.current = { key: stageKey, at: performance.now() };

  function notify(text, kind) {
    const id = ++noticeId.current;
    setNotice({ text, kind: kind || "ok", id });
    setTimeout(() => setNotice(n => (n && n.id === id ? null : n)), NCBDO_CFG.noticeMs);
  }
  function clearNotice() { noticeId.current++; setNotice(null); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported (iPhone) */ } }

  /* ---------- Actions ---------- */
  // Tap a combo. An open one takes the next place; after two, the last one fills in by itself.
  // A numbered one is taken back, along with any place after it.
  function tapBey(ci) {
    if (busy || S.stage !== "pick") return;
    const pi = S.who, at = S.order[pi].indexOf(ci);
    let mine = S.order[pi].slice();
    if (at >= 0) {
      mine = mine.slice(0, mine.length === 3 ? Math.min(at, 1) : at);
    } else {
      mine.push(ci);
      if (mine.length === 2) mine.push([0, 1, 2].find(i => !mine.includes(i)));
    }
    const order = S.order.slice();
    order[pi] = mine;
    setS(Object.assign({}, S, { order }));
    clearNotice();
    buzz(8);
    // A short beat shows 1st, 2nd and 3rd before the screen moves on. Taps are ignored during it.
    if (mine.length === 3) { setBusy(true); setTimeout(advance, NCBDO_CFG.beatMs); }
  }
  // After the beat: the other player's turn, or the check once both orders are set.
  // The check starts with the player whose order is already on screen.
  function advance() {
    setBusy(false);
    const st = SRef.current, pi = st.who, o = other(pi);
    if (st.stage !== "pick" || st.order[pi].length !== 3) return;
    if (st.fixing) setS(Object.assign({}, st, { stage: "check", fixing: false, fixSnap: null }));
    else if (st.order[o].length === 3) setS(Object.assign({}, st, { stage: "check", ck: { order: [pi, o], i: 0 } }));
    else { setS(Object.assign({}, st, { who: o })); notify(`${P[pi].name}'s order is set. Now ${P[o].name}'s.`, "ok"); }
  }
  function switchPlayer(i) {
    if (busy || S.stage !== "pick" || S.fixing || S.who === i) return;
    setS(Object.assign({}, S, { who: i }));
    clearNotice();
  }
  function startCheck() {
    if (busy || S.stage !== "pick" || S.fixing || !bothSet(S)) return;
    setS(Object.assign({}, S, { stage: "check", ck: { order: [S.who, other(S.who)], i: 0 } }));
    clearNotice();
  }
  // Both players confirmed: same steps as the old Start Match button.
  function finish() {
    const nd = [0, 1].map(pi => S.order[pi].map(ci => decks[pi][ci]));
    setD1(nd[0]);
    setD2(nd[1]);
    props.onConfirm({ p1Deck: nd[0], p2Deck: nd[1] });
  }
  // The player on screen confirms their own order. The second confirm starts the match.
  function confirmOrder() {
    if (S.stage !== "check") return;
    const ck = S.ck;
    buzz(15);
    setMenu(false);
    if (ck.i === 1) { finish(); return; }
    if (hide) setS(Object.assign({}, S, { stage: "cover" }));
    else setS(Object.assign({}, S, { ck: { order: ck.order, i: 1 } }));
  }
  function showOrder() {
    if (S.stage !== "cover") return;
    setMenu(false);
    setS(Object.assign({}, S, { stage: "check", ck: { order: S.ck.order, i: 1 } }));
  }
  // From a check: change that player's order. Only their screen opens, with no tabs,
  // and it returns to the same check when the order is complete again.
  function changeOrder() {
    if (S.stage !== "check") return;
    setS(Object.assign({}, S, { who: S.ck.order[S.ck.i], stage: "pick", fixing: true, fixSnap: S.order }));
    clearNotice();
  }
  // Back walks the check in reverse, through the hidden screen, so an order never shows by surprise.
  function back() {
    if (busy) return;
    const ck = S.ck;
    setMenu(false);
    if (S.stage === "pick") {
      if (!S.fixing) return;
      setS(Object.assign({}, S, { order: S.fixSnap, fixSnap: null, fixing: false, stage: "check" })); // Back cancels the change
      return;
    }
    if (S.stage === "cover") setS(Object.assign({}, S, { stage: "check", ck: { order: ck.order, i: 0 } }));
    else if (ck.i === 1 && hide) setS(Object.assign({}, S, { stage: "cover", ck: { order: ck.order, i: 0 } }));
    else if (ck.i === 1) setS(Object.assign({}, S, { ck: { order: ck.order, i: 0 } }));
    else setS(Object.assign({}, S, { stage: "pick", who: ck.order[0], ck: null }));
  }
  function startOver() {
    setBusy(false);
    setMenu(false);
    setS({ who: tabOrder[0], order: [[], []], stage: "pick", ck: null, fixing: false, fixSnap: null });
    notify("Both orders cleared.", "info");
  }
  function toggleHide() {
    const v = !hide;
    setHide(v);
    try { localStorage.setItem(NCBDO_CFG.hideKey, v ? "1" : "0"); } catch (e) {}
  }

  /* ---------- Taps ---------- */
  // These wait a moment after a new screen appears, so a double tap on one screen cannot
  // confirm, reveal or change anything on the next.
  const WAITS = { back: 1, bey: 1, "start-check": 1, confirm: 1, show: 1, change: 1 };
  const tapRef = useRef({ t: 0, x: 0, y: 0 });
  function tap(action, fn) {
    return e => {
      const now = performance.now(), byKeyboard = e.detail === 0;
      if (!byKeyboard) {
        const L = tapRef.current;
        const again = now - L.t < NCBDO_CFG.tapGuardMs && Math.hypot(e.clientX - L.x, e.clientY - L.y) < 40;
        L.t = now; L.x = e.clientX; L.y = e.clientY;
        if (again) return;
      }
      if (WAITS[action] && now - stageRef.current.at < NCBDO_CFG.stageGuardMs) return;
      fn();
    };
  }

  /* ---------- Timer (reshuffles only, like the old screen) ---------- */
  const [timerEnd] = useState(() => Date.now() + NCBDO_CFG.timerSeconds * 1000);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!showTimer) return undefined;
    const t = setInterval(() => setTick(x => x + 1), 500);
    return () => clearInterval(t);
  }, [showTimer]);
  const left = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));

  /* ---------- Menu keys ---------- */
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = e => {
      if (e.key === "Escape") setMenu(false);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = menuRef.current ? [...menuRef.current.querySelectorAll("button")] : [];
        const at = items.indexOf(document.activeElement);
        const next = items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1) + items.length) % items.length];
        if (next) { e.preventDefault(); next.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const bodyRef = useRef(null);
  React.useLayoutEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [stageKey]);

  /* ---------- View ---------- */
  const ck = S.ck;
  const who = S.stage === "check" ? ck.order[ck.i] : (S.stage === "cover" ? ck.order[1] : S.who); // whose colours are on screen
  const pl = P[who];
  const subOf = c => [c && c.ratchet, c && c.bit].filter(Boolean).join(" · ");
  const paint = c => {
    const col = c && c.blade && typeof BLADE_COLORS === "object" ? BLADE_COLORS[c.blade] : "";
    return col ? { borderColor: col, background: col + "18" } : undefined;
  };

  function barEl() {
    const entering = S.stage === "pick" && !S.fixing;
    let backLabel = "Back, both orders stay hidden";
    if (S.stage === "pick") backLabel = "Cancel the change and go back to the check";
    else if (S.stage === "check" && ck.i === 0) backLabel = "Back to entering the orders";
    const t = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    return [
      // The first screen has no Back (the old screen had none either): leaving it is Undo or Start.
      entering ? h("span", { key: "sp", style: { width: 10, flex: "none" } }) :
        h("button", { key: "b", className: "icon-btn", type: "button", "aria-label": backLabel, onClick: tap("back", back) }, ncbdoIcon("back", 22, 2.2)),
      h("div", { key: "t", className: "titles" },
        h("h1", { className: "bar-title" }, "Deck order"),
        h("div", { className: "bar-sub" }, `Set ${curSet} · Shuffle ${shuf}`)),
      S.stage === "check" ? h("span", { key: "p", className: "pill" }, `${ck.i + 1} of 2`) : null,
      showTimer ? h("span", { key: "tm", className: "timer" + (left === 0 ? " out" : (left <= 10 ? " low" : "")), "aria-label": left === 0 ? "Time's up" : `${left} seconds left` },
        ncbdoIcon("clock", 15, 2.4), left === 0 ? "Time's up" : t) : null,
      entering ? (props.canUndo ? h("button", { key: "u", className: "bar-btn", type: "button", "aria-label": "Undo last battle", onClick: tap("undo", () => props.onUndo()) }, ncbdoIcon("undo", 18, 2), h("span", { className: "t" }, "Undo")) : null)
        : (S.stage === "pick" ? h("button", { key: "c", className: "bar-btn", type: "button", onClick: tap("back", back) }, "Cancel") : null),
      h("button", { key: "m", className: "icon-btn", type: "button", "aria-label": "More options", "aria-haspopup": "menu", "aria-expanded": menu, onClick: tap("menu", () => setMenu(!menu)) }, ncbdoIcon("dots", 22, 2.6))
    ];
  }
  function scoreEl() {
    const bo3 = config && config.bo > 1;
    const target = config && config.pts > 0 ? config.pts : "∞";
    const pair = v => [h("b", { key: "a", style: { color: P[tabOrder[0]].ink } }, v[tabOrder[0]]), ":", h("b", { key: "b", style: { color: P[tabOrder[1]].ink } }, v[tabOrder[1]])];
    return [
      bo3 ? h("span", { key: "s" }, "Sets ", pair(sets || [0, 0])) : null,
      h("span", { key: "p" }, "Points ", pair(pts || [0, 0])),
      h("span", { key: "f" }, "First to ", target)
    ];
  }
  function pickBody() {
    const pi = S.who, mine = S.order[pi], n = mine.length, next = NCBDO_ORD[n] || "";
    const out = [];
    if (!S.fixing) {
      out.push(h("div", { key: "tabs", className: "tabs", role: "group", "aria-label": "Whose order" }, tabOrder.map(i => {
        const k = S.order[i].length, on = i === pi;
        return h("button", { key: i, className: "tab" + (on ? " on" : ""), type: "button", "aria-pressed": on, onClick: tap("tab", () => switchPlayer(i)) },
          h("span", { className: "tab-dot", style: { background: P[i].color } }),
          h("span", { className: "tab-name" }, P[i].name),
          h("span", { className: "tab-count" + (k === 3 ? " ready" : "") }, k === 3 ? "Ready" : k + "/3"));
      })));
    }
    const ask = n === 0 ? "Tap the bey that goes 1st" : (n === 1 ? "Now tap the 2nd" : "Order set");
    const sub = n === 0 ? "It plays the first battle." : (n === 1 ? "The last one fills in by itself." : "Tap a numbered bey to take it back.");
    out.push(h("div", { key: "ban", className: "banner" },
      h("div", { className: "who" }, h("span", { className: "dot" }), h("span", null, P[pi].name)),
      h("h2", { className: "ask" }, ask),
      h("p", { className: "ask-sub" }, sub)));
    out.push(h("div", { key: "beys", className: "beys" }, decks[pi].map((c, ci) => {
      const at = mine.indexOf(ci), picked = at >= 0;
      return h("button", { key: ci, className: "bey", type: "button", style: paint(c), onClick: tap("bey", () => tapBey(ci)) },
        h("span", { className: "bey-text" }, h("span", { className: "bey-name" }, c && c.blade || "?"), h("span", { className: "bey-sub" }, subOf(c))),
        picked ? h("span", { className: "badge on" }, NCBDO_ORD[at]) : h("span", { className: "badge" }, next + "?"),
        picked ? h("span", { className: "sr-only" }, ". Tap to take it back") : null);
    })));
    return out;
  }
  // One player's combos in play order, for that player to check. Nothing of the other player is here.
  function checkBody(pi) {
    return [
      h("div", { key: "ban", className: "ck-banner" },
        h("div", { className: "ck-who" }, h("span", { className: "dot" }), h("h2", { className: "ck-name" }, P[pi].name)),
        h("p", { className: "ck-q" }, "Is this your order?")),
      h("div", { key: "beys", className: "beys" }, S.order[pi].map((ci, k) => {
        const c = decks[pi][ci];
        return h("div", { key: k, className: "ck-card", style: paint(c) },
          h("span", { className: "badge on" }, NCBDO_ORD[k]),
          h("span", { className: "bey-text" }, h("span", { className: "bey-name" }, c && c.blade || "?"), h("span", { className: "bey-sub" }, subOf(c))));
      })),
      h("div", { key: "fix", className: "fixrow" }, h("span", null, "Something wrong?"),
        h("button", { className: "outline-btn", type: "button", onClick: tap("change", changeOrder) }, "Change order"))
    ];
  }
  function coverBody() {
    return h("div", { className: "cover" },
      h("span", { className: "cover-eye" }, ncbdoIcon("eyeOff", 36, 2)),
      h("h2", { className: "cover-title" }, `Next: ${P[ck.order[1]].name}`),
      h("p", { className: "cover-text" }, "Both orders are hidden. Turn the screen to them, then tap the button."),
      h("div", { className: "cover-done" }, ncbdoIcon("check", 16, 2.8), h("span", null, `${P[ck.order[0]].name} confirmed`)));
  }
  function dockEl() {
    if (S.stage === "pick") {
      return !busy && !S.fixing && bothSet(S) ? h("button", { key: "sc" + stageKey, className: "dock-btn", type: "button", onClick: tap("start-check", startCheck) }, "Check with the players") : null;
    }
    if (S.stage === "check") {
      const pi = ck.order[ck.i], o = other(pi);
      const sub = ck.i === 1 ? "Both players checked. Starts the match" : (hide ? `Hides this order, then ${P[o].name} checks` : `Next: ${P[o].name} checks`);
      return h("button", { key: "c" + stageKey, className: "dock-btn confirm", type: "button", onClick: tap("confirm", confirmOrder) },
        h("span", { className: "confirm-text" },
          h("span", { className: "confirm-title" }, h("span", { className: "confirm-name" }, P[pi].name), h("span", { className: "confirm-verb" }, " confirms")),
          h("span", { className: "confirm-sub" }, sub)),
        ncbdoIcon("check", 24, 2.6));
    }
    const nx = ck.order[1];
    return h("button", { key: "s" + stageKey, className: "dock-btn", type: "button", style: { background: P[nx].color }, onClick: tap("show", showOrder) },
      ncbdoIcon("eye", 22, 2.2), h("span", null, `Show ${P[nx].name}'s order`));
  }
  function menuItems() {
    const items = [
      h("button", { key: "so", className: "menu-item danger", type: "button", role: "menuitem", onClick: tap("start-over", startOver) }, ncbdoIcon("restart", 18, 2), h("span", { className: "mi-text" }, "Start over")),
      h("button", { key: "hd", className: "menu-item", type: "button", role: "menuitemcheckbox", "aria-checked": hide, onClick: tap("toggle-hide", toggleHide) },
        ncbdoIcon("eyeOff", 18, 2), h("span", { className: "mi-text" }, "Hide orders between players"), h("span", { className: "switch" + (hide ? " on" : ""), "aria-hidden": "true" }))
    ];
    if (props.toggleDark) items.push(h("button", { key: "dk", className: "menu-item", type: "button", role: "menuitemcheckbox", "aria-checked": dark, onClick: tap("dark", () => props.toggleDark()) },
      ncbdoIcon("moon", 18, 2), h("span", { className: "mi-text" }, "Dark mode"), h("span", { className: "switch" + (dark ? " on" : ""), "aria-hidden": "true" })));
    items.push(h("button", { key: "rp", className: "menu-item", type: "button", role: "menuitem", onClick: tap("report", () => { setMenu(false); if (window.__ncbOpenBugReport) window.__ncbOpenBugReport(); }) }, ncbdoIcon("flag", 18, 2), h("span", { className: "mi-text" }, "Report a problem")));
    return items;
  }

  const body = S.stage === "check" ? checkBody(who) : (S.stage === "cover" ? coverBody() : pickBody());
  const dock = dockEl();
  let say = "";
  if (S.stage === "check") say = `${pl.name}, is this your order?`;
  else if (S.stage === "cover") say = `Both orders are hidden. Next: ${pl.name}.`;
  else say = `${pl.name}: ${S.order[S.who].length === 3 ? "order set" : "tap the bey that goes " + NCBDO_ORD[S.order[S.who].length]}`;
  const appStyle = { "--pc": pl.color, "--pc-ink": pl.ink, "--tint": pl.tint, "--arm": NCBDO_CFG.stageGuardMs + "ms" };
  return h("div", { className: "ncbdo-wrap" },
    typeof BugReportInlineButton === "function" ? h(BugReportInlineButton, { hidden: true }) : null, // hides the floating ? (Report a problem is in the menu)
    h("div", { className: "ncbdo", "data-stage": S.stage, style: appStyle },
      h("header", { className: "top" },
        h("div", { className: "bar" }, barEl()),
        menu ? h("div", { className: "menu-backdrop", onClick: tap("menu-close", () => setMenu(false)) }) : null,
        menu ? h("div", { className: "menu", ref: menuRef, role: "menu", "aria-label": "More options" }, menuItems()) : null),
      h("main", { className: "main" },
        h("div", { className: "score" }, scoreEl()),
        h("div", { className: "body", ref: bodyRef }, body),
        h("div", { className: "toast-slot" },
          notice ? h("div", { key: notice.id, className: "notice" + (notice.kind === "info" ? " info" : ""), role: "status" },
            ncbdoIcon(notice.kind === "info" ? "info" : "check", 18, notice.kind === "info" ? 2.2 : 2.8), h("span", null, notice.text)) : null)),
      dock ? h("footer", { className: "dock" }, dock) : null,
      h("div", { className: "sr-only", "aria-live": "polite" }, say)));
}


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
    const topNew = topOrder.map(i => topDeck[i]);
    const botNew = botOrder.map(i => botDeck[i]);
    topSet(topNew);
    botSet(botNew);
    // Flag 1028: also hand back the locked order (player 1's deck, player 2's deck), because d1/d2 still hold the old order
    // until the next render. The overlay deck order graphic and the scoreboard's first combo are built from this.
    onConfirm({
      p1Deck: swapped ? botNew : topNew,
      p2Deck: swapped ? topNew : botNew
    });
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
      }, combo.ratchet ? (NO_BIT_RATCHETS.includes(combo.ratchet) ? combo.ratchet : `${combo.ratchet} · ${combo.bit}`) : combo.bit || "")), /*#__PURE__*/React.createElement("div", {
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
      }, combo.ratchet ? (NO_BIT_RATCHETS.includes(combo.ratchet) ? combo.ratchet : `${combo.ratchet} · ${combo.bit}`) : combo.bit || "")));
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
      // Wider right padding (56 vs 16) while the floating "?" bug-report button is on, so the
      // countdown and Undo button end before the "?" begins instead of sitting under it.
      padding: "12px 56px 10px 16px",
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
  }, "Set Deck Order")), canUndo && /*#__PURE__*/React.createElement("button", {
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

/* ═══════════════════════════════════════
   MISREPORT SCREEN
   Full chronological, editable history of the CURRENT match only. Lets a
   judge correct a combo, win condition, or winner on any past battle in this
   match (Launch Errors are locked for now). Nothing is written back to the
   real match until "Save Changes" is tapped, and Save is disabled while any
   row is showing a conflict.
═══════════════════════════════════════ */
function MisreportScreen({
  p1,
  p2,
  d1,
  d2,
  entries,
  config,
  need,
  onClose,
  onSave
}) {
  const blankDraft = () => entries.map(e => ({
    p1ComboIdx: e.p1ComboIdx,
    p2ComboIdx: e.p2ComboIdx,
    type: e.type,
    scorerIdx: e.scorerIdx
  }));
  const [draft, setDraft] = React.useState(blankDraft);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const merged = entries.map((e, i) => {
    const d = draft[i] || {};
    const p1ComboIdx = d.p1ComboIdx !== undefined ? d.p1ComboIdx : e.p1ComboIdx;
    const p2ComboIdx = d.p2ComboIdx !== undefined ? d.p2ComboIdx : e.p2ComboIdx;
    // Use THIS battle's own deck-order snapshot, not today's live deck order —
    // the judge can drag-reorder the 3 combos between shuffles, so "combo #2"
    // from three shuffles ago isn't necessarily the same bey as "combo #2" now.
    const deck1 = e._d1 || d1 || [];
    const deck2 = e._d2 || d2 || [];
    return {
      ...e,
      ...d,
      p1Combo: deck1[p1ComboIdx] ? {
        ...deck1[p1ComboIdx]
      } : e.p1Combo,
      p2Combo: deck2[p2ComboIdx] ? {
        ...deck2[p2ComboIdx]
      } : e.p2Combo
    };
  });
  const {
    rows,
    hasErrors,
    finalState
  } = React.useMemo(() => computeMisreportLog(merged, config, need), [draft, entries, config, need]);
  const visible = rows.map((r, i) => ({
    r,
    i
  })).filter(x => x.r.type !== "LER-STRIKE");
  const lastRow = rows.length ? rows[rows.length - 1] : null;
  const setPts = lastRow ? [lastRow.p1Score, lastRow.p2Score] : [0, 0];
  const P1C = "#2563EB",
    P2C = "#DC2626";
  const updateRow = (i, patch) => {
    setDraft(d => {
      const n = [...d];
      n[i] = {
        ...n[i],
        ...patch
      };
      return n;
    });
  };
  const comboLabel = c => comboStr(c) === "—" ? "(empty combo)" : comboStr(c);
  const rowErrorsFor = (r, scope) => r.errors.filter(e => e.scope === scope || e.scope === "row");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "var(--bg-solid)",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      fontFamily: "'Outfit',sans-serif",
      zIndex: 700
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px 10px",
      borderBottom: "1px solid var(--border)",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10
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
  }, "Misreport Mode"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0
    }
  }, "Fix Match History")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      border: "1px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-muted)",
      fontSize: 16,
      fontWeight: 900,
      cursor: "pointer",
      flexShrink: 0
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px",
      borderBottom: "1px solid var(--border)",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      background: "var(--surface2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: "var(--text-muted)",
      letterSpacing: 1,
      textTransform: "uppercase",
      margin: "0 0 2px"
    }
  }, "Match Score"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 20,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0
    }
  }, finalState.sets[0], "\u2013", finalState.sets[1])), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 30,
      background: "var(--border2)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: "var(--text-muted)",
      letterSpacing: 1,
      textTransform: "uppercase",
      margin: "0 0 2px"
    }
  }, "Set Score"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 20,
      fontWeight: 900,
      color: "var(--text-primary)",
      margin: 0
    }
  }, setPts[0], "\u2013", setPts[1]))), hasErrors && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#DC2626",
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
      padding: "8px 16px",
      textAlign: "center",
      flexShrink: 0
    }
  }, "Fix the highlighted battles below before saving"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "10px 12px"
    }
  }, visible.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      textAlign: "center",
      marginTop: 30
    }
  }, "No battles logged yet this match."), visible.map(({
    r,
    i
  }, vi) => {
    const prevTag = vi > 0 ? `${visible[vi - 1].r.set}-${visible[vi - 1].r.shuffle}` : null;
    const tag = `${r.set}-${r.shuffle}`;
    const showDivider = vi > 0 && prevTag !== tag;
    const locked = r.type === "LER";
    const winnerColor = r.scorerIdx === 0 ? P1C : P2C;
    const p1Errs = rowErrorsFor(r, "p1combo");
    const p2Errs = rowErrorsFor(r, "p2combo");
    const rowErrs = r.errors.filter(e => e.scope === "row");
    const deck1 = r._d1 || d1 || [];
    const deck2 = r._d2 || d2 || [];
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, showDivider && /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        background: "var(--border2)",
        margin: "10px 4px"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        borderRadius: 12,
        border: `2px solid ${rowErrs.length ? "#DC2626" : winnerColor}`,
        background: locked ? "var(--surface2)" : `${winnerColor}12`,
        padding: "8px 10px",
        marginBottom: 8,
        opacity: locked ? 0.75 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-muted)",
        letterSpacing: 0.5,
        textTransform: "uppercase"
      }
    }, "Set ", r.set, " \xB7 Shuffle ", r.shuffle, " \xB7 Battle ", r.slot), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 800,
        color: "var(--text-muted)"
      }
    }, r.p1Score, "\u2013", r.p2Score)), rowErrs.map((er, ei) => /*#__PURE__*/React.createElement("p", {
      key: ei,
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#DC2626",
        margin: "0 0 6px"
      }
    }, "\u26A0 ", er.msg)), locked ? /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-muted)",
        margin: "4px 0"
      }
    }, "Launch Error \u2014 not editable yet") : null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 8
      }
    }, [{
      name: p1,
      idx: r.p1ComboIdx,
      deck: deck1,
      errs: p1Errs,
      color: P1C,
      onChange: v => updateRow(i, {
        p1ComboIdx: v
      })
    }, {
      name: p2,
      idx: r.p2ComboIdx,
      deck: deck2,
      errs: p2Errs,
      color: P2C,
      onChange: v => updateRow(i, {
        p2ComboIdx: v
      })
    }].map((side, si) => /*#__PURE__*/React.createElement("div", {
      key: si,
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: side.color,
        margin: "0 0 2px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, side.name), /*#__PURE__*/React.createElement("select", {
      disabled: locked,
      value: side.idx,
      onChange: e => side.onChange(Number(e.target.value)),
      style: {
        width: "100%",
        fontSize: 11,
        fontWeight: 700,
        padding: "6px 6px",
        borderRadius: 8,
        border: `1.5px solid ${side.errs.length ? "#DC2626" : "var(--border2)"}`,
        background: side.errs.length ? "#FEE2E2" : "var(--surface)",
        color: side.errs.length ? "#991B1B" : "var(--text-primary)",
        fontFamily: "'Outfit',sans-serif"
      }
    }, side.deck.map((c, ci) => /*#__PURE__*/React.createElement("option", {
      key: ci,
      value: ci
    }, comboLabel(c)))), side.errs.map((er, ei) => /*#__PURE__*/React.createElement("p", {
      key: ei,
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "#DC2626",
        margin: "2px 0 0"
      }
    }, er.msg))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "flex-end"
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
        color: "var(--text-muted)",
        margin: "0 0 2px"
      }
    }, "Win Condition"), /*#__PURE__*/React.createElement("select", {
      disabled: locked,
      value: r.type,
      onChange: e => updateRow(i, {
        type: e.target.value
      }),
      style: {
        width: "100%",
        fontSize: 11,
        fontWeight: 700,
        padding: "6px 6px",
        borderRadius: 8,
        border: "1.5px solid var(--border2)",
        background: "var(--surface)",
        color: "var(--text-primary)",
        fontFamily: "'Outfit',sans-serif"
      }
    }, MISREPORT_WIN_CONDITIONS.map(f => /*#__PURE__*/React.createElement("option", {
      key: f.id,
      value: f.id
    }, f.id === "OF2" ? "Own \xD72" : f.id === "OF3" ? "Own \xD73" : f.name, " (+", f.p, ")")))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-muted)",
        margin: "0 0 2px"
      }
    }, "Winner"), /*#__PURE__*/React.createElement("div", {
      onClick: () => !locked && updateRow(i, {
        scorerIdx: r.scorerIdx === 0 ? 1 : 0
      }),
      style: {
        position: "relative",
        display: "flex",
        borderRadius: 8,
        overflow: "hidden",
        border: "1.5px solid var(--border2)",
        height: 30,
        cursor: locked ? "default" : "pointer",
        opacity: locked ? 0.6 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: r.scorerIdx === 0 ? P1C : "var(--surface2)",
        color: r.scorerIdx === 0 ? "#fff" : "var(--text-muted)",
        fontSize: 10,
        fontWeight: 800,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        padding: "0 4px"
      }
    }, p1), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: r.scorerIdx === 1 ? P2C : "var(--surface2)",
        color: r.scorerIdx === 1 ? "#fff" : "var(--text-muted)",
        fontSize: 10,
        fontWeight: 800,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        padding: "0 4px"
      }
    }, p2))))));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px 16px",
      borderTop: "1px solid var(--border)",
      flexShrink: 0,
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmReset(true),
    disabled: visible.length === 0,
    style: {
      padding: "13px 14px",
      borderRadius: 12,
      border: "1px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: visible.length === 0 ? "default" : "pointer",
      opacity: visible.length === 0 ? 0.4 : 1
    }
  }, "Clear Changes"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSave(rows, finalState),
    disabled: hasErrors || visible.length === 0,
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 12,
      border: "none",
      background: hasErrors || visible.length === 0 ? "var(--border2)" : "linear-gradient(135deg,#7C3AED,#4C1D95)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: hasErrors || visible.length === 0 ? "not-allowed" : "pointer"
    }
  }, "Save Changes")), confirmReset && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 800,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-solid)",
      borderRadius: 14,
      padding: 18,
      maxWidth: 320,
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "var(--text-primary)",
      margin: "0 0 8px"
    }
  }, "Clear all changes?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      margin: "0 0 14px"
    }
  }, "This brings every battle back to what was originally recorded."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmReset(false),
    style: {
      flex: 1,
      padding: "10px 0",
      borderRadius: 10,
      border: "1px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-primary)",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDraft(blankDraft());
      setConfirmReset(false);
    },
    style: {
      flex: 1,
      padding: "10px 0",
      borderRadius: 10,
      border: "none",
      background: "#DC2626",
      color: "#fff",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, "Clear")))));
}

// ── UnrankedFlow ─────────────────────────────────────────────────────────────
// Manages the set-by-set winner-picking flow for unranked matches.
// Props:
//   p1, p2        — player names
//   dark          — dark mode flag
//   onMatchComplete(winnerName, setResults) — called when a player wins 2 sets
//   onBack        — called when judge taps Back (returns to player pick)
function UnrankedFlow({ p1, p2, dark, onMatchComplete, onBack }) {
  // completedSets: [{ winner, loserScore }, ...]
  const [completedSets, setCompletedSets] = useState([]);
  // step: "winner" | "loser_score"
  const [step, setStep] = useState("winner");
  // pendingWinner: name of the set winner while we wait for loser score
  const [pendingWinner, setPendingWinner] = useState(null);

  const curSetNum = completedSets.length + 1;
  const p1Sets = completedSets.filter(s => s.winner === p1).length;
  const p2Sets = completedSets.filter(s => s.winner === p2).length;

  const handleWinner = (name) => {
    setPendingWinner(name);
    setStep("loser_score");
  };

  const handleLoserScore = (score) => {
    const newSet = { winner: pendingWinner, loserScore: score };
    const newCompleted = [...completedSets, newSet];
    setCompletedSets(newCompleted);
    setPendingWinner(null);
    setStep("winner");

    // Check if match is over (2 sets won)
    const p1Total = newCompleted.filter(s => s.winner === p1).length;
    const p2Total = newCompleted.filter(s => s.winner === p2).length;
    if (p1Total >= 2 || p2Total >= 2) {
      const matchWinner = p1Total >= 2 ? p1 : p2;
      onMatchComplete(matchWinner, newCompleted);
    }
  };

  const loserName = pendingWinner === p1 ? p2 : p1;

  // Shared style helpers
  const nameBtn = (name, color, onClick) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      flex: 1,
      padding: "28px 12px",
      borderRadius: 16,
      border: "none",
      background: color,
      color: "#fff",
      fontSize: name && name.length > 12 ? 20 : 28,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      lineHeight: 1.1,
      wordBreak: "break-word"
    }
  }, name);

  const scoreBtn = (score, onClick) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      flex: 1,
      padding: "22px 8px",
      borderRadius: 14,
      border: "2px solid var(--border)",
      background: "var(--surface2)",
      color: "var(--text-primary)",
      fontSize: 32,
      fontWeight: 900,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    }
  }, score);

  // Set history summary shown from set 2 onward
  const setHistory = completedSets.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface2)",
      borderRadius: 12,
      padding: "12px 16px",
      marginBottom: 16
    }
  },
    /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", margin: "0 0 8px" }
    }, "Set Scores"),
    completedSets.map((s, i) => {
      const p1Won = s.winner === p1;
      const p1Score = p1Won ? 4 : s.loserScore;
      const p2Score = p1Won ? s.loserScore : 4;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < completedSets.length - 1 ? 4 : 0 }
      },
        /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: 0 } }, "Set " + (i + 1)),
        /*#__PURE__*/React.createElement("p", { style: { fontSize: 13, fontWeight: 800, color: "var(--text-primary)", margin: 0, fontFamily: "'Outfit',sans-serif" } },
          p1 + " " + p1Score + " – " + p2Score + " " + p2
        )
      );
    }),
    /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }
    },
      /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, fontWeight: 700, color: "#2563EB", margin: 0 } }, p1 + ": " + p1Sets + " set" + (p1Sets !== 1 ? "s" : "")),
      /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, fontWeight: 700, color: "#DC2626", margin: 0 } }, p2 + ": " + p2Sets + " set" + (p2Sets !== 1 ? "s" : ""))
    )
  );

  return /*#__PURE__*/React.createElement("div", {
    style: { ...S.page, paddingBottom: 40 }
  },
    /*#__PURE__*/React.createElement("button", { style: S.back, onClick: onBack }, IC.back, " Back"),
    /*#__PURE__*/React.createElement("h1", { style: { ...S.title, marginBottom: 4 } }, "Set " + curSetNum),
    /*#__PURE__*/React.createElement("p", { style: { ...S.sub, marginBottom: 16 } },
      step === "winner" ? "Who won Set " + curSetNum + "?" : pendingWinner + " wins Set " + curSetNum + ". What was " + loserName + "'s score?"
    ),

    setHistory,

    step === "winner" && /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", gap: 12 }
    },
      nameBtn(p1, "#2563EB", () => handleWinner(p1)),
      nameBtn(p2, "#DC2626", () => handleWinner(p2))
    ),

    step === "loser_score" && /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }
      }, loserName + "'s score (losing player):"),
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", gap: 10 }
      },
        scoreBtn(0, () => handleLoserScore(0)),
        scoreBtn(1, () => handleLoserScore(1)),
        scoreBtn(2, () => handleLoserScore(2)),
        scoreBtn(3, () => handleLoserScore(3))
      )
    )
  );
}

// Was defined inside the picker's render, so React saw a new component type
// every render and remounted all ~140 part buttons. Hoisted + memoized.
// --espiiii
// Large "change one part" menu. Opens when a Quick Combo / Previous Combo is held down.
// Dims the whole screen and shows one big button per part (blade, ratchet, bit) with an X
// (cancel) in the top right corner. Tapping the dimmed area outside the card also cancels.
// No hooks in here on purpose, so it is safe to render conditionally anywhere.
function PartEditOverlay({
  combo,
  accent,
  onPick,
  onClose
}) {
  // Blades with no ratchet (e.g. Bullet Griffon) skip that button; ratchets with a built-in
  // bit (Turbo, Operate) skip the bit button. Same rules the pickers already follow.
  const rows = [{
    cat: "blade",
    label: "Blade",
    value: combo.blade,
    color: "#EA580C"
  }, ...(combo.ratchet ? [{
    cat: "ratchet",
    label: "Ratchet",
    value: combo.ratchet,
    color: "#1D4ED8"
  }] : []), ...(combo.bit && !NO_BIT_RATCHETS.includes(combo.ratchet) ? [{
    cat: "bit",
    label: "Bit",
    value: combo.bit,
    color: "#15803D"
  }] : [])];
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Change one part",
    onClick: e => {
      e.stopPropagation();
      onClose();
    },
    style: {
      position: "fixed",
      inset: 0,
      // above the floating "?" bug-report button (99990) so the two never overlap
      zIndex: 99995,
      background: "rgba(15,23,42,0.72)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      boxSizing: "border-box",
      fontFamily: "'Outfit',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 440,
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      background: "var(--surface)",
      border: `3px solid ${accent}`,
      borderRadius: 20,
      padding: 14,
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 900,
      color: "var(--text-primary)"
    }
  }, "Which part do you want to change?"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Cancel",
    style: {
      flexShrink: 0,
      width: 44,
      height: 44,
      borderRadius: "50%",
      border: "2px solid var(--border2)",
      background: "var(--surface2)",
      color: "var(--text-primary)",
      fontSize: 22,
      fontWeight: 800,
      lineHeight: 1,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0
    }
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, rows.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.cat,
    type: "button",
    onClick: () => onPick(r.cat),
    style: {
      width: "100%",
      minHeight: 96,
      borderRadius: 16,
      border: `3px solid ${r.color}`,
      background: r.color + "18",
      color: "var(--text-primary)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      padding: "10px 12px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: r.color
    }
  }, r.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 26,
      fontWeight: 900,
      lineHeight: 1.1,
      textAlign: "center",
      wordBreak: "break-word"
    }
  }, r.value))))));
}
const PartButton = memo(function PartButton({
  name,
  isTop,
  sel,
  taken,
  cat,
  cc,
  deck,
  setDeck,
  slot,
  who,
  d1,
  d2,
  picker,
  advanceDeckPicker
}) {
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
      // Hard rule: NO_BIT_RATCHETS (e.g. Turbo, Operate) have a built-in bit — no separate bit.
      // Null out the dependent part in the same state update so stale values never persist.
      const noRatchet = cat === "blade" && NO_RATCHET_BLADES.includes(name);
      const noBit = cat === "ratchet" && NO_BIT_RATCHETS.includes(name);
      nd[slot] = {
        ...nd[slot],
        [cat]: name,
        ...(noRatchet ? {
          ratchet: null
        } : {}),
        ...(noBit ? {
          bit: null
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
});

(window.__NCB_PARTS = window.__NCB_PARTS || {}).screens = true; // ticks this file's box - app.js checks all boxes before starting
