'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  requiredDailyReturn,
  impliedPeriodsToDouble,
  assessGoal,
  DEFAULT_DOUBLE_DAYS,
} = require('../lib/goals');

describe('capital goals', () => {
  it('defaults doubling horizon to a year, not a few days', () => {
    const goal = assessGoal({ startingCash: 100, equity: 100 });
    assert.equal(goal.doubleDays, DEFAULT_DOUBLE_DAYS);
    assert.equal(goal.isPromotionGate, false);
    assert.equal(goal.tooAggressive, false);
    assert.ok(goal.requiredDailyReturnPct < 0.3);
  });

  it('flags doubling in a few days as overfitting bait', () => {
    const goal = assessGoal({ doubleDays: 14, startingCash: 100 });
    assert.equal(goal.tooAggressive, true);
    assert.ok(goal.requiredDailyReturn > 0.04);
    assert.match(goal.warning, /overfitting/);
  });

  it('required daily return doubles capital over the horizon', () => {
    const r = requiredDailyReturn(365);
    const grown = 100 * (1 + r) ** 365;
    assert.ok(Math.abs(grown - 200) < 0.01);
  });

  it('implies days-to-double from a positive OOS rate', () => {
    const periods = impliedPeriodsToDouble(0.10, 20);
    assert.ok(periods > 20);
    assert.equal(impliedPeriodsToDouble(-0.1, 20), null);
  });

  it('flags in-sample doubling that OOS does not confirm', () => {
    const goal = assessGoal({
      startingCash: 100,
      doubleDays: 365,
      inSamplePnl: 80,
      inSampleSessions: 10,
      oosPnl: -5,
      oosSessions: 10,
    });
    assert.equal(goal.overfittingRisk, true);
    assert.match(goal.warning, /overfit/i);
  });
});
