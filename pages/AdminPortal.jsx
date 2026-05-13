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
  const [logsModal,    setLogsModal]    = React.useState(null)
  const [analytics,    setAnalytics]    = React.useState(null)
  const [view,         setView]         = React.useState('home')

  const navLinks = [{ label: 'Home', href: '#' }]

  function showInfo(title, message) {
    setInfoModal({ title, message })
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
      } catch (err) {
        console.warn('Backend unavailable, using demo admin data.', err)
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
    } catch (err) {
      showInfo('System Logs', 'Could not load logs. Please ensure the backend server is running.')
    }
  }

  async function handleAttendanceAnalytics() {
    try {
      const data = await AttendanceAPI.fetchAnalytics()
      setAnalytics(data)
    } catch (err) {
      showInfo('Attendance Analytics', 'Could not load analytics. Please ensure the backend server is running.')
    }
  }

  async function handleComplianceReport() {
    try {
      const data = await AttendanceAPI.fetchAnalytics()
      const logs = data.recentLogs || []
      if (logs.length === 0) { showInfo('Compliance Report', 'No attendance records found.'); return }
      const rows = [['Name', 'Student ID', 'Course', 'Session', 'Status', 'Date', 'Time', 'Device']]
      logs.forEach(l => {
        const d = new Date(l.time || l.created_at)
        rows.push([l.name, l.person_id || '—', l.course_code || '—', l.session || '—',
          l.attendance_status || l.status,
          d.toLocaleDateString('en-GB'), d.toTimeString().slice(0, 5), l.device_id || '—'])
      })
      const csv  = rows.map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `compliance_report_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showInfo('Compliance Report', `Report downloaded — ${logs.length} records exported.`)
    } catch (err) {
      showInfo('Compliance Report', 'Could not generate report. Please ensure the backend server is running.')
    }
  }

  const filteredUsers = users.filter(u => {
    const m = u.name.toLowerCase().includes(search.toLowerCase()) ||
              (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
              (u.studentId || '').includes(search)
    return m && (roleFilter === 'All' || u.role === roleFilter)
  })

  async function handleAddUser() {
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.password.trim()) {
      showInfo('Add User', 'Please fill in name, username, and password.')
      return
    }
    try {
      const created = await AttendanceAPI.createUser(newUser)
      setUsers(prev => [created, ...prev])
      setNewUser({ name: '', username: '', password: '', role: 'Student', email: '', studentId: '' })
      setShowAddModal(false)
    } catch (err) {
      showInfo('Backend Connection', err.message || 'Could not add user. Please check the backend server.')
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('Remove this user?')) return
    try {
      await AttendanceAPI.deleteUser(id)
      setUsers(prev => prev.filter(u => (u._id || u.id) !== id))
    } catch (err) {
      showInfo('Backend Connection', err.message || 'Could not remove user.')
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
    } catch (err) {
      showInfo('Backend Connection', err.message || 'Could not update user.')
    }
  }

  function rolePillKind(role) {
    return role === 'Admin' ? 'info' : role === 'Lecturer' ? 'accent' : 'neutral'
  }

  const avatarColors = {
    Student: '#0ca678', Lecturer: '#5c3de8', Admin: '#3b5bdb',
  }

  // Overlay style shared by modals
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(15,26,74,0.32)',
    display: 'grid', placeItems: 'center', zIndex: 200,
  }
  const modalBox = {
    background: 'var(--surface)', borderRadius: 14, padding: 24,
    boxShadow: 'var(--shadow-lg)', border: '1px solid var(--ink-100)',
  }

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="ap-shell">
      <Sidebar role="Admin" navLinks={navLinks} onLogout={onLogout}
               onSettings={() => setView('settings')} currentUser={currentUser} />

      <main className="ap-main">

        {view === 'settings' && (
          <SettingsPage role="Admin" currentUser={currentUser} onBack={() => setView('home')} />
        )}
        {view !== 'settings' && (<>

        {/* Info modal */}
        {infoModal && (
          <div style={overlay} onClick={() => setInfoModal(null)}>
            <div style={{ ...modalBox, width: 400 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 10 }}>
                {infoModal.title}
              </div>
              <p style={{ color: 'var(--ink-500)', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
                {infoModal.message}
              </p>
              <button className="ap-btn primary" style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setInfoModal(null)}>OK, Got It</button>
            </div>
          </div>
        )}

        {/* Logs modal */}
        {logsModal && (
          <div style={overlay} onClick={() => setLogsModal(null)}>
            <div style={{ ...modalBox, width: 780, maxHeight: '80vh', overflowY: 'auto' }}
                 onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 16 }}>
                System attendance logs
              </div>
              {logsModal.length === 0 ? (
                <p style={{ color: 'var(--ink-300)', textAlign: 'center', padding: 20, fontSize: 13 }}>
                  No attendance logs found.
                </p>
              ) : (
                <table className="ap-table">
                  <thead>
                    <tr>
                      {['Name', 'Course', 'Status', 'Attendance', 'Device', 'Time'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logsModal.map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{l.name}</td>
                        <td className="mono">{l.course_code || '—'}</td>
                        <td>
                          <ApStatus kind={l.status === 'recognised' ? 'success' : 'danger'} dot={false}>
                            {l.status}
                          </ApStatus>
                        </td>
                        <td>
                          <ApStatus kind={
                            l.attendance_status === 'Present' ? 'success' :
                            l.attendance_status === 'Late'    ? 'warning' : 'danger'
                          }>{l.attendance_status || '—'}</ApStatus>
                        </td>
                        <td className="mono">{l.device_id}</td>
                        <td className="mono">{new Date(l.time).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button className="ap-btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                      onClick={() => setLogsModal(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Analytics modal */}
        {analytics && (
          <div style={overlay} onClick={() => setAnalytics(null)}>
            <div style={{ ...modalBox, width: 500 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>
                Attendance analytics
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Records',    value: analytics.total,   accent: 'var(--primary)' },
                  { label: 'Present',          value: analytics.present, accent: 'var(--success)' },
                  { label: 'Late',             value: analytics.late,    accent: 'var(--warning)' },
                  { label: 'Absent / Denied',  value: (analytics.absent || 0) + (analytics.denied || 0), accent: 'var(--danger)' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'var(--surface-2)', borderRadius: 10, padding: 16,
                    textAlign: 'center', border: '1px solid var(--ink-100)',
                  }}>
                    <p style={{ fontSize: 28, fontWeight: 700, color: stat.accent, margin: 0 }}>{stat.value}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-400)', margin: '4px 0 0' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
              {analytics.byCourse?.length > 0 && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>By course</p>
                  {analytics.byCourse.map(c => (
                    <div key={c._id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid var(--ink-100)', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{c._id || 'Unknown'}</span>
                      <span style={{ color: 'var(--ink-400)' }}>{c.present}/{c.total} present</span>
                    </div>
                  ))}
                </>
              )}
              <button className="ap-btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
                      onClick={() => setAnalytics(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Add User modal */}
        {showAddModal && (
          <div style={overlay} onClick={() => setShowAddModal(false)}>
            <div style={{ ...modalBox, width: 380 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 18 }}>
                Add new user
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { placeholder: 'Full Name',         key: 'name',      type: 'text'     },
                  { placeholder: 'Username',           key: 'username',  type: 'text'     },
                  { placeholder: 'Temporary Password', key: 'password',  type: 'password' },
                  { placeholder: 'Email',              key: 'email',     type: 'email'    },
                  { placeholder: 'Student ID / Staff ID', key: 'studentId', type: 'text' },
                ].map(f => (
                  <input key={f.key} className="ap-input" type={f.type} placeholder={f.placeholder}
                         value={newUser[f.key]}
                         onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))} />
                ))}
                <select className="ap-select" value={newUser.role}
                        onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="Student">Student</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Admin">Admin</option>
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="ap-btn ghost" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button className="ap-btn primary" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={handleAddUser}>Add user</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit User modal */}
        {editingId !== null && (
          <div style={overlay} onClick={() => setEditingId(null)}>
            <div style={{ ...modalBox, width: 380 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 18 }}>
                Edit user
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input className="ap-input" value={editUser.name || ''}
                       placeholder="Full name"
                       onChange={e => setEditUser(p => ({ ...p, name: e.target.value }))} />
                <input className="ap-input" value={editUser.username || ''}
                       placeholder="Username"
                       onChange={e => setEditUser(p => ({ ...p, username: e.target.value }))} />
                <input className="ap-input" type="password" placeholder="New password (optional)"
                       value={editUser.password || ''}
                       onChange={e => setEditUser(p => ({ ...p, password: e.target.value }))} />
                <input className="ap-input" value={editUser.email || ''}
                       placeholder="Email"
                       onChange={e => setEditUser(p => ({ ...p, email: e.target.value }))} />
                <select className="ap-select" value={editUser.role || 'Student'}
                        onChange={e => setEditUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="Student">Student</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Admin">Admin</option>
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="ap-btn ghost" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="ap-btn primary" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={handleEditSave}>Save changes</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <ApTopBar title="Admin console" sub={`${today} · all systems nominal`}>
          <ApStatus kind={systemHealth?.status ? 'success' : 'neutral'}>
            {systemHealth?.status ? 'API healthy' : 'Demo mode'}
          </ApStatus>
          <button className="ap-btn ghost" onClick={handleComplianceReport}>
            <ApIcon name="download" size={14} /> Compliance report
          </button>
          <button className="ap-btn primary" onClick={() => setShowAddModal(true)}>
            <ApIcon name="plus" size={14} /> Add user
          </button>
        </ApTopBar>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <ApKpi label="Total users" value={users.length}
                 sub={`${users.filter(u=>u.role==='Student').length} students · ${users.filter(u=>u.role==='Lecturer').length} lecturers`} />
          <ApKpi label="Live sessions" value="—" sub="no active sessions" accent="var(--primary)" />
          <ApKpi label="Devices online" value={systemHealth?.devices_online ?? '—'}
                 sub="Raspberry Pi cameras" accent="var(--warning)" />
          <ApKpi label="Logs today" value={systemHealth?.attendance_logs?.toLocaleString() ?? '—'}
                 sub="total attendance records" />
        </div>

        {/* User management table */}
        <div className="ap-card padless">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 12px', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div className="ap-card-title">User management</div>
              <div className="ap-card-sub">{filteredUsers.length} of {users.length} users · sorted by recent activity</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="ap-input-wrap" style={{ width: 260 }}>
                <ApIcon name="search" size={14} />
                <input className="ap-input" placeholder="Search by name, email or ID…"
                       value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="ap-select" style={{ width: 140 }}
                      value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="All">All roles</option>
                <option value="Student">Student</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Admin">Admin</option>
              </select>
              <button className="ap-btn ghost">
                <ApIcon name="download" size={14} /> Export
              </button>
            </div>
          </div>

          <table className="ap-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>ID</th>
                <th>Email</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--ink-300)', padding: 24 }}>
                    No users match your search.
                  </td>
                </tr>
              ) : filteredUsers.map(u => (
                <tr key={u._id || u.id}>
                  <td>
                    <div className="ap-row-name">
                      <ApAvatar name={u.name} color={avatarColors[u.role] || '#3b5bdb'} size={32} />
                      <div>
                        <div style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{u.name}</div>
                        {u.username && <div style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>@{u.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <ApStatus kind={rolePillKind(u.role)} dot={false}>{u.role}</ApStatus>
                  </td>
                  <td className="mono">{u.studentId || u._id?.slice(-6) || '—'}</td>
                  <td style={{ color: 'var(--ink-500)' }}>{u.email}</td>
                  <td>
                    <ApStatus kind="success">Active</ApStatus>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button className="ap-btn ghost xs" onClick={() => handleEditStart(u)}>
                        <ApIcon name="edit" size={12} /> Edit
                      </button>
                      <button className="ap-btn ghost xs" style={{ color: 'var(--danger)' }}
                              onClick={() => handleRemove(u._id || u.id)}>
                        <ApIcon name="trash" size={12} /> Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--ink-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--ink-400)',
          }}>
            <span>Showing {filteredUsers.length} users</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="ap-btn ghost xs">Previous</button>
              <button className="ap-btn ghost xs">Next</button>
            </div>
          </div>
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>

          {/* Devices */}
          <div className="ap-card">
            <div className="ap-card-head">
              <div>
                <div className="ap-card-title">Raspberry Pi devices</div>
                <div className="ap-card-sub">Polled every 5 s · OpenCV pipeline</div>
              </div>
              <button className="ap-btn ghost sm">
                <ApIcon name="wifi" size={13} /> Ping all
              </button>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              alignItems: 'center', gap: 14,
              padding: '10px 14px',
              border: '1px solid var(--ink-100)',
              borderRadius: 10,
              background: 'var(--surface-2)',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>
                  Registered devices
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>
                  {systemHealth?.devices_online ?? '—'} online · facial recognition active
                </div>
              </div>
              <ApStatus kind={
                systemHealth?.devices_online > 0 ? 'success' : 'neutral'
              }>
                {systemHealth?.devices_online ?? '—'} online
              </ApStatus>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="ap-btn ghost" onClick={handleViewLogs}>
                <ApIcon name="database" size={14} /> View attendance logs
              </button>
              <button className="ap-btn dark" onClick={handleAttendanceAnalytics}>
                <ApIcon name="graph" size={14} /> Attendance analytics
              </button>
            </div>
          </div>

          {/* System health */}
          <div className="ap-card">
            <div className="ap-card-head">
              <div>
                <div className="ap-card-title">System health</div>
                <div className="ap-card-sub">Last checked just now</div>
              </div>
              <ApStatus kind={systemHealth?.status ? 'success' : 'neutral'}>
                {systemHealth?.status ? 'All green' : 'Demo mode'}
              </ApStatus>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  label: 'API server',
                  val: systemHealth?.status || 'Demo mode',
                  pct: systemHealth?.status ? 14 : 0,
                  kind: systemHealth?.status ? 'success' : 'warning',
                  sub: 'Response time healthy',
                },
                {
                  label: 'MongoDB Atlas',
                  val: systemHealth?.database || 'Not connected',
                  pct: systemHealth?.database ? 100 : 0,
                  kind: systemHealth?.database ? 'success' : 'danger',
                  sub: 'Database connection',
                },
                {
                  label: 'Devices online',
                  val: `${systemHealth?.devices_online ?? 0} active`,
                  pct: Math.min(100, (systemHealth?.devices_online ?? 0) * 25),
                  kind: 'success',
                  sub: 'Raspberry Pi cameras',
                },
                {
                  label: 'Attendance logs',
                  val: (systemHealth?.attendance_logs ?? 0).toLocaleString(),
                  pct: Math.min(100, Math.round((systemHealth?.attendance_logs ?? 0) / 10)),
                  kind: 'success',
                  sub: 'Total records in database',
                },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)' }}>{m.label}</span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{m.val}</span>
                  </div>
                  <div className={'ap-bar ' + m.kind}>
                    <span style={{ width: m.pct + '%' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 3 }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div className="ap-divider" />

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ap-btn ghost" style={{ flex: 1, justifyContent: 'center' }}
                      onClick={handleViewLogs}>
                <ApIcon name="database" size={14} /> View audit log
              </button>
              <button className="ap-btn dark" style={{ flex: 1, justifyContent: 'center' }}
                      onClick={handleAttendanceAnalytics}>
                <ApIcon name="graph" size={14} /> Open analytics
              </button>
            </div>
          </div>
        </div>

        </>)}
      </main>
    </div>
  )
}
