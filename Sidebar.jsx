// components/Sidebar.jsx
// Shared sidebar used by all three portal pages

function Sidebar({ role, navLinks = [], onLogout }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <h2>CIHE AttendanceApp</h2>
        <span>Real-time Facial Recognition</span>
      </div>

      <div className="user-status">
        Logged in as <strong>{role}</strong>
      </div>

      <nav>
        {navLinks.map((link) => (
          <a key={link.label} href={link.href || '#'} className="nav-btn">
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
