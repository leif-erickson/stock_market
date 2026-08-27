"""Pure-Python technical indicators.

Each function takes a sequence of floats (usually candle closes) and returns a
list aligned to the input, with ``None`` during the warmup period. Returning the
full aligned series keeps callers honest about lookback and makes backtests and
live evaluation consistent.
"""

from __future__ import annotations

from typing import Optional, Sequence


def sma(values: Sequence[float], period: int) -> list[Optional[float]]:
    """Simple moving average."""
    if period <= 0:
        raise ValueError("period must be positive")
    out: list[Optional[float]] = [None] * len(values)
    running = 0.0
    for i, v in enumerate(values):
        running += v
        if i >= period:
            running -= values[i - period]
        if i >= period - 1:
            out[i] = running / period
    return out


def ema(values: Sequence[float], period: int) -> list[Optional[float]]:
    """Exponential moving average, seeded with the first ``period`` SMA."""
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(values)
    out: list[Optional[float]] = [None] * n
    if n < period:
        return out
    k = 2.0 / (period + 1.0)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    for i in range(period, n):
        prev = values[i] * k + prev * (1.0 - k)
        out[i] = prev
    return out


def rsi(values: Sequence[float], period: int = 14) -> list[Optional[float]]:
    """Wilder's Relative Strength Index (0..100)."""
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(values)
    out: list[Optional[float]] = [None] * n
    if n <= period:
        return out

    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, n):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))

    def rsi_value(avg_gain: float, avg_loss: float) -> float:
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - 100.0 / (1.0 + rs)

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    out[period] = rsi_value(avg_gain, avg_loss)

    for i in range(period + 1, n):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        out[i] = rsi_value(avg_gain, avg_loss)
    return out


def true_range(high: float, low: float, prev_close: float) -> float:
    return max(high - low, abs(high - prev_close), abs(low - prev_close))


def last(values: Sequence[Optional[float]]) -> Optional[float]:
    """Return the most recent non-``None`` value, or ``None`` if there is none."""
    for v in reversed(values):
        if v is not None:
            return v
    return None
