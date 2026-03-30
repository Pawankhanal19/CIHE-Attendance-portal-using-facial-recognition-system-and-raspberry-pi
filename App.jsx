// App.jsx
// Root component — manages which page is shown using React state.
// No React Router needed since React is loaded via CDN.
// This replaces the original script.js window.location.href navigation.

function App() {
  // 'page' holds the current view: 'login' | 'student' | 'lecturer' | 'admin'
  const [page, setPage] = React.useState('login')

  function handleLogin(role) {
    setPage(role)
  }

  function handleLogout() {
    setPage('login')
  }

  if (page === 'student') {
    return <StudentPortal onLogout={handleLogout} />
  }

  if (page === 'lecturer') {
    return <LecturerPortal onLogout={handleLogout} />
  }

  if (page === 'admin') {
    return <AdminPortal onLogout={handleLogout} />
  }

  // Default: show login
  return <Login onLogin={handleLogin} />
}

// Mount the React app to the #root div in index.html
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
