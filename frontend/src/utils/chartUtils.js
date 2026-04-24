/**
 * Shared chart utilities for time-based axes, downsampling, and time-range selection.
 */

/** Available time window presets (in seconds) */
export const TIME_WINDOWS = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
  { label: 'All', value: Infinity },
]

/** Default live window */
export const DEFAULT_LIVE_WINDOW = 60

/** Max points to render in a chart for performance */
export const MAX_VISIBLE_POINTS = 600

/**
 * Format a timestamp (epoch ms or ISO string) to mm:ss relative to a reference time.
 * If no reference, formats as mm:ss from epoch.
 */
export function formatTimestamp(ts, referenceStart) {
  const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const elapsed = referenceStart != null ? (ms - referenceStart) / 1000 : ms / 1000
  const absElapsed = Math.abs(elapsed)
  const mins = Math.floor(absElapsed / 60)
  const secs = Math.floor(absElapsed % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * Filter measurements to a sliding time window ending at `now`.
 * Each measurement must have a `timestamp` field (epoch ms or ISO string).
 */
export function filterByTimeWindow(measurements, windowSeconds, now) {
  if (windowSeconds === Infinity) return measurements
  const cutoff = (now || Date.now()) - windowSeconds * 1000
  return measurements.filter(m => m.timestamp >= cutoff)
}

/**
 * Downsample an array to at most `maxPoints` entries using uniform stride.
 * Always keeps the first and last element.
 */
export function downsample(data, maxPoints = MAX_VISIBLE_POINTS) {
  if (data.length <= maxPoints) return data
  const result = [data[0]]
  const stride = (data.length - 1) / (maxPoints - 1)
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(data[Math.round(i * stride)])
  }
  result.push(data[data.length - 1])
  return result
}
