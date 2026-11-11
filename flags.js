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
 * ONE FLAG PER FEATURE (rule from 2026-11-11)
 *   A follow-up change to a feature goes INSIDE that feature's existing flag,
 *   not into a new flag that "needs" the first one. Add a new flag only for
 *   something truly separate. When a flag grows, grow its description in
 *   FEATURE_FLAG_INFO too. Several small flags that depend on each other are
 *   really one feature: merge them.
 *
 * CLEANUP
 *   Flags are temporary. Once a change has survived a few tournaments, delete
 *   the flag AND the old code path, or the duplicate branches pile up.
 *   2026-11-11: the stream overlay flags (1008, 1009, 1011, 1020, 1022-1026,
 *   1028-1030) went live for good; their flags and old code paths are gone.
 *   Later the same day: 1013-1017 (database sending, match timing, cloud error
 *   files, submit check + notifications) and 1036 (Next Action popup) went
 *   live too. 1033 was folded into 1032 and 1037 into 1034 (one flag per feature).
 *
 * --espiiii
 */
window.FEATURE_FLAGS = new Set([
  1031, // Fast Blast event mode: the org can switch Fast Blast on when creating an event (blade-only combos, no deck building). This flag covers the toggle on the name screen and the Fast Blast badge on the event list. Turn it off to hide both.
  // 1032, // Score pad redesign (judge): the Match result screen, the player tap-to-confirm screen and the battle (scoring) screen all use the new look from the Claude Design mock-up (Own plus text in the opponent's colour, one shared confirm bar). Drawing only; scoring and submitting are untouched. Held OFF for now: a judge can try it on their own device from the gear menu > Feature Flags, or remove the // at the start of this line to turn it on for everyone.
  1034, // Deck builder redesign (judge): new Record decks screen (deck always on screen, whole-combo search, ratchet grid, CX steps), then each player checks and confirms their own deck before the match starts. Fast Blast events use it too. Also New Part requests: a New Part button in every part list; the organizer or a head judge of the event adds or declines it in Org view > Notifications (needs the Worker part-requests block). Turn it off to get the old deck review and part pickers back.
  1035, // Deck order redesign (judge): new Deck order screen for the first order of a set and every reshuffle. Both decks on one screen, taps only, then Check With Players (each player confirms their own order) or Looks good, start battles. Turn it off to get the old Set Deck Order screen back.
]);

/* Shown in the Feature Flags menu. Keep in sync with the set above. */
window.FEATURE_FLAG_INFO = {
  1031: {
    name: "Fast Blast event mode (organizer + judge)",
    desc: "The organizer can switch Fast Blast on when creating an event. Fast Blast events are the quick format: judges pick just the blade for each combo instead of building full decks. This flag shows the Fast Blast switch on the Name This Tournament screen and the Fast Blast label on the event list.",
    off: "Old behaviour: no Fast Blast switch, every event is created as a normal event."
  },
  1032: {
    name: "Score pad redesign: result, confirm and battle screens (judge)",
    desc: "Gives the two end-of-match screens the new look from the Claude Design mock-up. The Match result screen becomes one tidy screen (winner and final score on top, Battles / Shuffles / Judge, the battle log with a Full stats switch, then Judge: confirm result and Download CSV at the bottom). The player confirm screen keeps the split screen (Player 1 on the top half, turned upside down for the player across the table, Player 2 on the bottom half) with a middle bar that shows Back to result and how many players have confirmed. Looks the same in light and dark mode. Only drawing changes: scoring, undo, submit and everything that is sent are exactly as before. After the judge submits, the status lines, New Match and Main Menu are the old ones in the new frame. The battle (scoring) screen gets the new look too: the top bar, the score card, one column per player with their combo, the finish buttons (the more points, the stronger the fill), Own x2 / Own x3 with the plus number in the OPPONENT's colour (they get those points), Launch Error with two dots, and one confirm bar at the bottom (\"Give Player +3\") instead of a confirm button under each player. The Adjust layout option is hidden while this is on, and the purple tournament bar is not used.",
    off: "Old behaviour: the original Match result screen (winner card, Match Score, Match History, CONFIRM RESULT card), the original player confirm screen and the original battle screen."
  },
  1034: {
    name: "Deck builder redesign + players check their own deck + New Part requests (judge + org view)",
    desc: "Replaces the Deck Review screen and the blade / ratchet / bit pickers with one Record decks screen: both players' tabs at the top, the deck being built always visible (tap any part to change it), a search box that takes a whole combo (type 'wiz 160 hexa' and press Enter), Previous and Quick combos, a ratchet grid (row = first number, column = height) and the CX pieces as steps (with the Picture guide). When both decks are built, each player sees their own deck on a big screen and taps '<name> confirms'; a blank screen hides both decks while the phone is handed to the other player (switch in the ... menu). The second confirm starts the match exactly like the old Start Match button. Fast Blast events get the same screens with only the blade. Every part list also ends with a New Part button (blades, crossover blades, each CX step, ratchets, bits, and a search that finds nothing): the judge types the missing part's name and sends it to the event, and a waiting screen tells them an organizer has to confirm it. In Org view the Notifications tab lists the request: the event's organizer or a head judge can fix the spelling and tap Add part (it goes into the shared parts library) or Decline. Once added, the part goes into the judge's combo by itself. Needs the part-requests block in the Worker.",
    off: "Old behaviour: the original Deck Review screen, Record Deck buttons and the separate blade / ratchet / bit / CX picker screens, with one Start Match button and no player check; no New Part button (missing parts are added by hand in the Parts Library)."
  },
  1035: {
    name: "Deck order redesign + players check their own order (judge)",
    desc: "Replaces the Set Deck Order screen (first order of a set and every reshuffle) with a new Deck order screen: tap the combo that goes 1st, then 2nd (the 3rd fills in by itself), tap a numbered combo to take it back. Both players' decks are on the screen at once, each in its own blue or red box. When both orders are set, two buttons show: 'Check With Players' (each player sees only their own order and taps '<name> confirms', with a blank screen between them, switch in the ... menu shared with the deck builder; the second confirm starts the shuffle) or 'Looks good, start battles.' (starts the shuffle right away, like the old Start Match button). The top-bar Undo still undoes the last battle, and the 60-second timer still shows on reshuffles. No dragging.",
    off: "Old behaviour: the original Set Deck Order screen with both players' orders on one screen, drag to reorder, and one Start Match button."
  },
};
