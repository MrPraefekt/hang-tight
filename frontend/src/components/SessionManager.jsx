import React, { useState } from 'react'

export default function SessionManager({ sessionActive, onStart, onStop, onClear, wsConnected }) {
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try { await onStart() } finally { setLoading(false) }
  }

  const handleStop = async () => {
    setLoading(true)
    try { await onStop() } finally { setLoading(false) }
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
          {loading && !sessionActive ? 'Starting...' : '&#x25B6; Start Session'}
        </button>
        <button 
          onClick={handleStop}
          disabled={!sessionActive || loading}
          className="button-danger"
          style={{ flex: 1 }}
        >
          {loading && sessionActive ? 'Stopping...' : '&#x23F9; Stop Session'}
        </button>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <button 
          onClick={onClear}
          className="button-secondary"
          style={{ width: '100%' }}
        >
          Clear Display
        </button>
      </div>

      <div className="separator"></div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {wsConnected ? (
          <>&#x2713; Backend connected and ready</>
        ) : (
          <>&#x2715; Waiting for backend connection...</>
        )}
      </p>
    </div>
  )
}
