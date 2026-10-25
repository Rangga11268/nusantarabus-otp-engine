"""
NusantaraBus Analytics Engine
Core analytical calculations, metrics computation, and simulations.
Powered by Polars & SQLite for high-performance analytical processing.
"""

import os
import sqlite3
from typing import Dict, List, Any, Optional

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data",
    "nusantarabus.db"
)

# Solar Industri benchmark price per Liter in IDR
FUEL_PRICE_PER_LITER = 13500.0

class NusantaraBusAnalytics:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def get_summary_kpis(self) -> Dict[str, Any]:
        """Calculates macro-level fleet KPIs."""
        query = """
        SELECT 
            COUNT(trip_id) AS total_trips,
            ROUND(100.0 * SUM(CASE WHEN arrival_delay_min <= 15 THEN 1 ELSE 0 END) / COUNT(trip_id), 1) AS overall_otp_pct,
            ROUND(AVG(arrival_delay_min), 1) AS mean_arrival_delay_min,
            ROUND(AVG(fuel_intensity_l_100km), 2) AS mean_fuel_intensity,
            ROUND(SUM(fuel_consumed_liters), 0) AS total_fuel_liters,
            ROUND(SUM(gross_revenue_idr), 0) AS total_revenue_idr,
            ROUND(AVG(passenger_count * 100.0 / seat_capacity), 1) AS avg_load_factor_pct
        FROM fact_trips
        """
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query)
            row = cur.fetchone()

        return {
            "total_trips": row[0],
            "overall_otp_pct": row[1],
            "mean_arrival_delay_min": row[2],
            "mean_fuel_intensity_l_100km": row[3],
            "total_fuel_liters": row[4],
            "total_revenue_idr": row[5],
            "avg_load_factor_pct": row[6],
        }

    def get_operator_leaderboard(
        self,
        route_id: Optional[str] = None,
        season_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns full operator OTP leaderboard with reliability rankings,
        delay breakdown, and fuel burn.
        """
        conditions = ["1=1"]
        params = []
        if route_id and route_id != "ALL":
            conditions.append("t.route_id = ?")
            params.append(route_id)
        if season_type and season_type != "ALL":
            conditions.append("c.season_type = ?")
            params.append(season_type)

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT 
            o.po_name,
            o.service_class,
            o.brand_color,
            COUNT(t.trip_id) AS total_trips,
            ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min <= 15 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS otp_pct,
            ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min > 15 AND t.arrival_delay_min <= 45 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS minor_delay_pct,
            ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min > 45 AND t.arrival_delay_min <= 90 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS moderate_delay_pct,
            ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min > 90 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS severe_delay_pct,
            ROUND(AVG(t.arrival_delay_min), 1) AS mean_delay_min,
            ROUND(AVG(t.fuel_intensity_l_100km), 2) AS mean_fuel_intensity,
            ROUND(AVG(t.avg_speed_kmh), 1) AS mean_speed_kmh
        FROM fact_trips t
        JOIN dim_operators o ON t.operator_id = o.operator_id
        JOIN dim_calendar c ON t.date_id = c.date_id
        WHERE {where_clause}
        GROUP BY o.po_name, o.service_class, o.brand_color
        ORDER BY otp_pct DESC, mean_delay_min ASC
        """

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        leaderboard = []
        for rank, r in enumerate(rows, start=1):
            leaderboard.append({
                "rank": rank,
                "po_name": r[0],
                "service_class": r[1],
                "brand_color": r[2],
                "total_trips": r[3],
                "otp_pct": r[4],
                "minor_delay_pct": r[5],
                "moderate_delay_pct": r[6],
                "severe_delay_pct": r[7],
                "mean_delay_min": r[8],
                "mean_fuel_intensity": r[9],
                "mean_speed_kmh": r[10],
            })
        return leaderboard

    def get_delay_waterfall_breakdown(
        self,
        operator_id: Optional[str] = None,
        route_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Decomposes delays into 5 key operational stages:
        1. Terminal Dwell & Agency Ngetem
        2. Arterial Urban Congestion
        3. Highway Cruising Variance
        4. Rest Area Dining / Service Stop
        5. Destination City Arrival
        """
        conditions = ["1=1"]
        params = []
        if operator_id and operator_id != "ALL":
            conditions.append("t.operator_id = ?")
            params.append(operator_id)
        if route_id and route_id != "ALL":
            conditions.append("t.route_id = ?")
            params.append(route_id)

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT 
            s.stage_name,
            ROUND(AVG(s.scheduled_duration_min), 1) AS avg_scheduled_min,
            ROUND(AVG(s.actual_duration_min), 1) AS avg_actual_min,
            ROUND(AVG(s.delay_variance_min), 1) AS avg_delay_added_min,
            ROUND(AVG(s.idle_duration_min), 1) AS avg_idle_min,
            ROUND(SUM(CASE WHEN s.delay_variance_min > 0 THEN s.delay_variance_min ELSE 0 END), 0) AS total_delay_mins
        FROM fact_trip_stages s
        JOIN fact_trips t ON s.trip_id = t.trip_id
        WHERE {where_clause}
        GROUP BY s.stage_name
        ORDER BY s.stage_sequence ASC
        """

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        stage_labels = {
            "ORIGIN_DWELL_NGETEM": "1. Terminal Dwell (Ngetem Agen)",
            "ARTERIAL_CITY_TRANSIT": "2. Macet Arteri Jakarta-Bekasi",
            "HIGHWAY_CRUISING": "3. Cruising Tol Trans-Jawa",
            "REST_AREA_DINING": "4. Istirahat Rest Area / Makan",
            "DEST_TERMINAL_ARRIVAL": "5. Masuk Terminal Tujuan",
        }

        total_delay_sum = sum(r[5] for r in rows) if rows else 1.0

        waterfall = []
        for r in rows:
            share_pct = round((r[5] / total_delay_sum) * 100.0, 1) if total_delay_sum > 0 else 0.0
            waterfall.append({
                "stage_key": r[0],
                "stage_name": stage_labels.get(r[0], r[0]),
                "avg_scheduled_min": r[1],
                "avg_actual_min": r[2],
                "avg_delay_added_min": r[3],
                "avg_idle_min": r[4],
                "pct_share_of_total_delay": share_pct,
            })
        return waterfall

    def get_delay_propagation_stats(self) -> List[Dict[str, Any]]:
        """
        Analyzes the propagation of departure delay to destination arrival delay.
        """
        query = """
        SELECT 
            CASE 
                WHEN departure_delay_min <= 5 THEN '01. Tepat Waktu (<= 5 mnt)'
                WHEN departure_delay_min <= 20 THEN '02. Ngetem Ringan (6-20 mnt)'
                WHEN departure_delay_min <= 45 THEN '03. Ngetem Sedang (21-45 mnt)'
                ELSE '04. Ngetem Parah (> 45 mnt)'
            END AS bracket,
            COUNT(trip_id) AS trip_count,
            ROUND(AVG(departure_delay_min), 1) AS mean_dep_delay,
            ROUND(AVG(arrival_delay_min), 1) AS mean_arr_delay,
            ROUND(AVG(arrival_delay_min - departure_delay_min), 1) AS net_delay_escalation,
            ROUND(100.0 * SUM(CASE WHEN arrival_delay_min <= 15 THEN 1 ELSE 0 END) / COUNT(trip_id), 1) AS otp_rate
        FROM fact_trips
        GROUP BY 1
        ORDER BY 1
        """
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query)
            rows = cur.fetchall()

        return [
            {
                "bracket": r[0],
                "trip_count": r[1],
                "mean_dep_delay": r[2],
                "mean_arr_delay": r[3],
                "net_delay_escalation": r[4],
                "otp_rate": r[5],
            }
            for r in rows
        ]

    def simulate_fuel_savings(
        self,
        speed_limiter_kmh: float = 90.0,
        idle_reduction_pct: float = 50.0
    ) -> Dict[str, Any]:
        """
        Simulates potential monthly OPEX fuel savings:
        1. Capping speeding trips to speed_limiter_kmh reduces intensity from ~31.5 to ~25.5 L/100km.
        2. Cutting idling time saves 2.8 L/hour.
        """
        query = """
        SELECT 
            SUM(fuel_consumed_liters) AS total_fuel_liters,
            SUM(distance_km) AS total_km,
            SUM(idle_time_total_min) AS total_idle_mins,
            COUNT(trip_id) AS total_trips,
            SUM(CASE WHEN avg_speed_kmh > 92 THEN 1 ELSE 0 END) AS speeding_trips,
            SUM(CASE WHEN avg_speed_kmh > 92 THEN distance_km ELSE 0 END) AS speeding_km
        FROM fact_trips
        """
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query)
            row = cur.fetchone()

        total_fuel = row[0]
        total_km = row[1]
        total_idle_mins = row[2]
        total_trips = row[3]
        speeding_km = row[5]

        # Idling fuel reduction
        idle_hours_saved = (total_idle_mins / 60.0) * (idle_reduction_pct / 100.0)
        fuel_saved_idle = idle_hours_saved * 2.8

        # Cruising speed fuel reduction on speeding KM:
        # Saving ~4.5 L/100km by governing aggressive speeds down to 90 km/h
        fuel_saved_speed = (speeding_km / 100.0) * 4.2

        total_liters_saved = round(fuel_saved_idle + fuel_saved_speed, 1)
        pct_fuel_saved = round((total_liters_saved / total_fuel) * 100.0, 1) if total_fuel > 0 else 0.0
        cost_saved_idr = round(total_liters_saved * FUEL_PRICE_PER_LITER, 0)

        # Baseline OPEX
        baseline_fuel_cost_idr = round(total_fuel * FUEL_PRICE_PER_LITER, 0)

        return {
            "total_trips_analyzed": total_trips,
            "baseline_fuel_liters": round(total_fuel, 0),
            "baseline_fuel_cost_idr": baseline_fuel_cost_idr,
            "total_liters_saved": total_liters_saved,
            "pct_fuel_saved": pct_fuel_saved,
            "monthly_cost_saved_idr": cost_saved_idr,
            "fuel_saved_from_idle_liters": round(fuel_saved_idle, 1),
            "fuel_saved_from_speed_cap_liters": round(fuel_saved_speed, 1),
        }

    def get_hourly_departure_recommender(
        self,
        route_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Computes arrival delay and on-time probability by scheduled departure hour.
        """
        conditions = ["1=1"]
        params = []
        if route_id and route_id != "ALL":
            conditions.append("t.route_id = ?")
            params.append(route_id)

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT 
            strftime('%H:00', t.scheduled_departure_ts) AS dep_hour,
            COUNT(t.trip_id) AS trip_count,
            ROUND(AVG(t.arrival_delay_min), 1) AS mean_delay_min,
            ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min <= 15 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS otp_rate,
            ROUND(AVG(t.total_duration_hours), 2) AS mean_duration_hours
        FROM fact_trips t
        WHERE {where_clause}
        GROUP BY 1
        ORDER BY 1 ASC
        """
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        return [
            {
                "hour": r[0],
                "trip_count": r[1],
                "mean_delay_min": r[2],
                "otp_rate": r[3],
                "mean_duration_hours": r[4],
            }
            for r in rows
        ]

if __name__ == "__main__":
    engine = NusantaraBusAnalytics()
    kpis = engine.get_summary_kpis()
    print("Macro KPIs:", kpis)
    leaderboard = engine.get_operator_leaderboard()
    print("Top 3 Operators by OTP:")
    for op in leaderboard[:3]:
        print(f"#{op['rank']} {op['po_name']} ({op['service_class']}) - OTP: {op['otp_pct']}% | Delay: {op['mean_delay_min']} mnt")
