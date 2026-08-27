from tradingcore.indicators import ema, last, rsi, sma


def test_sma_basic():
    values = [1, 2, 3, 4, 5]
    out = sma(values, 3)
    assert out[:2] == [None, None]
    assert out[2] == 2.0  # (1+2+3)/3
    assert out[3] == 3.0
    assert out[4] == 4.0


def test_ema_seed_and_length():
    values = [float(i) for i in range(1, 11)]
    out = ema(values, 3)
    assert len(out) == len(values)
    assert out[1] is None
    assert out[2] == sum(values[:3]) / 3  # seeded with SMA
    assert out[-1] is not None and out[-1] > out[2]


def test_rsi_all_gains_is_100():
    values = [float(i) for i in range(1, 30)]  # strictly increasing
    assert last(rsi(values, 14)) == 100.0


def test_rsi_all_losses_is_0():
    values = [float(i) for i in range(30, 1, -1)]  # strictly decreasing
    assert last(rsi(values, 14)) == 0.0


def test_rsi_warmup_is_none():
    values = [1.0, 2.0, 3.0]
    assert rsi(values, 14) == [None, None, None]


def test_last_helper():
    assert last([None, 1.0, None, 2.0, None]) == 2.0
    assert last([None, None]) is None
