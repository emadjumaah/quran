/**
 * Vercel Edge Function: /api/embed
 *
 * Turns a search query into a Gemini embedding vector, keeping the API key
 * server-side. Set GEMINI_API_KEY in the Vercel project settings.
 *
 *   POST /api/embed  { "text": "patience in hardship" }
 *   ->               { "vector": [ ...768 floats ] }
 */
import { guard } from "./_guard.js";

export const config = { runtime: "edge" };

const MODEL = "gemini-embedding-001";
const DIM = 768;
const MAX_LEN = 500;

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }
  const blocked = guard(req);
  if (blocked) return blocked;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  let text;
  try {
    text = String((await req.json()).text ?? "").trim();
  } catch {
    text = "";
  }
  if (!text || text.length > MAX_LEN) {
    return new Response(JSON.stringify({ error: `text required (1..${MAX_LEN} chars)` }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: DIM,
      }),
    },
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `upstream HTTP ${res.status}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
  const { embedding } = await res.json();
  return new Response(JSON.stringify({ vector: embedding.values }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
