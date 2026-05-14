"""
pi_control_server.py — Flask control server for the Pi.

Runs permanently on port 5001. The Node.js web app calls this server
to start/stop the face recognition script and to poll Pi health.

Run via systemd (see pi-control.service) so it starts on boot.
"""

import os
import subprocess
import threading
import time
import psutil
from flask import Flask, request, jsonify, Response
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

CONTROL_KEY        = os.getenv("CONTROL_KEY", "")
SCRIPT_DIR         = os.path.dirname(os.path.abspath(__file__))
RECOGNITION_SCRIPT = os.path.join(SCRIPT_DIR, "03_recognize_attendance.py")
CAPTURE_SCRIPT     = os.path.join(SCRIPT_DIR, "01_capture_faces.py")
TRAIN_SCRIPT       = os.path.join(SCRIPT_DIR, "02_train_model.py")
PYTHON_BIN         = os.path.join(SCRIPT_DIR, "venv", "bin", "python")

# Fall back to system python if venv doesn't exist yet
if not os.path.exists(PYTHON_BIN):
    import sys
    PYTHON_BIN = sys.executable

_recognition_process = None

# ── Job tracking (capture / train) ────────────────────────────────────────────

_job_process  = None
_job_type     = None   # 'capture' | 'train'
_job_output   = []     # rolling last-100 lines of stdout+stderr
_job_exit     = None   # exit code once done


def _stream_job(proc):
    """Background thread: read stdout/stderr and store lines."""
    global _job_exit
    for raw in proc.stdout:
        line = raw.rstrip()
        if line:
            _job_output.append(line)
            if len(_job_output) > 100:
                _job_output.pop(0)
    proc.wait()
    _job_exit = proc.returncode


def _start_job(cmd, job_name):
    """Kill any running job, then launch cmd."""
    global _job_process, _job_type, _job_output, _job_exit

    if _job_process and _job_process.poll() is None:
        _job_process.terminate()
        try:
            _job_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _job_process.kill()

    _job_output = []
    _job_exit   = None
    _job_type   = job_name

    env = os.environ.copy()
    env["HEADLESS"] = "1"

    _job_process = subprocess.Popen(
        cmd,
        cwd=SCRIPT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    threading.Thread(target=_stream_job, args=(_job_process,), daemon=True).start()
    return _job_process


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


STREAM_FRAME = "/tmp/pi_frame.jpg"


@app.route("/control/stream", methods=["GET"])
def stream():
    """MJPEG stream — serves the latest frame written by the recognition script."""
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    def generate():
        while True:
            if os.path.exists(STREAM_FRAME):
                try:
                    with open(STREAM_FRAME, "rb") as f:
                        data = f.read()
                    yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + data + b"\r\n"
                except OSError:
                    pass
            time.sleep(0.1)   # ~10 fps cap

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/control/capture", methods=["POST"])
def start_capture():
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    data       = request.get_json(silent=True) or {}
    student_id = data.get("studentId", "").strip()
    count      = int(data.get("count", 30))

    if not student_id:
        return jsonify({"error": "studentId is required"}), 400

    proc = _start_job([PYTHON_BIN, CAPTURE_SCRIPT, student_id, str(count)], "capture")
    print(f"[CONTROL] Capture started for {student_id} (PID {proc.pid})")
    return jsonify({"status": "started", "pid": proc.pid, "studentId": student_id, "count": count})


@app.route("/control/train", methods=["POST"])
def start_train():
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    proc = _start_job([PYTHON_BIN, TRAIN_SCRIPT], "train")
    print(f"[CONTROL] Training started (PID {proc.pid})")
    return jsonify({"status": "started", "pid": proc.pid})


@app.route("/control/job-status", methods=["GET"])
def job_status_route():
    if not _auth_ok():
        return jsonify({"error": "Unauthorized"}), 401

    running = _job_process is not None and _job_process.poll() is None
    return jsonify({
        "running":   running,
        "type":      _job_type,
        "output":    _job_output[-50:],
        "exit_code": _job_exit,
        "pid":       _job_process.pid if _job_process else None,
    })


if __name__ == "__main__":
    print("[CONTROL] Pi control server starting on port 5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
