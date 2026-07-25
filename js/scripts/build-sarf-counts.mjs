/**
 * العدُّ الدقيق — تفصيلُ مواضع كلِّ جذرٍ بالصيغة (2026-07-21، سؤال المالك:
 * «كيف أعرف ورودَ الكلمة بصيغةٍ بعينها: مفردًا أو مثنًّى أو جمعًا؟»).
 *
 * الوسمُ الصرفيُّ (QAC) يحمل لكلِّ مقطعٍ عددَه ونوعَه وتعريفَه وإعرابَه واشتقاقَه،
 * وللأفعال زمنَها وبناءَها وضميرَها — لكنّ قاعدةَ التطبيق لا تشحن هذه الحقول.
 * فيُخرَج هنا سِفرٌ جانبيٌّ خفيف: لكلِّ جذرٍ صفوفُه (لَـمّة × صيغة) بعددها
 * ومواضعها، فتُعرض في صفحة الجذر ويُبنى عليها عدٌّ لا يلتبس فيه:
 *   • عدُّ الجذر (المادّة كلُّها) · عدُّ اللَّـمّة (الصيغة المعجميّة) ·
 *   • عدُّ الرسم (صورةُ الكلمة كما تُكتب) — ثلاثةُ أعدادٍ مختلفةٍ لسؤالٍ واحد.
 *
 * usage: node js/scripts/build-sarf-counts.mjs
 * out:   public/sarf-counts.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });

const NUM = { S: "مفرد", D: "مثنّى", P: "جمع" };
const ASPECT = { PERF: "ماضٍ", IMPF: "مضارع", IMPV: "أمر" };
const DERIV = {
  ACT_PCPL: "اسم فاعل", PASS_PCPL: "اسم مفعول", VN: "مصدر", ADJ: "صفة مشبّهة",
  NOUN: "اسم", LOC: "اسم مكان/زمان", INTENS: "مبالغة",
};
const norm = (t) => (t || "").normalize("NFC").replace(/[ً-ٰٟـ]/g, "").replace(/ٱ/g, "ا");

const rows = db.prepare(`
  SELECT rt.root_ar AS root, l.lemma_ar AS lemma, a.location AS loc, s.text AS text,
         s.pos_basic AS pos, s.number AS num, s.state AS state, s.gender AS gen,
         s.aspect AS aspect, s.voice AS voice, s.derivation AS deriv, s.verb_form AS vform
  FROM segment s
  JOIN root rt ON rt.root_id = s.root_id
  JOIN ayah a ON a.ayah_id = s.ayah_id
  LEFT JOIN lemma l ON l.lemma_id = s.lemma_id
  WHERE s.root_id IS NOT NULL AND s.role = 'stem'
  ORDER BY rt.root_ar, s.seg_id`).all();

/** وصفُ الصيغة كما يُعرض للقارئ — مبنيٌّ من حقول الوسم لا من ظنّ */
function formOf(r) {
  if (r.pos === "V") {
    const parts = [ASPECT[r.aspect] ?? "فعل"];
    if (r.voice === "PASS") parts.push("مبنيٌّ للمجهول");
    if (r.vform && r.vform !== "I") parts.push(`الوزن ${r.vform}`);
    return parts.join(" · ");
  }
  const parts = [];
  if (r.deriv && DERIV[r.deriv]) parts.push(DERIV[r.deriv]);
  parts.push(NUM[r.num] ?? "مفرد");
  if (r.gen === "F") parts.push("مؤنّث");
  if (r.state === "DEF") parts.push("معرفة");
  else if (r.state === "INDEF") parts.push("نكرة");
  return parts.join(" · ");
}

const byRoot = new Map();
for (const r of rows) {
  const root = r.root;
  let entry = byRoot.get(root);
  if (!entry) byRoot.set(root, (entry = { total: 0, forms: new Map(), rasm: new Map() }));
  entry.total++;
  const key = `${r.lemma ?? "—"}|${r.pos}|${formOf(r)}`;
  const f = entry.forms.get(key) ?? { lemma: r.lemma ?? "—", pos: r.pos, form: formOf(r), locs: [] };
  f.locs.push(r.loc);
  entry.forms.set(key, f);
  // عدُّ الرسم: صورةُ الكلمة كما كُتبت (مجرّدةً من الضبط)
  const rasm = norm(r.text);
  const rr = entry.rasm.get(rasm) ?? [];
  rr.push(r.loc);
  entry.rasm.set(rasm, rr);
}

const out = {};
for (const [root, e] of byRoot) {
  out[root] = {
    n: e.total,
    forms: [...e.forms.values()]
      .sort((a, b) => b.locs.length - a.locs.length)
      .map((f) => ({ lemma: f.lemma, pos: f.pos, form: f.form, n: f.locs.length, locs: f.locs })),
    rasm: [...e.rasm.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 40)
      .map(([w, locs]) => ({ w, n: locs.length, locs })),
  };
}

const payload = {
  meta: {
    date: "2026-07-21",
    source: "الوسم الصرفيّ لمدوّنة القرآن (QAC) — حقولُ العدد والنوع والتعريف والاشتقاق وزمنِ الفعل وبنائه",
    note: "ثلاثةُ أعدادٍ لا تُخلَط: عدُّ الجذر (المادّة) · عدُّ اللَّـمّة بصيغتها · عدُّ الرسم (صورةُ الكلمة). كلُّ رقمٍ هنا محسوبٌ من مقاطع الجذوع لا من الزوائد.",
    roots: Object.keys(out).length,
    segments: rows.length,
  },
  roots: out,
};
fs.writeFileSync(path.join(PUB, "sarf-counts.json"), JSON.stringify(payload));
const mb = (fs.statSync(path.join(PUB, "sarf-counts.json")).size / 1048576).toFixed(1);
console.log(`✓ sarf-counts.json — ${Object.keys(out).length} جذرًا · ${rows.length} جذعًا · ${mb} م.ب`);
const sh = out["شهر"];
if (sh) {
  console.log(`\nمثال «شهر» — الجذر ${sh.n}:`);
  for (const f of sh.forms) console.log(`  ${f.lemma} · ${f.form} → ${f.n}`);
  console.log(`  الرسم: ${sh.rasm.slice(0, 5).map((r) => `${r.w}(${r.n})`).join(" · ")}`);
}
