/**
 * تشظيةُ المراجع — لئلّا يُنزِّل القارئُ مجلَّدًا ليقرأ إعرابَ آية (2026-07-31).
 *
 * العلّة: «الدرُّ المصون» وحدَه ١١٫٥ ميغابايت، و«لسانُ العرب» ١١. فلو شُحنت
 * كتلةً واحدةً لانتظر قارئُ الجوّال دهرًا ليرى سطرًا. فتُقطَّع كلُّ مادّةٍ
 * شظايا صغيرةً بمفتاحها الطبيعيّ — السورةُ للمرسى بالآية، وحرفُ المادّة
 * للمرسى بالجذر — ويُكتب معها **دليلٌ صغير** (map.json) يدلّ على الشظيّة.
 * فلا يُجلب إلا ما يُقرأ.
 */
import fs from "node:fs";
import path from "node:path";

const MAX = 220 * 1024; // حدُّ الشظيّة: يُجلب في لمحةٍ على شبكةٍ متوسّطة

/**
 * يكتب مادّةً مرساةً بالآية مشظّاةً بالسور.
 * @param entries { "s:a": [نصّ…] }
 * @returns { shards, bytes, locs }
 */
export function writeShardedByAyah(outDir, id, meta, entries) {
  const dir = path.join(outDir, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // تُجمع المواضعُ بسورها، ثم تُحزم السورُ في شظايا حتى الحدّ. والسورةُ
  // الضخمةُ (البقرةُ في الدرّ المصون) تُقسَم بنفسها على مدَياتِ آيٍ.
  const bySura = new Map();
  for (const [loc, v] of Object.entries(entries)) {
    const [s, a] = loc.split(":").map(Number);
    if (!bySura.has(s)) bySura.set(s, []);
    bySura.get(s).push([a, v]);
  }
  for (const arr of bySura.values()) arr.sort((x, y) => x[0] - y[0]);

  const map = {}; // سورة → [[أوّلُ آية، آخرُها، اسمُ الشظيّة]]
  let bucket = {}, bucketBytes = 0, n = 0, bytes = 0;
  const pending = []; // ما دخل الشظيّةَ الحاليّة: [sura, from, to]

  const flush = () => {
    if (!bucketBytes) return;
    const name = `${n++}`;
    const buf = JSON.stringify(bucket);
    fs.writeFileSync(path.join(dir, `${name}.json`), buf);
    bytes += buf.length;
    for (const [s, from, to] of pending) (map[s] ??= []).push([from, to, name]);
    bucket = {}; bucketBytes = 0; pending.length = 0;
  };

  for (const s of [...bySura.keys()].sort((a, b) => a - b)) {
    const rows = bySura.get(s);
    let from = rows[0][0], last = from;
    for (const [a, v] of rows) {
      const size = JSON.stringify(v).length + 8;
      if (bucketBytes + size > MAX && bucketBytes > 0) {
        pending.push([s, from, last]);
        flush();
        from = a;
      }
      bucket[`${s}:${a}`] = v;
      bucketBytes += size;
      last = a;
    }
    pending.push([s, from, last]);
  }
  flush();

  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ meta, map }));
  return { shards: n, bytes, locs: Object.keys(entries).length };
}

/** يكتب معجمًا مرسًى بالجذر مشظًّى بحرف المادّة الأوّل */
export function writeShardedByRoot(outDir, id, meta, entries) {
  const dir = path.join(outDir, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const groups = new Map();
  for (const [root, v] of Object.entries(entries)) {
    const k = root[0] ?? "؟";
    if (!groups.has(k)) groups.set(k, {});
    groups.get(k)[root] = v;
  }
  const map = {};
  let bytes = 0, n = 0;
  for (const [letter, obj] of groups) {
    // الحرفُ الضخم (كالعين في اللسان) يُقسَم إلى أجزاءٍ مرقّمة
    const roots = Object.keys(obj);
    let part = {}, partBytes = 0, idxInLetter = 0;
    const flush = () => {
      if (!partBytes) return;
      const name = `${n++}`;
      const buf = JSON.stringify(part);
      fs.writeFileSync(path.join(dir, `${name}.json`), buf);
      bytes += buf.length;
      for (const r of Object.keys(part)) map[r] = name;
      part = {}; partBytes = 0;
    };
    for (const r of roots) {
      const size = JSON.stringify(obj[r]).length + 8;
      if (partBytes + size > MAX && partBytes > 0) flush();
      part[r] = obj[r];
      partBytes += size;
      idxInLetter++;
    }
    flush();
    void letter; void idxInLetter;
  }
  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ meta, map }));
  return { shards: n, bytes, roots: Object.keys(entries).length };
}
