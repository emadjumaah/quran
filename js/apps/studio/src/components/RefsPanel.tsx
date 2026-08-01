/**
 * مراجعُ الآية — ما قاله أهلُ الصنعة في هذا الموضع، مرتَّبين **بالأقدميّة**.
 *
 * علّتُه: أُدخلت ٢٦ مرجعًا في خمس رتب (إعرابٌ ومعاني قرآنٍ وقراءات)، وكانت
 * لا تُقرأ إلا في صفحة الفحص — فبقيت مخزونةً لا يراها قارئُ المصحف. وهذا
 * موضعُها الطبيعيّ: عند الآية نفسِها.
 *
 * وأصلُ العرض: **لا يُعطى قولٌ واحدٌ في موضع خلاف.** يُوضع المعربون متجاورين
 * فيظهر اختلافُهم إن اختلفوا؛ فمن أعطى قولًا واحدًا حيث اختلفوا أوهم إجماعًا
 * ليس بموجود. ولذلك تُصدَّر بالأقدم: النظرُ في المتقدّم قبل المتأخّر.
 *
 * ولا يُجلب إلا شظيّةُ الموضع (lib/refs) — فلا يُنزَّل مجلَّدٌ لقراءة سطر.
 */
import { useEffect, useState } from "react";
import { getUILang, num } from "../i18n";
import { type RefHit, refsForAyah } from "../lib/refs";

export default function RefsPanel({ location, open }: { location: string; open: boolean }) {
  const ar = getUILang() === "ar";
  const [hits, setHits] = useState<RefHit[] | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHits(null);
    refsForAyah(location, { ranks: [1, 3, 5] })
      .then((h) => { setHits(h); setShown(h[0]?.book.id ?? null); })
      .catch(() => setHits([]));
  }, [location, open]);

  if (!open) return null;
  if (!hits) return <div className="refs-panel muted">…</div>;
  if (!hits.length) {
    return (
      <div className="refs-panel muted">
        {ar ? "لا مدخلَ لهذا الموضع عند المراجع المرساةِ بالآية — والتغطيةُ ٩٠٪ لا ١٠٠٪." : "No entry for this verse in the anchored references."}
      </div>
    );
  }

  return (
    <div className="refs-panel">
      <style>{`
        .refs-panel { --l: color-mix(in oklab, currentColor 12%, transparent); font-size: .95rem; }
        .refs-panel .rp-hint { opacity: .6; font-size: .84rem; line-height: 1.7; margin: 0 0 8px; }
        .refs-panel .rp-b { border-bottom: 1px solid var(--l); }
        .refs-panel .rp-b:last-child { border-bottom: 0; }
        .refs-panel .rp-b > button { display: flex; align-items: baseline; gap: 8px; width: 100%;
          background: none; border: 0; color: inherit; font: inherit; text-align: start;
          padding: 9px 2px; cursor: pointer; flex-wrap: wrap; }
        .refs-panel .rp-nm { font-weight: 600; }
        .refs-panel .rp-au { opacity: .58; font-size: .87rem; }
        .refs-panel .rp-rk { margin-inline-start: auto; opacity: .45; font-size: .76rem; white-space: nowrap; }
        .refs-panel .rp-x { padding: 0 2px 12px; }
        .refs-panel .rp-x p { margin: 0 0 8px; line-height: 2.05; opacity: .88; }
      `}</style>
      <p className="rp-hint">
        {ar
          ? <>{num(hits.length)} مرجعًا لهذا الموضع، مرتَّبةً بالأقدميّة. وإن اختلفوا فالخلافُ يُعرض ولا يُكتم.</>
          : <>{hits.length} references for this verse, oldest first. Where they differ, the difference is shown.</>}
      </p>
      {hits.map((h) => (
        <div className="rp-b" key={h.book.id}>
          <button onClick={() => setShown(shown === h.book.id ? null : h.book.id)}>
            <span className="rp-nm">{h.book.label}</span>
            <span className="rp-au">{h.book.author}{h.book.died ? ` (ت ${num(h.book.died)})` : ""}</span>
            <span className="rp-rk">{ar ? `الرتبة ${num(h.book.rank)}` : `rank ${h.book.rank}`}</span>
          </button>
          {shown === h.book.id && (
            <div className="rp-x">{h.texts.map((x, i) => <p key={i}>{x}</p>)}</div>
          )}
        </div>
      ))}
    </div>
  );
}
