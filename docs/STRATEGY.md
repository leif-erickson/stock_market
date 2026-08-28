# Strategy

Paper-first US equity research. Alpaca paper is the stock book. Live Robinhood stays confirm-to-place and out of band. This is not financial advice.

## Named edge

**Stock auction:** 15-minute opening range + VWAP as fair value + relative volume on high-beta names; flatten by close.

That is three facets. It is not an AI narrative, not Gann, and not a 12-factor score.

**What would kill it:** OOS P&amp;L concentrated in one expansion window (Sep–Oct 2025 Nasdaq melt-up) that fails in the Nov 2025 holdout; or consistency collapsing when the regime is `reset`.

**What maintains it weekly:** keep the same 2–5 facets; change *where* a setup may fire (instrument family + regime). One experiment slot from the Grokbot inbox. Do not add facets because last week was green.

## Facet budget

Every setup declares **2–5 named facets** (`maxFacets: 5` in `backend/lib/config.js`). Detectors that exceed the budget fail a unit test. Journal `features` store those names plus price/time. Event-days (CPI / FOMC / mega-cap earnings) are an optional **skip**, not a sixth confirm.

| Setup | Family | Facets | Where it may fire |
|---|---|---|---|
| `orb_breakout` | auction | or_break, above_vwap, rvol | high-beta |
| `orb_retest` | auction | prior_or_break, mid_vwap_touch, rvol | high-beta |
| `vwap_rsi_reversion` | mean_reversion | vwap_reclaim, rsi, rvol | slow large-cap |
| `bar_reversal` | reversal | pin_or_engulf, at_vwap, rvol | both |
| `impulse_hold` | vol_expansion | or_or_structure_break, above_vwap, rvol | expansion regime only |
| `roundtrip_fade` | vol_reset | extension_from_high, vwap_loss_or_engulf, rvol | reset regime only; SELL signal — cash book does not short |

High-beta: `SOFI, PLTR, TSLA, ARKK, NVDA, QQQ`. Slow large-cap: `MSFT, AMZN, BRK.B`.

## Candle model

`Candle` and `Session` in `backend/lib/candle.js` own geometry (range, wicks, pin, engulf) and session series (OR, VWAP, RSI, swings). Detectors stay functions. `OrderflowSession` throws `NOT_IMPLEMENTED` — no fake CVD from candle color. Gann stays inbox-only.

## Validation

Walk-forward OOS (5 sessions in / 2 out) is **necessary and not sufficient**.

1. Purged gap: embargo 1 session around frozen event dates so a train fold’s last bar is not the same event as the test fold’s first bar.
2. Frozen anomaly windows — **never fit params here**:
   - `2025-09-01` → `2025-10-31` — Nasdaq expansion (late-Oct highs, AI/tech leadership).
   - `2025-11-01` → `2025-11-21` — tech round-trip (incl. 2025-11-20 Nvidia open-drive reversal).
3. Regime scorecard: `quiet` / `expansion` / `reset`. If ≥50% of gross P&amp;L is expansion and reset is flat or negative, the edge is trend-beta — do not promote.
4. Variant tax: if more than 10 setup variants were tried, require extra OOS trades.
5. Anomaly concentration: if gates fail when Oct–Nov 2025 is removed, status stays `paper` with `anomaly_dependent`.

Doubling-horizon (`GOAL_DOUBLE_DAYS`) is a **measurement**, never a promotion gate.

## Four asset books

| Book | Research here | Live | Notes |
|---|---|---|---|
| Stocks | Alpaca 5m paper | Robinhood MCP confirm-to-place after OOS | $100 cash, no options, flatten-by-close |
| Crypto | config + `asset_class`; ccxt portfolio quotes | never from this repo | Nasdaq-beta glance (BTC/ETH) |
| Futures | Rithmic stub; paper stats later | wstrat_candlemaster after R\|Protocol | NinjaTrader is out |
| Options | research note / IV hypothesis | not on $100 RH cash | defined-risk; no fill engine this pass |

Same economic event, different books. Do not stack QQQ + NQ + BTC as extra confirms on one stock trigger.

## Weekly maintenance

`npm run paper:weekly` writes `backend/reports/weekly.md`:

1. Named edge (from config, not improvised).
2. This sample’s OOS vs regime mix.
3. Frozen-window P&amp;L share.
4. Kill / park / promote per family (`live-eligible` only if gates clear **and** not `anomaly_dependent`).
5. One experiment slot: newest `strategy_ideas` in `inbox` / `exploring`.
6. Cross-asset glance (QQQ vs NQ vs BTC).

Weekday `paper:daily` is the tape. Weekly is where the edge is **maintained**.

## Parked

- Overnight stock swing book
- Real CVD / tick / Lee-Ready
- Gann math
- Live options or futures from this repo
- Flipping `LIVE_SWITCH`
