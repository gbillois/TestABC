// Cloudflare Pages Function — /api/scores
// Méthodes supportées : GET (top 10) et POST (enregistrer un score)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;

  // Preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method === "GET") {
    return handleGet(env);
  }

  if (request.method === "POST") {
    return handlePost(request, env);
  }

  return new Response("Méthode non supportée", { status: 405 });
}

async function handleGet(env) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT name, score, created_at FROM scores ORDER BY score DESC LIMIT 10"
    ).all();

    return Response.json(results, { headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}

async function handlePost(request, env) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim().slice(0, 30);
    const score = parseInt(body.score, 10);

    if (!name || isNaN(score) || score < 0) {
      return Response.json({ error: "Données invalides" }, { status: 400, headers: CORS_HEADERS });
    }

    await env.DB.prepare(
      "INSERT INTO scores (name, score) VALUES (?, ?)"
    ).bind(name, score).run();

    return Response.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}
