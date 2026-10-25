-- ============================================================================
-- NusantaraBus OTP & Fleet Analytics Engine — Star Schema DDL
-- Compatible with SQLite, DuckDB, and PostgreSQL
-- ============================================================================

DROP TABLE IF EXISTS fact_trip_stages;
DROP TABLE IF EXISTS fact_trips;
DROP TABLE IF EXISTS dim_checkpoints;
DROP TABLE IF EXISTS dim_routes;
DROP TABLE IF EXISTS dim_operators;
DROP TABLE IF EXISTS dim_calendar;

-- 1. DIMENSION: OPERATORS (Perusahaan Otobus - PO)
CREATE TABLE dim_operators (
    operator_id VARCHAR(10) PRIMARY KEY,
    po_name VARCHAR(100) NOT NULL,
    brand_color VARCHAR(20) DEFAULT '#1E3A8A',
    service_class VARCHAR(50) NOT NULL, -- 'Executive', 'Super Executive', 'Sleeper Suite'
    fleet_count INT NOT NULL,
    headquarters VARCHAR(100) NOT NULL
);

-- 2. DIMENSION: ROUTES (Trayek Antarkota)
CREATE TABLE dim_routes (
    route_id VARCHAR(20) PRIMARY KEY,
    origin_city VARCHAR(50) NOT NULL,
    origin_terminal VARCHAR(100) NOT NULL,
    destination_city VARCHAR(50) NOT NULL,
    destination_terminal VARCHAR(100) NOT NULL,
    distance_km FLOAT NOT NULL,
    highway_km FLOAT NOT NULL,
    arterial_km FLOAT NOT NULL,
    scheduled_eta_hours FLOAT NOT NULL
);

-- 3. DIMENSION: CHECKPOINTS (Titik Kontrol & Rest Area)
CREATE TABLE dim_checkpoints (
    checkpoint_id VARCHAR(20) PRIMARY KEY,
    checkpoint_name VARCHAR(100) NOT NULL,
    checkpoint_type VARCHAR(50) NOT NULL, -- 'ORIGIN_TERMINAL', 'SUB_AGENCY', 'TOLL_GATE', 'REST_AREA_DINING', 'DEST_TERMINAL'
    km_mark FLOAT NOT NULL,
    city VARCHAR(50) NOT NULL
);

-- 4. DIMENSION: CALENDAR (Dimensi Waktu & Musim)
CREATE TABLE dim_calendar (
    date_id DATE PRIMARY KEY,
    day_name VARCHAR(20) NOT NULL,
    day_of_week INT NOT NULL,
    is_weekend BOOLEAN NOT NULL,
    season_type VARCHAR(30) NOT NULL -- 'REGULAR', 'WEEKEND_PEAK', 'LEBARAN_MUDIK', 'NATARU'
);

-- 5. FACT: TRIPS (Tingkat Perjalanan Bus Antarkota)
CREATE TABLE fact_trips (
    trip_id VARCHAR(30) PRIMARY KEY,
    date_id DATE NOT NULL,
    operator_id VARCHAR(10) NOT NULL,
    route_id VARCHAR(20) NOT NULL,
    bus_plate_number VARCHAR(20) NOT NULL,
    scheduled_departure_ts TIMESTAMP NOT NULL,
    actual_departure_ts TIMESTAMP NOT NULL,
    scheduled_arrival_ts TIMESTAMP NOT NULL,
    actual_arrival_ts TIMESTAMP NOT NULL,
    departure_delay_min FLOAT NOT NULL,
    arrival_delay_min FLOAT NOT NULL,
    otp_status VARCHAR(30) NOT NULL, -- 'ON_TIME', 'MINOR_DELAY', 'MODERATE_DELAY', 'SEVERE_DELAY'
    total_duration_hours FLOAT NOT NULL,
    distance_km FLOAT NOT NULL,
    fuel_consumed_liters FLOAT NOT NULL,
    fuel_efficiency_km_l FLOAT NOT NULL, -- KM per Liter
    fuel_intensity_l_100km FLOAT NOT NULL, -- Liters per 100 KM
    avg_speed_kmh FLOAT NOT NULL,
    idle_time_total_min FLOAT NOT NULL,
    passenger_count INT NOT NULL,
    seat_capacity INT NOT NULL,
    ticket_price_idr FLOAT NOT NULL,
    gross_revenue_idr FLOAT NOT NULL,
    FOREIGN KEY (date_id) REFERENCES dim_calendar(date_id),
    FOREIGN KEY (operator_id) REFERENCES dim_operators(operator_id),
    FOREIGN KEY (route_id) REFERENCES dim_routes(route_id)
);

-- 6. FACT: TRIP STAGES (Dekomposisi Tahapan Perjalanan / Dwell-Time)
CREATE TABLE fact_trip_stages (
    stage_id VARCHAR(40) PRIMARY KEY,
    trip_id VARCHAR(30) NOT NULL,
    stage_sequence INT NOT NULL,
    stage_name VARCHAR(50) NOT NULL, -- 'ORIGIN_DWELL_NGETEM', 'ARTERIAL_CITY_TRANSIT', 'HIGHWAY_CRUISING', 'REST_AREA_DINING', 'DEST_TERMINAL_ARRIVAL'
    checkpoint_from_id VARCHAR(20) NOT NULL,
    checkpoint_to_id VARCHAR(20) NOT NULL,
    scheduled_duration_min FLOAT NOT NULL,
    actual_duration_min FLOAT NOT NULL,
    delay_variance_min FLOAT NOT NULL, -- actual - scheduled
    idle_duration_min FLOAT NOT NULL,
    fuel_burned_liters FLOAT NOT NULL,
    avg_speed_kmh FLOAT NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES fact_trips(trip_id),
    FOREIGN KEY (checkpoint_from_id) REFERENCES dim_checkpoints(checkpoint_id),
    FOREIGN KEY (checkpoint_to_id) REFERENCES dim_checkpoints(checkpoint_id)
);

-- INDEXES FOR FAST ANALYTICAL PERFORMANCE
CREATE INDEX idx_trips_operator_date ON fact_trips(operator_id, date_id);
CREATE INDEX idx_trips_route_date ON fact_trips(route_id, date_id);
CREATE INDEX idx_trips_otp_status ON fact_trips(otp_status);
CREATE INDEX idx_stages_trip_seq ON fact_trip_stages(trip_id, stage_sequence);
