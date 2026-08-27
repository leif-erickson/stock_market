"""Event-driven backtest engine + performance metrics.

The engine walks candles in order and, for each one, runs the same
``process_candle`` step a live loop would run: advance the context clock (no
look-ahead), ask the strategy for a signal, apply risk sizing + the kill switch,
and route the resulting order to the (paper) broker. This shared step is what
lets a validated backtest graduate to paper/live with the same code path.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable, Optional

from tradingcore.broker import InsufficientFunds, Order, PaperBroker, Side
from tradingcore.context import ContextStore, ContextView
from tradingcore.domain import Candle, CandleSeries
from tradingcore.risk import KillSwitch, RiskLimits, position_size
from tradingcore.signals import Action, Signal, Strategy


@dataclass(slots=True)
class BacktestResult:
    equity_curve: list[tuple[object, float]] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)
    num_fills: int = 0


def max_drawdown(equity: list[float]) -> float:
    """Largest peak-to-trough decline as a positive fraction (0..1)."""
    peak = float("-inf")
    worst = 0.0
    for v in equity:
        peak = max(peak, v)
        if peak > 0:
            worst = max(worst, (peak - v) / peak)
    return worst


def sharpe(returns: list[float], periods_per_year: float = 1.0) -> float:
    """Annualised Sharpe of per-bar returns (risk-free = 0). 0 if undefined."""
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    std = math.sqrt(var)
    if std == 0:
        return 0.0
    return (mean / std) * math.sqrt(periods_per_year)


def _metrics(equity_values: list[float], closed_pnls: list[float], ppy: float) -> dict[str, float]:
    if len(equity_values) < 2:
        return {"total_return": 0.0, "max_drawdown": 0.0, "sharpe": 0.0,
                "win_rate": 0.0, "num_trades": float(len(closed_pnls))}
    rets = [
        equity_values[i] / equity_values[i - 1] - 1.0
        for i in range(1, len(equity_values))
        if equity_values[i - 1] != 0
    ]
    wins = sum(1 for p in closed_pnls if p > 0)
    return {
        "total_return": equity_values[-1] / equity_values[0] - 1.0,
        "max_drawdown": max_drawdown(equity_values),
        "sharpe": sharpe(rets, ppy),
        "win_rate": (wins / len(closed_pnls)) if closed_pnls else 0.0,
        "num_trades": float(len(closed_pnls)),
    }


def process_candle(
    candle: Candle,
    series: CandleSeries,
    strategy: Strategy,
    broker: PaperBroker,
    context: ContextView,
    limits: RiskLimits,
    kill_switch: KillSwitch,
) -> Optional[Signal]:
    """Run one decision cycle for a newly closed candle. Returns the signal acted
    on (or considered). Fills happen at the candle close in this reference core.
    """
    series.add(candle)
    price = candle.close
    equity = broker.equity({candle.symbol: price})
    kill_switch.update_equity(equity)

    signal = strategy.on_candle(series, context)
    pos = broker.position(candle.symbol)

    if signal.action is Action.BUY and pos.quantity == 0 and kill_switch.allow_entry():
        base = position_size(equity, price, limits, signal.stop_distance)
        qty = math.floor(base * max(signal.confidence, 0.0))
        affordable = math.floor(max(broker.cash() - broker.commission_per_trade, 0.0) / price)
        qty = min(qty, affordable)
        if qty > 0:
            try:
                broker.submit(Order(candle.symbol, Side.BUY, qty), price)
                kill_switch.on_trade()
            except InsufficientFunds:
                pass
    elif signal.action in (Action.SELL, Action.CLOSE) and pos.quantity > 0:
        broker.submit(Order(candle.symbol, Side.SELL, pos.quantity), price)
        kill_switch.on_trade()

    return signal


def run_backtest(
    candles: Iterable[Candle],
    strategy: Strategy,
    broker: Optional[PaperBroker] = None,
    context: Optional[ContextStore] = None,
    limits: Optional[RiskLimits] = None,
    periods_per_year: float = 1.0,
) -> BacktestResult:
    """Replay ``candles`` through ``strategy`` on a ``PaperBroker``."""
    broker = broker or PaperBroker()
    context = context or ContextStore()
    limits = limits or RiskLimits()
    kill_switch = KillSwitch(limits)

    series = CandleSeries()
    equity_curve: list[tuple[object, float]] = []
    prev_day: Optional[date] = None

    for candle in candles:
        day = candle.timestamp.date()
        if day != prev_day:
            kill_switch.new_day(broker.equity({candle.symbol: candle.close}))
            prev_day = day

        context.set_clock(candle.timestamp)
        process_candle(candle, series, strategy, broker, context, limits, kill_switch)

        equity = broker.equity({candle.symbol: candle.close})
        equity_curve.append((candle.timestamp, equity))

    values = [e for _, e in equity_curve]
    return BacktestResult(
        equity_curve=equity_curve,
        metrics=_metrics(values, broker.closed_trade_pnls, periods_per_year),
        num_fills=len(broker.fills),
    )
