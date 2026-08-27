"""Example strategies.

These are *illustrative*, not validated money-makers. They exist to demonstrate
the contract: derive features from each candle (momentum, patterns), fuse them
with external context sentiment, and emit a risk-annotated Signal — while staying
flat overnight per the brief.
"""

from __future__ import annotations

from datetime import time, timedelta

from tradingcore import patterns
from tradingcore.context import ContextView
from tradingcore.domain import CandleSeries
from tradingcore.indicators import last, rsi
from tradingcore.signals import Action, Signal, Strategy


class RsiReversionStrategy:
    """Intraday RSI mean-reversion, confirmed by candle shape and news sentiment.

    Entry: RSI below ``oversold`` and a bullish reversal candle (hammer or
    bullish engulfing). Optionally require non-negative context sentiment.
    Exit: RSI back above ``exit_level``, OR forced flat near the session close so
    the position is never held overnight.

    This class satisfies the :class:`~tradingcore.signals.Strategy` protocol.
    """

    def __init__(
        self,
        symbol: str,
        rsi_period: int = 14,
        oversold: float = 30.0,
        exit_level: float = 55.0,
        session_flat_after: time = time(15, 55),
        sentiment_lookback: timedelta = timedelta(hours=6),
        require_nonnegative_sentiment: bool = False,
    ) -> None:
        self.symbol = symbol
        self.rsi_period = rsi_period
        self.oversold = oversold
        self.exit_level = exit_level
        self.session_flat_after = session_flat_after
        self.sentiment_lookback = sentiment_lookback
        self.require_nonnegative_sentiment = require_nonnegative_sentiment

        self.name = f"rsi_reversion({symbol})"
        self.warmup = rsi_period + 2

    def on_candle(self, series: CandleSeries, context: ContextView) -> Signal:
        if len(series) < self.warmup:
            return Signal.hold(self.symbol, "warming up")

        candle = series.last

        # Never hold overnight: force a flatten near the session close.
        if candle.timestamp.time() >= self.session_flat_after:
            return Signal(Action.CLOSE, self.symbol, 1.0, "session end: go flat")

        rsi_value = last(rsi(series.closes(), self.rsi_period))
        if rsi_value is None:
            return Signal.hold(self.symbol, "no rsi yet")

        # Exit longs when momentum has recovered.
        if rsi_value >= self.exit_level:
            return Signal(Action.SELL, self.symbol, 1.0, f"rsi {rsi_value:.1f} >= exit")

        # Entry: oversold + a bullish reversal candle.
        prev = series[-2]
        bullish_shape = patterns.is_hammer(candle) or patterns.is_bullish_engulfing(prev, candle)
        if rsi_value <= self.oversold and bullish_shape:
            sentiment = context.sentiment(self.symbol, self.sentiment_lookback)
            if self.require_nonnegative_sentiment and sentiment is not None and sentiment < 0:
                return Signal.hold(self.symbol, f"oversold but sentiment {sentiment:.2f} < 0")
            # Confidence blends how oversold we are with any positive sentiment.
            depth = min(1.0, (self.oversold - rsi_value) / self.oversold)
            confidence = 0.5 + 0.5 * depth
            if sentiment is not None and sentiment > 0:
                confidence = min(1.0, confidence + 0.2 * sentiment)
            stop = candle.close - candle.low  # stop below the reversal low
            return Signal(
                Action.BUY,
                self.symbol,
                confidence,
                f"rsi {rsi_value:.1f} <= {self.oversold} + bullish candle",
                stop_distance=max(stop, 1e-9),
            )

        return Signal.hold(self.symbol, f"rsi {rsi_value:.1f}, no setup")


# Static type check: RsiReversionStrategy conforms to the Strategy protocol.
_: type[Strategy] = RsiReversionStrategy
