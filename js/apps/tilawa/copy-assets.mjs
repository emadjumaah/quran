/** أصولُ القرآن المشتركةُ إلى `public` — مصدرُها `@mishkat/quran-assets` وحدَه،
 *  وما ههنا مولَّدٌ في كلّ بناءٍ لا مُودَعٌ (ف١). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyShared } from "@mishkat/quran-assets";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "public");
fs.mkdirSync(PUB, { recursive: true });

const rows = copyShared(PUB);
const kb = (n) => (n / 1024).toFixed(0);
console.log(
  `shared assets → public/ : ${rows.map((r) => `${r.file} ${kb(r.bytes)}KB${r.copied ? " (copied)" : ""}`).join(", ")}`,
);
