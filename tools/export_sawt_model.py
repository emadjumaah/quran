"""**تصديرُ نموذج التتبّع عندنا** — من الأصل المعلَنِ رخصتُه إلى صورةٍ تُشحن.

ثلاثُ خطواتٍ لا رابعَ لها، وكلُّها آليّةٌ تُعاد بحرفها (ص٦ §٢ب):

  ١) **تصديرٌ إلى ONNX** من `tarteel-ai/whisper-tiny-ar-quran` (Apache-2.0)
     بـ`optimum` — **لا تدريبَ ولا ضبطَ ولا مسَّ قيمةِ وزنٍ واحد**.
  ٢) **فكُّ ازدواج جدول الرموز**: المصدِّرُ يُخرج مصفوفةَ الرموز مرّتين — مرّةً
     لجدول الرموز `[vocab, d]` ومرّةً منقولةً لطبقة الإخراج `[d, vocab]` —
     وهما ثمانون ميغابايتًا بالدقّة الكاملة. فتُحذف إحداهما **بعد التحقّق
     العدديّ** أنّها منقولةُ الأخرى بعينها، وتُقرأ الباقيةُ على محورها الثاني
     ثمّ تُنقَل.
  ٣) **تكميمٌ إلى ثمانِ بتّات** — **وجدولُ الرموز معه** (`Gather`)، وفرعا `If`
     كذلك (`EnableSubgraph`). وههنا يثمر الربطُ مرّتين: نسخةٌ واحدةٌ مكمَّمةٌ
     يقرؤها الجدولُ وطبقةُ الإخراج معًا.

**ولمَ ثمانِ بتّاتٍ لا أربع؟** بالقياس لا بالرغبة: أربعُ بتّاتٍ تمسّ طبقةَ
الإخراج فيهبط التتبّعُ (٧٥٫٥٪ مقابل ٨٢٫٣٪ في الصفحة المتّصلة — جدولُ
`findings/S6-RESULTS.md` §٣)، **وهي أكبرُ حجمًا كذلك** لأنّها تحتاج جدولَ
مقاديرَ لكلّ كتلة ولا تُكمَّم بها مصفوفةُ الرموز.

**وضبطُ التوليد** يُؤخذ من `openai/whisper-tiny` (Apache-2.0، وهو أصلُ النموذج):
فالمستودعُ المضبوطُ لا يشحنه، وما يولّده المصدِّرُ ناقصٌ من رموز اللغات فيأبى
المحرّكُ أن يُطلب إليه العربيّةُ.

**وبيئتُه ليست بيئةَ المستودع**: `transformers` **٤٫٤١٫٢ لا أحدثُ** — فالأحدثُ
يُخرج مدخلًا اسمُه `cache_position` لا يعرفه `transformers.js`، فتموت الجلسةُ في
المتصفّح. والوصفةُ كاملةً:

    python3.11 -m venv venv && ./venv/bin/pip install \
      "numpy<2" "torch==2.2.2" "transformers==4.41.2" "optimum==1.21.4" \
      "onnx==1.16.2" "onnxruntime==1.18.1" "huggingface_hub==0.24.6"
    ./venv/bin/python tools/export_sawt_model.py --out <مجلَّد>

ثمّ يُقاس المُخرَجُ قبل أن يُرفع:

    node js/scripts/bench-sawt-model.mjs --model <اسمُ المجلَّد> --dtype int8 \\
      --clip safha42 --audio <مجلَّدُ المحكّ> --models <أبو المجلَّد>
"""

import argparse
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

BASE_MODEL = "tarteel-ai/whisper-tiny-ar-quran"
GEN_CONFIG_FROM = "openai/whisper-tiny"
#: ما ينسخه التصديرُ إلى مجلَّد الشحن — وما عداه لا يُنزَّل إلى جهاز القارئ
SMALL = [
    "config.json",
    "generation_config.json",
    "preprocessor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "added_tokens.json",
    "normalizer.json",
]


def step_export(src: str, out: pathlib.Path) -> None:
    """١ — التصديرُ إلى ONNX بأدوات المصدر نفسِها."""
    subprocess.run(
        [sys.executable, "-m", "optimum.commands.optimum_cli", "export", "onnx",
         "--model", src, "--task", "automatic-speech-recognition-with-past",
         "--opset", "14", str(out)],
        check=True,
    )


def step_untie(src: pathlib.Path, dst: pathlib.Path) -> None:
    """٢ — فكُّ الازدواج. والعُقَدُ في فرعَي `If` فيُمشى في الفروع لا في المتن وحدَه."""
    import numpy as np
    import onnx
    from onnx import helper, numpy_helper

    m = onnx.load(str(src))
    g = m.graph
    emb = next(t for t in g.initializer if len(t.dims) == 2 and t.dims[0] > 40000)
    lm = next(t for t in g.initializer if len(t.dims) == 2 and t.dims[1] > 40000)
    if not np.array_equal(numpy_helper.to_array(emb), numpy_helper.to_array(lm).T):
        sys.exit("ليسا منقولين — لا يُفَكّ ازدواجٌ لم يثبت")
    print(f"  جدولُ الرموز {list(emb.dims)} · طبقةُ الإخراج {list(lm.dims)} · منقولٌ عنه ✓")

    def graphs(gr):
        yield gr
        for n in gr.node:
            for a in n.attribute:
                if a.g.ByteSize():
                    yield from graphs(a.g)
                for sub in a.graphs:
                    yield from graphs(sub)

    rewired = 0
    for gr in graphs(g):
        for n in list(gr.node):
            if emb.name not in n.input:
                continue
            if n.op_type != "Gather":
                sys.exit(f"مستهلكٌ ليس Gather: {n.op_type} — يُوقَف")
            axis = next((a for a in n.attribute if a.name == "axis"), None)
            if axis is not None and axis.i != 0:
                sys.exit("محورُ Gather ليس صفرًا — يُوقَف")
            n.input[list(n.input).index(emb.name)] = lm.name
            del n.attribute[:]
            n.attribute.extend([helper.make_attribute("axis", 1)])
            out_name = n.output[0]
            n.output[0] = f"{out_name}_untied"
            gr.node.insert(
                list(gr.node).index(n) + 1,
                helper.make_node("Transpose", [f"{out_name}_untied"], [out_name],
                                 name=f"{n.name}_untie_T", perm=[1, 2, 0]),
            )
            rewired += 1
    if not rewired:
        sys.exit("لم يُوجد مستهلكٌ لجدول الرموز — يُوقَف")
    g.initializer.remove(emb)
    onnx.checker.check_model(m, full_check=False)
    onnx.save(m, str(dst))
    print(f"  أُعيد توجيهُ {rewired} عقدةً · {src.stat().st_size/1e6:.2f} ⇐ {dst.stat().st_size/1e6:.2f} م.ب")


def step_quantize(src: pathlib.Path, dst: pathlib.Path) -> None:
    """٣ — تكميمٌ بثمانِ بتّاتٍ يشمل جدولَ الرموز وفرعَي `If`."""
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(
        str(src), str(dst),
        weight_type=QuantType.QInt8, per_channel=False, reduce_range=False,
        extra_options={"EnableSubgraph": True},
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="مجلَّدُ الشحن")
    ap.add_argument("--model", default=BASE_MODEL, help="الأصلُ (معرّفٌ أو مسارٌ محلّيّ)")
    ap.add_argument("--work", default=None, help="مجلَّدُ العمل (الافتراضُ: <out>/.work)")
    a = ap.parse_args()

    out = pathlib.Path(a.out)
    work = pathlib.Path(a.work) if a.work else out / ".work"
    (out / "onnx").mkdir(parents=True, exist_ok=True)

    print("١ — التصدير…")
    fp32 = work / "fp32"
    if not (fp32 / "decoder_model_merged.onnx").exists():
        step_export(a.model, fp32)

    print("  ضبطُ التوليد من الأصل…")
    from huggingface_hub import hf_hub_download

    shutil.copy(hf_hub_download(GEN_CONFIG_FROM, "generation_config.json"),
                fp32 / "generation_config.json")

    print("٢ — فكُّ الازدواج…")
    tied = work / "decoder_tied.onnx"
    step_untie(fp32 / "decoder_model_merged.onnx", tied)

    print("٣ — التكميم…")
    step_quantize(fp32 / "encoder_model.onnx", out / "onnx" / "encoder_model_int8.onnx")
    step_quantize(tied, out / "onnx" / "decoder_model_merged_int8.onnx")

    for f in SMALL:
        p = fp32 / f
        if p.exists():
            shutil.copy(p, out / f)

    total = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
    for p in sorted(out.rglob("*.onnx")):
        print(f"  {p.stat().st_size/1e6:8.2f} م.ب  {p.relative_to(out)}")
    print(f"مجلَّدُ الشحن: {out} · {total/1e6:.2f} م.ب")
    print("والتالي: بطاقةٌ ونصُّ الرخصة (Apache-2.0) ثمّ المِسطرةُ ثمّ المانيفست ثمّ الرفع.")


if __name__ == "__main__":
    main()
