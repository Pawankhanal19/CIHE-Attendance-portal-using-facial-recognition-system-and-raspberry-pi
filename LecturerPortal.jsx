// pages/LecturerPortal.jsx
// Placeholder built to match Student Portal layout, different role

const courses = [
  { code: 'ICT306', name: 'Cyber Security',       enrolled: 28, sessions: 12 },
  { code: 'ICT307', name: 'Network Fundamentals', enrolled: 32, sessions: 10 },
  { code: 'ICT401', name: 'Advanced Penetration', enrolled: 18, sessions: 8  },
  { code: 'ICT210', name: 'Database Systems',     enrolled: 35, sessions: 14 },
]

const sessionRecords = [
  { date: '28/09/2025', course: 'ICT307', session: 'Lecture',  present: 29, absent: 3, total: 32 },
  { date: '28/09/2025', course: 'ICT306', session: 'Tutorial', present: 25, absent: 3, total: 28 },
  { date: '21/09/2025', course: 'ICT307', session: 'Lecture',  present: 30, absent: 2, total: 32 },
  { date: '21/09/2025', course: 'ICT306', session: 'Lecture',  present: 24, absent: 4, total: 28 },
]

function LecturerPortal({ onLogout }) {
  const [filter, setFilter] = React.useState('All')

  const navLinks = [
    { label: 'Dashboard', href: '#' },
    { label: 'Sessions',  href: '#' },
    { label: 'Reports',   href: '#' },
  ]

  const filtered = filter === 'All'
    ? sessionRecords
    : sessionRecords.filter(r => r.course === filter)

  return (
    <div className="dashboard-body">
      <Sidebar role="Lecturer" navLinks={navLinks} onLogout={onLogout} />

      <main className="main-content">
        <header className="portal-header">
          <h1>Lecturer Portal</h1>
          <p>Raspberry Pi • OpenCV • Attendance Management</p>
        </header>

        {/* My Courses */}
        <div className="card" style={{ marginBottom: '22px' }}>
          <div className="card-header">
            <h3>My Courses</h3>
            <button className="btn-primary">+ New Session</button>
          </div>
          <div className="course-grid">
            {courses.map(c => (
              <div key={c.code} className="course-card">
                <h4>{c.code} — {c.name}</h4>
                <p>{c.enrolled} students enrolled</p>
                <div className="course-meta">
                  <span className="badge badge-blue">{c.sessions} sessions</span>
                  <span className="badge badge-green">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Records */}
        <div className="card">
          <div className="card-header">
            <h3>Session Attendance Records</h3>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', color: '#2b3674', cursor: 'pointer' }}
            >
              <option value="All">All Courses</option>
              {courses.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th><th>Course</th><th>Session</th>
                <th>Present</th><th>Absent</th><th>Total</th><th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  <td>{row.date}</td>
                  <td>{row.course}</td>
                  <td>{row.session}</td>
                  <td className="text-present">{row.present}</td>
                  <td className="text-absent">{row.absent}</td>
                  <td>{row.total}</td>
                  <td>{Math.round((row.present / row.total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  )
}
