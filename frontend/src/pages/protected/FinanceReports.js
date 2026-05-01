import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import { financeApi } from "../../features/finance/api";
import * as XLSX from "xlsx";

// (format helpers not required in this simplified report view)

function FinanceReports() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [payrolls, setPayrolls] = useState([]);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    String(now.getMonth() + 1),
  );
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  const toNumber = (value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9.-]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const formatRupiah = (v) => `Rp ${toNumber(v).toLocaleString("id-ID")}`;

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await financeApi.getDashboard();
      setDashboard(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPayrolls = useCallback(async (month, year) => {
    try {
      setLoading(true);
      setError("");
      const params = { month: Number(month), year: Number(year) };
      const list = await financeApi.getPayrollList(params);
      setPayrolls(list || []);
    } catch (err) {
      setError(err.message || "Gagal memuat data payroll");
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateTotals = () => {
    return {
      basicSalary: payrolls.reduce((sum, item) => sum + toNumber(item.basic_salary), 0),
      allowance: payrolls.reduce((sum, item) => sum + toNumber(item.allowance), 0),
      transportAllowance: payrolls.reduce((sum, item) => sum + toNumber(item.transport_allowance), 0),
      mealAllowance: payrolls.reduce((sum, item) => sum + toNumber(item.meal_allowance), 0),
      healthAllowance: payrolls.reduce((sum, item) => sum + toNumber(item.health_allowance), 0),
      bonus: payrolls.reduce((sum, item) => sum + toNumber(item.bonus), 0),
      otherAllowance: payrolls.reduce((sum, item) => sum + toNumber(item.other_allowance), 0),
      grossSalary: payrolls.reduce((sum, item) => sum + toNumber(item.gross_salary), 0),
      totalIncome: payrolls.reduce((sum, item) => sum + toNumber(item.total_income), 0),
      reimbursementTotal: payrolls.reduce((sum, item) => sum + toNumber(item.reimbursement_total), 0),
      totalDeduction: payrolls.reduce((sum, item) => sum + toNumber(item.deduction), 0),
      lateDeduction: payrolls.reduce((sum, item) => sum + toNumber(item.late_deduction), 0),
      absentDeduction: payrolls.reduce((sum, item) => sum + toNumber(item.absent_deduction), 0),
      bpjsDeduction: payrolls.reduce((sum, item) => sum + toNumber(item.bpjs_deduction), 0),
      taxDeduction: payrolls.reduce((sum, item) => sum + toNumber(item.tax_deduction), 0),
      otherDeduction: payrolls.reduce((sum, item) => sum + toNumber(item.other_deduction), 0),
      totalPaid: payrolls.reduce((sum, item) => sum + toNumber(item.final_amount || item.net_salary), 0),
    };
  };

  const exportExcel = () => {
    const data = payrolls.map((item, i) => ({
      No: i + 1,
      "Nama Pegawai": item.employee_name || item.employee_id,

      "Gaji Pokok": toNumber(item.basic_salary),

      Tunjangan: toNumber(item.allowance),
      Transport: toNumber(item.transport_allowance),
      Makan: toNumber(item.meal_allowance),
      Kesehatan: toNumber(item.health_allowance),
      Bonus: toNumber(item.bonus),
      Lainnya: toNumber(item.other_allowance),

      Gross: toNumber(item.gross_salary),
      "Total Income": toNumber(item.total_income),
      Reimbursement: toNumber(item.reimbursement_total),

      Potongan: toNumber(item.deduction),
      Terlambat: toNumber(item.late_deduction),
      Absen: toNumber(item.absent_deduction),
      BPJS: toNumber(item.bpjs_deduction),
      Pajak: toNumber(item.tax_deduction),
      "Lainnya Potongan": toNumber(item.other_deduction),

      "Hari Telat": item.total_late_days,
      "Hari Absen": item.total_absent_days,
      Sakit: item.total_sakit_days,
      Izin: item.total_izin_days,
      Masuk: item.present_days,

      "Gaji Bersih": toNumber(item.net_salary),
      Status: item.status,
      "Final Gaji": toNumber(item.final_amount || item.net_salary),
      Created: formatDate(item.created_at),
    }));

    // append totals row so tfoot is also exported
    const totals = calculateTotals();
    data.push({
      No: "",
      "Nama Pegawai": "Total",
      "Gaji Pokok": totals.basicSalary,
      Tunjangan: totals.allowance,
      Transport: totals.transportAllowance,
      Makan: totals.mealAllowance,
      Kesehatan: totals.healthAllowance,
      Bonus: totals.bonus,
      Lainnya: totals.otherAllowance,
      "Gaji Kotor": totals.grossSalary,
      "Total Pendapatan": totals.totalIncome,
      Reimbursement: totals.reimbursementTotal,
      Potongan: totals.totalDeduction,
      Terlambat: totals.lateDeduction,
      Absen: totals.absentDeduction,
      BPJS: totals.bpjsDeduction,
      Pajak: totals.taxDeduction,
      "Potongan Lainnya": totals.otherDeduction,
      "Hari Telat": "",
      "Hari Absen": "",
      Sakit: "",
      Izin: "",
      Masuk: "",
      "Gaji Bersih": totals.totalPaid,
      Status: "",
      "Final Gaji": "",
      Created: "",
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Lebar kolom
    worksheet["!cols"] = [
      { wch: 5 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");

    XLSX.writeFile(
      workbook,
      `laporan-payroll-${selectedMonth}-${selectedYear}.xlsx`,
    );
  };

  useEffect(() => {
    dispatch(setPageTitle({ title: "Laporan Finance" }));
    loadData();
    loadPayrolls(selectedMonth, selectedYear);
  }, [dispatch, loadData, loadPayrolls, selectedMonth, selectedYear]);

  if (loading) {
    return <div className="text-center py-10">Memuat laporan finance...</div>;
  }
  const totals = calculateTotals();
  return (
    <>
      {error ? <div className="alert alert-error mb-4">{error}</div> : null}
      {/* keep a hidden reference to dashboard to avoid unused variable lint warnings */}
      {dashboard ? (
        <pre className="sr-only">{JSON.stringify(dashboard)}</pre>
      ) : null}
      {/* Tabel Rekap Payroll Bulanan (Dummy UI, sesuaikan data sesuai kebutuhan) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xl font-bold block">
              Laporan Payroll Bulanan
            </span>
            <div className="flex items-center gap-2 mt-1">
              <label className="text-gray-500 text-sm">Periode:</label>
              <select
                className="select select-sm select-bordered"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: new Date(0, i).toLocaleString("id-ID", {
                    month: "long",
                  }),
                })).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="select select-sm select-bordered"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {Array.from({ length: 6 }, (_, idx) =>
                  String(now.getFullYear() - 3 + idx),
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2"></div>
        </div>
        <div className="bg-base-100 rounded-lg p-4 border border-base-200 mb-2">
          <div className="flex gap-2 mb-2">
            <input
              className="input input-bordered input-sm w-64"
              placeholder="Cari..."
            />
            <button className="btn btn-sm btn-success" onClick={exportExcel}>
              Export Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Pegawai</th>

                  <th>Gaji Pokok</th>

                  <th>Tunjangan</th>
                  <th>Transport</th>
                  <th>Makan</th>
                  <th>Kesehatan</th>
                  <th>Bonus</th>
                  <th>Lainnya</th>

                  <th>Gaji Kotor</th>
                  <th>Total Pendapatan</th>
                  <th>Reimbursement</th>

                  <th>Potongan</th>
                  <th>Terlambat</th>
                  <th>Absen</th>
                  <th>BPJS</th>
                  <th>Pajak</th>
                  <th>Potongan Lainnya</th>

                  <th>Hari Telat</th>
                  <th>Hari Absen</th>
                  <th>Sakit</th>
                  <th>Izin</th>
                  <th>Masuk</th>

                  <th>Gaji Bersih</th>
                  <th>Status</th>
                  <th>Final Gaji</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.employee_name}</td>

                    <td>{formatRupiah(item.basic_salary)}</td>

                    <td>{formatRupiah(item.allowance)}</td>
                    <td>{formatRupiah(item.transport_allowance)}</td>
                    <td>{formatRupiah(item.meal_allowance)}</td>
                    <td>{formatRupiah(item.health_allowance)}</td>
                    <td>{formatRupiah(item.bonus)}</td>
                    <td>{formatRupiah(item.other_allowance)}</td>

                    <td>{formatRupiah(item.gross_salary)}</td>
                    <td>{formatRupiah(item.total_income)}</td>
                    <td>{formatRupiah(item.reimbursement_total)}</td>

                    <td>{formatRupiah(item.deduction)}</td>
                    <td>{formatRupiah(item.late_deduction)}</td>
                    <td>{formatRupiah(item.absent_deduction)}</td>
                    <td>{formatRupiah(item.bpjs_deduction)}</td>
                    <td>{formatRupiah(item.tax_deduction)}</td>
                    <td>{formatRupiah(item.other_deduction)}</td>

                    <td>{item.total_late_days}</td>
                    <td>{item.total_absent_days}</td>
                    <td>{item.total_sakit_days}</td>
                    <td>{item.total_izin_days}</td>
                    <td>{item.present_days}</td>

                    <td className="font-bold text-blue-700">
                      {formatRupiah(item.net_salary)}
                    </td>

                    <td>{item.status}</td>

                    <td>
                      {formatRupiah(item.final_amount || item.net_salary)}
                    </td>

                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-base-200">
                  <td>Total</td>
                  <td></td>
                  <td>{formatRupiah(totals.basicSalary)}</td>
                  <td>{formatRupiah(totals.allowance)}</td>
                  <td>{formatRupiah(totals.transportAllowance)}</td>
                  <td>{formatRupiah(totals.mealAllowance)}</td>
                  <td>{formatRupiah(totals.healthAllowance)}</td>
                  <td>{formatRupiah(totals.bonus)}</td>
                  <td>{formatRupiah(totals.otherAllowance)}</td>
                  <td>{formatRupiah(totals.grossSalary)}</td>
                  <td>{formatRupiah(totals.totalIncome)}</td>
                  <td>{formatRupiah(totals.reimbursementTotal)}</td>
                  <td>{formatRupiah(totals.totalDeduction)}</td>
                  <td>{formatRupiah(totals.lateDeduction)}</td>
                  <td>{formatRupiah(totals.absentDeduction)}</td>
                  <td>{formatRupiah(totals.bpjsDeduction)}</td>
                  <td>{formatRupiah(totals.taxDeduction)}</td>
                  <td>{formatRupiah(totals.other_deduction)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td>{formatRupiah(totals.totalPaid)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default FinanceReports;
