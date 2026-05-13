# Backend, MongoDB, and Raspberry Pi Integration

This project uses the existing frontend as the dashboard and adds:

- Node.js + Express backend API
- MongoDB database through Mongoose
- Socket.IO live recognition updates
- Raspberry Pi Python sender scripts

## 1. Start MongoDB

Use a local MongoDB server or MongoDB Atlas.

Local example:

```bash
mongod
```

MongoDB Atlas example connection string:

```text
mongodb+srv://USERNAME:PASSWORD@cluster-url/cihe_attendance
```

## 2. Configure Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Default backend URL:

```text
http://localhost:5050
```

Important `.env` values:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/cihe_attendance
FRONTEND_ORIGIN=http://localhost:8000
DEVICE_API_KEY=change-this-device-key
AUTH_SECRET=change-this-auth-secret
```

For early testing, you can leave `DEVICE_API_KEY` empty. For the final demo, set it and use the same value on the Raspberry Pi.

## 3. Serve the Frontend

From the project root:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## 4. Test Raspberry Pi API Flow

From the project root:

```bash
cd raspberry_pi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ATTENDANCE_API_URL=http://localhost:5050 DEVICE_API_KEY=change-this-device-key python send_test_recognition.py
```

If the backend receives the event, the dashboard can update through Socket.IO and the record is saved in MongoDB.

## 5. Main API Endpoints

```text
POST   /api/auth/login
GET    /api/health
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/recognition
GET    /api/recognition-logs
GET    /api/devices
```

Default test logins created by the backend:

```text
Admin:    admin / admin123
Lecturer: lecturer / lecturer123
Student:  student / student123
```

Admin can add students, lecturers, and admins. Lecturer can add students only. Students cannot create accounts.

## 6. Raspberry Pi Production Flow

```text
Camera captures frame
OpenCV recognises person
Pi sends POST /api/recognition
Backend stores attendance log in MongoDB
Backend emits Socket.IO event
Frontend dashboard updates live
```
<<<<<<< HEAD
=======

Hi this is awesome project, that is created by the group no.1 and is quite a achievement to have
>>>>>>> my-project
