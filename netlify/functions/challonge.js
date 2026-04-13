// netlify/functions/challonge.js
//
// Proxy for Challonge participants API.
//
// Caching: the Cache-Control header tells Netlify's CDN to cache each slug's
// response at the edge for 30 minutes. Subsequent imports of the same tournament
// within that window are served instantly with zero calls to Challonge.
//
// Source detection: the response wraps the participants array with a fetchedAt
// timestamp (ms since epoch). The client compares Date.now() against fetchedAt —
// if the gap exceeds 30 seconds the response came from CDN cache, otherwise live.
//
// Deploy: place this file at netlify/functions/challonge.js in your repo.
// Env var: set CHALLONGE_API_KEY in Netlify → Site configuration → Environment variables.

exports.handler = async (event) => {
  const CACHE_SECONDS = 1800; // 30 minutes

  const slug = event.queryStringParameters?.slug;
  if (!slug) {
    return {
      statusCode: 400,
      body: JSON.stringify({ errors: ["Missing slug parameter"] }),
    };
  }

  const apiKey = process.env.CHALLONGE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ errors: ["Server misconfiguration: missing API key"] }),
    };
  }

  const apiUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${apiKey}`;

  let response;
  try {
    response = await fetch(apiUrl, { signal: AbortSignal.timeout(9000) });
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ errors: [`Challonge request failed: ${err.message}`] }),
    };
  }

  const rawText = await response.text();

  if (!response.ok) {
    // Pass Challonge error status through — do NOT cache error responses.
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: rawText,
    };
  }

  // Wrap the participants array with a fetchedAt timestamp.
  // The client uses this to determine whether the CDN served a cached copy:
  //   (Date.now() - fetchedAt) > 30000  →  came from cache
  //   (Date.now() - fetchedAt) <= 30000 →  live API call
  let participants;
  try {
    participants = JSON.parse(rawText);
  } catch {
    return {
      statusCode: 502,
      body: JSON.stringify({ errors: ["Failed to parse Challonge response"] }),
    };
  }

  const body = JSON.stringify({ participants, fetchedAt: Date.now() });

  // s-maxage: CDN caches for 30 min. max-age=0: browsers do not cache locally.
  // stale-while-revalidate: CDN can serve stale for 60s while refreshing in background.
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
    },
    body,
  };
};

