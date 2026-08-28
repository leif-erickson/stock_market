'use strict';

const { rsi, sessionVwap, openingRange, relativeVolume } = require('./indicators');

class Candle {
  constructor(row = {}) {
    this.symbol = row.symbol;
    this.ts = row.ts;
    this.open = Number(row.open);
    this.high = Number(row.high);
    this.low = Number(row.low);
    this.close = Number(row.close);
    this.volume = Number(row.volume ?? 0);
    this.sessionDate = row.sessionDate || row.session_date || null;
    this.minuteOfDay = row.minuteOfDay ?? row.minute_of_day ?? null;
    this.timeframe = row.timeframe || '5m';
    this.source = row.source || null;
  }

  range() {
    return this.high - this.low;
  }

  body() {
    return Math.abs(this.close - this.open);
  }

  upperWick() {
    return this.high - Math.max(this.open, this.close);
  }

  lowerWick() {
    return Math.min(this.open, this.close) - this.low;
  }

  isBullish() {
    return this.close > this.open;
  }

  closesInUpperThird() {
    const span = this.range();
    if (!(span > 0)) return false;
    return (this.close - this.low) / span >= 2 / 3;
  }

  pinBar(threshold = 2) {
    const body = this.body();
    const wick = Math.max(this.upperWick(), this.lowerWick());
    if (!(wick > 0)) return false;
    if (!(body > 0)) return wick > 0;
    return wick >= threshold * body;
  }

  bullishPin(threshold = 2) {
    return this.pinBar(threshold) && this.lowerWick() > this.upperWick() && this.isBullish();
  }

  engulfs(prev) {
    if (!prev) return false;
    const prevBody = typeof prev.body === 'function' ? prev.body() : Math.abs(Number(prev.close) - Number(prev.open));
    return this.high >= Number(prev.high)
      && this.low <= Number(prev.low)
      && this.body() > prevBody
      && this.isBullish() !== (typeof prev.isBullish === 'function' ? prev.isBullish() : Number(prev.close) > Number(prev.open));
  }

  toRow() {
    return {
      symbol: this.symbol,
      ts: this.ts,
      open: this.open,
      high: this.high,
      low: this.low,
      close: this.close,
      volume: this.volume,
      sessionDate: this.sessionDate,
      minuteOfDay: this.minuteOfDay,
      timeframe: this.timeframe,
      source: this.source,
    };
  }
}

function priorVolumesAtMinute(priorSessions, minuteOfDay) {
  const vols = [];
  for (const session of priorSessions) {
    const bars = session.candles || session;
    const match = (bars || []).find((b) => (b.minuteOfDay ?? b.minute_of_day) === minuteOfDay);
    if (match) vols.push(Number(match.volume));
  }
  return vols;
}

class Session {
  constructor(candles, { config, priorSessions = [], regime = 'quiet', assetClass = 'stocks' } = {}) {
    this.candles = candles.map((c) => (c instanceof Candle ? c : new Candle(c)));
    this.config = config || {};
    this.priorSessions = priorSessions;
    this.regime = regime;
    this.assetClass = assetClass;
  }

  static fromBars(bars, opts = {}) {
    const cfg = opts.config || {};
    const start = cfg.rthStartMinute ?? 9 * 60 + 30;
    const end = cfg.rthEndMinute ?? 16 * 60;
    const rth = (bars || []).filter((b) => {
      const m = b.minuteOfDay ?? b.minute_of_day;
      return m >= start && m < end;
    });
    return new Session(rth, opts);
  }

  static fromRows(rows, opts = {}) {
    return Session.fromBars(rows, opts);
  }

  openingRange(n) {
    return openingRange(this.candles, n ?? this.config.orBars ?? 3);
  }

  vwapSeries() {
    return sessionVwap(this.candles);
  }

  rsiSeries(period) {
    return rsi(this.candles.map((c) => c.close), period ?? this.config.rsiPeriod ?? 14);
  }

  swings(lookback = 3) {
    const out = [];
    const bars = this.candles;
    for (let i = lookback; i < bars.length - lookback; i += 1) {
      const window = bars.slice(i - lookback, i + lookback + 1);
      const highs = window.map((c) => c.high);
      const lows = window.map((c) => c.low);
      if (bars[i].high === Math.max(...highs)) {
        out.push({ kind: 'high', index: i, price: bars[i].high, ts: bars[i].ts });
      }
      if (bars[i].low === Math.min(...lows)) {
        out.push({ kind: 'low', index: i, price: bars[i].low, ts: bars[i].ts });
      }
    }
    return out;
  }

  trendFromSwings() {
    const swings = this.swings();
    const highs = swings.filter((s) => s.kind === 'high').slice(-2);
    const lows = swings.filter((s) => s.kind === 'low').slice(-2);
    const rising = highs.length === 2 && highs[1].price > highs[0].price
      && lows.length === 2 && lows[1].price > lows[0].price;
    const falling = highs.length === 2 && highs[1].price < highs[0].price
      && lows.length === 2 && lows[1].price < lows[0].price;
    return {
      rising,
      falling,
      lastHigh: highs.at(-1)?.price ?? null,
      lastLow: lows.at(-1)?.price ?? null,
    };
  }

  toAnnotated() {
    const cfg = this.config;
    const orBars = cfg.orBars ?? 3;
    const rsiSeries = this.rsiSeries(cfg.rsiPeriod);
    const vwapSeries = this.vwapSeries();
    const or = this.openingRange(orBars);
    const trend = this.trendFromSwings();
    let brokeUp = false;
    let brokeDown = false;
    return this.candles.map((candle, i) => {
      const rvol = relativeVolume(
        candle.volume,
        priorVolumesAtMinute(this.priorSessions, candle.minuteOfDay)
      );
      const orLocked = i >= orBars;
      if (orLocked && candle.close > or.high) brokeUp = true;
      if (orLocked && candle.close < or.low) brokeDown = true;
      return {
        ...candle.toRow(),
        rsi: rsiSeries[i],
        vwap: vwapSeries[i],
        orHigh: or.high,
        orLow: or.low,
        orMid: or.high != null && or.low != null ? (or.high + or.low) / 2 : null,
        orLocked,
        rvol,
        brokeUp,
        brokeDown,
        index: i,
        regime: this.regime,
        assetClass: this.assetClass,
        swingHigh: trend.lastHigh,
        swingLow: trend.lastLow,
        structureRising: trend.rising,
      };
    });
  }
}

class OrderflowSession {
  constructor() {
    const err = new Error('CVD/orderflow needs signed tape (aggressor), not OHLCV candles');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  static fromCandles() {
    const err = new Error('Refuse fake CVD from candle color. Provide trades + quotes (Lee-Ready) first.');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }
}

module.exports = {
  Candle,
  Session,
  OrderflowSession,
};
