import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ============================
// MATH HELPERS
// ============================
function normalPDF(x, mu = 0, sigma = 1) {
  const s2 = sigma * sigma;
  return (1 / Math.sqrt(2 * Math.PI * s2)) * Math.exp(-0.5 * ((x - mu) ** 2) / s2);
}
function normalCDF(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = z < 0 ? -1 : 1;
  const t = 1/(1+p*Math.abs(z));
  const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-z*z/2);
  return 0.5*(1+sign*y);
}
function charReal(t, mu = 0, sigma = 1) {
  return Math.exp(-0.5*sigma*sigma*t*t)*Math.cos(mu*t);
}
function charImag(t, mu = 0, sigma = 1) {
  return Math.exp(-0.5*sigma*sigma*t*t)*Math.sin(mu*t);
}
function charAbs(t, mu = 0, sigma = 1) {
  return Math.exp(-0.5*sigma*sigma*t*t);
}

// Seeded random for reproducibility
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function gaussRandom(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ============================
// KALMAN FILTER SIMULATION
// ============================
function runSimulation(Q, R, seed = 42) {
  const rng = mulberry32(seed);
  const N = 120;
  const dt = 1;

  // True signal: smooth sinusoidal + linear drift
  const truth = [];
  for (let i = 0; i < N; i++) {
    truth.push(3 * Math.sin(0.06 * i) + 0.02 * i + 1.5 * Math.sin(0.15 * i));
  }

  // Noisy measurements
  const measurements = truth.map(x => x + gaussRandom(rng) * Math.sqrt(R));

  // 1D Kalman filter (state = [position, velocity])
  let x_est = [measurements[0], 0]; // [pos, vel]
  let P = [[R, 0], [0, 1]]; // covariance

  const F = [[1, dt], [0, 1]]; // state transition
  const H = [[1, 0]]; // measurement matrix
  const Qmat = [[Q * dt * dt * dt / 3, Q * dt * dt / 2], [Q * dt * dt / 2, Q * dt]];

  const estimates = [{ mu: x_est[0], sigma: Math.sqrt(P[0][0]) }];
  const filteredPositions = [x_est[0]];

  for (let k = 1; k < N; k++) {
    // Predict
    const x_pred = [F[0][0]*x_est[0]+F[0][1]*x_est[1], F[1][0]*x_est[0]+F[1][1]*x_est[1]];
    const P_pred = [
      [F[0][0]*P[0][0]+F[0][1]*P[1][0], F[0][0]*P[0][1]+F[0][1]*P[1][1]],
      [F[1][0]*P[0][0]+F[1][1]*P[1][0], F[1][0]*P[0][1]+F[1][1]*P[1][1]],
    ];
    P_pred[0][0] += Qmat[0][0]; P_pred[0][1] += Qmat[0][1];
    P_pred[1][0] += Qmat[1][0]; P_pred[1][1] += Qmat[1][1];
    // Add F*P*F^T properly
    const FPFt = [
      [F[0][0]*(P[0][0]*F[0][0]+P[0][1]*F[1][0])+F[0][1]*(P[1][0]*F[0][0]+P[1][1]*F[1][0]),
       F[0][0]*(P[0][0]*F[0][1]+P[0][1]*F[1][1])+F[0][1]*(P[1][0]*F[0][1]+P[1][1]*F[1][1])],
      [F[1][0]*(P[0][0]*F[0][0]+P[0][1]*F[1][0])+F[1][1]*(P[1][0]*F[0][0]+P[1][1]*F[1][0]),
       F[1][0]*(P[0][0]*F[0][1]+P[0][1]*F[1][1])+F[1][1]*(P[1][0]*F[0][1]+P[1][1]*F[1][1])],
    ];
    const Pp = [
      [FPFt[0][0]+Qmat[0][0], FPFt[0][1]+Qmat[0][1]],
      [FPFt[1][0]+Qmat[1][0], FPFt[1][1]+Qmat[1][1]],
    ];

    // Update
    const S = Pp[0][0] + R; // H*P_pred*H^T + R
    const K = [Pp[0][0] / S, Pp[1][0] / S]; // Kalman gain
    const y_innov = measurements[k] - x_pred[0]; // innovation

    x_est = [x_pred[0] + K[0] * y_innov, x_pred[1] + K[1] * y_innov];
    P = [
      [(1 - K[0]) * Pp[0][0], (1 - K[0]) * Pp[0][1]],
      [Pp[1][0] - K[1] * Pp[0][0], Pp[1][1] - K[1] * Pp[0][1]],
    ];

    filteredPositions.push(x_est[0]);
    estimates.push({ mu: x_est[0], sigma: Math.sqrt(Math.max(P[0][0], 0.001)) });
  }

  return { truth, measurements, filteredPositions, estimates, N };
}

// ============================
// SVG CHART COMPONENTS
// ============================
const MONO = "'IBM Plex Mono',monospace";
const SERIF = "'Source Serif 4',Georgia,serif";

function TimeSeriesChart({ data, step, width, height }) {
  const { truth, measurements, filteredPositions, estimates, N } = data;
  const pad = { top: 20, right: 16, bottom: 32, left: 44 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  // Y-axis based on truth only so it doesn't jump when R changes
  const truthMin = Math.min(...truth);
  const truthMax = Math.max(...truth);
  const truthPad = (truthMax - truthMin) * 0.45 + 1;
  const yMin = truthMin - truthPad;
  const yMax = truthMax + truthPad;

  const toSX = i => pad.left + (i / (N - 1)) * cw;
  const toSY = y => pad.top + ch - ((y - yMin) / (yMax - yMin)) * ch;

  const buildLine = (arr) => arr.map((v, i) => `${i === 0 ? "M" : "L"} ${toSX(i)} ${toSY(v)}`).join(" ");

  // Confidence band (±2σ)
  let bandPath = `M ${toSX(0)} ${toSY(estimates[0].mu + 2 * estimates[0].sigma)}`;
  for (let i = 1; i < N; i++) bandPath += ` L ${toSX(i)} ${toSY(estimates[i].mu + 2 * estimates[i].sigma)}`;
  for (let i = N - 1; i >= 0; i--) bandPath += ` L ${toSX(i)} ${toSY(estimates[i].mu - 2 * estimates[i].sigma)}`;
  bandPath += " Z";

  const xTicks = [];
  for (let i = 0; i < N; i += 20) xTicks.push(i);

  const yStep = Math.ceil((yMax - yMin) / 6);
  const yTicks = [];
  for (let y = Math.ceil(yMin); y <= yMax; y += yStep) yTicks.push(y);

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {yTicks.map(y => <line key={y} x1={pad.left} x2={pad.left + cw} y1={toSY(y)} y2={toSY(y)} stroke="#1e1e30" strokeWidth={0.5} />)}

      {/* Confidence band */}
      <path d={bandPath} fill="#00b4d8" opacity={0.08} />

      {/* Measurement dots */}
      {measurements.map((v, i) => (
        <circle key={i} cx={toSX(i)} cy={toSY(v)} r={1.8}
          fill={i <= step ? "#e85d0480" : "#e85d0420"} />
      ))}

      {/* Truth */}
      <path d={buildLine(truth)} fill="none" stroke="#666" strokeWidth={1.5} strokeDasharray="4,3" />

      {/* Filtered */}
      <path d={buildLine(filteredPositions.slice(0, step + 1))} fill="none"
        stroke="#00b4d8" strokeWidth={2.2} strokeLinecap="round" />

      {/* Current step marker */}
      <line x1={toSX(step)} x2={toSX(step)} y1={pad.top} y2={pad.top + ch}
        stroke="#ffd16640" strokeWidth={1} />
      <circle cx={toSX(step)} cy={toSY(filteredPositions[step])} r={5}
        fill="#00b4d8" stroke="#0e0e18" strokeWidth={2} />
      <circle cx={toSX(step)} cy={toSY(measurements[step])} r={4}
        fill="#e85d04" stroke="#0e0e18" strokeWidth={1.5} />

      {/* Axes */}
      <line x1={pad.left} x2={pad.left + cw} y1={pad.top + ch} y2={pad.top + ch} stroke="#444" strokeWidth={1} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + ch} stroke="#444" strokeWidth={1} />
      {xTicks.map(i => (
        <g key={i}>
          <text x={toSX(i)} y={pad.top + ch + 16} textAnchor="middle" fill="#777" fontSize={9} fontFamily={MONO}>{i}</text>
        </g>
      ))}
      {yTicks.map(y => (
        <text key={y} x={pad.left - 6} y={toSY(y) + 3} textAnchor="end" fill="#777" fontSize={9} fontFamily={MONO}>{y.toFixed(0)}</text>
      ))}

      {/* Title */}
      <text x={pad.left + cw / 2} y={12} textAnchor="middle" fill="#ccc" fontSize={13} fontWeight={700} fontFamily={SERIF}>
        Kálmán-szűrő — Idősor
      </text>

      {/* Legend */}
      <g transform={`translate(${pad.left + 10},${pad.top + 10})`}>
        {[
          { col: "#666", dash: "4,3", label: "Valós jel", w: 1.5 },
          { col: "#e85d04", dash: "", label: "Zajos mérés", w: 2, dot: true },
          { col: "#00b4d8", dash: "", label: "Kálmán-becslés", w: 2.2 },
        ].map((l, i) => (
          <g key={i} transform={`translate(0,${i * 16})`}>
            {l.dot ? (
              <circle cx={9} cy={0} r={3} fill={l.col} />
            ) : (
              <line x1={0} x2={18} y1={0} y2={0} stroke={l.col} strokeWidth={l.w} strokeDasharray={l.dash || "none"} />
            )}
            <text x={24} y={3.5} fill="#aaa" fontSize={10} fontFamily={MONO}>{l.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function DistChart({ mu, sigma, measMu, measSigma, width, height, type }) {
  const range = 4.5;
  const xMin = mu - range * Math.max(sigma, measSigma);
  const xMax = mu + range * Math.max(sigma, measSigma);
  const pad = { top: 22, right: 14, bottom: 32, left: 42 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const isChar = type === "char";
  const tMin = isChar ? -8 : xMin;
  const tMax = isChar ? 8 : xMax;

  let maxY, minY;
  if (type === "pdf") {
    maxY = Math.max(normalPDF(mu, mu, sigma), normalPDF(measMu, measMu, measSigma)) * 1.25;
    minY = 0;
  } else if (type === "cdf") {
    maxY = 1.1; minY = 0;
  } else {
    maxY = 1.15; minY = -1.15;
  }

  const toSX = x => pad.left + ((x - tMin) / (tMax - tMin)) * cw;
  const toSY = y => pad.top + ch - ((y - minY) / (maxY - minY)) * ch;
  const steps = 300;

  function buildPath(fn) {
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = tMin + (i / steps) * (tMax - tMin);
      const y = Math.max(minY, Math.min(maxY, fn(x)));
      d += (i === 0 ? "M " : "L ") + toSX(x) + " " + toSY(y) + " ";
    }
    return d;
  }

  let curves = [];
  if (type === "pdf") {
    curves.push({ path: buildPath(x => normalPDF(x, mu, sigma)), col: "#00b4d8", label: "Becslés" });
    curves.push({ path: buildPath(x => normalPDF(x, measMu, measSigma)), col: "#e85d04", label: "Mérés", dash: "5,3" });
  } else if (type === "cdf") {
    curves.push({ path: buildPath(x => normalCDF(x, mu, sigma)), col: "#00b4d8", label: "Becslés" });
    curves.push({ path: buildPath(x => normalCDF(x, measMu, measSigma)), col: "#e85d04", label: "Mérés", dash: "5,3" });
  } else {
    curves.push({ path: buildPath(t => charReal(t, mu, sigma)), col: "#c77dff", label: "Re φ (becslés)" });
    curves.push({ path: buildPath(t => charImag(t, mu, sigma)), col: "#ff6d6d", label: "Im φ (becslés)" });
    curves.push({ path: buildPath(t => charAbs(t, mu, sigma)), col: "#ffd166", label: "|φ| (becslés)", dash: "5,3" });
    curves.push({ path: buildPath(t => charAbs(t, measMu, measSigma)), col: "#e85d0488", label: "|φ| (mérés)", dash: "2,3" });
  }

  // Axis ticks
  const xRange = tMax - tMin;
  const xStep = isChar ? 2 : xRange < 4 ? 0.5 : xRange < 10 ? 1 : 2;
  const xTicks = [];
  for (let x = Math.ceil(tMin / xStep) * xStep; x <= tMax; x += xStep) xTicks.push(Math.round(x * 100) / 100);

  const yStep = type === "pdf" ? maxY / 4 : isChar ? 0.5 : 0.25;
  const yTicks = [];
  for (let y = Math.ceil(minY / yStep) * yStep; y <= maxY; y += yStep) yTicks.push(Math.round(y * 1000) / 1000);

  const titles = { pdf: "Sűrűségfüggvény  f(x)", cdf: "Eloszlásfüggvény  F(x)", char: "Karakterisztikus fv.  φ(t)" };

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {yTicks.map(y => <line key={y} x1={pad.left} x2={pad.left + cw} y1={toSY(y)} y2={toSY(y)} stroke="#1e1e30" strokeWidth={0.5} />)}
      {isChar && <line x1={pad.left} x2={pad.left + cw} y1={toSY(0)} y2={toSY(0)} stroke="#333" strokeWidth={0.8} />}

      {curves.map((c, i) => (
        <path key={i} d={c.path} fill="none" stroke={c.col} strokeWidth={2}
          strokeLinecap="round" strokeDasharray={c.dash || "none"} />
      ))}

      {/* Axes */}
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
          {Math.abs(y) < 0.001 ? "0" : y.toFixed(2)}
        </text>
      ))}

      <text x={pad.left + cw / 2} y={13} textAnchor="middle" fill="#ccc" fontSize={12} fontWeight={700} fontFamily={SERIF}>
        {titles[type]}
      </text>

      {/* Legend */}
      <g transform={`translate(${pad.left + 8},${pad.top + 6})`}>
        {curves.map((c, i) => (
          <g key={i} transform={`translate(${i < 2 ? 0 : (i - 2) * 110},${i < 2 ? i * 14 : (i - 2) * 14})`}>
            <line x1={0} x2={16} y1={0} y2={0} stroke={c.col} strokeWidth={2} strokeDasharray={c.dash || "none"} />
            <text x={20} y={3.5} fill={c.col} fontSize={9} fontWeight={600} fontFamily={MONO}>{c.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ============================
// MAIN APP
// ============================
export default function KalmanApp() {
  const [Q, setQ] = useState(0.1);
  const [R, setR] = useState(2.0);
  const [step, setStep] = useState(60);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(false);

  const data = useMemo(() => runSimulation(Q, R, 42), [Q, R]);

  const est = data.estimates[step];
  const measVal = data.measurements[step];

  useEffect(() => {
    playRef.current = playing;
    if (!playing) return;
    const id = setInterval(() => {
      if (!playRef.current) return;
      setStep(s => {
        if (s >= data.N - 1) { setPlaying(false); return 0; }
        return s + 1;
      });
    }, 80);
    return () => clearInterval(id);
  }, [playing, data.N]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#0a0a14 0%,#0e1020 40%,#0a0a14 100%)",
      color: "#e0e0e8", fontFamily: SERIF, padding: "16px 10px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, letterSpacing: 1, margin: 0,
            background: "linear-gradient(90deg,#00b4d8,#c77dff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Kálmán-szűrő → PDF · CDF · Karakterisztikus függvény
          </h1>
          <p style={{ color: "#666", fontSize: 11, marginTop: 5, fontFamily: MONO }}>
            Zajos mérések → Kálmán-becslés (μ, σ²) → az eloszlás három arca
          </p>
        </div>

        {/* Time series */}
        <div style={{
          background: "#0d0d1c90", borderRadius: 12,
          border: "1px solid #1a1a30", padding: "6px 2px 2px",
        }}>
          <TimeSeriesChart data={data} step={step} width={920} height={220} />
        </div>

        {/* Controls row */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10, marginTop: 10,
        }}>
          {/* Time step */}
          <div style={{
            background: "#0d0d1c90", borderRadius: 10, border: "1px solid #1a1a30",
            padding: "10px 14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "#888" }}>
                Időlépés: <span style={{ color: "#ffd166", fontWeight: 700 }}>{step}</span>
              </span>
              <button onClick={() => { setPlaying(!playing); }}
                style={{
                  background: playing ? "#ff6d6d20" : "#00b4d820",
                  border: `1px solid ${playing ? "#ff6d6d" : "#00b4d8"}`,
                  color: playing ? "#ff6d6d" : "#00b4d8",
                  borderRadius: 6, padding: "3px 12px", cursor: "pointer",
                  fontFamily: MONO, fontSize: 11, fontWeight: 600,
                }}>
                {playing ? "⏸ Stop" : "▶ Lejátszás"}
              </button>
            </div>
            <input type="range" min={0} max={data.N - 1} step={1} value={step}
              onChange={e => { setStep(parseInt(e.target.value)); setPlaying(false); }}
              style={{ width: "100%", accentColor: "#ffd166", cursor: "pointer" }} />
          </div>

          {/* Process noise Q */}
          <div style={{
            background: "#0d0d1c90", borderRadius: 10, border: "1px solid #1a1a30",
            padding: "10px 14px",
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: "#888", marginBottom: 6 }}>
              Folyamatzaj Q: <span style={{ color: "#c77dff", fontWeight: 700 }}>{Q.toFixed(2)}</span>
            </div>
            <input type="range" min={0.01} max={2} step={0.01} value={Q}
              onChange={e => setQ(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#c77dff", cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, color: "#555", marginTop: 2 }}>
              <span>biztos modell</span><span>bizonytalan</span>
            </div>
          </div>

          {/* Measurement noise R */}
          <div style={{
            background: "#0d0d1c90", borderRadius: 10, border: "1px solid #1a1a30",
            padding: "10px 14px",
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: "#888", marginBottom: 6 }}>
              Mérési zaj R: <span style={{ color: "#e85d04", fontWeight: 700 }}>{R.toFixed(2)}</span>
            </div>
            <input type="range" min={0.1} max={8} step={0.1} value={R}
              onChange={e => setR(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#e85d04", cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, color: "#555", marginTop: 2 }}>
              <span>pontos szenzor</span><span>zajos szenzor</span>
            </div>
          </div>
        </div>

        {/* State info */}
        <div style={{
          marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
        }}>
          {[
            { label: "Kálmán-becslés", val: `μ = ${est.mu.toFixed(3)}`, sub: `σ = ${est.sigma.toFixed(3)}`, col: "#00b4d8" },
            { label: "Zajos mérés", val: `z = ${measVal.toFixed(3)}`, sub: `σ_mérés = ${Math.sqrt(R).toFixed(3)}`, col: "#e85d04" },
            { label: "Valós érték", val: `x = ${data.truth[step].toFixed(3)}`, sub: `hiba = ${Math.abs(data.truth[step] - est.mu).toFixed(3)}`, col: "#888" },
          ].map((item, i) => (
            <div key={i} style={{
              background: `${item.col}08`, borderRadius: 10,
              border: `1px solid ${item.col}30`, padding: "8px 14px",
              fontFamily: MONO, fontSize: 12,
            }}>
              <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
              <div style={{ color: item.col, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{item.val}</div>
              <div style={{ color: "#777", fontSize: 10, marginTop: 1 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* PDF + CDF row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div style={{
            background: "#0d0d1c90", borderRadius: 12,
            border: "1px solid #1a1a30", padding: "6px 2px 2px",
          }}>
            <DistChart mu={est.mu} sigma={est.sigma} measMu={measVal} measSigma={Math.sqrt(R)}
              width={450} height={210} type="pdf" />
          </div>
          <div style={{
            background: "#0d0d1c90", borderRadius: 12,
            border: "1px solid #1a1a30", padding: "6px 2px 2px",
          }}>
            <DistChart mu={est.mu} sigma={est.sigma} measMu={measVal} measSigma={Math.sqrt(R)}
              width={450} height={210} type="cdf" />
          </div>
        </div>

        {/* Characteristic function */}
        <div style={{
          marginTop: 10, background: "#0d0d1c90", borderRadius: 12,
          border: "1px solid #1a1a30", padding: "6px 2px 2px",
        }}>
          <DistChart mu={est.mu} sigma={est.sigma} measMu={measVal} measSigma={Math.sqrt(R)}
            width={920} height={200} type="char" />
        </div>

        {/* Explanation */}
        <div style={{
          marginTop: 12, background: "#00b4d808", borderRadius: 12,
          border: "1px solid #00b4d820", padding: "14px 18px",
        }}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: "#aaa" }}>
            <span style={{ color: "#00b4d8", fontWeight: 700 }}>▸ Kálmán-szűrő</span>{" "}
            — Minden lépésben egy <strong style={{ color: "#e85d04" }}>zajos mérést</strong> kapunk,
            és a szűrő ötvözi ezt az előző becslésből jövő <em>predikcióval</em>.
            Az eredmény: egy <strong style={{ color: "#00b4d8" }}>Gauss-eloszlás</strong> (μ, σ²),
            amely a rendszer állapotáról alkotott legjobb tudásunkat fejezi ki.
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.8, color: "#aaa" }}>
            <span style={{ color: "#c77dff", fontWeight: 700 }}>▸ A három arc</span>{" "}
            — Ugyanaz a Gauss-eloszlás három különböző nézőpontból: a <strong>pdf</strong> a helyi intenzitás,
            a <strong>CDF</strong> a kumulált valószínűség, a <strong style={{ color: "#c77dff" }}>karakterisztikus függvény</strong>{" "}
            φ(t) = e<sup>iμt − σ²t²/2</sup> pedig a Fourier-transzformált. Figyeld meg, hogy kisebb σ → szélesebb φ (és fordítva)!
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.8, color: "#aaa" }}>
            <span style={{ color: "#ffd166", fontWeight: 700 }}>▸ Próbáld ki</span>{" "}
            — Húzd a <strong>Q</strong> csúszkát (modell-bizonytalanság) és az <strong>R</strong> csúszkát (szenzorzaj),
            és figyeld, hogyan változik a szűrő viselkedése és az eloszlások alakja!
          </p>
        </div>
      </div>
    </div>
  );
}
