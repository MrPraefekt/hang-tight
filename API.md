# API Reference

Complete API documentation for the Hangboard backend.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-backend.railway.app`

## WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### Message Types

#### Measurement (ESP32 → Backend → Frontend)

```json
{
  "type": "measurement",
  "timestamp": 1705315200000,
  "raw": 2500,
  "force": 3.75,
  "simulated": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | string | "measurement" |
| timestamp | number | Unix milliseconds |
| raw | integer | Raw ADC value |
| force | number | Calibrated force (N) |
| simulated | boolean | Optional, true if simulation |

#### Connection Confirmation

```json
{
  "type": "connected",
  "message": "Connected to Hangboard backend"
}
```

#### Calibration Update

```json
{
  "type": "calibration_updated",
  "offset": 1000,
  "scale": 0.001
}
```

#### Session Events

**Session Started**:
```json
{
  "type": "session_started",
  "session_id": 42
}
```

**Session Stopped**:
```json
{
  "type": "session_stopped",
  "session_id": 42
}
```

#### Simulation Events

**Simulation Started**:
```json
{
  "type": "simulation_started",
  "session_id": 1
}
```

**Simulation Stopped**:
```json
{
  "type": "simulation_stopped"
}
```

## HTTP REST API

### Health Check

Get server health status.

**Endpoint**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "ok"
}
```

---

### API Information

Get API endpoint overview.

**Endpoint**: `GET /`

**Response** (200 OK):
```json
{
  "name": "Hangboard Force Measurement System",
  "version": "1.0.0",
  "endpoints": {
    "GET /health": "Health check",
    "GET /calibration": "Get current calibration",
    "POST /calibrate": "Save calibration",
    ...
  }
}
```

---

### Calibration

#### Get Current Calibration

Retrieve the most recent calibration values.

**Endpoint**: `GET /calibration`

**Response** (200 OK):
```json
{
  "id": 1,
  "offset": 1000,
  "scale": 0.001,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Response** (200 OK - No calibration):
```json
{
  "offset": 0,
  "scale": 1
}
```

#### Save New Calibration

Store new calibration offset and scale values.

**Endpoint**: `POST /calibrate`

**Content-Type**: `application/json`

**Request Body**:
```json
{
  "offset": 1000,
  "scale": 0.001
}
```

**Response** (200 OK):
```json
{
  "id": 2,
  "offset": 1000,
  "scale": 0.001,
  "created_at": "2024-01-15T11:00:00Z"
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid offset or scale | Non-numeric values provided |
| 500 | Database error | Server error occurred |

---

### Sessions

#### Start Session

Create new recording session.

**Endpoint**: `POST /session/start`

**Request Body**: (empty)

**Response** (200 OK):
```json
{
  "id": 7,
  "start_time": "2024-01-15T15:30:00Z",
  "end_time": null,
  "created_at": "2024-01-15T15:30:00Z"
}
```

**Error Responses**:

| Status | Error |
|--------|-------|
| 500 | Failed to start session |

---

#### Stop Session

End current recording session.

**Endpoint**: `POST /session/stop`

**Request Body**: (empty)

**Response** (200 OK):
```json
{
  "id": 7,
  "start_time": "2024-01-15T15:30:00Z",
  "end_time": "2024-01-15T15:35:00Z",
  "created_at": "2024-01-15T15:30:00Z"
}
```

---

#### List All Sessions

Retrieve all recording sessions ordered by date.

**Endpoint**: `GET /sessions`

**Query Parameters**: None

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "start_time": "2024-01-10T08:00:00Z",
    "end_time": "2024-01-10T08:02:00Z",
    "created_at": "2024-01-10T08:00:00Z"
  },
  {
    "id": 2,
    "start_time": "2024-01-10T09:00:00Z",
    "end_time": "2024-01-10T09:03:00Z",
    "created_at": "2024-01-10T09:00:00Z"
  }
]
```

---

#### Get Session Details

Retrieve specific session with all samples.

**Endpoint**: `GET /sessions/:id`

**Path Parameters**:
- `id` (required): Session ID

**Response** (200 OK):
```json
{
  "id": 1,
  "start_time": "2024-01-10T08:00:00Z",
  "end_time": "2024-01-10T08:02:00Z",
  "created_at": "2024-01-10T08:00:00Z",
  "samples": [
    {
      "id": 1,
      "session_id": 1,
      "timestamp": 1705315200000,
      "raw": 1050,
      "force": 0.05,
      "created_at": "2024-01-10T08:00:01Z"
    },
    {
      "id": 2,
      "session_id": 1,
      "timestamp": 1705315250000,
      "raw": 1200,
      "force": 0.20,
      "created_at": "2024-01-10T08:00:02Z"
    }
  ]
}
```

**Error Responses**:

| Status | Error |
|--------|-------|
| 404 | Session not found |
| 500 | Database error |

---

### Simulation

#### Start Simulation

Begin replaying a recorded session as if it were live data.

**Endpoint**: `POST /simulate/start`

**Content-Type**: `application/json`

**Request Body**:
```json
{
  "session_id": 1
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "samples": 125
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | session_id required | Missing session_id |
| 400 | Simulation already running | Stop current simulation first |
| 400 | No samples found | Session has no data |
| 500 | Database error | Server error |

**Behavior**:
- Replays samples at 20 Hz (50ms interval)
- Loops back to start after last sample
- Broadcasts via WebSocket as normal measurements
- Samples include `"simulated": true` flag

---

#### Stop Simulation

Stop active simulation.

**Endpoint**: `POST /simulate/stop`

**Request Body**: (empty)

**Response** (200 OK):
```json
{
  "success": true
}
```

**Response** (if not simulating):
```json
{
  "success": true
}
```

---

## Data Models

### Session
```typescript
interface Session {
  id: number
  start_time: string         // ISO 8601 timestamp
  end_time: string | null    // ISO 8601 timestamp
  created_at: string         // ISO 8601 timestamp
}
```

### Sample
```typescript
interface Sample {
  id: number
  session_id: number
  timestamp: number          // Unix milliseconds
  raw: integer               // Raw ADC value (-32768 to 32767)
  force: number              // Calibrated force in Newtons
  created_at: string         // ISO 8601 timestamp
}
```

### Calibration
```typescript
interface Calibration {
  id: number
  offset: number             // Raw ADC value when unloaded
  scale: number              // Force per raw unit
  created_at: string         // ISO 8601 timestamp
}
```

---

## Error Handling

All errors return JSON with consistent format:

```json
{
  "error": "Error description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Unexpected error |

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid offset or scale" | Non-numeric values | Use numbers |
| "session_id required" | Missing parameter | Include session_id in body |
| "Session not found" | Invalid session ID | Get ID from `/sessions` |
| "Simulation already running" | Can't start two sims | Call `/simulate/stop` first |
| "Database error" | Connection issue | Check DATABASE_URL env var |

---

## Rate Limiting

Current implementation has no rate limiting. For production, add:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100                    // 100 requests per window
});

app.use(limiter);
```

---

## CORS Headers

Default CORS configuration allows localhost. For production, configure:

```javascript
app.use(cors({
  origin: 'https://your-frontend.vercel.app',
  credentials: true
}));
```

---

## Request Examples

### cURL

**Start Session**:
```bash
curl -X POST http://localhost:3001/session/start
```

**Save Calibration**:
```bash
curl -X POST http://localhost:3001/calibrate \
  -H "Content-Type: application/json" \
  -d '{"offset": 1000, "scale": 0.001}'
```

**Get Sessions**:
```bash
curl http://localhost:3001/sessions
```

**Start Simulation**:
```bash
curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1}'
```

### JavaScript/Fetch

**Get Sessions**:
```javascript
const response = await fetch('http://localhost:3001/sessions');
const sessions = await response.json();
console.log(sessions);
```

**Save Calibration**:
```javascript
const response = await fetch('http://localhost:3001/calibrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ offset: 1000, scale: 0.001 })
});
const calibration = await response.json();
console.log(calibration);
```

### Python

```python
import requests

# Get sessions
response = requests.get('http://localhost:3001/sessions')
sessions = response.json()

# Save calibration
response = requests.post(
  'http://localhost:3001/calibrate',
  json={'offset': 1000, 'scale': 0.001}
)
calibration = response.json()

# Start simulation
response = requests.post(
  'http://localhost:3001/simulate/start',
  json={'session_id': 1}
)
```

---

## Testing

### WebSocket Test Script

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected');
  
  // Send test measurement
  ws.send(JSON.stringify({
    type: 'measurement',
    timestamp: Date.now(),
    raw: 2500
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('Error:', error);
};
```

### Integration Test

```bash
# 1. Start session
curl -X POST http://localhost:3001/session/start

# 2. Verify session created
curl http://localhost:3001/sessions

# 3. Save calibration
curl -X POST http://localhost:3001/calibrate \
  -H "Content-Type: application/json" \
  -d '{"offset": 1000, "scale": 0.001}'

# 4. Start simulation
curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1}'

# 5. Stop simulation
curl -X POST http://localhost:3001/simulate/stop

# 6. Stop session
curl -X POST http://localhost:3001/session/stop
```

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- WebSocket measurement streaming
- Session management
- Calibration endpoints
- Simulation mode

---

For issues or questions, check the main README or contact support.
