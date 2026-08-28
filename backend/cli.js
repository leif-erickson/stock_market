#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
const Alpaca = require('alpaca-trade-api');
const dotenv = require('dotenv');

const { loadConfig } = require('./lib/config');
const { ensureSchema } = require('./lib/schema');
const { createPgStore, createMemoryStore } = require('./lib/store');
const { createBarsClient } = require('./lib/bars');
const { runReplay, scanLatestSession } = require('./lib/pipeline');
const { isLiveEnabled } = require('./lib/robinhood');

dotenv.config();

function makeStore() {
  if (!process.env.DB_NAME) {
    console.warn('No DB_NAME set; using in-memory journal (not durable).');
    return { store: createMemoryStore(), pool: null };
  }
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432),
  });
  return { store: createPgStore(pool), pool };
}

function makeBars() {
  let alpaca = null;
  try {
    alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      paper: true,
    });
  } catch (err) {
    console.warn(`Alpaca client not available: ${err.message}`);
  }
  return createBarsClient({ alpaca });
}

async function main() {
  const cmd = process.argv[2] || 'replay';
  const config = loadConfig();
  const { store, pool } = makeStore();
  if (pool) await ensureSchema(pool);
  const barsClient = makeBars();

  if (cmd === 'replay') {
    const days = Number(process.argv[3] || 20);
    const result = await runReplay({ store, barsClient, config, days, persist: true });
    printReplay(result);
  } else if (cmd === 'scan' || cmd === 'today') {
    const result = await scanLatestSession({ store, barsClient, config, persist: false });
    printScan(result);
  } else if (cmd === 'rank') {
    const days = Number(process.argv[3] || 20);
    const result = await runReplay({ store, barsClient, config, days, persist: true });
    printRank(result.rankings);
  } else {
    console.error('Usage: node cli.js [replay|scan|rank] [days]');
    process.exitCode = 1;
  }

  if (pool) await pool.end();
}

function printReplay(result) {
  console.log(`Paper replay (${result.source})  universe=${result.universe.join(',')}  days=${result.days}`);
  console.log(`Signals=${result.signals}  journaled trades=${result.trades}`);
  console.log(`Account cash=${result.account.cash.toFixed(2)} settled=${result.account.settledCash.toFixed(2)} unsettled=${result.account.unsettledCash.toFixed(2)} equity=${result.account.equity.toFixed(2)}`);
  console.log(`Live enabled: ${isLiveEnabled()}`);
  printRank(result.rankings);
  if (result.todaySignals?.length) {
    console.log('\nLatest-session signals:');
    for (const s of result.todaySignals) {
      console.log(`  ${s.sessionDate} ${s.symbol} ${s.setupId} ${s.side} @ ${s.paperPrice.toFixed(2)} — ${s.reason}`);
    }
  }
}

function printScan(result) {
  console.log(`Scan session=${result.sessionDate} source=${result.source} live=${result.liveEnabled}`);
  if (!result.signals.length) {
    console.log('No signals on the latest session.');
    return;
  }
  for (const s of result.signals) {
    console.log(`  ${s.symbol} ${s.setupId} ${s.side} @ ${Number(s.paperPrice).toFixed(2)} — ${s.reason}`);
  }
}

function printRank(rankings) {
  console.log('\nSetup ranking (walk-forward OOS):');
  for (const r of rankings || []) {
    const m = r.metrics;
    console.log(
      `  ${r.setupId.padEnd(22)} status=${r.status.padEnd(14)} liveEligible=${r.liveEligible}  oos_n=${m.trades} wr=${(m.winRate * 100).toFixed(0)}% pnl=${m.grossPnl.toFixed(2)} cons=${(m.consistency * 100).toFixed(0)}% dd=${m.maxDrawdown.toFixed(2)}`
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
