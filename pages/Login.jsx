// pages/Login.jsx
function Login({ onLogin }) {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError]       = React.useState('')
  const [loading, setLoading]   = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const user = username.toLowerCase().trim()

    if (!user || !password) {
      setError('Please enter both a username and password.')
      setLoading(false)
      return
    }

    try {
      const auth = await AttendanceAPI.login(username, password)
      onLogin(auth)
    } catch (error) {
      setError(error.message || 'Login failed.')
    } finally {
      setLoading(false)
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
            placeholder="Username"
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
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
