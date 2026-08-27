"""Alpaca PAPER account smoke test.

Connects to Alpaca's paper trading endpoint, prints account + positions, and
(only with --place-order) submits ONE tiny market order to prove the write path.
No live money is involved when paper=True.

    pip install -e ".[alpaca]"
    export ALPACA_API_KEY=...   ALPACA_SECRET_KEY=...
    python examples/alpaca_paper_smoke.py            # read-only
    python examples/alpaca_paper_smoke.py --place-order AAPL 1
"""

from __future__ import annotations

import os
import sys

from tradingcore.adapters.alpaca_broker import AlpacaBroker
from tradingcore.broker import Order, Side


def main() -> None:
    api_key = os.environ.get("ALPACA_API_KEY")
    secret_key = os.environ.get("ALPACA_SECRET_KEY")
    if not api_key or not secret_key:
        print("Set ALPACA_API_KEY and ALPACA_SECRET_KEY in the environment.")
        raise SystemExit(2)

    broker = AlpacaBroker.from_credentials(api_key, secret_key, paper=True)
    print(f"paper account cash  : ${broker.cash():,.2f}")
    print(f"paper account equity: ${broker.equity({}):,.2f}")

    place = "--place-order" in sys.argv
    if place:
        args = [a for a in sys.argv[1:] if a != "--place-order"]
        symbol = args[0] if args else "AAPL"
        qty = float(args[1]) if len(args) > 1 else 1.0
        print(f"submitting PAPER market BUY {qty} {symbol} ...")
        fill = broker.submit(Order(symbol, Side.BUY, qty), price=broker.cash() and 0.0)
        print(f"submitted: {fill}")

    pos = broker.position("AAPL")
    print(f"AAPL position: qty={pos.quantity} avg={pos.avg_price}")
    print("OK — paper connectivity verified.")


if __name__ == "__main__":
    main()
