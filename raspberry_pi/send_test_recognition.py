import os
from datetime import datetime

import requests


API_URL = os.getenv("ATTENDANCE_API_URL", "http://localhost:5050")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "")


payload = {
    "person_id": "STU001",
    "name": "Diya Shrestha",
    "confidence": 91.4,
    "status": "recognised",
    "time": datetime.now().isoformat(),
    "device_id": "raspberry-pi-door-01",
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

print("Recognition sent successfully:")
print(response.json())
