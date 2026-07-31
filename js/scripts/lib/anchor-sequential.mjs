/**
 * المِرساةُ المتتابعة — لكتب الشرح الجارية على ترتيب المصحف (2026-07-31).
 *
 * العلّة: كتبُ «معاني القرآن» والإعرابِ متونٌ متّصلة، تقتبس الآيةَ ثم تتكلّم
 * عليها: «وقوله عزّ وجلّ: (الرحمن الرحيم) هذه صفاتٌ لله…». فتصويتُ الفقرة
 * (المِرساة العامّة) يُهدر أكثرَها لأنّ الفقرة قد تخلو من خماسيّةٍ مميِّزة،
 * والاقتباسُ نفسُه — وهو المِرساةُ الحقيقيّة — قد يكون كلمتين أو ثلاثًا.
 *
 * فتُستعمل ثلاثُ قرائنَ يقوّي بعضُها بعضًا، وكلُّها حتميّةٌ بلا تخمين:
 *   ١) **الاقتباسُ المحصور** بين قوسين أو شولتين — يُطابَق **متّصلًا** على نصّ
 *      آيةٍ بعد تطبيعٍ متماثل، لا بخماسيّاتٍ مبعثرة.
 *   ٢) **عنوانُ السورة** إن وُجد («### | ومن سورة البقرة») — فيُحصر البحثُ فيها.
 *   ٣) **التتابع**: هذه الكتبُ تمشي على ترتيب المصحف، فيُمسك مؤشّرٌ يتقدّم ولا
 *      يقفز؛ ويُؤخذ أوّلُ موضعٍ يوافق **عند المؤشّر أو بعده** في نافذةٍ محدودة.
 *      وبهذا يُحسم اشتراكُ الاقتباسات القصيرة الشائعة («الذين آمنوا وعملوا
 *      الصالحات») بلا ترجيحٍ بالظنّ.
 *   وإن لم يوافق شيءٌ في النافذة، فلا يُقبل إلا موضعٌ **وحيدٌ في المصحف كلِّه**،
 *   وحينها يُعاد ضبطُ المؤشّر إليه (استدراكٌ لانقطاع الترتيب).
 *
 * وما لم يثبت لا يُسنَد — تبقى الفقرةُ ملحقةً بسابقتها أو تُطرح.
 */
import { DatabaseSync } from "node:sqlite";
import { normAr } from "./anchor-by-quote.mjs";

const DB = "/Volumes/data/new-projects/quran/quran-kg.db";

/** آياتُ المصحف بترتيبها، مطبَّعةً ومحاطةً بفراغٍ ليُطابَق المتّصلُ متّصلًا */
export function buildSequentialIndex(dbPath = DB) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const verses = db
    .prepare("SELECT location, surah_no, ayah_no, text_clean, text_uthmani FROM ayah ORDER BY surah_no, ayah_no")
    .all()
    .map((r) => ({ loc: r.location, sura: r.surah_no, aya: r.ayah_no, norm: ` ${normAr(r.text_clean || r.text_uthmani)} ` }));

  const suraRange = new Map(); // رقمُ السورة → [أوّلُ فهرسٍ، آخرُه]
  verses.forEach((v, i) => {
    const r = suraRange.get(v.sura);
    if (r) r[1] = i;
    else suraRange.set(v.sura, [i, i]);
  });

  const suraByName = new Map();
  for (const s of db.prepare("SELECT surah_no, name_ar FROM surah").all()) {
    suraByName.set(normAr(s.name_ar), s.surah_no);
  }
  // أسماءٌ أخرى تُستعمل في الطبعات
  for (const [alias, no] of [["ام الكتاب", 1], ["فاتحه الكتاب", 1], ["الفاتحه", 1], ["بني اسراييل", 17], ["المومن", 40], ["حم السجده", 41], ["فصلت", 41], ["القتال", 47], ["الملايكه", 35], ["الانسان", 76], ["الدهر", 76], ["المطففين", 83], ["عبس", 80], ["التوبه", 9], ["براءه", 9], ["برايه", 9]])
    suraByName.set(normAr(alias), no);

  return { verses, suraRange, suraByName };
}

/** اسمُ السورة من سطر عنوان، أو null */
export function suraFromHeading(line, suraByName) {
  const t = normAr(line).replace(/^[#|~\s]+/, "").replace(/^(ومن |من |تفسير |سوره |ومن سوره )+/, "").trim();
  if (!t) return null;
  if (suraByName.has(t)) return suraByName.get(t);
  // «سورة البقرة وهي مدنية» ونحوُها: تُجرَّب أوّلُ كلمتين ثم أوّلُ كلمة
  const w = t.split(" ");
  for (const k of [w.slice(0, 2).join(" "), w[0]]) if (k && suraByName.has(k)) return suraByName.get(k);
  return null;
}

/**
 * يبحث عن آيةٍ تحوي الاقتباسَ متّصلًا.
 * @returns فهرسُ الآية في `verses` أو ‎-1
 */
function findQuote(q, { verses, suraRange }, cursor, sura, window) {
  const needle = ` ${q} `;
  const ranges = [];
  if (sura && suraRange.has(sura)) {
    const [s, e] = suraRange.get(sura);
    ranges.push([Math.max(s, Math.min(cursor, e)), e], [s, e]); // من المؤشّر داخل السورة، ثم السورةُ كلُّها
  } else {
    ranges.push([cursor, Math.min(cursor + window, verses.length - 1)]);
  }
  for (const [a, b] of ranges) for (let i = a; i <= b; i++) if (verses[i].norm.includes(needle)) return i;

  // آخرُ الاحتمالات: موضعٌ وحيدٌ في المصحف كلِّه (استدراكُ الترتيب)
  let hit = -1;
  for (let i = 0; i < verses.length; i++) {
    if (!verses[i].norm.includes(needle)) continue;
    if (hit >= 0) return -1; // مشتركٌ فلا يُقبل بلا قرينة
    hit = i;
  }
  return hit;
}

/**
 * يقطّع كتابًا متتابعًا إلى مداخلَ مُرسًى كلٌّ منها على آية.
 *
 * @param body متنُ الكتاب بعد الترويسة
 * @param ix   ناتجُ buildSequentialIndex
 * @param opts.minWords أدنى كلماتِ اقتباسٍ يُعتدّ به (٣ مع عنوان سورة، ٤ بدونه)
 * @returns { anchors: [{pos, loc}], stats }
 */
export function anchorSequentialBook(body, ix, { minWords = 3, window = 200 } = {}) {
  // صيغُ الاقتباس في طبعات المرآة: قوسان (مع تعشيشِ رقم الآية) · شولتان ·
  // معقوفتان · مزهّرتان · وعلامةُ OpenITI ‎@QB@…@QE@. وسطرُ العنوان يُلتقط
  // كذلك لأنّ بعض الطبعات (التبيان للعكبري) تضع الآيةَ في العنوان نفسِه.
  const TOKEN =
    /^###.*$|@QB@([\s\S]{4,400}?)@QE@|\(((?:[^()\n]|\([^()\n]*\)){4,300}?)\)|«([^»\n]{4,300})»|\{([^}\n]{4,300})\}|﴿([^﴾\n]{4,300})﴾/gm;
  const QUOTE_IN_HEAD = /\(((?:[^()\n]|\([^()\n]*\)){4,300}?)\)|\{([^}\n]{4,300})\}|﴿([^﴾\n]{4,300})﴾/g;

  const anchors = [];
  let cursor = 0, sura = null, tried = 0, hitCount = 0, resync = 0;

  /**
   * يجرّب اقتباسًا خامًا؛ يعيد true إن أُرسي.
   * @param certain علامةُ الاقتباس قاطعةٌ في أنّ المحصورَ قرآن (‎@QB@ · {} · ﴿﴾)
   *   بخلاف القوسين والشولتين فقد يحصران شعرًا أو كلامَ نحويّ. فمع القاطعة
   *   يُقبل اقتباسُ كلمتين — لكن في نافذةٍ ضيّقةٍ لئلّا يقفز المؤشّر بلا بيّنة.
   */
  const tryQuote = (rawQuote, pos, certain = false) => {
    if (!rawQuote) return false;
    const need = certain ? 2 : sura ? minWords : minWords + 1;
    const win = certain ? 40 : window;
    // الاقتباسُ قد يجمع آيتين مفصولتين برقم («… العالمين (2) الرحمن الرحيم (3)»)
    for (const piece of rawQuote.split(/\(?\s*\d{1,3}\s*\)?/)) {
      const q = normAr(piece);
      const words = q.split(" ").filter(Boolean);
      if (words.length < need) continue;
      tried++;
      const i = findQuote(q, ix, cursor, sura, win);
      if (i < 0) continue;
      if (i < cursor) resync++;
      cursor = i;
      hitCount++;
      const loc = ix.verses[i].loc;
      if (anchors.length && anchors[anchors.length - 1].loc === loc) return true; // اقتباساتٌ متتاليةٌ لآيةٍ واحدة
      anchors.push({ pos, loc });
      return true;
    }
    return false;
  };

  for (const m of body.matchAll(TOKEN)) {
    if (m[0].startsWith("###")) {
      const s = suraFromHeading(m[0], ix.suraByName);
      if (s) { sura = s; cursor = ix.suraRange.get(s)[0]; continue; }
      for (const h of m[0].matchAll(QUOTE_IN_HEAD)) if (tryQuote(h[1] ?? h[2] ?? h[3], m.index, !!(h[2] || h[3]))) break;
      continue;
    }
    // m[1]=@QB@ · m[2]=() · m[3]=«» · m[4]={} · m[5]=﴿﴾ — القاطعُ منها الأول والرابع والخامس
    tryQuote(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5], m.index, !!(m[1] || m[4] || m[5]));
  }
  return { anchors, stats: { tried, hit: hitCount, resync } };
}
