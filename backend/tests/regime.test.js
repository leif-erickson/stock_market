'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  frozenRegime,
  mechanicalRegime,
  regimeForDate,
  FROZEN_ANOMALY_WINDOWS,
} = require('../lib/regime');

describe('regime / frozen anomaly windows', () => {
  it('labels the frozen Oct 2025 expansion and Nov 2025 reset', () => {
    assert.equal(frozenRegime('2025-10-15'), 'expansion');
    assert.equal(frozenRegime('2025-11-20'), 'reset');
    assert.equal(frozenRegime('2024-03-04'), null);
    assert.equal(FROZEN_ANOMALY_WINDOWS.length, 2);
  });

  it('detects expansion and reset from daily closes without fitting on frozen dates', () => {
    const quiet = Array.from({ length: 20 }, () => 100);
    assert.equal(mechanicalRegime(quiet), 'quiet');
    const melt = [...Array.from({ length: 10 }, () => 100), ...Array.from({ length: 10 }, (_, i) => 100 + i * 2)];
    assert.equal(mechanicalRegime(melt, { expansionPct: 0.08 }), 'expansion');
    const roundTrip = [...melt, 108, 104, 102];
    assert.equal(mechanicalRegime(roundTrip, { expansionPct: 0.08, retracePct: 0.5 }), 'reset');
  });

  it('prefers the frozen window over mechanical labels', () => {
    const bars = [{ sessionDate: '2025-10-15', close: 100 }];
    assert.equal(regimeForDate('2025-10-15', { bars }), 'expansion');
    assert.equal(regimeForDate('2024-03-04', { bars: [{ sessionDate: '2024-03-04', close: 100 }] }), 'quiet');
  });
});
