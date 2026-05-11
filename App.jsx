// App.jsx
// Root component — manages which page is shown using React state.
// No React Router needed since React is loaded via CDN.
// This replaces the original script.js window.location.href navigation.

function App() {
  // 'page' holds the current view: 'login' | 'student' | 'lecturer' | 'admin'
  const savedAuth = AttendanceAPI.getAuth()
  const [currentUser, setCurrentUser] = React.useState(savedAuth?.user || null)
  const [page, setPage] = React.useState(savedAuth?.user?.role?.toLowerCase() || 'login')

  function handleLogin(auth) {
    setCurrentUser(auth.user)
    setPage(auth.user.role.toLowerCase())
  }

  function handleLogout() {
    AttendanceAPI.clearAuth()
    setCurrentUser(null)
    setPage('login')
  }

  if (page === 'student') {
    return <StudentPortal currentUser={currentUser} onLogout={handleLogout} />
  }

  if (page === 'lecturer') {
    return <LecturerPortal currentUser={currentUser} onLogout={handleLogout} />
  }

  if (page === 'admin') {
    return <AdminPortal currentUser={currentUser} onLogout={handleLogout} />
  }

  // Default: show login
  return <Login onLogin={handleLogin} />
}

// Mount the React app to the #root div in index.html
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
