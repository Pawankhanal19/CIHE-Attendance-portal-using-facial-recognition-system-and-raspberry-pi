import cv2
import os
import sys
from picamera2 import Picamera2
import time

HEADLESS = os.environ.get("HEADLESS", "0") == "1"


def capture_faces(person_name, num_samples=30):
    folder = f"dataset/{person_name}"
    os.makedirs(folder, exist_ok=True)

    picam2 = Picamera2()
    picam2.configure(picam2.create_preview_configuration(
        main={"format": 'XRGB8888', "size": (640, 480)}))
    picam2.start()
    time.sleep(2)

    cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')

    count = 0
    print(f"[INFO] Capturing {num_samples} samples for {person_name}", flush=True)
    if not HEADLESS:
        print("[INFO] Look at the camera, move slightly between captures. Press 'q' to quit early.", flush=True)

    while count < num_samples:
        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.3, 5, minSize=(80, 80))

        for (x, y, w, h) in faces:
            count += 1
            face_img = frame[y:y+h, x:x+w]
            cv2.imwrite(f"{folder}/{person_name}_{count}.jpg", face_img)
            print(f"[CAPTURE] {count}/{num_samples}", flush=True)
            time.sleep(0.3)
            break

        if not HEADLESS:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2) if len(faces) else None
            cv2.putText(frame, f"Captured: {count}/{num_samples}",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.imshow("Capturing", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    picam2.stop()
    if not HEADLESS:
        cv2.destroyAllWindows()
    print(f"[DONE] Saved {count} images to {folder}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python 01_capture_faces.py <person_name> [num_samples]")
        sys.exit(1)
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    capture_faces(sys.argv[1], count)
