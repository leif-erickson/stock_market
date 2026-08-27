"""Keyless historical bars via Yahoo Finance (``yfinance``).

Handy for reproducing real (including intraday) backtests without a broker API
key. ``yfinance`` is optional (``pip install -e ".[yahoo]"``) and imported lazily.
Intraday intervals (e.g. ``5m``) are only available for a trailing window per
Yahoo's limits.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from tradingcore.domain import Candle


class YahooData:
    def __init__(self, interval: str = "5m") -> None:
        self.interval = interval

    def get_bars(
        self,
        symbol: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        interval: Optional[str] = None,
        period: Optional[str] = None,
    ) -> list[Candle]:
        import yfinance as yf

        iv = interval or self.interval
        if period:
            df = yf.download(symbol, period=period, interval=iv, progress=False, auto_adjust=False)
        else:
            df = yf.download(symbol, start=start, end=end, interval=iv, progress=False, auto_adjust=False)
        return self._frame_to_candles(df, symbol, iv)

    @staticmethod
    def _frame_to_candles(df, symbol: str, timeframe: str) -> list[Candle]:
        import math

        import pandas as pd

        if df is None or len(df) == 0:
            return []
        # yfinance uses a (Price, Ticker) column MultiIndex for single symbols.
        if isinstance(df.columns, pd.MultiIndex):
            df = df.droplevel(axis=1, level=1)
        df = df.rename(columns=str)

        out: list[Candle] = []
        for ts, row in df.iterrows():
            try:
                o, h, l, c = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])
                v = float(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else 0.0
            except (KeyError, ValueError, TypeError):
                continue
            if any(math.isnan(x) for x in (o, h, l, c)):
                continue
            when = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts
            try:
                out.append(Candle(when, o, h, l, c, v, symbol, timeframe))
            except (ValueError, TypeError):
                continue
        return out
