// NC BLAST simulator: running robots against a REAL MatchMason event (--matchmason <link or id>).
// The bracket calls (players, open matches, results) go to the real Worker and on to MatchMason.
// Everything else (database, Sheets, overlay, combos, logins) is still answered by the fake Worker,
// so the robots never touch real stats.

const { STATIONS } = require("./fake-event.cjs");

const REAL_WORKER = "https://challonge-proxy.danny61734.workers.dev";

// "https://matchmason.com/t/5d8d5e..." or "5d8d5e..." -> "5d8d5e..."
function parseMmId(raw) {
  const t = String(raw || "").trim();
  const m = /matchmason\.com\/t\/([A-Za-z0-9_-]+)/.exec(t);
  const id = m ? m[1] : t.replace(/^mm-/, "");
  return /^[A-Za-z0-9_-]{4,80}$/.test(id) ? id : null;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, body, text: text.slice(0, 300) };
}

// Which requests go to the real Worker: only the bracket ones for this MatchMason event.
function isBracketCall(url, slug) {
  const u = new URL(url);
  if (!/^challonge-proxy\./.test(u.hostname)) return false;
  if (u.pathname.startsWith("/mm/")) return true;
  return ["/", "/pairings", "/standings", "/matches"].includes(u.pathname) && u.searchParams.get("slug") === slug;
}

// Reads the event from the real Worker. Throws an Error with a plain explanation if it can't.
async function loadMmEvent(base, id, judgesWanted) {
  const slug = "mm-" + id;
  const parts = await getJson(`${base}/?slug=${encodeURIComponent(slug)}`);
  if (!parts.ok || !parts.body) throw new Error(`The Worker could not load the MatchMason players (HTTP ${parts.status}): ${parts.body && parts.body.error || parts.text}`);
  const raw = Array.isArray(parts.body.participants) ? parts.body.participants : [];
  const players = raw.map(x => x.participant || x).filter(p => p && p.id).map((p, i) => ({
    id: p.id, gid: p.id, name: String(p.display_name || p.name || p.username || "Player " + (i + 1)), seed: p.seed || i + 1,
  }));
  if (players.length < 2) throw new Error("The MatchMason event has fewer than 2 players.");
  const open = await getJson(`${base}/mm/open-matches?slug=${encodeURIComponent(slug)}`);
  if (open.status === 404) throw new Error("The live Worker has no /mm/open-matches route yet. Deploy the MatchMason Worker update (the /mm routes and the MM_API_KEY secret) first.");
  if (!open.ok || !open.body) throw new Error(`The Worker could not load MatchMason's open matches (HTTP ${open.status}): ${open.body && open.body.error || open.text}`);
  const list = await getJson(`${base}/list`);
  const meta = list.ok && list.body && Array.isArray(list.body.tournaments) ? list.body.tournaments.find(t => t.slug === slug) : null;
  const ev = {
    slug, name: (meta && meta.name) || "MatchMason " + id.slice(0, 8), ranked: meta ? meta.ranked !== false : true, loginMode: "solo",
    players, judges: [], matches: [], round: 0, real: "mm", nextMatchId: 0,
  };
  syncOpen(ev, open.body.matches || []);
  const firstRound = ev.matches.filter(m => m.round === ev.round).length;
  const n = Math.max(1, Math.min(judgesWanted || 8, STATIONS.length, firstRound || 1));
  ev.judges = STATIONS.slice(0, n).map((st, i) => ({ username: "simjudge" + (i + 1), bracketName: "Sim Judge " + (i + 1), station: st }));
  return ev;
}

// Adds matches MatchMason has newly opened (a new round), and works out the current round.
// Returns how many new matches appeared.
function syncOpen(ev, openList) {
  let added = 0;
  const now = new Date().toISOString();
  openList.forEach(o => {
    if (!o || o.id == null || !o.player1_id || !o.player2_id) return;
    if (ev.matches.some(m => String(m.id) === String(o.id))) return;
    ev.matches.push({
      id: o.id, round: Number(o.round) || 1, state: "open", underway_at: null,
      player1_id: o.player1_id, player2_id: o.player2_id, winner_id: null, loser_id: null, scores_csv: "",
      created_at: now, updated_at: now, suggested_play_order: ev.matches.length + 1,
    });
    added++;
  });
  const openIds = new Set(openList.map(o => String(o.id)));
  ev.matches.forEach(m => { m.stillOpenOnMm = openIds.has(String(m.id)); });
  const waiting = ev.matches.filter(m => m.state !== "complete");
  ev.round = waiting.length ? Math.min(...waiting.map(m => m.round)) : Math.max(0, ...ev.matches.map(m => m.round));
  return added;
}

module.exports = { REAL_WORKER, parseMmId, loadMmEvent, syncOpen, isBracketCall, getJson };
