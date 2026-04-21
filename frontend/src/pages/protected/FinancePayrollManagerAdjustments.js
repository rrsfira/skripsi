import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { financeApi } from "../../features/finance/api";

const monthOptions = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const statusLabelMap = {
  draft: "Draft",
  submitted: "Aktif untuk Payroll",
  approved: "Aktif untuk Payroll",
  rejected: "Nonaktif",
};

const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const getCurrentPeriod = () => {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
};

function FinancePayrollManagerAdjustments() {
  const dispatch = useDispatch();
  const period = getCurrentPeriod();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const [periodMonth, setPeriodMonth] = useState(period.month);
  const [periodYear, setPeriodYear] = useState(period.year);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await financeApi.getPayrollManagerAdjustments({
        month: Number(periodMonth),
        year: Number(periodYear),
      });

      setRows(result?.data || []);
    } catch (err) {
      setRows([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [periodMonth, periodYear]);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Monitoring Adjustment" }));
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      const matchStatus =
        !statusFilter || status === String(statusFilter).toLowerCase();
      const matchKeyword =
        !keyword ||
        [
          item.employee_name,
          item.employee_code,
          item.department_name,
          item.position_name,
        ]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(keyword));

      return matchStatus && matchKeyword;
    });
  }, [rows, search, statusFilter]);

  return (
    <>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <TitleCard title="Monitoring Adjustment Payroll" topMargin="mt-0">
        <div className="grid md:grid-cols-4 grid-cols-1 gap-3 mb-4">
          <input
            className="input input-bordered w-full"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama/kode/departemen"
          />

          <select
            className="select select-bordered w-full"
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <input
            className="input input-bordered w-full"
            value={periodYear}
            onChange={(event) => setPeriodYear(event.target.value)}
            placeholder="Tahun"
          />

          <select
            className="select select-bordered w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="submitted">Aktif untuk Payroll</option>
            <option value="approved">Aktif (Legacy)</option>
            <option value="rejected">Nonaktif</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Periode</th>
                <th>Bonus</th>
                <th>Tunjangan Lain</th>
                <th>Potongan Lain</th>
                <th>Status</th>
                <th>Catatan Atasan</th>
                <th>Dibuat Oleh</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((item) => {
                const itemStatus = String(item.status || "").toLowerCase();

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold">
                        {item.employee_name || "-"}
                      </div>
                      <div className="text-xs opacity-70">
                        {item.employee_code || "-"}
                      </div>
                    </td>
                    <td>
                      {item.period_month}/{item.period_year}
                    </td>
                    <td>{formatCurrency(item.bonus)}</td>
                    <td>{formatCurrency(item.other_allowance)}</td>
                    <td>{formatCurrency(item.other_deduction)}</td>
                    <td>{statusLabelMap[itemStatus] || item.status}</td>
                    <td className="max-w-[220px] whitespace-pre-wrap">
                      {item.notes || "-"}
                    </td>
                    <td>{item.submitted_by_name || "-"}</td>
                  </tr>
                );
              })}

              {!filteredRows.length && !loading && (
                <tr>
                  <td colSpan={8} className="text-center opacity-70">
                    Tidak ada data adjustment payroll pada filter ini
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={8} className="text-center opacity-70">
                    Memuat data adjustment payroll...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TitleCard>
    </>
  );
}

export default FinancePayrollManagerAdjustments;
