'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PROMOTION_GATES, SETUPS } = require('../lib/config');
const { rankAndPromote, promotionDecision, rankSetup } = require('../lib/rank');
const { applyValidation, holdoutTrades } = require('../lib/validate');
const { createMemoryStore } = require('../lib/store');
const { FROZEN_ANOMALY_WINDOWS } = require('../lib/regime');

function trade(date, pnl, setupId = 'orb_breakout', extras = {}) {
  return {
    setupId,
    sessionDate: date,
    status: 'closed',
    pnl,
    ts: `${date}T10:05:00-04:00`,
    features: { sessionDate: date, ...(extras.features || {}) },
  };
}

function dates(n, start) {
  const out = [];
  const t0 = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(t0.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe('holdout / anomaly_dependent validation', () => {
  it('drops frozen Oct–Nov 2025 sessions from the holdout book', () => {
    const trades = [
      trade('2024-03-04', 1),
      trade('2025-10-15', 5),
      trade('2025-11-20', -2),
    ];
    const holdout = holdoutTrades(trades);
    assert.equal(holdout.length, 1);
    assert.equal(holdout[0].sessionDate, '2024-03-04');
  });

  it('blocks promotion when gates fail without the frozen windows', async () => {
    const store = createMemoryStore();
    const days = dates(16, '2025-10-01');
    const trades = days.map((d) => trade(d, 1.25));
    const ranked = await rankAndPromote(store, {
      setups: SETUPS,
      gates: PROMOTION_GATES,
      trades,
      windows: FROZEN_ANOMALY_WINDOWS,
    });
    const orb = ranked.find((r) => r.setupId === 'orb_breakout');
    assert.equal(orb.liveEligible, false);
    assert.equal(orb.anomalyDependent, true);
    assert.match(orb.reason, /anomaly_dependent/);
  });

  it('blocks promotion when P&L is expansion-only', () => {
    const days = dates(16, '2024-03-01');
    const trades = days.map((d) => trade(d, 1.5, 'orb_breakout', { features: { regime: 'expansion' } }));
    const metrics = rankSetup(trades);
    const raw = promotionDecision(metrics, PROMOTION_GATES);
    assert.equal(raw.liveEligible, true);
    const decision = applyValidation(metrics, raw, { trades, gates: PROMOTION_GATES });
    assert.equal(decision.liveEligible, false);
    assert.equal(decision.anomalyDependent, true);
    assert.match(decision.reason, /expansion/);
  });
});
