-- Hangboard Force Measurement System - SQLite Seed Data
-- Run via: make seed

-- Insert default calibration
INSERT OR IGNORE INTO calibration ("offset", scale) VALUES (1000, 0.001);

-- Session 1: Sample 30-second hang
INSERT INTO sessions (start_time, end_time) 
VALUES (datetime('now', '-6 days'), datetime('now', '-6 days', '+2 minutes'));

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(1, 1000, 1050, 0.05),
(1, 1050, 1080, 0.08),
(1, 1100, 1120, 0.12),
(1, 1150, 1200, 0.20),
(1, 1200, 1350, 0.35),
(1, 1250, 1650, 0.65),
(1, 1300, 1750, 0.75),
(1, 1350, 1800, 0.80),
(1, 1400, 1820, 0.82),
(1, 1450, 1800, 0.80),
(1, 1500, 1750, 0.75),
(1, 1550, 1700, 0.70),
(1, 1600, 1680, 0.68),
(1, 1650, 1650, 0.65),
(1, 1700, 1600, 0.60),
(1, 1750, 1450, 0.45),
(1, 1800, 1300, 0.30),
(1, 1850, 1200, 0.20),
(1, 1900, 1100, 0.10),
(1, 1950, 1050, 0.05);

-- Session 2: Another sample hang
INSERT INTO sessions (start_time, end_time) 
VALUES (datetime('now', '-5 days'), datetime('now', '-5 days', '+1 minutes'));

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(2, 1000, 1060, 0.06),
(2, 1050, 1100, 0.10),
(2, 1100, 1250, 0.25),
(2, 1150, 1500, 0.50),
(2, 1200, 1700, 0.70),
(2, 1250, 1850, 0.85),
(2, 1300, 1900, 0.90),
(2, 1350, 1880, 0.88),
(2, 1400, 1850, 0.85),
(2, 1450, 1750, 0.75),
(2, 1500, 1500, 0.50),
(2, 1550, 1200, 0.20),
(2, 1600, 1050, 0.05);
