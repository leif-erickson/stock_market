"""End-to-end demo: run the example intraday RSI strategy over synthetic candles.

This proves the pipeline (candles -> strategy -> risk -> paper broker -> metrics)
runs end to end. The synthetic data is a mean-reverting random walk; results are
illustrative ONLY and say nothing about live profitability.

Run:  python examples/demo_backtest.py
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from tradingcore.backtest import run_backtest
from tradingcore.broker import PaperBroker
from tradingcore.domain import Candle
from tradingcore.risk import RiskLimits
from tradingcore.strategies import RsiReversionStrategy

SYMBOL = "DEMO"


def synthetic_candles(days: int = 3, seed: int = 7) -> list[Candle]:
    rng = random.Random(seed)
    candles: list[Candle] = []
    prev_close = 100.0
    for d in range(days):
        day = datetime(2026, 1, 5) + timedelta(days=d)
        t = day.replace(hour=9, minute=30)
        end = day.replace(hour=16, minute=0)
        step = 0
        while t < end:
            # Mean-reverting oscillation + noise -> creates oversold dips.
            drift = 6.0 * math.sin(step / 7.0)
            price = 100.0 + drift + rng.uniform(-1.0, 1.0)
            o = prev_close
            c = price
            hi = max(o, c) + abs(rng.uniform(0, 0.4))
            lo = min(o, c) - abs(rng.uniform(0, 0.8))  # bias longer lower wicks
            candles.append(Candle(t, o, hi, lo, c, volume=1000, symbol=SYMBOL))
            prev_close = c
            t += timedelta(minutes=5)
            step += 1
    return candles


def main() -> None:
    candles = synthetic_candles()
    strategy = RsiReversionStrategy(SYMBOL, rsi_period=14, oversold=32.0, exit_level=55.0)
    broker = PaperBroker(starting_cash=100_000.0, commission_per_trade=0.0, slippage_bps=1.0)
    # ~78 five-minute bars per session -> annualise Sharpe against 252 sessions.
    result = run_backtest(
        candles, strategy, broker=broker, limits=RiskLimits(), periods_per_year=78 * 252
    )

    print(f"candles processed : {len(candles)}")
    print(f"fills             : {result.num_fills}")
    print(f"round-trip trades : {int(result.metrics['num_trades'])}")
    print(f"win rate          : {result.metrics['win_rate']:.1%}")
    print(f"total return      : {result.metrics['total_return']:.2%}")
    print(f"max drawdown      : {result.metrics['max_drawdown']:.2%}")
    print(f"sharpe (annualised): {result.metrics['sharpe']:.2f}")
    print(f"ending equity     : ${result.equity_curve[-1][1]:,.2f}")
    print(f"realized PnL      : ${broker.realized_pnl:,.2f}")
    print("\nNOTE: synthetic data; illustrative only, not a profitability claim.")


if __name__ == "__main__":
    main()
