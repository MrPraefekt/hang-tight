# Production Deployment Guide

Complete guide for deploying the Hangboard system to production.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│          Internet Users                 │
└────────────┬──────────────────┬─────────┘
             │                  │
       HTTPS │                  │ HTTPS
             ▼                  ▼
        ┌────────────┐    ┌──────────────┐
        │   Vercel   │    │   Railway    │
        │ (Frontend) │    │  (Backend)   │
        └────────────┘    └──────────────┘
             │                  │
             │  WebSocket       │
             │  Connection      │
             └────────┬─────────┘
                      │
                      │ SSL/TLS
                      ▼
              ┌────────────────┐
              │   Supabase     │
              │   PostgreSQL   │
              └────────────────┘
```

## Prerequisites

- GitHub account
- Railway account (railway.app)
- Vercel account (vercel.com)
- Supabase account (supabase.com)
- Terraform installed locally
- Domain name (optional, uses *.vercel.app by default)

## Phase 1: Infrastructure Setup (Terraform)

### 1. Supabase Project

```bash
# Navigate to infrastructure directory
cd infra

# Copy example variables
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
supabase_access_token = "your-supabase-token"
organization_id       = "your-org-id"
db_password          = "secure_password_min_16_chars"
project_name         = "hangboard"
environment          = "prod"
region               = "us-east-1"
enable_replication   = true
```

Get tokens from [Supabase Dashboard](https://app.supabase.com):
1. Settings → API
2. Copy `service_role` key for access token
3. Settings → Organization → Copy org ID

### 2. Initialize Terraform

```bash
terraform init

# Review planned changes
terraform plan

# Apply infrastructure
terraform apply
```

Save the output values:
- `database_url`
- `backend_api_key`
- `frontend_api_key`

### 3. Initialize Database

```bash
# Get DATABASE_URL from terraform output
export DATABASE_URL="postgresql://..."

# Run migrations
psql "$DATABASE_URL" -f migrations/001_init.sql
psql "$DATABASE_URL" -f migrations/002_seed_data.sql

# Verify schema
psql "$DATABASE_URL" -c "\dt"
```

## Phase 2: Backend Deployment (Railway)

### 1. Prepare Repository

```bash
cd backend

# Create .railwayignore (optional)
cat > .railwayignore << EOF
.git
.env.local
.env.*.local
node_modules
dist
build
EOF
```

### 2. Connect to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new service
railway init

# Link to repository
railway link
```

### 3. Configure Environment Variables

In Railway Dashboard:

1. Go to your project → Backend service
2. Variables → New Variable
3. Add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | From Terraform output |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://your-frontend.vercel.app` |

### 4. Deploy

```bash
# Push to trigger deploy
git push origin main

# Or deploy manually
railway deploy
```

Get backend URL from Railway Dashboard (e.g., `https://backend-prod.railway.app`)

### 5. Verify Backend

```bash
# Health check
curl https://your-backend.railway.app/health

# Get API info
curl https://your-backend.railway.app/
```

## Phase 3: Frontend Deployment (Vercel)

### 1. Prepare Repository

```bash
cd frontend

# Create .vercelignore
cat > .vercelignore << EOF
.git
.env.local
.env.*.local
node_modules
.next
dist
build
EOF
```

### 2. Connect to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Follow prompts:
- Link to GitHub repo
- Select `frontend` as root directory
- Confirm project settings

### 3. Configure Environment Variables

In Vercel Dashboard:

1. Go to Settings → Environment Variables
2. Add new variables:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-backend.railway.app` |
| `VITE_WS_URL` | `ws://your-backend.railway.app` |

### 4. Deploy Production Build

```bash
# Trigger production deploy
vercel --prod
```

Get frontend URL from Vercel Dashboard (e.g., `https://hangboard.vercel.app`)

### 5. Verify Frontend

Open `https://hangboard.vercel.app` and verify:
- Backend connection status
- Simulation works with test data
- UI is responsive

## Phase 4: Hardware Deployment (ESP32)

### 1. Update Firmware Configuration

Edit `firmware/platformio.ini`:

```ini
build_flags =
    -D WIFI_SSID="YourSSID"
    -D WIFI_PASSWORD="YourPassword"
    -D WS_SERVER="your-backend.railway.app"
    -D WS_PORT=80
    -D CORE_DEBUG_LEVEL=1
```

### 2. Build and Upload

```bash
cd firmware
pio run -t upload -e esp32
```

### 3. Monitor Connection

```bash
pio device monitor -p COM3 -b 115200
```

Expected output:
```
WiFi connected. IP: 192.168.1.100
WebSocket connected
TX: {"timestamp": 1234567890, "raw": 2500}
```

## Phase 5: Testing & Validation

### 1. Full System Test

1. **Open Frontend**: https://hangboard.vercel.app
2. **Check Connection**: Status should show "Connected"
3. **Start Session**: Backend should create session
4. **Verify Data**: Check browser console for measurements
5. **Stop Session**: Session should end properly

### 2. Database Verification

```bash
# Check sessions exist
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM sessions;"

# View recent measurements
psql "$DATABASE_URL" -c "SELECT * FROM samples ORDER BY created_at DESC LIMIT 10;"

# Check calibration
psql "$DATABASE_URL" -c "SELECT * FROM calibration LIMIT 1;"
```

### 3. Performance Testing

```bash
# Backend response time
time curl https://your-backend.railway.app/sessions

# WebSocket latency (use wscat)
wscat -c wss://your-backend.railway.app
```

### 4. Load Testing (Optional)

```bash
# Install Artillery
npm install -g artillery

# Create load-test.yml
cat > load-test.yml << EOF
config:
  target: "https://your-backend.railway.app"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Load Test"
    flow:
      - get:
          url: "/sessions"
      - get:
          url: "/calibration"
EOF

artillery run load-test.yml
```

## Phase 6: Monitoring & Maintenance

### 1. Set Up Logging

**Railway Backend Logs**:
```bash
railway logs
```

**Monitor WebSocket Errors**:
```bash
# In backend server.js, check for connection errors
# Errors are logged to stdout/Railway dashboard
```

### 2. Database Backups

**Automatic Backups** (Supabase):
- Daily backups enabled by default
- 7-day retention for free tier
- Access from: Dashboard → Backups

**Manual Backup**:
```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql
```

### 3. Monitoring Alerts

Set up alerts in:
- **Railway**: Metrics → Add Alert
- **Vercel**: Settings → Analytics
- **Supabase**: Settings → Alerts

Alert on:
- Backend CPU > 80%
- Database connections > 10
- Error rate > 5%

### 4. Regular Maintenance

**Weekly**:
- Check error logs
- Verify database size
- Review session statistics

**Monthly**:
- Update dependencies
- Review security updates
- Backup database locally

**Quarterly**:
- Full system test
- Performance profiling
- Security audit

## Scaling Considerations

### Increasing Capacity

**Backend (Railway)**:
- Upgrade plan for more CPU/RAM
- Auto-scaling configuration
- Load balancing setup

**Database (Supabase)**:
- Upgrade tier for more connections
- Enable read replicas
- Archive old sessions

**Frontend (Vercel)**:
- Edge caching configuration
- CDN optimization
- Analytics monitoring

### Cost Optimization

- **Railway**: $5/month for small workloads
- **Vercel**: Free tier covers most use cases
- **Supabase**: ~$25/month production tier

Monthly estimate: $30-40

## Troubleshooting Production

### Backend Issues

**Container Won't Start**:
```bash
railway logs
# Check for missing environment variables
```

**High Memory Usage**:
```bash
# Check for WebSocket memory leak
# Verify database connection pooling
```

### Frontend Issues

**Build Failures**:
```bash
# Check vercel logs
vercel logs --prod
```

**Slow Performance**:
- Check DevTools Network tab
- Verify API response times
- Check WebSocket latency

### Database Issues

**Connection Timeout**:
```bash
# Check Supabase connection limits
# Verify firewall rules
psql -h host -U user -d db -c "SELECT 1;"
```

**Slow Queries**:
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM samples WHERE session_id = 1;

-- Add indexes if needed
CREATE INDEX idx_samples_session_id_timestamp 
ON samples(session_id, timestamp);
```

## Rollback Procedure

### Backend Rollback (Railway)

1. Railway Dashboard → Deploys
2. Select previous working deployment
3. Click "Redeploy"

### Frontend Rollback (Vercel)

1. Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "Promote to Production"

### Database Rollback

```bash
# Restore from backup
psql "$DATABASE_URL" -f backup-2024-01-10.sql
```

## Security Hardening

### HTTPS/WSS Only
✅ Vercel: Automatic HTTPS
✅ Railway: Automatic HTTPS
✅ Supabase: Automatic SSL

### Database Security
```sql
-- Revoke public access
REVOKE ALL ON DATABASE hangboard FROM PUBLIC;

-- Create read-only role for frontend
CREATE ROLE hangboard_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO hangboard_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO hangboard_readonly;
```

### API Rate Limiting
```javascript
// In backend server.js - add rate limiter
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
```

### Environment Variables
- ✅ Never commit `.env` files
- ✅ Use platform-specific secret management
- ✅ Rotate API keys quarterly
- ✅ Enable 2FA for all services

## Post-Deployment Checklist

- [ ] Frontend loads without errors
- [ ] Backend health check passes
- [ ] WebSocket connection works
- [ ] Database contains sample data
- [ ] Calibration can be saved/loaded
- [ ] Sessions can be created/stopped
- [ ] Simulation mode works
- [ ] Historical data displays
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Backups configured
- [ ] Monitoring alerts set
- [ ] Security review complete

## Support & Documentation

- [Railway Docs](https://docs.railway.app/)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Terraform Docs](https://www.terraform.io/docs)

## Next Steps

1. **Monitor for 24 hours**: Check logs and metrics
2. **User Testing**: Get feedback on interface
3. **Optimize Performance**: Based on monitoring data
4. **Plan Scaling**: As user base grows

---

**Deployment Complete!** 🚀
