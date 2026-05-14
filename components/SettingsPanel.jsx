// components/SettingsPanel.jsx

function SettingsSection({ title, desc, children }) {
  return (
    <div className="ap-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--ink-100)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</div>
        {desc && <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ padding: '0 24px' }}>{children}</div>
    </div>
  )
}

function SettingsRow({ label, desc, noBorder, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 24, padding: '15px 0',
      borderBottom: noBorder ? 'none' : '1px solid var(--ink-100)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function SettingsPage({ role, currentUser, onBack }) {

  const [profile, setProfile] = React.useState({
    name:       currentUser?.name       || '',
    email:      currentUser?.email      || '',
    phone:      currentUser?.phone      || '',
    address:    currentUser?.address    || '',
    program:    currentUser?.program    || '',
    office:     currentUser?.office     || '',
    department: currentUser?.department || '',
    bio:        currentUser?.bio        || '',
    language:   'en-au',
  })

  const [passwords, setPasswords] = React.useState({ current: '', newPass: '', confirm: '' })
  const [showPw,    setShowPw]    = React.useState({ current: false, newPass: false, confirm: false })

  const [theme,  setTheme]  = React.useState(() => localStorage.getItem('ap-theme')  || 'light')
  const [accent, setAccent] = React.useState(() => localStorage.getItem('ap-accent') || '#3b5bdb')

  const [dirty, setDirty] = React.useState(false)
  const [toast, setToast] = React.useState(null)

  // Reload profile from server on mount
  React.useEffect(() => {
    AttendanceAPI.fetchMe().then(u => {
      setProfile(p => ({
        ...p,
        name:       u.name       || '',
        email:      u.email      || '',
        phone:      u.phone      || '',
        address:    u.address    || '',
        program:    u.program    || '',
        office:     u.office     || '',
        department: u.department || '',
        bio:        u.bio        || '',
      }))
    }).catch(() => {})
  }, [])

  React.useEffect(() => {
    const saved = localStorage.getItem('ap-accent')
    if (saved) { setAccent(saved); document.documentElement.style.setProperty('--primary', saved) }
  }, [])

  function set(key, val) { setProfile(p => ({ ...p, [key]: val })); setDirty(true) }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }

  function handleThemeChange(t) {
    setTheme(t)
    const applied = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t
    document.documentElement.setAttribute('data-theme', applied)
    localStorage.setItem('ap-theme', t)
    setDirty(true)
  }

  function handleAccentChange(color) {
    setAccent(color)
    document.documentElement.style.setProperty('--primary', color)
    localStorage.setItem('ap-accent', color)
    setDirty(true)
  }

  async function handleSave() {
    try {
      await AttendanceAPI.updateMe({
        name:       profile.name.trim(),
        email:      profile.email.trim(),
        phone:      profile.phone.trim(),
        address:    profile.address.trim(),
        program:    profile.program.trim(),
        office:     profile.office.trim(),
        department: profile.department.trim(),
        bio:        profile.bio.trim(),
      })
      setDirty(false)
      showToast('Settings saved successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not save settings.', 'error')
    }
  }

  function handleDiscard() {
    setProfile(p => ({
      ...p,
      name:       currentUser?.name       || '',
      email:      currentUser?.email      || '',
      phone:      currentUser?.phone      || '',
      address:    currentUser?.address    || '',
      program:    currentUser?.program    || '',
      office:     currentUser?.office     || '',
      department: currentUser?.department || '',
      bio:        currentUser?.bio        || '',
    }))
    setDirty(false)
  }

  async function handleChangePassword() {
    if (!passwords.current)                        { showToast('Enter your current password.', 'error');         return }
    if (!passwords.newPass)                        { showToast('Enter a new password.', 'error');                return }
    if (passwords.newPass.length < 6)              { showToast('Password must be at least 6 characters.', 'error'); return }
    if (passwords.newPass !== passwords.confirm)   { showToast('Passwords do not match.', 'error');              return }
    try {
      await AttendanceAPI.updateMe({ currentPassword: passwords.current, newPassword: passwords.newPass })
      setPasswords({ current: '', newPass: '', confirm: '' })
      showToast('Password updated successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not update password.', 'error')
    }
  }

  const avatarBg = role === 'Admin' ? '#3b5bdb' : role === 'Lecturer' ? '#5c3de8' : '#0ca678'
  const initials  = (currentUser?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const studentId = currentUser?.studentId || '—'
  const accents   = ['#3b5bdb', '#5c3de8', '#0ca678', '#d97706', '#dc2626', '#0891b2']

  const tc = {
    success: { bg: 'var(--success-50)', border: 'rgba(16,185,129,0.3)', color: 'var(--success)' },
    info:    { bg: 'var(--primary-50)', border: 'rgba(59,91,219,0.3)',  color: 'var(--primary)' },
    error:   { bg: 'var(--danger-50)',  border: 'rgba(220,38,38,0.3)',  color: 'var(--danger)'  },
  }

  const inputW = { width: 260 }

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 300,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          maxWidth: 340, boxShadow: 'var(--shadow-md)',
          border: `1px solid ${tc[toast.type]?.border}`,
          background: tc[toast.type]?.bg, color: tc[toast.type]?.color,
        }}>
          {toast.message}
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>Settings</div>
          <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>Manage your account, appearance and privacy.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button className="ap-btn ghost sm" onClick={onBack}>← Back</button>
          <div style={{
            display: 'flex', background: 'var(--surface)',
            border: '1px solid var(--ink-100)', borderRadius: 8, padding: 3, gap: 2,
          }}>
            {['Student', 'Lecturer', 'Admin'].map(r => (
              <div key={r} style={{
                padding: '5px 13px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                background: role === r ? 'var(--primary)' : 'transparent',
                color: role === r ? 'white' : 'var(--ink-400)',
              }}>{r}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>

        {/* PROFILE */}
        <SettingsSection title="Profile" desc="Your personal details visible across the portal.">

          {/* Avatar row — no change photo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 0', borderBottom: '1px solid var(--ink-100)',
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: avatarBg, color: 'white',
              display: 'grid', placeItems: 'center',
              fontSize: 17, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{currentUser?.name || 'User'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {studentId}{role !== 'Student' && profile.department ? ` · ${profile.department}` : ''}
              </div>
            </div>
          </div>

          <SettingsRow label="Display name">
            <input className="ap-input" style={inputW} value={profile.name}
                   onChange={e => set('name', e.target.value)} />
          </SettingsRow>

          <SettingsRow label="Email" desc="Used for notifications and password recovery.">
            <input className="ap-input" type="email" style={inputW} value={profile.email}
                   onChange={e => set('email', e.target.value)} />
          </SettingsRow>

          <SettingsRow label="Phone number" desc="Contact number for emergency or admin use.">
            <input className="ap-input" type="tel" style={inputW} placeholder="+61 4xx xxx xxx"
                   value={profile.phone}
                   onChange={e => set('phone', e.target.value)} />
          </SettingsRow>

          <SettingsRow label="Address" desc="Residential or mailing address.">
            <input className="ap-input" style={inputW} placeholder="Street, suburb, state, country"
                   value={profile.address}
                   onChange={e => set('address', e.target.value)} />
          </SettingsRow>

          {role === 'Student' && (
            <SettingsRow label="Program / Course" desc="Your enrolled program at CIHE.">
              <input className="ap-input" style={inputW} placeholder="e.g. Bachelor of Information Technology"
                     value={profile.program}
                     onChange={e => set('program', e.target.value)} />
            </SettingsRow>
          )}

          {role !== 'Student' && (
            <>
              <SettingsRow label="Department">
                <input className="ap-input" style={inputW} placeholder="e.g. School of Information Technology"
                       value={profile.department}
                       onChange={e => set('department', e.target.value)} />
              </SettingsRow>
              <SettingsRow label="Office / Room">
                <input className="ap-input" style={inputW} placeholder="e.g. Building B, Room 204"
                       value={profile.office}
                       onChange={e => set('office', e.target.value)} />
              </SettingsRow>
            </>
          )}

          <SettingsRow label="Bio" desc="A short description about yourself." noBorder>
            <textarea className="ap-input" style={{ ...inputW, height: 72, resize: 'vertical', padding: '8px 12px', lineHeight: 1.5 }}
                      placeholder="Tell others a little about yourself…"
                      value={profile.bio}
                      onChange={e => set('bio', e.target.value)} />
          </SettingsRow>
        </SettingsSection>

        {/* APPEARANCE */}
        <SettingsSection title="Appearance" desc="Theme and accent colour preferences.">

          <SettingsRow label="Theme" desc="Match your system, or pick a fixed light or dark mode.">
            <div style={{
              display: 'flex', background: 'var(--ink-50)',
              borderRadius: 8, padding: 3, gap: 2, border: '1px solid var(--ink-100)',
            }}>
              {[
                { key: 'light',  label: '· Light'  },
                { key: 'dark',   label: '◗ Dark'   },
                { key: 'system', label: '⊞ System' },
              ].map(opt => (
                <button key={opt.key} onClick={() => handleThemeChange(opt.key)} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                  background: theme === opt.key ? 'var(--surface)' : 'transparent',
                  color:      theme === opt.key ? 'var(--ink-900)' : 'var(--ink-400)',
                  border:     theme === opt.key ? '1px solid var(--ink-100)' : '1px solid transparent',
                  boxShadow:  theme === opt.key ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow label="Accent colour" desc="Applied to buttons, links and active states." noBorder>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {accents.map(c => (
                <button key={c} onClick={() => handleAccentChange(c)} style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c, border: 'none', cursor: 'pointer', padding: 0,
                  boxShadow: accent === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none',
                  transition: 'box-shadow 0.15s', flexShrink: 0,
                }} />
              ))}
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* SECURITY */}
        <SettingsSection title="Security" desc="Change your login password.">

          {[
            { label: 'Current password',     key: 'current' },
            { label: 'New password',         key: 'newPass' },
            { label: 'Confirm new password', key: 'confirm' },
          ].map((f, i, arr) => (
            <SettingsRow key={f.key} label={f.label} noBorder={i === arr.length - 1}>
              <div style={{ position: 'relative', width: 260 }}>
                <input className="ap-input"
                       type={showPw[f.key] ? 'text' : 'password'}
                       placeholder="••••••••"
                       value={passwords[f.key]}
                       style={{ paddingRight: 52, width: '100%' }}
                       onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))} />
                <button type="button"
                  onClick={() => setShowPw(p => ({ ...p, [f.key]: !p[f.key] }))}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 11, fontWeight: 600, color: 'var(--ink-400)', padding: '4px 6px',
                  }}>
                  {showPw[f.key] ? 'Hide' : 'Show'}
                </button>
              </div>
            </SettingsRow>
          ))}

          <div style={{ padding: '14px 0' }}>
            <button className="ap-btn primary sm" onClick={handleChangePassword}>
              <ApIcon name="lock" size={13} /> Update password
            </button>
          </div>
        </SettingsSection>

      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 10,
        background: 'var(--surface)', borderTop: '1px solid var(--ink-100)',
        padding: '14px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 13, fontWeight: dirty ? 600 : 400,
          color: dirty ? 'var(--warning)' : 'var(--ink-400)',
        }}>
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ap-btn ghost sm" onClick={handleDiscard} disabled={!dirty}>Discard</button>
          <button className="ap-btn primary sm" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </>
  )
}
