# Troubleshooting Guide

## Common Issues and Solutions

### Backend Issues

#### Port 3001 Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solutions**:

**Windows**:
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**macOS/Linux**:
```bash
# Find process
lsof -i :3001

# Kill process
kill -9 <PID>
```

**Or change port**:
```bash
# In backend/.env
PORT=3002
```

---

#### Cannot Connect to Database

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:

1. **Verify PostgreSQL is running**:
   ```bash
   # Windows
   tasklist | findstr postgres
   
   # macOS/Linux
   ps aux | grep postgres
   ```

2. **Verify DATABASE_URL format**:
   ```
   postgresql://user:password@localhost:5432/hangboard
   ```

3. **Test connection directly**:
   ```bash
   psql -U postgres -h localhost -d hangboard
   ```

4. **Check credentials**:
   - Username: Usually `postgres`
   - Password: Set during PostgreSQL installation
   - Database: `hangboard` (create if missing)

---

#### WebSocket Connection Refused

**Error**: WebSocket connection failed from frontend

**Solutions**:

1. **Verify backend is running**:
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok"}
   ```

2. **Check CORS settings** in `server.js`:
   ```javascript
   app.use(cors({
     origin: '*' // Allow all for development
   }));
   ```

3. **Verify firewall** allows port 3001

4. **Check browser console** (F12) for detailed errors

5. **Test WebSocket directly**:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:3001
   ```

---

#### Database Migrations Failed

**Error**: `psql: error: relation "sessions" does not exist`

**Solutions**:

1. **Check if migrations ran**:
   ```bash
   psql -U postgres -d hangboard -c "\dt"
   # Should list sessions, samples, calibration tables
   ```

2. **Run migrations manually**:
   ```bash
   psql -U postgres -d hangboard -f infra/migrations/001_init.sql
   psql -U postgres -d hangboard -f infra/migrations/002_seed_data.sql
   ```

3. **Reset and retry**:
   ```bash
   # Drop database
   psql -U postgres -c "DROP DATABASE hangboard;"
   
   # Create new database
   psql -U postgres -c "CREATE DATABASE hangboard;"
   
   # Run migrations
   psql -U postgres -d hangboard -f infra/migrations/001_init.sql
   psql -U postgres -d hangboard -f infra/migrations/002_seed_data.sql
   ```

---

#### Server Crashes on Startup

**Error**: Server exits immediately

**Solutions**:

1. **Check logs for errors**:
   ```bash
   npm run dev 2>&1 | head -50
   ```

2. **Verify all dependencies installed**:
   ```bash
   npm install
   npm list
   ```

3. **Check Node.js version**:
   ```bash
   node --version  # Should be 18+ required 16+
   ```

4. **Verify required environment variables**:
   ```bash
   echo $DATABASE_URL
   echo $PORT
   ```

---

### Frontend Issues

#### Frontend Cannot Connect to Backend

**Error**: Status shows "Disconnected" in UI

**Solutions**:

1. **Verify backend is running**:
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check VITE environment variables** (`frontend/.env`):
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_WS_URL=ws://localhost:3001
   ```

3. **Check browser console** (F12):
   - Look for CORS errors
   - Look for WebSocket connection errors
   - Check network tab for failed requests

4. **Try from different URL**:
   ```bash
   # If using 127.0.0.1 is failing, try IP address
   # Find IP: ipconfig (Windows) or ifconfig (macOS/Linux)
   # Use: http://192.168.1.100:3000
   ```

5. **Clear browser cache**:
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or use incognito window

---

#### npm install Fails

**Error**: `npm ERR! ...`

**Solutions**:

1. **Clear npm cache**:
   ```bash
   npm cache clean --force
   ```

2. **Delete node_modules and retry**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check Node version**:
   ```bash
   node --version  # 18+ required
   npm --version   # 9+ required
   ```

4. **Check disk space**:
   ```bash
   # Windows
   dir C:\
   
   # macOS/Linux
   df -h
   ```

---

#### Vite Build Fails

**Error**: Build command exits with error

**Solutions**:

1. **Check syntax errors**:
   ```bash
   npm run build 2>&1 | grep error
   ```

2. **Verify all imports exist**:
   - Check component paths in App.jsx
   - Verify all files created

3. **Clear build cache**:
   ```bash
   rm -rf dist
   npm run build
   ```

---

#### Graph Not Displaying

**Error**: Live graph shows empty area

**Solutions**:

1. **Verify WebSocket is connected**:
   - Check status indicator in header
   - Should show "Connected" in green

2. **Start a session**:
   - Click "Start Session" button
   - Wait for first measurement

3. **Check browser console** for Recharts errors:
   - F12 → Console tab
   - Look for any error messages

4. **Verify data structure**:
   ```javascript
   // In browser console
   console.log(measurements)  // Should show array of {force, index}
   ```

---

### Firmware Issues

#### ESP32 Not Uploading

**Error**: `Error: Failed to connect to ESP32`

**Solutions**:

1. **Check USB connection**:
   - Try different USB cable
   - Try different USB port
   - Verify device appears in device manager

2. **Install USB driver**:
   - Download: [CH340 Driver](http://wch.cn/downloads/CH341SER_ZIP.html)
   - Or [FTDI Driver](https://ftdichip.com/drivers/vcp-drivers/)

3. **Find correct COM port**:
   ```bash
   # Windows
   wmic logicaldisk get name
   mode
   
   # macOS/Linux
   ls -la /dev/tty*
   ```

4. **Update platformio.ini**:
   ```ini
   upload_port = COM3  # Replace with your port
   upload_speed = 921600
   ```

5. **Restart PlatformIO**:
   ```bash
   pio run --verbose -t upload
   ```

---

#### Serial Monitor Shows Nothing

**Error**: No output from ESP32

**Solutions**:

1. **Verify serial connection**:
   ```bash
   pio device monitor -p COM3 -b 115200
   ```

2. **Check baud rate** (should be 115200):
   ```bash
   pio device monitor -p COM3 -b 115200
   ```

3. **Reset ESP32**:
   - Press reset button on board
   - Or disconnect and reconnect USB

4. **Check firmware uploaded successfully**:
   - Look for "Leaving... Hard resetting" message

---

#### WiFi Not Connecting

**Error**: "WiFi disconnected" in serial output

**Solutions**:

1. **Verify WiFi credentials** in `platformio.ini`:
   ```ini
   -D WIFI_SSID="YourSSID"
   -D WIFI_PASSWORD="YourPassword"
   ```

2. **Check WiFi compatibility**:
   - ESP32 supports 2.4 GHz only (not 5 GHz)
   - Try connecting from computer to verify network

3. **Check distance to router**:
   - Move ESP32 closer to WiFi router
   - Check for interference

4. **Verify password**:
   - Ensure no special characters causing issues
   - Try with simple password first

5. **Recompile and upload**:
   ```bash
   pio run -t upload -e esp32
   ```

---

#### WebSocket Connection Fails on ESP32

**Error**: "WebSocket disconnected" in serial output

**Solutions**:

1. **Verify backend URL** in `platformio.ini`:
   ```ini
   -D WS_SERVER="your-backend-ip"
   -D WS_PORT=80
   ```

2. **Test connectivity**:
   ```bash
   # From computer on same network
   curl http://backend-ip:80/health
   ```

3. **Check firewall** allows port 80

4. **Verify backend is running and accessible**:
   ```bash
   curl http://your-backend-ip:3001/health
   ```

5. **Try with backend IP instead of hostname**:
   ```ini
   -D WS_SERVER="192.168.1.100"
   ```

---

#### HX711 Not Reading

**Error**: "HX711 not ready" in serial output

**Solutions**:

1. **Check wiring**:
   - DT → GPIO 25
   - SCK → GPIO 26
   - 3.3V → VCC
   - GND → GND

2. **Verify load cell connected**:
   - Red (E+), Black (E-), Green (A+), White (A-)
   - All wires fully connected

3. **Test with example code**:
   - Use HX711 library examples
   - Verify basic functionality first

4. **Check GPIO pins not conflicting**:
   - GPIO 25 and 26 should be available
   - No other devices using these pins

5. **Add delay for stabilization**:
   - HX711 takes ~1 second to stabilize after power
   - Already implemented in code

---

### Database Issues

#### Cannot Access Supabase

**Error**: Connection timeout

**Solutions**:

1. **Verify Supabase is running**:
   - Log in to supabase.com dashboard
   - Check project status

2. **Check connection string format**:
   ```
   postgresql://user:password@host:5432/database
   ```

3. **Verify network connectivity**:
   ```bash
   ping supabase-project-id.supabase.co
   ```

4. **Check firewall/proxy** allows outbound connections

---

#### Slow Database Queries

**Error**: Queries taking > 1 second

**Solutions**:

1. **Check indexes exist**:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'samples';
   ```

2. **Create missing indexes**:
   ```sql
   CREATE INDEX idx_samples_session_id ON samples(session_id);
   CREATE INDEX idx_samples_timestamp ON samples(timestamp);
   ```

3. **Analyze query performance**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM samples WHERE session_id = 1;
   ```

4. **Archive old data** if table is large:
   ```sql
   CREATE TABLE samples_archive AS SELECT * FROM samples WHERE created_at < NOW() - INTERVAL '90 days';
   DELETE FROM samples WHERE created_at < NOW() - INTERVAL '90 days';
   ```

---

#### Database Connection Pool Issues

**Error**: "Client already has open transaction"

**Solutions**:

1. **Restart backend**:
   ```bash
   npm run dev
   ```

2. **Check for connection leaks**:
   - Add logging to see open connections
   - Verify all queries close connections

3. **Increase pool size** if needed:
   ```javascript
   const db = new Pool({
     max: 20,  // Increase if needed
   });
   ```

---

### Terraform Issues

#### Terraform Cannot Connect to Supabase

**Error**: `Error: Authorization Error`

**Solutions**:

1. **Verify access token** in `terraform.tfvars`:
   ```bash
   echo $SUPABASE_ANON_KEY  # Should show token
   ```

2. **Get new token**:
   - Go to supabase.com
   - Settings → API → Service Role Key
   - Copy and update `terraform.tfvars`

3. **Verify organization ID**:
   ```bash
   # From Supabase dashboard URL
   # https://app.supabase.com/org/YOUR_ORG_ID/projects
   ```

---

#### Terraform Plan Shows Unexpected Changes

**Error**: Resources marked for deletion

**Solutions**:

1. **Review terraform.tfvars** for changes:
   ```bash
   terraform plan -out=tfplan
   ```

2. **Check for typos** in variable names

3. **Back up database** before destroy:
   ```sql
   pg_dump $DATABASE_URL > backup.sql
   ```

---

### Performance Issues

#### High Memory Usage

**Error**: Server using > 500 MB RAM

**Solutions**:

1. **Check for WebSocket memory leak**:
   - Verify clients disconnect properly
   - Monitor `clients.size` in logs

2. **Reduce graph data** in frontend:
   - Currently keeps 200 samples in memory
   - Reduce to 100 if needed

3. **Archive database records**:
   - Move old sessions to archive table
   - Reduce active query time

---

#### High Latency (> 1 second)

**Error**: Measurements appearing > 1 second delayed

**Solutions**:

1. **Check network latency**:
   ```bash
   ping your-backend.railway.app
   ```

2. **Check database query time**:
   ```sql
   SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;
   ```

3. **Verify WebSocket compression** enabled

4. **Check backend logs** for slow operations

---

## Getting More Help

### Check Logs

**Backend**:
```bash
npm run dev 2>&1 | tee backend.log
```

**Frontend** (Browser Console):
- F12 → Console tab
- Look for error messages

**ESP32**:
```bash
pio device monitor -p COM3
```

**Database**:
```bash
# Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  # Log queries > 100ms
SELECT pg_reload_conf();
```

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| EADDRINUSE | Port in use | Kill process or change port |
| ECONNREFUSED | Connection refused | Service not running |
| CORS error | Cross-origin not allowed | Check CORS config |
| 404 Not Found | Endpoint not found | Check URL spelling |
| 500 Internal Server | Server error | Check backend logs |
| WebSocket timeout | Connection lost | Check network/firewall |

---

## Before Reporting Issues

1. ✅ Verify prerequisites installed
2. ✅ Check error logs completely
3. ✅ Try restarting services
4. ✅ Clear caches (npm, browser)
5. ✅ Check documentation (SETUP.md, README.md)
6. ✅ Search troubleshooting section above
7. ✅ Try on fresh clone if possible

---

## Still Stuck?

Check the documentation:
- **README.md** - Project overview
- **SETUP.md** - Development setup
- **DEPLOYMENT.md** - Deployment issues
- **API.md** - API-related issues
- **ARCHITECTURE.md** - Architecture questions

---

Last Updated: January 2024
