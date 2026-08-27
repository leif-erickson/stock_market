"""Risk controls: position sizing, hard limits, and a kill switch.

Risk management — not signal quality — is what keeps an automated system alive.
These primitives are enforced by the execution layer *before* any order reaches a
broker. They are venue-agnostic.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RiskLimits:
    max_position_pct: float = 0.20      # cap a single position at 20% of equity
    per_trade_risk_pct: float = 0.01    # risk 1% of equity per trade at the stop
    max_daily_loss_pct: float = 0.03    # trip the kill switch at -3% on the day
    max_trades_per_day: int = 20        # also a PDT-awareness guard (see note)


def position_size(
    equity: float,
    price: float,
    limits: RiskLimits,
    stop_distance: float | None,
) -> float:
    """Return a share quantity respecting both per-trade risk and the position cap.

    If a stop distance is provided, size so that hitting the stop loses about
    ``per_trade_risk_pct`` of equity. Always clamp to ``max_position_pct``.
    Returns whole shares (floor); 0 means "do not trade".
    """
    if equity <= 0 or price <= 0:
        return 0.0

    cap_shares = (limits.max_position_pct * equity) / price

    if stop_distance and stop_distance > 0:
        risk_amount = limits.per_trade_risk_pct * equity
        risk_shares = risk_amount / stop_distance
        shares = min(cap_shares, risk_shares)
    else:
        shares = cap_shares

    return float(math.floor(max(shares, 0.0)))


class KillSwitch:
    """Blocks new entries once daily loss or trade-count limits are breached.

    Call :meth:`on_trade` when a trade executes and :meth:`update_equity` as the
    mark-to-market equity moves. :meth:`allow_entry` gates new positions. Reset at
    the start of each trading day with :meth:`new_day`.

    Note on the US Pattern Day Trader (PDT) rule: accounts under $25k are limited
    to a small number of day trades per rolling 5 business days. ``max_trades_per_day``
    is a coarse guard; a production system should track day-trade counts per the
    broker's own accounting.
    """

    def __init__(self, limits: RiskLimits) -> None:
        self.limits = limits
        self._day_start_equity: float | None = None
        self._low_watermark: float | None = None
        self._trades_today = 0
        self._tripped = False
        self._reason = ""

    def new_day(self, equity: float) -> None:
        self._day_start_equity = equity
        self._low_watermark = equity
        self._trades_today = 0
        self._tripped = False
        self._reason = ""

    def on_trade(self) -> None:
        self._trades_today += 1
        if self._trades_today >= self.limits.max_trades_per_day:
            self._trip(f"max_trades_per_day {self.limits.max_trades_per_day} reached")

    def update_equity(self, equity: float) -> None:
        if self._day_start_equity is None:
            self.new_day(equity)
            return
        if self._low_watermark is None or equity < self._low_watermark:
            self._low_watermark = equity
        drawdown = (self._day_start_equity - equity) / self._day_start_equity
        if drawdown >= self.limits.max_daily_loss_pct:
            self._trip(f"daily loss {drawdown:.2%} >= {self.limits.max_daily_loss_pct:.2%}")

    def _trip(self, reason: str) -> None:
        self._tripped = True
        self._reason = reason

    @property
    def tripped(self) -> bool:
        return self._tripped

    @property
    def reason(self) -> str:
        return self._reason

    def allow_entry(self) -> bool:
        return not self._tripped
