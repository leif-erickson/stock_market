"""Backtest over Alpaca historical bars.

Requires the ``alpaca`` extra and Alpaca API credentials in the environment:

    pip install -e ".[alpaca]"
    export ALPACA_API_KEY=...   ALPACA_SECRET_KEY=...
    python examples/run_alpaca_backtest.py AAPL

Uses free market data (IEX feed) available with any Alpaca account. This only
reads historical data — it places no orders.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

from tradingcore.adapters.alpaca_data import AlpacaData
from tradingcore.backtest import run_backtest
from tradingcore.broker import PaperBroker
from tradingcore.strategies import RsiReversionStrategy


def main() -> None:
    api_key = os.environ.get("ALPACA_API_KEY")
    secret_key = os.environ.get("ALPACA_SECRET_KEY")
    if not api_key or not secret_key:
        print("Set ALPACA_API_KEY and ALPACA_SECRET_KEY in the environment.")
        raise SystemExit(2)

    symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    from alpaca.data.timeframe import TimeFrame

    end = datetime.now(timezone.utc) - timedelta(minutes=20)  # respect the free-feed delay
    start = end - timedelta(days=5)

    data = AlpacaData.from_credentials(api_key, secret_key)
    candles = data.get_bars(symbol, start=start, end=end, timeframe=TimeFrame.Minute)
    if not candles:
        print("No candles returned.")
        return

    strategy = RsiReversionStrategy(symbol, rsi_period=14)
    broker = PaperBroker(starting_cash=100_000.0, slippage_bps=1.0)
    result = run_backtest(candles, strategy, broker=broker, periods_per_year=390 * 252)

    print(f"{symbol} — {len(candles)} 1-min bars")
    print(f"trades: {int(result.metrics['num_trades'])}  "
          f"win rate: {result.metrics['win_rate']:.1%}  "
          f"return: {result.metrics['total_return']:.2%}  "
          f"maxDD: {result.metrics['max_drawdown']:.2%}")
    print("NOTE: illustrative; not a profitability claim.")


if __name__ == "__main__":
    main()
