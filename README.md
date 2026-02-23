# Kalman-szuro — PDF / CDF / Karakterisztikus fuggveny

Elo Bybit kriptovaluta-arfolyamok Kalman-szuressel torteno elemzese es harom valoszinusegelmeleti nezopont vizualizacioja bongeszoben, Vite alatt.

## Funkcionalitas

- **Elo adatforras**: Bybit perpetual futures 1 perces gyertya close arak WebSocket-en
- **Z-score normalizalas**: a bootstrap adathalmazbol szamolt atlag es szoras befagyasztva (fix kalibracio), igy az elo arak trendjei megorzodnek
- **Inverz z-score megjelenitese**: a Kalman-szuro z-score-okon dolgozik, de a charton es az info dobozokban az eredeti USDT arakat latjuk (visszaszamolva: `ar = z * std + mean`)
- **Kalman-szuro**: 1D allapotter-modell (pozicio + sebesseg), inkrementalisan dolgozza fel a z-score meresi pontokat
- **Harom eloszlas-nezet** egy rolling ablakon szamolva:
  - **PDF** (surusegfuggveny) — Gauss-gorbe a becslesi es meresi eloszlasra
  - **CDF** (eloszlasfuggveny) — kumulalt valoszinuseg
  - **Karakterisztikus fuggveny** phi(t) — Fourier-transzformalt: Re, Im es amplitudo
- **Interaktiv vezerles**: Q/R csuszkak, idolepesi slider, lejatszas/Live mod, eloszlas-ablak meret
- **Coin valtas**: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, DOGEUSDT
- **Ido-tengely**: az x-tengelyen 24 oras idoformatum (pl. 18:30)
- **Automatikus reconnect**: exponencialis backoff + gap-detection REST catch-up-pal

## Elinditasa

```bash
npm install
npm run dev
```

Bongeszoben: `http://localhost:5173`

**Python backend nem kell** — a Vite dev proxy kezeli a Bybit REST API CORS-t, a WebSocket kozvetlenul csatlakozik a bongeszobol.

## Projektstruktura

```
kalman_pdf_cdf_char/
  index.html                        Vite entry pont
  package.json                      Fuggosegek (react, vite)
  vite.config.js                    Proxy: /api/bybit -> api.bybit.com
  src/
    main.jsx                        React mount
    App.jsx                         Fo layout, state osszekotes
    hooks/
      useBybitData.js               REST bootstrap + WS stream + z-score + Kalman
    lib/
      mathHelpers.js                normalPDF, normalCDF, charReal, charImag, charAbs
      kalmanFilter.js               Inkrementalis KalmanFilter1D osztaly
      zscore.js                     Z-score normalizer (fix kalibracios modszer)
    components/
      TimeSeriesChart.jsx           Idosor SVG chart (USDT arak + Kalman vonal + ido x-tengely)
      DistChart.jsx                 PDF/CDF/Char.fv. SVG chart
      ControlPanel.jsx              Q/R sliderek, lepes slider, Live mod
      StateInfo.jsx                 Becsles/meres/innovacio info dobozok (USDT arban)
      ConnectionStatus.jsx          WS statusz + coin dropdown
      ExplanationPanel.jsx          Magyar nyelvu leiras
```

## Adat-pipeline

```
Bybit REST (240 gyertya bootstrap)
         |
         v
    Raw close arak
         |
         v
  ZScoreNormalizer.calibrate()  -->  mean, std kiszamitasa
         |
         v
  ZScoreNormalizer.freeze()     -->  mean/std befagyasztasa
         |
Bybit WS (kline.1.SYMBOL, confirm=true)
         |
         v
  ZScoreNormalizer.update()     -->  z = (close - frozen_mean) / frozen_std
         |
         v
  KalmanFilter1D.update(z)     -->  {mu, sigma, filtered}
         |
         v
  history[] --> React state
         |
         +-->  Inverz z-score (ar = z * std + mean)  -->  TimeSeriesChart (USDT)
         +-->  Inverz z-score                         -->  StateInfo (USDT)
         +-->  Rolling distWindow statisztika          -->  PDF / CDF / Char.fv. chartok
```

## Konfiguracio

### Bootstrap ablak (letoltendo gyertyak szama)

`src/hooks/useBybitData.js` 9. sor:

```js
const DEFAULT_WINDOW = 4*60; // 240 perc = 4 ora
```

Vagy az `App.jsx`-bol parameterkent:

```js
useBybitData(symbol, Q, R, 120) // 120 perc = 2 ora
```

A bootstrap adat egyben a z-score kalibracios ablak: ebbol szamolodik az atlag es szoras, ami utana befagy. A Bybit API maximum 1000 gyertyat ad vissza egy keresben.

### Kalman-szuro parameterek

Az UI-ban csuszkakkal allithato:

| Parameter | Leiras | Tartomany |
|-----------|--------|-----------|
| **Q** (folyamatzaj) | Modell-bizonytalansag. Kisebb Q = a szuro jobban bizik a modellben. | 0.01 - 2.0 |
| **R** (meresi zaj) | Szenzor-zaj. Nagyobb R = a szuro kevesbe bizik a meresekben. | 0.1 - 8.0 |

Q/R valtoztatasa az egesz history-t ujrafuttatja a szuron (rerunAll).

### Eloszlas ablak

Az "Eloszlas ablak" csuszka (alapertelmezet: 30 gyertya) hatarozza meg, hogy a PDF/CDF/Karakterisztikus fuggveny chartok az aktualis leptestol visszafele hany gyertyanyi adatbol szamolodnak. A charton az ablak cyan hattershavval es a Kalman-vonal vastagabb kek szinevel jelolodik.

## Bybit API

A projekt ket Bybit v5 publikus endpointot hasznal (nincs szukseg API kulcsra):

| Endpoint | Cel |
|----------|-----|
| `GET /v5/market/kline` | Bootstrap: tortenelmi 1m gyertyak letoltese (Vite proxy-n at) |
| `wss://stream.bybit.com/v5/public/linear` | Elo 1m kline stream (kozvetlen bongeszo WS) |

### WebSocket elet-ciklus

1. Bootstrap: REST-tel N gyertya letoltese + z-score kalibracio befagyasztasa
2. WS csatlakozas + feliratkozas: `kline.1.{SYMBOL}`
3. 20 masodperces ping keep-alive
4. Csak lezart gyertyakat (`confirm: true`) dolgoz fel a Kalman-szuro
5. Nem lezart gyertyaknal az elo arat frissiti
6. Lecsatlakozasnal: exponencialis backoff reconnect (1s -> 2s -> 4s -> ... -> max 30s)
7. Gap-eszkeles: ha tobb mint 1.5 perc kihagyast eszlel, REST-tel potol

## Technologiai stack

- **React 18** — komponensek, hookok (useState, useEffect, useMemo, useRef, useCallback)
- **Vite 6** — dev szerver, proxy, HMR
- **Nativ WebSocket API** — bongeszo-nativ, nincs kulon WS library
- **SVG** — chartok kezileg epitett SVG path-okkal (nincs charting library)
- **CSS-in-JS** — inline stilusok, nincs kulon CSS fajl
- **IBM Plex Mono + Source Serif 4** — Google Fonts

Nulla runtime fuggoseg a React-en kivul.

## Matematikai hatter

### Kalman-szuro

Allapotter-modell: `x = [pozicio, sebesseg]^T`

- **Allapot-atmenet**: `F = [[1, dt], [0, 1]]`
- **Meresi matrix**: `H = [1, 0]`
- **Predikcios lepes**: `x_pred = F * x_est`, `P_pred = F * P * F^T + Q`
- **Frissitesi lepes**: Kalman-gain `K = P_pred * H^T / (H * P_pred * H^T + R)`, innovacio `y = z - H * x_pred`
- **Eredmeny**: Gauss-eloszlas N(mu, sigma^2) minden idolepesben

### Z-score normalizalas (fix kalibracio)

```
Kalibracios fazis (bootstrap):
  mean, std = a teljes bootstrap adathalmaz atlaga es szorasa
  freeze() -> mean es std tobbe nem valtozik

Elo fazis (WS):
  z_i = (close_i - frozen_mean) / frozen_std
```

Ez a megkozelites megorizni a trendeket: ha az arfolyam esik, a z-score ertekek egyre kisebbek lesznek (nem torzul el a folyamatosan valtozo atlag altal).

### Inverz z-score (megjelenittes)

```
ar_i = z_i * frozen_std + frozen_mean
```

A charton es az info dobozokban az eredeti USDT arak lathatoak. A Kalman-szuro belsejeben z-score-ok futnak, de a felhasznalo szamara atlathatoan arfolyamot mutatunk.

### Eloszlas-vizualizaciok (rolling ablakon)

| Nez | Keplet |
|-----|--------|
| PDF | f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2 / (2*sigma^2)) |
| CDF | F(x) = 0.5 * (1 + erf((x-mu) / (sigma*sqrt(2)))) |
| Char.fv. | phi(t) = exp(i*mu*t - sigma^2*t^2/2) |

A mu es sigma a rolling ablakon beluli filtered / measurement ertekek atlagabol es szorasabol szamolodik.
