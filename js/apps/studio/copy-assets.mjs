/** Copy the app database into public/ for Vite (the FTS5 sql.js wasm is
 *  bundled by Vite itself via the ?url import in main.ts). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "public");
fs.mkdirSync(PUB, { recursive: true });

const db = path.resolve(HERE, "../../../quran-app.db");
if (!fs.existsSync(db)) {
  console.error("quran-app.db not found — run: node ../../scripts/convert-to-app-db.mjs");
  process.exit(1);
}
fs.copyFileSync(db, path.join(PUB, "quran-app.db"));
console.log("assets copied to public/");
