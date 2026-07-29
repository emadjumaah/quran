/**
 * توثيقُ مشكاة — صفحةٌ واحدةٌ للمختصّ تشرح كلَّ جزءٍ في المشروع: ما هو، وكيف
 * أُنجز، وبكم رقمٍ، وما حدودُه المعلنة. المضمون في docsContent.ts (كلُّ رقمٍ
 * فيه منقولٌ من مخرجات البناء)، وهنا العرضُ وحده. المسار: /docs.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUILang, num, useUILang } from "../i18n";
import { DOC_INTRO, DOC_OPEN, DOC_SANAD, DOC_SECTIONS, type DocSection } from "../docsContent";

/** التوثيقُ بالإنجليزية (docs-en.json) — ترجمةٌ مولَّدةٌ بمراجعة عددٍ وترتيب،
 *  تُجلب عند فتح الصفحة بواجهة EN؛ وإن غابت بقيت المعذرةُ القديمة. */
interface DocsEn {
  intro: string;
  sanad: { k: string; d: string }[];
  sections: DocSection[];
  open: string[];
}
let docsEn: DocsEn | null = null;
let docsEnLoading: Promise<DocsEn | null> | null = null;
function loadDocsEn(): Promise<DocsEn | null> {
  if (docsEn) return Promise.resolve(docsEn);
  docsEnLoading ??= fetch(`${import.meta.env.BASE_URL}docs-en.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: DocsEn | null) => (docsEn = d))
    .catch(() => null);
  return docsEnLoading;
}

export default function Docs() {
  useUILang();
  const ar = getUILang() === "ar";
  const [active, setActive] = useState<string>(DOC_SECTIONS[0].id);
  const [en, setEn] = useState<DocsEn | null>(docsEn);
  useEffect(() => {
    if (!ar) loadDocsEn().then(setEn);
  }, [ar]);
  const INTRO = ar ? DOC_INTRO : (en?.intro ?? DOC_INTRO);
  const SANAD = ar ? DOC_SANAD : (en?.sanad ?? DOC_SANAD);
  const SECTIONS = ar ? DOC_SECTIONS : (en?.sections ?? DOC_SECTIONS);
  const OPEN = ar ? DOC_OPEN : (en?.open ?? DOC_OPEN);

  // القسمُ الظاهرُ يُضيء في الفهرس — مراقبةٌ واحدةٌ لكلِّ الأقسام
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]?.target.id) setActive(vis[0].target.id);
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 },
    );
    for (const s of DOC_SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  if (!ar && !en) {
    return (
      <div className="page">
        <div className="jw-wrap">
          <h1 className="jw-title">Documentation</h1>
          <p className="jw-lead muted">Loading the English documentation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" dir={ar ? "rtl" : "ltr"}>
      <div className="jw-wrap">
        <header className="jw-header dc-header">
          <div className="dc-eyebrow">{ar ? "توثيقُ المشروع" : "Project documentation"}</div>
          <h1 className="jw-title">{ar ? "كيف بُنيت مشكاة" : "How Mishkāt was built"}</h1>
          <p className="jw-lead">{INTRO}</p>
          <div className="dc-sanad">
            {SANAD.map((g) => (
              <div className="dc-sanad-i" key={g.k}>
                <b>{g.k}</b>
                <span>{g.d}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="dc-body">
          <nav className="dc-toc" aria-label="فهرس التوثيق">
            <div className="dc-toc-h">{ar ? "الفهرس" : "Contents"}</div>
            {SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className={`dc-toc-a${active === s.id ? " on" : ""}`}>
                <span className="dc-toc-n">{num(i + 1)}</span> {s.title}
              </a>
            ))}
            <a href="#open" className={`dc-toc-a${active === "open" ? " on" : ""}`}>
              <span className="dc-toc-n">•</span> {ar ? "ما لم يتمَّ بعد" : "Not done yet"}
            </a>
          </nav>

          <div className="dc-main">
            {SECTIONS.map((s, i) => (
              <section className="dc-sec" id={s.id} key={s.id}>
                <div className="dc-sec-h">
                  <span className="dc-sec-n">{num(i + 1)}</span>
                  <h2 className="dc-h2">{s.title}</h2>
                </div>
                <p className="dc-lead">{s.lead}</p>

                {s.stats && (
                  <div className="dc-stats">
                    {s.stats.map((x) => (
                      <div className="dc-stat" key={x.k}>
                        <b>{x.v}</b>
                        <span>{x.k}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="dc-qa">
                  <div className="dc-q">{ar ? "ما هو" : "What it is"}</div>
                  <p className="dc-a">{s.what}</p>
                </div>
                <div className="dc-qa">
                  <div className="dc-q">{ar ? "كيف أُنجز" : "How it was built"}</div>
                  <p className="dc-a">{s.how}</p>
                </div>
                {s.limits && (
                  <div className="dc-qa dc-lim">
                    <div className="dc-q">{ar ? "حدودُه" : "Its limits"}</div>
                    <p className="dc-a">{s.limits}</p>
                  </div>
                )}

                {s.links && (
                  <div className="dc-links">
                    {s.links.map((l) => (
                      <Link key={l.to} to={l.to} className="chip link">{l.label} ←</Link>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <section className="dc-sec" id="open">
              <div className="dc-sec-h">
                <span className="dc-sec-n">•</span>
                <h2 className="dc-h2">{ar ? "ما لم يتمَّ بعد" : "Not done yet"}</h2>
              </div>
              <p className="dc-lead">
                {ar
                  ? "ما دون هذا معلومٌ عندنا وموضوعٌ هنا لأنّ إخفاءَه أسوأُ من ذكره — والعهدُ أن نَنشر النتيجةَ السالبةَ كما ننشر الموجبة."
                  : "Everything below is known to us and listed because hiding it would be worse than stating it — our covenant is to publish negative results as readily as positive ones."}
              </p>
              <ul className="dc-open">
                {OPEN.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
              <div className="dc-links">
                <Link to="/about" className="chip link">{ar ? "عن المشروع وميثاقُ البيانات ←" : "About & data covenant ←"}</Link>
                <Link to="/assistant" className="chip link">{ar ? "جرّب مشكاة الذكيّ ←" : "Try Ask Mishkāt ←"}</Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
