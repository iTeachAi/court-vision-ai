from pathlib import Path
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import cv2
import shutil
import math

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
# HELPERS
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


def get_players_by_team(results):
    offense_players = []
    defense_players = []

    for box in results[0].boxes:
        cls = int(box.cls[0])
        label = results[0].names[cls]

        if label not in ["offense", "defense"]:
            continue

        x1, y1, x2, y2 = box.xyxy[0]
        center = ((x1 + x2) / 2, (y1 + y2) / 2)

        if label == "offense":
            offense_players.append(center)
        elif label == "defense":
            defense_players.append(center)

    return offense_players, defense_players


def get_possession_player(ball_pos, players):
    if ball_pos is None or len(players) == 0:
        return None

    closest = None
    min_dist = float("inf")

    for p in players:
        dist = math.dist(ball_pos, p)
        if dist < min_dist:
            min_dist = dist
            closest = p

    return closest, min_dist


def get_nearest_defender_distance(player, defenders):
    if player is None or len(defenders) == 0:
        return None

    min_dist = float("inf")

    for d in defenders:
        dist = math.dist(player, d)
        if dist < min_dist:
            min_dist = dist

    return min_dist


def evaluate_advantage_decision(history):
    if len(history) < 5:
        return None

    start = history[-5]
    end = history[-1]
    delta = end - start

    if abs(delta) < 5:
        return "neutral"

    return "good" if delta > 0 else "bad"


def is_stable_event(buffer):
    return len(buffer) > 0 and len(set(buffer)) == 1


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


def generate_coach_feedback(event, decision, defender_distance):
    if event == "drive":
        return "Attack with purpose." if decision != "bad" else "Stop. You're driving into pressure."
    elif event == "retreat":
        return "Reset properly." if decision != "bad" else "Don't give up advantage."
    elif event == "stall":
        return "Make a decision."
    return None


def interpret_sequence(sequence):
    if len(sequence) < 3:
        return None

    e1, d1 = sequence[-3]
    e2, d2 = sequence[-2]
    e3, d3 = sequence[-1]

    if e1 == "drive" and d1 == "bad" and e2 == "retreat":
        return "You attacked into pressure and gave up advantage."

    if e1 == "stall" and e2 == "stall":
        return "You're holding too long."

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

    # ✅ FIXED VIDEO WRITER
    fourcc = cv2.VideoWriter_fourcc(*"avc1")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # fallback if mp4 fails
    if not out.isOpened():
        print("⚠️ mp4 failed, switching to avi")
        output_path = output_path.replace(".mp4", ".avi")
        fourcc = cv2.VideoWriter_fourcc(*"XVID")
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # final safety check
    if not out.isOpened():
        raise Exception("❌ VideoWriter failed to open")

    print(f"✅ Writing video to: {output_path}")

    # ---- STATE ----
    ball_positions = []
    possession_history = []
    advantage_history = []
    sequence_buffer = []
    event_buffer = []

    EVENT_BUFFER_SIZE = 3
    SEQUENCE_LENGTH = 3
    POSSESSION_THRESHOLD = 120

    STEP_SECONDS = 0.5
    step = max(1, int(fps * STEP_SECONDS))

    frame_count = 0
    timeline = []

    last_event = None
    last_feedback = None

    last_results = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % step == 0:
            last_results = model(frame, conf=0.01, imgsz=1280, verbose=False)

        results = last_results

        if results is not None:
            annotated = results[0].plot()
        else:
            annotated = frame

        annotated = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
        out.write(annotated)

        frame_count += 1

    cap.release()
    out.release()

    print("✅ Video processing complete")

    return {
        "timeline": timeline,
        "video_url": f"/video/{Path(output_path).name}",
        "total_events": len(timeline),
        "duration": round(frame_count / fps, 2)
    }


# -----------------------------
# ANALYZE
# -----------------------------
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    video_path = TEMP_DIR / file.filename

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = run_analysis(str(video_path), get_model())

    return result


# -----------------------------
# VIDEO SERVE
# -----------------------------
@app.get("/video/{filename}")
def get_video(filename: str):

    file_path = TEMP_DIR / filename

    if filename.endswith(".avi"):
        return FileResponse(str(file_path), media_type="video/x-msvideo")

    return FileResponse(str(file_path), media_type="video/mp4")


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
