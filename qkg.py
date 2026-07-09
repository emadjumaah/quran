#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qkg — quick command-line explorer for quran-kg.db

Usage:
  python3 qkg.py root رحم          # every lemma of a root + where it appears
  python3 qkg.py word 2:255:5      # full morphology of one word (s:a:w)
  python3 qkg.py ayah 1:5          # ayah text + grammatical trace
  python3 qkg.py find وجد          # find words containing a string (clean text)
  python3 qkg.py stats             # global statistics
"""

import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "quran-kg.db")


def rows(db, sql, *params):
    return db.execute(sql, params).fetchall()


def cmd_root(db, root):
    hits = rows(db, """
        SELECT l.lemma_ar, l.occurrences FROM lemma l
        JOIN root r ON r.root_id = l.root_id WHERE r.root_ar = ?
        ORDER BY l.occurrences DESC""", root)
    if not hits:
        print(f"root '{root}' not found")
        return
    total = rows(db, "SELECT occurrences FROM root WHERE root_ar = ?", root)[0][0]
    print(f"root {root} — {total} occurrences, {len(hits)} lemmas\n")
    for lemma, n in hits:
        print(f"  {lemma:<20} {n:>5}×")
    print("\nfirst 15 locations:")
    for loc, word in rows(db, """
        SELECT g.location, w.text_uthmani FROM segment g
        JOIN root r ON r.root_id = g.root_id AND r.root_ar = ?
        JOIN word w ON w.word_id = g.word_id
        ORDER BY g.seg_id LIMIT 15""", root):
        print(f"  {loc:<12} {word}")


def cmd_word(db, loc):
    s, a, w = (int(x) for x in loc.split(":"))
    segs = rows(db, """
        SELECT text, role, pos_ar, pos_en, root_ar, lemma_ar, aspect, mood,
               voice, case_mark, person, gender, number, verb_form, features_raw
        FROM v_segment WHERE surah_no=? AND ayah_no=? AND word_no=?
        ORDER BY seg_id""", s, a, w)
    if not segs:
        print(f"word {loc} not found")
        return
    word = rows(db, "SELECT text_uthmani, text_clean FROM word WHERE location=?",
                f"{s}:{a}:{w}")[0]
    print(f"word {loc}: {word[0]}  (clean: {word[1]})\n")
    for t in segs:
        (text, role, pos_ar, pos_en, root, lemma, aspect, mood, voice,
         case, person, gender, number, vf, raw) = t
        parts = [f"[{role}] {text} — {pos_ar} ({pos_en})"]
        if root:
            parts.append(f"root {root}")
        if lemma:
            parts.append(f"lemma {lemma}")
        for label, v in (("form", f"{vf}" if vf else None), ("aspect", aspect),
                         ("mood", mood), ("voice", voice), ("case", case)):
            if v:
                parts.append(f"{label} {v}")
        pgn = "".join(str(x) for x in (person, gender, number) if x)
        if pgn:
            parts.append(f"pgn {pgn}")
        print("  " + " | ".join(parts))
        print(f"      raw: {raw}")


def cmd_ayah(db, loc):
    s, a = (int(x) for x in loc.split(":"))
    meta = rows(db, """
        SELECT text_uthmani, text_clean, juz, hizb, page, word_count
        FROM ayah WHERE surah_no=? AND ayah_no=?""", s, a)
    if not meta:
        print(f"ayah {loc} not found")
        return
    ut, cl, juz, hizb, page, wc = meta[0]
    print(f"{loc}  (juz {juz}, hizb {hizb}, page {page}, {wc} words)\n")
    print(f"  {ut}\n")
    has_tr = rows(db, "SELECT COUNT(*) FROM sqlite_master WHERE name='translation'")[0][0]
    if has_tr:
        for (tr,) in rows(db, """
            SELECT t.text FROM translation t
            JOIN ayah a2 ON a2.ayah_id = t.ayah_id
            WHERE a2.surah_no=? AND a2.ayah_no=?""", s, a):
            print(f"  {tr}\n")
    for wno, text, root, lemma, pos in rows(db, """
        SELECT w.word_no, w.text_uthmani, r.root_ar, l.lemma_ar, w.stem_pos
        FROM word w
        LEFT JOIN root r ON r.root_id = w.root_id
        LEFT JOIN lemma l ON l.lemma_id = w.lemma_id
        WHERE w.surah_no=? AND w.ayah_no=? ORDER BY w.word_no""", s, a):
        print(f"  {wno:>2}. {text:<20} root:{root or '—':<8} "
              f"lemma:{lemma or '—':<16} pos:{pos or '—'}")


def cmd_find(db, needle):
    hits = rows(db, """
        SELECT location, text_clean, root_ar, lemma_ar FROM v_word
        WHERE text_clean LIKE '%' || ? || '%' LIMIT 40""", needle)
    print(f"{len(hits)} matches (max 40 shown)")
    for loc, text, root, lemma in hits:
        print(f"  {loc:<12} {text:<20} root:{root or '—':<8} lemma:{lemma or '—'}")


def cmd_stats(db):
    for label, sql in [
            ("surahs", "SELECT COUNT(*) FROM surah"),
            ("ayahs", "SELECT COUNT(*) FROM ayah"),
            ("words", "SELECT COUNT(*) FROM word"),
            ("segments", "SELECT COUNT(*) FROM segment"),
            ("letters", "SELECT COUNT(*) FROM letter"),
            ("distinct roots", "SELECT COUNT(*) FROM root"),
            ("distinct lemmas", "SELECT COUNT(*) FROM lemma"),
            ("distinct clean words", "SELECT COUNT(DISTINCT text_clean) FROM word")]:
        print(f"  {label:<22} {rows(db, sql)[0][0]:>8,}")
    print("\ntop 10 roots:")
    for root, n, lemmas, spread in rows(
            db, "SELECT root_ar, occurrences, distinct_lemmas, surah_spread "
                "FROM v_root_freq LIMIT 10"):
        print(f"  {root:<8} {n:>6}×  ({lemmas} lemmas, in {spread} surahs)")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in (
            "root", "word", "ayah", "find", "stats"):
        print(__doc__)
        return 1
    db = sqlite3.connect(DB)
    cmd = sys.argv[1]
    if cmd == "stats":
        cmd_stats(db)
    else:
        if len(sys.argv) < 3:
            print(__doc__)
            return 1
        {"root": cmd_root, "word": cmd_word,
         "ayah": cmd_ayah, "find": cmd_find}[cmd](db, sys.argv[2])
    return 0


if __name__ == "__main__":
    sys.exit(main())
