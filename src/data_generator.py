"""
NusantaraBus Synthetic Data Generator
Generates realistic, physically sound operational data for Intercity Buses (AKAP)
across the Trans-Java Highway Network in Indonesia.
"""

import os
import sqlite3
import random
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "nusantarabus.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sql", "schema.sql")

OPERATORS = [
    {"id": "PO01", "name": "PO Sinar Jaya", "color": "#0284C7", "class": "Executive", "fleet": 450, "hq": "Bekasi", "speed_policy": "DISCIPLINED", "idle_bias": 1.0},
    {"id": "PO02", "name": "PO Rosalia Indah", "color": "#E11D48", "class": "Super Executive", "fleet": 320, "hq": "Karanganyar", "speed_policy": "BALANCED", "idle_bias": 1.2},
    {"id": "PO03", "name": "PO Harapan Jaya", "color": "#D97706", "class": "Executive", "fleet": 240, "hq": "Tulungagung", "speed_policy": "BALANCED", "idle_bias": 1.1},
    {"id": "PO04", "name": "PO Haryanto", "color": "#16A34A", "class": "Executive", "fleet": 280, "hq": "Kudus", "speed_policy": "AGGRESSIVE", "idle_bias": 1.4},
    {"id": "PO05", "name": "PO Gunung Harta", "color": "#059669", "class": "Sleeper Suite", "fleet": 180, "hq": "Malang", "speed_policy": "DISCIPLINED", "idle_bias": 1.0},
]

ROUTES = [
    {
        "id": "JKT-SBY",
        "origin_city": "Jakarta",
        "origin_terminal": "Terminal Terpadu Pulo Gebang",
        "destination_city": "Surabaya",
        "destination_terminal": "Terminal Purabaya (Bungurasih)",
        "distance_km": 785.0,
        "highway_km": 730.0,
        "arterial_km": 55.0,
        "eta_hours": 10.0,
        "ticket_price": 380000.0,
    },
    {
        "id": "JKT-SLO",
        "origin_city": "Jakarta",
        "origin_terminal": "Terminal Terpadu Pulo Gebang",
        "destination_city": "Solo",
        "destination_terminal": "Terminal Tirtonadi",
        "distance_km": 540.0,
        "highway_km": 505.0,
        "arterial_km": 35.0,
        "eta_hours": 7.5,
        "ticket_price": 260000.0,
    },
    {
        "id": "JKT-SMG",
        "origin_city": "Jakarta",
        "origin_terminal": "Terminal Kampung Rambutan",
        "destination_city": "Semarang",
        "destination_terminal": "Terminal Penggaron",
        "distance_km": 440.0,
        "highway_km": 410.0,
        "arterial_km": 30.0,
        "eta_hours": 6.0,
        "ticket_price": 220000.0,
    },
    {
        "id": "JKT-MLG",
        "origin_city": "Jakarta",
        "origin_terminal": "Terminal Terpadu Pulo Gebang",
        "destination_city": "Malang",
        "destination_terminal": "Terminal Arjosari",
        "distance_km": 850.0,
        "highway_km": 790.0,
        "arterial_km": 60.0,
        "eta_hours": 11.5,
        "ticket_price": 430000.0,
    },
]

CHECKPOINTS = [
    ("CP01", "Terminal Pulo Gebang", "ORIGIN_TERMINAL", 0.0, "Jakarta"),
    ("CP02", "Agen Cikarang Barat", "SUB_AGENCY", 32.0, "Bekasi"),
    ("CP03", "Gerbang Tol Cikampek Utama", "TOLL_GATE", 72.0, "Karawang"),
    ("CP04", "Rest Area KM 207A Palikanci", "REST_AREA_DINING", 207.0, "Cirebon"),
    ("CP05", "Rest Area KM 379A Batang", "REST_AREA_DINING", 379.0, "Batang"),
    ("CP06", "Gerbang Tol Kalikangkung", "TOLL_GATE", 414.0, "Semarang"),
    ("CP07", "Rest Area KM 519A Sragen", "REST_AREA_DINING", 519.0, "Sragen"),
    ("CP08", "Gerbang Tol Warugunung", "TOLL_GATE", 770.0, "Surabaya"),
    ("CP09", "Terminal Purabaya Bungurasih", "DEST_TERMINAL", 785.0, "Surabaya"),
    ("CP10", "Terminal Tirtonadi", "DEST_TERMINAL", 540.0, "Solo"),
    ("CP11", "Terminal Penggaron", "DEST_TERMINAL", 440.0, "Semarang"),
    ("CP12", "Terminal Arjosari", "DEST_TERMINAL", 850.0, "Malang"),
]

def init_db(db_path=DB_PATH):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    return conn

def populate_dimensions(conn):
    cur = conn.cursor()
    # Operators
    for op in OPERATORS:
        cur.execute(
            "INSERT INTO dim_operators VALUES (?, ?, ?, ?, ?, ?)",
            (op["id"], op["name"], op["color"], op["class"], op["fleet"], op["hq"])
        )
    # Routes
    for r in ROUTES:
        cur.execute(
            "INSERT INTO dim_routes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (r["id"], r["origin_city"], r["origin_terminal"], r["destination_city"],
             r["destination_terminal"], r["distance_km"], r["highway_km"], r["arterial_km"], r["eta_hours"])
        )
    # Checkpoints
    for cp in CHECKPOINTS:
        cur.execute("INSERT INTO dim_checkpoints VALUES (?, ?, ?, ?, ?)", cp)

    # Calendar: 90 days from June 1, 2026 to August 30, 2026
    start_date = datetime(2026, 6, 1)
    for i in range(91):
        dt = start_date + timedelta(days=i)
        date_id = dt.strftime("%Y-%m-%d")
        day_name = dt.strftime("%A")
        day_of_week = dt.weekday()
        is_weekend = 1 if day_of_week in (4, 5, 6) else 0 # Fri, Sat, Sun peak
        # Holidays: Idul Adha (approx June 16-18), Independence Day (Aug 17)
        if dt.month == 6 and 14 <= dt.day <= 19:
            season = "LEBARAN_MUDIK"
        elif dt.month == 8 and 15 <= dt.day <= 18:
            season = "WEEKEND_PEAK"
        elif is_weekend:
            season = "WEEKEND_PEAK"
        else:
            season = "REGULAR"

        cur.execute(
            "INSERT INTO dim_calendar VALUES (?, ?, ?, ?, ?)",
            (date_id, day_name, day_of_week, is_weekend, season)
        )
    conn.commit()

def generate_trips(conn, num_trips=3000, seed=42):
    random.seed(seed)
    cur = conn.cursor()

    cur.execute("SELECT date_id, is_weekend, season_type FROM dim_calendar")
    calendar_days = cur.fetchall()

    trip_counter = 1
    stage_counter = 1

    departure_hours = [6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21]
    departure_hour_weights = [0.04, 0.05, 0.03, 0.02, 0.06, 0.07, 0.12, 0.16, 0.18, 0.14, 0.08, 0.03, 0.02]

    for _ in range(num_trips):
        day_info = random.choice(calendar_days)
        date_str, is_weekend, season_type = day_info

        op = random.choice(OPERATORS)
        route = random.choice(ROUTES)

        # Scheduled departure
        dep_hour = random.choices(departure_hours, weights=departure_hour_weights)[0]
        dep_min = random.choice([0, 15, 30, 45])
        sched_dep = datetime.strptime(f"{date_str} {dep_hour:02d}:{dep_min:02d}:00", "%Y-%m-%d %H:%M:%S")

        # Scheduled arrival
        sched_arr = sched_dep + timedelta(hours=route["eta_hours"])

        # -------------------------------------------------------------
        # Operational Stage-Gates Simulation
        # -------------------------------------------------------------
        # Stage 1: Origin Terminal Dwell & Agency Ngetem
        sched_s1 = 20.0
        if op["idle_bias"] <= 1.0:
            actual_s1 = random.gauss(22.0, 5.0)
        else:
            actual_s1 = random.gauss(38.0 * op["idle_bias"], 12.0)
        actual_s1 = max(15.0, actual_s1)
        idle_s1 = actual_s1 * 0.70

        # Departure delay determined by Stage 1
        dep_delay_min = round(actual_s1 - sched_s1, 1)
        actual_dep = sched_dep + timedelta(minutes=dep_delay_min)

        # Stage 2: Arterial City Transit (escaping Jabodetabek bottleneck)
        sched_s2 = 45.0
        traffic_multiplier = 1.0
        if 16 <= dep_hour <= 19:
            traffic_multiplier = 1.65 # Peak evening rush hour
        elif 7 <= dep_hour <= 9:
            traffic_multiplier = 1.35
        if season_type != "REGULAR":
            traffic_multiplier *= 1.30

        actual_s2 = max(35.0, random.gauss(sched_s2 * traffic_multiplier, 12.0))
        idle_s2 = actual_s2 * 0.35

        # Stage 3: Highway Cruising (Tol Trans-Jawa)
        cruising_dist_km = route["highway_km"]
        if op["speed_policy"] == "AGGRESSIVE":
            target_speed = random.gauss(96.0, 6.0)
            fuel_base_intensity = 31.5 # L/100km
        elif op["speed_policy"] == "DISCIPLINED":
            target_speed = random.gauss(86.0, 3.5)
            fuel_base_intensity = 24.8 # L/100km
        else: # BALANCED
            target_speed = random.gauss(90.0, 4.5)
            fuel_base_intensity = 27.2 # L/100km

        target_speed = min(115.0, max(65.0, target_speed))
        cruising_hours = cruising_dist_km / target_speed
        actual_s3 = cruising_hours * 60.0
        sched_s3 = (route["highway_km"] / 88.0) * 60.0
        idle_s3 = random.uniform(2.0, 8.0)

        # Stage 4: Rest Area Dining / Service Stop
        sched_s4 = 35.0
        actual_s4 = max(28.0, random.gauss(sched_s4 * (1.1 if is_weekend else 1.0), 7.0))
        idle_s4 = actual_s4 * 0.40 # idling during passenger boarding

        # Stage 5: Destination City & Terminal Arrival
        sched_s5 = 20.0
        actual_s5 = max(15.0, random.gauss(22.0, 6.0))
        idle_s5 = actual_s5 * 0.30

        # Totals
        total_actual_min = actual_s1 + actual_s2 + actual_s3 + actual_s4 + actual_s5
        total_sched_min = sched_s1 + sched_s2 + sched_s3 + sched_s4 + sched_s5
        actual_arr = sched_dep + timedelta(minutes=total_actual_min)

        arr_delay_min = round((actual_arr - sched_arr).total_seconds() / 60.0, 1)

        # Categorize OTP
        if arr_delay_min <= 15.0:
            otp_status = "ON_TIME"
        elif arr_delay_min <= 45.0:
            otp_status = "MINOR_DELAY"
        elif arr_delay_min <= 90.0:
            otp_status = "MODERATE_DELAY"
        else:
            otp_status = "SEVERE_DELAY"

        total_duration_hours = round(total_actual_min / 60.0, 2)
        avg_speed_kmh = round(route["distance_km"] / total_duration_hours, 1)

        total_idle_min = round(idle_s1 + idle_s2 + idle_s3 + idle_s4 + idle_s5, 1)
        idle_fuel = (total_idle_min / 60.0) * 2.8 # 2.8 L/hr idling waste

        # Cruising fuel with speed and load penalty
        passengers = random.randint(24, 34)
        capacity = 34
        load_factor = passengers / capacity

        distance_fuel = (route["distance_km"] / 100.0) * (fuel_base_intensity * (0.95 + 0.10 * load_factor))
        fuel_consumed = round(distance_fuel + idle_fuel, 1)
        fuel_efficiency = round(route["distance_km"] / fuel_consumed, 2)
        fuel_intensity = round((fuel_consumed / route["distance_km"]) * 100.0, 2)

        gross_rev = passengers * route["ticket_price"]
        plate_no = f"B {random.randint(7000, 7999)} {random.choice(['VAA', 'SJA', 'RIA', 'HYA', 'GHA'])}"

        trip_id = f"TRP-{trip_counter:05d}"
        trip_counter += 1

        cur.execute(
            """INSERT INTO fact_trips VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )""",
            (
                trip_id, date_str, op["id"], route["id"], plate_no,
                sched_dep.strftime("%Y-%m-%d %H:%M:%S"), actual_dep.strftime("%Y-%m-%d %H:%M:%S"),
                sched_arr.strftime("%Y-%m-%d %H:%M:%S"), actual_arr.strftime("%Y-%m-%d %H:%M:%S"),
                dep_delay_min, arr_delay_min, otp_status, total_duration_hours,
                route["distance_km"], fuel_consumed, fuel_efficiency, fuel_intensity,
                avg_speed_kmh, total_idle_min, passengers, capacity, route["ticket_price"], gross_rev
            )
        )

        # Insert Stages
        stages_info = [
            ("ORIGIN_DWELL_NGETEM", "CP01", "CP02", sched_s1, actual_s1, idle_s1, 0.0),
            ("ARTERIAL_CITY_TRANSIT", "CP02", "CP03", sched_s2, actual_s2, idle_s2, 45.0),
            ("HIGHWAY_CRUISING", "CP03", "CP08", sched_s3, actual_s3, idle_s3, target_speed),
            ("REST_AREA_DINING", "CP04", "CP05", sched_s4, actual_s4, idle_s4, 0.0),
            ("DEST_TERMINAL_ARRIVAL", "CP08", "CP09", sched_s5, actual_s5, idle_s5, 30.0),
        ]

        for seq, (s_name, cp_from, cp_to, s_sched, s_act, s_idle, s_speed) in enumerate(stages_info, start=1):
            s_id = f"STG-{stage_counter:07d}"
            stage_counter += 1
            s_delay = round(s_act - s_sched, 1)
            s_fuel = round((s_act / total_actual_min) * fuel_consumed, 2)
            cur.execute(
                """INSERT INTO fact_trip_stages VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )""",
                (s_id, trip_id, seq, s_name, cp_from, cp_to, s_sched, s_act, s_delay, s_idle, s_fuel, s_speed)
            )

    conn.commit()
    print(f"Successfully generated {num_trips} trips and {stage_counter - 1} stages into database.")

def main():
    conn = init_db()
    populate_dimensions(conn)
    generate_trips(conn, num_trips=3200)
    conn.close()

if __name__ == "__main__":
    main()
