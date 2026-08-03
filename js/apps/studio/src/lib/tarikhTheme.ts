/**
 * قشرةُ باب «تاريخ النص» — مصدرٌ واحدٌ لكلِّ صفحات الباب.
 *
 * الدرجاتُ الخمسُ لغةٌ بصريّةٌ واحدة، على نمط شارات نبراس/ميزان الأقوال: نقطةٌ
 * وحلقةٌ بلونٍ هادئ من عائلة الهويّة — لا لونَ إنذاريّ ولا أحمرَ فاقع، فـ«مرجوح»
 * حكمُ موازنةٍ لا تخوين. تُقرأ في الوضعين الفاتح والداكن.
 */

/** معرّفاتُ الدرجات كما يولّدها build-tarikh (من أسماء v1) */
export type GradeId = "thabit" | "rajih" | "muhtamal" | "mawquf" | "marjuh";

/** ترتيبُ السلّم من أعلى إلى أدنى — كما في الميثاق §٣ */
export const GRADE_ORDER: GradeId[] = ["thabit", "rajih", "muhtamal", "mawquf", "marjuh"];

export const TARIKH_CSS = `
  .tarikh { --line: color-mix(in oklab, currentColor 12%, transparent); }
  .tarikh .g-thabit { --gc: #2f6f57; }
  .tarikh .g-rajih { --gc: #4a8f7b; }
  .tarikh .g-muhtamal { --gc: #6b7f8f; }
  .tarikh .g-mawquf { --gc: #8a8478; }
  .tarikh .g-marjuh { --gc: #9a6b58; }

  /* الفاصلةُ النقطيّة معزولةُ الاتجاه — وإلا التصقت بالأرقام فقُرئت صفرًا */
  .tarikh .sep { opacity: .4; margin: 0 7px; unicode-bidi: isolate; }
  .tarikh bdi { unicode-bidi: isolate; }

  /* أبوابُ القسم */
  .tarikh .ttabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line);
    margin: 0 0 20px; flex-wrap: wrap; }
  .tarikh .ttabs a { padding: 8px 14px; text-decoration: none; color: inherit; opacity: .6;
    border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: .95rem; white-space: nowrap; }
  .tarikh .ttabs a:hover { opacity: .85; }
  .tarikh .ttabs a.on { opacity: 1; font-weight: 600; border-color: var(--gold, #a97e2f); }

  /* جدولُ الكتب */
  .tarikh .works { display: grid; gap: 0; margin-top: 8px; }
  .tarikh .work { display: flex; gap: 10px; align-items: baseline; padding: 9px 4px;
    border-bottom: 1px solid var(--line); font-size: .93rem; }
  .tarikh .work .wn { flex: 1; min-width: 0; line-height: 1.7; }
  .tarikh .work .wa { opacity: .6; font-size: .86rem; white-space: nowrap; }
  .tarikh .work .wc { opacity: .5; font-size: .8rem; white-space: nowrap; flex: none;
    border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; }
  @media (max-width: 620px) {
    .tarikh .work { flex-wrap: wrap; gap: 4px 10px; }
    .tarikh .work .wn { flex-basis: 100%; }
  }
  .tarikh .mlist { padding-inline-start: 22px; margin: 8px 0 18px; }
  .tarikh .mlist li { margin-bottom: 10px; line-height: 1.95; }
  .tarikh .refs { line-height: 2.1; font-size: .92rem; opacity: .85; }

  /* شريطُ «كيف تُقرأ هذه الصفحة» — للقارئ غير المتخصّص */
  .tarikh .howto { border: 1px dashed var(--line); border-radius: 12px; padding: 12px 15px;
    margin: 14px 0 4px; font-size: .9rem; line-height: 1.9; opacity: .85; }
  .tarikh .howto b { opacity: 1; }
  .tarikh .howto ol { margin: 6px 0 0; padding-inline-start: 20px; }
  .tarikh .howto li { margin-bottom: 4px; }

  .tarikh h1 { font-size: 1.9rem; margin: 0 0 6px; letter-spacing: -.01em; }
  .tarikh .lede { font-size: 1.05rem; line-height: 1.9; opacity: .85; max-width: 62ch; }
  .tarikh h2 { font-size: 1.2rem; margin: 34px 0 10px; }
  .tarikh .sub { opacity: .6; font-size: .9rem; margin: 0 0 14px; }
  .tarikh .crumb { font-size: .9rem; opacity: .7; margin: 0 0 14px; }
  .tarikh .crumb a { color: inherit; }

  /* شارةُ الدرجة — النقطةُ ثمّ الاسم، والحدُّ بلون الدرجة */
  .tarikh .gchip { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap;
    font-size: .8rem; color: var(--gc); border: 1px solid color-mix(in oklab, var(--gc) 45%, transparent);
    border-radius: 999px; padding: 1px 10px; flex: none; }
  .tarikh .gchip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--gc); flex: none; }
  .tarikh .gchip.more { border-style: dashed; color: inherit; opacity: .6; }
  .tarikh .gchip.more::before { display: none; }

  /* السطرُ الزمنيّ الوثائقيّ */
  .tarikh .tl { position: relative; margin: 22px 0 10px; padding: 26px 0 8px;
    border: 1px solid var(--line); border-radius: 14px; background: color-mix(in oklab, currentColor 2.5%, transparent); }
  .tarikh .tl .band { position: absolute; top: 30px; height: 30px; border-radius: 6px;
    background: color-mix(in oklab, var(--gold, #a97e2f) 12%, transparent);
    border: 1px dashed color-mix(in oklab, var(--gold, #a97e2f) 40%, transparent); }
  .tarikh .tl .axis { position: relative; height: 96px; margin: 0 18px; }
  .tarikh .tl .rule { position: absolute; top: 46px; inset-inline: 0; height: 1px;
    background: color-mix(in oklab, currentColor 22%, transparent); }
  .tarikh .tl .pt { position: absolute; top: 0; text-align: center; width: 0; }
  .tarikh .tl .pt .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent, #0b6e56);
    position: absolute; top: 42px; inset-inline-start: -4.5px; }
  .tarikh .tl .pt .span { position: absolute; top: 44px; height: 5px; border-radius: 3px;
    background: color-mix(in oklab, var(--accent, #0b6e56) 45%, transparent); }
  .tarikh .tl .pt .lab { position: absolute; top: 56px; inset-inline-start: 0; transform: translateX(50%);
    font-size: .72rem; line-height: 1.5; white-space: nowrap; opacity: .8; }
  .tarikh .tl .pt .w { position: absolute; top: 20px; inset-inline-start: 0; transform: translateX(50%);
    font-size: .72rem; opacity: .55; white-space: nowrap; }
  .tarikh .tl .pt.alt .lab { top: 74px; }
  .tarikh .tl .pt.alt .w { top: 4px; }
  .tarikh .tl .ticks { display: flex; justify-content: space-between; margin: 0 18px;
    font-size: .7rem; opacity: .45; font-variant-numeric: tabular-nums; }
  .tarikh .tl .cap { margin: 4px 18px 0; font-size: .78rem; opacity: .6; line-height: 1.8; }
  /* على الجوّال يصير المحورُ قائمةً رأسيّة — أوضحُ من محورٍ مضغوط */
  .tarikh .tlist { margin: 0; padding: 4px 16px 2px; list-style: none; }
  .tarikh .tlist li { display: flex; gap: 10px; align-items: baseline; padding: 9px 0;
    border-bottom: 1px solid var(--line); }
  .tarikh .tlist li:last-child { border-bottom: none; }
  .tarikh .tlist .w { font-size: .74rem; opacity: .55; flex: none; border: 1px solid var(--line);
    border-radius: 999px; padding: 1px 8px; }
  .tarikh .tlist .d { font-size: .82rem; font-weight: 600; flex: none; white-space: nowrap; }
  .tarikh .tlist .p { font-size: .84rem; opacity: .75; line-height: 1.8; flex: 1; min-width: 0; }

  /* بطاقاتُ الدعاوى الثماني */
  .tarikh .cards { display: grid; gap: 10px; margin-top: 12px; }
  .tarikh .card { display: block; text-decoration: none; color: inherit; padding: 14px 16px;
    border: 1px solid var(--line); border-radius: 13px; }
  .tarikh .card:hover { background: color-mix(in oklab, currentColor 4%, transparent); }
  .tarikh .card .row { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .tarikh .card .n { font-size: .78rem; opacity: .5; font-variant-numeric: tabular-nums; }
  .tarikh .card .t { font-weight: 600; font-size: 1.05rem; flex: 1; min-width: 0; line-height: 1.7; }
  .tarikh .card .cl { margin: 6px 0 0; font-size: .92rem; line-height: 1.85; opacity: .75; }
  @media (max-width: 620px) {
    .tarikh .card .row { row-gap: 7px; }
    .tarikh .card .t { flex-basis: 100%; }
  }

  /* صفحةُ الدعوى */
  .tarikh .verdict { border-radius: 12px; padding: 14px 16px; margin: 16px 0 8px;
    border-inline-start: 4px solid var(--gc, var(--line));
    background: color-mix(in oklab, var(--gc, currentColor) 8%, transparent); }
  .tarikh .verdict .r { margin: 0 0 10px; line-height: 1.95; }
  .tarikh .verdict .r:last-child { margin-bottom: 0; }
  .tarikh .verdict .r .gchip { margin-inline-end: 8px; vertical-align: 2px; }
  .tarikh .verdict .why { margin: 10px 0 0; line-height: 1.95; opacity: .9; }
  .tarikh .block { margin: 22px 0; }
  .tarikh .block > h3 { font-size: .95rem; margin: 0 0 6px; opacity: .8; }
  .tarikh .block .body { line-height: 1.95; }
  .tarikh .block .body p { margin: 0 0 10px; }
  .tarikh .block .body ul, .tarikh .block .body ol { margin: 8px 0; padding-inline-start: 20px; }
  .tarikh .block .body li { margin-bottom: 8px; line-height: 1.9; }
  .tarikh .note { font-size: .82rem; opacity: .6; }

  /* بطاقاتُ البيّنة الوثائقية */
  .tarikh .wcards { display: grid; gap: 10px; }
  .tarikh .wcard { border: 1px solid var(--line); border-radius: 12px; padding: 13px 15px; }
  .tarikh .wcard .h { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; margin-bottom: 5px; }
  .tarikh .wcard .h .id { font-size: .74rem; border: 1px solid var(--line); border-radius: 999px;
    padding: 1px 8px; opacity: .7; flex: none; }
  .tarikh .wcard .h b { font-size: .98rem; }
  .tarikh .wcard .x { line-height: 1.9; font-size: .95rem; opacity: .88; }
  .tarikh .wcard .cite { margin-top: 7px; font-size: .78rem; opacity: .55; line-height: 1.7; }

  /* تبويبُ العناقيد + الشجرة */
  .tarikh .cltabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 10px; }
  .tarikh .cltabs button { font: inherit; font-size: .82rem; background: none; color: inherit; cursor: pointer;
    border: 1px solid var(--line); border-radius: 999px; padding: 3px 12px; opacity: .75; }
  .tarikh .cltabs button[data-on="1"] { opacity: 1; font-weight: 600;
    border-color: color-mix(in oklab, var(--gold, #a97e2f) 60%, transparent);
    background: color-mix(in oklab, var(--gold, #a97e2f) 10%, transparent); }
  .tarikh .cltabs .out { border-style: dashed; opacity: .5; cursor: default; }

  .tarikh .tree { position: relative; border: 1px solid var(--line); border-radius: 14px;
    background: color-mix(in oklab, currentColor 2.5%, transparent); overflow: hidden; }
  .tarikh .tree svg { display: block; width: 100%; height: 460px; touch-action: none; cursor: grab; }
  .tarikh .tree svg:active { cursor: grabbing; }
  @media (max-width: 760px) { .tarikh .tree svg { height: 380px; } }
  .tarikh .tree .zoom { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; display: flex; gap: 4px; }
  .tarikh .tree .zoom button { font: inherit; width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--line); background: var(--panel, #fff); color: inherit; line-height: 1; }
  .tarikh .tree .stat { position: absolute; inset-block-end: 8px; inset-inline-start: 10px;
    font-size: .72rem; opacity: .55; }
  .tarikh .tnode { cursor: pointer; }
  .tarikh .tnode text { pointer-events: none; }
  .tarikh .legend { display: flex; gap: 14px; flex-wrap: wrap; margin: 8px 2px 0; font-size: .78rem; opacity: .72; }
  .tarikh .legend span { display: inline-flex; gap: 6px; align-items: center; }
  .tarikh .legend i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; font-style: normal; }

  /* لوحةُ العقدة — النقرةُ الثانية */
  .tarikh .np-back { position: fixed; inset: 0; background: #0006; z-index: 60; }
  .tarikh .np { position: fixed; z-index: 61; inset-block: 0; inset-inline-end: 0; width: min(560px, 100%);
    background: var(--panel, #fff); border-inline-start: 1px solid var(--line);
    display: flex; flex-direction: column; box-shadow: -18px 0 40px #0002; }
  @media (max-width: 760px) { .tarikh .np { inset-block-start: auto; width: 100%; max-height: 88vh; border-radius: 16px 16px 0 0; } }
  .tarikh .np .np-h { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px 10px;
    border-bottom: 1px solid var(--line); }
  .tarikh .np .np-h b { font-size: 1.05rem; line-height: 1.6; flex: 1; }
  .tarikh .np .np-h button { font: inherit; background: none; border: none; color: inherit; cursor: pointer;
    font-size: 1.1rem; opacity: .6; }
  .tarikh .np .np-b { overflow-y: auto; padding: 12px 16px 26px; }
  .tarikh .np .facts { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .tarikh .np .facts span { font-size: .74rem; border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; opacity: .75; }
  .tarikh .np .facts span.flag { border-color: color-mix(in oklab, var(--gold, #a97e2f) 55%, transparent);
    color: var(--gold, #a97e2f); }
  .tarikh .np .rec { border-top: 1px solid var(--line); padding-top: 12px; margin-top: 12px; }
  .tarikh .np .rec:first-of-type { border-top: none; margin-top: 0; }
  .tarikh .np .rec .src { font-size: .82rem; opacity: .7; line-height: 1.7; margin-bottom: 6px; }
  .tarikh .np .rec .txt { line-height: 2.05; font-size: 1rem; }
  .tarikh .np .rec .jami { display: inline-block; margin-top: 8px; font-size: .8rem; text-decoration: none;
    border: 1px solid color-mix(in oklab, var(--accent, #0b6e56) 45%, transparent);
    color: var(--accent, #0b6e56); border-radius: 999px; padding: 2px 11px; }

  /* تذييلُ الباب: الميثاق والدرجات */
  .tarikh .mithaq { margin-top: 34px; border-top: 1px solid var(--line); padding-top: 18px; }
  .tarikh .ladder { display: grid; gap: 7px; margin: 10px 0 0; }
  .tarikh .ladder .g { display: flex; gap: 10px; align-items: baseline; font-size: .9rem; line-height: 1.8; }
  .tarikh .ladder .g .gchip { flex: none; }
  .tarikh .ladder .g .gl { opacity: .78; }

  /* صفحةُ الوثيقة الكاملة */
  .tarikh .doc { line-height: 2.05; }
  .tarikh .doc h1 { font-size: 1.75rem; margin: 0 0 14px; }
  .tarikh .doc h2 { font-size: 1.3rem; margin: 34px 0 8px; }
  .tarikh .doc h3 { font-size: 1.08rem; margin: 26px 0 6px; }
  .tarikh .doc p { margin: 0 0 12px; }
  .tarikh .doc ul, .tarikh .doc ol { margin: 10px 0; padding-inline-start: 22px; }
  .tarikh .doc li { margin-bottom: 9px; }
  .tarikh .doc hr { border: none; border-top: 1px solid var(--line); margin: 26px 0; }
  .tarikh .doc code { font-size: .86em; background: color-mix(in oklab, currentColor 7%, transparent);
    border-radius: 5px; padding: 1px 5px; }
  .tarikh .doc blockquote { margin: 0 0 12px; padding-inline-start: 12px;
    border-inline-start: 3px solid var(--line); opacity: .8; }
`;
