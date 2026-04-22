# System Architecture

Technical architecture for the Hangboard Force Measurement System.

## High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                    Local Network                     │
│                                                      │
│  ┌────────────┐    WebSocket    ┌────────────────┐  │
│  │  ESP32     │───────────────►│  Backend        │  │
│  │  + HX711   │  (raw samples) │  Node.js        │  │
│  └────────────┘                │  Express        │  │
│                                │  better-sqlite3 │  │
│  ┌────────────┐   WS + REST   │                  │  │
│  │  Browser   │◄──────────────►│  SQLite DB      │  │
│  │  (React)   │               │  (WAL mode)     │  │
│  └────────────┘                └────────────────┘  │
│                                                      │
│  Runs on Raspberry Pi (or any Linux/macOS/Windows)   │
└─────────────────────────────────────────────────────┘
```

## Component Details

### 1. ESP32 Firmware

**Technology**: Arduino C++ (PlatformIO)

- Reads HX711 load cell at **80 Hz**
- Applies 4-sample moving average filter
- Outputs at **20 Hz** via WebSocket
- Auto-reconnects WiFi and WebSocket

**Data format sent**:

```json
{ "timestamp": 1705315200000, "raw": 2500 }
```

### 2. Backend Server

**Technology**: Node.js 18+, Express, better-sqlite3

```
HTTP/WS Request Handler
├── REST API
│   ├── GET  /calibration
│   ├── POST /calibrate
│   ├── POST /session/start
│   ├── POST /session/stop
│   ├── GET  /sessions
│   ├── GET  /sessions/:id
│   ├── POST /simulate/start
│   └── POST /simulate/stop
│
└── WebSocket Server
    ├── ESP32 Input Handler
    ├── Calibration Applicator
    └── Client Broadcaster
```

**Database**: SQLite via `better-sqlite3`, WAL mode, foreign keys enabled. All queries use prepared statements. Batch inserts for high-throughput sample writing.

The backend also serves the built frontend from `backend/public/` in production.

### 3. Frontend

**Technology**: React 18, Vite, Recharts

```
App.jsx
├── LiveMonitor         — real-time force graph (Recharts)
├── SessionManager      — start/stop recording
├── CalibrationPanel    — offset + scale controls
├── SimulationPanel     — replay historical sessions
└── HistoricalData      — browse past sessions
```

Connects to backend via WebSocket for live data and REST for CRUD.

### 4. SQLite Database

**Schema**:

```sql
sessions    (id INTEGER PK, start_time TEXT, end_time TEXT, created_at, updated_at)
samples     (id INTEGER PK, session_id FK, timestamp INTEGER, raw INTEGER, force REAL, created_at)
calibration (id INTEGER PK, offset REAL, scale REAL, created_at, updated_at)
```

**Indexes**: `samples(session_id)`, `samples(timestamp)`, `sessions(start_time)`, `calibration(created_at)`

---

## Data Flow

### Real-Time Measurement

```
ESP32 ──WS──► Backend ──► Apply calibration (force = (raw-offset)*scale)
                       ├──► Save to SQLite (if session active)
                       └──► Broadcast to all WS clients
                                    │
                                    ▼
                              Frontend updates graph
```

### Session Recording

```
User clicks Start  →  POST /session/start  →  INSERT session
  (measurements stream & get saved as samples)
User clicks Stop   →  POST /session/stop   →  UPDATE session.end_time
```

### Simulation

```
POST /simulate/start {session_id: 1}
  → SELECT samples for session
  → setInterval: broadcast one sample every 50ms (20 Hz)
  → samples marked with simulated: true
POST /simulate/stop
  → clearInterval
```

---

## Performance

| Metric                   | Value       |
| ------------------------ | ----------- |
| ESP32 sampling rate      | 80 Hz       |
| ESP32 output rate        | 20 Hz       |
| Frontend update rate     | 20 Hz       |
| Sensor-to-UI latency     | ~150–300 ms |
| Sample record size       | ~200 bytes  |
| 1 hour of data           | ~2.9 MB     |
| 1 year of daily training | ~1 GB       |

### SQLite Performance

- WAL mode for concurrent reads during writes
- Prepared statements for all queries
- Indexed lookups: O(log n)
- Batch inserts for sample data

---

## Deployment Architecture

```
Development Machine                 Raspberry Pi
┌──────────────┐     rsync         ┌──────────────────────┐
│ make build   │ ──────────────►  │ /opt/hang-tight/     │
│ make deploy  │                   │  ├── server.js       │
└──────────────┘                   │  ├── public/  (React)│
                                   │  ├── data/   (SQLite)│
                                   │  └── node_modules/   │
                                   │                      │
                                   │  systemd: hangboard  │
                                   │  Port 3001           │
                                   └──────────────────────┘
```

The backend serves both the API and the built frontend as static files.

---

## Security Considerations

- No authentication (single-user local device)
- CORS configured for local development
- SQL injection prevented via prepared statements
- Input validation on calibration values
- No secrets needed — database is local

---

## Technology Justification

| Technology       | Reason                                                 |
| ---------------- | ------------------------------------------------------ |
| ESP32            | Low cost, built-in WiFi, Arduino SDK                   |
| Node.js          | Native WebSocket + JSON support                        |
| better-sqlite3   | Zero-config, single file, fast synchronous API         |
| React + Vite     | Fast dev experience, component model                   |
| Recharts         | Simple charting for React                              |
| SQLite           | No server process, embedded, perfect for single-device |
| Makefile + rsync | Simple, reliable deployment without CI overhead        |
