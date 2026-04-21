# Quick Start Commands

## One-Line Setup (assumes PostgreSQL running locally)

```bash
# Backend
cd backend && npm install && cp .env.example .env && npm run dev

# Frontend (new terminal)
cd frontend && npm install && cp .env.example .env && npm run dev

# Frontend available at http://localhost:3000
```

## Docker Setup (requires Docker)

```bash
# Start PostgreSQL
docker run --name hangboard-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hangboard \
  -p 5432:5432 \
  postgres:15

# Initialize database
docker exec hangboard-db psql -U postgres -d hangboard -f /path/to/001_init.sql
docker exec hangboard-db psql -U postgres -d hangboard -f /path/to/002_seed_data.sql

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hangboard
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Useful Commands

### Backend
```bash
cd backend
npm run dev      # Start with auto-reload
npm start        # Start production
npm test         # Run tests (if configured)
```

### Frontend
```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Check code quality
```

### Firmware
```bash
cd firmware
pio run           # Build
pio run -t upload # Upload to board
pio device monitor # View serial output
pio project list  # List projects
```

### Database
```bash
# PostgreSQL
psql -U user -d hangboard

# Show tables
\dt

# Show sample data
SELECT * FROM sessions;
SELECT * FROM samples LIMIT 10;
SELECT * FROM calibration;

# Backup
pg_dump hangboard > backup.sql

# Restore
psql hangboard < backup.sql
```

### Infrastructure
```bash
cd infra
terraform init      # Initialize
terraform plan      # Preview changes
terraform apply     # Apply changes
terraform destroy   # Destroy resources
terraform output    # Show outputs
```

## Testing Endpoints

```bash
# API health
curl http://localhost:3001/health

# Get calibration
curl http://localhost:3001/calibration

# Start session
curl -X POST http://localhost:3001/session/start

# Get sessions
curl http://localhost:3001/sessions

# WebSocket test
wscat -c ws://localhost:3001
```

## Development Tips

1. **Hot Reload**: Frontend auto-reloads on file changes
2. **API Testing**: Use Postman or Insomnia for REST calls
3. **Database**: Use DBeaver or pgAdmin for GUI management
4. **WebSocket**: Use wscat for command-line testing
5. **Logs**: Check browser console (F12) for frontend issues

## Troubleshooting

**Can't connect to database**:
```bash
psql -U postgres -h localhost
# If fails, ensure PostgreSQL is running
```

**Port already in use**:
```bash
# Find process
lsof -i :3001
# Kill process
kill -9 <PID>
```

**WebSocket errors**:
```bash
# Check backend logs
npm run dev
# Look for "WebSocket connected" messages
```

**Frontend not connecting**:
```bash
# Check browser console
# Verify VITE_WS_URL environment variable
# Check backend firewall/CORS settings
```

## Documentation

- [README.md](README.md) - Project overview
- [SETUP.md](SETUP.md) - Detailed setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [API.md](API.md) - API reference
