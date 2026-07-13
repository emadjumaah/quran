/**
 * collect-books.mjs — turn the spa5k/tafsir_api per-āyah JSON trees into compact,
 * grouped `{ref, refEnd?, text}` JSONL, organized by genre under js/data/.
 *
 * spa5k stores commentary per āyah, DUPLICATING a passage's text across every āyah
 * in its range. We collapse consecutive identical texts within a sūrah into ONE
 * record with a ref range (ref="2:1", refEnd="2:5"), so each distinct block is
 * stored once — reader lookups still resolve (any loc inside [ref,refEnd]), and
 * embedding sees no duplicates. Concise per-āyah books just get refEnd omitted.
 *
 *   node scripts/collect-books.mjs <path-to-tafsir_api/tafsir>
 */
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error("usage: collect-books.mjs <tafsir_api/tafsir dir>"); process.exit(1); }
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA = path.join(REPO, "data");

// slug → { id, genre, label, author }
const EDITIONS = {
  // ── tafsir: concise / modern ────────────────────────────────────────────
  "ar-tafsir-al-mukhtasar":            ["mukhtasar", "tafsir", "المختصر في التفسير", "مركز تفسير"],
  "ar-tafsir-as-saadi":                ["saadi", "tafsir", "تيسير الكريم الرحمن", "السعدي"],
  "tadabbur-wa-amal":                  ["tadabbur", "tafsir", "تدبّر وعمل", "-"],
  "abu-bakr-jabir-al-jazairi":         ["aysar", "tafsir", "أيسر التفاسير", "أبو بكر الجزائري"],
  "tafsir-ibn-uthaymeen":              ["uthaymeen", "tafsir", "تفسير ابن عثيمين", "ابن عثيمين"],
  // ── tafsir: classical مأثور ─────────────────────────────────────────────
  "ar-tafsir-al-tabari":               ["tabari", "tafsir", "جامع البيان", "الطبري"],
  "ar-tafsir-ibn-kathir":              ["ibnkathir", "tafsir", "تفسير القرآن العظيم", "ابن كثير"],
  "al-durr-al-manthur":                ["durrmanthur", "tafsir", "الدرّ المنثور", "السيوطي"],
  "tafsir-ibn-abi-hatim":              ["ibnabihatim", "tafsir", "تفسير ابن أبي حاتم", "ابن أبي حاتم"],
  "ar-tafsir-al-baghawi":              ["baghawi", "tafsir", "معالم التنزيل", "البغوي"],
  // ── tafsir: classical دراية / لغة / بلاغة ───────────────────────────────
  "ar-tafseer-al-qurtubi":             ["qurtubi", "tafsir", "الجامع لأحكام القرآن", "القرطبي"],
  "al-kashshaf-al-zamakhshari":        ["kashshaf", "tafsir", "الكشّاف", "الزمخشري"],
  "tafsir-al-razi":                    ["razi", "tafsir", "مفاتيح الغيب", "الفخر الرازي"],
  "al-bahr-al-muhit":                  ["bahrmuhit", "tafsir", "البحر المحيط", "أبو حيّان"],
  "tafsir-al-baydawi":                 ["baydawi", "tafsir", "أنوار التنزيل", "البيضاوي"],
  "al-muharrar-al-wajiz-ibn-atiyyah":  ["ibnatiyyah", "tafsir", "المحرّر الوجيز", "ابن عطية"],
  "tafsir-al-alusi":                   ["alusi", "tafsir", "روح المعاني", "الألوسي"],
  "fath-al-qadir-al-shawkani":         ["shawkani", "tafsir", "فتح القدير", "الشوكاني"],
  "ar-tafseer-tahrir-al-tanwir":       ["ibnashur", "tafsir", "التحرير والتنوير", "ابن عاشور"],
  "tafsir-al-nasafi":                  ["nasafi", "tafsir", "مدارك التنزيل", "النسفي"],
  "tafsir-abi-al-su-ood":              ["abusuud", "tafsir", "إرشاد العقل السليم", "أبو السعود"],
  "mahasin-al-ta-wil-al-qasimi":       ["qasimi", "tafsir", "محاسن التأويل", "القاسمي"],
  "adwa-al-bayan":                     ["adwaalbayan", "tafsir", "أضواء البيان", "الشنقيطي"],
  "nazam-al-durar-al-biqa-i":          ["biqai", "munasabat", "نظم الدرر في تناسب الآيات والسور", "البقاعي"],
  // ── إعراب ───────────────────────────────────────────────────────────────
  "al-jadwal-fi-i-rab-al-quran":       ["jadwal", "i3rab", "الجدول في إعراب القرآن", "محمود صافي"],
  "al-dur-al-masun-lil-samin-al-halabi":["durrmasun", "i3rab", "الدرّ المصون", "السمين الحلبي"],
  "i-rab-al-quran-li-al-darwish":      ["darwish", "i3rab", "إعراب القرآن وبيانه", "الدرويش"],
  "al-i-rab-al-muyassar":              ["i3rabmuyassar", "i3rab", "الإعراب الميسّر", "-"],
  // ── غريب / ألفاظ ────────────────────────────────────────────────────────
  "asseraj-fi-bayan-gharib-alquran":   ["seraj", "gharib", "السراج في بيان غريب القرآن", "الخضيري"],
  "al-muyassar-fi-al-gharib":          ["gharibmuyassar", "gharib", "الميسّر في غريب القرآن", "-"],
  "tahlil-kalimat-al-qur-an":          ["tahlil", "gharib", "تحليل كلمات القرآن", "-"],
  // ── قراءات ──────────────────────────────────────────────────────────────
  "al-qira-at-al-mawsoo-ah-al-qur-aniyyah":["qiraat", "qiraat", "الموسوعة القرآنية للقراءات", "-"],
  "al-nashr-li-ibn-al-jazari":         ["nashr", "qiraat", "النشر في القراءات العشر", "ابن الجزري"],
};

const manifest = [];
for (const [slug, [id, genre, label, author]] of Object.entries(EDITIONS)) {
  const dir = path.join(SRC, slug);
  if (!fs.existsSync(dir)) { console.log(`skip (absent): ${slug}`); continue; }
  // collect per-āyah text
  const perAyah = []; // {s,a,text}
  for (let s = 1; s <= 114; s++) {
    const sdir = path.join(dir, String(s));
    if (!fs.existsSync(sdir)) continue;
    for (const f of fs.readdirSync(sdir)) {
      if (!f.endsWith(".json")) continue;
      const a = Number(f.slice(0, -5));
      let j; try { j = JSON.parse(fs.readFileSync(path.join(sdir, f), "utf8")); } catch { continue; }
      const text = String(j.text ?? "").replace(/\s+/g, " ").trim();
      if (text) perAyah.push({ s, a, text });
    }
  }
  perAyah.sort((x, y) => x.s - y.s || x.a - y.a);
  // group consecutive identical text within a sūrah into ranges
  const rows = [];
  for (let i = 0; i < perAyah.length; ) {
    const { s, a, text } = perAyah[i];
    let j = i + 1;
    while (j < perAyah.length && perAyah[j].s === s && perAyah[j].text === text) j++;
    const end = perAyah[j - 1];
    const row = { ref: `${s}:${a}`, text };
    if (end.a !== a) row.refEnd = `${s}:${end.a}`;
    rows.push(row);
    i = j;
  }
  const outDir = path.join(DATA, genre);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${id}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n"));
  const bytes = rows.reduce((n, r) => n + Buffer.byteLength(r.text), 0);
  manifest.push({ id, genre, label, author, source: "spa5k", slug,
    ayat: perAyah.length, blocks: rows.length, textMB: +(bytes / 1e6).toFixed(2),
    avgChars: Math.round(bytes / rows.length) });
}

manifest.sort((a, b) => a.genre.localeCompare(b.genre) || b.textMB - a.textMB);
fs.writeFileSync(path.join(DATA, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${"id".padEnd(15)}${"genre".padEnd(11)}${"blocks".padStart(7)}${"ayat".padStart(7)}${"MB".padStart(8)}  label`);
for (const m of manifest)
  console.log(`${m.id.padEnd(15)}${m.genre.padEnd(11)}${String(m.blocks).padStart(7)}${String(m.ayat).padStart(7)}${String(m.textMB).padStart(8)}  ${m.label} — ${m.author}`);
const tot = manifest.reduce((a, m) => a + m.textMB, 0);
console.log(`\n${manifest.length} books · ${tot.toFixed(1)} MB grouped text → ${DATA}`);
