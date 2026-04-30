import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import TitleCard from "../../components/Cards/TitleCard";
import { setPageTitle, showNotification } from "../../features/common/headerSlice";
import { adminApi } from "../../features/admin/api";

const statusLabelMap = {
  submitted: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function ApproveHRAllowance() {
  const dispatch = useDispatch();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    dispatch(setPageTitle({ title: "Approval Tunjangan HR" }));
    loadData();
  }, [dispatch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await adminApi.getPayrollManagerAdjustments();
      const adjustments = result?.data || [];
      setData(adjustments);
    } catch (error) {
      dispatch(showNotification({ message: error.message, status: 0 }));
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 pending (approval)
  const pendingData = useMemo(
    () => data.filter((d) => d.status === "submitted"),
    [data],
  );

  // 🔹 history
  const historyData = useMemo(
    () => data.filter((d) => d.status !== "submitted"),
    [data],
  );

  const handleApprove = async (id) => {
    try {
      setSubmitting(true);
      await adminApi.approvePayrollManagerAdjustment(id);
      dispatch(showNotification({ message: "Adjustment berhasil disetujui", status: 1 }));
      setSelected(null);
      await loadData();
    } catch (error) {
      dispatch(showNotification({ message: error.message, status: 0 }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    try {
      setSubmitting(true);
      await adminApi.rejectPayrollManagerAdjustment(id, rejectReason);
      dispatch(showNotification({ message: "Adjustment berhasil ditolak", status: 1 }));
      setSelected(null);
      setRejectReason("");
      await loadData();
    } catch (error) {
      dispatch(showNotification({ message: error.message, status: 0 }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ================== CARD 1: APPROVAL ================== */}
      <TitleCard
        title="Perlu Persetujuan"
        topMargin="mt-0"
        TopSideButtons={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowApproval(!showApproval)}
            disabled={loading}
          >
            {showApproval ? "Sembunyikan" : `Lihat (${pendingData.length})`}
          </button>
        }
      >
        {/* ⛔ default kosong */}
        {loading ? (
          <div className="text-center py-10">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          showApproval && (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th>Periode</th>
                    <th>Bonus</th>
                    <th>Potongan Lain</th>
                    <th>Status</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {pendingData.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-semibold">{item.employee_name}</div>
                        <div className="text-xs opacity-70">
                          {item.employee_code}
                        </div>
                      </td>

                      <td>
                        {item.period_month}/{item.period_year}
                      </td>

                      <td>
                        Rp {(Number(item.bonus) || 0).toLocaleString("id-ID")}
                      </td>

                      <td>
                        Rp {(Number(item.other_deduction) || 0).toLocaleString("id-ID")}
                      </td>

                      <td>
                        <span className="badge badge-warning">
                          {statusLabelMap[item.status]}
                        </span>
                      </td>

                      <td className="max-w-xs whitespace-pre-wrap">
                        {item.notes || "-"}
                      </td>

                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelected(item)}
                          disabled={submitting}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!pendingData.length && (
                    <tr>
                      <td colSpan={7} className="text-center opacity-70">
                        Tidak ada data pending
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </TitleCard>

      {/* ================== CARD 2: HISTORY ================== */}
      <TitleCard title="Riwayat Approval" topMargin="mt-6">
        {loading ? (
          <div className="text-center py-10">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Pegawai</th>
                  <th>Periode</th>
                  <th>Bonus</th>
                  <th>Potongan Lain</th>
                  <th>Status</th>
                  <th>Catatan HR</th>
                  <th>Catatan Reviewer</th>
                </tr>
              </thead>

              <tbody>
                {historyData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold">{item.employee_name}</div>
                      <div className="text-xs opacity-70">
                        {item.employee_code}
                      </div>
                    </td>

                    <td>
                      {item.period_month}/{item.period_year}
                    </td>

                    <td>
                      Rp {(Number(item.bonus) || 0).toLocaleString("id-ID")}
                    </td>

                    <td>
                      Rp {(Number(item.other_deduction) || 0).toLocaleString("id-ID")}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          item.status === "approved"
                            ? "badge-success"
                            : "badge-error"
                        }`}
                      >
                        {statusLabelMap[item.status]}
                      </span>
                    </td>

                    <td className="max-w-xs whitespace-pre-wrap">
                      {item.notes || "-"}
                    </td>

                    <td className="max-w-xs whitespace-pre-wrap">
                      {item.review_notes || "-"}
                    </td>

                  </tr>
                ))}

                {!historyData.length && (
                  <tr>
                    <td colSpan={6} className="text-center opacity-70">
                      Belum ada riwayat
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </TitleCard>

      {/* ================== MODAL ================== */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-[450px] max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">Detail Tunjangan</h3>

            <div className="space-y-2 text-sm mb-6">
              <div>
                <span className="font-semibold">Pegawai:</span> {selected.employee_name}
              </div>
              <div>
                <span className="font-semibold">Kode:</span> {selected.employee_code}
              </div>
              <div>
                <span className="font-semibold">Periode:</span> {selected.period_month}/{selected.period_year}
              </div>
              <div>
                <span className="font-semibold">Bonus:</span> Rp {(Number(selected.bonus) || 0).toLocaleString("id-ID")}
              </div>
              <div>
                <span className="font-semibold">Potongan Lain:</span> Rp {(Number(selected.other_deduction) || 0).toLocaleString("id-ID")}
              </div>
              <div>
                <span className="font-semibold">Catatan HR:</span>
                <p className="whitespace-pre-wrap mt-1 p-2 bg-gray-100 rounded">
                  {selected.notes || "-"}
                </p>
              </div>
            </div>

            {/* Reviewer notes input */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Catatan Reviewer</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                placeholder="Tuliskan catatan atau alasan persetujuan/penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                className={`btn btn-success btn-sm ${submitting ? "loading" : ""}`}
                onClick={() => handleApprove(selected.id)}
                disabled={submitting}
              >
                Approve
              </button>

              <button
                className={`btn btn-error btn-sm ${submitting ? "loading" : ""}`}
                onClick={() => handleReject(selected.id)}
                disabled={submitting}
              >
                Reject
              </button>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelected(null);
                  setRejectReason("");
                }}
                disabled={submitting}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ApproveHRAllowance;
