# Hangboard Force Measurement — Makefile
#
# Local dev:
#   make install      — install all npm deps
#   make dev          — run backend + frontend (hot-reload)
#   make build        — production build
#   make seed         — seed local DB with sample data
#
# Deploy to Pi:
#   make ship         — commit, push, Pi auto-deploys in ~15s
#   make deploy       — push + SSH trigger (immediate)
#   make logs         — tail Pi logs
#   make status       — check Pi service
#
# First-time Pi setup (SSH into Pi, then run): \
sudo apt-get update && sudo apt-get install -y git curl && \
curl -fsSL https://raw.githubusercontent.com/mrpraefekt/hang-tight/main/deploy/setup-pi.sh | bash

PI_HOST  ?= hang-tight.local
PI_USER  ?= hang-tight
PI_SSH    = $(PI_USER)@$(PI_HOST)
PI_PATH   = /opt/hang-tight

# ── Local dev ────────────────────────────────────────────────────────────────

.PHONY: dev install build seed clean

dev:
	@trap 'kill 0' EXIT; \
		cd backend && npx nodemon server.js & \
		cd frontend && npx vite --host & \
		wait

install:
	cd backend && npm install
	cd frontend && npm install

build:
	cd frontend && npm run build
	rm -rf backend/public
	cp -r frontend/dist backend/public

seed:
	cd backend && node scripts/init-db.js --seed

clean:
	rm -rf backend/public frontend/dist data/*.csv

# ── Deploy ───────────────────────────────────────────────────────────────────

.PHONY: ship deploy

ship:
	@git add -A
	@git diff --cached --stat
	@read -p "Commit message: " msg && git commit -m "$$msg"
	git push origin main
	@echo "✓ Pushed. Pi auto-deploys in ~15s."

deploy:
	git push origin main
	ssh $(PI_SSH) "$(PI_PATH)/deploy/deploy.sh"
	@echo "✓ Deployed → http://$(PI_HOST):3001"

# ── Pi utilities ─────────────────────────────────────────────────────────────

.PHONY: logs status pull-data pull-csv

logs:
	ssh $(PI_SSH) "sudo journalctl -u hangboard -f --no-pager"

status:
	ssh $(PI_SSH) "sudo systemctl status hangboard"

pull-data:
	@mkdir -p data
	rsync -azP $(PI_SSH):$(PI_PATH)/backend/data/hangboard.db data/hangboard-pi.db
	@sqlite3 data/hangboard-pi.db "SELECT 'Sessions: ' || COUNT(*) FROM sessions;"
	@sqlite3 data/hangboard-pi.db "SELECT 'Samples:  ' || COUNT(*) FROM samples;"

pull-csv: pull-data
	@mkdir -p data
	sqlite3 -header -csv data/hangboard-pi.db \
		"SELECT s.id, s.session_id, s.timestamp, s.raw, s.force, \
		 ses.start_time, ses.end_time \
		 FROM samples s JOIN sessions ses ON s.session_id = ses.id \
		 ORDER BY s.session_id, s.timestamp" > data/samples.csv
	sqlite3 -header -csv data/hangboard-pi.db \
		"SELECT * FROM sessions ORDER BY start_time" > data/sessions.csv
	sqlite3 -header -csv data/hangboard-pi.db \
		"SELECT * FROM calibration ORDER BY created_at" > data/calibration.csv
	@wc -l data/*.csv
