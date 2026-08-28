'use strict';

const EVENT_KINDS = new Set(['news', 'analysis', 'macro', 'indicator', 'other']);
const IDEA_SOURCES = new Set(['manual', 'ui', 'slack', 'grokbot']);
const IDEA_STATUSES = new Set(['inbox', 'exploring', 'paper', 'rejected', 'parked']);

function asTextArray(value) {
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeEvent(input = {}) {
  const kind = String(input.kind || 'other').toLowerCase();
  return {
    kind: EVENT_KINDS.has(kind) ? kind : 'other',
    source: String(input.source || 'manual').trim() || 'manual',
    title: String(input.title || '').trim(),
    url: input.url ? String(input.url).trim() : null,
    body: input.body ? String(input.body) : '',
    symbols: asTextArray(input.symbols).map((s) => s.toUpperCase()),
    tags: asTextArray(input.tags),
    publishedAt: input.publishedAt || input.published_at || null,
  };
}

function normalizeIdea(input = {}) {
  const source = String(input.source || 'manual').toLowerCase();
  const status = String(input.status || 'inbox').toLowerCase();
  return {
    title: String(input.title || '').trim(),
    hypothesis: String(input.hypothesis || input.body || '').trim(),
    source: IDEA_SOURCES.has(source) ? source : 'manual',
    slackChannel: input.slackChannel || input.slack_channel || null,
    slackTs: input.slackTs || input.slack_ts || null,
    status: IDEA_STATUSES.has(status) ? status : 'inbox',
    symbols: asTextArray(input.symbols).map((s) => s.toUpperCase()),
    setupId: input.setupId || input.setup_id || null,
    notes: input.notes ? String(input.notes) : '',
  };
}

function flattenBars(barsBySymbol, { timeframe = '5m' } = {}) {
  const out = [];
  for (const [symbol, bars] of Object.entries(barsBySymbol || {})) {
    for (const bar of bars || []) {
      out.push({
        symbol: bar.symbol || symbol,
        timeframe: bar.timeframe || timeframe,
        ts: bar.ts,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0,
        sessionDate: bar.sessionDate || null,
        minuteOfDay: bar.minuteOfDay ?? null,
        source: bar.synthetic ? 'synthetic' : (bar.source || 'alpaca'),
      });
    }
  }
  return out;
}

module.exports = {
  EVENT_KINDS,
  IDEA_SOURCES,
  IDEA_STATUSES,
  asTextArray,
  normalizeEvent,
  normalizeIdea,
  flattenBars,
};
