"""
pi_control_server.py — Flask control server for the Pi.

Runs permanently on port 5001. The Node.js web app calls this server
to start/stop the face recognition script and to poll Pi health.

Run via systemd (see pi-control.service) so it starts on boot.
"""

import os
import subprocess
import psutil
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

CONTROL_KEY        = os.getenv("CONTROL_KEY", "")
RECOGNITION_SCRIPT = os.path.join(os.path.dirname(__file__), "03_recognize_attendance.py")
PYTHON_BIN         = os.path.join(os.path.dirname(__file__), "venv", "bin", "python")

# Fall back to system python if venv doesn't exist yet
if not os.path.exists(PYTHON_BIN):
    import sys
    PYTHON_BIN = sys.executable

_recognition_process = None


# ── Auth helper ───────────────────────────────────────────────────────────────

def _auth_ok() -> bool:
    """Return True only if the request carries the correct control key."""
    if not CONTROL_KEY:
        return True  # no key configured → open (dev mode)
    return request.headers.get("x-control-key") == CONTROL_KEY


def _is_running() -> bool:
    """Return True if the recognition subprocess is still alive."""
    global _recognition_process
    return _recognition_process is not None and _recognition_process.poll() is None


# ── CPU temperature ───────────────────────────────────────────────────────────

def _cpu_temp() -> float | None:
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            return round(int(f.read()) / 1000, 1)
    except Exception:
        return None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/control/health", methods=["GET"])
def health():
    """Simple liveness check — no auth required."""
    return jsonify({"status": "ok", "service": "pi-control"})


@app.route("/control/start", methods=["POST"])
def start_recognition():
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    global _recognition_process

    if _is_running():
        return jsonify({
            "status": "already_running",
            "pid": _recognition_process.pid,
        })

    data       = request.get_json(silent=True) or {}
    session_id = data.get("sessionId")

    env = os.environ.copy()
    env["HEADLESS"] = "1"         # suppress cv2.imshow window
    if session_id:
        env["SESSION_ID"] = str(session_id)

    _recognition_process = subprocess.Popen(
        [PYTHON_BIN, RECOGNITION_SCRIPT],
        cwd=os.path.dirname(RECOGNITION_SCRIPT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    print(f"[CONTROL] Recognition started (PID {_recognition_process.pid}, session={session_id})")
    return jsonify({
        "status":    "started",
        "pid":       _recognition_process.pid,
        "sessionId": session_id,
    })


@app.route("/control/stop", methods=["POST"])
def stop_recognition():
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    global _recognition_process

    if not _is_running():
        return jsonify({"status": "not_running"})

    pid = _recognition_process.pid
    _recognition_process.terminate()
    try:
        _recognition_process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        _recognition_process.kill()
        _recognition_process.wait()

    _recognition_process = None
    print(f"[CONTROL] Recognition stopped (was PID {pid})")
    return jsonify({"status": "stopped", "pid": pid})


@app.route("/control/status", methods=["GET"])
def status():
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    running = _is_running()
    return jsonify({
        "online":         True,
        "running":        running,
        "pid":            _recognition_process.pid if running else None,
        "cpu_percent":    psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
        "temperature":    _cpu_temp(),
    })


@app.route("/control/restart", methods=["POST"])
def restart_recognition():
    """Stop and immediately restart the recognition script."""
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    stop_recognition()

    data       = request.get_json(silent=True) or {}
    session_id = data.get("sessionId")

    env = os.environ.copy()
    env["HEADLESS"] = "1"
    if session_id:
        env["SESSION_ID"] = str(session_id)

    global _recognition_process
    _recognition_process = subprocess.Popen(
        [PYTHON_BIN, RECOGNITION_SCRIPT],
        cwd=os.path.dirname(RECOGNITION_SCRIPT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    print(f"[CONTROL] Recognition restarted (PID {_recognition_process.pid})")
    return jsonify({
        "status":    "restarted",
        "pid":       _recognition_process.pid,
        "sessionId": session_id,
    })


if __name__ == "__main__":
    print("[CONTROL] Pi control server starting on port 5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
