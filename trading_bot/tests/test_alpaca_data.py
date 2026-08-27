from datetime import datetime

import pytest

from tradingcore.adapters.alpaca_data import AlpacaData


class FakeBar:
    def __init__(self, timestamp, open, high, low, close, volume=0.0):
        self.timestamp = timestamp
        self.open = open
        self.high = high
        self.low = low
        self.close = close
        self.volume = volume


class FakeBarSet:
    def __init__(self, data):
        self.data = data


def test_bar_to_candle_pure():
    bar = FakeBar(datetime(2026, 1, 2, 10, 0), 100, 101, 99, 100.5, 1000)
    c = AlpacaData._bar_to_candle(bar, "AAPL", "1Min")
    assert c.symbol == "AAPL"
    assert c.timeframe == "1Min"
    assert (c.open, c.high, c.low, c.close, c.volume) == (100, 101, 99, 100.5, 1000)


def test_barset_to_candles_pure():
    bar = FakeBar(datetime(2026, 1, 2, 10, 0), 100, 101, 99, 100.5, 1000)
    barset = FakeBarSet({"AAPL": [bar, bar, bar]})
    candles = AlpacaData._barset_to_candles(barset, "AAPL", "1Min")
    assert len(candles) == 3
    assert AlpacaData._barset_to_candles(barset, "MSFT", "1Min") == []


def test_barset_skips_invalid_bar():
    good = FakeBar(datetime(2026, 1, 2, 10, 0), 100, 101, 99, 100.5, 10)
    bad = FakeBar(datetime(2026, 1, 2, 10, 1), 100, 90, 99, 100.5, 10)  # high < low
    candles = AlpacaData._barset_to_candles(FakeBarSet({"X": [good, bad]}), "X", "1Min")
    assert len(candles) == 1


def test_build_request_shape():
    pytest.importorskip("alpaca")
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame

    req = AlpacaData._build_request("AAPL", datetime(2026, 1, 1), datetime(2026, 1, 2), TimeFrame.Minute)
    assert isinstance(req, StockBarsRequest)
    assert req.symbol_or_symbols == "AAPL"
