import React, { useState, useMemo, useRef, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TIME_WINDOWS, DEFAULT_LIVE_WINDOW, downsample } from '../utils/chartUtils'

/** Throttle interval for chart updates (ms) */
const CHART_UPDATE_INTERVAL = 250

export default function LiveMonitor({ force, peakForce, elapsedTime, measurements, sessionActive, simulationActive }) {
  const [windowSeconds, setWindowSeconds] = useState(DEFAULT_LIVE_WINDOW)

  // Throttle: only snapshot measurements a few times per second
  const [snappedMeasurements, setSnappedMeasurements] = useState([])
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    const now = Date.now()
    if (measurements.length === 0) {
      setSnappedMeasurements([])
      lastUpdateRef.current = 0
      return
    }
    if (now - lastUpdateRef.current >= CHART_UPDATE_INTERVAL) {
      lastUpdateRef.current = now
      setSnappedMeasurements(measurements)
    }
  }, [measurements])

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const { chartData, xDomain, xTicks } = useMemo(() => {
    const empty = { chartData: [], xDomain: [0, windowSeconds === Infinity ? 1 : windowSeconds], xTicks: [] }
    if (snappedMeasurements.length === 0) return empty

    const sessionStart = snappedMeasurements[0].timestamp
    const now = snappedMeasurements[snappedMeasurements.length - 1].timestamp
    const elapsedSec = (now - sessionStart) / 1000

    // Fewer points for longer windows to keep SVG rendering fast
    const maxPoints = windowSeconds === Infinity
      ? 200
      : windowSeconds <= 15 ? 300 : windowSeconds <= 30 ? 250 : windowSeconds <= 60 ? 200 : windowSeconds <= 120 ? 150 : 120

    let filtered
    if (windowSeconds === Infinity) {
      filtered = snappedMeasurements
    } else {
      const cutoff = now - windowSeconds * 1000
      filtered = snappedMeasurements.filter(m => m.timestamp >= cutoff)
    }

    const mapped = filtered.map(m => ({
      elapsed: (m.timestamp - sessionStart) / 1000,
      force: Number(m.force.toFixed(2))
    }))

    // Snap domain to whole seconds so ticks don't jump
    const elapsedSnapped = Math.floor(elapsedSec)
    let domainMin, domainMax
    if (windowSeconds === Infinity) {
      domainMin = 0
      domainMax = Math.max(elapsedSnapped, 1)
    } else {
      domainMax = elapsedSnapped
      domainMin = elapsedSnapped - windowSeconds
    }

    // Generate stable tick positions at even intervals
    const tickInterval = windowSeconds === Infinity
      ? Math.max(1, Math.ceil(domainMax / 8))
      : windowSeconds <= 15 ? 5 : windowSeconds <= 30 ? 5 : windowSeconds <= 60 ? 10 : windowSeconds <= 120 ? 15 : 30
    const ticks = []
    const firstTick = Math.ceil(Math.max(domainMin, 0) / tickInterval) * tickInterval
    for (let t = firstTick; t <= domainMax; t += tickInterval) {
      ticks.push(t)
    }

    return { chartData: downsample(mapped, maxPoints), xDomain: [domainMin, domainMax], xTicks: ticks }
  }, [snappedMeasurements, windowSeconds])

  return (
    <div className="card">
      <h2 className="card-title">
        Live Monitoring
        {simulationActive && <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>SIMULATION</span>}
      </h2>
      
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

      {/* Time window selector */}
      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '1rem', flexWrap: 'wrap' }}>
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

      <div style={{ marginTop: '0.75rem' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="elapsed"
                type="number"
                domain={xDomain}
                ticks={xTicks}
                allowDataOverflow={true}
                stroke="var(--text-secondary)"
                tickFormatter={(sec) => {
                  if (sec < 0) return ''
                  const m = Math.floor(sec / 60)
                  const s = Math.floor(sec % 60)
                  return `${m}:${String(s).padStart(2, '0')}`
                }}
              />
              <YAxis stroke="var(--text-secondary)" label={{ value: 'N', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)' } }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                labelStyle={{ color: 'var(--text-primary)' }}
                labelFormatter={(sec) => {
                  const m = Math.floor(sec / 60)
                  const s = Math.floor(sec % 60)
                  return `Time: ${m}:${String(s).padStart(2, '0')}`
                }}
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
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            {sessionActive || simulationActive ? 'Waiting for data...' : 'Start a session or simulation to see live data'}
          </div>
        )}
      </div>

      <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Window: {windowSeconds === Infinity ? 'All' : `${windowSeconds}s`} · {measurements.length} samples buffered
      </p>
    </div>
  )
}
