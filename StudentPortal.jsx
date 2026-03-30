// pages/StudentPortal.jsx
// Converted from student.html
// window.location.href logout replaced with onLogout prop from App

const attendanceHistory = [
  { date: '28/09/2025', course: 'ICT307', session: 'Lecture',  status: 'Present', checkIn: '09:02' },
  { date: '21/09/2025', course: 'ICT307', session: 'Tutorial', status: 'Absent',  checkIn: '-'     },
  { date: '14/09/2025', course: 'ICT306', session: 'Lecture',  status: 'Present', checkIn: '08:58' },
  { date: '07/09/2025', course: 'ICT306', session: 'Tutorial', status: 'Late',    checkIn: '09:15' },
]

function StudentPortal({ onLogout }) {
  const [scanStatus, setScanStatus] = React.useState('Awaiting Scan')
  const [studentId, setStudentId] = React.useState('')

  function handleStartScan() {
    setScanStatus('Scanning…')
    setTimeout(() => setScanStatus('✓ Face Detected — Marked Present'), 2000)
  }

  const navLinks = [{ label: 'Home', href: '#' }]

  return (
    <div className="dashboard-body">
      <Sidebar role="Student" navLinks={navLinks} onLogout={onLogout} />

      <main className="main-content">
        <header className="portal-header">
          <h1>Student Portal</h1>
          <p>Raspberry Pi • OpenCV • Secure Sync</p>
        </header>

        <section className="dashboard-grid">

          {/* Check-in Kiosk */}
          <div className="card kiosk">
            <div className="card-header">
              <h3>Check-in Kiosk</h3>
              <button className="btn-primary" onClick={handleStartScan}>Start Scan</button>
            </div>

            <div className="camera-preview">Camera Preview</div>

            <div className="enroll-section">
              <h4>Enroll / Update Face</h4>
              <div className="input-group">
                <button className="btn-secondary">Capture</button>
                <button className="btn-secondary">Upload</button>
                <input
                  type="text"
                  placeholder="Student ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
                <button className="btn-primary">Save</button>
              </div>
            </div>
          </div>

          {/* Attendance Status */}
          <div className="card status">
            <div className="card-header">
              <h3>Attendance Status</h3>
              <button className="btn-outline">View History</button>
            </div>
            <div className="status-content">
              <p className="status-main">{scanStatus}</p>
              <p className="status-sub">ICT307 • 28 Sept 2025 • 9:00 AM</p>
            </div>
          </div>

          {/* Attendance History */}
          <div className="card history">
            <h3>Attendance History</h3>
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
                {attendanceHistory.map((row, i) => (
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

        </section>
      </main>
    </div>
  )
}
