"""External context ingestion (news, Discord, macro feeds, Slack input).

The trading brief calls for fusing many information sources with price action.
We model every external input as a normalised :class:`ContextEvent`. Concrete
:class:`ContextSource` implementations (news APIs, Discord, ForexFactory,
lynalden.com, a Slack control channel) turn raw feeds into these events. A
:class:`ContextStore` aggregates them and exposes a read-only
:class:`ContextView` to strategies.

The stub sources here return no events by default so the engine runs end-to-end
without credentials. Each documents exactly what a real implementation must do.
Sentiment is normalised to ``[-1.0, +1.0]`` so heterogeneous sources compose.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class ContextEvent:
    """A single normalised piece of non-price information."""

    timestamp: datetime
    source: str            # e.g. "news", "discord:alerts", "forexfactory", "slack"
    kind: str              # e.g. "headline", "economic_release", "user_directive"
    symbol: Optional[str] = None       # None for macro/market-wide events
    sentiment: Optional[float] = None  # -1.0 (bearish) .. +1.0 (bullish)
    importance: float = 0.5            # 0..1 weight for aggregation
    payload: dict = field(default_factory=dict)


@runtime_checkable
class ContextView(Protocol):
    """Read-only view handed to strategies at each candle."""

    def recent(self, symbol: Optional[str], within: timedelta) -> list[ContextEvent]: ...

    def sentiment(self, symbol: Optional[str], within: timedelta) -> Optional[float]: ...


class ContextStore:
    """Collects events from sources and answers time-windowed queries.

    ``now`` is injected (defaults to the latest event or wall clock) so the same
    store works in a backtest (simulated time) and live (wall clock).
    """

    def __init__(self, events: list[ContextEvent] | None = None) -> None:
        self._events: list[ContextEvent] = sorted(events or [], key=lambda e: e.timestamp)
        self._now: Optional[datetime] = None

    def ingest(self, events: list[ContextEvent]) -> None:
        for e in events:
            self._events.append(e)
        self._events.sort(key=lambda e: e.timestamp)

    def set_clock(self, now: datetime) -> None:
        """Point-in-time cutoff; avoids look-ahead bias in backtests."""
        self._now = now

    def _cutoff(self) -> datetime:
        if self._now is not None:
            return self._now
        return self._events[-1].timestamp if self._events else datetime.min

    def recent(self, symbol: Optional[str], within: timedelta) -> list[ContextEvent]:
        if self._now is None and not self._events:
            return []  # no time basis yet; nothing to report
        cutoff = self._cutoff()
        start = cutoff - within
        return [
            e
            for e in self._events
            if start <= e.timestamp <= cutoff
            and (symbol is None or e.symbol is None or e.symbol == symbol)
        ]

    def sentiment(self, symbol: Optional[str], within: timedelta) -> Optional[float]:
        events = [e for e in self.recent(symbol, within) if e.sentiment is not None]
        if not events:
            return None
        weight = sum(e.importance for e in events) or 1.0
        return sum((e.sentiment or 0.0) * e.importance for e in events) / weight


@runtime_checkable
class ContextSource(Protocol):
    """Something that produces context events (poll- or push-based)."""

    name: str

    def poll(self) -> list[ContextEvent]: ...


# --- Stub sources ---------------------------------------------------------
# These return [] so the engine runs without credentials. Fill them in per the
# roadmap. NEVER hard-code secrets here; read names from config and values from
# the environment / secrets manager.


class NewsSource:
    """Financial headlines -> sentiment-scored ContextEvents.

    Real implementation: pull from a news/RSS API, run a sentiment model, and
    emit one event per headline tagged with the affected symbol(s).
    """

    name = "news"

    def poll(self) -> list[ContextEvent]:
        return []


class DiscordSource:
    """Messages from configured Discord channels -> ContextEvents.

    Real implementation: a discord.py client (or webhook consumer) that maps
    channel chatter to ``kind="discord_message"`` events, optionally scored.
    """

    name = "discord"

    def poll(self) -> list[ContextEvent]:
        return []


class MacroSource:
    """Daily/macro commentary (e.g. lynalden.com) and the ForexFactory calendar.

    Real implementation: scrape/parse the economic calendar for scheduled
    releases (with actual/forecast/previous) and long-form macro posts, emitting
    ``kind="economic_release"`` / ``kind="macro_note"`` events. Respect each
    site's terms of service and rate limits.
    """

    name = "macro"

    def poll(self) -> list[ContextEvent]:
        return []
