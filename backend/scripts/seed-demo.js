#!/usr/bin/env node
/**
 * Generate realistic demo training data:
 * 1 session, 3 sets of 10 hangs, 7s on / 3s off, ~60s rest between sets.
 * 20 Hz sampling (50ms intervals).
 * Force profile: ramp-up, plateau with noise + fatigue, ramp-down.
 */

const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'hangboard.db')
const db = new Database(DB_PATH)

const SAMPLE_RATE = 20 // Hz
const DT = 1000 / SAMPLE_RATE // 50ms

// Training parameters
const SETS = 3
const HANGS_PER_SET = 10
const HANG_DURATION = 7 // seconds
const REST_DURATION = 3 // seconds between hangs
const SET_REST_DURATION = 60 // seconds between sets

// Force parameters (Newtons)
const BASE_FORCE = 180 // baseline peak force
const NOISE_AMP = 5 // random noise ±N
const RAMP_UP_TIME = 0.6 // seconds to reach peak
const RAMP_DOWN_TIME = 0.4 // seconds to release
const REST_FORCE = 2 // noise floor when not hanging

// Fatigue: force drops within a set and across sets
const INTRA_SET_FATIGUE = 0.02 // 2% drop per hang within set
const INTER_SET_FATIGUE = 0.05 // 5% drop per set

function noise(amp) {
  return (Math.random() - 0.5) * 2 * amp
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function generateSamples() {
  const samples = []
  let t = 1000 // start at 1000ms device uptime
  const calibrationOffset = 1000
  const calibrationScale = 0.001 // raw = offset + force / scale => raw = 1000 + force * 1000

  for (let set = 0; set < SETS; set++) {
    const setFatigue = 1 - set * INTER_SET_FATIGUE

    for (let hang = 0; hang < HANGS_PER_SET; hang++) {
      const hangFatigue = 1 - hang * INTRA_SET_FATIGUE
      const peakForce = BASE_FORCE * setFatigue * hangFatigue

      // --- Hang phase (7s) ---
      const hangSamples = HANG_DURATION * SAMPLE_RATE
      for (let i = 0; i < hangSamples; i++) {
        const elapsed = i / SAMPLE_RATE
        let force

        if (elapsed < RAMP_UP_TIME) {
          // Smooth ramp up (ease-in)
          const progress = elapsed / RAMP_UP_TIME
          force = peakForce * (progress * progress)
        } else if (elapsed > HANG_DURATION - RAMP_DOWN_TIME) {
          // Smooth ramp down
          const remaining = (HANG_DURATION - elapsed) / RAMP_DOWN_TIME
          force = peakForce * (remaining * remaining)
        } else {
          // Plateau with slight droop + noise
          const plateauProgress = (elapsed - RAMP_UP_TIME) / (HANG_DURATION - RAMP_UP_TIME - RAMP_DOWN_TIME)
          const droop = 1 - plateauProgress * 0.08 // 8% force drop during hang
          force = peakForce * droop
        }

        force = clamp(force + noise(NOISE_AMP), 0, 500)
        const raw = Math.round(calibrationOffset + force / calibrationScale)

        samples.push({ timestamp: Math.round(t), raw, force: Number(force.toFixed(2)) })
        t += DT
      }

      // --- Rest phase (3s between hangs, or set rest) ---
      const isLastHangInSet = hang === HANGS_PER_SET - 1
      const restTime = isLastHangInSet && set < SETS - 1 ? SET_REST_DURATION : (isLastHangInSet ? 0 : REST_DURATION)

      const restSamples = restTime * SAMPLE_RATE
      for (let i = 0; i < restSamples; i++) {
        const force = clamp(REST_FORCE + noise(1.5), 0, 10)
        const raw = Math.round(calibrationOffset + force / calibrationScale)
        samples.push({ timestamp: Math.round(t), raw, force: Number(force.toFixed(2)) })
        t += DT
      }
    }
  }

  return { samples, durationMs: t - 1000 }
}

// Main
const { samples, durationMs } = generateSamples()
const durationSec = Math.round(durationMs / 1000)
const minutes = Math.floor(durationSec / 60)
const seconds = durationSec % 60

console.log(`Generated ${samples.length} samples (${minutes}m ${seconds}s at ${SAMPLE_RATE} Hz)`)
console.log(`  3 sets × 10 hangs × 7s on / 3s off, 60s rest between sets`)

// Insert session
const startTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
const endTime = new Date(new Date(startTime).getTime() + durationMs).toISOString()

const insertSession = db.prepare(
  `INSERT INTO sessions (start_time, end_time) VALUES (?, ?)`
)
const result = insertSession.run(startTime, endTime)
const sessionId = result.lastInsertRowid

console.log(`  Session ID: ${sessionId}`)

// Batch insert samples
const insertSample = db.prepare(
  `INSERT INTO samples (session_id, timestamp, raw, force) VALUES (?, ?, ?, ?)`
)

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    insertSample.run(sessionId, row.timestamp, row.raw, row.force)
  }
})

insertMany(samples)
console.log(`  Inserted into session ${sessionId} ✓`)

db.close()
