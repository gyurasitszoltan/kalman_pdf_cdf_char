import { normalPDF, normalCDF, charReal, charImag, charAbs } from '../lib/mathHelpers.js';

const MONO = "'IBM Plex Mono',monospace";
const SERIF = "'Source Serif 4',Georgia,serif";

export default function DistChart({ mu, sigma, measMu, measSigma, width, height, type }) {
  const range = 4.5;
  const xMin = mu - range * Math.max(sigma, measSigma);
  const xMax = mu + range * Math.max(sigma, measSigma);
  const pad = { top: 22, right: 14, bottom: 32, left: 42 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const isChar = type === 'char';
  const tMin = isChar ? -8 : xMin;
  const tMax = isChar ? 8 : xMax;

  let maxY, minY;
  if (type === 'pdf') {
    maxY = Math.max(normalPDF(mu, mu, sigma), normalPDF(measMu, measMu, measSigma)) * 1.25;
    minY = 0;
  } else if (type === 'cdf') {
    maxY = 1.1; minY = 0;
  } else {
    maxY = 1.15; minY = -1.15;
  }

  const toSX = x => pad.left + ((x - tMin) / (tMax - tMin)) * cw;
  const toSY = y => pad.top + ch - ((y - minY) / (maxY - minY)) * ch;
  const steps = 300;

  function buildPath(fn) {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const x = tMin + (i / steps) * (tMax - tMin);
      const y = Math.max(minY, Math.min(maxY, fn(x)));
      d += (i === 0 ? 'M ' : 'L ') + toSX(x) + ' ' + toSY(y) + ' ';
    }
    return d;
  }

  let curves = [];
  if (type === 'pdf') {
    curves.push({ path: buildPath(x => normalPDF(x, mu, sigma)), col: '#00b4d8', label: 'Becslés' });
    curves.push({ path: buildPath(x => normalPDF(x, measMu, measSigma)), col: '#e85d04', label: 'Mérés', dash: '5,3' });
  } else if (type === 'cdf') {
    curves.push({ path: buildPath(x => normalCDF(x, mu, sigma)), col: '#00b4d8', label: 'Becslés' });
    curves.push({ path: buildPath(x => normalCDF(x, measMu, measSigma)), col: '#e85d04', label: 'Mérés', dash: '5,3' });
  } else {
    curves.push({ path: buildPath(t => charReal(t, mu, sigma)), col: '#c77dff', label: 'Re φ (becslés)' });
    curves.push({ path: buildPath(t => charImag(t, mu, sigma)), col: '#ff6d6d', label: 'Im φ (becslés)' });
    curves.push({ path: buildPath(t => charAbs(t, mu, sigma)), col: '#ffd166', label: '|φ| (becslés)', dash: '5,3' });
    curves.push({ path: buildPath(t => charAbs(t, measMu, measSigma)), col: '#e85d0488', label: '|φ| (mérés)', dash: '2,3' });
  }

  const xRange = tMax - tMin;
  const xStep = isChar ? 2 : xRange < 4 ? 0.5 : xRange < 10 ? 1 : 2;
  const xTicks = [];
  for (let x = Math.ceil(tMin / xStep) * xStep; x <= tMax; x += xStep) xTicks.push(Math.round(x * 100) / 100);

  const yStep = type === 'pdf' ? maxY / 4 : isChar ? 0.5 : 0.25;
  const yTicks = [];
  for (let y = Math.ceil(minY / yStep) * yStep; y <= maxY; y += yStep) yTicks.push(Math.round(y * 1000) / 1000);

  const titles = { pdf: 'Sűrűségfüggvény  f(x)', cdf: 'Eloszlásfüggvény  F(x)', char: 'Karakterisztikus fv.  φ(t)' };

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {yTicks.map(y => <line key={y} x1={pad.left} x2={pad.left + cw} y1={toSY(y)} y2={toSY(y)} stroke="#1e1e30" strokeWidth={0.5} />)}
      {isChar && <line x1={pad.left} x2={pad.left + cw} y1={toSY(0)} y2={toSY(0)} stroke="#333" strokeWidth={0.8} />}

      {curves.map((c, i) => (
        <path key={i} d={c.path} fill="none" stroke={c.col} strokeWidth={2}
          strokeLinecap="round" strokeDasharray={c.dash || 'none'} />
      ))}

      <line x1={pad.left} x2={pad.left + cw} y1={toSY(minY)} y2={toSY(minY)} stroke="#444" strokeWidth={1} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={toSY(minY)} stroke="#444" strokeWidth={1} />
      {xTicks.map(x => (
        <g key={x}>
          <line x1={toSX(x)} x2={toSX(x)} y1={toSY(minY)} y2={toSY(minY) + 4} stroke="#555" />
          <text x={toSX(x)} y={toSY(minY) + 15} textAnchor="middle" fill="#777" fontSize={9} fontFamily={MONO}>{x}</text>
        </g>
      ))}
      {yTicks.filter(y => y !== minY).map(y => (
        <text key={y} x={pad.left - 5} y={toSY(y) + 3} textAnchor="end" fill="#777" fontSize={8} fontFamily={MONO}>
          {Math.abs(y) < 0.001 ? '0' : y.toFixed(2)}
        </text>
      ))}

      <text x={pad.left + cw / 2} y={13} textAnchor="middle" fill="#ccc" fontSize={12} fontWeight={700} fontFamily={SERIF}>
        {titles[type]}
      </text>

      <g transform={`translate(${pad.left + 8},${pad.top + 6})`}>
        {curves.map((c, i) => (
          <g key={i} transform={`translate(${i < 2 ? 0 : (i - 2) * 110},${i < 2 ? i * 14 : (i - 2) * 14})`}>
            <line x1={0} x2={16} y1={0} y2={0} stroke={c.col} strokeWidth={2} strokeDasharray={c.dash || 'none'} />
            <text x={20} y={3.5} fill={c.col} fontSize={9} fontWeight={600} fontFamily={MONO}>{c.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
