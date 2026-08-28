'use strict';

const { Session, Candle } = require('./candle');
const { regimeForDate } = require('./regime');
const { SETUPS } = require('./config');

function isRth(bar, config) {
  return bar.minuteOfDay >= config.rthStartMinute && bar.minuteOfDay < config.rthEndMinute;
}

function groupBySession(bars) {
  const map = new Map();
  for (const bar of bars) {
    if (!map.has(bar.sessionDate)) map.set(bar.sessionDate, []);
    map.get(bar.sessionDate).push(bar);
  }
  for (const [, sessionBars] of map) {
    sessionBars.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
  }
  return map;
}

function flattenPrior(priorSessions) {
  const out = [];
  for (const session of priorSessions || []) {
    if (Array.isArray(session)) out.push(...session);
    else if (session?.candles) out.push(...session.candles);
  }
  return out;
}

function annotateSession(sessionBars, { priorSessions = [], config = {}, regime, assetClass = 'stocks' } = {}) {
  const date = sessionBars[0]?.sessionDate;
  const labeled = regime || regimeForDate(date, {
    bars: [...flattenPrior(priorSessions), ...sessionBars],
    windows: config.frozenWindows,
  });
  return Session.fromBars(sessionBars, {
    config,
    priorSessions,
    regime: labeled,
    assetClass,
  }).toAnnotated();
}

function stillTakingEntries(bar) {
  return bar.orLocked && bar.minuteOfDay <= 15 * 60 + 30;
}

function orbBreakout(bar, prev) {
  if (!stillTakingEntries(bar) || !prev) return null;
  const crossed = bar.close > bar.orHigh && prev.close <= bar.orHigh;
  if (!crossed) return null;
  if (!(bar.close > bar.vwap)) return null;
  if (bar.rvol < 1.2) return null;
  return {
    setupId: 'orb_breakout',
    side: 'BUY',
    reason: `OR breakout: close ${bar.close.toFixed(2)} > ORH ${bar.orHigh.toFixed(2)}, above VWAP ${bar.vwap.toFixed(2)}, rvol ${bar.rvol.toFixed(2)}`,
    stop: bar.orLow,
    target: bar.close + 1.5 * (bar.close - bar.orLow),
  };
}

function vwapRsiReversion(bar, prev) {
  if (!stillTakingEntries(bar) || !prev) return null;
  if (bar.rsi == null || prev.rsi == null) return null;
  const reclaimed = prev.close <= prev.vwap && bar.close > bar.vwap;
  if (!reclaimed) return null;
  if (!(bar.rsi <= 40 || prev.rsi <= 35)) return null;
  if (bar.rvol < 1.1) return null;
  const stop = Math.min(bar.low, bar.vwap * 0.99);
  return {
    setupId: 'vwap_rsi_reversion',
    side: 'BUY',
    reason: `VWAP reclaim after RSI ${bar.rsi.toFixed(1)} (prev ${prev.rsi.toFixed(1)}), rvol ${bar.rvol.toFixed(2)}`,
    stop,
    target: bar.close + 1.5 * (bar.close - stop),
  };
}

function orbRetest(bar, prev) {
  if (!stillTakingEntries(bar) || !prev) return null;
  if (!bar.brokeUp) return null;
  const level = bar.orMid != null && bar.vwap != null ? Math.max(bar.orMid, bar.vwap * 0.998) : bar.orMid;
  if (level == null) return null;
  const touched = bar.low <= level;
  const resumed = bar.close > level && bar.close > bar.open;
  if (!(touched && resumed)) return null;
  if (bar.rvol < 1.0) return null;
  if (!(prev.close > bar.orHigh || bar.brokeUp)) return null;
  return {
    setupId: 'orb_retest',
    side: 'BUY',
    reason: `OR retest: pullback to mid/VWAP ${level.toFixed(2)} then close ${bar.close.toFixed(2)}, rvol ${bar.rvol.toFixed(2)}`,
    stop: bar.orLow,
    target: bar.close + 1.5 * (bar.close - bar.orLow),
  };
}

function barReversal(bar, prev) {
  if (!stillTakingEntries(bar) || !prev) return null;
  if (bar.vwap == null || !(bar.rvol >= 1.2)) return null;
  const candle = new Candle(bar);
  const prevC = new Candle(prev);
  const pin = candle.bullishPin(2) && candle.close >= bar.vwap * 0.998;
  const engulf = candle.engulfs(prevC) && candle.isBullish() && prev.close <= (prev.vwap ?? prev.close);
  if (!pin && !engulf) return null;
  const stop = Math.min(bar.low, bar.vwap * 0.99);
  return {
    setupId: 'bar_reversal',
    side: 'BUY',
    reason: `Bar reversal (${pin ? 'pin' : 'engulf'}) at VWAP ${bar.vwap.toFixed(2)}, rvol ${bar.rvol.toFixed(2)}`,
    stop,
    target: bar.close + 1.5 * (bar.close - stop),
  };
}

function impulseHold(bar, prev) {
  if (bar.regime !== 'expansion') return null;
  if (!stillTakingEntries(bar) || !prev) return null;
  const orBreak = bar.close > bar.orHigh && prev.close <= bar.orHigh;
  const structureBreak = Boolean(bar.structureRising && bar.swingHigh != null && bar.close > bar.swingHigh && prev.close <= bar.swingHigh);
  if (!orBreak && !structureBreak) return null;
  if (!(bar.close > bar.vwap)) return null;
  if (bar.rvol < 1.2) return null;
  return {
    setupId: 'impulse_hold',
    side: 'BUY',
    reason: `Impulse hold (${orBreak ? 'OR' : 'structure'}) in expansion, above VWAP ${bar.vwap.toFixed(2)}, rvol ${bar.rvol.toFixed(2)}`,
    stop: bar.orLow ?? bar.swingLow ?? bar.low,
    target: bar.close + 1.5 * (bar.close - (bar.orLow ?? bar.low)),
  };
}

function roundtripFade(bar, prev) {
  if (bar.regime !== 'reset') return null;
  if (!stillTakingEntries(bar) || !prev) return null;
  if (bar.vwap == null || !(bar.rvol >= 1.1)) return null;
  const lostVwap = prev.close >= prev.vwap && bar.close < bar.vwap;
  const candle = new Candle(bar);
  const engulf = candle.engulfs(new Candle(prev)) && !candle.isBullish();
  if (!lostVwap && !engulf) return null;
  const high = bar.swingHigh || bar.orHigh;
  if (high != null && (high - bar.close) / high < 0.01) return null;
  return {
    setupId: 'roundtrip_fade',
    side: 'SELL',
    reason: `Round-trip fade in reset: ${lostVwap ? 'lost VWAP' : 'bear engulf'}, rvol ${bar.rvol.toFixed(2)} (cash book does not short)`,
    stop: high,
    target: bar.vwap,
  };
}

const DETECTORS = {
  orb_breakout: orbBreakout,
  vwap_rsi_reversion: vwapRsiReversion,
  orb_retest: orbRetest,
  bar_reversal: barReversal,
  impulse_hold: impulseHold,
  roundtrip_fade: roundtripFade,
};

const FACET_FIELDS = {
  orb_breakout: ['orHigh', 'vwap', 'rvol'],
  vwap_rsi_reversion: ['vwap', 'rsi', 'rvol'],
  orb_retest: ['orMid', 'vwap', 'rvol'],
  bar_reversal: ['vwap', 'rvol'],
  impulse_hold: ['orHigh', 'vwap', 'rvol', 'regime'],
  roundtrip_fade: ['vwap', 'rvol', 'regime', 'swingHigh'],
};

function featuresFrom(bar, setupId) {
  const out = {
    close: bar.close,
    sessionDate: bar.sessionDate,
    minuteOfDay: bar.minuteOfDay,
    regime: bar.regime || 'quiet',
    assetClass: bar.assetClass || 'stocks',
  };
  for (const key of FACET_FIELDS[setupId] || ['rvol', 'vwap']) {
    out[key] = bar[key];
  }
  return out;
}

function evaluateSetups(annotatedBars, setupIds = Object.keys(DETECTORS)) {
  const signals = [];
  const fired = new Set();
  for (let i = 1; i < annotatedBars.length; i += 1) {
    const bar = annotatedBars[i];
    const prev = annotatedBars[i - 1];
    for (const setupId of setupIds) {
      const key = `${setupId}:${bar.sessionDate}:${bar.symbol}`;
      if (fired.has(key)) continue;
      const detector = DETECTORS[setupId];
      if (!detector) continue;
      const hit = detector(bar, prev);
      if (!hit) continue;
      fired.add(key);
      signals.push({
        symbol: bar.symbol,
        ts: bar.ts,
        sessionDate: bar.sessionDate,
        minuteOfDay: bar.minuteOfDay,
        side: hit.side,
        setupId: hit.setupId,
        paperPrice: bar.close,
        stop: hit.stop,
        target: hit.target,
        features: featuresFrom(bar, hit.setupId),
        reason: hit.reason,
        assetClass: bar.assetClass || 'stocks',
        family: (SETUPS.find((s) => s.id === hit.setupId) || {}).family || null,
      });
    }
  }
  return signals;
}

function signalsForSymbol(bars, { priorSessions = [], config, setupIds, regime, assetClass } = {}) {
  const annotated = annotateSession(bars, { priorSessions, config, regime, assetClass });
  const ids = setupIds || Object.keys(DETECTORS);
  return {
    annotated,
    signals: evaluateSetups(annotated, ids),
  };
}

module.exports = {
  isRth,
  groupBySession,
  annotateSession,
  evaluateSetups,
  signalsForSymbol,
  DETECTORS,
  FACET_FIELDS,
  MAX_DETECTOR_FACETS: 5,
};
