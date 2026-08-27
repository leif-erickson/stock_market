"""Historical market-data loading.

A :class:`BarLoader` turns a symbol + date range into :class:`~tradingcore.domain.Candle`
objects that the backtest engine consumes. Concrete loaders (Alpaca, Yahoo) live
in :mod:`tradingcore.adapters`; :class:`CsvBarLoader` here is keyless and
dependency-free, ideal for reproducible tests and offline backtests.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Iterable, Optional, Protocol, runtime_checkable

from tradingcore.domain import Candle


@runtime_checkable
class BarLoader(Protocol):
    """Loads historical OHLCV bars for one symbol as ordered candles."""

    def get_bars(self, symbol: str, start: datetime, end: datetime) -> list[Candle]: ...


def _parse_dt(raw: str) -> datetime:
    raw = raw.strip()
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
    raise ValueError(f"unrecognised datetime: {raw!r}")


def candles_from_rows(
    rows: Iterable[tuple[datetime, float, float, float, float, float]],
    symbol: str,
    timeframe: str = "",
) -> list[Candle]:
    """Build candles from (timestamp, open, high, low, close, volume) tuples.

    Rows that fail :class:`Candle` validation (bad OHLC ordering, NaNs) are
    skipped rather than aborting a whole backtest on one dirty bar.
    """
    out: list[Candle] = []
    for ts, o, h, l, c, v in rows:
        try:
            out.append(Candle(ts, float(o), float(h), float(l), float(c), float(v), symbol, timeframe))
        except (ValueError, TypeError):
            continue
    return out


class CsvBarLoader:
    """Parse OHLCV candles from CSV text or a file.

    Recognised (case-insensitive) columns: a date column named one of
    ``date``/``datetime``/``timestamp``, plus ``open``/``high``/``low``/``close``
    and optional ``volume``. Reproducible and keyless.
    """

    _DATE_KEYS = ("datetime", "date", "timestamp", "time")

    def __init__(self, timeframe: str = "") -> None:
        self.timeframe = timeframe

    def parse(self, text: str, symbol: str) -> list[Candle]:
        reader = csv.reader(io.StringIO(text))
        rows = [r for r in reader if r]
        if not rows:
            return []
        header = [h.strip().lower() for h in rows[0]]

        def index_of(*names: str) -> Optional[int]:
            for name in names:
                if name in header:
                    return header.index(name)
            return None

        di = next((index_of(k) for k in self._DATE_KEYS if index_of(k) is not None), None)
        oi, hi, li, ci = index_of("open"), index_of("high"), index_of("low"), index_of("close")
        vi = index_of("volume")
        if None in (di, oi, hi, li, ci):
            raise ValueError(f"CSV missing required columns; header={header}")

        parsed: list[tuple[datetime, float, float, float, float, float]] = []
        for row in rows[1:]:
            try:
                ts = _parse_dt(row[di])
                o, h, l, c = float(row[oi]), float(row[hi]), float(row[li]), float(row[ci])
                v = float(row[vi]) if vi is not None and row[vi] != "" else 0.0
            except (ValueError, IndexError):
                continue
            parsed.append((ts, o, h, l, c, v))
        parsed.sort(key=lambda r: r[0])
        return candles_from_rows(parsed, symbol, self.timeframe)

    def load_file(self, path: str, symbol: str) -> list[Candle]:
        with open(path, encoding="utf-8") as fh:
            return self.parse(fh.read(), symbol)
