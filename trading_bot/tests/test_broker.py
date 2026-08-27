import pytest

from tradingcore.broker import (
    InsufficientFunds,
    LiveTradingNotEnabled,
    Order,
    PaperBroker,
    RobinhoodBroker,
    Side,
)


def test_buy_updates_cash_and_position():
    b = PaperBroker(starting_cash=10_000.0)
    b.submit(Order("AAPL", Side.BUY, 10), price=100.0)
    assert b.cash() == pytest.approx(9_000.0)
    pos = b.position("AAPL")
    assert pos.quantity == 10
    assert pos.avg_price == pytest.approx(100.0)


def test_average_price_on_scale_in():
    b = PaperBroker(starting_cash=10_000.0)
    b.submit(Order("AAPL", Side.BUY, 10), price=100.0)
    b.submit(Order("AAPL", Side.BUY, 10), price=120.0)
    assert b.position("AAPL").avg_price == pytest.approx(110.0)


def test_sell_realizes_pnl():
    b = PaperBroker(starting_cash=10_000.0)
    b.submit(Order("AAPL", Side.BUY, 10), price=100.0)
    b.submit(Order("AAPL", Side.SELL, 10), price=110.0)
    assert b.position("AAPL").quantity == 0
    assert b.realized_pnl == pytest.approx(100.0)  # 10 * (110-100)
    assert b.closed_trade_pnls == [pytest.approx(100.0)]


def test_insufficient_funds_rejected():
    b = PaperBroker(starting_cash=500.0)
    with pytest.raises(InsufficientFunds):
        b.submit(Order("AAPL", Side.BUY, 10), price=100.0)


def test_cannot_oversell_long_only():
    b = PaperBroker(starting_cash=10_000.0)
    with pytest.raises(InsufficientFunds):
        b.submit(Order("AAPL", Side.SELL, 5), price=100.0)


def test_equity_marks_to_market():
    b = PaperBroker(starting_cash=10_000.0)
    b.submit(Order("AAPL", Side.BUY, 10), price=100.0)
    assert b.equity({"AAPL": 130.0}) == pytest.approx(9_000.0 + 10 * 130.0)


def test_live_broker_is_blocked_by_default():
    with pytest.raises(LiveTradingNotEnabled):
        RobinhoodBroker()
    # Even when acknowledged, order routing is not implemented.
    rh = RobinhoodBroker(i_understand_the_risks=True)
    with pytest.raises(LiveTradingNotEnabled):
        rh.submit(Order("AAPL", Side.BUY, 1), price=100.0)
