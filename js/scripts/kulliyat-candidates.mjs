/**
 * مرشَّحو الكلّيّات — مراجعةٌ مباشرةٌ بأيدينا (بلا أسراب، بلا ميزانية).
 *
 * الجردُ (findings/unified/KULLIYAT-AUDIT-2026-07-21.txt) كشف أن وسمَنا الحاليّ
 * يقيس «أكثرَ القواعد تفصيلًا في المصحف» لا «جوامعَ الكلم»: صفرُ آيةٍ من ٤١ آيةً
 * يتوقّعها الباحثُ كلّيّةً كانت كلّيّةً عندنا. والسببان محسوبان لا ظنّيّان:
 *   ١) عشرٌ منها لم تجتزْ بوّابةَ صيغةِ القاعدة أصلًا (وهي أصلُ الشبكة كلِّها).
 *   ٢) والباقياتُ اجتزنَ ودخلن، لكن صلاتِهنَّ المفحوصةَ قليلةٌ لأن مولِّدَ الأزواج
 *      بُني على الجوار الدلاليّ، فيُحابي المعاني المكرَّرةَ في المصحف.
 *
 * فهذا السكربت يحسب لكلِّ آيةٍ مؤهَّلةٍ بالبوّابة «اتساعًا محسوبًا» مستقلًّا عن
 * الفحص — من بياناتٍ عندنا سلفًا لا تكلّف نداءً واحدًا:
 *   • مدى الجوار: كم سورةً وكم وحدةَ سياقٍ تقع فيها أقربُ جاراتها معنًى.
 *   • قوّةُ الجوار: متوسّطُ درجاتِ أقربِ خمسٍ.
 *   • الصلاتُ المفحوصة (م · اتساع المحاور · السور) حيث وُجدت — دليلٌ أقوى يُعرض كما هو.
 * ثم يُخرج المرشَّحين مرتَّبين، وكلُّ سطرٍ بأدلّته، للمراجعة معًا.
 *
 * usage: node js/scripts/kulliyat-candidates.mjs [عدد المعروضين]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const TOP = Number(process.argv[2] ?? 150);

const gates = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/kulliyat-v2/gates-v1.json"), "utf8"));
const ev = JSON.parse(fs.readFileSync(path.join(PUB, "v3-evidence.json"), "utf8"));
const ranks = JSON.parse(fs.readFileSync(path.join(PUB, "ranks-v1.json"), "utf8")).ranks;
const siyaq = JSON.parse(fs.readFileSync(path.join(PUB, "siyaq-units.json"), "utf8"))
  .units.map((u, i) => ({ i, s: u[0], a1: u[1], a2: u[2], name: u[3] }));

// نصوص الآيات وأسماء السور من قاعدة المعرفة
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const AY = db.prepare("SELECT ayah_id, location, text_clean FROM ayah ORDER BY ayah_id").all();
const NAME = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));
const TEXT = new Map(AY.map((a) => [a.location, a.text_clean]));
const LOC_BY_ID = new Map(AY.map((a) => [a.ayah_id, a.location]));
const nm = (loc) => `${NAME.get(Number(loc.split(":")[0]))} ${loc.split(":")[1]}`;

// جاراتُ كل آيةٍ معنًى (محسوبةٌ سلفًا: quran-neighbors.bin)
const nb = fs.readFileSync(path.join(PUB, "quran-neighbors.bin"));
const nab = nb.buffer.slice(nb.byteOffset, nb.byteOffset + nb.byteLength);
const nhl = new DataView(nab).getUint32(0, true);
const nh = JSON.parse(new TextDecoder().decode(new Uint8Array(nab, 4, nhl)));
const NBYTES = new Uint8Array(nab, 4 + nhl);
/** [{id, score}] لأقرب k جاراتٍ لآيةٍ برقمها العام — الصيغة كما في src/similar.ts:
 *  ثلاثةُ بايتاتٍ لكلِّ جارة (رقمٌ صغيرُ الطرف ببايتين، ثم الدرجةُ مئويّةً ببايت) */
function neighborsOf(id) {
  const { k, count } = nh;
  const out = [];
  const base = (id - 1) * k * 3;
  for (let i = 0; i < k; i++) {
    const off = base + i * 3;
    const nid = NBYTES[off] | (NBYTES[off + 1] << 8);
    if (!nid) break;
    if (nid >= 1 && nid <= count) out.push({ id: nid, score: NBYTES[off + 2] / 100 });
  }
  return out;
}

const unitOf = (loc) => {
  const [s, a] = loc.split(":").map(Number);
  return siyaq.find((u) => u.s === s && u.a1 <= a && a <= u.a2) ?? null;
};

// صلاتُ الشبكة المفحوصة
const relsOf = (loc) => {
  const out = {};
  for (const u of ev.verses[loc] ?? []) for (const [rel, ls] of Object.entries(u.links ?? {})) out[rel] = [...new Set([...(out[rel] ?? []), ...ls])];
  return out;
};

const rows = [];
for (const a of AY) {
  const g = gates[a.location];
  if (!g?.qualified) continue;
  const gs = [...new Set((g.units ?? []).filter((u) => u.qualified).flatMap((u) => u.gates))];
  const nbs = neighborsOf(a.ayah_id).filter((n) => n.score >= 0.72);
  const nlocs = nbs.map((n) => LOC_BY_ID.get(n.id)).filter(Boolean);
  const suras = new Set(nlocs.map((l) => l.split(":")[0]));
  const units = new Set(nlocs.map((l) => unitOf(l)?.i).filter((x) => x != null));
  const top5 = nbs.slice(0, 5);
  const avg5 = top5.length ? top5.reduce((s, n) => s + n.score, 0) / top5.length : 0;
  const rels = relsOf(a.location);
  const all = [...new Set(Object.values(rels).flat())];
  const rk = ranks[a.location];
  rows.push({
    loc: a.location,
    text: a.text_clean,
    gates: gs,
    // الاتساعُ المحسوب: انتشارُ الجوار في السور والمقاطع، وقوّتُه
    S: suras.size, U: units.size, avg5: +avg5.toFixed(3), n: nbs.length,
    // الصلاتُ المفحوصة حيث وُجدت
    m: rk?.m ?? Object.values(rels).flat().length,
    T: rk?.T ?? 0,
    mu: rk?.mu ?? (ev.mutual?.[a.location]?.length ?? 0),
    relS: new Set(all.map((l) => l.split(":")[0])).size,
    tier: rk?.r ?? "تفصيل",
  });
}

// درجةُ الترشيح: اتساعٌ محسوبٌ (سور + مقاطع + قوّة) يعزّزه الفحصُ حيث وُجد.
// معلَنةٌ صريحةً كي تُراجَع وتُعدَّل — لا صندوقَ أسود.
for (const r of rows) {
  r.reach = r.S + r.U + 12 * r.avg5;               // الاتساعُ المحسوب
  r.examined = r.m + 2 * r.T + r.relS;             // الفحصُ حيث وُجد
  r.score = +(r.reach + 0.6 * r.examined).toFixed(2);
}
rows.sort((a, b) => b.score - a.score);

console.log(`مؤهَّلو البوّابة: ${rows.length} · المعروض: ${Math.min(TOP, rows.length)}\n`);
console.log("الرمز: سور/مقاطع = انتشارُ الجوار المحسوب · ق = قوّةُ أقربِ خمس · م/محاور = الصلاتُ المفحوصة · الوسمُ الحالي\n");
rows.slice(0, TOP).forEach((r, i) => {
  console.log(
    `${String(i + 1).padStart(3)}. ${nm(r.loc).padEnd(15)} ${String(r.score).padStart(6)} | سور${String(r.S).padStart(3)} مقاطع${String(r.U).padStart(3)} ق${r.avg5.toFixed(2)} | م${String(r.m).padStart(2)} محاور${String(r.T).padStart(2)} | ${r.tier.padEnd(6)} | ${r.gates.map((g) => g.split(":")[1]).join("،").slice(0, 34)}`,
  );
  console.log(`     ${r.text.slice(0, 96)}`);
});

fs.writeFileSync(
  path.join(ROOT, "findings/unified/KULLIYAT-CANDIDATES.json"),
  JSON.stringify({ meta: { date: "2026-07-21", note: "مرشَّحو الكلّيّات — اتساعٌ محسوبٌ من الجوار + الفحصُ حيث وُجد؛ للمراجعة المباشرة", qualified: rows.length }, rows: rows.slice(0, 400) }, null, 1),
);
console.log(`\n✓ findings/unified/KULLIYAT-CANDIDATES.json (أول ٤٠٠)`);
