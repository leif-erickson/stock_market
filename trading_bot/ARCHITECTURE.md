# Trading Bot — Architecture & Roadmap

This document is the guide you asked for: how to approach building an intraday,
self-improving, multi-source trading bot **responsibly**, and how the code in
this repo is structured to get you there. Read the "Reality check" first.

---

## 1. Reality check (please read)

- **No algorithm reliably guarantees profit.** Markets are adversarial and
  largely efficient at intraday horizons. The large majority of retail automated
  strategies lose money after fees, slippage, and taxes. Treat "profitable bot"
  as a research goal with rigorous validation, not a foregone conclusion.
- **"Learns and fixes itself" is powerful and dangerous.** A system that rewrites
  its own trading logic can just as easily learn to lose money faster, or overfit
  to noise. Self-improvement here means *proposing* changes that must pass
  backtest + paper gates and (initially) human approval — never silent
  auto-deploys to live capital.
- **Robinhood has no official trading API.** Automating it likely violates its
  Terms of Service and can get your account frozen. Prefer a broker with an
  official API and a real paper endpoint (Alpaca, and later Interactive Brokers).
  The design keeps the broker pluggable so this is a config choice, not a rewrite.
- **Regulatory/PDT.** US margin accounts under $25k are limited by the Pattern Day
  Trader rule (a handful of day trades per rolling 5 business days). An intraday
  ("not overnight") bot bumps into this quickly. Plan around it (cash account,
  fewer/larger trades, or ≥$25k) and never trade money you can't lose.

The engineering answer to all of this is the same: **de-risk with a strict,
staged pipeline and hard safety gates.** That is what this architecture optimises
for.

---

## 2. System overview

```
            ┌─────────────────────────────────────────────────────────┐
            │                     Control plane                        │
            │   Slack (ask/approve/report)   Grok assistant (propose)  │
            └───────────────▲───────────────────────┬─────────────────┘
                            │ questions/approvals    │ PRs / suggestions
                            │                        ▼
  Market data ─┐     ┌──────┴───────┐        ┌───────────────┐
  (candles)    ├────▶│  Context     │        │   Git (origin)│  CI: backtest+
  News  ───────┤     │  store       │        │   strategies, │  paper gates
  Discord ─────┤     │ (normalised  │        │   config      │
  Macro/FF ────┘     │  events)     │        └───────────────┘
                     └──────┬───────┘
                            │ ContextView (point-in-time, no look-ahead)
                            ▼
   Candle ──▶ Strategy(s) ──▶ Signal ──▶ Risk/KillSwitch ──▶ Broker ──▶ Fills
   stream        ▲                                   (paper | alpaca | rh)
                 └──────────── same code path in backtest, paper, and live ──────
```

**Core principle:** strategies are pure decision functions over
`(CandleSeries, ContextView) -> Signal`. Everything else — data, risk, execution,
learning, messaging — plugs in around that seam. This is what lets the same core
serve multiple trading systems and multiple brokers.

### Data flow at each new candle (`backtest.process_candle`)
1. Advance the context clock to the candle time (prevents look-ahead bias).
2. Append the candle; the strategy computes indicators/patterns and reads context.
3. Strategy returns a `Signal` (BUY/SELL/CLOSE/HOLD) with confidence + a stop.
4. Risk layer sizes the order and the kill switch may veto entries.
5. Broker executes; fills and equity are recorded.

The backtest and the (future) live loop call the **same** `process_candle`, so a
validated backtest graduates to paper/live without a logic rewrite.

---

## 3. Component design

### 3.1 Candle as an object (per the brief)
`domain.Candle` is an immutable value object exposing derived properties —
`body`, `range`, `upper_wick`, `lower_wick`, `body_pct`, `is_bullish`,
`typical_price`, … — plus helpers like `returns_from`. Strategies "ask the candle
about itself" instead of recomputing geometry everywhere. `CandleSeries` gives
ordered, windowed access for indicators.

### 3.2 Indicators & patterns
`indicators.py` (RSI/SMA/EMA/true range) and `patterns.py` (doji, hammer, shooting
star, engulfing) are pure functions and are **features**, not standalone signals.
Combine momentum + shape + context before acting (see `strategies.py`).

### 3.3 Strategy contract
`signals.Strategy` is a `Protocol` with `name`, `warmup`, and
`on_candle(series, context) -> Signal`. Multiple strategies can run in parallel
(an ensemble/meta-strategy can weight them — a natural extension point). The
example `RsiReversionStrategy` is intraday and **forces flat near the session
close** so nothing is held overnight.

### 3.4 Broker abstraction (multi-system reuse)
`broker.Broker` is the single seam to the outside world:
- `PaperBroker` — in-memory simulator (used by backtests and forward paper trading).
- `AlpacaBroker` — recommended first real venue (official API + paper endpoint);
  ships as a guarded stub to implement with `alpaca-py`.
- `RobinhoodBroker` — guarded stub with an explicit ToS warning.

Because the interface is minimal (`submit`, `position`, `cash`, `equity`), you can
drop this core into other trading systems or add venues (IBKR, crypto exchanges
via CCXT) without touching strategies.

### 3.5 Context ingestion (news, Discord, macro)
`context.py` normalises every external input to a `ContextEvent`
(`source`, `kind`, `symbol?`, `sentiment ∈ [-1,1]`, `importance`, `payload`,
`timestamp`). `ContextStore` answers point-in-time, windowed queries and computes
an importance-weighted sentiment, so heterogeneous feeds compose cleanly:
- `NewsSource` — headlines → sentiment-scored events.
- `DiscordSource` — configured channels → events (via `discord.py`/webhooks).
- `MacroSource` — the ForexFactory economic calendar (scheduled releases with
  actual/forecast/previous) and long-form macro (e.g. lynalden.com) → events.

Stubs return `[]` so the engine runs without credentials; each documents what a
real implementation must do. **Respect each site's ToS and rate limits.**

### 3.6 Risk management (the part that keeps you alive)
`risk.py`: `position_size` (per-trade risk vs. a stop, capped by max position %),
`RiskLimits`, and a `KillSwitch` that halts new entries on a daily-loss breach or
trade-count/PDT guard. Risk runs **before** every order.

### 3.7 Control plane: Slack (human-in-the-loop)
Slack is the operator interface: the bot posts trade/updates and questions
("sentiment on X is mixed — take the setup?"), and you can send directives
(pause, flatten, adjust risk, answer a question) that arrive as
`ContextEvent(kind="user_directive")` or control commands. Start with
**approval-required** for entries; relax only after confidence is earned. Build it
with the Slack Bolt SDK (see the `slack-*` skills in this environment).

### 3.8 The Grok assistant + git ("fix and evolve")
The Grok bot is a *coding/ops assistant*, not a trader. It:
- proposes strategy/param changes as **pull requests** to `origin` (exactly how a
  Cursor agent works), with a rationale;
- runs the backtest + paper gates in CI and posts results to Slack;
- never merges to the live config without passing gates + (initially) your
  approval. Keep all strategy logic and config in git so every change is
  reviewable, revertible, and attributable.

---

## 4. "Learn and fix itself" — a safe interpretation

Do **not** let a model freely rewrite live trading code. Instead, layer learning
with guardrails:

1. **Parameter adaptation (safest):** walk-forward optimisation of existing
   strategy params (e.g. RSI thresholds) on rolling windows; promote only if
   out-of-sample metrics beat the incumbent.
2. **Model-assisted features:** ML/LLM models produce *features/context*
   (sentiment, regime labels), while rule-based strategies stay in control of
   execution. This bounds the blast radius of a bad model.
3. **Self-healing (ops):** automatic detection of broken feeds, stale data,
   diverging paper-vs-expected behaviour → auto-pause + Slack alert. "Fixing
   itself" here means failing safe and asking for help, not hot-patching live.
4. **Assistant-proposed changes:** Grok opens PRs; CI gates + human review decide.

Every promotion path is: **backtest → walk-forward → paper (weeks) → tiny live →
scale**, with automatic rollback on breach.

---

## 5. Roadmap (staged, safety-first)

- **Phase 0 — Foundation (this PR):** candle model, indicators/patterns, strategy
  contract, paper broker, risk + kill switch, event-driven backtest, tests, demo.
- **Phase 1 — Real data + validation:** historical + live candle feeds; a proper
  backtest report (equity curve, drawdown, trade log); walk-forward harness.
- **Phase 2 — Paper trading on Alpaca:** implement `AlpacaBroker` against the
  paper endpoint; run the *same* engine live-paper; reconcile fills.
- **Phase 3 — Context fusion:** implement News/Discord/Macro (ForexFactory
  calendar, macro notes) sources + sentiment; feature-flag each.
- **Phase 4 — Slack control plane:** updates, questions, approvals, manual
  overrides, kill-switch command.
- **Phase 5 — Grok assistant loop:** PR-based strategy/param proposals gated by
  CI backtests; auto-report to Slack.
- **Phase 6 — Careful live (optional):** only after sustained positive paper
  results, with tiny size, strict limits, and full observability. Reassess the
  Robinhood ToS/PDT constraints; prefer an official-API broker.

Do not skip phases. The kill switch, position caps, and paper-first discipline are
the difference between a research project and an expensive lesson.

---

## 6. Technology choices

- **Python 3.12**, typed, standard-library-only core (easy to run/test; add
  `pandas`/`numpy`/`ta`/a backtest lib later if warranted).
- **Alpaca** (`alpaca-py`) as the first real broker; **CCXT** for crypto later
  (already a dependency elsewhere in this repo).
- **Slack Bolt** for the control plane; **discord.py** for Discord ingestion.
- **Grok (xAI API)** for the assistant that proposes PRs.
- **git/origin + CI** as the system of record and the promotion gate.

## 7. Security

- Never commit secrets; read names from `config.SECRET_NAMES`, values from env / a
  secrets manager (Cursor Secrets panel for Cloud Agents).
- Least-privilege API keys; separate paper and live credentials.
- Treat brokerage/API keys as crown jewels; rotate on any exposure.
- (This repo previously contained injected malware in the Node backend — audit
  dependencies and code before wiring anything to real money or accounts.)
