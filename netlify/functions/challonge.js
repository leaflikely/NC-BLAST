// Cloudflare Worker — Challonge participants proxy with server-side KV cache
//
// Setup required in Cloudflare dashboard:
//   1. Workers & Pages → KV → Create namespace named "CHALLONGE_CACHE"
//   2. challonge-proxy Worker → Settings → Bindings → Add KV Namespace
//      Variable name: CHALLONGE_CACHE  |  Namespace: the one you just created
//   3. challonge-proxy Worker → Settings → Variables and Secrets
//      Variable name: CHALLONGE_API_KEY  |  Value: your Challonge API key (encrypted)
//
// How it works:
//   - Every import checks KV first. If a cached entry exists for the slug and
//     is under 30 minutes old, it returns immediately with fromCache: true.
//   - On a cache miss, it fetches from Challonge, stores the result in KV,
//     and returns with fromCache: false.
//   - The client uses fromCache to show the correct status badge and message.

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const CACHE_TTL_S  = 60 * 60;        // 1 hour KV expiration (longer than TTL so we control staleness)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return json({ errors: ["Missing slug parameter"] }, 400);
    }

    const apiKey = env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return json({ errors: ["Server misconfiguration: missing API key"] }, 500);
    }

    // Check KV cache first
    if (env.CHALLONGE_CACHE) {
      try {
        const cached = await env.CHALLONGE_CACHE.get(slug, { type: "json" });
        if (cached && cached.participants && cached.fetchedAt) {
          const age = Date.now() - cached.fetchedAt;
          if (age < CACHE_TTL_MS) {
            // Cache hit — return immediately, no Challonge call made
            return json({
              participants: cached.participants,
              fromCache: true,
              cachedAgo: Math.floor(age / 1000),
            }, 200);
          }
        }
      } catch {
        // KV read failure is non-fatal — fall through to live fetch
      }
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

    // Write to KV — expires at 1 hour so KV auto-cleans, but our 30-min TTL
    // check above ensures stale entries are never served to clients
    if (env.CHALLONGE_CACHE) {
      try {
        await env.CHALLONGE_CACHE.put(slug, JSON.stringify({
          participants,
          fetchedAt: Date.now(),
        }), { expirationTtl: CACHE_TTL_S });
      } catch {
        // KV write failure is non-fatal
      }
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
