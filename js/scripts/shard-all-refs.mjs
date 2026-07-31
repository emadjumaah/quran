/**
 * يشظّي كلَّ المراجع المبنيّة ويكتب **مانيفست المراجع** — وهو مصدرُ لوح
 * المراجع في صفحة الفحص (خطّة فاحص ٤٫٠): لا يُكتب باليد فلا يشيخ.
 *
 * usage: node js/scripts/shard-all-refs.mjs
 * out:   public/refs/<id>/{map.json,0.json,…}  · public/refs/manifest.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeShardedByAyah, writeShardedByRoot } from "./lib/shard-refs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "..", "apps/studio/public");
const SRC = path.join(HERE, "..", "data/refs-src"); // الخامُ غيرُ منشور
const OUT = path.join(PUB, "refs");

/** الرتبُ كما في ميثاق الفحص §ب */
const RANKS = {
  2: "معاجمُ اللغة — حجّةٌ في المعنى الوضعيّ",
  3: "معاني القرآن والإعراب — حجّةٌ في الحكم النحويّ والدلاليّ",
  4: "فقهُ اللغة وأصولُ التفسير — حجّةٌ في القاعدة لا في الجزئيّة",
};

const SOURCES = [
  { dir: "lex", kind: "root", rank: 2, group: "معاجمُ اللغة" },
  { dir: "iraab", kind: "ayah", rank: 3, group: "كتبُ الإعراب" },
  { dir: "maani", kind: "ayah", rank: 3, group: "معاني القرآن" },
];

fs.mkdirSync(OUT, { recursive: true });
const manifest = { date: "2026-07-31", ranks: RANKS, books: [] };

for (const src of SOURCES) {
  const dir = path.join(SRC, src.dir);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!j.entries) continue;
    const id = j.meta.id ?? f.replace(/\.json$/, "");
    const r = src.kind === "ayah"
      ? writeShardedByAyah(OUT, id, j.meta, j.entries)
      : writeShardedByRoot(OUT, id, j.meta, j.entries);
    manifest.books.push({
      id, label: j.meta.label, author: j.meta.author, died: j.meta.died,
      rank: src.rank, group: src.group, kind: src.kind,
      anchor: j.meta.anchor ?? null, source: j.meta.source,
      coverage: src.kind === "ayah" ? r.locs : r.roots,
      coverageOf: src.kind === "ayah" ? 6236 : 1651,
      shards: r.shards, bytes: r.bytes,
    });
    console.log(`✓ ${j.meta.label} — ${r.shards} شظيّةً · ${(r.bytes / 1024 / 1024).toFixed(1)}MB`);
  }
}

// كتبُ القواعد (أبوابٌ لا مواضع) تُذكر في المانيفست ولا تُشظّى — فهي تُقرأ بابًا
const usulIdx = path.join(PUB, "usul/index.json");
if (fs.existsSync(usulIdx)) {
  for (const b of JSON.parse(fs.readFileSync(usulIdx, "utf8")).books) {
    manifest.books.push({
      id: b.id, label: b.label, author: b.author, died: b.died, rank: 4,
      group: "فقهُ اللغة وأصولُ التفسير", kind: "section", note: b.note,
      coverage: b.sections, coverageOf: null,
      bytes: fs.statSync(path.join(PUB, `usul/${b.id}.json`)).size, shards: 1,
    });
  }
}

manifest.books.sort((a, b) => a.rank - b.rank || a.died - b.died);
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest));

const tot = manifest.books.reduce((s, b) => s + b.bytes, 0);
console.log(`\nالمانيفست: ${manifest.books.length} كتابًا · ${(tot / 1024 / 1024).toFixed(0)}MB`);
console.log("الرتب:", [2, 3, 4].map((r) => `${r}:${manifest.books.filter((b) => b.rank === r).length}`).join(" · "));
