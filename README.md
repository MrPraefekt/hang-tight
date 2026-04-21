# Hangboard Force Measurement System

A complete full-stack system for real-time grip strength monitoring using HX711 load cells, WebSocket communication, and cloud infrastructure.

## 🎯 Overview

This project provides an end-to-end solution for measuring and analyzing force data from hangboard training:

- **ESP32 Firmware**: Reads HX711 load cell at 80 Hz with 20 Hz output
- **Node.js Backend**: WebSocket server with calibration and session management
- **React Frontend**: Real-time visualization and control interface
- **PostgreSQL Database**: Stores sessions, measurements, and calibration data
- **Terraform IaC**: Automated infrastructure provisioning on Supabase

### Key Features

✅ Real-time force measurement and visualization
✅ Automatic calibration workflow
✅ Session recording and historical analysis
✅ Simulation mode for frontend testing without hardware
✅ WebSocket-based live data streaming
✅ Production-ready with free-tier deployment targets
✅ Modular architecture for easy extension

---

## 📁 Project Structure

```
hangboard-project/
├── firmware/                 # ESP32 Arduino code
│   ├── main.cpp             # HX711 reader and WebSocket client
│   └── platformio.ini        # Build configuration
│
├── backend/                 # Node.js WebSocket server
│   ├── server.js            # Main application
│   ├── package.json         # Dependencies
│   ├── .env.example         # Environment template
│   ├── railway.json         # Railway deployment config
│   └── vercel.json          # Vercel deployment config
│
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx          # Main component
│   │   ├── index.css        # Global styles
│   │   └── components/      # UI components
│   ├── package.json         # Dependencies
│   ├── vite.config.js       # Vite configuration
│   ├── .env.example         # Environment template
│   ├── vercel.json          # Vercel deployment config
│   └── index.html           # Entry HTML
│
├── infra/                   # Terraform infrastructure
│   ├── providers.tf         # Provider configuration
│   ├── variables.tf         # Input variables
│   ├── supabase.tf          # Supabase resources
│   ├── outputs.tf           # Output values
│   ├── terraform.tfvars.example
│   └── migrations/
│       ├── 001_init.sql     # Schema initialization
│       └── 002_seed_data.sql # Sample training data
│
└── README.md               # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **ESP32 Dev Board** (for hardware testing)
- **HX711 Load Cell Module**
- **Node.js 18+**
- **PostgreSQL** (or Supabase account)
- **Terraform** (for infrastructure)
- **Git**

### Local Development Setup

#### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database URL
npm run dev
# Server runs on http://localhost:3001
```

#### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# Frontend runs on http://localhost:3000
```

Access the frontend at http://localhost:3000

#### 3. ESP32 Firmware Setup

```bash
cd firmware
# Install PlatformIO CLI
pip install platformio

# Edit platformio.ini with:
# - WiFi SSID/Password
# - Backend WebSocket URL

# Build and upload
pio run -t upload -e esp32
```

### Testing Without Hardware

The system includes a **simulation mode** that replays pre-recorded training data:

1. Start backend and frontend
2. Click "Test Mode - Simulation" panel
3. Select a historical session
4. Click "Start Simulation"
5. Watch simulated data in real-time

---

## 🔧 System Architecture

### Data Flow

```
┌─────────────┐
│   ESP32     │ (80 Hz sampling, 20 Hz output)
│  + HX711    │
└──────┬──────┘
       │ WebSocket
       │ (raw data)
       ▼
┌──────────────────────┐
│   Backend Server     │
│   - Calibration      │
│   - Session Mgmt     │
│   - Broadcast        │
└──────┬───────────┬───┘
       │ WS to     │ HTTP
       │ Frontend  │ API
       ▼           ▼
    ┌─────────────────────┐
    │   Frontend React    │
    │   - Live display    │
    │   - Controls        │
    └────────┬────────────┘
             │
             ▼
        ┌─────────────┐
        │ PostgreSQL  │
        │ Database    │
        │ (Supabase)  │
        └─────────────┘
```

### Calibration Model

**Formula**: `force = (raw - offset) × scale`

- **offset**: Raw ADC value when unloaded
- **scale**: Conversion factor (N per raw unit)

Example:
- Unloaded ADC: 1000
- Loaded with 10N: 5000
- offset = 1000
- scale = 10 / (5000 - 1000) = 0.0025

---

## 📊 Calibration Workflow

### Step-by-Step Calibration

1. **Remove Load**
   - Ensure no weight on the sensor
   - Note the raw value displayed

2. **Enter Offset**
   - In Frontend → Calibration panel
   - Enter the unloaded raw value

3. **Add Known Weight**
   - Place calibrated weight (e.g., 10N) on sensor
   - Note the new raw value

4. **Calculate Scale**
   ```
   scale = known_weight / (loaded_raw - offset)
   scale = 10 / (new_raw - 1000)
   ```

5. **Save Calibration**
   - Enter offset and scale in Frontend
   - Click "Save Calibration"
   - Backend stores in PostgreSQL

### API Endpoints

**GET /calibration**
```json
{
  "id": 1,
  "offset": 1000,
  "scale": 0.0025,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**POST /calibrate**
```json
{
  "offset": 1000,
  "scale": 0.0025
}
```

---

## 🎮 Simulation Mode

### Purpose

Test the frontend UI and full data pipeline without hardware:

- Replays recorded training sessions
- Streams at 20 Hz like real hardware
- Perfect for:
  - Frontend development
  - Testing UI updates
  - Demo purposes
  - Debugging

### How It Works

1. **Get Session ID**
   ```bash
   curl http://localhost:3001/sessions
   ```

2. **Start Simulation**
   ```bash
   curl -X POST http://localhost:3001/simulate/start \
     -H "Content-Type: application/json" \
     -d '{"session_id": 1}'
   ```

3. **View in Frontend**
   - Real-time graph updates
   - Force data indistinguishable from live hardware

4. **Stop Simulation**
   ```bash
   curl -X POST http://localhost:3001/simulate/stop
   ```

### API Endpoints

**POST /simulate/start**
```json
{
  "session_id": 1
}
```

**POST /simulate/stop**
```json
{
  "success": true
}
```

---

## 🗄️ Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Samples Table
```sql
CREATE TABLE samples (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id),
  timestamp BIGINT,              -- Unix milliseconds
  raw INTEGER,                   -- Raw ADC value
  force NUMERIC(10, 4),          -- Calibrated force in Newtons
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Calibration Table
```sql
CREATE TABLE calibration (
  id SERIAL PRIMARY KEY,
  offset NUMERIC(10, 4),         -- Unloaded raw value
  scale NUMERIC(10, 4),          -- Force per raw unit
  created_at TIMESTAMP WITH TIME ZONE
);
```

---

## 🌐 REST API Reference

### Health Check
**GET /health**
```json
{ "status": "ok" }
```

### Sessions

**POST /session/start** - Start recording
```json
{
  "id": 1,
  "start_time": "2024-01-15T10:30:00Z"
}
```

**POST /session/stop** - End recording
```json
{
  "id": 1,
  "start_time": "2024-01-15T10:30:00Z",
  "end_time": "2024-01-15T10:32:00Z"
}
```

**GET /sessions** - List all sessions
```json
[
  {
    "id": 1,
    "start_time": "2024-01-15T10:30:00Z",
    "end_time": "2024-01-15T10:32:00Z"
  }
]
```

**GET /sessions/:id** - Get session with samples
```json
{
  "id": 1,
  "start_time": "2024-01-15T10:30:00Z",
  "end_time": "2024-01-15T10:32:00Z",
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

### Calibration

**GET /calibration** - Get current calibration
**POST /calibrate** - Save new calibration

---

## 🚢 Deployment

### Infrastructure Setup (Terraform)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your Supabase credentials

terraform init
terraform plan
terraform apply
```

This creates:
- Supabase PostgreSQL project
- Database with schema
- API keys for backend/frontend
- Storage bucket for backups

### Backend Deployment (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Set environment variables
railway variables set DATABASE_URL=<from-terraform>

# Deploy
git push
```

**Backend URL**: `https://hangboard-backend.railway.app`

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

cd frontend

# Configure environment
vercel env add VITE_API_URL
vercel env add VITE_WS_URL

# Deploy
vercel
```

**Frontend URL**: `https://hangboard.vercel.app`

### Environment Variables

**Backend (.env)**
```
DATABASE_URL=postgresql://...
PORT=3001
NODE_ENV=production
```

**Frontend (.env)**
```
VITE_API_URL=https://hangboard-backend.railway.app
VITE_WS_URL=ws://hangboard-backend.railway.app
VITE_ENV=production
```

**ESP32 (platformio.ini)**
```ini
build_flags =
    -D WIFI_SSID="YourSSID"
    -D WIFI_PASSWORD="YourPassword"
    -D WS_SERVER="hangboard-backend.railway.app"
    -D WS_PORT=80
```

---

## 📈 Performance Specifications

### ESP32 Firmware
- **Sampling Rate**: 80 Hz
- **Output Rate**: 20 Hz
- **Moving Average Window**: 4 samples
- **Timing Precision**: ±1ms
- **Memory Usage**: ~100KB Flash, ~20KB SRAM

### Backend
- **Max Clients**: Limited by server resources
- **Broadcast Latency**: <100ms
- **Database Queries**: Indexed for O(log n) lookup

### Frontend
- **Update Frequency**: 20 Hz
- **Live Graph Buffer**: 200 samples (~10 seconds)
- **Responsive**: Adapts to mobile/desktop

---

## 🔌 Hardware Wiring

### ESP32 to HX711

| ESP32 Pin | HX711 Pin |
|-----------|-----------|
| GPIO 25   | DT (Data) |
| GPIO 26   | SCK (Clock) |
| 3.3V      | VCC       |
| GND       | GND       |

### HX711 to Load Cell

Connect load cell to HX711 according to strain gauge color code:
- Red: E+
- Black: E-
- Green: A+
- White: A-

---

## 🐛 Troubleshooting

### ESP32 Not Connecting
- Check WiFi credentials in platformio.ini
- Verify backend URL is accessible
- Monitor serial output: `pio device monitor -p COM3`

### Backend Not Receiving Data
- Verify ESP32 is connected (check WebSocket logs)
- Test with: `wscat -c ws://localhost:3001`
- Check database connection string

### Frontend Shows "Disconnected"
- Verify backend is running
- Check browser console for CORS errors
- Verify VITE_WS_URL environment variable

### No Calibration Data
- Query database: `SELECT * FROM calibration;`
- Ensure migration 001_init.sql ran successfully
- Try POST /calibrate with test values

### Simulation Not Playing
- Verify session_id exists: `GET /sessions`
- Check that session has samples
- Verify backend simulation endpoint is accessible

---

## 🔒 Security Considerations

### Production Checklist

- [ ] Change default PostgreSQL password
- [ ] Enable HTTPS/WSS for all communications
- [ ] Set up CORS properly in backend
- [ ] Use environment variables for secrets
- [ ] Enable database encryption at rest
- [ ] Set up automated backups
- [ ] Add rate limiting to API
- [ ] Implement authentication for admin endpoints
- [ ] Monitor backend logs for anomalies
- [ ] Regular security updates for dependencies

---

## 📚 Technical Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Firmware | Arduino/C++ | ESP32 development |
| Backend | Node.js/Express | WebSocket server |
| Frontend | React/Vite | UI and visualization |
| Database | PostgreSQL | Data persistence |
| Infrastructure | Terraform | IaC |
| Deployment | Railway/Vercel | Cloud hosting |

---

## 🤝 Contributing

To extend this project:

1. **Add New Sensors**: Modify ESP32 firmware to read additional ADCs
2. **Custom Calibration**: Implement multi-point calibration in backend
3. **Analytics**: Add historical trend analysis
4. **Mobile App**: Convert frontend to React Native
5. **Cloud Storage**: Integrate S3 for session exports

---

## 📝 License

MIT License - See LICENSE file

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review API documentation
3. Check database logs for errors
4. Monitor backend console output

---

## 🎓 Learning Resources

- [HX711 Documentation](https://cdn.shopify.com/s/files/1/0176/3274/files/hx711_english.pdf)
- [WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [React Hooks Guide](https://react.dev/reference/react)
- [Terraform Docs](https://www.terraform.io/docs)

---

## Version History

- **v1.0.0** (2024-01-15): Initial release
  - Core firmware, backend, frontend
  - Database schema with migrations
  - Terraform infrastructure
  - Full simulation mode

---

**Built with ❤️ for climbers and engineers**
