// pages/LecturerPortal.jsx

const initialAttendance = [
  { id: 1, name: 'Student A', status: 'Present',        time: '09:02', recognized: true  },
  { id: 2, name: 'Student C', status: 'Not Recognized', time: '—',     recognized: false },
]

const initialAlerts = [
  { id: 1, message: 'Unrecognized face detected at ', highlight: '09:07' },
  { id: 2, message: 'Network restored at ',           highlight: '09:12' },
]

function LecturerPortal({ currentUser, onLogout }) {
  const [courseCode,    setCourseCode]    = React.useState('')
  const [roomSession,   setRoomSession]   = React.useState('')
  const [sessionActive, setSessionActive] = React.useState(false)
  const [notes,         setNotes]         = React.useState('')
  const [notesSaved,    setNotesSaved]    = React.useState(false)
  const [pendingSync,   setPendingSync]   = React.useState(2)
  const [synced,        setSynced]        = React.useState(33)
  const [attendance,    setAttendance]    = React.useState(initialAttendance)
  const [toast,         setToast]         = React.useState(null)  // { message, type: 'success'|'info'|'warning'|'error' }
  const [modal,         setModal]         = React.useState(null)  // { title, body, icon }
  const [overrideId,    setOverrideId]    = React.useState(null)  // student id being overridden
  const [overrideVal,   setOverrideVal]   = React.useState('Present')
  const [newStudent,    setNewStudent]    = React.useState({ name: '', username: '', password: '', email: '', studentId: '' })
  const [savedNotes,    setSavedNotes]    = React.useState([])
  const [savingNotes,   setSavingNotes]   = React.useState(false)
  const [activeSession, setActiveSession] = React.useState(null)  // ClassSession object from DB

  const navLinks = [{ label: 'Home', href: '#' }]

  React.useEffect(() => {
    let cancelled = false

    function attendanceRowFromLog(log) {
      const timestamp = new Date(log.time || log.created_at || Date.now())
      return {
        id: log.id,
        name: log.name,
        status: log.attendance_status || (log.status === 'recognised' ? 'Present' : 'Not Recognized'),
        time: timestamp.toTimeString().slice(0, 5),
        rawTimestamp: timestamp,
        recognized: log.status === 'recognised',
      }
    }

    async function loadAttendance() {
      try {
        const logs = await AttendanceAPI.fetchRecognitionLogs(20)
        if (!cancelled && logs.length > 0) {
          setAttendance(logs.map(attendanceRowFromLog))
          setSynced(logs.length)
          setPendingSync(0)
        }
      } catch (error) {
        console.warn('Backend unavailable, using demo lecturer data.', error)
      }
    }

    loadAttendance()
    const socket = AttendanceAPI.connectSocket()

    if (socket) {
      socket.on('attendance_updated', (log) => {
        setAttendance(prev => [attendanceRowFromLog(log), ...prev].slice(0, 20))
        setSynced(s => s + 1)
        showToast(`${log.name} attendance updated from Raspberry Pi.`, 'success')
      })
    }

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [])

  // ── Toast helper (auto-dismisses after 3s) ──────────────────
  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Modal helper ────────────────────────────────────────────
  function showModal(title, body, icon) {
    setModal({ title, body, icon: icon || 'ℹ️' })
  }

  // ── Session controls ────────────────────────────────────────
  async function handleStartSession() {
    if (!courseCode.trim()) {
      showToast('Please enter a course code before starting a session.', 'error')
      return
    }
    try {
      const session = await AttendanceAPI.startSession(courseCode, roomSession)
      setActiveSession(session)
      setSessionActive(true)
      showToast(`Session started for ${courseCode}${roomSession ? ' — ' + roomSession : ''} and saved to database.`, 'success')
    } catch (error) {
      showToast(error.message || 'Could not save session to backend.', 'error')
    }
  }

  async function handleAddStudent() {
    if (!newStudent.name.trim() || !newStudent.username.trim() || !newStudent.password.trim()) {
      showToast('Please enter student name, username, and password.', 'error')
      return
    }

    try {
      await AttendanceAPI.createUser({ ...newStudent, role: 'Student' })
      setNewStudent({ name: '', username: '', password: '', email: '', studentId: '' })
      showToast('Student login created successfully.', 'success')
    } catch (error) {
      showToast(error.message || 'Could not create student login.', 'error')
    }
  }

  async function handleStopSession() {
    if (!sessionActive) {
      showToast('No active session to stop.', 'warning')
      return
    }
    try {
      if (activeSession?._id) {
        await AttendanceAPI.stopSession(activeSession._id)
      }
    } catch (error) {
      console.warn('Could not update session end time:', error)
    }
    setSessionActive(false)
    setActiveSession(null)
    showToast(`Session for ${courseCode} has been stopped and saved to database.`, 'info')
  }

  function handleExportCSV() {
    if (attendance.length === 0) {
      showModal('Export CSV', 'No attendance records to export yet.', '📁')
      return
    }

    let rows = attendance
    if (activeSession) {
      const start = new Date(activeSession.startTime)
      const end   = activeSession.endTime ? new Date(activeSession.endTime) : new Date()
      rows = attendance.filter(s => s.rawTimestamp >= start && s.rawTimestamp <= end)
      if (rows.length === 0) {
        showModal('Export CSV', 'No attendance records were captured during this session.', '📁')
        return
      }
    }

    const csvRows = [['Student', 'Status', 'Time', 'Course', 'Room']]
    rows.forEach(s => csvRows.push([s.name, s.status, s.time, courseCode || 'ICT307', roomSession || 'Lecture']))
    const csv  = csvRows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance_${courseCode || 'session'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`CSV exported — ${rows.length} record(s) for ${courseCode || 'session'}.`, 'success')
  }

  // ── Sync controls ───────────────────────────────────────────
  async function handleSyncNow() {
    showToast('Syncing with database…', 'info')
    try {
      const logs = await AttendanceAPI.fetchRecognitionLogs(20)
      if (logs.length > 0) {
        setAttendance(logs.map(log => {
          const timestamp = new Date(log.time || log.created_at || Date.now())
          return {
            id: log.id,
            name: log.name,
            status: log.attendance_status || (log.status === 'recognised' ? 'Present' : 'Not Recognized'),
            time: timestamp.toTimeString().slice(0, 5),
            rawTimestamp: timestamp,
            recognized: log.status === 'recognised',
          }
        }))
        setSynced(logs.length)
        setPendingSync(0)
        showToast(`Synced — ${logs.length} record(s) loaded from database.`, 'success')
      } else {
        showToast('No records found in database.', 'info')
      }
    } catch (error) {
      showToast('Could not reach backend. Check the server is running.', 'error')
    }
  }

  // ── Attendance row actions ──────────────────────────────────
  async function handleMarkPresent(id) {
    const now = new Date().toTimeString().slice(0, 5)
    const student = attendance.find(s => s.id === id)
    setAttendance(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'Present', time: now, recognized: true } : s
    ))
    showToast(`${student.name} marked as Present.`, 'success')
    try {
      await AttendanceAPI.updateAttendanceLog(id, { attendanceStatus: 'Present' })
    } catch (error) {
      setPendingSync(p => p + 1)
    }
  }

  function handleRetry(id) {
    setAttendance(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'Scanning…', time: '—' } : s
    ))
    setTimeout(() => {
      setAttendance(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'Not Recognized', time: '—' } : s
      ))
      showToast('Face scan retried — student still not recognized. Try "Mark Present" manually.', 'warning')
    }, 1500)
  }

  function handleOverrideOpen(id) {
    setOverrideId(id)
    setOverrideVal('Present')
  }

  async function handleOverrideSave() {
    const now = new Date().toTimeString().slice(0, 5)
    const student = attendance.find(s => s.id === overrideId)
    setAttendance(prev => prev.map(s =>
      s.id === overrideId
        ? { ...s, status: overrideVal, time: overrideVal === 'Absent' ? '—' : now }
        : s
    ))
    showToast(`${student.name}'s status overridden to "${overrideVal}".`, 'info')
    setOverrideId(null)
    try {
      await AttendanceAPI.updateAttendanceLog(overrideId, { attendanceStatus: overrideVal })
    } catch (error) {
      setPendingSync(p => p + 1)
    }
  }

  function handleDetails(id) {
    const student = attendance.find(s => s.id === id)
    showModal(
      `Details — ${student.name}`,
      `Status: ${student.status}\nCheck-in Time: ${student.time}\nCourse: ${courseCode || 'N/A'}\nRoom: ${roomSession || 'N/A'}\n\nFull attendance history will be available once the backend is connected.`,
      '👤'
    )
  }

  // ── Session notes ───────────────────────────────────────────
  React.useEffect(() => {
    async function loadNotes() {
      try {
        const data = await AttendanceAPI.fetchSessionNotes()
        setSavedNotes(data)
      } catch (error) {
        console.warn('Could not load session notes:', error)
      }
    }
    loadNotes()
  }, [])

  async function handleSaveNotes() {
    if (!notes.trim()) {
      showToast('Nothing to save — notes are empty.', 'warning')
      return
    }
    setSavingNotes(true)
    try {
      const saved = await AttendanceAPI.saveSessionNote(notes.trim(), courseCode, roomSession)
      setSavedNotes(prev => [saved, ...prev])
      setNotesSaved(true)
      setNotes('')
      showToast('Notes saved to database successfully!', 'success')
      setTimeout(() => setNotesSaved(false), 3000)
    } catch (error) {
      showToast(error.message || 'Could not save notes. Is the backend running?', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  // ── Derived counts ──────────────────────────────────────────
  const totalStudents = 40
  const presentCount  = attendance.filter(s => s.status === 'Present').length + 35
  const absentCount   = totalStudents - presentCount

  // ── Toast colours ───────────────────────────────────────────
  const toastColours = {
    success: { background: '#d3f9d8', border: '#8ce99a', color: '#2f9e44' },
    info:    { background: '#dde4ff', border: '#748ffc', color: '#3b5bdb' },
    warning: { background: '#fff9db', border: '#ffe066', color: '#c18a00' },
    error:   { background: '#ffe3e3', border: '#ffa8a8', color: '#c92a2a' },
  }

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
  }
  const modalBoxStyle = {
    background: 'white', padding: '30px', borderRadius: '14px',
    width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
  }

  return (
    <div className="dashboard-body">
      <Sidebar role="Lecturer" navLinks={navLinks} onLogout={onLogout} />

      <main className="main-content">

        {/* ── Toast notification ── */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '24px', zIndex: 300,
            padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            maxWidth: '340px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: `1px solid ${toastColours[toast.type].border}`,
            background: toastColours[toast.type].background,
            color: toastColours[toast.type].color,
            transition: 'all 0.3s'
          }}>
            {toast.message}
          </div>
        )}

        {/* ── Info modal ── */}
        {modal && (
          <div style={overlayStyle}>
            <div style={{ ...modalBoxStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '42px', marginBottom: '12px' }}>{modal.icon}</div>
              <h3 style={{ color: '#3b5bdb', fontSize: '17px', marginBottom: '12px' }}>{modal.title}</h3>
              <p style={{ color: '#4a5a8a', fontSize: '13px', lineHeight: 1.7, marginBottom: '22px', whiteSpace: 'pre-line' }}>
                {modal.body}
              </p>
              <button className="btn-secondary-blue" style={{ width: '100%' }} onClick={() => setModal(null)}>
                OK, Got It
              </button>
            </div>
          </div>
        )}

        {/* ── Override modal ── */}
        {overrideId !== null && (
          <div style={overlayStyle}>
            <div style={modalBoxStyle}>
              <h3 style={{ color: '#3b5bdb', fontSize: '16px', marginBottom: '16px' }}>
                Override Attendance — {attendance.find(s => s.id === overrideId)?.name}
              </h3>
              <p style={{ color: '#4a5a8a', fontSize: '13px', marginBottom: '14px' }}>
                Select the correct attendance status for this student:
              </p>
              <select
                value={overrideVal}
                onChange={e => setOverrideVal(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #dde3f0',
                  borderRadius: '8px', fontSize: '13px', color: '#2b3674',
                  outline: 'none', marginBottom: '18px', background: 'white'
                }}
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary-blue" style={{ flex: 1 }} onClick={handleOverrideSave}>
                  Save Override
                </button>
                <button
                  style={{
                    flex: 1, padding: '10px', border: '1px solid #dde3f0', borderRadius: '9px',
                    cursor: 'pointer', background: 'white', color: '#2b3674',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit'
                  }}
                  onClick={() => setOverrideId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header banner */}
        <header className="portal-header">
          <h1>Lecturer Dashboard</h1>
          <p>Raspberry Pi • OpenCV • Secure Sync</p>
        </header>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>Add Student Login</h3>
          </div>
          <div className="session-bar">
            <input
              type="text"
              placeholder="Student name"
              value={newStudent.name}
              onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Username"
              value={newStudent.username}
              onChange={e => setNewStudent(p => ({ ...p, username: e.target.value }))}
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={newStudent.password}
              onChange={e => setNewStudent(p => ({ ...p, password: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Student ID"
              value={newStudent.studentId}
              onChange={e => setNewStudent(p => ({ ...p, studentId: e.target.value }))}
            />
            <input
              type="email"
              placeholder="Email"
              value={newStudent.email}
              onChange={e => setNewStudent(p => ({ ...p, email: e.target.value }))}
            />
            <button className="btn-secondary-blue" onClick={handleAddStudent}>
              Add Student
            </button>
          </div>
        </div>

        {/* Session control card */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="session-bar">
            <input
              type="text"
              placeholder="Course code (e.g., ICT307)"
              value={courseCode}
              onChange={e => setCourseCode(e.target.value)}
            />
            <input
              type="text"
              placeholder="Room / Session"
              value={roomSession}
              onChange={e => setRoomSession(e.target.value)}
            />
            <button className="btn-secondary-blue" onClick={handleStartSession}>
              {sessionActive ? '✓ Session Active' : 'Start Session'}
            </button>
            <button className="btn-stop" onClick={handleStopSession}>
              Stop Session
            </button>
            <button className="btn-export" onClick={handleExportCSV}>
              Export CSV
            </button>

            <div className="sync-badges">
              <span className="sync-badge-yellow">Pending Sync: {pendingSync}</span>
              <span className="sync-badge-green">Synced: {synced}</span>
              <button className="btn-sync-now" onClick={handleSyncNow}>Sync Now</button>
            </div>
          </div>
        </div>

        {/* Real-time Attendance */}
        <div className="card" style={{ marginBottom: '0' }}>
          <div className="card-header">
            <h3>Real-time Attendance</h3>
            <span className="attendance-meta">
              Total: {totalStudents} • Present: {presentCount} • Absent: {absentCount}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className={
                    s.status === 'Present'  ? 'text-present' :
                    s.status === 'Absent'   ? 'text-absent'  :
                    s.status === 'Late'     ? 'text-late'    :
                    s.status === 'Scanning…'? 'text-late'    : 'text-not-recognized'
                  }>
                    {s.status}
                  </td>
                  <td>{s.time}</td>
                  <td>
                    {s.recognized ? (
                      <>
                        <button className="btn-override" onClick={() => handleOverrideOpen(s.id)}>Override</button>
                        <button className="btn-details"  onClick={() => handleDetails(s.id)}>Details</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-retry" onClick={() => handleRetry(s.id)}>Retry</button>
                        <button className="btn-mark"  onClick={() => handleMarkPresent(s.id)}>Mark Present</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Session Notes + Alerts */}
          <div className="session-bottom-grid">
            <div className="card" style={{ boxShadow: 'none', border: '1px solid #e8edf5' }}>
              <div className="card-header">
                <h3>Session Notes</h3>
              </div>
              <textarea
                className="session-notes-textarea"
                placeholder="Notes for this class..."
                value={notes}
                onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
              />
              <button
                className="btn-secondary-blue"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                style={{ opacity: savingNotes ? 0.7 : 1 }}
              >
                {savingNotes ? 'Saving…' : notesSaved ? '✓ Saved to Database!' : 'Save Notes'}
              </button>

              {savedNotes.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#a3aed0', marginBottom: '8px', fontWeight: 600 }}>
                    PREVIOUSLY SAVED NOTES
                  </p>
                  {savedNotes.map((n, i) => (
                    <div key={n._id || i} style={{
                      background: '#f8f9ff', border: '1px solid #e8edf5',
                      borderRadius: '8px', padding: '10px 12px', marginBottom: '8px'
                    }}>
                      <p style={{ fontSize: '12px', color: '#a3aed0', marginBottom: '4px' }}>
                        {new Date(n.createdAt).toLocaleString()} — {n.courseCode || 'ICT307'} / {n.session || 'Lecture'}
                      </p>
                      <p style={{ fontSize: '13px', color: '#2b3674', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {n.notes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ boxShadow: 'none', border: '1px solid #e8edf5' }}>
              <div className="card-header">
                <h3>Alerts</h3>
              </div>
              {initialAlerts.map((a, i) => (
                <p key={i} className="alert-item">
                  {a.message}<span>{a.highlight}</span>
                </p>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
