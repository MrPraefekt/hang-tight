import React, { useState, useEffect } from 'react'

export default function CalibrationPanel({ calibration, onSave }) {
  const [offset, setOffset] = useState(calibration?.offset || 0)
  const [scale, setScale] = useState(calibration?.scale || 1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (calibration) {
      setOffset(calibration.offset || 0)
      setScale(calibration.scale || 1)
    }
  }, [calibration])

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(parseFloat(offset), parseFloat(scale))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">Calibration</h2>
      
      <div className="form-group">
        <label>Offset (raw units)</label>
        <input
          type="number"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          step="0.1"
          placeholder="0"
        />
      </div>

      <div className="form-group">
        <label>Scale Factor (N/raw unit)</label>
        <input
          type="number"
          value={scale}
          onChange={(e) => setScale(e.target.value)}
          step="0.001"
          placeholder="1"
        />
      </div>

      <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <strong>Calibration Formula:</strong>
        <div style={{ marginTop: '0.5rem', fontFamily: 'monospace' }}>
          force (N) = (raw - {offset}) &#xD7; {scale}
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={loading}
        className="button-success"
        style={{ width: '100%' }}
      >
        {loading ? 'Saving...' : '&#x2713; Save Calibration'}
      </button>

      <div className="separator"></div>

      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '0.5rem' }}>
          <strong>Calibration Steps:</strong>
        </p>
        <ol style={{ marginLeft: '1rem' }}>
          <li>Place no weight on sensor</li>
          <li>Note the raw value as offset</li>
          <li>Place known weight (e.g., 10 N)</li>
          <li>Calculate: scale = 10 / (raw - offset)</li>
          <li>Enter values and save</li>
        </ol>
      </div>
    </div>
  )
}
