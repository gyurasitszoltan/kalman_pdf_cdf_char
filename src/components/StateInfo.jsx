const MONO = "'IBM Plex Mono',monospace";

export default function StateInfo({ est, measVal, R, lastPrice, normStats }) {
  const innovation = est ? measVal - est.mu : 0;

  return (
    <div style={{
      marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10,
    }}>
      {[
        {
          label: 'Kálmán-becslés',
          val: `μ = ${est ? est.mu.toFixed(3) : '—'}`,
          sub: `σ = ${est ? est.sigma.toFixed(3) : '—'}`,
          col: '#00b4d8',
        },
        {
          label: 'Z-score mérés',
          val: `z = ${typeof measVal === 'number' ? measVal.toFixed(3) : '—'}`,
          sub: lastPrice ? `Ár: ${lastPrice.toFixed(2)} USDT` : `σ_mérés = ${Math.sqrt(R).toFixed(3)}`,
          col: '#e85d04',
        },
        {
          label: 'Innováció',
          val: `Δ = ${innovation.toFixed(3)}`,
          sub: normStats ? `μ_ár = ${normStats.mean.toFixed(1)}  σ_ár = ${normStats.std.toFixed(1)}` : '—',
          col: '#c77dff',
        },
      ].map((item, i) => (
        <div key={i} style={{
          background: `${item.col}08`, borderRadius: 10,
          border: `1px solid ${item.col}30`, padding: '8px 14px',
          fontFamily: MONO, fontSize: 12,
        }}>
          <div style={{ color: '#666', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
          <div style={{ color: item.col, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{item.val}</div>
          <div style={{ color: '#777', fontSize: 10, marginTop: 1 }}>{item.sub}</div>
        </div>
      ))}
    </div>
  );
}
