const MONO = "'IBM Plex Mono',monospace";

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

const STATUS_CONFIG = {
  loading:       { color: '#888', text: 'Betöltés...' },
  bootstrapping: { color: '#ffd166', text: 'Bootstrap...' },
  connected:     { color: '#00ff88', text: 'Csatlakozva' },
  reconnecting:  { color: '#ffd166', text: 'Újracsatlakozás...' },
  error:         { color: '#ff6d6d', text: 'Hiba' },
};

export default function ConnectionStatus({ status, error, symbol, onSymbolChange, candleCount, normStats }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.loading;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#0d0d1c90', borderRadius: 10, border: '1px solid #1a1a30',
      padding: '8px 14px', marginBottom: 10,
      fontFamily: MONO, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 6px ${cfg.color}60`,
        }} />
        <span style={{ color: cfg.color }}>{cfg.text}</span>
        {error && <span style={{ color: '#ff6d6d', fontSize: 10 }}>{error}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {normStats && (
          <span style={{ color: '#555', fontSize: 10 }}>
            {candleCount} gyertya | μ={normStats.mean.toFixed(1)} σ={normStats.std.toFixed(1)}
          </span>
        )}

        <select
          value={symbol}
          onChange={e => onSymbolChange(e.target.value)}
          style={{
            background: '#1a1a30', color: '#ccc', border: '1px solid #333',
            borderRadius: 6, padding: '4px 8px', fontFamily: MONO, fontSize: 11,
            cursor: 'pointer', outline: 'none',
          }}
        >
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
