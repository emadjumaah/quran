#!/usr/bin/env python3
"""ضبطٌ سالب: **لا صوتَ في git** — ولا ملفَّ تلاوةٍ واحداً في شجرة العمل المتتبَّعة.

    python3 tools/check_no_audio_in_git.py

التلاوةُ جيجاباتٌ تُجلب وتُرفع إلى مستودع البيانات، **ولا تُودَع في المستودع
البرمجيّ بحال**. وهذا الفاحصُ يقطع الطريقَ على الغلط قبل وقوعه، ويفحص ثلاثاً:

1. **لا ملفَّ صوتٍ متتبَّعاً** (`git ls-files`) — بأيّ لاحقةٍ من لواحق الصوت.
2. **`audio/` متجاهَلٌ فعلاً** — يُسأل git نفسُه لا `.gitignore` نصّاً.
3. **لا ملفَّ صوتٍ في المرحلة** (`git diff --cached`) — فالغلطُ يقع في `git add`
   لا في الإيداع.

ويخرج بـ`1` إن أخفق شيءٌ منها، فيصلح لسويتة البوّابات.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = {".mp3", ".ogg", ".opus", ".m4a", ".aac", ".wav", ".flac", ".wma", ".mp4", ".webm"}
GUARDED = ["audio/"]


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args],
                          capture_output=True, text=True).stdout.splitlines()


def audio_of(paths):
    return [p for p in paths if Path(p).suffix.lower() in EXT]


def main():
    fails = []

    tracked = audio_of(git("ls-files"))
    print(f"{'✗' if tracked else '✓'} متتبَّع: {len(tracked)} ملفَّ صوت")
    if tracked:
        fails.append("ملفّاتُ صوتٍ متتبَّعةٌ في git: " + ", ".join(tracked[:10]))

    staged = audio_of(git("diff", "--cached", "--name-only"))
    print(f"{'✗' if staged else '✓'} في المرحلة: {len(staged)} ملفَّ صوت")
    if staged:
        fails.append("ملفّاتُ صوتٍ في المرحلة: " + ", ".join(staged[:10]))

    for d in GUARDED:
        probe = d + "probe.mp3"
        ignored = subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", probe]
                                 ).returncode == 0
        print(f"{'✓' if ignored else '✗'} متجاهَل: {d}")
        if not ignored:
            fails.append(f"{d} غيرُ متجاهَلٍ في git — والتلاوةُ تُودَع سهواً")

    if fails:
        print("\n✗ أخفق الضبطُ السالب:")
        for f in fails:
            print("  -", f)
        return 1
    print("\n✓ لا صوتَ في git")
    return 0


if __name__ == "__main__":
    sys.exit(main())
