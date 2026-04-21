import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setPageTitle } from "../features/common/headerSlice";
import TitleCard from "../components/Cards/TitleCard";
import { NotificationManager } from "react-notifications";
import axios from "axios";
import ApplicationDetailModal from "./ApplicationsDetailModal";

export default function CandidateRequestsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [pendingWithdrawId, setPendingWithdrawId] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Permohonan Saya" }));
    fetchApplications();
  }, [dispatch]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/candidates/applications");
      if (response.data.applications) {
        const cleanApps = response.data.applications.filter((app) => app);
        setApplications(cleanApps);
        setFilteredApplications(cleanApps);
      }
    } catch (error) {
      NotificationManager.error("Gagal memuat permohonan", "Gagal", 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterStatus = (status) => {
    setSelectedStatus(status);
    if (status === "all") {
      setFilteredApplications(applications.filter((app) => app));
    } else {
      setFilteredApplications(
        applications.filter((app) => app && app.status === status),
      );
    }
  };

  const handleWithdraw = async (id, reason) => {
    try {
      setWithdrawingId(id);
      await axios.put(`/api/candidates/applications/${id}/withdraw`, {
        withdraw_reason: reason,
      });
      NotificationManager.success("Berhasil dibatalkan", "Sukses", 3000);
      fetchApplications();
    } catch (error) {
      NotificationManager.error("Gagal membatalkan", "Gagal", 3000);
    } finally {
      setWithdrawingId(null);
    }
  };

  const openWithdrawModal = (id) => {
    setPendingWithdrawId(id);
    setWithdrawReason("");
    setShowWithdrawModal(true);
  };

  const confirmWithdraw = () => {
    setShowWithdrawModal(false);
    if (pendingWithdrawId) {
      handleWithdraw(pendingWithdrawId, withdrawReason);
      setPendingWithdrawId(null);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const statusOptions = [
    { value: "all", label: "Semua" },
    { value: "submitted", label: "Terkirim" },
    { value: "screening", label: "Review" },
    { value: "lolos_dokumen", label: "Lolos Dokumen" },
    { value: "wawancara", label: "Jadwal Interview" },
    { value: "interview_rescheduled", label: "Reschedule Interview" },
    { value: "diterima", label: "Diterima" },
    { value: "ditolak", label: "Ditolak" },
    { value: "withdrawn", label: "Dibatalkan" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const map = {
      submitted:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      screening:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
      lolos_dokumen:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
      wawancara:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
      interview_rescheduled:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
      interview_completed:
        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      interview_cancelled:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      diterima:
        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      ditolak: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      withdrawn:
        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    };

    return (
      map[status] ||
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
    );
  };

  const getStatusLabel = (status) => {
    const map = {
      submitted: "Terkirim",
      screening: "Screening",
      lolos_dokumen: "Lolos Dokumen",
      wawancara: "Interview",
      interview_rescheduled: "Interview Reschedule",
      interview_completed: "Interview Selesai",
      interview_cancelled: "Interview Dibatalkan",
      diterima: "Diterima",
      ditolak: "Ditolak",
      withdrawn: "Dibatalkan",
    };
    return map[status] || status;
  };

  return (
    <>
      <TitleCard
        title="Permohonan Saya"
        subtitle={`${applications.length} Lamaran`}
      >
        <div className="mb-6">
          <div className="grid grid-cols-9 bg-base-200 rounded-xl p-1 gap-1">
            {statusOptions.map((s) => (
              <button
                key={s.value}
                onClick={() => handleFilterStatus(s.value)}
                className={`relative z-10 px-2 py-2 text-xs font-medium text-center rounded-lg transition-all
  ${
    selectedStatus === s.value
      ? "text-white"
      : "text-gray-500 hover:text-gray-700"
  }
`}
              >
                {s.label}
                {selectedStatus === s.value && (
                  <span className="absolute inset-0 -z-10 rounded-lg bg-primary shadow-sm"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* EMPTY */}
        {filteredApplications.length === 0 && (
          <div className="text-center py-16 opacity-70">
            <p className="text-lg font-semibold">Tidak ada data</p>
            <p className="text-sm">
              {selectedStatus === "all"
                ? "Belum ada lamaran"
                : "Tidak ada pada status ini"}
            </p>
          </div>
        )}

        {/* LIST */}
        <div className="grid gap-4">
          {filteredApplications &&
            filteredApplications.length > 0 &&
            filteredApplications.map((app) => {
              if (!app) return null;
              return (
                <div
                  key={app.id}
                  className="p-5 rounded-2xl border bg-base-100 hover:shadow-md transition"
                >
                  {/* TOP */}
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-lg">{app.job_title}</h2>
                      <p className="text-sm opacity-70">
                        {app.position_name} • {app.location}
                      </p>
                    </div>

                    <span
                      className={`
    inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
    ${getStatusBadge(app.status)}
  `}
                    >
                      {getStatusLabel(app.status)}
                    </span>
                  </div>

                  {/* INFO */}
                  <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-80">
                    <span>📁 {app.department_name}</span>
                    <span>📊 {app.level}</span>
                    <span>📅 {formatDate(app.submitted_at)}</span>
                  </div>

                  {/* TIMELINE */}
                  {(app.reviewed_at || app.scheduled_date) && (
                    <div className="mt-3 text-sm space-y-1">
                      {app.reviewed_at && (
                        <p>✔ Diulas: {formatDate(app.reviewed_at)}</p>
                      )}
                      {app.scheduled_date && (
                        <p>📆 Interview: {formatDate(app.scheduled_date)}</p>
                      )}
                    </div>
                  )}

                  {/* NOTES */}
                  {app.admin_notes && (
                    <div className="mt-3 p-3 bg-base-200 rounded-lg text-sm">
                      {app.admin_notes}
                    </div>
                  )}

                  {/* ACTION */}
                  <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setSelectedApp(app);
                        setIsModalOpen(true);
                      }}
                    >
                      Detail
                    </button>

                    <div className="flex gap-2">
                      {["submitted", "screening", "wawancara"].includes(
                        app.status,
                      ) && (
                        <button
                          className={`btn btn-sm btn-error ${
                            withdrawingId === app.id ? "loading" : ""
                          }`}
                          onClick={() => openWithdrawModal(app.id)}
                        >
                          Batalkan
                        </button>
                      )}

                      {app.status === "wawancara" && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate("/candidate/interview")}
                        >
                          Interview
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </TitleCard>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              Alasan Pembatalan Lamaran
            </h3>
            <p>Jika membatalkan pengajuan lamaran ini anda tidak dapat mengajukan ulang!!</p>
            <textarea
              className="textarea textarea-bordered w-full mb-4"
              rows={3}
              placeholder="Silahkan tulis alasan pembatalan (opsional)"
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-outline"
                onClick={() => setShowWithdrawModal(false)}
              >
                Batal
              </button>
              <button className="btn btn-error" onClick={confirmWithdraw}>
                Konfirmasi Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isModalOpen && selectedApp && (
        <ApplicationDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          app={selectedApp}
          onWithdraw={handleWithdraw}
          withdrawingId={withdrawingId}
        />
      )}
    </>
  );
}
