"""tradingcore: a broker-agnostic, event-driven trading research core.

Design goals
------------
- **Safe by default**: only ``BACKTEST`` and ``PAPER`` execution are supported.
  Live trading is intentionally *not* implemented and is hard-gated behind an
  explicit environment flag plus an adapter that must be written deliberately.
- **Broker-agnostic**: strategies emit :class:`~tradingcore.signals.Signal`
  objects; a :class:`~tradingcore.broker.Broker` executes them. Swap Alpaca,
  Robinhood, Interactive Brokers, or a simulator without touching strategy code.
- **Event-driven around candles**: each :class:`~tradingcore.domain.Candle` is a
  rich object; strategies react to every new candle *and* to external context
  (news, Discord, macro feeds) via a :class:`~tradingcore.context.ContextView`.

This package is a *foundation*, not a finished profitable bot. See ARCHITECTURE.md
for the realistic roadmap and risk disclosures.
"""

from tradingcore.domain import Candle, CandleSeries
from tradingcore.signals import Action, Signal, Strategy
from tradingcore.broker import Broker, PaperBroker, Order, OrderType, Side, Position

__all__ = [
    "Candle",
    "CandleSeries",
    "Action",
    "Signal",
    "Strategy",
    "Broker",
    "PaperBroker",
    "Order",
    "OrderType",
    "Side",
    "Position",
]

__version__ = "0.1.0"
