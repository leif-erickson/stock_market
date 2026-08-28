"""Alpaca historical bar data -> Candle objects.

The client is injected so the pure translation logic (bar -> Candle) is testable
without the SDK or network. ``from_credentials`` builds the real
``StockHistoricalDataClient`` via a lazy import.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from tradingcore.domain import Candle


class AlpacaData:
    def __init__(self, client: object) -> None:
        self._client = client

    @classmethod
    def from_credentials(cls, api_key: str, secret_key: str) -> "AlpacaData":
        from alpaca.data.historical import StockHistoricalDataClient

        return cls(StockHistoricalDataClient(api_key, secret_key))

    # --- pure translation (no SDK import) --------------------------------
    @staticmethod
    def _bar_to_candle(bar: object, symbol: str, timeframe: str) -> Candle:
        return Candle(
            timestamp=getattr(bar, "timestamp"),
            open=float(getattr(bar, "open")),
            high=float(getattr(bar, "high")),
            low=float(getattr(bar, "low")),
            close=float(getattr(bar, "close")),
            volume=float(getattr(bar, "volume", 0.0) or 0.0),
            symbol=symbol,
            timeframe=timeframe,
        )

    @staticmethod
    def _barset_to_candles(barset: object, symbol: str, timeframe: str) -> list[Candle]:
        # alpaca-py returns a BarSet with a ``.data`` dict keyed by symbol.
        if hasattr(barset, "data"):
            bars = barset.data.get(symbol, [])
        else:  # a plain mapping (used by fakes/tests)
            bars = barset[symbol] if symbol in barset else []
        out: list[Candle] = []
        for bar in bars:
            try:
                out.append(AlpacaData._bar_to_candle(bar, symbol, timeframe))
            except (ValueError, TypeError):
                continue
        return out

    # --- SDK request building (needs the SDK) ----------------------------
    @staticmethod
    def _resolve_feed(feed: object):
        """Coerce a feed string/enum to a DataFeed; None means server default."""
        if feed is None:
            return None
        from alpaca.data.enums import DataFeed

        return feed if isinstance(feed, DataFeed) else DataFeed(str(feed).lower())

    @staticmethod
    def _build_request(symbol: str, start: datetime, end: datetime, timeframe: object, feed: object = None):
        from alpaca.data.requests import StockBarsRequest

        kwargs = dict(symbol_or_symbols=symbol, timeframe=timeframe, start=start, end=end)
        if feed is not None:
            kwargs["feed"] = feed
        return StockBarsRequest(**kwargs)

    def get_bars(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
        timeframe: Optional[object] = None,
        feed: object = "iex",  # free/paper accounts use IEX; SIP needs a subscription
    ) -> list[Candle]:
        from alpaca.data.timeframe import TimeFrame

        tf = timeframe if timeframe is not None else TimeFrame.Minute
        request = self._build_request(symbol, start, end, tf, self._resolve_feed(feed))
        barset = self._client.get_stock_bars(request)
        return self._barset_to_candles(barset, symbol, str(tf))
