import { useMemo } from 'react';

const MONO = "'IBM Plex Mono',monospace";
const SERIF = "'Source Serif 4',Georgia,serif";

export default function TimeSeriesChart({ history, step, width, height, symbol, distWindow = 30, normStats, timestamps = [] }) {
  const N = history.length;
  if (N === 0) return null;

  // Inverz z-score: ár = z * std + mean
  const zMean = normStats?.mean || 0;
  const zStd = normStats?.std || 1;
  const toPrice = z => z * zStd + zMean;

  const measurements = useMemo(() => history.map(h => h.measurement), [history]);
  const filteredPositions = useMemo(() => history.map(h => h.filtered), [history]);
  const estimates = useMemo(() => history.map(h => ({ mu: h.mu, sigma: h.sigma })), [history]);

  // Árakra konvertált tömbök (megjelenítéshez)
  const measPrices = useMemo(() => measurements.map(toPrice), [measurements, zMean, zStd]);
  const filtPrices = useMemo(() => filteredPositions.map(toPrice), [filteredPositions, zMean, zStd]);
  const estPrices = useMemo(() => estimates.map(e => ({
    mu: toPrice(e.mu),
    sigma: e.sigma * zStd,
  })), [estimates, zMean, zStd]);

  const pad = { top: 20, right: 16, bottom: 32, left: 54 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const allVals = useMemo(() => [...measPrices, ...filtPrices], [measPrices, filtPrices]);
  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const spread = dataMax - dataMin || 1;
  const dataPad = spread * 0.15 + spread * 0.05;
  const yMin = dataMin - dataPad;
  const yMax = dataMax + dataPad;

  const toSX = i => pad.left + (i / Math.max(N - 1, 1)) * cw;
  const toSY = y => pad.top + ch - ((y - yMin) / (yMax - yMin)) * ch;

  // Confidence band (±2σ) — árban
  let bandPath = `M ${toSX(0)} ${toSY(estPrices[0].mu + 2 * estPrices[0].sigma)}`;
  for (let i = 1; i < N; i++) bandPath += ` L ${toSX(i)} ${toSY(estPrices[i].mu + 2 * estPrices[i].sigma)}`;
  for (let i = N - 1; i >= 0; i--) bandPath += ` L ${toSX(i)} ${toSY(estPrices[i].mu - 2 * estPrices[i].sigma)}`;
  bandPath += ' Z';

  const xTicks = [];
  const xStep = Math.max(1, Math.floor(N / 6));
  for (let i = 0; i < N; i += xStep) xTicks.push(i);

  // Y-tengely tickek — adaptív lépésköz (kis és nagy árakhoz egyaránt)
  const yRange = yMax - yMin;
  const niceSteps = [
    0.0001, 0.0002, 0.0005,
    0.001, 0.002, 0.005,
    0.01, 0.02, 0.05,
    0.1, 0.2, 0.5,
    1, 2, 5,
    10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
  ];
  let yTickStep = niceSteps.find(s => yRange / s <= 8) || Math.ceil(yRange / 6);
  const yTicks = [];
  for (let y = Math.ceil(yMin / yTickStep) * yTickStep; y <= yMax; y += yTickStep) yTicks.push(y);

  const clampedStep = Math.min(step, N - 1);
  const winStart = Math.max(0, clampedStep + 1 - distWindow);

  const buildLineRange = (arr, from, to) => {
    let d = '';
    for (let i = from; i <= to; i++) {
      d += `${i === from ? 'M' : 'L'} ${toSX(i)} ${toSY(arr[i])} `;
    }
    return d;
  };

  // Ár formázás — adaptív tizedesjegyek
  const fmtPrice = p => {
    const abs = Math.abs(p);
    if (abs >= 1000) return Math.round(p).toLocaleString('en');
    if (abs >= 1) return p.toFixed(1);
    if (abs >= 0.01) return p.toFixed(3);
    return p.toFixed(5);
  };

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {yTicks.map(y => <line key={y} x1={pad.left} x2={pad.left + cw} y1={toSY(y)} y2={toSY(y)} stroke="#1e1e30" strokeWidth={0.5} />)}

      {/* Distribution window background highlight */}
      <rect
        x={toSX(winStart)} y={pad.top}
        width={toSX(clampedStep) - toSX(winStart)}
        height={ch}
        fill="#22d3ee" opacity={0.04} rx={2}
      />

      {/* Confidence band */}
      <path d={bandPath} fill="#00b4d8" opacity={0.08} />

      {/* Measurement dots — árakban */}
      {measPrices.map((v, i) => (
        <circle key={i} cx={toSX(i)} cy={toSY(v)} r={1.8}
          fill={i <= clampedStep ? '#e85d0480' : '#e85d0420'} />
      ))}

      {/* Filtered line: outside window (dimmed) */}
      {winStart > 0 && (
        <path d={buildLineRange(filtPrices, 0, winStart)} fill="none"
          stroke="#00b4d8" strokeWidth={1.5} strokeLinecap="round" opacity={0.2} />
      )}
      {/* Filtered line: inside window (bright) */}
      <path d={buildLineRange(filtPrices, winStart, clampedStep)} fill="none"
        stroke="#00b4d8" strokeWidth={2.5} strokeLinecap="round" />

      {/* Window start marker */}
      <line x1={toSX(winStart)} x2={toSX(winStart)} y1={pad.top} y2={pad.top + ch}
        stroke="#22d3ee30" strokeWidth={1} strokeDasharray="4,3" />

      {/* Current step marker */}
      <line x1={toSX(clampedStep)} x2={toSX(clampedStep)} y1={pad.top} y2={pad.top + ch}
        stroke="#ffd16640" strokeWidth={1} />
      <circle cx={toSX(clampedStep)} cy={toSY(filtPrices[clampedStep])} r={5}
        fill="#00b4d8" stroke="#0e0e18" strokeWidth={2} />
      <circle cx={toSX(clampedStep)} cy={toSY(measPrices[clampedStep])} r={4}
        fill="#e85d04" stroke="#0e0e18" strokeWidth={1.5} />

      {/* Axes */}
      <line x1={pad.left} x2={pad.left + cw} y1={pad.top + ch} y2={pad.top + ch} stroke="#444" strokeWidth={1} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + ch} stroke="#444" strokeWidth={1} />
      {xTicks.map(i => {
        const ts = timestamps[i];
        const label = ts
          ? new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', hour12: false })
          : String(i);
        return (
          <text key={i} x={toSX(i)} y={pad.top + ch + 16} textAnchor="middle" fill="#777" fontSize={9} fontFamily={MONO}>{label}</text>
        );
      })}
      {yTicks.map(y => (
        <text key={y} x={pad.left - 6} y={toSY(y) + 3} textAnchor="end" fill="#777" fontSize={9} fontFamily={MONO}>{fmtPrice(y)}</text>
      ))}

      {/* Title */}
      <text x={pad.left + cw / 2} y={12} textAnchor="middle" fill="#ccc" fontSize={13} fontWeight={700} fontFamily={SERIF}>
        Kálmán-szűrő — {symbol || 'BTCUSDT'} 1m (USDT)
      </text>

      {/* Legend */}
      <g transform={`translate(${pad.left + 10},${pad.top + 10})`}>
        {[
          { col: '#e85d04', label: 'Close ár', dot: true },
          { col: '#00b4d8', label: 'Kálmán-becslés', w: 2.2 },
        ].map((l, i) => (
          <g key={i} transform={`translate(0,${i * 16})`}>
            {l.dot ? (
              <circle cx={9} cy={0} r={3} fill={l.col} />
            ) : (
              <line x1={0} x2={18} y1={0} y2={0} stroke={l.col} strokeWidth={l.w} />
            )}
            <text x={24} y={3.5} fill="#aaa" fontSize={10} fontFamily={MONO}>{l.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
