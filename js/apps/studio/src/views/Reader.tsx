/**
 * Reader — the mushaf reading view (/read/:surahNo and /read/:surahNo/:ayahNo).
 *
 * Two display modes:
 *   «صفحات» (default) — continuous mushaf flow, grouped by Madani page.
 *   «آيات»            — ayah-by-ayah list with tools and translation.
 *
 * عمودان: قائمةُ السور (٢٥٠ بكسل) والنصّ — وبياناتُ الكلمة والآية في مودالٍ
 * يُفتح بالنقر (أُلغي الجانبُ الأيمن بقرار المالك 2026-07-21). ودون ٩٠٠ بكسل
 * تنطوي قائمةُ السور ويحلّ محلَّها مُنتقٍ.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getWord, listAyahs, listSurahs, listWords, surahNameAr } from "../db";
import type { AyahDoc, SurahDoc, WordDoc } from "../types";
import { ayahsCount, getUILang, num, t, useUILang } from "../i18n";
import { setSelectedAyah, useReading } from "../reading";
import { useSettings } from "../settings";
import { recordProgress, toggleBookmark, useBookmarks } from "../bookmarks";
import { TAJWID, tajwidWords } from "../tajwid";
import AyahText from "../components/AyahText";
import MorphologyCard from "../components/MorphologyCard";
import RootMeaning from "../components/RootMeaning";
import CollectButton from "../components/CollectButton";
import AudioButton, { ayahIdOf, isPreviewPlaying, playContinuous, usePlayingId } from "../components/AudioButton";
import SimilarAyahs, { SimilarAyahsPanel } from "../components/SimilarAyahs";
import MuhkamaLine from "../components/MuhkamaLine";
import EraabChip, { EraabPanel } from "../components/EraabChip";
import { TafsirChip, TafsirPanel } from "../components/TafsirChip";
import { AsbabChip, AsbabPanel } from "../components/AsbabChip";
import TadabburChip, { TadabburPanel } from "../components/TadabburChip";
import InlineOmni from "../components/InlineOmni";
import ScrollTopFab from "../components/ScrollTopFab";
import VerseContext from "../components/VerseContext";
import { classOf, useKulliyat } from "../kulliyat";
import { loadSiyaq, loadSiyaqEn, siyaqNameEn, unitOf } from "../siyaq";
import Translations from "../components/Translations";
import { useWordPress, type WordPressHandlers } from "../lib/pressWord";
import AyahPanel from "../components/AyahPanel";
import WelcomeQuestions from "../components/WelcomeQuestions";
import { EnTransBar, EnVerseLine } from "../components/EnVerse";
import { wbwOf, type WbwEntry } from "../lib/wbw";

const MODE_KEY = "quran-studio:reader-mode";
type Mode = "pages" | "ayat";

/** Tracks whether the viewport is narrower than 900px. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState<boolean>(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

function SurahSidebar({
  surahs,
  activeNo,
  onPick,
}: {
  surahs: SurahDoc[];
  activeNo: number;
  onPick: (surahNo: number) => void;
}) {
  useUILang();
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const shown = q
    ? surahs.filter(
        (s) =>
          String(s.surahNo).startsWith(q) ||
          s.nameTranslit.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.nameAr.includes(filter.trim()),
      )
    : surahs;
  return (
    <aside
      style={{
        width: 250,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderInlineEnd: "1px solid var(--line)",
        background: "var(--panel)",
        minHeight: 0,
      }}
    >
      <div style={{ padding: "10px 10px 8px" }}>
        <input
          value={filter}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          placeholder={t("reader.filter")}
          style={{ width: "100%" }}
          aria-label={t("reader.filter")}
        />
      </div>
      {/* bottom padding clears the floating نِبراس button so the last sūra stays tappable */}
      <div style={{ overflowY: "auto", flex: 1, padding: "0 6px 84px" }}>
        {shown.map((s) => {
          const active = s.surahNo === activeNo;
          return (
            <div
              key={s.surahNo}
              onClick={() => onPick(s.surahNo)}
              role="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 8,
                cursor: "pointer",
                background: active ? "var(--accent-soft)" : undefined,
                color: active ? "var(--accent)" : "var(--ink-2)",
              }}
            >
              <span className="muted" style={{ width: 26, textAlign: "end" }}>
                {num(s.surahNo)}
              </span>
              {getUILang() === "ar" ? (
                <span className="quran" style={{ fontSize: 19, lineHeight: 1.4 }}>{s.nameAr}</span>
              ) : (
                <>
                  {/* الإنجليزيةُ أولًا وبلونها الكامل، والعربيُّ عونًا خافتًا في الطرف
                      (أمر المالك 2026-07-29: English concentrated, Arabic as helper) */}
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{s.nameTranslit}</span>
                  <span className="quran" style={{ marginInlineStart: "auto", fontSize: 16, opacity: 0.45 }}>{s.nameAr}</span>
                </>
              )}
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="muted" style={{ padding: 10 }}>
            {t("notFound")} “{filter}”
          </div>
        )}
      </div>
    </aside>
  );
}

/** نطقُ الكلمة المفردة — تلاوةُ كلِّ كلمةٍ متاحةٌ برابطٍ قياسيٍّ يُبنى من
 *  موضعها (audio.qurancdn.com/wbw) — معينٌ لمتعلّمي التلاوة خاصّة. */
function playWord(location: string) {
  const [s, a, w] = location.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(3, "0");
  const audio = new Audio(`https://audio.qurancdn.com/wbw/${pad(s)}_${pad(a)}_${pad(w)}.mp3`);
  void audio.play().catch(() => {});
}

function Inspector({ word }: { word: WordDoc | null }) {
  useUILang();
  const { layers } = useSettings();
  // «الكلمةُ الجسر» لغير العربيّ: رسمُ اللفظ لاتينيًّا ومعناه الإنجليزيّ أولَ اللوحة —
  // فيبني القارئُ معجمَه القرآنيَّ كلمةً كلمةً وهو يقرأ (رؤية 2026-07-29)
  const [wbw, setWbw] = useState<WbwEntry | null>(null);
  const en = getUILang() !== "ar";
  useEffect(() => {
    let live = true;
    setWbw(null);
    if (word && en) wbwOf(word.location).then((d) => live && setWbw(d));
    return () => { live = false; };
  }, [word?.location, en]);
  if (!word) {
    return (
      <div className="muted" style={{ padding: 8, lineHeight: 1.8 }}>
        {t("reader.inspector.hint")}
      </div>
    );
  }
  const ayahLoc = `${word.surahNo}:${word.ayahNo}`;
  return (
    <div>
      {en && wbw && (
        <div className="wbw-bridge" dir="ltr">
          <button className="wbw-play" onClick={() => playWord(word.location)} title="hear this word">▶</button>
          <span className="wbw-tr">{wbw.translit}</span>
          <span className="wbw-gl">{wbw.gloss}</span>
        </div>
      )}
      {!en && (
        <button className="chip wbw-play-ar" onClick={() => playWord(word.location)} title="استمع لنطق هذه الكلمة وحدها">
          ▶ نُطقُ الكلمة
        </button>
      )}
      <MorphologyCard word={word} />
      {word.root && layers.roots && <RootMeaning root={word.root} />}
      <div
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}
      >
        <CollectButton
          locations={[ayahLoc]}
          criterion={{ kind: "manual", value: word.location }}
          label={`⊕ ${t("collect")}`}
        />
        <Link to={`/aya/${word.surahNo}/${word.ayahNo}`} className="chip link" style={{ textDecoration: "none" }}>
          {getUILang() === "ar" ? "بطاقةُ الآية ←" : "verse card →"}
        </Link>
      </div>
    </div>
  );
}

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/** Continuous mushaf flow for one Madani page of the current surah — laid out
 *  like the printed Madina mushaf: header margin (juz · surah · hizb), surah
 *  name band + basmala where the surah begins, ۞ hizb/rub and ۩ sajda marks,
 *  and the page number at the foot. */
function MushafPage({
  page,
  ayahs,
  wordsByAyah,
  selected,
  press,
  selectedExtras,
  onAyahMarker,
  onAyahPick,
  selectedAyahNo,
  targetAyahNo,
  rubMarks,
  opening = false,
}: {
  page: number;
  ayahs: AyahDoc[];
  wordsByAyah: Map<number, WordDoc[]>;
  selected: string | null;
  press: WordPressHandlers<WordDoc>;
  /** ما يُعرض تحت الآية المعلَّمة (أدواتُها وسطرُ معارفها) — بدل الشريط السفليّ */
  selectedExtras?: React.ReactNode;
  onAyahMarker: (a: AyahDoc) => void;
  onAyahPick: (a: AyahDoc) => void;
  selectedAyahNo: number | null;
  targetAyahNo: number | null;
  rubMarks: Map<number, string>;
  opening?: boolean;
}) {
  const { script, tajwid, layers } = useSettings();
  const kullReady = useKulliyat(); // to mark كلّيّات on the page
  const ar = getUILang() === "ar";
  const first = ayahs[0];
  const surahNo = first?.surahNo ?? 0;
  // the band names the surah that BEGINS on this page (ayahNo===1) — which can
  // differ from the first ayah physically on it (~51 pages carry two suras).
  const startAyah = ayahs.find((a) => a.ayahNo === 1);
  return (
    <section className={`mushaf-page${opening ? " opening" : ""}`}>
      <div className="mp-margin">
        <span>{ar ? "الجزء" : "Juz"} {num(first?.juz ?? 0)}</span>
        <span>{surahNameAr(surahNo)} · {ar ? "الحزب" : "Hizb"} {num(first?.hizb ?? 0)}</span>
      </div>
      {startAyah && (
        <div className="mp-surah-band">
          <span className="mp-surah-name quran">سورة {surahNameAr(startAyah.surahNo)}</span>
          {startAyah.surahNo !== 1 && startAyah.surahNo !== 9 && <div className="mp-basmala quran">{BASMALA}</div>}
        </div>
      )}
      <div className="quran">
        {ayahs.map((ayah) => {
          const rub = rubMarks.get(ayah.ayahNo);
          const ws = wordsByAyah.get(ayah.ayahNo) ?? [];
          const colored = tajwid ? tajwidWords(ws.map((w) => w.textUthmani)) : null;
          // mark آيات كلّيّة (the computed flagship verses) with a gold marker
          const isKulliya = !!(layers.jawami && kullReady && classOf(`${ayah.surahNo}:${ayah.ayahNo}`)?.tier === "كلّية");
          return (
            <Fragment key={ayah.location}>
              {rub && <div className="mp-mark mp-rub"><span>۞ {num(rub)}</span></div>}
              {ayah.sajdaType && <div className="mp-mark mp-sajda"><span>۩ موضع سجدة</span></div>}
              {/* «القراءةُ أولًا»: النقرُ في أيِّ مكانٍ من الآية — حتى فوق كلماتها —
                  يعلّمها؛ وبياناتُ الكلمة بنقرٍ طويلٍ (جوال) أو بنقرةٍ بعد التعليم
                  (حاسوب) — قرار المالك 2026-07-29 */}
              <span
                id={`ayah-${ayah.surahNo}-${ayah.ayahNo}`}
                className={`mp-ayah${targetAyahNo === ayah.ayahNo ? " target" : ""}${selectedAyahNo === ayah.ayahNo ? " sel-ayah" : ""}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".ayah-marker")) return;
                  onAyahPick(ayah);
                }}
              >
                {ws.map((w, wi) => (
                  <span key={w.location}>
                    <span
                      className={`w${selected === w.location ? " sel" : ""}`}
                      onClick={(e) => press.onClick(e, w)}
                    >
                      {colored
                        ? colored[wi].map((s, i) =>
                            s.rule ? (
                              <span key={i} className={TAJWID[s.rule].cls} title={TAJWID[s.rule].ar}>{s.text}</span>
                            ) : (
                              <span key={i}>{s.text}</span>
                            ),
                          )
                        : script === "imlaai" ? w.textClean : w.textUthmani}
                    </span>{" "}
                  </span>
                ))}{" "}
                <span
                  className={`ayah-marker${isKulliya ? " jamia" : ""}`}
                  role="button"
                  title={`${t("reader.ayat")} ${num(ayah.ayahNo)}${ayah.sajdaType ? " ۩" : ""}${isKulliya ? ` · ${ar ? "آيةٌ كلّيّة" : "kulliyya"}` : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => onAyahMarker(ayah)}
                >
                  ﴿{num(ayah.ayahNo)}﴾
                </span>{" "}
              </span>
              {selectedAyahNo === ayah.ayahNo && selectedExtras}
            </Fragment>
          );
        })}
      </div>
      <div className="page-no">﴾ {num(page)} ﴿</div>
    </section>
  );
}

export default function Reader() {
  useUILang();
  const params = useParams<{ surahNo: string; ayahNo?: string }>();
  const navigate = useNavigate();
  // مفتاحُ كلِّ انتقال — به يُعاد التمريرُ إلى الآية حتى لو كان الرابطُ نفسَه
  // (رصدُ المالك: البحثُ عن الآية ثانيةً لم يعد يحرّك إليها)
  const navKey = useLocation().key;
  // ?know=twin|links|wujuh — سؤالُ الاستقبال يفتح جوابَه: الآيةُ تُعلَّم ولوحتُها تُفتح
  const [searchParams] = useSearchParams();
  const knowParam = searchParams.get("know") as "twin" | "links" | "wujuh" | null;
  const surahNo = Number(params.surahNo);
  const targetAyahNo = params.ayahNo != null ? Number(params.ayahNo) : null;
  const narrow = useNarrow();
  // صفحات is the default (easiest for most readers); آيات is opt-in for its
  // tools/translation/«مثلها». A returning reader's explicit choice is remembered.
  const [mode, setMode] = useState<Mode>(
    // «الصفحاتُ هي الأصل» (أمر المالك 2026-07-29): سيلُ المصحف المتصل هو
    // الافتراضيّ، و«آيات» بأدواتها اختيارٌ يُحفظ لمن بدّل إليه.
    () => (localStorage.getItem(MODE_KEY) === "ayat" ? "ayat" : "pages"),
  );
  const switchMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const [ayahs, setAyahs] = useState<AyahDoc[]>([]);
  const [wordsByAyah, setWordsByAyah] = useState<Map<number, WordDoc[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WordDoc | null>(null);
  // فواصلُ وحدات السياق المحسوبة (نمط الآيات فقط — صفحات المصحف تبقى بلا إقحام)
  const [siyaqReady, setSiyaqReady] = useState(false);
  useEffect(() => {
    // الأسماءُ الإنجليزيةُ تُجلب مع الوحدات — فالفاصلُ يُعرض بلغة القارئ
    Promise.all([loadSiyaq(), loadSiyaqEn()]).then(() => setSiyaqReady(true));
  }, []);
  // which ayah's محكم→تفصيل panel is open (آيات mode); one at a time keeps the
  // page short and the panel renders beneath the verse, not above it.
  // ONE study panel open at a time (إعراب · تفصيل · مثلها · تدبّر) — no wall of
  // stacked panels around a single ayah. Key = "kind:surah:ayah".
  // مودالُ بيانات الآية يفتحه النقرُ على رقمها أو على كلمةٍ منها — أما النقرُ
  // في فراغها فيحدّدها بالخضرة فقط (قرار المالك 2026-07-21)
  const [verseSheet, setVerseSheet] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null); // the scroll container (for page-turn scroll-to-top + the FAB)
  const bookmarks = useBookmarks();

  useEffect(() => {
    let cancelled = false;
    listSurahs().then((all: SurahDoc[]) => {
      if (!cancelled) setSurahs(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One fetch per surah: ayahs + all words, grouped by ayahNo with a Map.
  useEffect(() => {
    if (!Number.isInteger(surahNo) || surahNo < 1 || surahNo > 114) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    Promise.all([listAyahs(surahNo), listWords(surahNo)])
      .then(([ay, ws]: [AyahDoc[], WordDoc[]]) => {
        if (cancelled) return;
        const byAyah = new Map<number, WordDoc[]>();
        for (const w of ws) {
          const bucket = byAyah.get(w.ayahNo);
          if (bucket) bucket.push(w);
          else byAyah.set(w.ayahNo, [w]);
        }
        setAyahs(ay);
        setWordsByAyah(byAyah);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setAyahs([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [surahNo]);

  /** cumulative ayahs before each surah — global id = base + ayahNo */
  const surahBase = useMemo(() => {
    const map = new Map<number, number>();
    let acc = 0;
    for (const s of surahs) {
      map.set(s.surahNo, acc);
      acc += s.ayahCount;
    }
    return map;
  }, [surahs]);

  // remember the last reading position (for resume) and advance khatma progress
  useEffect(() => {
    if (Number.isInteger(surahNo) && surahNo >= 1 && surahNo <= 114) {
      localStorage.setItem("quran-studio:last-read", `${surahNo}:${targetAyahNo ?? 1}`);
      const base = surahBase.get(surahNo);
      if (base != null) recordProgress(base + (targetAyahNo ?? 1));
    }
  }, [surahNo, targetAyahNo, surahBase]);

  // وصولٌ من سؤال استقبال: علِّم الآيةَ الهدف كي يظهر سطرُ معارفها مفتوحًا
  useEffect(() => {
    if (knowParam && targetAyahNo != null) setSelectedAyah(`${surahNo}:${targetAyahNo}`);
  }, [knowParam, surahNo, targetAyahNo]);

  // Scroll the :ayahNo target into view once the surah has rendered — keyed
  // by navKey too, so repeating the SAME search result still scrolls to it.
  useEffect(() => {
    if (loading || targetAyahNo == null) return;
    const el = document.getElementById(`ayah-${surahNo}-${targetAyahNo}`);
    el?.scrollIntoView({ block: "center" });
  }, [loading, surahNo, targetAyahNo, mode, navKey]);

  // Landing on a new surah (no specific ayah) starts at the top so reading
  // continues naturally — especially on mobile where the page is one column.
  useEffect(() => {
    if (loading || targetAyahNo != null) return;
    mainRef.current?.scrollTo({ top: 0 });
  }, [loading, surahNo, targetAyahNo]);

  const surah = useMemo(() => surahs.find((s) => s.surahNo === surahNo), [surahs, surahNo]);

  // follow-along: highlight and scroll to the ayah being recited; if the
  // recitation crosses into another surah, follow it.
  const playingId = usePlayingId();
  const playingAyahNo = useMemo(() => {
    if (playingId === 0 || surahs.length === 0) return null;
    const base = surahBase.get(surahNo) ?? 0;
    const within = playingId - base;
    return within >= 1 && within <= (surah?.ayahCount ?? 0) ? within : null;
  }, [playingId, surahBase, surahNo, surah, surahs.length]);

  useEffect(() => {
    if (isPreviewPlaying()) return; // a «مثلها» sample must not move the reader
    if (playingAyahNo != null) {
      document
        .getElementById(`ayah-${surahNo}-${playingAyahNo}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (playingId > 0 && surahs.length > 0) {
      // recitation moved outside this surah — follow it
      let acc = 0;
      for (const s of surahs) {
        if (playingId <= acc + s.ayahCount) {
          if (s.surahNo !== surahNo) navigate(`/read/${s.surahNo}/${playingId - acc}`, { replace: true });
          break;
        }
        acc += s.ayahCount;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, playingAyahNo]);

  const pages = useMemo(() => {
    const byPage = new Map<number, AyahDoc[]>();
    for (const a of ayahs) {
      const bucket = byPage.get(a.page);
      if (bucket) bucket.push(a);
      else byPage.set(a.page, [a]);
    }
    return [...byPage.entries()].sort((x, y) => x[0] - y[0]);
  }, [ayahs]);

  // ۞ hizb/rub-quarter marks: ayahNo → «الحزب N» / «الربع» / «النصف» / «الثلاثة أرباع»
  const QUARTER = ["", "الربع", "النصف", "الثلاثة أرباع"];
  const rubMarks = useMemo(() => {
    const m = new Map<number, string>();
    let prev: number | null = ayahs[0]?.rub ?? null;
    for (const a of ayahs) {
      if (prev !== null && a.rub !== prev) {
        const q = (a.rub - 1) % 4;
        m.set(a.ayahNo, q === 0 ? `الحزب ${Math.ceil(a.rub / 4)}` : QUARTER[q]);
      }
      prev = a.rub;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayahs]);

  /* الصفحاتُ سيلٌ متصلٌ الآن — الأسهمُ تنتقل بين السور لا بين صفحاتٍ مقصوصة */
  const flipPage = (dir: -1 | 1) => {
    if (dir === 1 && surahNo < 114) navigate(`/read/${surahNo + 1}`);
    else if (dir === -1 && surahNo > 1) navigate(`/read/${surahNo - 1}`);
  };

  const goTo = (n: number) => navigate(`/read/${n}`);

  // Ayah selection + navigation (reading controller). Selecting an ayah opens
  // the ReadingBar; ← → move ayah (crossing surah at the ends); Esc clears.
  const { selected: selectedLoc } = useReading();
  const selectAyah = (loc: string) => {
    setSelectedAyah(loc);
    document.getElementById(`ayah-${loc.split(":")[0]}-${loc.split(":")[1]}`)?.scrollIntoView({ block: "center" });
  };
  // مساكاتُ الكلمة الموحّدة (صفحاتٍ وآيات): طويلًا على الجوال، وبعد التعليم على الحاسوب
  const wordPress = useWordPress<WordDoc>({
    isAyahSelected: (w) => selectedLoc === `${w.surahNo}:${w.ayahNo}`,
    onOpenWord: (w) => setSelected(w),
  });
  const navigateAyah = (dir: -1 | 1) => {
    if (!selectedLoc) return;
    const [ss, aa] = selectedLoc.split(":").map(Number);
    const cntOf = (n: number) => surahs.find((s) => s.surahNo === n)?.ayahCount ?? 0;
    let ns = ss;
    let na = aa + dir;
    if (na < 1) {
      // cross backward to the previous surah's LAST ayah (never ayah 0)
      if (ss <= 1) return;
      ns = ss - 1;
      na = cntOf(ns) || 1;
    } else if (na > cntOf(ss)) {
      // cross forward to the next surah's first ayah
      if (ss >= 114) return;
      ns = ss + 1;
      na = 1;
    }
    const loc = `${ns}:${na}`;
    if (ns === surahNo) {
      selectAyah(loc); // same surah in view — select + scroll
    } else {
      navigate(`/read/${ns}/${na}`); // crossed a boundary — go there AND keep selection in sync
      setSelectedAyah(loc);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
      if (!selectedLoc) {
        // no ayah selected → arrows turn the mushaf page (RTL: ← forward)
        if (mode === "pages") {
          const rtl = getUILang() === "ar";
          if (e.key === "ArrowLeft") { e.preventDefault(); flipPage(rtl ? 1 : -1); }
          else if (e.key === "ArrowRight") { e.preventDefault(); flipPage(rtl ? -1 : 1); }
        }
        return;
      }
      if (e.key === "ArrowRight") { e.preventDefault(); navigateAyah(getUILang() === "ar" ? -1 : 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); navigateAyah(getUILang() === "ar" ? 1 : -1); }
      else if (e.key === "Escape") setSelectedAyah(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!Number.isInteger(surahNo) || surahNo < 1 || surahNo > 114) {
    return (
      <div className="page">
        <div className="card page-narrow">
          <p>
            {t("notFound")} — <b>{params.surahNo}</b>
          </p>
          <Link to="/read/1">الفاتحة</Link>
        </div>
      </div>
    );
  }

  const ar = getUILang() === "ar";
  // which ayah to visually mark as "playing/target" — a «مثلها» preview must
  // NOT move the highlight (same rule the scroll/page-sync effects follow).
  const displayTargetAyahNo = isPreviewPlaying() ? targetAyahNo : (playingAyahNo ?? targetAyahNo);

  const listenSurah = () => playContinuous((surahBase.get(surahNo) ?? 0) + 1);


  /** الجوال: مبدّلُ «صفحات | آيات» ظاهرٌ في الصفِّ اللاصق نفسِه بأيقونتين
   *  مصغّرتين + ▶ للسورة — لا رأسَ ثالثًا ولا قائمةَ ⋮ (أمر المالك 2026-07-29:
   *  «يريدون التاب كما في الكمبيوتر ولا أريد ٣ هيدر فوق بعض»). */
  const MobileControls = () => (
    <div className="rd-ctrl rd-ctrl-m">
      <button className="rd-listen" onClick={listenSurah} title={ar ? "استمع للسورة كاملةً" : "listen to the sura"}>▶</button>
      <div className="rd-seg rd-seg-m" role="tablist" aria-label={ar ? "طريقة العرض" : "view mode"}>
        <button role="tab" aria-selected={mode === "pages"} className={mode === "pages" ? "on" : ""} onClick={() => switchMode("pages")}
          title={ar ? "صفحات المصحف" : "mushaf pages"} aria-label={ar ? "صفحات" : "pages"}>
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="2.5" width="14" height="15" rx="2"/><path d="M10 2.5v15"/></svg>
        </button>
        <button role="tab" aria-selected={mode === "ayat"} className={mode === "ayat" ? "on" : ""} onClick={() => switchMode("ayat")}
          title={ar ? "آياتٌ بأدواتها" : "verses with tools"} aria-label={ar ? "آيات" : "verses"}>
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3.5 4.5h13M3.5 10h13M3.5 15.5h9"/></svg>
        </button>
      </div>
    </div>
  );

  /** الحاسوب: الضوابطُ ظاهرةً — ▶ استمع + مبدّل «صفحات | آيات». */
  const HeaderControls = () => (
    <div className="rd-ctrl">
      <button className="rd-listen" onClick={listenSurah} title={ar ? "استمع للسورة كاملةً" : "listen to the sura"}>▶</button>
      <div className="rd-seg" role="tablist" aria-label={ar ? "طريقة العرض" : "view mode"}>
        {(["pages", "ayat"] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => switchMode(m)}>
            {m === "pages" ? t("reader.pages") : t("reader.ayat")}
          </button>
        ))}
      </div>
    </div>
  );

  // mobile: lock the page scroll behind the bottom sheet so it feels like a
  // native modal (the sheet itself scrolls internally).
  useEffect(() => {
    if (!narrow) return;
    const el = mainRef.current;
    // القفلُ للمودال وحدَه — لا لتحديد الآية (علّةٌ رصدها المالك: التمريرُ توقّف
    // على الجوال لأن التحديدَ كان يقفل التمرير 2026-07-26)
    const open = !!(selected || verseSheet);
    if (el) el.style.overflowY = open ? "hidden" : "";
    return () => { if (el) el.style.overflowY = ""; };
  }, [narrow, selected, verseSheet]);

  /** النقرُ خارج الآية يزيل تعليمَها (أمر المالك 2026-07-29) — ما لم تقع
   *  النقرةُ على آيةٍ أو لوحتها أو أداةٍ تفاعلية. */
  const clearOnOutside = (e: React.MouseEvent) => {
    if (!selectedLoc) return;
    const el = e.target as HTMLElement;
    if (el.closest(".ayah-card, .mp-ayah, .ayah-panel, .word-sheet, .sheet-backdrop, .wq-overlay, button, a, input, select, .v-more-menu")) return;
    setSelectedAyah(null);
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }} onClick={clearOnOutside}>
      {!narrow && <SurahSidebar surahs={surahs} activeNo={surahNo} onPick={goTo} />}

      <main ref={mainRef} className="page reader-main" style={{ flex: 1, minWidth: 0 }}>
        {/* Mobile: ONE sticky header — surah picker (carries the name), the
            on-page search, a compact ▶, and the mode toggle. Stays under the
            app header so you switch surah / jump / change view without scrolling
            up; no second bar. */}
        {surah && narrow && (
          <>
            <div className="reader-sticky">
              <div className="reader-sticky-search"><InlineOmni /></div>
              <select
                className="reader-surah-pick"
                value={surahNo}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => goTo(Number(e.target.value))}
                aria-label={t("reader.filter")}
              >
                {surahs.map((s) => (
                  <option key={s.surahNo} value={s.surahNo}>
                    {getUILang() === "ar" ? `${s.surahNo}. ${s.nameAr}` : `${s.surahNo}. ${s.nameTranslit}`}
                  </option>
                ))}
              </select>
              <MobileControls />
            </div>
          </>
        )}

        {/* Desktop: name · meta · on-page search · listen · modes. */}
        {surah && !narrow && (
          <div className="reader-head-wrap">
            <header className="reader-bar">
              {/* البحثُ أوّلَ الصدر (يمينًا في العربية)، والسورةُ في الطرف المقابل */}
              <div className="reader-bar-search"><InlineOmni /></div>
              <span className="reader-bar-spacer" />
              {getUILang() === "ar" ? (
                <span className="reader-bar-name quran">{surah.nameAr}</span>
              ) : (
                <span className="reader-bar-name" style={{ fontWeight: 700 }}>
                  {surah.nameTranslit} <span className="quran" style={{ opacity: 0.45, fontWeight: 400 }}>{surah.nameAr}</span>
                </span>
              )}
              <span className="muted reader-bar-meta">
                {surah.revelation === "Meccan" ? t("reader.meccan") : t("reader.medinan")} ·{" "}
                {ayahsCount(surah.ayahCount)}
              </span>
              <HeaderControls />
            </header>
            {/* شريطُ الترجمات صفًّا ثانيًا في الكتلة اللاصقة نفسِها — لا تراكبَ عند التمرير */}
            {mode === "ayat" && <EnTransBar />}
          </div>
        )}

        {!loading && <WelcomeQuestions />}
        {/* الجوال: شريطُ الترجمات تحت الصفّ اللاصق (الحاسوبُ يحمله في كتلة الرأس) */}
        {!loading && narrow && mode === "ayat" && <EnTransBar />}
        {loading ? (
          <p className="muted">{t("loading")}</p>
        ) : ayahs.length === 0 ? (
          <p className="muted">{t("notFound")}</p>
        ) : mode === "pages" ? (
          /* سيلُ المصحف المتصل: كلُّ صفحات السورة تتوالى بالتمرير الطبيعيّ —
             أُلغي التنقّلُ صفحةً صفحةً بزرّ (رصد المالك 2026-07-29: «في كل صفحة
             يلزمه سكرول ثم النقر على التالي — تجربة غير جيدة») */
          <div className="mushaf-stage">
            {pages.map(([pageNo, pageAyahs]) => (
              <MushafPage
                key={pageNo}
                page={pageNo}
                ayahs={pageAyahs}
                wordsByAyah={wordsByAyah}
                selected={selected?.location ?? null}
                press={wordPress}
                selectedExtras={(() => {
                  if (!selectedLoc) return undefined;
                  const selAyah = pageAyahs.find((a) => a.location === selectedLoc);
                  if (!selAyah) return undefined;
                  return (
                    <AyahPanel
                      ayah={selAyah}
                      words={wordsByAyah.get(selAyah.ayahNo) ?? []}
                      onClose={() => setSelectedAyah(null)}
                      onOpenAyat={() => { switchMode("ayat"); navigate(`/read/${selAyah.surahNo}/${selAyah.ayahNo}`); }}
                    />
                  );
                })()}
                onAyahMarker={(a: AyahDoc) => { setSelectedAyah(a.location); setVerseSheet(a.location); }}
                onAyahPick={(a: AyahDoc) => setSelectedAyah(selectedLoc === a.location ? null : a.location)}
                selectedAyahNo={selectedLoc && Number(selectedLoc.split(":")[0]) === surahNo ? Number(selectedLoc.split(":")[1]) : null}
                targetAyahNo={displayTargetAyahNo}
                rubMarks={rubMarks}
                opening={pageNo === 1 || pageNo === 2}
              />
            ))}
          </div>
        ) : (
          ayahs.map((ayah: AyahDoc) => {
            const isTarget = displayTargetAyahNo === ayah.ayahNo;
            const su = siyaqReady ? unitOf(ayah.location) : null;
            const unitStart = su && su.a1 === ayah.ayahNo && su.a1 !== 1 ? su : null;
            // «القراءةُ أولًا»: التعليمُ (الخضرةُ ولوحةُ الآية) لما علَّمه القارئُ
            // بيده وحدَه — وآيةُ الرابط «هدفٌ» بتظليلٍ خفيفٍ بلا لوحة، فلا تُعلَّم
            // الأولى قسرًا كلّما خلا الاختيار (رصد المالك 2026-07-29: استئنافُ
            // القراءة يفتح /read/س/١ فكانت الأولى تخطف التعليم)
            const marked = selectedLoc === ayah.location;
            const showTools = marked;
            return (
              <Fragment key={ayah.location}>
              {/* فاصلُ السياق قبل بطاقة الآية لا داخلَها — كان يصطبغ بتعليمها
                  فيُظنُّ اسمُه جزءًا منها (رصد المالك 2026-07-29) */}
              {unitStart && (() => {
                // بلغة القارئ: العربيُّ باسمها، وغيرُه بالاسم الإنجليزيّ المولَّد —
                // وإن غاب أُخفي الفاصلُ (أمر المالك: أخفِ ما لا إنجليزيَّ فيه)
                const nm = getUILang() === "ar" ? unitStart.name : siyaqNameEn(unitStart);
                if (!nm) return null;
                return (
                  <div className="sq-sep" title={`${surahNameAr(unitStart.s)} ${num(unitStart.a1)}–${num(unitStart.a2)}`}>
                    <span className="sq-sep-name">{nm}</span>
                  </div>
                );
              })()}
              <article
                id={`ayah-${ayah.surahNo}-${ayah.ayahNo}`}
                className={`ayah-card${getUILang() !== "ar" ? " en-first" : ""}${marked ? " sel-ayah" : isTarget && !selectedLoc ? " target-ayah" : ""}`}
                onClick={(e) => {
                  const el = e.target as HTMLElement;
                  if (el.closest("button, a, .ayah-tools, .v-more-menu, input, select")) return;
                  setSelectedAyah(selectedLoc === ayah.location ? null : ayah.location);
                }}
              >
                <AyahText
                  words={wordsByAyah.get(ayah.ayahNo) ?? []}
                  ayahNo={ayah.ayahNo}
                  selected={selected?.location ?? null}
                  press={wordPress}
                />
                {/* «وضعُ الفهم»: الترجمةُ متنٌ مقروءٌ تحت كل آيةٍ عند الواجهة غير العربية */}
                <EnVerseLine ayah={ayah} />
                {/* لوحةُ الآية الواحدة — الرأسُ والمعارفُ والأدواتُ في بطاقةٍ منظّمةٍ
                    بهوية مشكاة (أمر المالك 2026-07-29؛ ألغت قائمةَ النقاط الثلاث) */}
                {showTools && (
                  <AyahPanel
                    ayah={ayah}
                    words={wordsByAyah.get(ayah.ayahNo) ?? []}
                    onClose={() => setSelectedAyah(null)}
                    initialOpen={knowParam && isTarget ? knowParam : undefined}
                  />
                )}
              </article>
              </Fragment>
            );
          })
        )}
      </main>

      {narrow && <ScrollTopFab scrollerRef={mainRef} />}

      {(selected || verseSheet) && (
        <>
          <div className="sheet-backdrop" onClick={() => { setSelected(null); setVerseSheet(null); }} />
          <div className="word-sheet card" role="dialog" aria-modal="true">
            <div className="word-sheet-grip" aria-hidden />
            <button
              className="word-sheet-close"
              onClick={() => { setSelected(null); setVerseSheet(null); }}
              aria-label={ar ? "إغلاق" : "close"}
            >
              ✕
            </button>
            <div className="word-sheet-body">
              {verseSheet && !selected && (() => {
                const [ss, aa] = verseSheet.split(":").map(Number);
                const ay = ayahs.find((a) => a.surahNo === ss && a.ayahNo === aa);
                return ay ? (
                  <div className="ws-ayah">
                    <div className="ws-ayah-ref muted">{surahNameAr(ss)} · {ar ? `الآية ${num(aa)}` : `v.${aa}`}</div>
                    <div className="quran ws-ayah-text">
                      {ay.textUthmani}<span className="ayah-marker"> ﴿{num(aa)}﴾</span>
                    </div>
                  </div>
                ) : null;
              })()}
              <VerseContext location={verseSheet ?? selectedLoc} />
              {(verseSheet ?? selectedLoc) && <MuhkamaLine location={(verseSheet ?? selectedLoc)!} />}
              {selected && <Inspector word={selected} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
