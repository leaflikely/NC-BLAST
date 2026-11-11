// NC BLAST judge-match.js | part 4 of 6 (load order is set in index.html) | last updated: 2026-11-11b | next-action-popup (flag 1036, on by default: right after the judge submits, a "Next Action?" popup with New Match (main choice, waits for the bracket like the page button), Stay Here, and Finished this round. (only with a stream channel; starts the between-round standby slides)) | previous: 2026-11-11a | deck-order-redesign (flag 1035: the order screen call picks DeckOrderV2 from screens.js when the flag is on, and passes dark mode to it) | previous: 2026-11-10e | cx-picture-guide-new-parts (Picture guide lists Hurricane and Tread with the CXE blades, Tough with the over blades, Quell with the assist blades) | previous: 2026-11-10d | cxe-tag-dark-mode (flag 1034: the small CXE tag on the CX main blade buttons uses dark text in dark mode, it was white on near-white) | previous: 2026-11-10c | deck-builder-redesign (flag 1034, on by default: new Record decks screen from the teammate mock-up - deck always on screen, whole-combo search, ratchet grid, CX steps - then each player checks and confirms their own deck, with a hidden screen between them; Fast Blast uses it too; the old deck review and pickers stay as the flag-off path) | previous: 2026-11-10b | retired flags 1001-1006, 1012, 1027 (now permanent) | previous:2026-11-08c | score-pad-battle-screen (flag 1033, whole battle screen in the new layout, Own plus text in opponent colour) | previous: 2026-11-08a | score-pad-result-and-confirm (flag 1032, off by default: the Match result screen and the player tap-to-confirm screen get the new look from the Claude Design mock-up; drawing only, scoring and submitting are untouched) | previous: 2026-11-03d | graphic-pool-stage-1 (flag 1023: the judge app also sends the overlay the battle count of the match, whether the event is Swiss, and how many matches of this round have not started; it refreshes the bracket every 30 seconds during a match) | previous: 2026-11-03b | overlay-records (flag 1022: the judge app looks up the bracket's finished matches when a match starts and sends the stream overlay the round label and each player's match record (W-L) for its new second post-battle graphic; 0-0 when it cannot) | previous: 2026-11-03a | menu-cleanup-and-stream-flip (judge scorer: the ? report button and the dark mode toggle moved into the cog menu; the Reset-set button now reads "Set"; new cog menu button "Swap Stream Position" flips left and right on the stream overlay only, and the judge's own Swap button no longer touches the overlay) | previous: 2026-11-02a | overlay-set-winners (flag 1020: the overlay payload now lists who won each finished set, in order, so the stream overlay can colour set dot 1 for the set 1 winner) | previous: 2026-10-29d simple-match-history (post-game Match History defaults to names + "+points" with a check button for Full Stat View) | previous: 2026-10-29c confirm-names-black-crown (player names in black and a crown beside the winner on the tap-confirm screen) | previous: 2026-10-29b confirm-screen-scores (final match + per-set scores shown on the two-player tap-confirm screen) | previous: 2026-10-29a die-roll-wording (priority question now reads "Who Won the Die Roll?") | 2026-10-27a submit-check-and-notifications (flag 1017: confirm score with the bracket site, lock New Match until confirmed, escape button tells the TO) | previous: 2026-10-22b split-from-app.js (MatchScreen (the judge scoring screen) and its confirm window; code moved here unchanged)
// FLAG 1020: who won each finished set, oldest first (0 = player 1, 1 = player 2), for the
// stream overlay's set dots. Built from the per-set scores. Any win the scores don't list yet
// (the set that was just won: its score is saved a moment after the overlay push) is added at
// the end from the win counts. Never throws: on any problem it sends an empty list.
function overlaySetWinners(setScores, setsNow) {
  try {
    const w = (setScores || []).map(s => s.p1 > s.p2 ? 0 : 1);
    const have = [w.filter(x => x === 0).length, w.filter(x => x === 1).length];
    [0, 1].forEach(pi => {
      for (let k = have[pi]; k < (setsNow[pi] || 0); k++) w.push(pi);
    });
    return w.slice(0, (setsNow[0] || 0) + (setsNow[1] || 0));
  } catch (e) {
    return [];
  }
}
// FLAG 1022: a player's match record (wins, losses) from the bracket's match list, for the stream
// overlay's records graphic. Only finished matches with a winner count; the match being played now is
// skipped (it is not finished yet, or is being scored again). A match belongs to the player when the
// participant id matches, or, if that id is missing, when the name matches (ignoring capitals).
// Never throws: on any problem it returns 0-0 for both.
function overlayRecordsFrom(pairings, p1Id, p2Id, p1Name, p2Name, currentMatchId) {
  const count = (id, name) => {
    let w = 0, l = 0;
    try {
      const nm = String(name || "").trim().toLowerCase();
      (Array.isArray(pairings) ? pairings : []).forEach(m => {
        if (!m || m.state !== "complete") return;
        if (currentMatchId != null && String(m.id) === String(currentMatchId)) return;
        const mine = (pid, pname) => (id != null && id !== "" && pid != null && String(pid) === String(id)) || (nm !== "" && String(pname || "").trim().toLowerCase() === nm);
        const isP1 = mine(m.player1_id, m.player1_name);
        const isP2 = !isP1 && mine(m.player2_id, m.player2_name);
        if (!isP1 && !isP2) return;
        if (m.winner_id == null || m.winner_id === "") return;
        const myId = isP1 ? m.player1_id : m.player2_id;
        if (String(m.winner_id) === String(myId)) w++; else l++;
      });
    } catch (e) {
      return [0, 0];
    }
    return [w, l];
  };
  return { p1: count(p1Id, p1Name), p2: count(p2Id, p2Name) };
}
// Round label used on the overlay, the same words as the org view: "Swiss Round 3" / "Top Cut Round 1".
function overlayRoundLabel(round) {
  const r = Number(round);
  if (round == null || round === "" || !Number.isFinite(r) || r === 0) return "";
  return r < 0 ? "Top Cut Round " + Math.abs(r) : "Swiss Round " + r;
}
// FLAG 1023: how many matches of this round have not started yet: not finished, not marked underway,
// both players known, and not the match being played now. null = unknown (no round number).
function overlayPendingFrom(pairings, round, currentMatchId) {
  try {
    const r = Number(round);
    if (round == null || round === "" || !Number.isFinite(r) || r === 0) return null;
    let n = 0;
    (Array.isArray(pairings) ? pairings : []).forEach(m => {
      if (!m || Number(m.round) !== r) return;
      if (m.state === "complete" || m.underway_at) return;
      if (currentMatchId != null && String(m.id) === String(currentMatchId)) return;
      if (!m.player1_id || !m.player2_id) return;
      n++;
    });
    return n;
  } catch (e) {
    return null;
  }
}
// FLAG 1024: seeds from the bracket's player list, so the overlay can announce upsets.
// Returns { names: {lowercase name: seed}, ids: {participant id or group-stage id: seed} }. Never throws.
function overlaySeedMap(participants) {
  const out = { names: {}, ids: {} };
  try {
    (Array.isArray(participants) ? participants : []).forEach(p => {
      const part = (p && p.participant) || p || {};
      const seed = parseInt(part.seed, 10);
      if (!(seed >= 1)) return;
      const n = String(part.display_name || part.username || part.name || "").trim().toLowerCase();
      if (n) out.names[n] = seed;
      if (part.id != null) out.ids[String(part.id)] = seed;
      if (Array.isArray(part.group_player_ids)) part.group_player_ids.forEach(g => {
        if (g != null) out.ids[String(g)] = seed;
      });
    });
  } catch (e) {}
  return out;
}
// FLAG 1024: finished matches of this round that the LOWER seed won (a bigger seed number beat a smaller one).
// Each is { id, w, ws, l, ls } = winner name / seed, loser name / seed. Best-seeded loser first, at most 16.
// A match counts only when both seeds are known; the match being played now is left out.
function overlayUpsetsFrom(pairings, round, seeds, currentMatchId) {
  const out = [];
  try {
    const r = Number(round);
    if (round == null || round === "" || !Number.isFinite(r) || r === 0 || !seeds) return out;
    const seedOf = (id, name) => {
      if (id != null && id !== "" && seeds.ids && seeds.ids[String(id)] >= 1) return seeds.ids[String(id)];
      const n = String(name || "").trim().toLowerCase();
      return n && seeds.names && seeds.names[n] >= 1 ? seeds.names[n] : null;
    };
    (Array.isArray(pairings) ? pairings : []).forEach(m => {
      if (!m || m.state !== "complete" || Number(m.round) !== r) return;
      if (currentMatchId != null && String(m.id) === String(currentMatchId)) return;
      if (m.winner_id == null || m.winner_id === "") return;
      const p1Won = String(m.winner_id) === String(m.player1_id);
      const p2Won = !p1Won && String(m.winner_id) === String(m.player2_id);
      if (!p1Won && !p2Won) return;
      const wName = p1Won ? m.player1_name : m.player2_name, lName = p1Won ? m.player2_name : m.player1_name;
      const ws = seedOf(p1Won ? m.player1_id : m.player2_id, wName), ls = seedOf(p1Won ? m.player2_id : m.player1_id, lName);
      if (!wName || !lName || !ws || !ls || ws <= ls) return;
      const up = { id: String(m.id), w: String(wName), ws, l: String(lName), ls };
      const sc = setScoreText(m.scores_csv, p1Won); // FLAG 1029: "2-1" (sets), or points for a one-set match
      if (sc) up.sc = sc;
      out.push(up);
    });
    out.sort((a, b) => a.ls - b.ls || (b.ws - b.ls) - (a.ws - a.ls));
  } catch (e) {
    return [];
  }
  return out.slice(0, 16);
}
// FLAG 1029: the winner's score line for the Upset Alert, winner first. Sets won ("2-1") when the match had several sets,
// the points of the one set when it had only one. scores_csv is "p1-p2,p1-p2" (player 1 first). Returns "" when unreadable.
function setScoreText(scoresCsv, p1Won) {
  try {
    const sets = String(scoresCsv == null ? "" : scoresCsv).split(",").map(x => /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(x)).filter(Boolean).map(m => [parseInt(m[1], 10), parseInt(m[2], 10)]);
    if (!sets.length) return "";
    if (sets.length === 1) return p1Won ? sets[0][0] + "-" + sets[0][1] : sets[0][1] + "-" + sets[0][0];
    let a = 0, b = 0;
    sets.forEach(x => { if (x[0] > x[1]) a++; else if (x[1] > x[0]) b++; });
    return p1Won ? a + "-" + b : b + "-" + a;
  } catch (e) {
    return "";
  }
}
// FLAG 1029: which stadium letter a judge was assigned to. assign = { judgeName: "A" }, nameMap = { username: display name }.
// Same three-step lookup the Station Matches tab uses. Returns "" when not found.
function stadiumLetterFor(assign, nameMap, who) {
  try {
    const me = String(who || "").toLowerCase().trim();
    if (!me || !assign) return "";
    const nm = {};
    Object.entries(nameMap || {}).forEach(([k, v]) => { nm[k.toLowerCase()] = String(v || "").toLowerCase(); });
    const entries = Object.entries(assign);
    for (const [k, letter] of entries) if (k.toLowerCase() === me) return String(letter || "");
    for (const [k, letter] of entries) { const mapped = nm[k.toLowerCase()] || ""; if (mapped && mapped === me) return String(letter || ""); }
    const disp = nm[me] || "";
    if (disp) for (const [k, letter] of entries) {
      if (k.toLowerCase() === disp) return String(letter || "");
      const mapped = nm[k.toLowerCase()] || "";
      if (mapped && mapped === disp) return String(letter || "");
    }
  } catch (e) {}
  return "";
}
// FLAG 1029: adds who judged each finished match (j) and its stadium letter (st) to the upset list. notes = { matchId: { j, s } }.
function overlayUpsetsWithNotes(upsets, notes) {
  try {
    return (Array.isArray(upsets) ? upsets : []).map(u => {
      const n = notes && u && notes[String(u.id)];
      if (!n) return u;
      const o = Object.assign({}, u);
      if (n.s) o.st = String(n.s).slice(0, 2);
      if (n.j) o.j = String(n.j).slice(0, 40);
      return o;
    });
  } catch (e) {
    return upsets;
  }
}
// FLAG 1030 (standby slides): what to do when a judge taps New Match after finishing a match.
//   "stay"    - their station still has an open match queued: nothing special
//   "standby" - nothing is left in this round on any station: go to standby without asking
//   "ask"     - their queue is empty but other stations still have matches: ask "Are there no more matches at this stadium?"
//   "none"    - the bracket list could not be read: do nothing special
// queueIds = the match ids queued for this judge's station. A match counts as open when the bracket says it is not complete.
function standbyNeedsAsk({ queueIds, pairings, round, currentMatchId }) {
  try {
    if (!Array.isArray(pairings)) return "none";
    const r = Number(round);
    const anyRound = round == null || round === "" || !Number.isFinite(r) || r === 0;
    const open = pairings.filter(m => m && m.state !== "complete" && m.player1_id && m.player2_id && (anyRound || Number(m.round) === r) && String(m.id) !== String(currentMatchId));
    const openIds = new Set(open.map(m => String(m.id)));
    const queued = (Array.isArray(queueIds) ? queueIds : []).map(String).filter(id => id !== String(currentMatchId) && openIds.has(id));
    if (queued.length) return "stay";
    return open.length === 0 ? "standby" : "ask";
  } catch (e) {
    return "none";
  }
}
// FLAG 1030: the standings slide, copied from Challonge's own standings table (database Worker /standings -> { groups: [ { name, rows: [ { r, n, rec, d } ] } ] }).
// Shows the group that the two players of the match just finished belong to (the first group when they are not found).
// Each row: r = Challonge's rank, n = name, d = Pts Diff (Challonge's number), p = PPB from this event's battles (supplementary; null when unknown).
// PPB = points won minus points lost, per battle (stats.players from /event-stats). Returns { group, rows } with at most 8 rows.
function standbyStandingsFrom(groups, names, stats) {
  const out = { group: "", rows: [] };
  try {
    if (!Array.isArray(groups) || !groups.length) return out;
    const want = (Array.isArray(names) ? names : []).map(x => String(x || "").trim().toLowerCase()).filter(Boolean);
    const found = groups.find(g => g && Array.isArray(g.rows) && g.rows.some(r => want.indexOf(String(r.n || "").trim().toLowerCase()) !== -1));
    const g = found || groups.find(x => x && Array.isArray(x.rows) && x.rows.length);
    if (!g) return out;
    const ps = stats && stats.players || {};
    out.group = String(g.name || "");
    out.rows = g.rows.slice(0, 8).map(r => {
      const e = ps[String(r.n || "").trim().toLowerCase()];
      return { r: r.r, n: String(r.n || ""), d: typeof r.d === "number" ? r.d : null, p: e && e.n > 0 ? Math.round((e.pf - e.pa) / e.n * 100) / 100 : null };
    });
  } catch (e) {}
  return out;
}
// FLAG 1030: everything the three standby slides show, worked out from data the app already has.
//   pairings = the bracket's match list; stats = /event-stats answer { players, combos }; decks = /deck-log decks.
//   standings: NOT worked out here. They are Challonge's own table (see standbyStandingsFrom), so rank and tie-breaks are always Challonge's.
//   results:   finished matches of the round, newest first, winner first with the set score ("2-1").
//   combos:    combos in decks, counted once per locked deck (not per battle), with the event's PPB for that combo.
// Each list holds at most 8 entries. Never throws; a list that cannot be built is empty (the overlay skips an empty slide).
function standbyDataFrom(pairings, round, stats, decks) {
  const out = { round: null, standings: [], results: [], combos: [] };
  try {
    const r = Number(round);
    if (Number.isFinite(r) && r > 0) out.round = r;
    const comboStats = stats && stats.combos || {};
    const ppbOf = (map, key) => {
      const e = map[String(key || "").trim().toLowerCase()];
      return e && e.n > 0 ? Math.round((e.pf - e.pa) / e.n * 100) / 100 : null;
    };
    const done = (Array.isArray(pairings) ? pairings : []).filter(m => m && m.state === "complete" && m.winner_id != null && m.winner_id !== "");
    const sides = m => {
      const p1Won = String(m.winner_id) === String(m.player1_id);
      const p2Won = !p1Won && String(m.winner_id) === String(m.player2_id);
      if (!p1Won && !p2Won) return null;
      const w = p1Won ? m.player1_name : m.player2_name, l = p1Won ? m.player2_name : m.player1_name;
      if (!w || !l) return null;
      return { w: String(w), l: String(l), p1Won };
    };
    let resRound = out.round;
    if (resRound == null) done.forEach(m => { if (Number(m.round) > (resRound || 0)) resRound = Number(m.round); });
    out.results = done.filter(m => resRound == null || Number(m.round) === resRound).sort((a, b) => Number(b.id) - Number(a.id)).map(m => {
      const sd = sides(m);
      if (!sd) return null;
      const sc = setScoreText(m.scores_csv, sd.p1Won);
      return sc ? { w: sd.w, l: sd.l, sc } : { w: sd.w, l: sd.l };
    }).filter(Boolean).slice(0, 8);
    const count = {};
    (Array.isArray(decks) ? decks : []).forEach(d => {
      [d && d.d1, d && d.d2].forEach(list => (Array.isArray(list) ? list : []).forEach(t => {
        const text = String(t || "").trim();
        if (!text) return;
        const k = text.toLowerCase();
        (count[k] || (count[k] = { c: text, n: 0 })).n++;
      }));
    });
    out.combos = Object.keys(count).map(k => ({ c: count[k].c, n: count[k].n, p: ppbOf(comboStats, k), b: comboStats[k] ? comboStats[k].n : 0 })).sort((a, b) => b.n - a.n || (b.p == null ? -99 : b.p) - (a.p == null ? -99 : a.p) || a.c.localeCompare(b.c)).slice(0, 8);
  } catch (e) {}
  return out;
}
// ── FLAG 1032: score pad redesign - Match result screen + player tap-to-confirm screen ──────────
// These two functions only DRAW. They hold no scoring, undo, submit or send logic: MatchScreen hands
// them what to show and what to call when something is tapped, and the old screens stay in
// MatchScreen as the "flag off" branch. Colours and sizes come from the Claude Design mock-up
// ("NC BLAST - Match Confirm Redesign"). The mock has no red "confirmed" half, no p2-wins case and
// no red log rows, so those mirror the blue ones. --espiiii
const NCB_PAD_UI = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
const NCB_PAD_NUM = "'Outfit', sans-serif";
const NCB_PAD_LIGHT = {
  bg: "#F2F4F9", text: "#141B2D", sub: "#5B6478", card: "#FFFFFF", cardBorder: "none",
  shadow: "0 1px 2px rgba(20,27,45,0.06), 0 4px 16px rgba(20,27,45,0.05)", detailsCard: "#FFFFFF",
  hair: "#EDF0F5", rowHair: "#F0F2F6", setChip: "#F4F6FB", setChipBorder: "none", groupBar: "#F7F8FB",
  countBg: "#EEF0F5", countText: "#3A4458", toggleOff: "#CBD1DD", knob: "#FFFFFF", knobShadow: "0 1px 2px rgba(20,27,45,0.25)",
  blue: "#2F55D4", blueDeep: "#2346B8", blueTint: "#E6ECFC", blueChip: "#2F55D4",
  red: "#C8322A", redDeep: "#A8281F", redTint: "#FBE7E5", redChip: "#C8322A",
  loserNum: "#8A93A6", dash: "#C3C9D6", setNum: "#141B2D",
  backText: "#3A4458", helpBg: "#FFFFFF", helpBorder: "#D5DAE6", helpText: "#2F55D4",
  footerBg: "#FFFFFF", footerBorder: "#E3E7EF", footerShadow: "0 -4px 16px rgba(20,27,45,0.04)",
  confirmBtn: "#6234D8", confirmShadow: "0 6px 16px rgba(98,52,216,0.28)",
  secBorder: "#D5DAE6", secBg: "#FFFFFF", secText: "#3A4458",
  // player confirm screen
  cBg: "#141B2D", cBarBorder: "rgba(255,255,255,0.08)", cBarBg: "#141B2D",
  cBackBorder: "1.5px solid rgba(255,255,255,0.35)", cBackBg: "transparent", cBackText: "#FFFFFF", cBarText: "#FFFFFF",
  cDotOn: "#7FA0FF", cDotOnRed: "#FF9A94", cDotOff: "2px solid rgba(255,255,255,0.5)",
  cBluePending: "#2F55D4", cBlueDone: "#1F3E9E", cRedPending: "#C8322A", cRedDone: "#84211C",
  cBlueBtnText: "#2F55D4", cRedBtnText: "#B02A23", cPill: "#FFFFFF", cPillRing: "rgba(255,255,255,0.18)", cPillRingRed: "rgba(255,255,255,0.2)",
  cBadgeBg: "rgba(255,255,255,0.18)", cScoreBox: "rgba(0,0,0,0.16)", cCheckRing: "rgba(255,255,255,0.14)",
  cSub: "rgba(255,255,255,0.92)", cSub2: "rgba(255,255,255,0.9)"
};
const NCB_PAD_DARK = {
  bg: "#0F172A", text: "#F1F5F9", sub: "#94A3B8", card: "#1E293B", cardBorder: "1px solid #2A3650",
  shadow: "0 4px 20px rgba(0,0,0,0.35)", detailsCard: "#131C2F",
  hair: "#2A3650", rowHair: "#263248", setChip: "#0F172A", setChipBorder: "1px solid #2A3650", groupBar: "#172033",
  countBg: "#0F172A", countText: "#CBD5E1", toggleOff: "#334155", knob: "#CBD5E1", knobShadow: "0 1px 2px rgba(0,0,0,0.4)",
  blue: "#5B8BFF", blueDeep: "#8FB0FF", blueTint: "rgba(91,139,255,0.16)", blueChip: "#3463E8",
  red: "#FF6B6B", redDeep: "#FFA3A3", redTint: "rgba(255,107,107,0.16)", redChip: "#D93F3F",
  loserNum: "#64748B", dash: "#475569", setNum: "#94A3B8",
  backText: "#CBD5E1", helpBg: "#1E293B", helpBorder: "#334155", helpText: "#8FB0FF",
  footerBg: "#131C2F", footerBorder: "#2A3650", footerShadow: "none",
  confirmBtn: "#7C3AED", confirmShadow: "0 6px 20px rgba(124,58,237,0.35)",
  secBorder: "#334155", secBg: "#1E293B", secText: "#CBD5E1",
  cBg: "#0B1120", cBarBorder: "#2A3650", cBarBg: "#0B1120",
  cBackBorder: "1.5px solid #334155", cBackBg: "#1E293B", cBackText: "#E2E8F0", cBarText: "#CBD5E1",
  cDotOn: "#1FA65A", cDotOnRed: "#1FA65A", cDotOff: "2px solid #64748B",
  cBluePending: "#1F3FB0", cBlueDone: "#16286A", cRedPending: "#9E2620", cRedDone: "#6F1A16",
  cBlueBtnText: "#1F3FB0", cRedBtnText: "#9E2620", cPill: "#F1F5F9", cPillRing: "rgba(255,255,255,0.12)", cPillRingRed: "rgba(255,255,255,0.12)",
  cBadgeBg: "rgba(255,255,255,0.16)", cScoreBox: "rgba(0,0,0,0.22)", cCheckRing: "rgba(31,166,90,0.22)",
  cSub: "rgba(255,255,255,0.9)", cSub2: "rgba(255,255,255,0.88)"
};
function ncbPadIcon(size, d, o) {
  o = o || {};
  return React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: o.fill || "none", stroke: "currentColor", strokeWidth: o.sw || 2,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true"
  }, (Array.isArray(d) ? d : [d]).map((p, i) => React.createElement("path", { key: i, d: p })));
}
const NCB_PAD_ICONS = {
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z",
  back: "M15 18l-6-6 6-6",
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  scale: ["M12 3v18", "M7 21h10", "M4 7h16", "M7 7l-3 7a3 3 0 0 0 6 0L7 7z", "M17 7l-3 7a3 3 0 0 0 6 0l-3-7z"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
  check: "M5 12.5l4.5 4.5L19 7.5",
  tap: ["M9 11V5a2 2 0 0 1 4 0v6", "M13 10a2 2 0 0 1 4 0v1", "M17 11a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4 15.5a2 2 0 0 1 3-2.6L9 15"]
};

// Page frame. fixed = pre-submit ranked screen that must fit one phone screen (the log scrolls inside).
function ncbPadFrameStyle(dark, fixed) {
  const P = dark ? NCB_PAD_DARK : NCB_PAD_LIGHT;
  return {
    width: "100%", maxWidth: 480, margin: "0 auto", boxSizing: "border-box",
    display: "flex", flexDirection: "column",
    background: P.bg, color: P.text, fontFamily: NCB_PAD_UI,
    minHeight: "100dvh",
    ...(fixed ? { height: "100dvh", overflow: "hidden" } : {})
  };
}

// Match result screen: header + main (+ footer when `showFooter`).
function ncbPadResult(o) {
  const h = React.createElement;
  const P = o.dark ? NCB_PAD_DARK : NCB_PAD_LIGHT;
  const UI = NCB_PAD_UI, NUM = NCB_PAD_NUM;
  const fixed = !!o.showFooter;
  const p1Won = o.winner === o.p1;
  const sets = o.sets || [0, 0];
  const setScores = o.setScores || [];
  const sectionBase = {
    background: P.card, border: P.cardBorder, boxShadow: P.shadow
  };
  // single-set matches show the points of that set as the big score
  const big = o.bo > 1 || !setScores.length ? [sets[0], sets[1]] : [setScores[0].p1, setScores[0].p2];

  const header = h("header", {
    style: { height: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }
  }, h("div", { style: { width: 84, display: "flex" } }, !o.submitted && h("button", {
    type: "button", onClick: o.onBack,
    style: { height: 44, padding: "0 10px 0 4px", display: "flex", alignItems: "center", gap: 2, border: "none", background: "transparent", color: P.backText, font: "600 15px " + UI, cursor: "pointer" }
  }, ncbPadIcon(22, NCB_PAD_ICONS.back, { sw: 2.25 }), "Back")), h("div", {
    style: { textAlign: "center", minWidth: 0 }
  }, o.tournamentName ? h("div", {
    style: { font: "700 11px " + UI, letterSpacing: "0.14em", color: P.sub, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }
  }, o.tournamentName) : null, h("div", {
    style: { font: "700 17px " + NUM, color: P.text }
  }, "Match result")), h("div", {
    style: { width: 84, display: "flex", justifyContent: "flex-end" }
  }, o.onHelp && h("button", {
    type: "button", "aria-label": "Help", onClick: o.onHelp,
    style: { width: 44, height: 44, borderRadius: 22, border: "1.5px solid " + P.helpBorder, background: P.helpBg, color: P.helpText, font: "700 18px " + NUM, cursor: "pointer" }
  }, "?")));

  // winner / loser columns of the score card
  const col = idx => {
    const won = (idx === 0) === p1Won;
    const name = idx === 0 ? o.p1 : o.p2;
    const blue = idx === 0;
    return h("div", {
      key: idx,
      style: won ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 } : { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", alignSelf: "stretch", gap: 6, minWidth: 0 }
    }, won && h("span", {
      style: { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: blue ? P.blueTint : P.redTint, color: blue ? P.blueDeep : P.redDeep, font: "800 11px " + UI, letterSpacing: "0.08em" }
    }, ncbPadIcon(13, NCB_PAD_ICONS.crown, { fill: "currentColor", sw: 1.5 }), "WINNER"), h("div", {
      style: { maxWidth: "100%", font: "800 22px " + NUM, color: blue ? P.blue : P.red, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
    }, name));
  };
  const scoreCard = h("section", {
    "aria-label": "Final score",
    style: { ...sectionBase, flexShrink: 0, borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 14 }
  }, h("div", {
    style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "center", gap: 8 }
  }, col(0), h("div", {
    style: { display: "flex", alignItems: "center", gap: 10, font: "800 56px/1 " + NUM, fontVariantNumeric: "tabular-nums" }
  }, h("span", { style: { color: p1Won ? P.blue : P.loserNum } }, big[0]), h("span", { style: { color: P.dash, fontSize: 32 } }, "–"), h("span", { style: { color: p1Won ? P.loserNum : P.red } }, big[1])), col(1)), o.bo > 1 && setScores.length > 0 && h("div", {
    style: { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, paddingTop: 12, borderTop: "1px solid " + P.hair }
  }, setScores.map((ss, i) => {
    const w1 = ss.p1 > ss.p2;
    return h("div", {
      key: i,
      style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: P.setChip, border: P.setChipBorder }
    }, h("span", { style: { font: "700 11px " + UI, letterSpacing: "0.1em", color: P.sub } }, "SET " + (i + 1)), h("span", {
      style: { font: "800 16px " + NUM, color: P.setNum }
    }, h("span", { style: w1 ? { color: P.blue } : undefined }, ss.p1), "–", h("span", { style: !w1 ? { color: P.red } : undefined }, ss.p2)));
  })));

  // Battles / Shuffles / Judge (ranked events only, like the old screen)
  const stat = (label, val, first) => h("div", {
    key: label,
    style: { padding: "10px 8px", textAlign: "center", ...(first ? {} : { borderLeft: "1px solid " + P.hair }) }
  }, h("div", { style: { font: "700 11px " + UI, letterSpacing: "0.1em", color: P.sub } }, label), h("div", {
    style: { marginTop: 2, font: "700 20px " + NUM }
  }, val));
  const judgeCell = h("div", {
    key: "JUDGE",
    style: { padding: "10px 8px", textAlign: "center", borderLeft: "1px solid " + P.hair, minWidth: 0 }
  }, h("div", { style: { font: "700 11px " + UI, letterSpacing: "0.1em", color: P.sub } }, "JUDGE"), o.judgeEditMode ? h("div", {
    style: { display: "flex", gap: 4, width: "100%", marginTop: 4 }
  }, h(JudgeInput, {
    style: { ...S.inp, flex: 1, fontSize: 12, padding: "3px 6px", borderRadius: 6, minWidth: 0 },
    value: o.judge,
    onCommit: o.onJudgeCommit,
    onClear: () => o.onJudgeEdit(false)
  }), h("button", {
    type: "button", onClick: () => o.onJudgeEdit(false),
    style: { padding: "3px 8px", borderRadius: 6, border: "none", background: P.blueChip, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: NUM, cursor: "pointer" }
  }, "✓")) : h("button", {
    type: "button", onClick: () => !o.submitted && o.onJudgeEdit(true),
    style: { display: "block", width: "100%", marginTop: 4, padding: 0, border: "none", background: "none", color: P.text, font: "700 16px " + NUM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: o.submitted ? "default" : "pointer", textDecoration: o.submitted ? "none" : "underline dotted" }
  }, o.judge || "—"));
  const detailsCard = o.eventRanked && h("section", {
    "aria-label": "Match details",
    style: { ...sectionBase, background: P.detailsCard, flexShrink: 0, borderRadius: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }
  }, stat("BATTLES", o.battleCount, true), stat("SHUFFLES", o.shuffles, false), judgeCell);

  // Battle log, grouped by set
  const rows = [];
  const log = o.currentMatch || [];
  let lastSet = null;
  log.forEach((e, i) => {
    if (e.set !== lastSet) {
      lastSet = e.set;
      const ss = setScores[e.set - 1];
      const setWinner = ss ? (ss.p1 > ss.p2 ? o.p1 : o.p2) : null;
      rows.push(h("div", {
        key: "g" + i,
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 16px", background: P.groupBar, font: "700 11px " + UI, letterSpacing: "0.1em", color: P.sub, textTransform: "uppercase" }
      }, h("span", null, "SET " + e.set + (e.p1Side ? " · " + e.p1Side + "/" + e.p2Side : "")), ss && h("span", {
        style: { minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
      }, setWinner + " " + Math.max(ss.p1, ss.p2) + "–" + Math.min(ss.p1, ss.p2))));
    }
    const blue = e.scorerIdx === 0;
    const lastRow = i === log.length - 1;
    const combo = c => c ? (c.blade || "?") + (c.ratchet ? " " + c.ratchet : "") + (c.bit ? " · " + c.bit : "") : "";
    rows.push(h("div", {
      key: "r" + i,
      style: { display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", alignItems: "center", gap: 12, padding: "10px 16px", ...(lastRow ? {} : { borderBottom: "1px solid " + P.rowHair }) }
    }, h("span", {
      style: { width: 36, height: 36, borderRadius: 10, background: blue ? P.blueTint : P.redTint, color: blue ? P.blueDeep : P.redDeep, display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px " + NUM }
    }, "S" + e.slot), h("div", { style: { minWidth: 0 } }, h("div", {
      style: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 }
    }, h("span", {
      style: { font: "700 15px " + UI, color: blue ? P.blue : P.red, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }
    }, e.scorer), h("span", {
      style: { flexShrink: 0, padding: "2px 7px", borderRadius: 6, background: blue ? P.blueChip : P.redChip, color: "#FFFFFF", font: "700 12px " + NUM }
    }, "+" + e.points), e.penalty && h("span", {
      style: { flexShrink: 0, font: "700 11px " + UI, letterSpacing: "0.06em", color: P.sub }
    }, "PEN")), o.fullStats && h("div", {
      style: { marginTop: 3, font: "600 12px " + UI, color: P.sub, wordBreak: "break-word" }
    }, e.typeName + (e.p1Combo && e.p2Combo ? " · " + combo(e.p1Combo) + " vs " + combo(e.p2Combo) : ""))), h("span", {
      style: { font: "800 17px " + NUM, fontVariantNumeric: "tabular-nums" }
    }, e.p1Score + "–" + e.p2Score)));
  });
  const logCard = h("section", {
    "aria-label": "Battle log",
    style: { ...sectionBase, position: "relative", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", ...(fixed ? { flex: 1, minHeight: 0 } : { flexShrink: 0 }) }
  }, h("div", {
    style: { flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 6px 6px 16px", borderBottom: "1px solid " + P.hair }
  }, h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, h("h2", {
    style: { margin: 0, font: "700 17px " + NUM }
  }, "Battle log"), h("span", {
    style: { padding: "2px 8px", borderRadius: 999, background: P.countBg, font: "700 12px " + UI, color: P.countText }
  }, log.length)), h("button", {
    type: "button", "aria-pressed": !!o.fullStats, onClick: o.onToggleStats,
    style: { height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", border: "none", background: "transparent", font: "600 14px " + UI, color: P.countText, cursor: "pointer" }
  }, h("span", {
    "aria-hidden": "true",
    style: { position: "relative", display: "inline-block", width: 34, height: 20, borderRadius: 10, background: o.fullStats ? "#16A34A" : P.toggleOff }
  }, h("span", {
    style: { position: "absolute", top: 2, left: o.fullStats ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: o.fullStats ? "#FFFFFF" : P.knob, boxShadow: P.knobShadow }
  })), "Full stats")), h("div", {
    style: fixed ? { flex: 1, minHeight: 0, overflowY: "auto" } : {}
  }, rows));

  const main = h("main", {
    style: { display: "flex", flexDirection: "column", gap: 12, padding: "4px 16px 12px", ...(fixed ? { flex: 1, minHeight: 0 } : { flexShrink: 0 }) }
  }, scoreCard, detailsCard || null, logCard);

  const footer = fixed && h("footer", {
    style: { flexShrink: 0, background: P.footerBg, borderTop: "1px solid " + P.footerBorder, padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 10, boxShadow: P.footerShadow }
  }, h("button", {
    type: "button", onClick: o.onConfirm,
    style: { height: 56, border: "none", borderRadius: 16, background: P.confirmBtn, color: "#FFFFFF", font: "700 18px " + NUM, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: P.confirmShadow, cursor: "pointer" }
  }, ncbPadIcon(22, NCB_PAD_ICONS.scale), "Judge: confirm result", ncbPadIcon(20, NCB_PAD_ICONS.arrow, { sw: 2.25 })), h("button", {
    type: "button", onClick: o.onCsv,
    style: { height: 44, border: "1px solid " + P.secBorder, borderRadius: 12, background: P.secBg, color: P.secText, font: "600 14px " + UI, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }
  }, ncbPadIcon(18, NCB_PAD_ICONS.download), "Download CSV"));

  return h(React.Fragment, null, o.onHelp ? h(BugReportInlineButton, { hidden: true }) : null, header, main, footer || null);
}

// Player tap-to-confirm screen: top half = player 1 (turned upside down for the player across the table),
// bottom half = player 2, middle bar = Back to result + how many have confirmed.
function ncbPadConfirm(o) {
  const h = React.createElement;
  const P = o.dark ? NCB_PAD_DARK : NCB_PAD_LIGHT;
  const UI = NCB_PAD_UI, NUM = NCB_PAD_NUM;
  const sets = o.sets || [0, 0];
  const setScores = o.setScores || [];
  const cs = o.cs || {};
  const done = (cs.p1ok ? 1 : 0) + (cs.p2ok ? 1 : 0);
  const setLine = setScores.map((ss, i) => "Set " + (i + 1) + ": " + ss.p1 + "–" + ss.p2).join("  ·  ");
  const half = idx => {
    const blue = idx === 0;
    const who = blue ? "p1ok" : "p2ok";
    const name = blue ? o.p1 : o.p2;
    const other = blue ? o.p2 : o.p1;
    const won = blue ? !!o.p1Won : !o.p1Won;
    const mine = sets[blue ? 0 : 1], theirs = sets[blue ? 1 : 0];
    const turn = blue ? { transform: "rotate(180deg)" } : {};
    if (cs[who]) {
      return h("section", {
        key: idx, "aria-label": name + " has confirmed",
        style: { flex: 1, minHeight: 0, ...turn, background: blue ? P.cBlueDone : P.cRedDone, color: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }
      }, h("span", {
        style: { width: 76, height: 76, borderRadius: 38, background: "#1FA65A", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 10px " + P.cCheckRing }
      }, ncbPadIcon(40, NCB_PAD_ICONS.check, { sw: 3 })), h("div", {
        style: { font: "800 34px/1.1 " + NUM, wordBreak: "break-word" }
      }, name), h("span", {
        style: { padding: "5px 14px", borderRadius: 999, background: P.cBadgeBg, font: "800 13px " + UI, letterSpacing: "0.12em" }
      }, "CONFIRMED"), h("div", {
        style: { font: "500 15px " + UI, color: P.cSub2 }
      }, (won ? "Won " : "Lost ") + mine + "–" + theirs + " · " + (done >= 2 ? "Everyone has confirmed" : "Waiting for " + other)));
    }
    return h("button", {
      key: idx, type: "button", onClick: () => o.onTap(who),
      style: { flex: 1, minHeight: 0, width: "100%", ...turn, margin: 0, border: "none", background: blue ? P.cBluePending : P.cRedPending, color: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, fontFamily: UI, cursor: "pointer" }
    }, won && h("span", {
      style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: P.cBadgeBg, font: "800 12px " + UI, letterSpacing: "0.12em" }
    }, ncbPadIcon(14, NCB_PAD_ICONS.crown, { fill: "currentColor", sw: 1.5 }), "YOU WON"), h("span", {
      style: { font: "800 34px/1.1 " + NUM, wordBreak: "break-word", textAlign: "center" }
    }, name), h("span", {
      style: { font: "500 15px " + UI, color: P.cSub }
    }, "Check the score, then tap anywhere here"), h("span", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 20px", borderRadius: 16, background: P.cScoreBox, maxWidth: "100%" }
    }, h("span", {
      style: { display: "flex", alignItems: "center", gap: 10, font: "700 16px " + UI, whiteSpace: "nowrap" }
    }, o.p1, h("span", {
      style: { font: "800 30px/1 " + NUM, fontVariantNumeric: "tabular-nums" }
    }, sets[0] + " – " + sets[1]), o.p2), setLine && h("span", {
      style: { font: "600 13px " + UI, color: P.cSub2 }
    }, setLine)), h("span", {
      style: { display: "inline-flex", alignItems: "center", gap: 10, height: 56, padding: "0 28px", borderRadius: 28, background: P.cPill, color: blue ? P.cBlueBtnText : P.cRedBtnText, font: "800 18px " + NUM, letterSpacing: "0.04em", boxShadow: "0 0 0 8px " + (blue ? P.cPillRing : P.cPillRingRed) }
    }, ncbPadIcon(22, NCB_PAD_ICONS.tap), "TAP TO CONFIRM"));
  };
  const dot = on => h("span", {
    style: on ? { display: "block", width: 10, height: 10, borderRadius: 5, background: P.cDotOn } : { display: "block", width: 10, height: 10, borderRadius: 5, border: P.cDotOff, boxSizing: "border-box" }
  });
  return h("div", {
    style: { position: "fixed", inset: 0, zIndex: 99995, display: "flex", flexDirection: "column", boxSizing: "border-box", background: P.cBg, fontFamily: UI, color: "#FFFFFF" }
  }, half(0), h("div", {
    style: { height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: P.cBarBg, borderTop: "1px solid " + P.cBarBorder, borderBottom: "1px solid " + P.cBarBorder }
  }, done < 2 ? h("button", {
    type: "button", onClick: o.onBack,
    style: { height: 44, padding: "0 16px 0 10px", borderRadius: 22, border: P.cBackBorder, background: P.cBackBg, color: P.cBackText, font: "600 14px " + UI, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }
  }, ncbPadIcon(18, NCB_PAD_ICONS.back, { sw: 2.25 }), "Back to result") : h("span", null), h("div", {
    style: { display: "flex", alignItems: "center", gap: 10, font: "600 14px " + UI, color: P.cBarText }
  }, h("span", { "aria-hidden": "true", style: { display: "flex", gap: 6 } }, dot(!!cs.p1ok), dot(!!cs.p2ok)), h("span", null, done + " of 2 confirmed"))), half(1));
}

// FLAG 1033 (score pad redesign, scoring buttons): colours for one scoring button.
// Finish buttons fill stronger with more points (+1 light, +2 medium, +3 solid). Own finish
// buttons keep a calm look, but their "+N" is drawn in the OPPONENT's colour, because the
// opponent is who gets the points. Works in light and dark mode.
function ncbPadTile(o) {
  const dark = !!o.dark;
  const cl = o.cl, opp = o.oppCl;
  const txt = c => dark ? (c === "#2563EB" ? "#6B95F1" : "#E76B6B") : c;
  const ring = dark ? "#FFFFFF" : "#141B2D";
  const ringGap = dark ? "#0F172A" : "#F2F4F9";
  const sel = o.sel ? { boxShadow: "0 0 0 2px " + ringGap + ", 0 0 0 4px " + ring } : {};
  if (o.penalty) {
    return Object.assign({
      border: "2px solid " + (o.sel ? cl : cl + "61"),
      background: o.sel ? cl + "24" : (dark ? "#141C31" : "#FFFFFF"),
      label: dark ? "#DCE3F0" : "#141B2D",
      chipBg: "transparent",
      chip: txt(opp)
    }, sel);
  }
  if (o.p >= 3) {
    return Object.assign({
      border: "2px solid " + cl, background: cl, label: "#FFFFFF",
      chipBg: "rgba(255,255,255,0.22)", chip: "#FFFFFF",
      boxShadow: "0 6px 18px " + cl + "61"
    }, o.sel ? { boxShadow: sel.boxShadow + ", 0 6px 18px " + cl + "61" } : {});
  }
  if (o.p === 2) {
    return Object.assign({
      border: "2px solid " + cl + "9E", background: cl + "4D", label: dark ? "#F4F7FC" : "#141B2D",
      chipBg: "transparent", chip: dark ? "#FFFFFF" : cl
    }, sel);
  }
  return Object.assign({
    border: "2px solid " + cl + "6B", background: cl + "24", label: dark ? "#F4F7FC" : "#141B2D",
    chipBg: "transparent", chip: txt(cl)
  }, sel);
}

// FLAG 1033 (score pad redesign, battle screen): the whole scoring screen in the new layout.
// Colours for light and dark. Player colours stay with the player (p1 blue, p2 red).
function ncbPadTheme(dark) {
  return dark ? {
    page: "#0B1020", chrome: "#0E1426", card: "#121A2E", cardLine: "#1F2946", line: "#1C2540", btn: "#151D33", btnLine: "#26314F",
    text: "#F2F5FA", text2: "#C9D2E3", muted: "#9AA6BF", label: "#8A96B0", own: "#141C31", dash: "#3F4A6B", dotOff: "#56627F",
    amber: "#F5B83D", cardShadow: "none", dockBtn: "#151D33", dockLine: "#2C3756", hint: "#9AA6BF"
  } : {
    page: "#F2F4F9", chrome: "#FFFFFF", card: "#FFFFFF", cardLine: "#E3E7EF", line: "#E3E7EF", btn: "#FFFFFF", btnLine: "#D5DAE6",
    text: "#141B2D", text2: "#3A4458", muted: "#5B6478", label: "#6B7488", own: "#FFFFFF", dash: "#B5BDCE", dotOff: "#B5BDCE",
    amber: "#D98A0B", cardShadow: "0 1px 2px rgba(20,27,45,0.06), 0 4px 16px rgba(20,27,45,0.05)", dockBtn: "#FFFFFF", dockLine: "#D5DAE6", hint: "#5B6478"
  };
}
function ncbPadTxt(dark, cl) {
  return dark ? (cl === "#2563EB" ? "#6B95F1" : "#E76B6B") : (cl === "#2563EB" ? "#1D4ED8" : "#B91C1C");
}
const NCB_PAD_FIN_ICON = {
  SPF: ["M12 3a9 9 0 0 1 9 9", "M12 21a9 9 0 0 1-9-9", "M12 10.5a1.5 1.5 0 1 0 0.01 0"],
  OVR: ["M4 20h16", "M7 15L17 5", "M9 5h8v8"],
  BST: ["M12 2v5", "M12 17v5", "M2 12h5", "M17 12h5", "M4.9 4.9l3.5 3.5", "M15.6 15.6l3.5 3.5", "M4.9 19.1l3.5-3.5", "M15.6 8.4l3.5-3.5"],
  XTR: ["M13 2L4 14h7l-1 8 9-12h-7l1-8z"],
  LER: ["M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"]
};
function ncbPadScoreCard(o) {
  const T = ncbPadTheme(o.dark);
  const side = (d, align) => React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 } },
    React.createElement("div", { style: { maxWidth: "100%", fontSize: 17, fontWeight: 800, color: ncbPadTxt(o.dark, d.cl), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, d.name),
    React.createElement("div", { style: { fontFamily: NCB_PAD_NUM, fontSize: "clamp(56px, 18vw, 76px)", lineHeight: 0.95, fontWeight: 800, color: ncbPadTxt(o.dark, d.cl), fontVariantNumeric: "tabular-nums" } }, d.pts));
  return React.createElement("div", {
    style: { flexShrink: 0, margin: "12px 12px 0", padding: "12px 14px 14px", borderRadius: 18, background: T.card, border: "1px solid " + T.cardLine, boxShadow: T.cardShadow,
      display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", columnGap: 10, fontFamily: NCB_PAD_UI }
  },
    side(o.dA),
    React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 64 } },
      o.bo > 1 && React.createElement("div", { style: { padding: "2px 10px", borderRadius: 999, background: o.dark ? "#1E2844" : "#EEF0F5", fontSize: 14, fontWeight: 700, color: T.text2, fontVariantNumeric: "tabular-nums" } }, o.dA.sets + "–" + o.dB.sets),
      (o.sides.p1Side || o.sides.p2Side) && React.createElement("div", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: T.muted } }, (o.sides.p1Side || "—") + " · " + (o.sides.p2Side || "—")),
      React.createElement("div", { style: { width: 18, height: 2, margin: "2px 0", borderRadius: 2, background: o.dark ? "#34405F" : "#CBD1DD" } }),
      o.target > 0 && React.createElement("div", { style: { fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: T.text } }, "TO " + o.target),
      React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: T.muted, whiteSpace: "nowrap" } }, o.setName)),
    side(o.dB));
}
// The scrolling pad (one column per player) plus the confirm bar at the bottom.
function ncbPadBattleBody(o) {
  const T = ncbPadTheme(o.dark);
  const pend = o.pendingFinish;
  const tile = (side, opp, f) => {
    const active = o.bothCombosSelected;
    const isSel = side.pending?.id === f.id;
    const pt = ncbPadTile({ dark: o.dark, p: f.p, penalty: false, cl: side.cl, oppCl: opp.cl, sel: isSel });
    const icoColor = f.p >= 3 ? "#FFFFFF" : ncbPadTxt(o.dark, side.cl);
    return React.createElement("button", {
      key: f.id, type: "button", disabled: !active, "aria-pressed": isSel,
      onClick: () => { if (active) o.setPendingFinish(isSel ? null : { pi: side.ci, fin: f }); },
      style: Object.assign({
        width: "100%", height: "clamp(48px, 7dvh, 72px)", display: "flex", alignItems: "center", gap: 10, padding: "0 14px 0 12px",
        borderRadius: 14, border: pt.border, background: pt.background, color: pt.label, textAlign: "left", cursor: active ? "pointer" : "not-allowed",
        opacity: !active ? 0.4 : (pend && !isSel ? 0.55 : 1), fontFamily: NCB_PAD_UI, touchAction: "manipulation", flexShrink: 0
      }, pt.boxShadow ? { boxShadow: pt.boxShadow } : {})
    },
      React.createElement("span", { style: { color: icoColor, display: "flex", flex: "none" } }, ncbPadIcon(20, NCB_PAD_FIN_ICON[f.id])),
      React.createElement("span", { style: { flex: "1 1 auto", minWidth: 0, fontSize: "clamp(14px, 4.1vw, 20px)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, f.name.replace(/ Finish$/, "")),
      React.createElement("span", { style: { flex: "none", fontFamily: NCB_PAD_NUM, fontSize: "clamp(26px, 8vw, 32px)", lineHeight: 1, fontWeight: 800, color: pt.chip } }, "+" + f.p));
  };
  const ownTile = (side, opp, f) => {
    const active = o.bothCombosSelected;
    const isSel = side.pending?.id === f.id;
    const pt = ncbPadTile({ dark: o.dark, p: f.p, penalty: true, cl: side.cl, oppCl: opp.cl, sel: isSel });
    return React.createElement("button", {
      key: f.id, type: "button", disabled: !active, "aria-pressed": isSel,
      onClick: () => { if (active) o.setPendingFinish(isSel ? null : { pi: side.ci, fin: f }); },
      style: Object.assign({
        flex: "1 1 0", minWidth: 0, height: 56, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2, padding: "0 6px",
        borderRadius: 12, border: pt.border, background: pt.background, color: pt.label, cursor: active ? "pointer" : "not-allowed", fontFamily: NCB_PAD_UI,
        opacity: !active ? 0.4 : (pend && !isSel ? 0.55 : 1), touchAction: "manipulation"
      }, pt.boxShadow ? { boxShadow: pt.boxShadow } : {})
    },
      React.createElement("span", { style: { fontSize: 13, fontWeight: 600 } }, f.id === "OF2" ? "Own ×2" : "Own ×3"),
      React.createElement("span", { style: { fontFamily: NCB_PAD_NUM, fontSize: 22, lineHeight: 1, fontWeight: 800, color: pt.chip } }, "+" + f.p));
  };
  const column = (side, opp) => {
    const c = side.ri !== null ? (side.deck[side.ri] || {}) : null;
    const bey = c ? [c.blade, c.ratchet, c.bit].filter(Boolean).join(" ") : "Pick combos first";
    const api = o.lerApi[side.ci] || { locked: true, has: false, click: () => {} };
    const n = o.lerStrikes[side.ci] || 0;
    const col = ncbPadTxt(o.dark, side.cl);
    return React.createElement("section", { key: side.ci, style: { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" } },
      React.createElement("div", { style: { height: 50, minWidth: 0, padding: "0 10px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, borderRadius: 12, background: side.cl + "1A", border: "1px solid " + side.cl + "61" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 15, fontWeight: 700, color: col } },
          React.createElement("span", { style: { width: 8, height: 8, flex: "none", borderRadius: "50%", background: side.cl } }),
          React.createElement("span", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, side.name)),
        React.createElement("div", { style: { fontSize: 12, fontWeight: 500, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, bey)),
      React.createElement("div", { style: { margin: "12px 2px 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: T.label } }, "FINISH"),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, o.FINISH.map(f => tile(side, opp, f))),
      React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 10 } }, o.PENALTY.filter(f => f.id !== "LER").map(f => ownTile(side, opp, f))),
      React.createElement("button", {
        type: "button", disabled: api.locked, onClick: api.click,
        style: { marginTop: 12, height: 46, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 12, width: "100%",
          background: api.has ? (o.dark ? "#3A2E0B" : "#FEF9C3") : "transparent", border: api.has ? "1.5px solid #F59E0B" : "1.5px dashed " + T.dash,
          color: T.text2, cursor: api.locked ? "not-allowed" : "pointer", opacity: api.locked ? 0.4 : 1, fontFamily: NCB_PAD_UI, textAlign: "left", touchAction: "manipulation" }
      },
        React.createElement("span", { style: { color: T.amber, display: "flex", flex: "none" } }, ncbPadIcon(16, NCB_PAD_FIN_ICON.LER, { sw: 2.2 })),
        React.createElement("span", { style: { flex: "1 1 auto", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "Launch error"),
        React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 4, flex: "none" } },
          [0, 1].map(i => React.createElement("i", { key: i, style: { width: 9, height: 9, borderRadius: "50%", border: "1.5px solid " + (n > i ? T.amber : T.dotOff), background: n > i ? T.amber : "transparent" } })))));
  };
  // confirm bar
  let dock;
  if (pend) {
    const fin = pend.fin;
    const scorer = fin.penalty ? 1 - pend.pi : pend.pi;
    const scorerD = o.dA.ci === scorer ? o.dA : o.dB;
    const from = o.pts[scorer];
    const to = from + fin.p;
    const ends = o.target > 0 && to >= o.target;
    const finName = fin.penalty ? "Own finish" : fin.name.replace(/ Finish$/, "") + " finish";
    const canConfirm = o.bothCombosSelected;
    dock = React.createElement("div", { style: { height: 64, display: "flex", gap: 10 } },
      React.createElement("button", { type: "button", "aria-label": "Cancel", onClick: () => o.setPendingFinish(null),
        style: { width: 64, flex: "none", display: "grid", placeItems: "center", padding: 0, borderRadius: 14, border: "1px solid " + T.dockLine, background: T.dockBtn, color: T.text2, cursor: "pointer" } }, ncbPadIcon(22, ["M18 6L6 18", "M6 6l12 12"], { sw: 2.2 })),
      React.createElement("button", { type: "button", disabled: !canConfirm, onClick: o.onConfirm,
        style: { flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 18px", border: 0, borderRadius: 14,
          background: scorerD.cl, color: "#fff", boxShadow: (ends ? "inset 0 0 0 2px rgba(255,255,255,0.65), " : "") + "0 8px 24px " + scorerD.cl + "73", textAlign: "left", cursor: "pointer", fontFamily: NCB_PAD_UI, touchAction: "manipulation" } },
        React.createElement("span", { style: { display: "flex", flexDirection: "column", minWidth: 0 } },
          React.createElement("span", { style: { fontSize: 19, lineHeight: 1.2, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "Give " + scorerD.name + " +" + fin.p),
          React.createElement("span", { style: { fontSize: 13, lineHeight: 1.3, fontWeight: 500, color: "rgba(255,255,255,0.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, finName + " · " + from + " → " + to + (ends ? " · ends set" : ""))),
        React.createElement("span", { style: { flex: "none", display: "flex" } }, ends ? ncbPadIcon(24, ["M8 21h8", "M12 17v4", "M7 4h10v5a5 5 0 0 1-10 0V4z", "M17 5h3v2a3 3 0 0 1-3 3", "M7 5H4v2a3 3 0 0 0 3 3"], { sw: 2.2 }) : ncbPadIcon(24, NCB_PAD_ICONS.check, { sw: 2.6 }))));
  } else {
    dock = React.createElement("p", { style: { height: 64, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: T.hint, fontSize: 15, fontWeight: 600, fontFamily: NCB_PAD_UI } },
      ncbPadIcon(18, ["M12 19V5", "M5 12l7-7 7 7"], { sw: 2.2 }), o.bothCombosSelected ? "Tap a result, then confirm it here" : "Waiting for both combos");
  }
  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "12px 12px 4px", display: "flex", gap: 8, alignItems: "flex-start", fontFamily: NCB_PAD_UI } },
      column(o.dA, o.dB),
      React.createElement("div", { "aria-hidden": "true", style: { width: 1, alignSelf: "stretch", flex: "none", background: T.line } }),
      column(o.dB, o.dA)),
    React.createElement("div", { style: { flex: "none", marginTop: 8, padding: "12px 12px calc(12px + env(safe-area-inset-bottom))", background: T.chrome, borderTop: "1px solid " + T.line } }, dock));
}

// ── FLAG 1034: deck builder redesign (Record decks + each player checks their own deck) ──────────
// Ported from a teammate's mock-up (record-decks-redesign.html). The look and the tapping flow are
// the mock's; the data is the app's: decks are MatchScreen's d1/d2 (empty part = null, as before),
// parts come from the parts library (parts / parts.cx), previous combos from the combo registry,
// popular lists / colours / quick combos from core.js. Nothing here sends anything: when both
// players have confirmed, onStart() runs the same steps as the old "Start Match" button.
// The screen's own state (current part, check stage, undo list, search, CX steps) is kept in
// MatchScreen (st / setSt), so it survives the CX Picture Guide opening over it.
// Fast Blast events use it too: only the blade column is shown and checked.
const NCBDB_CSS = `
  .ncbdb-wrap {
    --page: #E6EAF1; --bg: #F4F6FA; --card: #FFFFFF; --ink: #0F172A; --ink-2: #334155; --ink-3: #475569; --muted: #5B6578;
    --line: #E3E8F0; --line-2: #D5DCE7; --track: #E7EBF2; --used-bg: #EEF1F6; --used-line: #E2E7EF; --used-ink: #7A8496;
    --clash: #9A3412; --night: #0F172A; --edge: #DCE2EC; --dash: #C3CCDA; --field: #CBD3E0; --off: #F1F3F7; --hover: #AEB9CB;
    --ready-bg: #DCFCE7; --ready-ink: #166534; --danger: #B91C1C;
    --font: 'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    position: fixed; inset: 0; z-index: 20; overflow: hidden; background: var(--page); color: var(--ink); font-family: var(--font);
    -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; overscroll-behavior: none;
  }
  body.dark .ncbdb-wrap {
    --page: #0B1120; --bg: #0F172A; --card: #1E293B; --ink: #F1F5F9; --ink-2: #CBD5E1; --ink-3: #B4C0D3; --muted: #94A3B8;
    --line: #2A3650; --line-2: #3A4762; --track: #0B1120; --used-bg: #172033; --used-line: #263248; --used-ink: #6B7891;
    --clash: #FDBA74; --night: #020617; --edge: #334155; --dash: #475569; --field: #475569; --off: #172033; --hover: #64748B;
    --ready-bg: rgba(34, 197, 94, 0.18); --ready-ink: #86EFAC; --danger: #F87171;
  }
  .ncbdb button { margin: 0; font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; -webkit-appearance: none; appearance: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .ncbdb button:disabled { cursor: default; }
  .ncbdb button:active:not(:disabled) { transform: scale(0.985); filter: brightness(0.97); }
  .ncbdb h1, .ncbdb h2, .ncbdb p { margin: 0; }
  .ncbdb svg { display: block; flex: none; }
  .ncbdb :focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
  .ncbdb [hidden] { display: none !important; }
  .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .ncbdb {
    --pc: #2563EB; --pc-ink: #1D4ED8; --pc-rgb: 37, 99, 235; --tint: #EEF4FF; --tint-line: #C7D7FB;

    
    --bar-h: 52px;
    --gap-y: 8px;
    --tab-h: 40px;
    --cell-h: 38px;
    --row-gap: 6px;
    --field-pad: 10px;
    --prompt-gap: 8px;
    --input-h: 46px;
    --seg-h: 44px;
    --pin-pad: 12px;
    --pop-h: 44px;
    --sug-h: 46px;
    --ck-gap: 10px;
    --ck-pad: 10px;
    --ck-num: 36px;
    --ck-blade-h: 54px;
    --ck-blade-f: 20px;
    --ck-part-h: 48px;
    --ck-part-f: 18px;
    --ck-name-f: 28px;
    --ck-ban-pad: 14px 16px;
    --dock-pad: 12px;
    --dock-btn-h: 62px;

    position: relative;
    height: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }
  .ncbdb.short {
    --bar-h: 48px; --gap-y: 6px; --tab-h: 36px; --cell-h: 34px; --row-gap: 4px;
    --field-pad: 8px; --prompt-gap: 6px; --input-h: 44px; --seg-h: 40px;
    --pin-pad: 8px; --pop-h: 40px; --sug-h: 42px;
    --ck-gap: 8px; --ck-pad: 8px; --ck-blade-h: 48px; --ck-blade-f: 19px; --ck-part-h: 44px; --ck-part-f: 17px;
    --ck-name-f: 24px; --ck-ban-pad: 10px 14px; --dock-pad: 10px; --dock-btn-h: 58px;
  }
  .ncbdb.dense {
    --ck-gap: 6px; --ck-pad: 6px; --ck-num: 30px; --ck-blade-h: 40px; --ck-blade-f: 17px; --ck-part-h: 36px; --ck-part-f: 15px;
    --ck-name-f: 20px; --ck-ban-pad: 8px 12px; --dock-pad: 8px; --dock-btn-h: 54px;
  }
  .ncbdb.kb { --gap-y: 6px; --cell-h: 30px; --row-gap: 4px; --field-pad: 6px; --prompt-gap: 4px; --input-h: 44px; }
  .ncbdb.kb .tabs { display: none; }
  .ncbdb.kb-min .deck { display: none; }
  .ncbdb .top { flex: none; }
  .ncbdb .main { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .ncbdb .bar {
    flex: none;
    height: calc(var(--bar-h) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 6px 0 2px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--card);
    border-bottom: 1px solid var(--line);
  }
  .ncbdb .icon-btn { width: 44px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: 10px; background: transparent; color: var(--ink-2); }
  .ncbdb .bar-title { flex: 1 1 auto; min-width: 0; font-size: 18px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .pill { flex: none; margin-right: 4px; padding: 4px 10px; border-radius: 999px; background: var(--track); color: var(--ink-2); font-size: 13px; font-weight: 700; white-space: nowrap; }
  .ncbdb .bar-btn { height: 40px; flex: none; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--card); color: var(--ink); font-size: 15px; font-weight: 600; }
  .ncbdb .bar-btn:disabled { color: #94A3B8; }
  .ncbdb .tabs { flex: none; padding: var(--gap-y) 12px 0; }
  .ncbdb .tabs-track { display: grid; grid-template-columns: minmax(0, auto) minmax(0, auto); gap: 4px; padding: 4px; border-radius: 14px; background: var(--track); }
  .ncbdb .tab { min-width: 0; height: var(--tab-h); display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; border: none; border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 15px; font-weight: 700; }
  .ncbdb .tab.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14); }
  .ncbdb .tab-dot { width: 10px; height: 10px; flex: none; border-radius: 50%; }
  .ncbdb .tab-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .tab-count { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--line-2); color: var(--ink-2); font-size: 12px; font-weight: 700; }
  .ncbdb .tab.on .tab-count { background: var(--track); }
  .ncbdb .tab .tab-count.ready { background: var(--ready-bg); color: var(--ready-ink); }
  .ncbdb .deck { flex: none; padding: var(--gap-y) 12px 0; }
  .ncbdb .deck-card { padding: var(--gap-y); border-radius: 16px; background: var(--card); border: 1px solid var(--line); display: flex; flex-direction: column; gap: var(--row-gap); }
  .ncbdb .deck-row { display: grid; grid-template-columns: 26px minmax(0, 1.55fr) minmax(0, 1fr) minmax(0, 1.2fr); gap: 6px; align-items: center; }
  .ncbdb .badge { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--track); color: var(--ink-2); font-size: 13px; font-weight: 800; }
  .ncbdb .badge.now { background: var(--card); color: var(--pc-ink); box-shadow: inset 0 0 0 2px var(--pc); }
  .ncbdb .badge.done { background: var(--pc); color: #FFFFFF; box-shadow: none; }
  .ncbdb .cell { height: var(--cell-h); min-width: 0; display: flex; align-items: center; gap: 6px; padding: 0 9px; border-radius: 10px; border: 1px solid var(--edge); background: var(--card); color: var(--ink); font-size: 13px; font-weight: 600; text-align: left; }
  .ncbdb .cell .t { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .cell.empty { border: 1.5px dashed var(--dash); background: var(--bg); color: var(--muted); font-weight: 500; }
  .ncbdb .cell.builtin { border-color: var(--bg); background: var(--bg); color: var(--muted); font-weight: 500; font-style: italic; }
  .ncbdb .cell.now { border: 1.5px solid var(--pc); background: var(--card); box-shadow: 0 0 0 3px rgba(var(--pc-rgb), 0.22); }
  .ncbdb .cell.now.empty { color: var(--pc-ink); font-weight: 700; }
  .ncbdb .cell-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.18); }
  .ncbdb .field { flex: none; padding: var(--field-pad) 12px 0; }
  .ncbdb .prompt { height: 20px; display: flex; font-size: 15px; line-height: 20px; font-weight: 700; white-space: pre; overflow: hidden; }
  .ncbdb .prompt:focus { outline: none; }
  .ncbdb .prompt-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .prompt-rest { flex: none; }
  .ncbdb .search { margin-top: var(--prompt-gap); height: var(--input-h); display: flex; align-items: center; gap: 8px; padding: 0 5px 0 12px; border-radius: 12px; background: var(--card); border: 1.5px solid var(--field); color: var(--muted); }
  .ncbdb .search:focus-within { border-color: var(--pc); box-shadow: 0 0 0 3px rgba(var(--pc-rgb), 0.18); }
  .ncbdb .search input { flex: 1 1 auto; min-width: 0; height: 40px; padding: 0; border: none; outline: none; background: transparent; color: var(--ink); font: inherit; font-size: 16px; }
  .ncbdb .search input::placeholder { color: var(--muted); opacity: 1; }
  .ncbdb .q-clear { width: 36px; height: 36px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: 8px; background: var(--used-bg); color: var(--ink-2); }
  .ncbdb .segwrap { flex: none; padding: var(--gap-y) 12px 0; }
  .ncbdb .seg-track { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--track); }
  .ncbdb .seg { flex: 1 1 0; min-width: 0; height: var(--seg-h); padding: 0; border: none; border-radius: 9px; background: transparent; color: var(--ink-3); font-size: 15px; font-weight: 700; }
  .ncbdb .seg.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14); }
  .ncbdb .scroller { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .ncbdb .pinned { flex: none; padding: var(--pin-pad) 12px; background: var(--bg); border-bottom: 1px solid var(--edge); }
  .ncbdb .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 12px 12px calc(24px + env(safe-area-inset-bottom)); }
  .ncbdb .scroller.unpin { display: block; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .ncbdb .scroller.unpin .pinned { padding-bottom: 6px; border-bottom: none; }
  .ncbdb .scroller.unpin .body { overflow: visible; }
  .ncbdb.flow { overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .ncbdb.flow > .main { flex: none; display: block; }
  .ncbdb.flow .scroller { display: block; overflow: visible; }
  .ncbdb.flow .body { overflow: visible; }
  .ncbdb.flow > .dock { position: sticky; bottom: 0; }
  .ncbdb .label { margin: 0 2px 8px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .ncbdb .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 2px 8px; }
  .ncbdb .label-row .label { flex: none; margin: 0; }
  .ncbdb .hint { min-width: 0; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .grid { display: grid; gap: 8px; }
  .ncbdb .g2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ncbdb .g3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ncbdb .g4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ncbdb .g5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .ncbdb .mb { margin-bottom: 18px; }
  .ncbdb .az-head { grid-column: 1 / -1; margin: 6px 2px 0; font-size: 13px; font-weight: 800; color: var(--muted); }
  .ncbdb .chip { position: relative; min-width: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--line-2); background: var(--card); color: var(--ink); }
  .ncbdb .chip-t { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .chip-blade { height: 46px; justify-content: flex-start; gap: 8px; padding: 0 10px 0 12px; border-width: 2px; border-radius: 12px; font-size: 15px; font-weight: 600; text-align: left; }
  .ncbdb .chip-blade .chip-t { flex: 1 1 auto; }
  .ncbdb .chip-ratchet { height: 44px; padding: 0 2px; border-radius: 10px; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ncbdb .pinned .chip-ratchet { height: var(--pop-h); }
  .ncbdb .chip-ratchet.mx { padding: 0; font-size: 13px; }
  .ncbdb .chip-ratchet.word { padding: 0 8px; font-size: 14px; font-weight: 600; }
  .ncbdb .g5 > .chip-ratchet.word { grid-column: span 2; }
  .ncbdb .chip-bit { height: 44px; padding: 0 8px; border-radius: 10px; font-size: 14px; font-weight: 600; }
  .ncbdb .chip-bit.lg { height: 46px; border-radius: 12px; font-size: 15px; }
  .ncbdb .chip.used { background: var(--used-bg); border-color: var(--used-line); color: var(--used-ink); }
  .ncbdb .chip.cur { box-shadow: 0 0 0 3px rgba(var(--pc-rgb), 0.35); }
  .ncbdb .chip.cur:not(.colored) { background: var(--tint); border-color: var(--pc); }
  .ncbdb [data-used]::after { content: attr(data-used); position: absolute; top: -7px; right: -5px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #475569; color: #FFFFFF; font-size: 10px; font-weight: 800; letter-spacing: 0; }
  .ncbdb .chip-blade[data-used]::after { position: static; width: 20px; height: 20px; flex: none; font-size: 11px; }
  .ncbdb .chip-ratchet.mx[data-used]::after { top: -6px; right: -4px; width: 16px; height: 16px; }
  .ncbdb .cc { min-height: 58px; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line-2); background: var(--card); color: var(--ink); text-align: left; }
  .ncbdb .cc-blade { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .cc-sub { font-size: 13px; font-weight: 500; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .cc.off { background: var(--off); border-color: var(--used-line); color: var(--used-ink); }
  .ncbdb .cc.off .cc-sub { color: var(--clash); }
  .ncbdb .use-all { min-height: 58px; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 12px; border: none; border-radius: 12px; background: var(--pc); color: #FFFFFF; font-size: 15px; font-weight: 700; }
  .ncbdb .sug-grid { margin-bottom: 12px; }
  .ncbdb .sug { height: var(--sug-h); min-width: 0; padding: 0 12px; border-radius: 12px; border: 1px solid var(--tint-line); background: var(--tint); color: var(--ink); font-size: 15px; font-weight: 700; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .sug:disabled { background: var(--off); border-color: var(--used-line); color: var(--used-ink); }
  .ncbdb .combo { margin-bottom: 18px; padding: 14px; border-radius: 16px; background: var(--tint); border: 1px solid var(--tint-line); }
  .ncbdb .combo-label { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
  .ncbdb .combo-title { margin-top: 6px; font-size: 19px; line-height: 1.25; font-weight: 700; overflow-wrap: anywhere; }
  .ncbdb .combo-sub { margin-top: 2px; font-size: 14px; color: var(--ink-3); }
  .ncbdb .combo-sub.clash { color: var(--clash); }
  .ncbdb .combo-btn { margin-top: 12px; width: 100%; height: 48px; padding: 0 14px; border: none; border-radius: 12px; background: var(--pc); color: #FFFFFF; font-size: 16px; font-weight: 700; white-space: nowrap; }
  .ncbdb .combo-btn:disabled { background: #94A3B8; }
  .ncbdb.kb .combo { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 10px; margin-bottom: 12px; padding: 8px 8px 8px 12px; }
  .ncbdb.kb .combo-label, .ncbdb.kb .combo-sub:not(.clash) { display: none; }
  .ncbdb.kb .combo-title { grid-column: 1; margin: 0; font-size: 16px; }
  .ncbdb.kb .combo-sub { grid-column: 1; margin: 0; font-size: 13px; }
  .ncbdb.kb .combo-btn { grid-column: 2; grid-row: 1 / span 2; width: auto; height: 44px; margin: 0; font-size: 15px; }
  .ncbdb .none { padding: 18px; border-radius: 14px; background: var(--card); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; color: var(--ink-2); overflow-wrap: anywhere; }
  .ncbdb .crumbs { display: flex; gap: 6px; margin-bottom: 14px; }
  .ncbdb .crumb { flex: 1 1 0; min-width: 0; height: 54px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; padding: 0 9px; border-radius: 12px; border: 1.5px dashed var(--dash); background: var(--bg); color: var(--ink); text-align: left; }
  .ncbdb .crumb-label { max-width: 100%; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .crumb-value { max-width: 100%; font-size: 15px; font-weight: 700; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .crumb.set { border: 1px solid var(--line-2); background: var(--card); }
  .ncbdb .crumb.set .crumb-value { color: var(--ink); }
  .ncbdb .crumb.cur { border: 2px solid var(--pc); background: var(--tint); }
  .ncbdb .crumb.cur .crumb-label, .ncbdb .crumb.cur:not(.set) .crumb-value { color: var(--pc-ink); }
  .ncbdb .crumbs.four .crumb { padding: 0 6px; }
  .ncbdb .crumbs.four .crumb-value { font-size: clamp(12px, 3.5vw, 15px); }
  .ncbdb .cx-opt { position: relative; height: 52px; min-width: 0; padding: 0 4px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card); color: var(--ink); font-size: 15px; font-weight: 600; white-space: nowrap; }
  .ncbdb .cx-opt.on { border: 2px solid var(--pc); background: var(--tint); }
  .ncbdb .cx-opt:disabled { background: var(--used-bg); border-color: var(--used-line); color: var(--used-ink); }
  .ncbdb .cx-opt[data-tag]::after { content: attr(data-tag); position: absolute; top: -7px; right: -4px; padding: 1px 6px; border-radius: 999px; background: var(--ink); color: var(--card); font-size: 9px; font-weight: 800; letter-spacing: 0.04em; }
  .ncbdb .mx-head, .ncbdb .mx-row { display: grid; gap: 6px; margin-bottom: 6px; align-items: center; }
  .ncbdb .mx-head { font-size: 12px; font-weight: 700; color: var(--muted); text-align: center; }
  .ncbdb .mx-label { font-size: 14px; font-weight: 800; color: var(--muted); text-align: center; }
  .ncbdb .mx-none { height: 44px; border-radius: 10px; border: 1px dashed var(--line); }
  .ncbdb .mx-other { margin-top: 18px; }
  .ncbdb .mx-head.tight, .ncbdb .mx-row.tight { gap: 4px; }
  .ncbdb .mx-row.tight .chip-ratchet.mx { font-size: 11px; letter-spacing: -0.02em; }
  .ncbdb .card { padding: 18px; border-radius: 16px; background: var(--card); border: 1px solid var(--line); }
  .ncbdb .card-title { font-size: 18px; font-weight: 700; }
  .ncbdb .card-title:focus, .ncbdb .ck-name:focus, .ncbdb .cover-title:focus { outline: none; }
  .ncbdb .card-text { margin-top: 6px; font-size: 15px; line-height: 1.45; color: var(--ink-3); }
  .ncbdb .card-btn { margin-top: 14px; width: 100%; min-height: 48px; padding: 6px 14px; border: none; border-radius: 12px; background: var(--night); color: #FFFFFF; font-size: 16px; font-weight: 700; }
  .ncbdb .card-btn.ghost { border: 1px solid var(--line-2); background: var(--card); color: var(--ink); }
  .ncbdb .locked { margin-top: min(72px, 8vh); padding: 28px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .ncbdb .locked .card-title { margin-top: 16px; font-size: 22px; }
  .ncbdb .ok-ring { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #DCFCE7; color: #15803D; }
  .ncbdb .ck-banner { padding: var(--ck-ban-pad); border-radius: 16px; background: var(--tint); border: 2px solid var(--pc); }
  .ncbdb .ck-who { display: flex; align-items: center; gap: 10px; }
  .ncbdb .ck-dot { width: 14px; height: 14px; flex: none; border-radius: 50%; background: var(--pc); }
  .ncbdb .ck-name { min-width: 0; font-size: var(--ck-name-f); line-height: 1.15; font-weight: 800; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .ncbdb .ck-q { margin-top: 4px; font-size: 16px; color: var(--ink-2); }
  .ncbdb .ck-card { display: grid; grid-template-columns: var(--ck-num) minmax(0, 1fr) minmax(0, 1fr); gap: 6px 8px; align-items: center; margin-top: var(--ck-gap); padding: var(--ck-pad); border-radius: 16px; background: var(--card); border: 1px solid var(--line); }
  .ncbdb .ck-num { grid-row: 1 / 3; width: var(--ck-num); height: var(--ck-num); display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--pc); color: #FFFFFF; font-size: 18px; font-weight: 800; }
  .ncbdb .ck-cell { min-width: 0; min-height: var(--ck-part-h); display: flex; align-items: center; padding: 3px 14px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card); color: var(--ink); font-size: var(--ck-part-f); font-weight: 600; text-align: left; }
  .ncbdb .ck-cell .t { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .ck-blade { grid-column: 2 / 4; min-height: var(--ck-blade-h); border-width: 2px; font-size: var(--ck-blade-f); font-weight: 700; line-height: 1.15; }
  .ncbdb .ck-blade .t { white-space: normal; overflow-wrap: anywhere; }
  .ncbdb .ck-cell.builtin { border-color: var(--bg); background: var(--bg); color: var(--muted); font-weight: 500; font-style: italic; }
  .ncbdb .ck-hint { margin-top: 14px; font-size: 15px; color: var(--ink-3); text-align: center; }
  .ncbdb[data-stage="check"] .body { padding-bottom: 12px; }
  .ncbdb.short .ck-hint { margin-top: 10px; }
  .ncbdb.dense .ck-banner { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0 10px; }
  .ncbdb.dense .ck-who { min-width: 0; }
  .ncbdb.dense .ck-q { flex: none; margin: 0; font-size: 14px; }
  .ncbdb.dense .ck-num { font-size: 16px; }
  .ncbdb.dense .ck-card { gap: 4px 8px; }
  .ncbdb.dense .ck-hint { margin-top: 8px; font-size: 14px; }
  .ncbdb[data-stage="cover"] .scroller, .ncbdb[data-stage="cover"] .body { background: var(--night); }
  .ncbdb .cover { padding: min(88px, 9vh) 8px 0; display: flex; flex-direction: column; align-items: center; text-align: center; color: #FFFFFF; }
  .ncbdb .cover-eye { width: 76px; height: 76px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #1E293B; color: #E2E8F0; }
  .ncbdb .cover-title { margin-top: 22px; max-width: 100%; font-size: 30px; line-height: 1.2; font-weight: 800; overflow-wrap: anywhere; }
  .ncbdb .cover-text { margin-top: 10px; font-size: 18px; line-height: 1.4; color: #E2E8F0; }
  .ncbdb .cover-done { margin-top: 24px; max-width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: #1E293B; color: #BBF7D0; font-size: 15px; font-weight: 600; }
  .ncbdb .cover-done span { min-width: 0; overflow-wrap: anywhere; }
  .ncbdb[data-stage="cover"] :focus-visible { outline-color: #FFFFFF; }
  .ncbdb .toast-slot { flex: none; position: relative; }
  .ncbdb:not([data-stage="build"]) .toast-slot { height: 0; }
  .ncbdb:not([data-stage="build"]) .notice { position: absolute; left: 0; right: 0; bottom: 0; }
  .ncbdb .notice { margin: 0 12px 12px; padding: 12px 14px; border-radius: 14px; background: var(--night); color: #FFFFFF; display: flex; align-items: center; gap: 10px; font-size: 15px; line-height: 1.3; font-weight: 600; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25); }
  .ncbdb .notice svg { color: #4ADE80; }
  .ncbdb .notice.warn svg { color: #FBBF24; }
  .ncbdb .notice.info svg { color: #93C5FD; }
  .ncbdb .notice span { min-width: 0; }
  .ncbdb[data-stage="cover"] .notice { background: #1E293B; }
  .ncbdb .dock { flex: none; padding: var(--dock-pad) 12px calc(var(--dock-pad) + env(safe-area-inset-bottom)); background: var(--card); border-top: 1px solid var(--line); }
  .ncbdb[data-stage="cover"] .dock { background: var(--night); border-top-color: var(--night); }
  .ncbdb .dock-btn { width: 100%; min-height: var(--dock-btn-h); display: flex; align-items: center; gap: 10px; padding: 6px 18px; border: none; border-radius: 14px; background: var(--pc); color: #FFFFFF; text-align: left; }
  .ncbdb .dock-btn.confirm { justify-content: space-between; }
  .ncbdb .dock-btn.reveal { justify-content: center; font-size: 19px; font-weight: 700; }
  .ncbdb .dock-btn.reveal span { min-width: 0; line-height: 1.2; overflow-wrap: anywhere; }
  .ncbdb .confirm-text { display: flex; flex-direction: column; min-width: 0; }
  .ncbdb .confirm-title { max-width: 100%; display: flex; font-size: 19px; line-height: 1.2; font-weight: 700; white-space: pre; }
  .ncbdb .confirm-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .confirm-verb { flex: none; }
  .ncbdb .confirm-sub { font-size: 13px; line-height: 1.35; font-weight: 500; }
  .ncbdb .menu-backdrop { position: fixed; inset: 0; z-index: 5; cursor: pointer; }
  .ncbdb .menu { position: absolute; top: calc(env(safe-area-inset-top) + var(--bar-h) - 2px); right: 8px; z-index: 6; width: 264px; max-width: calc(100% - 16px); padding: 6px; display: flex; flex-direction: column; border-radius: 14px; background: var(--card); border: 1px solid var(--line); box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18); }
  .ncbdb .menu-item { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 6px 12px; border: none; border-radius: 10px; background: transparent; color: var(--ink); font-size: 15px; line-height: 1.25; font-weight: 600; text-align: left; }
  .ncbdb .menu-item.danger { color: var(--danger); }
  .ncbdb .mi-text { flex: 1 1 auto; min-width: 0; }
  .ncbdb .switch { position: relative; width: 36px; height: 22px; flex: none; border-radius: 999px; background: #94A3B8; }
  .ncbdb .switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF; }
  .ncbdb .switch.on { background: #15803D; }
  .ncbdb .switch.on::after { left: 16px; }
  @media (hover: hover) {
  .ncbdb .chip:hover:not(:disabled):not(.colored), .ncbdb .cx-opt:hover:not(:disabled):not(.on) { border-color: var(--hover); }
  .ncbdb .menu-item:hover, .ncbdb .icon-btn:hover { background: var(--used-bg); }

  }
  @media (max-width: 359px) {
  .ncbdb .mx-head, .ncbdb .mx-row { gap: 4px; }
  .ncbdb .chip-ratchet.mx { font-size: 12px; }
  .ncbdb .cx-opt { font-size: 14px; }
  .ncbdb .tab { gap: 5px; padding: 0 6px; font-size: 14px; }
  .ncbdb .cell { gap: 4px; padding: 0 6px; font-size: 12px; }

  }
  @media (prefers-reduced-motion: no-preference) {
  .ncbdb button { transition: transform 0.06s ease-out; }
  .ncbdb .notice { animation: ncbdbRise 0.18s ease-out both; }
  .ncbdb .dock-btn { animation: ncbdbArm var(--arm, 600ms) ease-out both; }

  }
  @keyframes ncbdbRise {
 from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } 
  }
  @keyframes ncbdbArm {
 from { opacity: 0.45; } to { opacity: 1; } 
  }
  .ncbdb .label-row .hint { flex: 1 1 auto; text-align: right; }
  .ncbdb .label-row .label.shrink { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncbdb .link-btn { flex: none; align-self: center; height: 30px; display: flex; align-items: center; gap: 5px; margin: -6px -4px -6px 0; padding: 0 8px; border: none; border-radius: 8px; background: transparent; color: var(--pc-ink); font-size: 13px; font-weight: 700; white-space: nowrap; }
  .ncbdb .link-btn.danger { color: var(--danger); }
  .ncbdb .link-btn:hover { background: var(--used-bg); }
`;
function ncbdbEnsureCss() {
  try {
    if (document.getElementById("ncbdb-css")) return;
    const st = document.createElement("style");
    st.id = "ncbdb-css";
    st.textContent = NCBDB_CSS;
    document.head.appendChild(st);
  } catch (e) {}
}
// Player colours: color = buttons and outlines, ink = the same colour dark (or light) enough for small text,
// tint / line = light fills. Player 1 blue, player 2 red, as everywhere else in the app.
const NCBDB_PLAYER_COLORS = {
  light: [
    { color: "#2563EB", ink: "#1D4ED8", rgb: "37, 99, 235", tint: "#EEF4FF", line: "#C7D7FB" },
    { color: "#DC2626", ink: "#B91C1C", rgb: "220, 38, 38", tint: "#FEF2F2", line: "#F6C8C8" }
  ],
  dark: [
    { color: "#3B82F6", ink: "#93C5FD", rgb: "59, 130, 246", tint: "rgba(59, 130, 246, 0.16)", line: "rgba(59, 130, 246, 0.45)" },
    { color: "#EF4444", ink: "#FCA5A5", rgb: "239, 68, 68", tint: "rgba(239, 68, 68, 0.16)", line: "rgba(239, 68, 68, 0.45)" }
  ]
};
const NCBDB_ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  dots: '<path d="M12 5h.01"/><path d="M12 12h.01"/><path d="M12 19h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'
};
function ncbdbIcon(name, size, stroke) {
  return React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true",
    dangerouslySetInnerHTML: { __html: NCBDB_ICONS[name] }
  });
}
const NCBDB_CFG = {
  tapGuardMs: 300,     // a second tap on the same spot inside this window is ignored (not Undo)
  stageGuardMs: 600,   // "confirms", "Show deck" and Back ignore taps for this long after a check screen appears
  noticeMs: 3200,      // how long a notice stays up
  minListPx: 150,      // Popular ratchets stay pinned only while the list below keeps this much room
  hideKey: "ncblast.deckHideBetween" // device setting: blank screen between the two deck checks
};
const NCBDB_PARTS = ["blade", "ratchet", "bit"];
const ncbdbClone = o => JSON.parse(JSON.stringify(o));
const ncbdbCap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ncbdbOther = i => (i === 0 ? 1 : 0);
const ncbdbByName = (a, b) => a.localeCompare(b);
const ncbdbCxBlank = () => ({ step: "chip", chip: "", blade: "", over: "", assist: "" });
function ncbdbReadHide() {
  try { return localStorage.getItem(NCBDB_CFG.hideKey) !== "0"; } catch (e) { return true; }
}
// Fresh screen state for decks that may already hold parts (a resumed match, or Back from the next screen).
function ncbdbInitState(d1, d2, need) {
  const gap = deck => {
    for (let c = 0; c < 3; c++) for (const p of NCBDB_PARTS) if (need(deck[c], p) && !deck[c][p]) return { c, p };
    return null;
  };
  const a1 = gap(d1), a2 = gap(d2);
  return {
    player: a1 || !a2 ? 0 : 1,
    active: a1 || a2 || null,
    check: null, fix: null, hist: [],
    query: "", seg: "std", cx: ncbdbCxBlank(), menu: false,
    hide: ncbdbReadHide()
  };
}

function DeckBuilderV2(props) {
  const h = React.createElement;
  const { d1, d2, setD1, setD2, parts, eventFast, dark } = props;
  ncbdbEnsureCss();

  /* ---------- Parts, from the parts library ---------- */
  const lists = useMemo(() => {
    const pcx = parts && parts.cx || {};
    const crossover = pcx.crossover || CROSSOVER_BLADES;
    const cx = {
      chips: pcx.gear_chips || CX_CHIPS,
      blades: pcx.cx_blades || CX_BLADES,
      cxeBlades: pcx.cxe_blades || CXE_BLADES,
      overBlades: pcx.cxe_over || CXE_OVER_BLADES,
      assists: pcx.assist || CX_ASSISTS,
      popularAssists: CX_ASSIST_TOP5,
      plainChip: "Standard" // left out of the blade's name, and may repeat in a deck
    };
    const notStandard = new Set([...crossover, ...cx.chips, ...cx.blades, ...cx.cxeBlades, ...cx.overBlades, ...cx.assists]);
    const blades = [...new Set((parts && parts.blades || []).filter(n => n && !notStandard.has(n)))];
    const quick = QUICK_COMBOS.map(q => ({ blade: q.blade || null, ratchet: q.ratchet || null, bit: q.bit || null }));
    return {
      blades, crossover, cx, quick,
      ratchets: parts && parts.ratchets || [],
      bits: parts && parts.bits || [],
      popular: { blade: TOP10.blades || [], ratchet: TOP10.ratchets || [], bit: TOP10.bits || [] }
    };
  }, [parts]);
  const CX = lists.cx;
  const builtInRatchet = new Set(NO_RATCHET_BLADES);
  const builtInBit = new Set(NO_BIT_RATCHETS);
  const repeatable = new Set(["No Ratchet"]); // not a physical part, so it may appear in more than one combo

  const pal = NCBDB_PLAYER_COLORS[dark ? "dark" : "light"];
  const P = [props.p1, props.p2].map((n, i) => Object.assign({ name: String(n || "Player " + (i + 1)) }, pal[i]));
  const prevOf = i => (props.prev && props.prev[i] || []).slice(0, 3);
  const decks = [d1, d2];

  /* ---------- Rules ---------- */
  // Does this combo need the part? Fast Blast: only the blade. Some blades have the ratchet built in, some ratchets the bit.
  function need(c, p) {
    if (p === "blade") return true;
    if (eventFast) return false;
    if (p === "ratchet") return !(c.blade && builtInRatchet.has(c.blade));
    return !(c.ratchet && builtInBit.has(c.ratchet));
  }
  const s = props.st || ncbdbInitState(d1, d2, need);
  function nextEmpty(deck) {
    for (let c = 0; c < 3; c++) for (const p of NCBDB_PARTS) if (need(deck[c], p) && !deck[c][p]) return { c, p };
    return null;
  }
  function progress(deck) {
    let done = 0, total = 0;
    for (const c of deck) for (const p of NCBDB_PARTS) if (need(c, p)) { total++; if (c[p]) done++; }
    return { done, total };
  }
  // Which other combo in this deck already has the part (-1 when none).
  function usedIn(deck, p, name, except) {
    if (!name || repeatable.has(name)) return -1;
    for (let c = 0; c < 3; c++) if (c !== except && deck[c][p] === name) return c;
    return -1;
  }
  // "Emperor Blast Heavy" back into its pieces. null for a blade that is not CX.
  function cxParts(name) {
    const w = String(name || "").split(" ");
    const e = w.findIndex(x => CX.cxeBlades.includes(x));
    if (e >= 0) {
      if (e > 1 || w.length !== e + 3 || !CX.overBlades.includes(w[e + 1]) || !CX.assists.includes(w[e + 2])) return null;
      if (e === 1 && !CX.chips.includes(w[0])) return null;
      return { chip: e ? w[0] : CX.plainChip, blade: w[e], over: w[e + 1], assist: w[e + 2] };
    }
    if (w.length === 3 && CX.chips.includes(w[0]) && CX.blades.includes(w[1]) && CX.assists.includes(w[2])) return { chip: w[0], blade: w[1], over: "", assist: w[2] };
    if (w.length === 2 && CX.blades.includes(w[0]) && CX.assists.includes(w[1])) return { chip: CX.plainChip, blade: w[0], over: "", assist: w[1] };
    return null;
  }
  // CX pieces already used by the other combos in this deck: piece name -> combo index.
  function cxUsed(deck, except) {
    const used = { chip: {}, blade: {}, over: {}, assist: {} };
    deck.forEach((c, i) => {
      const x = i === except ? null : cxParts(c.blade);
      if (!x) return;
      if (x.chip !== CX.plainChip) used.chip[x.chip] = i;
      used.blade[x.blade] = i;
      if (x.over) used.over[x.over] = i;
      used.assist[x.assist] = i;
    });
    return used;
  }
  // Why a combo cannot go in slot ci ('' when it can): no part twice in one deck.
  function clashOf(deck, ci, c) {
    for (const p of NCBDB_PARTS) {
      const u = usedIn(deck, p, c[p], ci);
      if (u >= 0) return `${c[p]} is in combo ${u + 1}`;
    }
    const x = cxParts(c.blade);
    if (x) {
      const used = cxUsed(deck, ci);
      for (const k of ["chip", "blade", "over", "assist"]) {
        if (x[k] && used[k][x[k]] !== undefined) return `${x[k]} is in combo ${used[k][x[k]] + 1}`;
      }
    }
    return "";
  }
  const bothBuiltOf = dk => !nextEmpty(dk[0]) && !nextEmpty(dk[1]);
  // build: picking parts (also while fixing a part from a check screen)
  // check: one player's deck on screen for that player to confirm
  // cover: both decks hidden while the phone goes to the other player
  function stageOf(S, dk) {
    if (!S.check || S.active || !bothBuiltOf(dk)) return "build";
    return S.check.cover ? "cover" : "check";
  }

  /* ---------- Notices (only this screen) ---------- */
  const [notice, setNotice] = useState(null); // { text, kind, id }
  const noticeId = useRef(0);
  function notify(text, kind) {
    const id = ++noticeId.current;
    setNotice({ text, kind: kind || "ok", id });
    setTimeout(() => setNotice(n => (n && n.id === id ? null : n)), NCBDB_CFG.noticeMs);
  }
  function clearNotice() {
    noticeId.current++;
    setNotice(null);
  }
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported (iPhone) */ }
  }

  /* ---------- Actions ----------
     Each action works on a copy S of the screen state plus S.decks, the same way the mock-up
     changes its state, and act() hands the result back to MatchScreen in one go. */
  function act(fn) {
    const S = Object.assign({}, s, { hist: s.hist.slice(), decks: [d1, d2] });
    if (fn(S) === false) return;
    const dk = S.decks;
    delete S.decks;
    props.setSt(S);
    if (dk[0] !== d1) setD1(dk[0]);
    if (dk[1] !== d2) setD2(dk[1]);
  }
  const snapshot = S => ncbdbClone({ player: S.player, decks: S.decks, active: S.active, check: S.check, fix: S.fix });
  function resetPicker(S) {
    S.query = "";
    S.seg = "std";
    S.cx = ncbdbCxBlank();
    S.menu = false;
  }
  // Store new decks, then move to the next empty part: same player first, then the other player, then the check.
  function commit(S, nd, player, note) {
    S.hist.push(snapshot(S));
    if (S.hist.length > 60) S.hist.shift();
    let who = player, active = nextEmpty(nd[player]), msg = note || "";
    if (!active) {
      const o = ncbdbOther(player), gap = nextEmpty(nd[o]);
      if (gap) { who = o; active = gap; msg = `${P[player].name}'s deck is done. Now ${P[o].name}'s.`; }
    }
    if (!active) {
      // Both decks are built. The check starts with the player whose deck is already on screen,
      // so no other deck ever appears without a deliberate tap.
      const ck = S.check;
      S.check = ck && ck.order[ck.i] === who ? { order: ck.order, i: ck.i, cover: false } : { order: [who, ncbdbOther(who)], i: 0, cover: false };
      S.fix = null;
    }
    S.decks = nd;
    S.player = who;
    S.active = active;
    resetPicker(S);
    if (msg) notify(msg, "ok"); else clearNotice();
  }
  // Put parts into the combo being built. Returns false, with a notice, when a part is already used.
  function fill(parts2) {
    let ok = false;
    act(S => {
      const a = S.active;
      if (!a) return false;
      const nd = ncbdbClone(S.decks), deck = nd[S.player], c = deck[a.c];
      for (const p of NCBDB_PARTS) if (p in parts2) c[p] = parts2[p] || null;
      if (eventFast) { c.ratchet = null; c.bit = null; }
      if (c.blade && builtInRatchet.has(c.blade)) c.ratchet = null;
      if (c.ratchet && builtInBit.has(c.ratchet)) c.bit = null;
      const clash = clashOf(deck, a.c, c);
      if (clash) {
        notify(clash.replace(" is in ", " is already in ") + ".", "warn");
        return false;
      }
      buzz(8);
      commit(S, nd, S.player);
      ok = true;
    });
    return ok;
  }
  const pick = (p, name) => fill({ [p]: name });
  function useLast() {
    act(S => {
      const last = prevOf(S.player);
      if (!last.length || !S.active) return false;
      const nd = ncbdbClone(S.decks);
      nd[S.player] = last.map(c => eventFast
        ? { blade: c.blade || null, ratchet: null, bit: null }
        : { blade: c.blade || null, ratchet: c.ratchet || null, bit: c.bit || null });
      while (nd[S.player].length < 3) nd[S.player].push(emptyCombo());
      buzz(8);
      commit(S, nd, S.player);
    });
  }
  // Tap a part in the deck (or on a check screen) to change it.
  function edit(pi, ci, p) {
    act(S => {
      const c = S.decks[pi][ci];
      if (!need(c, p)) return false;
      if (S.check && !S.fix) S.fix = { decks: ncbdbClone(S.decks), hist: S.hist.length };
      S.player = pi;
      S.active = { c: ci, p };
      resetPicker(S);
      clearNotice();
      if (p === "blade" && c.blade) {
        // Reopen the picker the blade came from. A CX blade opens with its pieces filled in,
        // so one piece can be swapped without redoing the others.
        const x = cxParts(c.blade);
        if (x) { S.seg = "cx"; S.cx = Object.assign({ step: "blade" }, x); }
        else if (lists.crossover.includes(c.blade)) S.seg = "cross";
      }
    });
  }
  function switchPlayer(i) {
    act(S => {
      if (S.player === i) return false;
      S.player = i;
      S.active = nextEmpty(S.decks[i]);
      resetPicker(S);
      clearNotice();
    });
  }
  function startCheck(S) {
    if (!bothBuiltOf(S.decks)) return false;
    S.check = { order: [S.player, ncbdbOther(S.player)], i: 0, cover: false };
    S.active = null;
    S.fix = null;
    resetPicker(S);
    clearNotice();
  }
  function goOther() {
    act(S => {
      if (bothBuiltOf(S.decks)) return startCheck(S);
      const i = ncbdbOther(S.player);
      S.player = i;
      S.active = nextEmpty(S.decks[i]);
      resetPicker(S);
      clearNotice();
    });
  }
  function confirmCheck() {
    if (stageOf(s, decks) !== "check") return;
    const ck = s.check;
    clearNotice();
    buzz(15);
    if (ck.i === 0) {
      act(S => {
        S.menu = false;
        S.check = { order: ck.order, i: 1, cover: S.hide };
        S.player = ck.order[1];
      });
    } else {
      // Both players checked their own deck: same steps as the old Start Match button.
      act(S => {
        S.menu = false;
        S.check = null;
        S.active = null;
        S.fix = null;
      });
      props.onStart();
    }
  }
  function reveal() {
    act(S => {
      if (stageOf(S, S.decks) !== "cover") return false;
      const ck = S.check;
      S.menu = false;
      S.check = { order: ck.order, i: 1, cover: false };
      S.player = ck.order[1];
    });
  }
  // Back walks the check in reverse, through the hidden screen, so a deck never shows by surprise.
  function back() {
    const stage = stageOf(s, decks), ck = s.check;
    if (stage === "build" && !ck) {
      props.onBack();
      return;
    }
    act(S => {
      S.menu = false;
      if (stage === "build") {
        if (S.fix) {
          // Changing a part from a check screen: Back cancels the change.
          S.decks = S.fix.decks;
          S.hist.length = Math.min(S.hist.length, S.fix.hist);
        } else if (!bothBuiltOf(S.decks)) {
          notify("Pick the missing part first.", "warn");
          return;
        }
        S.fix = null;
        S.active = null;
        S.player = ck.order[ck.i];
        resetPicker(S);
        clearNotice();
      } else if (stage === "cover") {
        S.check = { order: ck.order, i: 0, cover: false };
        S.player = ck.order[0];
      } else if (ck.i === 1) {
        if (S.hide) S.check = { order: ck.order, i: 1, cover: true };
        else { S.check = { order: ck.order, i: 0, cover: false }; S.player = ck.order[0]; }
      } else {
        S.check = null;
      }
    });
  }
  function undo() {
    act(S => {
      const last = S.hist.pop();
      if (!last) return false;
      S.player = last.player;
      S.decks = last.decks;
      S.active = last.active;
      S.check = last.check || null;
      S.fix = last.fix || null;
      resetPicker(S);
      clearNotice();
    });
  }
  function clearDeck() {
    act(S => {
      const nd = ncbdbClone(S.decks);
      nd[S.player] = [emptyCombo(), emptyCombo(), emptyCombo()];
      commit(S, nd, S.player, `${P[S.player].name}'s deck cleared. Undo brings it back.`);
    });
  }
  function startOver() {
    act(S => {
      S.hist.push(snapshot(S));
      S.decks = [[emptyCombo(), emptyCombo(), emptyCombo()], [emptyCombo(), emptyCombo(), emptyCombo()]];
      S.player = 0;
      S.active = { c: 0, p: "blade" };
      S.check = null;
      S.fix = null;
      resetPicker(S);
      notify("Both decks cleared. Undo brings them back.", "info");
    });
  }
  function toggleHide() {
    act(S => {
      S.hide = !S.hide;
      try { localStorage.setItem(NCBDB_CFG.hideKey, S.hide ? "1" : "0"); } catch (e) {}
    });
  }
  function clearPrev() {
    props.onClearPrev(s.player);
    notify(`${P[s.player].name}'s previous combos cleared.`, "info");
  }
  const setUi = patch => act(S => { Object.assign(S, patch); });

  /* ----- CX: lock chip, main blade, (over blade), assist ----- */
  function cxSteps(x) {
    const steps = ["chip", "blade"];
    if (x.blade && CX.cxeBlades.includes(x.blade)) steps.push("over");
    steps.push("assist");
    return steps;
  }
  // Same naming as the old CX picker: the Standard chip is left out of the name.
  function cxName(x) {
    const core = CX.cxeBlades.includes(x.blade) ? `${x.blade} ${x.over} ${x.assist}` : `${x.blade} ${x.assist}`;
    return x.chip === CX.plainChip ? core : `${x.chip} ${core}`;
  }
  // Each tap sets one piece and opens the next missing one. The last piece adds the blade.
  function pickCx(kind, name) {
    const x = Object.assign({}, s.cx, { [kind]: name });
    const steps = cxSteps(x);
    if (!steps.includes("over")) x.over = "";
    const next = steps.find(st => !x[st]);
    x.step = next || kind;
    if (next) { buzz(8); setUi({ cx: x }); return; }
    pick("blade", cxName(x));
  }

  /* ----- Search -----
     The text is split on spaces. Each word is matched against the start of the words in a
     part's name ("wiz" finds Wizard Rod, "wr" finds it by initials, "160" finds 1-60).
     The best blade, ratchet and bit together make the "whole combo" card. */
  function search(query) {
    const toks = String(query || "").toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, "")).filter(Boolean);
    const rank = (p, n) => { const i = lists.popular[p].indexOf(n); return i < 0 ? 99 : i; };
    const score = (p, name) => {
      const lower = name.toLowerCase();
      const n = lower.replace(/[^a-z0-9]/g, "");
      const ws = lower.split(/[^a-z0-9]+/).filter(Boolean);
      const ini = ws.map(w => w.charAt(0)).join("");
      let sc = 0;
      for (const t of toks) {
        if (n === t) { sc += 3; continue; }
        if (p === "ratchet") { if (t.length >= 2 && n.indexOf(t) === 0) sc += 2; continue; }
        if (ws.some(w => w.indexOf(t) === 0)) sc += 2;
        else if (t.length >= 2 && ws.length > 1 && ini === t) sc += 2;
      }
      return sc;
    };
    const find = (p, list) => list
      .map(n => ({ n, s: score(p, n), r: rank(p, n) }))
      .filter(x => x.s >= 2)
      .sort((x, y) => (y.s - x.s) || (x.r - y.r) || ncbdbByName(x.n, y.n))
      .map(x => x.n);
    return {
      blade: find("blade", [...new Set(lists.blades.concat(lists.crossover))]),
      ratchet: eventFast ? [] : find("ratchet", lists.ratchets),
      bit: eventFast ? [] : find("bit", lists.bits)
    };
  }
  // The best blade, ratchet and bit from a search, and what adding them would do.
  function bestCombo(res) {
    const a = s.active, deck = decks[s.player];
    const found = {};
    for (const p of NCBDB_PARTS) if (res[p][0]) found[p] = res[p][0];
    const after = Object.assign({}, deck[a.c], found);
    if (after.blade && builtInRatchet.has(after.blade)) { delete found.ratchet; after.ratchet = null; }
    if (after.ratchet && builtInBit.has(after.ratchet)) { delete found.bit; after.bit = null; }
    return {
      parts: found,
      n: Object.keys(found).length,
      title: NCBDB_PARTS.map(p => found[p]).filter(Boolean).join(" · "),
      clash: clashOf(deck, a.c, after),
      missing: NCBDB_PARTS.filter(p => need(after, p) && !after[p])
    };
  }
  // Enter in the search box adds the best match and keeps the keyboard open for the next combo.
  function enterSearch() {
    if (!s.active || !s.query.trim()) return;
    const best = bestCombo(search(s.query));
    if (!best.n) return;
    if (fill(best.parts)) refocusRef.current = true;
  }

  /* ---------- Taps ---------- */
  const qRef = useRef(null);
  const tapRef = useRef({ t: 0, x: 0, y: 0 });
  const stageRef = useRef({ key: "", at: 0 });
  const kbRef = useRef(false);
  const refocusRef = useRef(false);
  // Picking with a tap closes the phone keyboard, so the next step has the whole screen.
  const CLOSES_KEYBOARD = { pick: 1, fill: 1, "use-last": 1, "cx-pick": 1, "cx-step": 1, edit: 1, tab: 1, seg: 1 };
  // These wait a moment after a check screen appears, so a double tap cannot confirm or reveal a deck.
  const WAITS_FOR_STAGE = { confirm: 1, reveal: 1, back: 1 };
  function tap(action, fn) {
    return e => {
      const now = performance.now();
      const byKeyboard = e.detail === 0;
      if (!byKeyboard) {
        const L = tapRef.current;
        const again = now - L.t < NCBDB_CFG.tapGuardMs && Math.hypot(e.clientX - L.x, e.clientY - L.y) < 40;
        L.t = now; L.x = e.clientX; L.y = e.clientY;
        if (again && action !== "undo" && action !== "clear-query") return;
      }
      if (WAITS_FOR_STAGE[action] && stageRef.current.key !== "build" && now - stageRef.current.at < NCBDB_CFG.stageGuardMs) return;
      if (!byKeyboard && CLOSES_KEYBOARD[action] && document.activeElement === qRef.current) qRef.current.blur();
      kbRef.current = byKeyboard;
      fn();
    };
  }

  /* ---------- View pieces ---------- */
  const stage = stageOf(s, decks), building = stage === "build", ck = s.check;
  const a = building ? s.active : null;
  const q = a ? s.query.trim() : "";
  const who = building ? s.player : ck.order[ck.i]; // whose colours are on screen
  const pl = P[who];
  const stageKey = stage + (ck ? ":" + ck.i + ":" + ck.cover : "");
  if (stageKey !== stageRef.current.key) stageRef.current = { key: stageKey, at: performance.now() };

  // One part you can pick. Grey with a combo number when another combo already has it.
  function chip(p, name, size, key) {
    const deck = decks[s.player];
    const used = usedIn(deck, p, name, a.c);
    const cur = deck[a.c][p] === name;
    const color = p === "blade" ? (BLADE_COLORS[name] || "") : "";
    const cls = ["chip", "chip-" + p];
    if (size) cls.push(size);
    if (p === "ratchet" && !/\d/.test(name)) cls.push("word");
    let style;
    if (used >= 0) cls.push("used");
    else {
      if (cur) cls.push("cur");
      if (color) { cls.push("colored"); style = { borderColor: color, background: color + "18" }; }
    }
    const label = used >= 0 ? `${name}, already used in combo ${used + 1}` : (cur ? `${name}, current pick` : `Pick ${name}`);
    return h("button", {
      key: key || p + ":" + name, type: "button", className: cls.join(" "), style, "aria-label": label,
      "data-used": used >= 0 ? String(used + 1) : undefined, disabled: used >= 0,
      onClick: tap("pick", () => pick(p, name))
    }, h("span", { className: "chip-t" }, name));
  }
  function azList(p, list, heads, size) {
    let last = "";
    const out = [];
    list.slice().sort(ncbdbByName).forEach(n => {
      const letter = n.charAt(0).toUpperCase();
      if (heads && letter !== last) out.push(h("div", { key: "h" + letter, className: "az-head" }, letter));
      last = letter;
      out.push(chip(p, n, size));
    });
    return out;
  }
  // A whole combo in one button: previous combos and quick combos.
  function comboCard(qc, key) {
    const deck = decks[s.player];
    const clash = clashOf(deck, a.c, qc);
    const color = BLADE_COLORS[qc.blade] || "";
    const rest = qc.ratchet ? (builtInBit.has(qc.ratchet) || !qc.bit ? qc.ratchet : `${qc.ratchet} · ${qc.bit}`) : (qc.bit || "");
    const style = !clash && color ? { borderColor: color, background: color + "18" } : undefined;
    return h("button", {
      key, type: "button", className: "cc" + (clash ? " off" : ""), style, disabled: !!clash,
      onClick: tap("fill", () => fill({ blade: qc.blade, ratchet: qc.ratchet, bit: qc.bit }))
    }, h("span", { className: "cc-blade" }, qc.blade), h("span", { className: "cc-sub" }, clash || rest));
  }

  function barEl() {
    const fixing = building && !!ck;
    let backLabel = "Back";
    if (fixing) backLabel = "Cancel the change and go back to the check";
    else if (stage === "check" && ck.i === 0) backLabel = "Back to building";
    else if (stage === "check") backLabel = s.hide ? "Back to the hidden screen" : `Back to ${P[ck.order[0]].name}'s deck`;
    else if (stage === "cover") backLabel = `Back to ${P[ck.order[0]].name}'s deck`;
    const step = stage === "check" ? `${ck.i + 1} of 2` : (stage === "cover" ? "1 of 2 done" : "");
    return [
      h("button", { key: "b", className: "icon-btn", type: "button", "aria-label": backLabel, onClick: tap("back", back) }, ncbdbIcon("back", 22, 2.2)),
      h("h1", { key: "t", className: "bar-title" }, building ? (eventFast ? "Record blades" : "Record decks") : (eventFast ? "Check blades" : "Check decks")),
      step ? h("span", { key: "p", className: "pill" }, step) : null,
      fixing ? h("button", { key: "c", className: "bar-btn", type: "button", onClick: tap("back", back) }, "Cancel")
        : building ? h("button", { key: "u", className: "bar-btn", type: "button", disabled: !s.hist.length, onClick: tap("undo", undo) }, ncbdbIcon("undo", 18, 2), "Undo") : null,
      h("button", {
        key: "m", className: "icon-btn", type: "button", "aria-label": "More options", "aria-haspopup": "menu", "aria-expanded": s.menu,
        onClick: tap("menu", () => setUi({ menu: !s.menu }))
      }, ncbdbIcon("dots", 22, 2.6))
    ];
  }
  function tabsEl() {
    return h("div", { className: "tabs-track", role: "group", "aria-label": "Whose deck" }, P.map((p, i) => {
      const pr = progress(decks[i]), on = s.player === i, done = pr.done === pr.total;
      return h("button", { key: i, className: "tab" + (on ? " on" : ""), type: "button", "aria-pressed": on, onClick: tap("tab", () => switchPlayer(i)) },
        h("span", { className: "tab-dot", style: { background: p.color } }),
        h("span", { className: "tab-name" }, p.name),
        h("span", { className: "tab-count" + (done ? " ready" : "") }, done ? "Ready" : pr.done + "/" + pr.total));
    }));
  }
  function cellEl(pi, ci, p) {
    const c = decks[pi][ci], val = c[p];
    const where = `${P[pi].name} combo ${ci + 1} ${p}`;
    if (!need(c, p)) return h("button", { key: p, className: "cell builtin", type: "button", disabled: true, "aria-label": `${where} is built in` }, h("span", { className: "t" }, "Built in"));
    const now = !!(s.active && s.active.c === ci && s.active.p === p);
    const text = val || (now ? `Pick ${p}` : ncbdbCap(p));
    const color = p === "blade" && val ? BLADE_COLORS[val] : "";
    // The spoken label always contains the words shown on the button (voice control relies on that).
    const label = val ? `${where}: ${val}. Tap to change` : (now ? `Pick ${p}, ${P[pi].name} combo ${ci + 1}` : `${where}, not picked yet`);
    return h("button", {
      key: p, className: "cell" + (val ? "" : " empty") + (now ? " now" : ""), type: "button", "aria-label": label,
      "aria-current": now ? "true" : undefined, onClick: tap("edit", () => edit(pi, ci, p))
    }, color ? h("span", { className: "cell-dot", style: { background: color } }) : null, h("span", { className: "t" }, text));
  }
  function deckEl() {
    const pi = s.player, act0 = s.active;
    const cols = eventFast ? ["blade"] : NCBDB_PARTS;
    return h("div", { className: "deck-card", role: "group", "aria-label": `${P[pi].name}'s deck` }, [0, 1, 2].map(ci => {
      const c = decks[pi][ci];
      const complete = NCBDB_PARTS.every(p => !need(c, p) || !!c[p]);
      const now = !!(act0 && act0.c === ci);
      return h("div", { key: ci, className: "deck-row", style: eventFast ? { gridTemplateColumns: "26px minmax(0, 1fr)" } : undefined },
        h("span", { className: "badge" + (complete ? " done" : (now ? " now" : "")), "aria-hidden": "true" }, complete ? "✓" : ci + 1),
        cols.map(p => cellEl(pi, ci, p)));
    }));
  }
  function segEl() {
    const opts = [["std", "Standard"], ["cx", "CX"], ["cross", "Crossover"]];
    return h("div", { className: "seg-track", role: "group", "aria-label": "Blade type" }, opts.map(([k, t]) =>
      h("button", { key: k, className: "seg" + (s.seg === k ? " on" : ""), type: "button", "aria-pressed": s.seg === k, onClick: tap("seg", () => setUi({ seg: k, cx: ncbdbCxBlank() })) }, t)));
  }
  // Ratchet step, stays put above the list: one-tap finishes for this blade, then the popular ratchets.
  function pinnedEl() {
    const deck = decks[s.player], c = deck[a.c];
    const pool = prevOf(s.player).concat(lists.quick);
    const seen = {};
    const sugs = [];
    for (const x of pool) {
      if (x.blade !== c.blade || !x.ratchet) continue;
      const key = x.ratchet + "|" + (x.bit || "");
      if (seen[key]) continue;
      seen[key] = true;
      const clash = clashOf(deck, a.c, { blade: null, ratchet: x.ratchet, bit: x.bit });
      const title = x.bit && !builtInBit.has(x.ratchet) ? `${x.ratchet} · ${x.bit}` : x.ratchet;
      sugs.push(h("button", {
        key, className: "sug", type: "button", title: clash || undefined, disabled: !!clash,
        onClick: tap("fill", () => fill({ ratchet: x.ratchet, bit: x.bit }))
      }, title + (clash ? " (in use)" : "")));
    }
    return [
      sugs.length ? h("div", { key: "sl", className: "label" }, `One tap: finish ${c.blade}`) : null,
      sugs.length ? h("div", { key: "sg", className: "grid g2 sug-grid" }, sugs) : null,
      h("div", { key: "pl", className: "label" }, "Popular ratchets"),
      h("div", { key: "pg", className: "grid g5" }, lists.popular.ratchet.map(n => chip("ratchet", n)))
    ];
  }
  function bladesBody() {
    const prev = prevOf(s.player);
    const out = [];
    if (prev.length) {
      const useAll = progress(decks[s.player]).done === 0;
      const hint = useAll ? `last round · tap one or use all ${prev.length}` : `last round · tap one for combo ${a.c + 1}`;
      out.push(h("div", { key: "pl", className: "label-row" },
        h("span", { className: "label" }, eventFast ? "Previous blades" : "Previous combos"),
        h("span", { className: "hint" }, hint),
        h("button", { className: "link-btn danger", type: "button", onClick: tap("clear-prev", clearPrev), "aria-label": `Clear ${P[s.player].name}'s previous combos` }, "Clear")));
      const items = eventFast
        ? [...new Set(prev.map(c => c.blade).filter(Boolean))].map(n => chip("blade", n, "", "pv:" + n))
        : prev.map((c, i) => comboCard(c, "pv" + i));
      if (useAll) items.push(h("button", { key: "all", className: "use-all", type: "button", onClick: tap("use-last", useLast) }, ncbdbIcon("history", 18, 2.2), `Use all ${prev.length}`));
      out.push(h("div", { key: "pg", className: "grid g2 mb" }, items));
    }
    if (!eventFast) {
      out.push(h("div", { key: "ql", className: "label-row" }, h("span", { className: "label" }, "Quick combos"), h("span", { className: "hint" }, "fills all 3 parts")));
      out.push(h("div", { key: "qg", className: "grid g2 mb" }, lists.quick.map((c, i) => comboCard(c, "q" + i))));
    }
    out.push(h("div", { key: "bl", className: "label" }, "Popular blades"));
    out.push(h("div", { key: "bg", className: "grid g2 mb" }, lists.popular.blade.map(n => chip("blade", n))));
    out.push(h("div", { key: "al", className: "label" }, "All blades, A to Z"));
    out.push(h("div", { key: "ag", className: "grid g2" }, azList("blade", lists.blades, true)));
    return out;
  }
  function crossBody() {
    return [h("div", { key: "l", className: "label" }, "Crossover blades, A to Z"), h("div", { key: "g", className: "grid g2" }, azList("blade", lists.crossover, false))];
  }
  function cxBody() {
    const x = s.cx, steps = cxSteps(x);
    const idx = Math.max(0, steps.indexOf(x.step)), step = steps[idx];
    const used = cxUsed(decks[s.player], a.c);
    // Four pieces (CXE) leave less room per label, so they get the short names.
    const four = steps.length > 3;
    const labels = four ? { chip: "Chip", blade: "Main", over: "Over", assist: "Assist" } : { chip: "Lock chip", blade: "Main blade", assist: "Assist" };
    const titles = { chip: "pick the lock chip", blade: "pick the main blade", over: "pick the over blade", assist: "pick the assist blade" };
    const guideKind = { blade: "blade", over: "over_blade", assist: "assist" }[step];
    const crumbs = steps.map((st, i) => {
      const cur = st === step, val = x[st], open = cur || !!val || i < idx;
      return h("button", {
        key: st, className: "crumb" + (cur ? " cur" : "") + (val ? " set" : ""), type: "button", "aria-current": cur ? "step" : undefined, disabled: !open,
        onClick: tap("cx-step", () => setUi({ cx: Object.assign({}, s.cx, { step: st }) }))
      }, h("span", { className: "crumb-label" }, labels[st]), h("span", { className: "crumb-value" }, val || (cur ? "Pick now" : "Later")));
    });
    let opts;
    if (step === "chip") opts = CX.chips.map(n => [n, ""]);
    else if (step === "blade") opts = CX.blades.slice().sort(ncbdbByName).map(n => [n, ""]).concat(CX.cxeBlades.slice().sort(ncbdbByName).map(n => [n, "CXE"]));
    else if (step === "over") opts = CX.overBlades.map(n => [n, ""]);
    else opts = CX.popularAssists.filter(n => CX.assists.includes(n)).concat(CX.assists.filter(n => !CX.popularAssists.includes(n)).sort(ncbdbByName)).map(n => [n, ""]);
    const grid = step === "blade" || step === "assist" ? "g4" : "g3";
    const buttons = opts.map(([n, kind]) => {
      const u = used[step][n], off = u !== undefined, on = x[step] === n;
      const what = kind ? `${n}, ${kind} blade` : n;
      const label = off ? `${what}, already used in combo ${u + 1}` : (on ? `${what}, current pick` : `Pick ${what}`);
      // The corner badge (combo number, or CXE) is drawn by CSS from data-used / data-tag.
      return h("button", {
        key: n, className: "cx-opt" + (on && !off ? " on" : ""), type: "button", "aria-label": label,
        "data-used": off ? String(u + 1) : undefined, "data-tag": !off && kind ? kind : undefined, disabled: off,
        onClick: tap("cx-pick", () => pickCx(step, n))
      }, n);
    });
    return [
      h("div", { key: "c", className: "crumbs" + (four ? " four" : "") }, crumbs),
      h("div", { key: "l", className: "label-row" },
        h("span", { className: "label shrink" }, `Step ${idx + 1} of ${steps.length}: ${titles[step]}`),
        guideKind && props.onGuide ? h("button", { className: "link-btn", type: "button", onClick: tap("guide", () => props.onGuide(guideKind)) }, ncbdbIcon("image", 14, 2.2), "Picture guide") : null),
      h("div", { key: "g", className: "grid " + grid }, buttons)
    ];
  }
  // All ratchets as a table: row = first number, column = height. Built from the list, so new sizes show up on their own.
  function ratchetsBody() {
    const map = {}, heights = [], rest = [];
    for (const r of lists.ratchets) {
      const m = /^([0-9A-Z])-(\d\d)$/.exec(r);
      if (!m) { rest.push(r); continue; }
      (map[m[1]] = map[m[1]] || {})[m[2]] = r;
      if (!heights.includes(m[2])) heights.push(m[2]);
    }
    heights.sort();
    const rows = Object.keys(map).sort((x, y) => (/\d/.test(x) ? 0 : 1) - (/\d/.test(y) ? 0 : 1) || ncbdbByName(x, y));
    const cols = { gridTemplateColumns: `22px repeat(${heights.length}, minmax(0, 1fr))` };
    const tight = heights.length > 7 ? " tight" : ""; // more heights than today: smaller text so the names still fit
    return [
      h("div", { key: "l", className: "label-row" }, h("span", { className: "label" }, "All ratchets"), h("span", { className: "hint" }, "row = first number, column = height")),
      h("div", { key: "hd", className: "mx-head" + tight, style: cols, "aria-hidden": "true" }, h("span", null), heights.map(x => h("span", { key: x }, x))),
      rows.map(k => h("div", { key: "r" + k, className: "mx-row" + tight, style: cols },
        h("span", { className: "mx-label", "aria-hidden": "true" }, k),
        heights.map(x => (map[k][x] ? chip("ratchet", map[k][x], "mx") : h("span", { key: "n" + x, className: "mx-none", "aria-hidden": "true" }))))),
      rest.length ? h("div", { key: "ol", className: "label mx-other" }, "Other") : null,
      rest.length ? h("div", { key: "og", className: "grid g3" }, rest.map(n => chip("ratchet", n))) : null
    ];
  }
  function bitsBody() {
    return [
      h("div", { key: "pl", className: "label" }, "Popular bits"),
      h("div", { key: "pg", className: "grid g2 mb" }, lists.popular.bit.map(n => chip("bit", n, "lg"))),
      h("div", { key: "al", className: "label" }, "All bits, A to Z"),
      h("div", { key: "ag", className: "grid g3" }, azList("bit", lists.bits, false))
    ];
  }
  function searchBody(qq) {
    const res = search(qq), best = bestCombo(res);
    const out = [];
    if (best.n >= (eventFast ? 1 : 2)) {
      const sub = best.clash || (best.missing.length ? `Then pick the ${best.missing.join(" and ")}` : (eventFast ? `Adds it as blade ${a.c + 1}` : `Fills combo ${a.c + 1} in one tap`));
      out.push(h("div", { key: "combo", className: "combo" },
        h("div", { className: "combo-label" }, eventFast ? "Blade found" : (best.missing.length ? "Parts found" : "Whole combo found")),
        h("div", { className: "combo-title" }, best.title),
        h("div", { className: "combo-sub" + (best.clash ? " clash" : "") }, sub),
        h("button", { className: "combo-btn", type: "button", disabled: !!best.clash, onClick: tap("fill", () => fill(best.parts)) }, `Add to combo ${a.c + 1}`)));
    }
    const b = res.blade.slice(0, 8), r = res.ratchet.slice(0, 10), x = res.bit.slice(0, 9);
    if (b.length) out.push(h("div", { key: "bl", className: "label" }, "Blades"), h("div", { key: "bg", className: "grid g2 mb" }, b.map(n => chip("blade", n))));
    if (r.length) out.push(h("div", { key: "rl", className: "label" }, "Ratchets"), h("div", { key: "rg", className: "grid g5 mb" }, r.map(n => chip("ratchet", n))));
    if (x.length) out.push(h("div", { key: "xl", className: "label" }, "Bits"), h("div", { key: "xg", className: "grid g3 mb" }, x.map(n => chip("bit", n))));
    if (!b.length && !r.length && !x.length) out.push(h("div", { key: "none", className: "none" }, `Nothing matches "${qq}". Check the spelling, or add the part in the parts library.`));
    return out;
  }
  function deckDoneBody() {
    const o = ncbdbOther(s.player), both = bothBuiltOf(decks);
    return h("div", { className: "card" },
      h("h2", { className: "card-title", tabIndex: -1, "data-focus": "" }, `${P[s.player].name}'s ${eventFast ? "blades are" : "deck is"} complete`),
      h("p", { className: "card-text" }, "Tap any part above to change it."),
      h("button", { className: "card-btn", type: "button", style: both ? undefined : { background: P[o].color }, onClick: tap("go-other", goOther) },
        both ? (eventFast ? "Check blades with the players" : "Check decks with the players") : `Go to ${P[o].name}'s ${eventFast ? "blades" : "deck"}`));
  }
  // One player's deck, big enough to read at arm's length. Tap a part to fix it.
  function checkBody(pi) {
    const cards = [0, 1, 2].map(ci => {
      const c = decks[pi][ci];
      const cell = p => {
        const where = `${P[pi].name} combo ${ci + 1} ${p}`;
        if (!need(c, p)) return eventFast ? null : h("button", { key: p, className: `ck-cell ck-${p} builtin`, type: "button", disabled: true, "aria-label": `${where} is built in` }, h("span", { className: "t" }, "Built in"));
        const color = p === "blade" ? (BLADE_COLORS[c[p]] || "") : "";
        return h("button", {
          key: p, className: `ck-cell ck-${p}`, type: "button", style: color ? { borderColor: color, background: color + "18" } : undefined,
          "aria-label": `${where}: ${c[p]}. Tap to change`, onClick: tap("edit", () => edit(pi, ci, p))
        }, h("span", { className: "t" }, c[p]));
      };
      return h("div", { key: ci, className: "ck-card" },
        h("span", { className: "ck-num", "aria-hidden": "true", style: eventFast ? { gridRow: "1" } : undefined }, ci + 1),
        cell("blade"), cell("ratchet"), cell("bit"));
    });
    return [
      h("div", { key: "ban", className: "ck-banner" },
        h("div", { className: "ck-who" }, h("span", { className: "ck-dot" }), h("h2", { className: "ck-name", tabIndex: -1, "data-focus": "" }, P[pi].name)),
        h("div", { className: "ck-q" }, eventFast ? "Are these your blades?" : "Is this your deck?")),
      cards,
      h("p", { key: "hint", className: "ck-hint" }, "Something wrong? Tap the part to fix it.")
    ];
  }
  function coverBody(next, done) {
    return h("div", { className: "cover" },
      h("span", { className: "cover-eye" }, ncbdbIcon("eyeOff", 36, 2)),
      h("h2", { className: "cover-title", tabIndex: -1, "data-focus": "" }, `Next: ${P[next].name}`),
      h("p", { className: "cover-text" }, "Both decks are hidden. Turn the screen to them, then tap the button."),
      h("div", { className: "cover-done" }, ncbdbIcon("check", 16, 2.8), h("span", null, `${P[done].name} confirmed`)));
  }
  function dockEl() {
    if (stage === "check") {
      const o = ncbdbOther(who);
      const sub = ck.i === 1 ? "Both players checked. Starts the match" : (s.hide ? `Hides this deck, then ${P[o].name} checks` : `Next: ${P[o].name} checks`);
      return h("button", { key: "c" + stageKey, className: "dock-btn confirm", type: "button", onClick: tap("confirm", confirmCheck) },
        h("span", { className: "confirm-text" },
          h("span", { className: "confirm-title" }, h("span", { className: "confirm-name" }, pl.name), h("span", { className: "confirm-verb" }, " confirms")),
          h("span", { className: "confirm-sub" }, sub)),
        ncbdbIcon("check", 24, 2.6));
    }
    return h("button", { key: "r" + stageKey, className: "dock-btn reveal", type: "button", onClick: tap("reveal", reveal) },
      ncbdbIcon("eye", 22, 2.2), h("span", null, `Show ${pl.name}'s ${eventFast ? "blades" : "deck"}`));
  }
  function menuItems() {
    const items = [];
    const close = fn => () => { fn(); };
    if (building && !ck) items.push(h("button", { key: "cd", className: "menu-item danger", type: "button", role: "menuitem", onClick: tap("clear-deck", close(clearDeck)) }, ncbdbIcon("trash", 18, 2), h("span", { className: "mi-text" }, eventFast ? "Clear these blades" : "Clear this deck")));
    items.push(h("button", { key: "so", className: "menu-item danger", type: "button", role: "menuitem", onClick: tap("start-over", startOver) }, ncbdbIcon("restart", 18, 2), h("span", { className: "mi-text" }, "Start over")));
    items.push(h("button", { key: "hd", className: "menu-item", type: "button", role: "menuitemcheckbox", "aria-checked": s.hide, onClick: tap("toggle-hide", toggleHide) },
      ncbdbIcon("eyeOff", 18, 2), h("span", { className: "mi-text" }, "Hide decks between players"), h("span", { className: "switch" + (s.hide ? " on" : ""), "aria-hidden": "true" })));
    if (props.toggleDark) items.push(h("button", { key: "dk", className: "menu-item", type: "button", role: "menuitemcheckbox", "aria-checked": !!dark, onClick: tap("dark", () => props.toggleDark()) },
      ncbdbIcon("moon", 18, 2), h("span", { className: "mi-text" }, "Dark mode"), h("span", { className: "switch" + (dark ? " on" : ""), "aria-hidden": "true" })));
    items.push(h("button", { key: "rp", className: "menu-item", type: "button", role: "menuitem", onClick: tap("report", () => { setUi({ menu: false }); if (window.__ncbOpenBugReport) window.__ncbOpenBugReport(); }) }, ncbdbIcon("flag", 18, 2), h("span", { className: "mi-text" }, "Report a problem")));
    return items;
  }

  /* ---------- What goes on screen ---------- */
  let body;
  if (stage === "check") body = checkBody(who);
  else if (stage === "cover") body = coverBody(who, ck.order[0]);
  else if (!a) body = deckDoneBody();
  else if (q) body = searchBody(q);
  else if (a.p === "ratchet") body = ratchetsBody();
  else if (a.p === "bit") body = bitsBody();
  else body = s.seg === "cx" ? cxBody() : (s.seg === "cross" ? crossBody() : bladesBody());
  const bladeStep = !!a && a.p === "blade" && !q;
  const ratchetStep = !!a && a.p === "ratchet" && !q;
  const docked = stage === "check" || stage === "cover";
  const promptEl = a ? [
    h("span", { key: "n", className: "prompt-name" }, pl.name),
    h("span", { key: "r", className: "prompt-rest" }, ` · Combo ${a.c + 1}: ${decks[s.player][a.c][a.p] ? "change the" : "pick the"} ${a.p}`)
  ] : null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const placeholder = eventFast ? (vw < 384 ? "Search blades" : "Search blades: wiz, shark…") : (vw < 340 ? "Type: wiz 160 hexa" : (vw < 384 ? "Search or type: wiz 160 hexa" : "Search, or type a combo: wiz 160 hexa"));
  let say = "";
  if (stage === "check") say = `${pl.name}, ${eventFast ? "are these your blades?" : "is this your deck?"}`;
  else if (stage === "cover") say = `Both decks are hidden. Next: ${pl.name}.`;
  else if (a) say = `${pl.name}, combo ${a.c + 1}: pick the ${a.p}`;
  else say = `${pl.name}'s deck is complete.`;
  const noticeKind = notice ? notice.kind : "ok";

  /* ---------- Fit the screen ---------- */
  const R = {
    app: useRef(null), bar: useRef(null), tabs: useRef(null), deck: useRef(null), field: useRef(null),
    seg: useRef(null), scroller: useRef(null), pinned: useRef(null), body: useRef(null), dock: useRef(null), prompt: useRef(null)
  };
  const viewKey = [stageKey, s.player, a ? a.c + a.p : "", s.seg, s.cx.step, q].join("|");
  const lastView = useRef("");
  function layout() {
    const app = R.app.current;
    if (!app) return;
    const qEl = qRef.current;
    const vv = window.visualViewport || null;
    const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const typing = !!qEl && document.activeElement === qEl;
    // 1. Phones lay the keyboard over the page. While typing, shrink the screen to the part still visible.
    let covered = 0;
    if (typing && vv && Math.abs(vv.scale - 1) < 0.02) covered = window.innerHeight - vv.height;
    if (covered > 120) {
      app.style.height = vv.height + "px";
      app.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : "";
    } else {
      app.style.height = "";
      app.style.transform = "";
    }
    const kb = typing && (coarse || covered > 120);
    const height = app.clientHeight;
    app.classList.toggle("short", height < 720);
    app.classList.toggle("dense", height < 660);
    app.classList.toggle("kb", kb);
    app.classList.remove("kb-min");
    // 2. How much room is left for the lists? Too little: give up the deck while typing, then let more of the page scroll.
    const parts2 = [R.bar, R.tabs, R.deck, R.field, R.seg, R.dock].map(r => r.current).filter(Boolean);
    const roomLeft = () => app.clientHeight - parts2.reduce((sum, el) => sum + el.offsetHeight, 0);
    let room = roomLeft();
    if (kb && room < 130) {
      app.classList.add("kb-min");
      room = roomLeft();
    }
    const flow = room < 100;
    app.classList.toggle("flow", flow);
    const pin = R.pinned.current, sc = R.scroller.current, bd = R.body.current;
    if (sc) sc.classList.toggle("unpin", !flow && !!pin && !pin.hidden && room - pin.offsetHeight < NCBDB_CFG.minListPx);
    // 3. A player must see all three combos without scrolling. If long names push the deck
    //    past the bottom of its check screen, use the tighter sizes.
    if (app.getAttribute("data-stage") === "check" && !flow && bd && bd.scrollHeight > bd.clientHeight + 1) app.classList.add("dense");
  }
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  React.useLayoutEffect(() => {
    // A new view starts at the top of its list.
    if (viewKey !== lastView.current) {
      lastView.current = viewKey;
      [R.body, R.scroller, R.app].forEach(r => { if (r.current) r.current.scrollTop = 0; });
      // Keyboard users: when the view changed, move focus to its heading so they are not left on a removed button.
      if (kbRef.current) {
        const target = R.body.current && R.body.current.querySelector("[data-focus]") || (a ? R.prompt.current : null);
        if (target) target.focus({ preventScroll: true });
      }
    }
    if (refocusRef.current) {
      refocusRef.current = false;
      if (stage === "build" && s.active && qRef.current) qRef.current.focus();
    }
    layout();
  });
  useEffect(() => {
    if (props.onOpen) props.onOpen(); // FLAG 1014: the timing clock starts the first time the deck builder opens
    const run = () => layoutRef.current();
    const vv = window.visualViewport || null;
    window.addEventListener("resize", run);
    if (vv) { vv.addEventListener("resize", run); vv.addEventListener("scroll", run); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(() => {});
    return () => {
      window.removeEventListener("resize", run);
      if (vv) { vv.removeEventListener("resize", run); vv.removeEventListener("scroll", run); }
    };
  }, []);
  // Menu: Escape closes it, arrow keys move between its items.
  const menuRef = useRef(null);
  useEffect(() => {
    if (!s.menu) return undefined;
    const first = menuRef.current && menuRef.current.querySelector("button");
    if (first && kbRef.current) first.focus();
    const onKey = e => {
      if (e.key === "Escape") { setUi({ menu: false }); }
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

  const appStyle = { "--pc": pl.color, "--pc-ink": pl.ink, "--pc-rgb": pl.rgb, "--tint": pl.tint, "--tint-line": pl.line, "--arm": NCBDB_CFG.stageGuardMs + "ms" };
  return h("div", { className: "ncbdb-wrap" },
    typeof BugReportInlineButton === "function" ? h(BugReportInlineButton, { hidden: true }) : null, // hides the floating ? (Report a problem is in the menu)
    h("div", { className: "ncbdb", ref: R.app, "data-stage": stage, style: appStyle },
      h("header", { className: "top" },
        h("div", { className: "bar", ref: R.bar }, barEl()),
        s.menu ? h("div", { className: "menu-backdrop", onClick: tap("menu-close", () => setUi({ menu: false })) }) : null,
        s.menu ? h("div", { className: "menu", ref: menuRef, role: "menu", "aria-label": "More options" }, menuItems()) : null),
      h("main", { className: "main" },
        h("div", { className: "tabs", ref: R.tabs, hidden: !(building && !ck) }, building && !ck ? tabsEl() : null),
        h("div", { className: "deck", ref: R.deck, hidden: !building }, building ? deckEl() : null),
        h("div", { className: "field", ref: R.field, hidden: !a },
          h("div", { className: "prompt", ref: R.prompt, tabIndex: -1 }, promptEl),
          h("label", { className: "search" },
            ncbdbIcon("search", 18, 2.2),
            h("input", {
              ref: qRef, type: "text", inputMode: "text", enterKeyHint: "go", autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false,
              placeholder, "aria-label": eventFast ? "Search blades" : "Search parts, or type a whole combo and press Enter",
              value: a ? s.query : "",
              onChange: e => setUi({ query: e.target.value }),
              onKeyDown: e => {
                if (e.nativeEvent && e.nativeEvent.isComposing) return;
                if (e.key === "Enter") { e.preventDefault(); enterSearch(); }
                else if (e.key === "Escape" && s.query) { e.stopPropagation(); setUi({ query: "" }); }
              },
              onFocus: () => layoutRef.current(),
              // Wait a moment so the layout does not jump under a tap that is still landing. The scroll reset
              // is for iPhones, which can leave the page pushed up after the keyboard closes.
              onBlur: () => setTimeout(() => { window.scrollTo(0, 0); layoutRef.current(); }, 120)
            }),
            h("button", {
              className: "q-clear", type: "button", "aria-label": "Clear search", hidden: !(a && s.query),
              // Keep the cursor in the search box when its clear button is pressed (Android would close the keyboard).
              onMouseDown: e => e.preventDefault(),
              onClick: tap("clear-query", () => { setUi({ query: "" }); if (qRef.current) qRef.current.focus(); })
            }, ncbdbIcon("x", 16, 2.4)))),
        h("div", { className: "segwrap", ref: R.seg, hidden: !bladeStep }, bladeStep ? segEl() : null),
        h("div", { className: "scroller", ref: R.scroller },
          h("div", { className: "pinned", ref: R.pinned, hidden: !ratchetStep }, ratchetStep ? pinnedEl() : null),
          h("div", { className: "body", ref: R.body }, body)),
        h("div", { className: "toast-slot" },
          notice ? h("div", { key: notice.id, className: "notice" + (noticeKind === "ok" ? "" : " " + noticeKind), role: "status" },
            ncbdbIcon(noticeKind === "warn" ? "alert" : (noticeKind === "info" ? "info" : "check"), 18, noticeKind === "ok" ? 2.8 : 2.2),
            h("span", null, notice.text)) : null)),
      docked ? h("footer", { className: "dock", ref: R.dock }, dockEl()) : null,
      h("div", { className: "sr-only", "aria-live": "polite" }, say)));
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
  eventRanked = true,
  eventFast = false
}) {
  // Fast Blast (flag 1031): only the blade counts as a finished combo, and combos print as just the blade.
  // For normal events these are the same functions as before.
  const comboReady = eventFast ? comboReadyBladeOnly : comboReadyStandard;
  const comboStr = eventFast ? comboStrBladeOnly : comboStrStandard;
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

  // The current match's battles. Falls back to the index when we have no key yet (e.g. resuming a session started on the old build).
  const useKeyScoping = !!matchKey;
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
  // FLAG 1036: the "Next Action?" popup after the judge submits. Holds the matchKey it was opened for, so it can
  // never show on a later match's result screen; null = closed.
  const [nextActionFor, setNextActionFor] = useState(null);
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
  // FLAG 1034: the new deck builder's own screen state (current part, check stage, undo list, search, CX steps).
  // Kept here so it survives the CX Picture Guide opening over it; cleared whenever the judge is back on the player pick.
  const [deckV2State, setDeckV2State] = useState(null);
  useEffect(() => {
    if (phase === "pick") setDeckV2State(null);
  }, [phase]);
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
  // Stream overlay only: true = the overlay shows the two players left/right flipped. Set from the cog
  // menu ("Swap Stream Position"); the judge's own Swap button never touches it, and it never flips the judge view.
  const [overlayFlip, setOverlayFlip] = useState(() => {
    try {
      return localStorage.getItem(KEYS.overlayFlip) === "1";
    } catch {
      return false;
    }
  });
  // FLAG 1022: { p1: [wins, losses], p2: [wins, losses] } for the overlay's records graphic; null until looked up.
  const [overlayRecords, setOverlayRecords] = useState(null);
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
    // Mint a fresh identity for this match (battles are filtered by it). --espiiii
    setMatchKey(`${challongeSlug || "manual"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setTiming(null); // FLAG 1014: a new match always starts with an empty timing notebook
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
  const [fullStats, setFullStats] = useState(false); // post-game Match History: false = simple view, true = full stat view
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
    bugLog("screen", "match phase: " + phase);
  }, [phase]);
  // Submit errors are caught and shown on screen, so they never reach the
  // error recorder. And WCB/Challonge often answer HTTP 200 with the error in
  // the body. Watching the status catches every outcome in one place,
  // including the exact message the judge saw.
  useEffect(() => {
    if (challongeSubmitStatus != null) bugLog("submit", "bracket submit: " + String(challongeSubmitStatus));
  }, [challongeSubmitStatus]);
  useEffect(() => {
    if (underwayStatus != null) bugLog("submit", "mark underway: " + String(underwayStatus));
  }, [underwayStatus]);
  // Snapshot of what's on screen, read when a report is filed. Only named
  // fields — no tokens, nothing from storage.
  useEffect(() => {
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
  // FLAG 1022: look up both players' match records once when a match is set up (and again if the
  // pairing changes). The bracket's list already holds every finished match. A failed or slow lookup
  // only means the overlay shows 0-0; scoring is never held up by it.
  // FLAG 1023: the same list also gives the number of matches still waiting in this round, which changes
  // while the match is played, so it is read again every 30 seconds (the Worker keeps the list for 60
  // seconds, so this adds almost no load).
  useEffect(() => {
    setOverlayRecords(null);
    if (!ff(1022) || !challongeSlug || !p1 || !p2) return;
    let stale = false;
    let seeds = null; // FLAG 1024: read once per match
    const load = async () => {
      try {
        const res = await fetch(`${OVERLAY_WORKER}/pairings?slug=${encodeURIComponent(challongeSlug)}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) return;
        const data = await res.json();
        if (stale) return;
        const recs = overlayRecordsFrom(data && data.pairings, challongeP1ParticipantId, challongeP2ParticipantId, p1, p2, challongeMatchId);
        // WCB lists only open matches and never marks them underway, so a count would be wrong there.
        recs.pending = ff(1023) && !String(challongeSlug).startsWith("wcb-") ? overlayPendingFrom(data && data.pairings, challongeRound, challongeMatchId) : null;
        // FLAG 1024: seeds come with the bracket's player list (WCB has none, so no upsets there).
        if (ff(1024) && !String(challongeSlug).startsWith("wcb-")) {
          if (!seeds) {
            try {
              const pr = await fetch(`${OVERLAY_WORKER}/?slug=${encodeURIComponent(challongeSlug)}`, { signal: AbortSignal.timeout(8000) });
              if (pr.ok) { const pd = await pr.json(); seeds = overlaySeedMap(pd && pd.participants); }
            } catch (e) {}
          }
          recs.upsets = seeds ? overlayUpsetsFrom(data && data.pairings, challongeRound, seeds, challongeMatchId) : [];
          // FLAG 1029: who judged each of those matches and on which stadium (saved by the judge app when the result was sent)
          if (ff(1029) && recs.upsets.length) {
            try {
              const nr = await fetch("https://ncblast-db.danny61734.workers.dev/match-notes?slug=" + encodeURIComponent(challongeSlug), { signal: AbortSignal.timeout(6000) });
              if (nr.ok) { const nd = await nr.json(); recs.upsets = overlayUpsetsWithNotes(recs.upsets, nd && nd.notes); }
            } catch (e) {}
          }
        }
        if (stale) return;
        setOverlayRecords(recs);
      } catch (e) {}
    };
    load();
    const timer = ff(1023) ? setInterval(load, 30000) : null;
    return () => {
      stale = true;
      if (timer) clearInterval(timer);
    };
  }, [challongeSlug, p1, p2, challongeMatchId, challongeRound, challongeP1ParticipantId, challongeP2ParticipantId]);
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
  // FLAG 1028: the deck order the judge last locked ({ id, names, p1: [3 combos], p2: [3 combos] }). It rides along on every overlay
  // push until the first battle of that order is scored, so a push that is dropped or replaced cannot lose it.
  const deckOrderRef = useRef(null);
  // FLAG 1030: standby mode for the stream overlay (between rounds). standbyAsk shows the "no more matches here?" question;
  // standbyRef is true from "yes" until the next real overlay update; standbyCtxRef keeps what the minute refresh needs.
  const [standbyAsk, setStandbyAsk] = useState(false);
  const [standbyActive, setStandbyActive] = useState(false);
  const standbyRef = useRef(false);
  const standbyCtxRef = useRef(null);
  const standbyBusyRef = useRef(false);
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
      // Stamps which match (and event) this battle belongs to. --espiiii
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
    const setsExtra = {
      sets: setsAfter,
      matchOver: setWon && setsAfter[scoringPi] >= need
    };

    // LER — 1-strike system: first LER adds a strike, second converts to a point
    // Combos do NOT advance on LER — push overlay now with unchanged r1/r2
    // FLAG 1023: battles in the match including the one just scored (the match log is not updated yet).
    const battleExtra = ff(1023) ? {
      battleCount: currentMatch.filter(e => e.type !== "LER-STRIKE").length + (fin.id !== "LER-STRIKE" ? 1 : 0)
    } : {};
    if (fin.id === "LER") {
      pushOverlay({
        lastFinish: {
          type: fin.id,
          scorerIdx: scoringPi
        },
        pts: np,
        ...setsExtra,
        ...battleExtra
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
      ...setsExtra,
      ...battleExtra
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
    if (eventFast) return; // Fast Blast: blade-only decks are not worth sharing between judges
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

  // FLAG 1029: after a result is sent, remember who judged it and (if stadiums were set up) which stadium, for the Upset Alert.
  // Best-effort and in the background: it can never hold up or break sending a result.
  const saveMatchNote = async matchId => {
    try {
      if (!ff(1029) || !challongeSlug || matchId == null || String(challongeSlug).startsWith("wcb-")) return;
      let stadium = "";
      try {
        const ar = await fetch(`${OVERLAY_WORKER}/stadium-assign?slug=${encodeURIComponent(challongeSlug)}`, { signal: AbortSignal.timeout(8000) });
        const ad = ar.ok ? await ar.json() : {};
        let nameMap = {};
        try { nameMap = JSON.parse(localStorage.getItem("ncblast-judge-namemap") || "{}") || {}; } catch (_) {}
        const who = sessionStorage.getItem("ncblast-auth-user") || "";
        stadium = stadiumLetterFor(ad && ad.data && ad.data.assign, nameMap, who) || stadiumLetterFor(ad && ad.data && ad.data.assign, nameMap, judge);
      } catch (_) {}
      await fetch("https://ncblast-db.danny61734.workers.dev/match-notes?slug=" + encodeURIComponent(challongeSlug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "zm77132596", matchId: String(matchId), judge: judge || "", stadium })
      });
    } catch (_) {}
  };
  // FLAG 1030: save both players' locked decks for this match (database Worker /deck-log). Best-effort, in the background.
  const saveDeckLog = locked => {
    try {
      if (!ff(1030) || !challongeSlug || !challongeMatchId || String(challongeSlug).startsWith("wcb-")) return;
      const texts = list => (Array.isArray(list) ? list : []).map(c => comboStr(c)).filter(t => t && t !== "\u2014");
      fetch("https://ncblast-db.danny61734.workers.dev/deck-log?slug=" + encodeURIComponent(challongeSlug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "zm77132596", matchId: String(challongeMatchId), round: challongeRound ?? null, p1: p1 || "", p2: p2 || "", d1: texts(locked.p1Deck), d2: texts(locked.p2Deck) })
      }).catch(() => {});
    } catch (_) {}
  };
  // FLAG 1030: send the standby slides' data to this judge's stream channel. ctx = { slug, tName, slot, judge, round }.
  // Skipped when standby has already ended (a real match update went out first). Never throws.
  const pushStandby = async ctx => {
    try {
      if (!ctx || !ctx.slot || !ctx.slug) return;
      const get = async u => {
        try {
          const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
          return r.ok ? await r.json() : null;
        } catch (_) {
          return null;
        }
      };
      const DB = "https://ncblast-db.danny61734.workers.dev";
      const [pr, st, dk, sd] = await Promise.all([
        get(`${OVERLAY_WORKER}/pairings?slug=${encodeURIComponent(ctx.slug)}`),
        ctx.tName ? get(DB + "/event-stats?tournament=" + encodeURIComponent(ctx.tName)) : null,
        get(DB + "/deck-log?slug=" + encodeURIComponent(ctx.slug)),
        get(DB + "/standings?slug=" + encodeURIComponent(ctx.slug))
      ]);
      if (!standbyRef.current) return;
      const standbyData = standbyDataFrom(pr && pr.pairings, ctx.round, st, dk && dk.decks);
      // Standings are Challonge's own table (read once a minute and shared by the database Worker), never our own count.
      const standing = standbyStandingsFrom(sd && sd.groups, ctx.names, st);
      standbyData.standings = standing.rows;
      standbyData.group = standing.group;
      const state = { standby: standbyData, sentAt: Date.now(), slug: ctx.slug, tournamentName: ctx.tName || "", judge: ctx.judge || "", p1: "", p2: "" };
      if (ff(1025)) {
        fetch(DB + "/overlay-live?slot=" + ctx.slot, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "zm77132596", state })
        }).catch(() => {});
      }
      fetch(`${OVERLAY_WORKER}/overlay/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, slot: ctx.slot })
      }).catch(() => {});
    } catch (_) {}
  };
  const goStandby = () => {
    const ctx = { slug: challongeSlug, tName: config.tournamentName || "", slot: overlaySlot, judge: judge || "", round: challongeRound ?? null, names: [p1, p2] };
    standbyCtxRef.current = ctx;
    standbyRef.current = true;
    setStandbyActive(true);
    pushStandby(ctx);
  };
  // Keeps the slides fresh while in standby (other stadiums keep finishing matches).
  useEffect(() => {
    if (!standbyActive) return;
    const t = setInterval(() => { if (standbyRef.current) pushStandby(standbyCtxRef.current); }, 60000);
    return () => clearInterval(t);
  }, [standbyActive]);
  // The decision when a judge taps New Match: see standbyNeedsAsk. Returns "ask" | "standby" | "stay" | "none".
  const standbyDecision = async () => {
    const get = async u => {
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
        return r.ok ? await r.json() : null;
      } catch (_) {
        return null;
      }
    };
    const ad = await get(`${OVERLAY_WORKER}/stadium-assign?slug=${encodeURIComponent(challongeSlug)}`);
    let nameMap = {};
    try { nameMap = JSON.parse(localStorage.getItem("ncblast-judge-namemap") || "{}") || {}; } catch (_) {}
    const assign = ad && ad.data && ad.data.assign || {};
    const letter = stadiumLetterFor(assign, nameMap, sessionStorage.getItem("ncblast-auth-user") || "") || stadiumLetterFor(assign, nameMap, judge);
    if (!letter) return "none";
    const [qd, pd] = await Promise.all([
      get(`${OVERLAY_WORKER}/station-queues?slug=${encodeURIComponent(challongeSlug)}`),
      get(`${OVERLAY_WORKER}/pairings?slug=${encodeURIComponent(challongeSlug)}`)
    ]);
    const queueIds = ((qd && qd.data || {})[letter] || []).map(String);
    return standbyNeedsAsk({ queueIds, pairings: pd && pd.pairings, round: challongeRound, currentMatchId: challongeMatchId });
  };
  // New Match button (all over screens). With flag 1030 on and a stream channel connected, it first checks whether this
  // judge's station is out of matches; any failure just carries on to the normal New Match.
  const newMatchTap = async () => {
    const proceed = () => { setSheetsStatus(null); resetAndRestoreJudge(); };
    if (!ff(1030) || !overlaySlot || !challongeSlug || String(challongeSlug).startsWith("wcb-") || standbyBusyRef.current) {
      proceed();
      return;
    }
    standbyBusyRef.current = true;
    let decision = "none";
    try {
      decision = await standbyDecision();
    } catch (_) {
      decision = "none";
    }
    standbyBusyRef.current = false;
    if (decision === "ask") {
      setStandbyAsk(true);
      return;
    }
    if (decision === "standby") goStandby();
    proceed();
  };
  const answerStandby = yes => {
    setStandbyAsk(false);
    if (yes) goStandby();
    setSheetsStatus(null); resetAndRestoreJudge();
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
    pushOverlayTrailExtraRef.current = null;
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
      // FLAG 1008: tells the overlay to mirror left/right. This now follows the
      // cog menu's "Swap Stream Position" (overlayFlip), NOT the judge's own Swap
      // button. Not sent at all with the flag off, so the overlay never flips.
      // --espiiii
      ...(ff(1008) ? { swapped: !!overlayFlip } : {}),
      // FLAG 1022: round label + each player's match record for the overlay's second post-battle graphic.
      ...(ff(1022) ? {
        records: {
          label: overlayRoundLabel(challongeRound),
          p1: overlayRecords ? overlayRecords.p1 : [0, 0],
          p2: overlayRecords ? overlayRecords.p2 : [0, 0],
          // FLAG 1023: known = the bracket lookup worked; swiss = group stage (Top Cut rounds are negative);
          // pending = matches of this round not started yet (null = unknown)
          ...(ff(1023) ? {
            known: !!overlayRecords,
            swiss: Number(challongeRound) > 0,
            pending: overlayRecords && typeof overlayRecords.pending === "number" ? overlayRecords.pending : null
          } : {})
        }
      } : {}),
      // FLAG 1023: battles in this match so far (LER strikes are not battles). A scoring push passes its own
      // count (battleCount in the extra state wins), because the match log is one entry behind at that moment.
      ...(ff(1023) ? { battleCount: currentMatch.filter(e => e.type !== "LER-STRIKE").length } : {}),
      // Time this update left the judge app: lets the overlay ignore an older copy that arrives late (flag 1025)
      // and shows how long an update took in its optional &debug=1 readout.
      sentAt: Date.now(),
      // FLAG 1024: the tournament link (so the overlay can tell which other live matches are still unfinished) and this
      // round's upsets (a lower seed beat a higher seed) for the Upset Alert graphic.
      ...(ff(1024) ? { slug: challongeSlug || "", upsets: overlayRecords && Array.isArray(overlayRecords.upsets) ? overlayRecords.upsets : [] } : {}),
      // FLAG 1020: winner of each finished set, in order (see overlaySetWinners above).
      ...(ff(1020) ? { setWinners: overlaySetWinners(setScores, rest.sets || sets) } : {}),
      ...rest
    };

    // FLAG 1028: the locked deck order stays on the push until a battle (or launch error strike) is scored, or the match ends or changes.
    if (ff(1028)) {
      const dk = deckOrderRef.current;
      if ("lastFinish" in extraState) deckOrderRef.current = null;
      else if (dk && dk.names === p1 + "\u0000" + p2 && phase !== "over" && !state.matchOver) state.deckOrder = {
        id: dk.id,
        shuf: dk.shuf,
        p1: dk.p1,
        p2: dk.p2
      };
    }
    // FLAG 1030: any real update ends standby mode.
    if (ff(1030)) {
      standbyRef.current = false;
      setStandbyActive(false);
    }
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
    // FLAG 1025: the same update also goes through the database Worker, which the stream overlay reads without delay
    // (the original route keeps the match list and everything else working, and stays the fallback).
    if (overlaySlot && ff(1025)) {
      fetch("https://ncblast-db.danny61734.workers.dev/overlay-live?slot=" + overlaySlot, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password: "zm77132596",
          state
        })
      }).catch(() => {});
    }
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
      saveMatchNote(matchId);
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
      if (eventFast && cat === "blade") {
        nextCat = null; // Fast Blast: the blade is the whole combo, move on to the next one
      } else if (cat === "blade" && NO_RATCHET_BLADES.includes(name)) {
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
  }, [openPicker, eventFast]);
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
      // Send only the current match's battles (the whole device log would leak every
      // past match to the receiving judge). --espiiii
      log: currentMatch,
      matchStartIdx: 0,
      // The receiving judge keeps scoring the same match, so it has
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
    // Keep this judge's own history and append just the handed-off match. Slicing by the
    // sender's matchStartIdx also protects us from tablets still on an old build, which
    // sent their whole log. --espiiii
    {
      const raw = Array.isArray(preview.log) ? preview.log : [];
      const from = Number.isInteger(preview.matchStartIdx) ? preview.matchStartIdx : 0;
      const incoming = raw.slice(from);
      const base = Array.isArray(log) ? log : [];
      const merged = [...base, ...incoming];
      setLog(merged);
      setMatchStartIdx(base.length);
      sSave(KEYS.matchLog, merged);
    }
    // Adopt the incoming match's identity so we keep scoring the
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
            items: ["Blitz","Delta","Fortress","Hurricane","Rage","Tread","Whip"],
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
            items: ["Break","Flow","Guard","Outer","Peak","Tough"],
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
            items: ["Assault","Bumper","Charge","Dual","Erase","Free","Gravity","Heavy","Jaggy","Knuckle","Massive","Odd","Quell","Round","Slash","Turn","Vertical","Wheel","Zillion"],
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
    const stepNum = eventFast ? (who === 1 ? 0 : 3) + slot : (who === 1 ? 0 : 9) + slot * 3 + ["blade", "ratchet", "bit"].indexOf(cat);
    const totalSteps = eventFast ? 6 : 18;
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
        if (challongeSlug && !eventFast) pushCombosForTournament(challongeSlug, playerName, []);
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
  // Stream channel picker window (cog menu on the battle screen, and the button on the Select Match screen). bp / bf scale sizes; the Select Match screen passes plain sizes.
  const renderStreamModal = (bp, bf) => overlayModal && /*#__PURE__*/React.createElement("div", {
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
  }, overlayStatus === "ok" ? "🟢 Push Update" : "▶ Connect Channel " + overlaySlot)));
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
    }, "Select Match"), /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setOverlayModal(true),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "10px 14px",
        marginBottom: 12,
        borderRadius: 12,
        border: `2px solid ${overlaySlot > 0 ? "#1D4ED8" : "var(--border)"}`,
        background: overlaySlot > 0 ? "#EFF6FF" : "var(--surface2)",
        color: overlaySlot > 0 ? "#1D4ED8" : "var(--text-primary)",
        fontFamily: "'Outfit',sans-serif",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCE1"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        textAlign: "left"
      }
    }, "Stream channel"), /*#__PURE__*/React.createElement("span", null, overlaySlot > 0 ? `Channel ${overlaySlot}` : "Off")), renderStreamModal(n => n, n => n)), /*#__PURE__*/React.createElement("div", {
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
      }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? (eventFast ? "Pick Blades \u2192" : "Build Decks \u2192") : "Start Match \u2192")));
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
      }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? (eventFast ? "Pick Blades \u2192" : "Build Decks \u2192") : "Start Match \u2192")));
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
        }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? (eventFast ? "Pick Blades \u2192" : "Build Decks \u2192") : "Start Match \u2192")
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
    }, deckLoadingCombos ? "Loading\u2026" : eventRanked ? (eventFast ? "Pick Blades \u2192" : "Build Decks \u2192") : "Start Match \u2192"), pickTab === "roster" && config.tm && playersSelected && !judge.trim() && /*#__PURE__*/React.createElement("p", {
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

  if (phase === "deck" && ff(1034)) {
    // FLAG 1034: new deck builder (Record decks, then each player checks their own deck). Same data as the old
    // screens below; onStart is the old "Start Match" button's steps, onBack the old Back from the deck review.
    return /*#__PURE__*/React.createElement(DeckBuilderV2, {
      p1: p1,
      p2: p2,
      d1: d1,
      d2: d2,
      setD1: setD1,
      setD2: setD2,
      parts: parts,
      eventFast: eventFast,
      dark: dark,
      toggleDark: toggleDark,
      prev: [p1, p2].map(n => (n && workerCombos[n] || []).map(normalizeCombo).filter(c => comboReady(c))),
      onClearPrev: i => {
        const playerName = i === 0 ? p1 : p2;
        if (!playerName) return;
        setWorkerCombos(prev => {
          const n = {
            ...prev
          };
          delete n[playerName];
          workerCombosRef.current = n;
          return n;
        });
        // Push empty array to the tournament registry to clear this player's entry (same as the old Clear Previous Combos)
        if (challongeSlug && !eventFast) pushCombosForTournament(challongeSlug, playerName, []);
      },
      st: deckV2State,
      setSt: setDeckV2State,
      onOpen: () => {
        if (ff(1014)) setTiming(t => timingStampPure(t, "start", null, Date.now())); // FLAG 1014: the clock starts the first time the deck builder opens
      },
      onGuide: kind => setCxGuide(kind),
      onBack: () => {
        setDeckReview(false);
        setPhase("pick");
      },
      onStart: () => {
        stampTiming("decks"); // FLAG 1014: Decks Recorded marker
        // Save decks to registry NOW so the next judge can see them immediately (same as the old Start Match).
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
    }, eventFast ? "Blade Review" : "Deck Review"), /*#__PURE__*/React.createElement("p", {
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
      }, (eventFast ? ["blade"] : ["blade", "ratchet", "bit"]).map(cat => {
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
    // FLAG 1035: new Deck order screen (same props and the same onConfirm hand-back as the old screen).
    return /*#__PURE__*/React.createElement(ff(1035) ? DeckOrderV2 : ShuffleOrderScreen, {
      dark: dark,
      toggleDark: toggleDark,
      showTimer: !!shuffleTimer,
      onConfirm: locked => {
        stampTiming("shuffle", curSet + ":" + displayShuf); // FLAG 1014: Shuffle marker (set:shuffle-in-set)
        // FLAG 1028: the order just locked goes to the overlay, which shows it as a three-row graphic until the first battle is scored.
        // d1/d2 still hold the OLD order inside this click (setD1/setD2 only land on the next render), so the new order comes from
        // the screen itself. The first combos go out with it, so the scoreboard matches row 1 of the graphic.
        let deckExtra = null;
        if (ff(1028) && locked && locked.p1Deck && locked.p2Deck) {
          const plain = c => ({
            blade: c && c.blade || "",
            ratchet: c && c.ratchet || "",
            bit: c && c.bit || ""
          });
          const firstOf = c => c && c.blade ? {
            blade: c.blade,
            ratchet: c.ratchet,
            bit: c.bit
          } : null;
          deckOrderRef.current = {
            id: Date.now(),
            shuf: displayShuf, // which shuffle of the set this is (1 = first order); the overlay numbers combos 1-3, 4-6, ... from it
            names: p1 + "\u0000" + p2,
            p1: locked.p1Deck.map(plain),
            p2: locked.p2Deck.map(plain)
          };
          deckExtra = {
            p1ActiveCombo: firstOf(locked.p1Deck[0]),
            p2ActiveCombo: firstOf(locked.p2Deck[0])
          };
        }
        // FLAG 1030: remember the locked decks (one record per match; locking again replaces it) for the standby "most used combos" slide.
        if (ff(1030) && locked && locked.p1Deck && locked.p2Deck) saveDeckLog(locked);
        if (shuffleTimer) {
          // Pass combo index 0 — deck order may have changed on this screen,
          // but the first bey to play is always slot 0 after a shuffle.
          pushOverlay({
            shuffling: false,
            p1ComboIdx: 0,
            p2ComboIdx: 0,
            ...(deckExtra || {})
          });
          if (shuffleTimer === "active") {
            setUsed1([]);
            setUsed2([]);
            setShuf(s => s + 1);
          }
          setShuffleTimer(null);
        } else if (deckExtra) {
          // First order of a set (no shuffle timer): nothing was sent here before, so send the deck order now.
          pushOverlay({
            p1ComboIdx: 0,
            p2ComboIdx: 0,
            ...deckExtra
          });
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
    }, priorityKnown ? "Pick a Side" : "Who Won the Die Roll?"), !priorityKnown && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 16,
        color: "var(--text-secondary)",
        fontWeight: 500
      }
    }, "Judge: select the player who won the die roll"), priorityKnown && /*#__PURE__*/React.createElement("p", {
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
    // FLAG 1032: the new result screen must fit one phone screen while the judge is still confirming (ranked tournament match).
    const padFixed = ff(1032) && config.tm && eventRanked && !submitted;

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
    // FLAG 1036: "Next Action?" popup, opened right after the judge submits.
    //   New Match         - the usual New Match (same button as on this page, so it waits for the bracket the same way)
    //   Stay Here         - closes the popup; the judge stays on this result page
    //   Finished this round. - only with a stream channel: puts the overlay into the between-round standby slides (flag 1030)
    const nextActionOpen = ff(1036) && submitted && nextActionFor !== null && nextActionFor === (matchKey || "match") && !standbyAsk;
    const canFinishRound = !!overlaySlot && ff(1030) && !!challongeSlug && !String(challongeSlug).startsWith("wcb-");
    const nextActionPopup = nextActionOpen && /*#__PURE__*/React.createElement("div", {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Next Action?",
      onClick: e => {
        if (e.target === e.currentTarget) setNextActionFor(null); // tap outside = Stay Here
      },
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        zIndex: 520,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 18,
        padding: "22px 20px 18px",
        maxWidth: 360,
        width: "100%",
        textAlign: "center",
        fontFamily: "'Outfit',sans-serif",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }
    }, "Next Action?"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      disabled: newMatchLocked,
      onClick: () => {
        if (newMatchLocked) return;
        setNextActionFor(null);
        newMatchTap();
      },
      style: {
        ...S.pri,
        padding: "16px 0",
        fontSize: 19,
        fontWeight: 800,
        borderRadius: 14,
        marginBottom: 10,
        boxShadow: newMatchLocked ? "none" : "0 6px 18px rgba(37,99,235,0.4)",
        opacity: newMatchLocked ? 0.55 : 1,
        cursor: newMatchLocked ? "default" : "pointer"
      }
    }, newMatchLocked ? "New Match (waiting for " + (String(challongeSlug || "").startsWith("wcb-") ? "WCB" : "Challonge") + ")" : "New Match"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setNextActionFor(null),
      style: {
        ...S.pri,
        background: "var(--surface2)",
        color: "var(--text-primary)",
        border: "1.5px solid var(--border)",
        boxShadow: "none",
        marginBottom: canFinishRound ? 10 : 0
      }
    }, "Stay Here"), canFinishRound && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        setNextActionFor(null);
        goStandby();
      },
      style: {
        ...S.pri,
        background: "transparent",
        color: "#B45309",
        border: "1.5px solid #B4530966",
        boxShadow: "none",
        marginBottom: 0
      }
    }, "Finished this round."), canFinishRound && /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }
    }, "Puts stream channel ", overlaySlot, " into the between-round slides until the next match starts.")));
    return /*#__PURE__*/React.createElement("div", {
      style: ff(1032) ? ncbPadFrameStyle(dark, padFixed) : {
        ...S.page,
        paddingBottom: 80
      }
    }, !ff(1032) && !submitted && /*#__PURE__*/React.createElement("button", {
      style: S.back,
      onClick: () => setOverBackConfirm(true)
    }, IC.back, " Back"), standbyAsk && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        zIndex: 510,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        borderRadius: 16,
        padding: "22px 20px",
        maxWidth: 360,
        width: "100%",
        textAlign: "center",
        fontFamily: "'Outfit',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 6 }
    }, "Are there no more matches at this stadium?"), /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }
    }, "Yes puts the stream into standby (standings, results and combos) until the next match starts."), /*#__PURE__*/React.createElement("button", {
      type: "button",
      style: S.pri,
      onClick: () => answerStandby(true)
    }, "Yes, no more matches here"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      style: { ...S.pri, background: "var(--surface2)", color: "var(--text)", marginTop: 8 },
      onClick: () => answerStandby(false)
    }, "No, more are coming"))), nextActionPopup, overBackConfirm && /*#__PURE__*/React.createElement("div", {
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
    }, "Undo & Go Back")))), ff(1032) ? ncbPadResult({
      dark,
      p1,
      p2,
      winner,
      sets,
      setScores,
      bo: config.bo,
      currentMatch,
      battleCount: currentMatch.length,
      shuffles: shuf,
      judge,
      judgeEditMode,
      onJudgeEdit: setJudgeEditMode,
      onJudgeCommit: v => {
        setJudge(v);
        setJudgeEditMode(false);
      },
      fullStats,
      onToggleStats: () => setFullStats(v => !v),
      eventRanked,
      submitted,
      showFooter: padFixed,
      tournamentName: config.tm && config.tournamentName ? config.tournamentName : "",
      onBack: () => setOverBackConfirm(true),
      onHelp: () => {
        if (window.__ncbOpenBugReport) window.__ncbOpenBugReport();
      },
      onConfirm: () => allPlayersDone ? setJudgeSubmitModal(true) : setConfirmOverlay(true),
      onCsv: () => onDownloadCSV(currentMatch, {
        p1,
        p2,
        sets,
        config,
        winner,
        shuffles: shuf,
        set1PriorityName
      })
    }) : /*#__PURE__*/React.createElement(React.Fragment, null, (() => {
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
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-primary)",
        margin: 0
      }
    }, "Match History"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setFullStats(v => !v),
      "aria-pressed": fullStats,
      title: "Toggle Full Stat View",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: fullStats ? "1.5px solid #16A34A" : "1.5px solid var(--text-faint)",
        background: fullStats ? "#16A34A" : "transparent",
        color: fullStats ? "#fff" : "var(--text-muted)",
        fontSize: 11,
        fontWeight: 800,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, fullStats ? "\u2713" : "\u25CB", " Full Stat View")), currentMatch.map((e, i) => {
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
          marginBottom: !fullStats || e.p1Combo ? 3 : 0
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
      }, e.scorer, fullStats ? " \u2014 " + e.typeName + " +" : " +", e.points, e.penalty ? " (pen)" : ""), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: "var(--text-muted)",
          flex: 1,
          textAlign: "right"
        }
      }, e.p1Score, "\u2013", e.p2Score)), !fullStats ? /*#__PURE__*/React.createElement("div", {
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
      }, p1), /*#__PURE__*/React.createElement("span", {
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
      }, p2)) : e.p1Combo && e.p2Combo && /*#__PURE__*/React.createElement("div", {
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
    }, "⚖️ Judge Confirm →"))), confirmOverlay && (() => {
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
      // FLAG 1032: new split confirm screen. Same taps, same Back (clears the taps), same hand-off to the Submit window.
      if (ff(1032)) return ncbPadConfirm({
        dark,
        p1,
        p2,
        p1Won: winner === p1,
        winner,
        sets,
        setScores,
        cs,
        onTap: tapConfirm,
        onBack: () => {
          setConfirmState({
            ...cs,
            p1ok: false,
            p2ok: false
          });
          setConfirmOverlay(false);
        }
      });
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
          wordBreak: "break-word",
          color: "#000"
        }
      }, cs[b.who] ? "✓ " + b.name : b.name, b.name === winner ? " \uD83D\uDC51" : ""), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: "uppercase"
        }
      }, cs[b.who] ? "Confirmed" : "Tap to confirm"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          width: "100%"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          opacity: 0.85
        }
      }, "Final match score"), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 26,
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: "center",
          wordBreak: "break-word"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#000"
        }
      }, p1, p1 === winner ? " \uD83D\uDC51" : ""), "  ", sets[0], " \u2013 ", sets[1], "  ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#000"
        }
      }, p2, p2 === winner ? " \uD83D\uDC51" : "")), setScores.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8
        }
      }, setScores.map((ss, si) => /*#__PURE__*/React.createElement("span", {
        key: si,
        style: {
          fontSize: 18,
          fontWeight: 800,
          padding: "4px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.2)"
        }
      }, "Set ", si + 1, ": ", ss.p1, " \u2013 ", ss.p2))), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          opacity: 0.85,
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#000",
          fontWeight: 800
        }
      }, winner, " \uD83D\uDC51"), " defeats ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#000",
          fontWeight: 800
        }
      }, loserName))))), !(cs.p1ok && cs.p2ok) && /*#__PURE__*/React.createElement("button", {
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
          if (ff(1036)) setNextActionFor(matchKey || "match"); // FLAG 1036: ask "Next Action?" right after the submit
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
    })(), /*#__PURE__*/React.createElement("div", {
      // FLAG 1032: the old status lines, New Match, Download CSV and Main Menu are untouched; this box only
      // places them. Flag off: it does not exist for layout (display: contents). Flag on: it sits below the new
      // result screen, and stays hidden while the judge is still confirming (the footer has Download CSV).
      style: ff(1032) ? padFixed ? {
        display: "none"
      } : {
        padding: "0 16px 28px",
        flexShrink: 0
      } : {
        display: "contents"
      }
    }, config.tm && eventRanked && submitted && challongeSlug && challongeMatchId && (() => {
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
        newMatchTap();
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
            newMatchTap();
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
        newMatchTap();
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
    }, "Reason: " + timingSendError))));
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
  const lerApi = {}; // FLAG 1033: the Launch Error handlers, filled in below so the new layout can reuse them
  const tmTop = config.tm && !ff(1033); // FLAG 1033: the new look has no purple tournament bar
  const COMBO_ROW_H = bp(54); // fixed height for combo picker row
  const STRIP_H = bp(36); // top strip height
  return /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      background: ff(1033) ? ncbPadTheme(dark).page : "var(--bg-solid)",
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
      borderBottom: "1px solid " + (ff(1033) ? ncbPadTheme(dark).line : "var(--border)"),
      background: tmTop ? "#6D28D9" : ff(1033) ? ncbPadTheme(dark).chrome : "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.back,
      marginBottom: 0,
      flexShrink: 0,
      fontSize: bf(12),
      color: tmTop ? "#E9D5FF" : ff(1033) ? ncbPadTheme(dark).text2 : undefined
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
      flexDirection: ff(1033) ? "row" : "column",
      alignItems: "center",
      justifyContent: "center",
      gap: ff(1033) ? 6 : 1,
      flex: 1,
      height: ff(1033) ? bp(34) : bp(30),
      borderRadius: ff(1033) ? 10 : bp(6),
      border: `1px solid ${tmTop ? "rgba(255,255,255,0.25)" : ff(1033) ? ncbPadTheme(dark).btnLine : "var(--border2)"}`,
      background: tmTop ? "rgba(255,255,255,0.1)" : ff(1033) ? ncbPadTheme(dark).btn : "var(--surface2)",
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer"
    };
    const lbl = {
      fontSize: ff(1033) ? Math.max(11, bf(13)) : Math.max(6, bf(8)),
      fontWeight: ff(1033) ? 600 : 700,
      letterSpacing: ff(1033) ? 0 : 0.4,
      lineHeight: 1,
      textTransform: ff(1033) ? "none" : "uppercase",
      marginTop: ff(1033) ? 0 : 1
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      onClick: undo,
      disabled: !canUndo,
      style: {
        ...btnBase,
        color: canUndo ? tmTop ? "#C4B5FD" : "var(--text-muted)" : "var(--text-disabled)",
        opacity: canUndo ? 1 : 0.3,
        cursor: canUndo ? "pointer" : "default"
      }
    }, IC.undo, /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: canUndo ? tmTop ? "#C4B5FD" : "var(--text-muted)" : "var(--text-disabled)"
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
        // This Swap only flips the judge's own view. It used to push to the
        // overlay (FLAG 1008); the overlay now flips only from the cog menu's
        // "Swap Stream Position", so nothing is sent from here.
      },
      style: {
        ...btnBase,
        color: tmTop ? "#E9D5FF" : "var(--text-secondary)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: bf(12),
        lineHeight: 1
      }
    }, "\u21C4"), /*#__PURE__*/React.createElement("span", {
      style: {
        ...lbl,
        color: tmTop ? "#E9D5FF" : "var(--text-secondary)"
      }
    }, "Swap")), (ff(1033) || hasCurrentBattles && currentMatch.some(e => e.set === curSet)) && /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "Restart this set at 0-0",
      disabled: !(hasCurrentBattles && currentMatch.some(e => e.set === curSet)),
      onClick: () => setResetSetConfirm(true),
      style: {
        ...btnBase,
        opacity: hasCurrentBattles && currentMatch.some(e => e.set === curSet) ? 1 : 0.45,
        flex: "0 0 auto",
        width: ff(1033) ? "auto" : bp(30),
        minWidth: bp(30),
        padding: ff(1033) ? "0 10px" : undefined,
        color: tmTop ? "#FCA5A5" : "var(--text-secondary)"
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
        textTransform: "none",
        color: tmTop ? "#FCA5A5" : "var(--text-secondary)"
      }
    }, "Set")));
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
    // The "?" and the dark mode toggle now live inside the cog menu. BugReportInlineButton is
    // still mounted (hidden) so the floating "?" stays out of the way on this screen.
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(BugReportInlineButton, {
      hidden: true
    }), /*#__PURE__*/React.createElement("div", {
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
        background: layoutEditMode ? "#7C3AED" : settingsMenuOpen ? tmTop ? "rgba(255,255,255,0.2)" : "var(--surface2)" : "none",
        border: layoutEditMode ? "none" : `1px solid ${tmTop ? "rgba(255,255,255,0.3)" : "var(--border2)"}`,
        color: layoutEditMode ? "#fff" : tmTop ? "#E9D5FF" : "var(--text-muted)"
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
        maxHeight: "calc(100vh - 70px)",
        overflowY: "auto",
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
    }), menuRow("streamflip", "\u21C4", "Swap Stream Position", () => {
      // Flips left/right on the stream overlay only. The judge view is not changed.
      const next = !overlayFlip;
      setOverlayFlip(next);
      try {
        localStorage.setItem(KEYS.overlayFlip, next ? "1" : "0");
      } catch {}
      if (ff(1008)) pushOverlay({
        swapped: next
      });
    }, {
      disabled: overlaySlot <= 0,
      hint: overlaySlot > 0 ? overlayFlip ? "Flipped" : "Normal" : undefined
    }), config.tm && challongeMatchId && menuRow("handoff", "\uD83D\uDD00", "Hand off match", () => {
      if (sharedJudges) {
        setHandoffMethodPicker(true);
      } else {
        startHandoff();
      }
    }), ff(1014) && menuRow("timing", "\u23F1", "Match timing", () => setTimingOpen(true)), !ff(1033) && menuRow("layout", "\u283F", layoutEditMode ? "Exit layout edit" : "Adjust layout", () => setLayoutEditMode(m => !m), {
      color: layoutEditMode ? "#7C3AED" : undefined
    }), menuRow("report", "?", "Report a problem", () => {
      if (window.__ncbOpenBugReport) window.__ncbOpenBugReport();
    }), menuRow("dark", dark ? "\u2600\uFE0F" : "\uD83C\uDF19", dark ? "Light mode" : "Dark mode", toggleDark)))));
  })())), ff(1033) && ncbPadScoreCard({
    dark,
    dA,
    dB,
    bo: config.bo,
    target: config.pts,
    sides: currentSides,
    setName: ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"][curSet - 1] ? ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"][curSet - 1] + " set" : "Set " + curSet
  }), /*#__PURE__*/React.createElement("div", {
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
      display: ff(1033) ? "none" : "flex",
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
      display: ff(1033) ? "none" : "flex",
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
      display: ff(1033) ? "none" : "flex",
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
      const pad33 = ff(1033) && active ? ncbPadTile({
        dark,
        p: f.p,
        penalty: !!f.penalty,
        cl: side.cl,
        oppCl: (side === dA ? dB : dA).cl,
        sel: isSel
      }) : null;
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
          border: pad33 ? pad33.border : `2px solid ${!active ? "var(--border)" : isSel ? side.cl : isFinish ? `${side.cl}50` : "var(--border2)"}`,
          background: pad33 ? pad33.background : !active ? "var(--surface2)" : isSel ? side.cl : isFinish ? `${side.cl}10` : "var(--surface2)",
          color: pad33 ? pad33.label : !active ? "var(--text-disabled)" : isSel ? "#fff" : "var(--text-primary)",
          boxShadow: pad33 && pad33.boxShadow ? pad33.boxShadow : undefined,
          fontFamily: "'Outfit',sans-serif",
          cursor: active ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${bp(4)}px`,
          opacity: active ? (pad33 && pendingFinish && !isSel ? 0.55 : 1) : 0.45,
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
            background: pad33 ? pad33.chipBg : !active ? "var(--border2)" : isSel ? "rgba(255,255,255,0.3)" : side.cl,
            borderRadius: bp(3),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }
        }, /*#__PURE__*/React.createElement(FitText, {
          ratio: 0.55,
          style: {
            color: pad33 ? pad33.chip : "#fff",
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
      lerApi[side.ci] = {
        locked: lerLocked,
        has: hasStrike,
        click: lerClick
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
          background: hasStrike ? (ff(1033) && dark ? "#3A2E0B" : "#FEF9C3") : ff(1033) ? "transparent" : "var(--surface2)",
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
          boxShadow: ff(1033) && canConfirm ? "0 6px 18px " + side.cl + "61" : undefined,
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
  })), ff(1033) && ncbPadBattleBody({
    dark,
    dA,
    dB,
    FINISH,
    PENALTY,
    pts,
    lerApi,
    lerStrikes,
    pendingFinish,
    setPendingFinish,
    bothCombosSelected,
    target: config.pts,
    onConfirm: () => {
      if (!pendingFinish || !bothCombosSelected) return;
      if (pendingFinish.fin.penalty) {
        setOwnConfirm({
          pi: pendingFinish.pi,
          fin: pendingFinish.fin
        });
        return;
      }
      doScore(pendingFinish.pi, pendingFinish.fin);
      setPendingFinish(null);
    }
  }), layoutEditMode && /*#__PURE__*/React.createElement("div", {
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
  }), renderTimingModal(), renderStreamModal(bp, bf), pingModal && (() => {
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
      setMatchStartIdx(0);
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
