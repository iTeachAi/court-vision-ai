from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Basketball AI Coach")

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = ROOT / "best.pt"


def _load_model():
    from ultralytics import YOLO

    path = DEFAULT_MODEL if DEFAULT_MODEL.exists() else ROOT / "yolo26s.pt"
    if not path.exists():
        raise FileNotFoundError(f"No weights at {DEFAULT_MODEL} or {ROOT / 'yolo26s.pt'}")
    return YOLO(str(path))


_model = None


def get_model():
    global _model
    if _model is None:
        _model = _load_model()
    return _model


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    import tempfile

    suffix = Path(file.filename or "image.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        results = get_model()(tmp_path)
        out = []
        for r in results:
            if r.boxes is not None:
                out.append(
                    {
                        "boxes": r.boxes.xyxy.cpu().tolist(),
                        "conf": r.boxes.conf.cpu().tolist(),
                        "cls": r.boxes.cls.cpu().tolist(),
                    }
                )
        return {"results": out}
    finally:
        Path(tmp_path).unlink(missing_ok=True)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)