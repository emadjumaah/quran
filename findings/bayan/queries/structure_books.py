# -*- coding: utf-8 -*-
"""
ب٠ — الهيكلة الحتمية لكتب البيان على عقد البيانات الموحد «جاهز لنبراس»
(findings/NIBRAS-DATA-CONTRACT.md)

الاستعمال:
    python3 structure_books.py <quran-kg.db المحلية> <مجلد raw> <مجلد structured> <مسار التقرير>

يقرأ شواهد OpenITI mARkdown من raw/ ويخرج لكل كتاب <layer>.jsonl:
  {id, layer, kind, text, source{work,author,locus,witness}, grade:"manqul",
   anchor{term?, root?[], aya?[]}}
كل خطوة حتمية: التقطيع على علامات متحققة، التنظيف معلن، مطابقة الاقتباسات
القرآنية بهيكل مجرد عبر فهرس ثماني الحروف، وإسناد الجذور بمطابقة الهيكل.
غير المحسوم يُترك فارغًا ويُعدّ في التقرير (وهو مادة سرب الإسناد ب١).
"""
import json
import os
import re
import sqlite3
import sys

DIAC = "ًٌٍَُِّْـٰٓۡۖۗۘۚۛۜٱ"
def skel(s):
    s = s.replace("ٱ", "ا")
    s = "".join(ch for ch in s if ch not in DIAC)
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ","و").replace("ئ","ي").replace("ء","")
    return re.sub(r"\s+", " ", s).strip()

NUM = ("وجهين|وجهان|ثلاثة عشر|أربعة عشر|خمسة عشر|ستة عشر|سبعة عشر|ثمانية عشر"
       "|أحد عشر|اثني عشر|اثنى عشر|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة"
       "|عشرة|عشرين|واحد")

# ---------------------------------------------------------------- التنظيف

PAGE = re.compile(r"PageV(\d+)P(\d+)")

def clean_text(seg):
    """نص مقروء: إزالة علامات mARkdown مع تحويل أقواس الاقتباس القرآني."""
    s = seg.replace("@QB@", "﴿").replace("@QE@", "﴾")
    s = PAGE.sub(" ", s)
    s = s.replace("~~", "")
    s = re.sub(r"\[\[[^\]]*\]\]", "", s)          # حواشي المحقق المعقوفة
    s = re.sub(r"ms\d+", " ", s)
    s = s.replace("%", "\n")                        # أبيات الشعر أسطرًا
    s = re.sub(r"#+", "\n", s)
    s = s.replace("|", " ").replace("@", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()

def last_page(body, pos):
    """آخر علامة صفحة قبل الموضع → (المجلد، الصفحة) للموضع الدقيق."""
    m = None
    for m in PAGE.finditer(body, 0, pos):
        pass
    return (int(m.group(1)), int(m.group(2))) if m else None

# ------------------------------------------------- فهرس الآيات للمطابقة

class AyaIndex:
    def __init__(self, db):
        cx = sqlite3.connect(db)
        self.ayas = cx.execute(
            "SELECT surah_no||':'||ayah_no, text_clean FROM ayah").fetchall()
        self.sk = [(loc, skel(t)) for loc, t in self.ayas]
        self.gram = {}
        for i, (loc, s) in enumerate(self.sk):
            for j in range(0, max(1, len(s) - 7)):
                g = s[j:j+8]
                self.gram.setdefault(g, set()).add(i)
        cx.close()

    def match(self, quote, cap=10):
        q = skel(quote)
        if len(q) < 8 or len(q.split()) < 2:
            return []
        cands = self.gram.get(q[:8], set())
        hits = [self.sk[i][0] for i in cands if q in self.sk[i][1]]
        return sorted(set(hits))[:cap] if len(set(hits)) <= cap else []

QUOTE_PATTERNS = [re.compile(r"﴿([^﴾]{6,300})﴾"),
                  re.compile(r"@QB@([^@]{6,300})@QE@"),
                  re.compile(r"\{([^}]{6,300})\}"),
                  re.compile(r'"([^"]{6,200})"'),
                  re.compile(r"\(([^)]{6,200})\)")]

ARABIC_ONLY = re.compile(r"[^ء-يٰٱ\s]")

def aya_refs(raw_seg, aidx):
    refs = []
    for pat in QUOTE_PATTERNS:
        for q in pat.findall(raw_seg):
            # تنقية الاقتباس من رموز الرقمنة (^ للآية في JK، ~~ للوصل، أرقام…)
            q = ARABIC_ONLY.sub(" ", q.replace("~~", " "))
            refs += aidx.match(q)
    out, seen = [], set()
    for r in refs:
        if r not in seen:
            seen.add(r); out.append(r)
    return out[:20]

# ------------------------------------------------- إسناد الجذور الأولي

class RootIndex:
    def __init__(self, db):
        cx = sqlite3.connect(db)
        self.roots = {}
        for rid, rar in cx.execute("SELECT root_id, root_ar FROM root"):
            self.roots.setdefault(skel(rar), rar)
        self.lem = {}
        for lar, rar in cx.execute(
            "SELECT l.lemma_ar, r.root_ar FROM lemma l JOIN root r ON r.root_id=l.root_id"):
            self.lem.setdefault(skel(lar), rar)
        cx.close()

    STOP = {"في", "فى", "من", "بين", "علي", "على", "ما", "الفرق", "بصيرة", "باب"}

    def of_terms(self, words):
        """محاولة حتمية: كلمة الرأس → جذر (مباشرة، أو عبر لمّة، أو بنزع ال)."""
        found = []
        for w in words:
            s = skel(w)
            s = re.sub(r"^و", "", s)
            for cand in (s, re.sub(r"^ال", "", s)):
                if cand in self.STOP or len(cand) < 2:
                    continue
                r = self.roots.get(cand) or self.lem.get(cand)
                if r and r not in found:
                    found.append(r); break
        return found

# ---------------------------------------------------------------- الكتب

def read_body(path):
    t = open(path, encoding="utf-8").read()
    i = t.find("#META#Header#End")
    return t[i + len("#META#Header#End"):]

def entry(layer, n, kind, head, raw_seg, work, author, witness, body, pos,
          aidx, ridx, head_words=None):
    pg = last_page(body, pos)
    locus = head[:80] + ((" — ج%d ص%d" % pg) if pg else "")
    terms = head_words if head_words is not None else []
    e = {"id": "%s-%04d" % (layer, n), "layer": layer, "kind": kind,
         "text": clean_text(raw_seg),
         "source": {"work": work, "author": author, "locus": locus,
                    "witness": witness},
         "grade": "manqul",
         "anchor": {}}
    if head:
        e["anchor"]["term"] = re.sub(r"\s+", " ", head).strip()[:60]
    roots = ridx.of_terms(terms) if terms else []
    if roots:
        e["anchor"]["root"] = roots
    refs = aya_refs(raw_seg, aidx)
    if refs:
        e["anchor"]["aya"] = refs
    return e

def split_at(body, positions):
    """قطع النص عند المواضع (مرتبةً) — من كل موضع إلى تاليه."""
    positions = sorted(set(positions))
    segs = []
    for i, p in enumerate(positions):
        q = positions[i + 1] if i + 1 < len(positions) else len(body)
        segs.append((p, body[p:q]))
    return segs

def head_terms_pair(head):
    """«الفرق بين X والY وZ» → [X, Y, Z] بعد نزع الواو وال."""
    h = re.sub(r"^و?الفرق بين ", "", head)
    parts = re.split(r"\s+و(?=\S)|،", h)
    return [re.sub(r"^ال", "", p.strip()) for p in parts if p.strip()][:4]

def build_furuq(raw, wit, aidx, ridx):
    body = read_body(os.path.join(raw, wit))
    pos = [m.start(1) for m in re.finditer(r"[#|]\s*((?:و)?الفرق بين)", body)]
    entries = []
    for n, (p, seg) in enumerate(split_at(body, pos), 1):
        # الرأس حتى «أن» المفتتحة للشرح — بحدود كلمة كي لا تُقطع «الأنس» ونحوها
        zone = re.sub(r"\s+", " ", seg[:140])
        m = re.match(r"^(و?الفرق بين .{2,80}?)\s+أنّ?ه?\s", zone)
        head = (m.group(1) if m else " ".join(zone.split()[:8])).strip(" |#~")
        entries.append(entry("bayan-furuq", n, "farq", head, seg,
                             "الفروق اللغوية", "أبو هلال العسكري", wit,
                             body, p, aidx, ridx, head_terms_pair(head)))
    return entries

def build_basair(raw, wit, aidx, ridx):
    body = read_body(os.path.join(raw, wit))
    pos = [m.start(1) for m in re.finditer(r"[#|]\s*(بصيرة ف[ىي])", body)]
    entries = []
    for n, (p, seg) in enumerate(split_at(body, pos), 1):
        head = re.sub(r"\s+", " ", seg[:100]).strip(" |#~")
        head = head[:60]
        is_sura = ".." in head or "سورة" in head[:25]
        words = [] if is_sura else re.sub(r"^بصيرة ف[ىي] ", "", head).split()[:5]
        entries.append(entry("bayan-basair", n,
                             "sura-basira" if is_sura else "wujuh",
                             head, seg, "بصائر ذوي التمييز", "الفيروزآبادي",
                             wit, body, p, aidx, ridx, words))
    return entries

def build_headed(raw, wit, layer, kind, work, author, aidx, ridx,
                 entry_filter=None, term_words=True):
    """الكتب المعنونة بـ### | : وجوه العسكري، ملاك، الإتقان."""
    body = read_body(os.path.join(raw, wit))
    pos = [m.start() for m in re.finditer(r"### \|", body)]
    entries = []
    n = 0
    for p, seg in split_at(body, pos):
        # يُنزع سابق العنوان أولًا — التقسيم على '#' قبل النزع يُفرغ الرأس
        head_zone = re.sub(r"^### \|+ ?", "", seg[:120])
        head = re.sub(r"\s+", " ", head_zone.split("\n")[0].split("#")[0]).strip()
        k = kind
        if entry_filter:
            k = entry_filter(head)
            if k is None:
                k = "front-matter"
        n += 1
        words = head.split()[:4] if term_words else []
        entries.append(entry(layer, n, k, head, seg, work, author, wit,
                             body, p, aidx, ridx, words))
    return entries

def build_nuzha(raw, wit, aidx, ridx):
    body = read_body(os.path.join(raw, wit))
    ms = list(re.finditer(r"\(\s*\d+\s*-\s*باب\s+[^)]{1,35}\)", body))
    entries = []
    for n, (p, seg) in enumerate(split_at(body, [m.start() for m in ms]), 1):
        head = re.sub(r"\s+", " ", seg[:60]).strip("(| #~")
        word = re.sub(r"^\d+\s*-\s*باب\s+", "", head).split(")")[0].strip()
        entries.append(entry("bayan-nuzha", n, "wujuh", head.split(")")[0] + ")",
                             seg, "نزهة الأعين النواظر", "ابن الجوزي", wit,
                             body, p, aidx, ridx, word.split()[:3]))
    return entries

def build_damghani(raw, wit, aidx, ridx):
    """رأس المدخل سطرُ فقرةٍ جديدة (لا يبدأ بوصلة ~~) قصيرٌ ينتهي بصيغة
    «على N أوجه» — والصيغة داخل سطر وصلٍ إعادةُ تقريرٍ داخلية لا رأس."""
    body = read_body(os.path.join(raw, wit))
    formula = re.compile(r"على\s+(?:" + NUM + r")\s*(?:أوجه|وجوه|وجها|وجهين)?")
    pos, heads = [], {}
    for m in formula.finditer(body):
        # حد المدخل: آخر علامة فقرة #/@ قبل الصيغة بمسافة ≤ ٢٥٠ (وصلات ~~
        # تغلف كل الأسطر في هذا الشاهد فلا يصلح السطر معيارًا)؛ ما لم يجد
        # حدًّا قريبًا فهو إعادة تقرير داخلية تبقى في مدخلها
        h = max(body.rfind("#", 0, m.start()), body.rfind("@", 0, m.start()))
        if h < 0 or m.start() - h > 250:
            continue
        head = re.sub(r"\s+", " ", PAGE.sub(" ", body[h + 1:m.start()]).replace("~~", " ")).strip(" |#@~")
        if not head or len(head) > 45 or len(head.split()) > 6:
            continue
        if h not in heads:
            pos.append(h); heads[h] = head
    entries = []
    for n, (p, seg) in enumerate(split_at(body, pos), 1):
        head = heads[p]
        # رؤوس مفروقة الأحرف («أح د») تُضم كلمةً واحدة لإسناد الجذر
        word = head.replace(" ", "") if head and all(len(w) <= 2 for w in head.split()) else head
        entries.append(entry("bayan-damghani", n, "wujuh", head or "(بلا رأس)",
                             seg, "قاموس القرآن (إصلاح الوجوه والنظائر)",
                             "الدامغاني", wit, body, p, aidx, ridx,
                             [word] if word else []))
    return entries

def build_durra(raw, wit, aidx, ridx):
    body = read_body(os.path.join(raw, wit))
    sura_pos = [(m.start(), re.sub(r"\s+", " ", m.group(1)).strip())
                for m in re.finditer(r"### \|+ ?([^\n#]{1,40})", body)
                if "سورة" in m.group(1)]
    aya_pos = [m.start() for m in re.finditer(r"#\s*\d+\s+الآية", body)]
    entries = []
    for n, (p, seg) in enumerate(split_at(body, aya_pos), 1):
        sura = ""
        for sp, sname in sura_pos:
            if sp <= p:
                sura = sname
        head = re.sub(r"\s+", " ", seg[:70]).strip(" |#~")
        entries.append(entry("bayan-durra", n, "mawdic-mutashabih",
                             (sura + " — " + head)[:80], seg,
                             "درة التنزيل وغرة التأويل", "الخطيب الإسكافي",
                             wit, body, p, aidx, ridx, []))
    return entries

def build_burhan(raw, wit, aidx, ridx):
    body = read_body(os.path.join(raw, wit))
    ms = list(re.finditer(r"[#|]\s*(النوع [^#\n]{1,60})", body))
    entries = []
    for n, (p, seg) in enumerate(split_at(body, [m.start(1) for m in ms]), 1):
        head = re.sub(r"\s+", " ", seg[:80].split("#")[0]).strip()
        entries.append(entry("bayan-burhan", n, "naw-culum", head, seg,
                             "البرهان في علوم القرآن", "الزركشي", wit,
                             body, p, aidx, ridx, []))
    return entries

# ---------------------------------------------------------------- التشغيل

def main():
    db, raw, out_dir, report_path = sys.argv[1:5]
    os.makedirs(out_dir, exist_ok=True)
    aidx, ridx = AyaIndex(db), RootIndex(db)

    def itqan_filter(head):
        return "naw-culum" if head.startswith("النوع") else "front-matter"

    def malak_filter(head):
        # المقدمات فقط بنية؛ كل ما سواها قطع محتوى (رؤوس السور وفصولها الداخلية)
        struct = any(head.startswith(x) for x in ("مقدمة", "خطبة", "فهرس", "المجلد", "تقديم"))
        return "front-matter" if struct else "qitca"

    def wujuh_filter(head):
        struct = ("مقد" in head[:8] or head.startswith("الباب") or head.startswith("المجلد"))
        return "front-matter" if struct else "wujuh"

    books = [
        ("bayan-furuq", lambda: build_furuq(raw, "0395AbuHilalCaskari.FuruqLughawiyya.JK006960-ara1", aidx, ridx)),
        ("bayan-basair", lambda: build_basair(raw, "0817MajdDinFiruzabadi.BasairDhawiTamyiz.Shamela0009856-ara1", aidx, ridx)),
        ("bayan-wujuh-askari", lambda: build_headed(raw, "0395AbuHilalCaskari.WujuhWaNazair.Shamela0037586-ara1",
            "bayan-wujuh-askari", "wujuh", "الوجوه والنظائر", "أبو هلال العسكري", aidx, ridx, wujuh_filter)),
        ("bayan-nuzha", lambda: build_nuzha(raw, "0597IbnJawzi.NuzhatAcyun.JK007134-ara1", aidx, ridx)),
        ("bayan-damghani", lambda: build_damghani(raw, "0478IbnMuhammadDamghani.QamusQuran.ShamAY0034085-ara1", aidx, ridx)),
        ("bayan-durra", lambda: build_durra(raw, "0420IbnCabdAllahKhatibIskafi.DurratTanzil.Shamela0001340-ara1", aidx, ridx)),
        ("bayan-malak", lambda: build_headed(raw, "0708IbnIbrahimAbuJacfarGharnati.MalakTawilQatic.Shamela0001419-ara1",
            "bayan-malak", "qitca", "ملاك التأويل", "ابن الزبير الغرناطي", aidx, ridx, malak_filter, term_words=False)),
        ("bayan-burhan", lambda: build_burhan(raw, "0794BadrDinZarkashi.BurhanFiCulumQuran.Shamela0011436-ara1", aidx, ridx)),
        ("bayan-itqan", lambda: build_headed(raw, "0911Suyuti.Itqan.Shamela0011728-ara1",
            "bayan-itqan", "naw-culum", "الإتقان في علوم القرآن", "السيوطي", aidx, ridx, itqan_filter, term_words=False)),
    ]

    lines = ["# تقرير بوابة ب٠ — الهيكلة الحتمية (مولد آليًّا من structure_books.py)", ""]
    lines.append("| الطبقة | المداخل | منها بنية | جذر مسند | آية مسندة | متوسط الطول | بلا نص |")
    lines.append("|---|---|---|---|---|---|---|")
    for layer, fn in books:
        es = fn()
        path = os.path.join(out_dir, layer + ".jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for e in es:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        content = [e for e in es if e["kind"] != "front-matter"]
        rooted = sum(1 for e in content if e["anchor"].get("root"))
        ayad = sum(1 for e in content if e["anchor"].get("aya"))
        empty = sum(1 for e in es if len(e["text"]) < 40)
        avg = sum(len(e["text"]) for e in es) // max(1, len(es))
        lines.append("| %s | %d | %d | %d | %d | %d | %d |" % (
            layer, len(es), len(content), rooted, ayad, avg, empty))
        print(lines[-1])
    open(report_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("تقرير:", report_path)

if __name__ == "__main__":
    main()
