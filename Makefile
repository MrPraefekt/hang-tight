# Hangboard Force Measurement — Development & Deployment
#
# Usage:
#   make dev          — run backend + frontend locally (development)
#   make build        — build frontend into backend/public/
#   make deploy       — push to git, Pi pulls via deploy script
#   make seed         — insert sample data into local DB
#   make clean        — remove build artifacts
#
# The Pi pulls code from GitHub. See deploy/setup-pi.sh for initial setup.
# For SSH-based commands, configure PI_HOST below.

PI_HOST  ?= hang-tight.local
PI_USER  ?= pi
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
# Deploy to Raspberry Pi (git-based)
# ============================================================================

# Push to GitHub, then trigger deploy on Pi via SSH
.PHONY: deploy
deploy:
	@echo "Pushing to GitHub..."
	git push origin main
	@echo "Triggering deploy on Pi..."
	ssh $(PI_SSH) "cd $(PI_PATH) && ./deploy/deploy.sh"
	@echo "✓ Deployed. Open http://$(PI_HOST):3001"

# Quick deploy: skip npm install on Pi
.PHONY: deploy-quick
deploy-quick:
	@echo "Pushing to GitHub..."
	git push origin main
	@echo "Triggering quick deploy on Pi..."
	ssh $(PI_SSH) "cd $(PI_PATH) && ./deploy/deploy.sh --quick"
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
# Pi setup (run once on fresh Pi — or use deploy/setup-pi.sh directly)
# ============================================================================

.PHONY: pi-setup
pi-setup:
	@echo "Running setup script on Pi..."
	ssh $(PI_SSH) "curl -fsSL https://raw.githubusercontent.com/mrpraefekt/hang-tight/main/deploy/setup-pi.sh | bash"
	@echo "✓ Pi ready."

# ============================================================================
# Fast iteration: commit + push (Pi auto-deploys via cron)
# ============================================================================

.PHONY: ship
ship:
	@git add -A
	@git diff --cached --stat
	@read -p "Commit message: " msg && git commit -m "$$msg"
	git push origin main
	@echo "✓ Pushed. Pi will auto-deploy within ~15 seconds."
	@echo "  Browser will auto-reload when build is ready."

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
