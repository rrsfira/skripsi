import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { financeApi } from "../../features/finance/api";

const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

function FinanceReports() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

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

  useEffect(() => {
    dispatch(setPageTitle({ title: "Laporan Finance" }));
    loadData();
  }, [dispatch, loadData]);

  if (loading) {
    return <div className="text-center py-10">Memuat laporan finance...</div>;
  }

  const summary = dashboard?.financial_summary || {};
  const trends = dashboard?.trends || [];
  const reimbursementByType = dashboard?.reimbursements?.by_type || [];
  const topEarners = dashboard?.top_earners || [];

  return (
    <>
      {/* Tabel Rekap Payroll Bulanan (Dummy UI, sesuaikan data sesuai kebutuhan) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xl font-bold block">
              Laporan Payroll Bulanan
            </span>
            <span className="text-gray-500 text-sm block">
              Periode: Februari 2026
            </span>
          </div>
          <button className="btn btn-primary">View Detail</button>
        </div>
        <div className="bg-base-100 rounded-lg p-4 border border-base-200 mb-2">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <label className="font-semibold">Departemen:</label>
            <select className="select select-bordered select-sm w-48">
              <option>Human Resources</option>
              <option>Finance</option>
              <option>IT</option>
            </select>
            <label className="font-semibold ml-4">Jabatan:</label>
            <select className="select select-bordered select-sm w-48">
              <option>HR & GA Manager</option>
              <option>Staff</option>
            </select>
            <input
              className="input input-bordered input-sm ml-4 w-48"
              placeholder="Cari..."
            />
            <button className="btn btn-sm btn-primary ml-2">Tampilkan</button>
          </div>
          <div className="flex gap-2 mb-2">
            <input
              className="input input-bordered input-sm w-64"
              placeholder="Cari..."
            />
            <button className="btn btn-sm btn-outline">Export Excel</button>
            <button className="btn btn-sm btn-outline">Download PDF</button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>No. Pegawai</th>
                  <th>Gaji Pokok</th>
                  <th>Tunjangan</th>
                  <th>Potongan</th>
                  <th>Total Gaji</th>
                  <th>Total Gaji</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1.</td>
                  <td>HR</td>
                  <td>EMP008</td>
                  <td>Rp 8.500.000</td>
                  <td>Rp 2.385.000</td>
                  <td>Rp 340.000</td>
                  <td className="font-bold text-blue-700">Rp 10.545.000</td>
                  <td>Rp 10.545.000</td>
                </tr>
                {[2, 3, 4, 5].map((n) => (
                  <tr key={n}>
                    <td>{n}.</td>
                    <td>–</td>
                    <td>–</td>
                    <td>–</td>
                    <td>Rp 2.385.000</td>
                    <td>Rp 340.000</td>
                    <td>Rp 10.545.000</td>
                    <td>Rp 10.545.000</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Rekap total di bawah tabel */}
          <div className="mt-2 border-t pt-2 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                Total Pendapatan:{" "}
                <span className="font-bold text-green-700">Rp 10.885.000</span>
              </div>
              <div>
                Total Tunjangan:{" "}
                <span className="font-bold text-blue-700">Rp 2.385.000</span>
              </div>
              <div>
                Total Potongan:{" "}
                <span className="font-bold text-blue-700">Rp 340.000</span>
              </div>
              <div>
                Total Dibayarkan:{" "}
                <span className="font-bold text-blue-700">Rp 10.545.000</span>
              </div>
            </div>
            <div className="mt-2 text-right text-xs text-gray-500">
              1–10 dari 100 entri
            </div>
            <div className="mt-2 flex gap-1 justify-end">
              <button className="btn btn-xs btn-outline btn-active">1</button>
              <button className="btn btn-xs btn-outline">2</button>
              <button className="btn btn-xs btn-outline">3</button>
              <span className="mx-1">…</span>
              <button className="btn btn-xs btn-outline">10</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default FinanceReports;
