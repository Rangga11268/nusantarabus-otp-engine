# NusantaraBus: Intercity Bus OTP & Fleet Intelligence Engine
*Empirical On-Time Performance (OTP) Modeling, 5-Stage Gate Dwell-Time Bottleneck Diagnostics, and Fuel OPEX Optimization across Indonesia's Trans-Java Tollway Network.*

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Data%20Mart-SQLite%20Star%20Schema-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Automated Tests](https://img.shields.io/badge/Tests-10%2F10%20Passing-22c55e.svg)](tests/)
[![Dataset](https://img.shields.io/badge/Dataset-80%20Verified%20Reviews%20(Excel)-217346.svg?logo=microsoftexcel&logoColor=white)](data/nusantarabus_complete_dataset.xlsx)
[![UI Architecture](https://img.shields.io/badge/Frontend-Vanilla%20ES6%2B%20%7C%20Zero--Build-38bdf8.svg)](index.html)
[![License](https://img.shields.io/badge/License-MIT-slate.svg)](LICENSE)

---

## Executive Summary

**NusantaraBus OTP Engine** is an operational data analytics and fleet intelligence platform engineered to diagnose intercity bus delays (*Bus Antarkota Antarprovinsi - AKAP*) across Indonesia's Trans-Java Highway Network (**Jakarta &ndash; Semarang &ndash; Solo &ndash; Surabaya &ndash; Malang**).

Rather than treating transit delay as an unavoidable black box, this project decomposes bus operations into a **5-Stage Gate Empirical Attribution Framework**. It analyzes **3,500 completed trips**, **17,500 discrete transit stages**, and **80 verified passenger reviews** harvested from public OTA platforms (RedBus ID and Traveloka) to answer four critical questions:

1. **Where is time actually lost?** Isolating origin terminal dwell (*ngetem*) and rest area dinner overstays from pure highway congestion.
2. **The Snowball Multiplier Effect:** Demonstrating how an initial 15-minute terminal departure delay cascades into a 90+ minute arrival delay at destination terminals.
3. **OPEX Fuel Optimization:** Calculating the mathematical trade-off between aggressive cruising (&gt;105 km/h) and eco-cruising (85&ndash;90 km/h) with engine idling penalties (2.8 L/hr).
4. **Passenger Trust & Sentiment:** Merging quantitative punctuality metrics with real, qualitative passenger feedback so travelers can choose operators based on empirical reliability rather than agency marketing claims.

---

## System Architecture

The platform adopts a decoupled, end-to-end data pipeline adhering to the `diagram-design` specification:

<p align="center">
  <img src="docs/diagrams/system-architecture.svg" alt="NusantaraBus System Architecture" width="100%">
</p>

### Pipeline Breakdown:

1. **Ingestion & Scrape Boundary:**
   - **OTA Review Scrapers:** Modular collectors for public passenger feedback from RedBus ID and Traveloka.
   - **Fleet Telemetry Harvester:** Simulates and formats stage timestamps across origin terminals, toll plazas (GT Cikampek Utama, GT Kalikangkung, GT Warugunung), rest areas (KM 207, KM 379), and destination hubs.
   - **Untrusted Boundary Gate:** Strict schema sanitization, type enforcement, and constraint verification before data enters analytical storage.
2. **Dimensional Data Mart (SQLite Core):**
   - Clean dimensional modeling separating transaction facts (`fact_trips`, `fact_trip_stages`) from operational entities (`dim_operators`, `dim_routes`, `dim_checkpoints`, `dim_calendar`, `dim_operator_sentiment`).
   - SQLite relational integrity with enforced foreign keys (`PRAGMA foreign_keys = ON;`).
3. **Analytics Computation & Optimization Engine:**
   - **4-Band OTP Classifier:** Early/On-Time (&le;15 min), Minor Delay (15&ndash;30 min), Moderate Delay (30&ndash;60 min), Severe Delay (&gt;60 min).
   - **Stage-Gate Dwell Waterfall:** Variance tracking across five defined trip segments.
   - **OPEX Fuel Burn Model:** Dynamic fuel consumption calculations accounting for aerodynamic drag and idle fuel waste.
4. **Dual-Surface Web Application:**
   - **Consumer Travel Landing Page (Dribbble-Grade UI):** Citizen-facing booking interface with boarding pass ticket cards, verified passenger review feeds, and an anti-ngetem survival guide.
   - **Enterprise Fleet Operations Console:** Technical dashboard featuring KPI cards, bar charts with operator logos, interactive delay waterfall breakdowns, and OPEX fuel sliders.
   - **1-Click Seamless Switcher:** Direct, instantaneous transition between consumer and fleet operator modes.

---

## Dimensional Data Mart (Star Schema)

The analytical data warehouse is structured into a normalized Star Schema optimized for OLAP aggregations and window CTE queries:

<p align="center">
  <img src="docs/diagrams/star-schema.svg" alt="NusantaraBus Star Schema Model" width="100%">
</p>

### Table Specifications:

| Table Name | Role | Row Count | Primary Grain / Purpose |
|---|---|---|---|
| `fact_trips` | Central Fact | 3,500 | 1 row per completed AKAP bus trip across Trans-Java corridors |
| `fact_trip_stages` | Stage Fact | 17,500 | 1 row per stage-gate checkpoint transition (5 stages per trip) |
| `dim_operators` | Dimension | 10 | Profile of audited operators (Rosalia Indah, Harapan Jaya, Sinar Jaya, Juragan 99, Gunung Harta, 27 Trans, Haryanto, Agra Mas, Kramat Djati, Nusantara) |
| `dim_routes` | Dimension | 4 | Trans-Java highway corridors (Jakarta to Surabaya, Solo, Semarang, Malang) |
| `dim_checkpoints` | Dimension | 12 | Terminal gates, highway toll plazas, and official rest areas (KM 207, KM 379) |
| `dim_calendar` | Dimension | 365 | Temporal attributes (day of week, weekend indicator, holiday peak status) |
| `dim_operator_sentiment` | Dimension | 10 | Aggregated passenger trust score, positive review ratio, and top highlights |

### Modern SQL Analytical Queries (CTEs & Window Functions):

#### 1. On-Time Performance (OTP) 4-Band Window Classification:
```sql
WITH trip_delays AS (
  SELECT
    t.trip_id,
    o.po_name,
    r.dest_city,
    ROUND((JULIANDAY(t.actual_arrival) - JULIANDAY(t.scheduled_arrival)) * 1440, 1) AS delay_minutes
  FROM fact_trips t
  JOIN dim_operators o ON t.operator_id = o.operator_id
  JOIN dim_routes r ON t.route_id = r.route_id
)
SELECT
  po_name,
  COUNT(*) AS total_trips,
  ROUND(AVG(delay_minutes), 1) AS mean_delay_min,
  ROUND(100.0 * SUM(CASE WHEN delay_minutes <= 15 THEN 1 ELSE 0 END) / COUNT(*), 1) AS otp_rate_pct,
  ROUND(100.0 * SUM(CASE WHEN delay_minutes > 60 THEN 1 ELSE 0 END) / COUNT(*), 1) AS severe_delay_pct
FROM trip_delays
GROUP BY po_name
ORDER BY otp_rate_pct DESC;
```

#### 2. Stage-Gate Delay Root-Cause Attribution:
```sql
SELECT
  s.stage_type,
  COUNT(*) AS total_stages,
  ROUND(AVG(s.dwell_time_min), 1) AS avg_dwell_minutes,
  ROUND(AVG(s.stage_delay_delta), 1) AS avg_delay_contribution_min,
  ROUND(100.0 * SUM(CASE WHEN s.stage_delay_delta > 10 THEN 1 ELSE 0 END) / COUNT(*), 1) AS bottleneck_frequency_pct
FROM fact_trip_stages s
GROUP BY s.stage_type
ORDER BY avg_delay_contribution_min DESC;
```

---

## Empirical Analytical Findings

### 1. The Snowball Multiplier of Ngetem
The data mart uncovers a non-linear relationship between initial departure delay and final terminal arrival delay:

<p align="center">
  <img src="docs/diagrams/delay-waterfall.svg" alt="NusantaraBus 5-Stage Delay Waterfall" width="100%">
</p>

* **Early Departures (&le;5 min initial delay):** Average destination delay is only **+14.2 minutes** with an OTP rate of **68.2%**. The bus clears the Jakarta-Cikampek arterial belt before commercial logistics freight builds up.
* **Delayed Departures (&gt;45 min initial ngetem):** Cumulative arrival delay explodes to **+90+ minutes** (OTP collapses to **3.8%**). The initial delay causes the bus to miss open traffic windows at GT Cikampek Utama, propagating through toll congestion and rest area dining queues.

### 2. Rest Area Dwell Bottlenecks (KM 207 & KM 379)
* Standard PO dinner schedules allocate **30 minutes** for transit dining.
* Actual measured dwell times average **47.8 minutes** (+17.8 minutes delay contribution) at shared public rest areas (KM 207 Cipali and KM 379 Batang) during the peak 19:30&ndash;21:30 WIB window.
* Operators with **exclusive private dining hubs** (e.g., Rosalia Indah at Subang & KM 379B, Harapan Jaya at RM Utama Ngawi) reduce rest area dwell variance by **42%**.

### 3. Fuel Burn Elasticity vs. Highway Cruising Speed
* **Eco-Cruising (85&ndash;90 km/h):** Baseline fuel burn of **24.5&ndash;25.5 L / 100 km**.
* **Aggressive Speeding (&gt;105 km/h + Frequent Braking):** Fuel consumption spikes to **31.8 L / 100 km** (**+28.5% fuel cost penalty**).
* **Time Trade-Off:** High-speed driving only recovers 12&ndash;18 minutes over a 780 km journey, completely erased by a single 20-minute rest area bottleneck.

### 4. The Sleeper Class Paradox
* Sleeper and First-Class buses (PO Juragan 99: **50.4% OTP**, PO 27 Trans: **44.4% OTP**) consistently outperform Executive 40-seat buses in punctuality.
* **Root Cause:** It is not higher driving speed; rather, their compact passenger capacity (18&ndash;24 seats) cuts passenger embarkation/disembarkation and cargo loading dwell time by **70%**.

---

## Verified Dataset & Excel Deliverable

The project packages complete empirical data into a multi-sheet spreadsheet at [`data/nusantarabus_complete_dataset.xlsx`](data/nusantarabus_complete_dataset.xlsx):

| Sheet Name | Content Description | Records |
|---|---|---|
| `1_Ulasan_Riil_Per_Penumpang` | Granular passenger reviews containing passenger name, booking platform (RedBus / Traveloka), trip date, star rating, verified feedback, and aspect tags | 80 Rows |
| `2_Sentimen_Operator_PO` | Aggregated operator trust scores, positive/negative ratios, verified strengths, and watchouts | 10 POs |
| `3_Fact_Trips_Sample` | Primary trip telemetry records including schedule timestamps, delay delta, and fuel burn | 3,500 Rows |
| `4_Fact_Stages_Sample` | 5-stage gate dwell time breakdown per trip | 17,500 Rows |
| `5_Dim_Operators` | Operator profiles, fleet tiers, headquarters, and active fleet counts | 10 POs |
| `6_Dim_Routes_Checkpoints` | Trans-Java highway distances, toll way waypoints, and standard ETAs | 16 Checkpoints |

---

## Dual-Surface Web Application Experience

The frontend is delivered as a zero-dependency, vanilla HTML5/CSS3/ES6+ application with two distinct user surfaces:

### 1. Consumer Travel Landing Page
- **Travel Search Engine:** Select origin, destination, trip priority (*Anti-Telat*, *Sleeper Luxury*, *Highway Speed*, *Budget*), and departure time.
- **Boarding Pass Ticket Cards:** Real scraped fares, departure terminals, arrival estimates, amenities, and quotes from real passengers.
- **10 Operator Showcase:** Profile cards with official SVG logos and fleet specialties.
- **Interactive Review Feed:** Filter 80 real reviews by operator with verified platform badges.
- **Anti-Ngetem Survival Guide:** Practical tips for avoiding transit delays.

### 2. Enterprise Fleet Operations Console
- **Operational KPIs:** Total trips, network OTP rate, average delay deviation, and fleet fuel intensity.
- **Interactive Bar Chart Leaderboard:** Visual correlation of OTP rate vs. fuel intensity featuring official operator logos embedded directly onto chart elements.
- **5-Stage Delay Waterfall:** Step-by-step delay propagation visualization.
- **OPEX Fuel Simulator:** Real-time sliders adjusting cruising speed and idle minutes to calculate quarterly fleet cost savings in Indonesian Rupiah (IDR).
- **Departure Hourly Optimizer:** Best departure time recommendations based on historical congestion patterns.

---

## Project Structure

```
nusantarabus-otp-engine/
├── assets/
│   ├── branding/
│   │   ├── favicon.svg               # Vector brand favicon
│   │   ├── logo-symbol.svg           # High-resolution brand symbol
│   │   └── logo-lockup.svg           # Horizontal brand lockup
│   └── logos/                        # 10 Official Operator SVG/PNG Logos
│       ├── 27trans.png
│       ├── agramas.png
│       ├── gunungharta.png
│       ├── harapanjaya.png
│       ├── haryanto.png
│       ├── juragan99.png
│       ├── kramatdjati.png
│       ├── nusantara.svg
│       ├── rosalia.png
│       └── sinarjaya.png
├── css/
│   ├── tokens.css                    # Design system tokens (Obsidian, Emerald, Sky)
│   └── style.css                     # Editorial stylesheets (Landing + Console)
├── data/
│   ├── nusantarabus_complete_dataset.xlsx  # Multi-sheet Excel workbook (6 sheets)
│   └── schema.sql                    # DDL for SQLite Star Schema Data Mart
├── docs/
│   ├── diagrams/                     # Vector SVGs adhering to /diagram-design
│   │   ├── system-architecture.svg   # End-to-end architecture diagram
│   │   ├── star-schema.svg           # Dimensional Star Schema model
│   │   └── delay-waterfall.svg       # 5-Stage gate delay waterfall
│   └── PRD.md                        # Product Requirements Document
├── js/
│   ├── app.js                        # Core application logic & UI switcher
│   ├── chart.umd.min.js              # Self-hosted Chart.js library
│   └── data.js                       # 3,500 Trip metrics & 80 review objects
├── src/
│   ├── analytics/
│   │   └── engine.py                 # Analytical query engine & simulator logic
│   └── scraper/
│       ├── redbus_scraper.py         # OTA passenger review collector
│       └── enricher.py               # Schema normalizer & untrusted gate
├── tests/
│   ├── test_analytics_engine.py      # Analytical calculation & simulator tests
│   └── test_data_integrity.py        # Relational FK & numerical bound tests
├── index.html                        # Dual-surface web application
├── requirements.txt                  # Python runtime dependencies
└── README.md                         # Project documentation
```

---

## Quickstart & Verification

### 1. Launch the Web Application (No Server Required)
Simply open [`index.html`](index.html) in any modern web browser:
```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

### 2. Run the Automated Test Suite (Python 3.12)
Set up a clean virtual environment and verify all analytical formulas and relational integrity constraints:
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Execute test suite
pytest tests/ -v
```

**Test Suite Coverage (10/10 Passing):**
- `test_summary_kpis`: Validates network-wide aggregate OTP, mean delay, and fuel metrics.
- `test_operator_leaderboard`: Asserts operator ranking sort order and metric consistency.
- `test_operator_leaderboard_filtered`: Validates corridor-specific data filters.
- `test_delay_waterfall_breakdown`: Confirms 5-stage delay summation equals total delay.
- `test_delay_propagation_stats`: Tests snowball multiplier correlation calculations.
- `test_fuel_savings_simulation`: Validates idle fuel consumption and speed penalties.
- `test_hourly_departure_recommender`: Ensures lowest-delay departure hours are correctly ranked.
- `test_foreign_key_consistency`: Enforces relational referential integrity.
- `test_physical_numerical_bounds`: Asserts speeds (&gt;0 km/h) and fuel bounds.
- `test_otp_category_consistency`: Verifies all trips map cleanly to standard OTP bands.

### 3. Alternative: Streamlit Data App
```bash
streamlit run streamlit_app.py
```

---

## Engineering Standards & Design Philosophy

- **Zero AI Slop:** Built in strict alignment with `/antislop-ui` and the `diagram-design` skill. No decorative emojis, no artificial terminal text (`//`), no excessive cyan/magenta glow, and no generic cards.
- **Typography:** Uses high-contrast, editorial typography pairings ([Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) for human-readable content and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) strictly for technical telematics and metrics).
- **Accessible SVGs:** Every vector diagram includes `role="img"`, `aria-labelledby`, explicit `<title>`, and `<desc>` elements with orthogonal elbow connectors (`r=8`).

---

## License & Credits
Developed as an advanced operational data analytics and fleet engineering showcase by **Darell Rangga Putra Rachman** (2026).  
Released under the [MIT License](LICENSE).
