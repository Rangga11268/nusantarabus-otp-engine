-- ============================================================================
-- NusantaraBus Advanced Analytical Queries
-- Demonstrating Modern SQL Analytics (CTEs, Window Functions, Aggregations)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUERY 1: OPERATOR OTP LEADERBOARD WITH WINDOW RANKING
-- Menghitung persentase On-Time Performance (OTP) per PO Bus & Ranking Pasar
-- ----------------------------------------------------------------------------
WITH operator_trip_summary AS (
    SELECT 
        o.operator_id,
        o.po_name,
        o.service_class,
        COUNT(t.trip_id) AS total_trips,
        SUM(CASE WHEN t.arrival_delay_min <= 15 THEN 1 ELSE 0 END) AS on_time_trips,
        SUM(CASE WHEN t.arrival_delay_min > 15 AND t.arrival_delay_min <= 45 THEN 1 ELSE 0 END) AS minor_delay_trips,
        SUM(CASE WHEN t.arrival_delay_min > 45 AND t.arrival_delay_min <= 90 THEN 1 ELSE 0 END) AS moderate_delay_trips,
        SUM(CASE WHEN t.arrival_delay_min > 90 THEN 1 ELSE 0 END) AS severe_delay_trips,
        ROUND(AVG(t.arrival_delay_min), 1) AS avg_delay_min,
        ROUND(AVG(t.fuel_intensity_l_100km), 2) AS avg_fuel_burn_l_100km
    FROM fact_trips t
    JOIN dim_operators o ON t.operator_id = o.operator_id
    GROUP BY o.operator_id, o.po_name, o.service_class
),
calculated_metrics AS (
    SELECT 
        operator_id,
        po_name,
        service_class,
        total_trips,
        on_time_trips,
        ROUND(100.0 * on_time_trips / total_trips, 2) AS otp_percentage,
        ROUND(100.0 * severe_delay_trips / total_trips, 2) AS severe_delay_pct,
        avg_delay_min,
        avg_fuel_burn_l_100km
    FROM operator_trip_summary
)
SELECT 
    RANK() OVER (ORDER BY otp_percentage DESC, avg_delay_min ASC) AS reliability_rank,
    po_name,
    service_class,
    total_trips,
    otp_percentage,
    avg_delay_min,
    severe_delay_pct,
    avg_fuel_burn_l_100km
FROM calculated_metrics
ORDER BY reliability_rank;


-- ----------------------------------------------------------------------------
-- QUERY 2: STAGE-GATE DWELL-TIME BOTTLENECK ATTRIBUTION
-- Mengidentifikasi di tahap mana keterlambatan paling banyak terakumulasi
-- ----------------------------------------------------------------------------
SELECT 
    s.stage_name,
    COUNT(s.stage_id) AS total_stage_instances,
    ROUND(AVG(s.scheduled_duration_min), 1) AS avg_scheduled_min,
    ROUND(AVG(s.actual_duration_min), 1) AS avg_actual_min,
    ROUND(AVG(s.delay_variance_min), 1) AS avg_delay_added_min,
    ROUND(SUM(CASE WHEN s.delay_variance_min > 0 THEN s.delay_variance_min ELSE 0 END) * 100.0 / 
          SUM(SUM(CASE WHEN s.delay_variance_min > 0 THEN s.delay_variance_min ELSE 0 END)) OVER (), 2) AS pct_of_total_delay_created,
    ROUND(AVG(s.idle_duration_min), 1) AS avg_idle_wasted_min
FROM fact_trip_stages s
GROUP BY s.stage_name
ORDER BY avg_delay_added_min DESC;


-- ----------------------------------------------------------------------------
-- QUERY 3: DELAY PROPAGATION & MULTIPLIER EFFECT
-- Menganalisis apakah keterlambatan berangkat (ngetem) berlipat ganda di tujuan
-- ----------------------------------------------------------------------------
SELECT 
    CASE 
        WHEN t.departure_delay_min <= 5 THEN '01. Tepat Waktu (<= 5 mnt)'
        WHEN t.departure_delay_min <= 20 THEN '02. Ngetem Ringan (6-20 mnt)'
        WHEN t.departure_delay_min <= 45 THEN '03. Ngetem Sedang (21-45 mnt)'
        ELSE '04. Ngetem Parah (> 45 mnt)'
    END AS departure_delay_bracket,
    COUNT(t.trip_id) AS trip_sample_size,
    ROUND(AVG(t.departure_delay_min), 1) AS avg_start_delay_min,
    ROUND(AVG(t.arrival_delay_min), 1) AS avg_final_arrival_delay_min,
    ROUND(AVG(t.arrival_delay_min - t.departure_delay_min), 1) AS net_delay_escalation_min,
    ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min <= 15 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS final_otp_rate_pct
FROM fact_trips t
GROUP BY 1
ORDER BY 1;


-- ----------------------------------------------------------------------------
-- QUERY 4: FUEL INTENSITY VS CRUISING SPEED ELASTICITY
-- Menganalisis elastisitas boros solar akibat mengebut (>100 km/jam) vs stabil (80-90 km/jam)
-- ----------------------------------------------------------------------------
SELECT 
    CASE 
        WHEN t.avg_speed_kmh < 65 THEN 'Sangat Lambat (<65 km/h, Macet)'
        WHEN t.avg_speed_kmh <= 80 THEN 'Normal Urban (65-80 km/h)'
        WHEN t.avg_speed_kmh <= 95 THEN 'Eco-Cruising Optimal (81-95 km/h)'
        ELSE 'Aggressive Speeding (>95 km/h)'
    END AS speed_profile,
    COUNT(t.trip_id) AS trips_count,
    ROUND(AVG(t.avg_speed_kmh), 1) AS mean_speed_kmh,
    ROUND(AVG(t.fuel_intensity_l_100km), 2) AS mean_fuel_l_100km,
    ROUND(AVG(t.fuel_efficiency_km_l), 2) AS km_per_liter,
    ROUND(AVG(t.fuel_consumed_liters * 13500), 0) AS avg_fuel_cost_idr -- Solar Industri Rp 13.500/L
FROM fact_trips t
GROUP BY 1
ORDER BY mean_fuel_l_100km ASC;


-- ----------------------------------------------------------------------------
-- QUERY 5: PASSENGER DEPARTURE TIME RECOMMENDER
-- Jam keberangkatan terbaik dari Jakarta menuju Surabaya & Solo
-- ----------------------------------------------------------------------------
SELECT 
    strftime('%H:00', t.scheduled_departure_ts) AS departure_hour,
    r.destination_city,
    COUNT(t.trip_id) AS total_trips,
    ROUND(AVG(t.arrival_delay_min), 1) AS avg_delay_minutes,
    ROUND(100.0 * SUM(CASE WHEN t.arrival_delay_min <= 15 THEN 1 ELSE 0 END) / COUNT(t.trip_id), 1) AS on_time_probability_pct,
    ROUND(AVG(t.total_duration_hours), 2) AS avg_travel_time_hours
FROM fact_trips t
JOIN dim_routes r ON t.route_id = r.route_id
WHERE r.destination_city IN ('Surabaya', 'Solo')
GROUP BY 1, 2
ORDER BY 2, on_time_probability_pct DESC;
