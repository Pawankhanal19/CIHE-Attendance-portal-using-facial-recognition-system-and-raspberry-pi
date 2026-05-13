// components/Sidebar.jsx
<<<<<<< HEAD
// Home button scrolls the main content area back to the top.
// onHome prop (optional) can be passed from a portal to reset its internal view.

function Sidebar({ role, navLinks = [], onLogout, onHome }) {
=======

function Sidebar({ role, navLinks = [], onLogout, onHome, onNav, currentUser }) {
>>>>>>> my-project
  const [activeLabel, setActiveLabel] = React.useState('Home')

  function handleNavClick(link) {
    setActiveLabel(link.label)
<<<<<<< HEAD

    if (link.label === 'Home') {
      // Scroll main content back to top
      const main = document.querySelector('.main-content')
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' })

      // If the parent portal has an onHome handler (e.g. to reset a sub-view), call it
      if (typeof onHome === 'function') onHome()
    }
  }

=======
    if (link.label === 'Home') {
      const main = document.querySelector('.main-content')
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
      if (typeof onHome === 'function') onHome()
    }
    if (typeof onNav === 'function') onNav(link.label)
  }

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : role[0].toUpperCase()

  const roleStyle =
    role === 'Admin'    ? { avatar: 'linear-gradient(135deg, #4dabf7, #4c5ddb)', role: '#3b5bdb' } :
    role === 'Lecturer' ? { avatar: 'linear-gradient(135deg, #9775fa, #5c3de8)', role: '#5c3de8' } :
                          { avatar: 'linear-gradient(135deg, #63e6be, #20c997)', role: '#0ca678' }

  const subtitle =
    role === 'Admin'    ? (currentUser?.email || 'System Administrator') :
    role === 'Lecturer' ? (currentUser?.email || 'Teaching Staff') :
    currentUser?.studentId ? `ID: ${currentUser.studentId}` : 'Student'

>>>>>>> my-project
  return (
    <aside className="sidebar">
      <div className="logo">
        <h2>Attendance Web App</h2>
        <span>Real-time Facial Recognition</span>
      </div>

<<<<<<< HEAD
      <div className="user-status">
        Logged in as <strong>{role}</strong>
=======
      <div className="sidebar-profile">
        <div className="sidebar-avatar" style={{ background: roleStyle.avatar }}>
          {initials}
        </div>
        <div className="sidebar-user-info">
          <p className="sidebar-user-name">{currentUser?.name || role}</p>
          <p className="sidebar-user-role" style={{ color: roleStyle.role }}>{role}</p>
          <p className="sidebar-user-detail">{subtitle}</p>
        </div>
>>>>>>> my-project
      </div>

      <nav>
        {navLinks.map((link) => (
          <a
            key={link.label}
            href="#"
            className={activeLabel === link.label ? 'nav-btn nav-btn-active' : 'nav-btn'}
            onClick={(e) => { e.preventDefault(); handleNavClick(link) }}
          >
            {link.label}
          </a>
        ))}
        <button onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </nav>
    </aside>
  )
<<<<<<< HEAD
}
=======
}
>>>>>>> my-project
