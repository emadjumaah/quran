#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add classical Arabic word-meanings to quran-kg.db — the معاجم layer.

Attaches, per root, entries from four respected classical lexicons
(public-domain texts, Shamela editions, via github.com/wizsk/arabic_lexicons):

  mufradat  المفردات في غريب القرآن — الراغب الأصفهاني   (Quran-specific)
  maqayis   مقاييس اللغة — ابن فارس                       (semantic essence)
  sihah     الصحاح — الجوهري
  lisan     لسان العرب — ابن منظور                        (fullest)

Creates:  root_meaning(root_id, source_key, matched_root, text)

Weak-root normalization: lexicons key final-weak roots as صلا/صلى where the
Quranic corpus uses صلو — a candidate ladder (و/ي → ا/ى, hamza folding)
resolves the match; strong roots match exactly.

Usage:
  python3 add_meanings.py [path/to/lexicons/db.sqlite]
  (default path: the session scratchpad copy; else downloads the 48 MB zip)
"""

import io
import os
import sqlite3
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(HERE, "quran-kg.db")
DEFAULT_LEX = (
    "/private/tmp/claude-503/-Volumes-data-new-projects-quran/"
    "762c865b-b6d5-4d4f-8fad-46cbaa8a28f2/scratchpad/lexicons/db.sqlite"
)
LEX_URL = "https://raw.githubusercontent.com/wizsk/arabic_lexicons/main/assets/data/db/db.sqlite.zip"

SOURCES = [
    # key, table, Arabic title (author), order shown in apps
    ("mufradat", "mufradat_alfajul_quran", "المفردات في غريب القرآن — الراغب الأصفهاني"),
    ("maqayis", "maqayeesul_luga", "مقاييس اللغة — ابن فارس"),
    ("sihah", "mujamul_shihah", "الصحاح — الجوهري"),
    ("lisan", "lisanularab", "لسان العرب — ابن منظور"),
]


def get_lexicon_db() -> str:
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        return sys.argv[1]
    if os.path.exists(DEFAULT_LEX):
        return DEFAULT_LEX
    local = os.path.join(HERE, "data", "lexicons.sqlite")
    if not os.path.exists(local):
        print(f"downloading lexicons ({LEX_URL}) …")
        raw = urllib.request.urlopen(LEX_URL, timeout=300).read()
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            name = next(n for n in z.namelist() if n.endswith(".sqlite"))
            with open(local, "wb") as f:
                f.write(z.read(name))
    return local


def strip_harakat(s: str) -> str:
    return "".join(c for c in s if not ("ً" <= c <= "ْ" or c == "ٰ"))


def candidates(root: str):
    """Spelling variants a lexicon may use for this Quranic-corpus root."""
    seen, out = set(), []

    def add(r):
        if r and r not in seen:
            seen.add(r)
            out.append(r)

    add(root)
    folded = root.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    add(folded)
    for base in (root, folded):
        if base[-1] in "وي":
            add(base[:-1] + "ا")
            add(base[:-1] + "ى")
            add(base[:-1] + base[-1])  # no-op, keeps order stable
        if base.endswith("ء"):
            add(base[:-1] + "أ")
    # doubled roots sometimes keyed with shadda collapsed: ربب -> رب
    if len(root) == 3 and root[1] == root[2]:
        add(root[:2])
    return out


def main():
    lex_path = get_lexicon_db()
    lex = sqlite3.connect(f"file:{lex_path}?mode=ro", uri=True)
    kg = sqlite3.connect(DB_FILE)

    kg.executescript("""
        CREATE TABLE IF NOT EXISTS root_meaning (
            root_id      INTEGER NOT NULL REFERENCES root(root_id),
            source_key   TEXT NOT NULL,
            matched_root TEXT NOT NULL,   -- the lexicon's spelling of the root
            text         TEXT NOT NULL,
            PRIMARY KEY (root_id, source_key)
        );
    """)

    roots = kg.execute("SELECT root_id, root_ar FROM root").fetchall()
    report = {}
    for key, table, title in SOURCES:
        index = {}
        for word, meanings in lex.execute(f"SELECT word, meanings FROM {table}"):
            w = strip_harakat((word or "").strip())
            if w and meanings and w not in index:
                index[w] = meanings.strip()
        hits = 0
        rows = []
        for root_id, root_ar in roots:
            for cand in candidates(root_ar):
                text = index.get(cand)
                if text:
                    rows.append((root_id, key, cand, text))
                    hits += 1
                    break
        kg.executemany("INSERT OR REPLACE INTO root_meaning VALUES (?,?,?,?)", rows)
        report[key] = (hits, len(roots), title)

    kg.execute(
        "INSERT INTO provenance (source, version, url, license, description) "
        "SELECT ?, NULL, ?, 'public domain (classical texts, Shamela editions)', ? "
        "WHERE NOT EXISTS (SELECT 1 FROM provenance WHERE url = ?)",
        ("Classical Arabic lexicons (Mufradat, Maqayis, Sihah, Lisan)",
         "https://github.com/wizsk/arabic_lexicons",
         "root_meaning table: word meanings per root from classical dictionaries",
         "https://github.com/wizsk/arabic_lexicons"))
    kg.commit()

    print("=== root meanings coverage ===")
    for key, (hits, total, title) in report.items():
        print(f"  {key:10s} {hits:>5}/{total}  {title}")
    kg.close()
    lex.close()


if __name__ == "__main__":
    main()
