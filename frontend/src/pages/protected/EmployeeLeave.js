import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { pegawaiApi } from "../../features/pegawai/api";

const INITIAL_FORM = {
  leave_type: "izin",
  start_date: "",
  end_date: "",
  reason: "",
  bukti: null,
};

const LEAVE_TYPE_LABEL = {
  izin: "Izin",
  cuti_tahunan: "Cuti Tahunan",
  cuti_sakit: "Cuti Sakit",
  cuti_melahirkan: "Cuti Melahirkan",
};

const STATUS_BADGE_CLASS = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-error",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const calculateRequestedDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  )
    return 0;

  const difference = end - start;
  return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
};

const getFileTypeFromPath = (filePath) => {
  if (!filePath) return "unknown";

  const lowerPath = String(filePath).toLowerCase();
  if (lowerPath.endsWith(".pdf")) return "pdf";
  if (
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg") ||
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".webp")
  ) {
    return "image";
  }

  return "unknown";
};

const getAssetUrl = (filePath) => {
  if (!filePath) return "";
  if (/^https?:\/\//i.test(filePath)) return filePath;

  const configuredBaseUrl = process.env.REACT_APP_BASE_URL;
  const fallbackBaseUrl = "http://localhost:5000";
  const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/$/, "");
  const normalizedPath = String(filePath).replace(/^\/+/, "");

  return `${baseUrl}/${normalizedPath}`;
};

function EmployeeLeave() {
  const dispatch = useDispatch();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [profile, setProfile] = useState({});
  const [todayAttendance, setTodayAttendance] = useState({});
  const [selectedProof, setSelectedProof] = useState(null);

  const todayDateKey = new Date().toISOString().split("T")[0];

  const isDateInRange = (startDate, endDate, currentDate) => {
    if (!startDate || !endDate || !currentDate) return false;
    return startDate <= currentDate && endDate >= currentDate;
  };

  const loadData = useCallback(
    async (selectedStatus = statusFilter) => {
      try {
        setLoading(true);
        setError("");

        const [profileResult, requestsResult, todayAttendanceResult] =
          await Promise.allSettled([
            pegawaiApi.getProfile(),
            pegawaiApi.getMyLeaveRequests(),
            pegawaiApi.getAttendanceToday(),
          ]);

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value || {});
        } else {
          setProfile({});
        }

        if (requestsResult.status === "fulfilled") {
          const allData = requestsResult.value?.data || [];
          setAllRequests(allData);
          setRequests(
            selectedStatus
              ? allData.filter((item) => item.status === selectedStatus)
              : allData,
          );
        } else {
          setAllRequests([]);
          setRequests([]);
          setError(
            requestsResult.reason?.message || "Gagal memuat data cuti/izin",
          );
        }

        if (todayAttendanceResult.status === "fulfilled") {
          setTodayAttendance(todayAttendanceResult.value || {});
        } else {
          setTodayAttendance({});
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    dispatch(setPageTitle({ title: "Cuti & Izin Pegawai" }));
    loadData();
  }, [dispatch, loadData]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (
      !form.leave_type ||
      !form.start_date ||
      !form.end_date ||
      !form.reason
    ) {
      setError(
        "Jenis cuti/izin, tanggal mulai, tanggal akhir, dan alasan wajib diisi",
      );
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError("Tanggal akhir tidak boleh lebih kecil dari tanggal mulai");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccessMessage("");
      await pegawaiApi.submitLeaveRequest(form);
      setForm(INITIAL_FORM);
      setSuccessMessage("Pengajuan cuti/izin berhasil dikirim");
      await loadData(statusFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const annualLeaveQuota = profile?.employee?.annual_leave_quota ?? 0;
  const remainingLeaveQuota = profile?.employee?.remaining_leave_quota ?? 0;
  const requestedDays = calculateRequestedDays(form.start_date, form.end_date);
  const pendingCount = allRequests.filter(
    (item) => item.status === "pending",
  ).length;
  const approvedCount = allRequests.filter(
    (item) => item.status === "approved",
  ).length;
  const rejectedCount = allRequests.filter(
    (item) => item.status === "rejected",
  ).length;

  const activeLeaveToday = allRequests.find(
    (item) =>
      item.status === "approved" &&
      isDateInRange(item.start_date, item.end_date, todayDateKey),
  );
  const isAttendanceIntegratedToday = ["izin", "sakit"].includes(
    String(todayAttendance?.status || "").toLowerCase(),
  );

  const openProofModal = (proofPath, leaveType) => {
    if (!proofPath) return;
    setSelectedProof({
      path: proofPath,
      type: getFileTypeFromPath(proofPath),
      leaveType: LEAVE_TYPE_LABEL[leaveType] || leaveType,
    });
  };

  const closeProofModal = () => {
    setSelectedProof(null);
  };

  return (
    <>
      {error ? (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="alert alert-success mb-4">
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Kuota Tahunan</div>
          <div className="stat-value text-primary text-2xl">
            {annualLeaveQuota}
          </div>
          <div className="stat-desc">hari/tahun</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Sisa Kuota</div>
          <div className="stat-value text-success text-2xl">
            {remainingLeaveQuota}
          </div>
          <div className="stat-desc">hari tersedia</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Menunggu</div>
          <div className="stat-value text-warning text-2xl">{pendingCount}</div>
          <div className="stat-desc">pengajuan pending</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Disetujui / Ditolak</div>
          <div className="stat-value text-2xl">
            {approvedCount}/{rejectedCount}
          </div>
          <div className="stat-desc">approved / rejected</div>
        </div>
      </div>

      <TitleCard title="Ajukan Cuti / Izin" topMargin="mt-6">
        <div className="grid md:grid-cols-2 grid-cols-1 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-base-200">
            <p className="text-sm opacity-70">Status Absensi Hari Ini</p>
            <p className="text-lg font-semibold capitalize">
              {todayAttendance?.status || "Belum ada status"}
            </p>
            <p className="text-xs opacity-70 mt-1">
              {isAttendanceIntegratedToday
                ? "Tombol absen otomatis tidak perlu diklik karena status cuti/izin aktif."
                : "Jika pengajuan disetujui untuk hari ini, absensi akan terisi otomatis."}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-base-200">
            <p className="text-sm opacity-70">Pengajuan Aktif Hari Ini</p>
            {activeLeaveToday ? (
              <>
                <p className="text-lg font-semibold">
                  {LEAVE_TYPE_LABEL[activeLeaveToday.leave_type] ||
                    activeLeaveToday.leave_type}
                </p>
                <p className="text-xs opacity-70 mt-1">
                  {formatDate(activeLeaveToday.start_date)} -{" "}
                  {formatDate(activeLeaveToday.end_date)}
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold">Tidak ada</p>
            )}
          </div>
        </div>
        <form
          className="grid md:grid-cols-2 grid-cols-1 gap-4"
          onSubmit={submitForm}
        >
          <select
            className="select select-bordered"
            value={form.leave_type}
            onChange={(e) => updateForm("leave_type", e.target.value)}
          >
            <option value="izin">Izin</option>
            <option value="cuti_tahunan">Cuti Tahunan</option>
            <option value="cuti_sakit">Cuti Sakit</option>
            <option value="cuti_melahirkan">Cuti Melahirkan</option>
          </select>
          <div className="text-sm opacity-70 flex items-center">
            Total pengajuan: <b className="ml-1">{requestedDays} hari</b>
          </div>
          <input
            className="input input-bordered border-base-300 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            type="date"
            value={form.start_date}
            onChange={(e) => updateForm("start_date", e.target.value)}
          />
          <input
            className="input input-bordered border-base-300 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            type="date"
            value={form.end_date}
            onChange={(e) => updateForm("end_date", e.target.value)}
          />
          <textarea
            className="textarea textarea-bordered md:col-span-2"
            placeholder="Alasan pengajuan"
            value={form.reason}
            onChange={(e) => updateForm("reason", e.target.value)}
          />
          <input
            className="file-input file-input-bordered md:col-span-2"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => updateForm("bukti", e.target.files?.[0] || null)}
          />
          <div className="md:col-span-2 text-xs opacity-70">
            Tipe file bukti: PDF/JPG/JPEG/PNG. Bukti bersifat opsional.
          </div>
          <div className="md:col-span-2">
            <button
              className={`btn btn-primary ${submitting ? "loading" : ""}`}
              type="submit"
              disabled={submitting}
            >
              Kirim Pengajuan
            </button>
          </div>
        </form>
      </TitleCard>

      <TitleCard title="Riwayat Pengajuan Cuti / Izin" topMargin="mt-6">
        <div className="flex justify-end mb-4">
          <select
            className="select select-bordered select-sm w-full max-w-xs"
            value={statusFilter}
            onChange={async (e) => {
              const nextStatus = e.target.value;
              setStatusFilter(nextStatus);
              await loadData(nextStatus);
            }}
          >
            <option value="">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div>Memuat data pengajuan...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Diajukan</th>
                  <th>Periode</th>
                  <th>Jenis</th>
                  <th>Total Hari</th>
                  <th>Status</th>
                  <th>Disetujui Oleh</th>
                  <th>Waktu Persetujuan</th>
                  <th>Bukti</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? (
                  requests.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.created_at)}</td>
                      <td>
                        {formatDate(item.start_date)} -{" "}
                        {formatDate(item.end_date)}
                      </td>
                      <td>
                        {LEAVE_TYPE_LABEL[item.leave_type] || item.leave_type}
                      </td>
                      <td>{item.total_days || 0}</td>
                      <td>
                        <span
                          className={`badge ${STATUS_BADGE_CLASS[item.status] || "badge-outline"}`}
                        >
                          {item.status || "-"}
                        </span>
                      </td>
                      <td>{item.approved_by_name || "-"}</td>
                      <td>{formatDateTime(item.approved_at)}</td>
                      <td>
                        {item.bukti ? (
                          <button
                            type="button"
                            className="link link-primary"
                            onClick={() =>
                              openProofModal(item.bukti, item.leave_type)
                            }
                          >
                            Lihat
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-xs whitespace-normal">
                        {item.reason || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center opacity-70">
                      Belum ada data pengajuan cuti/izin
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </TitleCard>

      <input
        type="checkbox"
        id="leave-proof-modal"
        className="modal-toggle"
        checked={!!selectedProof}
        onChange={closeProofModal}
      />
      <div className="modal">
        <div className="modal-box max-w-4xl">
          <button
            type="button"
            className="btn btn-sm btn-circle absolute right-2 top-2"
            onClick={closeProofModal}
          >
            ✕
          </button>
          <h3 className="font-semibold text-xl mb-1">Bukti Pengajuan</h3>
          <p className="text-sm opacity-70 mb-4">
            Jenis: {selectedProof?.leaveType || "-"}
          </p>

          <div className="w-full min-h-[420px] bg-base-200 rounded-lg overflow-hidden flex items-center justify-center">
            {selectedProof?.type === "image" ? (
              <img
                src={getAssetUrl(selectedProof.path)}
                alt="Bukti cuti atau izin"
                className="max-h-[70vh] w-auto object-contain"
              />
            ) : selectedProof?.type === "pdf" ? (
              <iframe
                title="Bukti PDF"
                src={getAssetUrl(selectedProof.path)}
                className="w-full h-[70vh] border-0"
              />
            ) : selectedProof?.path ? (
              <div className="text-center p-6">
                <p className="mb-2">
                  Preview tidak tersedia untuk tipe file ini.
                </p>
                <a
                  href={getAssetUrl(selectedProof.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Buka File
                </a>
              </div>
            ) : (
              <p className="opacity-70">Tidak ada file bukti.</p>
            )}
          </div>
        </div>
        <label
          className="modal-backdrop"
          htmlFor="leave-proof-modal"
          onClick={closeProofModal}
        >
          Close
        </label>
      </div>
    </>
  );
}

export default EmployeeLeave;
