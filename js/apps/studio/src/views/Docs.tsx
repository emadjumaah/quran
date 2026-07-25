/**
 * توثيقُ مشكاة — صفحةٌ واحدةٌ للمختصّ تشرح كلَّ جزءٍ في المشروع: ما هو، وكيف
 * أُنجز، وبكم رقمٍ، وما حدودُه المعلنة. المضمون في docsContent.ts (كلُّ رقمٍ
 * فيه منقولٌ من مخرجات البناء)، وهنا العرضُ وحده. المسار: /docs.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUILang, num, useUILang } from "../i18n";
import { DOC_INTRO, DOC_OPEN, DOC_SANAD, DOC_SECTIONS } from "../docsContent";

export default function Docs() {
  useUILang();
  const ar = getUILang() === "ar";
  const [active, setActive] = useState<string>(DOC_SECTIONS[0].id);

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

  if (!ar) {
    return (
      <div className="page">
        <div className="jw-wrap">
          <h1 className="jw-title">Documentation</h1>
          <p className="jw-lead">The full documentation is written in Arabic — switch the interface language to read it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="jw-wrap">
        <header className="jw-header dc-header">
          <div className="dc-eyebrow">توثيقُ المشروع</div>
          <h1 className="jw-title">كيف بُنيت مشكاة</h1>
          <p className="jw-lead">{DOC_INTRO}</p>
          <div className="dc-sanad">
            {DOC_SANAD.map((g) => (
              <div className="dc-sanad-i" key={g.k}>
                <b>{g.k}</b>
                <span>{g.d}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="dc-body">
          <nav className="dc-toc" aria-label="فهرس التوثيق">
            <div className="dc-toc-h">الفهرس</div>
            {DOC_SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className={`dc-toc-a${active === s.id ? " on" : ""}`}>
                <span className="dc-toc-n">{num(i + 1)}</span> {s.title}
              </a>
            ))}
            <a href="#open" className={`dc-toc-a${active === "open" ? " on" : ""}`}>
              <span className="dc-toc-n">•</span> ما لم يتمَّ بعد
            </a>
          </nav>

          <div className="dc-main">
            {DOC_SECTIONS.map((s, i) => (
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
                  <div className="dc-q">ما هو</div>
                  <p className="dc-a">{s.what}</p>
                </div>
                <div className="dc-qa">
                  <div className="dc-q">كيف أُنجز</div>
                  <p className="dc-a">{s.how}</p>
                </div>
                {s.limits && (
                  <div className="dc-qa dc-lim">
                    <div className="dc-q">حدودُه</div>
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
                <h2 className="dc-h2">ما لم يتمَّ بعد</h2>
              </div>
              <p className="dc-lead">
                ما دون هذا معلومٌ عندنا وموضوعٌ هنا لأنّ إخفاءَه أسوأُ من ذكره — والعهدُ أن نَنشر النتيجةَ السالبةَ كما ننشر الموجبة.
              </p>
              <ul className="dc-open">
                {DOC_OPEN.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
              <div className="dc-links">
                <Link to="/about" className="chip link">عن المشروع وميثاقُ البيانات ←</Link>
                <Link to="/assistant" className="chip link">جرّب مشكاة الذكيّ ←</Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
