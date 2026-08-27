from datetime import datetime, timedelta

from tradingcore.backtest import max_drawdown, run_backtest, sharpe
from tradingcore.broker import PaperBroker
from tradingcore.domain import Candle, CandleSeries
from tradingcore.signals import Action, Signal


class BuyOnceStrategy:
    """Deterministic strategy for exercising the engine plumbing."""

    name = "buy_once"
    warmup = 1

    def __init__(self, symbol: str) -> None:
        self.symbol = symbol
        self._seen = 0

    def on_candle(self, series: CandleSeries, context) -> Signal:
        self._seen += 1
        if self._seen == 2:
            return Signal(Action.BUY, self.symbol, 1.0, "test buy")
        return Signal.hold(self.symbol)


def _rising_candles(symbol: str, n: int) -> list[Candle]:
    base = datetime(2026, 1, 2, 10, 0)
    out = []
    price = 100.0
    for i in range(n):
        out.append(Candle(base + timedelta(minutes=i), price, price + 1, price - 0.5,
                          price + 1, volume=1000, symbol=symbol))
        price += 1
    return out


def test_max_drawdown():
    assert max_drawdown([100, 120, 90, 110]) == (120 - 90) / 120


def test_sharpe_zero_when_flat():
    assert sharpe([0.0, 0.0, 0.0]) == 0.0


def test_backtest_executes_and_tracks_equity():
    candles = _rising_candles("X", 6)
    broker = PaperBroker(starting_cash=100_000.0)
    result = run_backtest(candles, BuyOnceStrategy("X"), broker=broker)

    # A position was opened, and the rising market grew equity above the start.
    assert result.num_fills >= 1
    assert len(result.equity_curve) == len(candles)
    assert result.equity_curve[-1][1] > 100_000.0
    assert set(result.metrics) == {
        "total_return", "max_drawdown", "sharpe", "win_rate", "num_trades"
    }
    assert result.metrics["total_return"] > 0.0


def test_backtest_with_no_signals_is_flat():
    class NeverTrades:
        name = "never"
        warmup = 1

        def on_candle(self, series, context):
            return Signal.hold("X")

    candles = _rising_candles("X", 5)
    result = run_backtest(candles, NeverTrades(), broker=PaperBroker(50_000.0))
    assert result.num_fills == 0
    assert result.metrics["total_return"] == 0.0
