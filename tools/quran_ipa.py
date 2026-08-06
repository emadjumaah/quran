#!/usr/bin/env python3
"""الرسمُ الصوتيّ للمصحف (IPA) — مأخوذاً من مصحفِ QPC الموسومِ بالتجويد.

    python3 tools/quran_ipa.py --ayah 103:1        # آيةٌ واحدة
    python3 tools/quran_ipa.py --surah 103         # سورةٌ كاملة
    python3 tools/quran_ipa.py --all > ipa.tsv     # المصحف كلُّه آيةً آيةً
    python3 tools/quran_ipa.py --all-words         # وكلمةً كلمةً مفردةً
    python3 tools/quran_ipa.py --rules             # جردُ الأحكام كما في المرجع
    python3 tools/quran_ipa.py --limits            # حدودُ ما لم يُطبَّق
    python3 tools/quran_ipa.py --self-test         # فحصٌ ذاتيّ بلا شبكة

## من أين تأتي الأحكام

**لا تُستنتَج** — تُقرأ من `research/qpc-hafs-tajweed.json`: مصحفُ مجمّع الملك فهد
(رواية حفص) موسوماً بثمانيةَ عشرَ حكماً في ٦٩٬٩٠٢ وسم، كلُّ حكمٍ محيطٌ بحروفه في
النصّ نفسِه (`<rule class=ikhafa>نف</rule>`). فمقدارُ المدّ (٢/٤/٦) وإدغامُ
المتجانسين والمتقاربين والإخفاءُ الشفويّ — كلُّها **منقولةٌ عن المرجع لا مخمَّنة**.

وما لم يُوسَم فيه فمشتقٌّ بقاعدةٍ واحدة معلَنة: **المدُّ الطبيعيّ بحرفٍ مرسوم**
(`قَالَ` `يَقُولُ` `قِيلَ`) لا يوسمه المرجع — فيُشتقّ حركتين. وذلك حدُّ الاشتقاق كلُّه.

## نصُّ المصحف لا يُكتب بيد

النصّ يُقرأ من مصدرين ويُقابَل أحدُهما بالآخر:
  · `research/qpc-hafs-tajweed.json` — الأساس، ومنه الأحكام.
  · `data/quran-uthmani.txt` — نصّ تنزيل الأثماني، مرآةٌ يقابله بها `check_ipa.py`.
ولا يُعدَّل حرفٌ في أيّهما. وفروقُ الرسم بين النسختين أصنافٌ معدودةٌ يجردها الحارس.

## ما هذا الملفّ ومَن يستعمله

مخرجُه سلسلةُ IPA لكل آية — لتغذية مولّدات الكلام التي تقبل الرسم الصوتي، ولتقييم
التلاوة، ولعرض النطق للمتعلّم.

**والحكمُ فيه لمختصٍّ في التجويد** — هذا مولّدٌ يُخرج ما في المرجع، لا شهادةَ إتقان.

## اصطلاحُ الرموز (التفصيل في docs/IPA.md)

  · `ː` بعد صائتٍ = حركتان زائدتان: `aː` مدٌّ حركتان · `aːː` أربع · `aːːː` ستّ
  · `ː` بعد صامتٍ = تشديد
  · `◌̃` غُنّةٌ بمقدار حركتين · `ⁿ` إخفاءٌ · `ᵐ` إقلابٌ وإخفاءٌ شفويّ
  · `ᵊ` قلقلةٌ — زيادةٌ على IPA القياسي، إذ لا رمزَ لها فيه
"""

import argparse
import collections
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "research" / "qpc-hafs-tajweed.json"
MIRROR = ROOT / "data" / "quran-uthmani.txt"


# ————— ١) قراءةُ المرجع وشقُّ وسومه —————

# الوسمُ يأتي بثلاث صورٍ في المصدر: بلا اقتباس، وبمفردٍ، وبمزدوجٍ ومعه فضلةُ
# أداةِ عرضٍ (`data-bs-original-title` في ١٣:٣٧). فالتعبيرُ يقبلها كلَّها،
# ولولا ذلك لسقط وسمٌ صحيحٌ ولبدا النصُّ غيرَ متوازن.
_TOKEN = re.compile(r"(<rule\b[^>]*?>|</rule>)")
_OPEN = re.compile(r"""<rule\b[^>]*?class=["']?([a-z_]+)["']?[^>]*?>""")

# عيبٌ ثانٍ في المصدر يُصحَّح قراءةً لا كتابةً (لا يُمَسّ الملفّ): `&gt;` مقحمةٌ
# في ٣٢:٣ بين راء «ٱفۡتَرَ» وحاملِ ألفها — بقيّةُ ترميزِ HTML لم تُنظَّف.
_SOURCE_DEFECTS = ("&gt;", "&lt;", "&amp;")


def load_source() -> dict:
    """{"سورة:آية": نصٌّ موسوم} — بترتيب المصحف."""
    raw = json.loads(SOURCE.read_text(encoding="utf-8"))
    return {k: v["text"] for k, v in sorted(
        raw.items(), key=lambda kv: (kv[1]["surah"], kv[1]["ayah"]))}


def tagged_chars(text: str) -> list:
    """[(محرف, أحكامُه)] — كلُّ محرفٍ ومعه مجموعةُ الأحكام المحيطة به.

    والوسومُ تتداخل مرّةً واحدةً في المصحف كلِّه (`madda_obligatory_monfasel`
    يحوي `slnt` في ٢٩ موضعاً) — فالمكدّسُ لا الرايةُ الواحدة.
    """
    for bad in _SOURCE_DEFECTS:
        text = text.replace(bad, "")
    out, stack = [], []
    for tok in _TOKEN.split(text):
        m = _OPEN.fullmatch(tok)
        if m:
            stack.append(m.group(1))
            continue
        if tok == "</rule>":
            stack.pop()
            continue
        rules = frozenset(stack)
        out.extend((ch, rules) for ch in tok)
    return out


def plain(text: str) -> str:
    """نصُّ الآية بلا وسومٍ ولا رقمِ آية — كما يُقرأ."""
    s = "".join(ch for ch, _ in tagged_chars(text))
    return re.sub(r"[٠-٩]+\s*$", "", s).strip()


# ————— ٢) جدولُ الحروف والعلامات —————

CONS = {
    "ب": "b", "ت": "t", "ث": "θ", "ج": "d͡ʒ", "ح": "ħ", "خ": "x", "د": "d",
    "ذ": "ð", "ر": "r", "ز": "z", "س": "s", "ش": "ʃ", "ص": "sˤ", "ض": "dˤ",
    "ط": "tˤ", "ظ": "ðˤ", "ع": "ʕ", "غ": "ɣ", "ف": "f", "ق": "q", "ك": "k",
    "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "j",
    "ء": "ʔ", "أ": "ʔ", "إ": "ʔ", "ؤ": "ʔ", "ئ": "ʔ",
    "ة": "t",          # وصلاً تاءٌ، ووقفاً هاءٌ — يُبدَّل في آخر الآية
}

ALEF, WASLA, MAQSURA, DOTLESS = "ا", "ٱ", "ى", "ٮ"
DAGGER, SMALL_WAW, SMALL_YEH, SMALL_HIGH_YEH = "ٰ", "ۥ", "ۦ", "ۧ"
TATWEEL = "ـ"

# حاملُ المدّ ← صائتُه حين لا تُعرَف الحركةُ ممّا قبله
MADD_VOWEL = {
    ALEF: "a", MAQSURA: "a", DOTLESS: "a", DAGGER: "a",
    "و": "u", SMALL_WAW: "u",
    "ي": "i", SMALL_YEH: "i", SMALL_HIGH_YEH: "i",
}
MADD_CARRIERS = set(MADD_VOWEL)
# الحروفُ الصغيرة لا تُرسم إلا مدّاً — لا تحتاج شاهدَ حركةٍ قبلها
SMALL_MADD = {DAGGER, SMALL_WAW, SMALL_YEH, SMALL_HIGH_YEH}
# حواملُ الرسم التي يعلوها خنجرٌ فيحمل هو المدَّ عنها
BARE_CARRIERS = {ALEF, MAQSURA, DOTLESS}

FATHA, DAMMA, KASRA = "َ", "ُ", "ِ"
TAN_F, TAN_D, TAN_K = "ً", "ٌ", "ٍ"
SUKUN = "ۡ"                       # U+06E1 — سكونُ مصحف المدينة، لا U+0652
SHADDA = "ّ"
MADDAH = "ٓ"                      # علامةُ المدّ — المقدارُ من الوسم لا منها
HAMZA_ABOVE, HAMZA_BELOW = "ٔ", "ٕ"    # همزةٌ على حاملٍ مجرَّد ⇒ الوحدةُ همزة
IQLAB_MEEM, IQLAB_MEEM_LOW = "ۢ", "ۭ"  # ميمُ الإقلاب — وهي في QPC تنوبُ عن
#   الشَّطر الثاني من التنوين، فتُرسم حركةٌ واحدةٌ ومعها هذه (`أَبَدَۢا بِمَا`)

HARAKAT = {FATHA: "a", DAMMA: "u", KASRA: "i"}
TANWIN = {TAN_F: "a", TAN_D: "u", TAN_K: "i"}
MARKS = set(HARAKAT) | set(TANWIN) | {
    SUKUN, SHADDA, MADDAH, HAMZA_ABOVE, HAMZA_BELOW,
    IQLAB_MEEM, IQLAB_MEEM_LOW}

# علاماتُ وقفٍ وتحزيبٍ وسجدةٍ وإشاراتُ أداءٍ — تُقرأ ولا تُنطَق. وما كان منها
# إشارةَ حكمٍ خارجَ نطاقنا فموضعُه مذكورٌ بعينه في `LIMITS`.
IGNORED = set("‌ۖۗۘۙۚۛۜ۞۩ۣ۪۠ۨ۫۬")
DIGITS = set("٠١٢٣٤٥٦٧٨٩")


QALQALAH_LETTERS = set("قطبجد")     # يُشتقّ بها وقفُ الكلمة المفردة
NASAL_LETTERS = set("نم")           # مشدَّدُها مغنونٌ بلا استثناء     # يُشتقّ بها وقفُ الكلمة المفردة


# ————— ٣) الأحكامُ الثمانيةَ عشرَ وأثرُها —————

MADD_COUNTS = {                      # الحكمُ ← مقدارُه بالحركات
    "madda_normal": 2,               # طبيعيّ
    "madda_permissible": 2,          # عارضٌ للسكون: ٢ وصلاً و٢/٤/٦ وقفاً
    "madda_obligatory_mottasel": 4,  # واجبٌ متّصل
    "madda_obligatory_monfasel": 4,  # جائزٌ منفصل
    "madda_necessary": 6,            # لازم
}
MADD_RULES = set(MADD_COUNTS)

# أحكامٌ لها طرفان موسومان في النصّ: المُدغَم (أو المخفى) وما بعده
PAIRED = {
    "ikhafa", "iqlab", "idgham_ghunnah", "idgham_wo_ghunnah",
    "ikhafa_shafawi", "idgham_shafawi",
    "idgham_mutajanisayn", "idgham_mutaqaribayn",
}

# أثرُ الحكم على النون الساكنة والتنوين والميم الساكنة وحرفِ الإدغام
NASAL = {
    "ikhafa": "ⁿ",              # إخفاءٌ: غُنّةٌ بلا إطباقِ اللسان
    "iqlab": "ᵐ",               # إقلابٌ: ميمٌ مخفاة
    "ikhafa_shafawi": "ᵐ",      # إخفاءٌ شفويّ
    "idgham_ghunnah": "",       # يذهب الحرفُ وتبقى غُنّتُه على ما بعده
    "idgham_shafawi": "",
    "idgham_wo_ghunnah": "",    # يذهب بلا غُنّة
    "idgham_mutajanisayn": "",
    "idgham_mutaqaribayn": "",
}
GHUNNAH_CARRIERS = {"idgham_ghunnah", "idgham_shafawi"}   # يُغنّ ما بعدها

RULE_NAMES = {
    "ham_wasl": "همزةُ وصل", "slnt": "حرفٌ لا يُنطق",
    "laam_shamsiyah": "لامٌ شمسية", "ghunnah": "غُنّة", "qalaqah": "قلقلة",
    "ikhafa": "إخفاء", "ikhafa_shafawi": "إخفاءٌ شفويّ", "iqlab": "إقلاب",
    "idgham_ghunnah": "إدغامٌ بغُنّة", "idgham_wo_ghunnah": "إدغامٌ بلا غُنّة",
    "idgham_shafawi": "إدغامٌ شفويّ", "idgham_mutajanisayn": "إدغامُ المتجانسين",
    "idgham_mutaqaribayn": "إدغامُ المتقاربين",
    "madda_normal": "مدٌّ طبيعيّ", "madda_permissible": "مدٌّ عارضٌ للسكون",
    "madda_obligatory_mottasel": "مدٌّ واجبٌ متّصل",
    "madda_obligatory_monfasel": "مدٌّ جائزٌ منفصل",
    "madda_necessary": "مدٌّ لازم",
}

# فواتحُ السور: الحرفُ يُنطق **باسمه** لا بصوته، وليس اسمُه في النصّ. فهذا
# جدولُ أسماءٍ معلَن (صدرٌ · صائتٌ · عجُز)، **ومقدارُ صائته من وسم المصدر**:
# لازمٌ ⇒ ستّ حركات، وغيرُ موسومٍ ⇒ حركتان. تسعٌ وعشرون سورةً وحدَها.
LETTER_NAMES = {
    "ا": ("ʔalif", "", ""), "ل": ("l", "a", "m"), "م": ("m", "i", "m"),
    "ص": ("sˤ", "a", "d"), "ر": ("r", "a", ""), "ك": ("k", "a", "f"),
    "ه": ("h", "a", ""), "ي": ("j", "a", ""), "ع": ("ʕ", "aj", "n"),
    "ط": ("tˤ", "a", ""), "س": ("s", "i", "n"), "ح": ("ħ", "a", ""),
    "ن": ("n", "u", "n"), "ق": ("q", "a", "f"),
}
MUQATTA_SURAHS = {2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30,
                  31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68}

LIMITS = """ما لم يُطبَّق في هذا المولّد — وأكثرُه موسومٌ في المصدر فلا يخفى موضعُه:

  · الإمالة — ﴿مَجۡر۪ىٰهَا﴾ ١١:٤١ وحدَها (المحرف ۪ في المصدر). تُخرَج بالفتح.
  · الإشمام — ﴿تَأۡمَ۫نَّا﴾ ١٢:١١ وحدَها (المحرف ۫). يُخرَج إدغاماً كاملاً.
  · التسهيل — ﴿ءَا۠عۡجَمِىٌّ۬﴾ ٤١:٤٤ وحدَها (المحرفان ۠ و۬). تُخرَج همزةً محقَّقة.
  · السكت — مواضعُه في حفصٍ من طريق الشاطبية أربعة، ولا يسمها هذا المصدر.
  · ﴿ٱلۡمُصَۣيۡطِرُونَ﴾ ٥٢:٣٧ (المحرف ۣ) — وجهُ السين. تُخرَج صاداً.
  · ﴿نُـۨجِى﴾ ٢١:٨٨ (المحرف ۨ) — نونٌ صغيرة. تُخرَج نوناً منطوقة.
  · تفخيمُ الراء وترقيقُها — تُخرَج مفخَّمةً دائماً `r` بلا تمييز.
  · تفخيمُ لام لفظ الجلالة وترقيقُها — تُخرَج `l` بلا تمييز.
  · إطباقُ المستعلية فيما جاورها من الصوائت — أثرٌ صوتيٌّ لا يُرسم هنا.
  · مقدارُ المدّ العارض للسكون ٢ أو ٤ أو ٦ بخيار القارئ — والافتراضُ ٢،
    ويُبدَّل بـ`--arid 4` أو `--arid 6`.
  · مقدارُ المدّ المنفصل والمتّصل ٤ أو ٥ عند حفص — والمُخرَج ٤.
  · الوقفُ داخل الآية: تُوصَل الآيةُ كلُّها ويُوقَف على آخرها وحدَه، فعلاماتُ
    الوقف الجائز (ۖ ۗ ۚ ۛ) تُقرأ ولا يُوقَف عليها.
  · فواصلُ الكلمات تبقى في المُخرَج وإن أدغمت الكلمةُ فيما بعدها."""


# ————— ٤) الوحدة: حرفٌ بعلاماته —————

class Unknown(ValueError):
    """محرفٌ ليس في الجدول — يُوقِف البناء ولا يُبتلَع."""


class Unit:
    """حرفٌ واحدٌ بعلاماته وأحكامه وموضعِ محرفه في نصّ الآية."""

    __slots__ = ("base", "marks", "rules", "idx", "word", "borrowed")

    def __init__(self, base, idx, rules, word):
        self.base, self.idx, self.word = base, idx, word
        self.rules, self.marks, self.borrowed = set(rules), "", False

    def add_mark(self, ch, rules):
        self.marks += ch
        self.rules |= rules

    @property
    def haraka(self):
        return next((m for m in self.marks if m in HARAKAT), None)

    @property
    def tanwin(self):
        return next((m for m in self.marks if m in TANWIN), None)

    @property
    def shadda(self):
        return SHADDA in self.marks

    @property
    def hamza_mark(self):
        return HAMZA_ABOVE in self.marks or HAMZA_BELOW in self.marks

    @property
    def iqlab_mark(self):
        return IQLAB_MEEM in self.marks or IQLAB_MEEM_LOW in self.marks

    @property
    def joiner(self):
        """تطويلٌ مجرَّد — وصلُ رسمٍ لا حرف."""
        return self.base == TATWEEL and not self.marks

    @property
    def sakin(self):
        """ساكنٌ: لا حركةَ ولا تنوينَ ولا شدّة."""
        return not self.haraka and not self.tanwin and not self.shadda

    def rule(self, names):
        return next((r for r in sorted(self.rules) if r in names), None)

    def __repr__(self):
        return f"<{self.base}{self.marks} {sorted(self.rules)}>"


# علاماتٌ تُردّ إلى ما قبل الألف — والسكونُ والشدّةُ والمدّةُ تبقى على حاملها
REDIRECTABLE = set(HARAKAT) | set(TANWIN) | {IQLAB_MEEM, IQLAB_MEEM_LOW}


def _host(units, ch) -> int:
    """صاحبُ العلامة — وهو آخرُ وحدةٍ إلا في موضعٍ واحد.

    يرسم المصدرُ تنوينَ ما قبلَ الألف **بعدها** حين تتّصل بلامٍ قبلها
    (`مَثَلاً` `ضَلَـٰلاَۢ` — ٣٩٤ موضعاً): فالألفُ عاريةٌ وقبلها ساكنٌ، والعلامةُ
    في الحقيقة له. ولولا ردُّها إليه لسقط التنوينُ كلُّه من ٣٩٤ كلمة.

    **والسكونُ لا يُردّ**: `ءَامَنُواۡ` ألفُها ساكنةٌ موسومةٌ `slnt`، فردُّ سكونها
    إلى الواو يُلحق بها وسمَ الصمت فيذهب مدُّها — وهي مئاتُ المواضع.
    """
    last = units[-1]
    if ch not in REDIRECTABLE or last.base != ALEF or len(units) < 2:
        return -1
    if last.borrowed:
        return -2                     # عادت العلامةُ الثانية إلى حيث عادت الأولى
    prev = units[-2]
    if (not last.marks and prev.word == last.word
            and prev.base in CONS and prev.sakin):
        last.borrowed = True
        return -2
    return -1


def units_of(text: str):
    """(وحداتُ الآية، مواضعُ المحارف غيرِ المنطوقة).

    يرفع `Unknown` على أيّ محرفٍ غيرِ معلَن — فمحرفٌ جديد يُوقِف البناء
    يومَ يظهر، ولا يمرّ صامتاً.
    """
    units, skipped, word = [], {}, 0
    for idx, (ch, rules) in enumerate(tagged_chars(text)):
        if ch == " ":
            word += 1
            continue
        if ch in IGNORED:
            skipped[idx] = "علامةُ أداءٍ لا تُنطق"
            continue
        if ch in DIGITS:
            skipped[idx] = "رقمُ الآية"
            continue
        if ch in MARKS:
            if not units:
                raise Unknown(f"علامةٌ بلا حرفٍ قبلها: {ch!r}")
            units[_host(units, ch)].add_mark(ch, rules)
            skipped[idx] = "علامةٌ على حرفها"
            continue
        if ch == TATWEEL or ch in CONS or ch in MADD_CARRIERS or ch == WASLA:
            units.append(Unit(ch, idx, rules, word))
            continue
        raise Unknown(f"محرفٌ غيرُ معلَن: {ch!r} "
                      f"U+{ord(ch):04X} {unicodedata.name(ch, '?')}")
    return units, skipped


# ————— ٥) التصيير —————

class Out:
    """مخرجٌ يحمل نسبَ كلِّ رمزٍ إلى محرفه — وبه يعمل الحارس.

    `parts` كلُّ رمزٍ ومعه موضعُ المحرف الذي أنتجه وعلّتُه،
    و`silent` كلُّ حرفٍ لم يُنطق ومعه **علّتُه المعلَنة** — فلا حرفَ يسقط بلا سبب.
    """

    def __init__(self):
        self.parts = []
        self.silent = {}
        self.skipped = {}

    def add(self, sym, idx, why):
        if sym:
            self.parts.append((sym, idx, why))

    def hush(self, unit, why):
        self.silent[unit.idx] = why

    def text(self):
        return re.sub(r" +", " ", "".join(p[0] for p in self.parts)).strip()


class _Ctx:
    """حالُ التصيير: الوحداتُ والمخرجُ وما عُلِّق من غُنّةٍ على ما بعده."""

    def __init__(self, units, out, arid):
        self.units, self.out, self.arid = units, out, arid
        self.pending_ghunnah = False   # غُنّةُ إدغامٍ تنتظر أوّلَ صامتٍ بعدها
        # آخرُ منطوقٍ في الآية — تُتخطّى الحواملُ الصامتة، فيقع الوقفُ على
        # حرفِ التنوين لا على ألفه (`سَبِيلاً` ⇒ `sabiːlaː` لا `sabiːlaᵐ`)
        voiced = [i for i in range(len(units)) if not self.transparent(i)]
        self.final = voiced[-1] if voiced else None
        self.last_word = units[-1].word if units else 0

    def transparent(self, j) -> bool:
        """وحدةٌ لا صوتَ لها ولا تحجب ما وراءها: تطويلٌ، أو محذوفٌ بالوسم،
        أو حاملُ رسمٍ يعلوه خنجرٌ فيحمل هو المدَّ عنه (`عَلَىٰ` `ٱشۡتَرَٮٰهُ`)."""
        u = self.units[j]
        if u.joiner or "slnt" in u.rules:
            return True
        if u.base in BARE_CARRIERS and u.sakin and not u.hamza_mark:
            k = next((m for m in range(j + 1, len(self.units))
                      if not self.units[m].joiner), None)
            if k is not None and self.units[k].base in SMALL_MADD:
                return True                   # حاملٌ يعلوه خنجرٌ يحمل المدَّ عنه
            p = next((m for m in range(j - 1, -1, -1)
                      if not self.units[m].joiner), None)
            # ألفُ التنوين — والشفافيةُ هنا تجعل **الوقفَ يقع على حرف التنوين**
            # لا على ألفه الصامتة، فيُخرَج ﴿سَبِيلاً﴾ آخرَ الآية `sabiːlaː`
            if p is not None and (self.units[p].tanwin
                                  or self.units[p].iqlab_mark):
                return True
        return False

    def next_unit(self, i):
        for j in range(i + 1, len(self.units)):
            if not self.transparent(j):
                return j
        return None

    def prev_unit(self, i):
        for j in range(i - 1, -1, -1):
            if not self.transparent(j):
                return j
        return None


def render(text: str, key: str = "", arid: int = 2) -> Out:
    """يصيّر آيةً موسومةً رسماً صوتيّاً، محتفظاً بنسبِ كلِّ رمزٍ إلى محرفه."""
    units, skipped = units_of(text)
    return _render_units(units, skipped, key, arid)


def _render_units(units, skipped, key, arid) -> Out:
    out = Out()
    out.skipped = skipped
    if not units:
        return out
    ctx = _Ctx(units, out, arid)

    surah = int(key.split(":")[0]) if key and ":" in key else 0
    ayah = int(key.split(":")[1]) if key and ":" in key else 0
    start = _muqattaat(ctx, surah, ayah)

    for i in range(len(units)):
        if i < start:
            continue
        u = units[i]
        if i and u.word != units[i - 1].word:
            out.add(" ", u.idx, "فاصلُ كلمة")
        _emit(ctx, i)
    return out


# ————— الكلمةُ وحدَها: صورةُ الوقف والابتداء —————

def words_of(text: str):
    """[(رقمُ الكلمة، وحداتُها)] — الكلماتُ كما يقطّعها بياضُ النصّ."""
    units, _ = units_of(text)
    groups, current, number = [], [], None
    for u in units:
        if u.word != number:
            if current:
                groups.append((number, current))
            number, current = u.word, []
        current.append(u)
    if current:
        groups.append((number, current))
    return groups


def render_word(text: str, key: str, index: int, arid: int = 4) -> Out:
    """يصيّر **كلمةً وحدَها** كما تُنطق مفردةً — ابتداءً بأوّلها ووقفاً على آخرها.

    وليست هذه قصّةً من صوت الآية: ثلاثةُ أحكامٍ تتبدّل حين تُفرَد الكلمة، وكلُّها
    أثرٌ لِما جاورها فيسقط بسقوط الجوار:

      · **شدّةُ الإدغام في أوّلها** — يرسم المصحفُ ﴿مِن رَّبِّهِمۡ﴾ براءٍ مشدَّدة،
        والشدّةُ نونُ ﴿مِن﴾ أُدغِمت فيها. والكلمةُ مفردةً ﴿رَبِّهِم﴾ لا ﴿رَّبِّهِم﴾.
      · **إدغامُ آخرِها وإخفاؤه وإقلابُه** — نونُ ﴿مِن﴾ تذهب في سياقها وتظهر مفردةً.
      · **المدُّ المنفصل** — سببُه همزةُ الكلمة التالية، فيعود طبيعيّاً حركتين.

    ولذلك **لا يُغني قصُّ التسجيل عن التوليد**: القصُّ يعطي صورةَ الوصل، والتعليمُ
    يريد صورةَ الإفراد — وهي ما ينطق به المعلّم حين يلقّن كلمة.
    """
    groups = words_of(text)
    if not 0 <= index < len(groups):
        raise IndexError(f"الكلمةُ {index} خارجَ {key} ({len(groups)} كلمة)")
    units = [_freed(u) for u in groups[index][1]]
    if units:
        _free_edges(units)
    # **والمفتاحُ يُمرَّر**: كلماتُ فواتح السور تُنطق أسماءَ حروفٍ ولو أُفرِدت
    return _render_units(units, {}, key, arid)


def _freed(u: Unit) -> Unit:
    """نسخةٌ من الوحدة لا تُفسد الأصل — التصييرُ المفرد يعدّل أحكاماً."""
    copy = Unit(u.base, u.idx, u.rules, 0)
    copy.marks, copy.borrowed = u.marks, u.borrowed
    return copy


def _free_edges(units) -> None:
    """يفكّ طرفَي الكلمة ممّا علِق بهما من جوارهما."""
    # المدُّ الواجبُ والجائزُ سببُهما همزة. فإن لم تكن الهمزةُ في الكلمة فسببُه
    # ما بعدها، ويعود مفرداً مدّاً طبيعيّاً. **والعبرةُ بالهمزة لا باسم الحكم**:
    # يسم المرجعُ ﴿ءَامَنُوٓاۡ﴾ منفصلاً في ١١:٢٩ ومتّصلاً في ٢:١٦٥ وهمزتُهما
    # في الكلمة التالية في الموضعين.
    for j, u in enumerate(units):
        if not u.rules & {"madda_obligatory_mottasel",
                          "madda_obligatory_monfasel"}:
            continue
        if any(v.base in "ءأإؤئ" or v.hamza_mark for v in units[j + 1:]):
            continue
        u.rules -= {"madda_obligatory_mottasel", "madda_obligatory_monfasel"}
        u.rules.add("madda_normal")

    first, last = units[0], units[-1]
    first.rules -= PAIRED                      # هي المُدغَمُ فيه لِما قبلها
    # **ولا كلمةَ عربيةٌ تبتدئ بمشدَّد**: شدّةُ أوّلِ الكلمة أثرُ إدغامِ ما قبلها
    # دائماً (`مِن رَّبِّهِمۡ` `بَل لَّا` `عَذَابٌ مِّمَّا`)، فتُنزَع بلا شرط.
    # وكان النزعُ مشروطاً بوسمٍ في المرجع، فأفلت منه ما أدغمناه اشتقاقاً
    # (إدغامُ المتماثلين لا يسمه المرجع) — فخرج للرسم الواحد نطقان.
    first.marks = first.marks.replace(SHADDA, "", 1)
    last.rules -= PAIRED                       # وشريكُ حكمِ آخرِها ليس معها
    # **وقلقلةُ الوقف تُشتقّ**: يسمها المرجعُ حيث يسكن الحرفُ في سياقه، والكلمةُ
    # مفردةً تُوقَف دائماً فيسكن آخرُها. واتّباعُ المرجعِ لا مخالفتُه: في ٤٢٠
    # آيةٍ من ٤٢١ آخرُها حرفُ قلقلةٍ وسمه — والمشدَّدَ معها (﴿وَتَبَّ﴾ ١١١:١).
    # ويُستثنى ما لا حركةَ في كلمته أصلاً — فواتحُ السور تُنطق أسماءَ حروف.
    if last.base in QALQALAH_LETTERS and any(u.haraka or u.tanwin
                                             for u in units):
        last.rules.add("qalaqah")


def to_ipa_word(text: str, key: str, index: int, arid: int = 4) -> str:
    return render_word(text, key, index, arid).text()


def _muqattaat(ctx, surah, ayah) -> int:
    """فواتحُ السور: تُنطق أسماءَ حروفٍ لا أصواتاً. يُرجع عددَ ما استُهلك.

    والحدُّ **الحروفُ العارية في صدر الآية** — لا حركةَ عليها ولا تنوين؛
    وأوّلُ حرفٍ متحرّكٍ يقطع الفاتحة (`الٓمٓ` ثم `ذَٰلِكَ`).
    """
    if surah not in MUQATTA_SURAHS or ayah != 1:
        return 0
    units, taken = ctx.units, 0
    for i, u in enumerate(units):
        if u.joiner:
            taken = i + 1
            continue
        if u.base not in LETTER_NAMES or not u.sakin:
            break
        head, core, tail = LETTER_NAMES[u.base]
        length = 3 if "madda_necessary" in u.rules else 1
        if taken:
            ctx.out.add(" ", u.idx, "فاصلُ حرف")
        ctx.out.add(head + core + "ː" * length * bool(core) + tail, u.idx,
                    "muqattaat")
        taken = i + 1
    return taken


def _madd_length(ctx, i) -> int:
    """مقدارُ مدّ الوحدة بالحركات — من الوسم إن وُسِم، وإلا فطبيعيٌّ حركتان."""
    u = ctx.units[i]
    tagged = [MADD_COUNTS[r] for r in u.rules if r in MADD_RULES]
    if not tagged:
        return 2
    if "madda_permissible" in u.rules and u.word == ctx.last_word:
        return ctx.arid              # عارضٌ للسكون: بخيار القارئ عند الوقف
    return max(tagged)


def _madd_vowel(ctx, i) -> str:
    """صوتُ المدّ من الحركة قبله لا من رسمه — «لَفِى» ياءٌ بعد كسرةٍ ⇒ `iː`."""
    j = ctx.prev_unit(i)
    if j is not None:
        prev = ctx.units[j]
        if prev.haraka:
            return HARAKAT[prev.haraka]
        if prev.tanwin:
            return TANWIN[prev.tanwin]
        if prev.base in BARE_CARRIERS and prev.sakin:
            k = ctx.prev_unit(j)     # حاملٌ مجرَّدٌ يعلوه خنجر: الحركةُ قبله
            if k is not None and ctx.units[k].haraka:
                return HARAKAT[ctx.units[k].haraka]
    return MADD_VOWEL.get(ctx.units[i].base, "a")


def _is_madd(ctx, i) -> bool:
    """أهذه الوحدةُ حرفَ مدّ؟ — بالوسم، أو بالقاعدة حين لا يسمُ المرجعُ الطبيعيّ."""
    u = ctx.units[i]
    if u.base not in MADD_CARRIERS or u.hamza_mark or not u.sakin:
        return False
    if "slnt" in u.rules or ctx.transparent(i):
        return False
    k = ctx.prev_unit(i)
    prev = ctx.units[k] if k is not None else None
    # **حرفُ لينٍ لا حرفُ مدّ**: ياءٌ أو واوٌ ساكنةٌ بعد فتحةٍ صوتُها `aj`/`aw`
    # لا `aː`. ويسمها المرجعُ أحياناً `madda_permissible` عند الوقف، فلو
    # أُخِذ الوسمُ على ظاهره لخرجت ﴿ٱلۡبَيۡتِ﴾ `ʔalbaːt` بلا ياء.
    if u.base in ("ي", "و") and prev is not None and prev.haraka == FATHA:
        return False
    if u.rules & MADD_RULES or u.base in SMALL_MADD:
        return True                  # موسومٌ، أو حرفٌ صغيرٌ لا يُرسم إلا مدّاً
    if prev is None:
        return False
    if prev.tanwin or prev.iqlab_mark:
        return False                 # ألفُ التنوين — تسقط وصلاً
    if u.base in (MAQSURA, DOTLESS):
        # الألفُ المقصورة لا تكون صامتاً قطّ — فهي مدٌّ بحركةِ ما قبلها
        # (`فِى` كسرةٌ ⇒ `iː` · `مُوسَىٰ` فتحةٌ ⇒ `aː`)، أو حاملٌ سبق ردُّه.
        return prev.haraka is not None
    return prev.haraka == {ALEF: FATHA, "و": DAMMA, "ي": KASRA}[u.base]


def _mithlayn(ctx, i) -> bool:
    """إدغامُ المتماثلين — ساكنٌ يليه مثلُه مشدَّداً، فيذهب الأوّل.

    **مشتقٌّ لا منقول**: المرجعُ لا يسم هذا الباب، ولولا اشتقاقُه لخرجت
    ﴿ٱللَّهِ﴾ بلامين ظاهرتين. وهو والمدُّ الطبيعيُّ حدُّ الاشتقاق كلِّه.
    """
    u = ctx.units[i]
    if not u.sakin or u.base not in CONS:
        return False
    j = ctx.next_unit(i)
    return (j is not None and ctx.units[j].base == u.base
            and ctx.units[j].shadda)


def _jalalah_madd(ctx, i) -> bool:
    """ألفُ لفظ الجلالة — منطوقةٌ غيرُ مرسومة.

    ﴿ٱللَّهِ﴾ في هذا المصدر (وفي تنزيل) بلا ألفٍ ولا خنجرٍ ألبتّة: `ٱ ل ل ّ َ ه`.
    فلو أُخِذ الرسمُ على ظاهره لخرجت `lːahi` بفتحةٍ قصيرة. وهذا الموضعُ وحدَه
    يحتاج مدّاً يُزاد — وحدُّه: لامٌ مشدَّدةٌ مفتوحةٌ بعدها هاء، وقبلها لامٌ
    **في كلمتها**.

    وقيدان يمنعان ثلاثَ كلماتٍ تشبهه رسماً ولا تشبهه نطقاً:
      · **قيدُ الكلمة** — ﴿بَل لَّهُۥ﴾ ٢:١١٦: لامٌ مشدَّدةٌ مفتوحةٌ بعدها هاءٌ
        وقبلها لام، لكنّها لامُ ﴿بَلۡ﴾ من الكلمة السابقة، والثانيةُ ضميرٌ لا
        لفظُ جلالة. فلولا القيدُ لخرجت `balːaːhuː`.
      · **قيدُ آخرِ الكلمة** — ﴿ٱللَّهۡوِ﴾ و﴿ٱللَّهَبِ﴾: هاؤهما وسطُ الكلمة
        لا آخرُها، فهما «ال» داخلةٌ على لهوٍ ولهب. واستثناؤه ﴿ٱللَّهُمَّ﴾.
    """
    u = ctx.units[i]
    if u.base != "ل" or not u.shadda or u.haraka != FATHA:
        return False
    j, k = ctx.next_unit(i), ctx.prev_unit(i)
    if j is None or ctx.units[j].base != "ه":
        return False
    if k is None or ctx.units[k].base != "ل" or ctx.units[k].word != u.word:
        return False
    m = ctx.next_unit(j)
    if m is None or ctx.units[m].word != u.word:
        return True                       # الهاءُ آخرُ كلمتها
    return ctx.units[m].base == "م" and ctx.units[m].shadda   # ٱللَّهُمَّ


def _wasl_vowel(ctx, i) -> str:
    """حركةُ همزة الوصل ابتداءً.

    `ٱل` بالفتح — ولام التعريف هي كلُّ ما يفتتح به آيةً في المصحف (٢٢٧ آيةً
    تبدأ بهمزة وصل، ليس في أوائلها فعلٌ أوّلُه لام). وما سواها فالحكمُ
    **بثالث الحرف**: مضمومٌ ⇒ ضمٌّ (`ٱنظُرۡ` `ٱدۡخُلُوهَا`)، وإلا فكسرٌ
    (`ٱقۡرَأۡ` `ٱهۡدِنَا`) — والمشدَّدُ حرفان في العدّ (`ٱتَّخَذُوٓاۡ`).
    """
    rest = [u for u in ctx.units[i + 1:] if not u.joiner]
    if rest and rest[0].base == "ل":
        return "a"
    letters = []
    for u in rest:
        if u.shadda:
            letters.append(None)      # شطرُ الشدّة الساكن
        letters.append(u)
    third = letters[1] if len(letters) > 1 else None
    return "u" if third is not None and third.haraka == DAMMA else "i"


def _emit(ctx, i) -> None:
    units, out = ctx.units, ctx.out
    u = units[i]
    is_final = i == ctx.final                  # آخرُ منطوقٍ في الآية ⇒ وقف

    # ١) تطويلٌ مجرَّد — وصلُ رسمٍ لا حرف
    if u.joiner:
        out.hush(u, "tatweel")
        return

    # ٢) ما وسمه المصدرُ «لا يُنطق»
    if "slnt" in u.rules:
        out.hush(u, "slnt")
        return

    # ٣) همزةُ الوصل: تسقط وصلاً، وتُنطق ابتداءَ الآية
    if u.base == WASLA:
        if i == 0:
            out.add("ʔ" + _wasl_vowel(ctx, i), u.idx, "ham_wasl")
        else:
            out.hush(u, "ham_wasl")
        return

    # ٤) اللامُ الشمسية: تذهب ويبقى تشديدُ ما بعدها — والشدّةُ مرسومةٌ في المصدر
    if "laam_shamsiyah" in u.rules:
        out.hush(u, "laam_shamsiyah")
        return

    # ٥) حرفُ مدّ: يُطيل ما قبله ولا يُنطق حرفاً
    if _is_madd(ctx, i):
        out.add(_madd_vowel(ctx, i) + "ː" * (_madd_length(ctx, i) // 2), u.idx,
                u.rule(MADD_RULES) or "madd_natural")
        return

    # ٦) حاملٌ ساكنٌ لا مدَّ فيه: ألفُ التنوين (`هُدًى` `أَبَدَۢا`) تسقط وصلاً،
    #    والحاملُ الذي يعلوه خنجرٌ يذهب صوتُه إلى الخنجر
    if u.base in BARE_CARRIERS and u.sakin and not u.hamza_mark:
        j = ctx.prev_unit(i)
        prev = units[j] if j is not None else None
        out.hush(u, "tanwin-alef" if prev is not None
                 and (prev.tanwin or prev.iqlab_mark) else "carrier")
        return

    # ٧) الصامت
    sound = "ʔ" if u.hamza_mark else CONS.get(u.base, "")
    if u.base in (MAQSURA, DOTLESS, SMALL_YEH, SMALL_HIGH_YEH) and not sound:
        # حاملُ مدٍّ عليه حركةٌ ليس حاملاً بل **ياءٌ صامتة**: ألفاً مقصورةً
        # (`ٱلتَّرَاقِىَ` `وَلِىٍّ` — ٦٣٧ موضعاً)، أو ياءً صغيرةً متحرّكة
        # (`ءَاتَـٰنِۦَ` ٢٧:٣٦ و`وَلِــِّۧىَ` ٧:١٩٦ — خمسةُ مواضع).
        sound = "j"
    elif u.base == SMALL_WAW and not sound and (u.haraka or u.tanwin):
        sound = "w"
    if u.base == "ة" and is_final:
        sound = "h"                            # وقفاً على التاء المربوطة هاءٌ
    if (is_final and u.base in (MAQSURA, DOTLESS, "ي", "و")
            and not u.shadda and not u.tanwin):
        # وقفاً تُسكَّن، فإن جانستها حركةُ ما قبلها صارت مدّاً (`ٱلتَّرَاقِىْ`).
        # **والتنوينُ يسبق هذا الحكم**: ﴿كُفُوًا﴾ واوٌ منوَّنة، ووقفُها ألفُ
        # التنوين `kufuwaː` لا مدُّ ما قبلها `kufuː` — والواوُ فيها صامتٌ منطوق.
        k = ctx.prev_unit(i)
        prev = units[k] if k is not None else None
        want = DAMMA if u.base == "و" else KASRA
        if prev is not None and prev.haraka == want:
            out.add("ː", u.idx, "waqf-madd")
            return

    src = u.rule(PAIRED) or _nun_fallback(ctx, i)
    # إدغامُ المتماثلين مشتقٌّ لا موسوم — ولا يسبق حكماً منصوصاً عليه في المرجع
    if not (src and u.sakin) and _mithlayn(ctx, i):
        out.hush(u, "idgham_mithlayn")
        return

    if src and u.sakin:
        # نونٌ ساكنةٌ أو ميمٌ ساكنة أو حرفُ إدغام — يذهب صوتُه ويبقى أثرُه
        nasal = NASAL[src]
        if nasal:
            out.add(nasal, u.idx, src)
        else:
            out.hush(u, src)
        if src in GHUNNAH_CARRIERS:
            ctx.pending_ghunnah = True
        return

    out.add(sound, u.idx, "consonant")

    # ٩) التشديدُ والغُنّة — والشدّةُ مرسومةٌ في المصدر فلا تُخترع
    if u.shadda:
        out.add("ː", u.idx, "shadda")
        # **الغُنّةُ مشتقّةٌ لا منقولة**: كلُّ نونٍ وميمٍ مشدَّدةٍ مغنونةٌ بلا
        # استثناء، والمرجعُ يسم ٤٩١٩ منها ويترك ٢٤٢٣ — فلو اتُّبِع وسمُه وحدَه
        # لذهبت غُنّةُ ثلثِ المشدَّدات.
        if u.base in NASAL_LETTERS:
            out.add("̃", u.idx, "ghunnah")
    _take_ghunnah(ctx, i)

    if u.rules & MADD_RULES and u.base in ("ي", "و") and u.sakin:
        extra = _madd_length(ctx, i) // 2 - 1     # مدُّ اللين: يُطال الحرفُ نفسُه
        out.add("ː" * extra, u.idx, "madd_leen")

    if "qalaqah" in u.rules:
        out.add("ᵊ", u.idx, "qalaqah")

    # ١٠) الحركةُ والتنوين — والوقفُ يُسقط آخرَ حركةٍ في الآية
    if is_final:
        # المنصوبُ يصير ألفاً وقفاً، والمرفوعُ والمجرورُ يسقطان. ويرسم المصدرُ
        # تنوينَ النصب قبل الباء حركةً وميماً صغيرة، ووقفاً يعود ألفاً كسائره.
        if u.tanwin == TAN_F or (u.iqlab_mark and u.haraka == FATHA):
            out.add("aː", u.idx, "waqf-tanwin")
        return

    j = ctx.next_unit(i)
    if u.tanwin:
        out.add(TANWIN[u.tanwin], u.idx, "tanwin")
        tail = NASAL[src] if src else "n"          # إظهارٌ إن لم يُوسَم
        if tail:
            out.add(tail, u.idx, src or "izhar")
        elif src in GHUNNAH_CARRIERS:
            ctx.pending_ghunnah = True
    elif u.haraka:
        if _jalalah_madd(ctx, i):
            out.add("aː", u.idx, "jalalah_madd")
        elif not (j is not None and _is_madd(ctx, j)):
            # المدُّ إطالةُ الحركة — فلا تُكتب الحركةُ ومدُّها معاً
            out.add(HARAKAT[u.haraka], u.idx, "haraka")
        if u.iqlab_mark:              # إقلابٌ رُسم بحركةٍ واحدةٍ وميمٍ صغيرة
            out.add("ᵐ", u.idx, "iqlab")


# حروفُ الإخفاء الخمسةَ عشرَ — لا تُستعمَل إلا حين يسكت المرجع
IKHFA_LETTERS = set("تثجدذزسشصضطظفقك")


def _nun_fallback(ctx, i):
    """حكمُ نونٍ ساكنةٍ أو تنوينٍ **لم يسمه المرجع** — إخفاءً أو إقلاباً لا غير.

    المرجعُ يسم العبورَ بين الكلمتين كلَّه (٢٧١٤ موضعاً) ويترك عشرةً داخلَ
    الكلمة (`كَنزٌ` `إِنسٌ` `أَنۡسَـٰنِيهُ`)، فيخرج للرسم الواحد نطقان.
    فيُسَدّ بابُهما وحدَهما.

    **وضيقُه مقصود**: لا إدغامَ في الارتداد ولا إظهار. فالنونُ الساكنةُ قبل
    `ينمو` **داخلَ الكلمة** إظهارٌ مطلقٌ لا إدغام (`دُنۡيَا` `بُنۡيَـٰن`
    `صِنۡوَان` `قِنۡوَان`) — ولو عمّم الارتدادُ لأدغمها فأفسد أربعَ كلمات.
    """
    u = ctx.units[i]
    if not ((u.base == "ن" and u.sakin) or u.tanwin):
        return None
    j = ctx.next_unit(i)
    if j is None:
        return None
    after = ctx.units[j].base
    if after == "ب":
        return "iqlab"
    return "ikhafa" if after in IKHFA_LETTERS else None


def _take_ghunnah(ctx, i) -> None:
    """غُنّةٌ عُلِّقت من إدغامٍ قبلها — تُحمَل على أوّلِ صامتٍ يُنطق بعده.

    كاملٌ في `ن م` — والمصدرُ يرسم شدّتَه فيأتي التضعيفُ من الرسم؛
    وناقصٌ في `ي و` — لا شدّةَ فيه، فتُمَدّ الغُنّةُ حركتين على الحرف نفسِه.
    """
    if not ctx.pending_ghunnah:
        return
    ctx.pending_ghunnah = False
    u = ctx.units[i]
    if not (u.shadda and u.base in NASAL_LETTERS):
        ctx.out.add("̃", u.idx, "idgham_ghunnah")
    if not u.shadda:
        ctx.out.add("ː", u.idx, "idgham_ghunnah")   # إدغامٌ ناقصٌ في `ي و`


def to_ipa(text: str, key: str = "", arid: int = 2) -> str:
    return render(text, key, arid).text()


# ————— ٦) الواجهة —————

def form_id(ipa_text: str) -> str:
    """بصمةُ النطق — اثنا عشرَ رمزاً من sha256.

    **والمفتاحُ النطقُ لا الرسم**: رسمان مختلفان بنطقٍ واحدٍ صوتُهما واحد،
    فملفٌّ واحدٌ يكفيهما. وهو عينُ عهدِ «اقرأ»: اسمُ الملفّ من نصّه، فتصحيحُ
    حكمٍ يغيّر بصمةَ ما مسَّه وحدَه ويترك سائرَ الصوت المخزون على حاله.
    """
    return hashlib.sha256(ipa_text.encode("utf-8")).hexdigest()[:12]


def write_forms(source, out_dir: Path, arid: int) -> int:
    """يكتب جدولين: الصورُ المتمايزة (وهي قائمةُ العمل)، والرموزُ (وهي الفهرس)."""
    forms, tokens = {}, []
    for key, text in source.items():
        for i, (_, units) in enumerate(words_of(text)):
            arabic = "".join(u.base + u.marks for u in units)
            spoken = to_ipa_word(text, key, i, arid)
            fid = form_id(spoken)
            slot = forms.setdefault(fid, {"ipa": spoken, "rasm": {}, "n": 0})
            if slot["ipa"] != spoken:
                raise SystemExit(f"✗ تصادمُ بصمة: {fid}")
            slot["rasm"][arabic] = slot["rasm"].get(arabic, 0) + 1
            slot["n"] += 1
            tokens.append((key, i, fid))

    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "forms.tsv").open("w", encoding="utf-8") as f:
        f.write("id\tipa\tcount\trasm\n")
        for fid, v in sorted(forms.items(), key=lambda kv: -kv[1]["n"]):
            rasm = " ".join(sorted(v["rasm"], key=lambda r: -v["rasm"][r]))
            f.write(f"{fid}\t{v['ipa']}\t{v['n']}\t{rasm}\n")
    with (out_dir / "tokens.tsv").open("w", encoding="utf-8") as f:
        f.write("ayah\ti\tform\n")
        for key, i, fid in tokens:
            f.write(f"{key}\t{i}\t{fid}\n")

    print(f"  صورٌ متمايزة : {len(forms):6d}  → forms.tsv   (قائمةُ العمل)")
    print(f"  رموزٌ في المصحف: {len(tokens):6d}  → tokens.tsv  (الفهرس)")
    print(f"  التكرار      : ×{len(tokens) / len(forms):.1f}"
          f"  — يُولَّد الصوتُ مرّةً ويُشار إليه {len(tokens) - len(forms)} مرّةً زيادة")
    return 0


def rules_tally():
    """(عددُ الوسوم لكل حكم، عددُ المحارف التي يشملها) — الوسمُ يحيط بحرفٍ أو حرفين."""
    tags, chars = collections.Counter(), collections.Counter()
    for text in load_source().values():
        for bad in _SOURCE_DEFECTS:
            text = text.replace(bad, "")
        tags.update(m.group(1) for m in _OPEN.finditer(text))
        for _, rules in tagged_chars(text):
            chars.update(rules)
    return tags, chars


def self_test() -> int:
    """فحصٌ ذاتيّ بلا شبكة — آياتٌ تمسّ كلَّ بابٍ من أبواب الأحكام."""
    cases = [
        ("1:1", ["bismi", "lːaːhi", "rːaħmaːni", "rːaħiːm"]),        # وصلٌ ولامٌ شمسيةٌ ومدّ
        ("103:1", ["walʕasˤr"]),                          # همزةُ وصلٍ وقلقلةُ وقف
        ("112:1", ["qul", "huwa", "lːaːhu", "ʔaħadᵊ"]),
        ("2:3", ["ⁿ"]),                                   # إخفاءُ «يُنفِقون»
        ("2:10", ["ᵐ"]),                                  # إقلابُ «عَليمٌ بِما»
        ("2:5", ["huda", "mː̃i", "rːabːihim"]),                          # إدغامُ «هُدًى مِّن»
        ("2:1", ["ʔalif", "laːːːm", "miːːːm"]),          # فاتحةٌ ومدٌّ لازم
        ("19:1", ["kaːːːf", "haː", "jaː", "sˤaːːːd"]),
        ("4:158", ["rː"]),                                # إدغامُ المتقاربين
        ("2:233", ["tː"]),                                # إدغامُ المتجانسين
        ("1:7", ["dˤːaːːː"]),                              # مدٌّ لازمٌ مثقَّل
    ]
    words = [                       # الكلمةُ مفردةً: يسقط عنها أثرُ جوارها
        ("2:5", 3, "min"),          # ﴿مِّن﴾ — شدّةُ الإدغام ليست منها
        ("2:5", 4, "rabːihim"),     # ﴿رَّبِّهِمۡ﴾ — كذلك
        ("2:5", 2, "hudaː"),        # ﴿هُدًى﴾ — تنوينُ النصب ألفاً وقفاً
        ("2:10", 8, "ʔaliːm"),      # ﴿أَلِيمُۢ﴾ — لا إقلابَ بلا باءٍ بعدها
        ("1:1", 1, "ʔalːaːh"),      # ﴿ٱللَّهِ﴾ — ابتداءٌ ووقف
        ("112:1", 0, "qul"),
    ]
    source = load_source()
    fails = 0
    for key, wants in cases:
        got = to_ipa(source[key], key)
        missing = [w for w in wants if w not in got]
        fails += bool(missing)
        print(f"  {'✓' if not missing else '✗'} {key}\n      → {got}"
              + (f"\n      ينقصه: {'، '.join(missing)}" if missing else ""))
    for key, i, want in words:
        got = to_ipa_word(source[key], key, i)
        ok = got == want
        fails += not ok
        print(f"  {'✓' if ok else '✗'} {key}[{i}] مفردةً → {got}"
              + ("" if ok else f"   والمنتظَرُ {want}"))
    print("\n" + ("عدّةُ الرسم الصوتيّ سليمة (بلا شبكة)."
                  if not fails else f"{fails} فشل"))
    return 1 if fails else 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description="الرسمُ الصوتيّ (IPA) للمصحف من مصحف QPC الموسومِ بالتجويد")
    ap.add_argument("--ayah", help="سورة:آية")
    ap.add_argument("--words", help="سورة:آية — كلُّ كلمةٍ مفردةً كما يلقّنها معلّم")
    ap.add_argument("--surah", type=int)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--forms", metavar="مجلّد",
                    help="جدولا الصور والرموز — مفتاحُهما بصمةُ النطق")
    ap.add_argument("--all-words", action="store_true",
                    help="كلُّ كلمةٍ في المصحف مفردةً — سورة:آية، رقمُها، رسمُها")
    ap.add_argument("--arid", type=int, choices=(2, 4, 6), default=2,
                    help="مقدارُ المدّ العارض للسكون عند الوقف")
    ap.add_argument("--rules", action="store_true", help="جردُ أحكام المرجع")
    ap.add_argument("--limits", action="store_true", help="حدودُ هذا المولّد")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.limits:
        print(LIMITS)
        return 0
    if args.self_test:
        return self_test()
    if args.rules:
        tags, chars = rules_tally()
        print(f"  {'الحكم':22s} {'':26s} {'وسماً':>7s} {'محرفاً':>8s}")
        for name, n in tags.most_common():
            count = MADD_COUNTS.get(name)
            extra = f"  ({count} حركات)" if count else ""
            print(f"  {RULE_NAMES.get(name, name):22s} {name:26s} "
                  f"{n:7d} {chars[name]:8d}{extra}")
        print(f"\n  المجموع: {sum(tags.values())} وسماً على {len(tags)} حكماً، "
              f"تشمل {sum(chars.values())} محرفاً")
        return 0

    source = load_source()
    if args.words:
        text = source[args.words]
        for i, (_, units) in enumerate(words_of(text)):
            arabic = "".join(u.base + u.marks for u in units)
            print(f"  {i:2d}  {arabic:24s} {to_ipa_word(text, args.words, i, args.arid)}")
        return 0
    if args.ayah:
        text = source[args.ayah]
        print(plain(text))
        print(to_ipa(text, args.ayah, args.arid))
        return 0
    if args.surah:
        for key, text in source.items():
            if int(key.split(":")[0]) == args.surah:
                print(f"{key}\t{to_ipa(text, key, args.arid)}")
        return 0
    if args.all:
        for key, text in source.items():
            print(f"{key}\t{plain(text)}\t{to_ipa(text, key, args.arid)}")
        return 0
    if args.forms:
        return write_forms(source, Path(args.forms), args.arid)
    if args.all_words:
        for key, text in source.items():
            for i, (_, units) in enumerate(words_of(text)):
                arabic = "".join(u.base + u.marks for u in units)
                print(f"{key}\t{i}\t{arabic}\t"
                      f"{to_ipa_word(text, key, i, args.arid)}")
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
