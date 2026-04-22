import React, { useState, useEffect, useRef, useCallback } from 'react'
import LiveMonitor from './components/LiveMonitor'
import CalibrationPanel from './components/CalibrationPanel'
import SessionManager from './components/SessionManager'
import HistoricalData from './components/HistoricalData'
import SimulationPanel from './components/SimulationPanel'

const MAX_MEASUREMENTS = 500;
const WS_RECONNECT_DELAY = 3000;

function getApiUrl() {
  return import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
}

function getWsUrl() {
  return import.meta.env.VITE_WS_URL
    ? `${import.meta.env.VITE_WS_URL}/ws/client`
    : `ws://${window.location.hostname}:3001/ws/client`
}

export default function App() {
  const [wsConnected, setWsConnected] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [simulationActive, setSimulationActive] = useState(false)
  const [currentForce, setCurrentForce] = useState(0)
  const [peakForce, setPeakForce] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [measurements, setMeasurements] = useState([])
  const [calibration, setCalibration] = useState({ offset: 0, scale: 1 })
  const [sessions, setSessions] = useState([])
  
  const wsRef = useRef(null)
  const sessionStartTimeRef = useRef(null)
  const timerRef = useRef(null)
  const reconnectRef = useRef(null)
  const mountedRef = useRef(true)

  // WebSocket connection with auto-reconnect
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return // CONNECTING or OPEN
    
    const wsUrl = getWsUrl()
    console.log(`Connecting to WebSocket: ${wsUrl}`)
    
    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        setWsConnected(true)
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current)
          reconnectRef.current = null
        }
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setWsConnected(false)
        // Schedule reconnect
        if (mountedRef.current) {
          reconnectRef.current = setTimeout(connectWebSocket, WS_RECONNECT_DELAY)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      if (mountedRef.current) {
        reconnectRef.current = setTimeout(connectWebSocket, WS_RECONNECT_DELAY)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connectWebSocket()
    fetchCalibration()
    fetchSessions()
    
    return () => {
      mountedRef.current = false
      if (wsRef.current) wsRef.current.close()
      if (timerRef.current) clearInterval(timerRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connectWebSocket])

  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'connected':
        // Sync state from server
        if (data.sessionActive) setSessionActive(true)
        if (data.simulationActive) setSimulationActive(true)
        if (data.calibration) setCalibration(data.calibration)
        break
      case 'measurement':
        handleMeasurement(data)
        break
      case 'calibration_updated':
        setCalibration({ offset: data.offset, scale: data.scale })
        break
      case 'session_started':
        setSessionActive(true)
        break
      case 'session_stopped':
        setSessionActive(false)
        break
      case 'simulation_started':
        setSimulationActive(true)
        break
      case 'simulation_stopped':
        setSimulationActive(false)
        setMeasurements([])
        setCurrentForce(0)
        break
      default:
        break
    }
  }

  function handleMeasurement(data) {
    const { timestamp, raw, force } = data
    
    setCurrentForce(force)
    setPeakForce(prev => Math.max(prev, force))
    setMeasurements(prev => [...prev.slice(-(MAX_MEASUREMENTS - 1)), { timestamp, raw, force }])
  }

  async function fetchCalibration() {
    try {
      const response = await fetch(`${getApiUrl()}/calibration`)
      const data = await response.json()
      setCalibration(data)
    } catch (error) {
      console.error('Failed to fetch calibration:', error)
    }
  }

  async function fetchSessions() {
    try {
      const response = await fetch(`${getApiUrl()}/sessions`)
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  async function handleStartSession() {
    try {
      await fetch(`${getApiUrl()}/session/start`, { method: 'POST' })
      
      setSessionActive(true)
      sessionStartTimeRef.current = Date.now()
      setElapsedTime(0)
      setMeasurements([])
      setPeakForce(0)
      setCurrentForce(0)
      
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - sessionStartTimeRef.current) / 1000))
      }, 100)
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  async function handleStopSession() {
    try {
      if (timerRef.current) clearInterval(timerRef.current)
      await fetch(`${getApiUrl()}/session/stop`, { method: 'POST' })
      setSessionActive(false)
      await fetchSessions()
    } catch (error) {
      console.error('Failed to stop session:', error)
    }
  }

  async function handleSaveCalibration(offset, scale) {
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

  function handleClearState() {
    setMeasurements([])
    setCurrentForce(0)
    setPeakForce(0)
    setElapsedTime(0)
  }

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem' }}>
        <h1>&#x1F9D7; Hangboard Force Measurement</h1>
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
        simulationActive={simulationActive}
        maxPoints={MAX_MEASUREMENTS}
      />

      <div className="grid grid-2">
        <SessionManager 
          sessionActive={sessionActive}
          onStart={handleStartSession}
          onStop={handleStopSession}
          onClear={handleClearState}
          wsConnected={wsConnected}
        />

        <CalibrationPanel 
          calibration={calibration}
          onSave={handleSaveCalibration}
        />
      </div>

      <SimulationPanel 
        sessions={sessions}
        apiUrl={getApiUrl()}
        simulationActive={simulationActive}
      />

      <HistoricalData 
        sessions={sessions}
        onRefresh={fetchSessions}
        apiUrl={getApiUrl()}
      />
    </div>
  )
}
