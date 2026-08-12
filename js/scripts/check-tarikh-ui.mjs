/**
 * فحصُ الواجهة في متصفّحٍ حقيقيّ — قاعدةُ النقرتين والتحميلُ الكسول.
 *
 * يقود Google Chrome عبر DevTools Protocol (الطريقةُ المعتمَدة في المشروع؛
 * playwright معطوبٌ في هذه البيئة)، فيثبت آليًّا:
 *   أ — **النقرتان:** من `/tarikh` نقرةٌ واحدةٌ إلى بطاقة القول، ونقرةٌ ثانيةٌ
 *       على عقدةٍ في الشجرة تفتح نصَّ الرواية حرفيًّا — للأقوال الثمانية كلِّها.
 *   ب — **الكسل:** صفرُ طلبٍ لملفّ عنقودٍ في صدر الباب، ولا يُجلب من العناقيد
 *       إلا المفتوحُ منها بعينه.
 *   ج — نصُّ الرواية المعروض يطابق ما في ملفّ العنقود حرفًا.
 *   د — **عنوانُ صفحة الوثيقة** يطابق سطرَ عنوان مصدره حرفًا (استثناءُ س٩)،
 *       و**تأنيسُ العبارة المُعلَنة يُعدّ في الصفحة المرسومة** فيساوي عددَ ورودِ
 *       الأصل في مصدر تلك الصفحة، ولا تبقى منه بقيّةٌ غيرُ مُؤنَّسة (س١٠).
 *
 * يشترط خادمَ معاينةٍ يعمل: `cd js/apps/studio && npm run build && npm run preview`
 * التشغيل: node js/scripts/check-tarikh-ui.mjs [--url http://localhost:4173]
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUB = join(ROOT, "js", "apps", "studio", "public");
const argU = process.argv.indexOf("--url");
const BASE = argU > -1 ? process.argv[argU + 1] : "http://localhost:4173";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9500 + (process.pid % 400);
const PROFILE = `/tmp/cdp-tarikh-gate-${process.pid}`;

const claims = JSON.parse(readFileSync(join(PUB, "tarikh-claims.json"), "utf8"));

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  "--no-first-run", "--disable-gpu", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error("تعذّر تشغيل كروم");
}

function client(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const requests = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id != null) {
      const px = pending.get(m.id);
      if (px) { pending.delete(m.id); m.error ? px.rej(new Error(JSON.stringify(m.error))) : px.res(m.result); }
    } else if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener("open", () => res());
    ws.addEventListener("error", rej);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ready, send, requests, close: () => ws.close() };
}

async function ev(c, expression) {
  const r = await c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function until(c, expr, label, timeout = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await ev(c, expr)) return true; } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error(`انتظارٌ فات وقتُه: ${label}`);
}

const detail = { claims: [], lazy: {} };
try {
  const c = client(await target());
  await c.ready;
  await c.send("Page.enable"); await c.send("Runtime.enable"); await c.send("Network.enable");
  await c.send("Network.setCacheDisabled", { cacheDisabled: true });
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  // ——— أ+ب: صدرُ الباب — بطاقاتٌ ثمانٍ وصفرُ عنقودٍ مشحون ———
  const mark = c.requests.length;
  await c.send("Page.navigate", { url: `${BASE}/#/tarikh` });
  await until(c, "!document.querySelector('.boot') && !!document.querySelector('.tarikh .cards .card')", "صدرُ الباب");
  await sleep(600);
  const nCards = await ev(c, "document.querySelectorAll('.tarikh .cards .card').length");
  ok(nCards === claims.claims.length, `صدرُ الباب يعرض ${nCards} بطاقةً لا ${claims.claims.length}`);
  // لكلِّ بطاقةٍ شارةُ درجة: في ترويستها، أو على حكمها إن كانت مُصدَّرةً بأحكامها
  const nChips = await ev(c, "[...document.querySelectorAll('.tarikh .cards .card')].filter((x) => x.querySelector('.gchip:not(.more)')).length");
  ok(nChips === claims.claims.length, `بطاقاتٌ بشارةِ درجة ${nChips} لا ${claims.claims.length}`);

  // ——— التوجيهُ التحريريّ (قرارُ الإدارة س٧): بطاقةُ القول الثامن في متصفّحٍ حقيقيّ ———
  for (const [i, cl] of claims.claims.entries()) {
    const sel = `document.querySelectorAll('.tarikh .cards .card')[${i}]`;
    if (cl.leadWithRulings) {
      const parts = await ev(c, `${sel}.querySelectorAll('.split .cl').length`);
      ok(parts === cl.rulings.length, `${cl.id}: بطاقتُه تُظهر ${parts} شقًّا لا ${cl.rulings.length}`);
      const txt = await ev(c, `${sel}.textContent`);
      for (const r of cl.rulings) {
        const head = r.raw.replace(/\*\*/g, "").slice(0, 40);
        ok(txt.includes(head), `${cl.id}: شقُّ الحكم غيرُ ظاهرٍ في البطاقة («${head}…»)`);
      }
      detail.card = { id: cl.id, parts };
    }
    for (const w of cl.readWith ?? []) {
      const has = await ev(c, `${sel}.querySelector('.readwith')?.textContent ?? ''`);
      ok(has.includes(w.id) && has.includes(w.witness), `${cl.id}: «يُقرأ مع ${w.id}» غيرُ ظاهرٍ في بطاقته`);
    }
  }
  const onIndex = c.requests.slice(mark).filter((u) => u.includes("tarikh-cluster-"));
  ok(onIndex.length === 0, `صدرُ الباب جلب ${onIndex.length} عنقودًا قبل طلبها`);
  detail.lazy.index = onIndex.length;
  ok(await ev(c, "!!document.querySelector('.tarikh .tl .pt')"), "لا سطرَ زمنيًّا في صدر الباب");

  // ——— لكلِّ قول: نقرةٌ إلى صفحته، ثمّ نقرةٌ على عقدةٍ تفتح نصَّ روايته ———
  for (const [i, claim] of claims.claims.entries()) {
    await c.send("Page.navigate", { url: `${BASE}/#/tarikh` });
    await until(c, "!!document.querySelector('.tarikh .cards .card')", "صدرُ الباب");
    await sleep(250);
    const before = c.requests.length;

    // النقرةُ الأولى — من الفهرس إلى الدعوى، بلا مسارٍ وسيط
    await ev(c, `document.querySelectorAll('.tarikh .cards .card')[${i}].click()`);
    await until(c, "location.hash.startsWith('#/tarikh/d/')", `فتحُ ${claim.id}`);
    const hash = await ev(c, "decodeURIComponent(location.hash)");
    ok(hash === `#${claim.route}`, `${claim.id}: النقرةُ الأولى قادت إلى ${hash}`);

    // «يُقرأ مع»: رابطٌ حيٌّ في صفحة القول يقود إلى أخيه
    for (const w of claim.readWith ?? []) {
      const href = await ev(c, `[...document.querySelectorAll('.tarikh .readwith a')].map((a) => a.getAttribute('href')).join(' ')`);
      ok(href.includes(encodeURI(w.route)) || href.includes(w.route),
        `${claim.id}: صفحتُه لا تحمل رابطَ «يُقرأ مع» إلى ${w.id}`);
    }

    const clusters = claim.clusters.filter((x) => x.inSnapshot);
    const row = { id: claim.id, clusters: clusters.length, twoClicks: null, fetched: [] };
    if (clusters.length === 0) {
      // قولٌ بلا شجرة: حدودُه وما يغيّر درجتَه ظاهرةٌ في الصفحة نفسِها
      await until(c, "!!document.querySelector('.tarikh .block .wcard')", `${claim.id}: ذيلُ الصفحة`);
      row.twoClicks = "لا شجرةَ لهذا القول في الوثيقة";
      detail.claims.push(row);
      continue;
    }
    await until(c, "!!document.querySelector('.tarikh .tree .tnode')", `${claim.id}: الشجرة`);
    await sleep(400);
    const fetched = c.requests.slice(before).filter((u) => u.includes("tarikh-cluster-"))
      .map((u) => u.split("/").pop().split("?")[0]);
    row.fetched = fetched;
    ok(fetched.length === 1, `${claim.id}: جُلب ${fetched.length} عنقودًا والمفتوحُ واحد`);
    ok(fetched[0] === `tarikh-cluster-${clusters[0].id}.json`, `${claim.id}: جُلب عنقودٌ غيرُ المفتوح (${fetched[0]})`);

    // النقرةُ الثانية — عقدةٌ ذاتُ سجلّ تفتح لوحتَها بنصّ الرواية
    const idx = await ev(c, `(() => {
      const g = [...document.querySelectorAll('.tarikh .tree .tnode')];
      return g.findIndex((el) => true);
    })()`);
    ok(idx >= 0, `${claim.id}: لا عقدةَ في الشجرة`);
    // أوّلُ عقدةٍ نقرُها يفتح لوحةً فيها نصٌّ — تُجرَّب العقدُ حتى تُفتح واحدة
    let opened = false, text = "";
    const n = await ev(c, "document.querySelectorAll('.tarikh .tree .tnode').length");
    for (let k = 0; k < Math.min(n, 8) && !opened; k++) {
      await ev(c, `document.querySelectorAll('.tarikh .tree .tnode')[${k}].dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
      await sleep(250);
      text = await ev(c, "document.querySelector('.tarikh .np .rec .txt')?.textContent ?? ''");
      if (text.length > 40) opened = true;
      else await ev(c, "document.querySelector('.tarikh .np .np-h button')?.click()");
    }
    ok(opened, `${claim.id}: النقرةُ الثانية لم تفتح نصَّ روايةٍ`);
    row.twoClicks = opened ? `نصٌّ بطول ${text.length}` : "أخفقت";

    // ——— ج: النصُّ المعروض يطابق ملفَّ العنقود حرفًا ———
    if (opened) {
      const cl = JSON.parse(readFileSync(join(PUB, `tarikh-cluster-${clusters[0].id}.json`), "utf8"));
      const found = cl.records.some((r) => r.fullText === text);
      ok(found, `${claim.id}: النصُّ المعروض لا يطابق سجلًّا في ملفّ العنقود حرفًا`);
      row.verbatim = found;
    }
    detail.claims.push(row);
  }

  // ——— صفحةُ الوثيقة الكاملة ———
  await c.send("Page.navigate", { url: `${BASE}/#/tarikh/wathiqa` });
  await until(c, "!!document.querySelector('.tarikh .doc h1')", "صفحةُ الوثيقة");
  const docLen = await ev(c, "document.querySelector('.tarikh .doc').textContent.length");
  const hukm = JSON.parse(readFileSync(join(PUB, "tarikh-hukm.json"), "utf8"));
  ok(docLen > hukm.markdown.length * 0.7, `صفحةُ الوثيقة ناقصة: ${docLen} حرفًا من ${hukm.markdown.length}`);
  detail.doc = { rendered: docLen, source: hukm.markdown.length };

  // ——— عنوانُ الوثيقة: إصدارتُها كما في مصدرها حرفًا (استثناءُ س٩) ———
  const h1 = await ev(c, "document.querySelector('.tarikh .doc h1').textContent.trim()");
  const srcH1 = hukm.markdown.split("\n")[0].replace(/^#\s+/, "").trim();
  ok(h1 === srcH1, `عنوانُ صفحة الوثيقة «${h1}» لا يطابق مصدرَه «${srcH1}»`);
  detail.title = h1;

  /**
   * ——— تأنيسُ العبارة المُعلَنة: **عدٌّ في الصفحة المرسومة** (إذنُ س١٠) ———
   *
   * لا يُصدَّق التأنيسُ بإعلانِ خريطةٍ في الكود: يُعدّ ما ظهر منه للعين.
   * فلكلِّ صفحةٍ: عددُ تطبيقاته في نصّها المرسوم = عددُ ورودِ الأصل في مصدر
   * تلك الصفحة بعينه، **وصفرُ بقيّةٍ** من الأصل في المرسوم. فلو عُطّلت
   * الخريطةُ سقط العدُّ الأوّل، ولو تكاثرت سقط الثاني.
   */
  const [PH_FROM, PH_TO] = ["— تحقق خ٦/ب", "— تحقّق آليّ في مستودع البحث"];
  const countIn = (s, needle) => s.split(needle).length - 1;
  const domCount = async (sel, needle) =>
    ev(c, `(document.querySelector(${JSON.stringify(sel)})?.textContent ?? "").split(${JSON.stringify(needle)}).length - 1`);
  detail.humanized = [];
  {
    const srcN = countIn(hukm.markdown, PH_FROM);
    const shown = await domCount(".tarikh .doc", PH_TO);
    const left = await domCount(".tarikh .doc", PH_FROM);
    ok(srcN > 0, "مصدرُ صفحة الوثيقة لا يحمل أصلَ التأنيس — الفحصُ بلا مادّة");
    ok(shown === srcN, `صفحةُ الوثيقة: تطبيقاتُ التأنيس ${shown} وورودُ الأصل في مصدرها ${srcN}`);
    ok(left === 0, `صفحةُ الوثيقة: بقي من الأصل ${left} موضعًا غيرَ مُؤنَّس`);
    detail.humanized.push({ page: "wathiqa", source: srcN, shown, left });
  }
  {
    // وصفحةُ القول الذي فيه الموضعُ: تُعدّ فيها بمصدر أحكامها المرسومة
    const claim = claims.claims.find((x) => x.rulings.some((r) => r.raw.includes(PH_FROM)));
    ok(!!claim, `لا قولَ في الفهرس يحمل «${PH_FROM}» في أحكامه`);
    if (claim) {
      const srcN = countIn(claim.rulings.map((r) => r.raw).join("\n"), PH_FROM);
      await c.send("Page.navigate", { url: `${BASE}/#${claim.route}` });
      await until(c, "!!document.querySelector('.tarikh .verdict .r')", `صفحةُ ${claim.id}`);
      const shown = await domCount(".tarikh .verdict", PH_TO);
      const left = await domCount(".tarikh .verdict", PH_FROM);
      ok(shown === srcN, `${claim.id}: تطبيقاتُ التأنيس في حكمه ${shown} وورودُ الأصل في مصدره ${srcN}`);
      ok(left === 0, `${claim.id}: بقي من الأصل ${left} موضعًا غيرَ مُؤنَّس في حكمه`);
      detail.humanized.push({ page: claim.id, source: srcN, shown, left });
    }
  }

  c.close();
} catch (e) {
  fails.push(`خطأ التشغيل: ${e.message}`);
} finally {
  chrome.kill();
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}

const out = join(ROOT, "js", "data", "tarikh-sources", "GATE-UI.json");
writeFileSync(out, JSON.stringify({ ok: fails.length === 0, base: BASE, detail, failures: fails }, null, 2));
for (const f of fails) console.log(`  · ${f}`);
console.log(`${fails.length === 0 ? "✓" : "✗"} فحصُ الواجهة (النقرتان + الكسل) — التقرير: ${out}`);
process.exit(fails.length === 0 ? 0 : 1);
