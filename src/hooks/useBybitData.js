import { useState, useEffect, useRef, useCallback } from 'react';
import { ZScoreNormalizer } from '../lib/zscore.js';
import { KalmanFilter1D } from '../lib/kalmanFilter.js';

const WS_URL = 'wss://stream.bybit.com/v5/public/linear';
const PING_INTERVAL = 20000;
const MAX_RECONNECT_DELAY = 30000;
const GAP_THRESHOLD_MS = 90000;
const DEFAULT_WINDOW = 1*60; // 120 perc = 2 óra

export function useBybitData(symbol, Q, R, windowSize = DEFAULT_WINDOW) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [candleCount, setCandleCount] = useState(0);
  const [lastPrice, setLastPrice] = useState(null);
  const [normStats, setNormStats] = useState(null);

  const zscoreRef = useRef(new ZScoreNormalizer());
  const kalmanRef = useRef(new KalmanFilter1D(Q, R));
  const rawMeasurementsRef = useRef([]);
  const rawPricesRef = useRef([]);
  const timestampsRef = useRef([]);
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(1000);
  const lastCandleTimeRef = useRef(0);
  const symbolRef = useRef(symbol);
  const mountedRef = useRef(true);
  const versionRef = useRef(0);

  // Rerun Kalman filter when Q/R changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rawMeasurementsRef.current.length === 0) return;
      kalmanRef.current.setParams(Q, R);
      kalmanRef.current.rerunAll(rawMeasurementsRef.current);
      setHistory([...kalmanRef.current.history]);
    }, 50);
    return () => clearTimeout(timer);
  }, [Q, R]);

  const processCandle = useCallback((closePrice, startTime) => {
    const { z } = zscoreRef.current.update(closePrice);
    rawMeasurementsRef.current.push(z);
    rawPricesRef.current.push(closePrice);
    timestampsRef.current.push(startTime);
    kalmanRef.current.update(z);
    lastCandleTimeRef.current = startTime;

    if (mountedRef.current) {
      setHistory([...kalmanRef.current.history]);
      setCandleCount(rawMeasurementsRef.current.length);
      setLastPrice(closePrice);
      setNormStats({ ...zscoreRef.current.stats });
    }
  }, []);

  const fetchMissingCandles = useCallback(async (sym, fromTime, toTime) => {
    try {
      const url = `/api/bybit/v5/market/kline?category=linear&symbol=${sym}&interval=1&start=${fromTime}&end=${toTime}&limit=200`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      if (json.retCode !== 0) return [];
      const list = [...(json.result?.list || [])].reverse();
      return list.map(c => ({ close: parseFloat(c[4]), start: parseInt(c[0]) }));
    } catch {
      return [];
    }
  }, []);

  const connectWebSocket = useCallback((sym) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearInterval(pingRef.current);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`kline.1.${sym}`] }));
      reconnectDelayRef.current = 1000;
      if (mountedRef.current) {
        setStatus('connected');
        setError(null);
      }

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = async (event) => {
      // Stale WS guard: ha közben coin-t váltottunk, eldobjuk
      if (symbolRef.current !== sym) return;

      const msg = JSON.parse(event.data);
      if (!msg.topic || !msg.data) return;

      const candle = msg.data[0];
      if (!candle) return;

      const closePrice = parseFloat(candle.close);
      const startTime = parseInt(candle.start);

      // Update live price for non-confirmed candles too
      if (mountedRef.current) {
        setLastPrice(closePrice);
      }

      // Only process confirmed (closed) candles into the filter
      if (!candle.confirm) return;

      // Gap detection: fetch missing candles if needed
      if (lastCandleTimeRef.current > 0 && startTime - lastCandleTimeRef.current > GAP_THRESHOLD_MS) {
        const missing = await fetchMissingCandles(sym, lastCandleTimeRef.current + 60000, startTime);
        // Recheck after async gap-fill
        if (symbolRef.current !== sym) return;
        for (const mc of missing) {
          if (mc.start > lastCandleTimeRef.current && mc.start < startTime) {
            processCandle(mc.close, mc.start);
          }
        }
      }

      processCandle(closePrice, startTime);
    };

    ws.onclose = () => {
      clearInterval(pingRef.current);
      if (!mountedRef.current) return;
      if (symbolRef.current !== sym) return;
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY);
        connectWebSocket(sym);
      }, reconnectDelayRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [processCandle, fetchMissingCandles]);

  // Bootstrap + WS connect on symbol change
  useEffect(() => {
    mountedRef.current = true;
    symbolRef.current = symbol;
    const version = ++versionRef.current;

    // Reset state
    zscoreRef.current = new ZScoreNormalizer();
    kalmanRef.current = new KalmanFilter1D(Q, R);
    rawMeasurementsRef.current = [];
    rawPricesRef.current = [];
    timestampsRef.current = [];
    lastCandleTimeRef.current = 0;

    setStatus('bootstrapping');
    setError(null);
    setHistory([]);
    setCandleCount(0);
    setLastPrice(null);
    setNormStats(null);

    // Close existing WS
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearInterval(pingRef.current);
    clearTimeout(reconnectTimerRef.current);

    (async () => {
      try {
        const url = `/api/bybit/v5/market/kline?category=linear&symbol=${symbol}&interval=1&limit=${windowSize}`;
        const res = await fetch(url);

        // Ha közben coin-t váltottunk, eldobjuk a régi fetch eredményét
        if (versionRef.current !== version) return;

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.retCode !== 0) throw new Error(json.retMsg || 'Bybit API error');

        const list = json.result?.list;
        if (!list || list.length === 0) throw new Error('No kline data returned');

        // Reverse: API returns newest-first, we need oldest-first
        const candles = [...list].reverse();

        for (const c of candles) {
          const closePrice = parseFloat(c[4]);
          const startTime = parseInt(c[0]);
          processCandle(closePrice, startTime);
        }

        // Kalibrációs fázis vége: mean/std befagyasztása
        zscoreRef.current.freeze();

        if (mountedRef.current && versionRef.current === version) {
          // Explicit normStats frissítés a freeze után
          setNormStats({ ...zscoreRef.current.stats });
          connectWebSocket(symbol);
        }
      } catch (err) {
        if (mountedRef.current && versionRef.current === version) {
          setStatus('error');
          setError(`Bootstrap hiba: ${err.message}`);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      clearInterval(pingRef.current);
      clearTimeout(reconnectTimerRef.current);
    };
  }, [symbol, windowSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visibility change handler: check connection when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wsRef.current) {
        if (wsRef.current.readyState !== WebSocket.OPEN) {
          setStatus('reconnecting');
          connectWebSocket(symbolRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connectWebSocket]);

  return {
    status,
    error,
    history,
    candleCount,
    lastPrice,
    normStats,
    timestamps: timestampsRef.current,
    rawPrices: rawPricesRef.current,
  };
}
