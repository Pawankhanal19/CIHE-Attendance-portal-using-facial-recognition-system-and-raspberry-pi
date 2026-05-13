import face_recognition
import pickle
import cv2
import time
import os
import csv
import json
import queue
import threading
import atexit
import requests
from datetime import datetime
from picamera2 import Picamera2

ENCODINGS_FILE = "encodings.pickle"
ATTENDANCE_DIR = "attendance"
TOLERANCE = 0.45        # lower = stricter match (0.4–0.5 is good)
PROCESS_EVERY_N = 3     # process every Nth frame for speed
SCALE = 0.5             # downscale for faster detection
OFFLINE_FILE   = "pending_attendance.jsonl"

API_URL        = os.getenv("ATTENDANCE_API_URL", "http://localhost:5050")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "")
DEVICE_ID      = os.getenv("DEVICE_ID", "raspberry-pi-door-01")

# ── Offline-capable API queue ─────────────────────────────────────────────────
_q = queue.Queue()

def _load_pending():
    if os.path.exists(OFFLINE_FILE):
        with open(OFFLINE_FILE) as f:
            for line in f:
                line = line.strip()
                if line:
                    _q.put(json.loads(line))
        os.remove(OFFLINE_FILE)

def _save_pending():
    if _q.empty():
        return
    with open(OFFLINE_FILE, "w") as f:
        while not _q.empty():
            f.write(json.dumps(_q.get()) + "\n")

def _api_worker():
    while True:
        payload = _q.get()
        sent = False
        while not sent:
            try:
                headers = {"x-api-key": DEVICE_API_KEY} if DEVICE_API_KEY else {}
                r = requests.post(f"{API_URL}/api/recognition",
                                  json=payload, headers=headers, timeout=5)
                data = r.json()
                print(f"[API] {data.get('message','?')}: {payload.get('person_id')}")
                sent = True
            except requests.exceptions.RequestException as e:
                print(f"[API] offline ({e}), retry in 10s")
                time.sleep(10)
        _q.task_done()

_load_pending()
threading.Thread(target=_api_worker, daemon=True).start()
atexit.register(_save_pending)
# ─────────────────────────────────────────────────────────────────────────────

def mark_attendance(name, confidence, logged_today):
    if name in logged_today or name == "Unknown":
        return
    today = datetime.now().strftime("%Y-%m-%d")
    timestamp = datetime.now().strftime("%H:%M:%S")

    # Send to web app (non-blocking; queued and retried if offline)
    _q.put({
        "person_id":   name,
        "confidence":  round(confidence * 100, 1),  # server expects 0–100
        "status":      "recognised",
        "time":        datetime.now().isoformat(),
        "device_id":   DEVICE_ID,
        "device_name": "Raspberry Pi Door Camera",
        "location":    "Main Entrance",
        "course_code": "ICT307",
        "session":     "Lecture",
    })

    # CSV local backup
    csv_path = os.path.join(ATTENDANCE_DIR, f"attendance_{today}.csv")
    new_file = not os.path.exists(csv_path)
    with open(csv_path, "a", newline="") as f:
        writer = csv.writer(f)
        if new_file:
            writer.writerow(["Name", "Date", "Time", "Confidence"])
        writer.writerow([name, today, timestamp, f"{confidence:.3f}"])

    logged_today.add(name)
    print(f"[ATTENDANCE] {name} marked at {timestamp}")

def main():
    print("[INFO] Loading encodings...")
    with open(ENCODINGS_FILE, "rb") as f:
        data = pickle.loads(f.read())

    os.makedirs(ATTENDANCE_DIR, exist_ok=True)
    logged_today = set()
    # Note: logged_today starts empty every run, so each session re-logs
    # each person once. The CSV still appends, giving you a full history.

    picam2 = Picamera2()
    picam2.configure(picam2.create_preview_configuration(
        main={"format": 'XRGB8888', "size": (640, 480)}))
    picam2.start()
    time.sleep(2)

    frame_count = 0
    fps_start = time.time()
    fps_frames = 0
    fps = 0
    last_boxes = []
    last_names = []

    print("[INFO] Starting recognition. Press 'q' to quit.")

    while True:
        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
        frame_count += 1
        fps_frames += 1

        if frame_count % PROCESS_EVERY_N == 0:
            small = cv2.resize(frame, (0, 0), fx=SCALE, fy=SCALE)
            rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

            boxes = face_recognition.face_locations(rgb_small, model="hog")
            encodings = face_recognition.face_encodings(rgb_small, boxes)
            names = []

            for encoding in encodings:
                distances = face_recognition.face_distance(
                    data["encodings"], encoding)
                name = "Unknown"
                confidence = 0.0
                if len(distances) > 0:
                    best = distances.argmin()
                    if distances[best] < TOLERANCE:
                        name = data["names"][best]
                        confidence = 1.0 - distances[best]
                names.append(name)
                mark_attendance(name, confidence, logged_today)

            # Scale boxes back to full frame size
            last_boxes = [(int(t/SCALE), int(r/SCALE), int(b/SCALE), int(l/SCALE))
                          for (t, r, b, l) in boxes]
            last_names = names

        # Draw on full-res frame
        for ((top, right, bottom, left), name) in zip(last_boxes, last_names):
            color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            cv2.putText(frame, name, (left, top - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # FPS counter
        if time.time() - fps_start >= 1.0:
            fps = fps_frames / (time.time() - fps_start)
            fps_frames = 0
            fps_start = time.time()
        cv2.putText(frame, f"FPS: {fps:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        cv2.imshow("Attendance System", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    picam2.stop()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
