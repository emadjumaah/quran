/**
 * Word→root resolver for search — maps every normalized surface form (and its
 * ال-stripped variant) + every lemma to its root, so a reader can search by any
 * derived word instead of the bare root: «شقي» → root «شقو», «الزنى» → «زني».
 *
 * Reads quran-kg.db. Writes js/apps/studio/public/search-forms.json
 * ({ normalizedForm: rootAr }). Usage: node scripts/export-search-forms.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "js/apps/studio/public/search-forms.json");

// keep this identical to the app-side normalizer (src/searchForms.ts)
const stripDiac = (s) => s.replace(/[ؐ-ًؚ-ْٰـۖ-ۭ]/g, "");
const norm = (s) =>
  stripDiac(s).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
const stripAl = (s) => s.replace(/^(?:[وفبكل])?ال/, "");

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const forms = {};
const add = (form, root) => {
  for (const k of new Set([norm(form), norm(stripAl(form))])) {
    if (k.length >= 2 && !(k in forms)) forms[k] = root;
  }
};

// every distinct word surface form → its root
for (const r of db.prepare(`
  SELECT DISTINCT w.text_clean t, rt.root_ar root
  FROM word w JOIN root rt ON rt.root_id = w.root_id WHERE rt.root_ar IS NOT NULL`).iterate()) {
  add(r.t, r.root);
}
// every lemma → its root
for (const r of db.prepare(`
  SELECT DISTINCT l.lemma_ar t, rt.root_ar root
  FROM lemma l JOIN root rt ON rt.root_id = l.root_id WHERE rt.root_ar IS NOT NULL`).iterate()) {
  add(r.t, r.root);
}
// and roots map to themselves
for (const r of db.prepare("SELECT root_ar FROM root").iterate()) add(r.root_ar, r.root_ar);
db.close();

fs.writeFileSync(OUT, JSON.stringify(forms));
console.log(`search-forms.json: ${Object.keys(forms).length} forms → root (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
// sanity
for (const q of ["شقي", "الزنى", "زنى", "زاني", "يشقى", "المتقين"]) console.log(`  ${q} → ${forms[norm(q)] ?? forms[norm(stripAl(q))] ?? "—"}`);
