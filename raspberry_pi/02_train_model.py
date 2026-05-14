import face_recognition
import pickle
import cv2
import os
from imutils import paths


def train():
    print("[INFO] Loading face images...", flush=True)
    image_paths = list(paths.list_images("dataset"))
    if not image_paths:
        print("[ERROR] No images found in dataset/ — run capture first.", flush=True)
        return

    known_encodings = []
    known_names = []

    for (i, image_path) in enumerate(image_paths):
        name = image_path.split(os.path.sep)[-2]
        print(f"[INFO] Processing {i+1}/{len(image_paths)} — {name}", flush=True)

        image = cv2.imread(image_path)
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        boxes = face_recognition.face_locations(rgb, model="hog")
        encodings = face_recognition.face_encodings(rgb, boxes)

        for encoding in encodings:
            known_encodings.append(encoding)
            known_names.append(name)

    print(f"[INFO] Serializing {len(known_encodings)} encodings...", flush=True)
    data = {"encodings": known_encodings, "names": known_names}
    with open("encodings.pickle", "wb") as f:
        f.write(pickle.dumps(data))
    print("[DONE] Training complete.", flush=True)


if __name__ == "__main__":
    train()
