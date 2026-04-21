# System Architecture

Complete technical architecture documentation for the Hangboard Force Measurement System.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS / DEVICES                       │
└────────┬──────────────────────────────────────────┬──────────┘
         │                                          │
         │ HTTP/HTTPS                               │ WiFi
         │                                          │
    ┌────▼─────────┐                            ┌───▼────────┐
    │   Frontend    │                            │   ESP32    │
    │  (Vercel)     │◄───────WebSocket──────────►│  + HX711   │
    │  React/Vite   │       ws/wss              │            │
    └────┬─────────┘                            └───┬────────┘
         │                                          │
         │ REST API                                 │
         │ (JSON)                                   │
         └─────────────────┬──────────────────────┘
                           │
                    ┌──────▼──────────┐
                    │   Backend       │
                    │  (Railway)      │
                    │  Node.js        │
                    │  - WebSocket    │
                    │  - Calibration  │
                    │  - Sessions     │
                    │  - Simulation   │
                    └────────┬────────┘
                             │
                             │ JDBC/SSL
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Supabase)    │
                    │  - Sessions     │
                    │  - Samples      │
                    │  - Calibration  │
                    └─────────────────┘
```

## Component Details

### 1. ESP32 Firmware

**Technology**: Arduino C++

**Responsibilities**:
- Read HX711 load cell at 80 Hz
- Apply moving average filter (4 samples)
- Output at 20 Hz
- WebSocket client to backend
- WiFi connectivity with auto-reconnect

**Key Timing**:
```
80 Hz sampling → Moving avg (4) → 20 Hz output → WebSocket → Backend
12.5ms          50ms             50ms
```

**Data Format**:
```json
{
  "timestamp": 1705315200000,
  "raw": 2500
}
```

### 2. Backend Server

**Technology**: Node.js 18+ with Express.js

**Architecture**:
```
HTTP Request Handler
├── REST API
│   ├── /calibration (GET/POST)
│   ├── /sessions/* (GET/POST)
│   └── /simulate/* (POST)
│
└── WebSocket Server
    ├── ESP32 Input Handler
    ├── Measurement Processor
    │   └── Calibration Applicator
    └── Client Broadcaster
```

**Key Components**:

| Component | Function |
|-----------|----------|
| Express App | REST API routing |
| WebSocketServer | WebSocket management |
| Database Pool | PostgreSQL connections |
| Measurement Handler | Data processing |
| Simulator | Session replay |

**Data Flow**:
```
ESP32 → WS Input
         ↓
    Process Measurement
         ├─ Load calibration
         ├─ Apply formula
         └─ Save to DB
         ↓
    Broadcast to Clients
         ↓
    Frontend + HTTP Responses
```

### 3. Frontend Application

**Technology**: React 18 + Vite + Recharts

**Component Structure**:
```
App.jsx (Main)
├── LiveMonitor
│   └── Recharts LineChart
├── SessionManager
│   ├── Start/Stop buttons
│   └── Status display
├── CalibrationPanel
│   ├── Offset input
│   ├── Scale input
│   └── Save button
├── SimulationPanel
│   ├── Session selector
│   ├── Start/Stop buttons
│   └── Status indicator
└── HistoricalData
    ├── Sessions table
    ├── Session viewer
    └── Analytics display
```

**State Management**:
- WebSocket connection state
- Current measurements
- Session status
- Calibration data
- Historical sessions

**WebSocket Integration**:
```javascript
┌──────────────────────────┐
│   WebSocket Handler      │
├──────────────────────────┤
│ onopen()                 │
│ onmessage()              │
│ onclose()                │
│ onerror()                │
└──────────────────────────┘
         ↓
    Message Router
    ├─ measurement → handleMeasurement()
    ├─ calibration_updated → setCalibration()
    ├─ session_started → setSessionActive()
    └─ session_stopped → setSessionActive()
         ↓
    State Update → Re-render
```

### 4. PostgreSQL Database

**Schema**:

```sql
-- Sessions: Training records
sessions
├── id (PK)
├── start_time
├── end_time
└── created_at

-- Samples: Individual measurements
samples
├── id (PK)
├── session_id (FK → sessions)
├── timestamp
├── raw
├── force
└── created_at

-- Calibration: Offset/scale values
calibration
├── id (PK)
├── offset
├── scale
└── created_at
```

**Performance Indexes**:
```sql
CREATE INDEX idx_samples_session_id ON samples(session_id);
CREATE INDEX idx_samples_timestamp ON samples(timestamp);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);
CREATE INDEX idx_calibration_created_at ON calibration(created_at);
```

**Typical Queries**:

| Query | Performance |
|-------|-------------|
| Get last calibration | O(log n) indexed |
| Get session with samples | O(m) where m=sample count |
| List sessions | O(n) where n=session count |
| Save sample | O(1) insert |

## Data Flow Sequence Diagrams

### Real-Time Measurement Flow

```
ESP32          Backend              Frontend           Database
  │                │                   │                  │
  ├─ Sample @ 80Hz │                   │                  │
  ├─ 4-sample avg  │                   │                  │
  ├─ 20 Hz output  │                   │                  │
  │                │                   │                  │
  │─ WebSocket ────→ Receive          │                  │
  │                │ │                 │                  │
  │                ├─┼─ Load calib. ──────────────────→ Query
  │                │ │                 │                  │
  │                │ │                 │← Calibration ────┤
  │                │ │                 │                  │
  │                ├─┼─ Apply formula  │                  │
  │                │ │                 │                  │
  │                ├─┼─ Save sample ─────────────────→ Insert
  │                │ │                 │                  │
  │                │ └─→ Broadcast ────→ Update UI        │
  │                │     to all clients                   │
  │                │                 │                  │
  │              (repeat every 50ms)  │                  │
```

### Session Recording Flow

```
User            Frontend              Backend           Database
  │                │                   │                  │
  ├─ Click Start ─→│                   │                  │
  │                ├─ POST /session/start
  │                │                  │ ─→ INSERT ────→│
  │                │◄─ Session ID ────┤                  │
  │                │                   │                  │
  │                ├─ WebSocket open ─→│ (data collected)
  │                │                   │
  │  (measurements stream in...)       │
  │                │                   ├─ Save samples ─→│
  │                │                   │                  │
  ├─ Click Stop ──→│                   │                  │
  │                ├─ POST /session/stop
  │                │                  │ ─→ UPDATE ────→│
  │                │◄─ end_time ──────┤                  │
  │                │                   │                  │
```

### Simulation Flow

```
User            Frontend              Backend           Database
  │                │                   │                  │
  ├─ Select session
  ├─ Click Simulate
  │                ├─ POST /simulate/start
  │                │                  │                  │
  │                │                  ├─ SELECT samples ─→│
  │                │                  │◄─ Samples ───────┤
  │                │                  │                  │
  │                │                  ├─ Set interval   │
  │                │                  ├─ Loop samples   │
  │                │                  ├─ Send @ 20Hz ──→│
  │                │◄─ Measurements ──┤ (simulated: true)
  │                │                   │                  │
  │                ├─ Update UI       │                  │
  │                └─ Draw Graph      │                  │
  │                │                  │                  │
  │ (after ~50ms per sample)          │                  │
  │                │                   ├─ Next sample   │
  │                │                   ├─ Repeat        │
  │                │                   │                  │
  ├─ Click Stop ──→│                   │                  │
  │                ├─ POST /simulate/stop
  │                │                  ├─ Clear interval │
  │                │◄─ Success ───────┤                  │
  │                │                   │                  │
```

## Performance Characteristics

### Throughput

| Component | Rate |
|-----------|------|
| ESP32 sampling | 80 Hz |
| ESP32 output | 20 Hz |
| Frontend updates | 20 Hz |
| Database inserts | Async, ~100/sec |
| WebSocket broadcasts | 20/sec per client |

### Latency

| Path | Latency |
|------|---------|
| Sensor → Frontend | ~150-300ms |
| Calibration update | ~50ms |
| Simulation start | ~100ms |

### Memory Usage

| Component | Memory |
|-----------|--------|
| ESP32 firmware | ~100 KB Flash, 20 KB SRAM |
| Backend Node.js | ~50-100 MB |
| Frontend React app | ~2-3 MB loaded |
| Database session | ~1 MB per 1000 samples |

### Storage

| Item | Size |
|------|------|
| Sample record | ~200 bytes |
| 1 hour of data | ~2.9 MB |
| 7-day training week | ~20 MB |
| 1 year of training | ~1 GB |

## Scalability

### Single Server Limits

**Backend (Railway small)**:
- ~100 concurrent WebSocket clients
- ~1000 samples/sec insert rate
- ~50 API requests/sec

**Database (Supabase free)**:
- ~10 concurrent connections
- Unlimited queries
- 500 MB storage

**Frontend (Vercel)**:
- Unlimited users
- Global CDN distribution

### Scaling Strategy

1. **Vertical**: Increase Railway/Supabase tier
2. **Horizontal**: Multiple backend instances with load balancer
3. **Database**: Read replicas for analytics
4. **Frontend**: Already global via Vercel CDN

## Security Architecture

### Authentication (Optional)

Current implementation: **No authentication** (add as needed)

Future consideration:
```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ Login credentials
       ▼
┌─────────────────┐
│ Auth Service    │ JWT/OAuth
└──────┬──────────┘
       │ Access token
       ├─→ Backend (validate)
       ├─→ WebSocket (validate)
       └─→ Frontend (store)
```

### Data Encryption

- ✅ HTTPS/WSS in transit
- ✅ SSL to PostgreSQL
- ✅ Passwords hashed (if added)
- ⏳ Encryption at rest (Supabase feature)

### API Security

- ✅ CORS configured
- ✅ Rate limiting (add if needed)
- ✅ Input validation on calibration
- ✅ SQL injection prevention (via Prepared statements)

## Disaster Recovery

### Backup Strategy

**Database**:
- Supabase: Daily automated backups
- Manual: Export SQL weekly

**Configuration**:
- Environment variables: Stored in platform secrets
- Terraform state: Local + git (ignore sensitive values)

### Recovery Procedures

**Database failure**:
1. Restore from latest backup
2. Verify data integrity
3. Restart backend

**Backend failure**:
1. Railway auto-restart
2. Or manual restart
3. Check WebSocket connections

**Frontend failure**:
1. Vercel auto-deploy
2. Or manual redeploy
3. Clear browser cache

## Monitoring & Observability

### Key Metrics

**Backend**:
```javascript
// Add to server.js
console.log(`WebSocket clients: ${clients.size}`);
console.log(`DB connections: ${db.query('SELECT count(*) FROM pg_stat_activity')}`);
```

**Frontend**:
```javascript
// Monitor WebSocket latency
const sendTime = Date.now();
ws.send(ping);
ws.onmessage = () => {
  console.log('Latency:', Date.now() - sendTime);
};
```

**Database**:
```sql
SELECT COUNT(*) as samples FROM samples;
SELECT COUNT(*) as sessions FROM sessions;
SELECT AVG(force) as avg_force FROM samples;
```

### Logging

- **Backend**: Console logs → Railway dashboard
- **Frontend**: Browser console + optional Sentry
- **Database**: PostgreSQL logs → Supabase dashboard

### Alerting

Set up on:
- Backend CPU > 80%
- Database connections > 8
- API response time > 500ms
- Error rate > 5%

## Testing Strategy

### Unit Tests

```javascript
// Backend: Calibration formula
const force = (raw - offset) * scale;
assert(force === 0.75, 'Calibration formula failed');

// Frontend: Component rendering
assert(mounted, 'Component failed to mount');
```

### Integration Tests

```bash
# Full flow: REST → WebSocket → Database
curl /session/start
# Check database for session
psql -c "SELECT * FROM sessions WHERE id=1"
```

### Load Tests

```bash
# 100 simulated clients
artillery run load-test.yml
```

## Deployment Diagram

```
GitHub Repo
    │
    ├─→ Vercel (Frontend)
    │   ├─ Build
    │   ├─ Test
    │   └─ Deploy to CDN
    │
    └─→ Railway (Backend)
        ├─ Build
        ├─ Test
        └─ Deploy to container
        
        Both → Supabase (Database)
                └─ PostgreSQL instance
```

## Technology Justification

| Technology | Why Chosen |
|------------|-----------|
| ESP32 | Low cost, WiFi built-in, Arduino SDK |
| Node.js | WebSocket support, JSON native |
| React | Component-based, large ecosystem |
| PostgreSQL | Reliable, free tier, excellent for time-series |
| Terraform | Infrastructure as code, repeatable |
| Railway/Vercel | Free tier, easy deploy, good performance |
| Supabase | Managed PostgreSQL, free tier, dashboard |

---

**Last Updated**: January 2024
**Architecture Version**: 1.0.0
