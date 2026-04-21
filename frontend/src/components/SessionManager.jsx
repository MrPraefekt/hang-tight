import React, { useState } from 'react'

/**
 * Session Manager Component
 */
export default function SessionManager({ sessionActive, onStart, onStop, wsConnected }) {
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try {
      await onStart()
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await onStop()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">Session Control</h2>
      
      <div style={{ marginBottom: '1rem' }}>
        <div className="metric" style={{ textAlign: 'left' }}>
          <div className="metric-label">Status</div>
          <div style={{ marginTop: '0.5rem' }}>
            <span className={`badge ${sessionActive ? 'badge-success' : 'badge-info'}`}>
              {sessionActive ? 'Recording' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      <div className="button-group">
        <button 
          onClick={handleStart}
          disabled={sessionActive || !wsConnected || loading}
          className="button-success"
          style={{ flex: 1 }}
        >
          {loading ? 'Starting...' : '▶ Start Session'}
        </button>
        <button 
          onClick={handleStop}
          disabled={!sessionActive || loading}
          className="button-danger"
          style={{ flex: 1 }}
        >
          {loading ? 'Stopping...' : '⏹ Stop Session'}
        </button>
      </div>

      <div className="separator"></div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {wsConnected ? (
          <>✓ Backend connected and ready</>
        ) : (
          <>✕ Waiting for backend connection...</>
        )}
      </p>
    </div>
  )
}
