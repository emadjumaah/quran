/**
 * export-v2-evidence.mjs — حمولة نموذج الشارتين (قرار المالك: ب):
 *   «صيغة قاعدة» = بوابات الوحدة (أسماؤها ومداها) — دليلٌ صرفي حتمي.
 *   «ثبت تفرّعه» = روابط الشبكة المحكومة بعلاقاتها الأربع + مثاني الوحدة.
 * لا رتبة كلية/جامعة/تفصيل — الدليل يُعرَض باسمه.
 * الإخراج: public/v2-evidence.json  { verses: { loc: { units:[{u,r,g,links:{rel:[locs]},twins:[locs],f}] } } }
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const RUN = join(ROOT, "findings", "kulliyat-v2", "provenance", "v2-run");
const D21 = JSON.parse(readFileSync(join(ROOT, "findings", "kulliyat-v2", "derived-v2.1.json"), "utf8"));
const raw = readFileSync(join(RUN, "judge-results-raw.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const hubs = JSON.parse(readFileSync(join(RUN, "hubs.json"), "utf8"));

// شبكة الروابط بعلاقاتها
const linksOf = new Map();
for (const b of raw)
  for (const j of b.judgments) {
    let m = linksOf.get(j.id);
    if (!m) linksOf.set(j.id, (m = {}));
    for (const l of j.links ?? []) (m[l.rel] ??= []).push(l.loc);
  }
const metaOf = new Map(D21.units.map((u) => [u.id, u]));
const rangeOf = new Map(hubs.map((h) => [h.id, h.range]));

const verses = {};
for (const u of D21.units) {
  const links = linksOf.get(u.id) ?? {};
  const nLinks = Object.values(links).reduce((n, a) => n + a.length, 0);
  // لا نشحن وحدةً بلا أي دليل (لا بوابة معروضة بلا شبكة/مثانٍ تبقى مفيدة للبوابات فقط)
  const entry = {
    u: u.unit,
    r: rangeOf.get(u.id) ?? null,
    g: u.gates,
    ...(nLinks ? { links } : {}),
    ...(u.nTwins ? { tw: u.nTwins, tws: u.twinSpread } : {}),
    ...(u.isFormula ? { f: 1 } : {}),
    ne: u.nElab, sp: u.spread,
  };
  (verses[u.loc] ??= []).push(entry);
}
const out = {
  meta: {
    model: "two-badge-evidence (ب)", date: "2026-07-14",
    gates: "صيغة قاعدة — بوابات صرفية حتمية (استعادة ٩٦٪/رفض ١٠٠٪ على الضبط)",
    network: "ثبت تفرّعه — 11,773 رابطًا بحكم أعمى (قبول 11.2%، κ=0.585)",
    versesWithUnits: Object.keys(verses).length, units: D21.units.length,
  },
  verses,
};
const path = join(ROOT, "js", "apps", "studio", "public", "v2-evidence.json");
writeFileSync(path, JSON.stringify(out));
console.log(`v2-evidence.json: ${Object.keys(verses).length} آية · ${D21.units.length} وحدة · ${(JSON.stringify(out).length / 1e6).toFixed(1)}MB`);
