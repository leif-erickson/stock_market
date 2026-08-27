from tradingcore.risk import KillSwitch, RiskLimits, position_size


def test_position_size_respects_cap_without_stop():
    limits = RiskLimits(max_position_pct=0.20)
    # 20% of 100k = 20k / $100 = 200 shares
    assert position_size(100_000, 100.0, limits, stop_distance=None) == 200.0


def test_position_size_uses_risk_when_stop_given():
    limits = RiskLimits(max_position_pct=1.0, per_trade_risk_pct=0.01)
    # risk 1% of 100k = $1,000; stop distance $2 -> 500 shares
    assert position_size(100_000, 100.0, limits, stop_distance=2.0) == 500.0


def test_position_size_zero_on_bad_inputs():
    limits = RiskLimits()
    assert position_size(0, 100.0, limits, None) == 0.0
    assert position_size(100_000, 0.0, limits, None) == 0.0


def test_kill_switch_trips_on_daily_loss():
    ks = KillSwitch(RiskLimits(max_daily_loss_pct=0.03))
    ks.new_day(100_000)
    ks.update_equity(98_000)  # -2%, still ok
    assert ks.allow_entry()
    ks.update_equity(96_500)  # -3.5%, trip
    assert not ks.allow_entry()
    assert "daily loss" in ks.reason


def test_kill_switch_trips_on_trade_count():
    ks = KillSwitch(RiskLimits(max_trades_per_day=2))
    ks.new_day(100_000)
    ks.on_trade()
    assert ks.allow_entry()
    ks.on_trade()
    assert not ks.allow_entry()
