// pages/Login.jsx
function Login({ onLogin }) {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error,    setError]    = React.useState('')
  const [loading,  setLoading]  = React.useState(false)
  const [showPass, setShowPass] = React.useState(false)
  const [role,     setRole]     = React.useState('student')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (!username.trim() || !password) {
      setError('Please enter both a username and password.')
      setLoading(false)
      return
    }
    try {
      const auth = await AttendanceAPI.login(username.toLowerCase().trim(), password)
      const returnedRole = (auth.user?.role || '').toLowerCase()
      if (returnedRole !== role) {
        const label = role[0].toUpperCase() + role.slice(1)
        setError(`This account is not a ${label} account. Please select the correct role above.`)
        return
      }
      onLogin(auth)
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
      fontFamily: 'var(--font-sans)', color: 'var(--ink-800)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle gradient blobs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(circle at 18% 22%, rgba(59,91,219,0.07), transparent 45%),' +
          'radial-gradient(circle at 82% 78%, rgba(92,61,232,0.06), transparent 50%)',
      }} />

      <div style={{
        position: 'relative', width: 420,
        background: 'var(--surface)',
        border: '1px solid var(--ink-100)',
        borderRadius: 16,
        padding: '36px 36px 30px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        <ApLogo />

        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>
            Welcome
          </div>
        </div>

        {/* Role hint chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['student', 'lecturer', 'admin'].map(r => (
            <button key={r} onClick={() => { setRole(r); setError('') }}
              className={'ap-pill ' + (role === r ? 'info' : 'neutral')}
              style={{
                padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                border: role === r ? '1.5px solid var(--primary)' : '1.5px solid var(--ink-100)',
                fontWeight: role === r ? 700 : 600,
                transition: 'all 0.15s',
              }}>
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              onSubmit={handleSubmit}>
          <div className="ap-field">
            <label>Username</label>
            <div className="ap-input-wrap">
              <ApIcon name="user" size={15} />
              <input className="ap-input"
                     placeholder={
                       role === 'student'  ? 'e.g. priyanka.k' :
                       role === 'lecturer' ? 'e.g. sarah.j' :
                                            'e.g. admin'
                     }
                     value={username}
                     onChange={e => setUsername(e.target.value)} />
            </div>
          </div>

          <div className="ap-field">
            <label>Password</label>
            <div className="ap-input-wrap">
              <ApIcon name="lock" size={15} />
              <input className="ap-input"
                     type={showPass ? 'text' : 'password'}
                     placeholder="••••••••"
                     value={password}
                     onChange={e => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  padding: 6, color: 'var(--ink-400)', fontSize: 11, fontWeight: 600,
                }}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 13,
              background: 'var(--danger-50)', color: 'var(--danger)',
              border: '1px solid rgba(220,38,38,0.2)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="ap-btn primary"
                  style={{ justifyContent: 'center', padding: '12px 16px', marginTop: 4 }}
                  disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'} <ApIcon name="arrowRight" size={14} />
          </button>
        </form>

      </div>
    </div>
  )
}
