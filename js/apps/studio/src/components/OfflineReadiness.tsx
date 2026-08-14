/**
 * **لوحةُ «جاهزيّة العمل بلا إنترنت»** — تجيب سؤالًا واحدًا: **«هل تطبيقي جاهزٌ
 * الآن بلا إنترنت؟»** — **بحالٍ مقيسةٍ لا بوعد**.
 *
 * ## أربعةُ أحكامٍ تحكم كلَّ سطرٍ فيها
 *
 * **١) الأوفلاينُ ثلاثُ طبقاتٍ لا طبقةٌ واحدة** — وخلطُها يوهم القارئَ أنّه
 * محتاجٌ إلى جيجاباتٍ وهو لا يحتاجها. **فالحافظُ الذي يريد التتبّعَ يكفيه
 * النصُّ والمحرّك**، ولا يُنزَّل الصوتُ إلّا لمن أراد أن **يسمع**.
 *
 * **٢) ولا تُدّعى جاهزيّةٌ لا نملكها.** كلُّ ما يُقال ههنا مقروءٌ من الخزانة
 * لحظتَه: تُمحى وحدةٌ منزَّلةٌ فتقول اللوحةُ «غير جاهز» **فورًا**. والوعدُ
 * الكاذبُ ههنا يقطع على قارئٍ صلاتَه أو مراجعتَه.
 *
 * **٣) وما وقف يُعرض موقوفًا بسببه المعلن** — ولا يُقال «جاهز» لبابٍ لم يُفتح.
 * وسببُ الوقف **يُقرأ من `halat.ts` نفسِه** لا يُكتب ههنا ثانيةً، فلا تختلف
 * اللوحةُ عن الصفحة.
 *
 * **٤) ولا يُوعَد بثبات التخزين.** يُطلب من النظام ويُعرض جوابُه كما هو —
 * **وإن لم يُمنح قيل للقارئ إنّ النظام قد يمحو المنزَّل عند ضيق المساحة**، وهو
 * واقعٌ على أجهزة آبل خاصّةً.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getUILang, num } from "../i18n";
import { getSettings, setSettings } from "../settings";
import { HALAT } from "../lib/sawt/halat";
import { ON_DEVICE_WIRE_MB } from "../lib/sawt/engines";
import { MODEL_ID } from "../lib/sawt/onDeviceRecognizer";
import RecitationCredit from "./RecitationCredit";
import {
  appKeyOfMirror,
  deleteUnit,
  downloadUnit,
  engineDownloaded,
  askPersist,
  isRunning,
  loadManifest,
  space,
  stopUnit,
  unitStates,
  unitId,
  type Manifest,
  type Progress,
  type Unit,
  type UnitKind,
  type UnitState,
} from "../lib/sawt/tilawa";

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;
const size = (b: number, ar: boolean): string =>
  b >= GB ? `${num((b / GB).toFixed(2))} ${ar ? "ج.ب" : "GB"}` : `${num(Math.round(b / MB))} ${ar ? "م.ب" : "MB"}`;

/** أشبكةٌ محدودةٌ هي؟ — فلا يُنزَّل عليها ثقيلٌ بلا إذنٍ ثانٍ */
function metered(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c?.saveData) || ["slow-2g", "2g", "3g"].includes(c?.effectiveType ?? "");
}

interface Layers {
  shell: boolean;
  engine: boolean;
  recitation: number; // عددُ الوحدات الجاهزة
}

export default function OfflineReadiness() {
  const ar = getUILang() === "ar";
  const [man, setMan] = useState<Manifest | null>(null);
  const [states, setStates] = useState<UnitState[]>([]);
  const [layers, setLayers] = useState<Layers>({ shell: false, engine: false, recitation: 0 });
  const [sp, setSp] = useState<{ usage: number | null; quota: number | null; persisted: boolean | null }>({
    usage: null,
    quota: null,
    persisted: null,
  });
  const [live, setLive] = useState<Record<string, Progress>>({});
  const [read, setRead] = useState(true);
  const [openDl, setOpenDl] = useState(false);
  const [kind, setKind] = useState<UnitKind>("juz");
  const [mirror, setMirror] = useState<string>("Husary_Muallim_128kbps");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /** **كلُّ حالٍ تُقرأ من الخزانة** — لا من سجلٍّ عندنا */
  const refresh = useCallback(async (m: Manifest | null) => {
    const st = m ? await unitStates(m) : [];
    setStates(st);
    setLayers({
      shell: Boolean(navigator.serviceWorker?.controller),
      engine: await engineDownloaded(MODEL_ID),
      recitation: st.filter((s) => s.ready).length,
    });
    setSp(await space());
  }, []);

  useEffect(() => {
    let alive = true;
    void loadManifest().then(async (m) => {
      if (!alive) return;
      setMan(m);
      setRead(Boolean(m));
      await refresh(m);
    });
    return () => {
      alive = false;
    };
  }, [refresh]);

  const rec = man && man.reciters[mirror];
  const rows = useMemo(() => (rec ? rec[kind] : []), [rec, kind]);
  const readyUnits = states.filter((s) => s.ready);
  const partial = states.filter((s) => !s.ready);

  const stateOf = (u: Unit): UnitState | undefined => states.find((s) => unitId(s.unit) === unitId(u));

  async function onDownload(u: Unit, bytes: number) {
    if (!man) return;
    if (metered() && !window.confirm(
      ar
        ? `شبكتُك محدودةٌ الآن، وهذا التنزيل ${size(bytes, true)}. أتمضي؟`
        : `Your connection looks metered and this download is ${size(bytes, false)}. Continue?`,
    )) return;
    setBusy(true);
    setNote(null);
    // الحصيلةُ تُؤخذ من عائد التنزيل لا من حالٍ قديمةٍ في الإغلاق
    const p = await downloadUnit(man, u, (v) => setLive((s) => ({ ...s, [unitId(u)]: v })));
    if (p.rejected || p.failed) {
      setNote(
        ar
          ? `${p.rejected ? `رُفض ${num(p.rejected)} ملفًّا لأنّ تجزئتَه خالفت المانيفست. ` : ""}${p.failed ? `وأخفق ${num(p.failed)} ملفًّا. ` : ""}والوحدةُ لا تُعدّ جاهزةً حتّى تكتمل.`
          : `${p.rejected ? `${p.rejected} file(s) rejected on hash mismatch. ` : ""}${p.failed ? `${p.failed} file(s) failed. ` : ""}The unit is not counted ready until complete.`,
      );
    }
    setBusy(false);
    await refresh(man);
  }

  async function onDelete(u: Unit) {
    if (!man) return;
    setBusy(true);
    await deleteUnit(man, u);
    setLive((v) => {
      const n = { ...v };
      delete n[unitId(u)];
      return n;
    });
    setBusy(false);
    await refresh(man);
  }

  /* ── ما يُقال للقارئ عن كلّ استعمال ── */
  const ard = HALAT.find((h) => h.id === "ard");
  const talqin = HALAT.find((h) => h.id === "talqin");
  const readyNames = readyUnits.map((s) => unitLabel(s, ar)).join(ar ? "، " : ", ");

  const uses: { name: string; ok: boolean | "partial" | "suspended"; line: string }[] = [
    {
      name: ar ? "القراءة" : "Reading",
      ok: layers.shell,
      line: layers.shell
        ? ar ? "جاهزة — المصحفُ كلُّه وواجهتُه في جهازك" : "Ready — the whole mushaf and its interface are on your device"
        : ar ? "لم تُخزَّن بعد — افتح التطبيقَ مرّةً وأنت متّصل" : "Not stored yet — open the app once while online",
    },
    {
      name: ar ? "التتبّع والحفظ" : "Follow-along & memorisation",
      ok: layers.engine,
      line: layers.engine
        ? ar ? "جاهزٌ — ولا يحتاج تلاوةً منزَّلةً ألبتّة" : "Ready — and it needs no downloaded recitation at all"
        : ar
          ? `ينقصه محرّكُ السمع (${num(ON_DEVICE_WIRE_MB)} م.ب) — ويُنزَّل من صفحة التتبّع`
          : `Needs the listening engine (${ON_DEVICE_WIRE_MB} MB) — download it from the follow-along page`,
    },
    {
      name: ar ? "الاستماع والتلقين" : "Listening & talqīn",
      ok: talqin?.suspended ? "suspended" : readyUnits.length ? "partial" : false,
      line: talqin?.suspended
        ? talqin.suspended
        : readyUnits.length
          ? ar
            ? `جاهزٌ لـ: ${readyNames} — وغيرُها يحتاج إنترنت`
            : `Ready for: ${readyNames} — anything else needs a connection`
          : !read
            ? ar
              ? "لم يُعلَم — تعذّرت قراءةُ وصف التلاوة"
              : "Unknown — the recitation index could not be read"
            : ar
              ? "يحتاج إنترنت — ولم يُنزَّل شيءٌ من التلاوة بعد"
              : "Needs a connection — no recitation downloaded yet",
    },
    {
      name: ar ? "العَرْض (أحكام التجويد)" : "ʿArḍ (tajwīd rulings)",
      ok: ard?.suspended ? "suspended" : layers.shell,
      line: ard?.suspended
        ? ard.suspended
        : ar
          ? "أحكامُ التجويد تُشعَل في النصّ بلا إنترنت. وأمّا قياسُ مقادير المدّ ومعايرةُ تلاوتك فموقوفان حتّى تثبت رخصةُ مرجعهما ويراهما مختصٌّ في التجويد."
          : "Tajwīd rulings light up in the text offline. Measuring madd lengths and calibrating your own recitation remain suspended until their reference's licence is settled and a tajwīd specialist reviews them.",
    },
  ];

  const mark = (v: boolean | "partial" | "suspended") =>
    v === true ? "✓" : v === "partial" ? "◐" : v === "suspended" ? "⏸" : "○";

  return (
    <div className="tlw">
      {/* ١ — الطبقاتُ الثلاثُ بحالها، فلا تُظنّ بابًا واحدًا ثقيلًا */}
      <p className="set-note tlw-intro">
        {ar
          ? "الأوفلاينُ ثلاثُ طبقاتٍ لا طبقةٌ واحدة — ومن أراد التتبّعَ والحفظَ كفاه الأوّلان، ولا يُنزَّل الصوتُ إلّا لمن أراد أن يسمع."
          : "Offline is three layers, not one — follow-along and memorisation need only the first two; the audio is for listening alone."}
      </p>

      <ul className="tlw-layers">
        <li>
          <span className="tlw-mark">{layers.shell ? "✓" : "○"}</span>
          <span>{ar ? "النصُّ والمصحفُ والواجهة" : "Text, mushaf and interface"}</span>
          <span className="tlw-sz">{ar ? "مخزَّنٌ مع التطبيق" : "stored with the app"}</span>
        </li>
        <li>
          <span className="tlw-mark">{layers.engine ? "✓" : "○"}</span>
          <span>{ar ? "محرّكُ السمع (للتتبّع والحفظ)" : "Listening engine (follow-along)"}</span>
          <span className="tlw-sz">
            {layers.engine ? (ar ? "منزَّل" : "downloaded") : `${num(ON_DEVICE_WIRE_MB)} ${ar ? "م.ب" : "MB"}`}
          </span>
        </li>
        <li>
          <span className="tlw-mark">{layers.recitation ? "✓" : "○"}</span>
          <span>{ar ? "التلاوة (للاستماع والتلقين)" : "Recitation (listening & talqīn)"}</span>
          <span className="tlw-sz">
            {layers.recitation
              ? `${num(layers.recitation)} ${ar ? "وحدة" : "unit(s)"}`
              : ar ? "لم يُنزَّل شيء" : "none"}
          </span>
        </li>
      </ul>

      {/* ٢ — وجاهزيّةٌ لكلّ استعمالٍ بعبارةٍ صريحة، لا بجدولِ ملفّات */}
      <h4 className="tlw-h">
        {ar ? "ما تستطيعه الآن بلا إنترنت" : "What works offline right now"}
        {/* **تُقرأ الخزانةُ من جديد** — فمن محا شيئًا رآه ينقص ههنا في الحال،
            ولا يُصدَّق سجلٌّ عندنا على خزّانٍ في جهازه */}
        <button className="chip tlw-recheck" disabled={busy} onClick={() => void refresh(man)}>
          {ar ? "تحقّقْ الآن" : "Re-check"}
        </button>
      </h4>
      <ul className="tlw-uses">
        {uses.map((u) => (
          <li key={u.name} className={`tlw-use tlw-${u.ok === true ? "on" : u.ok === "partial" ? "part" : u.ok === "suspended" ? "susp" : "off"}`}>
            <span className="tlw-mark">{mark(u.ok)}</span>
            <span>
              <b>{u.name}:</b> {u.line}
            </span>
          </li>
        ))}
      </ul>

      {/* **وإن لم يُقرأ الوصفُ لم يُقَل «لا شيءَ منزَّل»** — فبينَ «لا أعلم»
          و«ليس عندك» فرقٌ، وخلطُهما إخبارٌ بغير علم */}
      {!read && (
        <p className="set-note tlw-warn">
          {ar
            ? "لم يُقرأ وصفُ التلاوة، فلا أستطيع أن أخبرك بما نزّلتَه منها — وما فوقَه من الأسطر لا يشمله. أعد فتحَ اللوحة وأنت متّصلٌ مرّةً واحدة."
            : "The recitation index could not be read, so what you have downloaded cannot be reported here. Open this panel once while online."}
        </p>
      )}

      {/* ٣ — التحميلُ بالتجزئة: لا زرَّ واحدًا يُنزّل ثلاثةَ جيجابايت */}
      <button className="set-more" onClick={() => setOpenDl((v) => !v)} aria-expanded={openDl}>
        <span>{ar ? "تنزيلُ التلاوة للاستماع بلا إنترنت" : "Download recitation for offline listening"}</span>
        <span className={`set-more-caret${openDl ? " on" : ""}`} aria-hidden>▾</span>
      </button>

      {openDl && man && (
        <div className="tlw-dl">
          <p className="set-note">
            {ar
              ? "يُنزَّل بالجزء أو السورة أو الصفحة — لا بالجملة. وحجمُ كلِّ وحدةٍ بجانبها قبل الضغط، ولا تنزيلَ يبدأ من نفسه."
              : "Download by juzʾ, sura or page — never all at once. Each unit's size is shown before you press, and nothing starts on its own."}
          </p>

          <div className="tlw-pick">
            <label>
              {ar ? "القارئ" : "Reciter"}
              <select className="set-select" value={mirror} onChange={(e) => setMirror(e.target.value)}>
                {Object.entries(man.reciters).map(([k, r]) => (
                  <option key={k} value={k}>
                    {(ar ? r.ar : r.en) + ` — ${size(r.bytes, ar)}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {ar ? "الوحدة" : "Unit"}
              <select className="set-select" value={kind} onChange={(e) => setKind(e.target.value as UnitKind)}>
                <option value="juz">{ar ? "جزء" : "Juzʾ"}</option>
                <option value="surah">{ar ? "سورة" : "Sura"}</option>
                <option value="page">{ar ? "صفحة" : "Page"}</option>
              </select>
            </label>
          </div>

          {/* **والقارئُ يُختار بالغرض لا بالحجم** — وحجمُ الآخر بجانبه في
              القائمة فلا يُخفى الخيار. والوصفُ ههنا **بلسان القارئ**، لا
              بوصف المستودع لنفسه. */}
          <p className="set-note tlw-use-note">
            {mirror === "Husary_Muallim_128kbps"
              ? ar
                ? "مصحفُ المعلّم يُلقِّن: إيقاعٌ بطيءٌ بيّنٌ وسكتاتُ ترديدٍ محفوظة — وهو أنفعُ للتعلّم والتلقين، وأثقلُ حجمًا."
                : "The teaching mushaf drills you: a deliberate pace with repetition pauses — best for learning, and the heavier of the two."
              : ar
                ? "المرتَّل تلاوةٌ متّصلةٌ للاستماع والمتابعة — وهو أخفُّ بالضعف."
                : "The murattal is continuous recitation for listening along — and half the size."}
          </p>

          <div className="tlw-list" role="list">
            {rows.map((row) => {
              const u: Unit = { reciter: mirror, kind, n: row.n };
              const st = stateOf(u);
              const p = live[unitId(u)];
              const running = isRunning(u);
              const pct = p && p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div className="tlw-row" role="listitem" key={row.n}>
                  <span className="tlw-name">
                    {kind === "surah"
                      ? `${num(row.n)} · ${ar ? row.ar : row.en}`
                      : `${ar ? (kind === "juz" ? "الجزء" : "الصفحة") : kind === "juz" ? "Juzʾ" : "Page"} ${num(row.n)}`}
                    <span className="tlw-sub">
                      {num(row.ayat)} {ar ? "آية" : "ayāt"} · {size(row.bytes, ar)}
                    </span>
                  </span>
                  {st?.ready ? (
                    <>
                      <span className="tlw-ok">{ar ? "منزَّل" : "downloaded"}</span>
                      <button className="chip" disabled={busy} onClick={() => void onDelete(u)}>
                        {ar ? "حذف" : "Delete"}
                      </button>
                    </>
                  ) : running ? (
                    <>
                      <span className="tlw-pct">{num(pct)}٪</span>
                      <button className="chip" onClick={() => stopUnit(u)}>
                        {ar ? "إيقاف" : "Stop"}
                      </button>
                    </>
                  ) : (
                    <>
                      {st && st.have > 0 && (
                        <span className="tlw-pct">
                          {num(st.have)}/{num(row.ayat)}
                        </span>
                      )}
                      <button className="chip" disabled={busy} onClick={() => void onDownload(u, row.bytes)}>
                        {st && st.have > 0 ? (ar ? "إتمام" : "Resume") : ar ? "تنزيل" : "Download"}
                      </button>
                      {st && st.have > 0 && (
                        <button className="chip" disabled={busy} onClick={() => void onDelete(u)}>
                          {ar ? "حذف" : "Delete"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {note && <p className="set-note tlw-warn">{note}</p>}
          <RecitationCredit source="downloaded" className="tlw-cr" />
        </div>
      )}

      {/* ٣ب — والناقصُ يُقال ولا يُخفى */}
      {partial.length > 0 && (
        <p className="set-note tlw-warn">
          {ar
            ? `وحداتٌ نقصت ولم تكتمل: ${partial.map((s) => `${unitLabel(s, true)} (${num(s.have)}/${num(s.row.ayat)})`).join("، ")} — وهي ليست جاهزةً للاستماع بلا إنترنت.`
            : `Incomplete units: ${partial.map((s) => `${unitLabel(s, false)} (${s.have}/${s.row.ayat})`).join(", ")} — these are not offline-ready.`}
        </p>
      )}

      {/* ٤ — المساحةُ وثباتُ التخزين: يُطلب ويُعرض جوابُه بصدق */}
      <h4 className="tlw-h">{ar ? "المساحة" : "Storage"}</h4>
      <p className="set-note">
        {sp.usage != null
          ? ar
            ? `المستعمَلُ من هذا الموقع: ${size(sp.usage, true)}${sp.quota ? ` من ${size(sp.quota, true)} متاحة` : ""}`
            : `Used by this site: ${size(sp.usage, false)}${sp.quota ? ` of ${size(sp.quota, false)} available` : ""}`
          : ar
            ? "لم يُخبرنا المتصفّحُ بالمساحة المستعملة."
            : "The browser did not report storage usage."}
      </p>
      <p className={`set-note${sp.persisted === false ? " tlw-warn" : ""}`}>
        {sp.persisted === true
          ? ar
            ? "ثباتُ التخزين: ممنوح — فلا يمحو النظامُ المنزَّلَ من تلقائه."
            : "Persistent storage: granted — the system will not evict your downloads on its own."
          : sp.persisted === false
            ? ar
              ? "ثباتُ التخزين: لم يُمنح — وقد يمحو النظامُ ما نزّلتَه عند ضيق المساحة (وهذا واقعٌ على أجهزة آبل خاصّةً). ولا نملك منعَه."
              : "Persistent storage: not granted — the system may evict your downloads when space runs low (notably on Apple devices). This is not in our hands."
            : ar
              ? "ثباتُ التخزين: لم يُسأل بعد."
              : "Persistent storage: not requested yet."}
      </p>
      {sp.persisted !== true && (
        <button
          className="chip"
          onClick={async () => {
            await askPersist();
            setSp(await space());
          }}
        >
          {ar ? "اطلب ثباتَ التخزين" : "Request persistent storage"}
        </button>
      )}

      {/* والقارئُ الافتراضيُّ يتبع الغرضَ لا الحجم */}
      {readyUnits.length > 0 && (
        <p className="set-note">
          {ar
            ? "وللاستماع من المنزَّل اختر القارئَ نفسَه في «التلاوة» أعلاه."
            : "To hear your downloads, pick the same reciter under “Recitation” above."}
          {" "}
          {(() => {
            const key = appKeyOfMirror(readyUnits[0].unit.reciter);
            return key && getSettings().reciter !== key ? (
              <button className="chip" onClick={() => setSettings({ reciter: key })}>
                {ar ? "اختره الآن" : "Select it now"}
              </button>
            ) : null;
          })()}
        </p>
      )}
    </div>
  );
}

function unitLabel(s: UnitState, ar: boolean): string {
  const n = num(s.unit.n);
  if (s.unit.kind === "surah") return ar ? `سورة ${s.row.ar ?? n}` : `Sura ${s.row.en ?? n}`;
  if (s.unit.kind === "juz") return ar ? `الجزء ${n}` : `Juzʾ ${n}`;
  return ar ? `الصفحة ${n}` : `Page ${n}`;
}
