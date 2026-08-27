# tradingcore

A broker-agnostic, event-driven **trading research core** for building and
evaluating intraday strategies. It is the foundation for the larger bot described
in [`ARCHITECTURE.md`](./ARCHITECTURE.md) (Slack control plane, news/Discord/macro
ingestion, a Grok assistant that proposes changes via PRs, and multiple brokers).

> ⚠️ **This is a foundation, not a profitable bot, and not financial advice.**
> Most retail automated trading loses money. Live trading is intentionally **not
> implemented** and is hard-gated off. Backtest and paper-trade first; risk only
> what you can afford to lose.

## Why it is shaped this way

- **Safe by default** — only `BACKTEST` and `PAPER` execution exist. Live adapters
  refuse to construct/trade (`tradingcore/broker.py`, `tradingcore/config.py`).
- **Broker-agnostic** — strategies emit `Signal`s; a `Broker` executes them. Start
  on the built-in `PaperBroker`; graduate to a broker with an *official* API
  (Alpaca is recommended; Robinhood has no official API — see the note below).
- **Candle-centric & event-driven** — every `Candle` is a rich object; strategies
  react to each new candle **and** to fused external `context` (news, Discord,
  macro). The exact `process_candle` step used in backtests is what a live loop
  reuses, so a validated backtest graduates without a rewrite.
- **Risk-first** — position sizing, per-trade risk, a daily-loss kill switch, and
  PDT-awareness live in `tradingcore/risk.py` and run before any order.

## Quickstart

```bash
cd trading_bot
python3 -m venv .venv && . .venv/bin/activate   # needs python3.12-venv
pip install -e ".[dev]"
pytest                       # run the test suite
python examples/demo_backtest.py   # end-to-end backtest on synthetic data
```

### Real data & Alpaca paper trading

```bash
# Keyless real intraday backtest via Yahoo Finance (no API key required):
pip install -e ".[yahoo]"
python examples/run_yahoo_backtest.py AAPL 5m 1mo

# Alpaca (official API). Backtest historical bars, or smoke-test the PAPER account:
pip install -e ".[alpaca]"
export ALPACA_API_KEY=...  ALPACA_SECRET_KEY=...   # use PAPER keys
python examples/run_alpaca_backtest.py AAPL        # reads data only, no orders
python examples/alpaca_paper_smoke.py              # read-only account check
python examples/alpaca_paper_smoke.py --place-order AAPL 1   # 1 tiny PAPER order
```

Data/broker adapters live in `tradingcore/adapters/` and lazily import their SDKs,
so the core stays dependency-free. `AlpacaBroker` defaults to **paper**; live
trading is refused unless explicitly acknowledged.

## Package layout

| Module | Responsibility |
| --- | --- |
| `domain.py` | `Candle` (rich value object) and `CandleSeries` |
| `indicators.py` | RSI, SMA, EMA, true range (pure Python) |
| `patterns.py` | Doji, hammer, shooting star, bullish/bearish engulfing |
| `signals.py` | `Action`, `Signal`, and the `Strategy` protocol |
| `strategies.py` | Example intraday `RsiReversionStrategy` (flat by EOD) |
| `broker.py` | `Broker` protocol, `PaperBroker`, guarded live adapters |
| `context.py` | Normalised external context (news/Discord/macro/Slack) |
| `risk.py` | Position sizing, `RiskLimits`, `KillSwitch` |
| `backtest.py` | Event-driven engine + performance metrics |
| `config.py` | Env-driven settings + the live-trading gate |

## A note on Robinhood

Robinhood does **not** publish an official trading API. Automating it (including
via an "MCP" wrapper) depends on unofficial/reverse-engineered endpoints and
likely violates Robinhood's Terms of Service, risking account suspension. The
`RobinhoodBroker` here is a guarded stub. Prefer a venue with an official API and
a real paper endpoint (e.g. Alpaca). If you proceed with Robinhood, do so
knowingly and behind the same `Broker` interface.

## Secrets

Never commit secrets. Configuration reads secret *names* (see `config.py`
`SECRET_NAMES`); provide *values* via environment variables / a secrets manager.
In Cursor Cloud Agents, add them in the Secrets panel.
