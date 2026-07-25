/**
 * بطاقات البيان إلى العرض — يجمع public/bayan.json من:
 *   data/bayan-cards.json          (الوصف اليدوي: العنوان، سطر الكشف، القراءات المنسوبة)
 *   ../findings/bayan/maps/<id>.json (الخرائط المحسوبة الحتمية — usage_map.py)
 * فكل بطاقة تصل القارئ بطبقتيها: محسوبٌ يوصف، ومنقولٌ يُنسب — «نحسب ونعرض».
 *
 * usage: node js/scripts/build-bayan-cards.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const META = JSON.parse(fs.readFileSync(path.join(ROOT, "data/bayan-cards.json"), "utf-8"));
const MAPS = path.resolve(ROOT, "../findings/bayan/maps");
const PUB = path.join(ROOT, "apps/studio/public");

// جذور كل بطاقة محرَّرة — مشتقّة من لمّاتها بمطابقة قاعدة الصرف (findings/bayan/maps/card-roots.json)
const CARD_ROOTS = (() => {
  const p = path.join(MAPS, "card-roots.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
})();

const out = { types: META.types, cards: [] };
for (const c of META.cards) {
  const m = JSON.parse(fs.readFileSync(path.join(MAPS, `${c.id}.json`), "utf-8"));
  const sides = [];
  for (const [name, s] of Object.entries(m.sides)) {
    const a = s.aggregates;
    sides.push({
      name,
      total: a.total,
      makki: a.by_revelation["مكية"] ?? 0,
      madani: a.by_revelation["مدنية"] ?? 0,
      aspects: a.by_aspect ?? {},
      colloc: (s.collocations_top ?? []).slice(0, 8),
      occ: s.occurrences.map((o) => ({
        loc: o.loc.split(":").slice(0, 2).join(":"),
        form: o.form,
        unit: o.unit,
        txt: o.ayah.length > 92 ? o.ayah.slice(0, 92) + "…" : o.ayah,
      })),
    });
  }
  const contrast = m.contrast
    ? Object.fromEntries(Object.entries(m.contrast).map(([k, v]) => [k.replace(/^only_/, ""), v.slice(0, 8)]))
    : null;
  out.cards.push({ id: c.id, title: c.title, type: c.type, kashf: c.kashf, roots: CARD_ROOTS[c.id] ?? [], readings: c.readings, sides, contrast });
}

const dest = path.join(PUB, "bayan.json");
fs.writeFileSync(dest, JSON.stringify(out), "utf-8");
console.log(`✓ bayan.json: ${out.cards.length} بطاقة · ${(fs.statSync(dest).size / 1024).toFixed(0)} ك.ب`);

// ——— مكتبة البيان: كتب البيان المهيكلة — ملفٌ لكل كتاب (يُجلب عند طلبه)
// ثلاث عائلات بثلاثة أبواب دخول: المداخل بالحرف، والمتشابه بالسورة، والأنواع بالباب.
const LIB_BOOKS = [
  { id: "furuqaskari", file: "bayan-furuq", mode: "term", label: "الفروق اللغوية — أبو هلال العسكري" },
  { id: "basair", file: "bayan-basair", mode: "term", label: "بصائر ذوي التمييز — الفيروزآبادي" },
  { id: "wujuhaskari", file: "bayan-wujuh-askari", mode: "term", label: "الوجوه والنظائر — أبو هلال العسكري" },
  { id: "nuzha", file: "bayan-nuzha", mode: "term", label: "نزهة الأعين النواظر — ابن الجوزي" },
  { id: "damghani", file: "bayan-damghani", mode: "term", label: "قاموس القرآن — الدامغاني" },
  { id: "durra", file: "bayan-durra", mode: "aya", label: "درة التنزيل وغرة التأويل — الخطيب الإسكافي" },
  { id: "malak", file: "bayan-malak", mode: "aya", label: "ملاك التأويل — ابن الزبير الغرناطي" },
  { id: "burhan", file: "bayan-burhan", mode: "naw", label: "البرهان في علوم القرآن — الزركشي" },
  { id: "itqan", file: "bayan-itqan", mode: "naw", label: "الإتقان في علوم القرآن — السيوطي" },
];
const clean = (s) => (s ?? "").replace(/ms\d{3,}/g, " ").replace(/PageV\d+P\d+/g, " ")
  .replace(/[$#*^~]+/g, " ").replace(/\s+/g, " ").trim();
const libIndex = [];
const libHits = [];             // دليل رؤوس المكتبة كلها (بلا نصوص) — بحثٌ فوريٌّ خفيف
const tariqRoots = new Map();   // جذر → {كتاب: عدد}
const tariqAyas = new Map();    // آية → [[كتاب, معرّف المدخل]]

for (const b of LIB_BOOKS) {
  const src = path.resolve(ROOT, `data/bayan-sources/structured/${b.file}.jsonl`);
  const entries = [];
  let curSura = "";
  for (const line of fs.readFileSync(src, "utf-8").split("\n").filter(Boolean)) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (["front-matter", "defective", "sura-basira"].includes(e.kind)) continue;
    const text = clean(e.text);
    // الفصول في كتب الأنواع طوالٌ — فما دون ذلك بقايا فهرسٍ لا فصلٌ قائم
    if (text.length < (b.mode === "naw" ? 400 : 40)) continue;
    // رأسٌ بلا حروفٍ عربية (نقطٌ أو أرقام من رقمنة المصدر) — يُستبدل بمطلع نصه
    let head = clean(e.anchor?.term);
    if (!/[ء-ي]{2}/.test(head)) head = text.slice(0, 60).replace(/\s+\S*$/, "") + "…";
    if (!head) continue;
    const roots = e.anchor?.root ?? [];
    const aya = (e.anchor?.aya ?? []).slice(0, 24);
    const row = { id: e.id, head, roots, text };
    if (b.mode !== "term") {
      if (aya.length) row.aya = aya;
      // السورة: من الموضع إن صرّح بها، وإلا فمن آخر سورةٍ صُرّح بها (كتب المتشابه تسير على ترتيب المصحف)
      const locSura = clean(/^سورة [^—]+/.exec(e.source?.locus ?? "")?.[0]);
      if (b.mode === "aya") {
        if (locSura) curSura = locSura;
        row.sura = curSura || "مقدمة";
        // الرأس داخل تصفُّح السورة لا يعيد اسمها
        row.head = row.head.replace(/^سورة [^—]+—\s*/, "").trim() || row.head;
      }
    }
    entries.push(row);
    libHits.push({ b: b.id, i: e.id, h: head.length > 90 ? head.slice(0, 90) + "…" : head, r: roots });
    for (const r of roots) {
      if (!tariqRoots.has(r)) tariqRoots.set(r, {});
      const m = tariqRoots.get(r);
      m[b.id] = (m[b.id] ?? 0) + 1;
    }
    for (const a of aya) {
      if (!tariqAyas.has(a)) tariqAyas.set(a, []);
      const l = tariqAyas.get(a);
      if (l.length < 8) l.push([b.id, e.id]);
    }
  }
  const dest = path.join(PUB, `bayan-lib-${b.id}.json`);
  fs.writeFileSync(dest, JSON.stringify({ id: b.id, label: b.label, mode: b.mode, entries }), "utf-8");
  const groups = b.mode === "aya" ? new Set(entries.map((x) => x.sura)).size : 0;
  libIndex.push({ id: b.id, label: b.label, mode: b.mode, count: entries.length, groups });
  console.log(`✓ bayan-lib-${b.id}.json: ${entries.length} مدخلًا (${b.mode}) · ${(fs.statSync(dest).size / 1024).toFixed(0)} ك.ب`);
}
fs.writeFileSync(path.join(PUB, "bayan-lib.json"), JSON.stringify({ books: libIndex, hits: libHits }), "utf-8");
console.log(`✓ bayan-lib.json (الفهرس + دليل الرؤوس): ${libIndex.length} كتب · ${libHits.length} مدخلًا · ${(fs.statSync(path.join(PUB, "bayan-lib.json")).size / 1024).toFixed(0)} ك.ب`);

// ——— فهرس المطروق: أين طَرَق العلماءُ هذا الجذرَ/هذا الموضعَ في متوننا المفهرسة
// (منهجية البيان §٦: هذا الفهرسُ نصفُ آلية «جبهة غير المطروق» — والنصف الآخر إشاراتُنا المحسوبة)
const tariq = {
  roots: Object.fromEntries([...tariqRoots.entries()]
    .map(([r, m]) => [r, Object.entries(m).sort((a, c) => c[1] - a[1])])),
  ayas: Object.fromEntries(tariqAyas),
};
const tDest = path.join(PUB, "bayan-tariq.json");
fs.writeFileSync(tDest, JSON.stringify(tariq), "utf-8");
console.log(`✓ bayan-tariq.json (فهرس المطروق): ${Object.keys(tariq.roots).length} جذرًا · ${Object.keys(tariq.ayas).length} موضعًا · ${(fs.statSync(tDest).size / 1024).toFixed(0)} ك.ب`);
