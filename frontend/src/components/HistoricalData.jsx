import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts'
import { TIME_WINDOWS, formatTimestamp, downsample } from '../utils/chartUtils'

export default function HistoricalData({ sessions, onRefresh, apiUrl }) {
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [windowSeconds, setWindowSeconds] = useState(Infinity)

  const handleViewSession = async (sessionId) => {
    setLoading(true)
    setWindowSeconds(Infinity)
    try {
      const response = await fetch(`${apiUrl}/sessions/${sessionId}`)
      const data = await response.json()
      setSelectedSession(data)
    } catch (error) {
      console.error('Error fetching session:', error)
      alert('Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => new Date(dateString).toLocaleString()

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'In progress'
    const seconds = Math.floor((new Date(endTime) - new Date(startTime)) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const fullChartData = useMemo(() => {
    if (!selectedSession?.samples?.length) return []
    // Timestamps from ESP32 are device-uptime ms; compute relative offset from first sample
    const firstTs = Number(selectedSession.samples[0].timestamp) || 0
    return selectedSession.samples.map(s => {
      const relativeMs = (Number(s.timestamp) || 0) - firstTs
      return {
        time: relativeMs,
        timeLabel: formatTimestamp(relativeMs, 0),
        force: Number(Number(s.force).toFixed(2)),
        raw: Number(s.raw),
      }
    })
  }, [selectedSession])

  const chartData = useMemo(() => {
    if (fullChartData.length === 0) return []
    let data = fullChartData
    if (windowSeconds !== Infinity && data.length > 0) {
      const lastTime = data[data.length - 1].time
      const cutoff = lastTime - windowSeconds * 1000
      data = data.filter(d => d.time >= cutoff)
    }
    return downsample(data)
  }, [fullChartData, windowSeconds])

  const stats = selectedSession?.samples?.length > 0 ? (() => {
    const forces = selectedSession.samples.map(s => Number(s.force))
    return {
      count: forces.length,
      maxForce: Math.max(...forces),
      avgForce: (forces.reduce((sum, f) => sum + f, 0) / forces.length).toFixed(2),
      minForce: Math.min(...forces)
    }
  })() : null

  return (
    <div className="card">
      <h2 className="card-title">Historical Data</h2>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
          No sessions recorded yet. Start a session to begin tracking data.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={onRefresh} className="button-secondary" style={{ marginBottom: '0.5rem' }}>
              &#x21BB; Refresh
            </button>
          </div>
          <div style={{ marginBottom: '1rem', overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session.id}>
                    <td>{formatDate(session.start_time)}</td>
                    <td>{formatDuration(session.start_time, session.end_time)}</td>
                    <td>
                      <span className={`badge ${session.end_time ? 'badge-info' : 'badge-success'}`}>
                        {session.end_time ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleViewSession(session.id)}
                        disabled={loading}
                        className="button-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedSession && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>
                Session Details - {formatDate(selectedSession.start_time)}
              </h3>

              {stats && (
                <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
                  <div className="metric">
                    <div className="metric-label">Max Force</div>
                    <div className="metric-value">{stats.maxForce.toFixed(2)}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Avg Force</div>
                    <div className="metric-value">{stats.avgForce}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Min Force</div>
                    <div className="metric-value">{stats.minForce.toFixed(2)}</div>
                  </div>
                </div>
              )}

              {/* Time window selector */}
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {TIME_WINDOWS.map(tw => (
                  <button
                    key={tw.value}
                    onClick={() => setWindowSeconds(tw.value)}
                    className={windowSeconds === tw.value ? 'button-primary' : 'button-secondary'}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', minWidth: '2.5rem' }}
                  >
                    {tw.label}
                  </button>
                ))}
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="var(--text-secondary)"
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis stroke="var(--text-secondary)" label={{ value: 'N', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)' } }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      labelFormatter={(label) => `Time: ${label}`}
                      formatter={(value) => [`${value} N`, 'Force']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="force" 
                      stroke="var(--accent)" 
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                    />
                    <Brush
                      dataKey="timeLabel"
                      height={30}
                      stroke="var(--accent)"
                      fill="var(--bg-secondary)"
                      travellerWidth={10}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No data available
                </div>
              )}

              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {stats ? `${stats.count} samples · Drag the brush below the chart to zoom` : ''}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
