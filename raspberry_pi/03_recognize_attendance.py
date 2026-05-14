"""
03_recognize_attendance.py — Real-time face recognition + attendance marking.

Changes from original:
  - Removed inline API queue; api_client.py now handles all HTTP/offline logic
  - mark_attendance() calls api_client.send_attendance() instead of queuing raw payloads
  - HEADLESS env var suppresses the cv2 window when launched by pi_control_server
  - SESSION_ID env var tags each attendance event with the active class session
"""

import face_recognition
import pickle
import cv2
import time
import os
import csv
import threading
from datetime import datetime
from picamera2 import Picamera2

import api_client  # handles all HTTP communication + offline queuing

ENCODINGS_FILE = "encodings.pickle"
ATTENDANCE_DIR = "attendance"
TOLERANCE      = 0.45   # lower = stricter match (0.4–0.5 is good)
PROCESS_EVERY_N = 3     # process every Nth frame for speed
SCALE           = 0.5   # downscale for faster detection

# Set by pi_control_server when launching as a background process
HEADLESS   = os.environ.get("HEADLESS",   "0") == "1"
SESSION_ID = os.environ.get("SESSION_ID", None)


# ── Attendance marking ────────────────────────────────────────────────────────

def mark_attendance(name: str, confidence: float, logged_today: set):
    """
    Send an attendance event to the web app and write a local CSV backup.
    Each person is only logged once per script run (logged_today guards this).
    """
    if name in logged_today or name == "Unknown":
        return

    today     = datetime.now().strftime("%Y-%m-%d")
    timestamp = datetime.now().strftime("%H:%M:%S")

    # Non-blocking — queued and auto-retried by api_client if server is down
    api_client.send_attendance(name, confidence, session_id=SESSION_ID)

    # Local CSV backup (useful if the server is permanently unreachable)
    csv_path = os.path.join(ATTENDANCE_DIR, f"attendance_{today}.csv")
    write_header = not os.path.exists(csv_path)
    with open(csv_path, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["StudentID", "Date", "Time", "Confidence"])
        writer.writerow([name, today, timestamp, f"{confidence:.3f}"])

    logged_today.add(name)
    print(f"[ATTENDANCE] {name} marked at {timestamp}  (conf={confidence:.2f})")


# ── Main recognition loop ─────────────────────────────────────────────────────

def main():
    print("[INFO] Loading face encodings…")
    with open(ENCODINGS_FILE, "rb") as f:
        data = pickle.loads(f.read())

    os.makedirs(ATTENDANCE_DIR, exist_ok=True)
    logged_today: set = set()

    picam2 = Picamera2()
    picam2.configure(picam2.create_preview_configuration(
        main={"format": "XRGB8888", "size": (640, 480)}
    ))
    picam2.start()
    time.sleep(2)

    frame_count = 0
    fps_start   = time.time()
    fps_frames  = 0
    fps         = 0.0
    last_boxes  = []
    last_names  = []

    mode = "HEADLESS" if HEADLESS else "GUI"
    print(f"[INFO] Recognition started ({mode}). Press 'q' to quit.")

    while True:
        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
        frame_count += 1
        fps_frames  += 1

        # ── Face detection (every Nth frame) ──────────────────────────────────
        if frame_count % PROCESS_EVERY_N == 0:
            small     = cv2.resize(frame, (0, 0), fx=SCALE, fy=SCALE)
            rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

            boxes     = face_recognition.face_locations(rgb_small, model="hog")
            encodings = face_recognition.face_encodings(rgb_small, boxes)
            names     = []

            for encoding in encodings:
                distances  = face_recognition.face_distance(data["encodings"], encoding)
                name       = "Unknown"
                confidence = 0.0

                if len(distances) > 0:
                    best = distances.argmin()
                    if distances[best] < TOLERANCE:
                        name       = data["names"][best]
                        confidence = 1.0 - distances[best]

                names.append(name)
                mark_attendance(name, confidence, logged_today)

            # Scale bounding boxes back to full-frame coordinates
            last_boxes = [
                (int(t / SCALE), int(r / SCALE), int(b / SCALE), int(l / SCALE))
                for (t, r, b, l) in boxes
            ]
            last_names = names

        # ── FPS counter ───────────────────────────────────────────────────────
        elapsed = time.time() - fps_start
        if elapsed >= 1.0:
            fps        = fps_frames / elapsed
            fps_frames = 0
            fps_start  = time.time()

        # ── GUI (skipped in headless mode) ────────────────────────────────────
        if not HEADLESS:
            for (top, right, bottom, left), name in zip(last_boxes, last_names):
                color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
                cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                cv2.putText(frame, name, (left, top - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            cv2.putText(frame, f"FPS: {fps:.1f}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

            cv2.imshow("Attendance System", frame)

        # waitKey must run even in headless mode so OpenCV processes events
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    picam2.stop()
    cv2.destroyAllWindows()
    print("[INFO] Recognition stopped.")


if __name__ == "__main__":
    main()
