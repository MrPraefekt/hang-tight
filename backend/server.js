/**
 * Hangboard Force Measurement System - Backend
 *
 * WebSocket server for:
 * - Real-time data streaming from ESP32 (path: /ws/esp)
 * - Frontend live data consumption (path: /ws/client)
 * - Calibration management
 * - Session recording with batch inserts
 * - Simulation mode (same output format as live)
 *
 * Uses SQLite for zero-config local storage (runs on Mac + Raspberry Pi).
 */

require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'hangboard.db');
const BATCH_SIZE = 20;
const BATCH_INTERVAL_MS = 1000;

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Initialize SQLite
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// ============================================================================
// Schema initialization
// ============================================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL DEFAULT (datetime('now')),
    end_time TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    raw INTEGER NOT NULL,
    force REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calibration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    "offset" REAL NOT NULL,
    scale REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_samples_session_id ON samples(session_id);
  CREATE INDEX IF NOT EXISTS idx_samples_timestamp ON samples(timestamp);
  CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
  CREATE INDEX IF NOT EXISTS idx_calibration_created_at ON calibration(created_at);
`);

// ============================================================================
// Prepared statements (much faster than ad-hoc queries)
// ============================================================================

const stmts = {
  getCalibration: db.prepare(
    'SELECT * FROM calibration ORDER BY created_at DESC LIMIT 1'
  ),
  insertCalibration: db.prepare(
    'INSERT INTO calibration ("offset", scale) VALUES (?, ?)'
  ),
  getLastRow: db.prepare(
    'SELECT * FROM calibration WHERE id = last_insert_rowid()'
  ),
  insertSession: db.prepare(
    "INSERT INTO sessions (start_time) VALUES (datetime('now'))"
  ),
  getLastSession: db.prepare(
    'SELECT * FROM sessions WHERE id = last_insert_rowid()'
  ),
  endSession: db.prepare(
    "UPDATE sessions SET end_time = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ),
  getSessionSamples: db.prepare(
    'SELECT * FROM samples WHERE session_id = ? ORDER BY timestamp ASC'
  ),
  getSessions: db.prepare(
    'SELECT * FROM sessions ORDER BY start_time DESC'
  ),
  getSessionById: db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ),
  insertSample: db.prepare(
    'INSERT INTO samples (session_id, timestamp, raw, force) VALUES (?, ?, ?, ?)'
  ),
};

// ============================================================================
// Express + HTTP server
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files (built with `vite build` -> backend/public/)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

const server = http.createServer(app);

// Two WebSocket servers on different paths
const wssEsp = new WebSocketServer({ noServer: true });
const wssClient = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/ws/esp') {
    wssEsp.handleUpgrade(request, socket, head, (ws) => {
      wssEsp.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/client' || pathname === '/ws' || pathname === '/') {
    wssClient.handleUpgrade(request, socket, head, (ws) => {
      wssClient.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ============================================================================
// State
// ============================================================================

let currentSession = null;
let currentCalibration = null;
let simulationActive = false;
let simulationInterval = null;

const frontendClients = new Set();

let sampleBatch = [];
let batchTimer = null;

// ============================================================================
// Database Functions (synchronous — better-sqlite3 is sync by design)
// ============================================================================

function getCalibration() {
  try {
    return stmts.getCalibration.get() || null;
  } catch (error) {
    console.error('Error fetching calibration:', error.message);
    return null;
  }
}

function saveCalibration(offset, scale) {
  stmts.insertCalibration.run(offset, scale);
  const row = stmts.getCalibration.get();
  currentCalibration = row;
  return row;
}

function createSession() {
  stmts.insertSession.run();
  const row = stmts.getLastSession.get();
  currentSession = row;
  sampleBatch = [];
  return row;
}

function endSession() {
  if (!currentSession) return null;
  flushSampleBatch();
  stmts.endSession.run(currentSession.id);
  const row = stmts.getSessionById.get(currentSession.id);
  currentSession = null;
  return row;
}

/**
 * Batch insert samples inside a single transaction
 */
const batchInsertSamples = db.transaction((rows) => {
  for (const s of rows) {
    stmts.insertSample.run(s.session_id, s.timestamp, s.raw, s.force);
  }
});

function flushSampleBatch() {
  if (sampleBatch.length === 0) return;
  const batch = sampleBatch.splice(0);
  try {
    batchInsertSamples(batch);
  } catch (error) {
    console.error('Error batch inserting samples:', error.message);
  }
}

function queueSample(sessionId, timestamp, raw, force) {
  sampleBatch.push({ session_id: sessionId, timestamp, raw, force });
  if (sampleBatch.length >= BATCH_SIZE) {
    flushSampleBatch();
  }
}

function startBatchTimer() {
  if (batchTimer) return;
  batchTimer = setInterval(() => {
    if (sampleBatch.length > 0) flushSampleBatch();
  }, BATCH_INTERVAL_MS);
}

function stopBatchTimer() {
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
}

function getSessionSamples(sessionId) {
  try {
    return stmts.getSessionSamples.all(sessionId);
  } catch (error) {
    console.error('Error fetching samples:', error.message);
    return [];
  }
}

function getSessions() {
  try {
    return stmts.getSessions.all();
  } catch (error) {
    console.error('Error fetching sessions:', error.message);
    return [];
  }
}

function getSessionById(sessionId) {
  try {
    return stmts.getSessionById.get(sessionId) || null;
  } catch (error) {
    console.error('Error fetching session:', error.message);
    return null;
  }
}

// ============================================================================
// Data Processing
// ============================================================================

function calibrateRaw(raw, calibration) {
  if (!calibration) return raw;
  return (raw - Number(calibration.offset)) * Number(calibration.scale);
}

function processMeasurement(data) {
  const { timestamp, raw } = data;

  if (typeof timestamp !== 'number' || typeof raw !== 'number') {
    return;
  }

  const force = calibrateRaw(raw, currentCalibration);
  const forceRounded = Number(force.toFixed(2));

  if (currentSession) {
    queueSample(currentSession.id, timestamp, raw, forceRounded);
  }

  broadcastToClients(JSON.stringify({
    type: 'measurement',
    timestamp,
    raw,
    force: forceRounded
  }));
}

function broadcastToClients(message) {
  frontendClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// ============================================================================
// Simulation
// ============================================================================

function startSimulation(sessionId) {
  const samples = getSessionSamples(sessionId);

  if (samples.length === 0) {
    throw new Error('No samples found for simulation');
  }

  simulationActive = true;
  let index = 0;

  console.log(`Starting simulation with ${samples.length} samples`);

  simulationInterval = setInterval(() => {
    if (index >= samples.length) {
      index = 0;
    }

    const sample = samples[index];
    broadcastToClients(JSON.stringify({
      type: 'measurement',
      timestamp: Number(sample.timestamp),
      raw: Number(sample.raw),
      force: Number(Number(sample.force).toFixed(2)),
      simulated: true
    }));
    index++;
  }, 50);

  return { success: true, samples: samples.length };
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  simulationActive = false;
  console.log('Simulation stopped');
}

// ============================================================================
// ESP32 WebSocket Handler
// ============================================================================

wssEsp.on('connection', (ws) => {
  console.log('ESP32 connected');

  ws.on('message', (data) => {
    try {
      processMeasurement(JSON.parse(data.toString()));
    } catch (error) {
      console.error('Error handling ESP message:', error.message);
    }
  });

  ws.on('close', () => console.log('ESP32 disconnected'));
  ws.on('error', (error) => console.error('ESP32 WebSocket error:', error.message));
});

// ============================================================================
// Frontend WebSocket Handler
// ============================================================================

wssClient.on('connection', (ws) => {
  console.log('Frontend client connected');
  frontendClients.add(ws);

  ws.send(JSON.stringify({
    type: 'connected',
    sessionActive: !!currentSession,
    simulationActive,
    calibration: currentCalibration || { offset: 0, scale: 1 }
  }));

  ws.on('close', () => {
    frontendClients.delete(ws);
  });

  ws.on('error', (error) => console.error('Frontend WS error:', error.message));
});

// ============================================================================
// REST API
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionActive: !!currentSession,
    simulationActive,
    frontendClients: frontendClients.size,
    espClients: wssEsp.clients.size
  });
});

// Build hash for auto-reload — returns current git commit
const { execSync } = require('child_process');
let buildHash = 'dev';
try {
  buildHash = execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }).toString().trim();
} catch (_) {}
app.get('/build-hash', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ hash: buildHash });
});

app.get('/calibration', (req, res) => {
  try {
    res.json(getCalibration() || { offset: 0, scale: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/calibrate', (req, res) => {
  try {
    const { offset, scale } = req.body;
    if (typeof offset !== 'number' || typeof scale !== 'number') {
      return res.status(400).json({ error: 'Invalid offset or scale' });
    }

    const calibration = saveCalibration(offset, scale);

    broadcastToClients(JSON.stringify({
      type: 'calibration_updated',
      offset: Number(calibration.offset),
      scale: Number(calibration.scale)
    }));

    res.json(calibration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/start', (req, res) => {
  try {
    if (currentSession) {
      return res.status(400).json({ error: 'Session already active' });
    }

    const session = createSession();
    startBatchTimer();

    broadcastToClients(JSON.stringify({
      type: 'session_started',
      session_id: session.id
    }));

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/stop', (req, res) => {
  try {
    const session = endSession();
    stopBatchTimer();

    broadcastToClients(JSON.stringify({
      type: 'session_stopped',
      session_id: session ? session.id : null
    }));

    res.json(session || { message: 'No active session' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/sessions', (req, res) => {
  try {
    res.json(getSessions());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/sessions/:id', (req, res) => {
  try {
    const session = getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const samples = getSessionSamples(req.params.id);
    res.json({ ...session, samples });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/simulate/start', (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }
    if (simulationActive) {
      return res.status(400).json({ error: 'Simulation already running' });
    }

    const result = startSimulation(session_id);

    broadcastToClients(JSON.stringify({
      type: 'simulation_started',
      session_id
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/simulate/stop', (req, res) => {
  try {
    stopSimulation();
    broadcastToClients(JSON.stringify({ type: 'simulation_stopped' }));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback — serve index.html for non-API routes (must be last)
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      name: 'Hangboard Force Measurement System',
      version: '1.0.0',
      note: 'No frontend build found in backend/public/. Run: make build'
    });
  }
});

// ============================================================================
// Initialize
// ============================================================================

function initialize() {
  currentCalibration = getCalibration();
  if (currentCalibration) {
    console.log(`Loaded calibration: offset=${currentCalibration.offset}, scale=${currentCalibration.scale}`);
  }

  server.listen(PORT, () => {
    console.log(`Hangboard Backend running on port ${PORT}`);
    console.log(`  Database: ${DB_PATH}`);
    console.log(`  ESP32 WS:  ws://localhost:${PORT}/ws/esp`);
    console.log(`  Client WS: ws://localhost:${PORT}/ws/client`);
    console.log(`  UI + API:  http://localhost:${PORT}`);
  });
}

function shutdown() {
  stopSimulation();
  stopBatchTimer();
  flushSampleBatch();
  db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => { console.log('SIGTERM'); shutdown(); });
process.on('SIGINT', () => { console.log('SIGINT'); shutdown(); });

initialize();
