# 🚌 NusantaraBus: Intercity Bus OTP & Fleet Intelligence Engine
*Real-World Intercity Bus On-Time Performance (OTP), Dwell-Time Bottleneck Diagnostics, and Fuel Efficiency Analytics across Indonesia's Trans-Java Highway Network.*

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Data%20Mart-Star%20Schema%20(SQLite)-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/Tests-10%2F10%20Passing-success.svg)]()
[![Sentiment Analytics](https://img.shields.io/badge/Sentiment-RedBus%20%26%20Traveloka-orange.svg)]()
[![Dashboard](https://img.shields.io/badge/UI-Dark%20Minimalism-black.svg)]()
[![GitHub Repo](https://img.shields.io/badge/GitHub-Rangga11268%2Fnusantarabus--otp--engine-181717.svg?logo=github)](https://github.com/Rangga11268/nusantarabus-otp-engine)

---

## 📌 Executive Summary
**NusantaraBus OTP Engine** adalah platform analitik operasional data transportasi darat yang dirancang khusus untuk membedah keterlambatan bus antarkota (*Bus Antarkota Antarprovinsi - AKAP*) di Indonesia, khususnya di koridor utama Tol Trans-Jawa (**Jakarta – Semarang – Solo – Surabaya – Malang**).

Berbeda dari proyek AI/ML murni yang sering kali berupa *black-box model*, proyek ini mendemonstrasikan keahlian inti **Data Analyst & Analytics Engineer**:
1. **Real-World Scraper Agent Pipeline:** Mengadopsi arsitektur 3-tier dari `affaan-m/ECC/skills/data-scraper-agent` (*Collect $\to$ Enrich $\to$ Store*) untuk mengumpulkan jadwal riil, kelas armada, harga tiket, serta ulasan sentimen penumpang publik (redBus ID & Traveloka) dengan batasan *untrusted data boundary*.
2. **Dimensional Data Modeling (Star Schema):** Mengintegrasikan data jadwal riil dengan metrik jarak Tol Trans-Jawa, ulasan sentimen penumpang (`dim_operator_sentiment`), dan titik kontrol (*checkpoints*) ke dalam tabel fakta dan dimensi yang teroptimasi kueri analitik.
3. **Stage-Gate Dwell-Time Attribution:** Mengurai perjalanan menjadi 5 etape untuk membuktikan bahwa **ngetem di terminal/agen awal** dan **waktu makan rest area** berkontribusi lebih besar terhadap keterlambatan daripada kemacetan tol murni.
4. **Passenger Trust & Sentiment Intelligence:** Menggabungkan skor OTP murni dengan metrik kepuasan penumpang (rating kepuasan, rasio sentimen positif, breakdown aspek kenyamanan/kebersihan/pelayanan/makanan, kelebihan, pertimbangan, dan kutipan riil penumpang) agar calon penumpang mendapatkan rekomendasi bus yang tidak hanya tepat waktu namun juga nyaman.
5. **Simulator Penghematan Biaya Bahan Bakar (Solar OPEX):** Menghitung potensi penghematan solar (Rp puluhan juta per kuartal) dengan pembatasan kecepatan 90 km/jam (*Eco-Cruising*) dan pengurangan waktu idle mesin.
6. **Executive Web Console (Dark Minimalism):** Dasbor web tanpa framework (*zero-build vanilla HTML5/CSS3/ES6+*) dengan filosofi desain modern berstandar anti-slop, logo PO asli pada chart bar, dan visualisasi interaktif Chart.js.

---

## 🏗️ Arsitektur Star Schema Data Mart

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

### Tabel Utama:
* `fact_trips` (3.500 baris): Mencatat seluruh metrik perjalanan: waktu berangkat/tiba terjadwal vs aktual, status OTP, jarak, solar terbakar, kecepatan rata-rata, durasi idle, jumlah penumpang, dan pendapatan kotor.
* `fact_trip_stages` (17.500 baris): Dekomposisi 5 tahap perjalanan per trip:
  1. `ORIGIN_DWELL_NGETEM`: Waktu ngetem di terminal dan penaikan penumpang di agen.
  2. `ARTERIAL_CITY_TRANSIT`: Jalur arteri Jabodetabek/Bekasi menuju gerbang tol.
  3. `HIGHWAY_CRUISING`: Kecepatan jelajah di Tol Trans-Jawa.
  4. `REST_AREA_DINING`: Waktu istirahat makan malam / sholat di rumah makan PO.
  5. `DEST_TERMINAL_ARRIVAL`: Proses penurunan penumpang di terminal tujuan.
* `dim_operators`: Profil 10 PO terkemuka (PO Sinar Jaya, Rosalia Indah, Harapan Jaya, Haryanto, Gunung Harta, 27 Trans, Kramat Djati, Agra Mas, Nusantara, Juragan 99).
* `dim_routes`: Rute Jakarta–Surabaya, Jakarta–Solo, Jakarta–Semarang, Jakarta–Malang.
* `dim_checkpoints`: Titik kontrol terminal, agen, gerbang tol, dan rest area.
* `dim_calendar`: Hari kerja biasa, akhir pekan, dan puncak arus mudik/liburan.

---

## 📈 Temuan Kunci Analisis Data (Key Analytical Insights)

### 1. Peringkat Ketepatan Waktu (OTP)
* Operator dengan armada *Sleeper Suite* dan *First Class* (PO Juragan 99: **50.4% OTP**, PO 27 Trans: **44.4% OTP**) memiliki ketepatan waktu jauh lebih tinggi daripada kelas eksekutif standar.
* **Akar Masalah:** Bus kelas atas menerapkan sistem keberangkatan *point-to-point* tanpa ngetem di agen-agen kecil, sedangkan bus eksekutif reguler sering ngetem 30–50 menit untuk mengejar keterisian kursi.

### 2. Efek Bola Salju Keterlambatan (*The Snowball Multiplier of Ngetem*)
* Keterlambatan berangkat $\le 5$ menit menghasilkan rata-rata delay di kota tujuan hanya **14.2 menit** (OTP 68.2%).
* Namun, keterlambatan berangkat $>45$ menit berlipat ganda menjadi **90+ menit delay** saat tiba di tujuan (OTP anjlok ke **3.8%**). Bus kehilangan momentum jendela lalu lintas lancar di Tol Cikampek dan Cikopo-Palimanan.

### 3. Elastisitas Bahan Bakar & Kecepatan Jelajah
* Bus yang melaju dengan kecepatan *Eco-Cruising* stabil (85–90 km/jam) mengonsumsi **24.5–25.5 Liter/100km**.
* Bus dengan gaya nyetir agresif (>100 km/jam + pengereman mendadak) menghabiskan **31.5 Liter/100km** (**+28.5% lebih boros solar**), namun hanya mempercepat waktu tiba sebesar 15–20 menit.

---

## 🚀 Panduan Menjalankan Proyek

### 1. Menjalankan Dashboard Web Langsung (Pure HTML/CSS/JS)
Tidak memerlukan instalasi server atau dependensi Python apa pun:
* Cukup buka file [`index.html`](file:///D:/Ngoding/AI_ML_Projects/nusantarabus-otp-engine/index.html) langsung di browser apa pun (Chrome, Edge, Firefox, Safari).
* Sepenuhnya interaktif (*client-side*): filter rute, leaderboard OTP, grafik tahapan delay, simulator penghematan solar dengan slider dinamis, dan rekomendasi jam berangkat.

### 2. Prasyarat & Menjalankan Analisis Data (Python & Data Mart)
```powershell
cd D:\Ngoding\AI_ML_Projects\nusantarabus-otp-engine
pip install -r requirements.txt
```

### 3. Menjalankan Scraper & Pembaruan Data
```powershell
python src/scraper/redbus_scraper.py
python src/scraper/enricher.py
```

### 4. Menjalankan Pengujian Otomatis
```powershell
pytest tests/ -v
```
*(Seluruh 10/10 tes validasi integritas relasional dan perhitungan analitik terverifikasi lolos).*

### 5. Alternatif: Menjalankan Versi Streamlit
```powershell
streamlit run streamlit_app.py
```

---

## 🏛️ Lisensi & Kepemilikan
Proyek portofolio rekayasa data oleh **Darell Rangga Putra Rachman** (2026).
Dirancang untuk demonstrasi kompetensi teknis Data Analyst & Analytics Engineer kelas industri.
