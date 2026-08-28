'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Candle, Session, OrderflowSession } = require('../lib/candle');
const { loadConfig } = require('../lib/config');

function bar(overrides = {}) {
  return {
    symbol: 'SOFI',
    sessionDate: '2024-03-04',
    minuteOfDay: 9 * 60 + 30,
    ts: '2024-03-04T09:30:00-04:00',
    open: 10,
    high: 10.2,
    low: 9.8,
    close: 10.1,
    volume: 1000,
    ...overrides,
  };
}

describe('Candle / Session', () => {
  it('exposes geometry used by reversal detectors', () => {
    const pin = new Candle({ open: 10.05, high: 10.08, low: 9.7, close: 10.06 });
    assert.ok(pin.bullishPin(2));
    assert.ok(pin.closesInUpperThird());
    const prev = new Candle({ open: 10.2, high: 10.22, low: 10.0, close: 10.01 });
    const engulf = new Candle({ open: 9.98, high: 10.3, low: 9.9, close: 10.25 });
    assert.equal(engulf.engulfs(prev), true);
  });

  it('annotates a session from candle_bars-shaped rows', () => {
    const config = loadConfig();
    const rows = Array.from({ length: 6 }, (_, i) => bar({
      session_date: '2024-03-04',
      minute_of_day: 9 * 60 + 30 + i * 5,
      open: 10,
      high: 10.1,
      low: 9.9,
      close: 10 + i * 0.02,
      volume: 1000,
    }));
    const session = Session.fromRows(rows, { config, regime: 'quiet' });
    const annotated = session.toAnnotated();
    assert.equal(annotated.length, 6);
    assert.ok(annotated[5].orLocked);
    assert.ok(Number.isFinite(annotated[5].vwap));
    assert.equal(annotated[5].regime, 'quiet');
  });

  it('refuses fake CVD from candles', () => {
    assert.throws(() => new OrderflowSession(), (err) => err.code === 'NOT_IMPLEMENTED');
    assert.throws(() => OrderflowSession.fromCandles(), (err) => err.code === 'NOT_IMPLEMENTED');
  });
});
