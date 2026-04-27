// NC BLAST — Cloudflare Worker
// Routes:
//   GET  /?slug=...                  — fetch participants (KV-cached, 1hr TTL)
//   GET  /list                       — list all cached tournaments in KV
//   POST /delete                     — delete a cached tournament from KV
//   GET  /matches?slug=...           — fetch open matches from Challonge
//   POST /submit                     — submit match result to Challonge
//   POST /overlay/push               — push match state to KV (stream overlay)
//   GET  /overlay/state?slot=N       — get current overlay state for slot N
//   GET  /overlay/poll?slot=N&etag=X — long-poll 25s for state change

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

import { Hono } from "hono";

type NcBlastEnv = {
	OVERLAY_KV: KVNamespace;
	CHALLONGE_API_KEY: string;
};

type Participant = {
	id: number;
	display_name: string;
	name: string;
	group_player_ids?: number[];
};

const app = new Hono<{ Bindings: NcBlastEnv }>();

/** List all cached tournaments */
app.get("/api/tournaments/list", async (c) => {
	try {
		const raw = await c.env.OVERLAY_KV.get("__tournament_index__", { type: "json" });
		const tournaments = Array.isArray(raw) ? raw : [];
		tournaments.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0));
		return c.json({ tournaments });
	} catch (e) {
		return c.json({ tournaments: [] });
	}
});

/** Gets participants for a specific tournament */
app.get("/api/tournaments/:slug/participants", async (c) => {
	const slug = c.req.param("slug");
	if (!slug) return err("Missing slug");
	const cacheKey = `tournament:${slug}`;
	try {
		const cached = await c.env.OVERLAY_KV.get(cacheKey, { type: "json" });
		if (cached) return json({ participants: cached, fromCache: true });
	} catch (_) { }
	try {
		const apiKey = c.env.CHALLONGE_API_KEY;
		const res = await fetch(
			`https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${apiKey}`
		);
		if (!res.ok) {
			const text = await res.text();
			try { return json(JSON.parse(text), res.status); } catch { return err(`HTTP ${res.status}`, res.status); }
		}
		const participants: Participant[] = await res.json();
		await c.env.OVERLAY_KV.put(cacheKey, JSON.stringify(participants), { expirationTtl: 3600 });
		let index = [];
		try { const raw = await c.env.OVERLAY_KV.get("__tournament_index__", { type: "json" }); if (Array.isArray(raw)) index = raw; } catch (_) { }
		index = index.filter(t => t.slug !== slug);
		index.push({ slug, fetchedAt: Date.now(), count: participants.length });
		await c.env.OVERLAY_KV.put("__tournament_index__", JSON.stringify(index), { expirationTtl: 86400 });
		return json({ participants, fromCache: false });
	} catch (e: unknown) {
		return err("Challonge fetch failed: " + (e as Error).message, 502);
	}
});

app.post("/api/tournaments/:slug/delete", async (c) => {
	try {
		const slug = c.req.param("slug");
		if (!slug) return err("Missing slug");
		await c.env.OVERLAY_KV.delete(`tournament:${slug}`);
		let index = [];
		try { const raw = await c.env.OVERLAY_KV.get("__tournament_index__", { type: "json" }); if (Array.isArray(raw)) index = raw; } catch (_) { }
		index = index.filter(t => t.slug !== slug);
		await c.env.OVERLAY_KV.put("__tournament_index__", JSON.stringify(index), { expirationTtl: 86400 });
		return json({ ok: true, slug });
	} catch (e: unknown) {
		return err("Delete failed: " + (e as Error).message, 500);
	}
});

app.get("/api/tournaments/:slug/matches", async (c) => {
	const slug = c.req.param("slug");
	if (!slug) return err("Missing slug");
	try {
		const apiKey = c.env.CHALLONGE_API_KEY;

		// Fetch matches and participants in parallel
		const [matchRes, partRes] = await Promise.all([
			fetch(`https://api.challonge.com/v1/tournaments/${slug}/matches.json?api_key=${apiKey}&state=open`),
			// Try KV cache first for participants, fall back to live fetch
			(async () => {
				try {
					const cached = await c.env.OVERLAY_KV.get(`tournament:${slug}`, { type: "json" });
					if (cached) return { json: () => Promise.resolve(cached), ok: true, _fromCache: true };
				} catch (_) { }
				return fetch(`https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${apiKey}`);
			})(),
		]);

		if (!matchRes.ok) return err(`Challonge matches error: HTTP ${matchRes.status}`, matchRes.status);

		const matchData = await matchRes.json();
		const rawMatches = Array.isArray(matchData) ? matchData : [];

		// Build id -> name map from participants
		const idToName: { [key: string]: string } = {};
		try {
			const partData = await partRes.json();
			const participants: Participant[] = Array.isArray(partData) ? partData : [];
			participants.forEach(participant => {
				const id = participant.id;
				const name = participant.display_name || participant.name || "";
				if (id && name) {
					idToName[String(id)] = name;
					// Also map group_player_ids so group-stage matches resolve correctly
					if (Array.isArray(participant.group_player_ids)) {
						participant.group_player_ids.forEach(gid => {
							if (gid) idToName[String(gid)] = name;
						});
					}
				}
			});
		} catch (_) { }

		// Attach player names to each match
		const matches = rawMatches.map(m => {
			const match = m.match || m;
			const p1id = String(match.player1_id || "");
			const p2id = String(match.player2_id || "");
			return {
				...match,
				player1_name: match.player1_name || idToName[p1id] || "",
				player2_name: match.player2_name || idToName[p2id] || "",
			};
		});

		return json({ matches });
	} catch (e: unknown) {
		return err("Challonge fetch failed: " + (e as Error).message, 502);
	}
});

app.post("/api/tournaments/:slug/match/:matchId/submit", async (c) => {
	try {
		const slug = c.req.param("slug");
		const matchId = c.req.param("matchId");
		const body: { [key: string]: any } = await c.req.json();
		const scores_csv = body["scores_csv"];
		const winner_id = body["winner_id"];
		if (!slug || !matchId || !scores_csv || !winner_id) return err("Missing fields");
		const apiKey = c.env.CHALLONGE_API_KEY;
		const res = await fetch(
			`https://api.challonge.com/v1/tournaments/${slug}/matches/${matchId}.json`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ api_key: apiKey, match: { scores_csv, winner_id } }),
			}
		);
		const data = await res.json();
		if (!res.ok) return json(data, res.status);
		return json(data);
	} catch (e: unknown) {
		return err("Submit failed: " + (e as Error).message, 502);
	}
});

app.post("/api/overlay/push", async (c) => {
	try {
		const body: { [key: string]: number | any } = await c.req.json();
		const slot: number = body["slot"];
		const state = body["state"];
		if (!slot || slot < 1 || slot > 4) return err("slot must be 1-4");
		if (!state) return err("Missing state");
		const etag = Date.now().toString(36);
		await c.env.OVERLAY_KV.put(`slot:${slot}`, JSON.stringify({ state, etag }), { expirationTtl: 3600 });
		return json({ ok: true, slot, etag });
	} catch (e: unknown) {
		return err("Push failed: " + (e as Error).message, 500);
	}
});

app.get("/api/overlay/slot/:slotNumber/state", async (c) => {
	const slot = parseInt(c.req.param("slotNumber"));
	if (!slot || slot < 1 || slot > 4) return err("slot must be 1-4");
	try {
		const raw = await c.env.OVERLAY_KV.get(`slot:${slot}`);
		if (!raw) return json({ state: null, etag: null });
		return json(JSON.parse(raw));
	} catch (e: unknown) {
		return err("State fetch failed: " + (e as Error).message, 500);
	}
});

app.get("/api/overlay/slot/:slotNumber/poll/:etag", async (c) => {
	const slot = parseInt(c.req.param("slotNumber"));
	const lastEtag = c.req.param("etag");
	if (!slot || slot < 1 || slot > 4) return err("slot must be 1-4");
	const deadline = Date.now() + 25000;
	while (Date.now() < deadline) {
		try {
			const raw = await c.env.OVERLAY_KV.get(`slot:${slot}`);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed.etag !== lastEtag) return json(parsed);
			}
		} catch (e: unknown) {
			return err("Poll error: " + (e as Error).message, 500);
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	try {
		const raw = await c.env.OVERLAY_KV.get(`slot:${slot}`);
		return json(raw ? JSON.parse(raw) : { state: null, etag: lastEtag });
	} catch (e: unknown) {
		return json({ state: null, etag: lastEtag });
	}
});

app.get("/api/player/:player/combos/get", async (c) => {
	const player = c.req.param("player");
	if (!player) return err("Missing player");
	try {
		const raw = await c.env.OVERLAY_KV.get(`combos:${player}`);
		if (!raw) return json({ combos: [], updatedAt: null });
		return json(JSON.parse(raw));
	} catch (e: unknown) {
		return json({ combos: [], updatedAt: null });
	}
});

app.post("/api/player/:player/combos/push", async (c) => {
	try {
		const body = await c.req.parseBody();
		const { player, combos, updatedAt } = body;
		if (!player || !Array.isArray(combos)) return err("Missing player or combos");
		await c.env.OVERLAY_KV.put(
			`combos:${player}`,
			JSON.stringify({ combos, updatedAt: updatedAt || Date.now() }),
			{ expirationTtl: 3600 }
		);
		return json({ ok: true });
	} catch (e: unknown) {
		return err("Combo push failed: " + (e as Error).message, 500);
	}
});

function json(data: any, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS, "Content-Type": "application/json" },
	});
}

function err(msg: string, status = 400) {
	return json({ error: msg }, status);
}

export default app;