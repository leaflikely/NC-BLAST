exports.handler = async (event) => {
  const slug = event.queryStringParameters?.slug;
  const key = "68330566a844961951645c6e25c48a7619d0f21c2d4b0f4a";
  if (!slug) return { statusCode: 400, body: "Missing slug" };
  const res = await fetch(`https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${key}`);
  const data = await res.text();
  return { statusCode: res.status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: data };
};
