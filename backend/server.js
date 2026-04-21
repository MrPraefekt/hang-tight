/**
 * Hangboard Force Measurement System - Backend
 * 
 * WebSocket server for:
 * - Real-time data streaming from ESP32
 * - Calibration management
 * - Session recording
 * - Simulation mode
 */

require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

// Configuration
const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;

// Initialize Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize HTTP server for WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Database connection pool
const db = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Global state
let currentSession = null;
let currentCalibration = null;
let simulationActive = false;
let simulationInterval = null;
let simulationSessionId = null;
let simulationSampleIndex = 0;
let simulationSamples = [];

// Connected WebSocket clients
const clients = new Set();

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Get current calibration from database
 */
async function getCalibration() {
  try {
    const result = await db.query(
      'SELECT * FROM calibration ORDER BY created_at DESC LIMIT 1'
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching calibration:', error);
    return null;
  }
}

/**
 * Save calibration to database
 */
async function saveCalibration(offset, scale) {
  try {
    const result = await db.query(
      'INSERT INTO calibration (offset, scale, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [offset, scale]
    );
    currentCalibration = result.rows[0];
    return currentCalibration;
  } catch (error) {
    console.error('Error saving calibration:', error);
    throw error;
  }
}

/**
 * Start new session
 */
async function startSession() {
  try {
    const result = await db.query(
      'INSERT INTO sessions (start_time) VALUES (NOW()) RETURNING *'
    );
    currentSession = result.rows[0];
    return currentSession;
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
}

/**
 * End current session
 */
async function endSession() {
  try {
    if (currentSession) {
      const result = await db.query(
        'UPDATE sessions SET end_time = NOW() WHERE id = $1 RETURNING *',
        [currentSession.id]
      );
      currentSession = null;
      return result.rows[0];
    }
  } catch (error) {
    console.error('Error ending session:', error);
    throw error;
  }
}

/**
 * Save sample to database
 */
async function saveSample(sessionId, timestamp, raw, force) {
  try {
    await db.query(
      'INSERT INTO samples (session_id, timestamp, raw, force) VALUES ($1, $2, $3, $4)',
      [sessionId, timestamp, raw, force]
    );
  } catch (error) {
    console.error('Error saving sample:', error);
  }
}

/**
 * Get session samples for simulation
 */
async function getSessionSamples(sessionId) {
  try {
    const result = await db.query(
      'SELECT * FROM samples WHERE session_id = $1 ORDER BY timestamp ASC',
      [sessionId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching samples:', error);
    return [];
  }
}

/**
 * Get all sessions
 */
async function getSessions() {
  try {
    const result = await db.query(
      'SELECT * FROM sessions ORDER BY start_time DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

/**
 * Get session by ID
 */
async function getSessionById(sessionId) {
  try {
    const result = await db.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Apply calibration to raw value
 * force = (raw - offset) * scale
 */
function calibrateRaw(raw, calibration) {
  if (!calibration) {
    return raw; // Return raw if no calibration
  }
  return (raw - calibration.offset) * calibration.scale;
}

/**
 * Process incoming measurement
 */
async function processMeasurement(data) {
  try {
    const { timestamp, raw } = data;
    
    if (!currentSession) {
      console.warn('Received measurement but no session active');
      return;
    }

    // Load fresh calibration
    if (!currentCalibration) {
      currentCalibration = await getCalibration();
    }

    // Apply calibration
    const force = calibrateRaw(raw, currentCalibration);

    // Save to database
    await saveSample(currentSession.id, timestamp, raw, force);

    // Broadcast to all connected clients
    const payload = JSON.stringify({
      type: 'measurement',
      timestamp,
      raw,
      force: Number(force.toFixed(2))
    });

    broadcastToClients(payload);
  } catch (error) {
    console.error('Error processing measurement:', error);
  }
}

/**
 * Broadcast message to all connected WebSocket clients
 */
function broadcastToClients(message) {
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// ============================================================================
// Simulation Mode
// ============================================================================

/**
 * Start simulation from a session
 */
async function startSimulation(sessionId) {
  try {
    simulationSessionId = sessionId;
    simulationSamples = await getSessionSamples(sessionId);
    
    if (simulationSamples.length === 0) {
      throw new Error('No samples found for simulation');
    }

    simulationSampleIndex = 0;
    simulationActive = true;

    console.log(`Starting simulation with ${simulationSamples.length} samples`);

    // Replay at 20 Hz (50ms interval)
    simulationInterval = setInterval(() => {
      if (simulationSampleIndex >= simulationSamples.length) {
        // Loop back to start
        simulationSampleIndex = 0;
      }

      const sample = simulationSamples[simulationSampleIndex];
      const payload = JSON.stringify({
        type: 'measurement',
        timestamp: sample.timestamp,
        raw: sample.raw,
        force: Number(sample.force.toFixed(2)),
        simulated: true
      });

      broadcastToClients(payload);
      simulationSampleIndex++;
    }, 50); // 20 Hz

    return { success: true, samples: simulationSamples.length };
  } catch (error) {
    console.error('Error starting simulation:', error);
    throw error;
  }
}

/**
 * Stop simulation
 */
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  simulationActive = false;
  simulationSamples = [];
  simulationSampleIndex = 0;
  console.log('Simulation stopped');
}

// ============================================================================
// WebSocket Handler
// ============================================================================

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  clients.add(ws);

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Hangboard backend'
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'measurement') {
        // Data from ESP32
        await processMeasurement(message);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// ============================================================================
// REST API Endpoints
// ============================================================================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * GET /calibration - Get current calibration
 */
app.get('/calibration', async (req, res) => {
  try {
    const calibration = await getCalibration();
    res.json(calibration || { offset: 0, scale: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /calibrate - Save new calibration
 */
app.post('/calibrate', async (req, res) => {
  try {
    const { offset, scale } = req.body;
    
    if (typeof offset !== 'number' || typeof scale !== 'number') {
      return res.status(400).json({ error: 'Invalid offset or scale' });
    }

    const calibration = await saveCalibration(offset, scale);
    
    // Notify all clients
    broadcastToClients(JSON.stringify({
      type: 'calibration_updated',
      offset: calibration.offset,
      scale: calibration.scale
    }));

    res.json(calibration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /session/start - Start recording session
 */
app.post('/session/start', async (req, res) => {
  try {
    const session = await startSession();
    
    broadcastToClients(JSON.stringify({
      type: 'session_started',
      session_id: session.id
    }));

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /session/stop - Stop recording session
 */
app.post('/session/stop', async (req, res) => {
  try {
    const session = await endSession();
    
    broadcastToClients(JSON.stringify({
      type: 'session_stopped',
      session_id: session.id
    }));

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /sessions - List all sessions
 */
app.get('/sessions', async (req, res) => {
  try {
    const sessions = await getSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /sessions/:id - Get session details
 */
app.get('/sessions/:id', async (req, res) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const samples = await getSessionSamples(req.params.id);
    res.json({
      ...session,
      samples
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /simulate/start - Start simulation
 */
app.post('/simulate/start', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }

    if (simulationActive) {
      return res.status(400).json({ error: 'Simulation already running' });
    }

    const result = await startSimulation(session_id);
    
    broadcastToClients(JSON.stringify({
      type: 'simulation_started',
      session_id
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /simulate/stop - Stop simulation
 */
app.post('/simulate/stop', async (req, res) => {
  try {
    stopSimulation();
    
    broadcastToClients(JSON.stringify({
      type: 'simulation_stopped'
    }));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET / - Welcome message
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Hangboard Force Measurement System',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'GET /calibration': 'Get current calibration',
      'POST /calibrate': 'Save calibration (offset, scale)',
      'POST /session/start': 'Start recording session',
      'POST /session/stop': 'Stop recording session',
      'GET /sessions': 'List all sessions',
      'GET /sessions/:id': 'Get session details with samples',
      'POST /simulate/start': 'Start simulation (session_id)',
      'POST /simulate/stop': 'Stop simulation',
      'WebSocket': 'ws://host/ws - Connects at root path'
    }
  });
});

// ============================================================================
// Initialize Database and Start Server
// ============================================================================

async function initialize() {
  try {
    // Test database connection
    const client = await db.connect();
    console.log('Database connected');
    client.release();

    // Load current calibration
    currentCalibration = await getCalibration();

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`🚀 Hangboard Backend running on port ${PORT}`);
      console.log(`   WebSocket: ws://localhost:${PORT}`);
      console.log(`   API: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  stopSimulation();
  await db.end();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

initialize();
