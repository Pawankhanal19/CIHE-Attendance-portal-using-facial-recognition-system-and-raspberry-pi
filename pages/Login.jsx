// pages/Login.jsx
// Username placeholder: "Username (student / lecturer / admin)", Password field, Login button

function Login({ onLogin }) {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError]       = React.useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const user = username.toLowerCase().trim()

    if (!user || !password) {
      setError('Please enter both a username and password.')
      return
    }

    if (user.includes('admin')) {
      onLogin('admin')
    } else if (user.includes('lecturer')) {
      onLogin('lecturer')
    } else if (user.includes('student')) {
      onLogin('student')
    } else {
      setError("Invalid login. Use a username containing 'admin', 'lecturer', or 'student'.")
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Attendance Web App</h1>
        <p className="subtitle">Secure sign in</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username (student / lecturer / admin)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn">Login</button>
        </form>
      </div>
    </div>
  )
}