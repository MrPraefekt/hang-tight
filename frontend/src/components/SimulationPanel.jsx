import React, { useState } from 'react'

export default function SimulationPanel({ sessions, apiUrl, simulationActive }) {
  const [selectedSession, setSelectedSession] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-select first session if none selected
  React.useEffect(() => {
    if (!selectedSession && sessions.length > 0) {
      setSelectedSession(sessions[0].id)
    }
  }, [sessions, selectedSession])

  const handleStartSimulation = async () => {
    if (!selectedSession) {
      alert('Please select a session to simulate')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/simulate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: parseInt(selectedSession) })
      })
      if (!response.ok) {
        const err = await response.json()
        alert(err.error || 'Failed to start simulation')
      }
    } catch (error) {
      console.error('Error starting simulation:', error)
      alert('Error starting simulation')
    } finally {
      setLoading(false)
    }
  }

  const handleStopSimulation = async () => {
    setLoading(true)
    try {
      await fetch(`${apiUrl}/simulate/stop`, { method: 'POST' })
    } catch (error) {
      console.error('Error stopping simulation:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">Test Mode - Simulation</h2>
      
      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Replay historical sessions without hardware. Uses the same data format as live.
      </p>

      {sessions.length === 0 ? (
        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.375rem', color: 'var(--text-secondary)' }}>
          No sessions available for simulation. Record a session first.
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>Select Session to Simulate</label>
            <select 
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              disabled={simulationActive}
            >
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {new Date(session.start_time).toLocaleString()} 
                  {session.end_time ? ` - ${new Date(session.end_time).toLocaleTimeString()}` : ' (In Progress)'}
                </option>
              ))}
            </select>
          </div>

          <div className="button-group">
            <button 
              onClick={handleStartSimulation}
              disabled={!selectedSession || simulationActive || loading}
              className="button-success"
              style={{ flex: 1 }}
            >
              {loading && !simulationActive ? 'Starting...' : '&#x25B6; Start Simulation'}
            </button>
            <button 
              onClick={handleStopSimulation}
              disabled={!simulationActive || loading}
              className="button-danger"
              style={{ flex: 1 }}
            >
              {loading && simulationActive ? 'Stopping...' : '&#x23F9; Stop Simulation'}
            </button>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.375rem' }}>
            <div className="metric-label">Status</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className={`badge ${simulationActive ? 'badge-success' : 'badge-info'}`}>
                {simulationActive ? 'Simulating' : 'Ready'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
