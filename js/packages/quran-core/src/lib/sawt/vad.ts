/**
 * كاشفُ النشاط الصوتيّ — أداةُ **قياسٍ** لا أداةُ تعرّف.
 *
 * لِمَ يلزم؟ لأنّ الزمنَ في المحكّ المختوم (§٤‑٤) هو **زمنُ الوقف**: من انقطاع
 * صوت القارئ إلى استقرار المؤشّر. وهذا لا يُعرف من المحرّك وحدَه — فالمحرّكُ
 * لا يقول متى سكتَّ، إنّما يقول ما سمع. فنقيس السكوتَ من الصوت نفسِه.
 *
 * **ولا يُحفظ صوتٌ ولا يُرسل**: تُقرأ طاقةُ الموجة في الذاكرة لحظةً بلحظة
 * (`AnalyserNode`)، ولا يُكتب شيءٌ ولا يُخزَّن ولا يُرفع.
 *
 * **وخطرٌ معلومٌ يُقاس ولا يُفترض**: فتحُ مجرًى للميكروفون إلى جانب محرّك
 * المتصفّح قد يتعارض معه على بعض الأجهزة (iOS خاصّة). فإن تعذّر أو تعارض
 * **يُطفأ ويُكتب «غير مقيسٍ آليًّا»** — ولا يُكتب رقمٌ مقدَّرٌ في خانةٍ مقيسة.
 */

export interface VadEvents {
  onSpeechStart(at: number): void;
  onSpeechEnd(at: number): void;
}

export interface VadHandle {
  stop(): void;
  /** أطولُ سكوتٍ متّصلٍ وقع (مِث) — من مواضع الثبات في المحكّ */
  longestSilenceMs(): number;
}

/** أجهزةُ آبل الجوّالة: مجرى ميكروفونٍ ثانٍ فيها موضعُ تعارضٍ متوقَّع */
export const isAppleMobile = (): boolean => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
};

export interface VadOptions {
  /** كم من السكوت المتّصل يُعدّ وقفًا (مِث) */
  hangoverMs?: number;
  /** كم مرّةً في الثانية تُقرأ الطاقة */
  hz?: number;
}

/**
 * تشغيلُ الكاشف. يرمي إن مُنع الميكروفونُ أو تعذّر المجرى — والمُناديةُ تلتقط
 * وتُطفئ القياسَ بلا إبطال الجلسة.
 */
export async function startVad(ev: VadEvents, opts: VadOptions = {}): Promise<VadHandle> {
  const hangover = opts.hangoverMs ?? 350;
  const period = 1000 / (opts.hz ?? 25);

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("no-audio-context");
  }
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  // عتبةٌ تُعايَر من أرضيّة الضجيج في أوّل نصف ثانية — لا رقمَ ثابتٌ يُفترض:
  // الغرفةُ تختلف عن الغرفة، والهاتفُ عن الحاسوب.
  let floor = 0;
  let floorSamples = 0;
  const calibrateUntil = performance.now() + 500;

  let speaking = false;
  let lastVoiceAt = 0;
  let silenceStart = 0;
  let longestSilence = 0;
  let stopped = false;

  const rms = (): number => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };

  const timer = window.setInterval(() => {
    if (stopped) return;
    const now = performance.now();
    const level = rms();
    if (now < calibrateUntil) {
      floor = (floor * floorSamples + level) / (floorSamples + 1);
      floorSamples++;
      return;
    }
    const threshold = Math.max(floor * 3, 0.008);
    if (level > threshold) {
      lastVoiceAt = now;
      if (!speaking) {
        speaking = true;
        if (silenceStart) longestSilence = Math.max(longestSilence, now - silenceStart);
        ev.onSpeechStart(now);
      }
    } else if (speaking && now - lastVoiceAt >= hangover) {
      speaking = false;
      silenceStart = lastVoiceAt;
      // زمنُ الوقف يُنسب إلى **آخر لحظةِ صوت**، لا إلى لحظة إعلان الوقف —
      // وإلّا حُسبت مهلةُ التثبّت (hangover) على المحرّك وهي ليست منه.
      ev.onSpeechEnd(lastVoiceAt);
    }
  }, period);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      try {
        src.disconnect();
      } catch {
        /* المجرى قد يكون مغلقًا */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    },
    longestSilenceMs: () => Math.round(longestSilence),
  };
}
