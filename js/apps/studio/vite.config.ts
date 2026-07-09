import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import fs from "node:fs";

/**
 * Dev-only /api/embed — mirrors api/embed.js (the Vercel Edge function) so
 * Meaning search works locally with zero setup. Reads GEMINI_API_KEY from the
 * repo root .env; the key never leaves the dev server process.
 */
function devEmbedApi(): Plugin {
  const MODEL = "gemini-embedding-001";
  const DIM = 768;
  const envKey = (): string | undefined => {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
      const env = fs.readFileSync(resolve(__dirname, "../../../.env"), "utf-8");
      return env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
    } catch {
      return undefined;
    }
  };
  return {
    name: "dev-embed-api",
    configureServer(server) {
      server.middlewares.use("/api/embed", (req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          const send = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(body));
          };
          if (req.method !== "POST") return send(405, { error: "POST only" });
          const key = envKey();
          if (!key) return send(500, { error: "GEMINI_API_KEY not found in .env" });
          let text = "";
          try {
            text = String(JSON.parse(Buffer.concat(chunks).toString()).text ?? "").trim();
          } catch {
            /* fall through */
          }
          if (!text || text.length > 500) return send(400, { error: "text required" });
          try {
            const r = await fetch(
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
            if (!r.ok) return send(502, { error: `upstream HTTP ${r.status}` });
            const { embedding } = (await r.json()) as { embedding: { values: number[] } };
            send(200, { vector: embedding.values });
          } catch (e) {
            send(502, { error: (e as Error).message });
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devEmbedApi()],
  resolve: {
    alias: {
      // Polyfill Node built-ins so @monlite/core (built for Node) runs in the
      // browser — same approach as monlite's own demo app.
      "node:module": resolve(__dirname, "./src/mocks/node-module.js"),
      module: resolve(__dirname, "./src/mocks/node-module.js"),
      "node:crypto": resolve(__dirname, "./src/mocks/crypto.js"),
      crypto: resolve(__dirname, "./src/mocks/crypto.js"),
      "node:buffer": "buffer",
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    // fts5-sql-bundle is CJS — it MUST be pre-bundled (esbuild adds the
    // default-export interop); excluding it breaks `import initSqlJs` in dev.
    include: [
      "fts5-sql-bundle/dist/sql-wasm.js",
      "@monlite/core",
      "@monlite/wasm",
      "@monlite/fts",
      "buffer",
      "react",
      "react-dom",
    ],
  },
  build: {
    target: "es2022",
    commonjsOptions: { transformMixedEsModules: true },
  },
  server: {
    fs: { allow: ["../.."] },
  },
});
