import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setPageTitle } from "../../features/common/headerSlice";
import { financeApi } from "../../features/finance/api";
import Chart from "react-apexcharts";
import {
  WalletIcon,
  GiftIcon,
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";

const fmt = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

const fmtM = (n) => {
  const num = Number(n || 0);
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return "Rp 0";
};

const periodLabel = (month, year) =>
  new Date(
    Number(year || new Date().getFullYear()),
    Number(month || new Date().getMonth() + 1) - 1,
    1
  ).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

const monthLabel = (month, year) =>
  new Date(
    Number(year || new Date().getFullYear()),
    Number(month || 1) - 1,
    1
  ).toLocaleDateString("id-ID", { month: "long" });

function FinanceDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [selectedTrendIndex, setSelectedTrendIndex] = useState(null);
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));

  const monthOptions = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];
  const yearOptions = Array.from({ length: 7 }, (_, i) => String(currentDate.getFullYear() - 3 + i));

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await financeApi.getDashboard({ month: Number(selectedMonth), year: Number(selectedYear) });
      setDashboard(data);
    } catch (err) {
      setError(err.message || "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Dashboard Payroll" }));
    loadDashboard();
  }, [dispatch, loadDashboard]);

  useEffect(() => {
    if (dashboard?.trends?.length) {
      setSelectedTrendIndex(dashboard.trends.length - 1);
    }
  }, [dashboard]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary" />
        <span className="ml-3 text-base-content/60">Memuat...</span>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-error">{error}</p>
        <button className="btn btn-primary btn-sm" onClick={loadDashboard}>
          Coba Lagi
        </button>
      </div>
    );

  /* ─── Data dari backend ─────────────────────────────── */
  const period = dashboard?.period || {};
  const fin = dashboard?.financial_summary || {};
  const trends = dashboard?.trends || [];
  const topEarners = dashboard?.top_earners || [];

  const basicSalary = Number(fin.total_basic_salary || 0);
  const tunjangan = Number(fin.total_allowance || 0);
  const reimbursement = Number(fin.total_reimbursement || 0);
  const potongan = Number(fin.total_deduction || 0);
  const totalPayout = Number(fin.total_payout || 0);
  const activeTrendIndex =
    selectedTrendIndex !== null && selectedTrendIndex >= 0
      ? selectedTrendIndex
      : Math.max(trends.length - 1, 0);
  const activeTrend = trends[activeTrendIndex] || {};
  const activePeriodLabel = periodLabel(
    activeTrend.period_month || period.month,
    activeTrend.period_year || period.year
  );

  /* ─── Chart (Line / Area 4 series) ─────────────────── */
  const cats = trends.map((t) => monthLabel(t.period_month, t.period_year));
  // Total Income (gross) = net_salary + deduction (reverse-engineering basic+reimb)
  const incomeData = trends.map(
    (t) => Number(t.total_salary || 0) + Number(t.total_deduction || 0)
  );
  const tunjData = trends.map((t) => Number(t.total_reimbursement || 0));
  const potData = trends.map((t) => Number(t.total_deduction || 0));
  const bayarData = trends.map((t) => Number(t.total_salary || 0)); // net
  const chartPeak = Math.max(
    0,
    ...incomeData,
    ...tunjData,
    ...potData,
    ...bayarData
  );
  const chartMax = chartPeak > 0 ? Math.ceil(chartPeak / 5000000) * 5000000 : 5000000;
  const highlightedIncomeValue = incomeData[activeTrendIndex] || 0;
  const highlightedIncomeIndex = Math.max(activeTrendIndex, 0);

  const chartOpts = {
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            setSelectedTrendIndex(config.dataPointIndex);
          }
        },
      },
    },
    stroke: {
      curve: "smooth",
      width: [4, 2, 2, 3],
      lineCap: "round",
    },
    fill: {
      type: ["gradient", "solid", "solid", "solid"],
      gradient: {
        shade: "light",
        type: "vertical",
        opacityFrom: 0.55,
        opacityTo: 0.08,
      },
    },
    markers: {
      size: [5, 3, 3, 4],
      strokeWidth: 2,
      hover: { sizeOffset: 3 },
    },
    legend: {
      position: "bottom",
      horizontalAlign: "left",
      markers: { radius: 50 },
      fontSize: "12px",
    },
    xaxis: {
      categories: cats,
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: {
        show: true,
        position: "back",
        stroke: {
          color: "#94a3b8",
          width: 1,
          dashArray: 4,
        },
      },
      labels: {
        style: {
          colors: "#64748b",
          fontSize: "11px",
          fontWeight: 500,
        },
      },
    },
    yaxis: {
      min: 0,
      max: chartMax,
      tickAmount: 4,
      crosshairs: {
        show: true,
        position: "back",
        stroke: {
          color: "#dbe3ef",
          width: 1,
          dashArray: 0,
        },
      },
      labels: {
        formatter: (v) => `${(v / 1000000).toFixed(0)}M`,
        style: {
          colors: "#94a3b8",
          fontSize: "12px",
        },
      },
    },
    tooltip: { y: { formatter: (v) => fmt(v) }, shared: true },
    grid: {
      borderColor: "#dbe3ef",
      strokeDashArray: 0,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
      padding: { left: 4, right: 4 },
    },
    colors: ["#1e40af", "#06b6d4", "#f87171", "#22c55e"],
    dataLabels: { enabled: false },
    annotations: {
      points: incomeData.length
        ? [
            {
              x: cats[highlightedIncomeIndex],
              y: highlightedIncomeValue,
              marker: {
                size: 6,
                fillColor: "#ffffff",
                strokeColor: "#1e40af",
                strokeWidth: 3,
              },
              label: {
                borderColor: "#1d4ed8",
                offsetY: -10,
                style: {
                  background: "#1d4ed8",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: {
                    left: 10,
                    right: 10,
                    top: 6,
                    bottom: 6,
                  },
                },
                text: fmt(highlightedIncomeValue),
              },
            },
          ]
        : [],
    },
  };

  const chartSeries = [
    { name: "Total Pendapatan", data: incomeData, type: "area" },
    { name: "Total Tunjangan", data: tunjData, type: "line" },
    { name: "Total Potongan", data: potData, type: "line" },
    { name: "Total Dibayarkan", data: bayarData, type: "line" },
  ];
  const activeIncome = Number(chartSeries[0]?.data?.[activeTrendIndex] || 0);
  const activeTunjangan = Number(chartSeries[1]?.data?.[activeTrendIndex] || 0);
  const activePotongan = Number(chartSeries[2]?.data?.[activeTrendIndex] || 0);
  const activeDibayarkan = Number(chartSeries[3]?.data?.[activeTrendIndex] || 0);

  /* ─── Donut Chart ───────────────────────────────────── */
  const donutSeries = [basicSalary, tunjangan, reimbursement, potongan];
  const donutOpts = {
    labels: ["Gaji Pokok", "Tunjangan", "Reimbursement", "Potongan"],
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              fontSize: "13px",
              color: "#6b7280",
              formatter: () => fmtM(totalPayout),
            },
            value: {
              show: true,
              fontSize: "16px",
              fontWeight: 700,
              formatter: (v) => fmtM(Number(v)),
            },
          },
        },
      },
    },
    legend: { show: false },
    colors: ["#1e40af", "#22d3ee", "#a78bfa", "#f87171"],
    tooltip: { y: { formatter: (v) => fmt(v) } },
    dataLabels: { enabled: false },
  };

  const donutTotal = basicSalary + tunjangan + reimbursement + potongan;
  const pct = (val) =>
    donutTotal > 0 ? `${((val / donutTotal) * 100).toFixed(1)}%` : "0.0%";

  return (
    <div>
      {/* ── Period filter ─────────────────────────────────── */}
      <div className="alert bg-base-100 border border-base-300 mb-4">
        <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Periode:</span>
            <span className="badge badge-primary badge-outline">
              {monthOptions.find((m) => m.value === selectedMonth)?.label} {selectedYear}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="select select-bordered select-sm"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setSelectedTrendIndex(null); }}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              className="select select-bordered select-sm"
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedTrendIndex(null); }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Main 2-column grid (left 3/5 + right 2/5) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== LEFT ===== */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* 3 stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Gaji Pokok */}
            <div className="card bg-base-100 border border-base-300 shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <WalletIcon className="w-5 h-5 text-blue-700" />
                </div>
                <span className="text-xs font-medium text-base-content/70 leading-tight">
                  Total Gaji Pokok
                </span>
              </div>
              <p className="text-lg font-bold text-blue-700">{fmt(basicSalary)}</p>
            </div>

            {/* Tunjangan */}
            <div className="card bg-base-100 border border-base-300 shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-cyan-100 p-2 rounded-lg">
                  <GiftIcon className="w-5 h-5 text-cyan-600" />
                </div>
                <span className="text-xs font-medium text-base-content/70 leading-tight">
                  Total Tunjangan
                </span>
              </div>
              <p className="text-lg font-bold text-cyan-600">{fmt(tunjangan)}</p>
            </div>

            {/* Potongan */}
            <div className="card bg-base-100 border border-base-300 shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-red-100 p-2 rounded-lg">
                  <ReceiptPercentIcon className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-xs font-medium text-base-content/70 leading-tight">
                  Total Potongan
                </span>
              </div>
              <p className="text-lg font-bold text-red-500">{fmt(potongan)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="card bg-base-100 border border-base-300 shadow p-5 flex-1">
            <div className="flex items-start justify-between mb-3 gap-4">
              <div>
                <h3 className="font-semibold text-base">Grafik Pengeluaran Payroll</h3>
                <p className="text-xs text-base-content/50 mt-1">
                  Klik titik pada bulan untuk melihat rincian total payroll.
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-base-content/50">Periode aktif</p>
                <p className="text-sm font-semibold text-blue-700">{activePeriodLabel}</p>
              </div>
            </div>
            {trends.length === 0 ? (
              <p className="text-center text-base-content/40 py-10">
                Belum ada data tren
              </p>
            ) : (
              <>
                <Chart
                  options={chartOpts}
                  series={chartSeries}
                  type="line"
                  height={270}
                />

                <div className="mt-4 rounded-xl border border-base-300 bg-gradient-to-br from-base-100 to-slate-50 px-4 py-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4 gap-4 border-b border-base-300/80 pb-3">
                    <div>
                      <h3 className="font-bold text-base">Total Payroll</h3>
                      <p className="text-xs text-base-content/50 mt-1">{activePeriodLabel}</p>
                    </div>
                    <div className="rounded-lg bg-white/80 px-3 py-2 text-right border border-base-300/70">
                      <p className="text-[11px] uppercase tracking-wide text-base-content/40">Ringkasan</p>
                      <p className="text-sm font-bold text-green-600">{fmt(activeDibayarkan)}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-3 py-2 border border-slate-200/80">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-3 h-3 rounded-full bg-slate-400 inline-block shrink-0" />
                        <span className="text-base-content/70 truncate">Total Pendapatan</span>
                      </div>
                      <div className="flex items-center gap-3 text-right shrink-0">
                        <span className="text-[11px] uppercase tracking-wide text-base-content/40">
                          Gross
                        </span>
                        <span className="w-32 sm:w-36 font-semibold text-blue-700">
                          {fmt(activeIncome)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-3 py-2 border border-cyan-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shrink-0" />
                        <span className="text-base-content/70 truncate">Total Tunjangan</span>
                      </div>
                      <div className="flex items-center gap-3 text-right shrink-0">
                        <span className="text-[11px] uppercase tracking-wide text-base-content/40">
                          Plus
                        </span>
                        <span className="w-32 sm:w-36 font-semibold text-cyan-600">
                          {fmt(activeTunjangan)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-3 py-2 border border-red-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-3 h-3 rounded-full bg-red-400 inline-block shrink-0" />
                        <span className="text-base-content/70 truncate">Total Potongan</span>
                      </div>
                      <div className="flex items-center gap-3 text-right shrink-0">
                        <span className="text-[11px] uppercase tracking-wide text-base-content/40">
                          Minus
                        </span>
                        <span className="w-32 sm:w-36 font-semibold text-red-500">
                          -{fmt(activePotongan)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-lg bg-green-50 px-3 py-2 border border-green-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block shrink-0" />
                        <span className="text-base-content/70 truncate">Total Dibayarkan</span>
                      </div>
                      <div className="flex items-center gap-3 text-right shrink-0">
                        <span className="text-[11px] uppercase tracking-wide text-base-content/40">
                          Netto
                        </span>
                        <span className="w-32 sm:w-36 font-semibold text-green-600">
                          {fmt(activeDibayarkan)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== RIGHT ===== */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Donut card */}
          <div className="card bg-base-100 border border-base-300 shadow p-5">
            <h3 className="font-bold text-base">
              Rincian Gaji Bulan {periodLabel(period.month, period.year)}
            </h3>
            <p className="text-sm text-base-content/50 mb-3">
              Distribusi Pendapatan
            </p>

            <Chart
              options={donutOpts}
              series={donutSeries}
              type="donut"
              height={230}
            />

            {/* Custom legend */}
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-800 inline-block" />
                  <span>Gaji Pokok:</span>
                </div>
                <span className="font-semibold">{pct(basicSalary)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />
                  <span>Tunjangan :</span>
                </div>
                <span className="font-semibold">{pct(tunjangan)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-violet-400 inline-block" />
                  <span>Reimbursement</span>
                </div>
                <span className="font-semibold">{pct(reimbursement)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                  <span>Potongan</span>
                </div>
                <span className="font-semibold text-red-500">{pct(potongan)}</span>
              </div>
            </div>
          </div>

          {/* Top 5 Earners table */}
          <div className="card bg-base-100 border border-base-300 shadow p-5 flex-1">
            <h3 className="font-bold text-base mb-3">
              5 Karyawan dengan Payroll Tertinggi
            </h3>
            <div className="overflow-x-auto rounded-xl border border-base-300/80">
              <table className="table table-sm w-full min-w-[520px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-base-content/50">
                  <tr>
                    <th className="w-10">No</th>
                    <th>Nama Karyawan</th>
                    <th>Departemen</th>
                    <th className="text-right">Total Payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {topEarners.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-base-content/40 py-6"
                      >
                        Belum ada data
                      </td>
                    </tr>
                  ) : (
                    topEarners.slice(0, 5).map((emp, i) => (
                      <tr key={i} className="border-t border-base-200/80 hover:bg-slate-50/80">
                        <td className="text-base-content/50 text-xs font-medium align-middle">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                            {i + 1}
                          </span>
                        </td>
                        <td className="align-middle">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-base-content truncate">
                              {emp.name || "-"}
                            </p>
                            <p className="text-[11px] text-base-content/40">Payroll tertinggi</p>
                          </div>
                        </td>
                        <td className="align-middle text-xs text-base-content/60">
                          <span className="inline-flex rounded-md bg-base-200 px-2 py-1 whitespace-nowrap">
                            {emp.department_name || "-"}
                          </span>
                        </td>
                        <td className="align-middle text-right font-semibold text-blue-700 text-sm whitespace-nowrap">
                          {fmt(emp.total_pay)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-right mt-3">
              <button
                className="text-sm text-blue-700 hover:underline font-medium"
                onClick={() =>
                  navigate(
                    `/app/payroll/transfers?month=${period.month || ""}&year=${period.year || ""}&status=all&sort=top-pay`
                  )
                }
              >
                Lihat Semua
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceDashboard;
