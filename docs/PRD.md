# Product Requirements Document (PRD)
## NusantaraBus: Intercity Bus On-Time Performance (OTP) & Fleet Efficiency Analytics

---

## 1. Executive Summary
**NusantaraBus OTP Engine** is a dedicated Data Analytics platform designed to solve operational delays, transit unpredictability, and fuel cost inefficiencies across Indonesia's intercity bus network (*Bus Antarkota Antarprovinsi - AKAP*), focusing on the high-density Trans-Java corridor (Jakarta – Semarang – Solo – Surabaya – Malang). 

By ingesting simulated telemetry and schedule-checkpoint data from leading operators (e.g., PO Sinar Jaya, Rosalia Indah, Harapan Jaya, PO Haryanto, Gunung Harta), the engine decomposes end-to-end trip cycles into distinct stage-gates, isolates root causes of delay, and quantifies fuel economy optimization opportunities.

---

## 2. Business Problem & Opportunity

### The Stakeholder Pain Points:
1. **Passengers:** Suffer from unannounced 1–3 hour delays, excessive "ngetem" (idling/waiting for passengers at informal agency stops), and lack of transparent operator reliability metrics.
2. **Perusahaan Otobus (PO) Management:** 
   * **Delay Churn:** Unreliable arrivals directly drive passengers toward train alternatives (KAI).
   * **Fuel Cost Inefficiency:** Fuel (Solar/Dexlite) accounts for **38%–45% of total operating expenditure (OPEX)**. Aggressive driving and prolonged engine idling at terminals erode operating margins by up to 18%.
3. **Transport Regulators (Kemenhub):** Lack empirical data to assess terminal congestion and highway toll gate bottlenecks.

---

## 3. Dimensional Data Architecture (Star Schema)

The analytical data mart is modeled in a clean **Star Schema** to ensure high-performance analytical queries and BI aggregations:

```
               +-------------------+
               |    dim_routes     |
               +-------------------+
                         |
                         | 1
                         |
+-------------------+    | N    +--------------------+
|   dim_operators   |----+-----|     fact_trips     |
+-------------------+    |      +--------------------+
                         |               | 1
                         |               |
               +-------------------+     | N
               |   dim_calendar    |     |
               +-------------------+     |
                         |               |
                         +---------------+
                                 |
                                 | 1
                                 |
                                 | N
                        +--------------------+
                        |  fact_trip_stages  |
                        +--------------------+
                                 | N
                                 |
                                 | 1
                        +--------------------+
                        |  dim_checkpoints   |
                        +--------------------+
```

### Table Definitions:
1. `dim_operators`: Operator ID, PO Name, Fleet Tier (Executive, Super Executive, Sleeper, Suite Class), Total Active Fleet.
2. `dim_routes`: Route ID, Origin City/Terminal, Destination City/Terminal, Highway KM, Arterial KM, Standard ETA (hours).
3. `dim_checkpoints`: Checkpoint ID, Name, Category (`ORIGIN_TERMINAL`, `SUB_AGENCY`, `TOLL_GATE`, `REST_AREA_DINING`, `TRANSIT_HUB`, `DEST_TERMINAL`), Location KM Mark.
4. `dim_calendar`: Date, Day of Week, Weekend Flag, Peak Season Flag (Lebaran, Nataru, Regular).
5. `fact_trips`: Trip ID, Date, Operator ID, Route ID, Bus Registration, Scheduled Departure, Actual Departure, Scheduled Arrival, Actual Arrival, Total Delay Minutes, Fuel Consumed (Liters), Total Distance (KM), Passenger Count, Seat Capacity, Gross Revenue (IDR).
6. `fact_trip_stages`: Stage ID, Trip ID, Checkpoint From ID, Checkpoint To ID, Stage Name (`TERMINAL_DWELL`, `ARTERIAL_TRANSIT`, `HIGHWAY_CRUISING`, `REST_AREA_STOP`, `DEST_TERMINAL_ARRIVAL`), Scheduled Duration (Min), Actual Duration (Min), Delay Delta (Min), Idle Time Minutes, Average Speed (KM/H).

---

## 4. Key Metrics & Analytical Formulations

### 4.1. On-Time Performance (OTP)
A trip is classified into one of four standard reliability bands:
$$\text{OTP Status} = \begin{cases} 
\text{Early / On-Time} & \text{if } \Delta_{\text{arrival}} \le 15 \text{ mins} \\
\text{Minor Delay} & \text{if } 15 < \Delta_{\text{arrival}} \le 45 \text{ mins} \\
\text{Moderate Delay} & \text{if } 45 < \Delta_{\text{arrival}} \le 90 \text{ mins} \\
\text{Severe Delay} & \text{if } \Delta_{\text{arrival}} > 90 \text{ mins}
\end{cases}$$

$$\text{OTP Rate (\%)} = \frac{\sum \text{Trips with } \Delta_{\text{arrival}} \le 15 \text{ mins}}{\text{Total Completed Trips}} \times 100\%$$

### 4.2. Delay Root Cause Attribution (Stage-Gate Decomposition)
$$\Delta_{\text{total}} = \Delta_{\text{origin\_terminal}} + \Delta_{\text{agency\_ngetem}} + \Delta_{\text{highway\_traffic}} + \Delta_{\text{rest\_area}} + \Delta_{\text{dest\_congestion}}$$

This isolates whether a 2-hour delay was caused by highway gridlock (external) or by 50 minutes of unnecessary terminal idling and agency boarding (internal operational failure).

### 4.3. Fuel Burn Elasticity & Eco-Driving Savings
$$\text{Fuel Intensity} = \frac{\text{Fuel Consumed (Liters)}}{\text{Distance (KM)}} \times 100 \quad [\text{L/100km}]$$

$$\text{Fuel Waste from Idling} = \text{Idling Hours} \times 2.8 \text{ Liters/hour}$$

Optimal cruising speed on Tol Trans-Jawa is evaluated against fuel consumption:
* **Eco-Cruising (80–90 km/h):** Baseline $\sim 24.5 \text{ L/100km}$.
* **Aggressive Speeding (>105 km/h + Frequent Braking):** Degrades to $\sim 31.8 \text{ L/100km}$ (+29.8% fuel cost increase with negligible arrival time gain).

---

## 5. Interactive Dashboard Specifications (Streamlit)
* **Tab 1: Fleet Executive Overview & OTP Leaderboard** (Filter by PO, Route, Date Range).
* **Tab 2: Delay Root-Cause & Stage-Gate Breakdown** (Waterfall chart isolating ngetem vs traffic vs rest area).
* **Tab 3: Fuel Economy & Eco-Driving Cost Simulator** (Estimated Monthly OPEX savings from reducing terminal idle and capping highway speed).
* **Tab 4: Passenger Smart Departure Recommender** (Heatmap showing the best departure hours to minimize delay on routes like Jakarta $\to$ Surabaya).
