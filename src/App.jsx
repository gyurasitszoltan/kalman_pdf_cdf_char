import { useState, useEffect, useRef, useMemo } from 'react';
import { useBybitData } from './hooks/useBybitData.js';
import TimeSeriesChart from './components/TimeSeriesChart.jsx';
import DistChart from './components/DistChart.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import StateInfo from './components/StateInfo.jsx';
import ConnectionStatus from './components/ConnectionStatus.jsx';
import ExplanationPanel from './components/ExplanationPanel.jsx';

const SERIF = "'Source Serif 4',Georgia,serif";
const MONO = "'IBM Plex Mono',monospace";

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [Q, setQ] = useState(0.1);
  const [R, setR] = useState(2.0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [distWindow, setDistWindow] = useState(30);
  const playRef = useRef(false);

  const {
    status, error, history, candleCount, lastPrice, normStats, timestamps,
  } = useBybitData(symbol, Q, R);

  const maxStep = Math.max(0, history.length - 1);
  const clampedStep = Math.min(step, maxStep);

  // Live mode: auto-advance step to latest candle
  useEffect(() => {
    if (liveMode && history.length > 0) {
      setStep(history.length - 1);
    }
  }, [liveMode, history.length]);

  // Play animation
  useEffect(() => {
    playRef.current = playing;
    if (!playing) return;
    const id = setInterval(() => {
      if (!playRef.current) return;
      setStep(s => {
        if (s >= maxStep) { setPlaying(false); return 0; }
        return s + 1;
      });
    }, 80);
    return () => clearInterval(id);
  }, [playing, maxStep]);

  const handleStepChange = (s) => {
    setStep(s);
    setLiveMode(false);
    setPlaying(false);
  };

  const handlePlayToggle = () => {
    setLiveMode(false);
    setPlaying(!playing);
  };

  const est = history[clampedStep] || null;
  const measVal = est ? est.measurement : 0;

  // Rolling window statistics for distribution charts
  const distStats = useMemo(() => {
    if (history.length === 0) return null;
    const end = clampedStep + 1;
    const start = Math.max(0, end - distWindow);
    const slice = history.slice(start, end);
    const n = slice.length;
    if (n === 0) return null;

    const filtVals = slice.map(h => h.filtered);
    const measVals = slice.map(h => h.measurement);

    const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const std = (arr, m) => {
      if (arr.length < 2) return 0.01;
      const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
      return Math.sqrt(v) || 0.01;
    };

    const filtMu = mean(filtVals);
    const filtSigma = std(filtVals, filtMu);
    const measMu = mean(measVals);
    const measSigma = std(measVals, measMu);

    return { filtMu, filtSigma, measMu, measSigma, n };
  }, [history, clampedStep, distWindow]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0a0a14 0%,#0e1020 40%,#0a0a14 100%)',
      color: '#e0e0e8', fontFamily: SERIF, padding: '16px 10px',
    }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, letterSpacing: 1, margin: 0,
            background: 'linear-gradient(90deg,#00b4d8,#c77dff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Kálmán-szűrő → PDF · CDF · Karakterisztikus függvény
          </h1>
          <p style={{ color: '#666', fontSize: 11, marginTop: 5, fontFamily: MONO }}>
            Bybit {symbol} 1m close → z-score → Kálmán-becslés (μ, σ²) → az eloszlás három arca
          </p>
          {timestamps.length > 0 && (
            <p style={{ color: '#555', fontSize: 11, marginTop: 4, fontFamily: MONO }}>
              <span style={{ color: '#ffd166' }}>
                {new Date(timestamps[0]).toLocaleString('hu-HU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              {' → '}
              <span style={{ color: '#00ff88' }}>
                {new Date(timestamps[timestamps.length - 1]).toLocaleString('hu-HU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ color: '#444' }}>{' '}({timestamps.length} gyertya)</span>
            </p>
          )}
        </div>

        {/* Connection status + coin selector */}
        <ConnectionStatus
          status={status} error={error} symbol={symbol}
          onSymbolChange={setSymbol} candleCount={candleCount}
          normStats={normStats}
        />

        {/* Loading state */}
        {history.length === 0 && status !== 'error' && (
          <div style={{
            textAlign: 'center', padding: '60px 0', color: '#555',
            fontFamily: MONO, fontSize: 13,
          }}>
            {status === 'bootstrapping' ? 'Bootstrap: 120 gyertya letöltése...' : 'Betöltés...'}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={{
            textAlign: 'center', padding: '60px 0', color: '#ff6d6d',
            fontFamily: MONO, fontSize: 13,
          }}>
            {error || 'Ismeretlen hiba'}
            <br />
            <button
              onClick={() => setSymbol(s => s)}
              style={{
                marginTop: 12, background: '#ff6d6d20', border: '1px solid #ff6d6d',
                color: '#ff6d6d', borderRadius: 6, padding: '6px 16px',
                fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
            >
              Újrapróbálás
            </button>
          </div>
        )}

        {history.length > 0 && (
          <>
            {/* Time series */}
            <div style={{
              background: '#0d0d1c90', borderRadius: 12,
              border: '1px solid #1a1a30', padding: '6px 2px 2px',
            }}>
              <TimeSeriesChart history={history} step={clampedStep} width={920} height={220} symbol={symbol} />
            </div>

            {/* Controls */}
            <ControlPanel
              step={clampedStep} maxStep={maxStep}
              onStepChange={handleStepChange}
              playing={playing} onPlayToggle={handlePlayToggle}
              Q={Q} onQChange={setQ} R={R} onRChange={setR}
              liveMode={liveMode}
              onLiveModeToggle={() => setLiveMode(!liveMode)}
            />

            {/* State info */}
            <StateInfo est={est} measVal={measVal} R={R} lastPrice={lastPrice} normStats={normStats} />

            {/* Distribution window slider */}
            <div style={{
              marginTop: 10, background: '#0d0d1c90', borderRadius: 10,
              border: '1px solid #1a1a30', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                Eloszlás ablak: <span style={{ color: '#22d3ee', fontWeight: 700 }}>{distWindow}</span>
                <span style={{ color: '#555' }}> gyertya</span>
              </span>
              <input type="range" min={5} max={Math.max(5, clampedStep + 1)} step={1} value={distWindow}
                onChange={e => setDistWindow(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#22d3ee', cursor: 'pointer' }} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#555', whiteSpace: 'nowrap' }}>
                [{Math.max(0, clampedStep + 1 - distWindow)}–{clampedStep}]
              </span>
            </div>

            {/* PDF + CDF row */}
            {distStats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div style={{
                    background: '#0d0d1c90', borderRadius: 12,
                    border: '1px solid #1a1a30', padding: '6px 2px 2px',
                  }}>
                    <DistChart mu={distStats.filtMu} sigma={distStats.filtSigma}
                      measMu={distStats.measMu} measSigma={distStats.measSigma}
                      width={450} height={210} type="pdf" />
                  </div>
                  <div style={{
                    background: '#0d0d1c90', borderRadius: 12,
                    border: '1px solid #1a1a30', padding: '6px 2px 2px',
                  }}>
                    <DistChart mu={distStats.filtMu} sigma={distStats.filtSigma}
                      measMu={distStats.measMu} measSigma={distStats.measSigma}
                      width={450} height={210} type="cdf" />
                  </div>
                </div>

                {/* Characteristic function */}
                <div style={{
                  marginTop: 10, background: '#0d0d1c90', borderRadius: 12,
                  border: '1px solid #1a1a30', padding: '6px 2px 2px',
                }}>
                  <DistChart mu={distStats.filtMu} sigma={distStats.filtSigma}
                    measMu={distStats.measMu} measSigma={distStats.measSigma}
                    width={920} height={200} type="char" />
                </div>
              </>
            )}

            {/* Explanation */}
            <ExplanationPanel />
          </>
        )}
      </div>
    </div>
  );
}
