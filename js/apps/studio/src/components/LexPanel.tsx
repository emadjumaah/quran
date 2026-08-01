/**
 * معاجمُ المادّة — الصحاحُ وأساسُ البلاغة ولسانُ العرب، مرتَّبةً بالأقدميّة.
 *
 * علّتُه: عند الجذر كان يُعرض معجمٌ واحدٌ من معجمَينا القرآنيَّين (المفردات
 * والمقاييس)، وأُدخلت بعدَها ثلاثةُ معاجمَ من معاجم اللغة العامّة تغطّي
 * ٨٦–٩٠٪ من جذور المصحف — فبقيت لا تُقرأ. وهذا موضعُها.
 *
 * والأقدمُ مقدَّمٌ (ميثاق الفحص، الرتبة ٢: «حجّةٌ في المعنى الوضعيّ، وتقديمُ
 * الأقدم عند الاختلاف») — فالجوهريُّ قبل الزمخشريِّ قبل ابن منظور.
 */
import { useEffect, useState } from "react";
import { getUILang, num } from "../i18n";
import { type RefHit, refsForRoot } from "../lib/refs";

export default function LexPanel({ root }: { root: string }) {
  const ar = getUILang() === "ar";
  const [hits, setHits] = useState<RefHit[] | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    setHits(null);
    refsForRoot(root).then((h) => { setHits(h); setShown(h[0]?.book.id ?? null); }).catch(() => setHits([]));
  }, [root]);

  if (!hits?.length) return null;

  return (
    <div className="card lex-panel" style={{ marginTop: 16 }}>
      <style>{`
        .lex-panel { --l: color-mix(in oklab, currentColor 12%, transparent); }
        .lex-panel h3 { margin: 0 0 4px; }
        .lex-panel .lp-hint { opacity: .6; font-size: .84rem; margin: 0 0 6px; line-height: 1.7; }
        .lex-panel .lp-b { border-bottom: 1px solid var(--l); }
        .lex-panel .lp-b:last-child { border-bottom: 0; }
        .lex-panel .lp-b > button { display: flex; align-items: baseline; gap: 8px; width: 100%;
          background: none; border: 0; color: inherit; font: inherit; text-align: start;
          padding: 9px 2px; cursor: pointer; flex-wrap: wrap; }
        .lex-panel .lp-nm { font-weight: 600; }
        .lex-panel .lp-au { opacity: .58; font-size: .87rem; }
        .lex-panel .lp-x { padding: 0 2px 12px; line-height: 2.05; opacity: .88; font-size: .95rem; }
      `}</style>
      <h3>{ar ? "المعاجم" : "Lexicons"}</h3>
      <p className="lp-hint">
        {ar ? "مداخلُ هذه المادّة في معاجم اللغة، والأقدمُ مقدَّم." : "This root in the classical lexicons, oldest first."}
      </p>
      {hits.map((h) => (
        <div className="lp-b" key={h.book.id}>
          <button onClick={() => setShown(shown === h.book.id ? null : h.book.id)}>
            <span className="lp-nm">{h.book.label}</span>
            <span className="lp-au">{h.book.author}{h.book.died ? ` (ت ${num(h.book.died)})` : ""}</span>
          </button>
          {shown === h.book.id && <div className="lp-x">{h.texts.join(" ")}</div>}
        </div>
      ))}
    </div>
  );
}
