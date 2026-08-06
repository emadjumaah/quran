#!/usr/bin/env python3
"""مِنصّةُ تجربة: تلاوةٌ مولَّدةٌ من الرسم الصوتيّ، مقابلَ الحصريّ.

    python3 tools/tts_bench.py --prepare          # يجهّز ملفات السور الاثنتي عشرة
    python3 tools/tts_bench.py --models           # يسأل الـAPI عن نماذج الصوت
    python3 tools/tts_bench.py --voices           # الأصواتُ الرجالية المعلَنة
    python3 tools/tts_bench.py --run 112 103      # يولّد (يحتاج مفتاحاً وشبكة)
    python3 tools/tts_bench.py --page             # يبني صفحة المقارنة
    python3 tools/tts_bench.py --self-test        # فحصٌ ذاتيّ بلا شبكة

## ما هذه التجربة

سؤالٌ واحد: **هل يُغني الرسمُ الصوتيّ عن التلاوة المسجَّلة؟** وجوابُه بالأذن لا
بالحجّة. فتُولَّد الآيةُ نفسُها بكل نموذجٍ وبكل صيغةِ إدخال، وتُصفّ إلى جانب
تلاوة الحصريّ في صفحةٍ واحدة، ويُحكَم سماعاً.

**وثلاثُ صيغِ إدخالٍ لا واحدة** — وهي أصلُ التجربة: بالرسم الصوتيّ وحدَه،
وبالنصّ العربيّ وحدَه (شاهدٌ ضابط)، وبهما معاً. فإن تساوى الأوّلُ والثاني سقطت
دعوى «الرسمُ الصوتيّ يُحسِّن النطق» من أصلها.

## السورُ الاثنتا عشرة

من مشروع «اقرأ» الشقيق (`/Volumes/data/new-projects/read`) — أرقامُها وحدَها
تُؤخَذ منه، **ونصُّها من مصدرنا** كسائر ما في هذه العدّة. والمشروعُ لا يُمَسّ:
يُقرأ منه ولا يُكتَب فيه.

## المفتاح

`GEMINI_API_KEY` من البيئة أو من `.env` في جذر المشروع. **لا مفتاحَ في الشيفرة**،
ولا يُطبَع في مخرَجٍ ولا في صفحة.

## الرخصة

مخرَجُ هذه الأداة مشتقٌّ من مرجعٍ لم تثبت رخصتُه — انظر `CREDITS.md`. وهي
**للتجربة المحلّية**، ولا يُنشَر شيءٌ منها قبل حسم الرخصة.
"""

import argparse
import base64
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import quran_ipa as ipa                      # noqa: E402
from check_ipa import skeleton               # noqa: E402

ROOT = ipa.ROOT
BUILD = ROOT / "build" / "tts"
READ_APP = Path("/Volumes/data/new-projects/read")

API = "https://generativelanguage.googleapis.com/v1beta"

# ————— السور: أرقامُها من رحلة «اقرأ» بترتيبها فيها —————
# تُقرأ حيّةً من `curriculum.js` عند `--prepare`، وهذه نسخةٌ احتياطيةٌ معلَنة
# تعمل إن غاب المشروعُ الشقيق — والفاحصُ يقابل بينهما فاختلافُهما يُحمِرّ.
SURAHS = [1, 112, 113, 114, 108, 103, 106, 111, 105, 94, 107, 101]

# ————— نماذجُ الصوت —————
# **يُسأل عنها الـAPI ولا تُخمَّن** (`--models`). وهذه ما كان متاحاً يوم كُتبت:
# لا وجودَ لـ«٣٫١ برو» في التوليد الصوتيّ — الموجودُ ثلاثةٌ لا أربعة.
MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
    "gemini-3.1-flash-tts-preview",
]

# أصواتٌ رجالية من أصوات Gemini المبنية — منتقاةٌ لما يناسب التلاوة:
# عمقاً ورزانةً وبطءَ إيقاع، لا حماسةً ولا خفّة.
MALE_VOICES = {
    "Charon": "عميقٌ رزين — الافتراضيّ هنا",
    "Orus": "حازمٌ واضح",
    "Rasalgethi": "متمهّلٌ مفسِّر",
    "Alnilam": "حازمٌ صافي النبرة",
    "Schedar": "مستوٍ لا تفاوتَ فيه",
    "Iapetus": "صافٍ خفيفُ الحدّة",
    "Enceladus": "هامسٌ قريب",
    "Algenib": "خشِنٌ غليظ",
    "Sadaltager": "عالمٌ متّزن",
    "Umbriel": "هادئٌ مسترسل",
}
DEFAULT_VOICE = "Charon"

# ————— صيغُ الإدخال الثلاث —————
# التوجيهُ واحدٌ في الثلاث فلا يختلف إلا المُدخَل — وإلا لم تكن مقارنة.
STYLE = ("Recite this slowly and reverently, in the measured cadence of "
         "Qur'anic murattal recitation. Do not rush. Hold every long vowel "
         "for its full length. Do not add any words of your own.")

MODES = {
    "ipa": ("الرسمُ الصوتيّ وحدَه",
            STYLE + " The text is given in IPA — pronounce exactly as "
                    "transcribed. Each 'ː' after a vowel adds one more beat "
                    "of length; 'ː' after a consonant doubles it.\n\n{ipa}"),
    "ar": ("النصُّ العربيّ وحدَه — شاهدٌ ضابط",
           STYLE + "\n\n{ar}"),
    "both": ("العربيُّ ومعه رسمُه الصوتيّ",
             STYLE + " The Arabic is given first, then its IPA "
                     "transcription — follow the IPA for pronunciation and "
                     "vowel lengths.\n\n{ar}\n\n{ipa}"),
}


# توجيهُ الكلمة المفردة — غيرُ توجيه الآية: **تلقينٌ لا تلاوة**. لا نغمةَ ولا
# ترتيل، بل نطقٌ بطيءٌ بيّنٌ كما يلقّن المعلّمُ طفلاً كلمةً واحدة.
WORD_PROMPT = (
    "Pronounce this single Arabic word slowly and very clearly, the way a "
    "teacher says one word for a child to repeat. No melody, no recitation "
    "tune — just careful, well-articulated pronunciation. Say it once only. "
    "Do not add any words of your own.\n"
    "The word is given in Arabic, then its IPA transcription. Follow the IPA "
    "exactly: each 'ː' after a vowel adds one more beat of length; 'ː' after "
    "a consonant doubles that consonant.\n\n{ar}\n\n{ipa}")


# توجيهُ الدفعة: كلماتُ الآية في نداءٍ واحد، بسكتةٍ بينها تُشَقّ عليها.
# **والسكتةُ مطلوبةٌ صراحةً** لأنّها هي المِشرَط: بلا صمتٍ بيّنٍ لا يُشَقّ الصوت.
WORD_BATCH_PROMPT = (
    "You are a teacher drilling Arabic pronunciation. Read the following "
    "words ALOUD ONE BY ONE, slowly and very clearly, exactly as a teacher "
    "says a single word for a child to repeat.\n"
    "CRITICAL: leave a full one-second silence between each word. Do not "
    "read them as a connected sentence. Do not say the numbers. Do not add "
    "any words of your own. No melody, no recitation tune.\n"
    "Each line gives the Arabic word then its IPA transcription — follow the "
    "IPA exactly: each 'ː' after a vowel adds one more beat of length; 'ː' "
    "after a consonant doubles that consonant.\n\n{lines}")


def split_on_silence(data: bytes, rate: int, want: int,
                     gap_ms: int = 260, floor: float = 0.06):
    """يشقّ WAV عند الصمت — ويُرجع `None` إن لم يوافق العددُ المنتظَر.

    **ولا يُقارِب**: لو أعطى المشقوقُ عدداً غيرَ عدد الكلمات لكان تسميةُ
    المقاطع تخميناً — وكلمةٌ باسم غيرِها أسوأُ من كلمةٍ لا صوتَ لها. فيُردّ
    الشقُّ كلُّه ويبقى الملفُّ الجامع، ويُعلَن العدد.
    """
    import array
    pcm = array.array("h")
    pcm.frombytes(data)
    step = rate // 100                       # إطارُ عشر ميلي ثانية
    frames = [max(abs(x) for x in pcm[i:i + step]) / 32768
              for i in range(0, len(pcm) - step, step)]
    if not frames:
        return None
    peak = max(frames)
    quiet = [f < peak * floor for f in frames]
    runs, start = [], None
    for i, q in enumerate(quiet + [False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if (i - start) * 10 >= gap_ms:
                runs.append((start, i))
            start = None
    cuts, prev = [], 0
    for a, b in runs:
        mid = (a + b) // 2
        if mid > prev:
            cuts.append((prev, mid))
        prev = mid
    if prev < len(frames):
        cuts.append((prev, len(frames)))
    pieces = []
    for a, b in cuts:
        chunk = pcm[a * step:b * step]
        if max((abs(x) for x in chunk), default=0) / 32768 > peak * floor:
            pieces.append(chunk.tobytes())
    return pieces if len(pieces) == want else len(pieces)


def _cut(raw: bytes, rate: int, want: int):
    """يجرّب سعاتِ صمتٍ متدرّجة، ويُرجع الشقَّ الموافقَ أو `None`."""
    for gap in (300, 240, 180, 140, 110):
        got = split_on_silence(raw[44:], rate, want, gap_ms=gap)
        if isinstance(got, list):
            return got
    return None


def word_batch(key_ayah: str, model: str, voice: str, force: bool) -> int:
    """كلماتُ آيةٍ في نداءٍ واحد، ثمّ تُشَقّ بالصمت — نبرةٌ واحدةٌ عبر الآية."""
    number, ayah = (int(x) for x in key_ayah.split(":"))
    data = json.loads((BUILD / "ipa" / f"{number}.json")
                      .read_text(encoding="utf-8"))
    item = next(a for a in data["ayat"] if a["ayah"] == ayah)
    text = ipa.load_source()[item["key"]]
    words = [("".join(u.base + u.marks for u in units),
              ipa.to_ipa_word(text, item["key"], i, data["arid"]))
             for i, (_, units) in enumerate(ipa.words_of(text))]
    lines = "\n".join(f"{i + 1}. {ar}   {ip}" for i, (ar, ip) in
                       enumerate(words))

    out_dir = BUILD / "batch" / str(number)
    out_dir.mkdir(parents=True, exist_ok=True)
    whole = out_dir / f"{ayah:03d}__{model}__{voice}.wav"
    if not whole.exists() or force:
        print(f"— {key_ayah} · {len(words)} كلمة في نداءٍ واحد —")
        audio = synth(model, WORD_BATCH_PROMPT.format(lines=lines),
                      voice, api_key())
        if audio is None:
            return 1
        whole.write_bytes(audio)

    raw = whole.read_bytes()
    rate = struct.unpack("<I", raw[24:28])[0]
    pieces = _cut(raw, rate, len(words))
    if pieces is None:
        print(f"  ✗ الشقُّ لم يوافق {len(words)} كلمة — يبقى الجامعُ وحدَه:"
              f"\n    {whole}")
        return 1
    for (ar, ip), pcm in zip(words, pieces):
        i = words.index((ar, ip))
        part = out_dir / f"{ayah:03d}_{i:02d}__{model}__{voice}.wav"
        part.write_bytes(wav(pcm, rate))
        part.with_suffix(".json").write_text(
            json.dumps({"i": i, "ar": ar, "ipa": ip}, ensure_ascii=False),
            encoding="utf-8")
        print(f"  {i:2d}  {ar:22s} {len(pcm) / (rate * 2):4.1f}ث  {ip}")
    print(f"\n✓ شُقَّ إلى {len(pieces)} كلمة")
    return 0


# ————— التجهيز —————

def read_app_surahs():
    """أرقامُ سور «اقرأ» بترتيبها — تُقرأ من `curriculum.js` بلا تنفيذ جافاسكربت."""
    src = READ_APP / "app" / "js" / "curriculum.js"
    if not src.exists():
        return None
    text = src.read_text(encoding="utf-8")
    body = text.split("surahs:", 1)[1] if "surahs:" in text else ""
    return [int(m) for m in re.findall(r"\bnumber:\s*(\d+)", body)]


def husary_index():
    """{نصُّ الآية مجرَّداً: مفتاحُ ملفّها} من بيان تلاوة «اقرأ»."""
    meta = READ_APP / "app" / "data" / "recitations.json"
    if not meta.exists():
        return {}, None
    data = json.loads(meta.read_text(encoding="utf-8"))
    return ({skeleton(t): k for k, t in data["ayat"].items()},
            data.get("reciterName", ""))


def prepare(arid: int) -> int:
    """يكتب `build/tts/ipa/<سورة>.json`: لكل آيةٍ نصُّها ورسمُها وملفُّ الحصريّ."""
    live = read_app_surahs()
    if live is None:
        print("  ! المشروعُ الشقيق غيرُ موجود — تُستعمل القائمةُ الاحتياطية")
    elif live != SURAHS:
        print(f"✗ قائمةُ السور تغيّرت في «اقرأ»: {live}\n"
              f"  والمعلَنُ هنا: {SURAHS} — يُحدَّث `SURAHS` ثم يُعاد التجهيز.")
        return 1

    source = ipa.load_source()
    hus, reciter = husary_index()
    out_dir = BUILD / "ipa"
    out_dir.mkdir(parents=True, exist_ok=True)

    index, missing = [], 0
    for number in SURAHS:
        ayat = []
        for key, text in source.items():
            if int(key.split(":")[0]) != number:
                continue
            arabic = ipa.plain(text)
            stem = hus.get(skeleton(arabic))
            missing += stem is None
            ayat.append({"key": key, "ayah": int(key.split(":")[1]),
                         "ar": arabic, "ipa": ipa.to_ipa(text, key, arid),
                         "husary": stem})
        path = out_dir / f"{number}.json"
        path.write_text(json.dumps(
            {"surah": number, "arid": arid, "reciter": reciter, "ayat": ayat},
            ensure_ascii=False, indent=1), encoding="utf-8")
        index.append({"surah": number, "ayat": len(ayat),
                      "husary": sum(1 for a in ayat if a["husary"])})
        print(f"  {number:3d}  {len(ayat):2d} آية  "
              f"تلاوةٌ محفوظة: {index[-1]['husary']:2d}")

    (out_dir / "index.json").write_text(
        json.dumps({"surahs": index, "arid": arid, "reciter": reciter},
                   ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(i["ayat"] for i in index)
    print(f"\n✓ {len(SURAHS)} سورة · {total} آية → {out_dir}")
    if missing:
        print(f"  ! {missing} آيةً بلا تلاوةٍ محفوظة في «اقرأ» — "
              f"تُولَّد ولا يُقابَل بها الحصريّ")
    return 0


# ————— الـAPI —————

def api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        env = ROOT / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"\'')
                    break
    if not key:
        raise SystemExit("✗ لا مفتاح: ضع GEMINI_API_KEY في البيئة أو في .env")
    return key


def _post(url: str, payload: dict, tries: int = 4) -> dict:
    body = json.dumps(payload).encode("utf-8")
    for attempt in range(tries):
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            if e.code in (429, 500, 503) and attempt < tries - 1:
                wait = 5 * (attempt + 1)
                print(f"      … {e.code}، إعادةٌ بعد {wait}ث")
                time.sleep(wait)
                continue
            raise SystemExit(f"✗ {e.code}: {detail}")
        except urllib.error.URLError as e:
            if attempt < tries - 1:
                time.sleep(5)
                continue
            raise SystemExit(f"✗ شبكة: {e}")
    raise SystemExit("✗ فشل الطلب")


def list_models() -> int:
    """نماذجُ الصوت **كما يقولها الـAPI** — لا كما نظنّ."""
    url = f"{API}/models?key={api_key()}&pageSize=200"
    with urllib.request.urlopen(url, timeout=60) as r:
        models = json.loads(r.read()).get("models", [])
    live = [m["name"].replace("models/", "") for m in models
            if "tts" in m["name"]]
    for name in live:
        mark = "✓" if name in MODELS else "+"
        print(f"  {mark} {name}")
    for name in MODELS:
        if name not in live:
            print(f"  ✗ {name} — معلَنٌ هنا وغيرُ موجودٍ في الـAPI")
    print(f"\n  المتاح: {len(live)} · المعلَن: {len(MODELS)}")
    return 0 if set(MODELS) <= set(live) else 1


def wav(pcm: bytes, rate: int) -> bytes:
    """يغلّف PCM خاماً بترويسة WAV — أحاديُّ القناة، ١٦ بتّاً."""
    head = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + len(pcm), b"WAVE",
                       b"fmt ", 16, 1, 1, rate, rate * 2, 2, 16,
                       b"data", len(pcm))
    return head + pcm


def synth(model: str, text: str, voice: str, key: str, tries: int = 3):
    """يُرجع WAV، أو `None` إن أبى النموذجُ أن يُصوّت.

    **ولا يُوقِف الجولة**: ردَّ `gemini-2.5-*-tts` مرّاتٍ بـ`finishReason: OTHER`
    بلا صوتٍ ولا خطأ HTTP — وهو حالُ النموذج لا عيبُ الطلب. فلو أُوقِفت الجولةُ
    عنده لضاع ما بعده، والمقارنةُ تريد ما نجح وما أخفق معاً.
    """
    url = f"{API}/models/{model}:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {
                "prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    for attempt in range(tries):
        data = _post(url, payload)
        try:
            part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
        except (KeyError, IndexError):
            why = (data.get("candidates") or [{}])[0].get("finishReason", "?")
            if attempt < tries - 1:
                time.sleep(3)
                continue
            print(f"      ✗ بلا صوت ({why}) بعد {tries} محاولات")
            return None
        rate = int(re.search(r"rate=(\d+)", part.get("mimeType", "")).group(1)
                   if "rate=" in part.get("mimeType", "") else 24000)
        return wav(base64.b64decode(part["data"]), rate)
    return None


def word_round(key_ayah: str, model: str, voice: str, force: bool) -> int:
    """كلماتُ آيةٍ، كلُّ كلمةٍ وحدَها — وهو المنتَجُ المقصود: نقرةٌ فصوتٌ منضبط.

    **والتوليدُ لا القصّ**: قصُّ صوت الآية يعطي صورةَ الوصل — ﴿مِّن﴾ بلا نونٍ
    و﴿رَّبِّهِمۡ﴾ بشدّةٍ ليست منها. والتلقينُ يريد صورةَ الإفراد، وهي التي
    ينطق بها المعلّم. فلذلك تُصاغ الكلمةُ رسماً صوتيّاً مفرداً ثم تُولَّد.
    """
    number, ayah = (int(x) for x in key_ayah.split(":"))
    data = json.loads((BUILD / "ipa" / f"{number}.json")
                      .read_text(encoding="utf-8"))
    item = next(a for a in data["ayat"] if a["ayah"] == ayah)
    text = ipa.load_source()[item["key"]]
    key, made = api_key(), 0
    print(f"— {key_ayah} · {item['ar']} —")
    for i, (_, units) in enumerate(ipa.words_of(text)):
        arabic = "".join(u.base + u.marks for u in units)
        word_ipa = ipa.to_ipa_word(text, item["key"], i, data["arid"])
        out = (BUILD / "words" / str(number) /
               f"{ayah:03d}_{i:02d}__{model}__{voice}.wav")
        if out.exists() and not force:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        print(f"  {i:2d}  {arabic:22s} {word_ipa}")
        audio = synth(model, WORD_PROMPT.format(ar=arabic, ipa=word_ipa),
                      voice, key)
        if audio is None:
            continue
        out.write_bytes(audio)
        (out.with_suffix(".json")).write_text(json.dumps(
            {"i": i, "ar": arabic, "ipa": word_ipa}, ensure_ascii=False),
            encoding="utf-8")
        made += 1
    print(f"\n✓ {made} كلمة")
    return 0


def voice_round(key_ayah: str, model: str, mode: str, force: bool) -> int:
    """جولةُ الأصوات: آيةٌ واحدةٌ بكلّ صوتٍ رجاليّ — لاختيار الصوت أوّلاً.

    وترتيبُ الجولتين مقصود: **الصوتُ يُختار قبل النموذج**. فلو خُلِطا لكان
    الحكمُ على نموذجٍ بصوتٍ لا يناسبه حكماً على الاثنين معاً.
    """
    number, ayah = (int(x) for x in key_ayah.split(":"))
    data = json.loads((BUILD / "ipa" / f"{number}.json")
                      .read_text(encoding="utf-8"))
    item = next(a for a in data["ayat"] if a["ayah"] == ayah)
    key, made = api_key(), 0
    print(f"— {key_ayah} · {item['ar']} —")
    for voice in MALE_VOICES:
        out = (BUILD / "audio" / str(number) /
               f"{ayah:03d}__{mode}__{model}__{voice}.wav")
        if out.exists() and not force:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        print(f"  {voice:14s} {MALE_VOICES[voice]}")
        audio = synth(
            model, MODES[mode][1].format(ar=item["ar"], ipa=item["ipa"]),
            voice, key)
        if audio is None:
            continue
        out.write_bytes(audio)
        made += 1
    print(f"\n✓ {made} صوتاً على الآية نفسِها")
    return 0


def run(surahs, models, modes, voice: str, force: bool) -> int:
    key = api_key()
    made = skipped = 0
    failed = []
    for number in surahs:
        path = BUILD / "ipa" / f"{number}.json"
        if not path.exists():
            print(f"✗ {number}: لم يُجهَّز — شغّل --prepare أوّلاً")
            return 1
        data = json.loads(path.read_text(encoding="utf-8"))
        print(f"\n— سورة {number} ({len(data['ayat'])} آية) —")
        for item in data["ayat"]:
            for model in models:
                for mode in modes:
                    out = (BUILD / "audio" / str(number) /
                           f"{item['ayah']:03d}__{mode}__{model}__{voice}.wav")
                    if out.exists() and not force:
                        skipped += 1
                        continue
                    out.parent.mkdir(parents=True, exist_ok=True)
                    prompt = MODES[mode][1].format(ar=item["ar"],
                                                   ipa=item["ipa"])
                    print(f"  {item['ayah']:3d}  {mode:5s} {model}")
                    audio = synth(model, prompt, voice, key)
                    if audio is None:
                        failed.append(f"{number}:{item['ayah']} {mode} {model}")
                        continue
                    out.write_bytes(audio)
                    made += 1
    print(f"\n✓ وُلِّد {made} مقطعاً" + (f"، وتُخُطّي {skipped} موجوداً"
                                          if skipped else ""))
    if failed:
        print(f"  ✗ أبى {len(failed)}: " + " · ".join(failed))
    return 0


def surah_run(number: int, model: str, voice: str, force: bool) -> int:
    """السورةُ كاملةً بالقارئ المختار: كلُّ آيةٍ، ثمّ كلماتُها.

    **والكلماتُ بالأسهل**: دفعةٌ واحدةٌ لكل آية تُشَقّ بالصمت — نبرةٌ واحدةٌ
    وكلفةٌ أقلّ. فإن أبى الشقُّ أن يوافق عددَ الكلمات **ارتُدَّ إلى النداء
    المفرد لتلك الآية وحدَها** وأُعلِن ذلك: السهولةُ لا تُشترى بكلمةٍ ناقصة.
    """
    path = BUILD / "ipa" / f"{number}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    source = ipa.load_source()
    key, calls = api_key(), 0
    batched = fellback = 0

    for item in data["ayat"]:
        ayah, text = item["ayah"], source[item["key"]]
        print(f"\n— {number}:{ayah} · {item['ar']}")

        # (أ) الآيةُ كاملةً — موصولةٌ كما تُتلى
        full = (BUILD / "ayat" / str(number) /
                f"{ayah:03d}__{model}__{voice}.wav")
        if not full.exists() or force:
            full.parent.mkdir(parents=True, exist_ok=True)
            audio = synth(model, MODES["ipa"][1].format(
                ar=item["ar"], ipa=item["ipa"]), voice, key)
            calls += 1
            if audio is None:
                print("   ✗ الآيةُ أبت")
            else:
                full.write_bytes(audio)
                print(f"   آية  {len(audio) / (24000 * 2):4.1f}ث")

        # (ب) كلماتُها — دفعةً، وإلا فمفردةً
        words = [("".join(u.base + u.marks for u in units),
                  ipa.to_ipa_word(text, item["key"], i, data["arid"]))
                 for i, (_, units) in enumerate(ipa.words_of(text))]
        out_dir = BUILD / "words" / str(number)
        out_dir.mkdir(parents=True, exist_ok=True)
        done = [out_dir / f"{ayah:03d}_{i:02d}__{model}__{voice}.wav"
                for i in range(len(words))]
        if all(f.exists() for f in done) and not force:
            print(f"   كلمات: {len(words)} موجودة")
            continue

        lines = "\n".join(f"{i + 1}. {ar}   {ip}"
                           for i, (ar, ip) in enumerate(words))
        raw = synth(model, WORD_BATCH_PROMPT.format(lines=lines), voice, key)
        calls += 1
        pieces = _cut(raw, 24000, len(words)) if raw else None

        if pieces:
            batched += 1
            print(f"   كلمات: دفعةٌ واحدة ← شُقَّت {len(pieces)}")
            for (ar, ip), pcm, f in zip(words, pieces, done):
                f.write_bytes(wav(pcm, 24000))
                f.with_suffix(".json").write_text(json.dumps(
                    {"i": done.index(f), "ar": ar, "ipa": ip, "how": "دفعة"},
                    ensure_ascii=False), encoding="utf-8")
        else:
            fellback += 1
            print(f"   كلمات: الشقُّ أبى ← ارتدادٌ إلى {len(words)} نداءً مفرداً")
            for i, ((ar, ip), f) in enumerate(zip(words, done)):
                audio = synth(model, WORD_PROMPT.format(ar=ar, ipa=ip),
                              voice, key)
                calls += 1
                if audio is None:
                    continue
                f.write_bytes(audio)
                f.with_suffix(".json").write_text(json.dumps(
                    {"i": i, "ar": ar, "ipa": ip, "how": "مفرد"},
                    ensure_ascii=False), encoding="utf-8")

    print(f"\n✓ سورة {number} · {calls} نداءً · "
          f"دفعةً {batched} آية، ارتداداً {fellback}")
    return 0


# ————— صفحةُ المقارنة —————

def page(surahs, models, modes, voice: str, only=None) -> int:
    """صفحةٌ واحدة: الآيةُ ورسمُها، والحصريُّ، وكلُّ مولَّدٍ إلى جانبه."""
    hus_dir = BUILD / "husary"
    hus_dir.mkdir(parents=True, exist_ok=True)
    rows, reciter = [], ""
    for number in surahs:
        path = BUILD / "ipa" / f"{number}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        reciter = data.get("reciter") or reciter
        for item in data["ayat"]:
            clips = []
            if item["husary"]:
                src = READ_APP / "app" / "audio" / f"{item['husary']}.mp3"
                if src.exists():
                    dst = hus_dir / src.name
                    if not dst.exists():
                        dst.write_bytes(src.read_bytes())
                    clips.append(("الحصريّ", "تلاوةٌ مسجَّلة",
                                  f"husary/{src.name}"))
            found = sorted((BUILD / "audio" / str(number)).glob(
                f"{item['ayah']:03d}__*.wav")) if (
                BUILD / "audio" / str(number)).exists() else []
            for clip in found:
                _, mode, model, v = clip.stem.split("__")
                if mode not in modes or model not in models:
                    continue
                if only and v not in only:
                    continue          # عزلُ المرشَّحين: لا يُسمَع إلا ما يُقارَن
                # **الصوتُ هو العنوان دائماً**: كان يُخفى متى وافق الافتراضيَّ،
                # فبقي ٢٩ مقطعاً بلا اسمِ صوتٍ ولم يُعرَف المختارُ منها.
                clips.append((v, f"{model.replace('gemini-', '')
                                  .replace('-preview', '')} · "
                                 f"{MODES[mode][0]}",
                              f"audio/{number}/{clip.name}"))
            rows.append((number, item, clips))

    if only:
        # **لا يُعرَض صفٌّ ناقص**: آيةٌ فيها مرشَّحٌ أو اثنان تُوهِم أنّ الباقين
        # أخفقوا، وإنما لم يُولَّدوا. فالصفُّ إمّا تامٌّ وإمّا لا يكون.
        rows = [r for r in rows
                if sum(1 for c in r[2] if c[0] in only) == len(only)]
    else:
        rows = [r for r in rows if len(r[2]) > 1]
    html = _render(rows, reciter, voice, models, modes, only)
    out = BUILD / ("shortlist.html" if only else "compare.html")
    out.write_text(html, encoding="utf-8")
    made = sum(len(c) for _, _, c in rows)
    print(f"✓ {len(rows)} آية · {made} مقطعاً → {out}")
    print(f"  افتحها: open {out}")
    return 0


def _render(rows, reciter, voice, models, modes, only=None) -> str:
    css = """
:root{--bg:#faf8f4;--ink:#1c1a17;--mut:#6b655c;--line:#e2ddd4;--acc:#7a5c2e}
@media(prefers-color-scheme:dark){:root{--bg:#16150f;--ink:#ece7dd;
--mut:#9a938a;--line:#302c25;--acc:#d4b483}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,
"SF Arabic","Segoe UI",system-ui,sans-serif;direction:rtl}
main{max-width:920px;margin:0 auto;padding:2rem 1.2rem 5rem}
h1{font-size:1.5rem;margin:0 0 .3rem}
.sub{color:var(--mut);font-size:.9rem;margin:0 0 2rem}
.sub b{color:var(--ink);font-weight:600}
.ayah{border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.3rem;
margin:0 0 1.1rem;background:color-mix(in srgb,var(--bg) 92%,var(--ink))}
.n{font-size:.75rem;color:var(--mut);letter-spacing:.04em}
.ar{font-size:1.5rem;line-height:2.2;margin:.3rem 0 .5rem}
.ipa{direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;
font-size:.85rem;color:var(--acc);background:color-mix(in srgb,var(--bg) 80%,
var(--ink));padding:.5rem .7rem;border-radius:8px;overflow-x:auto;
white-space:pre-wrap;word-break:break-word}
.clips{display:grid;gap:.5rem;margin-top:.9rem}
.clip{display:grid;grid-template-columns:15rem 1fr;gap:.7rem;align-items:center}
@media(max-width:640px){.clip{grid-template-columns:1fr}}
.lab{font-size:.8rem;line-height:1.35}
.lab b{display:block;font-weight:600}
.lab i{float:left;font-style:normal;color:var(--mut);font-size:.7rem;
border:1px solid var(--line);border-radius:5px;padding:0 .35rem}
.lab span{color:var(--mut)}
.gold b{color:var(--acc)}
audio{width:100%;height:34px}
footer{color:var(--mut);font-size:.8rem;margin-top:2.5rem;
border-top:1px solid var(--line);padding-top:1rem}
"""
    parts = [f"<style>{css}</style>", "<main>",
             ("<h1>اختيارُ الصوت — أربعةُ مرشَّحين على المادّة نفسِها</h1>"
              if only else
              "<h1>تلاوةٌ مولَّدةٌ من الرسم الصوتيّ — مقابلَ المسجَّلة</h1>"),
             (f"<p class=sub>المرشَّحون: <b>{' · '.join(only)}</b>"
              if only else
              f"<p class=sub>الصوت <b>{voice}</b> · النماذج "
              f"<b>{len(models)}</b> · صيغُ الإدخال <b>{len(modes)}</b>")
             + (f" · المسجَّلة <b>{reciter}</b>" if reciter else "") + "</p>"]
    for number, item, clips in rows:
        parts.append(f"<div class=ayah><div class=n>{number}:{item['ayah']}"
                     f"</div><div class=ar>{item['ar']}</div>"
                     f"<div class=ipa>{item['ipa']}</div><div class=clips>")
        for n, (name, note, src) in enumerate(clips, 1):
            gold = " gold" if name == "الحصريّ" else ""
            parts.append(f"<div class=clip><div class='lab{gold}'>"
                         f"<i>{n}</i><b>{name}</b><span>{note}</span></div>"
                         f"<audio controls preload=none src='{src}'></audio>"
                         "</div>")
        parts.append("</div></div>")
    parts.append("<footer>تجربةٌ محلّية. الرسمُ الصوتيّ من "
                 "<code>tools/quran_ipa.py</code>، ومرجعُه لم تثبت رخصتُه — "
                 "لا يُنشَر شيءٌ من هذا قبل حسمها (<code>CREDITS.md</code>)."
                 "</footer></main>")
    return "\n".join(parts)


def word_page(voice: str) -> int:
    """صفحةُ الكلمات: كلُّ كلمةٍ مولَّدةً مفردةً، ومعها مقطعُها المقصوصُ من الحصريّ.

    وهي **صلبُ المقارنة**: المقصوصُ صورةُ الوصل، والمولَّدُ صورةُ الإفراد.
    """
    meta = json.loads((READ_APP / "app" / "data" / "recitations.json")
                      .read_text(encoding="utf-8"))
    spans = meta.get("spans") or {}
    by_ayah = {}
    for stem, sp in spans.items():
        by_ayah.setdefault(sp["a"], []).append((sp["s"], sp["e"]))
    for v in by_ayah.values():
        v.sort()

    hus_dir = BUILD / "husary"
    hus_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for wav_dir in sorted((BUILD / "words").glob("*")):
        number = int(wav_dir.name)
        data = json.loads((BUILD / "ipa" / f"{number}.json")
                          .read_text(encoding="utf-8"))
        for ayah in sorted({int(f.name[:3]) for f in wav_dir.glob("*.wav")}):
            item = next(a for a in data["ayat"] if a["ayah"] == ayah)
            src = READ_APP / "app" / "audio" / f"{item['husary']}.mp3"
            if src.exists() and not (hus_dir / src.name).exists():
                (hus_dir / src.name).write_bytes(src.read_bytes())
            cuts = by_ayah.get(item["husary"], [])
            words = []
            for f in sorted(wav_dir.glob(f"{ayah:03d}_*.wav")):
                info = json.loads(f.with_suffix(".json").read_text(
                    encoding="utf-8"))
                cut = cuts[info["i"]] if info["i"] < len(cuts) else None
                words.append((info, f"words/{number}/{f.name}", cut))
            rows.append((number, ayah, item, f"husary/{src.name}", words))

    out = BUILD / "words.html"
    out.write_text(_render_words(rows, voice), encoding="utf-8")
    n = sum(len(w) for *_, w in rows)
    print(f"✓ {len(rows)} آية · {n} كلمة → {out}")
    print(f"  افتحها: open {out}")
    return 0


def _render_words(rows, voice) -> str:
    css = """
:root{--bg:#faf8f4;--ink:#1c1a17;--mut:#6b655c;--line:#e2ddd4;--acc:#7a5c2e;
--gold:#b8862b}
@media(prefers-color-scheme:dark){:root{--bg:#16150f;--ink:#ece7dd;
--mut:#9a938a;--line:#302c25;--acc:#d4b483;--gold:#d4b483}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,
"SF Arabic","Segoe UI",system-ui,sans-serif;direction:rtl}
main{max-width:900px;margin:0 auto;padding:2rem 1.2rem 5rem}
h1{font-size:1.45rem;margin:0 0 .3rem}
.sub{color:var(--mut);font-size:.88rem;margin:0 0 1.6rem}
.ayah{border:1px solid var(--line);border-radius:14px;padding:1rem 1.2rem;
margin:0 0 1.4rem}
.n{font-size:.72rem;color:var(--mut)}
.full{font-size:1.35rem;line-height:2.1;margin:.2rem 0 .6rem}
.words{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));
gap:.6rem}
.w{border:1px solid var(--line);border-radius:11px;padding:.6rem .7rem;
background:color-mix(in srgb,var(--bg) 88%,var(--ink))}
.w .ar{font-size:1.3rem;line-height:1.9}
.w .ph{direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;
font-size:.78rem;color:var(--acc);margin-bottom:.35rem}
.w audio{width:100%;height:30px;display:block}
.w .tag{font-size:.68rem;color:var(--mut);margin:.3rem 0 .1rem}
.w .tag b{color:var(--gold);font-weight:600}
footer{color:var(--mut);font-size:.78rem;margin-top:2rem;
border-top:1px solid var(--line);padding-top:1rem}
"""
    parts = [f"<style>{css}</style>", "<main>",
             "<h1>كلماتٌ مولَّدةٌ مفردةً — نقرةٌ فصوتٌ منضبط</h1>",
             f"<p class=sub>الصوت <b>{voice}</b>. "
             "<b>المولَّد</b> صورةُ الإفراد كما يلقّنها معلّم؛ "
             "<b>المقصوص</b> صورةُ الوصل من تلاوة الحصريّ — "
             "والفرقُ بينهما هو موضوعُ الحكم.</p>"]
    for number, ayah, item, hus, words in rows:
        parts.append(f"<div class=ayah><div class=n>{number}:{ayah}</div>"
                     f"<div class=full>{item['ar']}</div>"
                     f"<audio controls preload=none src='{hus}'></audio>"
                     "<div class=words>")
        for info, src, cut in words:
            span = ""
            if cut:
                span = (f"<div class=tag>المقصوص</div>"
                        f"<audio controls preload=none "
                        f"src='{hus}#t={cut[0]/1000:.2f},{cut[1]/1000:.2f}'>"
                        "</audio>")
            parts.append(f"<div class=w><div class=ar>{info['ar']}</div>"
                         f"<div class=ph>{info['ipa']}</div>"
                         f"<div class=tag><b>المولَّد مفرداً</b></div>"
                         f"<audio controls preload=none src='{src}'></audio>"
                         f"{span}</div>")
        parts.append("</div></div>")
    parts.append("<footer>تجربةٌ محلّية — مرجعُ الرسم الصوتيّ لم تثبت رخصتُه "
                 "(<code>CREDITS.md</code>).</footer></main>")
    return "\n".join(parts)


def surah_page(number: int, model: str, voice: str) -> int:
    """صفحةُ السورة: كلُّ آيةٍ مولَّدةً ومعها الحصريُّ، ثمّ كلماتُها مفردةً."""
    data = json.loads((BUILD / "ipa" / f"{number}.json")
                      .read_text(encoding="utf-8"))
    hus_dir = BUILD / "husary"
    hus_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for item in data["ayat"]:
        ayah = item["ayah"]
        src = READ_APP / "app" / "audio" / f"{item['husary']}.mp3"
        hus = ""
        if src.exists():
            if not (hus_dir / src.name).exists():
                (hus_dir / src.name).write_bytes(src.read_bytes())
            hus = f"husary/{src.name}"
        full = BUILD / "ayat" / str(number) / f"{ayah:03d}__{model}__{voice}.wav"
        words = []
        for f in sorted((BUILD / "words" / str(number)).glob(
                f"{ayah:03d}_*__{model}__{voice}.wav")):
            words.append((json.loads(f.with_suffix(".json").read_text(
                encoding="utf-8")), f"words/{number}/{f.name}"))
        rows.append((item, f"ayat/{number}/{full.name}" if full.exists()
                     else "", hus, words))

    name = {1: "الفاتحة", 94: "الشرح", 101: "القارعة", 103: "العصر",
            105: "الفيل", 106: "قريش", 107: "الماعون", 108: "الكوثر",
            111: "المسد", 112: "الإخلاص", 113: "الفلق", 114: "الناس"}
    out = BUILD / f"surah-{number}.html"
    out.write_text(_render_surah(rows, number, name.get(number, ""),
                                 model, voice), encoding="utf-8")
    n = sum(len(w) for *_, w in rows)
    print(f"✓ سورة {number} · {len(rows)} آية · {n} كلمة → {out}")
    print(f"  افتحها: open {out}")
    return 0


def _render_surah(rows, number, name, model, voice) -> str:
    css = """
:root{--bg:#faf8f4;--ink:#1c1a17;--mut:#6b655c;--line:#e2ddd4;--acc:#7a5c2e;
--gold:#b8862b}
@media(prefers-color-scheme:dark){:root{--bg:#16150f;--ink:#ece7dd;
--mut:#9a938a;--line:#302c25;--acc:#d4b483;--gold:#d4b483}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,
"SF Arabic","Segoe UI",system-ui,sans-serif;direction:rtl}
main{max-width:880px;margin:0 auto;padding:2rem 1.2rem 5rem}
h1{font-size:1.5rem;margin:0 0 .2rem}
.sub{color:var(--mut);font-size:.86rem;margin:0 0 1.8rem}
.ayah{border:1px solid var(--line);border-radius:15px;padding:1.1rem 1.25rem;
margin:0 0 1.3rem}
.n{font-size:.72rem;color:var(--mut)}
.ar{font-size:1.5rem;line-height:2.25;margin:.15rem 0 .55rem}
.ipa{direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;
font-size:.8rem;color:var(--acc);margin-bottom:.7rem;word-break:break-word}
.pair{display:grid;grid-template-columns:5.5rem 1fr;gap:.6rem;
align-items:center;margin-bottom:.4rem}
.pair span{font-size:.76rem;color:var(--mut)}
.pair.g span{color:var(--gold);font-weight:600}
audio{width:100%;height:32px}
.hr{height:1px;background:var(--line);margin:.9rem 0 .8rem}
.wt{font-size:.72rem;color:var(--mut);margin-bottom:.5rem}
.words{display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));
gap:.55rem}
.w{border:1px solid var(--line);border-radius:11px;padding:.5rem .6rem;
background:color-mix(in srgb,var(--bg) 88%,var(--ink))}
.w .a{font-size:1.25rem;line-height:1.85}
.w .p{direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;
font-size:.74rem;color:var(--acc)}
.w .h{font-size:.63rem;color:var(--mut)}
.w audio{height:28px;margin-top:.2rem}
footer{color:var(--mut);font-size:.78rem;margin-top:2rem;
border-top:1px solid var(--line);padding-top:1rem}
"""
    parts = [f"<style>{css}</style>", "<main>",
             f"<h1>سورة {name} — {number}</h1>",
             f"<p class=sub>القارئُ الآليّ <b>{voice}</b> · "
             f"{model.replace('gemini-', '').replace('-preview', '')} · "
             "من الرسم الصوتيّ. كلُّ آيةٍ موصولةً، ثمّ كلماتُها مفردةً "
             "كما يلقّنها معلّم.</p>"]
    for item, full, hus, words in rows:
        parts.append(f"<div class=ayah><div class=n>{number}:{item['ayah']}"
                     f"</div><div class=ar>{item['ar']}</div>"
                     f"<div class=ipa>{item['ipa']}</div>")
        if full:
            parts.append("<div class='pair g'><span>المولَّد</span>"
                         f"<audio controls preload=none src='{full}'></audio>"
                         "</div>")
        if hus:
            parts.append("<div class=pair><span>الحصريّ</span>"
                         f"<audio controls preload=none src='{hus}'></audio>"
                         "</div>")
        if words:
            how = {w[0].get("how", "") for w in words}
            parts.append(f"<div class=hr></div><div class=wt>"
                         f"{len(words)} كلمةً مفردةً · "
                         f"{'، '.join(sorted(how))}</div><div class=words>")
            for info, src in words:
                parts.append(f"<div class=w><div class=a>{info['ar']}</div>"
                             f"<div class=p>{info['ipa']}</div>"
                             f"<audio controls preload=none src='{src}'>"
                             "</audio></div>")
            parts.append("</div>")
        parts.append("</div>")
    parts.append("<footer>تجربةٌ محلّية — مرجعُ الرسم الصوتيّ لم تثبت رخصتُه "
                 "(<code>CREDITS.md</code>).</footer></main>")
    return "\n".join(parts)


# ————— الفحصُ الذاتيّ —————

def self_test() -> int:
    ok = True
    head = wav(b"\0\0" * 100, 24000)
    if head[:4] != b"RIFF" or len(head) != 44 + 200:
        print("  ✗ ترويسةُ WAV"); ok = False

    for name, (label, tpl) in MODES.items():
        try:
            filled = tpl.format(ar="ع", ipa="i")
        except KeyError as e:
            print(f"  ✗ قالبُ {name}: مفتاحٌ ناقص {e}"); ok = False
            continue
        if "{" in filled:
            print(f"  ✗ قالبُ {name}: بقيت فيه فراغات"); ok = False
        if name != "ar" and "i" not in filled:
            print(f"  ✗ قالبُ {name}: لا يحمل الرسمَ الصوتيّ"); ok = False

    if DEFAULT_VOICE not in MALE_VOICES:
        print("  ✗ الصوتُ الافتراضيّ ليس في القائمة"); ok = False

    live = read_app_surahs()
    if live is not None and live != SURAHS:
        print(f"  ✗ قائمةُ السور تخالف «اقرأ»: {live}"); ok = False

    # المفتاحُ لا يظهر في صفحةٍ ولا في اسم ملفّ
    html = _render([], "", DEFAULT_VOICE, MODELS, ["ipa"])
    if "key=" in html or "API_KEY" in html:
        print("  ✗ الصفحةُ تحمل أثرَ مفتاح"); ok = False

    print("  ✓ عدّةُ التجربة سليمة (بلا شبكة)." if ok else "")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="تجربةُ التلاوة المولَّدة")
    ap.add_argument("--prepare", action="store_true")
    ap.add_argument("--models", action="store_true")
    ap.add_argument("--voices", action="store_true")
    ap.add_argument("--run", nargs="*", type=int, metavar="سورة")
    ap.add_argument("--page", action="store_true")
    ap.add_argument("--surah-page", type=int, metavar="سورة",
                    help="صفحةُ السورة: الآيةُ ثمّ كلماتُها")
    ap.add_argument("--word-page", action="store_true",
                    help="صفحةُ الكلمات: المولَّدُ مفرداً مقابلَ المقصوص")
    ap.add_argument("--surah-run", type=int, metavar="سورة",
                    help="السورةُ كاملةً: كلُّ آيةٍ ثمّ كلماتُها")
    ap.add_argument("--word-batch", metavar="سورة:آية",
                    help="كلماتُ آيةٍ في نداءٍ واحد ثمّ تُشَقّ بالصمت")
    ap.add_argument("--word-round", metavar="سورة:آية",
                    help="كلماتُ آيةٍ، كلُّ كلمةٍ مفردةً — المنتَجُ المقصود")
    ap.add_argument("--voice-round", metavar="سورة:آية",
                    help="آيةٌ واحدةٌ بكلّ صوتٍ رجاليّ — لاختيار الصوت أوّلاً")
    ap.add_argument("--voice", default=DEFAULT_VOICE, choices=MALE_VOICES)
    ap.add_argument("--model", action="append", choices=MODELS,
                    help="يُكرَّر؛ والافتراضُ كلُّها")
    ap.add_argument("--mode", action="append", choices=list(MODES),
                    help="يُكرَّر؛ والافتراضُ كلُّها")
    ap.add_argument("--only-voice", action="append", choices=MALE_VOICES,
                    metavar="صوت", help="يُكرَّر — يعزل الصفحةَ على المرشَّحين")
    ap.add_argument("--surah", action="append", type=int,
                    help="لصفحة المقارنة؛ والافتراضُ كلُّ ما جُهِّز")
    ap.add_argument("--arid", type=int, choices=(2, 4, 6), default=4,
                    help="مقدارُ المدّ العارض للسكون — و٤ أشبهُ بالمرتَّل")
    ap.add_argument("--force", action="store_true", help="يعيد ما وُلِّد")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    models = args.model or MODELS
    modes = args.mode or list(MODES)

    if args.self_test:
        return self_test()
    if args.voices:
        for name, why in MALE_VOICES.items():
            mark = "←" if name == DEFAULT_VOICE else " "
            print(f"  {mark} {name:14s} {why}")
        return 0
    if args.models:
        return list_models()
    if args.prepare:
        return prepare(args.arid)
    if args.surah_run:
        return surah_run(args.surah_run, (args.model or MODELS)[-1],
                         args.voice, args.force)
    if args.word_batch:
        return word_batch(args.word_batch, (args.model or MODELS)[-1],
                          args.voice, args.force)
    if args.word_round:
        return word_round(args.word_round, (args.model or MODELS)[-1],
                          args.voice, args.force)
    if args.voice_round:
        return voice_round(args.voice_round, (args.model or MODELS)[-1],
                           (args.mode or ["both"])[0], args.force)
    if args.run is not None:
        return run(args.run or SURAHS, models, modes, args.voice, args.force)
    if args.surah_page:
        return surah_page(args.surah_page, (args.model or MODELS)[-1],
                          args.voice)
    if args.word_page:
        return word_page(args.voice)
    if args.page:
        return page(args.surah or SURAHS, models, modes, args.voice,
                    args.only_voice)

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
