// backend/index.js
const express = require('express');
const { Pool } = require('pg');
const ccxt = require('ccxt');
const Alpaca = require('alpaca-trade-api');
const dotenv = require('dotenv');
const cors = require('cors');

const { ensureSchema } = require('./lib/schema');
const { createPgStore } = require('./lib/store');
const { loadConfig } = require('./lib/config');
const { createBarsClient } = require('./lib/bars');
const { runReplay, scanLatestSession } = require('./lib/pipeline');
const { isLiveEnabled, placeOrder: robinhoodPlace } = require('./lib/robinhood');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
});

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET,
});

function getStore() {
  return createPgStore(pool);
}

function getBarsClient() {
  return createBarsClient({ alpaca });
}

// GET all portfolio items with current values
app.get('/portfolio', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM portfolio');
    const enhancedRows = await Promise.all(rows.map(async (item) => {
      // A failing/unauthenticated market-data provider should not take down the
      // whole endpoint; return the holding with null pricing instead.
      let currentPrice = null;
      try {
        if (item.type === 'stock') {
          const quote = await alpaca.getLatestQuote(item.symbol);
          currentPrice = quote.AskPrice;
        } else if (item.type === 'crypto') {
          const ticker = await exchange.fetchTicker(`${item.symbol}/USDT`);
          currentPrice = ticker.last;
        }
      } catch (priceError) {
        console.warn(`Price lookup failed for ${item.symbol} (${item.type}): ${priceError.message}`);
      }
      const quantity = Number(item.quantity);
      const originalCost = Number(item.original_cost);
      const currentValue = currentPrice == null ? null : quantity * currentPrice;
      const profitLoss = currentPrice == null ? null : currentValue - (quantity * originalCost);
      return { ...item, current_price: currentPrice, current_value: currentValue, profit_loss: profitLoss };
    }));
    res.json(enhancedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/portfolio', async (req, res) => {
  const { symbol, type, quantity, original_cost } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO portfolio (symbol, type, quantity, original_cost) VALUES ($1, $2, $3, $4) RETURNING *',
      [symbol, type, quantity, original_cost]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/portfolio/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM portfolio WHERE id = $1', [id]);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    liveEnabled: isLiveEnabled(),
    execution: 'paper',
  });
});

app.get('/trading/account', async (_req, res) => {
  try {
    const account = await getStore().getAccount();
    const positions = await getStore().listPositions();
    res.json({ account, positions, liveEnabled: isLiveEnabled() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/trading/journal', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const trades = await getStore().listTrades({ limit });
    res.json({ trades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/trading/setups', async (_req, res) => {
  try {
    const setups = await getStore().listSetups();
    res.json({ setups, liveEnabled: isLiveEnabled() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/trading/signals', async (req, res) => {
  try {
    const config = loadConfig();
    const result = await scanLatestSession({
      store: getStore(),
      barsClient: getBarsClient(),
      config,
      persist: false,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/trading/pnl', async (_req, res) => {
  try {
    const store = getStore();
    const account = await store.getAccount();
    const trades = await store.listTrades({ limit: 500 });
    const closed = trades.filter((t) => t.status === 'closed');
    const realized = closed.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    res.json({
      startingCash: Number(account.starting_cash ?? 100),
      cash: Number(account.cash),
      settledCash: Number(account.settled_cash),
      unsettledCash: Number(account.unsettled_cash),
      equity: Number(account.equity),
      realizedPnl: realized,
      tradeCount: trades.length,
      liveEnabled: isLiveEnabled(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/trading/replay', async (req, res) => {
  try {
    const config = loadConfig();
    const days = Number(req.body?.days || 20);
    const result = await runReplay({
      store: getStore(),
      barsClient: getBarsClient(),
      config,
      days,
      persist: true,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/trading/scan', async (_req, res) => {
  try {
    const config = loadConfig();
    const result = await scanLatestSession({
      store: getStore(),
      barsClient: getBarsClient(),
      config,
      persist: false,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Live Robinhood path is a hard-off stub. Grok Bot may call Robinhood MCP
// (review then place) only after the user confirms a specific order.
app.post('/trading/live/order', async (req, res) => {
  const result = await robinhoodPlace(req.body || {});
  const status = result.ok ? 200 : 403;
  res.status(status).json(result);
});

async function start(port = Number(process.env.PORT || 5000)) {
  await ensureSchema(pool);
  return app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, start, pool };
