import { useMemo, useState } from "react";
import { AYAH_COUNTS } from "@mishkat/quran-core";
import { marksOf, twinText, wordsOf, type Pairing, type TwinGroup } from "../furuq";
import type { Site, Tab, Tathbit } from "../tathbit";
import type { Mushaf } from "../mushaf";
import { num } from "../mushaf";
import Sheet from "./Sheet";

/**
 * **بابُ التثبيت في الصفحة — شريطٌ وورقةٌ، على نمط التتبّع.**
 *
 * ولا صفحةَ ثانية: يلمس الحافظُ **المفارق** في الرأس فتُوسَم آياتُ الالتباس في
 * مصحفه، ويظهر تحته شريطٌ رفيعٌ يقول كم موضعًا في صفحته، ومنه تُفتح الورقةُ
 * بألسنتها الثلاثة: **الخريطةُ** قبل الحفظ · **التدريبُ** عند المفرق ·
 * **سجلُّك** بالزوج.
 *
 * **والمتنُ لا يُطمَس ولا يُنقر**: الوسمُ لونُ ميداليّةِ رقم الآية لا غير — لا
 * يزيد في الصفحة عنصرًا ولا يزحزح تنضيدًا — واللوحُ ورقةٌ سفليّةٌ تُغلق فيعود
 * المصحفُ نصًّا صافيًا. **ورقمُ الآية ليس زرًّا**: المواضعُ تُفتح من الشريط.
 */

/** «٧:١٤١» ⇒ «الأعراف ١٤١» */
const say = (m: Mushaf, loc: string): string => {
  const [s, a] = loc.split(":").map(Number);
  return `${m.surahName(s)} ${num(a)}`;
};

/** شريطُ المفارق — رفيعٌ في أسفل الشاشة، يقول ما في صفحة القارئ */
export function ForkBar({ t, mushaf, page }: { t: Tathbit; mushaf: Mushaf; page: number }) {
  const here = t.marks
    ? mushaf.pages[page - 1].ayahs.filter((a) => t.marks!.has(a.id)).length
    : 0;
  return (
    <div className="tw-track" data-tathbit="bar">
      <div className="tw-track-row">
        <span className="tw-fork-say" data-tathbit="count">
          {!t.material && !t.failed ? (
            "تُقرأ مواضعُ الالتباس…"
          ) : t.failed ? (
            "لم تُجلب مادّةُ المفارق — تحقّق من الاتّصال."
          ) : here === 0 ? (
            <>لا موضعَ يلتبس في صفحة {num(page)}</>
          ) : (
            <>
              في صفحة {num(page)} <b>{num(here)}</b> من مواضع الالتباس
            </>
          )}
        </span>
        <span className="tw-spacer" />
        <button className="tw-track-act" data-tathbit="open-map" onClick={() => t.show("map")}>
          المواضع
        </button>
        <button className="tw-track-x" data-tathbit="close" aria-label="إغلاق التثبيت" onClick={t.close}>
          ✕
        </button>
      </div>
    </div>
  );
}

const TABS: { id: Tab; name: string }[] = [
  { id: "map", name: "الخريطة" },
  { id: "drill", name: "التدريب" },
  { id: "log", name: "سجلُّك" },
];

/** ورقةُ التثبيت — لسانٌ واحدٌ يُعرض، والباقيان في صفّ الأزرار */
export function TathbitSheet({
  t,
  mushaf,
  onGo,
}: {
  t: Tathbit;
  mushaf: Mushaf;
  /** الانتقالُ إلى آيةٍ في المصحف — وتُغلق الورقةُ عندها */
  onGo: (ayahId: number) => void;
}) {
  const [detail, setDetail] = useState<Site | null>(null);
  return (
    <Sheet title="التثبيت" onClose={() => t.show(null)}>
      <div className="tw-seg" role="tablist" aria-label="التثبيت">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-pressed={t.tab === x.id}
            onClick={() => {
              setDetail(null);
              t.show(x.id);
            }}
          >
            {x.name}
          </button>
        ))}
      </div>

      {!t.material ? (
        <p className="tw-note" data-tathbit="loading">
          {t.failed ? "لم تُجلب مادّةُ المفارق — تحقّق من الاتّصال ثمّ أعد فتح الباب." : "تُقرأ المادّة…"}
        </p>
      ) : detail ? (
        <Detail t={t} mushaf={mushaf} site={detail} onBack={() => setDetail(null)} onGo={onGo} />
      ) : t.tab === "drill" ? (
        <DrillView t={t} mushaf={mushaf} />
      ) : t.tab === "log" ? (
        <LogView t={t} mushaf={mushaf} />
      ) : (
        <MapView t={t} mushaf={mushaf} onPick={setDetail} />
      )}

      {/* **وسمُ المصدر في كلّ معروض**: المتنُ منقولٌ، والمحاذاةُ محسوبةٌ، والسؤالُ
          مولَّدٌ منهما — **وأرقامُ المادّة تُنشر ولا يُسكَت عن سقفٍ**. */}
      {t.material && (
        <p className="tw-stamp" data-tathbit="stamp">
          النصُّ <b>منقولٌ</b> من رسم المصحف · والمحاذاةُ <b>محسوبةٌ</b> من فروق التنزيل · والسؤالُ{" "}
          <b>مولَّدٌ</b> منها. ودخل من {num(t.material.counts.all)} زوجًا:{" "}
          {num(t.material.counts.forkPairs)} ذاتَ مفرقٍ داخليٍّ (حدُّ السلسلة{" "}
          {num(t.material.counts.minLead)} كلماتٍ) في {num(t.material.counts.questions)} سؤالًا، و
          {num(t.material.counts.twinPairs)} توأمًا تامًّا في {num(t.material.counts.twinGroups)} مجموعة.
          وبقي {num(t.material.counts.belowLead)} دون الحدّ
          {t.material.counts.misaligned > 0 && <> و{num(t.material.counts.misaligned)} لم تستقم محاذاتُه</>}.
        </p>
      )}
    </Sheet>
  );
}

/* ═══════════ الخريطة — مواضعُ الالتباس قبل الحفظ ═══════════ */

function MapView({
  t,
  mushaf,
  onPick,
}: {
  t: Tathbit;
  mushaf: Mushaf;
  onPick: (s: Site) => void;
}) {
  const [choosing, setChoosing] = useState<null | "surah" | "page">(null);
  const where =
    t.scope.kind === "page" ? `صفحة ${num(t.scope.n)}` : `سورة ${mushaf.surahName(t.scope.n)}`;

  if (choosing) {
    return (
      <div data-tathbit="choose">
        <div className="tw-seg" role="tablist" aria-label="المدى">
          <button role="tab" aria-pressed={choosing === "surah"} onClick={() => setChoosing("surah")}>
            السور
          </button>
          <button role="tab" aria-pressed={choosing === "page"} onClick={() => setChoosing("page")}>
            الصفحات
          </button>
        </div>
        {choosing === "surah" ? (
          <div className="tw-grid">
            {AYAH_COUNTS.map((count, i) => (
              <button
                key={i}
                onClick={() => {
                  t.setScope({ kind: "surah", n: i + 1 });
                  setChoosing(null);
                }}
              >
                <b className="quran">{mushaf.surahName(i + 1)}</b>
                <i>{num(count)}</i>
              </button>
            ))}
          </div>
        ) : (
          <div className="tw-grid pages">
            {mushaf.pages.map((p) => (
              <button
                key={p.page}
                onClick={() => {
                  t.setScope({ kind: "page", n: p.page });
                  setChoosing(null);
                }}
              >
                {num(p.page)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-tathbit="map">
      <button className="tw-scope" data-tathbit="scope" onClick={() => setChoosing(t.scope.kind)}>
        {where} <i>بدِّل المدى</i>
      </button>
      {t.sites.length === 0 ? (
        <p className="tw-note">لا موضعَ يلتبس في هذا المدى.</p>
      ) : (
        <>
          <p className="tw-note">
            ههنا <b>{num(t.sites.length)}</b> من المواضع تلتبس بغيرها — وهذا قبل الحفظ لا بعده.
          </p>
          <div className="tw-sites">
            {t.sites.map((s) => (
              <button key={s.key} className="tw-site" data-tathbit="site" onClick={() => onPick(s)}>
                <b>{say(mushaf, s.loc)}</b>
                <span className="quran">{first(mushaf, s.id)}</span>
                <i>
                  {s.kind === "twin" ? "تتكرّر في " : "تلتبس بـ"}
                  {s.others.map((o) => say(mushaf, o.loc)).join(" · ")}
                  {s.forks > 0 && <> · {s.forks === 1 ? "مفرقٌ واحد" : `${num(s.forks)} مفارق`}</>}
                  {s.lapses > 0 && <> · زللتَ عنها {num(s.lapses)}</>}
                </i>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** صدرُ الآية — أربعُ كلماتٍ من رسمها تكفي للتعرّف عليها في القائمة */
const first = (m: Mushaf, id: number): string => {
  const w = wordsOf(m, id);
  return w.slice(0, 4).join(" ") + (w.length > 4 ? " …" : "");
};

/* ═══════════ لوحُ التفصيل — الآيةُ مع نظيرتها والمفترقُ مُبرَز ═══════════ */

function Detail({
  t,
  mushaf,
  site,
  onBack,
  onGo,
}: {
  t: Tathbit;
  mushaf: Mushaf;
  site: Site;
  onBack: () => void;
  onGo: (id: number) => void;
}) {
  const rel = useMemo(() => {
    if (!t.material) return null;
    if (site.kind === "twin") return t.material.twins.find((g) => g.key === site.key) ?? null;
    return t.material.pairs.find((p) => p.key === site.key) ?? null;
  }, [t.material, site]);

  return (
    <div data-tathbit="detail">
      <button className="tw-scope" onClick={onBack}>
        <i>← رجوعٌ إلى المواضع</i>
      </button>
      {rel && "forks" in rel ? (
        <PairText mushaf={mushaf} pair={rel} />
      ) : rel ? (
        <TwinText mushaf={mushaf} group={rel} />
      ) : null}
      <div className="tw-acts">
        <button className="tw-act-main" data-tathbit="go" onClick={() => onGo(site.id)}>
          انتقلْ إلى الموضع
        </button>
        <button className="tw-act" onClick={onBack}>
          المواضع
        </button>
      </div>
    </div>
  );
}

/** **الآيتان معًا والمفترقُ مُبرَز** — فحفظُ الآية منفردةً هو سببُ الالتباس */
function PairText({ mushaf, pair }: { mushaf: Mushaf; pair: Pairing }) {
  /* **المواضعُ تُقرأ من المحاذاة نفسِها** لا من وجهَي السؤال: الوجهُ قد يُوسَّع
     بكلمةٍ مشتركةٍ ليستبين، فلو أُخذ الإبرازُ منه لَلُوّنت كلمةٌ هي في الآيتين سواء. */
  const marks = useMemo(() => {
    const m = marksOf(pair.ops, pair.win);
    return { a: new Set(m.a), b: new Set(m.b) };
  }, [pair]);
  return (
    <div className="tw-pair">
      <Ayah mushaf={mushaf} id={pair.idA} loc={pair.a} hot={marks.a} />
      <Ayah mushaf={mushaf} id={pair.idB} loc={pair.b} hot={marks.b} />
    </div>
  );
}

function TwinText({ mushaf, group }: { mushaf: Mushaf; group: TwinGroup }) {
  return (
    <div className="tw-pair">
      <p className="tw-q-lead quran" data-tathbit="twin-text">
        {twinText(group.places[0], wordsOf(mushaf, group.places[0].id)).join(" ")}
      </p>
      <p className="tw-note">
        بلا مفرقٍ ألبتّة — وإنّما مواضعُها:{" "}
        <b>{group.places.map((p) => say(mushaf, p.loc)).join(" · ")}</b>
      </p>
    </div>
  );
}

/** آيةٌ بنصّها، وكلماتُ المفترق فيها مُبرَزة */
function Ayah({
  mushaf,
  id,
  loc,
  hot,
}: {
  mushaf: Mushaf;
  id: number;
  loc: string;
  hot: Set<number>;
}) {
  const words = wordsOf(mushaf, id);
  return (
    <div className="tw-ayah" data-tathbit="ayah" data-loc={loc}>
      <b className="tw-ayah-at">{say(mushaf, loc)}</b>
      <p className="quran">
        {words.map((w, i) => (
          <span key={i} className={hot.has(i + 1) ? "tw-hot" : undefined}>
            {i ? " " : ""}
            {w}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ═══════════ التدريب — الاختبارُ عند المفرق ═══════════ */

function DrillView({ t, mushaf }: { t: Tathbit; mushaf: Mushaf }) {
  const [shown, setShown] = useState(false);
  const d = t.drill;
  if (!d) return <p className="tw-note">لا مادّةَ للتدريب.</p>;

  if (d.twin) {
    const places = d.twin.places;
    return (
      <div data-tathbit="drill-twin" key={d.key}>
        <p className="tw-q-lead quran" data-tathbit="twin-text">
          {twinText(places[0], wordsOf(mushaf, places[0].id)).join(" ")}
        </p>
        <p className="tw-q-ask" data-tathbit="ask">
          <b>أين تقع؟</b> — وهي بلا مفرق، فمواضعُها هي المطلوب.
        </p>
        {!shown && t.answered === null ? (
          <div className="tw-acts">
            <button className="tw-act-main" data-tathbit="reveal" onClick={() => setShown(true)}>
              أظهِر المواضع
            </button>
          </div>
        ) : (
          <>
            <p className="tw-truth" data-tathbit="truth">
              {places.map((p) => say(mushaf, p.loc)).join(" · ")}
            </p>
            {t.answered === null ? (
              <div className="tw-acts">
                <button
                  className="tw-act-main"
                  data-tathbit="grade-good"
                  onClick={() => t.answer(true)}
                >
                  حضرتني
                </button>
                <button className="tw-act" data-tathbit="grade-again" onClick={() => t.answer(false)}>
                  تُراجَع
                </button>
              </div>
            ) : (
              <NextBtn t={t} onNext={() => setShown(false)} />
            )}
          </>
        )}
      </div>
    );
  }

  const q = d.q!;
  const faces: { side: "a" | "b"; text: string[] | null }[] = d.flip
    ? [
        { side: "b", text: q.faceB },
        { side: "a", text: q.faceA },
      ]
    : [
        { side: "a", text: q.faceA },
        { side: "b", text: q.faceB },
      ];
  const mine = q.side === "a" ? q.faceA : q.faceB;
  const other = q.side === "a" ? q.faceB : q.faceA;
  const otherLoc = q.side === "a" ? q.pair.b : q.pair.a;

  return (
    <div data-tathbit="drill-fork" key={`${d.key}-${q.side}-${q.fork.atA}`}>
      <p className="tw-q-lead quran" data-tathbit="lead">
        {q.clipped ? "… " : ""}
        {q.lead.join(" ")}
      </p>
      <p className="tw-q-ask" data-tathbit="ask">
        في <b>{say(mushaf, q.loc)}</b> — أيُّهما؟
      </p>
      <div className="tw-faces" data-tathbit="faces">
        {faces.map((f) => (
          <button
            key={f.side}
            className={`tw-face${f.text ? " quran" : " tw-face-end"}`}
            data-tathbit={`face-${f.side}`}
            aria-pressed={t.answered !== null && f.side === q.side}
            disabled={t.answered !== null}
            onClick={() => t.answer(f.side === q.side)}
          >
            {f.text ? f.text.join(" ") : "تنتهي الآيةُ ههنا"}
          </button>
        ))}
      </div>

      {/* **ولا يُقال «أخطأت»**: يُعرض الصوابُ وموضعُ الفرق — والآيتان معًا تحته */}
      {t.answered !== null && (
        <div data-tathbit="after">
          <p className="tw-truth" data-tathbit="truth">
            في <b>{say(mushaf, q.loc)}</b>: <span className="quran">{show(mine)}</span> — وفي{" "}
            <b>{say(mushaf, otherLoc)}</b>: <span className="quran">{show(other)}</span>
          </p>
          <PairText mushaf={mushaf} pair={q.pair} />
          <NextBtn t={t} onNext={() => setShown(false)} />
        </div>
      )}
    </div>
  );
}

const show = (face: string[] | null): string => (face ? face.join(" ") : "تنتهي ههنا");

function NextBtn({ t, onNext }: { t: Tathbit; onNext: () => void }) {
  return (
    <div className="tw-acts">
      <button
        className="tw-act-main"
        data-tathbit="next"
        onClick={() => {
          onNext();
          t.next();
        }}
      >
        التالية
      </button>
    </div>
  );
}

/* ═══════════ السجلّ — بالزوج لا بالآية ═══════════ */

function LogView({ t, mushaf }: { t: Tathbit; mushaf: Mushaf }) {
  if (!t.log.length) {
    return (
      <p className="tw-note" data-tathbit="log-empty">
        لم يمضِ من التدريب شيءٌ بعدُ — وسجلُّك يُكتب من مجالسك، ويبقى في هذا الجهاز.
      </p>
    );
  }
  return (
    <div data-tathbit="log">
      <p className="tw-note">
        مضى من العلاقات <b>{num(t.seen)}</b> · وحلَّ أجلُ <b>{num(t.due)}</b> منها.
      </p>
      <div className="tw-sites">
        {t.log.map((r) => (
          <div key={r.key} className="tw-site tw-logrow" data-tathbit="log-row">
            <b>
              {r.kind === "twin" ? (
                <>مواضعُ {r.places.map((p) => say(mushaf, p.loc)).join(" · ")}</>
              ) : (
                <>
                  تخلط {say(mushaf, r.places[0].loc)} بـ{say(mushaf, r.places[1].loc)}
                </>
              )}
            </b>
            <i>
              {r.lapses > 0 ? <>زللتَ عنها {num(r.lapses)} · </> : null}
              عُرضت {num(r.reps)} · وتُعاد {when(r.due)}
            </i>
          </div>
        ))}
      </div>
    </div>
  );
}

/** موعدُ الإعادة بلسانٍ لا بتاريخٍ آليّ */
function when(due: string): string {
  const days = Math.round((Date.parse(due) - Date.now()) / 86400000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "غدًا";
  if (days < 30) return `بعد ${num(days)} يومًا`;
  const months = Math.round(days / 30);
  return months === 1 ? "بعد شهر" : `بعد ${num(months)} أشهر`;
}
