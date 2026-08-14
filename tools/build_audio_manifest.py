#!/usr/bin/env python3
"""مانيفستُ التلاوة — **محسوبٌ من الملفّات نفسِها**، لا مقدَّرٌ ولا منقول.

    python3 tools/build_audio_manifest.py                       # القارئان معاً
    python3 tools/build_audio_manifest.py --reciter Husary_64kbps
    python3 tools/build_audio_manifest.py --verify               # مطابقةٌ بلا كتابة

## ما يُخرِج

1. `js/data/sawt/audio-manifest.json` — بطاقةُ المستودع للتطبيق: موضعُ الاستضافة
   ونمطُ الاسم، ومجاميعُ **بالجزء وبالسورة وبالصفحة** (عددُ الملفّات وبايتاتُها)
   — **فيعرف القارئُ حجمَ ما سيُنزّله قبل أن يبدأ**.
2. `js/data/sawt/audio-files.<القارئ>.tsv` — سجلُّ كلِّ ملفّ: `سورة:آية ⇥ بايت ⇥
   sha256`. وبه تُقابَل التجزئةُ بعد التنزيل، **وما خالف يُرفض ويُعاد**.

## مصادرُ الحدود — منقولةٌ لا مخترَعة

حدودُ الأجزاء والصفحات وأسماءُ السور من `data/quran-data.xml` (تنزيل · CC BY 3.0)،
ومفاتيحُ الآيات من العمود الأوّل من `build/ipa/quran-ayat.tsv` — **العمودُ الأوّل
وحدَه**؛ فالعمودُ الثالث رسمٌ صوتيٌّ رخصتُه موقوفة (`CREDITS.md §٢`) ولا يُقرأ هنا.
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
OUT = ROOT / "js" / "data" / "sawt"

REPO = "emadjumaah/mishkat-quran-audio"
BASE = f"https://huggingface.co/datasets/{REPO}/resolve/main/"

RECITERS = {
    "Husary_Muallim_128kbps": {
        "ar": "محمود خليل الحصري — مصحفُ المعلّم",
        "en": "Mahmoud Khalil al-Husary — Mu'allim (teaching) mushaf",
        "use_ar": "التلقين — بطيءٌ بيّنٌ وسكتاتُ الترديد محفوظة",
        "use_en": "Teaching/repetition: deliberate pace, pauses preserved",
        "kbps": 128,
    },
    "Husary_64kbps": {
        "ar": "محمود خليل الحصري — المرتَّل",
        "en": "Mahmoud Khalil al-Husary — murattal",
        "use_ar": "المعايرة — أنظفُ محاذاةً، ولا يُعايَر طالبٌ بإيقاعٍ أُبطئ للتعليم",
        "use_en": "Calibration: cleanest alignment; a learner is not measured against a slowed teaching pace",
        "kbps": 64,
    },
}


def ayah_keys():
    """٦٢٣٦ مفتاحاً — العمودُ الأوّل وحدَه من `quran-ayat.tsv`."""
    src = ROOT / "build" / "ipa" / "quran-ayat.tsv"
    if not src.exists():
        sys.exit("✗ build/ipa/quran-ayat.tsv مفقود")
    out = []
    for ln in src.read_text(encoding="utf-8").splitlines():
        if ln.strip():
            s, a = ln.split("\t")[0].split(":")
            out.append((int(s), int(a)))
    return out


def structure():
    """حدودُ الأجزاء والصفحات وأسماءُ السور — من `data/quran-data.xml` (تنزيل)."""
    xml = (ROOT / "data" / "quran-data.xml").read_text(encoding="utf-8")

    def marks(tag):
        return [(int(i), int(s), int(a)) for i, s, a in re.findall(
            rf'<{tag} index="(\d+)" sura="(\d+)" aya="(\d+)"', xml)]

    suras = {int(m[0]): {"ar": m[1], "en": m[2]} for m in re.findall(
        r'<sura index="(\d+)"[^>]*?name="([^"]+)" tname="([^"]+)"', xml)}
    return marks("juz"), marks("page"), suras


def bucket(keys, marks):
    """يُسند كلَّ مفتاحِ آيةٍ إلى وحدته (جزءٍ أو صفحة) بحدودها المنقولة."""
    order = {k: i for i, k in enumerate(keys)}
    starts = sorted(((order[(s, a)], n) for n, s, a in marks if (s, a) in order))
    out = {}
    for pos, (idx, n) in enumerate(starts):
        end = starts[pos + 1][0] if pos + 1 < len(starts) else len(keys)
        for k in keys[idx:end]:
            out[k] = n
    return out


def digest(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def scan(reciter, keys):
    """يقرأ كلَّ ملفٍّ فيُخرج (حجمَه وتجزئتَه) — والمفقودُ يُقيَّد ولا يُسكَت عنه."""
    d = AUDIO / reciter
    rows, missing = {}, []
    for s, a in keys:
        p = d / f"{s:03d}{a:03d}.mp3"
        if not p.exists():
            missing.append((s, a))
            continue
        rows[(s, a)] = (p.stat().st_size, digest(p))
    return rows, missing


def totals(keys, rows, unit_of):
    """مجاميعُ الوحدات — عددُ الملفّات وبايتاتُها ومداها من الآيات."""
    agg = {}
    for k in keys:
        n = unit_of.get(k)
        if n is None:
            continue
        e = agg.setdefault(n, {"n": n, "from": f"{k[0]}:{k[1]}", "to": f"{k[0]}:{k[1]}",
                               "ayat": 0, "files": 0, "bytes": 0})
        e["to"] = f"{k[0]}:{k[1]}"
        e["ayat"] += 1
        if k in rows:
            e["files"] += 1
            e["bytes"] += rows[k][0]
    return [agg[n] for n in sorted(agg)]


def surah_totals(keys, rows, suras):
    agg = {}
    for s, a in keys:
        e = agg.setdefault(s, {"n": s, "ar": suras.get(s, {}).get("ar", ""),
                               "en": suras.get(s, {}).get("en", ""),
                               "ayat": 0, "files": 0, "bytes": 0})
        e["ayat"] += 1
        if (s, a) in rows:
            e["files"] += 1
            e["bytes"] += rows[(s, a)][0]
    return [agg[s] for s in sorted(agg)]


def main():
    ap = argparse.ArgumentParser(description="بناءُ مانيفست التلاوة من الملفّات")
    ap.add_argument("--reciter", action="append", help="يُكرَّر؛ وإلّا فالقارئان معاً")
    ap.add_argument("--verify", action="store_true",
                    help="يقابل المانيفستَ المكتوبَ بالملفّات ولا يكتب شيئاً")
    a = ap.parse_args()

    keys = ayah_keys()
    juz_marks, page_marks, suras = structure()
    juz_of, page_of = bucket(keys, juz_marks), bucket(keys, page_marks)
    want = a.reciter or [r for r in RECITERS if (AUDIO / r).is_dir()]
    if not want:
        sys.exit("✗ لا مجلّدَ قارئٍ في audio/ — شغّل tools/fetch_recitation.py أوّلاً")

    if a.verify:
        bad = 0
        for reciter in want:
            tsv = OUT / f"audio-files.{reciter}.tsv"
            if not tsv.exists():
                print(f"✗ {reciter}: لا سجلَّ ملفّاتٍ مكتوباً")
                bad += 1
                continue
            n_ok = n_bad = n_gone = 0
            for ln in tsv.read_text(encoding="utf-8").splitlines()[1:]:
                key, size, sha = ln.split("\t")
                s, y = (int(x) for x in key.split(":"))
                p = AUDIO / reciter / f"{s:03d}{y:03d}.mp3"
                if not p.exists():
                    n_gone += 1
                elif p.stat().st_size == int(size) and digest(p) == sha:
                    n_ok += 1
                else:
                    n_bad += 1
                    print(f"  ✗ {reciter} {key}: خالف المانيفست")
            print(f"{reciter}: ✓ {n_ok} مطابق · ✗ {n_bad} مخالف · {n_gone} مفقود")
            bad += n_bad
        return 1 if bad else 0

    OUT.mkdir(parents=True, exist_ok=True)
    man = {
        "tag": "مولَّد",
        "generated": date.today().isoformat(),
        "by": "tools/build_audio_manifest.py",
        "note": "الأحجامُ والتجزئاتُ محسوبةٌ من الملفّات نفسِها لا مقدَّرة.",
        "host": {"kind": "huggingface-dataset", "repo": REPO, "base": BASE},
        "path": "{reciter}/{sura:03}{ayah:03}.mp3",
        "attribution": {
            "timings": "quran-align — Collin Fair — CC BY 4.0 — github.com/cpfair/quran-align",
            "recitation": "محمود خليل الحصري — عبر everyayah.com",
            "structure": "تنزيل (Tanzil) — CC BY 3.0 — حدودُ الأجزاء والصفحات وأسماءُ السور",
        },
        "ayat": len(keys),
        "reciters": {},
    }

    for reciter in want:
        meta = dict(RECITERS.get(reciter, {}))
        rows, missing = scan(reciter, keys)
        lines = ["key\tbytes\tsha256"]
        lines += [f"{s}:{a}\t{rows[(s, a)][0]}\t{rows[(s, a)][1]}"
                  for s, a in keys if (s, a) in rows]
        tsv = OUT / f"audio-files.{reciter}.tsv"
        tsv.write_text("\n".join(lines) + "\n", encoding="utf-8")

        meta.update({
            "files": len(rows),
            "missing": len(missing),
            "bytes": sum(v[0] for v in rows.values()),
            "records": f"audio-files.{reciter}.tsv",
            "recordsSha256": digest(tsv),
            "juz": totals(keys, rows, juz_of),
            "surah": surah_totals(keys, rows, suras),
            "page": totals(keys, rows, page_of),
        })
        if missing:
            meta["missingKeys"] = [f"{s}:{a}" for s, a in missing[:50]]
        man["reciters"][reciter] = meta
        mb = meta["bytes"] / 1024 ** 2
        print(f"{reciter}: {len(rows)}/{len(keys)} ملفّاً · {mb:.1f} م.ب"
              f"{' · مفقود ' + str(len(missing)) if missing else ''}")

    (OUT / "audio-manifest.json").write_text(
        json.dumps(man, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n✓ {OUT / 'audio-manifest.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
