"""Broker abstraction and a paper (simulated) implementation.

The :class:`Broker` protocol is the single seam between strategy logic and the
outside world. ``PaperBroker`` is a fully in-memory simulator used for backtests
and forward paper-trading. Live adapters (Alpaca, Robinhood, IBKR) implement the
same protocol — but live execution is deliberately unimplemented here and gated
(see :mod:`tradingcore.config`).

Scope of the reference core: **long-only**, market fills at a provided price with
optional commission and slippage. Shorting, limit/stop order books, and partial
fills are explicit later-phase extensions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Protocol, runtime_checkable


class Side(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"


@dataclass(frozen=True, slots=True)
class Order:
    symbol: str
    side: Side
    quantity: float
    type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = None


@dataclass(frozen=True, slots=True)
class Fill:
    symbol: str
    side: Side
    quantity: float
    price: float
    commission: float = 0.0


@dataclass(slots=True)
class Position:
    symbol: str
    quantity: float = 0.0
    avg_price: float = 0.0

    def market_value(self, price: float) -> float:
        return self.quantity * price

    def unrealized_pnl(self, price: float) -> float:
        return (price - self.avg_price) * self.quantity


@runtime_checkable
class Broker(Protocol):
    """Minimal execution surface. Prices are provided by the caller (the engine)
    so the same interface works for simulated and live fills."""

    def submit(self, order: Order, price: float) -> Fill: ...

    def position(self, symbol: str) -> Position: ...

    def cash(self) -> float: ...

    def equity(self, prices: dict[str, float]) -> float: ...


class InsufficientFunds(Exception):
    pass


class PaperBroker:
    """In-memory long-only simulator with realized-PnL tracking."""

    def __init__(
        self,
        starting_cash: float = 100_000.0,
        commission_per_trade: float = 0.0,
        slippage_bps: float = 0.0,
    ) -> None:
        self._cash = starting_cash
        self.commission_per_trade = commission_per_trade
        self.slippage_bps = slippage_bps
        self._positions: dict[str, Position] = {}
        self.fills: list[Fill] = []
        self.closed_trade_pnls: list[float] = []  # realized PnL per (partial) close
        self.realized_pnl = 0.0

    # --- Broker protocol -------------------------------------------------
    def cash(self) -> float:
        return self._cash

    def position(self, symbol: str) -> Position:
        return self._positions.get(symbol, Position(symbol))

    def equity(self, prices: dict[str, float]) -> float:
        holdings = sum(
            pos.market_value(prices.get(sym, pos.avg_price))
            for sym, pos in self._positions.items()
        )
        return self._cash + holdings

    def submit(self, order: Order, price: float) -> Fill:
        if order.quantity <= 0:
            raise ValueError("order quantity must be positive")
        fill_price = self._apply_slippage(price, order.side)
        if order.side is Side.BUY:
            return self._buy(order.symbol, order.quantity, fill_price)
        return self._sell(order.symbol, order.quantity, fill_price)

    # --- internals -------------------------------------------------------
    def _apply_slippage(self, price: float, side: Side) -> float:
        adj = price * (self.slippage_bps / 10_000.0)
        return price + adj if side is Side.BUY else price - adj

    def _buy(self, symbol: str, quantity: float, price: float) -> Fill:
        cost = quantity * price + self.commission_per_trade
        if cost > self._cash + 1e-9:
            raise InsufficientFunds(
                f"need {cost:.2f} but only {self._cash:.2f} available"
            )
        self._cash -= cost
        pos = self._positions.get(symbol, Position(symbol))
        total_qty = pos.quantity + quantity
        pos.avg_price = (pos.avg_price * pos.quantity + price * quantity) / total_qty
        pos.quantity = total_qty
        self._positions[symbol] = pos
        fill = Fill(symbol, Side.BUY, quantity, price, self.commission_per_trade)
        self.fills.append(fill)
        return fill

    def _sell(self, symbol: str, quantity: float, price: float) -> Fill:
        pos = self._positions.get(symbol, Position(symbol))
        qty = min(quantity, pos.quantity)  # long-only: never sell more than held
        if qty <= 0:
            raise InsufficientFunds(f"no long position in {symbol} to sell")
        proceeds = qty * price - self.commission_per_trade
        realized = (price - pos.avg_price) * qty - self.commission_per_trade
        self._cash += proceeds
        self.realized_pnl += realized
        self.closed_trade_pnls.append(realized)
        pos.quantity -= qty
        if pos.quantity <= 1e-12:
            pos.quantity = 0.0
            pos.avg_price = 0.0
        self._positions[symbol] = pos
        fill = Fill(symbol, Side.SELL, qty, price, self.commission_per_trade)
        self.fills.append(fill)
        return fill


# --- Live adapters: intentionally not implemented -------------------------


class LiveTradingNotEnabled(Exception):
    """Raised if something tries to trade live through the reference core."""


class _GuardedLiveBroker:
    """Base for live adapters. Refuses to construct unless the operator has
    explicitly acknowledged the risk, and still raises on any trade because no
    live order routing ships in this foundation."""

    venue = "unknown"

    def __init__(self, i_understand_the_risks: bool = False, **_: object) -> None:
        if not i_understand_the_risks:
            raise LiveTradingNotEnabled(
                f"{self.venue} live trading is disabled. Live routing is NOT "
                "implemented in this foundation. Validate on PaperBroker first, "
                "then implement + review a real adapter behind explicit gating."
            )

    def submit(self, order: Order, price: float) -> Fill:  # noqa: ARG002
        raise LiveTradingNotEnabled(
            f"{self.venue} order routing is not implemented in this foundation."
        )

    def position(self, symbol: str) -> Position:
        raise LiveTradingNotEnabled(f"{self.venue} adapter is a stub.")

    def cash(self) -> float:
        raise LiveTradingNotEnabled(f"{self.venue} adapter is a stub.")

    def equity(self, prices: dict[str, float]) -> float:  # noqa: ARG002
        raise LiveTradingNotEnabled(f"{self.venue} adapter is a stub.")


# NOTE: The real Alpaca **paper** adapter lives in
# ``tradingcore.adapters.alpaca_broker.AlpacaBroker`` (it implements this Broker
# protocol against Alpaca's official API). Paper trading is allowed; live trading
# through it is gated behind an explicit acknowledgement. Robinhood remains a
# guarded stub because it has no official API.


class RobinhoodBroker(_GuardedLiveBroker):
    """Robinhood has **no official trading API**. Automating it relies on
    unofficial/reverse-engineered endpoints (and an MCP wrapper around them),
    which likely violates Robinhood's Terms of Service and risks account
    suspension. Prefer a broker with an official API; if you proceed, do so
    knowingly and behind the same guarded interface."""

    venue = "robinhood"
