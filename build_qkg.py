#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build the Quran Knowledge Graph (QKG) — quran-kg.db
====================================================

Builds a single, self-contained SQLite database in which every surah, ayah,
word, morphological segment, and letter of the Quran is a first-class,
queryable entity with full linguistic metadata (root, lemma, part of speech,
verb form, aspect, mood, voice, case, person/gender/number, ...) and full
structural positioning (juz, hizb, rub, ruku, page, manzil, sajda).

Sources
-------
  data/quran-morphology.txt   Quranic Arabic Corpus v0.4 morphology
                              (Arabic-script edition, mustafa0x/quran-morphology)
  data/quran-data.xml         Tanzil structural metadata (surahs, juz, hizb
                              quarters, rukus, pages, manzils, sajdas)
  data/quran-uthmani.txt      Tanzil Uthmani text v1.1 (one ayah per line)
  data/quran-clean.txt        Simple clean text  surah|ayah|text

Usage
-----
  python3 build_qkg.py            # writes quran-kg.db next to this script

The build is fully deterministic: re-running it recreates the identical
database from the source files.
"""

import os
import re
import sqlite3
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
MORPH_FILE = os.path.join(HERE, "data", "quran-morphology.txt")
META_FILE = os.path.join(HERE, "data", "quran-data.xml")
UTHMANI_FILE = os.path.join(HERE, "data", "quran-uthmani.txt")
CLEAN_FILE = os.path.join(HERE, "data", "quran-clean.txt")
DB_FILE = os.path.join(HERE, "quran-kg.db")

BASMALA_UTHMANI = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
# Surahs 95 and 97 follow surahs ending in ب; Tanzil writes the basmala there
# with idgham — a shadda on the bā (ب + kasra U+0650 + shadda U+0651).
BASMALA_UTHMANI_SHADDA = BASMALA_UTHMANI.replace("بِ", "بِّ", 1)
BASMALA_CLEAN = "بسم الله الرحمن الرحيم"

# Vocative/attention particles written separately in the clean text but fused
# to the next word in Uthmani orthography (e.g. «يا أيها» -> «يَٰٓأَيُّهَا»).
FUSED_PARTICLES = {"يا", "ها", "ويا", "فيا", "أيا"}

# Other clean-text sequences fused into a single word in Uthmani orthography.
# Merged clean tokens KEEP their space ("يا أيها", "بعد ما"): the stored
# text_clean stays exactly the source text — searchable and letter-exact —
# while the word boundary follows QAC tokenization.
MERGE_PAIRS = {("بعد", "ما"),      # بَعْدَمَا  (2:181, 8:6, 13:37)
               ("إل", "ياسين"),    # إِلْ يَاسِينَ (37:130)
               ("وأن", "لو")}      # وَأَلَّوِ (72:16)
MERGE_TRIPLES = {("يا", "ابن", "أم")}  # يَبْنَؤُمَّ (20:94)

# ---------------------------------------------------------------------------
# Tag glossaries (Quranic Arabic Corpus tagset)
# ---------------------------------------------------------------------------

POS_TAGS = {
    # tag: (english, arabic, category)
    "N":         ("Noun", "اسم", "nominal"),
    "PN":        ("Proper noun", "اسم علم", "nominal"),
    "ADJ":       ("Adjective", "صفة", "nominal"),
    "NV":        ("Verbal noun (ism fi'l)", "اسم فعل", "nominal"),
    "PRON":      ("Personal pronoun", "ضمير", "pronoun"),
    "DEM":       ("Demonstrative pronoun", "اسم إشارة", "pronoun"),
    "REL":       ("Relative pronoun", "اسم موصول", "pronoun"),
    "T":         ("Time adverb", "ظرف زمان", "adverb"),
    "LOC":       ("Location adverb", "ظرف مكان", "adverb"),
    "V":         ("Verb", "فعل", "verb"),
    "P":         ("Preposition", "حرف جر", "particle"),
    "DET":       ("Determiner (al-)", "أداة التعريف", "particle"),
    "CONJ":      ("Coordinating conjunction", "حرف عطف", "particle"),
    "SUB":       ("Subordinating conjunction", "حرف مصدري", "particle"),
    "ACC":       ("Accusative particle (inna family)", "حرف نصب", "particle"),
    "AMD":       ("Amendment particle", "حرف استدراك", "particle"),
    "ANS":       ("Answer particle", "حرف جواب", "particle"),
    "ATT":       ("Attention particle", "حرف تنبيه", "particle"),
    "AVR":       ("Aversion particle", "حرف ردع", "particle"),
    "CAUS":      ("Particle of cause", "حرف سببية", "particle"),
    "CERT":      ("Particle of certainty", "حرف تحقيق", "particle"),
    "CIRC":      ("Circumstantial particle", "حرف حال", "particle"),
    "COM":       ("Comitative particle", "واو المعية", "particle"),
    "COND":      ("Conditional particle", "حرف شرط", "particle"),
    "EQ":        ("Equalization particle", "حرف تسوية", "particle"),
    "EXH":       ("Exhortation particle", "حرف تحضيض", "particle"),
    "EXL":       ("Explanation particle", "حرف تفصيل", "particle"),
    "EXP":       ("Exceptive particle", "أداة استثناء", "particle"),
    "FUT":       ("Future particle", "حرف استقبال", "particle"),
    "INC":       ("Inceptive particle", "حرف ابتداء", "particle"),
    "INT":       ("Particle of interpretation", "حرف تفسير", "particle"),
    "INTG":      ("Interrogative particle", "حرف استفهام", "particle"),
    "NEG":       ("Negative particle", "حرف نفي", "particle"),
    "PREV":      ("Preventive particle (ma)", "حرف كافّ (ما الكافّة)", "particle"),
    "PRO":       ("Prohibition particle", "حرف نهي", "particle"),
    "REM":       ("Resumption particle", "حرف استئناف", "particle"),
    "RES":       ("Restriction particle", "أداة حصر", "particle"),
    "RET":       ("Retraction particle", "حرف إضراب", "particle"),
    "RSLT":      ("Result particle", "حرف واقع في جواب الشرط", "particle"),
    "SUP":       ("Supplemental particle", "حرف زائد", "particle"),
    "SUR":       ("Surprise particle", "حرف فجاءة", "particle"),
    "VOC":       ("Vocative particle", "حرف نداء", "particle"),
    "INL":       ("Quranic initials", "حروف مقطعة", "particle"),
    "EMPH":      ("Emphasis (emphatic lam / nun of emphasis)", "توكيد: لام التوكيد أو نون التوكيد", "particle"),
    "IMPV_LAM":  ("Imperative lam", "لام الأمر", "particle"),
    "PRP":       ("Purpose lam", "لام التعليل", "particle"),
    "DIST":      ("Distance lam (of demonstrative)", "لام البعد", "particle"),
    "ADDR":      ("Address suffix (kaf of address)", "كاف الخطاب", "particle"),
}

DERIVATIONS = {
    "ACT_PCPL": ("Active participle", "اسم فاعل"),
    "PASS_PCPL": ("Passive participle", "اسم مفعول"),
    "VN": ("Verbal noun", "مصدر"),
}

ASPECTS = {"PERF": ("Perfect", "ماضٍ"),
           "IMPF": ("Imperfect", "مضارع"),
           "IMPV": ("Imperative", "أمر")}

MOODS = {"IND": ("Indicative", "مرفوع"),
         "SUBJ": ("Subjunctive", "منصوب"),
         "JUS": ("Jussive", "مجزوم")}

CASES = {"NOM": ("Nominative", "مرفوع"),
         "ACC": ("Accusative", "منصوب"),
         "GEN": ("Genitive", "مجرور")}

# Fine POS tags looked up among the bare feature tags (priority order).
POS_PRIORITY = [
    "PN", "ADJ", "NV", "PRON", "DEM", "REL", "T", "LOC", "INL",
    "DET", "CONJ", "SUB", "EMPH", "PRP", "DIST", "ADDR", "VOC",
    "NEG", "COND", "INTG", "ACC", "AMD", "ANS", "ATT", "AVR", "CAUS",
    "CERT", "CIRC", "COM", "EQ", "EXH", "EXL", "EXP", "FUT", "INC",
    "INT", "PREV", "PRO", "REM", "RES", "RET", "RSLT", "SUP", "SUR",
]

PGN_RE = re.compile(r"^([123])?(M|F)?(S|D|P)?$")

ARABIC_LETTER_RE = re.compile(r"[ء-يٱ]")


def norm(text):
    return unicodedata.normalize("NFC", text.strip())


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def parse_metadata():
    tree = ET.parse(META_FILE)
    root = tree.getroot()

    surahs = []
    for s in root.find("suras"):
        surahs.append(dict(
            no=int(s.get("index")), ayahs=int(s.get("ayas")),
            start=int(s.get("start")), name_ar=s.get("name"),
            name_translit=s.get("tname"), name_en=s.get("ename"),
            revelation=s.get("type"), chrono=int(s.get("order")),
            rukus=int(s.get("rukus"))))

    def boundaries(tag):
        return [(int(e.get("index")), int(e.get("sura")), int(e.get("aya")))
                for e in root.find(tag)]

    sajdas = {(int(e.get("sura")), int(e.get("aya"))): e.get("type")
              for e in root.find("sajdas")}

    return surahs, {
        "juz": boundaries("juzs"),
        "rub": boundaries("hizbs"),      # 240 hizb quarters
        "manzil": boundaries("manzils"),
        "ruku": boundaries("rukus"),
        "page": boundaries("pages"),
    }, sajdas


def parse_piped(path):
    """surah|ayah|text -> dict[(s,a)] = text"""
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            s, a, text = line.split("|", 2)
            s, a = int(s), int(a)
            text = norm(text)
            if a == 1 and s not in (1, 9) and text.startswith(BASMALA_CLEAN):
                text = text[len(BASMALA_CLEAN):].strip()
            out[(s, a)] = text
    return out


def align_clean(tokens, target):
    """Align clean-text tokens to the QAC word count by merging vocative
    particles («يا», «ها», ...) and known fused sequences with the following
    word. Merged tokens keep their internal space, preserving the source
    text exactly. Returns a list of exactly `target` tokens, or None if
    alignment is impossible."""
    if len(tokens) == target:
        return tokens
    toks = list(tokens)
    i = 0
    while len(toks) > target and i < len(toks) - 1:
        if tuple(toks[i:i + 3]) in MERGE_TRIPLES:
            toks[i:i + 3] = [" ".join(toks[i:i + 3])]
        elif tuple(toks[i:i + 2]) in MERGE_PAIRS or toks[i] in FUSED_PARTICLES:
            toks[i:i + 2] = [" ".join(toks[i:i + 2])]
        else:
            i += 1
    return toks if len(toks) == target else None


def parse_uthmani(surahs):
    """Tanzil line-per-ayah file; strips basmala prefixed to first ayahs."""
    with open(UTHMANI_FILE, encoding="utf-8") as f:
        lines = [norm(l) for l in f]
    out = {}
    i = 0
    for s in surahs:
        for a in range(1, s["ayahs"] + 1):
            text = lines[i]
            if a == 1 and s["no"] not in (1, 9):
                for bas in (BASMALA_UTHMANI, BASMALA_UTHMANI_SHADDA):
                    if text.startswith(bas):
                        text = text[len(bas):].strip()
                        break
            out[(s["no"], a)] = text
            i += 1
    return out


def decode_features(basic, feats):
    """Decode a QAC feature string into structured fields."""
    d = dict(role="stem", pos=None, root=None, lemma=None, verb_form=None,
             aspect=None, mood=None, voice=None, case=None, state=None,
             person=None, gender=None, number=None, derivation=None,
             family=None)
    bare, keyed = [], {}
    for t in feats.split("|"):
        t = t.strip()
        if not t:
            continue
        if ":" in t:
            k, v = t.split(":", 1)
            keyed[k] = v
        else:
            bare.append(t)

    d["root"] = keyed.get("ROOT")
    d["lemma"] = keyed.get("LEM")
    d["family"] = keyed.get("FAM")
    if "VF" in keyed:
        d["verb_form"] = int(keyed["VF"])
    if "MOOD" in keyed:
        d["mood"] = keyed["MOOD"]

    if "PREF" in bare:
        d["role"] = "prefix"
    elif "SUFF" in bare:
        d["role"] = "suffix"

    consumed = {"PREF", "SUFF"}

    # NV (اسم فعل) segments carry verbal aspect too (e.g. هَلُمّ is imperative)
    aspect_ok = basic == "V" or "NV" in bare
    for t in bare:
        if t in ASPECTS and aspect_ok:
            d["aspect"] = t
            consumed.add(t)
        elif t == "PASS" and basic == "V":
            d["voice"] = "PASS"
            consumed.add(t)
        elif t in CASES and basic != "P":
            d["case"] = t
            consumed.add(t)
        elif t == "INDEF":
            d["state"] = "INDEF"
            consumed.add(t)
        elif t in DERIVATIONS:
            d["derivation"] = t
            consumed.add(t)

    if basic == "V" and d["voice"] is None:
        d["voice"] = "ACT"

    # fine part of speech
    pos = None
    for cand in POS_PRIORITY:
        if cand in bare:
            if cand == "ACC" and basic != "P":
                continue  # that was a case marker
            pos = cand
            consumed.add(cand)
            break
    if pos is None:
        if basic == "P":
            if "IMPV" in bare:
                pos = "IMPV_LAM"
                consumed.add("IMPV")
            else:
                pos = "P"
                consumed.add("P")
        else:
            pos = basic  # N or V
    d["pos"] = pos

    # person / gender / number from remaining tags like 3MS, MP, 1P, F, 3D
    for t in bare:
        if t in consumed:
            continue
        if t == "P" and basic == "P":
            continue
        m = PGN_RE.match(t)
        if m and any(m.groups()):
            p, g, n = m.groups()
            if p:
                d["person"] = int(p)
            if g:
                d["gender"] = g
            if n:
                d["number"] = n
    return d


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA = """
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

CREATE TABLE provenance (
    prov_id     INTEGER PRIMARY KEY,
    source      TEXT NOT NULL,
    version     TEXT,
    url         TEXT,
    license     TEXT,
    description TEXT
);

CREATE TABLE surah (
    surah_no      INTEGER PRIMARY KEY,          -- 1..114
    name_ar       TEXT NOT NULL,
    name_translit TEXT NOT NULL,
    name_en       TEXT NOT NULL,
    revelation    TEXT NOT NULL CHECK (revelation IN ('Meccan','Medinan')),
    chrono_order  INTEGER NOT NULL,             -- traditional revelation order
    ayah_count    INTEGER NOT NULL,
    ruku_count    INTEGER NOT NULL,
    has_bismillah INTEGER NOT NULL,             -- 1 except surah 9 (and 1: it IS ayah 1)
    word_count    INTEGER,                      -- filled after ingest
    letter_count  INTEGER
);

CREATE TABLE ayah (
    ayah_id      INTEGER PRIMARY KEY,           -- global 1..6236 (mushaf order)
    surah_no     INTEGER NOT NULL REFERENCES surah(surah_no),
    ayah_no      INTEGER NOT NULL,
    location     TEXT NOT NULL,                 -- 's:a'
    text_uthmani TEXT NOT NULL,
    text_clean   TEXT NOT NULL,
    juz          INTEGER NOT NULL,              -- 1..30
    hizb         INTEGER NOT NULL,              -- 1..60
    rub          INTEGER NOT NULL,              -- 1..240 (hizb quarter)
    ruku         INTEGER NOT NULL,              -- global ruku number
    page         INTEGER NOT NULL,              -- Madani mushaf page 1..604
    manzil       INTEGER NOT NULL,              -- 1..7
    sajda_type   TEXT,                          -- NULL | 'recommended' | 'obligatory'
    word_count   INTEGER NOT NULL,
    letter_count INTEGER NOT NULL,
    UNIQUE (surah_no, ayah_no)
);

CREATE TABLE root (
    root_id      INTEGER PRIMARY KEY,
    root_ar      TEXT NOT NULL UNIQUE,          -- e.g. 'رحم'
    letter_count INTEGER NOT NULL,
    occurrences  INTEGER NOT NULL DEFAULT 0     -- number of segments with this root
);

CREATE TABLE lemma (
    lemma_id    INTEGER PRIMARY KEY,
    lemma_ar    TEXT NOT NULL UNIQUE,           -- dictionary citation form
    root_id     INTEGER REFERENCES root(root_id),
    occurrences INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE word (
    word_id       INTEGER PRIMARY KEY,          -- global sequence 1..~77429
    ayah_id       INTEGER NOT NULL REFERENCES ayah(ayah_id),
    surah_no      INTEGER NOT NULL,
    ayah_no       INTEGER NOT NULL,
    word_no       INTEGER NOT NULL,             -- position within the ayah (1-based)
    location      TEXT NOT NULL UNIQUE,         -- 's:a:w'
    text_uthmani  TEXT NOT NULL,                -- concatenation of its segments
    text_clean    TEXT,                         -- aligned from quran-clean.txt
    root_id       INTEGER REFERENCES root(root_id),   -- root of the stem segment
    lemma_id      INTEGER REFERENCES lemma(lemma_id), -- lemma of the stem segment
    stem_pos      TEXT,                         -- fine POS of the stem segment
    segment_count INTEGER NOT NULL
);

CREATE TABLE segment (
    seg_id       INTEGER PRIMARY KEY,           -- global sequence
    word_id      INTEGER NOT NULL REFERENCES word(word_id),
    ayah_id      INTEGER NOT NULL REFERENCES ayah(ayah_id),
    seg_no       INTEGER NOT NULL,              -- position within the word (1-based)
    location     TEXT NOT NULL UNIQUE,          -- 's:a:w:g'
    text         TEXT NOT NULL,
    pos_basic    TEXT NOT NULL CHECK (pos_basic IN ('N','V','P')),
    role         TEXT NOT NULL CHECK (role IN ('prefix','stem','suffix')),
    pos          TEXT NOT NULL REFERENCES pos_tag(tag),
    root_id      INTEGER REFERENCES root(root_id),
    lemma_id     INTEGER REFERENCES lemma(lemma_id),
    verb_form    INTEGER,                       -- I..XII as 1..12
    aspect       TEXT,                          -- PERF | IMPF | IMPV
    mood         TEXT,                          -- IND | SUBJ | JUS
    voice        TEXT,                          -- ACT | PASS
    case_mark    TEXT,                          -- NOM | ACC | GEN
    state        TEXT,                          -- INDEF
    person       INTEGER,                       -- 1 | 2 | 3
    gender       TEXT,                          -- M | F
    number       TEXT,                          -- S | D | P
    derivation   TEXT,                          -- ACT_PCPL | PASS_PCPL | VN
    family       TEXT,                          -- FAM: special verb/particle family
    features_raw TEXT NOT NULL                  -- original QAC feature string
);

CREATE TABLE letter (
    letter_id   INTEGER PRIMARY KEY,
    word_id     INTEGER NOT NULL REFERENCES word(word_id),
    ayah_id     INTEGER NOT NULL REFERENCES ayah(ayah_id),
    surah_no    INTEGER NOT NULL,
    ayah_no     INTEGER NOT NULL,
    word_no     INTEGER NOT NULL,
    pos_in_word INTEGER NOT NULL,               -- 1-based
    letter      TEXT NOT NULL                   -- bare letter from clean text
);

CREATE TABLE pos_tag (
    tag      TEXT PRIMARY KEY,
    name_en  TEXT NOT NULL,
    name_ar  TEXT NOT NULL,
    category TEXT NOT NULL                      -- nominal|pronoun|adverb|verb|particle
);

CREATE TABLE feature_glossary (
    feature  TEXT PRIMARY KEY,                  -- e.g. 'aspect:PERF'
    name_en  TEXT NOT NULL,
    name_ar  TEXT NOT NULL
);
"""

INDEXES = """
CREATE INDEX idx_ayah_surah      ON ayah(surah_no, ayah_no);
CREATE INDEX idx_ayah_juz        ON ayah(juz);
CREATE INDEX idx_ayah_page       ON ayah(page);
CREATE INDEX idx_word_ayah       ON word(ayah_id);
CREATE INDEX idx_word_loc        ON word(surah_no, ayah_no, word_no);
CREATE INDEX idx_word_root       ON word(root_id);
CREATE INDEX idx_word_lemma      ON word(lemma_id);
CREATE INDEX idx_word_clean      ON word(text_clean);
CREATE INDEX idx_seg_word        ON segment(word_id);
CREATE INDEX idx_seg_ayah        ON segment(ayah_id);
CREATE INDEX idx_seg_root        ON segment(root_id);
CREATE INDEX idx_seg_lemma       ON segment(lemma_id);
CREATE INDEX idx_seg_pos         ON segment(pos);
CREATE INDEX idx_seg_aspect      ON segment(aspect) WHERE aspect IS NOT NULL;
CREATE INDEX idx_seg_vform       ON segment(verb_form) WHERE verb_form IS NOT NULL;
CREATE INDEX idx_lemma_root      ON lemma(root_id);
CREATE INDEX idx_letter_word     ON letter(word_id);
CREATE INDEX idx_letter_letter   ON letter(letter);
"""

VIEWS = """
-- Every word with its resolved root/lemma text and location context.
CREATE VIEW v_word AS
SELECT w.word_id, w.location, w.surah_no, w.ayah_no, w.word_no,
       w.text_uthmani, w.text_clean, r.root_ar, l.lemma_ar, w.stem_pos,
       s.name_ar AS surah_name, s.revelation, a.juz, a.page
FROM word w
JOIN ayah a  ON a.ayah_id = w.ayah_id
JOIN surah s ON s.surah_no = w.surah_no
LEFT JOIN root r  ON r.root_id = w.root_id
LEFT JOIN lemma l ON l.lemma_id = w.lemma_id;

-- Every segment fully decoded, with human-readable POS names.
CREATE VIEW v_segment AS
SELECT g.seg_id, g.location, g.text, g.role, g.pos,
       p.name_en AS pos_en, p.name_ar AS pos_ar, p.category,
       r.root_ar, l.lemma_ar, g.verb_form, g.aspect, g.mood, g.voice,
       g.case_mark, g.state, g.person, g.gender, g.number,
       g.derivation, g.family, g.features_raw,
       w.text_uthmani AS word_text, w.surah_no, w.ayah_no, w.word_no
FROM segment g
JOIN word w   ON w.word_id = g.word_id
JOIN pos_tag p ON p.tag = g.pos
LEFT JOIN root r  ON r.root_id = g.root_id
LEFT JOIN lemma l ON l.lemma_id = g.lemma_id;

-- Root frequency with number of distinct lemmas and surahs it appears in.
CREATE VIEW v_root_freq AS
SELECT r.root_id, r.root_ar, r.occurrences,
       COUNT(DISTINCT g.lemma_id) AS distinct_lemmas,
       COUNT(DISTINCT w.surah_no) AS surah_spread
FROM root r
JOIN segment g ON g.root_id = r.root_id
JOIN word w    ON w.word_id = g.word_id
GROUP BY r.root_id ORDER BY r.occurrences DESC;

CREATE VIEW v_lemma_freq AS
SELECT l.lemma_id, l.lemma_ar, r.root_ar, l.occurrences
FROM lemma l LEFT JOIN root r ON r.root_id = l.root_id
ORDER BY l.occurrences DESC;

-- Exact clean-word frequency.
CREATE VIEW v_word_freq AS
SELECT text_clean, COUNT(*) AS freq
FROM word WHERE text_clean IS NOT NULL
GROUP BY text_clean ORDER BY freq DESC;

CREATE VIEW v_letter_freq AS
SELECT letter, COUNT(*) AS freq FROM letter
GROUP BY letter ORDER BY freq DESC;

-- Per-surah statistics.
CREATE VIEW v_surah_stats AS
SELECT s.surah_no, s.name_ar, s.name_translit, s.revelation, s.chrono_order,
       s.ayah_count, s.word_count, s.letter_count,
       COUNT(DISTINCT g.root_id) AS distinct_roots,
       ROUND(1.0 * s.word_count / s.ayah_count, 2) AS avg_words_per_ayah
FROM surah s
JOIN word w ON w.surah_no = s.surah_no
LEFT JOIN segment g ON g.word_id = w.word_id AND g.root_id IS NOT NULL
GROUP BY s.surah_no;

-- All locations of every root (the "root map").
CREATE VIEW v_root_map AS
SELECT r.root_ar, g.location, w.text_uthmani AS word, w.text_clean,
       g.pos, g.derivation, g.verb_form, w.surah_no, w.ayah_no, w.word_no
FROM segment g
JOIN root r ON r.root_id = g.root_id
JOIN word w ON w.word_id = g.word_id;
"""


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build():
    for f in (MORPH_FILE, META_FILE, UTHMANI_FILE, CLEAN_FILE):
        if not os.path.exists(f):
            sys.exit(f"missing source file: {f}")
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    surahs, bounds, sajdas = parse_metadata()
    clean = parse_piped(CLEAN_FILE)
    uthmani = parse_uthmani(surahs)

    db = sqlite3.connect(DB_FILE)
    db.executescript(SCHEMA)

    db.executemany("INSERT INTO pos_tag VALUES (?,?,?,?)",
                   [(t, en, ar, cat) for t, (en, ar, cat) in POS_TAGS.items()])

    gloss = []
    for k, (en, ar) in ASPECTS.items():
        gloss.append((f"aspect:{k}", en, ar))
    for k, (en, ar) in MOODS.items():
        gloss.append((f"mood:{k}", en, ar))
    for k, (en, ar) in CASES.items():
        gloss.append((f"case:{k}", en, ar))
    for k, (en, ar) in DERIVATIONS.items():
        gloss.append((f"derivation:{k}", en, ar))
    gloss += [
        ("voice:ACT", "Active voice", "مبني للمعلوم"),
        ("voice:PASS", "Passive voice", "مبني للمجهول"),
        ("state:INDEF", "Indefinite", "نكرة"),
        ("role:prefix", "Prefix", "سابقة"),
        ("role:stem", "Stem", "جذع الكلمة"),
        ("role:suffix", "Suffix", "لاحقة"),
        ("person:1", "First person", "متكلم"),
        ("person:2", "Second person", "مخاطب"),
        ("person:3", "Third person", "غائب"),
        ("gender:M", "Masculine", "مذكر"),
        ("gender:F", "Feminine", "مؤنث"),
        ("number:S", "Singular", "مفرد"),
        ("number:D", "Dual", "مثنى"),
        ("number:P", "Plural", "جمع"),
        ("family:إِنّ", "Inna and its sisters", "إنّ وأخواتها"),
        ("family:كَان", "Kana and its sisters", "كان وأخواتها"),
        ("family:كَاد", "Kada and its sisters", "كاد وأخواتها"),
    ]
    VERB_FORM_PATTERNS = [
        (1, "Form I", "فَعَلَ"), (2, "Form II", "فَعَّلَ"), (3, "Form III", "فَاعَلَ"),
        (4, "Form IV", "أَفْعَلَ"), (5, "Form V", "تَفَعَّلَ"), (6, "Form VI", "تَفَاعَلَ"),
        (7, "Form VII", "اِنْفَعَلَ"), (8, "Form VIII", "اِفْتَعَلَ"),
        (9, "Form IX", "اِفْعَلَّ"), (10, "Form X", "اِسْتَفْعَلَ"),
        (11, "Form XI", "اِفْعَالَّ"), (12, "Form XII", "اِفْعَوْعَلَ"),
    ]
    gloss += [(f"verb_form:{n}", en, ar) for n, en, ar in VERB_FORM_PATTERNS]
    db.executemany("INSERT INTO feature_glossary VALUES (?,?,?)", gloss)

    db.executemany(
        "INSERT INTO provenance (source, version, url, license, description) "
        "VALUES (?,?,?,?,?)",
        [("Quranic Arabic Corpus (Arabic-script edition)", "0.4",
          "https://github.com/mustafa0x/quran-morphology",
          "GNU GPL (corpus.quran.com)",
          "Morphological segmentation, POS, roots, lemmas, grammatical features"),
         ("Tanzil Quran metadata", "1.0", "https://tanzil.net/docs/quran_metadata",
          "CC BY 3.0", "Surah names/types, juz, hizb quarters, rukus, pages, manzils, sajdas"),
         ("Tanzil Quran text (Uthmani)", "1.1", "https://tanzil.net/download",
          "CC BY 3.0", "Uthmani ayah text"),
         ("quran-clean.txt (project source)", None, None, None,
          "Simple clean ayah text, surah|ayah|text")])

    # --- surahs & ayahs -----------------------------------------------------
    def boundary_lookup(key):
        """returns fn(s, a) -> index of the latest boundary <= (s, a)"""
        blist = bounds[key]

        def fn(s, a):
            lo = 0
            for idx, bs, ba in blist:
                if (bs, ba) <= (s, a):
                    lo = idx
                else:
                    break
            return lo
        return fn

    juz_of, rub_of = boundary_lookup("juz"), boundary_lookup("rub")
    manzil_of, ruku_of = boundary_lookup("manzil"), boundary_lookup("ruku")
    page_of = boundary_lookup("page")

    ayah_rows, ayah_id_of = [], {}
    aid = 0
    for s in surahs:
        for a in range(1, s["ayahs"] + 1):
            aid += 1
            ayah_id_of[(s["no"], a)] = aid
            ct = clean[(s["no"], a)]
            rub = rub_of(s["no"], a)
            ayah_rows.append((
                aid, s["no"], a, f"{s['no']}:{a}", uthmani[(s["no"], a)], ct,
                juz_of(s["no"], a), (rub - 1) // 4 + 1, rub,
                ruku_of(s["no"], a), page_of(s["no"], a), manzil_of(s["no"], a),
                sajdas.get((s["no"], a)),
                len(ct.split()), sum(1 for c in ct if ARABIC_LETTER_RE.match(c))))

    db.executemany("INSERT INTO surah (surah_no,name_ar,name_translit,name_en,"
                   "revelation,chrono_order,ayah_count,ruku_count,has_bismillah)"
                   " VALUES (?,?,?,?,?,?,?,?,?)",
                   [(s["no"], s["name_ar"], s["name_translit"], s["name_en"],
                     s["revelation"], s["chrono"], s["ayahs"], s["rukus"],
                     0 if s["no"] == 9 else 1) for s in surahs])
    db.executemany("INSERT INTO ayah VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   ayah_rows)

    # --- morphology: words & segments --------------------------------------
    roots, lemmas = {}, {}          # text -> id
    lemma_root_votes = defaultdict(lambda: defaultdict(int))

    def root_id(text):
        if text is None:
            return None
        if text not in roots:
            roots[text] = len(roots) + 1
        return roots[text]

    def lemma_id(text):
        if text is None:
            return None
        if text not in lemmas:
            lemmas[text] = len(lemmas) + 1
        return lemmas[text]

    words = {}                      # (s,a,w) -> word accumulator
    word_order = []
    seg_rows = []

    with open(MORPH_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            loc, text, basic, feats = line.split("\t")
            s, a, w, g = (int(x) for x in loc.split(":"))
            d = decode_features(basic, feats)
            key = (s, a, w)
            if key not in words:
                words[key] = dict(segs=[], root=None, lemma=None, stem_pos=None)
                word_order.append(key)
            acc = words[key]
            acc["segs"].append(norm(text))
            rid, lid = root_id(d["root"]), lemma_id(d["lemma"])
            if rid and lid:
                lemma_root_votes[lid][rid] += 1
            if d["role"] == "stem" and acc["stem_pos"] is None:
                acc["root"], acc["lemma"], acc["stem_pos"] = rid, lid, d["pos"]
            seg_rows.append((s, a, w, g, norm(text), basic, d, rid, lid, feats))

    # word rows, with clean-text alignment
    word_rows, word_id_of = [], {}
    misaligned_ayahs = set()
    clean_words = {k: v.split() for k, v in clean.items()}
    by_ayah = defaultdict(list)
    for key in word_order:
        by_ayah[(key[0], key[1])].append(key)

    wid = 0
    for key in word_order:
        wid += 1
        word_id_of[key] = wid
        s, a, w = key
        acc = words[key]
        cw = align_clean(clean_words.get((s, a), []), len(by_ayah[(s, a)]))
        if cw is None:
            misaligned_ayahs.add((s, a))
        word_rows.append((
            wid, ayah_id_of[(s, a)], s, a, w, f"{s}:{a}:{w}",
            "".join(acc["segs"]), cw[w - 1] if cw else None,
            acc["root"], acc["lemma"], acc["stem_pos"], len(acc["segs"])))

    db.executemany("INSERT INTO root (root_id, root_ar, letter_count) VALUES (?,?,?)",
                   [(i, t, len(t)) for t, i in roots.items()])
    db.executemany("INSERT INTO lemma (lemma_id, lemma_ar, root_id) VALUES (?,?,?)",
                   [(i, t,
                     max(lemma_root_votes[i].items(), key=lambda kv: kv[1])[0]
                     if lemma_root_votes.get(i) else None)
                    for t, i in lemmas.items()])
    db.executemany("INSERT INTO word VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", word_rows)

    seg_insert = []
    for i, (s, a, w, g, text, basic, d, rid, lid, feats) in enumerate(seg_rows, 1):
        seg_insert.append((
            i, word_id_of[(s, a, w)], ayah_id_of[(s, a)], g, f"{s}:{a}:{w}:{g}",
            text, basic, d["role"], d["pos"], rid, lid, d["verb_form"],
            d["aspect"], d["mood"], d["voice"], d["case"], d["state"],
            d["person"], d["gender"], d["number"], d["derivation"], d["family"],
            feats))
    db.executemany("INSERT INTO segment VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   seg_insert)

    # --- letters (from clean text) ------------------------------------------
    letter_rows = []
    lid_ = 0
    for key in word_order:
        s, a, w = key
        row = word_rows[word_id_of[key] - 1]
        text_clean = row[7]
        if text_clean is None:
            continue
        for j, ch in enumerate(text_clean, 1):
            if ARABIC_LETTER_RE.match(ch):
                lid_ += 1
                letter_rows.append((lid_, word_id_of[key], ayah_id_of[(s, a)],
                                    s, a, w, j, ch))
    db.executemany("INSERT INTO letter VALUES (?,?,?,?,?,?,?,?)", letter_rows)

    # --- aggregates (indexes first — the correlated updates need them) ------
    db.executescript(INDEXES)
    db.executescript("""
        UPDATE root SET occurrences =
            (SELECT COUNT(*) FROM segment WHERE segment.root_id = root.root_id);
        UPDATE lemma SET occurrences =
            (SELECT COUNT(*) FROM segment WHERE segment.lemma_id = lemma.lemma_id);
        -- One tokenization everywhere: ayah.word_count = QAC words (same as
        -- the word table and surah.word_count), not clean-text whitespace.
        UPDATE ayah SET word_count =
            (SELECT COUNT(*) FROM word WHERE word.ayah_id = ayah.ayah_id);
        UPDATE surah SET
            word_count   = (SELECT COUNT(*) FROM word  WHERE word.surah_no = surah.surah_no),
            letter_count = (SELECT SUM(letter_count) FROM ayah WHERE ayah.surah_no = surah.surah_no);
    """)

    db.executescript(VIEWS)
    db.commit()

    # --- validation ----------------------------------------------------------
    q = lambda sql: db.execute(sql).fetchone()[0]
    checks = [
        ("surahs", q("SELECT COUNT(*) FROM surah"), 114),
        ("ayahs", q("SELECT COUNT(*) FROM ayah"), 6236),
        ("words", q("SELECT COUNT(*) FROM word"), None),
        ("segments", q("SELECT COUNT(*) FROM segment"), None),
        ("letters", q("SELECT COUNT(*) FROM letter"), None),
        ("roots", q("SELECT COUNT(*) FROM root"), None),
        ("lemmas", q("SELECT COUNT(*) FROM lemma"), None),
        ("words without clean alignment",
         q("SELECT COUNT(*) FROM word WHERE text_clean IS NULL"), None),
        ("segments with unknown POS",
         q("SELECT COUNT(*) FROM segment g LEFT JOIN pos_tag p ON p.tag=g.pos "
           "WHERE p.tag IS NULL"), 0),
        ("words with >1 stem segment",
         q("SELECT COUNT(*) FROM (SELECT word_id FROM segment WHERE role='stem' "
           "GROUP BY word_id HAVING COUNT(*)>1)"), None),
        ("orphan segments",
         q("SELECT COUNT(*) FROM segment g LEFT JOIN word w ON w.word_id=g.word_id "
           "WHERE w.word_id IS NULL"), 0),
        ("ayahs with 0 words",
         q("SELECT COUNT(*) FROM ayah a LEFT JOIN word w ON w.ayah_id=a.ayah_id "
           "WHERE w.word_id IS NULL"), 0),
    ]
    print("=== QKG build report ===")
    ok = True
    for name, got, want in checks:
        status = ""
        if want is not None:
            good = got == want
            ok = ok and good
            status = "OK" if good else f"EXPECTED {want} — FAIL"
        print(f"  {name:38s} {got:>8,}  {status}")
    print(f"  misaligned ayahs (uthmani vs clean word count): {len(misaligned_ayahs)}")
    if misaligned_ayahs:
        sample = sorted(misaligned_ayahs)[:10]
        print(f"    e.g. {', '.join(f'{s}:{a}' for s, a in sample)}")
    db.execute("ANALYZE")
    db.commit()
    db.close()
    size_mb = os.path.getsize(DB_FILE) / 1e6
    print(f"\nwrote {DB_FILE} ({size_mb:.1f} MB)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(build())
