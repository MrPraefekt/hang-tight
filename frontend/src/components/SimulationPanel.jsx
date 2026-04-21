import React, { useState } from 'react'

/**
 * Simulation Panel Component
 */
export default function SimulationPanel({ sessions, apiUrl }) {
  const [selectedSession, setSelectedSession] = useState(sessions[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)

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
      
      if (response.ok) {
        const data = await response.json()
        setSimulating(true)
        console.log('Simulation started:', data)
      } else {
        alert('Failed to start simulation')
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
      const response = await fetch(`${apiUrl}/simulate/stop`, {
        method: 'POST'
      })
      
      if (response.ok) {
        setSimulating(false)
        console.log('Simulation stopped')
      } else {
        alert('Failed to stop simulation')
      }
    } catch (error) {
      console.error('Error stopping simulation:', error)
      alert('Error stopping simulation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">Test Mode - Simulation</h2>
      
      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Replay historical training sessions without hardware. Perfect for testing the frontend.
      </p>

      {sessions.length === 0 ? (
        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.375rem', color: 'var(--text-secondary)' }}>
          No sessions available for simulation. Start a real session first.
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>Select Session to Simulate</label>
            <select 
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              disabled={simulating}
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
              disabled={!selectedSession || simulating || loading}
              className="button-success"
              style={{ flex: 1 }}
            >
              {loading ? 'Starting...' : '▶ Start Simulation'}
            </button>
            <button 
              onClick={handleStopSimulation}
              disabled={!simulating || loading}
              className="button-danger"
              style={{ flex: 1 }}
            >
              {loading ? 'Stopping...' : '⏹ Stop Simulation'}
            </button>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.375rem' }}>
            <div className="metric-label">Status</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className={`badge ${simulating ? 'badge-success' : 'badge-info'}`}>
                {simulating ? 'Simulating' : 'Ready'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
