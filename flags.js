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
 * RELEASE POLICY - new flags ship OFF
 *   Merge with the id commented out. Then turn it on deliberately, on one
 *   device first (gear menu on the home page), and only add it to the set
 *   below once it has been seen working. A merge should never change
 *   behaviour on its own.
 *
 * CLEANUP
 *   Flags are temporary. Once a change has survived a few tournaments, delete
 *   the flag AND the old code path, or the duplicate branches pile up.
 *
 * --espiiii
 */
window.FEATURE_FLAGS = new Set([
  1001,
  1002,
  // 1003 - off after it broke the Challonge submit button. The Sheets fix
  // itself is fine; the button gating was the problem and is now removed.
  // Turn on per-device from the gear menu to verify before enabling here.
  // 1004 - new, ships off. WCB event creation in Organizer view. Turn on
  // per-device from the gear menu to test against a real WCB bracket first.
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
    desc: "Adds a 'Load from WCB link' box in Organizer view, next to the Challonge one. Paste a West Coast Bladers bracket link and it registers the event in BLAST's shared list, pulling the name and roster from WCB automatically. Read-only on the WCB side — nothing is written back to WCB. Judges/players scoring matches from a WCB event is separate, later work.",
    off: "Old behaviour: Organizer view only offers Challonge as an event source."
  }
};
