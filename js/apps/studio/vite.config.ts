import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
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
