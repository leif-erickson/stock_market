import pytest

from tradingcore.marketdata import CsvBarLoader


def test_csv_parse_daily():
    text = (
        "Date,Open,High,Low,Close,Volume\n"
        "2026-01-02,100,102,99,101,1000\n"
        "2026-01-03,101,103,100,102,1100\n"
    )
    candles = CsvBarLoader(timeframe="1d").parse(text, "X")
    assert len(candles) == 2
    assert candles[0].close == 101 and candles[1].close == 102
    assert candles[0].timestamp.year == 2026
    assert candles[0].symbol == "X"


def test_csv_intraday_and_sorting():
    text = (
        "datetime,open,high,low,close,volume\n"
        "2026-01-02T10:05:00,101,101.5,100.5,101,10\n"
        "2026-01-02T10:00:00,100,101,99,100.5,20\n"  # out of order on purpose
    )
    candles = CsvBarLoader().parse(text, "X")
    assert [c.timestamp.minute for c in candles] == [0, 5]  # sorted ascending


def test_csv_skips_bad_rows():
    text = (
        "datetime,open,high,low,close\n"
        "2026-01-02T10:00:00,100,101,99,100.5\n"
        "bad,x,y,z,w\n"
    )
    assert len(CsvBarLoader().parse(text, "X")) == 1


def test_csv_missing_columns_raises():
    with pytest.raises(ValueError):
        CsvBarLoader().parse("a,b\n1,2\n", "X")
