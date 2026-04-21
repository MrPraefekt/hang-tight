import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * Historical Data Viewer Component
 */
export default function HistoricalData({ sessions, onRefresh }) {
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleViewSession = async (sessionId) => {
    setLoading(true)
    try {
      const response = await fetch(`${getApiUrl()}/sessions/${sessionId}`)
      const data = await response.json()
      setSelectedSession(data)
    } catch (error) {
      console.error('Error fetching session:', error)
      alert('Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  const getApiUrl = () => {
    return `http://${window.location.hostname}:3001`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'In progress'
    const start = new Date(startTime)
    const end = new Date(endTime)
    const seconds = Math.floor((end - start) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getChartData = () => {
    if (!selectedSession || !selectedSession.samples) return []
    return selectedSession.samples.map((s, i) => ({
      index: i,
      force: Number(s.force.toFixed(2)),
      raw: s.raw
    }))
  }

  const stats = selectedSession && selectedSession.samples ? {
    count: selectedSession.samples.length,
    maxForce: Math.max(...selectedSession.samples.map(s => s.force)),
    avgForce: (selectedSession.samples.reduce((sum, s) => sum + s.force, 0) / selectedSession.samples.length).toFixed(2),
    minForce: Math.min(...selectedSession.samples.map(s => s.force))
  } : null

  return (
    <div className="card">
      <h2 className="card-title">Historical Data</h2>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
          No sessions recorded yet. Start a session to begin tracking data.
        </div>
      ) : (
        <>
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

              {getChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData()} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="index" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="force" 
                      stroke="var(--accent)" 
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No data available
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
