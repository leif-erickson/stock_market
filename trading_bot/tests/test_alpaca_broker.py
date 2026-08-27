import pytest

from tradingcore.adapters.alpaca_broker import AlpacaBroker
from tradingcore.broker import LiveTradingNotEnabled, Order, Side


class FakeAccount:
    def __init__(self, cash, equity):
        self.cash = cash
        self.equity = equity


class FakePosition:
    def __init__(self, symbol, qty, avg_entry_price):
        self.symbol = symbol
        self.qty = qty
        self.avg_entry_price = avg_entry_price


class FakeTradingClient:
    def __init__(self, positions=None, account=None):
        self.submitted = []
        self._positions = positions or []
        self._account = account

    def submit_order(self, request):
        self.submitted.append(request)
        return object()

    def get_all_positions(self):
        return self._positions

    def get_account(self):
        return self._account


def test_cash_and_equity_parsed_from_strings():
    client = FakeTradingClient(account=FakeAccount("100000.50", "105000.25"))
    broker = AlpacaBroker(client, paper=True)
    assert broker.cash() == pytest.approx(100000.50)
    assert broker.equity({}) == pytest.approx(105000.25)


def test_position_mapping():
    client = FakeTradingClient(positions=[FakePosition("AAPL", "10", "150.0")])
    broker = AlpacaBroker(client)
    pos = broker.position("AAPL")
    assert pos.quantity == 10 and pos.avg_price == 150.0
    assert broker.position("MSFT").quantity == 0  # flat when absent


def test_live_requires_explicit_ack():
    with pytest.raises(LiveTradingNotEnabled):
        AlpacaBroker.from_credentials("key", "secret", paper=False)


def test_submit_builds_market_order():
    pytest.importorskip("alpaca")
    from alpaca.trading.enums import OrderSide

    client = FakeTradingClient(account=FakeAccount("100000", "100000"))
    broker = AlpacaBroker(client, paper=True)
    fill = broker.submit(Order("AAPL", Side.BUY, 3), price=200.0)

    assert (fill.symbol, fill.side, fill.quantity, fill.price) == ("AAPL", Side.BUY, 3, 200.0)
    assert len(client.submitted) == 1
    req = client.submitted[0]
    assert req.symbol == "AAPL"
    assert float(req.qty) == 3
    assert req.side == OrderSide.BUY


def test_order_request_maps_sell():
    pytest.importorskip("alpaca")
    from alpaca.trading.enums import OrderSide

    req = AlpacaBroker._order_request(Order("MSFT", Side.SELL, 5))
    assert req.side == OrderSide.SELL and req.symbol == "MSFT"
