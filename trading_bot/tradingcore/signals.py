"""Strategy contract: strategies read candles + context and emit Signals.

Strategies never touch a broker directly. They return a :class:`Signal`; the
execution layer (backtest engine or live engine) is responsible for turning a
signal into risk-checked orders. This separation is what makes the core
broker-agnostic and reusable across trading systems.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Protocol, runtime_checkable

from tradingcore.context import ContextView
from tradingcore.domain import CandleSeries


class Action(Enum):
    BUY = "buy"        # open/increase a long
    SELL = "sell"      # reduce/close a long (short support is a later phase)
    CLOSE = "close"    # flatten any open position (e.g. end-of-day)
    HOLD = "hold"      # do nothing


@dataclass(frozen=True, slots=True)
class Signal:
    action: Action
    symbol: str
    confidence: float = 1.0            # 0..1; execution may scale size by this
    reason: str = ""                   # human-readable rationale (great for Slack)
    stop_distance: Optional[float] = None  # absolute price distance for risk sizing
    metadata: dict = field(default_factory=dict)

    @staticmethod
    def hold(symbol: str, reason: str = "") -> "Signal":
        return Signal(Action.HOLD, symbol, 0.0, reason)


@runtime_checkable
class Strategy(Protocol):
    """A pluggable strategy.

    ``warmup`` tells the engine how many candles are needed before signals are
    meaningful. ``on_candle`` is called once per new candle with the full series
    (up to and including the latest) and a point-in-time context view.
    """

    name: str
    warmup: int

    def on_candle(self, series: CandleSeries, context: ContextView) -> Signal: ...
