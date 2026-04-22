# API Reference

## Base URL

`http://localhost:3001`

In production (Raspberry Pi): `http://<pi-ip>:3001`

---

## WebSocket

### Connection

```javascript
const ws = new WebSocket("ws://localhost:3001");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### Message Types

**Measurement** (ESP32 → Backend → Clients):

```json
{
  "type": "measurement",
  "timestamp": 1705315200000,
  "raw": 2500,
  "force": 3.75,
  "simulated": false
}
```

**Connection Confirmation**:

```json
{ "type": "connected", "message": "Connected to Hangboard backend" }
```

**Calibration Updated**:

```json
{ "type": "calibration_updated", "offset": 1000, "scale": 0.001 }
```

**Session Started / Stopped**:

```json
{ "type": "session_started", "session_id": 42 }
{ "type": "session_stopped", "session_id": 42 }
```

**Simulation Started / Stopped**:

```json
{ "type": "simulation_started", "session_id": 1 }
{ "type": "simulation_stopped" }
```

---

## REST Endpoints

### Health Check

`GET /health` → `{ "status": "ok" }`

---

### Calibration

**Get current calibration**

`GET /calibration`

```json
{
  "id": 1,
  "offset": 1000,
  "scale": 0.001,
  "created_at": "2024-01-15T10:30:00Z"
}
```

Returns `{ "offset": 0, "scale": 1 }` if no calibration exists.

**Save new calibration**

`POST /calibrate`

```json
// Request
{ "offset": 1000, "scale": 0.001 }

// Response
{ "id": 2, "offset": 1000, "scale": 0.001, "created_at": "2024-01-15T11:00:00Z" }
```

---

### Sessions

**Start recording**

`POST /session/start` → returns new session object

**Stop recording**

`POST /session/stop` → returns updated session with `end_time`

**List all sessions**

`GET /sessions`

```json
[
  { "id": 1, "start_time": "...", "end_time": "...", "created_at": "..." },
  { "id": 2, "start_time": "...", "end_time": "...", "created_at": "..." }
]
```

**Get session with samples**

`GET /sessions/:id`

```json
{
  "id": 1,
  "start_time": "...",
  "end_time": "...",
  "samples": [
    {
      "id": 1,
      "session_id": 1,
      "timestamp": 1234567890,
      "raw": 2500,
      "force": 3.75
    }
  ]
}
```

---

### Simulation

**Start simulation**

`POST /simulate/start`

```json
// Request
{ "session_id": 1 }

// Response
{ "success": true, "samples": 125 }
```

Replays samples at 20 Hz via WebSocket. Loops after last sample.

**Stop simulation**

`POST /simulate/stop` → `{ "success": true }`

---

## Error Handling

All errors return:

```json
{ "error": "Error description" }
```

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 400  | Bad request (missing/invalid params) |
| 404  | Not found                            |
| 500  | Server error                         |

---

## Examples

### cURL

```bash
# Start session
curl -X POST http://localhost:3001/session/start

# Save calibration
curl -X POST http://localhost:3001/calibrate \
  -H "Content-Type: application/json" \
  -d '{"offset": 1000, "scale": 0.001}'

# Start simulation
curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1}'
```

### JavaScript

```javascript
const res = await fetch("http://localhost:3001/sessions");
const sessions = await res.json();
```

### Python

```python
import requests
sessions = requests.get('http://localhost:3001/sessions').json()
```
