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
  1015, // Send match timing to the database after Submit (needs 1014 and 1013; needs the Worker /db/timing door deployed first).
  1016, // Error files (failed battles send, failed timing send, bug reports) go to the cloud backup folder instead of the judge's device (needs the Worker /backup/upload door deployed first).
  1017, // Submit check + notifications: a score only counts as sent once the bracket site confirms it; New Match waits (with an escape button); the org view gets a Notifications tab (needs the Worker add-on routes /submit/verify and /notify/* deployed first).
  // 1018, // Stream overlay stage layout (overlay only). Held OFF on purpose: it changes how every stream looks. Try it per OBS source with ?ff=1018 on the overlay link; to turn it on for everyone, remove the // at the start of this line.
  // 1019, // New stream-overlay scoreboard look from the Claude Design mock-up (overlay only; turns the stage layout 1018 on by itself). Held OFF while it is being tuned: try it per OBS source with ?ff=1019 on the overlay link.
  1020, // Judge app tells the stream overlay who won each finished set (for the overlay's set dots; only used by the new look, flag 1019).
  1021, // Stream overlay space shapes (wide / tall) plus the 5-second post-battle graphic (overlay only; turns 1018 and 1019 on by itself). On by default: the plain link ncblast.pages.dev/overlay?slot=N fills its OBS source, settings live in a hover-only gear. To see the old look on one source add ?ff=-1021 to its link.
  1022, // Post-battle graphic gets a second, general graphic: the finish text shows 3 seconds, fades away, then the round and each player's match record (W-L) show for the gear's "General graphic" seconds (default 5). The judge app adds the records to what it sends the overlay. Needs flag 1021. Turn it off to get the single graphic back.
  1023, // Post-battle graphic pool: after the finish text one general graphic is picked from an ordered list (Match Winner at the end of a match, Final Battle, Match Point, Match Context once per match, then Matches Pending). The judge app adds the battle count, the Swiss/Top Cut flag and the pending-match count to what it sends the overlay. Needs flags 1021 and 1022. Turn it off to get the plain records graphic after every finish.
  1024, // Post-battle graphics Upset Alert and Currently Playing: the judge app also sends the tournament link and the round's upsets (from player seeds); the overlay lists the other live matches. Needs flag 1023.
  1025, // Real battles reach the stream overlay through the database Worker too (the original route is sometimes 10-30 seconds behind); the overlay shows whichever copy arrives first.
  1026, // Post-battle graphic Matchup Stats (how the two combos about to battle did against each other before); Test fire uses the real match data.
  1027, // Judge view: a Stream channel button on the Select Match screen, so a judge can pick the channel (and connect) before decks are recorded.
  1028, // Overlay deck order graphic: when the judge locks the deck order (Start Match on the Set Deck Order screen), the overlay shows both players' three combos in order until the first battle is scored. Needs flag 1021.
  1029, // Upset Alert last line: "Wins 2-1 on Stadium B" (or "judged by <name>"). The judge app saves who judged each result and their stadium (needs the /match-notes block pasted into the database Worker).
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
  1018: {
    name: "Stage layout for the stream overlay (overlay)",
    desc: "Stream overlay only. The overlay becomes a fixed 1920x1080 stage with the scoreboard centered along the bottom, 40% of the screen wide by default (change with ?w= and ?bottom= on the overlay link). The rest of the stage stays empty and transparent for future features. Dragging and resizing are switched off, and the scoreboard no longer stretches or runs off the screen. In OBS, make the browser source 1920 wide by 1080 tall.",
    off: "Old behaviour: a draggable, resizable scoreboard box (or ?fullscreen=1, which runs wider than the screen)."
  },
  1019: {
    name: "New scoreboard look for the stream overlay (overlay)",
    desc: "Stream overlay only. Replaces the scoreboard card with the new compact design: player names and the score big, blade and ratchet/bit lines under each name, set dots under the score, a gold line on top, and a banner above it when a finish is scored. Turns the stage layout (flag 1018) on by itself. No brand label, tournament name, judge name, sides or point-limit text. Add ?edit=1 to the overlay link to get a small switch for the width: the mock-up's size (one third of the screen) or 40%.",
    off: "Old behaviour: the original scoreboard card."
  },
  1020: {
    name: "Overlay set dots show who won each set (judge)",
    desc: "The judge app adds the winner of every finished set, in order, to what it sends the stream overlay. The new overlay look (flag 1019) uses it to colour set dot 1 for the set 1 winner, dot 2 for the set 2 winner, and so on. Nothing changes on screen without flag 1019.",
    off: "Old behaviour: the overlay only knows how many sets each player won, so the new look draws player 1's wins first."
  },
  1021: {
    name: "Space shapes and post-battle graphic for the stream overlay (overlay)",
    desc: "Stream overlay only. The overlay lives in a fixed-shape space (wide or tall) and fills whatever box OBS gives the source, so OBS decides position and size; the link stays the same per channel (overlay?slot=N) and the shape, side and timing are set in a gear that appears when the mouse is over the source's top-left corner (OBS: right-click the source, Interact). The old drag editor is gone: position and size come only from OBS (extra ?x= ?y= ?s= on an old link are ignored; ?edit=1 just shows a demo match). Wide shape: the scoreboard sits in the middle, then slides left, right or alternates while a graphic comes out on the other side. Tall shape: the scoreboard sits at the bottom (or top) and the graphic slides out above (or below) it. After every finish the graphic shows the finish, the points, who scored, the winning combo and the set score for 5 seconds (change with ?gfx=). Turns the new scoreboard look (flag 1019) on by itself.",
    off: "Old behaviour: the scoreboard sits where flags 1018 / 1019 put it, with a small banner above it after a finish."
  },
  1022: {
    name: "Round and match records after each finish (overlay + judge)",
    desc: "After a finish, the stream overlay shows the finish graphic for 3 seconds, then its text fades away and a second graphic shows the round (e.g. Swiss Round 1) and each player's match record (wins-losses in this tournament) for 5 seconds (the gear's General graphic setting changes the 5). The judge app looks up the finished matches when a match starts and adds the records to what it sends the overlay; if it cannot, the records show 0-0. When the match ends, that match is counted straight away. Needs flag 1021.",
    off: "Old behaviour: one finish graphic that stays for the gear's time, no records graphic."
  },
  1023: {
    name: "Variety of post-battle graphics (overlay + judge)",
    desc: "After the finish text (3 seconds) the overlay picks ONE general graphic for the next 5 seconds, checking an ordered list from the top: at the end of a match a Winner graphic (winner's name in their colour, the battle count, and their Swiss record in the group stage); FINAL BATTLE! with shaking text when it becomes 3-3 in the deciding set; MATCH POINT [player]! when a player has 3 points in a set and has already won a set; the round and player records (once per match); and finally the basic pool, which takes turns between its graphics (Matches Pending: how many matches in this round have not started). More graphics are added to this list later. The judge app adds the battle count, whether the event is Swiss, and the pending-match count to what it sends the overlay, and refreshes the bracket every 30 seconds during a match. Needs flags 1021 and 1022.",
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
  1027: {
    name: "Stream channel button on the Select Match screen (judge)",
    desc: "Adds a Stream channel button to the judge's Select Match screen. It opens the same window as the cog menu's Stream overlay (pick Channel 1-4 or Off, then Connect Channel), so a judge can connect to a channel in round 1 before the decks are recorded and the first battle starts.",
    off: "Old behaviour: the channel can only be picked from the cog menu on the battle screen."
  },
  1028: {
    name: "Deck order graphic on the stream overlay (judge + overlay)",
    desc: "When the judge taps Start Match on the Set Deck Order screen, the overlay's slide-out graphic shows both players' three combos in the order they were locked (player on the scoreboard's left in the left column, combo 1 on top). It stays up until the first battle of that order is scored, then the normal post-battle graphic takes over. It shows every time an order is locked: the start of each set and after each shuffle. The judge app also sends the new first combos with it, so the scoreboard matches row 1. Needs flag 1021 (space shapes).",
    off: "Old behaviour: no deck order graphic."
  },
  1029: {
    name: "Upset Alert last line: score and stadium or judge (judge + overlay)",
    desc: "The Upset Alert's last line becomes 'Wins 2-1 on Stadium B' (the stadium the judge was assigned to), or 'Wins 2-1 judged by Name' when no stadium was set up. The judge app saves the judge and stadium when a result is sent, and reads them back for the overlay. Needs the /match-notes block pasted into the database Worker; until then the line just shows 'Wins 2-1'.",
    off: "Old behaviour: the last line says 'Final result from another stadium'."
  }
};
