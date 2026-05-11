const API_BASE_URL = window.ATTENDANCE_API_URL || 'http://localhost:5050'
const AUTH_STORAGE_KEY = 'cihe_attendance_auth'

const AttendanceAPI = {
  getAuth() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')
    } catch (error) {
      return null
    }
  },

  setAuth(auth) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  },

  clearAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  },

  async request(path, options = {}) {
    const auth = this.getAuth()
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed.' }))
      throw new Error(error.message || 'Request failed.')
    }

    return response.json()
  },

  async login(username, password) {
    const auth = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    this.setAuth(auth)
    return auth
  },

  fetchUsers() {
    return this.request('/api/users')
  },

  createUser(user) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    })
  },

  updateUser(id, user) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    })
  },

  deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    })
  },

  fetchRecognitionLogs(limit = 50, filters = {}) {
    const params = new URLSearchParams({ limit })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    return this.request(`/api/recognition-logs?${params.toString()}`)
  },

  sendRecognition(payload) {
    return this.request('/api/recognition', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  fetchHealth() {
    return this.request('/api/health')
  },

  connectSocket() {
    if (!window.io) return null
    return window.io(API_BASE_URL)
  },
}
