// pages/AdminPortal.jsx

const initialUsers = [
  { id: 1, name: 'Priyanka Karki',    role: 'Student',  email: 'pk@example.com' },
  { id: 2, name: 'Dr. Sarah Johnson', role: 'Lecturer', email: 'sj@example.com' },
]

function AdminPortal({ onLogout }) {
  const [users,        setUsers]        = React.useState(initialUsers)
  const [search,       setSearch]       = React.useState('')
  const [roleFilter,   setRoleFilter]   = React.useState('All')
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [newUser,      setNewUser]      = React.useState({ name: '', role: 'Student', email: '' })
  const [editingId,    setEditingId]    = React.useState(null)
  const [editUser,     setEditUser]     = React.useState({})
  const [infoModal,    setInfoModal]    = React.useState(null) // { title, message, icon }

  const navLinks = [{ label: 'Home', href: '#' }]

  // ── Info modal helpers ──────────────────────────────────────
  function showInfo(title, message, icon) {
    setInfoModal({ title, message, icon: icon || '⚠️' })
  }

  function handleViewLogs() {
    showInfo(
      'System Logs',
      'Could not display system logs at this moment. Please ensure the backend server is running and try again.',
      '📋'
    )
  }

  function handleAttendanceAnalytics() {
    showInfo(
      'Attendance Analytics',
      'Could not display attendance analytics at this moment. This feature requires a live backend connection.',
      '📊'
    )
  }

  function handleComplianceReport() {
    showInfo(
      'Compliance Report',
      'Could not display the compliance report at this moment. Please ensure the backend server is running and try again.',
      '📄'
    )
  }

  // ── User management helpers ─────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'All' || u.role === roleFilter
    return matchSearch && matchRole
  })

  function handleAddUser() {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      alert('Please fill in all fields.')
      return
    }
    setUsers(prev => [...prev, { ...newUser, id: Date.now() }])
    setNewUser({ name: '', role: 'Student', email: '' })
    setShowAddModal(false)
  }

  function handleRemove(id) {
    if (window.confirm('Remove this user?')) {
      setUsers(prev => prev.filter(u => u.id !== id))
    }
  }

  function handleEditStart(user) {
    setEditingId(user.id)
    setEditUser({ ...user })
  }

  function handleEditSave() {
    setUsers(prev => prev.map(u => u.id === editingId ? { ...editUser } : u))
    setEditingId(null)
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
      <Sidebar role="Admin" navLinks={navLinks} onLogout={onLogout} />

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

        {/* ── Add User modal ── */}
        {showAddModal && (
          <div style={overlayStyle}>
            <div style={modalBoxStyle}>
              <h3 style={{ color: '#3b5bdb', marginBottom: '18px', fontSize: '16px' }}>Add New User</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input style={inputStyle} placeholder="Full Name"
                  value={newUser.name}
                  onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Email"
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
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
                <th>Role</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ color: '#a3aed0', textAlign: 'center' }}>No users found.</td>
                </tr>
              ) : filteredUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td>{u.email}</td>
                  <td>
                    <button className="btn-edit"   onClick={() => handleEditStart(u)}>Edit</button>
                    <button className="btn-remove" onClick={() => handleRemove(u.id)}>Remove</button>
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
            <p className="health-line">Uptime: 99.6%</p>
            <p className="health-line">Raspberry Pi devices online: 4/4</p>
            <p className="health-line">Last backup: 27 Sept 2025, 11:45 PM</p>
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