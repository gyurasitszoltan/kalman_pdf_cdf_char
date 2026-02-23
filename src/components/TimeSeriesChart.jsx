import { useMemo } from 'react';

const MONO = "'IBM Plex Mono',monospace";
const SERIF = "'Source Serif 4',Georgia,serif";

export default function TimeSeriesChart({ history, step, width, height, symbol }) {
  const N = history.length;
  if (N === 0) return null;

  const measurements = useMemo(() => history.map(h => h.measurement), [history]);
  const filteredPositions = useMemo(() => history.map(h => h.filtered), [history]);
  const estimates = useMemo(() => history.map(h => ({ mu: h.mu, sigma: h.sigma })), [history]);

  const pad = { top: 20, right: 16, bottom: 32, left: 44 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const allVals = useMemo(() => [...measurements, ...filteredPositions], [measurements, filteredPositions]);
  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const dataPad = (dataMax - dataMin) * 0.25 + 0.5;
  const yMin = dataMin - dataPad;
  const yMax = dataMax + dataPad;

  const toSX = i => pad.left + (i / Math.max(N - 1, 1)) * cw;
  const toSY = y => pad.top + ch - ((y - yMin) / (yMax - yMin)) * ch;

  const buildLine = (arr, count) => {
    let d = '';
    for (let i = 0; i < count; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${toSX(i)} ${toSY(arr[i])} `;
    }
    return d;
  };

  // Confidence band (±2σ)
  let bandPath = `M ${toSX(0)} ${toSY(estimates[0].mu + 2 * estimates[0].sigma)}`;
  for (let i = 1; i < N; i++) bandPath += ` L ${toSX(i)} ${toSY(estimates[i].mu + 2 * estimates[i].sigma)}`;
  for (let i = N - 1; i >= 0; i--) bandPath += ` L ${toSX(i)} ${toSY(estimates[i].mu - 2 * estimates[i].sigma)}`;
  bandPath += ' Z';

  const xTicks = [];
  const xStep = Math.max(1, Math.floor(N / 6));
  for (let i = 0; i < N; i += xStep) xTicks.push(i);

  const yRange = yMax - yMin;
  const yStep = yRange < 2 ? 0.5 : yRange < 6 ? 1 : Math.ceil(yRange / 6);
  const yTicks = [];
  for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) yTicks.push(Math.round(y * 100) / 100);

  const clampedStep = Math.min(step, N - 1);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {yTicks.map(y => <line key={y} x1={pad.left} x2={pad.left + cw} y1={toSY(y)} y2={toSY(y)} stroke="#1e1e30" strokeWidth={0.5} />)}

      {/* Confidence band */}
      <path d={bandPath} fill="#00b4d8" opacity={0.08} />

      {/* Measurement dots */}
      {measurements.map((v, i) => (
        <circle key={i} cx={toSX(i)} cy={toSY(v)} r={1.8}
          fill={i <= clampedStep ? '#e85d0480' : '#e85d0420'} />
      ))}

      {/* Filtered line */}
      <path d={buildLine(filteredPositions, clampedStep + 1)} fill="none"
        stroke="#00b4d8" strokeWidth={2.2} strokeLinecap="round" />

      {/* Current step marker */}
      <line x1={toSX(clampedStep)} x2={toSX(clampedStep)} y1={pad.top} y2={pad.top + ch}
        stroke="#ffd16640" strokeWidth={1} />
      <circle cx={toSX(clampedStep)} cy={toSY(filteredPositions[clampedStep])} r={5}
        fill="#00b4d8" stroke="#0e0e18" strokeWidth={2} />
      <circle cx={toSX(clampedStep)} cy={toSY(measurements[clampedStep])} r={4}
        fill="#e85d04" stroke="#0e0e18" strokeWidth={1.5} />

      {/* Axes */}
      <line x1={pad.left} x2={pad.left + cw} y1={pad.top + ch} y2={pad.top + ch} stroke="#444" strokeWidth={1} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + ch} stroke="#444" strokeWidth={1} />
      {xTicks.map(i => (
        <text key={i} x={toSX(i)} y={pad.top + ch + 16} textAnchor="middle" fill="#777" fontSize={9} fontFamily={MONO}>{i}</text>
      ))}
      {yTicks.map(y => (
        <text key={y} x={pad.left - 6} y={toSY(y) + 3} textAnchor="end" fill="#777" fontSize={9} fontFamily={MONO}>{y.toFixed(1)}</text>
      ))}

      {/* Title */}
      <text x={pad.left + cw / 2} y={12} textAnchor="middle" fill="#ccc" fontSize={13} fontWeight={700} fontFamily={SERIF}>
        Kálmán-szűrő — {symbol || 'BTCUSDT'} 1m (z-score)
      </text>

      {/* Legend */}
      <g transform={`translate(${pad.left + 10},${pad.top + 10})`}>
        {[
          { col: '#e85d04', label: 'Z-score mérés', dot: true },
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
