const MONO = "'IBM Plex Mono',monospace";

export default function ControlPanel({
  step, maxStep, onStepChange,
  playing, onPlayToggle,
  Q, onQChange, R, onRChange,
  liveMode, onLiveModeToggle,
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10, marginTop: 10,
    }}>
      {/* Time step + Live */}
      <div style={{
        background: '#0d0d1c90', borderRadius: 10, border: '1px solid #1a1a30',
        padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#888' }}>
            Lépés: <span style={{ color: '#ffd166', fontWeight: 700 }}>{step}</span>
            <span style={{ color: '#555' }}> / {maxStep}</span>
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onLiveModeToggle}
              style={{
                background: liveMode ? '#00ff8820' : '#33333340',
                border: `1px solid ${liveMode ? '#00ff88' : '#555'}`,
                color: liveMode ? '#00ff88' : '#777',
                borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                fontFamily: MONO, fontSize: 10, fontWeight: 600,
              }}>
              {liveMode ? '● LIVE' : '○ LIVE'}
            </button>
            <button onClick={onPlayToggle}
              style={{
                background: playing ? '#ff6d6d20' : '#00b4d820',
                border: `1px solid ${playing ? '#ff6d6d' : '#00b4d8'}`,
                color: playing ? '#ff6d6d' : '#00b4d8',
                borderRadius: 6, padding: '3px 12px', cursor: 'pointer',
                fontFamily: MONO, fontSize: 11, fontWeight: 600,
              }}>
              {playing ? '⏸ Stop' : '▶ Lejátszás'}
            </button>
          </div>
        </div>
        <input type="range" min={0} max={maxStep} step={1} value={step}
          onChange={e => onStepChange(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#ffd166', cursor: 'pointer' }} />
      </div>

      {/* Process noise Q */}
      <div style={{
        background: '#0d0d1c90', borderRadius: 10, border: '1px solid #1a1a30',
        padding: '10px 14px',
      }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: '#888', marginBottom: 6 }}>
          Folyamatzaj Q: <span style={{ color: '#c77dff', fontWeight: 700 }}>{Q.toFixed(2)}</span>
        </div>
        <input type="range" min={0.01} max={2} step={0.01} value={Q}
          onChange={e => onQChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#c77dff', cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 9, color: '#555', marginTop: 2 }}>
          <span>biztos modell</span><span>bizonytalan</span>
        </div>
      </div>

      {/* Measurement noise R */}
      <div style={{
        background: '#0d0d1c90', borderRadius: 10, border: '1px solid #1a1a30',
        padding: '10px 14px',
      }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: '#888', marginBottom: 6 }}>
          Mérési zaj R: <span style={{ color: '#e85d04', fontWeight: 700 }}>{R.toFixed(2)}</span>
        </div>
        <input type="range" min={0.1} max={8} step={0.1} value={R}
          onChange={e => onRChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#e85d04', cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 9, color: '#555', marginTop: 2 }}>
          <span>pontos szenzor</span><span>zajos szenzor</span>
        </div>
      </div>
    </div>
  );
}
