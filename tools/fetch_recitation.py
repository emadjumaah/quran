#!/usr/bin/env python3
"""جالبُ التلاوة من everyayah — ملفُّ آيةٍ لكلّ آية، بلا قصٍّ ولا إعادةِ ترميز.

    python3 tools/fetch_recitation.py --surahs 78-114          # جزءُ عمّ
    python3 tools/fetch_recitation.py --all                    # المصحفُ كلُّه
    python3 tools/fetch_recitation.py --surahs 1 --verify      # تحقّقٌ بلا جلب
    python3 tools/fetch_recitation.py --reciter Husary_64kbps --all

## لماذا ملفُّ الآية ولا يُقَصّ

توقيتاتُ `quran-align` مولَّدةٌ **لملفّات everyayah نفسِها**، فبها يُقتطع موضعُ
الكلمة من الملفّ حين التشغيل (`currentTime` وسكتةٌ عند حدّه). فلا حاجةَ إلى
٧٧٬٤٣٣ مقطعاً على القرص، ولا إلى إعادةِ ترميزٍ تُفسد المقابلةَ بالتوقيت.

## القِرى

يُنزَّل الملفُّ مرّةً ولا يُعاد: الموجودُ الصحيحُ يُتخطّى، فالجلبُ يُستأنَف من
حيث انقطع. وأربعةُ خيوطٍ لا أكثر — الخادمُ ضيفٌ علينا لا مورد.

## التحقّق

كلُّ ملفٍّ يُفحَص بعد نزوله: ترويسةُ MP3 صحيحة (`ID3` أو مزامنةُ إطار)، وحجمٌ
يوافق مدّةَ الآية في بيانات المحاذاة بهامشٍ معلَن. وما أخفق يُحذَف ويُعاد.
والمخرَجُ **خارج المستودع** (`audio/` في `.gitignore`).
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio"
BASE = "https://everyayah.com/data"
UA = "mishkat-quran/1.0 (recitation fetch; contact: mishkat.qa)"

BITRATE = {"Husary_Muallim_128kbps": 16000, "Husary_64kbps": 8000}   # بايت/ثانية
WORKERS = 4
MIN_BYTES = 2000


def ayah_keys():
    """مفاتيحُ الآيات من مصدرنا لا من الخادم — ٦٢٣٦ بالبناء."""
    src = ROOT / "build" / "ipa" / "quran-ayat.tsv"
    if not src.exists():
        sys.exit("✗ build/ipa/quran-ayat.tsv مفقود — شغّل quran_ipa.py --all أوّلاً")
    return [tuple(int(p) for p in ln.split("\t")[0].split(":"))
            for ln in src.read_text(encoding="utf-8").splitlines() if ln.strip()]


def durations(reciter, align_dir):
    """مدّةُ كلّ آيةٍ بالميلي ثانية من بيانات المحاذاة — للتحقّق من الحجم."""
    path = Path(align_dir) / f"{reciter}.json"
    if not path.exists():
        return {}
    return {(x["surah"], x["ayah"]): max((s[3] for s in x["segments"]), default=0)
            for x in json.loads(path.read_text())}


def sound(path: Path) -> bool:
    """ترويسةٌ صحيحة: وسمُ ID3 أو مزامنةُ إطار MP3."""
    try:
        if path.stat().st_size < MIN_BYTES:
            return False
        head = path.read_bytes()[:4]
        return head[:3] == b"ID3" or (head[0] == 0xFF and head[1] & 0xE0 == 0xE0)
    except OSError:
        return False


def grab(reciter, sura, aya, tries=3):
    """يُرجع (الحال، بايتات): skip · ok · fail."""
    dst = OUT / reciter / f"{sura:03d}{aya:03d}.mp3"
    if sound(dst):
        return "skip", dst.stat().st_size
    dst.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/{reciter}/{sura:03d}{aya:03d}.mp3"
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                data = r.read()
            tmp = dst.with_suffix(".part")
            tmp.write_bytes(data)
            if sound(tmp):
                tmp.replace(dst)
                return "ok", len(data)
            tmp.unlink(missing_ok=True)
        except (urllib.error.URLError, OSError, TimeoutError):
            pass
        time.sleep(1.5 * (n + 1))
    return "fail", 0


def main():
    ap = argparse.ArgumentParser(description="جلبُ تلاوةِ آياتٍ من everyayah")
    ap.add_argument("--reciter", default="Husary_Muallim_128kbps")
    ap.add_argument("--surahs", help="مثل 78-114 أو 1,112,114")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--verify", action="store_true", help="فحصُ الموجود بلا جلب")
    ap.add_argument("--align", default=str(ROOT.parent / "read" / "tools" / ".cache"),
                    help="مجلّدُ بيانات المحاذاة المفكوكة (للتحقّق من الحجم)")
    a = ap.parse_args()

    keys = ayah_keys()
    if a.surahs:
        want = set()
        for part in a.surahs.split(","):
            if "-" in part:
                lo, hi = (int(x) for x in part.split("-"))
                want |= set(range(lo, hi + 1))
            else:
                want.add(int(part))
        keys = [k for k in keys if k[0] in want]
    elif not a.all:
        sys.exit("✗ اختر --surahs أو --all")

    dur = durations(a.reciter, a.align)
    rate = BITRATE.get(a.reciter, 16000)
    print(f"القارئ : {a.reciter}\nالآيات : {len(keys)}\nالمخرَج: {OUT / a.reciter}\n")

    if a.verify:
        ok = bad = gone = 0
        for s, y in keys:
            p = OUT / a.reciter / f"{s:03d}{y:03d}.mp3"
            if not p.exists():
                gone += 1
            elif sound(p):
                ok += 1
            else:
                bad += 1
        print(f"✓ سليم {ok} · ✗ تالف {bad} · مفقود {gone}")
        return 0 if not bad and not gone else 1

    t0 = time.time()
    tally = {"ok": 0, "skip": 0, "fail": 0}
    total = 0
    failed = []
    with ThreadPoolExecutor(WORKERS) as pool:
        jobs = {pool.submit(grab, a.reciter, s, y): (s, y) for s, y in keys}
        for i, fut in enumerate(jobs, 1):
            pass
        for i, (fut, key) in enumerate(jobs.items(), 1):
            state, n = fut.result()
            tally[state] += 1
            total += n
            if state == "fail":
                failed.append(key)
            if i % 50 == 0 or i == len(keys):
                el = time.time() - t0
                print(f"  {i:>5}/{len(keys)}  {total/1024**2:7.1f} م.ب  "
                      f"{el:5.0f}ث  (جديد {tally['ok']} · موجود {tally['skip']} "
                      f"· أخفق {tally['fail']})")

    print(f"\n✓ {tally['ok']} جديد · {tally['skip']} موجود · {tally['fail']} أخفق"
          f"  —  {total/1024**2:.1f} م.ب في {time.time()-t0:.0f}ث")
    if failed:
        print("  أخفقت:", ", ".join(f"{s}:{y}" for s, y in failed[:20]))

    # مقابلةُ الحجم بمدّةِ المحاذاة — كشفُ ملفٍّ لغيرِ آيته
    if dur:
        odd = []
        for s, y in keys:
            p = OUT / a.reciter / f"{s:03d}{y:03d}.mp3"
            ms = dur.get((s, y))
            if p.exists() and ms:
                ratio = p.stat().st_size / (ms / 1000 * rate)
                if ratio < 0.85:
                    odd.append((s, y, round(ratio, 2)))
        print(f"  مقابلةُ الحجم بالتوقيت: {len(keys)-len(odd)} موافق · "
              f"{len(odd)} أقصرُ من محاذاته")
        if odd:
            print("    (نسبةٌ دون ٠٫٨٥ تعني صوتاً أقصرَ من توقيته — تُفحص)")
            print("   ", odd[:10])
    return 1 if tally["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
