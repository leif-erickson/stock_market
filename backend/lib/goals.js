'use strict';

/**
 * Capital-doubling is an aspiration to measure against, never a promotion
 * gate. Short horizons (weeks) imply daily returns that overfit noise.
 */

const MIN_SANE_DOUBLE_DAYS = 90;
const DEFAULT_DOUBLE_DAYS = 365;

/**
 * @param {number} doubleDays
 * @returns {number}
 */
function requiredDailyReturn(doubleDays) {
  const days = Math.max(1, Number(doubleDays) || DEFAULT_DOUBLE_DAYS);
  return 2 ** (1 / days) - 1;
}

/**
 * @param {number} periodReturn  total return over `periods` (e.g. 0.1 = +10%)
 * @param {number} periods
 * @returns {number | null} calendar-ish periods to double, or null if no growth
 */
function impliedPeriodsToDouble(periodReturn, periods) {
  const n = Number(periods);
  const r = Number(periodReturn);
  if (!(n > 0) || !Number.isFinite(r) || r <= 0) return null;
  const per = (1 + r) ** (1 / n) - 1;
  if (!(per > 0)) return null;
  return Math.log(2) / Math.log(1 + per);
}

/**
 * @param {object} input
 * @param {number} [input.startingCash]
 * @param {number} [input.equity]
 * @param {number} [input.doubleDays]
 * @param {number} [input.oosPnl]
 * @param {number} [input.oosSessions]
 * @param {number} [input.inSamplePnl]
 * @param {number} [input.inSampleSessions]
 */
function assessGoal(input = {}) {
  const startingCash = Number(input.startingCash ?? 100);
  const equity = Number(input.equity ?? startingCash);
  const doubleDays = Math.max(1, Number(input.doubleDays ?? DEFAULT_DOUBLE_DAYS));
  const required = requiredDailyReturn(doubleDays);
  const tooAggressive = doubleDays < MIN_SANE_DOUBLE_DAYS;
  const oosReturn = startingCash > 0 ? Number(input.oosPnl || 0) / startingCash : 0;
  const inSampleReturn = startingCash > 0 ? Number(input.inSamplePnl || 0) / startingCash : 0;
  const oosDaysToDouble = impliedPeriodsToDouble(oosReturn, Number(input.oosSessions || 0));
  const inSampleDaysToDouble = impliedPeriodsToDouble(inSampleReturn, Number(input.inSampleSessions || 0));
  const overfittingRisk = Boolean(
    inSampleDaysToDouble != null
    && (oosDaysToDouble == null || inSampleDaysToDouble < 0.5 * (oosDaysToDouble || Infinity))
  );

  let warning = 'Aspiration only. Promotion still requires walk-forward OOS gates, not this target.';
  if (tooAggressive) {
    warning = `Doubling in ${doubleDays} days implies ~${(required * 100).toFixed(2)}% per day compounded. That is not a reasonable research target and is a classic overfitting bait.`;
  } else if (overfittingRisk) {
    warning = 'In-sample doubling looks much faster than OOS. Treat the in-sample curve as overfit until OOS agrees.';
  }

  return {
    startingCash,
    equity,
    targetEquity: startingCash * 2,
    doubleDays,
    requiredDailyReturn: required,
    requiredDailyReturnPct: required * 100,
    oosDaysToDouble,
    inSampleDaysToDouble,
    tooAggressive,
    overfittingRisk,
    isPromotionGate: false,
    warning,
  };
}

module.exports = {
  MIN_SANE_DOUBLE_DAYS,
  DEFAULT_DOUBLE_DAYS,
  requiredDailyReturn,
  impliedPeriodsToDouble,
  assessGoal,
};
