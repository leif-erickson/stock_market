"""Candlestick pattern detectors.

Each detector operates on :class:`~tradingcore.domain.Candle` objects and returns
a bool. They are intentionally conservative and parameterised so a strategy can
tune sensitivity. Patterns are *features*, not standalone signals: combine them
with trend/momentum context before acting.
"""

from __future__ import annotations

from tradingcore.domain import Candle


def is_doji(candle: Candle, max_body_pct: float = 0.1) -> bool:
    """Indecision: body is a small fraction of the range."""
    return candle.range > 0 and candle.body_pct <= max_body_pct


def is_hammer(candle: Candle, min_lower_wick_ratio: float = 2.0) -> bool:
    """Bullish reversal shape: long lower wick, small body, small upper wick."""
    if candle.body == 0:
        return False
    return (
        candle.lower_wick >= min_lower_wick_ratio * candle.body
        and candle.upper_wick <= candle.body
    )


def is_shooting_star(candle: Candle, min_upper_wick_ratio: float = 2.0) -> bool:
    """Bearish reversal shape: long upper wick, small body, small lower wick."""
    if candle.body == 0:
        return False
    return (
        candle.upper_wick >= min_upper_wick_ratio * candle.body
        and candle.lower_wick <= candle.body
    )


def is_bullish_engulfing(prev: Candle, cur: Candle) -> bool:
    """Current bullish body fully engulfs the previous bearish body."""
    return (
        prev.is_bearish
        and cur.is_bullish
        and cur.open <= prev.close
        and cur.close >= prev.open
    )


def is_bearish_engulfing(prev: Candle, cur: Candle) -> bool:
    """Current bearish body fully engulfs the previous bullish body."""
    return (
        prev.is_bullish
        and cur.is_bearish
        and cur.open >= prev.close
        and cur.close <= prev.open
    )
