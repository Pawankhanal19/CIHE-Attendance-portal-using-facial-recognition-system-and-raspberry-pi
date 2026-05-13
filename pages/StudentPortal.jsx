// pages/StudentPortal.jsx

const initialHistory = [
  { date: '28/09/2025', course: 'ICT307', session: 'Lecture',  status: 'Present', checkIn: '09:02' },
  { date: '21/09/2025', course: 'ICT307', session: 'Tutorial', status: 'Absent',  checkIn: '—'     },
  { date: '14/09/2025', course: 'ICT306', session: 'Lecture',  status: 'Present', checkIn: '08:58' },
  { date: '07/09/2025', course: 'ICT306', session: 'Tutorial', status: 'Late',    checkIn: '09:15' },
]

function historyRowFromLog(log) {
  const timestamp = new Date(log.time || log.created_at || Date.now())
  return {
    id: log.id,
    date: timestamp.toLocaleDateString('en-GB'),
    course: log.course_code || 'ICT307',
    session: log.session || 'Lecture',
    status: log.attendance_status || (log.status === 'recognised' ? 'Present' : 'Absent'),
    checkIn: timestamp.toTimeString().slice(0, 5),
  }
}

function StudentPortal({ currentUser, onLogout }) {
  const [scanStatus,    setScanStatus]    = React.useState('Awaiting Scan')
  const [scanning,      setScanning]      = React.useState(false)
  const [studentId,     setStudentId]     = React.useState('')
  const [captured,      setCaptured]      = React.useState(false)
  const [history,       setHistory]       = React.useState(initialHistory)
  const [toast,         setToast]         = React.useState(null)
  const [modal,         setModal]         = React.useState(null)
  const [view,          setView]          = React.useState('home')
  const [weeklyData,    setWeeklyData]    = React.useState([])
  const [weeklyLoading, setWeeklyLoading] = React.useState(false)

  const historyRef = React.useRef(null)
  const navLinks = [
    { label: 'Home',          href: '#' },
    { label: 'Weekly Report', href: '#' },
  ]

  React.useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const filters = currentUser?.studentId ? { person_id: currentUser.studentId } : {}
        const logs = await AttendanceAPI.fetchRecognitionLogs(20, filters)
        if (!cancelled && logs.length > 0) {
          setHistory(logs.map(historyRowFromLog))
          const latest = logs[0]
          setScanStatus(latest.status === 'recognised'
            ? `Face Detected — ${latest.name} Marked Present`
            : 'Face Not Recognised')
        }
      } catch (error) {
        console.warn('Backend unavailable, using demo student history.', error)
      }
    }

    loadHistory()
    const socket = AttendanceAPI.connectSocket()

    if (socket) {
      socket.on('face_recognised', (log) => {
        setHistory(prev => {
          const row = historyRowFromLog(log)
          return [row, ...prev.filter(item => item.id !== row.id)].slice(0, 20)
        })
        setScanStatus(log.status === 'recognised'
          ? `Face Detected — ${log.name} Marked Present`
          : 'Face Not Recognised')
        showToast(log.status === 'recognised'
          ? `${log.name} marked Present.`
          : 'Unrecognised face detected.',
          log.status === 'recognised' ? 'success' : 'warning')
      })
    }

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [])

  // ── Toast helper ────────────────────────────────────────────
  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Modal helper ────────────────────────────────────────────
  function showModal(title, body, icon) {
    setModal({ title, body, icon: icon || 'ℹ️' })
  }

  // ── Nav handler (called by Sidebar for all link clicks) ─────
  async function handleNav(label) {
    if (label === 'Weekly Report') {
      setView('weekly')
      if (weeklyData.length === 0 && !weeklyLoading) {
        if (!currentUser?.studentId) {
          showToast('No Student ID on your account. Contact an admin to add it.', 'warning')
          return
        }
        setWeeklyLoading(true)
        try {
          const data = await AttendanceAPI.fetchWeeklyAttendance(currentUser.studentId)
          setWeeklyData(data)
        } catch (err) {
          showToast('Could not load weekly report. Is the backend running?', 'error')
        } finally {
          setWeeklyLoading(false)
        }
      }
    } else {
      setView('home')
    }
  }

  // ── Start Scan ──────────────────────────────────────────────
  function handleStartScan() {
    if (scanning) return
    setScanning(true)
    setScanStatus('Scanning…')
    showToast('Face scan started. Please look at the camera.', 'info')

    setTimeout(async () => {
      const now = new Date()
      try {
        const response = await AttendanceAPI.sendRecognition({
          person_id: currentUser?.studentId || currentUser?.username || 'unknown',
          name: currentUser?.name || 'Unknown Student',
          confidence: 95.0,
          status: 'recognised',
          time: now.toISOString(),
          device_id: 'frontend-student-scan',
          course_code: 'ICT307',
          session: 'Lecture',
        })
        setHistory(prev => {
          const row = historyRowFromLog(response.log)
          return [row, ...prev.filter(item => item.id !== row.id)].slice(0, 20)
        })
        setScanStatus(`Face Detected — ${response.log.name} Marked Present`)
        showToast('Face recognised and saved to MongoDB.', 'success')
      } catch (error) {
        const timeStr = now.toTimeString().slice(0, 5)
        const dateStr = now.toLocaleDateString('en-GB')
        setHistory(prev => [
          { date: dateStr, course: 'ICT307', session: 'Lecture', status: 'Present', checkIn: timeStr },
          ...prev,
        ])
        setScanStatus('Face Detected — Marked Present')
        showToast('Demo scan completed. Start the backend to save this in MongoDB.', 'warning')
      } finally {
        setScanning(false)
      }
    }, 2500)
  }

  // ── Capture / Upload / Save ─────────────────────────────────
  function handleCapture() {
    setCaptured(true)
    showToast('Face image captured! Enter your Student ID and click Save to enrol.', 'info')
    setTimeout(() => setCaptured(false), 3000)
  }

  function handleUpload() {
    showModal('Upload Face Image',
      'File upload requires a connected backend. Please ensure the server is running and try again, or use the Capture button to take a photo directly.',
      '📁')
  }

  function handleSave() {
    if (!studentId.trim()) { showToast('Please enter your Student ID before saving.', 'error'); return }
    if (!captured)          { showToast('Please capture or upload a face image first.', 'warning'); return }
    showModal('Face Enrolment Restricted',
      'Only an Admin or Lecturer can create or update student access records. Please contact authorised staff.',
      '🔒')
  }

  // ── View History ─────────────────────────────────────────────
  function handleViewHistory() {
    setTimeout(() => {
      if (historyRef.current) historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // ── Shared styles ───────────────────────────────────────────
  const toastColours = {
    success: { background: '#d3f9d8', border: '#8ce99a', color: '#2f9e44' },
    info:    { background: '#dde4ff', border: '#748ffc', color: '#3b5bdb' },
    warning: { background: '#fff9db', border: '#ffe066', color: '#c18a00' },
    error:   { background: '#ffe3e3', border: '#ffa8a8', color: '#c92a2a' },
  }
  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }

  // ── Weekly report helpers ───────────────────────────────────
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
  const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

  function pctColor(v) {
    if (v === null || v === undefined) return '#a3aed0'
    return v >= 80 ? '#2f9e44' : v >= 60 ? '#f59e0b' : '#fa5252'
  }

  return (
    <div className="dashboard-body">
      <Sidebar
        role="Student"
        navLinks={navLinks}
        onLogout={onLogout}
        onNav={handleNav}
        currentUser={currentUser}
      />

      <main className="main-content">

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '24px', zIndex: 300,
            padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            maxWidth: '340px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: `1px solid ${toastColours[toast.type].border}`,
            background: toastColours[toast.type].background,
            color: toastColours[toast.type].color,
          }}>
            {toast.message}
          </div>
        )}

        {/* ── Modal ── */}
        {modal && (
          <div style={overlayStyle}>
            <div style={{
              background: 'white', padding: '30px', borderRadius: '14px',
              width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '42px', marginBottom: '12px' }}>{modal.icon}</div>
              <h3 style={{ color: '#3b5bdb', fontSize: '17px', marginBottom: '12px' }}>{modal.title}</h3>
              <p style={{ color: '#4a5a8a', fontSize: '13px', lineHeight: 1.7, marginBottom: '22px' }}>
                {modal.body}
              </p>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => setModal(null)}>
                OK, Got It
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            HOME VIEW
        ═══════════════════════════════════════════ */}
        {view === 'home' && (
          <>
            <header className="portal-header">
              <h1>Student Portal</h1>
              <p>Raspberry Pi • OpenCV • Secure Sync</p>
            </header>

            <div className="student-grid">

              {/* Check-in Kiosk */}
              <div className="card">
                <div className="card-header">
                  <h3>Check-in Kiosk</h3>
                  <button
                    className="btn-primary"
                    onClick={handleStartScan}
                    disabled={scanning}
                    style={{ opacity: scanning ? 0.7 : 1 }}
                  >
                    {scanning ? 'Scanning…' : 'Start Scan'}
                  </button>
                </div>
                <div className="camera-preview" style={{
                  border: scanning ? '2px solid #4dabf7' : '1px solid #dde3f0',
                  transition: 'border 0.3s',
                }}>
                  {scanning
                    ? <span style={{ color: '#4dabf7', fontWeight: 600 }}>🎥 Scanning face…</span>
                    : scanStatus.includes('✓')
                      ? <span style={{ color: '#40c057', fontWeight: 600 }}>✓ Face Captured</span>
                      : 'Camera Preview'
                  }
                </div>
                <div className="enroll-section">
                  <h4>Enroll / Update Face</h4>
                  <div className="input-group">
                    <button
                      className="btn-capture"
                      onClick={handleCapture}
                      style={{ background: captured ? 'linear-gradient(to right,#40c057,#2f9e44)' : undefined }}
                    >
                      {captured ? '✓ Captured' : 'Capture'}
                    </button>
                    <button className="btn-upload" onClick={handleUpload}>Upload</button>
                    <input
                      type="text"
                      placeholder="Student ID"
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                    />
                    <button className="btn-save" onClick={handleSave}>Save</button>
                  </div>
                </div>
              </div>

              {/* Attendance Status */}
              <div className="card">
                <div className="card-header">
                  <h3>Attendance Status</h3>
                  <button className="btn-outline" onClick={handleViewHistory}>View History</button>
                </div>
                <div className="status-content">
                  <p className="status-main" style={{
                    color: scanStatus.includes('✓') ? '#40c057' :
                           scanStatus.includes('Scanning') ? '#4dabf7' : '#2b3674',
                  }}>
                    {scanStatus}
                  </p>
                  <p className="status-sub">
                    ICT307 • {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

            </div>

            {/* Attendance History */}
            <div className="card student-history-card" ref={historyRef}>
              <div className="card-header">
                <h3>Attendance History</h3>
                <span style={{ fontSize: '12px', color: '#a3aed0' }}>{history.length} records</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Course</th><th>Session</th><th>Status</th><th>Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={i}>
                      <td>{row.date}</td>
                      <td>{row.course}</td>
                      <td>{row.session}</td>
                      <td className={
                        row.status === 'Present' ? 'text-present' :
                        row.status === 'Absent'  ? 'text-absent'  : 'text-late'
                      }>{row.status}</td>
                      <td>{row.checkIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════
            WEEKLY REPORT VIEW
        ═══════════════════════════════════════════ */}
        {view === 'weekly' && (
          <>
            <header className="portal-header">
              <h1>Weekly Attendance Report</h1>
              <p>{currentUser?.name} • {currentUser?.studentId || currentUser?.username}</p>
            </header>

            <div className="card">
              <div className="card-header" style={{ marginBottom: '4px' }}>
                <h3>Student Attendance View By Week</h3>
                {!weeklyLoading && weeklyData.length > 0 && (
                  <span style={{ fontSize: '12px', color: '#a3aed0' }}>{weeklyData.length} week(s)</span>
                )}
              </div>

              {weeklyLoading && (
                <p style={{ color: '#a3aed0', textAlign: 'center', padding: '40px 0' }}>
                  Loading weekly report…
                </p>
              )}

              {!weeklyLoading && weeklyData.length === 0 && (
                <p style={{ color: '#a3aed0', textAlign: 'center', padding: '40px 0' }}>
                  No attendance records found for Student ID <strong>{currentUser?.studentId}</strong>.<br />
                  Records appear here once the Pi recognises you in class.
                </p>
              )}

              {!weeklyLoading && weeklyData.length > 0 && (
                <>
                  <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                    <table style={{ minWidth: '1100px', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9ff' }}>
                          {['Term', 'Week Length', ...DAY_LABELS,
                            'Study Hrs', 'Other Hrs', 'Weekly Attd Hrs.',
                            'Weekly Class Hrs', 'Weekly Attd%',
                            'Semester Curr. Attd.', 'Semester Proj. Attd.',
                          ].map(h => (
                            <th key={h} style={{
                              padding: '10px 8px', textAlign: 'center',
                              whiteSpace: 'nowrap', fontSize: '11px',
                              fontWeight: 700, color: '#2b3674',
                              borderBottom: '2px solid #e8edf5',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyData.map((week, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafbff' }}>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: '#4a5a8a' }}>
                              {week.term}
                            </td>
                            <td style={{ padding: '9px 8px', whiteSpace: 'nowrap', color: '#4a5a8a' }}>
                              ({week.weekRange})
                            </td>

                            {DAY_KEYS.map(dk => {
                              const val = week.days[dk]
                              const isNC     = val === 'NC'
                              const isAbsent = val === 0
                              return (
                                <td key={dk} style={{
                                  padding: '9px 8px', textAlign: 'center',
                                  fontWeight: isNC ? 'normal' : '600',
                                  color: isNC ? '#a3aed0' : isAbsent ? '#fa5252' : '#2b3674',
                                  borderBottom: '1px solid #f1f4fa',
                                }}>
                                  {isNC ? 'NC' : val}
                                </td>
                              )
                            })}

                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: '600', color: '#2b3674' }}>
                              {week.studyHrs}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: '#a3aed0' }}>
                              {week.otherHrs}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: '600', color: '#2b3674' }}>
                              {week.weeklyAttdHrs}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: '#4a5a8a' }}>
                              {week.weeklyClassHrs}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: '700', color: pctColor(week.weeklyAttdPct) }}>
                              {week.weeklyAttdPct !== null ? week.weeklyAttdPct : '—'}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: '600', color: pctColor(week.semesterCurrAttd) }}>
                              {week.semesterCurrAttd !== null ? week.semesterCurrAttd : '—'}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: '600', color: pctColor(week.semesterProjAttd) }}>
                              {week.semesterProjAttd !== null ? week.semesterProjAttd : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div style={{
                    marginTop: '20px', padding: '14px 16px',
                    background: '#f8f9ff', borderRadius: '10px',
                    fontSize: '12px', lineHeight: 1.9, color: '#2b3674',
                  }}>
                    <p style={{ margin: '0 0 2px' }}>
                      <strong>Weekly Attd%:</strong> Weekly attendance percentage. Weekly Attd Hrs. / Weekly Class Hrs × 100
                    </p>
                    <p style={{ margin: '0 0 2px' }}>
                      <strong>Semester Curr. Attd.:</strong> Cumulative attendance up to that week. Total attended / total class hours × 100
                    </p>
                    <p style={{ margin: '0 0 10px' }}>
                      <strong>Semester Proj. Attd.:</strong> Maximum possible % if student attends 100% of all remaining weeks
                    </p>
                    <p style={{ margin: 0, color: '#a3aed0' }}>
                      <strong>NC</strong> = No Class &nbsp;|&nbsp;
                      <strong style={{ color: '#fa5252' }}>0</strong> = Absent (class was held) &nbsp;|&nbsp;
                      <strong>3</strong> = 3 hrs attended &nbsp;|&nbsp;
                      <span style={{ color: '#2f9e44', fontWeight: 700 }}>Green</span> ≥ 80% &nbsp;
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>Orange</span> 60–79% &nbsp;
                      <span style={{ color: '#fa5252', fontWeight: 700 }}>Red</span> &lt; 60%
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </main>
    </div>
  )
}
