// NC BLAST simulator: one robot judge.
// Drives the real app in a browser the way a judge would: log in, take the next match from
// their station, enter both decks, score battles until someone wins, submit, repeat.
// Every choice comes from a seeded random number, so a run can be repeated exactly.

const ui = require("./ui.cjs");

const { makeRandom } = require("./random.cjs");

const BAD_TEXT = [
  [/\bID:\s?\d+/, "Screen shows an ID instead of a player name"],
  [/\bundefined\b/, "Screen shows the word \"undefined\""],
  [/\bNaN\b/, "Screen shows \"NaN\" (a broken number)"],
  [/\[object Object\]/, "Screen shows \"[object Object]\""],
];

// "Blade | 1-60 · Hexa" (no ratchet for blades like Bullet Griffon): the way the Previous Combos
// row reads, so the robot's record and the screen can be compared directly.
const comboText = c => {
  const r = (c.ratchet || "").trim(), b = (c.bit || "").trim();
  return (c.blade || "").trim() + " | " + [r, b].filter(Boolean).join(" · ");
};
const norm = t => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
// BLAST shows (and, as of Nov 2026, also stores) names over 15 characters as the first 12 + "…".
// Same rule as tn() in core.js, so the robot can recognise both forms on screen.
const shortName = n => n && n.length > 15 ? n.slice(0, 12) + "…" : n || "";
const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameRe = n => new RegExp("^(" + escRe(n.trim()) + "|" + escRe(shortName(n)) + ")$");
const sameName = (shown, n) => norm(shown) === norm(n) || norm(shown) === norm(shortName(n));

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
    this.allDevs = [dev];           // every phone this robot has used (a handoff adds one)
    this.saveTimes = [];            // ms from the last tap of a battle until the app saved it
    this.heap = [];                 // app memory use (MB) after each match
  }

  say(text) {
    this.steps.push({ t: Date.now(), text });
    if (this.opts.verbose) console.log("  [" + this.who + "] " + text);
  }

  async tap(match, opts) {
    await ui.tap(this.page, match, opts);
  }

  async screen() {
    const t = await ui.screenText(this.page);
    this.scan(t);
    return t;
  }

  // Text that should never be on a screen: an id where a name belongs, or a broken value.
  scan(t) {
    for (const [re, what] of BAD_TEXT) {
      const m = re.exec(t);
      if (!m) continue;
      const key = what + "|" + (this.current ? this.current.matchId : "-");
      this.scanned = this.scanned || new Set();
      if (this.scanned.has(key)) continue;
      this.scanned.add(key);
      const around = t.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).replace(/\n+/g, " / ");
      this.fw.find("bug", this.who, what, (this.current ? this.current.p1 + " vs " + this.current.p2 + ": " : "") + "…" + around + "…");
    }
  }

  // ── log in ───────────────────────────────────────────────────────────────
  async login(baseUrl, opts = {}) {
    const p = this.page;
    if (!opts.here) {
      this.say("open the app");
      await p.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
    }
    // Screen by screen, so it also works after a refresh (when some steps are skipped).
    const evName = new RegExp("^" + this.fw.ev.name.replace(/[()]/g, "\\$&"));
    for (let guard = 0; guard < 80; guard++) {
      const s = await this.screen();
      const btns = await ui.buttons(p);
      if (/Spin Finish|Set Deck Order|Pick a Side|Who Won the Die Roll|Deck Review|Record decks|Check decks|Record blades|Check blades|Both decks are hidden|CONFIRM RESULT|Select Match/.test(s) && !/Select the Challonge event/.test(s)) break;
      if (btns.includes("⚖️ A Judge")) { await ui.tap(p, "⚖️ A Judge", { optional: true, timeout: 1500 }); continue; }
      if (btns.some(t => evName.test(t))) { await ui.tap(p, evName, { optional: true, timeout: 1500 }); continue; }
      if (btns.includes("Log in with Challonge →")) { await ui.tap(p, "Log in with Challonge →", { optional: true, timeout: 1500 }); continue; }
      if (/Enter your Challonge username/.test(s)) {
        await p.fill("input", this.judge.username);
        await ui.tap(p, "Confirm →", { optional: true, timeout: 1500 });
        continue;
      }
      if (btns.includes("✏️ Manual Name Entry") && !(await p.$("input[placeholder='Enter your name…']"))) { await ui.tap(p, "✏️ Manual Name Entry", { optional: true, timeout: 1500 }); continue; }
      if (await p.$("input[placeholder='Enter your name…']")) {
        await p.fill("input[placeholder='Enter your name…']", this.judge.bracketName);
        await ui.tap(p, "Confirm", { optional: true, timeout: 1500 });
        continue;
      }
      if (btns.includes("Next: Players →")) { await ui.tap(p, "Next: Players →", { optional: true, timeout: 1500 }); continue; }
      await p.waitForTimeout(ui.POLL * 2);
    }
    await ui.waitForText(p, /Select Match|Spin Finish|Set Deck Order|Pick a Side|Who Won the Die Roll|Deck Review|Record decks|Check decks|Record blades|Check blades|Both decks are hidden|CONFIRM RESULT/, 10000);
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
    // At most one clash test per round, so the rest of the round stays a normal event.
    this.fw.clashRounds = this.fw.clashRounds || {};
    if (!this.fw.clashRounds[this.fw.ev.round] && this.rnd.chance(this.opts.clashRate === undefined ? 0.08 : this.opts.clashRate)) {
      this.fw.clashRounds[this.fw.ev.round] = true;
      if (await this.takeOtherStationsMatch()) return true;
    }
    for (let i = 0; i < 20; i++) {
      if (await this.answerStandbyPrompt()) continue;
      if (await ui.tap(this.page, "🏟️ Station", { optional: true, timeout: 500 })) break;
      if (i === 19) throw new Error("Could not get to the Station list");
    }
    await this.tap("↻ Refresh", { optional: true, timeout: 1500 });
    await ui.waitForText(this.page, /STATION [A-H] MATCHES|station/i);
    // A judge who is not on the organizer's station list (like a relief judge) is asked to pick one.
    if (/Pick your station/i.test(await this.screen())) {
      this.say("pick station " + this.judge.station);
      await this.tap(this.judge.station);
      await ui.waitForText(this.page, /STATION [A-H] MATCHES/i, 5000).catch(() => {});
    }
    // Wait for the match rows to show (an empty station simply times out after a moment).
    const btns = (await ui.until(this.page, async () => { const b = await ui.buttons(this.page); return b.some(x => /^#\d+ /.test(x)) && b; }, 1200)) || await ui.buttons(this.page);
    const done = new Set(this.matchesDone.map(m => String(m.matchId)));
    // Station rows look like "#1 Ace RamirezvsBree Tanaka". Match them to the bracket to get exact names.
    // Every name a player has had (current first), keyed by their bracket group id.
    const names = {};
    this.fw.ev.players.forEach(pl => { names[pl.gid] = [pl.name, ...(pl.oldNames || [])].map(x => x.trim()); });
    const byGid = {};
    this.fw.ev.players.forEach(pl => { byGid[pl.gid] = pl; });
    const rows = btns.filter(b => /^#\d+ /.test(b)).map(b => {
      const flat = b.replace(/^#\d+ /, "").replace(/\s+/g, "");
      for (const m of this.fw.ev.matches) {
        for (const a of names[m.player1_id] || []) for (const c of names[m.player2_id] || []) {
          if ((a + "vs" + c).replace(/\s+/g, "") === flat) return { label: b, m, p1: a, p2: c, pl1: byGid[m.player1_id], pl2: byGid[m.player2_id] };
        }
      }
      return { label: b };
    });
    rows.filter(r => /^#\d+ \s*vs|vs\s*$/.test(r.label)).forEach(r => this.fw.find("bug", this.who, "Station list shows a match with a blank player name", r.label));
    rows.filter(r => !r.m).forEach(r => this.fw.find("warn", this.who, "Station list shows a match the bracket does not have", r.label));
    rows.filter(r => r.m && (r.p1 !== r.pl1.name.trim() || r.p2 !== r.pl2.name.trim()))
      .forEach(r => this.fw.find("warn", this.who, "Station list still shows a player's old name after it was renamed in the bracket", r.label + " (now " + r.pl1.name.trim() + " vs " + r.pl2.name.trim() + ")"));
    const row = rows.find(r => r.m && !done.has(String(r.m.id)));
    if (!row) return false;
    this.current = { label: row.label, p1: row.p1, p2: row.p2, pl1: row.pl1, pl2: row.pl2, matchId: row.m.id, startedAt: Date.now(), prevChecked: {} };
    this.say("take " + row.label + " (match " + row.m.id + ")");
    // Tap the match; if the app does not move on (a lost request on bad wifi), tap it again like a judge would.
    for (let i = 0; ; i++) {
      await this.tap(row.label, { timeout: 4000 }).catch(() => {});
      if (await ui.until(this.page, async () => (await ui.buttons(this.page)).includes("Build Decks →"), 6000)) break;
      if (i >= 2) {
        this.fw.find(this.fw.wifiBad ? "info" : "warn", this.who, "Tapping a match in the Station list did not open it" + (this.fw.wifiBad ? " (bad wifi)" : ""), row.label + " (3 tries)");
        return false;
      }
      this.say("match did not open, tapping again");
      await ui.tap(this.page, "↻ Refresh", { optional: true, timeout: 800 });
    }
    this.claim();
    await this.tap("Build Decks →");
    return true;
  }

  // Note who is scoring which match, so two judges on one match can be spotted.
  claim() {
    const id = String(this.current.matchId);
    this.fw.inPlay = this.fw.inPlay || {};
    const other = this.fw.inPlay[id];
    if (other && other !== this.who) {
      this.fw.find("warn", this.who, "Two judges are scoring the same match at the same time (no warning from the app)", this.current.p1 + " vs " + this.current.p2 + ": station " + other + " already has it open" + (this.current.stolen ? " (taken from Active Matches)" : " (taken from the Station list)"));
      this.fw.clashes = (this.fw.clashes || 0) + 1;
      (this.fw.contested = this.fw.contested || {})[id] = true;
    }
    this.fw.inPlay[id] = this.who;
  }

  // Station clash test: open ⚡ Active Matches and take a match that belongs to another station,
  // preferably one another judge is already scoring. Returns false if there is nothing to take.
  async takeOtherStationsMatch() {
    const p = this.page;
    if (!(await ui.tap(p, "⚡ Active Matches", { optional: true, timeout: 1500 }))) return false;
    await ui.tap(p, "↻ Refresh", { optional: true, timeout: 800 });
    const rows = (await ui.until(p, async () => { const b = (await ui.buttons(p)).filter(x => / Select →$/.test(x)); return b.length && b; }, 2000)) || [];
    const n = this.fw.idToName();
    const mine = new Set((this.fw.stationQueues()[this.judge.station] || []).map(String));
    const inPlay = this.fw.inPlay || {};
    const cands = rows.map(label => {
      const mm = /^(.+?) vs (.+?) Round \d+ · Match #\d+ Select →$/.exec(label);
      if (!mm) return null;
      const m = this.fw.ev.matches.find(x => x.state !== "complete" && sameName(mm[1], n[x.player1_id]) && sameName(mm[2], n[x.player2_id]));
      return m && !mine.has(String(m.id)) && inPlay[String(m.id)] !== this.who && !(this.fw.contested || {})[String(m.id)] ? { label, m, p1: mm[1], p2: mm[2] } : null;
    }).filter(Boolean);
    if (!cands.length) { await ui.tap(p, "🏟️ Station", { optional: true, timeout: 800 }); return false; }
    const busy = cands.filter(c => inPlay[String(c.m.id)]);
    const pick = busy.length ? this.rnd.pick(busy) : this.rnd.pick(cands);
    const byGid = {};
    this.fw.ev.players.forEach(pl => { byGid[pl.gid] = pl; });
    this.current = { label: pick.label, p1: n[pick.m.player1_id].trim(), p2: n[pick.m.player2_id].trim(), pl1: byGid[pick.m.player1_id], pl2: byGid[pick.m.player2_id], matchId: pick.m.id, startedAt: Date.now(), prevChecked: {}, stolen: true };
    this.say("CLASH TEST: take another station's match from Active Matches: " + pick.label);
    await this.tap(pick.label);
    this.claim();
    await this.tap("Build Decks →");
    return true;
  }

  // ── enter both players' decks ────────────────────────────────────────────
  async buildDecks() {
    const p = this.page;
    for (let guard = 0; guard < 80; guard++) {
      // Flag 1034: the new Record decks screen (wait a moment for it, the app may still be loading combos).
      if (await ui.until(p, () => p.$(".ncbdb"), guard ? 0 : 1500)) return this.buildDecksV2();
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

  // Reads the 🕐 Previous Combos row on the blade picker: [{ text, disabled }], or null when there is none.
  async readPrevCombos() {
    return this.page.evaluate(() => {
      // Flag 1034 screen: "Previous combos" label row, then a grid of combo cards (blade | ratchet · bit).
      if (document.querySelector(".ncbdb")) {
        const row = [...document.querySelectorAll(".ncbdb .label-row")].find(x => /^Previous (combos|blades)$/.test((x.querySelector(".label") || {}).textContent || ""));
        if (!row) return null;
        const grid = row.nextElementSibling;
        return grid ? [...grid.querySelectorAll("button.cc, button.chip")].map(b => ({ text: [...b.children].map(x => x.textContent.trim()).filter(Boolean).join(" | "), disabled: !!b.disabled })) : [];
      }
      const label = [...document.querySelectorAll("p")].find(x => /Previous Combos/.test(x.textContent));
      if (!label) return null;
      const grid = label.parentElement && label.parentElement.nextElementSibling;
      if (!grid) return [];
      return [...grid.querySelectorAll("button")].map(b => ({ text: b.innerText.split("\n").map(x => x.trim()).filter(Boolean).join(" | "), disabled: !!b.disabled }));
    });
  }

  // On a player's first combo, the Previous Combos row must show that player's last deck exactly
  // (or nothing at all if they have not played yet).
  async checkPrevCombos(screenText) {
    const m = /(^|\n)([^\n]+?) — (FIRST|SECOND|THIRD) COMBO/.exec(screenText);
    if (!m || m[3] !== "FIRST") return null;
    const who = sameName(m[2], this.current.p1) ? 1 : sameName(m[2], this.current.p2) ? 2 : 0;
    if (!who || this.current.prevChecked[who]) return null;
    this.current.prevChecked[who] = true;
    const pl = who === 1 ? this.current.pl1 : this.current.pl2;
    const name = who === 1 ? this.current.p1 : this.current.p2;
    const truth = this.fw.truthDecks[pl.id];
    const shown = await this.readPrevCombos();
    // A match two judges scored has two "real" decks, so there is no single right answer to check.
    if (truth && truth.contested) return shown;
    const match = this.current.p1 + " vs " + this.current.p2;
    this.prevStats = this.prevStats || { checked: 0, ok: 0 };
    this.prevStats.checked++;
    if (!truth) {
      if (shown && shown.length) this.fw.find("bug", this.who, "Previous Combos shown for a player who has not played yet (someone else's deck?)", name + " in " + match + ": " + shown.map(x => x.text).join(" / "));
      else this.prevStats.ok++;
      return shown;
    }
    const want = truth.combos.map(norm).sort().join(" / ");
    const got = (shown || []).map(x => norm(x.text)).sort().join(" / ");
    if (want === got) { this.prevStats.ok++; return shown; }
    const renamed = this.fw.renamed && this.fw.renamed.id === pl.id;
    // Combos whose ratchet has the bit built in (Turbo, Operate…) are complete in BLAST but have no bit.
    const shownSet = new Set((shown || []).map(x => norm(x.text)));
    const missing = truth.combos.filter(c => !shownSet.has(norm(c)));
    const noBit = c => truth.raw && truth.raw.some(r => comboText(r) === c && r.ratchet && !r.bit);
    if (missing.length && missing.every(noBit) && got) {
      const extra = (shown || []).map(x => x.text).filter(t => !truth.combos.map(norm).includes(norm(t)));
      this.fw.find("bug", this.who, "Previous Combos leave out combos whose ratchet has a built-in bit (Turbo, Operate…)", name + ": left out " + missing.join(" / ") + (extra.length ? "; an older combo shows instead: " + extra.join(" / ") : "") + ". The Worker's /combos/slug save keeps only combos with a bit.");
      return shown;
    }
    const otherTruths = Object.values(this.fw.truthDecks).filter(t => t !== truth && t.combos.map(norm).sort().join(" / ") === got);
    let what = !got ? "Previous Combos missing for a player who has played before"
      : otherTruths.length ? "Previous Combos show another player's deck"
      : "Previous Combos differ from the player's last deck";
    let level = "bug";
    if (renamed && !got) { what = "Previous combos lost after a player was renamed in the bracket"; level = "warn"; }
    this.fw.find(level, this.who, what, name + " in " + match + " (last played round " + truth.round + " as \"" + truth.name.trim() + "\"): expected " + truth.combos.join(" / ") + "; shown " + (got ? shown.map(x => x.text).join(" / ") : "nothing") + (otherTruths.length ? " (that is " + otherTruths.map(t => t.name.trim()).join(", ") + "'s deck)" : ""));
    return shown;
  }

  // ── Flag 1034: the new Record decks screen, then each player checks their own deck ──
  // Reads the screen (stage, prompt), picks parts like a judge would (previous combo, quick combo,
  // typed search, CX steps, or a part button), sometimes fixes a part from a check screen, then
  // taps both "<name> confirms" buttons. The match then starts by itself (no Start Match button).
  async buildDecksV2() {
    const p = this.page;
    this.current.v2 = true;
    this.current.v2Fixed = false;
    for (let guard = 0; guard < 160; guard++) {
      // The screen ignores a second tap on the same spot within 0.3 s (and a tap inside that window
      // restarts it), and its confirm buttons wait 0.6 s after they appear, so a real judge's pace is used.
      if (guard) await p.waitForTimeout(340);
      const st = await p.evaluate(() => {
        const app = document.querySelector(".ncbdb");
        if (!app) return null;
        const f = app.querySelector(".field");
        return { stage: app.getAttribute("data-stage"), prompt: f && !f.hidden ? f.querySelector(".prompt").innerText.replace(/\s+/g, " ").trim() : "" };
      });
      if (!st) return;   // the deck screen closed: the match has started
      await this.screen();
      if (st.stage === "check") {
        // Now and then a player spots a wrong part on their check screen: fix it, like a judge would.
        if (!this.current.v2Fixed && this.rnd.chance(0.08)) {
          const cells = await p.$$(".ncbdb .ck-cell:not(:disabled)");
          if (cells.length) {
            this.current.v2Fixed = true;
            this.say("player asks to fix a part on the check screen");
            await this.rnd.pick(cells).click({ timeout: 3000 }).catch(() => {});
            continue;
          }
        }
        const ok = await ui.tap(p, / confirms/, { optional: true, timeout: 1500 });
        if (ok) this.say("deck confirmed by its player");
        continue;
      }
      if (st.stage === "cover") { await ui.tap(p, /^Show .+'s (deck|blades)$/, { optional: true, timeout: 1500 }); continue; }
      if (!st.prompt) {
        await ui.tap(p, /^(Check (decks|blades) with the players|Go to .+'s (deck|blades))$/, { optional: true, timeout: 1500 });
        continue;
      }
      const m = /^(.+?) · Combo (\d): (?:pick|change) the (blade|ratchet|bit)$/.exec(st.prompt);
      if (!m) { await p.waitForTimeout(ui.POLL); continue; }
      if (m[3] === "blade") await this.pickBladeV2(m[1], Number(m[2]));
      else await this.pickPartV2(m[3]);
      await p.waitForTimeout(ui.POLL);
    }
    throw new Error("Deck building (new screen) did not finish (stuck on: " + (await this.screen()).replace(/\n+/g, " / ").slice(0, 200) + ")");
  }

  // Clicks one enabled element matching a selector, chosen at random. Returns its text, or null.
  async clickRandom(sel) {
    const els = await this.page.$$(sel);
    const ok = [];
    for (const e of els) if (await e.isEnabled().catch(() => false) && await e.isVisible().catch(() => false)) ok.push(e);
    if (!ok.length) return null;
    const el = this.rnd.pick(ok);
    const t = ((await el.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    await el.click({ timeout: 3000 }).catch(() => {});
    return t;
  }

  // Marks the combo cards under one label ("Previous combos", "Quick combos") so clickRandom can find them.
  async markGrid(label) {
    return this.page.evaluate(label => {
      document.querySelectorAll("[data-robot-pick]").forEach(x => x.removeAttribute("data-robot-pick"));
      const row = [...document.querySelectorAll(".ncbdb .label-row")].find(x => ((x.querySelector(".label") || {}).textContent || "") === label);
      const grid = row && row.nextElementSibling;
      if (!grid) return 0;
      const bs = [...grid.querySelectorAll("button.cc")];
      bs.forEach(b => b.setAttribute("data-robot-pick", ""));
      return bs.length;
    }, label);
  }

  async pickBladeV2(name, combo) {
    const p = this.page;
    // On a player's first combo the Previous combos row must show their last deck (same check as the old screen).
    if (combo === 1) {
      const empty = await p.evaluate(() => !document.querySelector(".ncbdb .deck-row .cell:not(.empty):not(.builtin)"));
      if (empty) await this.checkPrevCombos("\n" + name + " — FIRST COMBO");
    }
    const r = this.rnd();
    const reuse = this.opts.reuseRate === undefined ? 0.4 : this.opts.reuseRate;
    if (r < reuse) {
      if (await this.markGrid("Previous combos")) {
        const t = await this.clickRandom("[data-robot-pick]");
        if (t) { this.say("previous combo " + t); this.reusedPrev = (this.reusedPrev || 0) + 1; return; }
      }
    }
    if (r < reuse + 0.2) {
      if (await this.markGrid("Quick combos")) {
        const t = await this.clickRandom("[data-robot-pick]");
        if (t) { this.say("quick combo " + t); return; }
      }
    }
    if (r < reuse + 0.35) {
      // Type a blade name in the search box and press Enter, like a judge using the keyboard.
      const names = await p.$$eval(".ncbdb .body .chip-blade:not(:disabled) .chip-t", xs => xs.map(x => x.textContent));
      if (names.length) {
        const n = this.rnd.pick(names);
        this.say("search " + n + " + Enter");
        await p.fill(".ncbdb .search input", n);
        await p.press(".ncbdb .search input", "Enter");
        await p.waitForTimeout(ui.POLL);
        // Close the keyboard the way a judge would, by tapping on to the next part.
        await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
        return;
      }
    }
    if (r < reuse + 0.45) {
      // A CX blade, one piece per tap.
      await ui.tap(p, "CX", { optional: true, timeout: 1000 });
      for (let i = 0; i < 6; i++) {
        const still = await p.$(".ncbdb .cx-opt");
        if (!still) break;
        const t = await this.clickRandom(".ncbdb .cx-opt:not(:disabled)");
        if (!t) break;
        this.say("CX piece " + t);
        await p.waitForTimeout(ui.POLL);
        const pr = await p.evaluate(() => { const f = document.querySelector(".ncbdb .field"); return f && !f.hidden ? f.innerText : ""; });
        if (!/pick the blade|change the blade/.test(pr)) return;
      }
      await ui.tap(p, "Standard", { optional: true, timeout: 800 });
    }
    const t = await this.clickRandom(".ncbdb .body .chip-blade:not(:disabled)");
    if (t) this.say("blade " + t);
  }

  async pickPartV2(kind) {
    const p = this.page;
    if (kind === "ratchet" && this.rnd.chance(0.3)) {
      const t = await this.clickRandom(".ncbdb .pinned .sug:not(:disabled)");
      if (t) { this.say("one-tap finish " + t); return; }
    }
    const t = await this.clickRandom(".ncbdb .chip-" + kind + ":not(:disabled)");
    if (!t) throw new Error("No " + kind + " to pick on the new deck screen");
    this.say(kind + " " + t);
  }

  async pickBlade() {
    const p = this.page;
    const shown = await this.checkPrevCombos(await this.screen());
    // Like a real judge, often reuse a previous combo when there is one.
    const usable = (shown || await this.readPrevCombos() || []).map((x, i) => ({ ...x, i })).filter(x => !x.disabled);
    if (usable.length && this.rnd.chance(this.opts.reuseRate === undefined ? 0.4 : this.opts.reuseRate)) {
      const pick = this.rnd.pick(usable);
      this.say("previous combo " + pick.text);
      const h = await p.evaluateHandle(i => {
        const label = [...document.querySelectorAll("p")].find(x => /Previous Combos/.test(x.textContent));
        return label.parentElement.nextElementSibling.querySelectorAll("button")[i];
      }, pick.i);
      await h.asElement().click({ timeout: 3000 });
      this.reusedPrev = (this.reusedPrev || 0) + 1;
      return;
    }
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
  const sideName = s => (s === "p1" ? this.current.p1 : this.current.p2);
  this.battles = 0;
  this.undos = 0;
  this.history = [];   // app state before each battle (for checking Undo)
  this.expSets = [];   // set scores the robot expects, e.g. [[4,2],[1,4],...]
  // Flag 1034: the new deck screen starts the match itself after both players confirm.
  if (!this.current.v2) await this.tap("Start Match ⚔️");
  for (let guard = 0; guard < 400; guard++) {
    const p = this.page;   // (can change mid-match: a handoff moves the robot to another phone)
    const s = await this.screen();
    const btns = await ui.buttons(p);
    if (/Who Won the Die Roll\?/.test(s)) {
      const who = this.rnd.pick(["p1", "p2"]);
      this.say("die roll won by " + sideName(who));
      await this.tap(nameRe(sideName(who)));
      continue;
    }
    if (/Pick a Side/.test(s)) {
      const side = this.rnd.pick(["B Side", "X Side"]);
      this.say("picks " + side);
      await this.tap(side);
      continue;
    }
    // Flag 1035: the new Deck order screen. Tap combos in a random order for each player (the 3rd fills in
    // by itself), sometimes take one back, sometimes fix an order from a check screen, then both players confirm.
    if (await p.$(".ncbdo")) {
      await p.waitForTimeout(340);   // the screen ignores a second tap on the same spot within 0.3 s, and new screens for 0.6 s
      const st = await p.evaluate(() => {
        const a = document.querySelector(".ncbdo");
        if (!a) return null;
        // One box per player (both on screen; only one while an order is being changed): how many places are set in each.
        const boxes = [...a.querySelectorAll(".pnl")].map(b => ({ open: b.querySelectorAll(".bey .badge:not(.on)").length, picked: b.querySelectorAll(".bey .badge.on").length }));
        return { stage: a.getAttribute("data-stage"), fixing: a.getAttribute("data-fixing") === "1", boxes, dock: !!a.querySelector(".dock-btn:not(:disabled)") };
      });
      if (!st) continue;
      if (st.stage === "check") {
        if (!this.current.orderFixed && this.rnd.chance(0.06)) {
          this.current.orderFixed = true;
          this.say("player asks to change their order");
          await ui.tap(p, "Change order", { optional: true, timeout: 1500 });
          continue;
        }
        if (await ui.tap(p, / confirms/, { optional: true, timeout: 1500 })) this.say("order confirmed by its player");
        continue;
      }
      if (st.stage === "cover") { await ui.tap(p, /^Show .+'s order$/, { optional: true, timeout: 1500 }); continue; }
      const boxSel = k => `.ncbdo .pnl >> nth=${k}`;
      if (st.fixing && st.boxes[0] && st.boxes[0].picked === 3) {
        // Changing an order from the check screen: take back the 1st place, then pick again.
        await p.locator(boxSel(0)).locator(".bey:has(.badge.on)").first().click({ timeout: 2000 }).catch(() => {});
        continue;
      }
      const k1 = st.boxes.findIndex(b => b.picked === 1);
      if (k1 >= 0 && this.rnd.chance(0.1)) {
        this.say("takes back a 1st pick");
        await p.locator(boxSel(k1)).locator(".bey:has(.badge.on)").first().click({ timeout: 2000 }).catch(() => {});
        continue;
      }
      const todo = st.boxes.map((b, k) => (b.picked < 3 && b.open ? k : -1)).filter(k => k >= 0);
      if (todo.length) {
        const k = this.rnd.pick(todo);
        const els = await p.locator(boxSel(k)).locator(".bey:has(.badge:not(.on))").all();
        if (els.length) { await this.rnd.pick(els).click({ timeout: 2000 }).catch(() => {}); continue; }
      }
      if (st.dock) {
        // Both orders set: two buttons. Sometimes the judge has the players check, sometimes starts right away.
        if (this.rnd.chance(0.5)) { this.say("deck order set, check with players"); await ui.tap(p, "Check With Players", { optional: true, timeout: 1500 }); }
        else { this.say("deck order set, start battles"); await ui.tap(p, "Looks good, start battles.", { optional: true, timeout: 1500 }); }
        continue;
      }
      // In the middle of the short pause after a 3rd place fills in: wait.
      await p.waitForTimeout(ui.POLL);
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
  if (!this.current.decksRecorded && Array.isArray(before.d1) && Array.isArray(before.d2)) {
    this.current.decksRecorded = true;
    [[this.current.pl1, before.d1], [this.current.pl2, before.d2]].forEach(([pl, deck]) => {
      const prev = this.fw.truthDecks[pl.id];
      const round = this.fw.ev.matches.find(x => x.id === this.current.matchId).round;
      const contested = !!(this.fw.contested || {})[String(this.current.matchId)] || !!(prev && prev.contested && prev.round === round);
      this.fw.truthDecks[pl.id] = { name: pl.name, combos: deck.map(comboText), raw: deck, round, contested };
    });
  }
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
  // Once per event: hand the match to a relief judge on a second phone.
  if (this.opts.openReliefDevice && !this.opts.streamSlot && !this.fw.handoffDone && this.history.length && !this.current.stolen
      && this.rnd.chance(this.opts.handoffRate === undefined ? 0.03 : this.opts.handoffRate)) {
    this.fw.handoffDone = true;
    await this.handOff(before);
    return;
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
  const t0 = Date.now();
  if (await ui.until(p, changed, 2000)) this.saveTimes.push(Date.now() - t0);
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
  const forms = n => [n.trim().toUpperCase(), shortName(n).toUpperCase()];
  const want = st.pts[0] + "-" + st.pts[1];
  const started = Date.now();
  let seen = "";
  while (Date.now() - started < 8000) {
    const t = await ov.evaluate(() => document.body.innerText).catch(() => "");
    const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const a = lines.findIndex(x => forms(this.current.p1).includes(x)), b = lines.findIndex(x => forms(this.current.p2).includes(x));
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
  this.fw.find(this.fw.wifiBad ? "warn" : "bug", this.who, "Stream overlay did not show the right score within 8 seconds" + (this.fw.wifiBad ? " (bad wifi)" : ""), name + ": judge screen " + want + ", overlay " + (seen || "nothing") + (this.refreshedIn === name ? " (the judge's page was refreshed earlier in this match)" : ""));
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
  if (!(await ui.until(p, async () => (await ui.buttons(p)).includes("Submit"), 8000))) {
    const t = (await this.screen()).replace(/\n+/g, " / ");
    const where = name + (this.current.handedOff ? " (after a handoff)" : "");
    // First try what a judge would: reload the page, log in again, and confirm once more.
    if (!this.current.reloadTried) {
      this.current.reloadTried = { judge: (/JUDGE \/ ([^/]+) \//.exec(t) || [])[1] || "?", buttons: (await ui.buttons(p)).join(" | ") };
      this.say("no bracket Submit button: reload, log in again, try once more");
      await this.login(this.opts.baseUrl);
      if ((await ui.buttons(this.page)).includes("⚖️ Judge Confirm →")) return this.finishMatch();
    }
    // Still no way to send the result to the bracket from this phone. Note it, then do what an
    // organizer would: enter the result in the bracket by hand, so the event can go on.
    this.fw.find("bug", this.who, "No bracket Submit button at the end of the match", where + ". Judge shown: " + this.current.reloadTried.judge + "; buttons: " + this.current.reloadTried.buttons + (this.current.reloadTried ? " (still none after reloading and logging in again)" : ""));
    const cap = this.opts.setPoints || 4;
    const wins = this.expSets.reduce((a, x) => { if (x[0] >= cap) a[0]++; else if (x[1] >= cap) a[1]++; return a; }, [0, 0]);
    this.fw.enterByHand(this.current.matchId, this.expSets.map(x => x[0] + "-" + x[1]).join(","), wins[0] > wins[1] ? 1 : 2);
    this.matchesDone.push({ name, matchId: this.current.matchId, handedOff: !!this.current.handedOff, exp: "(entered by hand)", battles: this.battles, undos: this.undos, ms: Date.now() - this.current.startedAt });
    if (this.fw.inPlay) delete this.fw.inPlay[String(this.current.matchId)];
    // Start this phone fresh (reload and log in again), like a judge would.
    await this.login(this.opts.baseUrl);
    return;
  }
  if (this.current.reloadTried) this.fw.find("bug", this.who, "No bracket Submit button at the end of the match until the judge reloads and logs in again", name + (this.current.handedOff ? " (after a handoff)" : "") + ". Before reloading, judge shown: " + this.current.reloadTried.judge + "; buttons: " + this.current.reloadTried.buttons);
  await this.tap("Submit", { timeout: 8000 });
  this.say("submit " + name);
  // Wait for the bracket to answer. If the send failed, retry like a judge would (up to 5 times).
  let tries = 0;
  for (;;) {
    const r = await ui.until(p, async () => {
      const t = await this.screen();
      if (/✓ Submitted to Challonge/.test(t)) return "ok";
      if ((await ui.buttons(p)).some(b => /Failed — Retry|NOT sent to Challonge — tap to retry/.test(b))) return "failed";
      return false;
    }, 20000);
    if (r !== "failed" || tries >= 5) break;
    tries++;
    this.retries = (this.retries || 0) + 1;
    this.say("bracket send failed, Retry (" + tries + ")");
    await ui.tap(p, /Failed — Retry|NOT sent to Challonge — tap to retry/);
  }
  for (let d = 0; d < 3; d++) {
    const failed = await ui.until(p, async () => {
      const b = await ui.buttons(p);
      if (b.some(x => /Database: failed/.test(x))) return "failed";
      return /✓ Database: sent/.test(await this.screen()) ? "ok" : false;
    }, 4000);
    if (failed !== "failed") break;
    this.say("database send failed, tap to retry");
    await ui.tap(p, /Database: failed/, { optional: true, timeout: 500 });
  }
  await ui.until(p, async () =>
    this.fw.submits.slice(submitsBefore).some(x => x.who === this.who) &&
    this.fw.ingests.slice(ingestsBefore).some(x => x.who === this.who) &&
    /✓ Submitted to Challonge/.test(await this.screen()), 2500);
  const s = await this.screen();
  if (!/✓ Submitted to Challonge/.test(s)) this.fw.find("bug", this.who, "Bracket submit did not show success", name + ": " + (s.match(/[^\n]*Challonge[^\n]*/g) || []).join(" / "));
  if (/Database: (failed|error)/i.test(s)) this.fw.find(this.fw.wifiBad ? "warn" : "bug", this.who, "Database send failed" + (this.fw.wifiBad ? " even after retrying (bad wifi)" : ""), name);
  if (/Sheets.*(failed|error)/i.test(s)) this.fw.find(this.fw.wifiBad ? "warn" : "bug", this.who, "Sheets send failed" + (this.fw.wifiBad ? " (bad wifi)" : ""), name);

  // What the robot expects
  const cap = this.opts.setPoints || 4;
  const exp = this.expSets.map(x => x[0] + "-" + x[1]).join(",");
  const wins = this.expSets.reduce((a, x) => { if (x[0] >= cap) a[0]++; else if (x[1] >= cap) a[1]++; return a; }, [0, 0]);
  const expWinner = wins[0] > wins[1] ? ids[0] : ids[1];

  // What reached the (fake) bracket
  const sub = this.fw.submits.slice(submitsBefore).filter(x => x.who === this.who);
  if (sub.length > 1 && sub.every(x => x.scores_csv === sub[0].scores_csv && x.winner_id === sub[0].winner_id))
    this.fw.find("info", this.who, "Result reached the bracket twice after a lost reply (same score both times, harmless)", name);
  else if (sub.length !== 1) this.fw.find("bug", this.who, sub.length ? "Bracket got the result more than once" : "Bracket never got the result", name + " (" + sub.length + " submits)");
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
    if (this.current.handedOff) this.judgeNames = [];   // a relief judge took over: new name from here on
    else if (this.judgeNames.length > 1) this.fw.find("bug", this.who, "Judge name in the saved battles changed between matches", "logged in as " + this.judge.username + " / picked \"" + this.judge.bracketName + "\"; rows used: " + this.judgeNames.map(j => "\"" + j + "\"").join(", ") + " (now on " + name + ")");
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
  try { const mb = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0); if (mb) this.heap.push(Math.round(mb)); } catch (_) {}
  this.matchesDone.push({ name, matchId: this.current.matchId, handedOff: !!this.current.handedOff, retries: tries, exp, battles: this.battles, undos: this.undos, ms: Date.now() - this.current.startedAt });

  // Flag 1036: the "Next Action?" popup opens right after Submit. Mostly the judge taps New Match there; now and then
  // Stay Here (then the page's own New Match), or, with a stream channel, Finished this round. (standby slides).
  let viaPopup = false;
  const dlg = '[role="dialog"][aria-label="Next Action?"]';
  if (await ui.until(p, () => p.$(dlg), 1500)) {
    const btn = t => p.locator(dlg + " button", { hasText: t }).first();
    const canFinish = await btn("Finished this round.").count();
    const r = this.rnd();
    if (canFinish && r < 0.2) {
      this.say("Next Action: Finished this round.");
      await btn("Finished this round.").click({ timeout: 3000 });
      const slot = this.opts.streamSlot;
      const ok = await ui.until(p, async () => !!(this.fw.overlay[slot] && this.fw.overlay[slot].standby), 5000);
      if (!ok) this.fw.find("bug", this.who, "Finished this round. did not put the stream channel into the between-round slides", name + " (channel " + slot + ")");
    } else if (r < 0.35) {
      this.say("Next Action: Stay Here");
      await btn("Stay Here").click({ timeout: 3000 });
    } else {
      this.say("Next Action: New Match");
      await ui.until(p, async () => await btn("New Match").isEnabled(), 8000);
      await btn("New Match").click({ timeout: 3000 });
      viaPopup = true;
    }
    if (!viaPopup && await ui.until(p, () => p.$(dlg), 300)) this.fw.find("bug", this.who, "Next Action popup did not close", name);
  } else if (await p.evaluate(() => typeof ff === "function" && ff(1036)).catch(() => false)) {
    this.fw.find("bug", this.who, "Next Action popup did not open after Submit", name);
  }
  // Back to the match list. The finished match should not still be offered.
  if (!viaPopup) await this.tap(/^New Match/);
  const listOrPrompt = async () => { const b = await ui.buttons(p); return (b.includes("Yes, no more matches here") || b.some(x => /^#\d+ /.test(x))) && b; };
  await ui.until(p, listOrPrompt, 1500);
  if (await this.answerStandbyPrompt()) await ui.until(p, async () => (await ui.buttons(p)).some(x => /^#\d+ /.test(x)), 1500);
  const btns = await ui.buttons(p);
  const stale = btns.find(b => /^#\d+ /.test(b) && b.replace(/\s+/g, "").includes((this.current.p1 + "vs" + this.current.p2).replace(/\s+/g, "")));
  if (stale) this.fw.find("warn", this.who, "Station list still offers the match that was just submitted (until Refresh)", name);
  if (this.fw.inPlay && this.fw.inPlay[String(this.current.matchId)] === this.who) delete this.fw.inPlay[String(this.current.matchId)];
  // Clash test: tap the finished match again, like a judge who did not notice it was done.
  if (stale && this.rnd.chance(this.opts.reopenRate === undefined ? 0.25 : this.opts.reopenRate)) {
    this.say("CLASH TEST: tap the finished match again");
    await this.tap(stale);
    const s2 = await ui.until(p, async () => { const t = await this.screen(); return /Build Decks|Deck Review|Start Match|already|complete|submitted/i.test(t) && t; }, 3000) || await this.screen();
    if ((await ui.buttons(p)).includes("Build Decks →")) {
      this.fw.find("warn", this.who, "A match that was already submitted can be opened again from the Station list", name + ": the app goes to Build Decks with no warning");
    } else {
      this.reopenBlocked = (this.reopenBlocked || 0) + 1;
      this.say("app stopped it: " + s2.replace(/\n+/g, " / ").slice(0, 120));
    }
    // Back out to the match list without scoring it again.
    for (let i = 0; i < 6 && !(await ui.buttons(p)).includes("🏟️ Station"); i++) {
      await ui.tap(p, "Back", { optional: true, timeout: 1000 });
      await ui.tap(p, /^(Yes|Leave|Discard|OK)/, { optional: true, timeout: 300 });
    }
    if (!(await ui.buttons(p)).includes("🏟️ Station")) throw new Error("Could not get back to the match list after reopening a finished match");
  }
};

// Hand the match in progress to a relief judge on a second phone (the QR link from the
// "Hand off match" menu), then carry on scoring on that phone.
const HANDOFF_FIELDS = {
  pts: "points", sets: "sets won", curSet: "current set", setScores: "earlier set scores", d1: "player 1's deck", d2: "player 2's deck",
  r1: "which combo player 1 has in play", r2: "which combo player 2 has in play", used1: "player 1's used combos", used2: "player 2's used combos",
  currentSides: "B/X sides", sideAssign: "B/X side choice", lerStrikes: "launch-error strikes", set1PriorityName: "Set 1 pick priority (~P~ tag)",
  challongeRound: "round number", challongeMatchId: "bracket match", shuf: "shuffle number",
};
RobotJudge.prototype.handOff = async function (before) {
  const p = this.page;
  const name = this.current.p1 + " vs " + this.current.p2;
  const known = new Set(Object.keys(this.fw.handoffs));
  this.say("HANDOFF: hand the match to a relief judge");
  await p.click('button[title="Settings"]', { timeout: 3000 });
  await ui.tap(p, /Hand off match/);
  await ui.tap(p, /new device|another device|other phone/i, { optional: true, timeout: 600 });
  const token = await ui.until(p, async () => Object.keys(this.fw.handoffs).find(k => !known.has(k)), 6000);
  if (!token) {
    // The app could not save the handoff (on bad wifi it shows "Network error creating handoff").
    this.fw.find(this.fw.wifiBad ? "info" : "bug", this.who, "Handoff could not be started" + (this.fw.wifiBad ? " (bad wifi)" : ""), name);
    await ui.tap(p, /^(Cancel|✕|Close)$/, { optional: true, timeout: 800 });
    this.fw.handoffDone = false;   // let a later battle try again
    return;
  }

  const old = { dev: this.dev, page: this.page };
  const relief = await this.opts.openReliefDevice(this.who);
  this.allDevs.push(relief);
  this.dev = relief; this.page = relief.page;
  this.judge = { ...this.judge, username: this.judge.username + "b", bracketName: this.judge.bracketName + " (relief)" };
  await this.page.goto(this.opts.baseUrl + "/?handoff=" + token, { waitUntil: "domcontentloaded" });
  await this.login(null, { here: true });
  const card = await ui.until(this.page, async () => (await ui.buttons(this.page)).includes("✓ Accept Match") && await this.screen(), 8000);
  if (!card) throw new Error("The handoff link did not show the Accept card on the second phone");
  if (/Not logged in — battles won't have a judge name/.test(card))
    this.fw.find("warn", this.who, "Handoff card says the receiving judge is not logged in, though they are", "relief judge logged in as " + this.judge.username + " (\"" + this.judge.bracketName + "\")");
  await this.tap("✓ Accept Match");
  const after = await ui.until(this.page, async () => { const st = await this.state(); return st && String(st.challongeMatchId) === String(before.challongeMatchId) && st; }, 6000);
  if (!after) throw new Error("Accepting the handoff did not load the match on the second phone");
  const lost = Object.keys(HANDOFF_FIELDS).filter(k => JSON.stringify(before[k] === undefined ? null : before[k]) !== JSON.stringify(after[k] === undefined ? null : after[k]));
  if (lost.length) this.fw.find("bug", this.who, "Handoff to another phone drops part of the match", name + ": lost or changed " + lost.map(k => HANDOFF_FIELDS[k] + " (" + JSON.stringify(before[k]) + " → " + JSON.stringify(after[k]) + ")").join("; "));
  const cleared = await ui.until(old.page, async () => !(await old.page.evaluate(() => sessionStorage.getItem("ncblast-match-resume-v1"))), 8000);
  if (!cleared) this.fw.find("warn", this.who, "The first phone still holds the match after handing it off", name);
  this.current.handedOff = true;
  this.handoffs = (this.handoffs || 0) + 1;
  // Can the relief judge keep scoring? If not, recover the way a judge would: Undo back to the deck order.
  const usable = async () => (await ui.buttons(this.page)).includes("Spin Finish +1") || /Set Deck Order/.test(await this.screen()) || !!(await this.page.$(".ncbdo"));
  if (!(await ui.until(this.page, usable, 3000))) {
    this.fw.find("bug", this.who, "After a handoff the score pad cannot be used (finish buttons greyed out)", name + ": the relief judge has to Undo back to the deck order to continue, losing this set's battles");
    for (let i = 0; i < 15 && !(await usable()); i++) {
      if (!(await ui.tap(this.page, "UNDO", { optional: true, timeout: 1000 }))) break;
      const prev = this.history.pop();
      if (prev) this.expSets.length = prev.expSetsLen;
      this.undos++;
      await this.page.waitForTimeout(300);
    }
    if (!(await usable())) throw new Error("Could not recover the match after the handoff");
  }
  this.say("HANDOFF done, continuing on the relief phone");
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
      if (this.fw.stuck) { this.say("stopping: another station is stuck"); break; }
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
