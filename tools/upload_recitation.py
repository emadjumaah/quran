#!/usr/bin/env python3
"""رفعُ التلاوة إلى مستودع البيانات — **حتميٌّ قابلٌ للاستئناف**.

    python3.11 tools/upload_recitation.py --card                  # البطاقةُ والمانيفست
    python3.11 tools/upload_recitation.py --reciter Husary_64kbps # قارئٌ واحد
    python3.11 tools/upload_recitation.py --all                   # القارئان
    python3.11 tools/upload_recitation.py --verify                # مقابلةُ المرفوع بالقرص

يُعاد تشغيلُه فلا يرفع ما رُفع، ويُكمل ما انقطع — `upload_large_folder` يقارن
تجزئاتِ ما على الخادم بما على القرص قبل أن يرسل بايتاً.

## 🔒 الرمز

يُقرأ `HF_TOKEN` من البيئة، وإلّا فمن `.env` في جذر المستودع (وهو متجاهَلٌ في
`.gitignore`). **ولا يُطبَع، ولا يُمرَّر في سطر أوامر، ولا يُكتب في سجلّ.**

## المتطلَّب

`huggingface_hub` (مثبَّتٌ على python3.11 في هذا الجهاز — ومن ثمَّ `python3.11`
في الأمثلة أعلاه).
"""

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
DATA = ROOT / "js" / "data" / "sawt"
REPO = "emadjumaah/mishkat-quran-audio"
RECITERS = ["Husary_Muallim_128kbps", "Husary_64kbps"]


def token() -> str:
    """من البيئة، وإلّا من `.env` — ولا يُطبَع بحال."""
    tok = os.environ.get("HF_TOKEN", "").strip()
    if tok:
        return tok
    env = ROOT / ".env"
    if env.exists():
        m = re.search(r"^HF_TOKEN\s*=\s*(.+)$", env.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip().strip("'\"")
    sys.exit("✗ HF_TOKEN مفقود — لا في البيئة ولا في .env")


def api():
    from huggingface_hub import HfApi
    return HfApi(token=token())


def push_card():
    """البطاقةُ أوّلاً — فرفعُ مادّةٍ مرخَّصةٍ بلا إسنادٍ إخلالٌ بشرطها."""
    h = api()
    card = DATA / "hf-dataset-card.md"
    if not card.exists():
        sys.exit(f"✗ {card} مفقود")
    h.upload_file(path_or_fileobj=str(card), path_in_repo="README.md",
                  repo_id=REPO, repo_type="dataset",
                  commit_message="بطاقةُ المستودع — الإسنادُ الواجب بالعربيّة والإنجليزيّة")
    print("✓ README.md (بطاقةُ المستودع والإسناد)")
    for name in ["audio-manifest.json"] + [f"audio-files.{r}.tsv" for r in RECITERS]:
        p = DATA / name
        if p.exists():
            h.upload_file(path_or_fileobj=str(p), path_in_repo=name,
                          repo_id=REPO, repo_type="dataset",
                          commit_message=f"مانيفست: {name}")
            print(f"✓ {name}")


def push_audio(reciters, workers):
    d = AUDIO
    if not d.is_dir():
        sys.exit("✗ audio/ مفقود — شغّل tools/fetch_recitation.py أوّلاً")
    for r in reciters:
        n = len(list((d / r).glob("*.mp3"))) if (d / r).is_dir() else 0
        if not n:
            print(f"⚠ {r}: لا ملفّاتٍ على القرص — يُتخطّى")
            continue
        print(f"\n▶ رفعُ {r} — {n} ملفّاً")
        api().upload_large_folder(
            repo_id=REPO, folder_path=str(d), repo_type="dataset",
            allow_patterns=[f"{r}/*.mp3"], num_workers=workers,
            print_report=True, print_report_every=30)
        print(f"✓ تمّ {r}")


def verify(reciters):
    """يقابل ما في المستودع بما على القرص — عدداً وحجماً، ملفاً ملفاً."""
    h = api()
    from huggingface_hub import HfApi  # noqa: F401
    remote = {}
    for f in h.list_repo_tree(REPO, repo_type="dataset", recursive=True):
        size = getattr(f, "size", None)
        if size is not None:
            remote[f.path] = size
    bad = 0
    for r in reciters:
        local = {f"{r}/{p.name}": p.stat().st_size
                 for p in sorted((AUDIO / r).glob("*.mp3"))} if (AUDIO / r).is_dir() else {}
        miss = [k for k in local if k not in remote]
        diff = [k for k in local if k in remote and remote[k] != local[k]]
        extra = [k for k in remote if k.startswith(f"{r}/") and k not in local]
        print(f"{r}: على القرص {len(local)} · في المستودع "
              f"{sum(1 for k in remote if k.startswith(r + '/'))} · "
              f"ناقص {len(miss)} · مختلفُ الحجم {len(diff)} · زائد {len(extra)}")
        for k in (miss[:5] + diff[:5]):
            print(f"   ✗ {k}")
        bad += len(miss) + len(diff)
    for name in ["README.md", "audio-manifest.json"]:
        print(f"{'✓' if name in remote else '✗'} {name}")
        bad += 0 if name in remote else 1
    return 1 if bad else 0


def sample(reciters, n):
    """مقابلةُ المرفوع بالمانيفست **من خارجٍ**: تُنزَّل عيّنةٌ من المستودع العامّ
    **بلا رمز** — كما ينزّلها قارئُ التطبيق — وتُقابَل تجزئتُها بالمانيفست.
    **وما خالف يُرفض** — فلا تُدّعى جاهزيّةٌ لملفٍّ لم يثبت أنّه هو."""
    import hashlib
    import random
    import urllib.request

    bad = 0
    for r in reciters:
        tsv = DATA / f"audio-files.{r}.tsv"
        if not tsv.exists():
            print(f"⚠ {r}: لا سجلَّ ملفّاتٍ — يُتخطّى")
            continue
        rows = {}
        for ln in tsv.read_text(encoding="utf-8").splitlines()[1:]:
            k, b, sha = ln.split("\t")
            rows[k] = (int(b), sha)
        random.seed(0)
        keys = ["1:1", "2:255", "36:1", "78:1", "114:6"]
        keys = [k for k in keys if k in rows]
        keys += random.sample(sorted(rows), min(n, len(rows)))
        ok = 0
        for k in keys:
            s, a = (int(x) for x in k.split(":"))
            url = f"https://huggingface.co/datasets/{REPO}/resolve/main/{r}/{s:03d}{a:03d}.mp3"
            data = urllib.request.urlopen(url, timeout=60).read()
            want_b, want_sha = rows[k]
            good = len(data) == want_b and hashlib.sha256(data).hexdigest() == want_sha
            ok += good
            if not good:
                print(f"  ✗ {r} {k}: خالفَ المانيفست — يُرفض ويُعاد")
        bad += len(keys) - ok
        print(f"{r}: {ok}/{len(keys)} مطابقٌ من المستودع العامّ (بلا رمز)")
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser(description="رفعُ التلاوة إلى مستودع البيانات")
    ap.add_argument("--card", action="store_true", help="البطاقةُ والمانيفست وحدها")
    ap.add_argument("--reciter", action="append", help="يُكرَّر")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--sample", type=int, metavar="ع",
                    help="ينزّل عيّنةً من المستودع العامّ بلا رمز ويقابل تجزئتَها")
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    reciters = a.reciter or (RECITERS if (a.all or a.verify or a.sample) else [])
    if a.sample:
        return sample(reciters, a.sample)
    if a.verify:
        return verify(reciters)
    if a.card:
        push_card()
        if not a.reciter and not a.all:
            return 0
    if not reciters:
        ap.error("اختر --card أو --reciter أو --all أو --verify")
    push_audio(reciters, a.workers)
    return 0


if __name__ == "__main__":
    sys.exit(main())
