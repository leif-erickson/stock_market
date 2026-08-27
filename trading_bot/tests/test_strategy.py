from datetime import datetime, time, timedelta

from tradingcore.context import ContextStore
from tradingcore.domain import Candle, CandleSeries
from tradingcore.signals import Action
from tradingcore.strategies import RsiReversionStrategy


def _series(candles):
    s = CandleSeries()
    for c in candles:
        s.add(c)
    return s


def test_warmup_returns_hold():
    strat = RsiReversionStrategy("X", rsi_period=14)
    s = _series([Candle(datetime(2026, 1, 2, 10, i), 100, 100, 100, 100, symbol="X")
                 for i in range(3)])
    assert strat.on_candle(s, ContextStore()).action is Action.HOLD


def test_session_end_forces_flat():
    strat = RsiReversionStrategy("X", rsi_period=14, session_flat_after=time(15, 55))
    candles = [Candle(datetime(2026, 1, 2, 10, 0) + timedelta(minutes=i),
                      100, 100, 100, 100, symbol="X") for i in range(20)]
    # Make the final candle land after the flatten cutoff.
    candles[-1] = Candle(datetime(2026, 1, 2, 15, 56), 100, 100, 100, 100, symbol="X")
    sig = strat.on_candle(_series(candles), ContextStore())
    assert sig.action is Action.CLOSE


def test_oversold_hammer_triggers_buy():
    strat = RsiReversionStrategy("X", rsi_period=14, oversold=30.0)
    candles = []
    o = 130.0
    for i in range(18):  # strictly declining bearish candles -> RSI -> ~0
        candles.append(Candle(datetime(2026, 1, 2, 10, i), o, o, o - 1, o - 1, symbol="X"))
        o -= 1
    # Bullish hammer at the bottom (long lower wick, small body).
    candles.append(Candle(datetime(2026, 1, 2, 10, 18), 112, 113, 102, 113, symbol="X"))

    sig = strat.on_candle(_series(candles), ContextStore())
    assert sig.action is Action.BUY
    assert sig.stop_distance is not None and sig.stop_distance > 0
    assert 0.0 < sig.confidence <= 1.0


def test_negative_sentiment_can_veto_entry():
    from tradingcore.context import ContextEvent

    strat = RsiReversionStrategy(
        "X", rsi_period=14, oversold=30.0, require_nonnegative_sentiment=True
    )
    candles = []
    o = 130.0
    for i in range(18):
        candles.append(Candle(datetime(2026, 1, 2, 10, i), o, o, o - 1, o - 1, symbol="X"))
        o -= 1
    candles.append(Candle(datetime(2026, 1, 2, 10, 18), 112, 113, 102, 113, symbol="X"))

    store = ContextStore([
        ContextEvent(datetime(2026, 1, 2, 10, 17), "news", "headline",
                     symbol="X", sentiment=-0.8, importance=1.0)
    ])
    store.set_clock(datetime(2026, 1, 2, 10, 18))
    assert strat.on_candle(_series(candles), store).action is Action.HOLD
