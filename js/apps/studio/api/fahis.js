/**
 * /api/fahis — المسارُ المفتوح في «فاحص»: يكتب الزائرُ فكرتَه نثرًا فتُفحص.
 *
 * والبنيةُ مقصودةٌ لتمنع النموذجَ من اختلاق رقم — وهي على **طورين**:
 *
 *   ١) **التصنيف** (`classify`): يقرأ النموذجُ نصَّ الفكرة فيُخرج **حقولًا
 *      فقط** — نوعُها، واللفظُ المقصود، والعددُ المدَّعى إن ذُكر، والموضعُ إن
 *      ذُكر. لا يحكم ولا يعدّ.
 *   ٢) **الصياغة** (`compose`): يُعطى **ما حسبه التطبيقُ عنده** (عددُ المفرد
 *      والجمع وصيغُها ومواضعُها ومعدّلُ الصدفة وما عند المراجع) فيصوغ منه
 *      بطاقةً بصيغة الميثاق. **وممنوعٌ عليه أن يأتي برقمٍ أو موضعٍ ليس في
 *      المعطى** — وهذا مكتوبٌ في أمره ومحروسٌ ببنية الطلب.
 *
 * فالحسابُ عندنا، والصياغةُ عنده. ومن سأل «كم مرّةً وردت؟» أُجيب بعدٍّ لا
 * بذاكرة نموذج.
 *
 * POST { mode: "classify", text }                       -> { kind, word, number, loc, why }
 * POST { mode: "compose", claim, kind, evidence: [...] } -> { verdict, limit, lines }
 */
import { guard } from "./_guard.js";

export const config = { runtime: "edge" };
const MODEL = process.env.FAHIS_MODEL || "gemini-2.5-flash";

const KINDS = ["عدد", "كلية", "دلالة", "اعراب", "ترادف", "قراءة", "صرف", "خارج"];

const CLASSIFY = `أنت تصنّف فكرةً تُعرض عليك، ولا تحكم عليها ولا تعدّ شيئًا.

أخرِجْ JSON فقط بهذه الحقول:
{"kind":"<واحدٌ من: عدد | كلية | دلالة | اعراب | ترادف | قراءة | صرف | خارج>",
 "word":"<اللفظُ العربيُّ المقصود مفردًا مجرّدًا، أو null>",
 "word2":"<اللفظُ الثاني إن كانت مقارنةً بين لفظين، أو null>",
 "number":<العددُ المدَّعى رقمًا إن ذُكر، أو null>,
 "loc":"<موضعٌ بصيغة سورة:آية إن ذُكر، أو null>",
 "why":"<سطرٌ واحدٌ: لماذا هذا التصنيف>"}

ضوابطُ التصنيف:
• «عدد» إذا ادُّعي عددُ ورودٍ للفظ.
• «كلية» إذا كان القولُ سالبًا شاملًا («لا يوجد في القرآن…») أو موجبًا شاملًا («كلُّ…»).
• «ترادف» إذا نُفي الترادفُ بين لفظين أو أُثبت.
• «دلالة» إذا ادُّعي معنًى للفظ.
• «اعراب» إذا كان القولُ في إعراب موضع.
• «قراءة» إذا كان في ضبطٍ أو قراءة.
• «صرف» إذا كان في جذرٍ أو صيغةٍ صرفيّة.
• «خارج» إذا كان في التاريخ أو الفقه أو العقيدة أو خارجَ لغة القرآن — فهذا ما لا أداةَ لنا فيه.

ولا تُخرج شيئًا غيرَ JSON.`;

const COMPOSE = `أنت تصوغ بطاقةَ فحصٍ من **معطًى محسوبٍ يُعطى لك**، ولا تضيف إليه شيئًا.

**ممنوعٌ منعًا باتًّا**: أن تذكر رقمًا أو موضعَ آيةٍ أو نصَّ آيةٍ ليس في المعطى.
وإن نقص المعطى عن الحكم فقل «لم يتبيّن» ولا تتكلّف.

أخرِجْ JSON فقط:
{"lines":["<شاهدٌ مصوغٌ من المعطى>", "…"],
 "verdict":"<واحدٌ من: تستقيم | تحتاج تقييدًا | لا تستقيم | لم يتبيّن> — وبعده سببٌ موجز",
 "limit":"<حدودُ النتيجة: ما لا يلزم منها>"}

الأسلوب: عربيّةٌ رصينةٌ هادئة، تقريرٌ لا خصومة. لا تذكر اسمَ أحد. ابدأ بلا تصدير.
واجعل الشواهدَ مرتَّبةً: العدُّ أوّلًا ثمّ ما عند أهل الصنعة. ولا تدّعِ قطعًا
فيما المعطى فيه احتمال.`;

function json(o, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
}

async function call(key, system, user) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2, topP: 0.9, maxOutputTokens: 900,
        responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!r.ok) return { error: `upstream ${r.status}`, detail: (await r.text()).slice(0, 240) };
  const d = await r.json();
  const txt = (d?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join("").trim();
  try { return JSON.parse(txt); } catch { return { error: "bad json", detail: txt.slice(0, 200) }; }
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const blocked = guard(req);
  if (blocked) return blocked;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  if (b?.mode === "classify") {
    const text = String(b.text ?? "").slice(0, 1200).trim();
    if (!text) return json({ error: "text required" }, 400);
    const out = await call(key, CLASSIFY, `الفكرة:\n${text}`);
    if (out.error) return json(out, 502);
    // الحقولُ تُنقَّى عندنا فلا يمرّ تصنيفٌ خارجَ القائمة
    return json({
      kind: KINDS.includes(out.kind) ? out.kind : "خارج",
      word: typeof out.word === "string" ? out.word.trim().slice(0, 40) : null,
      word2: typeof out.word2 === "string" ? out.word2.trim().slice(0, 40) : null,
      number: Number.isFinite(out.number) ? out.number : null,
      loc: /^\d{1,3}:\d{1,3}$/.test(String(out.loc ?? "")) ? out.loc : null,
      why: String(out.why ?? "").slice(0, 220),
    });
  }

  if (b?.mode === "compose") {
    const claim = String(b.claim ?? "").slice(0, 600);
    const kind = String(b.kind ?? "").slice(0, 20);
    const ev = Array.isArray(b.evidence) ? b.evidence.slice(0, 14).map((x) => String(x).slice(0, 700)) : [];
    if (!claim || !ev.length) return json({ error: "claim and evidence required" }, 400);
    const out = await call(key, COMPOSE, `الفكرة (مجرّدةً من قائلها): ${claim}\nنوعُها: ${kind}\n\nالمعطى المحسوب — لا تخرج عنه:\n${ev.map((e, i) => `${i + 1}) ${e}`).join("\n")}`);
    if (out.error) return json(out, 502);
    return json({
      lines: Array.isArray(out.lines) ? out.lines.slice(0, 10).map((x) => String(x).slice(0, 700)) : [],
      verdict: String(out.verdict ?? "لم يتبيّن").slice(0, 220),
      limit: String(out.limit ?? "").slice(0, 500),
    });
  }

  return json({ error: "mode must be classify|compose" }, 400);
}
