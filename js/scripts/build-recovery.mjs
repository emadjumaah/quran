/**
 * بناء دفعات سرب استرداد التوكيد المتوازي (قرار المالك: الخيار ب، بوابة ت١):
 * كل زوجٍ ثبت في v2 ولم يؤكده فاحص السياق في ت١–ت٣ يُفحص فحصًا متماثلًا واحدًا
 * («أهما تقريران مستقلان لمضمون واحد؟») — ما ثبت انضم توكيدًا متبادلًا للطبقة
 * المتماثلة لا الموجهة. بلا نوافذ (قرار بوابة الموجة ١: السياق لا يؤثر في
 * السؤال المتماثل). دفعات ×٤٠ + ٥٪ كابا.
 *
 * Writes: findings/deepening/recovery/{rec-*.json, recovery-manifest.json}
 * Usage: node scripts/build-recovery.mjs   (يتطلب اكتمال results-t1/t2/t3)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const RJ = path.join(ROOT, "findings/deepening/rejudge");
const OUT = path.join(ROOT, "findings/deepening/recovery");
fs.mkdirSync(OUT, { recursive: true });

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const txt = new Map(db.prepare("SELECT surah_no s, ayah_no a, text_clean t FROM ayah").all().map((r) => [`${r.s}:${r.a}`, r.t]));
db.close();

// أحكام v2 المؤرشفة
const v2map = new Map();
for (const l of fs.readFileSync(path.join(ROOT, "findings/kulliyat-v2/provenance/v2-run/judge-results-raw.jsonl"), "utf-8").split("\n").filter(Boolean)) {
  let r; try { r = JSON.parse(l); } catch { continue; }
  if (r.run && r.run !== 1) continue;
  for (const j of r.judgments ?? []) if (!v2map.has(j.id)) v2map.set(j.id, new Map((j.links ?? []).map((x) => [x.loc, x.rel])));
}

// أحكام التوحيد ت١–ت٣ (الفحص الأول فقط)
const now = new Map(); // id -> Map(loc -> rel|null مفحوص)
const judgedPairs = new Map(); // id -> Set(loc) كل ما فحصه التوحيد
for (const f of ["results-t1.jsonl", "results-t2.jsonl", "results-t3.jsonl"]) {
  for (const l of fs.readFileSync(path.join(RJ, f), "utf-8").split("\n").filter(Boolean)) {
    const r = JSON.parse(l);
    if (r.run !== 1) continue;
    const batch = JSON.parse(fs.readFileSync(path.join(RJ, `${r.file}.json`), "utf-8"));
    const byId = new Map(batch.map((p) => [p.id, p]));
    for (const j of r.judgments) {
      const p = byId.get(j.id); if (!p) continue;
      if (!now.has(j.id)) { now.set(j.id, new Map()); judgedPairs.set(j.id, new Set()); }
      const links = new Map((j.links ?? []).map((x) => [x.loc, x.rel]));
      for (const c of p.candidates) {
        judgedPairs.get(j.id).add(c.loc);
        if (links.has(c.loc)) now.get(j.id).set(c.loc, links.get(c.loc));
      }
    }
  }
}

// الفاقد: v2 أثبت والتوحيد لم يؤكد
const lost = [];
const seen = new Set();
for (const [id, oldLinks] of v2map) {
  const jp = judgedPairs.get(id);
  if (!jp) continue;
  for (const [loc, rel] of oldLinks) {
    if (!jp.has(loc)) continue;
    if (now.get(id)?.has(loc)) continue;
    const hubLoc = id.split("/")[0];
    const key = `${hubLoc}|${loc}`;
    if (seen.has(key) || hubLoc === loc) continue;
    seen.add(key);
    lost.push({ id, a: hubLoc, b: loc, v2rel: rel });
  }
}
console.log(`أزواج الفاقد للاسترداد: ${lost.length}`);

// دفعات ×٤٠
const batches = [];
for (let i = 0; i < lost.length; i += 40) batches.push(lost.slice(i, i + 40));
batches.forEach((batch, bi) => {
  const out = batch.map((p) => ({ a: { loc: p.a, text: txt.get(p.a) }, b: { loc: p.b, text: txt.get(p.b) } }));
  fs.writeFileSync(path.join(OUT, `rec-${String(bi).padStart(3, "0")}.json`), JSON.stringify(out, null, 1));
});
const files = batches.map((_, bi) => `rec-${String(bi).padStart(3, "0")}`);
const kn = Math.ceil(files.length * 0.05);
const kappa = [...Array(kn).keys()].map((k) => files[Math.floor((k * files.length) / kn)]);
const manifest = { date: "2026-07-18", pairs: lost.length, batches: files.length, kappa, lostSource: "v2-accepted not confirmed by t1..t3 arm-A", files };
fs.writeFileSync(path.join(OUT, "recovery-manifest.json"), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT, "lost-pairs.jsonl"), lost.map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(`دفعات: ${files.length} + ${kn}κ = ${files.length + kn} فاحصًا`);
