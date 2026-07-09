#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add a translation layer to quran-kg.db — demonstrates schema-free enrichment:
new knowledge attaches to existing stable IDs (ayah_id), no redesign.

Downloads a Tanzil translation (default: Saheeh International, English) and
creates/updates the `translation` table:

    translation(ayah_id, lang, source_key, text)

Usage:
  python3 add_translation.py                 # en.sahih (Saheeh International)
  python3 add_translation.py fr.hamidullah   # any Tanzil translation key

Translation keys and licenses: https://tanzil.net/trans/
Tanzil translations are free to use with attribution (see each key's page).
"""

import os
import sqlite3
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(HERE, "quran-kg.db")

NAMES = {
    "en.sahih": ("en", "Saheeh International"),
    "fr.hamidullah": ("fr", "Muhammad Hamidullah"),
    "tr.diyanet": ("tr", "Diyanet İşleri"),
}


def main():
    key = sys.argv[1] if len(sys.argv) > 1 else "en.sahih"
    lang = key.split(".", 1)[0]
    url = f"https://tanzil.net/trans/{key}"
    print(f"downloading {url} ...")
    raw = urllib.request.urlopen(url, timeout=60).read().decode("utf-8")

    rows = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|", 2)
        if len(parts) != 3 or not parts[0].isdigit():
            continue
        rows.append((int(parts[0]), int(parts[1]), parts[2]))
    if len(rows) != 6236:
        sys.exit(f"expected 6236 ayah lines, got {len(rows)} — aborting")

    db = sqlite3.connect(DB_FILE)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS translation (
            ayah_id    INTEGER NOT NULL REFERENCES ayah(ayah_id),
            lang       TEXT NOT NULL,
            source_key TEXT NOT NULL,
            text       TEXT NOT NULL,
            PRIMARY KEY (ayah_id, source_key)
        );
        CREATE INDEX IF NOT EXISTS idx_translation_lang ON translation(lang);
    """)
    ayah_ids = {(s, a): i for i, s, a in
                db.execute("SELECT ayah_id, surah_no, ayah_no FROM ayah")}
    db.executemany(
        "INSERT OR REPLACE INTO translation VALUES (?,?,?,?)",
        [(ayah_ids[(s, a)], lang, key, text) for s, a, text in rows])
    name = NAMES.get(key, (lang, key))[1]
    db.execute(
        "INSERT INTO provenance (source, version, url, license, description) "
        "SELECT ?, NULL, ?, 'see tanzil.net/trans', ? "
        "WHERE NOT EXISTS (SELECT 1 FROM provenance WHERE url = ?)",
        (f"Tanzil translation: {name}", url, f"Ayah translation layer ({key})", url))
    db.commit()
    n = db.execute("SELECT COUNT(*) FROM translation WHERE source_key = ?", (key,)).fetchone()[0]
    db.close()
    print(f"added {n} ayah translations for {key} ({name})")


if __name__ == "__main__":
    main()
