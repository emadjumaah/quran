/**
 * قشرةُ قسم «ميزان الأقوال» (فاحص داخليًّا) — مصدرٌ واحدٌ لكلِّ صفحات القسم.
 *
 * ألوانُ الحالات الستّ هادئةٌ من عائلة الهويّة، درجاتٌ وسطى تُقرأ في الوضعين
 * الفاتح والداكن — ولا تختلط بألوان رتب المراجع: لونُ الرتبة للسند، ولونُ
 * الحالة للحكم (خطّة إعادة البناء §٣).
 */

/** ألوانُ رتب المراجع الخمس — كما في لوح المراجع، تُستعمل لشارات سند الشواهد */
export const RANK_TONE: Record<number, string> = {
  1: "var(--gold, #c9a227)", 2: "#4a8f7b", 3: "#5b7fa8", 4: "#8a6fa8", 5: "#8f7a5b",
};

export const FAHIS_CSS = `
  .fahis { --line: color-mix(in oklab, currentColor 12%, transparent); }
  .fahis .v-tastaqim { --vc: #3f8264; }
  .fahis .v-taqyid { --vc: #b8892f; }
  .fahis .v-la-tastaqim { --vc: #a85454; }
  .fahis .v-lam-yatabayyan { --vc: #6b7f8f; }
  .fahis .v-mawquf { --vc: #848484; }
  .fahis .v-kharij-babina { --vc: #848484; }

  .fahis h1 { font-size: 1.9rem; margin: 0 0 6px; letter-spacing: -.01em; }
  .fahis .lede { font-size: 1.05rem; line-height: 1.9; opacity: .85; max-width: 62ch; }
  .fahis section { margin-top: 40px; }
  .fahis h2 { font-size: 1.25rem; margin: 0 0 4px; }
  .fahis h2 + .sub { opacity: .6; font-size: .9rem; margin: 0 0 18px; }

  /* أبوابُ القسم الثلاثة */
  .fahis .ftabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line);
    margin: 0 0 20px; flex-wrap: wrap; }
  .fahis .ftabs a { padding: 8px 14px; text-decoration: none; color: inherit; opacity: .6;
    border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: .95rem; white-space: nowrap; }
  .fahis .ftabs a:hover { opacity: .85; }
  .fahis .ftabs a.on { opacity: 1; font-weight: 600; border-color: var(--gold, #c9a227); }

  /* شريطُ الإحصاء — يعمل مصفاةً بالنقر */
  .fahis .fstats { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 18px 0 4px; }
  .fahis .fstats .tot { font-size: .92rem; opacity: .7; margin-inline-end: 6px; }
  .fahis .fstats button { font: inherit; font-size: .88rem; background: none; color: inherit;
    border: 1px solid var(--line); border-radius: 999px; padding: 3px 12px; cursor: pointer;
    display: inline-flex; gap: 7px; align-items: center; }
  .fahis .fstats button .d { width: 8px; height: 8px; border-radius: 50%; background: var(--vc); flex: none; }
  .fahis .fstats button[data-on="1"] { border-color: var(--vc);
    background: color-mix(in oklab, var(--vc) 10%, transparent); font-weight: 600; }

  /* البحثُ ومصفاةُ النوع */
  .fahis .ffind { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 6px; }
  .fahis .ffind input { font: inherit; font-size: 16px; flex: 1 1 240px; min-width: 0;
    padding: 8px 12px; border-radius: 9px; border: 1px solid var(--line);
    background: transparent; color: inherit; }
  .fahis .fkinds { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 10px; }
  .fahis .fkinds button { font: inherit; font-size: .8rem; background: none; color: inherit;
    border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; cursor: pointer; opacity: .75; }
  .fahis .fkinds button[data-on="1"] { opacity: 1; font-weight: 600;
    border-color: color-mix(in oklab, currentColor 45%, transparent); }

  /* صفوفُ الفهرس */
  .fahis .frows { margin-top: 6px; }
  .fahis .frow { display: flex; gap: 10px; align-items: baseline; padding: 13px 4px;
    border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
  .fahis .frow:hover { background: color-mix(in oklab, currentColor 4%, transparent); }
  .fahis .frow .t { flex: 1; font-weight: 600; line-height: 1.75; min-width: 0; }
  .fahis .frow .k { font-size: .76rem; opacity: .55; border: 1px solid var(--line);
    border-radius: 999px; padding: 1px 8px; white-space: nowrap; flex: none; }
  .fahis .fempty { opacity: .6; padding: 18px 4px; }

  /* شارةُ الحالة الملوّنة */
  .fahis .vchip { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap;
    font-size: .8rem; color: var(--vc); border: 1px solid color-mix(in oklab, var(--vc) 45%, transparent);
    border-radius: 999px; padding: 1px 10px; flex: none; }
  .fahis .vchip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--vc); flex: none; }
  .fahis .v-kharij-babina .vchip, .fahis .vchip.hollow { border-style: dashed; }
  .fahis .vchip.hollow::before { background: transparent; border: 1.5px solid var(--vc); }

  /* تشريحُ البطاقة */
  .fahis .fc { border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; }
  .fahis .fc .fc-claim { font-weight: 600; line-height: 1.85; font-size: 1.05rem; }
  .fahis .fc .fc-ay { margin: 8px 0 0; line-height: 1.9; opacity: .78; }
  .fahis .fc .fc-ay b { opacity: .9; }
  .fahis .fc .fc-scope { margin: 14px 0 0; font-size: .9rem; opacity: .7; line-height: 1.8;
    border-inline-start: 3px solid var(--line); padding-inline-start: 12px; }
  .fahis .fc h3 { font-size: .95rem; margin: 20px 0 6px; opacity: .85; }
  .fahis .fc ol { margin: 8px 0 0; padding-inline-start: 20px; }
  .fahis .fc li { margin-bottom: 10px; line-height: 1.9; opacity: .88; }
  .fahis .fc .rb { display: inline-block; font-size: .72rem; color: #fff; border-radius: 999px;
    padding: 1px 8px; margin-inline-end: 7px; vertical-align: 2px; white-space: nowrap; }
  .fahis .fc .rb.m { background: none; color: inherit; border: 1px dashed var(--line); opacity: .65; }
  .fahis .fc li.counter { border-inline-start: 3px solid color-mix(in oklab, currentColor 25%, transparent);
    padding-inline-start: 10px; list-style-position: inside; margin-inline-start: -13px; }
  .fahis .fc .cmark { display: block; font-size: .78rem; opacity: .6; margin-bottom: 3px; }
  .fahis .vstrip { margin-top: 18px; border-radius: 10px; padding: 12px 14px;
    border-inline-start: 4px solid var(--vc);
    background: color-mix(in oklab, var(--vc) 9%, transparent); }
  .fahis .vstrip b { font-size: 1.05rem; color: var(--vc); }
  .fahis .vstrip .vd-detail { margin: 2px 0 0; line-height: 1.8; }
  .fahis .vstrip .vd-gloss { margin: 4px 0 0; font-size: .85rem; opacity: .65; }
  .fahis .fc .fc-limit { margin-top: 14px; font-size: .89rem; opacity: .68; line-height: 1.85; }
  .fahis .fc .fc-limit b { opacity: .95; }
  .fahis .redo { display: inline-block; margin-top: 16px; font-size: .92rem; text-decoration: none;
    border: 1px solid color-mix(in oklab, var(--gold, #c9a227) 55%, transparent);
    color: inherit; border-radius: 999px; padding: 7px 18px; }
  .fahis .redo:hover { background: color-mix(in oklab, var(--gold, #c9a227) 10%, transparent); }
  .fahis .redo + .redo-note { display: block; margin-top: 6px; font-size: .8rem; opacity: .55; }

  /* صفحةُ البطاقة: الرأسُ والذيل */
  .fahis .crumb { font-size: .9rem; opacity: .7; margin: 0 0 14px; }
  .fahis .crumb a { color: inherit; }
  .fahis .fc-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0 16px; }
  .fahis .fc-meta .k { font-size: .78rem; opacity: .6; border: 1px solid var(--line);
    border-radius: 999px; padding: 1px 9px; }
  .fahis .fc-meta .dt { font-size: .82rem; opacity: .55; }
  .fahis .foot { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap;
    font-size: .86rem; opacity: .8; margin-top: 18px; }
  .fahis .foot button { font: inherit; font-size: .86rem; color: inherit; background: none;
    border: 1px solid var(--line); border-radius: 999px; padding: 3px 13px; cursor: pointer; }
  .fahis .foot button:hover { border-color: color-mix(in oklab, currentColor 40%, transparent); }
  .fahis .mithaq { font-size: .82rem; opacity: .55; margin-top: 12px; line-height: 1.8; }
  .fahis .revs { margin-top: 16px; font-size: .84rem; opacity: .7; }
  .fahis .revs summary { cursor: pointer; }
  .fahis .revs li { margin: 6px 0; line-height: 1.8; }

  /* دعوةُ «افحص فكرتك» في ذيل الفهرس */
  .fahis .fcta { border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px;
    margin-top: 26px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  .fahis .fcta .tx { flex: 1 1 280px; }
  .fahis .fcta b { display: block; margin-bottom: 3px; }
  .fahis .fcta p { margin: 0; font-size: .9rem; opacity: .7; line-height: 1.8; }
  .fahis .fcta a { flex: none; text-decoration: none; font-weight: 600; border-radius: 9px;
    padding: 10px 20px; background: var(--gold, #c9a227); color: #1a1a1a; }

  /* صفحةُ المنهج */
  .fahis .usul { display: grid; gap: 14px; }
  .fahis .usul > div { border-inline-start: 3px solid var(--line); padding-inline-start: 14px; }
  .fahis .usul b { display: block; margin-bottom: 3px; }
  .fahis .usul p { margin: 0; opacity: .8; line-height: 1.85; }
  .fahis .vlex { display: grid; gap: 10px; }
  .fahis .vlex > div { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  .fahis .vlex .g { opacity: .7; font-size: .9rem; line-height: 1.7; }
  .fahis .sift { display: grid; gap: 2px; margin: 10px 0 0; }
  .fahis .sift > div { display: flex; gap: 12px; align-items: baseline; padding: 9px 2px;
    border-bottom: 1px dotted var(--line); }
  .fahis .sift b { font-variant-numeric: tabular-nums; min-width: 110px; }
  .fahis .sift span { opacity: .75; font-size: .92rem; line-height: 1.7; }
  .fahis .rank { margin-bottom: 26px; }
  .fahis .rank > header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px;
    padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  .fahis .rn { font-weight: 700; font-size: .85rem; padding: 2px 9px; border-radius: 999px;
    color: #fff; flex: none; }
  .fahis .rd { font-size: .92rem; opacity: .78; }
  .fahis .books { display: grid; gap: 8px; }
  .fahis .bk { display: grid; grid-template-columns: 1fr auto; gap: 4px 14px; align-items: baseline;
    padding: 9px 0; border-bottom: 1px dotted var(--line); }
  .fahis .bk:last-child { border-bottom: 0; }
  .fahis .bk .nm { font-weight: 600; }
  .fahis .bk .au { opacity: .62; font-size: .9rem; margin-inline-start: 8px; font-weight: 400; }
  .fahis .bk .cv { font-variant-numeric: tabular-nums; font-size: .88rem; opacity: .75; white-space: nowrap; }
  .fahis .bk .how { grid-column: 1 / -1; font-size: .82rem; opacity: .55; line-height: 1.7; }
  .fahis .lim { font-size: .87rem; opacity: .62; line-height: 1.75; margin-top: 6px; }

  @media (max-width: 560px) {
    .fahis .bk { grid-template-columns: 1fr; }
    .fahis .frow { flex-wrap: wrap; }
    .fahis .frow .t { flex-basis: 100%; }
  }
`;
