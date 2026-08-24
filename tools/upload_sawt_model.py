"""**رفعُ نموذج التتبّع إلى مستودعنا على HF** — آخرُ خطوةٍ بعد أن يخضرّ المحكُّ محلّيًّا.

والتوكن يُقرأ من `.env` في جذر المستودع **ولا يُطبع ولا يُمرَّر في سطر أوامر**:
يُوضع في بيئة العمليّة وحدَها فلا يظهر في `ps`.

    python3 tools/upload_sawt_model.py --dir <مجلَّدُ النموذج> --repo <owner/name> [--dry]
"""
import argparse, os, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_token() -> str:
    env = ROOT / ".env"
    if not env.exists():
        sys.exit("لا وجودَ لـ .env في جذر المستودع")
    for line in env.read_text().splitlines():
        if line.startswith("HF_TOKEN="):
            tok = line.split("=", 1)[1].strip().strip('"').strip("'")
            if tok:
                return tok
    sys.exit("HF_TOKEN غيرُ موجودٍ في .env")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    os.environ["HF_TOKEN"] = load_token()
    from huggingface_hub import HfApi

    api = HfApi(token=os.environ["HF_TOKEN"])
    d = pathlib.Path(a.dir)
    files = sorted(p for p in d.rglob("*") if p.is_file())
    total = sum(p.stat().st_size for p in files)
    print(f"المستودع: {a.repo} · {len(files)} ملفًّا · {total/1e6:.2f} م.ب")
    for p in files:
        print(f"  {p.stat().st_size/1e6:8.2f} م.ب  {p.relative_to(d)}")
    if a.dry:
        print("(تجربةٌ بلا رفع)")
        return
    api.create_repo(a.repo, repo_type="model", exist_ok=True, private=False)
    api.upload_folder(folder_path=str(d), repo_id=a.repo, repo_type="model",
                      commit_message="mishkat: whisper-tiny-ar-quran ONNX — تصديرٌ عندنا من الأصل Apache-2.0")
    info = api.model_info(a.repo, files_metadata=True)
    print(f"رُفع · المراجعة {info.sha}")
    for s in sorted(info.siblings, key=lambda s: -(s.size or 0))[:8]:
        print(f"  {(s.size or 0)/1e6:8.2f} م.ب  {s.rfilename}")


if __name__ == "__main__":
    main()
