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
          <div class="distribution-bar" title="On-Time: ${op.otp_pct}%, Minor: ${op.minor_delay_pct}%, Moderat: ${op.moderate_delay_pct}%, Kritis: ${op.severe_delay_pct}%">
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
        <td class="font-mono">${op.mean_fuel_intensity.toFixed(2)}</td>
        <td class="font-mono text-muted">${op.mean_speed_kmh.toFixed(1)} km/h</td>
      `;
      tbody.appendChild(tr);
    });

    renderLeaderboardChart(list);
  }

  /**
   * Chart 1: Trade-off OTP vs Fuel Intensity
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
    const fuelData = list.map((item) => item.mean_fuel_intensity);
    const barColors = list.map((item) => item.brand_color || "#38bdf8");

    // Custom plugin: Render real operator logos directly atop each bar
    const barLogoPlugin = {
      id: "barLogoPlugin",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
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
            label: "Tingkat Ketepatan On-Time (%)",
            data: otpData,
            backgroundColor: barColors.map((c) => c + "cc"),
            borderColor: barColors,
            borderWidth: 1,
            yAxisID: "y",
            borderRadius: 3,
            order: 2,
          },
          {
            label: "Intensitas Solar (L / 100km)",
            data: fuelData,
            type: "line",
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b",
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
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
            grid: { display: false },
            ticks: { font: { size: 10 } },
          },
          y: {
            position: "left",
            min: 0,
            max: 70,
            title: { display: true, text: "OTP %", color: "#10b981" },
            grid: { color: "rgba(255, 255, 255, 0.04)" },
          },
          y1: {
            position: "right",
            min: 22,
            max: 36,
            title: { display: true, text: "Liter / 100 km", color: "#f59e0b" },
            grid: { display: false },
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

    const top = list[0];
    const runnerUp = list[1] || list[0];

    const logoTop = LOGO_MAP[top.po_name] || "assets/logos/sinarjaya.png";
    const logoRunner = LOGO_MAP[runnerUp.po_name] || "assets/logos/sinarjaya.png";

    const priorityLabels = {
      ontime: "Ketepatan Waktu Tertinggi",
      comfort: "Kenyamanan Armada Sleeper",
      speed: "Kecepatan Jelajah Tol",
      budget: "Paling Ramah Kantong",
    };

    const timeAdvice = {
      morning: "Perjalanan pagi (06:00 - 08:00 WIB) rentan bottleneck di GT Cikampek Utama KM 70 karena bersamaan dengan arus truk ekspedisi logistik. Estimasikan waktu luang (buffer) minimal +35 menit.",
      afternoon: "Perjalanan siang (12:00 - 14:00 WIB) tol layang MBZ relatif lengang, namun cuaca terik di aspal beton Pantura-Jateng meningkatkan risiko perlambatan armada.",
      evening: "Keberangkatan malam (18:00 - 20:00 WIB) adalah jam paling optimal! Arus komuter sore Jakarta telah reda, cruising tol lancar, dan Anda tiba istirahat pagi di terminal tujuan.",
    };

    const reasonsTop = [];
    if (top.otp_pct >= 40) {
      reasonsTop.push(`<strong>Ketepatan Tertinggi:</strong> Rasio On-Time resmi ${top.otp_pct}% pada terminal tujuan.`);
    } else {
      reasonsTop.push(`<strong>Peringkat Terbaik di Koridor Ini:</strong> Mengungguli PO kompetitor dengan rata-rata delay +${top.mean_delay_min} mnt.`);
    }

    if (top.severe_delay_pct <= 5) {
      reasonsTop.push(`<strong>Risiko Delay Ekstrem Sangat Rendah:</strong> Peluang macet parah (&gt;60 mnt) hanya ${top.severe_delay_pct}%.`);
    } else {
      reasonsTop.push(`<strong>Armada Sangat Teruji:</strong> Diaudit dari total ${formatNumber(top.total_trips)} perjalanan aktual.`);
    }

    if (/sleeper|first class|president/i.test(top.service_class)) {
      reasonsTop.push(`<strong>Proses Agen Singkat:</strong> Kapasitas kursi eksklusif memangkas waktu ngetem naik-turun bagasi di arteri.`);
    } else {
      reasonsTop.push(`<strong>Kecepatan Jelajah Efektif:</strong> Rata-rata ${top.mean_speed_kmh} km/jam di jalur bebas hambatan.`);
    }

    const sentTop = (DATA.sentiment && DATA.sentiment[top.po_name]) || null;
    const sentRunner = (DATA.sentiment && DATA.sentiment[runnerUp.po_name]) || null;

    container.innerHTML = `
      <!-- TOP PICK CARD -->
      <article class="rec-card primary">
        <div class="rec-badge-row">
          <span class="rec-status-badge primary">Pilihan Utama &bull; ${priorityLabels[priority]}</span>
          <span class="rec-match-score">Tingkat Kecocokan <strong>98%</strong></span>
        </div>

        <div class="rec-operator-header">
          <div class="operator-logo-wrap" style="width: 48px; height: 32px;">
            <img src="${logoTop}" alt="${top.po_name}" class="operator-logo-img">
          </div>
          <div class="rec-operator-title">
            <h3>${top.po_name}</h3>
            <span>${top.service_class} • Koridor ${CORRIDORS[routeKey].label.split("(")[0]}</span>
          </div>
        </div>

        <div class="rec-metrics-strip">
          <div class="rec-metric-item">
            <span class="rec-metric-label">Rasio On-Time</span>
            <span class="rec-metric-val ${top.otp_pct >= 40 ? "text-ontime" : "text-amber"}">${top.otp_pct}%</span>
          </div>
          <div class="rec-metric-item">
            <span class="rec-metric-label">Rata-Rata Delay</span>
            <span class="rec-metric-val">+${top.mean_delay_min} mnt</span>
          </div>
          <div class="rec-metric-item">
            <span class="rec-metric-label">Kecepatan Tol</span>
            <span class="rec-metric-val font-mono">${top.mean_speed_kmh} km/h</span>
          </div>
        </div>

        <ul class="rec-reasons-list">
          ${reasonsTop.map((r) => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${r}</span></li>`).join("")}
        </ul>

        ${sentTop ? `
        <div class="sentiment-trust-box">
          <div class="sentiment-trust-header">
            <div class="sentiment-rating-badge">
              <span class="rating-star">★</span>
              <strong>${sentTop.rating_score} / 5.0</strong>
              <span class="text-muted font-mono">(${formatNumber(sentTop.total_reviews)} ulasan)</span>
            </div>
            <div class="sentiment-score-chip">
              <span class="text-ontime font-mono">${sentTop.sentiment_positive_pct}% Positif</span>
            </div>
          </div>
          <p class="sentiment-review-quote">
            "${sentTop.verified_quotes[0]}"
          </p>
          <div class="sentiment-meta-row">
            <span><strong>Keunggulan:</strong> ${sentTop.top_strengths}</span>
          </div>
        </div>
        ` : ''}

        <div class="rec-warning-box">
          <strong>Tips Perjalanan:</strong> ${timeAdvice[timeWindow]}
        </div>
      </article>

      <!-- RUNNER UP CARD -->
      <article class="rec-card">
        <div class="rec-badge-row">
          <span class="rec-status-badge secondary">Alternatif Terbaik</span>
          <span class="rec-match-score">Tingkat Kecocokan <strong>91%</strong></span>
        </div>

        <div class="rec-operator-header">
          <div class="operator-logo-wrap" style="width: 48px; height: 32px;">
            <img src="${logoRunner}" alt="${runnerUp.po_name}" class="operator-logo-img">
          </div>
          <div class="rec-operator-title">
            <h3>${runnerUp.po_name}</h3>
            <span>${runnerUp.service_class} • Alternatif Kuat</span>
          </div>
        </div>

        <div class="rec-metrics-strip">
          <div class="rec-metric-item">
            <span class="rec-metric-label">Rasio On-Time</span>
            <span class="rec-metric-val">${runnerUp.otp_pct}%</span>
          </div>
          <div class="rec-metric-item">
            <span class="rec-metric-label">Rata-Rata Delay</span>
            <span class="rec-metric-val">+${runnerUp.mean_delay_min} mnt</span>
          </div>
          <div class="rec-metric-item">
            <span class="rec-metric-label">Total Trip Audit</span>
            <span class="rec-metric-val font-mono">${formatNumber(runnerUp.total_trips)}</span>
          </div>
        </div>

        <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
          Bila tiket <strong>${top.po_name}</strong> telah penuh, <strong>${runnerUp.po_name}</strong> merupakan opsi cadangan paling teruji di koridor ini dengan deviasi keterlambatan yang terukur.
        </p>

        ${sentRunner ? `
        <div class="sentiment-trust-box">
          <div class="sentiment-trust-header">
            <div class="sentiment-rating-badge">
              <span class="rating-star">★</span>
              <strong>${sentRunner.rating_score} / 5.0</strong>
              <span class="text-muted font-mono">(${formatNumber(sentRunner.total_reviews)} ulasan)</span>
            </div>
            <div class="sentiment-score-chip">
              <span class="text-ontime font-mono">${sentRunner.sentiment_positive_pct}% Positif</span>
            </div>
          </div>
          <p class="sentiment-review-quote">
            "${sentRunner.verified_quotes[0]}"
          </p>
        </div>
        ` : ''}

        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-muted);">
          <span>Frekuensi Armada: ${formatNumber(runnerUp.total_trips)} trip</span>
          <span class="font-mono ${runnerUp.severe_delay_pct <= 10 ? "text-ontime" : "text-amber"}">Delay Kritis: ${runnerUp.severe_delay_pct}%</span>
        </div>
      </article>
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
        <td style="max-width: 280px; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
          ${s.top_strengths}
        </td>
        <td style="max-width: 240px; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
          ${s.top_considerations}
        </td>
      `;
      tbody.appendChild(tr);
    });
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

    document.querySelectorAll("#passengerPriorityChips .chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#passengerPriorityChips .chip-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.passengerPriority = btn.dataset.priority;
        renderPassengerRecommender();
      });
    });

    document.querySelectorAll("#passengerTimeChips .chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#passengerTimeChips .chip-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.passengerTime = btn.dataset.time;
        renderPassengerRecommender();
      });
    });

    // Corridor selector dropdown
    const corridorSelect = document.getElementById("corridorSelect");
    if (corridorSelect) {
      corridorSelect.addEventListener("change", (e) => {
        state.activeCorridor = e.target.value;
        updateKPIs(state.activeCorridor);
        renderLeaderboard(state.activeCorridor);
      });
    }

    // Tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
      });
    });

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
    renderPassengerRecommender();
    renderSentimentTable();
    updateKPIs(state.activeCorridor);
    renderLeaderboard(state.activeCorridor);
    renderWaterfall();
    runFuelSimulation();
    renderHourlyRecommender(state.activeDest);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
