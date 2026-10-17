/* NC BLAST feature flags
 *
 * HOW THIS WORKS
 *   Every flagged change is wrapped in `if (ff(<id>)) { new } else { old }`.
 *   The set below is the DEFAULT that ships with the app.
 *
 *   A judge can also turn a flag off on their own device from the home page
 *   (gear icon -> Feature Flags) without any code change. Those per-device
 *   overrides are stored in localStorage and win over the defaults here.
 *   That is the fast rollback: uncheck, reload, back on the old code path.
 *
 *   To change the default for everyone: edit the set below, commit, push.
 *
 * ADDING A FLAG
 *   1. add the id to FEATURE_FLAGS below
 *   2. add an entry to FEATURE_FLAG_INFO so the UI shows something readable
 *   3. wrap the change: if (ff(<id>)) { new } else { old }
 *   Hooks cannot be called conditionally - call the hook unconditionally and
 *   branch on the result. See the boundary-persistence effect in app.js.
 *
 * RELEASE POLICY - new flags ship ON (changed 2026-10-11)
 *   Flags 1001-1012 were all tested and are now on by default. From here on a
 *   new flag is added to the set below already enabled, so everyone gets the
 *   change. The flag still exists as the safety switch: if something goes
 *   wrong, comment its id out below and push (off for everyone), or a judge can
 *   uncheck it in the gear menu (off for that device only). Test a change
 *   yourself before merging it, since it reaches every device straight away.
 *
 * CLEANUP
 *   Flags are temporary. Once a change has survived a few tournaments, delete
 *   the flag AND the old code path, or the duplicate branches pile up.
 *
 * --espiiii
 */
window.FEATURE_FLAGS = new Set([
  1001, // match log scoping
  1002, // tag battles by match
  1003, // honest Sheets submit result (re-enabled 2026-10-11 after the button gating was removed and it was tested)
  1004, // WCB event creation in Organizer view
  1005, // "?" bug report button on every screen
  1006, // overlay set dots
  1007, // overlay finish flash no longer overlaps name/combo
  1008, // judge app sends Swap to the overlay
  1009, // overlay mirrors on Swap (needs 1008)
  1010, // overlay combo chips at 2x
  1011, // overlay shows each new matchup; stream slot stays on between matches
  1012, // Organizer view: type any number of stadiums (1-99)
  1013, // Send to database beside the Sheets submit; judge name required to submit
  1014, // Match timing notebook (judge). Nothing is sent anywhere yet; the notebook is kept on the device and shown in the cog menu.
]);

/* Shown in the Feature Flags menu. Keep in sync with the set above. */
window.FEATURE_FLAG_INFO = {
  1001: {
    name: "Match log scoping",
    desc: "Keeps each match's battle log separate. Fixes the confirm screen showing battles from other matches, stops handoff copying a tablet's whole history, and caps the stored log.",
    off: "Old behaviour: handoff sends the entire device log, match boundary comes from the session only, log grows without limit."
  },
  1002: {
    name: "Tag battles by match",
    desc: "Stamps every battle with the match it belongs to, so screens filter by that instead of counting positions in one shared list. Battles from older matches and other tournaments can no longer appear, even on a device with a messy log.",
    off: "Old behaviour: the current match is everything after a saved position number. If that number is wrong, older battles show up."
  },
  1003: {
    name: "Honest Sheets submit result",
    desc: "Stops the false 'Sheets failed' message. The results were reaching the spreadsheet, but the reply could not be read, so the app reported failure. Also adds a timeout, blocks double-submits, and actually downloads the CSV if the send really fails.",
    off: "Old behaviour: reports failure whenever the reply can't be read, even though the rows were saved. Re-submitting duplicates them."
  },
  1004: {
    name: "WCB event creation (Organizer)",
    desc: "Adds a 'Load from WCB link' box in Organizer view, next to the Challonge one. Paste a West Coast Bladers bracket link and it registers the event in BLAST's shared list, pulling the name and roster from WCB automatically. Judges can select and score a WCB event's open matches the same way as a Challonge one — starting a match and submitting its result now write back to WCB itself, not just Challonge.",
    off: "Old behaviour: Organizer view only offers Challonge as an event source."
  },
  1005: {
    name: "Report a problem button",
    desc: "Adds a ? button on every screen. Judges describe what went wrong, get a bug number, and can send a report with this device's recent errors and match state to the organizers. Nothing is sent unless they choose to.",
    off: "No ? button, and no error recording on this device."
  },
  1006: {
    name: "Overlay set dots",
    desc: "Fixes the stream overlay missing the last set dot. The point that wins a set now sends the new set count to the overlay right away, so the match-winning dot appears. Also stops quick back-to-back updates from being dropped.",
    off: "Old behaviour: the overlay gets the set count from before the point. The final set dot never appears, and earlier dots show up late."
  },
  1007: {
    name: "Overlay finish text cleanup",
    desc: "On the stream overlay, the XTREME / OVER / BURST flash sits next to the score, in the empty space on the scoring player's side, instead of on top of their name and combo. The combo stays visible. If the flash would still cover something, only that piece fades while it shows. Overlay only - add &ff=1007 to the OBS source URL to try it.",
    off: "Old behaviour: the flash text overlaps the player's name and combo."
  },
  1008: {
    name: "Send Swap to the overlay (judge)",
    desc: "When the judge taps Swap, the judge app tells the stream overlay right away instead of waiting for the next point. The overlay only mirrors if its own flag, 1009, is on.",
    off: "Old behaviour: Swap isn't sent to the overlay; it only picks up new sides on the next point."
  },
  1009: {
    name: "Overlay mirrors on Swap (overlay)",
    desc: "Stream overlay only. When the judge swaps sides, player 1 moves to the right and player 2 to the left, each keeping their colour, so the stream matches where players are standing. Needs 1008 on the judging device. Add &ff=1009 to the OBS source URL to try it.",
    off: "Old behaviour: the overlay always shows player 1 on the left."
  },
  1010: {
    name: "Bigger combos on the overlay (overlay)",
    desc: "Stream overlay only. Combo chips (blade / ratchet / bit) are twice the size so viewers can read them. While a finish flash shows, the scorer's combo may fade for those 2 seconds if it would overlap. Add &ff=1010 to the OBS source URL.",
    off: "Old behaviour: small combo text."
  },
  1011: {
    name: "Overlay shows each new matchup (judge)",
    desc: "As soon as the judge picks the next two players, the stream overlay switches to them at 0-0 instead of waiting for the first point. The stream slot also stays on between matches, so a streaming station keeps streaming until the judge turns it off in the cog menu.",
    off: "Old behaviour: the stream slot turns off after every match, and a new matchup only reaches the overlay on its first point."
  },
  1012: {
    name: "Any number of stadiums (Organizer)",
    desc: "In Organizer view, the 'How many stadiums are you running?' step gets a number box (1-99) next to the 1-8 buttons. Stadium names continue past H as I, J ... Z, then AA, AB. Colours past H repeat the first eight. Judge devices show the extra stations automatically.",
    off: "Old behaviour: only the buttons 1-8 (stadiums A-H)."
  },
  1013: {
    name: "Send to database (judge)",
    desc: "When a judge submits a finished match to Sheets, the same battle rows are also sent to the NC BLAST database. A separate 'Database: sending / sent / failed' line appears under the Sheets one, and a failed send can be retried with one tap (sending twice is safe, the database ignores repeats). If a send fails, the match CSV is also downloaded so nothing is lost. Also requires a judge name before a match can be submitted: if it is blank, the Submit window asks for it. Sheets and the bracket submit are not changed.",
    off: "Old behaviour: results go to Sheets and the bracket only. Nothing is sent to the database, and a blank judge name does not block the submit."
  },
  1014: {
    name: "Match timing (judge)",
    desc: "Keeps a small clock notebook for each match on the judge's device: Start (the first time the deck builder opens), Decks Recorded, Priority, Side Selection, Shuffle and Match Complete, plus the time of every battle and launch error. Nothing is erased: undone battles stay in the notebook, marked as undone, so all the time adds up to the full match. Every Undo or Reset set starts a fix timer that runs until the match is back where it was, split into time-to-notice and time-to-repair. Abandoning a match throws its timing away; the QR handoff carries it over. The Redo item is hidden from the cog menu while this is on, and the cog menu gets a read-only Match timing window to check it. Nothing is sent anywhere yet.",
    off: "Old behaviour: no timing is kept, Redo stays in the cog menu, and there is no Match timing item."
  }
};
