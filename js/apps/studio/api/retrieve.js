/**
 * /api/retrieve — نِبراس's semantic retrieval over the RAG corpus (rag.db).
 *
 * A **Node** serverless function (NOT edge): it opens a read-only sqlite (via the
 * built-in node:sqlite driver) and runs @monlite/vector's findSimilar over the
 * āyāt — and, later, tafsir/books added under their own `source`. No always-on
 * server; the .db is bundled read-only and copied to /tmp for a writable handle.
 *
 *   POST { text, source?, topK? }
 *   ->   { hits: [ { ref, text, source, distance } ] }
 *
 * The computed layers stay Quran+معاجم+QAC only; this is نِبراس's cited corpus.
 */
import fs from "node:fs";
import path from "node:path";
import { createDb } from "@monlite/core";
import { vector } from "@monlite/vector";

const MODEL = "gemini-embedding-001";
const DIM = 768;
const MAX_LEN = 800;

// ---- rag.db (opened once per warm lambda) -----------------------------------
let ragCol = null;
function rag() {
  if (ragCol) return ragCol;
  const candidates = [
    path.join(process.cwd(), "rag.db"),
    path.join(process.cwd(), "js/apps/studio/rag.db"),
    new URL("../rag.db", import.meta.url).pathname,
  ];
  const src = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (!src) throw new Error("rag.db not found");
  // Vercel's deployment FS is read-only; work from a writable /tmp copy.
  let dbPath = src;
  try {
    const tmp = "/tmp/rag.db";
    if (!fs.existsSync(tmp) || fs.statSync(tmp).size !== fs.statSync(src).size) fs.copyFileSync(src, tmp);
    dbPath = tmp;
  } catch { /* local dev: use the source path directly */ }
  const db = createDb(dbPath, {
    plugins: [vector({ rag: { field: "embedding", dimensions: DIM, distance: "cosine" } })],
  });
  ragCol = db.collection("rag");
  return ragCol;
}

// ---- embed the query (Gemini; key stays server-side) ------------------------
async function embed(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
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
  if (!res.ok) throw new Error(`embed upstream HTTP ${res.status}`);
  const { embedding } = await res.json();
  return embedding.values;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const text = String(body.text ?? "").trim();
    const source = body.source ? String(body.source) : undefined; // undefined = all sources
    const topK = Math.min(Math.max(Number(body.topK) || 8, 1), 30);
    if (!text || text.length > MAX_LEN) return res.status(400).json({ error: `text required (1..${MAX_LEN})` });

    const vec = await embed(text);
    const col = rag();
    const where = source ? { source } : undefined;
    const hits = await col.findSimilar({ vector: vec, topK, ...(where ? { where } : {}) });
    return res.status(200).json({
      hits: hits.map((h) => ({ ref: h.ref, text: h.text, source: h.source, distance: h._distance })),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
