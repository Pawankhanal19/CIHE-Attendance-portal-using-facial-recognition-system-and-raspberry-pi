// components/SettingsPanel.jsx

// ── Reusable layout primitives (defined outside to keep stable identity) ──

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

function SettingsToggle({ value, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
      background: value ? 'var(--primary)' : 'var(--ink-200)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white', boxShadow: 'var(--shadow-sm)',
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

function SettingsPage({ role, currentUser, onBack }) {

  // Profile
  const [name,       setName]       = React.useState(currentUser?.name       || '')
  const [email,      setEmail]      = React.useState(currentUser?.email      || '')
  const [department, setDepartment] = React.useState(currentUser?.department || '')
  const [language,   setLanguage]   = React.useState('en-au')

  // Security
  const [passwords, setPasswords] = React.useState({ current: '', newPass: '', confirm: '' })
  const [showPw,    setShowPw]    = React.useState({ current: false, newPass: false, confirm: false })

  // Appearance
  const [theme,         setTheme]         = React.useState(() => localStorage.getItem('ap-theme')  || 'light')
  const [accent,        setAccent]        = React.useState(() => localStorage.getItem('ap-accent') || '#3b5bdb')
  const [reducedMotion, setReducedMotion] = React.useState(false)
  const [compactMode,   setCompactMode]   = React.useState(false)

  // Face ID
  const [faceStatus, setFaceStatus] = React.useState('enrolled')

  // Save state
  const [dirty, setDirty] = React.useState(false)
  const [toast, setToast] = React.useState(null)

  React.useEffect(() => {
    setName(currentUser?.name || '')
    setEmail(currentUser?.email || '')
    setDepartment(currentUser?.department || '')
  }, [currentUser])

  React.useEffect(() => {
    const saved = localStorage.getItem('ap-accent')
    if (saved) {
      setAccent(saved)
      document.documentElement.style.setProperty('--primary', saved)
    }
  }, [])

  function markDirty() { setDirty(true) }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }

  function handleThemeChange(t) {
    setTheme(t)
    const applied = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t
    document.documentElement.setAttribute('data-theme', applied)
    localStorage.setItem('ap-theme', t)
    markDirty()
  }

  function handleAccentChange(color) {
    setAccent(color)
    document.documentElement.style.setProperty('--primary', color)
    localStorage.setItem('ap-accent', color)
    markDirty()
  }

  async function handleSave() {
    try {
      if (currentUser?._id) {
        await AttendanceAPI.updateUser(currentUser._id, {
          name:  name.trim(),
          email: email.trim(),
        })
      }
      setDirty(false)
      showToast('Settings saved successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not save settings.', 'error')
    }
  }

  function handleDiscard() {
    setName(currentUser?.name || '')
    setEmail(currentUser?.email || '')
    setDepartment(currentUser?.department || '')
    setDirty(false)
  }

  async function handleChangePassword() {
    if (!passwords.current)                      { showToast('Enter your current password.', 'error'); return }
    if (!passwords.newPass)                      { showToast('Enter a new password.', 'error'); return }
    if (passwords.newPass.length < 6)            { showToast('New password must be at least 6 characters.', 'error'); return }
    if (passwords.newPass !== passwords.confirm) { showToast('Passwords do not match.', 'error'); return }
    try {
      if (currentUser?._id) {
        await AttendanceAPI.updateUser(currentUser._id, { password: passwords.newPass })
      }
      setPasswords({ current: '', newPass: '', confirm: '' })
      showToast('Password updated successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not update password.', 'error')
    }
  }

  function handleCaptureFace() {
    setFaceStatus('capturing')
    setTimeout(() => {
      setFaceStatus('captured')
      showToast('Face captured. Click "Save enrolment" to apply.', 'info')
    }, 2200)
  }

  function handleSaveEnrolment() {
    showToast('Face re-enrolment saved.', 'success')
    setFaceStatus('enrolled')
  }

  const avatarBg  = role === 'Admin' ? '#3b5bdb' : role === 'Lecturer' ? '#5c3de8' : '#0ca678'
  const initials  = (currentUser?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const studentId = currentUser?.studentId || currentUser?._id?.slice(-8).toUpperCase() || '—'

  const accents = ['#3b5bdb', '#5c3de8', '#0ca678', '#d97706', '#dc2626', '#0891b2']

  const tc = {
    success: { bg: 'var(--success-50)', border: 'rgba(16,185,129,0.3)', color: 'var(--success)' },
    info:    { bg: 'var(--primary-50)', border: 'rgba(59,91,219,0.3)',  color: 'var(--primary)' },
    warning: { bg: 'var(--warning-50)', border: 'rgba(217,119,6,0.3)',  color: 'var(--warning)' },
    error:   { bg: 'var(--danger-50)',  border: 'rgba(220,38,38,0.3)',  color: 'var(--danger)'  },
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 300,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          maxWidth: 340, boxShadow: 'var(--shadow-md)',
          border: `1px solid ${tc[toast.type].border}`,
          background: tc[toast.type].bg, color: tc[toast.type].color,
        }}>
          {toast.message}
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>
            Settings
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>
            Manage your account, appearance and privacy.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button className="ap-btn ghost sm" onClick={onBack}>← Back</button>
          {/* Role indicator */}
          <div style={{
            display: 'flex', background: 'var(--surface)',
            border: '1px solid var(--ink-100)', borderRadius: 8,
            padding: 3, gap: 2,
          }}>
            {['Student', 'Lecturer', 'Admin'].map(r => (
              <div key={r} style={{
                padding: '5px 13px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                background: role === r ? 'var(--primary)' : 'transparent',
                color: role === r ? 'white' : 'var(--ink-400)',
              }}>
                {r}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>

        {/* PROFILE */}
        <SettingsSection title="Profile" desc="How you appear across the portal.">

          {/* Avatar row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 0', borderBottom: '1px solid var(--ink-100)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: avatarBg, color: 'white',
                display: 'grid', placeItems: 'center',
                fontSize: 17, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
                  {currentUser?.name || 'User'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {studentId}{currentUser?.program ? ` · ${currentUser.program}` : ''}
                </div>
              </div>
            </div>
            <button className="ap-btn ghost sm">Change photo</button>
          </div>

          <SettingsRow label="Display name">
            <input className="ap-input" style={{ width: 220 }}
                   value={name}
                   onChange={e => { setName(e.target.value); markDirty() }} />
          </SettingsRow>

          <SettingsRow label="Email" desc="Used for notifications and password recovery.">
            <input className="ap-input" type="email" style={{ width: 220 }}
                   value={email}
                   onChange={e => { setEmail(e.target.value); markDirty() }} />
          </SettingsRow>

          {role !== 'Student' && (
            <SettingsRow label="Department">
              <input className="ap-input" style={{ width: 220 }}
                     placeholder="e.g. School of IT"
                     value={department}
                     onChange={e => { setDepartment(e.target.value); markDirty() }} />
            </SettingsRow>
          )}

          <SettingsRow label="Language" noBorder>
            <select className="ap-select" style={{ width: 220 }}
                    value={language}
                    onChange={e => { setLanguage(e.target.value); markDirty() }}>
              <option value="en-au">English (Australia)</option>
              <option value="en">English (UK)</option>
              <option value="ne">Nepali</option>
              <option value="zh">Chinese (Simplified)</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
          </SettingsRow>
        </SettingsSection>

        {/* APPEARANCE */}
        <SettingsSection title="Appearance" desc="Theme, accent colour and motion preferences.">

          {/* Theme segmented control */}
          <SettingsRow label="Theme" desc="Match your system, or pick a fixed light or dark mode.">
            <div style={{
              display: 'flex', background: 'var(--ink-50)',
              borderRadius: 8, padding: 3, gap: 2,
              border: '1px solid var(--ink-100)',
            }}>
              {[
                { key: 'light',  label: '· Light'  },
                { key: 'dark',   label: '◗ Dark'   },
                { key: 'system', label: '⊞ System' },
              ].map(opt => (
                <button key={opt.key} onClick={() => handleThemeChange(opt.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    fontSize: 12.5, fontWeight: 600,
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

          {/* Accent colour swatches */}
          <SettingsRow label="Accent colour" desc="Applied to buttons, links and active states.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {accents.map(c => (
                <button key={c} onClick={() => handleAccentChange(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: c, border: 'none', cursor: 'pointer', padding: 0,
                    boxShadow: accent === c
                      ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}`
                      : 'none',
                    transition: 'box-shadow 0.15s', flexShrink: 0,
                  }} />
              ))}
            </div>
          </SettingsRow>

          {/* Reduced motion */}
          <SettingsRow label="Reduced motion" desc="Disable transitions and animations across the portal.">
            <SettingsToggle value={reducedMotion}
                            onChange={() => { setReducedMotion(v => !v); markDirty() }} />
          </SettingsRow>

          {/* Compact density */}
          <SettingsRow label="Compact density" desc="Tighter spacing in tables and lists." noBorder>
            <SettingsToggle value={compactMode}
                            onChange={() => { setCompactMode(v => !v); markDirty() }} />
          </SettingsRow>
        </SettingsSection>

        {/* SECURITY */}
        <SettingsSection title="Security" desc="Change your password and manage active sessions.">

          {[
            { label: 'Current password',     key: 'current' },
            { label: 'New password',         key: 'newPass' },
            { label: 'Confirm new password', key: 'confirm' },
          ].map(f => (
            <SettingsRow key={f.key} label={f.label}>
              <div style={{ position: 'relative', width: 220 }}>
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

          <SettingsRow label="" noBorder={false}>
            <button className="ap-btn primary sm" onClick={handleChangePassword}>
              <ApIcon name="lock" size={13} /> Update password
            </button>
          </SettingsRow>

          <SettingsRow label="Active sessions"
                       desc="Devices where your account is currently signed in."
                       noBorder>
            <ApStatus kind="success">Active now</ApStatus>
          </SettingsRow>
        </SettingsSection>

        {/* FACE ID — students only */}
        {role === 'Student' && (
          <SettingsSection title="Face ID" desc="Update your face data for the Raspberry Pi recognition camera.">

            {/* Status */}
            <div style={{ padding: '14px 0', borderBottom: '1px solid var(--ink-100)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 10,
                background: faceStatus === 'enrolled' ? 'var(--success-50)' : 'var(--primary-50)',
                border: `1px solid ${faceStatus === 'enrolled' ? 'rgba(16,185,129,0.2)' : 'rgba(59,91,219,0.2)'}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  background: faceStatus === 'enrolled' ? 'rgba(16,185,129,0.15)' : 'rgba(59,91,219,0.15)',
                  color: faceStatus === 'enrolled' ? 'var(--success)' : 'var(--primary)',
                }}>
                  <ApIcon name={faceStatus === 'enrolled' ? 'check' : 'scan'} size={16} stroke={2} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>
                    {faceStatus === 'enrolled' ? 'Face data enrolled'
                     : faceStatus === 'capturing' ? 'Capturing face…' : 'New face captured'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 1 }}>
                    {faceStatus === 'enrolled'
                      ? `Student ID: ${studentId}`
                      : faceStatus === 'capturing'
                      ? 'Hold still and face the camera directly'
                      : 'Click "Save enrolment" below to apply'}
                  </div>
                </div>
              </div>
            </div>

            {/* Camera kiosk */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--ink-100)' }}>
              <div className="ap-camera" style={{ height: 180 }}>
                <div className="ap-camera-corner tl" />
                <div className="ap-camera-corner tr" />
                <div className="ap-camera-corner bl" />
                <div className="ap-camera-corner br" />
                {faceStatus === 'capturing' && <div className="ap-scan-line" />}
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 8,
                }}>
                  {faceStatus === 'captured' ? (
                    <>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'rgba(16,185,129,0.18)',
                        border: '2px solid var(--success)', color: 'var(--success)',
                        display: 'grid', placeItems: 'center',
                      }}>
                        <ApIcon name="check" size={24} stroke={2.2} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Face captured</div>
                    </>
                  ) : faceStatus === 'capturing' ? (
                    <>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Hold still…</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Scanning</div>
                    </>
                  ) : (
                    <>
                      <ApIcon name="camera" size={32} color="rgba(255,255,255,0.4)" stroke={1.2} />
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Camera preview</div>
                    </>
                  )}
                </div>
                <div style={{
                  position: 'absolute', left: 10, bottom: 10, zIndex: 2,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(15,26,74,0.55)', backdropFilter: 'blur(4px)',
                  padding: '4px 8px', borderRadius: 999,
                  fontSize: 10.5, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-mono)',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                  pi-cam-04 · L2-04
                </div>
              </div>
            </div>

            <SettingsRow label="" noBorder>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ap-btn primary sm"
                        onClick={handleCaptureFace}
                        disabled={faceStatus === 'capturing'}>
                  <ApIcon name="scan" size={13} />
                  {faceStatus === 'capturing' ? 'Capturing…' : 'Capture face'}
                </button>
                {faceStatus === 'captured' && (
                  <button className="ap-btn success sm" onClick={handleSaveEnrolment}>
                    <ApIcon name="check" size={13} /> Save enrolment
                  </button>
                )}
              </div>
            </SettingsRow>

            <div style={{ padding: '0 0 16px' }}>
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--warning-50)', border: '1px solid rgba(217,119,6,0.2)',
                fontSize: 12, color: 'var(--warning)', lineHeight: 1.7,
              }}>
                <strong>Note:</strong> Re-enrolment updates the face model on the Pi. Use good lighting and face the camera directly. Changes sync after the next session.
              </div>
            </div>
          </SettingsSection>
        )}

      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 10,
        background: 'var(--surface)',
        borderTop: '1px solid var(--ink-100)',
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
          <button className="ap-btn ghost sm" onClick={handleDiscard} disabled={!dirty}>
            Discard
          </button>
          <button className="ap-btn primary sm" onClick={handleSave}>
            Save changes
          </button>
        </div>
      </div>
    </>
  )
}
