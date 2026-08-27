// backend/index.js
const express = require('express');
const { Pool } = require('pg');
const ccxt = require('ccxt');
const Alpaca = require('alpaca-trade-api');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: process.env.DB_USER,
  host: 'localhost', // Change to 'db' if running in Docker network
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true, // Use paper trading for testing
});

// Initialize CCXT exchange (e.g., Binance for crypto)
const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET,
});

// Create table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'stock' or 'crypto'
    quantity DECIMAL NOT NULL,
    original_cost DECIMAL NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE
  );
`);

// GET all portfolio items with current values
app.get('/portfolio', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM portfolio');
    const enhancedRows = await Promise.all(rows.map(async (item) => {
      let currentPrice = 0;
      if (item.type === 'stock') {
        const quote = await alpaca.getLatestQuote(item.symbol);
        currentPrice = quote.AskPrice; // Or use BidPrice/AskPrice average
      } else if (item.type === 'crypto') {
        const ticker = await exchange.fetchTicker(`${item.symbol}/USDT`);
        currentPrice = ticker.last;
      }
      const currentValue = item.quantity * currentPrice;
      const profitLoss = currentValue - (item.quantity * item.original_cost);
      return { ...item, current_price: currentPrice, current_value: currentValue, profit_loss: profitLoss };
    }));
    res.json(enhancedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add item
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

// DELETE item
app.delete('/portfolio/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM portfolio WHERE id = $1', [id]);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () => {
  console.log('Backend server running on port 5000');
});
