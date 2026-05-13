require('dotenv').config()

const cors = require('cors')
const express = require('express')
const http = require('http')
const mongoose = require('mongoose')
const crypto = require('crypto')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)

const PORT = process.env.PORT || 5050
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cihe_attendance'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || ''
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-auth-secret-change-me'

app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }))
app.use(express.json({ limit: '2mb' }))

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
})

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, enum: ['Student', 'Lecturer', 'Admin'], default: 'Student' },
    email: { type: String, trim: true },
    studentId: { type: String, trim: true, index: true },
    faceEncodingRef: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    deviceName: { type: String, trim: true },
    location: { type: String, trim: true },
    status: { type: String, enum: ['online', 'offline'], default: 'online' },
    lastSeen: { type: Date, default: Date.now },
    ipAddress: { type: String, trim: true },
  },
  { timestamps: true }
)

const attendanceLogSchema = new mongoose.Schema(
  {
    personId: { type: String, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    confidence: { type: Number, min: 0, max: 100 },
    status: { type: String, enum: ['recognised', 'unrecognised', 'manual', 'error'], required: true },
    attendanceStatus: { type: String, enum: ['Present', 'Late', 'Absent', 'Denied'], default: 'Present' },
    courseCode: { type: String, trim: true, default: 'ICT307' },
    session: { type: String, trim: true, default: 'Lecture' },
    deviceId: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true, default: Date.now },
    rawPayload: { type: Object },
  },
  { timestamps: true }
)

const classSessionSchema = new mongoose.Schema(
  {
    courseCode:   { type: String, required: true, trim: true },
    room:         { type: String, trim: true },
    lecturerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lecturerName: { type: String, trim: true },
    startTime:    { type: Date, required: true, default: Date.now },
    endTime:      { type: Date },
    status:       { type: String, enum: ['active', 'ended'], default: 'active' },
  },
  { timestamps: true }
)

const sessionNoteSchema = new mongoose.Schema(
  {
    courseCode: { type: String, trim: true, default: 'ICT307' },
    session: { type: String, trim: true, default: 'Lecture' },
    notes: { type: String, required: true },
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lecturerName: { type: String, trim: true },
  },
  { timestamps: true }
)

const User = mongoose.model('User', userSchema)
const Device = mongoose.model('Device', deviceSchema)
const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema)
const SessionNote = mongoose.model('SessionNote', sessionNoteSchema)
const ClassSession = mongoose.model('ClassSession', classSessionSchema)

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return { salt, hash }
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'))
}

function signToken(user) {
  const payload = {
    id: user._id.toString(),
    role: user.role,
    username: user.username,
    exp: Date.now() + 1000 * 60 * 60 * 8,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null

  const [body, signature] = token.split('.')
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  if (signature !== expected) return null

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (payload.exp < Date.now()) return null
  return payload
}

function toClientUser(user) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    username: user.username,
    role: user.role,
    email: user.email,
    studentId: user.studentId,
    active: user.active,
    createdAt: user.createdAt,
  }
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const auth = verifyToken(token)

  if (!auth) return res.status(401).json({ message: 'Please log in again.' })
  req.auth = auth
  next()
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'You are not authorised for this action.' })
    }
    next()
  }
}

app.get('/', (req, res) => {
  res.json({
    message: 'CIHE Attendance Backend API is running.',
    frontend: 'http://localhost:8000',
    health: '/api/health',
    users: '/api/users',
    recognition_logs: '/api/recognition-logs',
    raspberry_pi_endpoint: 'POST /api/recognition',
  })
})

function requireDeviceKey(req, res, next) {
  if (!DEVICE_API_KEY) return next()

  const providedKey = req.get('x-api-key')
  if (providedKey !== DEVICE_API_KEY) {
    return res.status(401).json({ message: 'Invalid or missing device API key.' })
  }

  next()
}

function toClientLog(log) {
  return {
    id: log._id,
    person_id: log.personId,
    user_id: log.user,
    name: log.name,
    confidence: log.confidence,
    status: log.status,
    attendance_status: log.attendanceStatus,
    course_code: log.courseCode,
    session: log.session,
    device_id: log.deviceId,
    time: log.timestamp,
    created_at: log.createdAt,
  }
}

app.get('/api/health', async (req, res) => {
  const devicesOnline = await Device.countDocuments({ status: 'online' })
  const logsCount = await AttendanceLog.countDocuments()

  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'not_connected',
    devices_online: devicesOnline,
    attendance_logs: logsCount,
    time: new Date().toISOString(),
  })
})

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' })
  }

  const user = await User.findOne({ username, active: true })
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ message: 'Invalid username or password.' })
  }

  res.json({
    token: signToken(user),
    user: toClientUser(user),
  })
})

app.get('/api/users', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const users = await User.find({ active: true }).sort({ createdAt: -1 })
  res.json(users.map(toClientUser))
})

app.post('/api/users', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const role = req.body.role || 'Student'
  if (req.auth.role === 'Lecturer' && role !== 'Student') {
    return res.status(403).json({ message: 'Lecturers can only add student accounts.' })
  }

  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!username || !password || !req.body.name) {
    return res.status(400).json({ message: 'Name, username, and password are required.' })
  }

  const passwordData = hashPassword(password)
  const user = await User.create({
    name: req.body.name,
    username,
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    role,
    email: req.body.email,
    studentId: req.body.student_id || req.body.studentId,
    faceEncodingRef: req.body.face_encoding_ref || req.body.faceEncodingRef,
  })

  const clientUser = toClientUser(user)
  io.emit('users_updated', clientUser)
  res.status(201).json(clientUser)
})

app.put('/api/users/:id', requireAuth, requireRoles(['Admin']), async (req, res) => {
  const updates = {
    name: req.body.name,
    username: req.body.username,
    role: req.body.role,
    email: req.body.email,
    studentId: req.body.student_id || req.body.studentId,
    faceEncodingRef: req.body.face_encoding_ref || req.body.faceEncodingRef,
  }

  if (req.body.password) {
    const passwordData = hashPassword(req.body.password)
    updates.passwordHash = passwordData.hash
    updates.passwordSalt = passwordData.salt
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  )

  if (!user) return res.status(404).json({ message: 'User not found.' })

  const clientUser = toClientUser(user)
  io.emit('users_updated', clientUser)
  res.json(clientUser)
})

app.delete('/api/users/:id', requireAuth, requireRoles(['Admin']), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true })
  if (!user) return res.status(404).json({ message: 'User not found.' })

  io.emit('users_updated', { id: req.params.id, deleted: true })
  res.json({ message: 'User removed.' })
})

app.get('/api/recognition-logs', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const query = {}

  if (req.query.person_id) query.personId = req.query.person_id
  if (req.query.device_id) query.deviceId = req.query.device_id

  const logs = await AttendanceLog.find(query).sort({ timestamp: -1 }).limit(limit)
  res.json(logs.map(toClientLog))
})

app.post('/api/recognition', requireDeviceKey, async (req, res) => {
  const payload = req.body || {}
  const personId = payload.person_id || payload.personId
  const deviceId = payload.device_id || payload.deviceId || 'unknown-device'
  const status = payload.status || (personId ? 'recognised' : 'unrecognised')
  const timestamp = payload.time ? new Date(payload.time) : new Date()

  const matchedUser = personId
    ? await User.findOne({ $or: [{ studentId: personId }, { _id: mongoose.isValidObjectId(personId) ? personId : null }] })
    : null

  await Device.findOneAndUpdate(
    { deviceId },
    {
      deviceId,
      deviceName: payload.device_name || payload.deviceName || deviceId,
      location: payload.location,
      status: 'online',
      lastSeen: new Date(),
      ipAddress: req.ip,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  const log = await AttendanceLog.create({
    personId,
    user: matchedUser?._id,
    name: payload.name || matchedUser?.name || 'Unknown Person',
    confidence: payload.confidence,
    status,
    attendanceStatus: status === 'recognised' ? 'Present' : 'Denied',
    courseCode: payload.course_code || payload.courseCode || 'ICT307',
    session: payload.session || 'Lecture',
    deviceId,
    timestamp,
    rawPayload: payload,
  })

  const clientLog = toClientLog(log)
  io.emit('face_recognised', clientLog)
  io.emit('attendance_updated', clientLog)

  res.status(201).json({
    message: 'Recognition data received.',
    log: clientLog,
  })
})

app.get('/api/devices', async (req, res) => {
  const devices = await Device.find().sort({ lastSeen: -1 })
  res.json(devices)
})

app.put('/api/recognition-logs/:id', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const { attendanceStatus } = req.body
  if (!['Present', 'Late', 'Absent', 'Denied'].includes(attendanceStatus)) {
    return res.status(400).json({ message: 'Invalid attendance status.' })
  }
  const log = await AttendanceLog.findByIdAndUpdate(
    req.params.id,
    { attendanceStatus, status: 'manual' },
    { new: true }
  )
  if (!log) return res.status(404).json({ message: 'Log not found.' })
  const clientLog = toClientLog(log)
  io.emit('attendance_updated', clientLog)
  res.json(clientLog)
})

app.get('/api/analytics', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const [total, present, late, absent, denied, byCourse, recentLogs] = await Promise.all([
    AttendanceLog.countDocuments(),
    AttendanceLog.countDocuments({ attendanceStatus: 'Present' }),
    AttendanceLog.countDocuments({ attendanceStatus: 'Late' }),
    AttendanceLog.countDocuments({ attendanceStatus: 'Absent' }),
    AttendanceLog.countDocuments({ attendanceStatus: 'Denied' }),
    AttendanceLog.aggregate([
      { $group: { _id: '$courseCode', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'Present'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    AttendanceLog.find().sort({ timestamp: -1 }).limit(50),
  ])
  res.json({ total, present, late, absent, denied, byCourse, recentLogs: recentLogs.map(toClientLog) })
})

app.post('/api/sessions', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const { courseCode, room } = req.body
  if (!courseCode || !courseCode.trim()) {
    return res.status(400).json({ message: 'Course code is required to start a session.' })
  }

  await ClassSession.updateMany(
    { lecturerId: req.auth.id, status: 'active' },
    { status: 'ended', endTime: new Date() }
  )

  const lecturer = await User.findById(req.auth.id)
  const session = await ClassSession.create({
    courseCode: courseCode.trim(),
    room: room?.trim() || '',
    lecturerId: req.auth.id,
    lecturerName: lecturer?.name || req.auth.username,
    startTime: new Date(),
  })

  res.status(201).json(session)
})

app.put('/api/sessions/:id/stop', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const session = await ClassSession.findOneAndUpdate(
    { _id: req.params.id, lecturerId: req.auth.id },
    { status: 'ended', endTime: new Date() },
    { new: true }
  )
  if (!session) return res.status(404).json({ message: 'Session not found.' })
  res.json(session)
})

app.get('/api/sessions', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const query = req.auth.role === 'Lecturer' ? { lecturerId: req.auth.id } : {}
  const sessions = await ClassSession.find(query).sort({ startTime: -1 }).limit(limit)
  res.json(sessions)
})

app.post('/api/session-notes', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const { notes, courseCode, session } = req.body
  if (!notes || !notes.trim()) {
    return res.status(400).json({ message: 'Notes cannot be empty.' })
  }

  const lecturer = await User.findById(req.auth.id)
  const note = await SessionNote.create({
    notes: notes.trim(),
    courseCode: courseCode || 'ICT307',
    session: session || 'Lecture',
    lecturerId: req.auth.id,
    lecturerName: lecturer?.name || req.auth.username,
  })

  res.status(201).json(note)
})

app.get('/api/session-notes', requireAuth, requireRoles(['Admin', 'Lecturer']), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const query = {}
  if (req.query.course_code) query.courseCode = req.query.course_code
  if (req.auth.role === 'Lecturer') query.lecturerId = req.auth.id

  const notes = await SessionNote.find(query).sort({ createdAt: -1 }).limit(limit)
  res.json(notes)
})

app.get('/api/weekly-attendance', requireAuth, async (req, res) => {
  const personId = req.query.person_id
  if (!personId) return res.status(400).json({ message: 'person_id query parameter is required.' })

  const HOURS_PER_SESSION = 3

  const [myLogs, allLogs] = await Promise.all([
    AttendanceLog.find({ personId }).sort({ timestamp: 1 }).lean(),
    AttendanceLog.find({}).select('timestamp').lean(),
  ])

  if (myLogs.length === 0) return res.json([])

  // Any day where ANY student was recognised counts as a class day
  const classDaySet = new Set(allLogs.map(l => new Date(l.timestamp).toISOString().slice(0, 10)))

  // Map of dates this student attended: YYYY-MM-DD → hours attended
  const myDayMap = {}
  for (const log of myLogs) {
    const dk = new Date(log.timestamp).toISOString().slice(0, 10)
    if (log.attendanceStatus === 'Present' || log.attendanceStatus === 'Late') {
      myDayMap[dk] = HOURS_PER_SESSION  // one class per day — multiple scans don't stack
    } else if (!myDayMap[dk]) {
      myDayMap[dk] = 0
    }
  }

  function getMonday(date) {
    const d = new Date(date)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    return d
  }

  function fmtDate(d) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  }

  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const weeks = []
  let cumAttd = 0, cumClass = 0

  let cursor = getMonday(new Date(myLogs[0].timestamp))
  const todayMonday = getMonday(new Date())

  while (cursor <= todayMonday) {
    const wStart = new Date(cursor)
    const wEnd   = new Date(cursor)
    wEnd.setDate(wEnd.getDate() + 6)

    const days = {}
    let weeklyAttd = 0, weeklyClass = 0

    for (let i = 0; i < 7; i++) {
      const day = new Date(wStart)
      day.setDate(day.getDate() + i)
      const dk = day.toISOString().slice(0, 10)

      if (classDaySet.has(dk)) {
        weeklyClass += HOURS_PER_SESSION
        days[DAY_KEYS[i]] = myDayMap[dk] ?? 0
        weeklyAttd += myDayMap[dk] ?? 0
      } else {
        days[DAY_KEYS[i]] = 'NC'
      }
    }

    cumAttd  += weeklyAttd
    cumClass += weeklyClass

    weeks.push({
      term: 1,
      weekRange: `${fmtDate(wStart)} - ${fmtDate(wEnd)}`,
      days,
      studyHrs:        weeklyAttd,
      otherHrs:        0,
      weeklyAttdHrs:   weeklyAttd,
      weeklyClassHrs:  weeklyClass,
      weeklyAttdPct:   weeklyClass > 0 ? Math.round(weeklyAttd / weeklyClass * 10000) / 100 : null,
      semesterCurrAttd: cumClass > 0  ? Math.round(cumAttd  / cumClass  * 10000) / 100 : null,
      _cumAttd:  cumAttd,
      _cumClass: cumClass,
    })

    cursor.setDate(cursor.getDate() + 7)
  }

  // Semester Proj. Attd. — if student attends 100% of remaining weeks, max possible %
  const avgWeeklyClass = weeks.reduce((s, w) => s + w.weeklyClassHrs, 0) / weeks.length || HOURS_PER_SESSION * 3
  for (let i = 0; i < weeks.length; i++) {
    const futureClass    = (weeks.length - 1 - i) * avgWeeklyClass
    const totalPossible  = weeks[i]._cumClass + futureClass
    weeks[i].semesterProjAttd = totalPossible > 0
      ? Math.round((weeks[i]._cumAttd + futureClass) / totalPossible * 10000) / 100
      : null
    delete weeks[i]._cumAttd
    delete weeks[i]._cumClass
  }

  res.json(weeks)
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ message: 'Server error.', detail: err.message })
})

async function start() {
  await mongoose.connect(MONGODB_URI)
  console.log(`MongoDB connected: ${MONGODB_URI}`)

  await seedDefaultUsers()

  server.listen(PORT, () => {
    console.log(`Attendance API running on http://localhost:${PORT}`)
  })
}

async function seedDefaultUsers() {
  const defaults = [
    { name: 'System Admin', username: 'admin', password: 'admin123', role: 'Admin', email: 'admin@cihe.edu.au' },
    { name: 'Demo Lecturer', username: 'lecturer', password: 'lecturer123', role: 'Lecturer', email: 'lecturer@cihe.edu.au' },
    { name: 'Demo Student', username: 'student', password: 'student123', role: 'Student', email: 'student@cihe.edu.au', studentId: 'STU001' },
  ]

  for (const account of defaults) {
    const exists = await User.findOne({ username: account.username })
    if (exists) continue

    const passwordData = hashPassword(account.password)
    await User.create({
      ...account,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
    })
  }
}

start().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
