"""Alpaca broker adapter implementing the :class:`~tradingcore.broker.Broker` protocol.

Defaults to **paper** trading (Alpaca's simulated account over the official API).
Live trading is refused unless the operator explicitly acknowledges the risk; even
then, use it deliberately. The client is injected so submit/position/cash/equity
mapping is unit-testable with a fake, without network or credentials.

Note: market fills are asynchronous. ``submit`` returns a Fill echoing the
reference price passed by the caller; reconciling the true ``filled_avg_price``
by polling order status is a documented follow-up (Phase 2+ live loop).
"""

from __future__ import annotations

from tradingcore.broker import (
    Fill,
    LiveTradingNotEnabled,
    Order,
    OrderType,
    Position,
    Side,
)


class AlpacaBroker:
    def __init__(self, client: object, paper: bool = True) -> None:
        self._client = client
        self.paper = paper

    @classmethod
    def from_credentials(
        cls,
        api_key: str,
        secret_key: str,
        paper: bool = True,
        i_understand_live_risk: bool = False,
    ) -> "AlpacaBroker":
        if not paper and not i_understand_live_risk:
            raise LiveTradingNotEnabled(
                "Alpaca LIVE trading requires i_understand_live_risk=True. "
                "Validate on paper (paper=True) first."
            )
        from alpaca.trading.client import TradingClient

        return cls(TradingClient(api_key, secret_key, paper=paper), paper=paper)

    # --- SDK request building (needs the SDK) ----------------------------
    @staticmethod
    def _order_request(order: Order):
        from alpaca.trading.enums import OrderSide, TimeInForce
        from alpaca.trading.requests import MarketOrderRequest

        if order.type is not OrderType.MARKET:
            raise NotImplementedError("AlpacaBroker adapter currently supports market orders only")
        side = OrderSide.BUY if order.side is Side.BUY else OrderSide.SELL
        return MarketOrderRequest(
            symbol=order.symbol,
            qty=order.quantity,
            side=side,
            time_in_force=TimeInForce.DAY,
        )

    # --- Broker protocol -------------------------------------------------
    def submit(self, order: Order, price: float) -> Fill:
        request = self._order_request(order)
        self._client.submit_order(request)
        return Fill(order.symbol, order.side, order.quantity, price)

    def position(self, symbol: str) -> Position:
        for p in self._client.get_all_positions():
            if getattr(p, "symbol", None) == symbol:
                return Position(symbol, float(p.qty), float(p.avg_entry_price))
        return Position(symbol)

    def cash(self) -> float:
        return float(self._client.get_account().cash)

    def equity(self, prices: dict[str, float]) -> float:  # noqa: ARG002 - Alpaca knows equity
        return float(self._client.get_account().equity)
