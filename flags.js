/* NC BLAST feature flags
 *
 * HOW THIS WORKS
 *   Every flagged change is wrapped in `if (ff(<id>)) { new } else { old }`.
 *   Removing an id from the set below makes the app fall back to the old code
 *   path. No other edits needed.
 *
 *   To disable a change: delete its line, commit, push. Pages redeploys.
 *
 * REGISTRY - keep this updated, "1001" means nothing to the next person
 *   1001  Match log scoping
 *         - handoff sends only the current match, not the whole device log
 *         - matchStartIdx persisted in localStorage + clamped on load
 *         - battle log capped at MATCH_LOG_CAP entries
 *         - Clear All resets matchStartIdx
 *         Off  = pre-fix behaviour (whole log in handoff, index from
 *                sessionStorage only, uncapped log)
 *
 * CLEANUP
 *   Flags are temporary. Once a change has survived a few tournaments, delete
 *   the flag AND the old code path. Otherwise the duplicate branches pile up.
 *
 * --espiiii
 */
window.FEATURE_FLAGS = new Set([
  1001,
]);
