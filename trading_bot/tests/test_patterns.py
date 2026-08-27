from datetime import datetime

from tradingcore.domain import Candle
from tradingcore.patterns import (
    is_bearish_engulfing,
    is_bullish_engulfing,
    is_doji,
    is_hammer,
    is_shooting_star,
)

TS = datetime(2026, 1, 2, 10, 0)


def c(o, h, l, cl):
    return Candle(TS, o, h, l, cl)


def test_doji():
    assert is_doji(c(100, 101, 99, 100.05))
    assert not is_doji(c(100, 101, 99, 100.9))


def test_hammer():
    assert is_hammer(c(100, 101, 90, 100.5))       # long lower wick, small body
    assert not is_hammer(c(100, 110, 99, 109))     # big body, not a hammer


def test_shooting_star():
    assert is_shooting_star(c(100, 110, 99.5, 100.5))
    assert not is_shooting_star(c(100, 101, 90, 100.5))


def test_bullish_engulfing():
    prev = c(100, 100.5, 97, 98)   # bearish
    cur = c(97.5, 101, 97, 100.5)  # bullish, engulfs prev body
    assert is_bullish_engulfing(prev, cur)
    assert not is_bullish_engulfing(cur, prev)


def test_bearish_engulfing():
    prev = c(98, 101, 97.5, 100.5)  # bullish
    cur = c(101, 101.5, 97, 98)     # bearish, engulfs prev body
    assert is_bearish_engulfing(prev, cur)
