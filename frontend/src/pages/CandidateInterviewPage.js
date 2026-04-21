import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../features/common/headerSlice";
import TitleCard from "../components/Cards/TitleCard";
import { NotificationManager } from "react-notifications";
import axios from "axios";

export default function CandidateInterviewPage() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");

  useEffect(() => {
    dispatch(setPageTitle({ title: "Wawancara" }));
    fetchApplicationsAndInterviews();
    // eslint-disable-next-line
  }, [dispatch]);

  const fetchApplicationsAndInterviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/candidates/applications");
      if (response.data.applications) {
        // Ambil hanya aplikasi milik user login yang punya jadwal interview
        const withInterview = response.data.applications.filter(
          (app) => app.scheduled_date,
        );
        setApps(withInterview);
      } else {
        setApps([]);
      }
    } catch (error) {
      console.error("Failed to fetch interviews:", error);
      setApps([]);
      NotificationManager.error("Gagal memuat data wawancara", "Gagal", 3000);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    // Mapping sesuai status di database interviews: scheduled, completed, cancelled, rescheduled
    const statusMap = {
      scheduled: "badge badge-warning",
      completed: "badge badge-success",
      cancelled: "badge badge-error",
      rescheduled: "badge badge-ghost",
    };
    const statusLabelMap = {
      scheduled: "Dijadwalkan",
      completed: "Selesai",
      cancelled: "Dibatalkan",
      rescheduled: "Dijadwalkan Ulang",
    };
    return {
      class: statusMap[status] || "badge",
      label: statusLabelMap[status] || status,
    };
  };

  const getInterviewTypeBadge = (type) => {
    const typeMap = {
      online: "badge badge-info",
      offline: "badge badge-accent",
    };
    const typeLabelMap = {
      online: "Online",
      offline: "Offline",
    };
    return {
      class: typeMap[type] || "badge",
      label: typeLabelMap[type] || type,
    };
  };

  const handleOpenLink = (link) => {
    if (link) {
      window.open(link, "_blank");
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter apps berdasarkan status, tipe, dan tanggal interview
  const appsWithInterview = apps.filter((app) => {
    let statusMatch = true;
    let typeMatch = true;
    let dateMatch = true;
    if (filterStatus) {
      statusMatch = app.interview_status === filterStatus;
    }
    if (filterType) {
      typeMatch = app.interview_type === filterType;
    }
    if (filterDateStart) {
      const appDate = new Date(app.scheduled_date);
      const startDate = new Date(filterDateStart);
      dateMatch = appDate >= startDate;
    }
    if (filterDateEnd) {
      const appDate = new Date(app.scheduled_date);
      const endDate = new Date(filterDateEnd);
      // Agar tanggal akhir tetap termasuk, set jam ke 23:59:59
      endDate.setHours(23, 59, 59, 999);
      dateMatch = dateMatch && appDate <= endDate;
    }
    return statusMatch && typeMatch && dateMatch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <>
      <TitleCard
        title="Jadwal Wawancara"
        subtitle={`Total ${appsWithInterview.length} wawancara`}
      >
        {/* Filter Section */}
        <div className="mb-6 p-6 rounded-2xl border bg-base-100 shadow-sm">
          <div className="w-full flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
              {/* STATUS */}
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold">
                    Status Wawancara
                  </span>
                </label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">Semua Status</option>
                  <option value="scheduled">Dijadwalkan</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="rescheduled">Dijadwalkan Ulang</option>
                </select>
              </div>

              {/* TIPE */}
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold">
                    Tipe Wawancara
                  </span>
                </label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">Semua Tipe</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* TANGGAL MULAI */}
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold">
                    Tanggal Mulai
                  </span>
                </label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={filterDateStart}
                  onChange={e => setFilterDateStart(e.target.value)}
                  max={filterDateEnd || undefined}
                />
              </div>

              {/* TANGGAL AKHIR */}
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold">
                    Tanggal Akhir
                  </span>
                </label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={filterDateEnd}
                  onChange={e => setFilterDateEnd(e.target.value)}
                  min={filterDateStart || undefined}
                />
              </div>
            </div>
            <div className="flex w-full justify-end">
              {(filterStatus || filterType || filterDateStart || filterDateEnd) && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setFilterStatus("");
                    setFilterType("");
                    setFilterDateStart("");
                    setFilterDateEnd("");
                  }}
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>

        {appsWithInterview.length === 0 ? (
          <div className="alert alert-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div>
              <h3 className="font-bold">Belum Ada Jadwal Wawancara</h3>
              <div className="text-xs">
                Anda belum memiliki jadwal wawancara. Silakan ajukan lamaran
                pekerjaan terlebih dahulu atau tunggu pihak HR menghubungi Anda.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {appsWithInterview.map((app, idx) => (
              <div key={idx} className="card bg-base-200 shadow-md">
                <div className="card-body">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div>
                      <h3 className="card-title text-lg">{app.job_title}</h3>
                      <p className="text-sm text-gray-600">
                        {app.position_name} • {app.location}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <div
                        className={
                          getInterviewTypeBadge(app.interview_type).class
                        }
                      >
                        {getInterviewTypeBadge(app.interview_type).label}
                      </div>
                      <div
                        className={getStatusBadge(app.interview_status).class}
                      >
                        {getStatusBadge(app.interview_status).label}
                      </div>
                    </div>
                  </div>

                  <div className="divider my-2"></div>

                  {/* Interview Details */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">
                        Tanggal & Waktu
                      </p>
                      <p className="font-semibold">
                        {formatDateTime(app.scheduled_date)}
                      </p>
                      {app.duration_minutes && (
                        <p className="text-sm text-gray-600">
                          Durasi: {app.duration_minutes} menit
                        </p>
                      )}
                    </div>

                    {app.interview_type === "video" && app.meeting_link && (
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Link Wawancara
                        </p>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenLink(app.meeting_link)}
                        >
                          Buka Link
                        </button>
                      </div>
                    )}

                    {app.interview_location && (
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Lokasi
                        </p>
                        <p className="font-semibold">
                          {app.interview_location}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Interview Status */}
                  <div className="mt-4 p-3 bg-base-100 rounded-lg">
                    <p className="text-xs text-gray-600 font-semibold mb-2">
                      Status Wawancara
                    </p>
                    <div className="flex items-center gap-2">
                      {app.interview_status === "scheduled" && (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          <span>Terjadwal</span>
                        </>
                      )}
                      {app.interview_status === "completed" && (
                        <>
                          <svg
                            className="w-5 h-5 text-success"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                          <span>Selesai</span>
                        </>
                      )}
                      {app.interview_status === "cancelled" && (
                        <>
                          <svg
                            className="w-5 h-5 text-error"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                          <span>Dibatalkan</span>
                        </>
                      )}
                      {app.interview_status === "rescheduled" && (
                        <>
                          <svg
                            className="w-5 h-5 text-warning"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z"></path>
                          </svg>
                          <span>Dijadwalkan Ulang</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Interview Result */}
                  {app.interview_status === "completed" &&
                    app.interview_result !== "pending" && (
                      <div className="mt-4 p-3 bg-base-100 rounded-lg">
                        <p className="text-xs text-gray-600 font-semibold mb-2">
                          Hasil Wawancara
                        </p>
                        {app.interview_result === "passed" && (
                          <div className="alert alert-success py-2">
                            <span>
                              Selamat! Anda lolos tahap wawancara ini.
                            </span>
                          </div>
                        )}
                        {app.interview_result === "failed" && (
                          <div className="alert alert-error py-2">
                            <span>
                              Mohon maaf, Anda tidak lolos tahap wawancara ini.
                            </span>
                          </div>
                        )}
                        {app.interview_result === "no_show" && (
                          <div className="alert alert-warning py-2">
                            <span>
                              Anda tidak hadir pada jadwal wawancara yang telah
                              ditentukan.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Interview Rating */}
                  {app.rating && (
                    <div className="mt-4 p-3 bg-base-100 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-2">
                        Rating Wawancara
                      </p>
                      <p className="text-sm">Rating: {app.rating}/5</p>
                      <div className="rating rating-sm mt-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <input
                            key={i}
                            type="radio"
                            name={`rating-${app.id}`}
                            className="mask mask-star-2 bg-orange-400"
                            checked={parseInt(app.rating) === i}
                            disabled
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interview Notes */}
                  {app.interviewer_notes && (
                    <div className="mt-4 p-3 bg-base-100 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-2">
                        Catatan Pewawancara
                      </p>
                      <p className="text-sm">{app.interviewer_notes}</p>
                    </div>
                  )}

                  {/* Lamaran Status */}
                  <div className="mt-4 pt-4 border-t border-base-300 text-xs text-gray-600">
                    <span className="font-semibold">Status Lamaran:</span>
                    <span className="ml-2 badge badge-outline">
                      {app.status}
                    </span>
                    <p className="mt-1">
                      Diajukan:{" "}
                      {new Date(app.submitted_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TitleCard>
    </>
  );
}
