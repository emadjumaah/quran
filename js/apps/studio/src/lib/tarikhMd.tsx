/**
 * عارضُ المقاطع المنقولة حرفًا من الوثيقة المختومة.
 *
 * المقاطعُ تُخزَّن في ملفّات العرض **كما هي في v1** — بتوكيدها `**…**` وشيفراتها
 * `` `…` `` — كي يمكن فحصُها آليًّا بالمطابقة الحرفيّة مع المصدر. فوظيفةُ هذا
 * العارض إظهارُ تلك العلامات لا أكثر: توكيدٌ وشيفرةٌ وفقراتٌ وقوائم. لا يُضاف
 * حرفٌ ولا يُحذف.
 */
import type { ReactNode } from "react";
import { humanize, tagRender, tidy, type ClusterLabels } from "./tarikhIds";

/** فهرسُ ألقاب العناقيد — يُضبط مرّةً عند تحميل البيانات، فيراه كلُّ عارض */
let LABELS: ClusterLabels | undefined;
export const setClusterLabels = (m: ClusterLabels) => { LABELS = m; };

/**
 * عزلُ المقاطع اللاتينية داخل النصّ العربيّ — أسماءُ الباحثين وأوعيةُ النشر
 * وأرقامُها تنقلب فتُقرأ مبعثرةً إن تُركت لخوارزمية الاتجاهين. النصُّ لا يتغيّر
 * حرفًا: يُلَفّ في `<bdi dir="ltr">` فحسب.
 */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9 .,'’"“”&:;/()[\]\-–—]*[A-Za-z0-9.)\]]/g;
function isolateLatin(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, i = 0;
  LATIN_RUN.lastIndex = 0;
  while ((m = LATIN_RUN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<bdi key={`${keyPrefix}l${i++}`} dir="ltr">{m[0]}</bdi>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

/**
 * التوكيدُ والشيفرةُ داخل السطر — ومعهما تأنيسُ المعرّفات: يُبدَّل معرّفُ
 * العنقود باسم أقدمِ كتابٍ فيه، وتُطوى أعلامُ الجودة ومعرّفاتُ الرواة
 * والسجلات. البياناتُ تبقى حرفًا، والتأنيسُ في العرض وحدَه (tarikhIds.ts).
 */
export function inlineMd(text: string, keyPrefix = ""): ReactNode[] {
  // ١) الوسومُ وأعلامُ الجودة: تُسمّى بالعربيّة أو تُطوى، والقوسُ يُنظَّف إن فرغ
  const stripped = tidy(text.replace(/`([^`]+)`/g, (whole, code: string) => {
    const r = tagRender(code);
    return r === null ? whole : r ? `«${r}»` : "";
  }));
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  const plain = (t: string, k: string) => isolateLatin(humanize(t, LABELS), k);
  while ((m = re.exec(stripped))) {
    if (m.index > last) out.push(...plain(stripped.slice(last, m.index), `${keyPrefix}${i}p`));
    if (m[1] !== undefined) out.push(<b key={`${keyPrefix}b${i++}`}>{plain(m[1], `${keyPrefix}b${i}`)}</b>);
    else out.push(<code key={`${keyPrefix}c${i++}`} dir="ltr">{humanize(m[2], LABELS)}</code>);
    last = m.index + m[0].length;
  }
  if (last < stripped.length) out.push(...plain(stripped.slice(last), `${keyPrefix}${i}e`));
  return out;
}

interface Block { kind: "p" | "ul" | "ol" | "h1" | "h2" | "h3" | "hr" | "quote"; text?: string; items?: string[] }

/** تقطيعُ مقطعٍ منقولٍ إلى فقراتٍ وقوائمَ وعناوين — بأدنى ما يكفي لوثيقتنا */
export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split("\n");
  let para: string[] = [], list: string[] | null = null, listKind: "ul" | "ol" = "ul";
  const flushPara = () => { if (para.length) { blocks.push({ kind: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list) { blocks.push({ kind: listKind, items: list }); list = null; } };
  for (const raw of lines) {
    const ln = raw.trimEnd();
    const t = ln.trim();
    if (!t) { flushPara(); flushList(); continue; }
    if (/^---+$/.test(t)) { flushPara(); flushList(); blocks.push({ kind: "hr" }); continue; }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^###\s+(.+)$/))) { flushPara(); flushList(); blocks.push({ kind: "h3", text: m[1] }); continue; }
    if ((m = t.match(/^##\s+(.+)$/))) { flushPara(); flushList(); blocks.push({ kind: "h2", text: m[1] }); continue; }
    if ((m = t.match(/^#\s+(.+)$/))) { flushPara(); flushList(); blocks.push({ kind: "h1", text: m[1] }); continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { flushPara(); flushList(); blocks.push({ kind: "quote", text: m[1] }); continue; }
    if ((m = t.match(/^-\s+(.+)$/))) {
      flushPara();
      if (list && listKind !== "ul") flushList();
      listKind = "ul"; (list ??= []).push(m[1]);
      continue;
    }
    if ((m = t.match(/^\d+\.\s+(.+)$/))) {
      flushPara();
      if (list && listKind !== "ol") flushList();
      listKind = "ol"; (list ??= []).push(m[1]);
      continue;
    }
    // سطرُ متابعةٍ لبندِ قائمة (إزاحةٌ بمسافات) يُلحق ببنده
    if (list && /^\s{2,}\S/.test(ln)) { list[list.length - 1] += ` ${t}`; continue; }
    flushList();
    para.push(t);
  }
  flushPara(); flushList();
  return blocks;
}

/** عرضُ مقطعٍ منقولٍ بفقراته وقوائمه */
export function Md({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === "hr") return <hr key={i} />;
        if (b.kind === "h1") return <h1 key={i}>{inlineMd(b.text!, `${i}-`)}</h1>;
        if (b.kind === "h2") return <h2 key={i}>{inlineMd(b.text!, `${i}-`)}</h2>;
        if (b.kind === "h3") return <h3 key={i}>{inlineMd(b.text!, `${i}-`)}</h3>;
        if (b.kind === "quote") return <blockquote key={i}>{inlineMd(b.text!, `${i}-`)}</blockquote>;
        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind === "ul" ? "ul" : "ol";
          return (
            <List key={i}>
              {b.items!.map((it, j) => <li key={j}>{inlineMd(it, `${i}-${j}-`)}</li>)}
            </List>
          );
        }
        return <p key={i}>{inlineMd(b.text!, `${i}-`)}</p>;
      })}
    </div>
  );
}
