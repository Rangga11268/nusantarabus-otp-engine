"""
NusantaraBus OTP & Fleet Intelligence Dashboard
Executive Data Analytics platform for Intercity Buses (AKAP) across the Trans-Java Corridor.
Built for Perusahaan Otobus (PO) operators and public commuters.
"""

import os
import sys
import pandas as pd
import altair as alt
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from src.analytics_engine import NusantaraBusAnalytics, DB_PATH

# Page Config
st.set_page_config(
    page_title="NusantaraBus | Intercity Bus OTP & Fleet Intelligence",
    page_icon="🚌",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
<style>
    .metric-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .metric-value {
        font-size: 26px;
        font-weight: 700;
        color: #0F172A;
    }
    .metric-label {
        font-size: 13px;
        color: #64748B;
        font-weight: 500;
        margin-top: 4px;
    }
    .badge-ontime {
        background-color: #DCFCE7;
        color: #166534;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .badge-delay {
        background-color: #FEE2E2;
        color: #991B1B;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

@st.cache_resource
def get_engine():
    return NusantaraBusAnalytics(DB_PATH)

engine = get_engine()

# Sidebar Filters
st.sidebar.title("🚌 NusantaraBus Analytics")
st.sidebar.markdown("**Koridor Tol Trans-Jawa**  \n*Jakarta – Semarang – Solo – Surabaya – Malang*")
st.sidebar.divider()

route_options = {
    "ALL": "Semua Rute Trans-Jawa",
    "JKT-SBY": "Jakarta → Surabaya (785 km)",
    "JKT-SLO": "Jakarta → Solo (540 km)",
    "JKT-SMG": "Jakarta → Semarang (440 km)",
    "JKT-MLG": "Jakarta → Malang (850 km)",
}
selected_route = st.sidebar.selectbox("Pilih Rute:", options=list(route_options.keys()), format_func=lambda x: route_options[x])

season_options = {
    "ALL": "Semua Musim Operasional",
    "REGULAR": "Hari Kerja Biasa (Regular)",
    "WEEKEND_PEAK": "Akhir Pekan (Jumat-Minggu)",
    "LEBARAN_MUDIK": "Puncak Mudik & Libur Nasional",
}
selected_season = st.sidebar.selectbox("Filter Musim:", options=list(season_options.keys()), format_func=lambda x: season_options[x])

st.sidebar.markdown("---")
st.sidebar.caption("Data Mart: SQLite Star Schema • 3,500 Trips • 17,500 Stages • Benchmark: Tol Trans-Jawa 2026")

# Header
st.title("🚌 NusantaraBus: Intercity Bus OTP & Fleet Intelligence Engine")
st.markdown(
    "Platform analitik operasional terintegrasi untuk mendiagnosis keterlambatan (*On-Time Performance*), "
    "mengisolasi waktu ngetem (*dwell-time bottleneck*), dan mengoptimalkan biaya solar bus AKAP."
)

# Top KPI Summary Cards
kpis = engine.get_summary_kpis()
c1, c2, c3, c4, c5 = st.columns(5)

with c1:
    st.metric("Total Perjalanan", f"{kpis['total_trips']:,} trips")
with c2:
    st.metric("Overall OTP Rate", f"{kpis['overall_otp_pct']}%", delta="Toleransi <=15 mnt", delta_color="normal")
with c3:
    st.metric("Rerata Delay Kedatangan", f"{kpis['mean_arrival_delay_min']} mnt")
with c4:
    st.metric("Konsumsi Solar", f"{kpis['mean_fuel_intensity_l_100km']} L/100km")
with c5:
    rev_miliar = round(kpis['total_revenue_idr'] / 1e9, 2)
    st.metric("Estimasi Pendapatan", f"Rp {rev_miliar} Miliar")

st.markdown("---")

# Main Navigation Tabs
tab1, tab2, tab3, tab4 = st.tabs([
    "🏆 1. Leaderboard OTP Operator",
    "⏱️ 2. Dwell-Time & Bottleneck Keterlambatan",
    "⛽ 3. Simulator Penghematan Solar (OPEX)",
    "🧭 4. Rekomendasi Jam Berangkat Penumpang"
])

# ----------------------------------------------------------------------------
# TAB 1: OPERATOR LEADERBOARD & RELIABILITY
# ----------------------------------------------------------------------------
with tab1:
    st.subheader("Leaderboard On-Time Performance (OTP) Perusahaan Otobus (PO)")
    st.markdown("Peringkat ketepatan waktu kedatangan bus antarkota dengan standar industri (tiba maksimal $\le 15$ menit dari jadwal).")

    leaderboard = engine.get_operator_leaderboard(route_id=selected_route, season_type=selected_season)
    df_lb = pd.DataFrame(leaderboard)

    if not df_lb.empty:
        # Display Leaderboard Chart
        chart_df = df_lb[["po_name", "otp_pct", "minor_delay_pct", "moderate_delay_pct", "severe_delay_pct"]].copy()
        chart_df = chart_df.rename(columns={
            "otp_pct": "Tepat Waktu (<=15 m)",
            "minor_delay_pct": "Delay Ringan (16-45 m)",
            "moderate_delay_pct": "Delay Sedang (46-90 m)",
            "severe_delay_pct": "Delay Parah (>90 m)"
        })
        chart_melted = chart_df.melt(id_vars=["po_name"], var_name="Kategori Keterlambatan", value_name="Persentase")

        chart = alt.Chart(chart_melted).mark_bar().encode(
            x=alt.X("Persentase:Q", stack="normalize", title="Distribusi Status Kedatangan"),
            y=alt.Y("po_name:N", sort="-x", title="Perusahaan Otobus (PO)"),
            color=alt.Color("Kategori Keterlambatan:N", scale=alt.Scale(
                domain=["Tepat Waktu (<=15 m)", "Delay Ringan (16-45 m)", "Delay Sedang (46-90 m)", "Delay Parah (>90 m)"],
                range=["#16A34A", "#FBBF24", "#F97316", "#DC2626"]
            )),
            tooltip=["po_name", "Kategori Keterlambatan", alt.Tooltip("Persentase:Q", format=".1f")]
        ).properties(height=350)

        st.altair_chart(chart, use_container_width=True)

        # Formatted Data Table
        st.markdown("#### Detail Metrik Reliabilitas per Operator")
        table_df = df_lb[[
            "rank", "po_name", "service_class", "total_trips", "otp_pct", "mean_delay_min", "severe_delay_pct", "mean_fuel_intensity", "mean_speed_kmh"
        ]].copy()
        table_df.columns = [
            "Peringkat", "Nama PO", "Kelas Layanan", "Total Trip", "OTP Rate (%)", "Rata-rata Delay (mnt)", "Delay Parah (%)", "Konsumsi Solar (L/100km)", "Kecepatan (km/h)"
        ]
        st.dataframe(table_df, use_container_width=True, hide_index=True)

        st.info(
            "💡 **Insight Analis:** Operator dengan armada *Sleeper Suite* dan *First Class* (seperti PO Juragan 99, 27 Trans, dan PO Gunung Harta) "
            "menempati peringkat OTP tertinggi karena tidak banyak menaikkan penumpang di agen-agen liar (*point-to-point departure*), "
            "sedangkan bus eksekutif reguler sering terhambat 30–50 menit akibat ngetem di agen sepanjang jalur arteri."
        )

# ----------------------------------------------------------------------------
# TAB 2: DWELL-TIME & BOTTLENECK WATERFALL
# ----------------------------------------------------------------------------
with tab2:
    st.subheader("Dekomposisi Tahapan Keterlambatan (Stage-Gate Bottleneck)")
    st.markdown("Mengurai perjalanan bus menjadi 5 etape untuk mengisolasi di mana waktu perjalanan paling banyak terbuang.")

    waterfall = engine.get_delay_waterfall_breakdown(route_id=selected_route)
    df_wf = pd.DataFrame(waterfall)

    if not df_wf.empty:
        col_wf1, col_wf2 = st.columns([3, 2])

        with col_wf1:
            wf_chart = alt.Chart(df_wf).mark_bar().encode(
                x=alt.X("avg_delay_added_min:Q", title="Rata-rata Keterlambatan Tambahan (Menit)"),
                y=alt.Y("stage_name:N", sort=None, title="Tahapan Perjalanan"),
                color=alt.Color("avg_delay_added_min:Q", scale=alt.Scale(scheme="redoranges")),
                tooltip=["stage_name", "avg_scheduled_min", "avg_actual_min", "avg_delay_added_min", "pct_share_of_total_delay"]
            ).properties(height=280)
            st.altair_chart(wf_chart, use_container_width=True)

        with col_wf2:
            st.markdown("#### Proporsi Penyumbang Keterlambatan")
            for item in waterfall:
                st.markdown(
                    f"**{item['stage_name']}**:  \n"
                    f"Rata-rata delay: **+{item['avg_delay_added_min']} mnt** ({item['pct_share_of_total_delay']}% dari total delay)"
                )

        st.markdown("---")
        st.subheader("Analisis Propagasi Keterlambatan (*The Snowball Effect of Ngetem*)")
        st.markdown("Apakah telat berangkat 20 menit di terminal awal berdampak linier, atau justru berlipat ganda saat tiba di tujuan?")

        propagation = engine.get_delay_propagation_stats()
        df_prop = pd.DataFrame(propagation)
        df_prop.columns = ["Kelompok Keterlambatan Berangkat", "Jumlah Trip", "Rata-rata Delay Berangkat", "Rata-rata Delay Tiba (Tujuan)", "Keterlambatan Bersih Tambahan", "Peluang OTP (%)"]
        st.dataframe(df_prop, use_container_width=True, hide_index=True)

        st.warning(
            "⚠️ **Temuan Utama Analis:** Keterlambatan ngetem di awal (>45 menit) memiliki efek *multiplier*: "
            "Bus kehilangan momentum jendela lalu lintas lancar di Tol Cikampek dan Cikopo-Palimanan, sehingga tiba di kota tujuan "
            "dengan keterlambatan rata-rata **90+ menit** dan tingkat ketepatan waktu anjlok hingga di bawah **4%**!"
        )

# ----------------------------------------------------------------------------
# TAB 3: FUEL ECONOMY & COST SIMULATOR
# ----------------------------------------------------------------------------
with tab3:
    st.subheader("Simulator Efisiensi Biaya Bahan Bakar (Solar Industri) & Emisi")
    st.markdown("Menganalisis dampak finansial dari pembatasan kecepatan (*speed limiter*) dan pengurangan waktu idle mesin di terminal.")

    sim_col1, sim_col2 = st.columns([1, 2])

    with sim_col1:
        st.markdown("#### Parameter Kebijakan Armada")
        speed_cap = st.slider("Batas Kecepatan Maksimal di Tol (km/jam):", min_value=80.0, max_value=105.0, value=90.0, step=5.0)
        idle_cut = st.slider("Target Pengurangan Waktu Idle / Ngetem (%):", min_value=0, max_value=80, value=50, step=10)

        st.caption("Asumsi Harga Solar: Rp 13.500 / Liter (Standar Solar Industri / Dexlite)")

    sim_result = engine.simulate_fuel_savings(speed_limiter_kmh=speed_cap, idle_reduction_pct=idle_cut)

    with sim_col2:
        st.markdown("#### Hasil Simulasi Efisiensi Biaya")
        r1, r2, r3 = st.columns(3)
        with r1:
            st.metric("Penghematan Solar", f"{sim_result['total_liters_saved']:,} Liter", f"{sim_result['pct_fuel_saved']}% dari baseline")
        with r2:
            savings_juta = round(sim_result['monthly_cost_saved_idr'] / 1e6, 1)
            st.metric("Biaya Dihemat", f"Rp {savings_juta:,} Juta", "per kuartal")
        with r3:
            co2_tons = round((sim_result['total_liters_saved'] * 2.68) / 1000.0, 1) # 2.68 kg CO2 per liter diesel
            st.metric("Reduksi Emisi CO2", f"{co2_tons} Ton", "Dampak Ramah Lingkungan")

        st.markdown("---")
        st.markdown(
            f"* **Bahan Bakar Dihemat dari Pengurangan Idle:** `{sim_result['fuel_saved_from_idle_liters']:,} Liter` (mesin menyala saat ngetem membuang ~2.8 Liter/jam).  \n"
            f"* **Bahan Bakar Dihemat dari Speed Limiter 90 km/h:** `{sim_result['fuel_saved_from_speed_cap_liters']:,} Liter` (mengebut >100 km/jam membakar 29.8% solar lebih boros)."
        )

# ----------------------------------------------------------------------------
# TAB 4: SMART PASSENGER RECOMMENDER
# ----------------------------------------------------------------------------
with tab4:
    st.subheader("Panduan Jam Keberangkatan Terbaik untuk Penumpang")
    st.markdown("Membantu calon penumpang memilih jam keberangkatan bus dari Jakarta yang paling minim keterlambatan.")

    dest_filter = st.selectbox("Pilih Kota Tujuan Anda:", ["Surabaya", "Solo", "Semarang", "Malang"])
    route_map = {"Surabaya": "JKT-SBY", "Solo": "JKT-SLO", "Semarang": "JKT-SMG", "Malang": "JKT-MLG"}

    hourly_data = engine.get_hourly_departure_recommender(route_id=route_map[dest_filter])
    df_hour = pd.DataFrame(hourly_data)

    if not df_hour.empty:
        h_chart = alt.Chart(df_hour).mark_line(point=True).encode(
            x=alt.X("hour:N", title="Jam Keberangkatan Terjadwal"),
            y=alt.Y("mean_delay_min:Q", title="Rata-rata Menit Keterlambatan"),
            color=alt.value("#0284C7"),
            tooltip=["hour", "trip_count", "mean_delay_min", "otp_rate", "mean_duration_hours"]
        ).properties(height=320)

        st.altair_chart(h_chart, use_container_width=True)

        best_hour = min(hourly_data, key=lambda x: x["mean_delay_min"])
        worst_hour = max(hourly_data, key=lambda x: x["mean_delay_min"])

        st.success(
            f"✅ **Waktu Keberangkatan Terbaik:** Jam **{best_hour['hour']}** "
            f"(Peluang tepat waktu {best_hour['otp_rate']}%, rerata delay hanya {best_hour['mean_delay_min']} menit)."
        )
        st.error(
            f"❌ **Waktu Keberangkatan Paling Berisiko Macet:** Jam **{worst_hour['hour']}** "
            f"(Rerata delay membengkak hingga **{worst_hour['mean_delay_min']} menit** akibat jam sibuk sore Tol Cikampek)."
        )
