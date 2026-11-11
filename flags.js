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
 *
 * --espiiii
 */
window.FEATURE_FLAGS = new Set([
  1013, // Send to database beside the Sheets submit; judge name required to submit
  1014, // Match timing notebook (judge). Nothing is sent anywhere yet; the notebook is kept on the device and shown in the cog menu.
  1015, // Send match timing to the database after Submit (needs 1014 and 1013; needs the Worker /db/timing door deployed first).
  1016, // Error files (failed battles send, failed timing send, bug reports) go to the cloud backup folder instead of the judge's device (needs the Worker /backup/upload door deployed first).
  1017, // Submit check + notifications: a score only counts as sent once the bracket site confirms it; New Match waits (with an escape button); the org view gets a Notifications tab (needs the Worker add-on routes /submit/verify and /notify/* deployed first).
  1031, // Fast Blast event mode: the org can switch Fast Blast on when creating an event (blade-only combos, no deck building). This flag covers the toggle on the name screen and the Fast Blast badge on the event list. Turn it off to hide both.
  // 1032, // Score pad redesign, first two screens (judge): the Match result screen and the player tap-to-confirm screen use the new look from the Claude Design mock-up. Drawing only, scoring and submitting are untouched. Held OFF on purpose (a tournament is coming): a judge can try it on their own device from the gear menu > Feature Flags, or remove the // at the start of this line to turn it on for everyone.
  // 1033, // Score pad redesign, battle screen (judge): the whole scoring screen gets the new look from the Claude Design mock-up (Own plus text in the opponent's colour, one shared confirm bar). Drawing only; scoring unchanged. Held OFF: a tournament is coming.
  1034, // Deck builder redesign (judge): new Record decks screen (deck always on screen, whole-combo search, ratchet grid, CX steps), then each player checks and confirms their own deck before the match starts. Fast Blast events use it too. Turn it off to get the old deck review and part pickers back.
  1035, // Deck order redesign (judge): new Deck order screen for the first order of a set and every reshuffle. Both decks on one screen, taps only, then Check With Players (each player confirms their own order) or Looks good, start battles. Turn it off to get the old Set Deck Order screen back.
  1036, // Next Action popup (judge): right after the judge submits a match, ask New Match / Stay Here / Finished this round. (the last one only with a stream channel; starts the between-round slides). Turn it off to just stay on the result page like before.
  1037, // New Part requests (judge + org view): a New Part button in every part list of the new deck builder; the organizer or a head judge of the event adds or declines it in Org view > Notifications. Needs the Worker part-requests block.
]);

/* Shown in the Feature Flags menu. Keep in sync with the set above. */
window.FEATURE_FLAG_INFO = {
  1013: {
    name: "Send to database (judge)",
    desc: "When a judge submits a finished match to Sheets, the same battle rows are also sent to the NC BLAST database. A separate 'Database: sending / sent / failed' line appears under the Sheets one, and a failed send can be retried with one tap (sending twice is safe, the database ignores repeats). If a send fails, the match CSV is also downloaded so nothing is lost. Also requires a judge name before a match can be submitted: if it is blank, the Submit window asks for it. Sheets and the bracket submit are not changed.",
    off: "Old behaviour: results go to Sheets and the bracket only. Nothing is sent to the database, and a blank judge name does not block the submit."
  },
  1014: {
    name: "Match timing (judge)",
    desc: "Keeps a small clock notebook for each match on the judge's device: Start (the first time the deck builder opens), Decks Recorded, Priority, Side Selection, Shuffle and Match Complete, plus the time of every battle and launch error. Nothing is erased: undone battles stay in the notebook, marked as undone, so all the time adds up to the full match. Every Undo or Reset set starts a fix timer that runs until the match is back where it was, split into time-to-notice and time-to-repair. Abandoning a match throws its timing away; the QR handoff carries it over. The Redo item is hidden from the cog menu while this is on, and the cog menu gets a read-only Match timing window to check it. Nothing is sent anywhere yet.",
    off: "Old behaviour: no timing is kept, Redo stays in the cog menu, and there is no Match timing item."
  },
  1015: {
    name: "Send match timing to the database (judge)",
    desc: "When a judge submits a finished match, the match timing notebook (flag 1014) is also sent to the NC BLAST database, one line per event, undone and corrected entries included and tagged. A separate 'Timing: sending / sent / failed' line appears under the Database one, and a failed send can be retried with one tap (sending twice is safe, the database swaps the old lines for the new). A failed send also keeps retrying by itself (every minute, when the connection returns, and after the app is reopened). After 10 minutes of failing, the timing is uploaded as a CSV to the cloud backup folder, named by event, judge, both players and round; only if that fails too is the CSV downloaded to the judge's device. It never touches the Sheets, Database battles or bracket submits. Needs the Worker's /db/timing and /backup/upload doors to be deployed.",
    off: "Old behaviour: the timing stays on the device and is not sent."
  },
  1016: {
    name: "Error files go to the cloud (judge)",
    desc: "When something fails, the file that would have been saved on the judge's device goes to the cloud backup folder instead: the battles CSV when a Database or Sheets send fails, the timing CSV when the timing send keeps failing, and bug reports (the Send button now sends it straight to the organizers). Each file is named by event, judge, both players and round. If there is no connection, the file waits on the device and uploads by itself, every minute, when the internet returns, and after the app is reopened. The Download CSV button and the choice to submit without Sheets still download a file as before. Needs the Worker's /backup/upload door deployed first.",
    off: "Old behaviour: error files are downloaded to the judge's device, and bug reports use the share sheet."
  },
  1017: {
    name: "Submit check and notifications (judge + Organizer)",
    desc: "After a judge sends a score to the bracket site (Challonge or WCB), the app asks the site to confirm the match really shows as finished. Until it does, the judge's New Match button stays locked. If the bracket site cannot be reached, the judge can press 'Tell the TO to enter it by hand', which adds the score to a new Notifications tab in Organizer view (red number on the tab). The tab also lists send errors and matches that were added to a station queue automatically, and has a Resolved section. Waiting matches that are missing from every station queue are now added to the shortest queue automatically. Needs the Worker add-on routes deployed first.",
    off: "Old behaviour: a score counts as sent as soon as the bracket site answers, New Match is never locked, there is no Notifications tab, and a match missing from every station queue stays missing until the queues are regenerated."
  },
  1031: {
    name: "Fast Blast event mode (organizer + judge)",
    desc: "The organizer can switch Fast Blast on when creating an event. Fast Blast events are the quick format: judges pick just the blade for each combo instead of building full decks. This flag shows the Fast Blast switch on the Name This Tournament screen and the Fast Blast label on the event list.",
    off: "Old behaviour: no Fast Blast switch, every event is created as a normal event."
  },
  1032: {
    name: "Score pad redesign: Match result and player confirm screens (judge)",
    desc: "Gives the two end-of-match screens the new look from the Claude Design mock-up. The Match result screen becomes one tidy screen (winner and final score on top, Battles / Shuffles / Judge, the battle log with a Full stats switch, then Judge: confirm result and Download CSV at the bottom). The player confirm screen keeps the split screen (Player 1 on the top half, turned upside down for the player across the table, Player 2 on the bottom half) with a middle bar that shows Back to result and how many players have confirmed. Looks the same in light and dark mode. Only drawing changes: scoring, undo, submit and everything that is sent are exactly as before. After the judge submits, the status lines, New Match and Main Menu are the old ones in the new frame.",
    off: "Old behaviour: the original Match result screen (winner card, Match Score, Match History, CONFIRM RESULT card) and the original player confirm screen."
  },
  1033: {
    name: "Score pad redesign: battle screen (judge)",
    desc: "Gives the whole scoring screen the new look from the Claude Design mock-up: the top bar, the score card, one column per player with their combo, the finish buttons (the more points, the stronger the fill), Own x2 / Own x3 with the plus number in the OPPONENT's colour (they get those points), Launch Error with two dots, and one confirm bar at the bottom (\"Give Player +3\") instead of a confirm button under each player. Works in light and dark mode. Scoring itself is unchanged. The Adjust layout option is hidden while this is on, and the purple tournament bar is not used.",
    off: "Old behaviour: the original battle screen."
  },
  1034: {
    name: "Deck builder redesign + players check their own deck (judge)",
    desc: "Replaces the Deck Review screen and the blade / ratchet / bit pickers with one Record decks screen: both players' tabs at the top, the deck being built always visible (tap any part to change it), a search box that takes a whole combo (type 'wiz 160 hexa' and press Enter), Previous and Quick combos, a ratchet grid (row = first number, column = height) and the CX pieces as steps (with the Picture guide). When both decks are built, each player sees their own deck on a big screen and taps '<name> confirms'; a blank screen hides both decks while the phone is handed to the other player (switch in the ... menu). The second confirm starts the match exactly like the old Start Match button. Fast Blast events get the same screens with only the blade.",
    off: "Old behaviour: the original Deck Review screen, Record Deck buttons and the separate blade / ratchet / bit / CX picker screens, with one Start Match button and no player check."
  },
  1035: {
    name: "Deck order redesign + players check their own order (judge)",
    desc: "Replaces the Set Deck Order screen (first order of a set and every reshuffle) with a new Deck order screen: tap the combo that goes 1st, then 2nd (the 3rd fills in by itself), tap a numbered combo to take it back. Both players' decks are on the screen at once, each in its own blue or red box. When both orders are set, two buttons show: 'Check With Players' (each player sees only their own order and taps '<name> confirms', with a blank screen between them, switch in the ... menu shared with the deck builder; the second confirm starts the shuffle) or 'Looks good, start battles.' (starts the shuffle right away, like the old Start Match button). The top-bar Undo still undoes the last battle, and the 60-second timer still shows on reshuffles. No dragging.",
    off: "Old behaviour: the original Set Deck Order screen with both players' orders on one screen, drag to reorder, and one Start Match button."
  },
  1036: {
    name: "Next Action popup after submitting (judge)",
    desc: "Right after the judge taps Submit on a finished match, a 'Next Action?' popup opens. New Match (the main choice, shown biggest) is the same as the New Match button on the page, so it waits for the bracket site the same way. Stay Here closes the popup and leaves the judge on the result page. Finished this round. shows only when the judge is connected to a stream channel: it puts that channel into the between-round standby slides (standings, results, most used combos) until the next match starts.",
    off: "Old behaviour: no popup; after Submit the judge stays on the result page and uses the New Match button there."
  },
  1037: {
    name: "New Part requests (judge + org view)",
    desc: "In the new deck builder (flag 1034) every part list ends with a New Part button (blades, crossover blades, each CX step, ratchets, bits, and a search that finds nothing). The judge types the missing part's name and sends it to the event; a waiting screen tells them an organizer has to confirm it. In Org view the Notifications tab lists the request: the event's organizer or a head judge can fix the spelling and tap Add part (it goes into the shared parts library) or Decline. Once added, the part goes into the judge's combo by itself. Needs the part-requests block in the Worker.",
    off: "Old behaviour: no New Part button; missing parts are added by hand in the Parts Library."
  }
};
