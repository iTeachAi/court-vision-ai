from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import cv2
import shutil
import math
import os
import subprocess
import logging

# -----------------------------
# LOGGING
# -----------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# -----------------------------
# APP
# -----------------------------
app = FastAPI(
    title="CourtIQ Analysis API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

ROOT = Path(__file__).resolve().parent
TEMP_DIR = ROOT / "temp"
TEMP_DIR.mkdir(exist_ok=True)

DEFAULT_MODEL = ROOT / "best.pt"
FALLBACK_MODEL = ROOT / "yolo26s.pt"

POSSESSION_THRESHOLD = 120
EVENT_BUFFER_SIZE = 3
SEQUENCE_LENGTH = 3
STEP_SECONDS = 0.5


# -----------------------------
# MODEL LOADER
# -----------------------------
def _load_model():
    from ultralytics import YOLO

    path = DEFAULT_MODEL if DEFAULT_MODEL.exists() else FALLBACK_MODEL
    if not path.exists():
        raise FileNotFoundError(f"No model weights found at {DEFAULT_MODEL} or {FALLBACK_MODEL}")

    logger.info(f"Loading model from {path}")
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
@app.get("/")
def health():
    return {"status": "ok"}


# -----------------------------
# HELPERS
# -----------------------------
def get_ball_position(results):
    best_ball = None
    best_conf = 0.0

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

        if label not in ("offense", "defense"):
            continue

        x1, y1, x2, y2 = box.xyxy[0]
        center = ((x1 + x2) / 2, (y1 + y2) / 2)

        if label == "offense":
            offense_players.append(center)
        else:
            defense_players.append(center)

    return offense_players, defense_players


def get_possession_player(ball_pos, players):
    if ball_pos is None or not players:
        return None

    closest = min(players, key=lambda p: math.dist(ball_pos, p))
    return closest, math.dist(ball_pos, closest)


def get_nearest_defender_distance(player, defenders):
    if player is None or not defenders:
        return None

    return min(math.dist(player, d) for d in defenders)


def evaluate_advantage_decision(history):
    if len(history) < 5:
        return None

    delta = history[-1] - history[-5]
    if abs(delta) < 5:
        return "neutral"
    return "good" if delta > 0 else "bad"


def is_stable_event(buffer):
    return len(buffer) > 0 and len(set(buffer)) == 1


def smooth_positions(positions, window=3):
    if not positions:
        return None
    recent = positions[-window:]
    avg_x = sum(p[0] for p in recent) / len(recent)
    avg_y = sum(p[1] for p in recent) / len(recent)
    return (avg_x, avg_y)


def classify_event(history):
    if len(history) < 6:
        return None

    delta = history[-1][0] - history[-6][0]
    if abs(delta) < 5:
        return "stall"
    return "drive" if delta > 0 else "retreat"


def generate_coach_feedback(event, decision, defender_distance):
    if event == "drive":
        return "Attack with purpose." if decision != "bad" else "Stop. You're driving into pressure."
    if event == "retreat":
        return "Reset properly." if decision != "bad" else "Don't give up advantage."
    if event == "stall":
        return "Make a decision."
    return None


def interpret_sequence(sequence):
    if len(sequence) < 3:
        return None

    e1, d1 = sequence[-3]
    e2, d2 = sequence[-2]

    if e1 == "drive" and d1 == "bad" and e2 == "retreat":
        return "You attacked into pressure and gave up advantage."
    if e1 == "stall" and e2 == "stall":
        return "You're holding too long."

    return None


# -----------------------------
# VIDEO WRITER HELPER
# -----------------------------
def create_video_writer(video_path: str, fps: int, width: int, height: int):
    stem = Path(video_path).stem

    codec_attempts = [
        (str(TEMP_DIR / f"{stem}_annotated.mp4"),     "mp4v"),
        (str(TEMP_DIR / f"{stem}_annotated.avi"),      "XVID"),
        (str(TEMP_DIR / f"{stem}_annotated_mjpg.avi"), "MJPG"),
    ]

    for path, codec in codec_attempts:
        fourcc = cv2.VideoWriter_fourcc(*codec)
        writer = cv2.VideoWriter(path, fourcc, fps, (width, height))
        if writer.isOpened():
            logger.info(f"Using codec {codec} -> {path}")
            return writer, path
        logger.warning(f"Codec {codec} failed, trying next...")

    raise RuntimeError("VideoWriter failed: no working codec found on this system")


def convert_to_mp4(source_path: str) -> str:
    if source_path.endswith(".mp4"):
        return source_path

    mp4_path = source_path.rsplit(".", 1)[0] + ".mp4"

    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", source_path,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                mp4_path,
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode == 0 and os.path.exists(mp4_path):
            logger.info(f"ffmpeg converted -> {mp4_path}")
            os.remove(source_path)
            return mp4_path

        logger.error(f"ffmpeg failed (rc={result.returncode}): {result.stderr[:300]}")

    except FileNotFoundError:
        logger.warning("ffmpeg not installed — serving raw file")
    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg timed out — serving raw file")

    return source_path


# -----------------------------
# MAIN ANALYSIS
# -----------------------------
def run_analysis(video_path: str, model) -> dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video file: {video_path}")

    fps    = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    step   = max(1, int(fps * STEP_SECONDS))

    out, raw_output_path = create_video_writer(video_path, fps, width, height)

    # ---------------- STATE ----------------
    ball_positions     = []
    possession_history = []
    advantage_history  = []
    sequence_buffer    = []
    event_buffer       = []

    frame_count  = 0
    timeline     = []
    last_event   = None
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
            pos = get_ball_position(results)
            ball_positions.append(pos if pos else (ball_positions[-1] if ball_positions else None))
            ball_positions = [p for p in ball_positions if p is not None]  # strip Nones
            smoothed_pos = smooth_positions(ball_positions)

            offense_players, defense_players = get_players_by_team(results)

            possession     = None
            has_possession = False

            if smoothed_pos is not None:
                data = get_possession_player(smoothed_pos, offense_players)
                if data:
                    possession, distance = data
                    if distance < POSSESSION_THRESHOLD:
                        has_possession = True
                        possession_history.append(possession)

            defender_distance = None
            if has_possession:
                defender_distance = get_nearest_defender_distance(possession, defense_players)
                if defender_distance is not None:
                    advantage_history.append(defender_distance)

            possession_decision = evaluate_advantage_decision(advantage_history)
            event = classify_event(possession_history)

            if event:
                event_buffer.append(event)
                if len(event_buffer) > EVENT_BUFFER_SIZE:
                    event_buffer.pop(0)

            stable_event = is_stable_event(event_buffer)

            if event and possession_decision:
                sequence_buffer.append((event, possession_decision))
                if len(sequence_buffer) > SEQUENCE_LENGTH:
                    sequence_buffer.pop(0)

            sequence_feedback = interpret_sequence(sequence_buffer)
            coach_feedback = sequence_feedback or generate_coach_feedback(
                event, possession_decision, defender_distance
            )

            if stable_event and coach_feedback:
                if event != last_event or coach_feedback != last_feedback:
                    timeline.append({
                        "time":     round(frame_count / fps, 2),
                        "event":    event,
                        "decision": possession_decision,
                        "feedback": coach_feedback,
                    })
                    last_event    = event
                    last_feedback = coach_feedback

            annotated = results[0].plot()

            if smoothed_pos:
                cv2.circle(annotated, (int(smoothed_pos[0]), int(smoothed_pos[1])), 8, (0, 255, 0), -1)
            if has_possession and possession:
                cv2.circle(annotated, (int(possession[0]), int(possession[1])), 12, (0, 255, 255), 3)
            if coach_feedback:
                cv2.putText(
                    annotated, coach_feedback[:70], (30, 200),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2,
                )
        else:
            annotated = frame

        out.write(annotated)
        frame_count += 1

    cap.release()
    out.release()

    if not os.path.exists(raw_output_path):
        raise RuntimeError("Output video file was not created")
    if os.path.getsize(raw_output_path) < 1000:
        raise RuntimeError("Output video file is too small — encoding likely failed")

    output_path = convert_to_mp4(raw_output_path)
    logger.info(f"Processing complete -> {output_path}")

    return {
        "timeline":     timeline,
        "video_url":    f"/video/{Path(output_path).name}",
        "total_events": len(timeline),
        "duration":     round(frame_count / fps, 2),
    }


# -----------------------------
# ROUTES
# -----------------------------
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Sanitize filename to avoid path traversal
    safe_name = Path(file.filename).name
    video_path = TEMP_DIR / safe_name

    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = run_analysis(str(video_path), get_model())
        return result

    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up the raw upload (the annotated output is kept for /video serving)
        if video_path.exists():
            video_path.unlink(missing_ok=True)


@app.get("/video/{filename}")
def get_video(filename: str):
    # Prevent directory traversal
    safe_name = Path(filename).name
    file_path = TEMP_DIR / safe_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    media_type = "video/x-msvideo" if filename.endswith(".avi") else "video/mp4"
    return FileResponse(str(file_path), media_type=media_type)


# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://courtiq.cfd",
        "https://www.courtiq.cfd",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https://.*\.trycloudflare\.com|https://.*\.courtiq\.cfd",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)