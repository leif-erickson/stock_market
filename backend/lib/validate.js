'use strict';

const { rankSetup, sessionOf, clearsPromotionGate } = require('./rank');
const { isFrozenDate, frozenRegime, FROZEN_ANOMALY_WINDOWS } = require('./regime');

const EXPANSION_PNL_SHARE_CAP = 0.5;

function holdoutTrades(trades, windows = FROZEN_ANOMALY_WINDOWS) {
  return (trades || []).filter((t) => !isFrozenDate(sessionOf(t), windows));
}

function regimePnlShare(trades, windows = FROZEN_ANOMALY_WINDOWS) {
  const closed = (trades || []).filter((t) => t.status === 'closed' || t.pnl != null);
  const totals = { expansion: 0, reset: 0, quiet: 0, frozen: 0 };
  let grossAbs = 0;
  for (const t of closed) {
    const pnl = Number(t.pnl || 0);
    const date = sessionOf(t);
    const frozen = frozenRegime(date, windows);
    const regime = t.features?.regime || frozen || 'quiet';
    if (frozen) totals.frozen += pnl;
    if (regime === 'expansion') totals.expansion += pnl;
    else if (regime === 'reset') totals.reset += pnl;
    else totals.quiet += pnl;
    grossAbs += Math.abs(pnl);
  }
  const positive = Math.max(totals.expansion + totals.reset + totals.quiet, 1e-9);
  return {
    ...totals,
    expansionShare: totals.expansion / positive,
    frozenShare: Math.abs(totals.frozen) / Math.max(grossAbs, 1e-9),
  };
}

/**
 * Walk-forward remains necessary. Holdout + concentration decide if it was
 * just the Oct 2025 melt-up.
 */
function applyValidation(metrics, decision, {
  trades = [],
  gates,
  windows = FROZEN_ANOMALY_WINDOWS,
  variantsTried = 0,
} = {}) {
  if (!decision.liveEligible) {
    return { ...decision, anomalyDependent: false };
  }
  const holdout = holdoutTrades(trades, windows);
  const holdoutMetrics = rankSetup(holdout);
  const holdoutClears = clearsPromotionGate(holdoutMetrics, gates);
  const share = regimePnlShare(trades, windows);
  const trendBeta = share.expansionShare >= EXPANSION_PNL_SHARE_CAP && share.reset <= 0;
  const extraTradesNeeded = variantsTried > 10 ? Math.ceil(gates.minOosTrades * 1.5) : gates.minOosTrades;
  const variantTax = metrics.trades < extraTradesNeeded;

  if (!holdoutClears || trendBeta || variantTax) {
    return {
      liveEligible: false,
      status: 'paper',
      anomalyDependent: true,
      reason: !holdoutClears
        ? 'anomaly_dependent: gates fail when frozen Oct–Nov 2025 windows are removed'
        : trendBeta
          ? 'anomaly_dependent: P&L concentrated in expansion; reset is not profitable'
          : 'anomaly_dependent: too many variants tried for this OOS sample',
      holdoutMetrics,
      regimePnl: share,
    };
  }
  return {
    ...decision,
    anomalyDependent: false,
    holdoutMetrics,
    regimePnl: share,
  };
}

module.exports = {
  EXPANSION_PNL_SHARE_CAP,
  holdoutTrades,
  regimePnlShare,
  applyValidation,
};
