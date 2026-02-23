const SERIF = "'Source Serif 4',Georgia,serif";

export default function ExplanationPanel() {
  return (
    <div style={{
      marginTop: 12, background: '#00b4d808', borderRadius: 12,
      border: '1px solid #00b4d820', padding: '14px 18px',
    }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: '#aaa' }}>
        <span style={{ color: '#00b4d8', fontWeight: 700 }}>▸ Kálmán-szűrő</span>{' '}
        — A Bybit-ről érkező <strong style={{ color: '#e85d04' }}>1 perces gyertya close árakat</strong>{' '}
        z-score normalizáljuk egy 120 perces (2 órás) gördülő ablakon, majd a szűrő ötvözi
        az új mérést az előző becslésből jövő <em>predikcióval</em>.
        Az eredmény: egy <strong style={{ color: '#00b4d8' }}>Gauss-eloszlás</strong> (μ, σ²).
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.8, color: '#aaa' }}>
        <span style={{ color: '#c77dff', fontWeight: 700 }}>▸ A három arc</span>{' '}
        — Ugyanaz a Gauss-eloszlás három különböző nézőpontból: a <strong>PDF</strong> a helyi intenzitás,
        a <strong>CDF</strong> a kumulált valószínűség, a <strong style={{ color: '#c77dff' }}>karakterisztikus függvény</strong>{' '}
        φ(t) = e<sup>iμt − σ²t²/2</sup> pedig a Fourier-transzformált.
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.8, color: '#aaa' }}>
        <span style={{ color: '#ffd166', fontWeight: 700 }}>▸ Élő adat</span>{' '}
        — A WebSocket folyamatosan frissíti az adatot. A <strong>Q</strong> (modell-bizonytalanság) és{' '}
        <strong>R</strong> (mérési zaj) csúszkákkal hangolhatod a szűrő viselkedését.
        A <strong style={{ color: '#00ff88' }}>LIVE</strong> gomb az utolsó gyertyára ugrik.
      </p>
    </div>
  );
}
