---
license: other
license_name: see-attribution-section
license_link: https://huggingface.co/datasets/emadjumaah/mishkat-quran-audio/blob/main/README.md
language:
- ar
pretty_name: "تلاوةُ الحصريّ لمشكاة — Husary recitation for Mishkat (offline)"
tags:
- quran
- recitation
- arabic
- audio
- offline
size_categories:
- 10K<n<100K
---

# تلاوةُ الحصريّ — مرآةٌ لعمل مشكاة بلا إنترنت

# Al-Ḥuṣarī recitation — an offline mirror for Mishkat

> **العربيّة أوّلاً، ثمّ الإنجليزيّة.** · *Arabic first, then English.*

---

## ما هذا؟

ملفّاتُ تلاوةٍ **آيةً آيةً** للشيخ **محمود خليل الحصريّ**، منسوخةٌ كما هي من
[everyayah.com](https://everyayah.com) **بلا قصٍّ ولا إعادةِ ترميز**، ليعمل بها
تطبيق **[مشكاة](https://www.mishkat.qa)** — الاستماعُ والتلقينُ — **بلا اتّصالٍ
بالإنترنت**.

**ولا نصَّ قرآنٍ في هذا المستودع ولا تفسير** — صوتٌ فقط، ومانيفستٌ يصفه.

### القارئان — ولكلٍّ موضعُه

| المجلّد | التلاوة | لماذا |
|---|---|---|
| `Husary_Muallim_128kbps/` | **مصحفُ المعلّم** | **التلقين**: إيقاعٌ بطيءٌ بيّنٌ، وسكتاتُ الترديد محفوظة |
| `Husary_64kbps/` | **المرتَّل** | **المعايرة**: أنظفُ محاذاةً بالتوقيتات |

### التسمية والبنية

```
<القارئ>/<سورة ٣ خانات><آية ٣ خانات>.mp3      مثال: Husary_64kbps/002255.mp3
```

٦٢٣٦ ملفًّا لكلّ قارئ — بترقيم حفصٍ المعتمد. **وأسماءُ الملفّات هي أسماءُ
everyayah نفسُها**، فتوقيتاتُ `quran-align` تنطبق عليها بلا إزاحة.

### المانيفست — الحجمُ يُعرف قبل التنزيل

| الملفّ | ما فيه |
|---|---|
| `audio-manifest.json` | مجاميعُ **بالجزء وبالسورة وبالصفحة**: عددُ الملفّات وبايتاتُها |
| `audio-files.<القارئ>.tsv` | لكلّ ملفّ: `سورة:آية ⇥ بايت ⇥ sha256` |

**والأحجامُ محسوبةٌ من الملفّات نفسِها لا مقدَّرة**، وبالتجزئة يُقابَل كلُّ ملفٍّ
بعد نزوله — وما خالف يُرفض ويُعاد.

---

## ⚖️ الرخصةُ والإسنادُ الواجب

**ثلاثةُ حقوقٍ لا تُخلط — ولا يدّعي هذا المستودعُ ملكيّةَ شيءٍ منها:**

### ١) توقيتاتُ الكلمات — `quran-align`

> **Collin Fair** · **CC BY 4.0** · <https://github.com/cpfair/quran-align>

التوقيتاتُ **ليست في هذا المستودع**، لكنّها **الأداةُ التي بها اختير هذا القارئُ
بعينه وبها فُحص كلُّ ملفٍّ** (مقابلةُ حجم الملفّ بمدّة محاذاته)، **وبها يشتغل
التطبيقُ على هذه الملفّات نفسِها**. فالإسنادُ واجبٌ برخصتها، وهو مثبَتٌ هنا وفي
موضع الاستماع من التطبيق.

### ٢) التلاوة — للشيخ محمود خليل الحصريّ، عبر everyayah.com

التسجيلاتُ **منقولةٌ كما هي** من <https://everyayah.com/data/>.
**ولم نُنشئها ولا نملكها ولا نعيد ترخيصَها** — وحقوقُها لأصحابها.
وهذه مرآةٌ تخدم قارئَ مشكاة ليسمع بلا إنترنت.
**ومن كان له حقٌّ في هذه التسجيلات ورأى أن تُرفَع فلْيُراسِلنا وتُرفَع.**

### ٣) بنيةُ المصحف — حدودُ الأجزاء والصفحات وأسماءُ السور

> **مشروع تنزيل (Tanzil.net)** · **CC BY 3.0**

منها بُنيت مجاميعُ المانيفست بالجزء والصفحة.

**⚠️ وحقلُ `license` في صدر هذه البطاقة `other` عن قصد**: فالمادّةُ حقوقٌ
مختلفةُ الأصل، **ولا يصحّ أن يُوضع عليها وسمُ رخصةٍ واحدةٍ يُوهم إباحةً لم
تثبت**.

---

## كيف بُني — قابلٌ للإعادة

| الخطوة | العدّة |
|---|---|
| الجلبُ من everyayah (بلا قصٍّ ولا ترميز) | `tools/fetch_recitation.py` |
| المانيفستُ والتجزئات | `tools/build_audio_manifest.py` |
| الرفع (حتميٌّ قابلٌ للاستئناف) | `tools/upload_recitation.py` |

كلُّها في مستودع مشكاة: <https://github.com/qataruts/quran>

---
---

# English

## What is this?

**Verse-by-verse** recitation audio by **Shaykh Mahmoud Khalil al-Ḥuṣarī**,
mirrored **byte-for-byte** from [everyayah.com](https://everyayah.com) — **no
cutting, no re-encoding** — so that **[Mishkat](https://www.mishkat.qa)** can
offer listening and teaching-repetition (*talqīn*) **fully offline**.

**No Qur'an text and no exegesis live here** — audio only, plus a manifest
describing it.

### Two reciters, two purposes

| Folder | Recitation | Why |
|---|---|---|
| `Husary_Muallim_128kbps/` | **Muʿallim** (teaching mushaf) | **Talqīn**: deliberate pace, repetition pauses preserved |
| `Husary_64kbps/` | **Murattal** | **Calibration**: cleanest word alignment |

### Layout

```
<reciter>/<3-digit sura><3-digit ayah>.mp3      e.g. Husary_64kbps/002255.mp3
```

6,236 files per reciter, canonical Ḥafṣ numbering. **File names are
everyayah's own**, so `quran-align` timings apply with zero offset.

### Manifest — know the size before you download

| File | Contents |
|---|---|
| `audio-manifest.json` | Totals **per juzʾ, per sura, per mushaf page**: file count and bytes |
| `audio-files.<reciter>.tsv` | Per file: `sura:ayah ⇥ bytes ⇥ sha256` |

**Sizes are computed from the files themselves, never estimated**, and every
downloaded file is checked against its hash — a mismatch is rejected and
re-fetched.

## ⚖️ License & required attribution

**Three distinct rights. This repository claims none of them.**

**1) Word timings — `quran-align`** · **Collin Fair** · **CC BY 4.0** ·
<https://github.com/cpfair/quran-align>
The timing files are *not* hosted here, but they are how this reciter was
chosen, how every file here was verified (file size vs. aligned duration), and
how the application drives these very files. Attribution is therefore required
and is given here and wherever the audio is played in the app.

**2) The recitation — Shaykh Mahmoud Khalil al-Ḥuṣarī, via everyayah.com**
Mirrored as-is from <https://everyayah.com/data/>. **We did not create it, do
not own it, and do not re-license it**; rights belong to their holders. This
mirror exists to serve Mishkat's readers offline. **If you hold rights in these
recordings and want this mirror taken down, contact us and it will be.**

**3) Mushaf structure — juzʾ/page boundaries and sura names** · **Tanzil.net** ·
**CC BY 3.0** — used to build the manifest's per-juzʾ and per-page totals.

**⚠️ The `license` field above is deliberately `other`**: this material carries
rights of different origins, and stamping a single permissive tag on it would
imply a permission that has not been established.

## Reproducing this

| Step | Tool |
|---|---|
| Fetch from everyayah (no cut, no re-encode) | `tools/fetch_recitation.py` |
| Manifest and hashes | `tools/build_audio_manifest.py` |
| Upload (deterministic, resumable) | `tools/upload_recitation.py` |

All in the Mishkat repository: <https://github.com/qataruts/quran>

---

*مشكاة — المرجعُ الحاسوبيّ للمصحف · <https://www.mishkat.qa>*
