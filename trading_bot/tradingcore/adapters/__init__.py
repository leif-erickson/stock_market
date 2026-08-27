"""Optional integrations with external brokers/data providers.

Each adapter lazily imports its heavy third-party SDK inside factory methods, so
importing this subpackage never requires the extras to be installed. Install what
you need:

    pip install -e ".[alpaca]"   # alpaca-py
    pip install -e ".[yahoo]"    # yfinance
"""
