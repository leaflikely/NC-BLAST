// NC BLAST simulator: one robot judge.
// Drives the real app in a browser the way a judge would: log in, take the next match from
// their station, enter both decks, score battles until someone wins, submit, repeat.
// Every choice comes from a seeded random number, so a run can be repeated exactly.

const ui = require("./ui.cjs");

// Small seeded random number generator (same seed = same choices every time)
function makeRandom(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.pick = list => list[Math.floor(next() * list.length)];
  next.chance = p => next() < p;
  return next;
}

// Buttons on the part pickers that are not parts.
const NOT_PARTS = new Set(["", "?", "Back", "Undo", "★ Popular", "# Numerical", "CX Tab", "✕"]);
const isPart = t => t && !NOT_PARTS.has(t) && !/·|IN USE|EDITING|Crossover|^[←↩📡👥⚡🏟️↻▶⇄📷]/u.test(t);

class RobotJudge {
  constructor(dev, fw, judge, opts = {}) {
    this.dev = dev;
    this.page = dev.page;
    this.fw = fw;
    this.judge = judge;             // { username, bracketName, station }
    this.who = judge.station;
    this.rnd = makeRandom(opts.seed || 1);
    this.opts = opts;
    this.steps = [];                // what this robot did, for the report
    this.matchesDone = [];
    this.current = null;            // { p1, p2, matchNo, startedAt }
  }

  say(text) {
    this.steps.push({ t: Date.now(), text });
    if (this.opts.verbose) console.log("  [" + this.who + "] " + text);
  }

  async tap(match, opts) {
    await ui.tap(this.page, match, opts);
  }

  async screen() { return ui.screenText(this.page); }

  // ── log in ───────────────────────────────────────────────────────────────
  async login(baseUrl, opts = {}) {
    const p = this.page;
    if (!opts.here) {
      this.say("open the app");
      await p.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
    }
    // Screen by screen, so it also works after a refresh (when some steps are skipped).
    const evName = new RegExp("^" + this.fw.ev.name.replace(/[()]/g, "\\$&"));
    for (let guard = 0; guard < 40; guard++) {
      const s = await this.screen();
      const btns = await ui.buttons(p);
      if (/Spin Finish|Set Deck Order|Pick a Side|Who Won the Die Roll|Deck Review|CONFIRM RESULT|Select Match/.test(s) && !/Select the Challonge event/.test(s)) break;
      if (btns.includes("⚖️ A Judge")) { await this.tap("⚖️ A Judge"); continue; }
      if (btns.some(t => evName.test(t))) { await this.tap(evName); continue; }
      if (btns.includes("Log in with Challonge →")) { await this.tap("Log in with Challonge →"); continue; }
      if (/Enter your Challonge username/.test(s)) {
        await p.fill("input", this.judge.username);
        await this.tap("Confirm →");
        continue;
      }
      if (btns.includes("✏️ Manual Name Entry") && !(await p.$("input[placeholder='Enter your name…']"))) { await this.tap("✏️ Manual Name Entry"); continue; }
      if (await p.$("input[placeholder='Enter your name…']")) {
        await p.fill("input[placeholder='Enter your name…']", this.judge.bracketName);
        await this.tap("Confirm");
        continue;
      }
      if (btns.includes("Next: Players →")) { await this.tap("Next: Players →"); continue; }
      await p.waitForTimeout(ui.POLL * 2);
    }
    await ui.waitForText(p, /Select Match|Spin Finish|Set Deck Order|Pick a Side|Who Won the Die Roll|Deck Review|CONFIRM RESULT/, 10000);
    this.say("logged in as " + this.judge.username + " (" + this.judge.bracketName + ")");
  }

  // ── pick the next match from this judge's station ────────────────────────
  // Returns false when the station has nothing left to play.
  async takeNextMatch() {
    await this.answerStandbyPrompt();
    if (this.opts.streamSlot) {
      const off = await ui.findButton(this.page, "📡 Stream channel Off");
      if (off) {
        await this.tap("📡 Stream channel Off");
        await this.tap("📡 Channel " + this.opts.streamSlot);
        await ui.tap(this.page, "✕", { optional: true, timeout: 1000 });
        this.say("stream to channel " + this.opts.streamSlot);
      }
    }
    await this.tap("🏟️ Station");
    await this.tap("↻ Refresh", { optional: true, timeout: 1500 });
    await ui.waitForText(this.page, /STATION [A-H] MATCHES|station/i);
    // Wait for the match rows to show (an empty station simply times out after a moment).
    const btns = (await ui.until(this.page, async () => { const b = await ui.buttons(this.page); return b.some(x => /^#\d+ /.test(x)) && b; }, 1200)) || await ui.buttons(this.page);
    const done = new Set(this.matchesDone.map(m => m.name.replace(/\s+/g, "")));
    // Station rows look like "#1 Ace RamirezvsBree Tanaka". Match them to the bracket to get exact names.
    const n = this.fw.idToName();
    const rows = btns.filter(b => /^#\d+ /.test(b)).map(b => {
      const flat = b.replace(/^#\d+ /, "").replace(/\s+/g, "");
      const m = this.fw.ev.matches.find(x => (n[x.player1_id] + "vs" + n[x.player2_id]).replace(/\s+/g, "") === flat);
      return { label: b, m, p1: m && n[m.player1_id], p2: m && n[m.player2_id] };
    });
    const row = rows.find(r => r.m && !done.has((r.p1 + " vs " + r.p2).replace(/\s+/g, "")));
    if (!row) return false;
    this.current = { label: row.label, p1: row.p1, p2: row.p2, matchId: row.m.id, startedAt: Date.now() };
    this.say("take " + row.label + " (match " + row.m.id + ")");
    await this.tap(row.label);
    await this.tap("Build Decks →");
    return true;
  }

  // ── enter both players' decks ────────────────────────────────────────────
  async buildDecks() {
    const p = this.page;
    for (let guard = 0; guard < 80; guard++) {
      const s = await this.screen();
      if (/Deck Review/.test(s) && !/— (FIRST|SECOND|THIRD) COMBO/.test(s)) {
        // Review screen. Start recording whoever is not done yet, or move on.
        if (await ui.findButton(p, "Record Deck →")) { await this.tap("Record Deck →"); continue; }
        return;
      }
      if (/Select Blade/.test(s)) { await this.pickBlade(); continue; }
      if (/^\s*Back\s*\n\s*(Undo\s*\n\s*)?Ratchet\b/m.test(s) || /\nRatchet\n/.test(s)) { await this.pickPart("ratchet"); continue; }
      if (/\nBit\n/.test(s)) { await this.pickPart("bit"); continue; }
      await p.waitForTimeout(ui.POLL);
    }
    throw new Error("Deck building did not finish (stuck on: " + (await this.screen()).replace(/\n+/g, " / ").slice(0, 200) + ")");
  }

  async pickBlade() {
    const p = this.page;
    // Sometimes use a Quick Combo (fills all three parts in one tap), like a hurried judge.
    if (this.rnd.chance(0.3)) {
      const quick = await p.$$eval("button:has(.qc-blade)", bs => bs.filter(b => !b.disabled).map(b => [...b.querySelectorAll("[data-label]")].map(x => x.getAttribute("data-label")).join(" ")));
      if (quick.length) {
        const q = this.rnd.pick(quick);
        this.say("quick combo " + q);
        await this.tap(q);
        return;
      }
    }
    const list = (await ui.buttons(p)).filter(isPart);
    const blade = this.rnd.pick(list);
    this.say("blade " + blade);
    await this.tap(blade);
  }

  async pickPart(kind) {
    const list = (await ui.buttons(this.page)).filter(isPart);
    if (!list.length) throw new Error("No " + kind + " to pick");
    const part = this.rnd.pick(list);
    this.say(kind + " " + part);
    await this.tap(part);
  }
}


// What each finish button is worth. Normal finishes score for the player whose column it is in.
// Own finishes and launch errors are penalties: tapped under the player who made the mistake,
// and any points go to the OTHER player.
const FINISHES = [
  { label: "Spin Finish +1", pts: 1, weight: 34 },
  { label: "Over Finish +2", pts: 2, weight: 24 },
  { label: "Burst Finish +2", pts: 2, weight: 14 },
  { label: "Xtreme Finish +3", pts: 3, weight: 16 },
  { label: "Own ×2 +2", pts: 2, weight: 3, penalty: true },
  { label: "Own ×3 +3", pts: 3, weight: 2, penalty: true },
  { label: "Launch Error LER", pts: 0, weight: 7, ler: true },
];

RobotJudge.prototype.state = async function () {
  return this.page.evaluate(() => {
    try { return JSON.parse(sessionStorage.getItem("ncblast-match-resume-v1") || "null"); } catch (_) { return null; }
  });
};

RobotJudge.prototype.pickFinish = function () {
  const total = FINISHES.reduce((a, f) => a + f.weight, 0);
  let r = this.rnd() * total;
  for (const f of FINISHES) { if ((r -= f.weight) < 0) return f; }
  return FINISHES[0];
};

// Plays the current match from "Start Match" to the end. Checks the score after every battle.
RobotJudge.prototype.playMatch = async function () {
  const p = this.page;
  const sideName = s => (s === "p1" ? this.current.p1 : this.current.p2);
  this.battles = 0;
  this.undos = 0;
  this.history = [];   // app state before each battle (for checking Undo)
  this.expSets = [];   // set scores the robot expects, e.g. [[4,2],[1,4],...]
  await this.tap("Start Match ⚔️");
  for (let guard = 0; guard < 400; guard++) {
    const s = await this.screen();
    const btns = await ui.buttons(p);
    if (/Who Won the Die Roll\?/.test(s)) {
      const who = this.rnd.pick(["p1", "p2"]);
      this.say("die roll won by " + sideName(who));
      await this.tap(sideName(who));
      continue;
    }
    if (/Pick a Side/.test(s)) {
      const side = this.rnd.pick(["B Side", "X Side"]);
      this.say("picks " + side);
      await this.tap(side);
      continue;
    }
    if (/Set Deck Order/.test(s)) {
      const left = btns.filter(t => t.startsWith("· "));
      if (left.length) { await this.tap(this.rnd.pick(left)); continue; }
      const go = btns.find(t => /^Start/.test(t));
      if (go) { this.say("deck order set"); await this.tap(go); continue; }
      await p.waitForTimeout(ui.POLL);
      continue;
    }
    if (btns.includes("Spin Finish +1")) {
      await this.battle();
      continue;
    }
    if (/CONFIRM RESULT|Judge Confirm/.test(s)) return s;
    await p.waitForTimeout(ui.POLL);
  }
  throw new Error("Match did not finish after 400 steps");
};

RobotJudge.prototype.battle = async function () {
  const p = this.page;
  const before = await this.state();
  if (!before) throw new Error("No saved match state during battles");
  const name = this.current.p1 + " vs " + this.current.p2;
  // Now and then a judge taps the wrong thing and presses Undo.
  if (this.history.length && this.rnd.chance(this.opts.undoRate === undefined ? 0.05 : this.opts.undoRate)) {
    const ok = await ui.tap(p, "UNDO", { optional: true, timeout: 800 });
    if (ok) {
      this.undos++;
      this.say("UNDO last battle");
      // (No confirm step: Undo acts at once. Undoing the first battle of a set goes back to
      // that set's deck order screen, which has its own Undo button, so never tap twice.)
      const was = JSON.stringify(before);
      await ui.until(p, async () => JSON.stringify(await this.state()) !== was, 1500);
      const after = await this.state();
      const prev = this.history.pop();
      if (after && prev && (after.pts.join() !== prev.state.pts.join() || after.sets.join() !== prev.state.sets.join() || after.curSet !== prev.state.curSet)) {
        this.fw.find("bug", this.who, "Undo did not put the score back", name + ": before the battle " + prev.state.pts.join("-") + " (sets " + prev.state.sets.join("-") + "), after Undo " + after.pts.join("-") + " (sets " + after.sets.join("-") + ")");
      }
      if (prev) this.expSets.length = prev.expSetsLen;
      return;
    }
  }
  // Now and then the page gets refreshed mid-match (phone locks, browser reloads). The judge
  // logs back in and the match must come back exactly as it was.
  if (this.rnd.chance(this.opts.refreshRate === undefined ? 0.02 : this.opts.refreshRate)) {
    this.say("REFRESH the page mid-match");
    await p.reload({ waitUntil: "domcontentloaded" });
    await this.login(null, { here: true });
    await ui.until(p, async () => (await ui.buttons(p)).includes("Spin Finish +1"), 3000);
    const back = await this.state();
    const onPad = (await ui.buttons(p)).includes("Spin Finish +1");
    if (!back || !onPad || back.pts.join() !== before.pts.join() || back.sets.join() !== before.sets.join() || back.curSet !== before.curSet) {
      this.fw.find("bug", this.who, "Match not restored after a refresh", name + ": before " + before.pts.join("-") + " sets " + before.sets.join("-") + ", after " + (back ? back.pts.join("-") + " sets " + back.sets.join("-") : "nothing saved") + (onPad ? "" : " (not back on the score pad)"));
    }
    this.refreshes = (this.refreshes || 0) + 1;
    this.refreshedIn = this.current.p1 + " vs " + this.current.p2;
    return;
  }
  const side = this.rnd.chance(0.5) ? "p1" : "p2";
  const f = this.pickFinish();
  const idx = side === "p1" ? 0 : 1;
  const exp = before.pts.slice();
  if (f.ler) {
    if ((before.lerStrikes || [0, 0])[idx] === 1) exp[1 - idx] += 1;
  } else if (f.penalty) exp[1 - idx] += f.pts;
  else exp[idx] += f.pts;
  // The app caps a set score at the set target (a 3-point finish at 3-3 is saved as 3-4, not 3-6).
  const cap = this.opts.setPoints || 4;
  exp[0] = Math.min(exp[0], cap); exp[1] = Math.min(exp[1], cap);
  this.history.push({ state: before, expSetsLen: this.expSets.length });
  this.say("battle: " + (side === "p1" ? this.current.p1 : this.current.p2) + " " + f.label + (f.ler ? " (launch error)" : ""));
  const was = JSON.stringify(before);
  const changed = async () => JSON.stringify(await this.state()) !== was;
  const continueOrChanged = async () => (await ui.buttons(p)).includes("Continue") || await changed();
  await ui.tapSide(p, side, f.label);
  if (f.ler) {
    await ui.until(p, continueOrChanged, 1500);
    await ui.tap(p, "Continue", { optional: true, timeout: 0 });
  } else {
    await ui.tapSide(p, side, /Confirm/);
    // Own finishes ask "are you sure?" first.
    if (f.penalty) { await ui.until(p, continueOrChanged, 1500); await ui.tap(p, "Continue", { optional: true, timeout: 0 }); }
  }
  this.battles++;
  // Wait until the app has saved the battle (its saved state changes), at most 2 seconds.
  await ui.until(p, changed, 2000);
  const after = await this.state();
  this.checkScore(before, after, exp, side, f);
  // (Skip the battle that ends a set: the overlay keeps showing that set's final score for a bit.)
  const every = this.opts.overlayEvery || 1;
  if (this.opts.overlayPage && after && after.phase === "battle" && after.curSet === before.curSet && this.rnd() < 1 / every) await this.checkOverlay(after);
};

// The OBS overlay on this judge's stream channel should show the same names and points
// within a few seconds.
RobotJudge.prototype.checkOverlay = async function (st) {
  const ov = this.opts.overlayPage;
  const P1 = this.current.p1.toUpperCase(), P2 = this.current.p2.toUpperCase();
  const want = st.pts[0] + "-" + st.pts[1];
  const started = Date.now();
  let seen = "";
  while (Date.now() - started < 8000) {
    const t = await ov.evaluate(() => document.body.innerText).catch(() => "");
    const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const a = lines.indexOf(P1), b = lines.indexOf(P2);
    if (a >= 0 && b > a) {
      const nums = lines.slice(a + 1, b).filter(x => /^\d+$/.test(x));
      seen = nums.slice(0, 2).join("-");
      if (seen === want) {
        const ms = Date.now() - started;
        this.overlayDelays = this.overlayDelays || [];
        this.overlayDelays.push(ms);
        return;
      }
    } else seen = "names not shown";
    await this.page.waitForTimeout(ui.POLL * 2);
  }
  const name = this.current.p1 + " vs " + this.current.p2;
  this.fw.find("bug", this.who, "Stream overlay did not show the right score within 8 seconds", name + ": judge screen " + want + ", overlay " + (seen || "nothing") + (this.refreshedIn === name ? " (the judge's page was refreshed earlier in this match)" : ""));
};

// The score the app shows must match the rules. A set ends at 4 points, then the points reset.
RobotJudge.prototype.checkScore = function (before, after, exp, side, f) {
  const cap = this.opts.setPoints || 4;
  const name = this.current.p1 + " vs " + this.current.p2;
  const reached = exp[0] >= cap || exp[1] >= cap;
  if (reached) this.expSets.push(exp.slice());
  if (!after) return; // match over: the saved state is cleared; checked at submit
  const setEnded = (after.sets[0] + after.sets[1]) > (before.sets[0] + before.sets[1]) || after.curSet !== before.curSet;
  if (setEnded) {
    const w = exp[0] >= cap ? 0 : exp[1] >= cap ? 1 : -1;
    if (w < 0) this.fw.find("bug", this.who, "Set ended before anyone reached " + cap + " points", name + ": expected " + exp.join("-") + ", app moved to set " + after.curSet);
    else if (after.sets[w] !== before.sets[w] + 1) this.fw.find("bug", this.who, "Wrong player was given the set", name + ": points " + exp.join("-") + ", sets now " + after.sets.join("-"));
    const last = after.setScores && after.setScores[after.setScores.length - 1];
    if (last && (last.p1 !== exp[0] || last.p2 !== exp[1])) this.fw.find("bug", this.who, "Saved set score differs from the battles", name + ": battles add to " + exp.join("-") + ", saved " + last.p1 + "-" + last.p2);
    return;
  }
  if (reached) {
    // The match-ending battle clears nothing yet (the confirm screen still shows), so only flag
    // a reached target when the app is still taking battles in the same set.
    if (after.phase === "battle" && after.curSet === before.curSet) this.fw.find("bug", this.who, "Set did not end at " + cap + " points", name + ": " + exp.join("-"));
    return;
  }
  if (after.pts[0] !== exp[0] || after.pts[1] !== exp[1]) {
    this.fw.find("bug", this.who, "Score is wrong after a battle", name + ": " + f.label + " under " + (side === "p1" ? this.current.p1 : this.current.p2) + " from " + before.pts.join("-") + ", expected " + exp.join("-") + ", app shows " + after.pts.join("-"));
  }
};

// Confirm the result, let both players tap, submit, and check every copy of the result agrees.
RobotJudge.prototype.finishMatch = async function () {
  const p = this.page;
  const name = this.current.p1 + " vs " + this.current.p2;
  const st = await this.state();
  const matchId = st && st.challongeMatchId;
  const ids = st ? [st.challongeP1ParticipantId, st.challongeP2ParticipantId] : [null, null];
  await this.tap("⚖️ Judge Confirm →");
  const confirms = async () => (await ui.buttons(p)).filter(b => /TAP TO CONFIRM/.test(b)).length;
  for (let i = 0; i < 2; i++) {
    const n = await ui.until(p, confirms, 3000);
    await this.tap(/TAP TO CONFIRM/);
    await ui.until(p, async () => (await confirms()) < n, 1500);
  }
  const submitsBefore = this.fw.submits.length;
  const ingestsBefore = this.fw.ingests.length;
  await this.tap("Submit", { timeout: 8000 });
  this.say("submit " + name);
  await ui.waitForText(p, /Submitted to Challonge|Challonge.*(fail|error)|New Match/i, 20000);
  await ui.until(p, async () =>
    this.fw.submits.slice(submitsBefore).some(x => x.who === this.who) &&
    this.fw.ingests.slice(ingestsBefore).some(x => x.who === this.who) &&
    /✓ Submitted to Challonge/.test(await this.screen()), 2500);
  const s = await this.screen();
  if (!/✓ Submitted to Challonge/.test(s)) this.fw.find("bug", this.who, "Bracket submit did not show success", name + ": " + (s.match(/[^\n]*Challonge[^\n]*/g) || []).join(" / "));
  if (/Database: (failed|error)/i.test(s)) this.fw.find("bug", this.who, "Database send failed", name);
  if (/Sheets.*(failed|error)/i.test(s)) this.fw.find("bug", this.who, "Sheets send failed", name);

  // What the robot expects
  const cap = this.opts.setPoints || 4;
  const exp = this.expSets.map(x => x[0] + "-" + x[1]).join(",");
  const wins = this.expSets.reduce((a, x) => { if (x[0] >= cap) a[0]++; else if (x[1] >= cap) a[1]++; return a; }, [0, 0]);
  const expWinner = wins[0] > wins[1] ? ids[0] : ids[1];

  // What reached the (fake) bracket
  const sub = this.fw.submits.slice(submitsBefore).filter(x => x.who === this.who);
  if (sub.length !== 1) this.fw.find("bug", this.who, sub.length ? "Bracket got the result more than once" : "Bracket never got the result", name + " (" + sub.length + " submits)");
  const last = sub[sub.length - 1];
  if (last) {
    if (String(last.matchId) !== String(matchId)) this.fw.find("bug", this.who, "Result went to the wrong bracket match", name + ": sent to " + last.matchId + ", playing " + matchId);
    if (last.scores_csv !== exp) this.fw.find("bug", this.who, "Bracket score differs from the battles played", name + ": battles say " + exp + ", bracket got " + last.scores_csv);
    if (String(last.winner_id) !== String(expWinner)) this.fw.find("bug", this.who, "Bracket winner differs from the battles played", name + ": expected id " + expWinner + ", got " + last.winner_id);
  }
  // What reached the (fake) database: one row per battle that counted
  const ing = this.fw.ingests.slice(ingestsBefore).filter(x => x.who === this.who);
  if (this.fw.flagOn && this.fw.flagOn(1013) && !ing.length) this.fw.find("warn", this.who, "Database never got the battles", name);
  if (ing.length) {
    const rows = ing[ing.length - 1].rows;
    // The Judge column should name the same judge on every match this robot scores.
    const judges = [...new Set(rows.map(r => String(Array.isArray(r) ? r[1] : r.Judge)))];
    this.judgeNames = this.judgeNames || [];
    judges.forEach(j => { if (!this.judgeNames.includes(j)) this.judgeNames.push(j); });
    if (this.judgeNames.length > 1) this.fw.find("bug", this.who, "Judge name in the saved battles changed between matches", "logged in as " + this.judge.username + " / picked \"" + this.judge.bracketName + "\"; rows used: " + this.judgeNames.map(j => "\"" + j + "\"").join(", ") + " (now on " + name + ")");
    const counted = this.battles - this.undos * 1; // each Undo removes one battle
    const nonStrike = rows.filter(r => !/strike/i.test(String(Array.isArray(r) ? r[13] : r.FinishType)));
    void nonStrike;
    if (rows.length !== counted) this.fw.find("warn", this.who, "Database row count differs from battles played", name + ": " + rows.length + " rows, " + counted + " battles (" + this.undos + " undone)");
    // Last row of each set must carry that set's final score
    const bySet = {};
    rows.forEach(r => { const a = Array.isArray(r) ? r : null; if (a) bySet[a[8]] = a; });
    Object.keys(bySet).sort().forEach((k, i) => {
      const a = bySet[k], e = this.expSets[i];
      if (e && (Number(a[16]) !== e[0] || Number(a[17]) !== e[1])) this.fw.find("bug", this.who, "Database set score differs from the battles", name + " set " + k + ": rows end at " + a[16] + "-" + a[17] + ", battles say " + e.join("-"));
    });
  }
  this.matchesDone.push({ name, matchId, exp, battles: this.battles, undos: this.undos, ms: Date.now() - this.current.startedAt });

  // Back to the match list. The finished match should not still be offered.
  await this.tap("New Match");
  const listOrPrompt = async () => { const b = await ui.buttons(p); return (b.includes("Yes, no more matches here") || b.some(x => /^#\d+ /.test(x))) && b; };
  await ui.until(p, listOrPrompt, 1500);
  if (await this.answerStandbyPrompt()) await ui.until(p, async () => (await ui.buttons(p)).some(x => /^#\d+ /.test(x)), 1500);
  const btns = await ui.buttons(p);
  const stale = btns.find(b => /^#\d+ /.test(b) && b.replace(/\s+/g, "").includes((this.current.p1 + "vs" + this.current.p2).replace(/\s+/g, "")));
  if (stale) this.fw.find("warn", this.who, "Station list still offers the match that was just submitted (until Refresh)", name);
};

// A streaming station is asked "Are there no more matches at this stadium?" when its queue
// looks empty. Answer it either way (both paths get tested over many runs).
RobotJudge.prototype.answerStandbyPrompt = async function () {
  const btns = await ui.buttons(this.page);
  if (!btns.includes("Yes, no more matches here")) return false;
  const yes = this.rnd.chance(0.3);
  this.say("stream standby prompt: " + (yes ? "yes, no more matches" : "no, more are coming"));
  await this.tap(yes ? "Yes, no more matches here" : "No, more are coming");
  await ui.until(this.page, async () => !(await ui.buttons(this.page)).includes("Yes, no more matches here"), 1500);
  return true;
};

// The whole shift: log in, then play station matches until the event is over.
RobotJudge.prototype.run = async function (baseUrl, isEventOver) {
  await this.login(baseUrl);
  let idle = 0;
  while (!this.stopped) {
    const got = await this.takeNextMatch();
    if (!got) {
      if (isEventOver()) break;
      idle++;
      // If no result has reached the bracket for 2 minutes, another station is stuck: stop waiting.
      const lastSubmit = this.fw.submits.length ? this.fw.submits[this.fw.submits.length - 1].at : this.fw.startedAt;
      if (Date.now() - lastSubmit > 120000) throw new Error("Waited 2 minutes for a match (another station may be stuck)");
      await this.page.waitForTimeout(1000);
      continue;
    }
    idle = 0;
    await this.buildDecks();
    await this.playMatch();
    await this.finishMatch();
  }
  this.say("done: " + this.matchesDone.length + " matches");
};

module.exports = { RobotJudge, makeRandom };
