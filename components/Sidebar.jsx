// components/Sidebar.jsx — shared design components + Sidebar

// ── Icons ─────────────────────────────────────────────────────
const ApIconSet = {
  home:      'M3 11l9-8 9 8M5 9.5V21h14V9.5',
  report:    'M4 4h12l4 4v12H4zM16 4v4h4M8 12h8M8 16h5',
  users:     'M9 11a4 4 0 100-8 4 4 0 000 8zm-7 10a7 7 0 0114 0M19 8a3 3 0 100-6 3 3 0 000 6zm-1 13a6 6 0 016-6',
  user:      'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0',
  shield:    'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  settings:  'M12 9a3 3 0 100 6 3 3 0 000-6zm9 3a9 9 0 00-.2-1.8l1.8-1.4-2-3.4-2.1.9a9 9 0 00-3.1-1.8L15 2h-4l-.4 2.5a9 9 0 00-3.1 1.8l-2.1-.9-2 3.4 1.8 1.4A9 9 0 003 12c0 .6.1 1.2.2 1.8L1.4 15.2l2 3.4 2.1-.9a9 9 0 003.1 1.8L9 22h4l.4-2.5a9 9 0 003.1-1.8l2.1.9 2-3.4-1.8-1.4c.1-.6.2-1.2.2-1.8z',
  search:    'M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.5-4.5',
  bell:      'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0',
  camera:    'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 100-8 4 4 0 000 8z',
  scan:      'M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 12h10',
  check:     'M5 12l5 5L20 7',
  x:         'M6 6l12 12M6 18L18 6',
  plus:      'M12 5v14M5 12h14',
  arrowRight:'M5 12h14M13 5l7 7-7 7',
  arrowDown: 'M12 5v14M5 12l7 7 7-7',
  logout:    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  calendar:  'M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM8 2v4M16 2v4',
  clock:     'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  download:  'M12 3v12m0 0l-4-4m4 4l4-4M5 21h14',
  filter:    'M3 5h18l-7 9v6l-4-2v-4z',
  edit:      'M14 5l5 5-9 9H5v-5zM13 6l5 5',
  trash:     'M4 7h16M9 7V4h6v3m-7 0v13a1 1 0 001 1h8a1 1 0 001-1V7',
  lock:      'M6 11V8a6 6 0 1112 0v3M5 11h14v10H5z',
  mail:      'M3 7l9 6 9-6M3 7v10h18V7M3 7h18',
  cpu:       'M5 5h14v14H5zM9 9h6v6H9zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4',
  wifi:      'M1 9a16 16 0 0122 0M5 13a10 10 0 0114 0M9 17a4 4 0 016 0M12 21h.01',
  database:  'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  alert:     'M12 3l10 18H2zM12 9v5M12 18v.01',
  graph:     'M3 3v18h18M7 14l3-3 3 3 5-6',
  more:      'M5 12h.01M12 12h.01M19 12h.01',
}

function ApIcon({ name, size = 16, color, stroke = 1.6, fill = 'none' }) {
  const d = ApIconSet[name]
  if (!d) return null
  return (
    <span className="ap-icon" style={{ color: color || 'currentColor', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
           stroke="currentColor" strokeWidth={stroke}
           strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  )
}

function ApAvatar({ name = 'A B', role, color, size = 36 }) {
  const palette = { Student: '#0ca678', Lecturer: '#5c3de8', Admin: '#3b5bdb' }
  const bg = color || palette[role] || '#3b5bdb'
  const initials = (name || 'A B').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="ap-row-avatar" style={{
      width: size, height: size,
      background: bg, fontSize: Math.round(size * 0.34),
    }}>
      {initials}
    </div>
  )
}

function ApLogo() {
  return (
    <div className="ap-logo">
      <div className="ap-logo-mark">
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none"
             stroke="currentColor" strokeWidth="7"
             strokeLinecap="round" strokeLinejoin="round">
          {/* Corner brackets */}
          <path d="M5 30 L5 10 Q5 5 10 5 L30 5" />
          <path d="M70 5 L90 5 Q95 5 95 10 L95 30" />
          <path d="M5 70 L5 90 Q5 95 10 95 L30 95" />
          <path d="M70 95 L90 95 Q95 95 95 90 L95 70" />
          {/* Eyes */}
          <line x1="35" y1="38" x2="35" y2="46" strokeWidth="7" />
          <line x1="65" y1="38" x2="65" y2="46" strokeWidth="7" />
          {/* Nose */}
          <path d="M50 42 L50 58 Q50 62 55 62" strokeWidth="6" />
          {/* Smile */}
          <path d="M35 72 Q50 82 65 72" strokeWidth="6" />
        </svg>
      </div>
      <div className="ap-logo-text">
        <div className="t1">Face Recognition</div>
        <div className="t2">Attendance</div>
      </div>
    </div>
  )
}

function ApTopBar({ title, sub, children }) {
  return (
    <div className="ap-topbar">
      <div>
        <div className="ap-page-title">{title}</div>
        {sub && <div className="ap-page-sub">{sub}</div>}
      </div>
      <div className="ap-topbar-actions">{children}</div>
    </div>
  )
}

function ApKpi({ label, value, delta, deltaDir, sub, accent }) {
  return (
    <div className="ap-kpi">
      <div className="label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="value" style={accent ? { color: accent } : undefined}>{value}</div>
        {delta && (
          <div className={'delta ' + (deltaDir || '')}>
            {deltaDir === 'up' ? '▲ ' : deltaDir === 'down' ? '▼ ' : ''}{delta}
          </div>
        )}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{sub}</div>}
    </div>
  )
}

function ApStatus({ kind = 'neutral', children, dot = true }) {
  return (
    <span className={'ap-pill ' + kind}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

// Expose for use in portal files loaded after this one
Object.assign(window, { ApIcon, ApIconSet, ApAvatar, ApLogo, ApTopBar, ApKpi, ApStatus })

// ── Nav icon mapping ─────────────────────────────────────────
const NAV_ICON = {
  'Home':          'home',
  'Dashboard':     'home',
  'Weekly Report': 'report',
  'Schedule':      'calendar',
  'Roster':        'users',
  'Session notes': 'report',
  'Exports':       'download',
  'Overview':      'home',
  'Users':         'users',
  'Devices':       'cpu',
  'Reports':       'graph',
  'Audit log':     'database',
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ role, navLinks = [], onLogout, onHome, onNav, onSettings, currentUser }) {
  const [activeLabel, setActiveLabel] = React.useState(navLinks[0]?.label || 'Home')

  function handleNavClick(label) {
    setActiveLabel(label)
    if (label === 'Home' && typeof onHome === 'function') onHome()
    if (typeof onNav === 'function') onNav(label)
  }

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : role[0].toUpperCase()

  const avatarBg =
    role === 'Admin'    ? '#3b5bdb' :
    role === 'Lecturer' ? '#5c3de8' : '#0ca678'

  const meta =
    role === 'Admin'    ? (currentUser?.email || 'System Administrator') :
    role === 'Lecturer' ? (currentUser?.email || 'Teaching Staff') :
    currentUser?.studentId ? `ID · ${currentUser.studentId}` : 'Student'

  return (
    <aside className="ap-sidebar">
      <ApLogo />

      <div className="ap-profile">
        <div className="ap-avatar" style={{ background: avatarBg }}>{initials}</div>
        <div className="ap-profile-info">
          <div className="name">{currentUser?.name || role}</div>
          <div className="meta">{meta}</div>
        </div>
      </div>

      <nav className="ap-nav">
        <div className="ap-nav-section-title">{role}</div>
        {navLinks.map(link => (
          <div key={link.label}
               className={'ap-nav-item' + (activeLabel === link.label ? ' active' : '')}
               onClick={() => handleNavClick(link.label)}>
            <ApIcon name={NAV_ICON[link.label] || 'home'} size={16} />
            <span>{link.label}</span>
          </div>
        ))}
      </nav>

      <div className="ap-sidebar-foot">
        <div className="ap-nav-item" style={{ cursor: 'pointer' }}
             onClick={() => typeof onSettings === 'function' && onSettings()}>
          <ApIcon name="settings" size={16} />
          <span>Settings</span>
        </div>
        <button className="ap-sign-out" onClick={onLogout}>
          <ApIcon name="logout" size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
