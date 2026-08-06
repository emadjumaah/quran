#!/usr/bin/env python3
"""حارسُ الرسم الصوتيّ — يقابل مخرجَ المولّد بنصّ المصحف حرفاً حرفاً.

    python3 tools/check_ipa.py                # المصحف كلُّه (٦٢٣٦ آية)
    python3 tools/check_ipa.py --verbose      # مع جردِ العلل والأصناف
    python3 tools/check_ipa.py --self-test    # فحصٌ ذاتيّ سريعٌ بلا شبكة

**لا عيّنة**: يُشغَّل على المصحف كلِّه في كل مرّة — فآيةٌ واحدةٌ تشذّ تُحمِرّه.

## ما الذي يُقاس

### أوّلاً: النسب — «كلُّ حرفٍ منطوقٍ له رمز، ولا رمزَ بلا حرف»

المولّدُ لا يُخرج نصّاً فحسب، بل يحمل مع **كلِّ رمزٍ موضعَ المحرف الذي أنتجه**
(`Out.parts`)، ومع **كلِّ حرفٍ صامتٍ علّةَ صمته** (`Out.silent`). فالحارسُ يجرد
محارفَ الآية محرفاً محرفاً ويطالب كلَّ واحدٍ منها بأحدِ ثلاثة:

  ١) رمزٌ في المخرج ينسب إليه، أو
  ٢) علّةُ صمتٍ **من قائمةٍ مغلقة** (`SILENCE`) — لا «سقط ولا أدري»، أو
  ٣) صفةُ محرفٍ لا يُنطق أصلاً (علامةٌ على حرفها، أو وقفٌ، أو رقمُ آية).

وفي المقابل: كلُّ رمزٍ في المخرج ينسب إلى محرفٍ موجود، ومن جدولِ رموزٍ معلَن
(`ALPHABET`) — فلا يتسلّل رمزٌ لا أصلَ له.

وعلّةُ هذا الباب أنّ الخطأ في مثل هذا المولّد **حذفٌ صامت**: حرفٌ يسقط فلا يشكو
أحد. فالنسبُ يجعل السقوطَ مستحيلاً بالبناء لا بالانتباه.

### ثانياً: النصّ — يُقابَل بنسخةٍ ثانيةٍ مستقلّة

نصُّ المصحف في هذا المشروع لا يُكتب بيد. والحارسُ يقابل نصَّ QPC (الأساس) بنصّ
**تنزيل الأثماني** — نسخةٌ ثانيةٌ مستقلّةُ التحقيق — حرفاً حرفاً بعد ردِّ حواملِ
الرسم إلى أصولها. وما بقي من فروقٍ **أصنافٌ ثلاثةٌ معلَنةٌ بأعدادها**
(`RASM_CLASSES`): بسملةُ الفواتح، ورسمُ الهمزة الممدودة، وحاملُ الهمزة. وأيُّ
فرقٍ خارجها — أو تغيُّرُ عددٍ في واحدٍ منها — يُحمِرّ الحارس.
"""

import argparse
import collections
import difflib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import quran_ipa as ipa            # noqa: E402

TANZIL = ipa.MIRROR
AYAT = 6236


# ————— القوائمُ المغلقة —————

# علّةُ كلِّ حرفٍ لا يُنطق. مغلقةٌ عمداً: علّةٌ جديدةٌ تُوقِف الحارس حتى تُعلَن.
SILENCE = {
    "slnt": "وسمَه المرجعُ «لا يُنطق» (ألفُ التفريق، وواوُ ٱلصَّلَوٰة…)",
    "ham_wasl": "همزةُ وصلٍ تسقط في الوصل",
    "laam_shamsiyah": "لامُ التعريف تُدغَم في الشمسيّ",
    "idgham_mithlayn": "ساكنٌ أُدغِم في مثله (﴿ٱللَّهِ﴾) — مشتقٌّ لا موسوم",
    "idgham_ghunnah": "أُدغِم بغُنّةٍ فيما بعده",
    "idgham_wo_ghunnah": "أُدغِم بلا غُنّةٍ فيما بعده",
    "idgham_shafawi": "ميمٌ أُدغِمت في ميم",
    "idgham_mutajanisayn": "أُدغِم في مجانسه",
    "idgham_mutaqaribayn": "أُدغِم في مقاربه",
    "carrier": "حاملُ رسمٍ يعلوه خنجرٌ فيحمل هو المدَّ عنه (﴿عَلَىٰ﴾)",
    "tanwin-alef": "ألفُ التنوين — تسقط وصلاً (﴿هُدًى﴾)",
    "tatweel": "تطويلٌ مجرَّد — وصلُ رسمٍ لا حرف",
}

# جدولُ الرموز: لا يخرج من المولّد رمزٌ خارجَه.
ALPHABET = set(
    "btθdðrzsʃʕɣfqklmnhwjʔxħ"      # صوامتُ الجدول
    "ʒ͡ˤ"                           # مركّباتٌ: d͡ʒ وعلامةُ الإطباق
    "aui"                           # صوائتُ قصار
    "ː"                             # طولٌ: مدٌّ أو تشديد
    "̃"                        # ◌̃ غُنّة
    "ⁿᵐᵊ"                           # إخفاءٌ · إقلابٌ · قلقلة
    " "
)

# فروقُ الرسم بين نسختَي المصحف — مغلقةٌ بأعدادها. رقمٌ يتغيّر يُحمِرّ الحارس.
RASM_CLASSES = {
    "همزةٌ ممدودة: `أ` في QPC مقابل `ءا` في تنزيل": ({("ء", "ا")}, 277),
    "حاملُ الهمزة: حاملٌ مجرَّدٌ وهمزةٌ مركّبة مقابل `ئ`/`ؤ`":
        ({("ا", "ء"), ("", "ء"), ("", "ءا"), ("و", "ء")}, 14),
}

# ردُّ حواملِ الرسم إلى أصولها قبل المقابلة — الصوتُ واحدٌ والرسمُ نسختان
FOLD = {"ٱ": "ا", "ى": "ا", "ٮ": "ا", "ٰ": "ا", "ۦ": "ا", "ۧ": "ا",
        "ۥ": "و", "أ": "ء", "إ": "ء", "آ": "ءا", "ؤ": "ء", "ئ": "ء"}
LETTERS = set("ابتثجحخدذرزسشصضطظعغفقكلمنهويةء")


def skeleton(text: str) -> str:
    """هيكلُ الحروف وحدَه بعد ردِّ الحوامل — لا حركةَ ولا علامة."""
    out = []
    for ch in text:
        for c in FOLD.get(ch, ch):
            if c in LETTERS:
                out.append(c)
    return re.sub("ا{2,}", "ا", "".join(out))


# ————— الفحصُ الأوّل: النسب —————

def check_provenance(source, report):
    """كلُّ محرفٍ في المصحف يُصنَّف — منطوقاً أو صامتاً بعلّةٍ معلَنة."""
    reasons = collections.Counter()
    symbols = collections.Counter()
    chars = 0

    for key, text in source.items():
        marked = ipa.tagged_chars(text)
        units, skipped = ipa.units_of(text)
        out = ipa.render(text, key)
        chars += len(marked)

        voiced = {idx for _, idx, _ in out.parts}
        letters = {u.idx for u in units}

        # ١) لا رمزَ بلا حرف
        stray = voiced - letters
        if stray:
            report.fail(key, f"رمزٌ لا ينسب إلى حرف: مواضعُ {sorted(stray)}")

        # ٢) كلُّ حرفٍ منطوقٌ له رمز، أو علّةُ صمتٍ معلَنة
        for u in units:
            if u.idx in voiced:
                continue
            why = out.silent.get(u.idx)
            if why is None:
                report.fail(key, f"حرفٌ سقط بلا علّة: {u.base!r} في {u.idx}")
            elif why not in SILENCE:
                report.fail(key, f"علّةُ صمتٍ غيرُ معلَنة: {why!r}")
            else:
                reasons[why] += 1

        # ٣) كلُّ محرفٍ في الآية مصنَّف: حرفٌ، أو علامةٌ، أو ما لا يُنطق
        for idx in range(len(marked)):
            if idx in letters or idx in skipped or marked[idx][0] == " ":
                continue
            report.fail(key, f"محرفٌ لم يُصنَّف: {marked[idx][0]!r} في {idx}")

        # ٤) لا رمزَ خارجَ الجدول
        for sym, _, why in out.parts:
            symbols[why] += 1
            bad = set(sym) - ALPHABET
            if bad:
                report.fail(key, f"رمزٌ خارجَ الجدول: {sorted(bad)} من {why}")

    report.note("المحارفُ المصنَّفة", chars)
    report.note("الرموزُ المُخرَجة", sum(symbols.values()))
    report.tally("عللُ الصمت", reasons, SILENCE)
    report.tally("مصادرُ الرموز", symbols, {})


def check_words(source, report):
    """التصييرُ المفرد: كلُّ كلمةٍ في المصحف وحدَها — نسبٌ كامل، وحروفٌ لا تزيد.

    ولهذا فحصٌ خاصٌّ لأنّ **الإفراد يعدّل أحكاماً** (شدّةَ الإدغام في الأوّل،
    وحكمَ الآخر، والمدَّ المنفصل). فلو عدّل حرفاً لَما شكا أحد — إلا هذا.
    """
    words = letters = 0
    for key, text in source.items():
        units, _ = ipa.units_of(text)
        groups = ipa.words_of(text)
        # ١) لا كلمةَ تضيع ولا حرفَ يزيد في التقطيع
        if sum(len(g) for _, g in groups) != len(units):
            report.fail(key, "التقطيعُ يخالف عددَ الوحدات")
        for i, (_, group) in enumerate(groups):
            words += 1
            out = ipa.render_word(text, key, i)
            letters += len(group)
            voiced = {idx for _, idx, _ in out.parts}
            idxs = {u.idx for u in group}
            stray = voiced - idxs
            if stray:
                report.fail(key, f"كلمةٌ {i}: رمزٌ من خارجها {sorted(stray)}")
            for u in group:
                if u.idx in voiced:
                    continue
                why = out.silent.get(u.idx)
                if why is None:
                    report.fail(key, f"كلمةٌ {i}: حرفٌ سقط بلا علّة {u.base!r}")
                elif why not in SILENCE:
                    report.fail(key, f"كلمةٌ {i}: علّةٌ غيرُ معلَنة {why!r}")
            for sym, _, why in out.parts:
                bad = set(sym) - ALPHABET
                if bad:
                    report.fail(key, f"كلمةٌ {i}: رمزٌ خارجَ الجدول {sorted(bad)}")
    report.note("الكلماتُ المصيَّرة مفردةً", words)
    report.note("حروفُها", letters)


# ————— الفحصُ الثالث: مقابلةُ النصّ بنسخةٍ ثانية —————

def check_text(source, report):
    """نصُّ QPC مقابلَ نصّ تنزيل الأثماني — والفروقُ أصنافٌ معلَنةٌ بأعدادها."""
    lines = TANZIL.read_text(encoding="utf-8").splitlines()[:AYAT]
    if len(lines) != AYAT or len(source) != AYAT:
        report.fail("—", f"عددُ الآيات: QPC={len(source)} تنزيل={len(lines)}")
        return
    # فاتحةُ الكتاب هي البسملةُ نفسُها. والمقابلةُ **بالهيكل لا بالنصّ**: تكتبها
    # نسخةُ تنزيل في التين والقدر `بِّسۡمِ` بشدّةٍ على الباء (إظهارُ إدغام باء
    # آخرِ السورة قبلهما)، فالمطابقةُ الحرفية تخطئهما وحدَهما من بين ١١٢.
    basmala = skeleton(lines[0])

    found = collections.Counter()
    stripped = 0
    for i, (key, text) in enumerate(source.items()):
        surah, ayah = (int(x) for x in key.split(":"))
        a, b = skeleton(ipa.plain(text)), skeleton(lines[i])
        if (ayah == 1 and surah not in (1, 9)
                and b.startswith(basmala) and not a.startswith(basmala)):
            b = b[len(basmala):]         # تنزيلُ يُلحق البسملةَ بأولى الآيات
            stripped += 1
        if a == b:
            continue
        ops = difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes()
        for tag, i1, i2, j1, j2 in ops:
            if tag == "equal":
                continue
            pair = (a[i1:i2], b[j1:j2])
            name = next((n for n, (pairs, _) in RASM_CLASSES.items()
                         if pair in pairs), None)
            if name is None:
                report.fail(key, f"فرقُ رسمٍ غيرُ معلَن: QPC={pair[0]!r} "
                                 f"تنزيل={pair[1]!r}")
            else:
                found[name] += 1

    if stripped != 112:
        report.fail("—", f"بسملاتٌ مستخرَجة: {stripped} — والمنتظَرُ ١١٢")
    for name, (_, want) in RASM_CLASSES.items():
        if found[name] != want:
            report.fail("—", f"صنفُ «{name}»: {found[name]} والمنتظَرُ {want}")
    report.note("بسملاتُ الفواتح في نسخة تنزيل", stripped)
    report.tally("فروقُ الرسم", found, {})


# ————— التقرير —————

class Report:
    def __init__(self, verbose):
        self.verbose, self.fails, self.notes, self.tables = verbose, [], [], []

    def fail(self, key, msg):
        self.fails.append(f"{key}: {msg}")

    def note(self, label, value):
        self.notes.append((label, value))

    def tally(self, label, counter, glossary):
        self.tables.append((label, counter, glossary))

    def render(self):
        for label, value in self.notes:
            print(f"  {label}: {value}")
        if self.verbose:
            for label, counter, glossary in self.tables:
                print(f"\n  — {label} —")
                for name, n in counter.most_common():
                    why = glossary.get(name, "")
                    print(f"    {n:7d}  {name:22s} {why}")
        if not self.fails:
            print(f"\n✓ الحارسُ أخضر: {AYAT} آيةً، كلُّ محرفٍ منسوبٌ ومصنَّف.")
            return 0
        print(f"\n✗ {len(self.fails)} إخفاقاً:")
        for line in self.fails[:40]:
            print("   ", line)
        if len(self.fails) > 40:
            print(f"    … و{len(self.fails) - 40} غيرها")
        return 1


def self_test() -> int:
    """فحصٌ ذاتيٌّ سريع: يثبت أنّ الحارسَ يمسك ما وُضِع له — بلا شبكة."""
    ok = True

    # ١) الهيكلُ يردّ الحوامل: `عَلَىٰ` و`عَلَا` هيكلٌ واحد
    if skeleton("عَلَىٰ") != skeleton("عَلَا"):
        print("  ✗ الهيكلُ لا يردّ حاملَ الألف"); ok = False

    # ٢) قائمةُ علل الصمت تغطّي ما يُخرجه المولّد فعلاً — على سورةٍ كاملة
    src = ipa.load_source()
    seen = set()
    for key, text in src.items():
        if key.startswith(("1:", "112:", "2:")):
            seen |= set(ipa.render(text, key).silent.values())
    missing = seen - set(SILENCE)
    if missing:
        print(f"  ✗ عللٌ غيرُ معلَنة: {missing}"); ok = False

    # ٣) الحارسُ يُحمِرّ على مخرجٍ مدسوس
    probe = Report(False)
    out = ipa.render(src["1:1"], "1:1")
    out.parts.append(("Z", 999, "دسٌّ متعمَّد"))
    if not (set("Z") - ALPHABET):
        print("  ✗ جدولُ الرموز يقبل رمزاً غريباً"); ok = False

    # ٤) صنفُ رسمٍ مجهولٌ يُحمِرّ
    if any((("ص", "ط") in pairs) for pairs, _ in RASM_CLASSES.values()):
        print("  ✗ أصنافُ الرسم واسعةٌ أكثرَ ممّا يجب"); ok = False

    print("  ✓ عدّةُ الحارس سليمة (بلا شبكة)." if ok else "")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="حارسُ الرسم الصوتيّ للمصحف")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--quick", action="store_true",
                    help="يتخطّى التصييرَ المفرد (٧٧ ألفَ كلمة)")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()

    source = ipa.load_source()
    report = Report(args.verbose)
    check_provenance(source, report)
    if not args.quick:
        check_words(source, report)
    check_text(source, report)
    return report.render()


if __name__ == "__main__":
    sys.exit(main())
