const MONO = "'IBM Plex Mono',monospace";

// Adaptív ár formázás — kis és nagy árakhoz egyaránt
const fmtUsdt = (p, forceDecimals) => {
  const abs = Math.abs(p);
  if (abs >= 1000) return Math.round(p).toLocaleString('en');
  if (abs >= 10) return p.toFixed(1);
  if (abs >= 0.1) return p.toFixed(forceDecimals || 3);
  if (abs >= 0.001) return p.toFixed(forceDecimals || 4);
  return p.toFixed(forceDecimals || 6);
};

export default function StateInfo({ est, measVal, R, lastPrice, normStats }) {
  const zMean = normStats?.mean || 0;
  const zStd = normStats?.std || 1;
  const toPrice = z => z * zStd + zMean;

  const estPrice = est ? toPrice(est.mu) : null;
  const estSigmaPrice = est ? est.sigma * zStd : null;
  const innovation = est ? measVal - est.mu : 0;
  const innovPrice = innovation * zStd;

  return (
    <div style={{
      marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10,
    }}>
      {[
        {
          label: 'Kálmán-becslés',
          val: estPrice !== null ? `${fmtUsdt(estPrice)} USDT` : '—',
          sub: estSigmaPrice !== null ? `±${fmtUsdt(estSigmaPrice)} USDT  (z: μ=${est.mu.toFixed(2)} σ=${est.sigma.toFixed(2)})` : '—',
          col: '#00b4d8',
        },
        {
          label: 'Close ár',
          val: lastPrice ? `${fmtUsdt(lastPrice)} USDT` : '—',
          sub: `z = ${typeof measVal === 'number' ? measVal.toFixed(3) : '—'}`,
          col: '#e85d04',
        },
        {
          label: 'Innováció',
          val: `${innovPrice >= 0 ? '+' : ''}${fmtUsdt(innovPrice)} USDT`,
          sub: normStats ? `Kalibráció: μ=${fmtUsdt(zMean)} σ=${fmtUsdt(zStd)}${normStats.frozen ? ' ❄' : ''}` : '—',
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
