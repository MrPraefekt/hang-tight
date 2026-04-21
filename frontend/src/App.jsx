import React, { useState, useEffect, useRef } from 'react'
import LiveMonitor from './components/LiveMonitor'
import CalibrationPanel from './components/CalibrationPanel'
import SessionManager from './components/SessionManager'
import HistoricalData from './components/HistoricalData'
import SimulationPanel from './components/SimulationPanel'

/**
 * Main Application Component
 */
export default function App() {
  const [wsConnected, setWsConnected] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [currentForce, setCurrentForce] = useState(0)
  const [peakForce, setPeakForce] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [measurements, setMeasurements] = useState([])
  const [calibration, setCalibration] = useState({ offset: 0, scale: 1 })
  const [sessions, setSessions] = useState([])
  
  const wsRef = useRef(null)
  const sessionStartTimeRef = useRef(null)
  const timerRef = useRef(null)

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`
    
    console.log(`Connecting to WebSocket: ${wsUrl}`)
    
    try {
      wsRef.current = new WebSocket(wsUrl)
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
        setWsConnected(true)
      }
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected')
        setWsConnected(false)
        // Attempt reconnect after 3 seconds
        setTimeout(() => {
          console.log('Attempting to reconnect...')
        }, 3000)
      }
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setWsConnected(false)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Fetch calibration on mount
  useEffect(() => {
    fetchCalibration()
    fetchSessions()
  }, [])

  // Handle incoming WebSocket messages
  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'measurement':
        handleMeasurement(data)
        break
      case 'calibration_updated':
        setCalibration(data)
        break
      case 'session_started':
        setSessionActive(true)
        break
      case 'session_stopped':
        setSessionActive(false)
        setMeasurements([])
        setPeakForce(0)
        setElapsedTime(0)
        break
      case 'simulation_started':
        console.log('Simulation started')
        break
      case 'simulation_stopped':
        console.log('Simulation stopped')
        break
      default:
        break
    }
  }

  // Process incoming measurement
  function handleMeasurement(data) {
    if (!sessionActive && !data.simulated) return
    
    const { timestamp, raw, force } = data
    
    // Update current metrics
    setCurrentForce(force)
    if (force > peakForce) {
      setPeakForce(force)
    }
    
    // Store measurement
    setMeasurements(prev => [...prev.slice(-199), { timestamp, raw, force }])
  }

  // Fetch current calibration from backend
  async function fetchCalibration() {
    try {
      const response = await fetch(`${getApiUrl()}/calibration`)
      const data = await response.json()
      setCalibration(data)
    } catch (error) {
      console.error('Failed to fetch calibration:', error)
    }
  }

  // Fetch sessions from backend
  async function fetchSessions() {
    try {
      const response = await fetch(`${getApiUrl()}/sessions`)
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  // Start session
  async function startSession() {
    try {
      const response = await fetch(`${getApiUrl()}/session/start`, {
        method: 'POST'
      })
      const data = await response.json()
      
      setSessionActive(true)
      sessionStartTimeRef.current = Date.now()
      setElapsedTime(0)
      setMeasurements([])
      setPeakForce(0)
      setCurrentForce(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - sessionStartTimeRef.current) / 1000))
      }, 100)
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  // Stop session
  async function stopSession() {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      const response = await fetch(`${getApiUrl()}/session/stop`, {
        method: 'POST'
      })
      
      setSessionActive(false)
      await fetchSessions()
    } catch (error) {
      console.error('Failed to stop session:', error)
    }
  }

  // Save calibration
  async function saveCalibration(offset, scale) {
    try {
      const response = await fetch(`${getApiUrl()}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset, scale })
      })
      const data = await response.json()
      setCalibration(data)
      alert('Calibration saved successfully')
    } catch (error) {
      console.error('Failed to save calibration:', error)
      alert('Failed to save calibration')
    }
  }

  function getApiUrl() {
    return import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
  }

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem' }}>
        <h1>🧗 Hangboard Force Measurement</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Real-time grip strength monitoring system
        </p>
        <div style={{ marginTop: '1rem' }}>
          <span className={`status ${wsConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <LiveMonitor 
        force={currentForce}
        peakForce={peakForce}
        elapsedTime={elapsedTime}
        measurements={measurements}
        sessionActive={sessionActive}
      />

      <div className="grid grid-2">
        <SessionManager 
          sessionActive={sessionActive}
          onStart={startSession}
          onStop={stopSession}
          wsConnected={wsConnected}
        />

        <CalibrationPanel 
          calibration={calibration}
          onSave={saveCalibration}
        />
      </div>

      <SimulationPanel 
        sessions={sessions}
        apiUrl={getApiUrl()}
      />

      <HistoricalData 
        sessions={sessions}
        onRefresh={fetchSessions}
      />
    </div>
  )
}
