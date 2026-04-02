from pathlib import Path
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import os
import cv2
import math
import shutil

app = FastAPI(title="Basketball AI Coach")

ROOT = Path(__file__).resolve().parent
TEMP_DIR = ROOT / "temp"
TEMP_DIR.mkdir(exist_ok=True)

DEFAULT_MODEL = ROOT / "best.pt"


# -----------------------------
# MODEL LOADER
# -----------------------------
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


# -----------------------------
# HEALTH
# -----------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


# -----------------------------
# HELPER FUNCTIONS
# -----------------------------
def get_ball_position(results):
    best_ball = None
    best_conf = 0

    for box in results[0].boxes:
        cls = int(box.cls[0])
        label = results[0].names[cls]
        conf = float(box.conf[0])

        if label == "basketball" and conf > best_conf:
            x1, y1, x2, y2 = box.xyxy[0]
            best_ball = ((x1 + x2) / 2, (y1 + y2) / 2)
            best_conf = conf

    return best_ball


def smooth_positions(positions, window=3):
    if len(positions) == 0:
        return None
    if len(positions) < window:
        return positions[-1]

    avg_x = sum(p[0] for p in positions[-window:]) / window
    avg_y = sum(p[1] for p in positions[-window:]) / window
    return (avg_x, avg_y)


def classify_event(history):
    if len(history) < 6:
        return None

    start = history[-6][0]
    end = history[-1][0]
    delta = end - start

    if abs(delta) < 5:
        return "stall"

    return "drive" if delta > 0 else "retreat"


def generate_feedback(event):
    if event == "drive":
        return "Attack with purpose."
    elif event == "retreat":
        return "Don't give up space."
    elif event == "stall":
        return "Make a decision."
    return None


# -----------------------------
# MAIN ANALYSIS
# -----------------------------
def run_analysis(video_path, model):

    cap = cv2.VideoCapture(video_path)

    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(3))
    height = int(cap.get(4))

    output_path = str(TEMP_DIR / (Path(video_path).stem + "_annotated.mp4"))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    ball_positions = []
    timeline = []

    frame_count = 0
    last_event = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame, conf=0.05, imgsz=1280)

        # --- BALL ---
        pos = get_ball_position(results)

        if pos:
            ball_positions.append(pos)
        elif ball_positions:
            ball_positions.append(ball_positions[-1])

        smoothed = smooth_positions(ball_positions)

        # --- EVENT ---
        event = classify_event(ball_positions)
        feedback = generate_feedback(event)

        if event and event != last_event:
            timeline.append({
                "time": round(frame_count / fps, 2),
                "event": event,
                "feedback": feedback
            })
            last_event = event

        # --- DRAW ---
        annotated = results[0].plot()

        if smoothed:
            cv2.circle(annotated, (int(smoothed[0]), int(smoothed[1])), 8, (0, 255, 0), -1)

        out.write(annotated)

        frame_count += 1

    cap.release()
    out.release()

    return {
        "timeline": timeline,
        "video_url": f"/video/{Path(output_path).name}",
        "duration": round(frame_count / fps, 2)
    }


# -----------------------------
# ANALYZE ENDPOINT
# -----------------------------
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    video_path = TEMP_DIR / file.filename

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = run_analysis(str(video_path), get_model())

    return result


# -----------------------------
# VIDEO SERVING
# -----------------------------
@app.get("/video/{filename}")
def get_video(filename: str):
    return FileResponse(str(TEMP_DIR / filename), media_type="video/mp4")


# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
