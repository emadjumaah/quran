/**
 * SettingsPanel — إعداداتُ القراءة. تحرّر مخزنَ الإعدادات الواحد، وكلُّ خيارٍ
 * يسري فورًا.
 *
 * **بُنيت من جديدٍ للّمس لا للفأرة** (أمر المالك 2026-08-14: «صفحةُ الإعدادات
 * كأنّها قادمةٌ من الويب بشكلٍ فجّ، وكلُّ شيءٍ فيها صغير»):
 *   • **على الجوال ورقةٌ ملءَ الشاشة** لها عنوانٌ وزرُّ إغلاقٍ واضح — لا قائمةً
 *     منسدلةً معلَّقةً بأيقونةِ الرأس (ميثاقُ الوجه §١/٢).
 *   • **وعلى الحاسوب تبقى منسدلة** — أوسعَ وأكبرَ خطًّا، **بالسلّم نفسِه**.
 *   • **وسلّمُ الخطّ وأهدافُ اللمس رموزٌ في `theme.css`** (`--set-fs-*` و
 *     `--set-tap`) — **ولا رقمَ خطٍّ مكتوبٌ نصًّا في هذا الملفّ**، فلا يعود
 *     الصغرُ يتسلّل مع الوقت (بوّابةُ الميثاق تحرسه).
 *   • **والترتيبُ بالأولويّة**: ما يُبدَّل كثيرًا أوّلًا، وما يندر يُطوى تحت
 *     «المزيد».
 * **ولم يُحذف إعدادٌ ولم يُغيَّر معناه** — إعادةُ عرضٍ لا إعادةُ وظيفة.
 *
 * ═══ **والورقةُ تُرحَّل من الرأس إلى الشاشة** (ج٩ §١) ═══
 * **الواقعةُ بنصّها**: ج٨ §٣ وضعت `transform` **دائمًا** على `.topbar` (اقترانُ
 * الانسحاب بالسكرول) — و`transform` على عنصرٍ يجعله **حاويةَ الإحداثيّات لكلّ
 * `position: fixed` في أحفاده**. وهذه اللوحةُ تسكن الرأسَ، فصار `inset: 0`
 * فيها **ملءَ الرأس** (٥٥px مقيسةً على المنشور) لا ملءَ الشاشة: يُرى رأسُها
 * ومحتواها مقصوصٌ — وهو الذي بلّغه المالكُ «الإعداداتُ فارغة».
 * **والعلاجُ أن يعود مرجعُها الشاشةَ**: تُرحَّل عند فتحها إلى `document.body`
 * بـ`createPortal` — **العُدّةُ نفسُها التي رحّلت بها ج٨ أدواتِ الرأس**. وقواعدُها
 * في `theme.css` تبقى كما هي فهي صحيحةٌ متى صار مرجعُها الشاشة.
 * **والترحيلُ على عرض الهاتف وحدَه**: على الحاسوب هي منسدلةٌ `absolute` مرجعُها
 * `.set-wrap`، ولا `transform` على رأسٍ هناك أصلًا — فلا يُنقل ما لم ينكسر.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { setSettings, useSettings, type Numerals, type QuranFont, type Script, type Theme } from "../settings";
import { RECITERS, reloadForReciter, setLivePlaybackRate } from "./AudioButton";
import { TAFSIR_SOURCES } from "../books";
import { TAJWID_LEGEND } from "../tajwid";
import { getUILang, num, useUILang } from "../i18n";
import RecitationCredit from "./RecitationCredit";
/** أنساقُ إسناد التلاوة والشريط الجاري — `.tlw-credit*` و`.npb-*` (رخصةُ التلاوات) */
import "../styles/sawt-tilawa.css";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <span className="set-label">
        {label}
        {hint && <span className="set-hint">{hint}</span>}
      </span>
      <span className="set-control">{children}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="set-sec">
      <h3 className="set-group">{title}</h3>
      {children}
    </section>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string; tip?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <span className="set-seg">
      {options.map((o) => (
        <button
          key={o.v}
          className={value === o.v ? "on" : ""}
          onClick={() => onChange(o.v)}
          title={o.tip}
          aria-pressed={value === o.v}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** مفتاحٌ يُلمس بالإبهام — لا مربّعُ تأشيرٍ ١٦px */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="set-switch">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="set-switch-track" aria-hidden />
      {label && <span className="set-switch-note">{label}</span>}
    </label>
  );
}

/** أعرضُ الشاشة عرضُ هاتف؟ — وعنده تصير اللوحةُ ورقةً ملءَ الشاشة (§١) */
function usePhone(): boolean {
  const [m, setM] = useState<boolean>(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export default function SettingsPanel() {
  useUILang();
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  /** **ومرجعُ النقر خارجَها اثنان بعد الترحيل**: الغلافُ في الرأس، واللوحةُ في
   *  `body` — فلو قِيس بالغلاف وحدَه لأغلقت اللوحةُ نفسَها بأوّل لمسةٍ فيها. */
  const panelRef = useRef<HTMLDivElement>(null);
  const phone = usePhone();
  const ar = getUILang() === "ar";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // الورقةُ ملءَ الشاشة تقفل تمريرَ ما خلفها — كي لا يتحرّك المصحفُ تحتها
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("set-sheet-open");
    return () => document.body.classList.remove("set-sheet-open");
  }, [open]);

  /** **الترحيلُ إلى الشاشة** (§١): على الهاتف تُركَّب اللوحةُ في `body` فيعود
   *  مرجعُ `fixed` الشاشةَ لا الرأسَ المتحوِّل؛ وعلى الحاسوب تبقى في غلافها
   *  منسدلةً كما هي. */
  const portalize = (node: React.ReactNode) => (phone ? createPortal(node, document.body) : node);

  return (
    <div className="set-wrap" ref={ref}>
      <button onClick={() => setOpen(!open)} title={ar ? "الإعدادات" : "Settings"} aria-label={ar ? "الإعدادات" : "settings"} aria-expanded={open}>
        {/* المقاسُ والمحاذاةُ من الأنماط لا من JSX (ج٨ §٢أ) — كانت ههنا إزاحةٌ
            يدويّةٌ (`verticalAlign: -4px`) تُزيح هذه وحدَها عن أخواتها */}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>
      {/* `set-reading` يفصل بناءَ هذه اللوحة عن المنسدلة العامّة التي يشترك فيها
          لوحُ العلامات ولوحُ المصادر — فلا يسري تغييرُها إليهما */}
      {open && portalize(
        <div className="set-panel set-reading" ref={panelRef} role="dialog" aria-label={ar ? "إعدادات القراءة" : "Reading settings"}>
          <div className="set-head">
            <span className="set-title">{ar ? "إعدادات القراءة" : "Reading settings"}</span>
            <button className="set-close" onClick={() => setOpen(false)} aria-label={ar ? "إغلاق" : "close"}>✕</button>
          </div>

          <div className="set-body">
            {/* ── ما يُبدَّل كثيرًا: أوّلًا وبلا طيّ ── */}
            <Group title={ar ? "القراءة" : "Reading"}>
              <Row label={`${ar ? "حجم الخط" : "Font size"} · ${num(Math.round(s.quranScale * 100))}%`}>
                <span className="set-stepper">
                  <button
                    onClick={() => setSettings({ quranScale: Math.max(0.8, +(s.quranScale - 0.1).toFixed(2)) })}
                    disabled={s.quranScale <= 0.8}
                    aria-label={ar ? "تصغير" : "smaller"}
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={0.8}
                    max={1.6}
                    step={0.1}
                    value={s.quranScale}
                    onChange={(e) => setSettings({ quranScale: Number(e.target.value) })}
                    aria-label={ar ? "حجم الخط" : "font size"}
                  />
                  <button
                    onClick={() => setSettings({ quranScale: Math.min(1.6, +(s.quranScale + 0.1).toFixed(2)) })}
                    disabled={s.quranScale >= 1.6}
                    aria-label={ar ? "تكبير" : "larger"}
                  >
                    +
                  </button>
                </span>
              </Row>
              <Row label={ar ? "السمة" : "Theme"}>
                <Seg<Theme>
                  value={s.theme}
                  onChange={(v) => setSettings({ theme: v })}
                  options={[
                    { v: "auto", label: ar ? "تلقائي" : "Auto" },
                    { v: "light", label: ar ? "فاتح" : "Light" },
                    { v: "sepia", label: ar ? "ورقي" : "Sepia" },
                    { v: "dark", label: ar ? "داكن" : "Dark" },
                  ]}
                />
              </Row>
              <Row label={ar ? "خطّ المصحف" : "Quran font"}>
                <Seg<QuranFont>
                  value={s.quranFont}
                  onChange={(v) => setSettings({ quranFont: v })}
                  options={[
                    { v: "amiri", label: ar ? "أميري" : "Amiri", tip: ar ? "خطّ أميري: نسخٌ أنيق واضح" : "Amiri: elegant naskh" },
                    { v: "kfgqpc", label: ar ? "المدينة" : "Madina", tip: ar ? "خطّ مجمع الملك فهد: رسم مصحف المدينة" : "KFGQPC: Madina mushaf style" },
                    { v: "scheherazade", label: ar ? "تقليدي" : "Classic", tip: ar ? "خطّ نسخيّ تقليديّ واضح ورصين" : "traditional, clear naskh" },
                  ]}
                />
              </Row>
              <Row label={ar ? "وضع التركيز" : "Focus mode"} hint={ar ? "إخفاء الأدوات" : "hide chrome"}>
                <Switch on={s.focus} onChange={(v) => setSettings({ focus: v })} />
              </Row>
            </Group>

            <Group title={ar ? "التلاوة" : "Recitation"}>
              <Row label={ar ? "القارئ" : "Reciter"}>
                <select
                  className="set-select"
                  value={s.reciter}
                  onChange={(e) => {
                    setSettings({ reciter: e.target.value });
                    reloadForReciter();
                  }}
                  aria-label={ar ? "القارئ" : "reciter"}
                >
                  {Object.entries(RECITERS).map(([key, r]) => (
                    <option key={key} value={key}>
                      {ar ? r.ar : r.en}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label={ar ? "السرعة" : "Speed"}>
                <Seg<string>
                  value={String(s.speed)}
                  onChange={(v) => {
                    setSettings({ speed: Number(v) });
                    setLivePlaybackRate(Number(v));
                  }}
                  options={[
                    { v: "0.75", label: ar ? "٠٫٧٥×" : "0.75×" },
                    { v: "1", label: ar ? "١×" : "1×" },
                    { v: "1.25", label: ar ? "١٫٢٥×" : "1.25×" },
                  ]}
                />
              </Row>
              {/* الإسنادُ ظاهرٌ حيث تُختار التلاوة — شرطُ رخصةٍ لا تحسين */}
              <RecitationCredit source={RECITERS[s.reciter]?.everyayah ? "everyayah" : "cdn"} />
            </Group>

            {/* ── وما يندر يُطوى تحت «المزيد» مفتوحًا بلمسة ── */}
            <button className="set-more" onClick={() => setMore((v) => !v)} aria-expanded={more}>
              <span>{ar ? "المزيد" : "More"}</span>
              <span className={`set-more-caret${more ? " on" : ""}`} aria-hidden>▾</span>
            </button>

            {more && (
              <>
                <Group title={ar ? "النص" : "Text"}>
                  <Row label={ar ? "الرسم" : "Script"}>
                    <Seg<Script>
                      value={s.script}
                      onChange={(v) => setSettings({ script: v })}
                      options={[
                        { v: "uthmani", label: ar ? "عثماني" : "Uthmani" },
                        { v: "imlaai", label: ar ? "إملائي" : "Simple" },
                      ]}
                    />
                  </Row>
                  <Row label={ar ? "الأرقام" : "Numerals"}>
                    <Seg<Numerals>
                      value={s.numerals}
                      onChange={(v) => setSettings({ numerals: v })}
                      options={[
                        { v: "auto", label: ar ? "تلقائي" : "Auto" },
                        { v: "ar", label: "٠١٢" },
                        { v: "west", label: "012" },
                      ]}
                    />
                  </Row>
                </Group>

                <Group title={ar ? "التفسير" : "Tafsir"}>
                  <Row label={ar ? "التفسير المفضّل" : "Preferred tafsir"}>
                    <select
                      className="set-select"
                      value={s.tafsir}
                      onChange={(e) => setSettings({ tafsir: e.target.value })}
                      aria-label={ar ? "التفسير المفضّل" : "preferred tafsir"}
                    >
                      {TAFSIR_SOURCES.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                  </Row>
                </Group>

                <Group title={ar ? "التجويد" : "Tajwīd"}>
                  <Row label={ar ? "تلوين التجويد" : "Colour-coded tajwīd"} hint={ar ? "في وضعَي النص" : "text modes"}>
                    <Switch on={s.tajwid} onChange={(v) => setSettings({ tajwid: v })} />
                  </Row>
                  {s.tajwid && (
                    <div className="tj-legend">
                      {TAJWID_LEGEND.map((l) => (
                        <div key={l.cls} className="tj-legend-row">
                          <span className={`tj-swatch ${l.cls}`} />
                          <span>{ar ? l.ar : l.en}</span>
                        </div>
                      ))}
                      <p className="set-note">
                        {ar ? "محسوبة من النص العثماني — عونٌ على التلاوة" : "computed from the text — a recitation aid"}
                      </p>
                    </div>
                  )}
                </Group>

                <Group title={ar ? "طبقات المعرفة" : "Knowledge layers"}>
                  <Row label={ar ? "إبرازُ الآيات الكلّيّة" : "Mark kulliyyāt"}>
                    <Switch on={s.layers.jawami} onChange={(v) => setSettings({ layers: { ...s.layers, jawami: v } })} />
                  </Row>
                  <Row label={ar ? "قريب المعنى (مثلها)" : "Similar meaning"}>
                    <Switch on={s.layers.similar} onChange={(v) => setSettings({ layers: { ...s.layers, similar: v } })} />
                  </Row>
                  <Row label={ar ? "جذر الكلمة" : "Word root"}>
                    <Switch on={s.layers.roots} onChange={(v) => setSettings({ layers: { ...s.layers, roots: v } })} />
                  </Row>
                  <Row label={ar ? "زرّ الإضافة للمجموعات ⊕" : "Add-to-collection ⊕"}>
                    <Switch on={s.layers.collect} onChange={(v) => setSettings({ layers: { ...s.layers, collect: v } })} />
                  </Row>
                </Group>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
