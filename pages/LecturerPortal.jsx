// pages/LecturerPortal.jsx

const initialAttendance = [
  { id: 1, name: 'Student A', status: 'Present',        time: '09:02', recognized: true  },
  { id: 2, name: 'Student C', status: 'Not Recognized', time: '—',     recognized: false },
]

const initialAlerts = [
  { id: 1, message: 'Unrecognized face detected at ', highlight: '09:07' },
  { id: 2, message: 'Network restored at ',           highlight: '09:12' },
]

function LecturerPortal({ onLogout }) {
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

  const navLinks = [{ label: 'Home', href: '#' }]

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
  function handleStartSession() {
    if (!courseCode.trim()) {
      showToast('Please enter a course code before starting a session.', 'error')
      return
    }
    setSessionActive(true)
    showToast(`Session started for ${courseCode}${roomSession ? ' — ' + roomSession : ''}.`, 'success')
  }

  function handleStopSession() {
    if (!sessionActive) {
      showToast('No active session to stop.', 'warning')
      return
    }
    setSessionActive(false)
    showToast(`Session for ${courseCode} has been stopped. Attendance saved.`, 'info')
  }

  function handleExportCSV() {
    if (!sessionActive && !courseCode.trim()) {
      showModal(
        'Export CSV',
        'No session data available to export. Please start a session first.',
        '📁'
      )
      return
    }
    // Build a simple CSV from current attendance
    const rows = [['Student', 'Status', 'Time']]
    attendance.forEach(s => rows.push([s.name, s.status, s.time]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance_${courseCode || 'session'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV exported successfully!', 'success')
  }

  // ── Sync controls ───────────────────────────────────────────
  function handleSyncNow() {
    if (pendingSync === 0) {
      showToast('Everything is already synced — no pending records.', 'info')
      return
    }
    setSynced(s => s + pendingSync)
    setPendingSync(0)
    showToast(`${pendingSync} record(s) synced to the cloud successfully.`, 'success')
  }

  // ── Attendance row actions ──────────────────────────────────
  function handleMarkPresent(id) {
    const now = new Date().toTimeString().slice(0, 5)
    setAttendance(prev => prev.map(s =>
      s.id === id
        ? { ...s, status: 'Present', time: now, recognized: true }
        : s
    ))
    const student = attendance.find(s => s.id === id)
    showToast(`${student.name} has been manually marked as Present.`, 'success')
    setPendingSync(p => p + 1)
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

  function handleOverrideSave() {
    const now = new Date().toTimeString().slice(0, 5)
    setAttendance(prev => prev.map(s =>
      s.id === overrideId
        ? { ...s, status: overrideVal, time: overrideVal === 'Absent' ? '—' : now }
        : s
    ))
    const student = attendance.find(s => s.id === overrideId)
    showToast(`${student.name}'s status overridden to "${overrideVal}".`, 'info')
    setOverrideId(null)
    setPendingSync(p => p + 1)
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
  function handleSaveNotes() {
    if (!notes.trim()) {
      showToast('Nothing to save — notes are empty.', 'warning')
      return
    }
    setNotesSaved(true)
    showToast('Session notes saved successfully!', 'success')
    setTimeout(() => setNotesSaved(false), 3000)
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
              <button className="btn-secondary-blue" onClick={handleSaveNotes}>
                {notesSaved ? '✓ Notes Saved!' : 'Save Notes'}
              </button>
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