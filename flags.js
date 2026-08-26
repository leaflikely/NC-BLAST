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
 * CLEANUP
 *   Flags are temporary. Once a change has survived a few tournaments, delete
 *   the flag AND the old code path, or the duplicate branches pile up.
 *
 * --espiiii
 */
window.FEATURE_FLAGS = new Set([
  1001,
]);

/* Shown in the Feature Flags menu. Keep in sync with the set above. */
window.FEATURE_FLAG_INFO = {
  1001: {
    name: "Match log scoping",
    desc: "Keeps each match's battle log separate. Fixes the confirm screen showing battles from other matches, stops handoff copying a tablet's whole history, and caps the stored log.",
    off: "Old behaviour: handoff sends the entire device log, match boundary comes from the session only, log grows without limit."
  }
};
