-- Hangboard Force Measurement System - Seed Data
-- Realistic training data for 7 sessions (one week of training)

-- Insert default calibration (offset, scale)
INSERT INTO calibration (offset, scale) VALUES (1000, 0.001);

-- Session 1: Monday morning - 30 second hang
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '2 minutes');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
-- Ramp up phase (0-3s)
(1, 1000, 1050, 0.05),
(1, 1050, 1080, 0.08),
(1, 1100, 1120, 0.12),
(1, 1150, 1200, 0.20),
(1, 1200, 1350, 0.35),
-- Peak hold (3-8s)
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
-- Recovery phase (8-12s)
(1, 1750, 1450, 0.45),
(1, 1800, 1300, 0.30),
(1, 1850, 1150, 0.15),
(1, 1900, 1050, 0.05);

-- Session 2: Tuesday - 30 second hang with good form
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 minutes');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(2, 2000, 1040, 0.04),
(2, 2050, 1100, 0.10),
(2, 2100, 1180, 0.18),
(2, 2150, 1300, 0.30),
(2, 2200, 1550, 0.55),
(2, 2250, 1850, 0.85),
(2, 2300, 1950, 0.95),
(2, 2350, 2000, 1.00),
(2, 2400, 2050, 1.05),
(2, 2450, 2100, 1.10),
(2, 2500, 2150, 1.15),
(2, 2550, 2100, 1.10),
(2, 2600, 2000, 1.00),
(2, 2650, 1850, 0.85),
(2, 2700, 1650, 0.65),
(2, 2750, 1450, 0.45),
(2, 2800, 1250, 0.25),
(2, 2850, 1100, 0.10),
(2, 2900, 1030, 0.03);

-- Session 3: Wednesday - Recovery day, lighter loads
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '90 seconds');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(3, 3000, 1030, 0.03),
(3, 3050, 1080, 0.08),
(3, 3100, 1150, 0.15),
(3, 3150, 1250, 0.25),
(3, 3200, 1350, 0.35),
(3, 3250, 1400, 0.40),
(3, 3300, 1420, 0.42),
(3, 3350, 1400, 0.40),
(3, 3400, 1350, 0.35),
(3, 3450, 1280, 0.28),
(3, 3500, 1180, 0.18),
(3, 3550, 1080, 0.08),
(3, 3600, 1020, 0.02);

-- Session 4: Thursday - Good session with consistent pulls
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '3 minutes');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(4, 4000, 1035, 0.035),
(4, 4050, 1120, 0.12),
(4, 4100, 1250, 0.25),
(4, 4150, 1450, 0.45),
(4, 4200, 1700, 0.70),
(4, 4250, 1950, 0.95),
(4, 4300, 2150, 1.15),
(4, 4350, 2250, 1.25),
(4, 4400, 2320, 1.32),
(4, 4450, 2380, 1.38),
(4, 4500, 2400, 1.40),
(4, 4550, 2380, 1.38),
(4, 4600, 2320, 1.32),
(4, 4650, 2200, 1.20),
(4, 4700, 2000, 1.00),
(4, 4750, 1750, 0.75),
(4, 4800, 1500, 0.50),
(4, 4850, 1250, 0.25),
(4, 4900, 1050, 0.05);

-- Session 5: Friday - Intense session with multiple sets
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '4 minutes');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(5, 5000, 1020, 0.02),
(5, 5050, 1150, 0.15),
(5, 5100, 1400, 0.40),
(5, 5150, 1750, 0.75),
(5, 5200, 2100, 1.10),
(5, 5250, 2450, 1.45),
(5, 5300, 2750, 1.75),
(5, 5350, 2950, 1.95),
(5, 5400, 3050, 2.05),
(5, 5450, 3100, 2.10),
(5, 5500, 3050, 2.05),
(5, 5550, 2950, 1.95),
(5, 5600, 2700, 1.70),
(5, 5650, 2400, 1.40),
(5, 5700, 2050, 1.05),
(5, 5750, 1650, 0.65),
(5, 5800, 1250, 0.25),
(5, 5850, 1020, 0.02);

-- Session 6: Saturday - Long session
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '5 minutes');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(6, 6000, 1015, 0.015),
(6, 6050, 1100, 0.10),
(6, 6100, 1300, 0.30),
(6, 6150, 1600, 0.60),
(6, 6200, 1950, 0.95),
(6, 6250, 2350, 1.35),
(6, 6300, 2700, 1.70),
(6, 6350, 3000, 2.00),
(6, 6400, 3200, 2.20),
(6, 6450, 3350, 2.35),
(6, 6500, 3400, 2.40),
(6, 6550, 3380, 2.38),
(6, 6600, 3300, 2.30),
(6, 6650, 3100, 2.10),
(6, 6700, 2800, 1.80),
(6, 6750, 2400, 1.40),
(6, 6800, 1900, 0.90),
(6, 6850, 1400, 0.40),
(6, 6900, 1000, 0.00),
(6, 6950, 900, -0.10);

-- Session 7: Sunday - Week conclusion (today)
INSERT INTO sessions (start_time, end_time) 
VALUES (NOW(), NOW() + INTERVAL '2 minutes');

INSERT INTO samples (session_id, timestamp, raw, force) VALUES
(7, 7000, 1010, 0.01),
(7, 7050, 1120, 0.12),
(7, 7100, 1350, 0.35),
(7, 7150, 1700, 0.70),
(7, 7200, 2100, 1.10),
(7, 7250, 2500, 1.50),
(7, 7300, 2850, 1.85),
(7, 7350, 3100, 2.10),
(7, 7400, 3250, 2.25),
(7, 7450, 3300, 2.30),
(7, 7500, 3250, 2.25),
(7, 7550, 3100, 2.10),
(7, 7600, 2800, 1.80),
(7, 7650, 2400, 1.40),
(7, 7700, 1950, 0.95),
(7, 7750, 1500, 0.50),
(7, 7800, 1100, 0.10),
(7, 7850, 1020, 0.02);
