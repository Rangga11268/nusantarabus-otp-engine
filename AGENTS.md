# NusantaraBus OTP & Fleet Analytics Engine — Agent Guide

## Overview
**NusantaraBus OTP Engine** (`nusantarabus-otp-engine/`) is an enterprise-grade Data Analytics & Business Intelligence system modeling Intercity Bus (*Bus Antarkota Antarprovinsi - AKAP*) On-Time Performance (OTP), Trip Stage Dwell-Time Bottlenecks, and Fleet Fuel Consumption across Indonesia's Trans-Java Highway Network.

## Engineering Standards
* **Python Runtime:** Python 3.12+ virtual environment.
* **Core Libraries:** Polars, DuckDB / SQLite, Pandas, NumPy, SciPy, Streamlit, Plotly, Pytest.
* **Data Modeling:** Dimensional Star Schema (`fact_trips`, `fact_trip_stages`, `dim_routes`, `dim_operators`, `dim_checkpoints`).
* **Analytical Focus:**
  * Strict On-Time Performance (OTP) categorization with standard tolerance ($\le 15$ min buffer).
  * Stage-gate dwell-time attribution (Moving vs Terminal Dwell vs Rest Area Dining vs Highway Congestion).
  * Fuel economy elasticity (L/100km vs cruising speed & stop-and-go acceleration).
  * Departure time optimization heatmap for passenger decision-making.
* **Testing:** 100% automated test coverage for analytical calculations and SQL transformations via `pytest`.
