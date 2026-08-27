"""Real-data intraday backtest using keyless Yahoo Finance data.

Fetches recent intraday bars, runs the example intraday RSI strategy (flat by the
close), and prints a performance report. Requires the ``yahoo`` extra:

    pip install -e ".[yahoo]"
    python examples/run_yahoo_backtest.py AAPL 5m 5d

Results are illustrative of the *pipeline*, not a profitability claim.
"""

from __future__ import annotations

import sys

from tradingcore.adapters.yahoo_data import YahooData
from tradingcore.backtest import run_backtest
from tradingcore.broker import PaperBroker
from tradingcore.risk import RiskLimits
from tradingcore.strategies import RsiReversionStrategy

# Bars/year for Sharpe annualisation, keyed by interval (approx US equity session).
_PPY = {"1m": 390 * 252, "5m": 78 * 252, "15m": 26 * 252, "1h": 7 * 252, "1d": 252}


def main() -> None:
    symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    interval = sys.argv[2] if len(sys.argv) > 2 else "5m"
    period = sys.argv[3] if len(sys.argv) > 3 else "5d"

    candles = YahooData(interval=interval).get_bars(symbol, period=period)
    if not candles:
        print(f"No candles returned for {symbol} {interval} {period}.")
        return

    strategy = RsiReversionStrategy(symbol, rsi_period=14, oversold=30.0, exit_level=55.0)
    broker = PaperBroker(starting_cash=100_000.0, slippage_bps=1.0)
    result = run_backtest(
        candles, strategy, broker=broker, limits=RiskLimits(),
        periods_per_year=_PPY.get(interval, 252),
    )

    first, last = candles[0].timestamp, candles[-1].timestamp
    print(f"{symbol} {interval} — {len(candles)} bars  {first} .. {last}")
    print(f"fills             : {result.num_fills}")
    print(f"round-trip trades : {int(result.metrics['num_trades'])}")
    print(f"win rate          : {result.metrics['win_rate']:.1%}")
    print(f"total return      : {result.metrics['total_return']:.2%}")
    print(f"max drawdown      : {result.metrics['max_drawdown']:.2%}")
    print(f"sharpe (annualised): {result.metrics['sharpe']:.2f}")
    print(f"ending equity     : ${result.equity_curve[-1][1]:,.2f}")
    print(f"realized PnL      : ${broker.realized_pnl:,.2f}")
    print("\nNOTE: real market data, illustrative strategy — NOT a profitability claim.")


if __name__ == "__main__":
    main()
