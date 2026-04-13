// netlify/functions/challonge.js
//
// Proxy for Challonge participants API.
// The Cache-Control header tells Netlify's CDN to cache each slug's response
// at the edge for 30 minutes — subsequent imports of the same tournament
// within that window are served instantly with zero calls to Challonge.
//
// Deploy: place this file at netlify/functions/challonge.js
// Env var: set CHALLONGE_API_KEY in your Netlify site settings (Site → Environment variables).
// Remove the hardcoded API key from index.html once this is live.

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

  const body = await response.text();

  if (!response.ok) {
    // Pass Challonge's error status through — do NOT cache error responses.
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body,
    };
  }

  // Success — tell Netlify's CDN to cache this response at the edge.
  // s-maxage controls the CDN TTL; max-age=0 means browsers won't cache locally.
  // stale-while-revalidate gives a 60s grace window so the CDN can refresh
  // in the background without a user ever waiting on a cold refetch.
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
    },
    body,
  };
};
