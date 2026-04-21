import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * Live Monitoring Display
 */
export default function LiveMonitor({ force, peakForce, elapsedTime, measurements, sessionActive }) {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const chartData = measurements.map((m, i) => ({
    index: i,
    force: Number(m.force.toFixed(2))
  }))

  return (
    <div className="card">
      <h2 className="card-title">Live Monitoring</h2>
      
      <div className="grid grid-3">
        <div className="metric">
          <div className="metric-label">Current Force</div>
          <div className="metric-value">
            {force.toFixed(2)}
            <span className="metric-unit">N</span>
          </div>
        </div>

        <div className="metric">
          <div className="metric-label">Peak Force</div>
          <div className="metric-value">
            {peakForce.toFixed(2)}
            <span className="metric-unit">N</span>
          </div>
        </div>

        <div className="metric">
          <div className="metric-label">Elapsed Time</div>
          <div className="metric-value" style={{ fontSize: '1.5rem' }}>
            {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {measurements.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
            {sessionActive ? 'Waiting for data...' : 'Start a session to see live data'}
          </div>
        )}
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Showing last {measurements.length} measurements at 20 Hz
      </p>
    </div>
  )
}
