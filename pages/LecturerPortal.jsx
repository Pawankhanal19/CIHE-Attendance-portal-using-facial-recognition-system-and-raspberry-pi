// pages/LecturerPortal.jsx

function LecturerPortal({ currentUser, onLogout }) {
  const [courseCode,    setCourseCode]    = React.useState('')
  const [roomSession,   setRoomSession]   = React.useState('')
  const [sessionActive, setSessionActive] = React.useState(false)
  const [notes,         setNotes]         = React.useState('')
  const [notesSaved,    setNotesSaved]    = React.useState(false)
  const [pendingSync,   setPendingSync]   = React.useState(0)
  const [synced,        setSynced]        = React.useState(0)
  const [attendance,    setAttendance]    = React.useState([])
  const [toast,         setToast]         = React.useState(null)
  const [modal,         setModal]         = React.useState(null)
  const [overrideId,    setOverrideId]    = React.useState(null)
  const [overrideVal,   setOverrideVal]   = React.useState('Present')
  const [newStudent,    setNewStudent]    = React.useState({ name: '', username: '', password: '', email: '', studentId: '' })
  const [showAddStudent,setShowAddStudent]= React.useState(false)
  const [savedNotes,    setSavedNotes]    = React.useState([])
  const [savingNotes,   setSavingNotes]   = React.useState(false)
  const [activeSession, setActiveSession] = React.useState(null)
  const [alerts,        setAlerts]        = React.useState([])
  const [piStatus,      setPiStatus]      = React.useState(null)
  const [sessionSearch, setSessionSearch] = React.useState('')
  const [view,          setView]          = React.useState('home')

  const navLinks = [{ label: 'Home', href: '#' }]

  function attendanceRowFromLog(log) {
    const timestamp = new Date(log.time || log.created_at || Date.now())
    return {
      id: log.id,
      name: log.name,
      status: log.attendance_status || (log.status === 'recognised' ? 'Present' : 'Not Recognized'),
      time: timestamp.toTimeString().slice(0, 5),
      date: timestamp.toLocaleDateString('en-GB'),
      rawTimestamp: timestamp,
      recognized: log.status === 'recognised',
      course: log.course_code || 'ICT307',
      personId: log.person_id || '—',
      confidence: log.confidence ? Math.round(log.confidence) : null,
      deviceId: log.device_id || '—',
    }
  }

  // Initial data load + socket
  React.useEffect(() => {
    let cancelled = false

    async function loadAttendance() {
      try {
        const logs = await AttendanceAPI.fetchRecognitionLogs(50)
        if (!cancelled && logs.length > 0) {
          setAttendance(logs.map(attendanceRowFromLog))
          setSynced(logs.length)
          setPendingSync(0)
          const unrec = logs.filter(l => l.status === 'unrecognised' || l.attendance_status === 'Denied')
          setAlerts(unrec.map(l => ({
            id: l.id,
            icon: 'alert', tint: 'warning',
            title: 'Unrecognised face detected',
            body: `${l.device_id || 'Pi'} captured a low-confidence match at ${new Date(l.time || l.created_at).toTimeString().slice(0, 5)}`,
          })))
        }
      } catch (err) {
        console.warn('Backend unavailable.', err)
      }
    }

    loadAttendance()
    const interval = setInterval(loadAttendance, 30000)
    const socket = AttendanceAPI.connectSocket()

    if (socket) {
      socket.on('attendance_updated', (log) => {
        const row = attendanceRowFromLog(log)
        setAttendance(prev => [row, ...prev.filter(s => s.id !== row.id)].slice(0, 50))
        setSynced(s => s + 1)
        showToast(`${log.name} attendance updated from Raspberry Pi.`, 'success')
        if (log.status === 'unrecognised' || log.attendance_status === 'Denied') {
          setAlerts(prev => [{
            id: log.id, icon: 'alert', tint: 'warning',
            title: 'Unrecognised face detected',
            body: `${log.device_id || 'Pi'} captured a low-confidence match at ${new Date(log.time || Date.now()).toTimeString().slice(0, 5)}`,
          }, ...prev].slice(0, 10))
        }
      })
    }

    return () => {
      cancelled = true
      clearInterval(interval)
      if (socket) socket.disconnect()
    }
  }, [])

  // Pi status polling (every 5 s)
  React.useEffect(() => {
    async function pollPiStatus() {
      try {
        const data = await AttendanceAPI.fetchPiStatus()
        setPiStatus(data.pi)
        if (data.activeSession && !activeSession) {
          setActiveSession(data.activeSession)
          setSessionActive(true)
        }
      } catch (err) {
        setPiStatus({ online: false })
      }
    }
    pollPiStatus()
    const piInterval = setInterval(pollPiStatus, 5000)
    return () => clearInterval(piInterval)
  }, [])

  // Session notes load
  React.useEffect(() => {
    async function loadNotes() {
      try {
        const data = await AttendanceAPI.fetchSessionNotes()
        setSavedNotes(data)
      } catch (err) {
        console.warn('Could not load session notes:', err)
      }
    }
    loadNotes()
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function showModal(title, body) {
    setModal({ title, body })
  }

  // Session controls
  async function handleStartSession() {
    if (!courseCode.trim()) {
      showToast('Please enter a course code before starting a session.', 'error')
      return
    }
    try {
      const session = await AttendanceAPI.startSession(courseCode, roomSession)
      setActiveSession(session)
      setSessionActive(true)
      const piMsg = session.piStatus?.error
        ? ` (Pi: ${session.piStatus.error})`
        : session.piStatus?.status === 'started' ? ' — Pi camera started.' : ''
      showToast(`Session started for ${courseCode}${roomSession ? ' · ' + roomSession : ''}${piMsg}`, 'success')
    } catch (err) {
      showToast(err.message || 'Could not save session to backend.', 'error')
    }
  }

  async function handleStopSession() {
    if (!sessionActive) { showToast('No active session to stop.', 'warning'); return }
    try {
      if (activeSession?._id) await AttendanceAPI.stopSession(activeSession._id)
    } catch (err) {
      console.warn('Could not update session end time:', err)
    }
    setSessionActive(false)
    setActiveSession(null)
    showToast(`Session for ${courseCode || 'current class'} stopped and saved.`, 'info')
  }

  function handleExportCSV() {
    if (attendance.length === 0) { showModal('Export CSV', 'No attendance records to export yet.'); return }
    let rows = attendance
    if (activeSession) {
      const start = new Date(activeSession.startTime)
      const end = activeSession.endTime ? new Date(activeSession.endTime) : new Date()
      rows = attendance.filter(s => s.rawTimestamp >= start && s.rawTimestamp <= end)
      if (rows.length === 0) { showModal('Export CSV', 'No attendance records captured during this session.'); return }
    }
    const csvRows = [['Student', 'Status', 'Time', 'Course', 'Room']]
    rows.forEach(s => csvRows.push([s.name, s.status, s.time, courseCode || 'ICT307', roomSession || 'Lecture']))
    const csv  = csvRows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `attendance_${courseCode || 'session'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`CSV exported — ${rows.length} record(s).`, 'success')
  }

  async function handleSyncNow() {
    showToast('Syncing with database…', 'info')
    try {
      const logs = await AttendanceAPI.fetchRecognitionLogs(50)
      if (logs.length > 0) {
        setAttendance(logs.map(attendanceRowFromLog))
        setSynced(logs.length)
        setPendingSync(0)
        showToast(`Synced — ${logs.length} record(s) loaded.`, 'success')
      } else {
        showToast('No records found in database.', 'info')
      }
    } catch (err) {
      showToast('Could not reach backend. Check the server is running.', 'error')
    }
  }

  async function handleMarkPresent(id) {
    const now = new Date().toTimeString().slice(0, 5)
    const student = attendance.find(s => s.id === id)
    setAttendance(prev => prev.map(s => s.id === id ? { ...s, status: 'Present', time: now, recognized: true } : s))
    showToast(`${student?.name || 'Student'} marked as Present.`, 'success')
    try {
      await AttendanceAPI.updateAttendanceLog(id, { attendanceStatus: 'Present' })
    } catch (err) {
      setPendingSync(p => p + 1)
    }
  }

  function handleRetry(id) {
    setAttendance(prev => prev.map(s => s.id === id ? { ...s, status: 'Scanning…', time: '—' } : s))
    setTimeout(() => {
      setAttendance(prev => prev.map(s => s.id === id ? { ...s, status: 'Not Recognized', time: '—' } : s))
      showToast('Retry complete — still not recognised. Use "Mark present" manually.', 'warning')
    }, 1500)
  }

  function handleOverrideOpen(id) {
    const student = attendance.find(s => s.id === id)
    setOverrideId(id)
    setOverrideVal(student?.status || 'Present')
  }

  async function handleOverrideSave() {
    const now = new Date().toTimeString().slice(0, 5)
    const student = attendance.find(s => s.id === overrideId)
    setAttendance(prev => prev.map(s =>
      s.id === overrideId
        ? { ...s, status: overrideVal, time: overrideVal === 'Absent' ? '—' : now }
        : s
    ))
    showToast(`${student?.name || 'Student'}'s status overridden to "${overrideVal}".`, 'info')
    setOverrideId(null)
    try {
      await AttendanceAPI.updateAttendanceLog(overrideId, { attendanceStatus: overrideVal })
    } catch (err) {
      setPendingSync(p => p + 1)
    }
  }

  function handleDetails(id) {
    const s = attendance.find(s => s.id === id)
    showModal(`Student details — ${s?.name}`,
      `Student ID: ${s?.personId}\nStatus: ${s?.status}\nCheck-in: ${s?.date} at ${s?.time}\nCourse: ${s?.course}\nDevice: ${s?.deviceId}\nConfidence: ${s?.confidence ? s.confidence + '%' : '—'}`)
  }

  async function handleAddStudent() {
    if (!newStudent.name.trim() || !newStudent.username.trim() || !newStudent.password.trim()) {
      showToast('Please enter student name, username, and password.', 'error')
      return
    }
    try {
      await AttendanceAPI.createUser({ ...newStudent, role: 'Student' })
      setNewStudent({ name: '', username: '', password: '', email: '', studentId: '' })
      setShowAddStudent(false)
      showToast('Student login created successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not create student login.', 'error')
    }
  }

  async function handleSaveNotes() {
    if (!notes.trim()) { showToast('Nothing to save — notes are empty.', 'warning'); return }
    setSavingNotes(true)
    try {
      const saved = await AttendanceAPI.saveSessionNote(notes.trim(), courseCode, roomSession)
      setSavedNotes(prev => [saved, ...prev])
      setNotesSaved(true)
      setNotes('')
      showToast('Notes saved to database!', 'success')
      setTimeout(() => setNotesSaved(false), 3000)
    } catch (err) {
      showToast(err.message || 'Could not save notes. Is the backend running?', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  // Derived stats
  const presentCount  = attendance.filter(s => s.status === 'Present').length
  const lateCount     = attendance.filter(s => s.status === 'Late').length
  const absentCount   = attendance.filter(s => s.status === 'Absent').length
  const needsReview   = attendance.filter(s => !s.recognized).length
  const totalStudents = attendance.length

  // Pi label for topbar
  function piLabel() {
    if (!piStatus) return null
    if (piStatus.online === false) return 'Pi offline'
    return `pi · ${piStatus.cpu_percent ?? '—'}% · ${piStatus.temperature ?? '—'}°C`
  }

  // Status pill
  function statusPill(s) {
    return s === 'Present'        ? <ApStatus kind="success">{s}</ApStatus> :
           s === 'Late'           ? <ApStatus kind="warning">{s}</ApStatus> :
           s === 'Absent'         ? <ApStatus kind="danger">{s}</ApStatus>  :
           s === 'Not Recognized' ? <ApStatus kind="neutral">{s}</ApStatus> :
                                    <ApStatus kind="info">{s}</ApStatus>
  }

  const toastColours = {
    success: { bg: 'var(--success-50)', border: 'rgba(16,185,129,0.3)', color: 'var(--success)' },
    info:    { bg: 'var(--primary-50)', border: 'rgba(59,91,219,0.3)',  color: 'var(--primary)' },
    warning: { bg: 'var(--warning-50)', border: 'rgba(217,119,6,0.3)',  color: 'var(--warning)' },
    error:   { bg: 'var(--danger-50)',  border: 'rgba(220,38,38,0.3)',  color: 'var(--danger)'  },
  }

  const overrideRow = overrideId ? attendance.find(s => s.id === overrideId) : null

  // Filter roster
  const filteredRoster = sessionSearch
    ? attendance.filter(s =>
        s.name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
        s.personId.includes(sessionSearch))
    : attendance

  const avatarColors = ['#0ca678','#5c3de8','#3b5bdb','#d97706','#be185d','#0284c7','#475569']

  return (
    <div className="ap-shell">
      <Sidebar role="Lecturer" navLinks={navLinks} onLogout={onLogout}
               onSettings={() => setView('settings')} currentUser={currentUser} />

      <main className="ap-main">

        {view === 'settings' && (
          <SettingsPage role="Lecturer" currentUser={currentUser} onBack={() => setView('home')} />
        )}
        {view !== 'settings' && (<>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 24, zIndex: 300,
            padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            maxWidth: 340, boxShadow: 'var(--shadow-md)',
            border: `1px solid ${toastColours[toast.type].border}`,
            background: toastColours[toast.type].bg, color: toastColours[toast.type].color,
          }}>
            {toast.message}
          </div>
        )}

        {/* Info modal */}
        {modal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,26,74,0.32)',
            display: 'grid', placeItems: 'center', zIndex: 200,
          }} onClick={() => setModal(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 400, background: 'var(--surface)', borderRadius: 14,
              padding: 28, boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--ink-100)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
                {modal.title}
              </div>
              <p style={{ color: 'var(--ink-500)', fontSize: 13, lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-line' }}>
                {modal.body}
              </p>
              <button className="ap-btn primary" style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setModal(null)}>
                OK
              </button>
            </div>
          </div>
        )}

        {/* Override modal */}
        {overrideRow && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,26,74,0.32)',
            display: 'grid', placeItems: 'center', zIndex: 200,
          }} onClick={() => setOverrideId(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 380, background: 'var(--surface)', borderRadius: 14,
              padding: 24, boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--ink-100)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <ApAvatar name={overrideRow.name}
                          color={avatarColors[attendance.indexOf(overrideRow) % avatarColors.length]}
                          size={36} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{overrideRow.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{overrideRow.personId}</div>
                </div>
              </div>
              <div className="ap-field" style={{ marginBottom: 16 }}>
                <label>Override status</label>
                <select className="ap-select" value={overrideVal}
                        onChange={e => setOverrideVal(e.target.value)}>
                  <option>Present</option>
                  <option>Late</option>
                  <option>Absent</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ap-btn ghost" style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setOverrideId(null)}>Cancel</button>
                <button className="ap-btn primary" style={{ flex: 1, justifyContent: 'center' }}
                        onClick={handleOverrideSave}>Save override</button>
              </div>
            </div>
          </div>
        )}

        {/* Add student modal */}
        {showAddStudent && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,26,74,0.32)',
            display: 'grid', placeItems: 'center', zIndex: 200,
          }} onClick={() => setShowAddStudent(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 380, background: 'var(--surface)', borderRadius: 14,
              padding: 24, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--ink-100)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 18 }}>
                Add student login
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { placeholder: 'Full name',         key: 'name',      type: 'text'     },
                  { placeholder: 'Username',           key: 'username',  type: 'text'     },
                  { placeholder: 'Temporary password', key: 'password',  type: 'password' },
                  { placeholder: 'Student ID',         key: 'studentId', type: 'text'     },
                  { placeholder: 'Email',              key: 'email',     type: 'email'    },
                ].map(f => (
                  <input key={f.key} className="ap-input" type={f.type} placeholder={f.placeholder}
                         value={newStudent[f.key]}
                         onChange={e => setNewStudent(p => ({ ...p, [f.key]: e.target.value }))} />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="ap-btn ghost" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => setShowAddStudent(false)}>Cancel</button>
                  <button className="ap-btn primary" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={handleAddStudent}>Add student</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <ApTopBar
          title={courseCode ? `${courseCode} · ${roomSession || 'Session'}` : 'Lecturer Dashboard'}
          sub={`${currentUser?.name || 'Lecturer'} · ${sessionActive ? 'Session live' : 'No active session'}`}>
          <ApStatus kind={sessionActive ? 'success' : 'neutral'}>
            {sessionActive ? 'Session live' : 'Session ended'}
          </ApStatus>
          {piLabel() && (
            <ApStatus kind={piStatus?.online === false ? 'danger' : 'info'} dot={false}>
              <ApIcon name="cpu" size={12} /> {piLabel()}
            </ApStatus>
          )}
          <button className="ap-btn ghost" onClick={handleExportCSV}>
            <ApIcon name="download" size={14} /> Export CSV
          </button>
          <button className="ap-btn danger" onClick={handleStopSession} disabled={!sessionActive}>
            <ApIcon name="x" size={14} /> Stop session
          </button>
        </ApTopBar>

        {/* Session control card */}
        <div className="ap-card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="ap-field" style={{ width: 180 }}>
              <label>Course code</label>
              <input className="ap-input" placeholder="e.g. ICT307"
                     value={courseCode} onChange={e => setCourseCode(e.target.value)} />
            </div>
            <div className="ap-field" style={{ width: 200 }}>
              <label>Room / Session</label>
              <input className="ap-input" placeholder="e.g. L2-04 Lecture"
                     value={roomSession} onChange={e => setRoomSession(e.target.value)} />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="ap-pill neutral">Pending: {pendingSync}</span>
                <span className="ap-pill success">Synced: {synced}</span>
              </div>
              <button className="ap-btn subtle" onClick={handleSyncNow}>
                <ApIcon name="wifi" size={14} /> Sync now
              </button>
              <button className="ap-btn primary" onClick={handleStartSession} disabled={sessionActive}>
                {sessionActive ? 'Session active' : 'Start session'}
              </button>
              <button className="ap-btn ghost" onClick={() => setShowAddStudent(true)}>
                <ApIcon name="plus" size={14} /> Add student
              </button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <ApKpi label="Enrolled" value={totalStudents} sub="in roster" />
          <ApKpi label="Present" value={presentCount}
                 delta={totalStudents > 0 ? `${Math.round(presentCount/Math.max(totalStudents,1)*100)}%` : '0%'}
                 deltaDir="up" accent="var(--success)" />
          <ApKpi label="Late" value={lateCount} sub="after threshold" accent="var(--warning)" />
          <ApKpi label="Absent" value={absentCount} sub="no scan yet" accent="var(--danger)" />
          <ApKpi label="Needs review" value={needsReview} sub="confidence &lt; 70%" />
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16 }}>

          {/* Live roster */}
          <div className="ap-card padless">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 12px',
            }}>
              <div>
                <div className="ap-card-title">Live roster</div>
                <div className="ap-card-sub">Updates from Pi in real time</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="ap-input-wrap" style={{ width: 220 }}>
                  <ApIcon name="search" size={14} />
                  <input className="ap-input" placeholder="Search student or ID…"
                         value={sessionSearch} onChange={e => setSessionSearch(e.target.value)} />
                </div>
                <button className="ap-btn ghost sm">
                  <ApIcon name="filter" size={13} /> Filter
                </button>
              </div>
            </div>

            <table className="ap-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Confidence</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--ink-300)', padding: 24 }}>
                      No records yet — waiting for Pi scans…
                    </td>
                  </tr>
                ) : filteredRoster.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <div className="ap-row-name">
                        <ApAvatar name={s.name} color={avatarColors[i % avatarColors.length]} size={30} />
                        <div style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{s.name}</div>
                      </div>
                    </td>
                    <td className="mono">{s.personId}</td>
                    <td>{statusPill(s.status)}</td>
                    <td className="mono">{s.time}</td>
                    <td style={{ minWidth: 130 }}>
                      {s.confidence != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="ap-bar" style={{ width: 70 }}>
                            <span style={{
                              width: s.confidence + '%',
                              background: s.confidence >= 90 ? 'var(--success)' :
                                          s.confidence >= 70 ? 'var(--warning)' : 'var(--danger)',
                            }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{s.confidence}%</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-300)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {s.recognized ? (
                          <>
                            <button className="ap-btn ghost xs" onClick={() => handleOverrideOpen(s.id)}>Override</button>
                            <button className="ap-btn subtle xs" onClick={() => handleDetails(s.id)}>Details</button>
                          </>
                        ) : (
                          <>
                            <button className="ap-btn ghost xs" onClick={() => handleRetry(s.id)}>Retry</button>
                            <button className="ap-btn primary xs" onClick={() => handleMarkPresent(s.id)}>Mark present</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              padding: '10px 20px', borderTop: '1px solid var(--ink-100)',
              fontSize: 12, color: 'var(--ink-400)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Showing {filteredRoster.length} of {totalStudents} in roster</span>
              <span>Last sync · just now</span>
            </div>
          </div>

          {/* Right column: notes + alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Session notes */}
            <div className="ap-card">
              <div className="ap-card-head">
                <div>
                  <div className="ap-card-title">Session notes</div>
                  <div className="ap-card-sub">Auto-saves · attached to this session</div>
                </div>
                {notesSaved && (
                  <ApStatus kind="success" dot={false}>
                    <ApIcon name="check" size={12} /> Saved
                  </ApStatus>
                )}
              </div>
              <textarea className="ap-textarea" rows={5}
                placeholder="Notes for this class…"
                value={notes}
                onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
                style={{ resize: 'none', fontSize: 13, lineHeight: 1.5 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ap-btn primary" onClick={handleSaveNotes} disabled={savingNotes}>
                  <ApIcon name="check" size={14} /> {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>

              {savedNotes.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-300)', fontWeight: 700, marginBottom: 8 }}>
                    Previously saved
                  </div>
                  {savedNotes.slice(0, 3).map((n, i) => (
                    <div key={n._id || i} style={{
                      background: 'var(--surface-2)', border: '1px solid var(--ink-100)',
                      borderRadius: 8, padding: '8px 10px', marginBottom: 6,
                    }}>
                      <p style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                        {new Date(n.createdAt).toLocaleString()} · {n.courseCode || 'ICT307'}
                      </p>
                      <p style={{ fontSize: 12.5, color: 'var(--ink-700)', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {n.notes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alerts */}
            <div className="ap-card">
              <div className="ap-card-head">
                <div>
                  <div className="ap-card-title">Alerts</div>
                  <div className="ap-card-sub">From this session</div>
                </div>
                {alerts.length > 0 && (
                  <span className="ap-pill warning">{alerts.length} new</span>
                )}
              </div>

              {alerts.length === 0 ? (
                <p style={{ color: 'var(--ink-300)', fontSize: 13, padding: '4px 0' }}>
                  No unrecognised faces — all clear.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alerts.slice(0, 5).map((a, i) => (
                    <div key={a.id || i} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: 10, border: '1px solid var(--ink-100)',
                      borderRadius: 10, background: 'var(--surface-2)',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                        background: a.tint === 'warning' ? 'var(--warning-50)' :
                                    a.tint === 'info'    ? 'var(--primary-50)' : 'var(--ink-50)',
                        color: a.tint === 'warning' ? 'var(--warning)' :
                               a.tint === 'info'    ? 'var(--primary)' : 'var(--ink-500)',
                      }}>
                        <ApIcon name={a.icon || 'alert'} size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>{a.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        </>)}
      </main>
    </div>
  )
}
