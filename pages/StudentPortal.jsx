// pages/StudentPortal.jsx

const initialHistory = [
  { date: '28/09/2025', course: 'ICT307', session: 'Lecture',  status: 'Present', checkIn: '09:02' },
  { date: '21/09/2025', course: 'ICT307', session: 'Tutorial', status: 'Absent',  checkIn: '—'     },
  { date: '14/09/2025', course: 'ICT306', session: 'Lecture',  status: 'Present', checkIn: '08:58' },
  { date: '07/09/2025', course: 'ICT306', session: 'Tutorial', status: 'Late',    checkIn: '09:15' },
]

function historyRowFromLog(log) {
  const timestamp = new Date(log.time || log.created_at || Date.now())
  return {
    id: log.id,
    date: timestamp.toLocaleDateString('en-GB'),
    course: log.course_code || 'ICT307',
    session: log.session || 'Lecture',
    status: log.attendance_status || (log.status === 'recognised' ? 'Present' : 'Absent'),
    checkIn: timestamp.toTimeString().slice(0, 5),
  }
}

function StudentPortal({ currentUser, onLogout }) {
  const [scanState,     setScanState]     = React.useState('idle') // idle | scanning | success
  const [scanning,      setScanning]      = React.useState(false)
  const [scanStatus,    setScanStatus]    = React.useState('Awaiting Scan')
  const [history,       setHistory]       = React.useState(initialHistory)
  const [toast,         setToast]         = React.useState(null)
  const [view,          setView]          = React.useState('home')
  const [weeklyData,    setWeeklyData]    = React.useState([])
  const [weeklyLoading, setWeeklyLoading] = React.useState(false)
  const [streamOk,      setStreamOk]      = React.useState(null) // null=loading, true, false
  const [streamKey,     setStreamKey]     = React.useState(0)   // increment to force img remount
  const streamUrl = React.useMemo(() => AttendanceAPI.getPiStreamUrl(), [])

  // Auto-retry stream every 12 s when offline
  React.useEffect(() => {
    if (streamOk !== false) return
    const t = setTimeout(() => {
      setStreamOk(null)
      setStreamKey(k => k + 1)
    }, 12000)
    return () => clearTimeout(t)
  }, [streamOk])

  const navLinks = [
    { label: 'Home',          href: '#' },
    { label: 'Weekly Report', href: '#' },
  ]

  React.useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const filters = currentUser?.studentId ? { person_id: currentUser.studentId } : {}
        const logs = await AttendanceAPI.fetchRecognitionLogs(20, filters)
        if (!cancelled && logs.length > 0) {
          setHistory(logs.map(historyRowFromLog))
          const latest = logs[0]
          if (latest.status === 'recognised') setScanState('success')
          setScanStatus(latest.status === 'recognised'
            ? `Face Detected — ${latest.name} Marked Present`
            : 'Face Not Recognised')
        }
      } catch (err) {
        console.warn('Backend unavailable, using demo history.', err)
      }
    }

    loadHistory()
    const socket = AttendanceAPI.connectSocket()

    if (socket) {
      socket.on('face_recognised', (log) => {
        setHistory(prev => {
          const row = historyRowFromLog(log)
          return [row, ...prev.filter(r => r.id !== row.id)].slice(0, 20)
        })
        if (log.status === 'recognised') setScanState('success')
        setScanStatus(log.status === 'recognised'
          ? `Face Detected — ${log.name} Marked Present`
          : 'Face Not Recognised')
        showToast(log.status === 'recognised'
          ? `${log.name} marked Present.`
          : 'Unrecognised face detected.', log.status === 'recognised' ? 'success' : 'warning')
      })
    }

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleNav(label) {
    if (label === 'Weekly Report') {
      setView('weekly')
      if (weeklyData.length === 0 && !weeklyLoading) {
        if (!currentUser?.studentId) {
          showToast('No Student ID on your account. Contact an admin.', 'warning')
          return
        }
        setWeeklyLoading(true)
        try {
          const data = await AttendanceAPI.fetchWeeklyAttendance(currentUser.studentId)
          setWeeklyData(data)
        } catch (err) {
          showToast('Could not load weekly report. Is the backend running?', 'error')
        } finally {
          setWeeklyLoading(false)
        }
      }
    } else {
      setView('home')
    }
  }

  function handleStartScan() {
    if (scanning) return
    setScanning(true)
    setScanState('scanning')
    setScanStatus('Scanning…')
    showToast('Face scan started. Please look at the camera.', 'info')

    setTimeout(async () => {
      const now = new Date()
      try {
        const response = await AttendanceAPI.sendRecognition({
          person_id: currentUser?.studentId || currentUser?.username || 'unknown',
          name: currentUser?.name || 'Unknown Student',
          confidence: 95.0,
          status: 'recognised',
          time: now.toISOString(),
          device_id: 'frontend-student-scan',
          course_code: 'ICT307',
          session: 'Lecture',
        })
        setHistory(prev => {
          const row = historyRowFromLog(response.log)
          return [row, ...prev.filter(r => r.id !== row.id)].slice(0, 20)
        })
        setScanState('success')
        setScanStatus(`Face Detected — ${response.log.name} Marked Present`)
        showToast('Face recognised and saved to MongoDB.', 'success')
      } catch (err) {
        const timeStr = now.toTimeString().slice(0, 5)
        const dateStr = now.toLocaleDateString('en-GB')
        setHistory(prev => [
          { date: dateStr, course: 'ICT307', session: 'Lecture', status: 'Present', checkIn: timeStr },
          ...prev,
        ])
        setScanState('success')
        setScanStatus('Face Detected — Marked Present')
        showToast('Demo scan completed. Start the backend to save to MongoDB.', 'warning')
      } finally {
        setScanning(false)
      }
    }, 2500)
  }

  // KPI derivations
  const presentCount = history.filter(r => r.status === 'Present').length
  const lateCount    = history.filter(r => r.status === 'Late').length
  const absentCount  = history.filter(r => r.status === 'Absent').length
  const attendedCount = presentCount + lateCount
  const attendancePct = history.length > 0
    ? Math.round(attendedCount / history.length * 100)
    : 0

  // Status pill
  function statusPill(s) {
    return s === 'Present' ? <ApStatus kind="success">{s}</ApStatus> :
           s === 'Late'    ? <ApStatus kind="warning">{s}</ApStatus> :
           s === 'Absent'  ? <ApStatus kind="danger">{s}</ApStatus> :
                             <ApStatus kind="neutral">{s}</ApStatus>
  }

  // Toast colours
  const toastColours = {
    success: { background: 'var(--success-50)', border: 'rgba(16,185,129,0.3)', color: 'var(--success)' },
    info:    { background: 'var(--primary-50)', border: 'rgba(59,91,219,0.3)',  color: 'var(--primary)' },
    warning: { background: 'var(--warning-50)', border: 'rgba(217,119,6,0.3)',  color: 'var(--warning)' },
    error:   { background: 'var(--danger-50)',  border: 'rgba(220,38,38,0.3)',  color: 'var(--danger)'  },
  }

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun']
  const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

  function pctColor(v) {
    if (v === null || v === undefined) return 'var(--ink-300)'
    return v >= 80 ? 'var(--success)' : v >= 60 ? 'var(--warning)' : 'var(--danger)'
  }

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="ap-shell">
      <Sidebar
        role="Student"
        navLinks={navLinks}
        onLogout={onLogout}
        onNav={handleNav}
        onSettings={() => setView('settings')}
        currentUser={currentUser}
      />

      <main className="ap-main">

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 24, zIndex: 300,
            padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            maxWidth: 340, boxShadow: 'var(--shadow-md)',
            border: `1px solid ${toastColours[toast.type].border}`,
            background: toastColours[toast.type].background,
            color: toastColours[toast.type].color,
          }}>
            {toast.message}
          </div>
        )}

        {/* ═══ HOME VIEW ═══ */}
        {view === 'home' && (
          <>
            <ApTopBar
              title={`Hi ${currentUser?.name?.split(' ')[0] || 'Student'}`}
              sub={today + ' · ICT307 next'}>
              <button className="ap-btn ghost">
                <ApIcon name="bell" size={15} /> Alerts
              </button>
              <button className="ap-btn primary" onClick={handleStartScan} disabled={scanning}>
                <ApIcon name="scan" size={14} />
                {scanning ? 'Scanning…' : 'Check in now'}
              </button>
            </ApTopBar>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <ApKpi label="Semester attendance" value={`${attendancePct}%`}
                     accent="var(--success)" />
              <ApKpi label="Classes attended" value={attendedCount}
                     sub={`of ${history.length} recorded`} />
              <ApKpi label="Late arrivals" value={lateCount} sub="this semester" />
              <ApKpi label="Absences" value={absentCount} sub="recorded" />
            </div>

            {/* Main grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 16 }}>

              {/* Check-in kiosk */}
              <div className="ap-card">
                <div className="ap-card-head">
                  <div>
                    <div className="ap-card-title">Check-in kiosk</div>
                    <div className="ap-card-sub">Look at the camera. Recognition takes about 1–2 seconds.</div>
                  </div>
                  <ApStatus kind={
                    scanState === 'success' ? 'success' :
                    scanState === 'scanning' ? 'info' : 'neutral'
                  }>
                    {scanState === 'success' ? 'Marked present' :
                     scanState === 'scanning' ? 'Scanning…' : 'Awaiting scan'}
                  </ApStatus>
                </div>

                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#0a0f1e',
                }}>
                  {scanning && <div className="ap-scan-line" />}

                  {/* Live Pi stream */}
                  {streamUrl && streamOk !== false && (
                    <img
                      key={streamKey}
                      src={streamUrl}
                      alt="Pi camera"
                      onError={() => setStreamOk(false)}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}

                  {/* Success / scanning overlay — only when there's a state to show */}
                  {scanState !== 'idle' && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 10, zIndex: 1,
                      background: 'rgba(0,0,0,0.52)',
                      pointerEvents: 'none',
                    }}>
                      {scanState === 'success' ? (
                        <>
                          <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'rgba(16,185,129,0.18)',
                            display: 'grid', placeItems: 'center',
                            border: '2px solid var(--success)',
                            color: 'var(--success)',
                          }}>
                            <ApIcon name="check" size={32} stroke={2.2} />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>
                            Face recognised · {currentUser?.name?.split(' ')[0] || 'Student'}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>
                            Confidence 95% · ICT307 · {new Date().toTimeString().slice(0, 5)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Hold still…</div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Scanning face</div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="ap-btn primary" onClick={handleStartScan} disabled={scanning}>
                    <ApIcon name="scan" size={14} />
                    {scanning ? 'Scanning…' : scanState === 'success' ? 'Scan again' : 'Start scan'}
                  </button>
                  <button className="ap-btn ghost">
                    <ApIcon name="camera" size={14} /> Re-enrol face
                  </button>
                  <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 11.5, color: 'var(--ink-400)' }}>
                    Last scan · {history[0]?.date || '—'} {history[0]?.checkIn || ''}
                  </div>
                </div>
              </div>

              {/* Attendance status */}
              <div className="ap-card">
                <div className="ap-card-head">
                  <div>
                    <div className="ap-card-title">Attendance status</div>
                    <div className="ap-card-sub">Current session · ICT307</div>
                  </div>
                </div>

                <div style={{
                  padding: '20px 16px',
                  background: scanState === 'success' ? 'var(--success-50)' :
                              scanState === 'scanning' ? 'var(--primary-50)' : 'var(--ink-50)',
                  borderRadius: 10,
                  border: `1px solid ${
                    scanState === 'success' ? 'rgba(16,185,129,0.2)' :
                    scanState === 'scanning' ? 'rgba(59,91,219,0.2)' : 'var(--ink-100)'
                  }`,
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: scanState === 'success' ? 'var(--success)' :
                           scanState === 'scanning' ? 'var(--primary)' : 'var(--ink-500)',
                    marginBottom: 4,
                  }}>
                    {scanState === 'success' ? 'Present' :
                     scanState === 'scanning' ? 'Scanning…' : 'Not yet checked in'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
                    {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'This semester', val: `${attendancePct}%`, color: pctColor(attendancePct) },
                    { label: 'Classes attended', val: `${attendedCount} / ${history.length}`, color: 'var(--ink-700)' },
                    { label: 'Late arrivals', val: lateCount, color: lateCount > 0 ? 'var(--warning)' : 'var(--ink-400)' },
                    { label: 'Absences', val: absentCount, color: absentCount > 0 ? 'var(--danger)' : 'var(--ink-400)' },
                  ].map(item => (
                    <div key={item.label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--ink-500)' }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>

                <button className="ap-btn ghost" style={{ justifyContent: 'center' }}
                        onClick={() => handleNav('Weekly Report')}>
                  View weekly report <ApIcon name="arrowRight" size={14} />
                </button>
              </div>
            </div>

            {/* Attendance history */}
            <div className="ap-card padless">
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 20px 14px',
              }}>
                <div>
                  <div className="ap-card-title">Attendance history</div>
                  <div className="ap-card-sub">{history.length} records · sorted by most recent</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ap-btn ghost sm">
                    <ApIcon name="filter" size={13} /> Filter
                  </button>
                  <button className="ap-btn ghost sm">
                    <ApIcon name="download" size={13} /> Export
                  </button>
                </div>
              </div>
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Course</th>
                    <th>Session</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{row.date}</td>
                      <td className="mono">{row.course}</td>
                      <td>{row.session}</td>
                      <td>{statusPill(row.status)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{row.checkIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ═══ WEEKLY REPORT VIEW ═══ */}
        {view === 'weekly' && (
          <>
            <ApTopBar
              title="Weekly Report"
              sub={`${currentUser?.name || ''} · ${currentUser?.studentId || currentUser?.username || ''}`}>
              <button className="ap-btn ghost" onClick={() => setView('home')}>
                ← Back to dashboard
              </button>
            </ApTopBar>

            <div className="ap-card">
              <div className="ap-card-head">
                <div>
                  <div className="ap-card-title">Student Attendance View By Week</div>
                  {!weeklyLoading && weeklyData.length > 0 && (
                    <div className="ap-card-sub">{weeklyData.length} week(s)</div>
                  )}
                </div>
              </div>

              {weeklyLoading && (
                <p style={{ color: 'var(--ink-300)', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
                  Loading weekly report…
                </p>
              )}

              {!weeklyLoading && weeklyData.length === 0 && (
                <p style={{ color: 'var(--ink-300)', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
                  No attendance records found for Student ID <strong>{currentUser?.studentId}</strong>.<br />
                  Records appear here once the Pi recognises you in class.
                </p>
              )}

              {!weeklyLoading && weeklyData.length > 0 && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '1100px', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Term', 'Week Length', ...DAY_LABELS,
                            'Study Hrs', 'Other Hrs', 'Weekly Attd Hrs.',
                            'Weekly Class Hrs', 'Weekly Attd%',
                            'Semester Curr. Attd.', 'Semester Proj. Attd.',
                          ].map(h => (
                            <th key={h} style={{
                              padding: '10px 8px', textAlign: 'center',
                              whiteSpace: 'nowrap', fontSize: '11px',
                              fontWeight: 700, color: 'var(--ink-700)',
                              borderBottom: '2px solid var(--ink-100)',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyData.map((week, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--ink-500)' }}>
                              {week.term}
                            </td>
                            <td style={{ padding: '9px 8px', whiteSpace: 'nowrap', color: 'var(--ink-500)' }}>
                              ({week.weekRange})
                            </td>
                            {DAY_KEYS.map(dk => {
                              const val = week.days[dk]
                              const isNC     = val === 'NC'
                              const isAbsent = val === 0
                              return (
                                <td key={dk} style={{
                                  padding: '9px 8px', textAlign: 'center',
                                  fontWeight: isNC ? 'normal' : '600',
                                  color: isNC ? 'var(--ink-300)' : isAbsent ? 'var(--danger)' : 'var(--ink-700)',
                                  borderBottom: '1px solid var(--ink-100)',
                                }}>
                                  {isNC ? 'NC' : val}
                                </td>
                              )
                            })}
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--ink-700)' }}>{week.studyHrs}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--ink-300)' }}>{week.otherHrs}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--ink-700)' }}>{week.weeklyAttdHrs}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--ink-500)' }}>{week.weeklyClassHrs}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: pctColor(week.weeklyAttdPct) }}>
                              {week.weeklyAttdPct !== null ? week.weeklyAttdPct : '—'}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 600, color: pctColor(week.semesterCurrAttd) }}>
                              {week.semesterCurrAttd !== null ? week.semesterCurrAttd : '—'}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 600, color: pctColor(week.semesterProjAttd) }}>
                              {week.semesterProjAttd !== null ? week.semesterProjAttd : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{
                    padding: '14px 16px', background: 'var(--surface-2)',
                    borderRadius: 10, border: '1px solid var(--ink-100)',
                    fontSize: 12, lineHeight: 1.9, color: 'var(--ink-700)',
                  }}>
                    <p style={{ margin: '0 0 2px' }}>
                      <strong>Weekly Attd%:</strong> Weekly Attd Hrs. / Weekly Class Hrs × 100
                    </p>
                    <p style={{ margin: '0 0 2px' }}>
                      <strong>Semester Curr. Attd.:</strong> Cumulative attendance up to that week
                    </p>
                    <p style={{ margin: '0 0 10px' }}>
                      <strong>Semester Proj. Attd.:</strong> Max possible % if attending all remaining weeks
                    </p>
                    <p style={{ margin: 0, color: 'var(--ink-400)' }}>
                      <strong>NC</strong> = No Class &nbsp;|&nbsp;
                      <strong style={{ color: 'var(--danger)' }}>0</strong> = Absent &nbsp;|&nbsp;
                      <strong>3</strong> = 3 hrs attended &nbsp;|&nbsp;
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>Green</span> ≥ 80% &nbsp;
                      <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Orange</span> 60–79% &nbsp;
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Red</span> &lt; 60%
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ═══ SETTINGS VIEW ═══ */}
        {view === 'settings' && (
          <SettingsPage role="Student" currentUser={currentUser} onBack={() => setView('home')} />
        )}

      </main>
    </div>
  )
}
