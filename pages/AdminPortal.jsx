// pages/AdminPortal.jsx

const initialUsers = [
  { id: 1, name: 'Priyanka Karki',    role: 'Student',  email: 'pk@example.com' },
  { id: 2, name: 'Dr. Sarah Johnson', role: 'Lecturer', email: 'sj@example.com' },
]

function AdminPortal({ currentUser, onLogout }) {
  const [users,        setUsers]        = React.useState(initialUsers)
  const [search,       setSearch]       = React.useState('')
  const [roleFilter,   setRoleFilter]   = React.useState('All')
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [newUser,      setNewUser]      = React.useState({ name: '', username: '', password: '', role: 'Student', email: '', studentId: '' })
  const [editingId,    setEditingId]    = React.useState(null)
  const [editUser,     setEditUser]     = React.useState({})
  const [infoModal,    setInfoModal]    = React.useState(null)
  const [systemHealth, setSystemHealth] = React.useState(null)
  const [logsModal,    setLogsModal]    = React.useState(null)   // array of log objects
  const [analytics,    setAnalytics]    = React.useState(null)   // analytics object

  const navLinks = [{ label: 'Home', href: '#' }]

  // ── Info modal helpers ──────────────────────────────────────
  function showInfo(title, message, icon) {
    setInfoModal({ title, message, icon: icon || '⚠️' })
  }

  React.useEffect(() => {
    let cancelled = false

    async function loadAdminData() {
      try {
        const [apiUsers, health] = await Promise.all([
          AttendanceAPI.fetchUsers(),
          AttendanceAPI.fetchHealth(),
        ])

        if (!cancelled) {
          setUsers(apiUsers)
          setSystemHealth(health)
        }
      } catch (error) {
        console.warn('Backend unavailable, using demo admin data.', error)
      }
    }

    loadAdminData()
    const socket = AttendanceAPI.connectSocket()

    if (socket) {
      socket.on('users_updated', loadAdminData)
      socket.on('attendance_updated', loadAdminData)
    }

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [])

  async function handleViewLogs() {
    try {
      const data = await AttendanceAPI.fetchAnalytics()
      setLogsModal(data.recentLogs || [])
    } catch (error) {
      showInfo('System Logs', 'Could not load logs. Please ensure the backend server is running.', '📋')
    }
  }

  async function handleAttendanceAnalytics() {
    try {
      const data = await AttendanceAPI.fetchAnalytics()
      setAnalytics(data)
    } catch (error) {
      showInfo('Attendance Analytics', 'Could not load analytics. Please ensure the backend server is running.', '📊')
    }
  }

  async function handleComplianceReport() {
    try {
      const data = await AttendanceAPI.fetchAnalytics()
      const logs = data.recentLogs || []
      if (logs.length === 0) {
        showInfo('Compliance Report', 'No attendance records found to generate a report.', '📄')
        return
      }
      const rows = [['Name', 'Student ID', 'Course', 'Session', 'Status', 'Date', 'Time', 'Device']]
      logs.forEach(l => {
        const d = new Date(l.time || l.created_at)
        rows.push([
          l.name,
          l.person_id || '—',
          l.course_code || '—',
          l.session || '—',
          l.attendance_status || l.status,
          d.toLocaleDateString('en-GB'),
          d.toTimeString().slice(0, 5),
          l.device_id || '—',
        ])
      })
      const csv  = rows.map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `compliance_report_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showInfo('Compliance Report', `Report downloaded — ${logs.length} records exported successfully.`, '📄')
    } catch (error) {
      showInfo('Compliance Report', 'Could not generate report. Please ensure the backend server is running.', '📄')
    }
  }

  // ── User management helpers ─────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'All' || u.role === roleFilter
    return matchSearch && matchRole
  })

  async function handleAddUser() {
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.password.trim()) {
      alert('Please fill in name, username, and password.')
      return
    }

    try {
      const created = await AttendanceAPI.createUser(newUser)
      setUsers(prev => [created, ...prev])
      setNewUser({ name: '', username: '', password: '', role: 'Student', email: '', studentId: '' })
      setShowAddModal(false)
    } catch (error) {
      showInfo('Backend Connection', error.message || 'Could not add user. Please check the backend server.', '⚠️')
    }
  }

  async function handleRemove(id) {
    if (window.confirm('Remove this user?')) {
      try {
        await AttendanceAPI.deleteUser(id)
        setUsers(prev => prev.filter(u => (u._id || u.id) !== id))
      } catch (error) {
        showInfo('Backend Connection', error.message || 'Could not remove user. Please check the backend server.', '⚠️')
      }
    }
  }

  function handleEditStart(user) {
    setEditingId(user._id || user.id)
    setEditUser({ ...user })
  }

  async function handleEditSave() {
    try {
      const updated = await AttendanceAPI.updateUser(editingId, editUser)
      setUsers(prev => prev.map(u => (u._id || u.id) === editingId ? updated : u))
      setEditingId(null)
    } catch (error) {
      showInfo('Backend Connection', error.message || 'Could not update user. Please check the backend server.', '⚠️')
    }
  }

  // ── Shared inline styles ────────────────────────────────────
  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
  }
  const modalBoxStyle = {
    background: 'white', padding: '30px', borderRadius: '14px',
    width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
  }
  const inputStyle = {
    padding: '10px 12px', border: '1px solid #dde3f0', borderRadius: '8px',
    fontSize: '13px', outline: 'none', color: '#2b3674', width: '100%'
  }
  const selectStyle = {
    padding: '10px 12px', border: '1px solid #dde3f0', borderRadius: '8px',
    fontSize: '13px', outline: 'none', color: '#2b3674', width: '100%',
    cursor: 'pointer', background: 'white'
  }
  const cancelBtnStyle = {
    flex: 1, padding: '10px', border: '1px solid #dde3f0', borderRadius: '9px',
    cursor: 'pointer', background: 'white', color: '#2b3674',
    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit'
  }

  return (
    <div className="dashboard-body">
      <Sidebar role="Admin" navLinks={navLinks} onLogout={onLogout} currentUser={currentUser} />

      <main className="main-content">

        {/* Header banner */}
        <header className="portal-header">
          <h1>Admin Console</h1>
          <p>Raspberry Pi • OpenCV • Secure Sync</p>
        </header>

        {/* Search / Filter / Add User bar */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="admin-bar">
            <input
              className="admin-search-input"
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="admin-filter-select"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="All">Filter role</option>
              <option value="Student">Student</option>
              <option value="Lecturer">Lecturer</option>
              <option value="Admin">Admin</option>
            </select>
            <button className="btn-add-user" onClick={() => setShowAddModal(true)}>
              Add User
            </button>
          </div>
        </div>

        {/* ── Info / unavailable modal ── */}
        {infoModal && (
          <div style={overlayStyle}>
            <div style={{ ...modalBoxStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '42px', marginBottom: '14px' }}>{infoModal.icon}</div>
              <h3 style={{ color: '#3b5bdb', fontSize: '17px', marginBottom: '12px' }}>
                {infoModal.title}
              </h3>
              <p style={{ color: '#4a5a8a', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
                {infoModal.message}
              </p>
              <button
                className="btn-add-user"
                style={{ width: '100%' }}
                onClick={() => setInfoModal(null)}
              >
                OK, Got It
              </button>
            </div>
          </div>
        )}

        {/* ── View Logs modal ── */}
        {logsModal && (
          <div style={overlayStyle} onClick={() => setLogsModal(null)}>
            <div style={{ ...modalBoxStyle, width: '780px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: '#3b5bdb', fontSize: '17px', marginBottom: '16px' }}>📋 System Attendance Logs</h3>
              {logsModal.length === 0 ? (
                <p style={{ color: '#a3aed0', textAlign: 'center', padding: '20px' }}>No attendance logs found.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9ff' }}>
                      {['Name', 'Course', 'Status', 'Attendance', 'Device', 'Time'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#2b3674', borderBottom: '1px solid #e8edf5' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logsModal.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px 10px', color: '#2b3674' }}>{l.name}</td>
                        <td style={{ padding: '8px 10px', color: '#4a5a8a' }}>{l.course_code || '—'}</td>
                        <td style={{ padding: '8px 10px', color: l.status === 'recognised' ? '#2f9e44' : '#c92a2a' }}>{l.status}</td>
                        <td style={{ padding: '8px 10px', color: l.attendance_status === 'Present' ? '#2f9e44' : l.attendance_status === 'Late' ? '#c18a00' : '#c92a2a' }}>{l.attendance_status}</td>
                        <td style={{ padding: '8px 10px', color: '#a3aed0', fontSize: '12px' }}>{l.device_id}</td>
                        <td style={{ padding: '8px 10px', color: '#a3aed0', fontSize: '12px' }}>{new Date(l.time).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button className="btn-add-user" style={{ width: '100%', marginTop: '16px' }} onClick={() => setLogsModal(null)}>Close</button>
            </div>
          </div>
        )}

        {/* ── Analytics modal ── */}
        {analytics && (
          <div style={overlayStyle} onClick={() => setAnalytics(null)}>
            <div style={{ ...modalBoxStyle, width: '500px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: '#3b5bdb', fontSize: '17px', marginBottom: '20px' }}>📊 Attendance Analytics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Records', value: analytics.total, color: '#3b5bdb' },
                  { label: 'Present', value: analytics.present, color: '#2f9e44' },
                  { label: 'Late', value: analytics.late, color: '#c18a00' },
                  { label: 'Absent / Denied', value: (analytics.absent || 0) + (analytics.denied || 0), color: '#c92a2a' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: '#f8f9ff', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
                    <p style={{ fontSize: '12px', color: '#a3aed0', margin: '4px 0 0' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
              {analytics.byCourse?.length > 0 && (
                <>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#2b3674', marginBottom: '10px' }}>By Course</p>
                  {analytics.byCourse.map(c => (
                    <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                      <span style={{ color: '#2b3674' }}>{c._id || 'Unknown'}</span>
                      <span style={{ color: '#a3aed0' }}>{c.present}/{c.total} present</span>
                    </div>
                  ))}
                </>
              )}
              <button className="btn-add-user" style={{ width: '100%', marginTop: '20px' }} onClick={() => setAnalytics(null)}>Close</button>
            </div>
          </div>
        )}

        {/* ── Add User modal ── */}
        {showAddModal && (
          <div style={overlayStyle}>
            <div style={modalBoxStyle}>
              <h3 style={{ color: '#3b5bdb', marginBottom: '18px', fontSize: '16px' }}>Add New User</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input style={inputStyle} placeholder="Full Name"
                  value={newUser.name}
                  onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Username"
                  value={newUser.username}
                  onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} />
                <input style={inputStyle} type="password" placeholder="Temporary Password"
                  value={newUser.password}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                <input style={inputStyle} placeholder="Email"
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                <input style={inputStyle} placeholder="Student ID / Staff ID"
                  value={newUser.studentId}
                  onChange={e => setNewUser(p => ({ ...p, studentId: e.target.value }))} />
                <select style={selectStyle} value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="Student">Student</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Admin">Admin</option>
                </select>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button className="btn-add-user" style={{ flex: 1 }} onClick={handleAddUser}>Add</button>
                  <button style={cancelBtnStyle} onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit User modal ── */}
        {editingId !== null && (
          <div style={overlayStyle}>
            <div style={modalBoxStyle}>
              <h3 style={{ color: '#3b5bdb', marginBottom: '18px', fontSize: '16px' }}>Edit User</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input style={inputStyle} value={editUser.name}
                  onChange={e => setEditUser(p => ({ ...p, name: e.target.value }))} />
                <input style={inputStyle} value={editUser.username || ''}
                  onChange={e => setEditUser(p => ({ ...p, username: e.target.value }))} />
                <input style={inputStyle} type="password" placeholder="New password (optional)"
                  value={editUser.password || ''}
                  onChange={e => setEditUser(p => ({ ...p, password: e.target.value }))} />
                <input style={inputStyle} value={editUser.email}
                  onChange={e => setEditUser(p => ({ ...p, email: e.target.value }))} />
                <select style={selectStyle} value={editUser.role}
                  onChange={e => setEditUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="Student">Student</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Admin">Admin</option>
                </select>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button className="btn-add-user" style={{ flex: 1 }} onClick={handleEditSave}>Save</button>
                  <button style={cancelBtnStyle} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management table */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>User Management</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ color: '#a3aed0', textAlign: 'center' }}>No users found.</td>
                </tr>
              ) : filteredUsers.map(u => (
                <tr key={u._id || u.id}>
                  <td>{u.name}</td>
                  <td>{u.username || '—'}</td>
                  <td>{u.role}</td>
                  <td>{u.email}</td>
                  <td>
                    <button className="btn-edit"   onClick={() => handleEditStart(u)}>Edit</button>
                    <button className="btn-remove" onClick={() => handleRemove(u._id || u.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom grid: System Health | Reports */}
        <div className="admin-bottom-grid">

          <div className="card">
            <div className="card-header">
              <h3>System Health</h3>
            </div>
            <p className="health-line">API Status: {systemHealth?.status || 'Demo mode'}</p>
            <p className="health-line">Database: {systemHealth?.database || 'Not connected'}</p>
            <p className="health-line">Raspberry Pi devices online: {systemHealth?.devices_online ?? 0}</p>
            <p className="health-line">Attendance logs: {systemHealth?.attendance_logs ?? 0}</p>
            <button className="btn-view-logs" onClick={handleViewLogs}>View Logs</button>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Reports</h3>
            </div>
            <div className="reports-btn-group">
              <button className="btn-dark" onClick={handleAttendanceAnalytics}>Attendance Analytics</button>
              <button className="btn-dark" onClick={handleComplianceReport}>Compliance Report</button>
            </div>
          </div>

        </div>

      </main>
    </div>
  )
}
