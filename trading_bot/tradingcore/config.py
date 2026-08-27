"""Runtime configuration and the live-trading gate.

Configuration is read from environment variables (never hard-code secrets).
Secret *names* live here; secret *values* come from the environment / a secrets
manager at runtime. ``ExecutionMode.LIVE`` is refused unless an operator sets an
explicit flag AND a real (reviewed) live adapter exists.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum


class ExecutionMode(Enum):
    BACKTEST = "backtest"
    PAPER = "paper"
    LIVE = "live"


class LiveTradingBlocked(Exception):
    pass


@dataclass(slots=True)
class Settings:
    mode: ExecutionMode = ExecutionMode.BACKTEST
    broker: str = "paper"           # "paper" | "alpaca" | "robinhood"
    symbols: list[str] = field(default_factory=list)
    timeframe: str = "5m"
    allow_live: bool = False        # mirrors TRADING_ALLOW_LIVE

    @staticmethod
    def from_env(env: dict[str, str] | None = None) -> "Settings":
        env = env if env is not None else dict(os.environ)
        mode = ExecutionMode(env.get("TRADING_MODE", "backtest").lower())
        symbols = [s.strip() for s in env.get("TRADING_SYMBOLS", "").split(",") if s.strip()]
        return Settings(
            mode=mode,
            broker=env.get("TRADING_BROKER", "paper").lower(),
            symbols=symbols,
            timeframe=env.get("TRADING_TIMEFRAME", "5m"),
            allow_live=env.get("TRADING_ALLOW_LIVE", "0") == "1",
        )

    def require_safe_or_confirmed_live(self) -> None:
        """Raise unless the mode is safe (backtest/paper) or live is explicitly
        unlocked. Even when unlocked, no live adapter ships here, so a live
        broker will still refuse to trade — defense in depth."""
        if self.mode is ExecutionMode.LIVE and not self.allow_live:
            raise LiveTradingBlocked(
                "TRADING_MODE=live requires TRADING_ALLOW_LIVE=1 and a reviewed "
                "live broker adapter. Backtest and paper-trade first."
            )


# Names only — values are injected at runtime from the environment/secret store.
SECRET_NAMES = {
    "alpaca": ["ALPACA_API_KEY", "ALPACA_SECRET_KEY"],
    "robinhood": ["ROBINHOOD_USERNAME", "ROBINHOOD_PASSWORD", "ROBINHOOD_MFA_SECRET"],
    "slack": ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "SLACK_SIGNING_SECRET"],
    "discord": ["DISCORD_BOT_TOKEN"],
    "grok": ["XAI_API_KEY"],
    "news": ["NEWS_API_KEY"],
}
