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
  1008, // judge app sends Swap to the overlay
  1009, // overlay mirrors on Swap (needs 1008)
  1011, // overlay shows each new matchup; stream slot stays on between matches
  1013, // Send to database beside the Sheets submit; judge name required to submit
  1014, // Match timing notebook (judge). Nothing is sent anywhere yet; the notebook is kept on the device and shown in the cog menu.
  1015, // Send match timing to the database after Submit (needs 1014 and 1013; needs the Worker /db/timing door deployed first).
  1016, // Error files (failed battles send, failed timing send, bug reports) go to the cloud backup folder instead of the judge's device (needs the Worker /backup/upload door deployed first).
  1017, // Submit check + notifications: a score only counts as sent once the bracket site confirms it; New Match waits (with an escape button); the org view gets a Notifications tab (needs the Worker add-on routes /submit/verify and /notify/* deployed first).
  1020, // Judge app tells the stream overlay who won each finished set (for the overlay's set dots; only used by the overlay's set dots).
  1022, // Post-battle graphic gets a second, general graphic: the finish text shows 3 seconds, fades away, then the round and each player's match record (W-L) show for the gear's "General graphic" seconds (default 5). The judge app adds the records to what it sends the overlay. Turn it off to get the single graphic back.
  1023, // Post-battle graphic pool: after the finish text one general graphic is picked from an ordered list (Match Winner at the end of a match, Final Battle, Match Point, Match Context once per match, then Matches Pending). The judge app adds the battle count, the Swiss/Top Cut flag and the pending-match count to what it sends the overlay. Needs flag 1022. Turn it off to get the plain records graphic after every finish.
  1024, // Post-battle graphics Upset Alert and Currently Playing: the judge app also sends the tournament link and the round's upsets (from player seeds); the overlay lists the other live matches. Needs flag 1023.
  1025, // Real battles reach the stream overlay through the database Worker too (the original route is sometimes 10-30 seconds behind); the overlay shows whichever copy arrives first.
  1026, // Post-battle graphic Matchup Stats (how the two combos about to battle did against each other before); Test fire uses the real match data.
  1028, // Overlay deck order graphic: when the judge locks the deck order (Start Match on the Set Deck Order screen), the overlay shows both players' three combos in order until the first battle is scored. 
  1030, // Standby slides on the stream between rounds: after a judge's last match at a stadium, the overlay shows standings, round results and the event's most used combos (needs the /deck-log + /event-stats routes in the database Worker; the question 'no more matches here?' appears on the judge's New Match button).
  1029, // Upset Alert last line: "Wins 2-1 on Stadium B" (or "judged by <name>"). The judge app saves who judged each result and their stadium (needs the /match-notes block pasted into the database Worker).
  1031, // Fast Blast event mode: the org can switch Fast Blast on when creating an event (blade-only combos, no deck building). This flag covers the toggle on the name screen and the Fast Blast badge on the event list. Turn it off to hide both.
  // 1032, // Score pad redesign, first two screens (judge): the Match result screen and the player tap-to-confirm screen use the new look from the Claude Design mock-up. Drawing only, scoring and submitting are untouched. Held OFF on purpose (a tournament is coming): a judge can try it on their own device from the gear menu > Feature Flags, or remove the // at the start of this line to turn it on for everyone.
  // 1033, // Score pad redesign, battle screen (judge): the whole scoring screen gets the new look from the Claude Design mock-up (Own plus text in the opponent's colour, one shared confirm bar). Drawing only; scoring unchanged. Held OFF: a tournament is coming.
  1034, // Deck builder redesign (judge): new Record decks screen (deck always on screen, whole-combo search, ratchet grid, CX steps), then each player checks and confirms their own deck before the match starts. Fast Blast events use it too. Turn it off to get the old deck review and part pickers back.
  1035, // Deck order redesign (judge): new Deck order screen for the first order of a set and every reshuffle. Both decks on one screen, taps only, then Check With Players (each player confirms their own order) or Looks good, start battles. Turn it off to get the old Set Deck Order screen back.
  1036, // Next Action popup (judge): right after the judge submits a match, ask New Match / Stay Here / Finished this round. (the last one only with a stream channel; starts the between-round slides). Turn it off to just stay on the result page like before.
]);

/* Shown in the Feature Flags menu. Keep in sync with the set above. */
window.FEATURE_FLAG_INFO = {
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
  1011: {
    name: "Overlay shows each new matchup (judge)",
    desc: "As soon as the judge picks the next two players, the stream overlay switches to them at 0-0 instead of waiting for the first point. The stream slot also stays on between matches, so a streaming station keeps streaming until the judge turns it off in the cog menu.",
    off: "Old behaviour: the stream slot turns off after every match, and a new matchup only reaches the overlay on its first point."
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
  1020: {
    name: "Overlay set dots show who won each set (judge)",
    desc: "The judge app adds the winner of every finished set, in order, to what it sends the stream overlay. The stream overlay uses it to colour set dot 1 for the set 1 winner, dot 2 for the set 2 winner, and so on.",
    off: "Old behaviour: the overlay only knows how many sets each player won, so the new look draws player 1's wins first."
  },
  1022: {
    name: "Round and match records after each finish (overlay + judge)",
    desc: "After a finish, the stream overlay shows the finish graphic for 3 seconds, then its text fades away and a second graphic shows the round (e.g. Swiss Round 1) and each player's match record (wins-losses in this tournament) for 5 seconds (the gear's General graphic setting changes the 5). The judge app looks up the finished matches when a match starts and adds the records to what it sends the overlay; if it cannot, the records show 0-0. When the match ends, that match is counted straight away. ",
    off: "Old behaviour: one finish graphic that stays for the gear's time, no records graphic."
  },
  1023: {
    name: "Variety of post-battle graphics (overlay + judge)",
    desc: "After the finish text (3 seconds) the overlay picks ONE general graphic for the next 5 seconds, checking an ordered list from the top: at the end of a match a Winner graphic (winner's name in their colour, the battle count, and their Swiss record in the group stage); FINAL BATTLE! with shaking text when it becomes 3-3 in the deciding set; MATCH POINT [player]! when a player has 3 points in a set and has already won a set; the round and player records (once per match); and finally the basic pool, which takes turns between its graphics (Matches Pending: how many matches in this round have not started). More graphics are added to this list later. The judge app adds the battle count, whether the event is Swiss, and the pending-match count to what it sends the overlay, and refreshes the bracket every 30 seconds during a match. Needs flag 1022.",
    off: "Old behaviour: the round and records graphic after every finish."
  },
  1024: {
    name: "Upset Alert and Currently Playing graphics (overlay + judge)",
    desc: "Adds two graphics to the post-battle list. UPSET! shows when a match of this round (not shown on this channel yet) was won by the lower seed: \"Player A (Seed 9) beats Player B (Seed 2)\"; if several qualify, the one where the best-seeded player lost goes first. It comes after the round and records graphic. Currently Playing (basic pool, first pick of every match, then it takes turns with Matches Pending) lists up to 3 other matches being played right now with their point score in the set and their sets. The judge app adds the tournament link and the list of this round's upsets (it reads player seeds from the bracket) to what it sends the overlay; the overlay reads the other live matches from the Worker every 30 seconds. Needs flag 1023.",
    off: "Old behaviour: no Upset Alert or Currently Playing graphic."
  },
  1025: {
    name: "Fast delivery of real battles to the stream overlay (judge + overlay)",
    desc: "While a judge is assigned to a stream channel, every update is also sent through the database Worker (/overlay-live), and the overlay checks it once a second. It was added because the original route could deliver an update to OBS 10 to 30 seconds late. The overlay draws whichever copy arrives first and ignores the same update arriving again, or an older one arriving late. Needs the /overlay-live block pasted into the database Worker; until then nothing changes.",
    off: "Old behaviour: the overlay only uses the original route."
  },
  1026: {
    name: "Matchup Stats graphic and real-data Test fire (overlay)",
    desc: "Adds MATCHUP HISTORY to the post-battle list (after Match Point, before the round records), once per match: how the two combos about to battle have done against each other before (favorite, win percentage, points per battle, number of battles). Needs at least 10 past battles of that exact pairing; test events are left out. Read from the database Worker (/matchup-stats). Also: the Settings panel Test fire buttons for Records, Pending, Upset, Currently Playing and Matchup Stats now build the graphic from the real current match (a labelled sample with an error code shows if the data is missing), and a Clear graphic memory button lets once-per-match/round graphics show again. Needs flags 1023 and 1024.",
    off: "Old behaviour: no Matchup Stats graphic; Test fire shows fixed sample graphics."
  },
  1028: {
    name: "Deck order graphic on the stream overlay (judge + overlay)",
    desc: "When the judge taps Start Match on the Set Deck Order screen, the overlay's slide-out graphic shows both players' three combos in the order they were locked (player on the scoreboard's left in the left column, combo 1 on top). It stays up until the first battle of that order is scored, then the normal post-battle graphic takes over. It shows every time an order is locked: the start of each set and after each shuffle. The judge app also sends the new first combos with it, so the scoreboard matches row 1.",
    off: "Old behaviour: no deck order graphic."
  },
  1029: {
    name: "Upset Alert last line: score and stadium or judge (judge + overlay)",
    desc: "The Upset Alert's last line becomes 'Wins 2-1 on Stadium B' (the stadium the judge was assigned to), or 'Wins 2-1 judged by Name' when no stadium was set up. The judge app saves the judge and stadium when a result is sent, and reads them back for the overlay. Needs the /match-notes block pasted into the database Worker; until then the line just shows 'Wins 2-1'.",
    off: "Old behaviour: the last line says 'Final result from another stadium'."
  },
  1030: {
    name: "Standby slides between rounds (judge + overlay)",
    desc: "When a judge finishes their station's last match and taps New Match, the app asks 'Are there no more matches at this stadium?' (skipped when no matches are left anywhere in the round). Yes puts that stream channel into standby: the scoreboard is replaced by one larger panel that cycles, every 10 seconds, through the standings (read from Challonge's own standings page, never calculated by us), the round's match results and the event's most used combos (counted once per deck per round, with their PPB). A new match starts the scoreboard again. Needs the new /deck-log, /event-stats and /standings routes in the database Worker; without them that slide is simply skipped.",
    off: "Old behaviour: the stream keeps showing the last finished match until the next one starts."
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
  }
};
