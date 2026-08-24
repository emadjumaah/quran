/**
 * **بابُ التثبيت — تدبيرُه وسجلُّه.**
 *
 * حالُ «التثبيت» في التلاوة كانت حجابًا ينكشف بالتلاوة (ف٣)، **وههنا تمامُها**:
 * أن يُعرف للحافظ **أين يزلّ** قبل أن يزلّ، وأن يُسأل عند المفرق، وأن يُسجَّل
 * ضعفُه **بالزوج لا بالآية** فتُوجَّه المراجعةُ إلى العلاقة.
 *
 * وثلاثةُ أشياءَ ههنا لا رابعَ لها: **المدى** الذي يُنظر فيه (سورةٌ أو صفحة)،
 * و**اختيارُ المسألة** من الجدول، و**السجلّ** في هذا الجهاز.
 *
 * **والسجلُّ موضعٌ وعدد**: مفتاحُ العلاقة، وحالُها في الجدول، وكم مرّةً زلّ
 * عنها — **ولا سلاسلَ ولا نقاطٍ ولا شارات** (قرارُ مالكٍ مُقرٌّ مرّتين). ولا
 * يخرج منه شيءٌ إلى شبكة: تخزينُ المتصفّح وحدَه.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AGAIN, GOOD, review, type Card } from "./fsrs";
import {
  buildFuruq,
  loadFuruq,
  questionOf,
  wordsOf,
  type Furuq,
  type Pairing,
  type Question,
  type TwinGroup,
} from "./furuq";
import type { Mushaf } from "./mushaf";

/** ألسنةُ الورقة: خريطةُ المفارق · التدريب · سجلُّك */
export type Tab = "map" | "drill" | "log";

/** المدى الذي يُنظر فيه — **سورةٌ أو صفحة**، وهما ما يفتح بهما الحافظُ وردَه */
export type Scope = { kind: "surah"; n: number } | { kind: "page"; n: number };

/** موضعُ التباسٍ في المدى — آيةٌ ونظائرُها */
export interface Site {
  key: string;
  kind: "fork" | "twin";
  /** الآيةُ التي في المدى */
  id: number;
  loc: string;
  /** نظائرُها خارجَ المدى أو فيه */
  others: { loc: string; id: number }[];
  /** عدّةُ مفارقها — و`0` في التوأم التامّ */
  forks: number;
  /** كم مرّةً زلّ عنها */
  lapses: number;
}

/** مسألةٌ معروضةٌ الآن */
export interface Drill {
  key: string;
  /** **سؤالُ المفرق**: أيُّ الوجهين ههنا؟ */
  q: Question | null;
  /** **التوأمُ التامّ**: أين تقع؟ — وقالبُه غيرُ قالب الوجهين */
  twin: TwinGroup | null;
  /** أيُعرض وجهُ «ب» أوّلًا؟ — فلا يكون الصوابُ في موضعٍ واحدٍ دائمًا */
  flip: boolean;
}

/** سطرٌ في السجلّ — **بالعلاقة لا بالآية** */
export interface LogRow {
  key: string;
  kind: "fork" | "twin";
  places: { loc: string; id: number }[];
  lapses: number;
  reps: number;
  due: string;
}

const KEY = "tilawa.tathbit.v1";

type Store = Record<string, Card>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return {};
    const out: Store = {};
    for (const [k, c] of Object.entries(v as Record<string, Partial<Card>>)) {
      if (typeof c?.s === "number" && typeof c.d === "number" && typeof c.due === "string") {
        out[k] = {
          s: c.s,
          d: c.d,
          due: c.due,
          last: typeof c.last === "string" ? c.last : c.due,
          reps: typeof c.reps === "number" ? c.reps : 1,
          lapses: typeof c.lapses === "number" ? c.lapses : 0,
        };
      }
    }
    return out;
  } catch {
    return {}; /* الجهازُ قد يمنع التخزين — ولا يُبطل ذلك التدريب */
  }
}

function writeStore(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* لا شيء — يمضي المجلسُ ولا يُحفظ */
  }
}

/** **علاقةٌ واحدةٌ مجرّدةٌ** — يستوي فيها الزوجُ ذو المفارق ومجموعةُ التوائم */
interface Rel {
  key: string;
  kind: "fork" | "twin";
  pair: Pairing | null;
  twin: TwinGroup | null;
  /** مواضعُها بترتيب المصحف */
  places: { loc: string; id: number }[];
}

const relsOf = (f: Furuq): Map<string, Rel> => {
  const m = new Map<string, Rel>();
  for (const p of f.pairs) {
    m.set(p.key, {
      key: p.key,
      kind: "fork",
      pair: p,
      twin: null,
      places: [
        { loc: p.a, id: p.idA },
        { loc: p.b, id: p.idB },
      ].sort((x, y) => x.id - y.id),
    });
  }
  for (const g of f.twins) {
    m.set(g.key, {
      key: g.key,
      kind: "twin",
      pair: null,
      twin: g,
      places: g.places.map((pl) => ({ loc: pl.loc, id: pl.id })),
    });
  }
  return m;
};

/** أتقع آيةٌ في المدى؟ */
const inScope = (m: Mushaf, sc: Scope, id: number): boolean =>
  sc.kind === "page" ? m.ayahs[id - 1].page === sc.n : m.ayahs[id - 1].surahNo === sc.n;

export interface Tathbit {
  /** أمفتوحٌ البابُ؟ — وبه تُوسَم آياتُ الالتباس في الصفحة */
  on: boolean;
  open: (at: number) => void;
  close: () => void;
  /** لسانُ الورقة — و`null` أنّها مطويّةٌ والوسمُ قائم */
  tab: Tab | null;
  show: (t: Tab | null) => void;
  material: Furuq | null;
  failed: boolean;
  scope: Scope;
  setScope: (s: Scope) => void;
  /** **الآياتُ الموسومةُ كلُّها** — مجموعةٌ واحدةٌ ثابتةٌ تقرأ منها كلُّ صفحة */
  marks: Set<number> | null;
  sites: Site[];
  drill: Drill | null;
  /** أجابَ؟ — و`true` أنّه وقع على المفرق */
  answered: boolean | null;
  answer: (right: boolean) => void;
  next: () => void;
  log: LogRow[];
  /** ما حلّ أجلُه الآن، وما مضى من العلاقات */
  due: number;
  seen: number;
}

export function useTathbit(mushaf: Mushaf | null): Tathbit {
  const [on, setOn] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [raw, setRaw] = useState<Furuq | null>(null);
  const [failed, setFailed] = useState(false);
  const [scope, setScope] = useState<Scope>({ kind: "page", n: 1 });
  const [store, setStore] = useState<Store>({});
  const [key, setKey] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean | null>(null);

  /* **المادّةُ لا تُجلب لمن لم يفتح الباب** — ٦٩٨ ك.ب لا تُحمَّل على قارئٍ يقرأ */
  useEffect(() => {
    if (!on || !mushaf || raw || failed) return;
    let live = true;
    loadFuruq().then(
      (f) => live && setRaw(buildFuruq(mushaf, f)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [on, mushaf, raw, failed]);

  const rels = useMemo(() => (raw ? relsOf(raw) : null), [raw]);

  const marks = useMemo(() => {
    if (!raw) return null;
    const s = new Set<number>();
    for (const id of raw.byAyah.keys()) s.add(id);
    for (const id of raw.twinsByAyah.keys()) s.add(id);
    return s;
  }, [raw]);

  const open = useCallback(
    (at: number) => {
      setStore(readStore());
      setOn(true);
      setTab("map");
      if (mushaf) setScope({ kind: "page", n: mushaf.ayahs[at - 1].page });
    },
    [mushaf],
  );

  const close = useCallback(() => {
    setOn(false);
    setTab(null);
    setKey(null);
    setAnswered(null);
  }, []);

  /** مواضعُ الالتباس في المدى — بترتيب المصحف، **وكلُّ علاقةٍ مرّةً واحدة** */
  const sites = useMemo<Site[]>(() => {
    if (!raw || !rels || !mushaf) return [];
    const out: Site[] = [];
    const seen = new Set<string>();
    for (const r of rels.values()) {
      const here = r.places.find((p) => inScope(mushaf, scope, p.id));
      if (!here || seen.has(r.key)) continue;
      seen.add(r.key);
      out.push({
        key: r.key,
        kind: r.kind,
        id: here.id,
        loc: here.loc,
        others: r.places.filter((p) => p.id !== here.id),
        forks: r.pair ? r.pair.forks.length : 0,
        lapses: store[r.key]?.lapses ?? 0,
      });
    }
    out.sort((x, y) => x.id - y.id);
    return out;
  }, [raw, rels, mushaf, scope, store]);

  /**
   * **اختيارُ المسألة**: ما حلّ أجلُه أوّلًا (أقدمُه أجلًا)، فإن لم يكن فما لم
   * يُعرض بعدُ **على ترتيب المصحف**، فإن نفد فأقربُ الآجال. **والمدى يُقدَّم**:
   * ما كان في السورة أو الصفحة التي اختارها قبل ما سواه؛ فإن خلا المدى مضى
   * إلى غيره **ولا يقف الحافظُ على فراغ**.
   */
  const pick = useCallback(
    (avoid: string | null): string | null => {
      if (!rels) return null;
      const now = Date.now();
      const keys = sites.map((s) => s.key);
      const wide = [...rels.keys()];
      const order = [...keys, ...wide.filter((k) => !keys.includes(k))];
      const dueNow: string[] = [];
      const fresh: string[] = [];
      let soonest: string | null = null;
      let soonestAt = Infinity;
      for (const k of order) {
        if (k === avoid) continue;
        const c = store[k];
        if (!c) fresh.push(k);
        else if (Date.parse(c.due) <= now) dueNow.push(k);
        else if (Date.parse(c.due) < soonestAt) {
          soonestAt = Date.parse(c.due);
          soonest = k;
        }
      }
      dueNow.sort((x, y) => Date.parse(store[x].due) - Date.parse(store[y].due));
      return dueNow[0] ?? fresh[0] ?? soonest ?? avoid;
    },
    [rels, sites, store],
  );

  const next = useCallback(() => {
    setAnswered(null);
    setKey((k) => pick(k));
  }, [pick]);

  /* أوّلُ مسألةٍ حين يُفتح لسانُ التدريب */
  useEffect(() => {
    if (tab === "drill" && rels && !key) setKey(pick(null));
  }, [tab, rels, key, pick]);

  const drill = useMemo<Drill | null>(() => {
    if (!rels || !mushaf || !key) return null;
    const r = rels.get(key);
    if (!r) return null;
    const reps = store[key]?.reps ?? 0;
    if (r.kind === "twin") return { key, q: null, twin: r.twin, flip: false };
    const p = r.pair!;
    /* **دورةٌ محسوبةٌ لا قرعة**: يُسأل عن مفارقه واحدًا واحدًا، وعن الآيتين
       بالتناوب — فلا يبقى وجهٌ لم يُسأل عنه، ولا يُحفَظ موضعُ الجواب. */
    const roll = reps * 7 + p.idA;
    const fork = p.forks[reps % p.forks.length];
    return {
      key,
      q: questionOf(p, fork, roll % 2 ? "b" : "a", wordsOf(mushaf, p.idA), wordsOf(mushaf, p.idB)),
      twin: null,
      flip: Math.floor(roll / 2) % 2 === 1,
    };
  }, [rels, mushaf, key, store]);

  const answer = useCallback(
    (right: boolean) => {
      if (!key || answered !== null) return;
      setAnswered(right);
      setStore((s) => {
        const nextStore = { ...s, [key]: review(s[key] ?? null, right ? GOOD : AGAIN, Date.now()) };
        writeStore(nextStore);
        return nextStore;
      });
    },
    [key, answered],
  );

  const log = useMemo<LogRow[]>(() => {
    if (!rels) return [];
    const out: LogRow[] = [];
    for (const [k, c] of Object.entries(store)) {
      const r = rels.get(k);
      if (!r) continue;
      out.push({ key: k, kind: r.kind, places: r.places, lapses: c.lapses, reps: c.reps, due: c.due });
    }
    out.sort((x, y) => y.lapses - x.lapses || Date.parse(x.due) - Date.parse(y.due));
    return out;
  }, [rels, store]);

  const due = useMemo(() => {
    const now = Date.now();
    return log.filter((r) => Date.parse(r.due) <= now).length;
  }, [log]);

  return {
    on,
    open,
    close,
    tab,
    show: setTab,
    material: raw,
    failed,
    scope,
    setScope,
    marks,
    sites,
    drill,
    answered,
    answer,
    next,
    log,
    due,
    seen: log.length,
  };
}
