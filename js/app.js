/**
 * NusantaraBus Operations Console Application Engine
 * Pure vanilla JavaScript + Local Vendor Chart.js
 * Standard: Anti-Slop UI / Hallmark / Ponytail
 */

"use strict";

(function () {
  // Guard against missing data module
  if (!window.NUSANTARABUS_DATA) {
    console.error("[NusantaraBus] Critical Error: NUSANTARABUS_DATA not loaded.");
    return;
  }

  const DATA = window.NUSANTARABUS_DATA;
  const DATA_FRESHNESS = {
    scheduleSnapshot: "25 Okt 2026, 16:34 WIB",
    sourceLabel: "RedBus ID & verifikasi operator",
    bookingStatus: "Belum terhubung ke inventori booking live",
  };

  // Chart Instances Registry
  const charts = {
    leaderboard: null,
    waterfall: null,
    fuel: null,
    hourly: null,
  };

  // Application State
  const state = {
    activeTab: "passenger",
    activeCorridor: "all",
    activeDest: "SBY",
    passengerRoute: "sby",
    passengerPriority: "ontime",
    passengerTime: "evening",
  };

  // Corridor route labels and filter mapping
  const CORRIDORS = {
    all: { key: "leaderboard_all", label: "Seluruh Koridor Trans-Jawa" },
    sby: { key: "leaderboard_sby", label: "Jakarta - Surabaya (782 km)" },
    slo: { key: "leaderboard_slo", label: "Jakarta - Solo (540 km)" },
    smg: { key: "leaderboard_smg", label: "Jakarta - Semarang (440 km)" },
    mlg: { key: "leaderboard_mlg", label: "Jakarta - Malang (850 km)" },
  };

  // Setup Global Chart.js Defaults if loaded
  if (window.Chart) {
    Chart.defaults.color = "#94a3b8"; // Slate 400
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 11;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.tooltip.backgroundColor = "#161820";
    Chart.defaults.plugins.tooltip.borderColor = "rgba(255, 255, 255, 0.12)";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = "#ffffff";
    Chart.defaults.plugins.tooltip.bodyColor = "#94a3b8";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
  }

  // Official Real Logo Mapping & Image Preloader
  const LOGO_MAP = {
    "PO Juragan 99": "assets/logos/juragan99.png",
    "PO 27 Trans": "assets/logos/27trans.png",
    "PO Gunung Harta": "assets/logos/gunungharta.png",
    "PO Rosalia Indah": "assets/logos/rosalia.png",
    "PO Kramat Djati": "assets/logos/kramatdjati.png",
    "PO Haryanto": "assets/logos/haryanto.png",
    "PO Sinar Jaya": "assets/logos/sinarjaya.png",
    "PO Agra Mas": "assets/logos/agramas.png",
    "PO Harapan Jaya": "assets/logos/harapanjaya.png",
    "PO Nusantara": "assets/logos/nusantara.svg",
  };

  // Scraped Real Passenger Pricing & Experience Intelligence
  const OPERATOR_META = {
    "PO Juragan 99": {
      fare_range: "Rp 530.000 – Rp 635.000",
      perks: ["Private Sleeper Pod", "Toilet Bersih Harum", "Makan Mewah & Snack", "Point-to-Point Anti-Ngetem"],
      passenger_verdict: "Pilihan terbaik jika Anda ingin tidur nyenyak seperti di hotel berjalan dan tiba pagi di terminal tujuan dalam kondisi bugar tanpa drama transit agen."
    },
    "PO 27 Trans": {
      fare_range: "Rp 450.000 – Rp 520.000",
      perks: ["Air Suspension Empuk", "President Sleeper", "Servis Makan Malam", "Driver Santun & Halus"],
      passenger_verdict: "Sangat direkomendasikan untuk rute Malang & Surabaya bagi pelancong yang memprioritaskan kenyamanan suspensi udara dan ketenangan kabin malam."
    },
    "PO Gunung Harta": {
      fare_range: "Rp 390.000 – Rp 520.000",
      perks: ["Sasis Scania/Volvo", "Prasmanan Nyaman", "Safety-First Driver", "Kabin Double Decker Luas"],
      passenger_verdict: "Karakter driver sangat tenang dan taat marka jalan. Perawatan sasis Eropa premium membuat perjalanan jauh tidak terasa melelahkan."
    },
    "PO Rosalia Indah": {
      fare_range: "Rp 380.000 – Rp 550.000",
      perks: ["Pramugara & Pramugari Aktif", "Resto Rosin Buffet", "Banyak Pilihan Kelas", "Jaringan Agen Luas"],
      passenger_verdict: "Standar fasilitas paling konsisten dengan keunggulan rumah makan eksklusif Resto Rosin dan pramugari yang siap membantu bagasi Anda."
    },
    "PO Sinar Jaya": {
      fare_range: "Rp 275.000 – Rp 420.000",
      perks: ["Tarif Paling Ekonomis", "Jadwal Sangat Padat", "Disiplin Jam Berangkat", "Armada Melimpah"],
      passenger_verdict: "Pilihan nomor satu untuk perjalanan hemat! Sangat pas untuk rombongan keluarga atau perjalanan dinas rutin dengan kepastian jam keberangkatan awal."
    },
    "PO Harapan Jaya": {
      fare_range: "Rp 330.000 – Rp 480.000",
      perks: ["Legrest Reclining Ergonomis", "Ruang Kaki Luas", "Makanan Enak", "AC Dingin Sejuk"],
      passenger_verdict: "PO legendaris kepercayaan warga Jawa Timur & Solo Raya dengan kursi yang lapang dan servis makan malam yang berkualitas."
    },
    "PO Haryanto": {
      fare_range: "Rp 320.000 – Rp 380.000",
      perks: ["Laju Cepat di Jalan Tol", "Singgah Sholat Teratur", "Kopi Hangat Gratis", "Kru Komunikatif"],
      passenger_verdict: "Cocok untuk penumpang yang mengejar kecepatan waktu tempuh dengan waktu istirahat ibadah yang terjamin di rest area."
    },
    "PO Agra Mas": {
      fare_range: "Rp 310.000 – Rp 440.000",
      perks: ["Titik Naik Banyak di Jabodetabek", "Kabin Modern", "Snack Box Lengkap", "Full Tol Trans-Jawa"],
      passenger_verdict: "Paling praktis diakses bagi warga Bodetabek (Bogor, Depok, Tangerang, Bekasi) tanpa harus jauh-jauh ke terminal pusat."
    },
    "PO Kramat Djati": {
      fare_range: "Rp 280.000 – Rp 350.000",
      perks: ["Harga Bersahabat", "Cruising Cepat", "Jadwal Fleksibel", "Bagasi Luas"],
      passenger_verdict: "Alternatif ramah kantong bagi yang menginginkan perjalanan simpel dan waktu tempuh langsung via tol."
    },
    "PO Nusantara": {
      fare_range: "Rp 300.000 – Rp 420.000",
      perks: ["Sasis Mercedes-Benz Halus", "Kabin Tenang", "Kursi Empuk", "Kru Senior Berpengalaman"],
      passenger_verdict: "Pelopor bus eksekutif jalur Pantura-Semarang-Kudus yang terkenal dengan kestabilan mesin Eropa dan kenyamanan berkendara."
    }
  };

  const logoImageCache = {};
  Object.keys(LOGO_MAP).forEach((name) => {
    const src = LOGO_MAP[name];
    const img = new Image();
    img.src = src;
    logoImageCache[src] = img;
  });

  function getLogoImage(poName) {
    const fullName = poName.startsWith("PO ") ? poName : "PO " + poName;
    const src = LOGO_MAP[fullName] || LOGO_MAP[poName];
    if (!src) return null;
    if (!logoImageCache[src]) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (charts.leaderboard) charts.leaderboard.draw();
      };
      logoImageCache[src] = img;
    }
    return logoImageCache[src];
  }

  /**
   * Helper: Format number with thousands separator
   */
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "-";
    return Number(num).toLocaleString("id-ID");
  }

  /**
   * Helper: Get status class and text for OTP %
   */
  function getOtpStatus(otp) {
    if (otp >= 40) return { className: "ontime", text: "UNGGUL" };
    if (otp >= 20) return { className: "minor", text: "MODERAT" };
    return { className: "severe", text: "KRITIS" };
  }

  /**
   * Update KPI Summary Cards based on corridor filter
   */
  function updateKPIs(corridorKey) {
    const list = DATA[CORRIDORS[corridorKey].key] || DATA.leaderboard_all;

    let totalTrips = 0;
    let weightedOtpSum = 0;
    let weightedDelaySum = 0;
    let weightedFuelSum = 0;

    list.forEach((item) => {
      totalTrips += item.total_trips;
      weightedOtpSum += item.otp_pct * item.total_trips;
      weightedDelaySum += item.mean_delay_min * item.total_trips;
      weightedFuelSum += item.mean_fuel_intensity * item.total_trips;
    });

    const avgOtp = totalTrips > 0 ? (weightedOtpSum / totalTrips).toFixed(1) : DATA.kpis.overall_otp_pct;
    const avgDelay = totalTrips > 0 ? (weightedDelaySum / totalTrips).toFixed(1) : DATA.kpis.mean_arrival_delay_min;
    const avgFuel = totalTrips > 0 ? (weightedFuelSum / totalTrips).toFixed(2) : DATA.kpis.mean_fuel_intensity_l_100km;

    const elTrips = document.getElementById("kpiTotalTrips");
    const elOtp = document.getElementById("kpiOtpPct");
    const elDelay = document.getElementById("kpiMeanDelay");
    const elFuel = document.getElementById("kpiFuelIntensity");

    if (elTrips) elTrips.textContent = formatNumber(totalTrips);
    if (elOtp) elOtp.textContent = `${avgOtp}%`;
    if (elDelay) elDelay.textContent = `+${avgDelay}`;
    if (elFuel) elFuel.textContent = avgFuel;
  }

  /**
   * Render Leaderboard Table & Chart
   */
  function renderLeaderboard(corridorKey) {
    const list = DATA[CORRIDORS[corridorKey].key] || DATA.leaderboard_all;
    const tbody = document.getElementById("leaderboardTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    list.forEach((op, idx) => {
      const tr = document.createElement("tr");
      const status = getOtpStatus(op.otp_pct);
      const logoPath = LOGO_MAP[op.po_name] || "assets/logos/rosalia.png";

      tr.innerHTML = `
        <td class="font-mono text-dim" style="font-weight: 700;">#${idx + 1}</td>
        <td>
          <div class="operator-cell">
            <div class="operator-logo-wrap" title="${op.po_name}">
              <img src="${logoPath}" alt="${op.po_name} Logo" class="operator-logo-img" width="42" height="28">
            </div>
            <div class="operator-info">
              <span class="operator-name">${op.po_name}</span>
              <span class="operator-class">${op.service_class}</span>
            </div>
          </div>
        </td>
        <td class="font-mono">${formatNumber(op.total_trips)}</td>
        <td>
          <div class="distribution-bar" title="Tepat Waktu: ${op.otp_pct}%, Minor: ${op.minor_delay_pct}%, Moderat: ${op.moderate_delay_pct}%, Kritis: ${op.severe_delay_pct}%">
            <div class="bar-segment ontime" style="width: ${op.otp_pct}%;"></div>
            <div class="bar-segment minor" style="width: ${op.minor_delay_pct}%;"></div>
            <div class="bar-segment moderate" style="width: ${op.moderate_delay_pct}%;"></div>
            <div class="bar-segment severe" style="width: ${op.severe_delay_pct}%;"></div>
          </div>
        </td>
        <td>
          <span class="status-pill ${status.className}">
            <span class="font-mono">${op.otp_pct}%</span>
          </span>
        </td>
        <td class="font-mono">+${op.mean_delay_min.toFixed(1)} mnt</td>
        <td class="font-mono text-severe">${op.severe_delay_pct}%</td>
        <td class="font-mono text-muted">${op.mean_speed_kmh.toFixed(1)} km/h</td>
        <td>
          <span class="status-pill ${status.className}">
            <span>${status.text}</span>
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderLeaderboardChart(list);
  }

  /**
   * Chart 1: Operator Punctuality & Delay Distribution Chart
   * 100% Stacked Bar comparing the 4 delay categories (On-time, Minor, Moderate, Severe)
   * with secondary line axis for Average Delay Deviation (Minutes).
   */
  function renderLeaderboardChart(list) {
    if (!window.Chart) return;
    const canvas = document.getElementById("chartLeaderboardTradeoff");
    if (!canvas) return;

    if (charts.leaderboard) {
      charts.leaderboard.destroy();
    }

    const labels = list.map((item) => item.po_name.replace("PO ", ""));
    const otpData = list.map((item) => item.otp_pct);
    const minorData = list.map((item) => item.minor_delay_pct);
    const moderateData = list.map((item) => item.moderate_delay_pct);
    const severeData = list.map((item) => item.severe_delay_pct);
    const meanDelayData = list.map((item) => item.mean_delay_min);

    // Custom plugin: Render real operator logos directly atop each stacked column
    const barLogoPlugin = {
      id: "barLogoPlugin",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        // The top of the stacked bar is the 4th dataset (index 3)
        const meta = chart.getDatasetMeta(3);
        if (!meta || !meta.data) return;

        meta.data.forEach((bar, index) => {
          const item = list[index];
          if (!item) return;
          const img = getLogoImage(item.po_name);
          if (!img || !img.complete || img.naturalWidth === 0) return;

          const x = bar.x;
          const y = bar.y;
          const logoW = 28;
          const logoH = 18;

          ctx.save();
          const badgeX = x - logoW / 2 - 2;
          const badgeY = y - logoH - 6;

          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 1;

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(badgeX, badgeY, logoW + 4, logoH + 4, 3);
          } else {
            ctx.rect(badgeX, badgeY, logoW + 4, logoH + 4);
          }
          ctx.fill();

          ctx.shadowColor = "transparent";
          ctx.drawImage(img, x - logoW / 2, y - logoH - 4, logoW, logoH);
          ctx.restore();
        });
      },
    };

    charts.leaderboard = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Tepat Waktu (<15 mnt)",
            data: otpData,
            backgroundColor: "#10b981",
            borderRadius: 0,
            stack: "punctuality",
            order: 2,
          },
          {
            label: "Minor (15-30 mnt)",
            data: minorData,
            backgroundColor: "#38bdf8",
            borderRadius: 0,
            stack: "punctuality",
            order: 2,
          },
          {
            label: "Moderat (30-60 mnt)",
            data: moderateData,
            backgroundColor: "#f59e0b",
            borderRadius: 0,
            stack: "punctuality",
            order: 2,
          },
          {
            label: "Kritis (>60 mnt)",
            data: severeData,
            backgroundColor: "#ef4444",
            borderRadius: { topLeft: 4, topRight: 4 },
            stack: "punctuality",
            order: 2,
          },
          {
            label: "Rata-Rata Delay (Menit)",
            data: meanDelayData,
            type: "line",
            borderColor: "#f8fafc",
            backgroundColor: "#f8fafc",
            borderWidth: 2.5,
            pointBackgroundColor: "#38bdf8",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 1.5,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      plugins: [barLogoPlugin],
      options: {
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 10, weight: "bold" }, color: "#94a3b8" },
          },
          y: {
            stacked: true,
            position: "left",
            min: 0,
            max: 100,
            title: { display: true, text: "Komposisi Kedatangan (%)", color: "#10b981", font: { weight: "bold" } },
            ticks: {
              callback: (v) => v + "%",
              stepSize: 20,
              color: "#94a3b8",
            },
            grid: { color: "rgba(255, 255, 255, 0.05)" },
          },
          y1: {
            position: "right",
            min: 0,
            max: 75,
            title: { display: true, text: "Rata-Rata Keterlambatan (Menit)", color: "#f8fafc", font: { weight: "bold" } },
            ticks: {
              callback: (v) => "+" + v + "m",
              stepSize: 15,
              color: "#94a3b8",
            },
            grid: { display: false },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "#0c0f14",
            titleColor: "#f8fafc",
            bodyColor: "#94a3b8",
            borderColor: "rgba(255, 255, 255, 0.15)",
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => {
                if (context.dataset.type === "line") {
                  return `  ${context.dataset.label}: +${context.parsed.y.toFixed(1)} menit`;
                }
                return `  ${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Render Waterfall Dwell Stages, Table, & Chart
   */
  function renderWaterfall() {
    const container = document.getElementById("waterfallCardsGrid");
    if (!container) return;

    container.innerHTML = "";

    DATA.waterfall_all.forEach((item, index) => {
      const card = document.createElement("div");
      const isCritical = item.pct_share_of_total_delay > 25;
      card.className = `stage-card ${isCritical ? "critical" : ""}`;

      const delayDisplay = item.avg_delay_added_min >= 0 ? `+${item.avg_delay_added_min}` : `${item.avg_delay_added_min}`;

      card.innerHTML = `
        <div class="stage-order-num">Tahap 0${index + 1} &bull; ${item.stage_key}</div>
        <div class="stage-title">${item.stage_name}</div>
        <div class="stage-delay-metric ${isCritical ? "text-severe" : "text-amber"}">
          ${delayDisplay} <span>mnt deviasi</span>
        </div>
        <div class="stage-submetrics">
          <div>Jadwal: <strong class="font-mono">${item.avg_scheduled_min} mnt</strong> | Aktual: <strong class="font-mono">${item.avg_actual_min} mnt</strong></div>
          <div style="margin-top: 4px;">Rata-rata Idle Mesin: <strong class="font-mono text-amber">${item.avg_idle_min} mnt</strong></div>
          <div style="margin-top: 2px;">Kontribusi Delay Koridor: <strong class="font-mono">${item.pct_share_of_total_delay}%</strong></div>
        </div>
        <div class="stage-share-bar">
          <div class="stage-share-fill" style="width: ${Math.min(100, item.pct_share_of_total_delay * 1.8)}%;"></div>
        </div>
      `;
      container.appendChild(card);
    });

    // Render Propagation Matrix Table
    const propBody = document.getElementById("propagationTableBody");
    if (propBody) {
      propBody.innerHTML = "";
      DATA.propagation.forEach((p) => {
        const tr = document.createElement("tr");
        const statusClass = p.otp_rate >= 40 ? "text-ontime" : p.otp_rate >= 15 ? "text-amber" : "text-severe";

        const depDelayStr = p.mean_dep_delay > 0 ? `+${p.mean_dep_delay.toFixed(1)}` : `${p.mean_dep_delay.toFixed(1)}`;
        const arrDelayStr = p.mean_arr_delay > 0 ? `+${p.mean_arr_delay.toFixed(1)}` : `${p.mean_arr_delay.toFixed(1)}`;
        const netEscStr = p.net_delay_escalation > 0 ? `+${p.net_delay_escalation.toFixed(1)}` : `${p.net_delay_escalation.toFixed(1)}`;

        tr.innerHTML = `
          <td style="font-weight: 600;">${p.bracket}</td>
          <td class="font-mono">${formatNumber(p.trip_count)}</td>
          <td class="font-mono">${depDelayStr} mnt</td>
          <td class="font-mono">${arrDelayStr} mnt</td>
          <td class="font-mono text-severe">${netEscStr} mnt</td>
          <td class="font-mono ${statusClass}" style="font-weight: 700;">${p.otp_rate.toFixed(1)}%</td>
        `;
        propBody.appendChild(tr);
      });
    }

    renderWaterfallChart();
  }

  /**
   * Chart 2: Cumulative Waterfall Delay Progression
   */
  function renderWaterfallChart() {
    if (!window.Chart) return;
    const canvas = document.getElementById("chartWaterfallProgression");
    if (!canvas) return;

    if (charts.waterfall) {
      charts.waterfall.destroy();
    }

    const labels = [
      "1. Ngetem Agen",
      "2. Arteri Jkt-Bekasi",
      "3. Cruising Tol",
      "4. Rest Area Makan",
      "5. Masuk Terminal",
    ];

    const stageAdded = [14.2, 24.4, -5.6, 2.5, 1.3];
    const cumulative = [14.2, 38.6, 33.0, 35.5, 36.8];

    const stageColors = stageAdded.map((v) => (v < 0 ? "#10b981" : v > 20 ? "#ef4444" : "#f59e0b"));

    charts.waterfall = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Deviasi Tahapan (Menit)",
            data: stageAdded,
            backgroundColor: stageColors,
            borderRadius: 3,
            order: 2,
          },
          {
            label: "Akumulasi Delay Kumulatif (Menit)",
            data: cumulative,
            type: "line",
            borderColor: "#38bdf8",
            backgroundColor: "#38bdf8",
            borderDash: [4, 4],
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            order: 1,
          },
        ],
      },
      options: {
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Deviasi Keterlambatan (Menit)" },
            grid: { color: "rgba(255, 255, 255, 0.04)" },
          },
        },
      },
    });
  }

  /**
   * Run Eco-Speed & Fuel Savings Simulator & Chart
   */
  function runFuelSimulation() {
    const speedInput = document.getElementById("speedSlider");
    const idleInput = document.getElementById("idleSlider");
    if (!speedInput || !idleInput) return;

    const speed = parseFloat(speedInput.value);
    const idleCut = parseFloat(idleInput.value);

    const speedValDisplay = document.getElementById("speedVal");
    const idleValDisplay = document.getElementById("idleVal");
    if (speedValDisplay) speedValDisplay.textContent = `${speed} km/jam`;
    if (idleValDisplay) idleValDisplay.textContent = `${idleCut}%`;

    // Baseline fleet parameters (from 3,500 trips data mart)
    const totalFuelLiters = DATA.kpis.total_fuel_liters; // 644,086 Liters
    const baselineIdleHours = 250646.0 / 60.0; // 4,177.4 Hours
    const baselineSpeedingKm = 246985.0; // km traveled above 90 km/h

    // 1. Idle Fuel Savings: Heavy duty diesel engine burns ~2.8L/hr at idle
    const savedIdleHours = baselineIdleHours * (idleCut / 100.0);
    const fuelSavedIdle = savedIdleHours * 2.8;

    // 2. Aerodynamic Drag Speed Savings:
    const speedReductionRatio = Math.max(0, (105.0 - speed) / 15.0);
    const fuelSavedSpeed = (baselineSpeedingKm / 100.0) * (4.2 * speedReductionRatio);

    const totalSavedLiters = Math.round(fuelSavedIdle + fuelSavedSpeed);
    const pctSaved = ((totalSavedLiters / totalFuelLiters) * 100).toFixed(1);
    const idrSaved = totalSavedLiters * 13500; // Rp 13.500 / Liter Dexlite
    const costJuta = (idrSaved / 1_000_000).toFixed(1);
    const co2AvoidedTons = ((totalSavedLiters * 2.68) / 1000).toFixed(1);

    const resLiters = document.getElementById("resSavedLiters");
    const resPct = document.getElementById("resSavedPct");
    const resCost = document.getElementById("resSavedCost");
    const resCo2 = document.getElementById("resCo2");

    if (resLiters) resLiters.textContent = `${formatNumber(totalSavedLiters)} L`;
    if (resPct) resPct.textContent = `${pctSaved}% dari konsumsi armada`;
    if (resCost) resCost.textContent = `Rp ${costJuta} Juta`;
    if (resCo2) resCo2.textContent = `${co2AvoidedTons} Ton`;

    renderFuelSensitivityChart(speed, idleCut);
  }

  /**
   * Chart 3: Fuel Savings Sensitivity Curve
   */
  function renderFuelSensitivityChart(currentSpeed, idleCut) {
    if (!window.Chart) return;
    const canvas = document.getElementById("chartFuelSensitivity");
    if (!canvas) return;

    if (charts.fuel) {
      charts.fuel.destroy();
    }

    const speedPoints = [80, 85, 90, 95, 100, 105];
    const totalIdleMins = 250646.0;
    const speedingKm = 246985.0;
    const idleHoursSaved = (totalIdleMins / 60.0) * (idleCut / 100.0);
    const fuelSavedIdle = idleHoursSaved * 2.8;

    const dataPoints = speedPoints.map((s) => {
      const speedRatio = Math.max(0, (105.0 - s) / 15.0);
      const fuelSavedSpeed = (speedingKm / 100.0) * (4.2 * speedRatio);
      const totalLiters = fuelSavedIdle + fuelSavedSpeed;
      return parseFloat(((totalLiters * 13500) / 1_000_000).toFixed(1)); // in Juta Rupiah
    });

    const pointRadii = speedPoints.map((s) => (Math.abs(s - currentSpeed) < 2.5 ? 8 : 4));
    const pointColors = speedPoints.map((s) => (Math.abs(s - currentSpeed) < 2.5 ? "#10b981" : "#f59e0b"));

    charts.fuel = new Chart(canvas, {
      type: "line",
      data: {
        labels: speedPoints.map((s) => `${s} km/h`),
        datasets: [
          {
            label: "Penghematan Biaya BBM (Juta Rupiah)",
            data: dataPoints,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            fill: true,
            borderWidth: 2.5,
            pointRadius: pointRadii,
            pointBackgroundColor: pointColors,
            pointHoverRadius: 9,
            tension: 0.3,
          },
        ],
      },
      options: {
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            title: { display: true, text: "Batas Kecepatan Maksimum (Speed Limiter)" },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Penghematan Bersih (Juta Rp)" },
            grid: { color: "rgba(255, 255, 255, 0.04)" },
          },
        },
      },
    });
  }

  /**
   * Render Hourly Departure Optimizer & Chart
   */
  function renderHourlyRecommender(destKey) {
    const hourlyKey = `hourly_${destKey.toLowerCase()}`;
    const list = DATA[hourlyKey] || DATA.hourly_sby;
    const container = document.getElementById("hourlyChartContainer");
    const adviceBox = document.getElementById("recommendationAlert");

    if (!container || !adviceBox) return;

    container.innerHTML = "";

    // Find best and worst hours based on mean delay
    const sorted = [...list].sort((a, b) => a.mean_delay_min - b.mean_delay_min);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    adviceBox.innerHTML = `
      <div class="advice-tile optimal">
        <div class="advice-header">Jendela Keberangkatan Optimal</div>
        <div class="advice-time">Pukul ${best.hour} WIB</div>
        <div class="advice-stats">
          Tingkat On-Time <strong class="text-ontime">${best.otp_rate}%</strong> | Rata-rata delay hanya <strong class="text-ontime">+${best.mean_delay_min} mnt</strong>.
          Kondisi Tol Layang MBZ & Cikampek Utama relatif lancar.
        </div>
      </div>
      <div class="advice-tile suboptimal">
        <div class="advice-header">Jendela Keberangkatan Rawan Macet</div>
        <div class="advice-time">Pukul ${worst.hour} WIB</div>
        <div class="advice-stats">
          Tingkat On-Time hanya <strong class="text-severe">${worst.otp_rate}%</strong> | Rata-rata delay membengkak hingga <strong class="text-severe">+${worst.mean_delay_min} mnt</strong>.
          Terkena dampak kemacetan komuter malam dan antrean bottleneck GT Kalikangkung.
        </div>
      </div>
    `;

    // Render hourly comparison horizontal bars
    const maxDelay = Math.max(...list.map((i) => i.mean_delay_min), 80);

    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "hourly-bar-row";

      let barColor = "var(--status-ontime)";
      if (item.mean_delay_min > 55) barColor = "var(--status-severe)";
      else if (item.mean_delay_min > 40) barColor = "var(--status-moderate)";
      else if (item.mean_delay_min > 25) barColor = "var(--status-minor)";

      const widthPct = Math.min(100, Math.round((item.mean_delay_min / maxDelay) * 100));

      row.innerHTML = `
        <div class="hour-badge">${item.hour} WIB</div>
        <div class="hour-track">
          <div class="hour-fill" style="width: ${widthPct}%; background: ${barColor};"></div>
        </div>
        <div class="font-mono text-dim" style="text-align: right; font-weight: 600;">+${item.mean_delay_min} mnt</div>
        <div class="font-mono text-dim" style="text-align: right;">${item.otp_rate}% OTP</div>
      `;
      container.appendChild(row);
    });

    renderHourlyProfileChart(list);
  }

  /**
   * Chart 4: Dual-Axis Hourly Profile Chart
   */
  function renderHourlyProfileChart(list) {
    if (!window.Chart) return;
    const canvas = document.getElementById("chartHourlyProfile");
    if (!canvas) return;

    if (charts.hourly) {
      charts.hourly.destroy();
    }

    const labels = list.map((item) => `${item.hour} WIB`);
    const delays = list.map((item) => item.mean_delay_min);
    const otps = list.map((item) => item.otp_rate);

    const barColors = delays.map((d) => (d > 55 ? "#ef4444" : d > 40 ? "#f97316" : d > 25 ? "#f59e0b" : "#10b981"));

    charts.hourly = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Rata-rata Keterlambatan (Menit)",
            data: delays,
            backgroundColor: barColors.map((c) => c + "cc"),
            borderColor: barColors,
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: "y",
            order: 2,
          },
          {
            label: "Peluang Tiba Tepat Waktu / OTP (%)",
            data: otps,
            type: "line",
            borderColor: "#10b981",
            backgroundColor: "#10b981",
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      options: {
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            position: "left",
            title: { display: true, text: "Delay Kedatangan (Menit)" },
            grid: { color: "rgba(255, 255, 255, 0.05)" },
          },
          y1: {
            position: "right",
            min: 0,
            max: 30,
            title: { display: true, text: "Peluang OTP (%)", color: "#10b981" },
            grid: { display: false },
          },
        },
      },
    });
  }

  /**
   * Render Smart Passenger Trip Assistant & Best PO Recommendation
   */
  function renderPassengerRecommender() {
    const container = document.getElementById("passengerRecommendationsContainer");
    if (!container) return;

    const routeKey = state.passengerRoute || "sby";
    const priority = state.passengerPriority || "ontime";
    const timeWindow = state.passengerTime || "evening";

    const corridorKey = (CORRIDORS[routeKey] && CORRIDORS[routeKey].key) ? CORRIDORS[routeKey].key : "leaderboard_all";
    let list = [...(DATA[corridorKey] || DATA.leaderboard_all)];

    // Rank candidate POs based on passenger's priority
    list.sort((a, b) => {
      if (priority === "ontime") {
        return b.otp_pct - a.otp_pct || a.mean_delay_min - b.mean_delay_min;
      } else if (priority === "comfort") {
        const aSleeper = /sleeper|president|first class/i.test(a.service_class) ? 1 : 0;
        const bSleeper = /sleeper|president|first class/i.test(b.service_class) ? 1 : 0;
        if (bSleeper !== aSleeper) return bSleeper - aSleeper;
        return a.severe_delay_pct - b.severe_delay_pct || b.otp_pct - a.otp_pct;
      } else if (priority === "speed") {
        return b.mean_speed_kmh - a.mean_speed_kmh || a.mean_delay_min - b.mean_delay_min;
      } else if (priority === "budget") {
        return b.total_trips - a.total_trips;
      }
      return b.otp_pct - a.otp_pct;
    });

    const priorityLabels = {
      ontime: "Ketepatan Waktu Tertinggi",
      comfort: "Kenyamanan Armada Sleeper",
      speed: "Kecepatan Jelajah Tol",
      budget: "Paling Ramah Kantong",
    };

    const timeAdvice = {
      morning: "Perjalanan pagi (06:00 - 08:00 WIB) rentan bottleneck di GT Cikampek Utama KM 70 karena bersamaan dengan arus truk ekspedisi logistik. Disarankan berangkat lebih awal atau siapkan waktu luang minimal +35 menit.",
      afternoon: "Perjalanan siang (12:00 - 14:00 WIB) tol layang MBZ relatif lengang, namun cuaca terik di aspal beton Pantura-Jateng meningkatkan risiko perlambatan armada.",
      evening: "Keberangkatan malam (18:00 - 20:00 WIB) adalah jam paling optimal! Arus komuter sore Jakarta telah reda, cruising tol lancar, dan Anda tiba istirahat pagi di terminal tujuan dalam kondisi bugar.",
    };

    const routeDetails = {
      sby: { originTerm: "Pondok Pinang / Pulo Gebang", destTerm: "Terminal Purabaya Bungurasih", destCity: "Surabaya", dep: "18:30 WIB", arr: "05:15 WIB", duration: "10j 45m" },
      slo: { originTerm: "Pulo Gebang / Kp Rambutan", destTerm: "Terminal Tirtonadi Solo", destCity: "Solo", dep: "18:00 WIB", arr: "03:30 WIB", duration: "9j 30m" },
      smg: { originTerm: "Pulo Gebang / Kalideres", destTerm: "Terminal Krapyak Semarang", destCity: "Semarang", dep: "19:30 WIB", arr: "02:00 WIB", duration: "6j 30m" },
      mlg: { originTerm: "Pondok Pinang / Pulo Gebang", destTerm: "Terminal Arjosari Malang", destCity: "Malang", dep: "18:00 WIB", arr: "06:30 WIB", duration: "12j 30m" },
      all: { originTerm: "Terminal Jakarta", destTerm: "Terminal Tujuan Trans-Jawa", destCity: "Jateng / Jatim", dep: "18:00 WIB", arr: "05:00 WIB", duration: "±10 Jam" },
    };

    const curRoute = routeDetails[routeKey] || routeDetails.sby;

    const top = list[0];
    const runnerUp = list[1] || list[0];
    const budgetPick = list[2] || list[1] || list[0];

    const logoTop = LOGO_MAP[top.po_name] || "assets/logos/sinarjaya.png";
    const logoRunner = LOGO_MAP[runnerUp.po_name] || "assets/logos/sinarjaya.png";
    const logoBudget = LOGO_MAP[budgetPick.po_name] || "assets/logos/sinarjaya.png";

    const sentTop = (DATA.sentiment && DATA.sentiment[top.po_name]) || null;
    const sentRunner = (DATA.sentiment && DATA.sentiment[runnerUp.po_name]) || null;
    const sentBudget = (DATA.sentiment && DATA.sentiment[budgetPick.po_name]) || null;

    const metaTop = OPERATOR_META[top.po_name] || {
      fare_range: "Rp 320.000 – Rp 480.000",
      perks: ["AC Dingin", "Reclining Seat", "Toilet", "Makan Malam"],
      passenger_verdict: "Pilihan andal dengan performa operasional teruji di rute Trans-Jawa."
    };
    const metaRunner = OPERATOR_META[runnerUp.po_name] || {
      fare_range: "Rp 300.000 – Rp 450.000",
      perks: ["AC Dingin", "Reclining Seat", "Toilet"],
      passenger_verdict: "Opsi alternatif yang layak dengan frekuensi keberangkatan padat."
    };
    const metaBudget = OPERATOR_META[budgetPick.po_name] || {
      fare_range: "Rp 260.000 – Rp 380.000",
      perks: ["AC Dingin", "Reclining Seat", "Ekonomis"],
      passenger_verdict: "Pilihan terbaik untuk menghemat biaya perjalanan tanpa mengorbankan kenyamanan."
    };

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: 8px;">
        <div>
        <span style="font-size: 13.5px; font-weight: 700; color: #f8fafc; display: block;">
          Menampilkan Tiket Rekomendasi Bus: Jakarta ke ${curRoute.destCity}
        </span>
        <span class="recommendation-freshness">Jadwal referensi diperbarui ${DATA_FRESHNESS.scheduleSnapshot} · ${DATA_FRESHNESS.sourceLabel}</span>
        </div>
        <span class="fare-estimate-pill font-mono">Full Tol Trans-Jawa &bull; Tanpa Ngetem Parah</span>
      </div>

      <!-- TICKET 1: TOP MATCH (BEST PICK) -->
      <article class="ticket-card featured">
        <div class="ticket-main-section">
          <div class="ticket-top-row">
            <div class="ticket-po-brand">
              <img src="${logoTop}" alt="${top.po_name}" class="ticket-po-logo">
              <div>
                <h3 class="ticket-po-title">${top.po_name}</h3>
                <span class="ticket-po-class">${top.service_class} • Rute Jakarta ke ${curRoute.destCity}</span>
              </div>
            </div>
            <span class="ticket-rank-badge best-otp">★ Pilihan Utama &bull; ${priorityLabels[priority]}</span>
          </div>

          <!-- Journey Timeline -->
          <div class="ticket-journey-strip">
            <div class="journey-stop origin">
              <span class="journey-time-big font-mono">${curRoute.dep}</span>
              <span class="journey-city-name">Jakarta</span>
              <span class="journey-terminal-name" title="${curRoute.originTerm}">${curRoute.originTerm}</span>
            </div>

            <div class="journey-mid-track">
              <span class="journey-duration-tag font-mono">${curRoute.duration}</span>
              <div class="journey-visual-line">
                <span class="journey-dot start"></span>
                <span class="journey-bar"></span>
                <span class="journey-dot end"></span>
              </div>
              <span class="journey-route-badge">Tol Trans-Jawa</span>
            </div>

            <div class="journey-stop dest">
              <span class="journey-time-big font-mono">${curRoute.arr}</span>
              <span class="journey-city-name">${curRoute.destCity}</span>
              <span class="journey-terminal-name" title="${curRoute.destTerm}">${curRoute.destTerm}</span>
            </div>
          </div>

          <!-- Perks -->
          <div class="perks-list">
            ${metaTop.perks.map((p) => `<span class="perk-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${p}</span>`).join("")}
          </div>

          <div class="passenger-verdict-box">
            <strong>Saran Penumpang:</strong> ${metaTop.passenger_verdict}
            ${sentTop && sentTop.verified_quotes && sentTop.verified_quotes[0] ? `<br><em style="color: #94a3b8; display: block; margin-top: 5px; font-size: 11.5px;">"${sentTop.verified_quotes[0]}"</em>` : ""}
          </div>
        </div>

        <!-- Sidebar: Fare & Rating -->
        <div class="ticket-sidebar-section">
          <div class="ticket-fare-box">
            <span class="ticket-fare-caption">Tarif referensi</span>
            <div class="ticket-fare-value font-mono">${metaTop.fare_range.split("–")[0].trim()}</div>
            <span class="ticket-fare-caption">Indikatif · rentang s.d. ${metaTop.fare_range.split("–")[1] ? metaTop.fare_range.split("–")[1].trim() : ""}</span>
          </div>

          <div class="ticket-rating-strip">
            <span style="color: #fbbf24; font-size: 13px;">★</span>
            <strong class="font-mono" style="font-size: 13px; color: #f8fafc;">${sentTop ? sentTop.rating_score : "4.8"}</strong>
            <span class="text-muted font-mono" style="font-size: 11px;">(${sentTop ? formatNumber(sentTop.total_reviews) : "2.000+"} ulasan)</span>
          </div>

          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            <span class="${top.otp_pct >= 40 ? "text-ontime" : "text-amber"}">Ketepatan: ${top.otp_pct}%</span> &bull; Delay: +${top.mean_delay_min}m
          </div>

          <button type="button" class="btn-view-reviews" onclick="const f = document.getElementById('reviewPoFilter'); if(f) { f.value='${top.po_name}'; f.dispatchEvent(new Event('change')); document.getElementById('reviewsFeedContainer').scrollIntoView({behavior: 'smooth'}); }">
            Lihat Ulasan Penumpang &rarr;
          </button>
          <button type="button" class="btn-book-ticket" data-booking-operator="${top.po_name}" data-booking-class="${top.service_class}" data-booking-destination="${curRoute.destCity}" data-booking-departure="${curRoute.dep}" data-booking-arrival="${curRoute.arr}" data-booking-fare="${metaTop.fare_range}">
            Pilih untuk dipesan
          </button>
        </div>
      </article>

      <!-- TICKET 2: RUNNER UP (BEST ALTERNATIVE) -->
      <article class="ticket-card">
        <div class="ticket-main-section">
          <div class="ticket-top-row">
            <div class="ticket-po-brand">
              <img src="${logoRunner}" alt="${runnerUp.po_name}" class="ticket-po-logo">
              <div>
                <h3 class="ticket-po-title">${runnerUp.po_name}</h3>
                <span class="ticket-po-class">${runnerUp.service_class} • Alternatif Terbaik</span>
              </div>
            </div>
            <span class="ticket-rank-badge best-comfort">Alternatif Rekomendasi</span>
          </div>

          <div class="ticket-journey-strip">
            <div class="journey-stop origin">
              <span class="journey-time-big font-mono">${curRoute.dep}</span>
              <span class="journey-city-name">Jakarta</span>
              <span class="journey-terminal-name" title="${curRoute.originTerm}">${curRoute.originTerm}</span>
            </div>

            <div class="journey-mid-track">
              <span class="journey-duration-tag font-mono">${curRoute.duration}</span>
              <div class="journey-visual-line">
                <span class="journey-dot start"></span>
                <span class="journey-bar"></span>
                <span class="journey-dot end"></span>
              </div>
              <span class="journey-route-badge">Tol Trans-Jawa</span>
            </div>

            <div class="journey-stop dest">
              <span class="journey-time-big font-mono">${curRoute.arr}</span>
              <span class="journey-city-name">${curRoute.destCity}</span>
              <span class="journey-terminal-name" title="${curRoute.destTerm}">${curRoute.destTerm}</span>
            </div>
          </div>

          <div class="perks-list">
            ${metaRunner.perks.map((p) => `<span class="perk-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${p}</span>`).join("")}
          </div>

          <div class="passenger-verdict-box">
            <strong>Saran Penumpang:</strong> ${metaRunner.passenger_verdict}
            ${sentRunner && sentRunner.verified_quotes && sentRunner.verified_quotes[0] ? `<br><em style="color: #94a3b8; display: block; margin-top: 5px; font-size: 11.5px;">"${sentRunner.verified_quotes[0]}"</em>` : ""}
          </div>
        </div>

        <div class="ticket-sidebar-section">
          <div class="ticket-fare-box">
            <span class="ticket-fare-caption">Tarif referensi</span>
            <div class="ticket-fare-value font-mono">${metaRunner.fare_range.split("–")[0].trim()}</div>
            <span class="ticket-fare-caption">Indikatif · rentang s.d. ${metaRunner.fare_range.split("–")[1] ? metaRunner.fare_range.split("–")[1].trim() : ""}</span>
          </div>

          <div class="ticket-rating-strip">
            <span style="color: #fbbf24; font-size: 13px;">★</span>
            <strong class="font-mono" style="font-size: 13px; color: #f8fafc;">${sentRunner ? sentRunner.rating_score : "4.6"}</strong>
            <span class="text-muted font-mono" style="font-size: 11px;">(${sentRunner ? formatNumber(sentRunner.total_reviews) : "1.800+"} ulasan)</span>
          </div>

          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            <span class="${runnerUp.otp_pct >= 40 ? "text-ontime" : "text-amber"}">Ketepatan: ${runnerUp.otp_pct}%</span> &bull; Delay: +${runnerUp.mean_delay_min}m
          </div>

          <button type="button" class="btn-view-reviews" onclick="const f = document.getElementById('reviewPoFilter'); if(f) { f.value='${runnerUp.po_name}'; f.dispatchEvent(new Event('change')); document.getElementById('reviewsFeedContainer').scrollIntoView({behavior: 'smooth'}); }">
            Lihat Ulasan Penumpang &rarr;
          </button>
          <button type="button" class="btn-book-ticket" data-booking-operator="${runnerUp.po_name}" data-booking-class="${runnerUp.service_class}" data-booking-destination="${curRoute.destCity}" data-booking-departure="${curRoute.dep}" data-booking-arrival="${curRoute.arr}" data-booking-fare="${metaRunner.fare_range}">
            Pilih untuk dipesan
          </button>
        </div>
      </article>

      <!-- TICKET 3: BUDGET VALUE PICK -->
      <article class="ticket-card">
        <div class="ticket-main-section">
          <div class="ticket-top-row">
            <div class="ticket-po-brand">
              <img src="${logoBudget}" alt="${budgetPick.po_name}" class="ticket-po-logo">
              <div>
                <h3 class="ticket-po-title">${budgetPick.po_name}</h3>
                <span class="ticket-po-class">${budgetPick.service_class} • Opsi Ekonomis Teruji</span>
              </div>
            </div>
            <span class="ticket-rank-badge best-budget">Paling Hemat Budget</span>
          </div>

          <div class="ticket-journey-strip">
            <div class="journey-stop origin">
              <span class="journey-time-big font-mono">${curRoute.dep}</span>
              <span class="journey-city-name">Jakarta</span>
              <span class="journey-terminal-name" title="${curRoute.originTerm}">${curRoute.originTerm}</span>
            </div>

            <div class="journey-mid-track">
              <span class="journey-duration-tag font-mono">${curRoute.duration}</span>
              <div class="journey-visual-line">
                <span class="journey-dot start"></span>
                <span class="journey-bar"></span>
                <span class="journey-dot end"></span>
              </div>
              <span class="journey-route-badge">Tol Trans-Jawa</span>
            </div>

            <div class="journey-stop dest">
              <span class="journey-time-big font-mono">${curRoute.arr}</span>
              <span class="journey-city-name">${curRoute.destCity}</span>
              <span class="journey-terminal-name" title="${curRoute.destTerm}">${curRoute.destTerm}</span>
            </div>
          </div>

          <div class="perks-list">
            ${metaBudget.perks.map((p) => `<span class="perk-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${p}</span>`).join("")}
          </div>

          <div class="passenger-verdict-box">
            <strong>Saran Penumpang:</strong> ${metaBudget.passenger_verdict}
            ${sentBudget && sentBudget.verified_quotes && sentBudget.verified_quotes[0] ? `<br><em style="color: #94a3b8; display: block; margin-top: 5px; font-size: 11.5px;">"${sentBudget.verified_quotes[0]}"</em>` : ""}
          </div>
        </div>

        <div class="ticket-sidebar-section">
          <div class="ticket-fare-box">
            <span class="ticket-fare-caption">Tarif referensi</span>
            <div class="ticket-fare-value font-mono">${metaBudget.fare_range.split("–")[0].trim()}</div>
            <span class="ticket-fare-caption">Indikatif · rentang s.d. ${metaBudget.fare_range.split("–")[1] ? metaBudget.fare_range.split("–")[1].trim() : ""}</span>
          </div>

          <div class="ticket-rating-strip">
            <span style="color: #fbbf24; font-size: 13px;">★</span>
            <strong class="font-mono" style="font-size: 13px; color: #f8fafc;">${sentBudget ? sentBudget.rating_score : "4.4"}</strong>
            <span class="text-muted font-mono" style="font-size: 11px;">(${sentBudget ? formatNumber(sentBudget.total_reviews) : "3.000+"} ulasan)</span>
          </div>

          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            <span class="${budgetPick.otp_pct >= 40 ? "text-ontime" : "text-amber"}">Ketepatan: ${budgetPick.otp_pct}%</span> &bull; Delay: +${budgetPick.mean_delay_min}m
          </div>

          <button type="button" class="btn-view-reviews" onclick="const f = document.getElementById('reviewPoFilter'); if(f) { f.value='${budgetPick.po_name}'; f.dispatchEvent(new Event('change')); document.getElementById('reviewsFeedContainer').scrollIntoView({behavior: 'smooth'}); }">
            Lihat Ulasan Penumpang &rarr;
          </button>
          <button type="button" class="btn-book-ticket" data-booking-operator="${budgetPick.po_name}" data-booking-class="${budgetPick.service_class}" data-booking-destination="${curRoute.destCity}" data-booking-departure="${curRoute.dep}" data-booking-arrival="${curRoute.arr}" data-booking-fare="${metaBudget.fare_range}">
            Pilih untuk dipesan
          </button>
        </div>
      </article>

      <div class="rec-warning-box" style="margin-top: var(--space-4);">
        <strong>Tips Jam Berangkat:</strong> ${timeAdvice[timeWindow]}
      </div>
    `;

    renderSentimentTable();
  }

  /**
   * Render Sentiment & Passenger Trust Table
   */
  function renderSentimentTable() {
    const tbody = document.getElementById("sentimentTableBody");
    if (!tbody || !DATA.sentiment) return;

    tbody.innerHTML = "";

    Object.keys(DATA.sentiment).forEach((poName) => {
      const s = DATA.sentiment[poName];
      const logoSrc = LOGO_MAP[poName] || "assets/logos/sinarjaya.png";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="operator-cell">
            <div class="operator-logo-wrap" style="width: 36px; height: 24px;">
              <img src="${logoSrc}" alt="${poName}" class="operator-logo-img">
            </div>
            <div class="operator-info">
              <span class="operator-name">${poName}</span>
              <span class="operator-class">${s.sentiment_label}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="color: #fbbf24;">★</span>
            <strong class="font-mono">${s.rating_score}</strong>
            <span class="text-muted font-mono" style="font-size: 11px;">/ 5.0</span>
          </div>
        </td>
        <td class="font-mono">${formatNumber(s.total_reviews)}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; justify-content: space-between; font-size: 10.5px;" class="font-mono">
              <span class="text-ontime">${s.sentiment_positive_pct}%</span>
              <span class="text-dim">${s.sentiment_neutral_pct}%</span>
              <span class="text-severe">${s.sentiment_negative_pct}%</span>
            </div>
            <div class="distribution-bar" style="width: 110px;">
              <div class="bar-segment ontime" style="width: ${s.sentiment_positive_pct}%;"></div>
              <div class="bar-segment minor" style="width: ${s.sentiment_neutral_pct}%;"></div>
              <div class="bar-segment severe" style="width: ${s.sentiment_negative_pct}%;"></div>
            </div>
          </div>
        </td>
        <td style="max-width: 320px; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
          <strong>${s.top_strengths}</strong>
          <span class="table-note">Perhatian: ${s.top_considerations}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderSentimentHighlights() {
    const container = document.getElementById("sentimentHighlights");
    if (!container || !DATA.sentiment) return;

    const entries = Object.entries(DATA.sentiment)
      .sort(([, a], [, b]) => b.rating_score - a.rating_score)
      .slice(0, 3);

    container.innerHTML = entries.map(([poName, s], index) => `
      <article class="sentiment-highlight-card${index === 0 ? " featured" : ""}">
        <div class="sentiment-highlight-top">
          <span class="eyebrow">${index === 0 ? "SKOR TERTINGGI" : "PILIHAN DATASET"}</span>
          <strong class="sentiment-rating">${s.rating_score.toFixed(1)}<small>/5</small></strong>
        </div>
        <h3>${poName}</h3>
        <p>${s.top_strengths}</p>
        <div class="sentiment-highlight-meta">
          <span>${formatNumber(s.total_reviews)} ulasan di dataset</span>
          <span class="sentiment-positive">${s.sentiment_positive_pct}% positif</span>
        </div>
      </article>
    `).join("");
  }

  /**
   * Render Granular Passenger Reviews Feed (Who Commented & What They Said)
   */
  function renderPassengerReviewsFeed(filterPo = "all") {
    const feed = document.getElementById("reviewsFeedContainer");
    if (!feed || !DATA.reviews) return;

    feed.innerHTML = "";
    const list = filterPo === "all" ? DATA.reviews.slice(0, 3) : DATA.reviews.filter((r) => r.operator_name === filterPo).slice(0, 3);

    list.forEach((r) => {
      const logoSrc = LOGO_MAP[r.operator_name] || "assets/logos/sinarjaya.png";
      const card = document.createElement("article");
      card.className = "review-card";

      const starCount = Math.round(r.rating_stars);
      const starsStr = "★".repeat(starCount) + "☆".repeat(5 - starCount);

      card.innerHTML = `
        <div>
          <div class="review-user-row">
            <div class="review-user-info">
              <div class="review-user-avatar">${r.reviewer_name.charAt(0)}</div>
              <div>
                <div class="review-user-name">${r.reviewer_name}</div>
                <span class="review-source-badge font-mono">${r.source_platform}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #fbbf24; font-size: 13px;">${starsStr}</span>
              <strong class="font-mono" style="font-size: 12px; color: #f8fafc;">${r.rating_stars.toFixed(1)}</strong>
            </div>
          </div>

          <div class="review-meta-line">
            <div class="operator-logo-wrap" style="width: 26px; height: 18px; display: inline-flex; vertical-align: middle;">
              <img src="${logoSrc}" alt="${r.operator_name}" class="operator-logo-img">
            </div>
            <strong style="color: var(--text-primary); font-size: 11.5px;">${r.operator_name}</strong>
            <span>•</span>
            <span>${r.service_class}</span>
          </div>

          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">
            Rute: <strong>${r.route_traveled}</strong> • Tanggal: ${r.review_date}
          </div>

          <h4 class="review-title-text">${r.review_title}</h4>
          <p class="review-body-text">"${r.review_comment}"</p>
        </div>

        <div class="review-card-footer">
          <span class="perk-tag" style="background: rgba(34, 197, 94, 0.1); color: #22c55e; border-color: rgba(34, 197, 94, 0.25);">
            ${r.aspect_highlight}
          </span>
          <span class="font-mono text-dim" style="font-size: 10.5px;">${r.review_id}</span>
        </div>
      `;
      feed.appendChild(card);
    });

    const dialogFeed = document.getElementById("dialogReviews");
    if (dialogFeed && dialogFeed !== feed) {
      dialogFeed.innerHTML = "";
      list.forEach((r) => {
        const card = document.createElement("article");
        card.className = "review-card";
        card.innerHTML = `<strong>${r.operator_name}</strong><h4 class="review-title-text">${r.review_title}</h4><p class="review-body-text">"${r.review_comment}"</p><span class="review-source-badge">${r.source_platform}</span>`;
        dialogFeed.appendChild(card);
      });
    }
  }

  /**
   * Tab Switching with Chart Reflow
   */
  function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${tabId}`);
    });

    // Resize/reflow charts when their container becomes visible
    setTimeout(() => {
      if (tabId === "leaderboard" && charts.leaderboard) charts.leaderboard.resize();
      if (tabId === "waterfall" && charts.waterfall) charts.waterfall.resize();
      if (tabId === "simulator" && charts.fuel) charts.fuel.resize();
      if (tabId === "hourly" && charts.hourly) charts.hourly.resize();
    }, 50);
  }

  /**
   * Event Listeners Registration
   */
  function setupEventListeners() {
    // Passenger Assistant controls
    const passRoute = document.getElementById("passengerRouteSelect");
    if (passRoute) {
      passRoute.addEventListener("change", (e) => {
        state.passengerRoute = e.target.value;
        renderPassengerRecommender();
      });
    }

    document.querySelectorAll("#passengerPriorityChips button, #passengerPriorityChips .search-filter-chip, #passengerPriorityChips .chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#passengerPriorityChips button, #passengerPriorityChips .search-filter-chip, #passengerPriorityChips .chip-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.passengerPriority = btn.dataset.priority;
        renderPassengerRecommender();
      });
    });

    document.querySelectorAll("#passengerTimeChips button, #passengerTimeChips .search-filter-chip, #passengerTimeChips .chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#passengerTimeChips button, #passengerTimeChips .search-filter-chip, #passengerTimeChips .chip-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.passengerTime = btn.dataset.time;
        renderPassengerRecommender();
      });
    });

    // Search submit button
    const btnSearchSubmit = document.getElementById("btnSearchSubmit");
    if (btnSearchSubmit) {
      btnSearchSubmit.addEventListener("click", () => {
        renderPassengerRecommender();
        const resultsSec = document.getElementById("resultsSection");
        if (resultsSec) {
          resultsSec.scrollIntoView({ behavior: "auto", block: "start" });
        }
      });
    }

    // Corridor selector dropdown
    const corridorSelect = document.getElementById("corridorSelect");
    if (corridorSelect) {
      corridorSelect.addEventListener("change", (e) => {
        state.activeCorridor = e.target.value;
        updateKPIs(state.activeCorridor);
        renderLeaderboard(state.activeCorridor);
      });
    }

    // Tabs inside Analytics Dashboard
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Page Switcher: Landing Page (Passenger) <-> Analytics Dashboard (Fleet Ops)
    const landingWrap = document.getElementById("landingPageWrap");
    const dashboardWrap = document.getElementById("dashboardPageWrap");
    const btnBackToLanding = document.getElementById("btnBackToLanding");

    document.querySelectorAll(".btn-cta-analytics").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!landingWrap || !dashboardWrap) {
          window.location.href = "dashboard.html";
          return;
        }
        if (landingWrap) landingWrap.style.display = "none";
        if (dashboardWrap) dashboardWrap.style.display = "block";
        switchTab("leaderboard");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    if (btnBackToLanding) {
      btnBackToLanding.addEventListener("click", () => {
        if (!landingWrap || !dashboardWrap) {
          window.location.href = "landing.html";
          return;
        }
        if (dashboardWrap) dashboardWrap.style.display = "none";
        if (landingWrap) landingWrap.style.display = "block";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Review PO Filter
    const reviewPoFilter = document.getElementById("reviewPoFilter");
    if (reviewPoFilter) {
      reviewPoFilter.addEventListener("change", (e) => {
        renderPassengerReviewsFeed(e.target.value);
      });
    }

    const sentimentDialog = document.getElementById("sentimentDialog");
    const openSentiment = document.getElementById("btnOpenSentiment");
    const closeSentiment = document.getElementById("btnCloseSentiment");
    if (sentimentDialog && openSentiment) {
      openSentiment.addEventListener("click", () => {
        renderSentimentTable();
        renderPassengerReviewsFeed(reviewPoFilter ? reviewPoFilter.value : "all");
        sentimentDialog.showModal();
      });
    }
    if (sentimentDialog && closeSentiment) {
      closeSentiment.addEventListener("click", () => sentimentDialog.close());
    }

    const bookingDialog = document.getElementById("bookingDialog");
    const bookingSummary = document.getElementById("bookingSummary");
    const bookingCopyStatus = document.getElementById("bookingCopyStatus");
    const closeBooking = document.getElementById("btnCloseBooking");
    const copyBooking = document.getElementById("btnCopyBooking");
    if (bookingDialog && bookingSummary) {
      document.addEventListener("click", (event) => {
        const button = event.target.closest(".btn-book-ticket");
        if (!button) return;
        const details = [
          `${button.dataset.bookingOperator} | ${button.dataset.bookingClass}`,
          `Jakarta ke ${button.dataset.bookingDestination}`,
          `${button.dataset.bookingDeparture} - ${button.dataset.bookingArrival}`,
          `Perkiraan tarif: ${button.dataset.bookingFare}`,
        ];
        bookingSummary.textContent = details.join("\n");
        bookingSummary.dataset.copyText = details.join("\n");
        if (bookingCopyStatus) bookingCopyStatus.textContent = "";
        bookingDialog.showModal();
      });
    }
    if (bookingDialog && closeBooking) {
      closeBooking.addEventListener("click", () => bookingDialog.close());
    }
    if (bookingDialog && copyBooking && bookingSummary) {
      copyBooking.addEventListener("click", async () => {
        const text = bookingSummary.dataset.copyText || bookingSummary.textContent;
        try {
          await navigator.clipboard.writeText(text);
          if (bookingCopyStatus) bookingCopyStatus.textContent = "Ringkasan tersalin.";
        } catch (error) {
          if (bookingCopyStatus) bookingCopyStatus.textContent = "Tidak dapat menyalin otomatis. Blok teks di atas untuk menyalinnya.";
        }
      });
    }

    // Simulator sliders
    const speedSlider = document.getElementById("speedSlider");
    const idleSlider = document.getElementById("idleSlider");

    if (speedSlider) speedSlider.addEventListener("input", runFuelSimulation);
    if (idleSlider) idleSlider.addEventListener("input", runFuelSimulation);

    // Destination filter buttons
    document.querySelectorAll(".dest-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".dest-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeDest = btn.dataset.dest;
        renderHourlyRecommender(state.activeDest);
      });
    });
  }

  /**
   * Initial App Boot
   */
  function init() {
    setupEventListeners();
    const isDashboard = Boolean(document.getElementById("dashboardPageWrap"));
    const isLanding = Boolean(document.getElementById("landingPageWrap"));

    if (isLanding) {
      renderPassengerRecommender();
      renderSentimentHighlights();

      // Reviews sit well below the recommendation flow. Defer their card
      // construction until the section is close to the viewport.
      const reviewsSection = document.getElementById("reviewsSection");
      if (reviewsSection && "IntersectionObserver" in window) {
        const reviewsObserver = new IntersectionObserver((entries, observer) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          renderPassengerReviewsFeed("all");
          observer.disconnect();
        }, { rootMargin: "300px 0px" });
        reviewsObserver.observe(reviewsSection);
      } else {
        renderPassengerReviewsFeed("all");
      }
    }

    if (isDashboard) {
      switchTab("leaderboard");
      updateKPIs(state.activeCorridor);
      renderLeaderboard(state.activeCorridor);
      renderWaterfall();
      runFuelSimulation();
      renderHourlyRecommender(state.activeDest);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
