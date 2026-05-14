"""
api_client.py — Attendance API sender with offline queuing.

Import this module in 03_recognize_attendance.py and call
send_attendance() whenever a face is recognised.

The background worker thread handles all HTTP communication so the
recognition loop is never blocked by network delays or outages.
Unsent events are written to disk on exit and replayed on next startup.
"""

import json
import os
import queue
import threading
import time
import atexit
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL      = os.getenv("API_URL",  "http://localhost:5050")
API_KEY      = os.getenv("API_KEY",  "")
OFFLINE_FILE = "pending_attendance.jsonl"

_q = queue.Queue()


# ── Persistence across restarts ───────────────────────────────────────────────

def _load_pending():
    """Re-queue events that were not sent during the previous run."""
    if not os.path.exists(OFFLINE_FILE):
        return
    with open(OFFLINE_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    _q.put(json.loads(line))
                except json.JSONDecodeError:
                    pass
    os.remove(OFFLINE_FILE)
    print(f"[API] Loaded pending events from {OFFLINE_FILE}")


def _save_pending():
    """Flush the queue to disk on clean shutdown."""
    if _q.empty():
        return
    with open(OFFLINE_FILE, "w") as f:
        while not _q.empty():
            f.write(json.dumps(_q.get()) + "\n")
    print(f"[API] Saved unsent events to {OFFLINE_FILE}")


# ── Public interface ──────────────────────────────────────────────────────────

def send_attendance(student_id: str, confidence: float = None, session_id: str = None):
    """
    Queue an attendance event (non-blocking).

    Args:
        student_id:  The student's ID string (must exist in MongoDB).
        confidence:  Recognition confidence as a 0–1 float.
        session_id:  Optional active class session ObjectId string.
    """
    _q.put({
        "studentId":  student_id,
        "confidence": float(confidence) if confidence is not None else None,
        "timestamp":  datetime.now().isoformat(),
        "sessionId":  session_id,
    })


# ── Background worker ─────────────────────────────────────────────────────────

def _worker():
    """POST events to the web app, retrying indefinitely until they succeed."""
    while True:
        payload = _q.get()
        sent = False
        while not sent:
            try:
                headers = {"x-api-key": API_KEY} if API_KEY else {}
                r = requests.post(
                    f"{API_URL}/api/pi/attendance",
                    json=payload,
                    headers=headers,
                    timeout=5,
                )
                if r.status_code == 200:
                    data = r.json()
                    print(f"[API] {data.get('status', 'ok')}: {payload['studentId']}")
                    sent = True
                elif r.status_code == 404:
                    print(f"[API] Student not found: {payload['studentId']} — skipping")
                    sent = True  # no point retrying a missing student
                elif r.status_code == 401:
                    print("[API] 401 Unauthorized — check API_KEY in .env")
                    sent = True  # wrong key won't fix itself on retry
                else:
                    print(f"[API] HTTP {r.status_code}: {r.text[:100]} — retry in 5s")
                    time.sleep(5)
            except requests.exceptions.RequestException as e:
                print(f"[API] No connection ({e}). Retry in 10s")
                time.sleep(10)
        _q.task_done()


# ── Module init (runs once on import) ─────────────────────────────────────────

_load_pending()
threading.Thread(target=_worker, daemon=True).start()
atexit.register(_save_pending)
