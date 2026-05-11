// components/Sidebar.jsx
// Home button scrolls the main content area back to the top.
// onHome prop (optional) can be passed from a portal to reset its internal view.

function Sidebar({ role, navLinks = [], onLogout, onHome }) {
  const [activeLabel, setActiveLabel] = React.useState('Home')

  function handleNavClick(link) {
    setActiveLabel(link.label)

    if (link.label === 'Home') {
      // Scroll main content back to top
      const main = document.querySelector('.main-content')
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' })

      // If the parent portal has an onHome handler (e.g. to reset a sub-view), call it
      if (typeof onHome === 'function') onHome()
    }
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <h2>Attendance Web App</h2>
        <span>Real-time Facial Recognition</span>
      </div>

      <div className="user-status">
        Logged in as <strong>{role}</strong>
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
}