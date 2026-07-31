/**
 * معاجمُ اللغة الكلاسيكيّة — الدفعةُ الثانية من إكمال المراجع (2026-07-31،
 * ميثاق الفحص §ب الرتبة ٢: «حجّةٌ في المعنى الوضعيّ، وتقديمُ الأقدم عند
 * الاختلاف»).
 *
 * (غيرُ build-lexicons.mjs القائم — ذاك للمعجمين القرآنيّين في قاعدة التطبيق:
 * المفردات والمقاييس. وهذا يُدخل معاجمَ اللغة العامّة.)
 *
 * العلّةُ المعالَجة: أصحابُ الدعاوى اللسانيّة يحتكمون إلى **لسان العرب**
 * و**الصحاح** و**أساس البلاغة** بأعيانها، فمن ردّ عليهم بغير معاجمهم لم
 * يُلزمهم. فتدخل ستّةٌ بترتيب أقدميّتها: العين (١٧٠) · الصحاح (٣٩٣) ·
 * المحكم (٤٥٨) · أساس البلاغة (٥٣٨) · لسان العرب (٧١١) · الكلّيّات (١٠٩٤).
 *
 * المرساة: **جذر**. مداخلُ المعاجم في مرآة OpenITI معنونةٌ بالمادّة صراحةً
 * («### | [بطأ]»)، فيُقطَّع الكتابُ عليها ويُطبَّق الجذرُ على جدول جذورنا
 * بتطبيعٍ متماثل. وما لا يوافق جذرًا قرآنيًّا يُطرح — فبابُنا القرآنُ لا
 * المعجمُ كلُّه، فيخفّ الملفُّ ويصير كلُّ مدخلٍ مسنَدًا إلى مادّةٍ عندنا.
 *
 * usage: node js/scripts/build-lexicons-classical.mjs
 * out:   js/data/refs-src/lex/<id>.json (خامٌ غيرُ منشور) — ثم
 *        node js/scripts/shard-all-refs.mjs يشظّيه إلى public/refs/<id>/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { cleanOpenITI } from "./lib/anchor-by-quote.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const OUT = path.join(ROOT, "js/data/refs-src/lex");
const MIRROR = "/Volumes/data/RELEASE-master/data";

const BOOKS = [
  { id: "ayn", uri: "0170KhalilFarahidi.Cayn", label: "كتاب العين", by: "الخليل بن أحمد الفراهيدي", died: 170 },
  { id: "sihah", uri: "0393IbnHammadJawhari.SihahTajLugha", label: "الصحاح — تاج اللغة", by: "الجوهري", died: 393 },
  { id: "muhkam", uri: "0458IbnSidaMursi.MuhkamWaMuhit", label: "المحكم والمحيط الأعظم", by: "ابن سِيدَه", died: 458 },
  { id: "asas", uri: "0538JarAllahZamakhshari.AsasBalagha", label: "أساس البلاغة", by: "الزمخشري", died: 538 },
  { id: "lisan", uri: "0711IbnManzurIfriqi.LisanCarab", label: "لسان العرب", by: "ابن منظور", died: 711 },
  { id: "kulliyat", uri: "1094IbnMusaKaffawi.Kulliyat", label: "الكلّيّات — معجم المصطلحات والفروق", by: "أبو البقاء الكفوي", died: 1094 },
];

/** تطبيعُ الجذر للمطابقة: تجريدُ الضبط وطيُّ صور الهمزة والألف المقصورة */
const normRoot = (s) =>
  (s || "")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/[^ء-ي]/g, "");

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const quranRoots = new Map();
for (const r of db.prepare("SELECT root_ar FROM root").all()) {
  const k = normRoot(r.root_ar);
  if (k.length >= 2) quranRoots.set(k, r.root_ar);
}
console.log(`جذورُ المصحف: ${quranRoots.size}\n`);

fs.mkdirSync(OUT, { recursive: true });
const summary = [];
for (const b of BOOKS) {
  const dir = path.join(MIRROR, b.uri.split(".")[0], b.uri);
  if (!fs.existsSync(dir)) { console.log(`✗ ${b.id}: لا مجلد`); continue; }

  // النسخةُ التي فيها أكثرُ مداخلَ معنونةٍ بمادّة — بأيِّ صيغةٍ من صيغ الطبعات:
  //   «[بطأ]» · «|| CHECK [أ ر ج]» · «بطأ» مجرّدةً
  let best = null, bestN = -1;
  for (const f of fs.readdirSync(dir).filter((x) => !x.endsWith(".yml") && !x.endsWith(".md"))) {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    // صيغتان: عنوانٌ مستقلٌّ بالمادّة، أو «### $ مادّة: نصُّ المدخل…» (اللسان)
    const n = (t.match(/^###[\s|$]*(?:CHECK\s*)?\[?\s*[ء-ي](?:\s?[ء-ي]){1,5}\s*\]?\s*(?::|$)/gm) || []).length;
    if (n > bestN) { bestN = n; best = f; }
  }
  if (!best || bestN < 200) { console.log(`✗ ${b.label}: لا مداخلَ معنونةً بالمادّة (${bestN})`); continue; }

  const body = fs.readFileSync(path.join(dir, best), "utf8").split("#META#Header#End#").pop();
  const parts = body.split(/^###[\s|$]*/m);
  const entries = {};
  let matched = 0, skipped = 0;
  for (const part of parts) {
    // المادّةُ إمّا عنوانٌ مستقلٌّ في سطرٍ، وإمّا صدرُ السطر يتلوها «:» ثم النصّ
    const inline = part.match(/^(?:CHECK\s*)?\[?\s*([ء-ي](?:\s?[ء-ي]){1,5})\s*\]?\s*:\s*/);
    let m, rest;
    if (inline) {
      m = inline; rest = part.slice(inline[0].length);
    } else {
      const nl = part.indexOf("\n");
      if (nl < 0) { skipped++; continue; }
      m = part.slice(0, nl).trim().match(/^[\s|]*(?:CHECK\s*)?\[?\s*([ء-ي](?:\s?[ء-ي]){1,5})\s*\]?\s*$/);
      rest = part.slice(nl + 1);
    }
    if (!m) { skipped++; continue; }
    const qroot = quranRoots.get(normRoot(m[1]));
    if (!qroot) { skipped++; continue; }
    const text = cleanOpenITI(rest);
    if (text.length < 30) { skipped++; continue; }
    const cut = text.length > 6000 ? text.slice(0, 6000) + "…" : text;
    entries[qroot] = entries[qroot] ? `${entries[qroot]}\n${cut}` : cut;
    matched++;
  }
  const covered = Object.keys(entries).length;
  fs.writeFileSync(path.join(OUT, `${b.id}.json`), JSON.stringify({
    meta: { id: b.id, label: b.label, author: b.by, died: b.died,
            source: `OpenITI ${b.uri} · ${best}`, date: "2026-07-31", anchor: "جذر",
            role: "معجمُ لغةٍ — حجّةٌ في المعنى الوضعيّ (ميثاق الفحص، الرتبة ٢)",
            coverage: `${covered} من ${quranRoots.size} جذرًا قرآنيًّا` },
    entries,
  }));
  const kb = (fs.statSync(path.join(OUT, `${b.id}.json`)).size / 1024) | 0;
  console.log(`✓ ${b.label} — ${b.by} (ت${b.died}): ${covered} جذرًا (${((covered / quranRoots.size) * 100).toFixed(0)}%) · ${kb}KB`);
  summary.push({ id: b.id, covered });
}
console.log("\nالتغطية:", summary.map((s) => `${s.id}:${s.covered}`).join(" · "));
