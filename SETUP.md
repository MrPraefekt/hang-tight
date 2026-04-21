# Development Setup Guide

Quick reference for local development setup.

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 12+ or Supabase account ([Supabase](https://supabase.com/))
- Git ([Download](https://git-scm.com/))
- PlatformIO (for ESP32): `pip install platformio`

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/hangboard
PORT=3001
NODE_ENV=development
```

### 3. Initialize Database

If using local PostgreSQL:
```bash
psql -U postgres -d hangboard -f ../infra/migrations/001_init.sql
psql -U postgres -d hangboard -f ../infra/migrations/002_seed_data.sql
```

If using Supabase:
1. Log in to Supabase Dashboard
2. Go to SQL Editor
3. Create new query
4. Paste contents of `infra/migrations/001_init.sql`
5. Run, then repeat with `002_seed_data.sql`

### 4. Run Backend
```bash
npm run dev
```

Server logs:
```
🚀 Hangboard Backend running on port 3001
   WebSocket: ws://localhost:3001
   API: http://localhost:3001
```

## Frontend Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_ENV=development
```

### 3. Run Frontend
```bash
npm run dev
```

Frontend available at: http://localhost:3000

## ESP32 Firmware Setup

### 1. Install PlatformIO
```bash
pip install platformio
# Or use VS Code extension
```

### 2. Configure WiFi & Backend
Edit `firmware/platformio.ini`:
```ini
build_flags =
    -D WIFI_SSID="YOUR_SSID"
    -D WIFI_PASSWORD="YOUR_PASSWORD"
    -D WS_SERVER="localhost"
    -D WS_PORT=80
```

For local testing on same network:
- Use your machine's IP instead of localhost
- Find IP: `ipconfig` (Windows) or `ifconfig` (Linux/Mac)

### 3. Build & Upload
```bash
cd firmware
pio run -t upload -e esp32
```

### 4. Monitor Serial Output
```bash
pio device monitor -p COM3 -b 115200
# Replace COM3 with your USB port
```

## Testing Without Hardware

The system includes complete simulation mode - perfect for UI development:

1. Ensure backend is running
2. Ensure frontend is running
3. Open http://localhost:3000
4. Click "Test Mode - Simulation" panel
5. Select a session and click "Start Simulation"
6. Observe simulated data streaming in real-time

## Database Management

### View Sessions
```bash
psql your_database -c "SELECT * FROM sessions;"
```

### View Samples from Session 1
```bash
psql your_database -c "SELECT * FROM samples WHERE session_id = 1 LIMIT 20;"
```

### View Calibration
```bash
psql your_database -c "SELECT * FROM calibration ORDER BY created_at DESC LIMIT 1;"
```

### Reset Database
```bash
psql your_database -c "DROP TABLE IF EXISTS samples CASCADE;"
psql your_database -c "DROP TABLE IF EXISTS calibration CASCADE;"
psql your_database -c "DROP TABLE IF EXISTS sessions CASCADE;"
psql your_database -f ../infra/migrations/001_init.sql
psql your_database -f ../infra/migrations/002_seed_data.sql
```

## Testing API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

### Get Sessions
```bash
curl http://localhost:3001/sessions
```

### Get Calibration
```bash
curl http://localhost:3001/calibration
```

### Save Calibration
```bash
curl -X POST http://localhost:3001/calibrate \
  -H "Content-Type: application/json" \
  -d '{"offset": 1000, "scale": 0.001}'
```

### Start Session
```bash
curl -X POST http://localhost:3001/session/start
```

### Stop Session
```bash
curl -X POST http://localhost:3001/session/stop
```

### Start Simulation (Session 1)
```bash
curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1}'
```

### Stop Simulation
```bash
curl -X POST http://localhost:3001/simulate/stop
```

## WebSocket Testing

### Using wscat
```bash
npm install -g wscat
wscat -c ws://localhost:3001
```

Then type:
```json
{"type": "measurement", "timestamp": 1234567890, "raw": 2500}
```

### Using Browser Console
```javascript
const ws = new WebSocket('ws://localhost:3001');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
ws.onopen = () => ws.send(JSON.stringify({type: 'test'}));
```

## Debugging Tips

### Backend Logs
Add debug prefix:
```bash
DEBUG=hangboard:* npm run dev
```

### Frontend Console
Open DevTools: F12 or Ctrl+Shift+I
- Check Console tab for errors
- Check Network tab for API calls
- Check WebSocket frames in DevTools

### ESP32 Serial Logs
```bash
pio device monitor -p COM3
```

Look for:
- WiFi connection status
- WebSocket connection status
- HX711 readings
- Sample output

## Common Issues

### Port Already in Use
```bash
# Find process on port 3001
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### WebSocket Connection Refused
- Verify backend is running
- Check firewall settings
- Try from same machine first

### Database Connection Error
- Verify DATABASE_URL format
- Check credentials
- Test with `psql` command directly

### Frontend Shows Disconnected
- Check browser console for errors
- Verify VITE_WS_URL is correct
- Try from incognito window (disable cache)

## Performance Profiling

### Backend
```bash
# Enable CPU profiling
node --prof server.js

# Process logs
node --prof-process isolate-*.log > profile.txt
```

### Frontend
Use Chrome DevTools Performance tab:
1. Open DevTools
2. Performance tab
3. Record session
4. Analyze timeline

## Database Performance

### Check Slow Queries
```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Create Additional Indexes
```sql
-- If queries are slow, add indexes
CREATE INDEX idx_samples_force ON samples(force);
CREATE INDEX idx_sessions_end_time ON sessions(end_time);
```

## Next Steps

1. **Complete Calibration**: Follow calibration workflow in main README
2. **Deploy Backend**: Use Railway deployment guide
3. **Deploy Frontend**: Use Vercel deployment guide
4. **Connect Hardware**: Upload firmware to ESP32
5. **Monitor Production**: Set up logging and alerts

---

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md)
