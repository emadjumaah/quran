/**
 * InlineOmni — the on-page search bar for the reader (the "main page"). Same
 * look as the PageSearch bar on every content page, and the same brain as the
 * ⌘K omnibox (src/omni.ts) — but inline, not a popup: type a surah, ayah, juz,
 * page, root or phrase and pick a jump target from the dropdown beneath it.
 *
 * **وبـ`ask` يصير الحقلَ الجامعَ في الصفحة الأولى** (ف٥ §١): **حقلٌ واحدٌ لا
 * حقلان** — اللفظُ والآيةُ إلى البحث القائم كما هو، **والسؤالُ إلى «اسأل
 * مشكاة»**؛ فيُضاف صفٌّ واحدٌ إلى نتائج الحقل نفسِه: يتصدّرها إن كان المكتوبُ
 * استفهامًا، ويُذيّلها وإلّا — فيبقى البابُ مفتوحًا لمن أراده ولو لم يستفهم.
 * **ولا يُمَسّ منطقُ البحث ولا منطقُ المساعد**: هذا ترتيبُ صفٍّ في قائمةٍ لا
 * غير، والسؤالُ يصل إلى حقل المساعد مكتوبًا فيراه صاحبُه قبل أن يذهب.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUILang, t, useUILang } from "../i18n";
import { useOmniResults, type OmniItem } from "../omni";

/** صفُّ «اسأل مشكاة» يُزاد على صفوف الحقل — ولا يُغيَّر نوعُ صفوفه */
type Row = Omit<OmniItem, "kind"> & { kind: OmniItem["kind"] | "ask" };

/**
 * **أَسؤالٌ هو؟** — علامتان لا اجتهادَ فيهما: علامةُ الاستفهام، أو صدرٌ من
 * أدوات الاستفهام في جملةٍ لا في كلمتين (فـ«من الرحمن» لفظان يُبحث عنهما،
 * و«من هو الرحمن» سؤالٌ يُسأل عنه). **ولا حدَّ كلمةٍ (`\b`) مع العربيّة**
 * (بلاغُ 2026-08-12): المقابلةُ على أوّل كلمةٍ بعد تجريد حركاتها، مساواةً
 * تامّةً لا احتواء.
 *
 * **وخطؤه لا يضيع شيئًا**: هذه رتبةُ صفٍّ لا مصير؛ فصفوفُ البحث كلُّها باقيةٌ
 * تحته، وصفُّ السؤال باقٍ ولو لم يُصَب.
 */
const ASK_HEADS_AR = ["هل", "ما", "ماذا", "لماذا", "لم", "لمَ", "كيف", "متى", "أين", "أي", "أيّ", "كم", "من", "أليس", "أهو", "أهي"];
const ASK_HEADS_EN = ["what", "why", "how", "who", "when", "where", "which", "is", "are", "does", "do", "did", "can"];
const TASHKIL = /[\u064B-\u0652\u0670]/g;
export function isQuestion(raw: string): boolean {
  const q = raw.trim();
  if (!q) return false;
  if (/[؟?]$/.test(q)) return true;
  const words = q.split(/\s+/);
  if (words.length < 3) return false;
  const head = words[0].replace(TASHKIL, "").toLowerCase();
  return ASK_HEADS_AR.includes(head) || ASK_HEADS_EN.includes(head);
}

export default function InlineOmni({
  placeholder,
  autoFocus,
  onNavigate,
  ask,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  /** الحقلُ الجامعُ في الصفحة الأولى: يُزاد عليه بابُ «اسأل مشكاة» */
  ask?: boolean;
}) {
  useUILang();
  const ar = getUILang() === "ar";
  // الحقلُ على الجوال ضيّق — فالنصُّ الإرشاديُّ يُختصر (قرار المالك 2026-07-21)
  const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const found = useOmniResults(q);
  const items = useMemo<Row[]>(() => {
    const query = q.trim();
    if (!ask || !query) return found;
    const row: Row = {
      key: "ask",
      kind: "ask",
      label: (ar ? "اسألْ مشكاة: " : "Ask Mishkat: ") + query,
      to: `/assistant?q=${encodeURIComponent(query)}`,
    };
    return isQuestion(query) ? [row, ...found] : [...found, row];
  }, [ask, q, found, ar]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setActive(0), [items]);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // dismiss the dropdown on outside-click
  useEffect(() => {
    if (!focused) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [focused]);

  const show = focused && q.trim() !== "" && items.length > 0;
  const go = (to: string) => {
    setQ("");
    setFocused(false);
    onNavigate?.();
    navigate(to);
  };

  return (
    <div className="inline-omni" ref={wrapRef}>
      <div className="page-search">
        <span className="page-search-icon" aria-hidden>⌕</span>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder ?? (narrow ? (ar ? "ابحث…" : "search…") : (ar ? "ابحث في القرآن، أو اذهب إلى سورة أو آية…" : "search the Qur'an, or go to a surah/ayah…"))}
          aria-label={ar ? "البحث والانتقال" : "search & jump"}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && items[active]) {
              e.preventDefault();
              go(items[active].to);
            } else if (e.key === "Escape") {
              setFocused(false);
            }
          }}
        />
        {q && (
          <button className="page-search-clear" onClick={() => setQ("")} aria-label={ar ? "مسح" : "clear"}>
            ✕
          </button>
        )}
      </div>
      {show && (
        <div className="inline-omni-results" role="listbox">
          {items.map((item, i) => (
            <div
              key={item.key}
              role="option"
              aria-selected={i === active}
              onClick={() => go(item.to)}
              onMouseEnter={() => setActive(i)}
              className={`inline-omni-row${i === active ? " active" : ""}`}
            >
              {/* لا وسومَ («نص/معنى» حشوٌ — رصد المالك): الموضعُ وحدَه رأسًا
                  صغيرًا، والآيةُ تحته كاملةَ العرض تلتفّ ولا تُبتر */}
              {item.sub && <div className="inline-omni-sub">{item.sub}</div>}
              <div
                className={
                  (item.kind === "text" || item.kind === "root" ? "quran " : "") +
                  "inline-omni-label" +
                  (item.key === "all-text" || item.kind === "meaning" ? " inline-omni-cta" : "") +
                  (item.kind === "ask" ? " inline-omni-ask" : "")
                }
                dir={item.kind === "text" || item.kind === "root" ? "rtl" : undefined}
              >
                {item.kind === "ask" && <span className="ai-spark" aria-hidden />}
                {item.segs
                  ? item.segs.map((g, gi) => (
                      <span key={gi} className={g.hit ? "omni-hit" : undefined}>{g.text}{" "}</span>
                    ))
                  : item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
