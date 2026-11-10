// NC BLAST simulator: the fake event.
// Builds a made-up Swiss tournament (32 players, 8 stations A-H, 8 judges) in the same
// shape Challonge sends it through the real Worker. Nothing here touches the internet.
//
// Swiss on Challonge is a "group stage", so every player has a normal id AND a group id
// (group_player_ids), and match player ids are the GROUP ids. That is how real events look,
// and it is a known trouble spot for name lookups, so the fake copies it on purpose.

// Name traps are mixed into the first 12 so even small events get them:
// a name that is the start of another ("Alex" / "Alex K."), a trailing space, an emoji,
// accents and apostrophes, and a very long name. "Hana Sato" is renamed in the bracket
// after round 1 (see renameAfterRound1).
const PLAYER_NAMES = [
  "Ace Ramirez", "Bree Tanaka", "Alex", "Dani Okafor", "Alex K.", "Zoë Laurent",
  "Milo Grant ", "Hana Sato", "D'Angelo Brooks", "🔥Blaze", "José Álvarez", "Christopher Montgomery-Wellington III",
  "Cole Whitfield", "Eli Novak", "Faye Lindqvist", "Gus Moreno", "Ivan Petrov", "Jade Collins",
  "Kai Mendoza", "Lena Fischer", "Nia Adeyemi", "Owen Park", "Pia Rossi", "Quinn Harper",
  "Rafa Delgado", "Sage Bennett", "Theo Nakamura", "Uma Patel", "Vic Herrera", "Wes Dalton",
  "Mai Nguyen", "Finn O'Neil",
];
const RENAME = { from: "Hana Sato", to: "Hana Sato-Kim" };

const STATIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function makeEvent(opts = {}) {
  const slug = opts.slug || "ncbl-simswiss32";
  const name = opts.name || "SIM Swiss 32 (fake event)";
  const players = PLAYER_NAMES.slice(0, opts.players || 32).map((n, i) => ({
    id: 1001 + i,
    gid: 2001 + i,
    name: n,
    seed: i + 1,
  }));
  const judges = STATIONS.slice(0, opts.judges || 8).map((st, i) => ({
    username: "simjudge" + (i + 1),
    bracketName: "Sim Judge " + (i + 1),
    station: st,
  }));
  const ev = {
    slug,
    name,
    ranked: opts.ranked !== false,
    loginMode: "solo",
    players,
    judges,
    matches: [], // Challonge-shaped match records
    round: 0,
    nextMatchId: 5001,
  };
  addSwissRound(ev);
  return ev;
}

// Challonge participant record (what GET /?slug= returns inside { participants })
function participantRecord(p) {
  return {
    participant: {
      id: p.id,
      name: p.name,
      display_name: p.name,
      username: null,
      seed: p.seed,
      group_player_ids: [p.gid],
      active: true,
      final_rank: null,
    },
  };
}

// Win/loss record from finished matches (keyed by player id)
function records(ev) {
  const rec = {};
  ev.players.forEach(p => { rec[p.id] = { w: 0, l: 0, diff: 0, opp: new Set() }; });
  const byGid = {};
  ev.players.forEach(p => { byGid[p.gid] = p.id; });
  ev.matches.forEach(m => {
    const a = byGid[m.player1_id], b = byGid[m.player2_id];
    if (a && b) { rec[a].opp.add(b); rec[b].opp.add(a); }
    if (m.state !== "complete" || !m.winner_id) return;
    const w = byGid[m.winner_id], l = w === a ? b : a;
    rec[w].w++; rec[l].l++;
  });
  return rec;
}

// Pair the next Swiss round: sort by wins, pair neighbours who have not met yet.
function addSwissRound(ev) {
  ev.round++;
  const rec = records(ev);
  const order = ev.players.slice().sort((x, y) => (rec[y.id].w - rec[x.id].w) || (x.seed - y.seed));
  const left = order.slice();
  const pairs = [];
  while (left.length > 1) {
    const a = left.shift();
    let j = left.findIndex(b => !rec[a.id].opp.has(b.id));
    if (j < 0) j = 0;
    const b = left.splice(j, 1)[0];
    pairs.push([a, b]);
  }
  const now = new Date().toISOString();
  pairs.forEach(([a, b]) => {
    ev.matches.push({
      id: ev.nextMatchId++,
      round: ev.round,
      state: "open",
      underway_at: null,
      player1_id: a.gid,
      player2_id: b.gid,
      winner_id: null,
      loser_id: null,
      scores_csv: "",
      identifier: "",
      created_at: now,
      updated_at: now,
      group_id: 9001,
      suggested_play_order: ev.matches.length + 1,
    });
  });
  return pairs.length;
}

function roundComplete(ev) {
  return ev.matches.filter(m => m.round === ev.round).every(m => m.state === "complete");
}

// A player fixes their name in the bracket between rounds (it happens). Returns what changed.
function renameAfterRound1(ev) {
  const p = ev.players.find(x => x.name === RENAME.from);
  if (!p) return null;
  p.oldNames = [p.name];
  p.name = RENAME.to;
  return { id: p.id, from: RENAME.from, to: RENAME.to };
}

module.exports = { renameAfterRound1, makeEvent, participantRecord, addSwissRound, roundComplete, records, STATIONS };
