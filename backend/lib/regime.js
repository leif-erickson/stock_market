'use strict';

const FROZEN_ANOMALY_WINDOWS = [
  {
    id: 'nasdaq_expansion_2025q3q4',
    start: '2025-09-01',
    end: '2025-10-31',
    regime: 'expansion',
    note: 'Nasdaq Sep–Oct 2025 melt-up (late-Oct highs, AI/tech leadership). Frozen: never fit params here.',
  },
  {
    id: 'nasdaq_reset_2025_nov',
    start: '2025-11-01',
    end: '2025-11-21',
    regime: 'reset',
    note: 'Nov 2025 tech round-trip incl. 2025-11-20 Nvidia open-drive reversal. Frozen holdout.',
  },
];

function inWindow(date, window) {
  if (!date) return false;
  const d = String(date).slice(0, 10);
  return d >= window.start && d <= window.end;
}

function frozenRegime(date, windows = FROZEN_ANOMALY_WINDOWS) {
  const hit = windows.find((w) => inWindow(date, w));
  return hit ? hit.regime : null;
}

function isFrozenDate(date, windows = FROZEN_ANOMALY_WINDOWS) {
  return windows.some((w) => inWindow(date, w));
}

/**
 * Mechanical regime from daily closes of one proxy series.
 * expansion: +expansionPct from the lookback trough.
 * reset: had that impulse and retraced retracePct of it.
 */
function mechanicalRegime(closes, {
  lookback = 20,
  expansionPct = 0.08,
  retracePct = 0.5,
} = {}) {
  const px = (closes || []).map(Number).filter((n) => Number.isFinite(n));
  if (px.length < 5) return 'quiet';
  const window = px.slice(-lookback);
  const last = window.at(-1);
  const trough = Math.min(...window);
  const peak = Math.max(...window);
  if (!(trough > 0) || last == null) return 'quiet';
  const impulse = (peak - trough) / trough;
  const fromTrough = (last - trough) / trough;
  if (impulse >= expansionPct && (peak - last) / Math.max(peak - trough, 1e-9) >= retracePct) {
    return 'reset';
  }
  if (fromTrough >= expansionPct) return 'expansion';
  return 'quiet';
}

function sessionCloses(bars) {
  const byDate = new Map();
  for (const bar of bars || []) {
    const d = bar.sessionDate || bar.session_date;
    if (!d) continue;
    byDate.set(d, Number(bar.close));
  }
  return [...byDate.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([, close]) => close);
}

function regimeForDate(date, { bars = [], windows = FROZEN_ANOMALY_WINDOWS, mechanical = {} } = {}) {
  const frozen = frozenRegime(date, windows);
  if (frozen) return frozen;
  const cutoff = String(date).slice(0, 10);
  const dated = [...new Map(
    (bars || [])
      .map((b) => [String(b.sessionDate || b.session_date || '').slice(0, 10), Number(b.close)])
      .filter(([d]) => d && d !== 'undefined')
  ).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([d]) => d <= cutoff)
    .map(([, close]) => close);
  return mechanicalRegime(dated, mechanical);
}

function embargoDates(windows = FROZEN_ANOMALY_WINDOWS) {
  return windows.flatMap((w) => [w.start, w.end]);
}

module.exports = {
  FROZEN_ANOMALY_WINDOWS,
  inWindow,
  frozenRegime,
  isFrozenDate,
  mechanicalRegime,
  sessionCloses,
  regimeForDate,
  embargoDates,
};
