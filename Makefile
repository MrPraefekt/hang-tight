# Hangboard Force Measurement — Development & Deployment
#
# Usage:
#   make dev          — run backend + frontend locally (development)
#   make build        — build frontend into backend/public/
#   make deploy       — build + rsync to Pi + restart service
#   make pull-data    — copy Pi's SQLite database to local ./data/
#   make seed         — insert sample data into local DB
#   make clean        — remove build artifacts
#
# Configure PI_HOST below (or override: make deploy PI_HOST=192.168.1.50)

PI_HOST  ?= hang-tight.local
PI_USER  ?= hang-tight
PI_PATH  ?= /opt/hang-tight
PI_SSH    = $(PI_USER)@$(PI_HOST)

# ============================================================================
# Local development
# ============================================================================

.PHONY: dev
dev:
	@echo "Starting backend (nodemon) + frontend (vite) in parallel..."
	@trap 'kill 0' EXIT; \
		cd backend && npx nodemon server.js & \
		cd frontend && npx vite --host & \
		wait

.PHONY: install
install:
	cd backend && npm install
	cd frontend && npm install

# ============================================================================
# Build
# ============================================================================

.PHONY: build
build:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Copying build to backend/public/..."
	rm -rf backend/public
	cp -r frontend/dist backend/public
	@echo "Build complete. Run 'cd backend && node server.js' to test."

# ============================================================================
# Deploy to Raspberry Pi
# ============================================================================

.PHONY: deploy
deploy: build
	@echo "Deploying to $(PI_SSH):$(PI_PATH)..."
	rsync -azP --delete \
		--exclude node_modules \
		--exclude .env \
		--exclude 'data/*.db' \
		--exclude 'data/*.db-wal' \
		--exclude 'data/*.db-shm' \
		backend/ $(PI_SSH):$(PI_PATH)/
	@echo "Installing dependencies on Pi..."
	ssh $(PI_SSH) "cd $(PI_PATH) && npm install --production"
	@echo "Restarting service..."
	ssh $(PI_SSH) "sudo systemctl restart hang-tight"
	@echo "✓ Deployed. Open http://$(PI_HOST):3001"

.PHONY: deploy-quick
deploy-quick: build
	@echo "Quick deploy (skip npm install)..."
	rsync -azP --delete \
		--exclude node_modules \
		--exclude .env \
		--exclude 'data/*.db' \
		--exclude 'data/*.db-wal' \
		--exclude 'data/*.db-shm' \
		backend/ $(PI_SSH):$(PI_PATH)/
	ssh $(PI_SSH) "sudo systemctl restart hangboard"
	@echo "✓ Deployed."

# ============================================================================
# Pull data from Pi to local machine
# ============================================================================

.PHONY: pull-data
pull-data:
	@echo "Pulling database from $(PI_SSH)..."
	@mkdir -p data
	rsync -azP \
		$(PI_SSH):$(PI_PATH)/data/hangboard.db \
		data/hangboard-pi.db
	@echo "✓ Database saved to data/hangboard-pi.db"
	@echo ""
	@echo "Quick stats:"
	@sqlite3 data/hangboard-pi.db "SELECT 'Sessions: ' || COUNT(*) FROM sessions;"
	@sqlite3 data/hangboard-pi.db "SELECT 'Samples:  ' || COUNT(*) FROM samples;"
	@sqlite3 data/hangboard-pi.db "SELECT 'DB size:  ' || (page_count * page_size) / 1024 || ' KB' FROM pragma_page_count(), pragma_page_size();"

# Export to CSV for analysis in Python/Jupyter/etc.
.PHONY: pull-csv
pull-csv: pull-data
	@echo "Exporting to CSV..."
	@mkdir -p data
	sqlite3 -header -csv data/hangboard-pi.db \
		"SELECT s.id as sample_id, s.session_id, s.timestamp, s.raw, s.force, \
		 ses.start_time, ses.end_time \
		 FROM samples s JOIN sessions ses ON s.session_id = ses.id \
		 ORDER BY s.session_id, s.timestamp" \
		> data/samples.csv
	sqlite3 -header -csv data/hangboard-pi.db \
		"SELECT * FROM sessions ORDER BY start_time" \
		> data/sessions.csv
	sqlite3 -header -csv data/hangboard-pi.db \
		"SELECT * FROM calibration ORDER BY created_at" \
		> data/calibration.csv
	@echo "✓ Exported to data/samples.csv, data/sessions.csv, data/calibration.csv"
	@wc -l data/*.csv

# ============================================================================
# Pi setup (run once on fresh Pi)
# ============================================================================

.PHONY: pi-setup
pi-setup:
	@echo "Setting up Raspberry Pi..."
	ssh $(PI_SSH) "\
		curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && \
		sudo apt-get install -y nodejs && \
		sudo mkdir -p $(PI_PATH)/data && \
		sudo chown -R $(PI_USER):$(PI_USER) $(PI_PATH)"
	scp deploy/hangboard.service $(PI_SSH):/tmp/hangboard.service
	ssh $(PI_SSH) "\
		sudo cp /tmp/hangboard.service /etc/systemd/system/ && \
		sudo systemctl daemon-reload && \
		sudo systemctl enable hangboard"
	@echo "✓ Pi ready. Run 'make deploy' to push code."

# ============================================================================
# Utilities
# ============================================================================

.PHONY: logs
logs:
	ssh $(PI_SSH) "sudo journalctl -u hangboard -f --no-pager"

.PHONY: status
status:
	ssh $(PI_SSH) "sudo systemctl status hangboard"

.PHONY: seed
seed:
	@echo "Seeding local database with sample data..."
	cd backend && node scripts/init-db.js --seed

.PHONY: clean
clean:
	rm -rf backend/public
	rm -rf frontend/dist
	rm -rf data/*.csv
