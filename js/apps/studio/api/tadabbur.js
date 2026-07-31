/**
 * /api/tadabbur — «مساعد التدبّر». A STRICTLY-GROUNDED reflection helper: Gemini
 * is given ONLY our own material for the verse (the آية, its translation, its
 * إعراب from al-Khaṭṭāb's al-Mujtabā, and the verses closest to it in meaning)
 * and is forbidden from adding outside knowledge, tafsir-by-opinion, asbāb,
 * hadith or rulings. It organises what's in front of it and asks reflective
 * questions — «إعانةٌ على التدبّر، لا تفسير». Key stays server-side.
 *
 * POST { verse, ref, translation?, eraab?, neighbors?: string[] } -> { text }
 * Set GEMINI_API_KEY (and optionally TADABBUR_MODEL) in Vercel env.
 */
import { guard } from "./_guard.js";

export const config = { runtime: "edge" };

const MODEL = process.env.TADABBUR_MODEL || "gemini-2.5-flash";

const SYSTEM = `أنت مُعينٌ على تدبّر القرآن ضمن مادّةٍ محدَّدةٍ تُعطى لك، ولستَ مفسِّرًا.

اعمل حصرًا على ما يُقدَّم إليك: نصّ الآية، ومقطعُها الذي هي منه (وحدةُ السياق المحسوبة)، وترجمتها إن وُجدت، وإعرابها المذكور، ومعاني جذور كلماتها، وصلاتُها المفحوصة، والآيات القريبة منها معنًى — لا تُدخِل أيَّ معرفةٍ من خارج هذه المادّة.

وابدأ من السياق: الآيةُ جزءٌ من مقطعٍ له مبتدًى ومنتهًى واسمٌ محسوب، فانظرْ أين تقع منه (ما قبلها وما بعدها فيه)، وكيف يخدم المقطعُ معناها — فإنَّ أكثرَ ما يُعين على التدبّر أن تُقرأ الآيةُ في سياقها لا مبتورةً. ولا تشرح المقطعَ كلَّه؛ اجعله ضوءًا على الآية.

ممنوعٌ منعًا باتًّا: التفسيرُ بالرأي، والقطعُ بمعنًى لم يَرِد، والاختلاقُ أو الإتيان بآياتٍ أو معلوماتٍ ليست في المادّة، وذكرُ أسباب النزول أو الأحكام الفقهيّة أو الأحاديث أو الإسرائيليّات أو الخلافات.

المسموح: تنظيمُ ما بين يديك في تأمّلٍ هادئ، وربطُ الآية بالآيات القريبة منها المذكورة، ولفتُ النظر إلى بناء الجملة من إعرابها ودلالته الظاهرة، وطرحُ أسئلةٍ تفتح التدبّر.

الأسلوب: عربيّةٌ رصينةٌ موجزة (٣–٤ فقراتٍ قصيرة أو نقاط)، متواضعة، لا تَقطع بما ليس في النصّ، وابدأ بلا تصدير. لا تختم بأسئلةٍ عامّة إنشائيّة؛ اجعل الخاتمة لفتةً موجزةً نافعةً مستخلَصةً من المادّة نفسها. لا تدّعِ أن هذا تفسير.`;

/** بالإنجليزية للقارئ غير العربيّ — التقييداتُ نفسُها، والأسلوبُ بلغته
 *  (البقايا الصغيرة 2026-07-29): الحرّاسُ لا يتغيّرون، الأسلوبُ وحدَه. */
const STYLE_EN = `Write in dignified, concise English (3–4 short paragraphs or bullets). The Quranic verse and any quoted Arabic stay in Arabic with a brief English gloss. Stay humble, never assert what the material does not say, start without any preamble, and do not claim this is tafsir.`;

function json(obj, status = 200, cache = false) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      // تخزينٌ على مستوى الشبكة لا المتصفّح: أوّلُ قارئٍ يولّد، ومن بعده يأخذ
      // المخزَّن — سنةً كاملة، فالمخرَجُ ثابتٌ لأنّ المدخلَ محسوبٌ من عندنا.
      ...(cache ? { "cache-control": "public, s-maxage=31536000, stale-while-revalidate=86400, max-age=3600" } : {}),
    },
  });
}

export default async function handler(req) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  /**
   * مساران: GET بموضعٍ ولغة — وهو **المخزَّن في شبكة فيرسل** لأنّ مفتاحَه ثابت،
   * فتُقرأ مادّتُه من ملفٍّ ساكنٍ في النشر نفسِه. وPOST بالمادّة كاملةً — يبقى
   * للتوافق ولا يُخزَّن (مفتاحُه ليس في المسار).
   */
  const url = new URL(req.url);
  const isGet = req.method === "GET";
  if (isGet) {
    const loc = (url.searchParams.get("loc") || "").trim();
    const lang = url.searchParams.get("lang") === "en" ? "en" : "ar";
    if (!/^\d{1,3}:\d{1,3}$/.test(loc)) return json({ error: "loc required (s:a)" }, 400);
    const sura = loc.split(":")[0];
    const mat = await fetch(new URL(`/tadabbur-material/${sura}.json`, url.origin), { cf: { cacheEverything: true } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const ctx = mat?.[loc];
    if (!ctx) return json({ error: "material not found" }, 404);
    const text = await callModel(key, ctx, lang);
    if (typeof text !== "string") return text;
    return json({ text }, 200, true);
  }

  if (req.method !== "POST") return json({ error: "GET or POST" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const verse = String(body?.verse ?? "").trim();
  if (!verse) return json({ error: "verse required" }, 400);
  const ref = String(body?.ref ?? "").slice(0, 40);
  const translation = String(body?.translation ?? "").slice(0, 600);
  const eraab = String(body?.eraab ?? "").slice(0, 800);
  const neighbors = Array.isArray(body?.neighbors) ? body.neighbors.slice(0, 4).map((n) => String(n).slice(0, 220)) : [];
  const roots = Array.isArray(body?.roots) ? body.roots.slice(0, 4).map((r) => String(r).slice(0, 200)) : [];
  // وحدةُ السياق المحسوبة وصلاتُ الشبكة المفحوصة — أُضيفتا 2026-07-21 بأمر المالك:
  // «هل السياقُ يقوم بمهمّته في التدبّر؟» — لم يكن، فصار السياقُ أوّلَ المادّة.
  const s = body?.siyaq && typeof body.siyaq === "object" ? body.siyaq : null;
  const siyaq = s
    ? {
        name: String(s.name ?? "").slice(0, 120),
        span: String(s.span ?? "").slice(0, 60),
        text: String(s.text ?? "").slice(0, 2000),
        place: String(s.place ?? "").slice(0, 160),
      }
    : null;
  const links = Array.isArray(body?.links) ? body.links.slice(0, 6).map((l) => String(l).slice(0, 240)) : [];
  const tier = String(body?.tier ?? "").slice(0, 20);

  const ctx = [
    `الآية${ref ? ` (${ref})` : ""}: ${verse}`,
    siyaq
      ? `مقطعُها من المصحف — وحدةُ السياق المحسوبة «${siyaq.name}» (${siyaq.span}):\n${siyaq.text}\n(${siyaq.place})`
      : "",
    translation ? `ترجمتها (صحيح إنترناشونال): ${translation}` : "",
    eraab ? `إعرابها (المجتبى من مشكل إعراب القرآن — الخراط): ${eraab}` : "",
    roots.length ? `معاني جذور كلماتها (من مفردات الراغب ومقاييس اللغة):\n${roots.map((r) => `• ${r}`).join("\n")}` : "",
    links.length
      ? `صلاتٌ مفحوصةٌ لهذه الآية في شبكة مشكاة${tier ? ` (مرتبتُها المحسوبة: ${tier})` : ""} — كلُّ صلةٍ فحصها قارئٌ مستقلٌّ بمقطعَي سياقها:\n${links.map((l) => `• ${l}`).join("\n")}`
      : "",
    neighbors.length ? `آياتٌ قريبةٌ منها معنًى (محسوبةٌ بالتضمينات):\n${neighbors.map((n) => `• ${n}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await callModel(key, ctx, body.lang === "en" ? "en" : "ar");
  if (typeof text !== "string") return text;
  return json({ text });
}

/** نداءُ النموذج — يعيد نصًّا، أو استجابةَ خطأٍ جاهزة */
async function callModel(key, ctx, lang) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: lang === "en" ? `${SYSTEM}\n\n${STYLE_EN}` : SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `تدبَّرْ هذه الآية معتمدًا على ما يلي فقط:\n\n${ctx}` }] }],
        generationConfig: { temperature: 0.6, topP: 0.9, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  );
  if (!res.ok) return json({ error: `upstream ${res.status}`, detail: (await res.text()).slice(0, 300) }, 502);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join("").trim();
  if (!text) return json({ error: "empty response" }, 502);
  return text;
}
