"""
Data Integrity Tests for NusantaraBus Star Schema
Validates relational foreign key consistency, physical bounds, and categorical definitions.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import pytest
from src.analytics_engine import DB_PATH

@pytest.fixture
def db_conn():
    conn = sqlite3.connect(DB_PATH)
    yield conn
    conn.close()

def test_foreign_key_consistency(db_conn):
    cur = db_conn.cursor()
    # Check that all trips reference existing operators
    cur.execute("""
        SELECT COUNT(*) FROM fact_trips t
        LEFT JOIN dim_operators o ON t.operator_id = o.operator_id
        WHERE o.operator_id IS NULL
    """)
    assert cur.fetchone()[0] == 0

    # Check that all trips reference existing routes
    cur.execute("""
        SELECT COUNT(*) FROM fact_trips t
        LEFT JOIN dim_routes r ON t.route_id = r.route_id
        WHERE r.route_id IS NULL
    """)
    assert cur.fetchone()[0] == 0

    # Check that all trips reference valid calendar dates
    cur.execute("""
        SELECT COUNT(*) FROM fact_trips t
        LEFT JOIN dim_calendar c ON t.date_id = c.date_id
        WHERE c.date_id IS NULL
    """)
    assert cur.fetchone()[0] == 0

def test_physical_numerical_bounds(db_conn):
    cur = db_conn.cursor()
    
    # No negative durations
    cur.execute("SELECT COUNT(*) FROM fact_trips WHERE total_duration_hours <= 0")
    assert cur.fetchone()[0] == 0

    # No negative fuel
    cur.execute("SELECT COUNT(*) FROM fact_trips WHERE fuel_consumed_liters <= 0")
    assert cur.fetchone()[0] == 0

    # Realistic average speed (30 km/h - 120 km/h)
    cur.execute("SELECT COUNT(*) FROM fact_trips WHERE avg_speed_kmh < 30 OR avg_speed_kmh > 120")
    assert cur.fetchone()[0] == 0

    # Realistic fuel efficiency (1.5 km/L - 5.5 km/L)
    cur.execute("SELECT COUNT(*) FROM fact_trips WHERE fuel_efficiency_km_l < 1.5 OR fuel_efficiency_km_l > 5.5")
    assert cur.fetchone()[0] == 0

def test_otp_category_consistency(db_conn):
    cur = db_conn.cursor()
    
    # Check ON_TIME is strictly <= 15 minutes
    cur.execute("SELECT COUNT(*) FROM fact_trips WHERE otp_status = 'ON_TIME' AND arrival_delay_min > 15.0")
    assert cur.fetchone()[0] == 0

    # Check SEVERE_DELAY is strictly > 90 minutes
    cur.execute("SELECT COUNT(*) FROM fact_trips WHERE otp_status = 'SEVERE_DELAY' AND arrival_delay_min <= 90.0")
    assert cur.fetchone()[0] == 0
