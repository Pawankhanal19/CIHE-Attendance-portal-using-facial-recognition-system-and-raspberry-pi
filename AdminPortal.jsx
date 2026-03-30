// pages/AdminPortal.jsx
// Placeholder built to match Student Portal layout, different role

const allStudents = [
  { id: 'S1001', name: 'Alice Tan',   course: 'ICT307', attendance: 92, status: 'Active'  },
  { id: 'S1002', name: 'Ben Nguyen',  course: 'ICT306', attendance: 78, status: 'At Risk' },
  { id: 'S1003', name: 'Cara Liu',    course: 'ICT401', attendance: 88, status: 'Active'  },
  { id: 'S1004', name: 'Daniel Park', course: 'ICT210', attendance: 55, status: 'At Risk' },
  { id: 'S1005', name: 'Eva Smith',   course: 'ICT307', attendance: 97, status: 'Active'  },
  { id: 'S1006', name: 'Frank Gomez', course: 'ICT306', attendance: 40, status: 'Flagged' },
]

const systemLogs = [
  { time: '09:02', event: 'Face recognised — Alice Tan — ICT307 Lecture',       type: 'success' },
  { time: '09:05', event: 'Face recognised — Eva Smith — ICT307 Lecture',        type: 'success' },
  { time: '09:11', event: 'Unrecognised face detected — manual review required', type: 'warning' },
  { time: '09:18', event: 'Sync complete — 28 records uploaded to cloud',        type: 'info'    },
  { time: '09:30', event: 'Session closed — ICT307 Lecture attendance finalised',type: 'info'    },
]

function AdminPortal({ onLogout }) {
  const [search, setSearch] = React.useState('')

  const navLinks = [
    { label: 'Dashboard', href: '#' },
    { label: 'Students',  href: '#' },
    { label: 'Reports',   href: '#' },
    { label: 'Settings',  href: '#' },
  ]

  const filtered = allStudents.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.course.toLowerCase().includes(search.toLowerCase())
  )

  const avgAttendance = Math.round(
    allStudents.reduce((sum, s) => sum + s.attendance, 0) / allStudents.length
  )
  const atRisk = allStudents.filter(s => s.status !== 'Active').length

  return (
    <div className="dashboard-body">
      <Sidebar role="Admin" navLinks={navLinks} onLogout={onLogout} />

      <main className="main-content">
        <header className="portal-header">
          <h1>Admin Portal</h1>
          <p>System Overview • Attendance Management • User Control</p>
        </header>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Total Students</p>
            <p className="stat-value">{allStudents.length}</p>
            <p className="stat-sub">Across all courses</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Avg Attendance</p>
            <p className="stat-value">{avgAttendance}%</p>
            <p className="stat-sub">This semester</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">At Risk / Flagged</p>
            <p className="stat-value" style={{ color: '#fa5252' }}>{atRisk}</p>
            <p className="stat-sub">Require follow-up</p>
          </div>
        </div>

        <div className="dashboard-grid">

          {/* Student Records */}
          <div className="card full-width">
            <div className="card-header">
              <h3>Student Records</h3>
              <input
                className="admin-search"
                type="text"
                placeholder="Search by name, ID or course…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <table>
              <thead>
                <tr>
                  <th>Student ID</th><th>Name</th><th>Course</th>
                  <th>Attendance</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{s.id}</td>
                    <td>{s.name}</td>
                    <td>{s.course}</td>
                    <td className={s.attendance >= 80 ? 'text-present' : 'text-absent'}>
                      {s.attendance}%
                    </td>
                    <td>
                      <span className={
                        s.status === 'Active'  ? 'badge badge-green' :
                        s.status === 'At Risk' ? 'badge badge-red'   : 'badge badge-blue'
                      }>{s.status}</span>
                    </td>
                    <td>
                      <button className="btn-outline" style={{ padding: '5px 12px', fontSize: '12px' }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* System Log */}
          <div className="card full-width">
            <div className="card-header">
              <h3>System Log</h3>
              <span style={{ fontSize: '12px', color: '#a3aed0' }}>Today · 28/09/2025</span>
            </div>
            {systemLogs.map((log, i) => (
              <div key={i} className={`log-entry log-${log.type}`}>
                <span className="log-time">{log.time}</span>
                <span>{log.event}</span>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  )
}
