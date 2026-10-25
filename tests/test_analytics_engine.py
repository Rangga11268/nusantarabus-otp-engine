"""
Unit Tests for NusantaraBus Analytics Engine
Verifies mathematical correctness of metrics, OTP ranking, waterfall attribution,
and fuel savings simulations.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from src.analytics_engine import NusantaraBusAnalytics, DB_PATH

@pytest.fixture
def analytics():
    if not os.path.exists(DB_PATH):
        from src.scraper.enricher import run_pipeline
        run_pipeline()
    return NusantaraBusAnalytics(DB_PATH)

def test_summary_kpis(analytics):
    kpis = analytics.get_summary_kpis()
    assert kpis["total_trips"] >= 3000
    assert 0.0 <= kpis["overall_otp_pct"] <= 100.0
    assert kpis["total_fuel_liters"] > 100000.0
    assert kpis["total_revenue_idr"] > 1000000000.0
    assert 50.0 <= kpis["avg_load_factor_pct"] <= 100.0
    assert 20.0 <= kpis["mean_fuel_intensity_l_100km"] <= 35.0

def test_operator_leaderboard(analytics):
    leaderboard = analytics.get_operator_leaderboard()
    assert len(leaderboard) >= 5
    
    # Ranks must be consecutive 1..N
    ranks = [item["rank"] for item in leaderboard]
    assert ranks == list(range(1, len(leaderboard) + 1))

    for item in leaderboard:
        # Sum of delay bands should equal ~100%
        delay_sum = item["otp_pct"] + item["minor_delay_pct"] + item["moderate_delay_pct"] + item["severe_delay_pct"]
        assert pytest.approx(delay_sum, abs=1.5) == 100.0
        assert item["mean_fuel_intensity"] > 20.0

def test_operator_leaderboard_filtered(analytics):
    lb_route = analytics.get_operator_leaderboard(route_id="JKT-SBY")
    assert len(lb_route) >= 5
    total_trips = sum(item["total_trips"] for item in lb_route)
    assert total_trips > 500

def test_delay_waterfall_breakdown(analytics):
    waterfall = analytics.get_delay_waterfall_breakdown()
    assert len(waterfall) == 5
    
    stages = [w["stage_key"] for w in waterfall]
    assert "ORIGIN_DWELL_NGETEM" in stages
    assert "HIGHWAY_CRUISING" in stages
    assert "REST_AREA_DINING" in stages

    total_share = sum(w["pct_share_of_total_delay"] for w in waterfall)
    assert pytest.approx(total_share, abs=2.0) == 100.0

def test_delay_propagation_stats(analytics):
    propagation = analytics.get_delay_propagation_stats()
    assert len(propagation) == 4
    
    # Departure on-time group should have higher OTP than severe ngetem group
    on_time_group = propagation[0]
    severe_ngetem_group = propagation[-1]
    assert on_time_group["otp_rate"] > severe_ngetem_group["otp_rate"]
    assert on_time_group["mean_arr_delay"] < severe_ngetem_group["mean_arr_delay"]

def test_fuel_savings_simulation(analytics):
    sim = analytics.simulate_fuel_savings(speed_limiter_kmh=90.0, idle_reduction_pct=50.0)
    assert sim["total_trips_analyzed"] >= 3000
    assert sim["total_liters_saved"] > 3000.0
    assert sim["pct_fuel_saved"] > 0.0
    assert sim["monthly_cost_saved_idr"] > 50000000.0 # > Rp 50 Juta
    assert sim["baseline_fuel_cost_idr"] > sim["monthly_cost_saved_idr"]

def test_hourly_departure_recommender(analytics):
    recs = analytics.get_hourly_departure_recommender(route_id="JKT-SBY")
    assert len(recs) > 5
    for r in recs:
        assert ":" in r["hour"]
        assert r["trip_count"] > 0
        assert 0.0 <= r["otp_rate"] <= 100.0
