"""Core market-data domain objects.

A :class:`Candle` is modelled as a rich value object with derived *properties*
(body, wicks, direction, ...) and helper *methods*. Strategies build decisions
from these properties at each new candle, per the project brief.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Iterator, Sequence


@dataclass(frozen=True, slots=True)
class Candle:
    """A single OHLCV bar for one symbol/timeframe.

    Immutable on purpose: a candle is a historical fact. Derived analytics are
    exposed as properties so a strategy can ask the candle about itself, e.g.
    ``candle.is_bullish`` or ``candle.body_pct``.
    """

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    symbol: str = ""
    timeframe: str = ""

    def __post_init__(self) -> None:
        if self.high < self.low:
            raise ValueError(f"high {self.high} < low {self.low}")
        if not (self.low <= self.open <= self.high):
            raise ValueError(f"open {self.open} outside [{self.low}, {self.high}]")
        if not (self.low <= self.close <= self.high):
            raise ValueError(f"close {self.close} outside [{self.low}, {self.high}]")

    # --- direction -------------------------------------------------------
    @property
    def is_bullish(self) -> bool:
        return self.close > self.open

    @property
    def is_bearish(self) -> bool:
        return self.close < self.open

    @property
    def is_doji_like(self) -> bool:
        """True when the body is a tiny fraction of the range (indecision)."""
        return self.range > 0 and self.body <= 0.1 * self.range

    # --- geometry --------------------------------------------------------
    @property
    def body(self) -> float:
        return abs(self.close - self.open)

    @property
    def range(self) -> float:
        return self.high - self.low

    @property
    def upper_wick(self) -> float:
        return self.high - max(self.open, self.close)

    @property
    def lower_wick(self) -> float:
        return min(self.open, self.close) - self.low

    @property
    def body_pct(self) -> float:
        """Body size as a fraction of the full range (0..1); 0 when range is 0."""
        return 0.0 if self.range == 0 else self.body / self.range

    @property
    def typical_price(self) -> float:
        return (self.high + self.low + self.close) / 3.0

    @property
    def midpoint(self) -> float:
        return (self.high + self.low) / 2.0

    def returns_from(self, prev: "Candle") -> float:
        """Simple close-to-close return relative to a previous candle."""
        if prev.close == 0:
            return 0.0
        return self.close / prev.close - 1.0


class CandleSeries:
    """An append-only, ordered collection of candles for one symbol/timeframe.

    Provides windowed access that indicators and strategies consume. Kept
    deliberately simple (a list under the hood) so the reference core has no
    third-party dependencies; swap for a columnar store when scaling.
    """

    def __init__(self, candles: Iterable[Candle] | None = None) -> None:
        self._candles: list[Candle] = list(candles) if candles else []

    def add(self, candle: Candle) -> None:
        if self._candles and candle.timestamp < self._candles[-1].timestamp:
            raise ValueError("candles must be added in non-decreasing time order")
        self._candles.append(candle)

    def __len__(self) -> int:
        return len(self._candles)

    def __iter__(self) -> Iterator[Candle]:
        return iter(self._candles)

    def __getitem__(self, index: int) -> Candle:
        return self._candles[index]

    @property
    def last(self) -> Candle:
        return self._candles[-1]

    def window(self, n: int) -> Sequence[Candle]:
        """The most recent ``n`` candles (fewer if not yet available)."""
        return self._candles[-n:]

    def closes(self) -> list[float]:
        return [c.close for c in self._candles]

    def highs(self) -> list[float]:
        return [c.high for c in self._candles]

    def lows(self) -> list[float]:
        return [c.low for c in self._candles]

    def opens(self) -> list[float]:
        return [c.open for c in self._candles]

    def volumes(self) -> list[float]:
        return [c.volume for c in self._candles]
