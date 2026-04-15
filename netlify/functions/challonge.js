// Cloudflare Worker — Challonge participants proxy with server-side KV cache
//
// Setup required in Cloudflare dashboard:
//   1. Workers & Pages → KV → Create namespace named "CHALLONGE_CACHE"
//   2. challonge-proxy Worker → Settings → Bindings → Add KV Namespace
//      Variable name: CHALLONGE_CACHE  |  Namespace: the one you just created
//   3. challonge-proxy Worker → Settings → Variables and Secrets
//      Variable name: CHALLONGE_API_KEY  |  Value: your Challonge API key (encrypted)
//
// Routes:
//   GET /?slug=SLUG  — fetch participants for a tournament (checks KV cache first)
//   GET /list        — returns all currently cached slugs with age and participant count

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_TTL_S  = 60 * 60;        // 1 hour KV hard expiration

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── /list — return all cached slugs ──────────────────────────────────────
    if (url.pathname === "/list") {
      if (!env.CHALLONGE_CACHE) return json({ tournaments: [] }, 200);
      try {
        const list = await env.CHALLONGE_CACHE.list();
        const now = Date.now();
        const tournaments = [];
        for (const key of list.keys) {
          try {
            const entry = await env.CHALLONGE_CACHE.get(key.name, { type: "json" });
            if (!entry || !entry.fetchedAt) continue;
            const ageMs = now - entry.fetchedAt;
            if (ageMs >= CACHE_TTL_MS) continue; // expired by our TTL
            tournaments.push({
              slug: key.name,
              ageSeconds: Math.floor(ageMs / 1000),
              participantCount: Array.isArray(entry.participants) ? entry.participants.length : 0,
            });
          } catch { /* skip bad entries */ }
        }
        // Sort by most recently cached first
        tournaments.sort((a, b) => a.ageSeconds - b.ageSeconds);
        return json({ tournaments }, 200);
      } catch (err) {
        return json({ tournaments: [], error: err.message }, 200);
      }
    }

    // ── /?slug=SLUG — fetch participants ─────────────────────────────────────
    const slug = url.searchParams.get("slug");
    if (!slug) return json({ errors: ["Missing slug parameter"] }, 400);

    const apiKey = env.CHALLONGE_API_KEY;
    if (!apiKey) return json({ errors: ["Server misconfiguration: missing API key"] }, 500);

    // Check KV cache first
    if (env.CHALLONGE_CACHE) {
      try {
        const cached = await env.CHALLONGE_CACHE.get(slug, { type: "json" });
        if (cached && cached.participants && cached.fetchedAt) {
          const age = Date.now() - cached.fetchedAt;
          if (age < CACHE_TTL_MS) {
            return json({
              participants: cached.participants,
              fromCache: true,
              cachedAgo: Math.floor(age / 1000),
            }, 200);
          }
        }
      } catch { /* KV read failure — fall through to live fetch */ }
    }

    // Cache miss — fetch live from Challonge
    const challongeUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${apiKey}`;
    let response;
    try {
      response = await fetch(challongeUrl, { signal: AbortSignal.timeout(9000) });
    } catch (err) {
      return json({ errors: [`Challonge request failed: ${err.message}`] }, 502);
    }

    if (!response.ok) {
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    let participants;
    try {
      participants = await response.json();
    } catch {
      return json({ errors: ["Failed to parse Challonge response"] }, 502);
    }

    if (!Array.isArray(participants)) {
      return json({ errors: ["Unexpected Challonge response format"] }, 502);
    }

    // Write to KV
    if (env.CHALLONGE_CACHE) {
      try {
        await env.CHALLONGE_CACHE.put(slug, JSON.stringify({
          participants,
          fetchedAt: Date.now(),
        }), { expirationTtl: CACHE_TTL_S });
      } catch { /* KV write failure is non-fatal */ }
    }

    return json({ participants, fromCache: false }, 200);
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
