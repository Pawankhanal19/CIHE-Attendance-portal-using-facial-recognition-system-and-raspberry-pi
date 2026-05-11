"""
Template for the Raspberry Pi integration.

Replace recognise_face() with your OpenCV/Picamera2 recognition logic.
When a face is recognised, POST the result to the backend API.
"""

import os
import time
from datetime import datetime

import requests


API_URL = os.getenv("ATTENDANCE_API_URL", "http://localhost:5050")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "")
DEVICE_ID = os.getenv("DEVICE_ID", "raspberry-pi-door-01")


def recognise_face():
    # TODO: Replace with Picamera2 + OpenCV recognition.
    return {
        "person_id": "STU001",
        "name": "Diya Shrestha",
        "confidence": 91.4,
        "status": "recognised",
    }


def send_result(result):
    payload = {
        **result,
        "time": datetime.now().isoformat(),
        "device_id": DEVICE_ID,
        "device_name": "Raspberry Pi Door Camera",
        "location": "Main Entrance",
        "course_code": "ICT307",
        "session": "Lecture",
    }

    headers = {}
    if DEVICE_API_KEY:
        headers["x-api-key"] = DEVICE_API_KEY

    response = requests.post(f"{API_URL}/api/recognition", json=payload, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    while True:
        recognition = recognise_face()
        api_response = send_result(recognition)
        print(api_response)
        time.sleep(5)
