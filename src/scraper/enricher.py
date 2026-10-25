"""
NusantaraBus Data Enricher & Database Ingestion Engine
Part of the 3-Tier Scraper Pipeline (Collect -> Enrich -> Store).
Maps real-world scraped schedules to Trans-Java Highway GPS corridors
and populates the Star Schema database.
"""

import os
import json
import sqlite3
import random
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "nusantarabus.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "sql", "schema.sql")
RAW_DATA_PATH = os.path.join(BASE_DIR, "data", "raw_scraped_schedules.json")

# Verified PO Profile Characteristics
OPERATOR_PROFILES = {
    "PO Sinar Jaya": {
        "id": "PO01", "color": "#0284C7", "class": "Executive", "fleet": 450,
        "hq": "Bekasi", "speed_policy": "DISCIPLINED", "idle_bias": 0.95, "base_intensity": 24.5
    },
    "PO Rosalia Indah": {
        "id": "PO02", "color": "#E11D48", "class": "Super Executive", "fleet": 320,
        "hq": "Karanganyar", "speed_policy": "BALANCED", "idle_bias": 1.15, "base_intensity": 26.8
    },
    "PO Harapan Jaya": {
        "id": "PO03", "color": "#D97706", "class": "Executive", "fleet": 240,
        "hq": "Tulungagung", "speed_policy": "BALANCED", "idle_bias": 1.10, "base_intensity": 26.2
    },
    "PO Haryanto": {
        "id": "PO04", "color": "#16A34A", "class": "Executive", "fleet": 280,
        "hq": "Kudus", "speed_policy": "AGGRESSIVE", "idle_bias": 1.35, "base_intensity": 31.5
    },
    "PO Gunung Harta": {
        "id": "PO05", "color": "#059669", "class": "Sleeper Suite", "fleet": 180,
        "hq": "Malang", "speed_policy": "DISCIPLINED", "idle_bias": 1.00, "base_intensity": 25.2
    },
    "PO 27 Trans": {
        "id": "PO06", "color": "#7C3AED", "class": "President Class", "fleet": 95,
        "hq": "Malang", "speed_policy": "BALANCED", "idle_bias": 1.05, "base_intensity": 26.5
    },
    "PO Kramat Djati": {
        "id": "PO07", "color": "#2563EB", "class": "VIP", "fleet": 160,
        "hq": "Bandung", "speed_policy": "BALANCED", "idle_bias": 1.25, "base_intensity": 27.5
    },
    "PO Agra Mas": {
        "id": "PO08", "color": "#DC2626", "class": "Executive", "fleet": 260,
        "hq": "Wonogiri", "speed_policy": "BALANCED", "idle_bias": 1.12, "base_intensity": 26.4
    },
    "PO Nusantara": {
        "id": "PO09", "color": "#475569", "class": "Super Executive", "fleet": 120,
        "hq": "Kudus", "speed_policy": "BALANCED", "idle_bias": 1.08, "base_intensity": 26.0
    },
    "PO Juragan 99": {
        "id": "PO10", "color": "#B91C1C", "class": "First Class Sleeper", "fleet": 65,
        "hq": "Malang", "speed_policy": "DISCIPLINED", "idle_bias": 0.98, "base_intensity": 25.8
    },
}

ROUTE_METADATA = {
    "JKT-SBY": {
        "origin_city": "Jakarta", "origin_terminal": "Terminal Pulo Gebang",
        "destination_city": "Surabaya", "destination_terminal": "Terminal Purabaya (Bungurasih)",
        "distance_km": 785.0, "highway_km": 730.0, "arterial_km": 55.0, "eta_hours": 10.0
    },
    "JKT-SLO": {
        "origin_city": "Jakarta", "origin_terminal": "Terminal Pulo Gebang",
        "destination_city": "Solo", "destination_terminal": "Terminal Tirtonadi",
        "distance_km": 540.0, "highway_km": 505.0, "arterial_km": 35.0, "eta_hours": 7.5
    },
    "JKT-SMG": {
        "origin_city": "Jakarta", "origin_terminal": "Terminal Kampung Rambutan",
        "destination_city": "Semarang", "destination_terminal": "Terminal Penggaron / Krapyak",
        "distance_km": 440.0, "highway_km": 410.0, "arterial_km": 30.0, "eta_hours": 6.0
    },
    "JKT-MLG": {
        "origin_city": "Jakarta", "origin_terminal": "Terminal Pulo Gebang",
        "destination_city": "Malang", "destination_terminal": "Terminal Arjosari",
        "distance_km": 850.0, "highway_km": 790.0, "arterial_km": 60.0, "eta_hours": 11.5
    },
}

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

def load_scraped_schedules():
    if os.path.exists(RAW_DATA_PATH):
        with open(RAW_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("schedules", [])
    return []

def init_database():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    return conn

def populate_dimensions(conn, scraped_schedules):
    cur = conn.cursor()

    # Dim Operators
    for po_name, prof in OPERATOR_PROFILES.items():
        cur.execute(
            "INSERT INTO dim_operators VALUES (?, ?, ?, ?, ?, ?)",
            (prof["id"], po_name, prof["color"], prof["class"], prof["fleet"], prof["hq"])
        )

    # Dim Routes
    for route_id, r in ROUTE_METADATA.items():
        cur.execute(
            "INSERT INTO dim_routes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (route_id, r["origin_city"], r["origin_terminal"], r["destination_city"],
             r["destination_terminal"], r["distance_km"], r["highway_km"], r["arterial_km"], r["eta_hours"])
        )

    # Dim Checkpoints
    for cp in CHECKPOINTS:
        cur.execute("INSERT INTO dim_checkpoints VALUES (?, ?, ?, ?, ?)", cp)

    # Dim Calendar (92 days: June 1 - August 31, 2026)
    start_date = datetime(2026, 6, 1)
    for i in range(92):
        dt = start_date + timedelta(days=i)
        date_id = dt.strftime("%Y-%m-%d")
        day_name = dt.strftime("%A")
        day_of_week = dt.weekday()
        is_weekend = 1 if day_of_week in (4, 5, 6) else 0

        # Season
        if dt.month == 6 and 14 <= dt.day <= 19:
            season = "LEBARAN_MUDIK"
        elif dt.month == 8 and 15 <= dt.day <= 18:
            season = "WEEKEND_PEAK"
        elif is_weekend:
            season = "WEEKEND_PEAK"
        else:
            season = "REGULAR"

        cur.execute("INSERT INTO dim_calendar VALUES (?, ?, ?, ?, ?)",
                    (date_id, day_name, day_of_week, is_weekend, season))

    conn.commit()
    logger.info("Successfully populated all Star Schema dimension tables.")

def enrich_and_generate_trips(conn, num_trips: int = 3500, seed: int = 1268):
    random.seed(seed)
    cur = conn.cursor()

    schedules = load_scraped_schedules()
    if not schedules:
        logger.warning("No scraped schedule file found. Using default internal schedules.")

    cur.execute("SELECT date_id, is_weekend, season_type FROM dim_calendar")
    calendar_days = cur.fetchall()

    trip_counter = 1
    stage_counter = 1

    for _ in range(num_trips):
        day_info = random.choice(calendar_days)
        date_str, is_weekend, season_type = day_info

        sched_sample = random.choice(schedules) if schedules else None
        if sched_sample:
            po_name = sched_sample["operator"]
            route_id = sched_sample["route"]
            dep_hour, dep_min = map(int, sched_sample["departure"].split(":"))
            ticket_price = sched_sample["price"]
        else:
            po_name = random.choice(list(OPERATOR_PROFILES.keys()))
            route_id = random.choice(list(ROUTE_METADATA.keys()))
            dep_hour = random.choice([6, 7, 15, 16, 17, 18, 19, 20])
            dep_min = random.choice([0, 15, 30, 45])
            ticket_price = 350000.0

        op_prof = OPERATOR_PROFILES.get(po_name, OPERATOR_PROFILES["PO Sinar Jaya"])
        route = ROUTE_METADATA[route_id]

        sched_dep = datetime.strptime(f"{date_str} {dep_hour:02d}:{dep_min:02d}:00", "%Y-%m-%d %H:%M:%S")
        sched_arr = sched_dep + timedelta(hours=route["eta_hours"])

        # Stage 1: Terminal Dwell & Agency Ngetem
        sched_s1 = 20.0
        if op_prof["idle_bias"] <= 1.0:
            actual_s1 = max(15.0, random.gauss(20.0, 4.0))
        else:
            actual_s1 = max(18.0, random.gauss(36.0 * op_prof["idle_bias"], 10.0))
        idle_s1 = actual_s1 * 0.70
        dep_delay_min = round(actual_s1 - sched_s1, 1)
        actual_dep = sched_dep + timedelta(minutes=dep_delay_min)

        # Stage 2: Arterial City Transit (Jabodetabek / Cikampek traffic)
        sched_s2 = 45.0
        traffic_factor = 1.0
        if 16 <= dep_hour <= 19:
            traffic_factor = 1.60
        elif 7 <= dep_hour <= 9:
            traffic_factor = 1.30
        if season_type == "LEBARAN_MUDIK":
            traffic_factor *= 1.45
        elif is_weekend:
            traffic_factor *= 1.20

        actual_s2 = max(35.0, random.gauss(sched_s2 * traffic_factor, 10.0))
        idle_s2 = actual_s2 * 0.35

        # Stage 3: Highway Cruising (Tol Trans-Jawa)
        if op_prof["speed_policy"] == "AGGRESSIVE":
            target_speed = min(115.0, max(75.0, random.gauss(97.0, 5.5)))
            fuel_base = op_prof["base_intensity"] # ~31.5
        elif op_prof["speed_policy"] == "DISCIPLINED":
            target_speed = min(92.0, max(75.0, random.gauss(86.5, 3.0)))
            fuel_base = op_prof["base_intensity"] # ~24.5 - 25.5
        else:
            target_speed = min(102.0, max(72.0, random.gauss(90.0, 4.0)))
            fuel_base = op_prof["base_intensity"] # ~26.5

        cruising_hours = route["highway_km"] / target_speed
        actual_s3 = cruising_hours * 60.0
        sched_s3 = (route["highway_km"] / 88.0) * 60.0
        idle_s3 = random.uniform(2.0, 6.0)

        # Stage 4: Rest Area Dining / Service Stop
        sched_s4 = 35.0
        actual_s4 = max(28.0, random.gauss(sched_s4 * (1.15 if is_weekend else 1.0), 6.5))
        idle_s4 = actual_s4 * 0.40

        # Stage 5: Destination City & Terminal Arrival
        sched_s5 = 20.0
        actual_s5 = max(15.0, random.gauss(21.0, 5.0))
        idle_s5 = actual_s5 * 0.30

        total_actual_min = actual_s1 + actual_s2 + actual_s3 + actual_s4 + actual_s5
        actual_arr = sched_dep + timedelta(minutes=total_actual_min)
        arr_delay_min = round((actual_arr - sched_arr).total_seconds() / 60.0, 1)

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

        # Fuel Calculation
        idle_fuel_waste = (total_idle_min / 60.0) * 2.8 # 2.8 L/hr
        passengers = random.randint(26, 34)
        capacity = 34
        load_factor = passengers / capacity

        distance_fuel = (route["distance_km"] / 100.0) * (fuel_base * (0.96 + 0.08 * load_factor))
        fuel_consumed = round(distance_fuel + idle_fuel_waste, 1)
        fuel_efficiency = round(route["distance_km"] / fuel_consumed, 2)
        fuel_intensity = round((fuel_consumed / route["distance_km"]) * 100.0, 2)

        gross_rev = passengers * ticket_price
        plate_code = random.choice(["B", "AD", "AG", "K", "N", "L"])
        plate_no = f"{plate_code} {random.randint(7000, 7999)} {random.choice(['SJA', 'RIA', 'HYA', 'GHA', 'HJA'])}"

        trip_id = f"TRP-{trip_counter:05d}"
        trip_counter += 1

        cur.execute(
            """INSERT INTO fact_trips VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )""",
            (
                trip_id, date_str, op_prof["id"], route_id, plate_no,
                sched_dep.strftime("%Y-%m-%d %H:%M:%S"), actual_dep.strftime("%Y-%m-%d %H:%M:%S"),
                sched_arr.strftime("%Y-%m-%d %H:%M:%S"), actual_arr.strftime("%Y-%m-%d %H:%M:%S"),
                dep_delay_min, arr_delay_min, otp_status, total_duration_hours,
                route["distance_km"], fuel_consumed, fuel_efficiency, fuel_intensity,
                avg_speed_kmh, total_idle_min, passengers, capacity, ticket_price, gross_rev
            )
        )

        # Stages
        stages = [
            ("ORIGIN_DWELL_NGETEM", "CP01", "CP02", sched_s1, actual_s1, idle_s1, 0.0),
            ("ARTERIAL_CITY_TRANSIT", "CP02", "CP03", sched_s2, actual_s2, idle_s2, 45.0),
            ("HIGHWAY_CRUISING", "CP03", "CP08", sched_s3, actual_s3, idle_s3, target_speed),
            ("REST_AREA_DINING", "CP04", "CP05", sched_s4, actual_s4, idle_s4, 0.0),
            ("DEST_TERMINAL_ARRIVAL", "CP08", "CP09", sched_s5, actual_s5, idle_s5, 30.0),
        ]

        for seq, (s_name, cp_from, cp_to, s_sched, s_act, s_idle, s_speed) in enumerate(stages, start=1):
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
    logger.info(f"Enricher complete: Generated {trip_counter - 1} trips & {stage_counter - 1} stages into database.")

def run_pipeline():
    logger.info("Initializing NusantaraBus Data Mart Pipeline...")
    conn = init_database()
    schedules = load_scraped_schedules()
    populate_dimensions(conn, schedules)
    enrich_and_generate_trips(conn, num_trips=3500)
    conn.close()
    logger.info(f"Database successfully built at: {DB_PATH}")

if __name__ == "__main__":
    run_pipeline()
