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
  const [scanStatus,   setScanStatus]   = React.useState('Awaiting Scan')
  const [scanning,     setScanning]     = React.useState(false)
  const [studentId,    setStudentId]    = React.useState('')
  const [captured,     setCaptured]     = React.useState(false)
  const [history,      setHistory]      = React.useState(initialHistory)
  const [toast,        setToast]        = React.useState(null)   // { message, type }
  const [modal,        setModal]        = React.useState(null)   // { title, body, icon }
  const [showHistory,  setShowHistory]  = React.useState(false)  // scroll-to ref flag

  const historyRef = React.useRef(null)
  const navLinks   = [{ label: 'Home', href: '#' }]

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

  // ── Start Scan ──────────────────────────────────────────────
  function handleStartScan() {
    if (scanning) return
    setScanning(true)
    setScanStatus('Scanning…')
    showToast('Face scan started. Please look at the camera.', 'info')

    setTimeout(async () => {
      const now      = new Date()

      try {
        const response = await AttendanceAPI.sendRecognition({
          person_id: 'STU001',
          name: 'Diya Shrestha',
          confidence: 91.4,
          status: 'recognised',
          time: now.toISOString(),
          device_id: 'frontend-demo-scan',
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

  // ── Capture ─────────────────────────────────────────────────
  function handleCapture() {
    setCaptured(true)
    showToast('Face image captured! Enter your Student ID and click Save to enrol.', 'info')
    setTimeout(() => setCaptured(false), 3000)
  }

  // ── Upload ──────────────────────────────────────────────────
  function handleUpload() {
    showModal(
      'Upload Face Image',
      'File upload requires a connected backend. Please ensure the server is running and try again, or use the Capture button to take a photo directly.',
      '📁'
    )
  }

  // ── Save enrolment ──────────────────────────────────────────
  function handleSave() {
    if (!studentId.trim()) {
      showToast('Please enter your Student ID before saving.', 'error')
      return
    }
    if (!captured) {
      showToast('Please capture or upload a face image first.', 'warning')
      return
    }
    showModal(
      'Face Enrolment Restricted',
      'Only an Admin or Lecturer can create or update student access records. Please contact authorised staff.',
      '🔒'
    )
  }

  // ── View History ─────────────────────────────────────────────
  function handleViewHistory() {
    setShowHistory(true)
    setTimeout(() => {
      if (historyRef.current) {
        historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  // ── Toast colour map ────────────────────────────────────────
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

  return (
    <div className="dashboard-body">
      <Sidebar role="Student" navLinks={navLinks} onLogout={onLogout} />

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
          }}>
            {toast.message}
          </div>
        )}

        {/* ── Info modal ── */}
        {modal && (
          <div style={overlayStyle}>
            <div style={{
              background: 'white', padding: '30px', borderRadius: '14px',
              width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center'
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

        {/* Header banner */}
        <header className="portal-header">
          <h1>Student Portal</h1>
          <p>Raspberry Pi • OpenCV • Secure Sync</p>
        </header>

        {/* Top two-column grid */}
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

            {/* Camera preview — shows scanning animation when active */}
            <div className="camera-preview" style={{
              border: scanning ? '2px solid #4dabf7' : '1px solid #dde3f0',
              transition: 'border 0.3s'
            }}>
              {scanning
                ? <span style={{ color: '#4dabf7', fontWeight: 600, animation: 'pulse 1s infinite' }}>
                    🎥 Scanning face…
                  </span>
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
                  onChange={(e) => setStudentId(e.target.value)}
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
                       scanStatus.includes('Scanning') ? '#4dabf7' : '#2b3674'
              }}>
                {scanStatus}
              </p>
              <p className="status-sub">ICT307 • 28 Sept 2025 • 9:00 AM</p>
            </div>
          </div>

        </div>

        {/* Attendance History — full width */}
        <div className="card student-history-card" ref={historyRef}>
          <div className="card-header">
            <h3>Attendance History</h3>
            <span style={{ fontSize: '12px', color: '#a3aed0' }}>{history.length} records</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Course</th>
                <th>Session</th>
                <th>Status</th>
                <th>Check-in</th>
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

      </main>
    </div>
  )
}
