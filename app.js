// NC BLAST app.js | last updated: 2026-11-11a | parts-refresh (flag 1037: reloads the shared parts list when the deck builder says an organizer added a part) | previous: 2026-11-10b | retired flags 1001-1006, 1012, 1027 (now permanent) | previous:2026-11-08a | staff-flags-menu (Staff button in the Feature Flags page: master key, then choose default on/off per flag for all devices) | previous: 2026-11-07a | fast-blast-judge-flow (Fast Blast events: judges pick only the blade per combo; nothing sent to Sheets or the database) | previous: 2026-11-06b | fast-blast-plumbing (flag 1031: the app now knows whether the selected event is a Fast Blast event; nothing uses it yet, the Fast Blast match flow comes next) | previous: 2026-11-06a | ezq-removed (the EZQ standalone queue tool, its role-picker button and its route are gone; a tab that still remembers the EZQ role now returns to the role picker; Fast Blast will replace it) | previous: 2026-11-03a | bug-button-in-menu (BugReportInlineButton can now be mounted hidden: it still hides the floating ? button but draws nothing, because the judge scorer's ? now lives in the cog menu) | previous: 2026-10-22b | split-into-parts (app.js is now the LAST of 6 script files: blade-images.js, core.js, screens.js, judge-match.js, organizer.js, app.js - loaded in that order by index.html. Code moved unchanged. New "parts check" below: every other file ticks a box when it finishes loading, and app.js shows a message + reloads once instead of a blank screen if a box is empty) | previous: 2026-10-22 | remove-ranked-unranked-choice (Organizer view: the "Ranked or Unranked?" choice is gone from both the Challonge and WCB add-event flows; every new event is added as ranked. The name screen button now adds the event directly, and a failed add returns to the name screen with the error) | previous: 2026-10-16e | cloud-backup-for-error-files (flag 1016, on by default: every error file - failed battles send, failed Sheets send, failed timing send, bug reports - is queued on the device and uploaded to the cloud backup folder through the Worker /backup/upload door instead of being saved to the judge device; it keeps retrying until the upload works) | previous: 2026-10-16d | match-timing-outbox (flag 1015: a failed timing send keeps retrying by itself, survives closing the app, and after 10 minutes is uploaded as a CSV to the cloud backup folder through the Worker /backup/upload door; the judge device only downloads it if that fails too) | previous: 2026-10-16c | match-timing-send (flag 1015, on by default: after Submit the match timing is sent to the database through the Worker /db/timing door, with its own Timing status line and tap-to-retry) | previous: 2026-10-16b | match-timing-keep-everything (flag 1014, now ON by default like every new flag): the timing notebook now erases nothing - battles and launch errors removed by Undo / Reset set, and markers wiped out or pressed again, are kept and tagged undone / replaced; every Undo or Reset set opens a fix timer (from the confirm click of the most recent undone entry until the match is back to the same number of entries, split into time to notice + time to repair) so fixing mistakes is its own category and all categories add up to the full match time; Redo is hidden from the cog menu while 1014 is on; the Match timing window shows all of it | previous: 2026-10-15i | match-timing-notebook (flag 1014, off by default): a small device-saved notebook of clock times per match - Start (first time the deck builder opens, always 0.00), Decks Recorded, Priority, Side Selection N, Shuffle N, Match Complete - while Battle and Launch Error times are read from the saved battle log (so Undo, Redo, Reset set, abandon and the QR handoff keep them in step); cog menu gets a read-only Match timing window; nothing is sent to the database yet | previous: 2026-10-15h | big-change-one-part-menu: holding a Quick Combo or Previous Combo now opens a large centered menu with one big Blade / Ratchet / Bit button and an X (cancel) in the top right, replacing the small dropdown | previous: 2026-10-15g | popular-update-and-ratchet-sort: new Top 15 blades (+Suppress Superion, Glory Valkyrie, Ring Aether; Tyranno Beat, Dran Buster, Knight Mail dropped) with colors, new Top 10 ratchets (+5-50) and bits (+Narrow) in popularity order, Popular / Numerical toggle on the judge's ratchet picker | previous: 2026-10-15f | judge-first-confirm: final score screen now starts with one big Judge Confirm button, which opens a full-screen split (top half = Player 1, bottom half = Player 2) so each player taps a large target, then the Submit window opens; shuffle screen header leaves room so the ? bug-report button no longer covers the countdown | previous: 2026-10-15e | feature-requests: Swiss bye banner on Organizer screen; Launch Error confirmation window; Reset set (restart current set at 0-0, with confirmation) button next to Swap; popular parts searchable and keep popular colour in search results | previous: 2026-10-15d | Antler picture added to the CX Picture Guide | previous: 2026-10-15c | cx-tab-label + Picture Guide button (twice as tall, two lines) | previous: 2026-10-15b confusing-spots: (a) Own Over / Own Xtreme now ask "This action will award N points to [other player]. Continue?" before scoring; (b) CX is a full-width button above the part search bar; (c) Organizer Station Queues has a "Judges at own stadiums" toggle (off by default) that puts judge-vs-judge matches on a judge's home station and stops suggesting cross-station handoffs | previous: 2026-10-15 organizer-report-fixes: (1) ranked results screen now shows the Challonge send status with a Retry button, /submit waits 20s and retries once on a network failure; (2) combo saves check the reply, retry and double-check the Worker kept them, and a failed refresh no longer blanks a player's combos; (3) Undo button on the reshuffle / new-set deck-order screen and on the new-set side picker, and undo now closes those screens and restores the sides | previous: 2026-10-14 database-fail-reason (flag 1013): the "Database: failed" line now also shows the reason with its HTTP code (and what the database said) so a failed send can be diagnosed from the screen and the ? report | previous: 2026-10-13 database-send (flag 1013, ON by default): when a judge submits to Sheets, the SAME rows are also sent to the NC BLAST database via the Worker's POST /db/ingest route, with its own separate "Database: sending / sent / failed" status line, tap-to-retry (resending is safe) and the CSV download as fallback on failure; a judge name is now required before a match can submit (blank = the Submit window asks for it); Glory Valkyrie and Hells Nether added to UXE_BLADES so they get no ratchet. Sheets payload, Challonge submit, scoring and the combo picker code are unchanged | previous: set1-pick-priority-tag: the player with pick priority in set 1 gets "~P~" appended to their name in the P1/P2 columns of the Sheets Battle + summary rows and the CSV backup (name-based, survives resume; no Apps Script change) | previous: stadium-count-textbox (flag 1012, off by default): Organizer view's "How many stadiums are you running?" step gets a number box (1-99) beside the 1-8 buttons, so events can run any number of stadiums. Stadium names continue past H as I..Z, then AA, AB... (helpers stadiumLabel/stadiumLabelList near ff()); colours past H rotate through the 8 existing ones; the judge-side station picker lists as many stations as the org set. Names A-H and all behaviour for 8 or fewer stadiums are unchanged. EZQ tab still capped at A-H. | previous: battle-banner-cog: top banner slimmed to Back / Undo / Swap / dark toggle plus one cog button; Redo, Fix, Log, Stream overlay, Handoff and Adjust layout moved into a cog settings menu; set-score pill moved from the banner into the middle of the score card above the B/X side display | previous: wcb-dont-mark-underway: live test match confirmed WCB's own /result endpoint rejects a score once the match has been PATCHed to "underway" — {error: "match_result_error", message: "Only ready, unfinished matches can be scored."} — unlike Challonge, where marking underway first is expected and harmless, WCB requires the match to still be in its original "ready" state to accept a result. markMatchUnderway() no longer calls /wcb/match/start automatically for wcb- events; the Worker route itself is untouched in case a later flow needs it. | wcb-submit-checkbox-label: the confirm screen's bracket checkbox/button always said "Submit to Challonge" and "Submitted to Challonge" even for a WCB event — likely cause of a real match where the score reached Sheets but never reached WCB, since the judge had no way to tell the checkbox even applied. All four spots (the checkbox in the ranked confirm modal, its two status lines, and the two unranked-mode submit buttons) now read the event's own backend off challongeSlug and say "WCB" or "Challonge" accordingly — same submitChallongeScore()/checkbox plumbing underneath, just honest labeling. | wcb-start-match-button: the WCB match panel could be selected but had no way to actually proceed — the "Marking in progress" status + Start Match/Build Decks button that the Challonge match-select panel has was never added when the WCB panel became selectable. Copied the same block over (same handler, same beginMatchLog/refreshCombos/deckReview flow), just re-colored purple and re-worded "Challonge access confirmed" to "WCB access confirmed". | wcb-phase2-writes: Judge view's "Open WCB Matches" panel is now selectable — tapping a match calls the same selectActivePairing() used for Challonge (it already worked generically off player1_id/player2_id/player1_name/player2_name), and markMatchUnderway/submitChallongeScore each grew an internal branch that calls the Worker's new /wcb/match/start and /wcb/match/result routes instead of the Challonge ones when challongeSlug starts with "wcb-" — no new feature flag needed since this is only reachable through a wcb- event, which flag 1004 already gates. | ezq-stuck-judge-fix: EZQ's isUnderway() only checked underway_at truthiness, not match state — if a completed match ever carried a leftover underway_at value (Challonge normally clears it on completion, but this closes the gap for any edge case where it doesn't), the judge who played that match would show red/occupied forever with no way to self-correct. isUnderway now also requires state !== "complete". The manual Refresh button already force-bypasses the Worker's 60s pairings cache, so it remains the fastest way to clear a stuck judge if the cause turns out to be caching lag rather than this logic gap | ezq-floaters-and-poll: EZQ now polls Challonge every 5s (matching Org view's rhythm) instead of 15s — costs the same real Challonge traffic since the Worker's 60s cache absorbs the extra checks either way, it just means EZQ catches a fresh cache entry sooner. Floaters are no longer treated as judges in queue priority/coverage math (isJudgeName now means judge only) — a floater's match schedules as ordinary PvP and floaters never appear in a station's judge header, since they have no fixed station. Added a separate display-only badge (FvP/FvJ/FvF) so the queue card still shows when a floater is involved, without that affecting scheduling | ezq-dragdrop-fix: EZQ station queue container had both a container-level onDrop AND a card-level onDrop covering the same area; HTML drop events bubble, so dropping on a card fired both handlers and inserted the dragged match twice with no way to remove the extra copy. Replaced the container-level catch-all with a dedicated thin spacer div after the card list (same pattern the Organizer view's queue already used) and added stopPropagation as a backstop | ezq-v1: new EZQ tab (RolePicker) — standalone, single-device queue-only tool for TOs not running BLAST scoring; paste Challonge link, tap-designate judges/floaters locally (no login/master-code), assign stations, then a trimmed Org-style queue view that detects "in progress" via Challonge's own underway_at field (not BLAST overlay state) and auto-generates/reorders station queues | matchstartidx-fix: reset() now sets matchStartIdx from in-memory log.length instead of re-reading localStorage, fixing rare Sheets submissions that included the device's entire accumulated match history | wcb-org-create (flag 1004, off by default): Organizer view gets a "Load from WCB link" box alongside the Challonge one — paste a West Coast Bladers bracket link, Worker fetches name+roster from WCB via /org/tournament/add-wcb and registers it in BLAST's shared cached-tournament list, tagged with a small "WCB" pill. Entirely separate state/handlers from the existing Challonge add-tournament flow — no shared code paths touched. Judges/players actually scoring a WCB event is separate, later work. | wcb-judge-preview: Judge view's "Active Matches" tab now shows a read-only "Open WCB Matches (preview)" list for wcb- slugs instead of the normal Challonge matches UI — real match data from WCB's confirmed Swiss response shape, but deliberately not selectable/scoreable yet, since selecting a match in the existing flow writes an "underway" state to Challonge specifically; scoring a WCB match is separate work still to come.
// ── Parts check ───────────────────────────────────────────────────────────────
// The other 5 files each end by ticking a box in window.__NCB_PARTS. If any box is
// empty (a file failed to download, or only some of the files were uploaded), show
// a plain message and reload once, instead of a blank screen. Then stop here so
// the app does not start half-built.
(function () {
  var need = ["images", "core", "screens", "match", "organizer"];
  var have = window.__NCB_PARTS || {};
  var missing = need.filter(function (k) { return !have[k]; });
  try { if (!missing.length) { sessionStorage.removeItem("ncb-parts-reload"); } } catch (e) {}
  if (!missing.length) return;
  var already = false;
  try { already = sessionStorage.getItem("ncb-parts-reload") === "1"; sessionStorage.setItem("ncb-parts-reload", "1"); } catch (e) {}
  if (!already) { try { location.reload(); } catch (e) {} }
  var root = document.getElementById("root");
  if (root) {
    root.innerHTML = '<div style="font-family:sans-serif;padding:32px 24px;max-width:340px;margin:0 auto;text-align:center">' +
      '<h2 style="margin:0 0 8px">NC BLAST did not finish loading</h2>' +
      '<p style="font-size:14px;line-height:1.5">Part of the app did not download (' + missing.join(", ") + '). This usually fixes itself with a reload.</p>' +
      '<button onclick="location.reload()" style="padding:12px 24px;font-size:15px;font-weight:700">Reload</button></div>';
  }
  throw new Error("NC BLAST: parts missing: " + missing.join(", "));
})();
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
/* ═══════════════════════════════════════
   FEATURE FLAGS PANEL
   Per-device flag toggles. Lets a judge turn off a change from their own
   tablet if it misbehaves mid-event, without a code change or redeploy.
   Saving writes to localStorage; a reload applies it. --espiiii
═══════════════════════════════════════ */
function FlagsPanel({ onBack }) {
  const ids = allFlagIds();
  // Working copy: current effective state per flag.
  const [draft, setDraft] = useState(() => {
    const d = {};
    ids.forEach(id => {
      d[String(id)] = ff(id);
    });
    return d;
  });
  const [saved, setSaved] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);

  const dirty = ids.some(id => draft[String(id)] !== ff(id));

  const card = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  };

  const save = () => {
    // Only store ids that differ from the shipped default, so devices track
    // future default changes unless the judge explicitly overrode them.
    const overrides = {};
    ids.forEach(id => {
      const want = draft[String(id)];
      if (want !== flagDefault(id)) overrides[String(id)] = want;
    });
    saveFlagOverrides(overrides);
    setSaved(true);
  };

  const resetAll = () => {
    clearFlagOverrides();
    const d = {};
    ids.forEach(id => {
      d[String(id)] = flagDefault(id);
    });
    setDraft(d);
    setSaved(true);
  };

  if (staffOpen) return /*#__PURE__*/React.createElement(StaffFlagsPanel, { onBack: () => setStaffOpen(false) });

  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "var(--bg-solid)",
      padding: "18px 16px 40px",
      fontFamily: "'Outfit',sans-serif",
      boxSizing: "border-box"
    }
  },
    /*#__PURE__*/React.createElement("button", {
      onClick: onBack,
      style: {
        background: "none",
        border: "1px solid var(--border2)",
        borderRadius: 9,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-muted)",
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 14
      }
    }, "← Back"),
    /*#__PURE__*/React.createElement("button", {
      onClick: () => setStaffOpen(true),
      style: {
        background: "none",
        border: "1px solid var(--border2)",
        borderRadius: 9,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-muted)",
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer",
        marginBottom: 14,
        marginLeft: 8
      }
    }, "🔑 Staff"),

    /*#__PURE__*/React.createElement("h1", {
      style: { fontSize: 20, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 4px" }
    }, "⚙️ Feature Flags"),
    /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.5 }
    }, "Turn a change off on this device only. If something breaks mid-event, uncheck it, save, then reload. Other tablets are unaffected."),

    ids.length === 0 && /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 13, color: "var(--text-disabled)", fontStyle: "italic" }
    }, "No feature flags defined."),

    ids.map(id => {
      const key = String(id);
      const info = FLAG_INFO[key] || FLAG_INFO[id] || {};
      const on = !!draft[key];
      const isDefault = on === flagDefault(id);
      return /*#__PURE__*/React.createElement("div", { key: key, style: card },
        /*#__PURE__*/React.createElement("label", {
          style: { display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }
        },
          /*#__PURE__*/React.createElement("input", {
            type: "checkbox",
            checked: on,
            disabled: flagStaffLockedOff(id),
            onChange: e => {
              setSaved(false);
              setDraft(prev => ({ ...prev, [key]: e.target.checked }));
            },
            style: { width: 20, height: 20, marginTop: 2, flexShrink: 0, cursor: "pointer" }
          }),
          /*#__PURE__*/React.createElement("div", { style: { flex: 1 } },
            /*#__PURE__*/React.createElement("div", {
              style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }
            },
              /*#__PURE__*/React.createElement("span", {
                style: { fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }
              }, info.name || `Flag ${id}`),
              /*#__PURE__*/React.createElement("span", {
                style: { fontSize: 10, fontWeight: 700, color: "var(--text-faint)", letterSpacing: 0.5 }
              }, "#" + id),
              flagStaffLockedOff(id) && /*#__PURE__*/React.createElement("span", {
                style: {
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#B91C1C",
                  background: "#EF444422",
                  border: "1px solid #EF444455",
                  borderRadius: 5,
                  padding: "1px 5px",
                  letterSpacing: 0.4
                }
              }, "OFF BY STAFF"),
              !isDefault && /*#__PURE__*/React.createElement("span", {
                style: {
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#B45309",
                  background: "#F59E0B22",
                  border: "1px solid #F59E0B55",
                  borderRadius: 5,
                  padding: "1px 5px",
                  letterSpacing: 0.4
                }
              }, "OVERRIDDEN")
            ),
            info.desc && /*#__PURE__*/React.createElement("p", {
              style: { fontSize: 11, color: "var(--text-secondary)", margin: "5px 0 0", lineHeight: 1.5 }
            }, info.desc),
            !on && info.off && /*#__PURE__*/React.createElement("p", {
              style: { fontSize: 11, color: "var(--text-faint)", margin: "5px 0 0", lineHeight: 1.5, fontStyle: "italic" }
            }, info.off)
          )
        )
      );
    }),

    saved && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#22C55E18",
        border: "1px solid #22C55E55",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10
      }
    },
      /*#__PURE__*/React.createElement("p", {
        style: { fontSize: 12, fontWeight: 700, color: "#15803D", margin: "0 0 8px" }
      }, "Saved. Reload for it to take effect."),
      /*#__PURE__*/React.createElement("button", {
        onClick: () => window.location.reload(),
        style: {
          padding: "10px 0",
          width: "100%",
          borderRadius: 10,
          border: "none",
          background: "#22C55E",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "'Outfit',sans-serif",
          cursor: "pointer"
        }
      }, "↻ Reload now")
    ),

    ids.length > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: save,
      disabled: !dirty,
      style: {
        padding: "13px 0",
        width: "100%",
        borderRadius: 12,
        border: "none",
        background: dirty ? "linear-gradient(135deg,#EA580C,#DC2626)" : "var(--surface3)",
        color: dirty ? "#fff" : "var(--text-disabled)",
        fontSize: 14,
        fontWeight: 900,
        fontFamily: "'Outfit',sans-serif",
        cursor: dirty ? "pointer" : "not-allowed",
        marginBottom: 8
      }
    }, dirty ? "Save changes" : "No changes"),

    ids.length > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: resetAll,
      style: {
        padding: "10px 0",
        width: "100%",
        borderRadius: 10,
        border: "1px solid var(--border2)",
        background: "transparent",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        cursor: "pointer"
      }
    }, "Reset to app defaults")
  );
}

/* ═══════════════════════════════════════
   STAFF FLAGS PANEL
   Master-key-only. Chooses, for every device, whether each flag starts On or
   Off (or follows the app's built-in default). Saved on the server (Worker
   route /flags). Devices pick it up the next time they load BLAST. A flag set
   to Off here cannot be turned back on by a judge on their own tablet.
   Overlay-only flags are left out: those go out through flags.js.
═══════════════════════════════════════ */
function StaffFlagsPanel({ onBack }) {
  const storedKey = () => {
    try { return sessionStorage.getItem("ncblast-master-key") || localStorage.getItem("ncblast-master-key") || ""; } catch { return ""; }
  };
  const ids = allFlagIds().filter(id => STAFF_FLAG_EXCLUDED.indexOf(id) === -1);
  const builtIn = id => { try { return FLAG_DEFAULTS.has(id); } catch { return false; } };
  const [key, setKey] = useState(storedKey());
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState(() => {
    const d = {};
    ids.forEach(id => {
      const k = String(id);
      d[k] = Object.prototype.hasOwnProperty.call(STAFF_FLAGS, k) ? (STAFF_FLAGS[k] ? "on" : "off") : "default";
    });
    return d;
  });
  const [dirty, setDirty] = useState(false);

  const call = async (body) => {
    const res = await fetch(`${OVERLAY_WORKER}/flags`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Master-Key": key.trim() },
      body: JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { res, data };
  };

  const unlock = async () => {
    if (!key.trim()) { setMsg("Enter the master key."); return; }
    setBusy(true); setMsg("");
    try {
      const { res, data } = await call({ verify: true });
      if (res.status === 403) { setMsg("That master key was not accepted."); }
      else if (res.status === 404) { setMsg("The server does not have the flags feature yet. The Worker update has not been installed."); }
      else if (!res.ok || !data || !data.ok) { setMsg("Could not check the key. Try again."); }
      else {
        try { sessionStorage.setItem("ncblast-master-key", key.trim()); } catch {}
        // Start from what the server has right now, not this device's older copy.
        try {
          const g = await fetch(`${OVERLAY_WORKER}/flags`);
          const gd = g.ok ? await g.json() : null;
          if (gd && gd.ok && gd.flags) {
            const fresh = cleanStaffFlags(gd.flags);
            const d = {};
            ids.forEach(id => {
              const k = String(id);
              d[k] = Object.prototype.hasOwnProperty.call(fresh, k) ? (fresh[k] ? "on" : "off") : "default";
            });
            setDraft(d);
          }
        } catch {}
        setUnlocked(true);
      }
    } catch {
      setMsg("Could not reach the server. Check the connection.");
    }
    setBusy(false);
  };

  const save = async () => {
    const flags = {};
    ids.forEach(id => {
      const v = draft[String(id)];
      if (v === "on") flags[String(id)] = true;
      else if (v === "off") flags[String(id)] = false;
    });
    setBusy(true); setMsg("");
    try {
      const { res, data } = await call({ flags });
      if (res.status === 403) setMsg("The master key was not accepted. Nothing was saved.");
      else if (!res.ok || !data || !data.ok) setMsg("Save failed: " + ((data && data.error) || "server error") + ". Nothing was changed.");
      else {
        saveStaffFlagsCache(flags);
        setDirty(false);
        setMsg("Saved. Other devices pick this up the next time they load BLAST (a reload is enough). This device: reload now.");
      }
    } catch {
      setMsg("Could not reach the server. Nothing was saved.");
    }
    setBusy(false);
  };

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 10 };
  const btnBase = { fontFamily: "'Outfit',sans-serif", cursor: "pointer", fontWeight: 800, fontSize: 12, padding: "8px 0", border: "1px solid var(--border2)", flex: 1 };
  const choice = (k, v, label, color) => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => { setDraft(p => ({ ...p, [k]: v })); setDirty(true); setMsg(""); },
    style: {
      ...btnBase,
      background: draft[k] === v ? color : "transparent",
      color: draft[k] === v ? "#fff" : "var(--text-muted)",
      borderColor: draft[k] === v ? color : "var(--border2)"
    }
  }, label);

  const page = { minHeight: "100vh", background: "var(--bg-solid)", padding: "18px 16px 40px", fontFamily: "'Outfit',sans-serif", boxSizing: "border-box" };
  const backBtn = /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: { background: "none", border: "1px solid var(--border2)", borderRadius: 9, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "'Outfit',sans-serif", cursor: "pointer", marginBottom: 14 }
  }, "← Back");

  if (!unlocked) {
    return /*#__PURE__*/React.createElement("div", { style: page },
      backBtn,
      /*#__PURE__*/React.createElement("h1", { style: { fontSize: 20, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 4px" } }, "🔑 Staff flags"),
      /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.5 } }, "Enter the master key to choose which flags start On or Off for every device."),
      /*#__PURE__*/React.createElement("input", {
        type: "password",
        value: key,
        placeholder: "Master key",
        autoComplete: "off",
        onChange: e => { setKey(e.target.value); setMsg(""); },
        onKeyDown: e => { if (e.key === "Enter") unlock(); },
        style: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 14, fontFamily: "'Outfit',sans-serif", marginBottom: 10 }
      }),
      msg && /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, fontWeight: 700, color: "#B91C1C", margin: "0 0 10px" } }, msg),
      /*#__PURE__*/React.createElement("button", {
        onClick: unlock,
        disabled: busy,
        style: { padding: "13px 0", width: "100%", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#EA580C,#DC2626)", color: "#fff", fontSize: 14, fontWeight: 900, fontFamily: "'Outfit',sans-serif", cursor: busy ? "wait" : "pointer" }
      }, busy ? "Checking..." : "Unlock")
    );
  }

  return /*#__PURE__*/React.createElement("div", { style: page },
    backBtn,
    /*#__PURE__*/React.createElement("h1", { style: { fontSize: 20, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 4px" } }, "🔑 Staff flags"),
    /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.5 } }, "These choices apply to every device the next time it loads BLAST. \"App default\" follows the built-in setting. \"Off\" cannot be turned back on by a judge. \"On\" can still be turned off by a judge on their own device."),
    ids.map(id => {
      const k = String(id);
      const info = FLAG_INFO[k] || FLAG_INFO[id] || {};
      return /*#__PURE__*/React.createElement("div", { key: k, style: card },
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 14, fontWeight: 800, color: "var(--text-primary)" } }, info.name || `Flag ${id}`),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: "var(--text-faint)", letterSpacing: 0.5 } }, "#" + id)
        ),
        info.desc && /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, color: "var(--text-secondary)", margin: "5px 0 8px", lineHeight: 1.5 } }, info.desc),
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", borderRadius: 9, overflow: "hidden", gap: 0 } },
          choice(k, "default", "App default (" + (builtIn(id) ? "On" : "Off") + ")", "#64748B"),
          choice(k, "on", "On", "#16A34A"),
          choice(k, "off", "Off", "#DC2626")
        )
      );
    }),
    msg && /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, fontWeight: 700, color: msg.indexOf("Saved") === 0 ? "#15803D" : "#B91C1C", margin: "0 0 10px", lineHeight: 1.5 } }, msg),
    /*#__PURE__*/React.createElement("button", {
      onClick: save,
      disabled: !dirty || busy,
      style: { padding: "13px 0", width: "100%", borderRadius: 12, border: "none", background: dirty ? "linear-gradient(135deg,#EA580C,#DC2626)" : "var(--surface3)", color: dirty ? "#fff" : "var(--text-disabled)", fontSize: 14, fontWeight: 900, fontFamily: "'Outfit',sans-serif", cursor: dirty && !busy ? "pointer" : "not-allowed", marginBottom: 8 }
    }, busy ? "Saving..." : dirty ? "Save for all devices" : "No changes"),
    msg.indexOf("Saved") === 0 && /*#__PURE__*/React.createElement("button", {
      onClick: () => window.location.reload(),
      style: { padding: "10px 0", width: "100%", borderRadius: 10, border: "none", background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: "'Outfit',sans-serif", cursor: "pointer" }
    }, "↻ Reload now")
  );
}

function RolePicker({
  onSelect,
  judge,
  sharedJudges,
  onLogout,
  reading,
  toggleReading,
  onOpenFlags
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
      fontFamily: "'Outfit',sans-serif",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    // Small utility entry, top-right. Deliberately low emphasis so it does not
    // compete with the role buttons. --espiiii
    onClick: onOpenFlags,
    title: "Feature flags",
    "aria-label": "Feature flags",
    style: {
      position: "absolute",
      top: 12,
      // FLAG 1005: the "?" button takes the corner, so move over. --espiiii
      right: 56,
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid var(--border2)",
      background: "var(--surface)",
      color: "var(--text-faint)",
      fontSize: 15,
      lineHeight: 1,
      fontFamily: "'Outfit',sans-serif",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0
    }
  }, "⚙️"), /*#__PURE__*/React.createElement("div", {
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
  // Only depends on viewport scale, so don't rebuild ~270 style objects every
  // render. Stable identity also lets memoized children skip work. --espiiii
  const memoS = useMemo(() => makeS(sc), [sc]);
  S = memoS;
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
      const saved = sessionStorage.getItem("ncblast-pending-role");
      return saved && saved !== "ezq" ? saved : null;
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
  // Feature flags panel. Not persisted — closing or reloading returns home.
  // --espiiii
  const [flagsOpen, setFlagsOpen] = useState(false);

  // All judge-side state declared unconditionally (React rules require this)
  const [screen, setScreen] = useState("format");
  const [eventRanked, setEventRanked] = useState(true); // false when org created event as UNRANKED
  const [eventFast, setEventFast] = useState(false); // true when the org created the event as Fast Blast (flag 1031)
  const [config, setConfig] = useState({
    pts: 4,   // always 4 pts — set by org ruleset
    bo: 3,    // always best-of-3 — set by org ruleset
    tm: true, // always ranked mode — org controls this at event creation
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
  // Remembers the last payload we successfully handed to Sheets. Used to skip a
  // duplicate POST of the same match without disabling the submit button — that
  // button also submits to Challonge, and gating it broke Challonge. A new match
  // produces a different payload, so it is never blocked. --espiiii
  const lastSheetsPayloadRef = useRef(null);
  // FLAG 1013: "send to database" runs beside the Sheets submit. Its own status line,
  // so Sheets wording/state is never touched. null | "sending" | "sent" | "failed" | "skipped".
  // dbPendingRef keeps the last payload so a failed send can be retried with one tap
  // (safe: the database ignores battles it already has). lastDbPayloadRef is the
  // double-send guard (same idea as lastSheetsPayloadRef). dbCsvPayloadRef makes sure the
  // CSV fallback downloads once per payload, not again on every retry. --espiiii
  const [dbStatus, setDbStatus] = useState(null);
  const [dbError, setDbError] = useState("");
  const lastDbPayloadRef = useRef(null);
  const dbPendingRef = useRef(null);
  // FLAG 1015: the match TIMING send has its own status line and its own retry, so the battle
  // send above is never touched by it. null | "sending" | "sent" | "failed" | "skipped".
  const [timingSendStatus, setTimingSendStatus] = useState(null);
  const [timingSendError, setTimingSendError] = useState("");
  const dbCsvPayloadRef = useRef(null);
  // FLAG 1005: top-level trail + live state (which area, Sheets result). The
  // flag is checked inside each hook so hook order never changes. --espiiii
  useEffect(() => {
    bugLog("screen", "area: " + (role || "home") + (flagsOpen ? " (flags menu)" : ""));
  }, [role, flagsOpen]);
  useEffect(() => {
    bugLog("screen", "judge step: " + screen);
  }, [screen]);
  useEffect(() => {
    if (sheetsStatus != null) bugLog("submit", "sheets: " + String(sheetsStatus));
  }, [sheetsStatus]);
  useEffect(() => {
    try {
      window.__ncbLiveApp = {
        at: new Date().toISOString(),
        area: role || "home",
        flagsMenuOpen: !!flagsOpen,
        judgeStep: screen,
        eventRanked: !!eventRanked,
        eventFast: !!eventFast,
        judge: judge || "",
        sheetsStatus: sheetsStatus ?? null
      };
    } catch {}
  });
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
  // FLAG 1037: the deck builder asks for a fresh parts list after an organizer adds a part a judge asked for.
  useEffect(() => {
    const reload = () => fetch(`${OVERLAY_WORKER}/parts`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    }).then(r => r.json()).then(d => {
      if (d.ok && d.parts) {
        const fresh = mergeWithDefaults(d.parts);
        setParts(fresh);
        sSave(KEYS.parts, fresh);
      }
    }).catch(() => {});
    window.addEventListener("ncblast:parts-refresh", reload);
    return () => window.removeEventListener("ncblast:parts-refresh", reload);
  }, []);
  const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzvb5LkqMDXaMVJNFNQSf7dsUJK_0vbTfQ4gRRISGsRWg4mINvawLROxn0SaPqJ5o9E/exec";

  // Download CSV to device — always available, never sends to sheets
  // Pick-priority marker. Appends "~P~" to the name of the player who had pick priority in
  // set 1 of the match (meta.set1PriorityName). Used ONLY on the P1/P2 name columns of the
  // Sheets rows and the CSV backup - winner/loser/scorer/judge-log columns stay clean.
  // Unknown priority (null) = no tag, same as events from before tracking existed.
  const tagP = (name, meta) => meta && meta.set1PriorityName && name === meta.set1PriorityName ? `${name}~P~` : name;

  const handleDownloadCSV = (roundLog, meta, asError) => {
    let csv = "Slot,Set,Shuffle,Judge,Tournament,Winner,WinnerCombo,FinishType,Points,Penalty,P1,P1Side,P1Score,P1Combo,P2,P2Side,P2Score,P2Combo,Timestamp\n";
    roundLog.forEach(r => {
      csv += `${r.slot},${r.set},${r.shuffle},"${r.judge || ""}","${meta.config?.tournamentName || ""}","${r.scorer}","${r.winnerCombo}",${r.type},${r.points},${r.penalty ? 1 : 0},"${tagP(r.p1Name, meta)}",${r.p1Side || ""},"${r.p1Score}","${comboStr(r.p1Combo)}","${tagP(r.p2Name, meta)}",${r.p2Side || ""},"${r.p2Score}","${comboStr(r.p2Combo)}",${r.time}\n`;
    });
    // FLAG 1016: when this is an ERROR copy (a send failed), it goes to the cloud backup folder
    // instead of this device. The Download CSV button and the "no Sheets" submit still download.
    if (asError && ff(1016)) {
      cloudBackupEnqueue({
        kind: "battle-error",
        slug: meta.challongeSlug,
        fileName: backupFileName(meta.config?.tournamentName, meta.judge || roundLog[0] && roundLog[0].judge, meta.p1, meta.p2, meta.timingRound, ".csv"),
        content: csv
      }).catch(() => {});
      return;
    }
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

  // FLAG 1015: send one match's timing lines to the database through the BLAST Worker's
  // /db/timing door (the Worker adds the secret). Sending the same match again is safe: the
  // database swaps that match's old lines for the new ones. Every send goes through a small
  // "outbox" kept on the device: a failed send retries by itself every minute (and when the
  // connection comes back, and after the app is reopened). After 10 minutes of failing, the
  // timing is uploaded as a CSV to the cloud backup folder (Worker /backup/upload); only if that
  // fails too is the CSV downloaded to this device. None of this touches Sheets, the battles
  // send or the bracket.
  const timingOutboxRef = useRef(null);
  if (timingOutboxRef.current === null) timingOutboxRef.current = timingOutboxLoad();
  const timingShownIdRef = useRef(null);
  const timingBusyRef = useRef(false);
  const timingAgainRef = useRef(false);
  const showTimingStatus = (id, status, err) => {
    if (id !== timingShownIdRef.current) return; // only the match on screen owns the status line
    setTimingSendError(err || "");
    setTimingSendStatus(status);
  };
  const timingDropItem = id => {
    timingOutboxRef.current = timingOutboxRef.current.filter(x => x.id !== id);
    timingOutboxSave(timingOutboxRef.current);
  };
  // One try. Returns null when the database accepted it, otherwise a readable reason.
  const timingTryOnce = async item => {
    try {
      const resp = await fetch(`${OVERLAY_WORKER}/db/timing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: item.payload,
        signal: AbortSignal.timeout(20000)
      });
      let reply = null;
      try {
        reply = await resp.json();
      } catch (_) {}
      if (!resp.ok || !reply || reply.ok !== true) {
        let detail = "HTTP " + resp.status;
        if (reply && reply.error) detail += " - " + reply.error;else if (!reply) detail += " - reply was not JSON";
        return detail;
      }
      console.log("[timing] inserted " + reply.inserted + ", replaced " + reply.replaced);
      if (Array.isArray(reply.notes) && reply.notes.length) console.log("[timing] notes:", reply.notes);
      return null;
    } catch (err) {
      const msg = err && err.message ? err.message : "unknown";
      return err && (err.name === "TimeoutError" || err.name === "AbortError") ? "timed out after 20 seconds" : err instanceof TypeError ? "network: " + msg : msg;
    }
  };
  // Out of patience: the CSV is queued for the cloud backup folder (flag 1016), which keeps
  // trying until the upload works. Only with 1016 off is it downloaded to this device.
  const timingGiveUp = async item => {
    let p = null;
    try {
      p = JSON.parse(item.payload);
    } catch (_) {}
    if (!p) {
      timingDropItem(item.id);
      return;
    }
    const fileName = timingBackupFileName(p, item.round);
    const content = timingCsv(p);
    if (ff(1016)) {
      cloudBackupEnqueue({
        kind: "timing-error",
        slug: p.slug,
        fileName,
        content
      }).catch(() => {});
      timingDropItem(item.id);
      showTimingStatus(item.id, "backup");
      bugLog("submit", "timing: backup file queued for the cloud folder");
      return;
    }
    try {
      timingDownloadText(fileName, content);
    } catch (_) {}
    timingDropItem(item.id);
    showTimingStatus(item.id, "downloaded");
    bugLog("submit", "timing: CSV downloaded");
  };
  const timingAttempt = async item => {
    showTimingStatus(item.id, "sending");
    const reason = await timingTryOnce(item);
    if (!reason) {
      timingDropItem(item.id);
      showTimingStatus(item.id, "sent");
      bugLog("submit", "timing: sent");
      return;
    }
    console.warn("[timing] send failed:", reason);
    item.tries = (item.tries || 0) + 1;
    timingOutboxSave(timingOutboxRef.current);
    if (Date.now() - item.addedAt > TIMING_GIVE_UP_MS) {
      await timingGiveUp(item);
      return;
    }
    showTimingStatus(item.id, "failed", reason.slice(0, 400));
    bugLog("submit", "timing: failed - " + reason);
  };
  const processTimingOutbox = async () => {
    if (!ff(1015)) return;
    if (timingBusyRef.current) {
      timingAgainRef.current = true; // something new arrived mid-run: go round once more
      return;
    }
    timingBusyRef.current = true;
    try {
      for (const item of [...timingOutboxRef.current]) await timingAttempt(item);
    } catch (_) {} finally {
      timingBusyRef.current = false;
    }
    if (timingAgainRef.current) {
      timingAgainRef.current = false;
      processTimingOutbox().catch(() => {});
    }
  };
  const processTimingRef = useRef(null);
  processTimingRef.current = processTimingOutbox;
  useEffect(() => {
    const run = () => {
      if (processTimingRef.current) processTimingRef.current().catch(() => {});
    };
    const first = setTimeout(run, 4000); // after the app opens: pick up anything left in the outbox
    const every = setInterval(run, 60000);
    window.addEventListener("online", run);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener("online", run);
    };
  }, []);
  const sendTiming = async (timing, round) => {
    if (!timing) {
      timingShownIdRef.current = null;
      setTimingSendStatus("skipped");
      return;
    }
    const id = String(timing.matchKey);
    timingShownIdRef.current = id;
    // Re-submitting the same match replaces its waiting copy (the database does the same).
    timingOutboxRef.current = [...timingOutboxRef.current.filter(x => x.id !== id), {
      id,
      payload: JSON.stringify(timing),
      round: round ?? null,
      addedAt: Date.now(),
      tries: 0
    }];
    timingOutboxSave(timingOutboxRef.current);
    await processTimingOutbox();
  };
  const handleRetryTiming = () => {
    processTimingOutbox().catch(() => {});
  };

  // FLAG 1013: send one finished match to the NC BLAST database (through the BLAST
  // Worker's /db/ingest door, which holds the database secret - never put it here).
  // Runs BESIDE the Sheets submit and reuses the exact same rows array. Nothing in
  // here touches the Sheets status or the Challonge submit: success or failure only
  // changes the separate "Database:" status line. Resending is always safe because
  // the database ignores any battle it already has. --espiiii
  const postDatabasePayload = async (payload, roundLog, meta) => {
    setDbError("");
    setDbStatus("sending");
    try {
      // Normal CORS fetch (NOT no-cors) so the reply can be read.
      const resp = await fetch(`${OVERLAY_WORKER}/db/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: payload,
        signal: AbortSignal.timeout(20000)
      });
      let reply = null;
      try {
        reply = await resp.json();
      } catch (_) {}
      if (!resp.ok || !reply || reply.ok !== true) {
        // Build a readable reason with the HTTP code so a failed send can be diagnosed
        // from the screen: code, the Worker's message, and anything the database added.
        let detail = "HTTP " + resp.status;
        if (reply && reply.error) detail += " - " + reply.error;else if (!reply) detail += " - reply was not JSON";
        if (reply && reply.raw) detail += " - database said: " + String(reply.raw).slice(0, 160);
        if (reply && typeof reply === "object") {
          const extra = {
            ...reply
          };
          delete extra.ok;
          delete extra.error;
          delete extra.raw;
          delete extra.inserted;
          delete extra.skipped;
          delete extra.notes;
          if (Object.keys(extra).length) detail += " - " + JSON.stringify(extra).slice(0, 200);
        }
        throw new Error(detail);
      }
      lastDbPayloadRef.current = payload;
      dbPendingRef.current = null;
      // skipped > 0 just means a repeat submit - fine. "notes" are small things the
      // database tidied up: console only, never shown to the judge.
      console.log("[database] inserted " + reply.inserted + ", skipped " + reply.skipped);
      if (Array.isArray(reply.notes) ? reply.notes.length : reply.notes) console.log("[database] notes:", reply.notes);
      setDbStatus("sent");
      bugLog("submit", "database: sent");
    } catch (err) {
      const msg = err && err.message ? err.message : "unknown";
      const reason = err && (err.name === "TimeoutError" || err.name === "AbortError") ? "timed out after 20 seconds" : err instanceof TypeError ? "network: " + msg : msg;
      console.warn("[database] send failed:", reason);
      setDbError(reason.slice(0, 400));
      setDbStatus("failed");
      bugLog("submit", "database: failed - " + reason);
      // Never lose the match: use the same CSV fallback as Sheets, once per payload
      // (a retry that fails again does not download a second copy).
      if (dbCsvPayloadRef.current !== payload) {
        dbCsvPayloadRef.current = payload;
        try {
          handleDownloadCSV(roundLog, meta, true);
        } catch (_) {}
      }
    }
  };
  const sendToDatabase = async (rows, flagged, roundLog, meta) => {
    const slug = meta && meta.challongeSlug;
    if (!slug) {
      setDbStatus("skipped");
      return;
    }
    const payload = JSON.stringify({
      slug,
      rows,
      flagged: !!flagged
    });
    // Keep it so the judge can tap to retry if this send fails.
    dbPendingRef.current = {
      payload,
      roundLog,
      meta
    };
    // Same double-send idea as Sheets: an exact repeat of a send that already
    // succeeded is skipped. A new match gives a different payload, so it is never blocked.
    if (lastDbPayloadRef.current === payload) {
      setDbStatus("sent");
      return;
    }
    await postDatabasePayload(payload, roundLog, meta);
  };
  // "Tap to retry" on the Database status line.
  const handleRetryDatabase = () => {
    const pending = dbPendingRef.current;
    if (!pending) return;
    postDatabasePayload(pending.payload, pending.roundLog, pending.meta).catch(() => {});
  };

  // Send to Google Sheets only — no CSV download
  const handleSendSheets = async (roundLog, meta) => {
    // Fast Blast (flag 1031): its stats are not kept, so nothing goes to Sheets or the database.
    // The Challonge result is submitted by a different button and is not affected.
    if (eventFast) return;
    // FLAG 1013: a judge name is required to submit, so a battle that was logged with a
    // blank name takes the name entered at submit time. Off = rows built exactly as before.
    if (ff(1013) && meta && meta.judge) roundLog = roundLog.map(r => r && !r.judge ? {
      ...r,
      judge: meta.judge
    } : r);
    // Sheet 1: existing summary rows
    const rows = roundLog.map(r => [r.time, r.judge || "", meta.config?.tournamentName || "", `${r.p1Name} vs ${r.p2Name}`, tagP(r.p1Name, meta), r.p1Side || "", tagP(r.p2Name, meta), r.p2Side || "", r.set, r.shuffle, r.slot, r.scorer, r.winnerCombo, r.typeName, r.points, r.penalty ? 1 : 0, r.p1Score, r.p2Score, comboStr(r.p1Combo), comboStr(r.p2Combo)]);

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
      return [dateTime, r.judge || "", tagP(r.p1Name, meta), r.p1Side || "", comboStr(r.p1Combo), tagP(r.p2Name, meta), r.p2Side || "", comboStr(r.p2Combo), winnerName, winnerCombo, winCondition, loserCombo, loserName];
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
    const payload = JSON.stringify({
      rows,
      battleRows,
      judgeLog
    });
    // FLAG 1013: also send the SAME rows to the database. Not awaited and fully wrapped,
    // so it can never delay, fail or change the Sheets / Challonge submit below.
    // It runs even when the Sheets double-send guard below skips, so a database send
    // that failed earlier gets another try (the database ignores repeats). --espiiii
    if (ff(1013)) {
      try {
        sendToDatabase(rows, roundLog.some(r => r && Array.isArray(r.errors) && r.errors.length > 0), roundLog, meta).catch(() => {});
      } catch (_) {}
    }
    // FLAG 1015: the match timing goes to the database beside the battles. Not awaited and fully
    // wrapped, so it can never delay, fail or change the Sheets / Challonge submit below.
    if (ff(1015)) {
      try {
        sendTiming(meta && meta.timing, meta && meta.timingRound).catch(() => {});
      } catch (_) {}
    }
    // Apps Script /exec answers with a 302 to script.googleusercontent.com, and
    // that target does not reliably send CORS headers. fetch follows the
    // redirect, the CORS check fails, and the promise rejects — AFTER the script
    // has already written the rows. That is why judges saw "Sheets failed" with
    // the results sitting in the spreadsheet.
    //
    // So stop pretending we can read the reply: mode "no-cors" makes the
    // response deliberately opaque. Resolving means the request was delivered
    // ("sent"); rejecting means it genuinely never went out ("error").
    // Do NOT add a Content-Type header — that triggers a CORS preflight, which
    // Apps Script does not answer, and submission breaks entirely. --espiiii
    // Skip an exact re-send of the same match. Guarded here rather than on the
    // submit button, which also submits to Challonge. --espiiii
    if (lastSheetsPayloadRef.current === payload) {
      setSheetsStatus("sent");
      return;
    }
    setSheetsStatus("sending");
    try {
      await fetch(SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        body: payload,
        signal: AbortSignal.timeout(20000)
      });
      lastSheetsPayloadRef.current = payload;
      setSheetsStatus("sent");
    } catch (err) {
      setSheetsStatus("error");
      // The old message claimed a CSV was downloaded but nothing was. Now it is
      // true, so a real failure never loses the match. --espiiii
      try {
        handleDownloadCSV(roundLog, meta, true);
      } catch (_) {}
    }
  };

  // Branch on role in the render — no early returns before hooks
  // Plain state, not a role — roles persist to sessionStorage, which would
  // strand a judge on this panel after the reload. --espiiii
  if (flagsOpen) return /*#__PURE__*/React.createElement(FlagsPanel, {
    onBack: () => setFlagsOpen(false)
  });
  if (!role) return /*#__PURE__*/React.createElement(RolePicker, {
    onSelect: chooseRole,
    onOpenFlags: () => setFlagsOpen(true),
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
    },
    onRankedChange: ranked => setEventRanked(ranked),
    onFastChange: fast => setEventFast(fast)
  }), screen === "match" && /*#__PURE__*/React.createElement(MatchScreen, {
    config: config,
    parts: parts,
    players: players,
    judge: judge,
    setJudge: setJudge,
    sharedJudges: sharedJudges,
    sheetsStatus: sheetsStatus,
    setSheetsStatus: setSheetsStatus,
    dbStatus: dbStatus,
    dbError: dbError,
    setDbStatus: setDbStatus,
    onRetryDatabase: handleRetryDatabase,
    timingSendStatus: timingSendStatus,
    timingSendError: timingSendError,
    setTimingSendStatus: setTimingSendStatus,
    onRetryTiming: handleRetryTiming,
    onBack: () => setScreen("format"),
    onMainMenu: () => setScreen("format"),
    onDownloadCSV: handleDownloadCSV,
    onSendSheets: handleSendSheets,
    onOpenLib: () => setLibOpen(true),
    dark: dark,
    toggleDark: toggleDark,
    challongeSlug: challongeSlug,
    challongeParticipants: challongeParticipants,
    onParticipantsRefresh: pmap => {
      setChallongeParticipants(pmap);
      sSave(KEYS.challongeMap, {
        slug: challongeSlug,
        participants: pmap
      });
    },
    eventRanked: eventRanked,
    eventFast: eventFast
  }));
}
/* ═══════════════════════════════════════
   BUG REPORTS — FLAG 1005 (report + UI)
   A "?" button that is always on screen. Judge types what went wrong, taps
   Submit, gets a bug number and a "Send to organizers" button that opens the
   phone's share sheet with the report attached. Nothing leaves the device
   unless they send it.
   --espiiii
═══════════════════════════════════════ */

// Not sequential — there is no server to count. Date + random is unique
// enough to match a report to a message.
function _bugId() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L - easy to read out loud
  let r = "";
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `NCB-${mm}${dd}-${r}`;
}

function _bugRead(store, key) {
  try {
    const v = store.getItem(key);
    if (v == null) return null;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  } catch {
    return null;
  }
}

// Key names and sizes only, never values. Shows a bloated log at a glance.
function _bugStorageSizes(store) {
  const out = {};
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      out[k] = (store.getItem(k) || "").length;
    }
  } catch {}
  return out;
}

// ALLOWLIST ONLY. Every value included is named here on purpose. Auth tokens,
// the master key and OAuth results are never read, and anything new added to
// storage later stays out until someone adds it here deliberately.
function buildBugReport(description) {
  const resume = _bugRead(sessionStorage, "ncblast-match-resume-v1");
  const stored = _bugRead(localStorage, "bx-matchlog-v1");
  const logArr = Array.isArray(stored) ? stored : [];
  const key = resume && resume.matchKey ? resume.matchKey : null;
  const flags = {};
  allFlagIds().forEach(id => {
    flags[id] = { on: ff(id), default: flagDefault(id) };
  });
  return {
    reportVersion: 2, // 2 = adds live + tap/screen/submit trail
    id: _bugId(),
    createdAt: new Date().toISOString(),
    description: String(description || "").slice(0, 4000),
    app: {
      url: location.origin + location.pathname,
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      screen: { w: screen.width, h: screen.height },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      dpr: window.devicePixelRatio,
      timezone: (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          return "";
        }
      })()
    },
    flags,
    // What was on screen when the report was filed (FLAG 1005). Built by the
    // app from named fields only, never copied from storage.
    live: {
      app: window.__ncbLiveApp || null,
      match: window.__ncbLiveMatch || null
    },
    state: {
      role: _bugRead(sessionStorage, "ncblast-pending-role"),
      resume,
      matchStart: _bugRead(localStorage, "bx-matchstart-v1"),
      overlaySlot: _bugRead(localStorage, "bx-overlay-slot-v1"),
      dark: _bugRead(localStorage, "ncblast-dark"),
      reading: _bugRead(localStorage, "ncblast-reading")
    },
    battles: {
      totalStored: logArr.length,
      currentMatchKey: key,
      currentMatch: key ? logArr.filter(e => e && e.matchKey === key) : [],
      recent: logArr.slice(-60)
    },
    storageSizes: {
      local: _bugStorageSizes(localStorage),
      session: _bugStorageSizes(sessionStorage)
    },
    events: BUGLOG.slice()
  };
}

// Keeps a short list of filed reports so a judge can find their bug number
// again. Only id/time/description — the full report is too big to hoard.
function _bugRemember(report) {
  try {
    const list = _bugRead(localStorage, BUGREPORTS_KEY);
    const next = (Array.isArray(list) ? list : []).concat([{ id: report.id, createdAt: report.createdAt, description: report.description.slice(0, 200) }]).slice(-10);
    localStorage.setItem(BUGREPORTS_KEY, JSON.stringify(next));
  } catch {}
}

// Share sheet with the file attached where supported (most phones/tablets).
// Otherwise download the file and copy a one-line summary.
async function shareBugReport(report) {
  const json = JSON.stringify(report, null, 2);
  const fname = `ncblast-bug-${report.id}.json`;
  const summary = `NC BLAST bug ${report.id}: ${report.description.slice(0, 140)}`;
  try {
    if (navigator.canShare && typeof File === "function") {
      const file = new File([json], fname, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `NC BLAST bug ${report.id}`, text: summary });
        return "shared";
      }
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
    // any other share failure: fall through to download
  }
  try {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
  try {
    if (navigator.clipboard) await navigator.clipboard.writeText(summary);
  } catch {}
  return "downloaded";
}

const _bugFont = "'Outfit',sans-serif";
const _bugQStyle = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "2px solid #fff",
  background: "#2563EB",
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
  fontFamily: _bugFont,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  flexShrink: 0
};

// The battle screen's header has Undo in the top-right corner, where the
// floating button would sit. So on that screen the "?" lives inside the header
// instead, and the floating one hides itself while this is mounted.
function BugReportInlineButton(props) {
  useEffect(() => {
    document.body.classList.add("ncb-bug-inline");
    return () => document.body.classList.remove("ncb-bug-inline");
  }, []);
  // hidden: the "?" is drawn somewhere else (the judge cog menu), so only hide the floating one.
  if (props && props.hidden) return null;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => window.__ncbOpenBugReport && window.__ncbOpenBugReport(),
    title: "Report a problem",
    "aria-label": "Report a problem",
    style: { ..._bugQStyle, width: 28, height: 28, fontSize: 15, border: "none", boxShadow: "none" }
  }, "?");
}

function BugReporter() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [report, setReport] = useState(null);
  const [shareState, setShareState] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    window.__ncbOpenBugReport = () => setOpen(true);
    return () => {
      delete window.__ncbOpenBugReport;
    };
  }, []);

  const close = () => {
    setOpen(false);
    setText("");
    setReport(null);
    setShareState(null);
    setSending(false);
  };

  const submit = () => {
    const r = buildBugReport(text.trim());
    _bugRemember(r);
    bugLog("report", "filed " + r.id);
    setReport(r);
  };

  const send = async () => {
    if (!report || sending) return;
    setSending(true);
    // FLAG 1016: the report goes to the cloud backup folder (queued and retried if there is no
    // connection) instead of the share sheet / a file on this device.
    if (ff(1016)) {
      const fileName = bugBackupFileName(report);
      const live = report.live && report.live.match || {};
      try {
        await cloudBackupEnqueue({
          kind: "bug-report",
          slug: live.slug || "",
          fileName,
          content: JSON.stringify(report, null, 2)
        });
      } catch (_) {}
      setShareState(cloudBackupPending("bug-report", fileName) ? "queued" : "shared");
      setSending(false);
      return;
    }
    const s = await shareBugReport(report);
    setShareState(s);
    setSending(false);
  };

  const big = (bg, fg, enabled = true) => ({
    width: "100%",
    padding: "15px 0",
    borderRadius: 12,
    border: "none",
    background: enabled ? bg : "#CBD5E1",
    color: enabled ? fg : "#64748B",
    fontSize: 16,
    fontWeight: 900,
    fontFamily: _bugFont,
    cursor: enabled ? "pointer" : "not-allowed"
  });

  const quiet = {
    width: "100%",
    padding: "11px 0",
    borderRadius: 10,
    border: "1px solid #CBD5E1",
    background: "transparent",
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: _bugFont,
    cursor: "pointer",
    marginTop: 8
  };

  const fab = /*#__PURE__*/React.createElement("button", {
    id: "ncb-bug-fab",
    type: "button",
    onClick: () => setOpen(true),
    title: "Report a problem",
    "aria-label": "Report a problem",
    style: { ..._bugQStyle, position: "fixed", top: 12, right: 12, zIndex: 99990 }
  }, "?");

  if (!open) return fab;

  const canSubmit = text.trim().length > 0;

  const body = !report ? [
    /*#__PURE__*/React.createElement("h2", { key: "h", style: { margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#0F172A" } }, "Report a problem"),
    /*#__PURE__*/React.createElement("p", { key: "p", style: { margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5 } }, "Tell us what went wrong. Plain words are fine."),
    /*#__PURE__*/React.createElement("textarea", {
      key: "t",
      autoFocus: true,
      value: text,
      onChange: e => setText(e.target.value),
      rows: 5,
      maxLength: 4000,
      placeholder: "Example: I pressed Submit after the match and nothing happened.",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: 12,
        borderRadius: 12,
        border: "2px solid #CBD5E1",
        fontSize: 16, // 16px stops iOS from zooming in on focus
        fontFamily: _bugFont,
        resize: "vertical",
        marginBottom: 12,
        color: "#0F172A",
        background: "#fff"
      }
    }),
    /*#__PURE__*/React.createElement("button", { key: "s", type: "button", disabled: !canSubmit, onClick: submit, style: big("#2563EB", "#fff", canSubmit) }, "Submit"),
    !canSubmit && /*#__PURE__*/React.createElement("p", { key: "hint", style: { margin: "6px 0 0", fontSize: 11, color: "#94A3B8", textAlign: "center" } }, "Type something first"),
    /*#__PURE__*/React.createElement("button", { key: "c", type: "button", onClick: close, style: quiet }, "Cancel")
  ] : [
    /*#__PURE__*/React.createElement("p", { key: "ok", style: { margin: "0 0 6px", fontSize: 14, color: "#15803D", fontWeight: 800, textAlign: "center" } }, "✓ Got it. Your bug number is"),
    /*#__PURE__*/React.createElement("div", { key: "id", style: { fontSize: 28, fontWeight: 900, letterSpacing: 1.5, color: "#0F172A", textAlign: "center", margin: "0 0 14px", userSelect: "all" } }, report.id),
    /*#__PURE__*/React.createElement("p", { key: "how", style: { margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5, textAlign: "center" } }, "Tap the button below and send it to the organizers. Nothing is sent until you do."),
    /*#__PURE__*/React.createElement("button", { key: "send", type: "button", onClick: send, disabled: sending, style: big("#16A34A", "#fff", !sending) }, sending ? "Opening…" : "Send to organizers"),
    shareState === "shared" && /*#__PURE__*/React.createElement("p", { key: "r1", style: { margin: "10px 0 0", fontSize: 13, color: "#15803D", fontWeight: 700, textAlign: "center" } }, "✓ Sent. You can close this now."),
    shareState === "downloaded" && /*#__PURE__*/React.createElement("p", { key: "r2", style: { margin: "10px 0 0", fontSize: 13, color: "#B45309", fontWeight: 700, textAlign: "center", lineHeight: 1.5 } }, "Saved as a file on this device, and the bug number was copied. Send that file to the organizers."),
    shareState === "queued" && /*#__PURE__*/React.createElement("p", { key: "r4", style: { margin: "10px 0 0", fontSize: 13, color: "#B45309", fontWeight: 700, textAlign: "center", lineHeight: 1.5 } }, "No connection right now. Your report is saved and will be sent to the organizers by itself as soon as this device is online."),
    shareState === "cancelled" && /*#__PURE__*/React.createElement("p", { key: "r3", style: { margin: "10px 0 0", fontSize: 12, color: "#64748B", textAlign: "center" } }, "Not sent. Tap the green button to try again."),
    /*#__PURE__*/React.createElement("button", { key: "d", type: "button", onClick: close, style: quiet }, "Done")
  ];

  return /*#__PURE__*/React.createElement(React.Fragment, null, fab, /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      if (e.target === e.currentTarget && !report) close();
    },
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 99995,
      background: "rgba(15,23,42,0.55)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "60px 16px 24px",
      overflowY: "auto",
      boxSizing: "border-box",
      fontFamily: _bugFont
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-label": "Report a problem",
    style: {
      width: "100%",
      maxWidth: 420,
      background: "#fff",
      borderRadius: 18,
      padding: 18,
      boxSizing: "border-box",
      boxShadow: "0 12px 40px rgba(0,0,0,0.3)"
    }
  }, body)));
}

// Separate React root, outside the main app. That keeps the "?" on screen on
// every page, and working even if the main app crashes to its error screen.
if (!window.__NCBLAST_OAUTH_CALLBACK__) {
  try {
    const st = document.createElement("style");
    st.textContent = "body.ncb-bug-inline #ncb-bug-fab{display:none!important}";
    document.head.appendChild(st);
    const el = document.createElement("div");
    el.id = "ncb-bug-root";
    document.body.appendChild(el);
    ReactDOM.createRoot(el).render(/*#__PURE__*/React.createElement(BugReporter, null));
  } catch (e) {
    console.warn("NC BLAST bug reporter failed to start", e);
  }
}

if (!window.__NCBLAST_OAUTH_CALLBACK__) {
  ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(BeyJudgeApp, null));
}
