// Pastikan status/hiring_status di-fetch untuk semua job di history
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HRModalInterview from "./HRModalInterview";
import HRInterviewDetailLowongan from "./HRInterviewDetailLowongan";
import TitleCard from "../../components/Cards/TitleCard";
import axios from "axios";
import { useRef } from "react";

export default function HRInterview() {
  const [activeMenu, setActiveMenu] = useState("schedule");
  const [canceledMap, setCanceledMap] = useState({});
  // Listener untuk refresh data interview dari modal detail
  useEffect(() => {
    const handler = () => {
      if (activeMenu === "history") {
        // Ambil data dari endpoint baru gabungan
        axios
          .get("/api/hr/interviews/history-combined")
          .then((res) => {
            setData(res.data.history || []);
          })
          .catch(() => setData([]));
      } else {
        axios
          .get("/api/hr/interviews")
          .then((res) => {
            console.log("[DEBUG] DATA INTERVIEWS", res.data.interviews);
            // Jika data kosong, tampilkan pesan
            if (!res.data.interviews || res.data.interviews.length === 0) {
              console.warn(
                "[DEBUG] Tidak ada data interview yang diterima dari API",
              );
            }
            // Pastikan status interview sesuai
            setData(
              (res.data.interviews || []).map((i) => ({
                ...i,
                status: i.status || i.interview_status || "scheduled",
                job_title:
                  i.job_title ||
                  i.position_name ||
                  i.base_position ||
                  "Lainnya",
                id: i.id || i.interview_id,
                candidate_name: i.candidate_name || i.name || "-",
                scheduled_date: i.scheduled_date || i.date,
                interview_type: i.interview_type || i.type || "-",
                interviewer_name:
                  i.interviewer_name || i.interviewer || i.full_name || "-",
              })),
            );
          })
          .catch(() => setData([]));
      }
    };
    window.addEventListener("refreshInterviewData", handler);
    return () => window.removeEventListener("refreshInterviewData", handler);
  }, [activeMenu]);
  const [data, setData] = useState([]); // interview data
  const [candidates, setCandidates] = useState([]); // kandidat lolos dokumen
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState({});
  const [mode, setMode] = useState("create");
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelNotes, setCancelNotes] = useState("");
  const handleSchedule = (candidate) => {
    // Cek apakah kandidat sudah punya jadwal interview (scheduled/rescheduled)
    const alreadyScheduled = data.some(
      (d) =>
        d.application_id === candidate.id &&
        ["scheduled", "rescheduled"].includes(d.status),
    );
    if (alreadyScheduled) {
      alert(
        "Kandidat ini sudah memiliki jadwal wawancara. Silakan atur ulang jadwal terlebih dahulu pada menu Jadwal Wawancara.",
      );
      return;
    }

    if (form.scheduled_date && form.interviewer_id) {
      const newStart = new Date(form.scheduled_date);
      const newEnd = new Date(
        newStart.getTime() +
          (parseInt(form.duration_minutes || 0) || 0) * 60000,
      );
      const conflict = data.some((d) => {
        if (
          d.interviewer_id === form.interviewer_id &&
          ["scheduled", "rescheduled"].includes(d.status)
        ) {
          const existStart = new Date(d.scheduled_date);
          const existEnd = new Date(
            existStart.getTime() +
              (parseInt(d.duration_minutes || 0) || 0) * 60000,
          );
          // Cek overlap
          return newStart < existEnd && existStart < newEnd;
        }
        return false;
      });
      if (conflict) {
        alert(
          "Interviewer sudah memiliki jadwal wawancara yang bentrok di waktu tersebut. Silakan pilih waktu lain.",
        );
        return;
      }
    }

        // Cek apakah kandidat punya interview status canceled/cancelled
        const canceledInterview = data.find(
          (d) =>
            d.application_id === candidate.id &&
            ["canceled", "cancelled"].includes(d.status),
        );

        if (canceledInterview) {
          setMode("update");
          setSelectedCandidate(canceledInterview);
          setForm({
            scheduled_date: canceledInterview.scheduled_date || "",
            interview_stage: canceledInterview.stage || "HR",
            interview_type: canceledInterview.interview_type || "Online",
            duration_minutes: canceledInterview.duration_minutes || 60,
            interviewer_id: canceledInterview.interviewer_id || "",
            meeting_link: canceledInterview.meeting_link || "",
            location: canceledInterview.location || "",
          });
        } else {
          setMode("create");
          setSelectedCandidate(candidate);
          setForm((prev) => ({
            ...prev,
            scheduled_date: "",
            interview_stage: "HR",
            interview_type: "Online",
            duration_minutes: 60,
            interviewer_id: "",
            meeting_link: "",
            location: "",
          }));
        }
    setIsModalOpen(true);
    setTimeout(() => {
      console.log("isModalOpen:", isModalOpen, "selectedCandidate:", candidate);
    }, 100);
  };

  const [form, setForm] = useState({
    datetime: "",
    type: "Online",
    stage: "HR",
    interviewer: "",
    location: "",
  });

  useEffect(() => {
    if (activeMenu === "schedule") {
      // Ambil data aplikasi lolos_dokumen
      axios
        .get("/api/hr/applications?status=lolos_dokumen")
        .then(async (res) => {
          const apps = (res.data && res.data.applications) || [];
          let tempCanceledMap = {};

          try {
            const resp = await axios.get(
              "/api/hr/interviews/canceled-applications",
            );

            if (resp.data && Array.isArray(resp.data.applications)) {
              resp.data.applications.forEach((row) => {
                tempCanceledMap[row.application_id] = true;
              });
            }
          } catch (e) {
            console.error("[ERROR CANCELED]:", e);
          }

          setCanceledMap(tempCanceledMap);
          setCandidates(apps);
        })
        .catch(() => setCandidates([]));
    } else if (activeMenu === "list") {
      axios
        .get("/api/hr/interviews")
        .then((res) => {
          console.log("[DEBUG] DATA INTERVIEWS", res.data.interviews);
          // Jika data kosong, tampilkan pesan
          if (!res.data.interviews || res.data.interviews.length === 0) {
            console.warn(
              "[DEBUG] Tidak ada data interview yang diterima dari API",
            );
          }
          // Pastikan status interview sesuai
          setData(
            (res.data.interviews || []).map((i) => ({
              ...i,
              status: i.status || i.interview_status || "scheduled",
              job_title:
                i.job_title || i.position_name || i.base_position || "Lainnya",
              id: i.id || i.interview_id,
              candidate_name: i.candidate_name || i.name || "-",
              scheduled_date: i.scheduled_date || i.date,
              interview_type: i.interview_type || i.type || "-",
              interviewer_name:
                i.interviewer_name || i.interviewer || i.full_name || "-",
            })),
          );
        })
        .catch((err) => {
          console.error("[DEBUG] Error ambil data interviews:", err);
          setData([]);
        });
    } else if (activeMenu === "history") {
      // Ambil data interview status completed & canceled_by_company dari endpoint gabungan
      axios
        .get("/api/hr/interviews/history-combined")
        .then((res) => {
          const interviews = (res.data.history || []).map((i) => ({
            ...i,
            job_title:
              i.job_title || i.position_name || i.base_position || "Lainnya",
            id: i.id || i.interview_id,
            candidate_name: i.candidate_name || i.name || "-",
            scheduled_date: i.scheduled_date || i.date,
            interview_type: i.interview_type || i.type || "-",
            interviewer_name:
              i.interviewer_name || i.interviewer || i.full_name || "-",
            status: i.status || i.interview_status || "completed",
          }));
          setData(interviews);
        })
        .catch((err) => {
          console.error("[DEBUG HISTORY] error:", err);
          setData([]);
        });
    }
  }, [activeMenu]);

  const menu = [
    { key: "schedule", label: "Buatkan Jadwal" },
    { key: "list", label: "Jadwal Wawancara" },
    { key: "history", label: "Riwayat Jadwal" },
  ];

  const formatDate = (date) => {
    if (!date) return "-";
    const d = new Date(date);
    const bulan = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const hari = d.getDate();
    const namaBulan = bulan[d.getMonth()];
    const tahun = d.getFullYear();
    const jam = d.getHours().toString().padStart(2, "0");
    const menit = d.getMinutes().toString().padStart(2, "0");
    return `${hari} ${namaBulan} ${tahun}, pukul ${jam}:${menit}`;
  };

  const groupedData = data
    .filter((d) => ["scheduled", "rescheduled"].includes(d.status))
    .reduce((acc, curr) => {
      if (!acc[curr.job_title]) {
        acc[curr.job_title] = [];
      }
      acc[curr.job_title].push(curr);
      return acc;
    }, {});

  // Pastikan status/hiring_status selalu di-fetch untuk setiap job di groupedData (activeMenu === 'list')
  useEffect(() => {
    if (activeMenu === "history") {
      Object.keys(groupedData).forEach((job) => {
        const first = groupedData[job]?.[0];
        const jobOpeningId =
          first?.job_opening_id || first?.position_id || first?.id;
        if (jobOpeningId) fetchJobStatus(jobOpeningId);
      });
    }
  }, [activeMenu, groupedData]);

  // Gabungkan data interviews (completed) dan applications/interviews (canceled_by_company) untuk history
  // Hanya tampilkan interview dengan status 'completed' dan 'canceled_by_company' (bukan 'cancelled')
  // Urutkan data riwayat terbaru di atas
  const sortedHistory = [...data]
    .filter(
      (d) => d.status === "completed" || d.status === "canceled_by_company",
    )
    .sort((a, b) => {
      // Urutkan descending berdasarkan tanggal interview
      const dateA = new Date(a.scheduled_date || a.date || 0);
      const dateB = new Date(b.scheduled_date || b.date || 0);
      return dateB - dateA;
    });

  // Group by job_title
  const groupedHistory = sortedHistory.reduce((acc, curr) => {
    const job = curr.job_title || "Lainnya";
    if (!acc[job]) acc[job] = [];
    acc[job].push(curr);
    return acc;
  }, {});

  // Filter by posisi dan status
  const filteredHistory = Object.fromEntries(
    Object.entries(groupedHistory).filter(([job, list]) => {
      // Filter posisi
      if (form.positionFilterHistory && job !== form.positionFilterHistory)
        return false;
      // Filter status
      if (
        form.statusFilterHistory &&
        !list.some((d) => d.status === form.statusFilterHistory)
      )
        return false;
      return true;
    }),
  );

  useEffect(() => {
    if (activeMenu === "history") {
      Object.keys(filteredHistory).forEach((job) => {
        const first = filteredHistory[job]?.[0];
        const jobOpeningId =
          first?.job_opening_id || first?.position_id || first?.id;
        if (jobOpeningId) fetchJobStatus(jobOpeningId);
      });
    }
  }, [activeMenu, filteredHistory]);

  const [jobStatusMap, setJobStatusMap] = useState({}); // { [job_opening_id]: { status, hiring_status } }
  const jobStatusLoading = useRef({}); // prevent duplicate fetch

  // Fungsi untuk fetch status job_openings jika belum ada di state
  const fetchJobStatus = async (jobOpeningId) => {
    if (
      !jobOpeningId ||
      jobStatusMap[jobOpeningId] ||
      jobStatusLoading.current[jobOpeningId]
    )
      return;
    jobStatusLoading.current[jobOpeningId] = true;
    try {
      const res = await axios.get(`/api/job-openings/${jobOpeningId}`);
      if (res.data && res.data.job) {
        setJobStatusMap((prev) => ({
          ...prev,
          [jobOpeningId]: {
            status: res.data.job.status,
            hiring_status: res.data.job.hiring_status,
          },
        }));
      }
    } catch (e) {
      // Optional: handle error
    } finally {
      jobStatusLoading.current[jobOpeningId] = false;
    }
  };

  return (
    <TitleCard
      title="Manajemen Interview"
      subtitle="Kelola jadwal interview kandidat"
    >
      <div>
        <div className="mb-6">
          <div className="flex w-full bg-base-200 p-2 rounded-2xl gap-2">
            {menu.map((m) => (
              <button
                key={m.key}
                onClick={() => setActiveMenu(m.key)}
                className={`flex-1 text-center py-3 rounded-xl text-sm font-medium transition-all
            ${
              activeMenu === m.key
                ? "bg-primary text-white shadow-md"
                : "text-base-content hover:bg-base-300"
            }
          `}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {/* CONTENT */}
        {activeMenu === "schedule" && (
          <div>
            {/* FILTER SCHEDULE */}
            <div className="w-full mb-6">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <select
                  className="select select-bordered flex-1 min-w-[180px]"
                  value={form.positionFilter || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, positionFilter: e.target.value }))
                  }
                >
                  <option value="">Semua Posisi</option>
                  {Array.from(
                    new Set(candidates.map((c) => c.job_title || "Lainnya")),
                  ).map((pos, idx) => (
                    <option key={idx} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="input input-bordered flex-1 min-w-[160px]"
                />
                <button className="btn btn-primary w-full sm:w-auto">
                  Apply Filters
                </button>
              </div>
            </div>

            {/* GROUPED LIST */}
            <div className="space-y-6">
              {/* Group kandidat berdasarkan posisi (job_title) */}
              {Object.entries(
                candidates
                  .filter(
                    (c) =>
                      !form.positionFilter ||
                      (c.job_title || "Lainnya") === form.positionFilter,
                  )
                  .reduce((acc, curr) => {
                    const job = curr.job_title || "Lainnya";
                    if (!acc[job]) acc[job] = [];
                    acc[job].push(curr);
                    return acc;
                  }, {}),
              ).map(([job, list], idx) => (
                <div key={idx} className="border rounded-xl overflow-hidden">
                  <div className="bg-base-200 px-4 py-3 flex justify-between items-center">
                    <span className="font-semibold">{job}</span>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-xs flex items-center gap-1"
                        onClick={() => {
                          // Cari kandidat pertama pada list untuk ambil id
                          const firstCandidate = list[0];
                          navigate("/app/DetailInterview-process", {
                            state: {
                              job: {
                                id:
                                  firstCandidate?.position_id ||
                                  firstCandidate?.job_opening_id,
                                title: job,
                              },
                            },
                          });
                        }}
                      >
                        Detail Lowongan
                      </button>
                      <button
                        className="btn btn-error btn-xs"
                        onClick={async () => {
                          // Cari kandidat pertama pada list untuk ambil id
                          const first = list[0];
                          const jobId =
                            first?.job_opening_id ||
                            first?.position_id ||
                            first?.id;
                          if (!first || !jobId) {
                            alert(
                              "Data lowongan tidak ditemukan atau ID tidak valid!",
                            );
                            return;
                          }
                          if (
                            !window.confirm(
                              "Yakin ingin membatalkan lowongan ini? Semua kandidat akan diberi status dibatalkan.",
                            )
                          )
                            return;
                          try {
                            // Update semua aplikasi dan interview pada posisi ini menjadi canceled_by_company
                            const url1 = `/api/hr/applications/cancel-by-job`;
                            const url2 = `/api/job-openings/${jobId}/cancel`;
                            const res1 = await axios.put(url1, {
                              job_opening_id: jobId,
                            });
                            const res2 = await axios.put(url2);
                            if (res1.data && res2.data) {
                              alert(
                                `Lowongan berhasil dibatalkan. Semua kandidat dan interview telah diberi status dibatalkan oleh perusahaan.`,
                              );
                              // Refresh data kandidat
                              setCandidates((prev) =>
                                prev.filter(
                                  (c) => (c.job_title || "Lainnya") !== job,
                                ),
                              );
                            } else {
                              alert(
                                "Gagal membatalkan lowongan. Respon tidak valid dari server.",
                              );
                            }
                          } catch (err) {
                            let msg = "Gagal membatalkan lowongan\n";
                            msg += `URL1: /api/hr/applications/cancel-by-job\n`;
                            msg += `URL2: /api/job-openings/${jobId}/cancel\n`;
                            msg += `Method: PUT\n`;
                            if (err?.response?.data?.message)
                              msg += `Pesan: ${err.response.data.message}`;
                            else if (err?.message)
                              msg += `Pesan: ${err.message}`;
                            else msg += JSON.stringify(err);
                            alert(msg);
                          }
                        }}
                      >
                        Cancel Lowongan
                      </button>
                    </div>
                  </div>
                  <div className="divide-y">
                    {(showAll[job] ? list : list.slice(0, 1)).map(
                      (candidate, i) => {
                        const isReschedule = canceledMap[candidate.application_id];
                        return (
                          <div
                            key={candidate.id || i}
                            className="flex justify-between items-center p-4"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-2 h-2 bg-primary rounded-full"></span>
                              <span className="flex items-center">
                                {candidate.name ||
                                  candidate.candidate_name ||
                                  "(Tanpa Nama)"}
                                {isReschedule && (
                                  <span className="badge badge-warning ml-2">
                                    Reschedule jadwal ini
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {!isReschedule && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSchedule(candidate)}
                                >
                                  Buatkan Jadwal Wawancara
                                </button>
                              )}
                              {isReschedule && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setMode("update");
                                    // Cari interview canceled pada data
                                    const canceledInterview = data.find(
                                      (d) =>
                                        d.application_id === candidate.id &&
                                        ["canceled", "cancelled"].includes(d.status),
                                    );
                                    if (canceledInterview) {
                                      setSelectedCandidate(canceledInterview);
                                      setForm({
                                        scheduled_date: canceledInterview.scheduled_date || canceledInterview.date,
                                        interview_stage: canceledInterview.stage,
                                        interview_type: canceledInterview.interview_type || canceledInterview.type,
                                        duration_minutes: canceledInterview.duration_minutes || 60,
                                        interviewer_id: canceledInterview.interviewer_id || "",
                                        meeting_link: canceledInterview.meeting_link || "",
                                        location: canceledInterview.location || "",
                                      });
                                    } else {
                                      setSelectedCandidate(candidate);
                                    }
                                    setIsModalOpen(true);
                                  }}
                                >
                                  Atur Ulang Jadwal
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                    {list.length > 1 && (
                      <div className="p-4 text-center">
                        <button
                          className="btn-sm"
                          onClick={() =>
                            setShowAll((prev) => ({
                              ...prev,
                              [job]: !prev[job],
                            }))
                          }
                        >
                          {showAll[job]
                            ? "Tampilkan Sedikit Data"
                            : `Tampilkan Semua (${list.length})`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {candidates.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Tidak ada kandidat yang lolos dokumen.
                </div>
              )}
            </div>
          </div>
        )}
        {activeMenu === "list" && (
          <div>
            {/* FILTER LIST */}
            <div className="w-full mb-6">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <select
                  className="select select-bordered flex-1 min-w-[180px]"
                  value={form.positionFilterList || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      positionFilterList: e.target.value,
                    }))
                  }
                >
                  <option value="">Semua Posisi</option>
                  {Array.from(
                    new Set(
                      data
                        .filter((d) =>
                          ["scheduled", "rescheduled"].includes(d.status),
                        )
                        .map((c) => c.job_title || "Lainnya"),
                    ),
                  ).map((pos, idx) => (
                    <option key={idx} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="input input-bordered flex-1 min-w-[160px]"
                />
                <button className="btn btn-primary w-full sm:w-auto">
                  Apply Filters
                </button>
              </div>
            </div>
            <div className="space-y-6">
              {Object.keys(
                Object.fromEntries(
                  Object.entries(groupedData).filter(
                    ([job]) =>
                      !form.positionFilterList ||
                      job === form.positionFilterList,
                  ),
                ),
              ).map((job, idx) => (
                <div key={idx} className="border rounded-xl overflow-hidden">
                  {/* 🔥 HEADER POSISI */}
                  <div className="bg-base-200 px-4 py-3 flex justify-between items-center">
                    <span className="font-semibold">{job}</span>

                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          // Cari kandidat pertama pada groupedData[job] untuk ambil id
                          const first = groupedData[job]?.[0];
                          navigate("/app/DetailInterview-process", {
                            state: {
                              job: {
                                id: first?.position_id || first?.job_opening_id,
                                title: job,
                              },
                            },
                          });
                        }}
                      >
                        Detail Lowongan
                      </button>
                      <button
                        className="btn btn-error btn-xs"
                        onClick={async () => {
                          // Cari kandidat pertama pada groupedData[job] untuk ambil id
                          const first = groupedData[job]?.[0];
                          const jobId =
                            first?.job_opening_id ||
                            first?.position_id ||
                            first?.id;
                          if (!first || !jobId) {
                            alert(
                              "Data lowongan tidak ditemukan atau ID tidak valid!",
                            );
                            return;
                          }
                          if (
                            !window.confirm(
                              "Yakin ingin membatalkan lowongan ini? Semua kandidat akan diberi status dibatalkan.",
                            )
                          )
                            return;
                          try {
                            // Update semua aplikasi dan interview pada posisi ini menjadi canceled_by_company
                            const url1 = `/api/hr/applications/cancel-by-job`;
                            const url2 = `/api/job-openings/${jobId}/cancel`;
                            const res1 = await axios.put(url1, {
                              job_opening_id: jobId,
                            });
                            const res2 = await axios.put(url2);
                            if (res1.data && res2.data) {
                              alert(
                                `Lowongan berhasil dibatalkan. Semua kandidat dan interview telah diberi status dibatalkan oleh perusahaan.`,
                              );
                              setData((prev) =>
                                prev.filter((d) => d.job_title !== job),
                              );
                            } else {
                              alert(
                                "Gagal membatalkan lowongan. Respon tidak valid dari server.",
                              );
                            }
                          } catch (err) {
                            let msg = "Gagal membatalkan lowongan\n";
                            msg += `URL1: /api/hr/applications/cancel-by-job\n`;
                            msg += `URL2: /api/job-openings/${jobId}/cancel\n`;
                            msg += `Method: PUT\n`;
                            if (err?.response?.data?.message)
                              msg += `Pesan: ${err.response.data.message}`;
                            else if (err?.message)
                              msg += `Pesan: ${err.message}`;
                            else msg += JSON.stringify(err);
                            alert(msg);
                          }
                        }}
                      >
                        Cancel Lowongan
                      </button>
                    </div>
                  </div>

                  {/* 🔥 LIST KANDIDAT */}
                  <div className="divide-y">
                    {(showAll[job]
                      ? groupedData[job]
                      : groupedData[job].slice(0, 1)
                    ).map((d) => (
                      <div
                        key={d.id}
                        id={`interview-row-${d.id}`}
                        className="p-4 bg-base-100"
                      >
                        {/* HEADER */}
                        <div>
                          <h2 className="font-semibold">{d.candidate_name}</h2>
                        </div>

                        {/* DETAIL */}
                        <div className="mt-3 flex justify-between items-start">
                          {/* 🔹 LEFT: DETAIL */}
                          <div className="text-[15px] space-y-1.5">
                            <p>📆 Tanggal: {formatDate(d.scheduled_date)}</p>
                            <p>
                              ⏱️ Durasi:{" "}
                              {d.duration_minutes
                                ? `${d.duration_minutes} menit`
                                : "-"}
                            </p>
                            <p>📍 Tipe: {d.interview_type}</p>
                            <p>👤 Interviewer : {d.interviewer_name || "-"}</p>
                          </div>

                          {/* 🔹 RIGHT: BUTTON */}
                          <div className="flex flex-col gap-1.5 items-end w-[140px]">
                            <button></button>

                            <button
                              className="btn btn-info btn-xs w-full text-sm normal-case"
                              onClick={() => {
                                setSelectedCandidate(d);
                                setIsDetailOpen(true);
                              }}
                            >
                              Review & Nilai
                            </button>

                            <button
                              className="btn btn-warning btn-xs w-full text-sm normal-case"
                              onClick={() => {
                                setMode("update");
                                setSelectedCandidate(d);

                                setForm({
                                  scheduled_date: d.date,
                                  interview_stage: d.stage,
                                  interview_type: d.type,
                                  duration_minutes: 60,
                                  interviewer_id: "",
                                  meeting_link: "",
                                  location: "",
                                });

                                setIsModalOpen(true);
                              }}
                            >
                              Atur Ulang Jadwal
                            </button>

                            <button
                              className="btn btn-error btn-xs w-full text-sm normal-case"
                              onClick={() => {
                                setSelectedCandidate(d);
                                setCancelNotes("");
                                setIsCancelModalOpen(true);
                              }}
                            >
                              Gugurkan
                            </button>
                            <button
                              className="btn btn-warning btn-xs w-full text-sm normal-case mt-1"
                              onClick={() => {
                                // Logika cancel jadwal interview
                                if (!d?.id) {
                                  alert("ID interview tidak ditemukan!");
                                  return;
                                }
                                if (
                                  !window.confirm(
                                    "Yakin ingin membatalkan jadwal interview ini?",
                                  )
                                )
                                  return;
                                axios
                                  .put(
                                    `/api/hr/interviews/${d.id}/cancel`,
                                  )
                                  .then(() => {
                                    alert(
                                      "Jadwal interview berhasil dibatalkan.",
                                    );
                                    // Update status interview di state data menjadi cancelled
                                    setData((prev) =>
                                      prev.map((item) =>
                                        item.id === d.id
                                          ? { ...item, status: "canceled" }
                                          : item,
                                      ),
                                    );
                                    // Tambahkan ke candidates (menu schedule) jika ingin langsung muncul di sana
                                    setCandidates((prev) => {
                                      const newData = [
                                        ...prev,
                                        {
                                          ...d,
                                          name:
                                            d.candidate_name ||
                                            d.name ||
                                            "(Tanpa Nama)",
                                          status: "canceled",
                                          isReschedule: true,
                                        },
                                      ];
                                      setTimeout(() => {
                                        const el = document.getElementById(
                                          `interview-row-${d.id}`,
                                        );
                                        if (el) {
                                          el.scrollIntoView({
                                            behavior: "smooth",
                                            block: "center",
                                          });
                                          el.classList.add(
                                            "ring",
                                            "ring-primary",
                                            "ring-offset-2",
                                          );
                                          setTimeout(() => {
                                            el.classList.remove(
                                              "ring",
                                              "ring-primary",
                                              "ring-offset-2",
                                            );
                                          }, 2000);
                                        }
                                      }, 500);
                                      return newData;
                                    });
                                    // Pindahkan ke menu schedule
                                    setActiveMenu("schedule");
                                  })
                                  .catch((err) => {
                                    let msg =
                                      "Gagal membatalkan jadwal interview.\n";
                                    if (err?.response?.data?.message) {
                                      msg += `Pesan server: ${err.response.data.message}`;
                                    } else if (err?.message) {
                                      msg += `Pesan: ${err.message}`;
                                    } else {
                                      msg += JSON.stringify(err);
                                    }
                                    alert(msg);
                                    // Optional: log ke console untuk debug
                                    console.error(
                                      "[Cancel Interview Error]",
                                      err,
                                    );
                                  });
                              }}
                            >
                              Batalkan Jadwal
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {groupedData[job].length > 1 && (
                    <div className="p-4 text-center">
                      <button
                        className="btn-sm"
                        onClick={() =>
                          setShowAll((prev) => ({
                            ...prev,
                            [job]: !prev[job],
                          }))
                        }
                      >
                        {showAll[job]
                          ? "Tampilkan Sedikit Data"
                          : `Tampilkan Semua (${groupedData[job].length})`}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(
                Object.fromEntries(
                  Object.entries(groupedData).filter(
                    ([job]) =>
                      !form.positionFilterList ||
                      job === form.positionFilterList,
                  ),
                ),
              ).length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Tidak ada Jadwal Wawancara dengan Kandidat.
                </div>
              )}
            </div>
          </div>
        )}
        {activeMenu === "history" && (
          <div>
            {/* FILTER HISTORY */}
            <div className="w-full mb-6">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <select
                  className="select select-bordered flex-1 min-w-[180px]"
                  value={form.positionFilterHistory || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      positionFilterHistory: e.target.value,
                    }))
                  }
                >
                  <option value="">Semua Posisi</option>
                  {Array.from(new Set(Object.keys(groupedHistory))).map(
                    (pos, idx) => (
                      <option key={idx} value={pos}>
                        {pos}
                      </option>
                    ),
                  )}
                </select>

                {/* Filter status */}
                <select
                  className="select select-bordered flex-1 min-w-[160px]"
                  value={form.statusFilterHistory || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      statusFilterHistory: e.target.value,
                    }))
                  }
                >
                  <option value="">Semua Status</option>
                  <option value="completed">Selesai</option>
                  <option value="canceled_by_company">
                    Dibatalkan Perusahaan
                  </option>
                </select>

                <input
                  type="date"
                  className="input input-bordered flex-1 min-w-[160px]"
                />

                <button className="btn btn-primary w-full sm:w-auto">
                  Apply Filters
                </button>
              </div>
            </div>

            {/* CONTENT HISTORY */}
            <div className="space-y-6">
              {Object.keys(filteredHistory).length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Tidak ada data riwayat wawancara.
                </div>
              ) : (
                Object.keys(filteredHistory).map((job, idx) => {
                  const first = filteredHistory[job]?.[0];
                  const jobOpeningId =
                    first?.job_opening_id || first?.position_id || first?.id;
                  const jobStatus = jobStatusMap[jobOpeningId] || {};
                  const status = (jobStatus.status || "").toLowerCase();
                  const hiringStatus = (
                    jobStatus.hiring_status || ""
                  ).toLowerCase();
                  return (
                    <div
                      key={idx}
                      className="border rounded-xl overflow-hidden"
                    >
                      {/* HEADER POSISI */}
                      <div className="bg-base-200 px-4 py-3 flex justify-between items-center">
                        <span className="font-semibold">{job}</span>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              const first = filteredHistory[job]?.[0];
                              navigate("/app/DetailInterview-process", {
                                state: {
                                  job: {
                                    id:
                                      first?.position_id ||
                                      first?.job_opening_id,
                                    title: job,
                                  },
                                },
                              });
                            }}
                          >
                            Detail Lowongan
                          </button>
                          {/* Button Selesaikan Lowongan Ini, hanya tampil jika status/hiring_status TIDAK closed/completed/canceled */}
                          {(() => {
                            // Ambil dari filteredHistory, bukan groupedData
                            const first = filteredHistory[job]?.[0];
                            const jobOpeningId =
                              first?.job_opening_id ||
                              first?.position_id ||
                              first?.id;
                            const jobStatus = jobStatusMap[jobOpeningId] || {};
                            const status = (
                              jobStatus.status || ""
                            ).toLowerCase();
                            const hiringStatus = (
                              jobStatus.hiring_status || ""
                            ).toLowerCase();
                            // Jangan render button apapun jika status/hiring_status masih kosong (belum sempat fetch)
                            if (!status || !hiringStatus) return null;
                            // Button hanya tidak tampil jika status closed dan hiring_status completed/canceled
                            if (
                              status === "closed" &&
                              ["completed", "canceled"].includes(hiringStatus)
                            )
                              return null;
                            return (
                              <button
                                className="btn btn-success btn-xs"
                                onClick={async () => {
                                  if (!jobOpeningId) {
                                    alert("ID lowongan tidak ditemukan!");
                                    return;
                                  }
                                  if (
                                    !window.confirm(
                                      "Yakin ingin menandai lowongan ini sebagai selesai?",
                                    )
                                  )
                                    return;
                                  try {
                                    // Update status job_openings menjadi closed & completed
                                    await axios.put(
                                      `/api/job-openings/${jobOpeningId}/complete`,
                                    );
                                    alert("Lowongan berhasil diselesaikan.");
                                    // Refresh status di map
                                    fetchJobStatus(jobOpeningId);
                                  } catch (err) {
                                    alert(
                                      "Gagal menyelesaikan lowongan: " +
                                        (err?.response?.data?.message ||
                                          err?.message ||
                                          JSON.stringify(err)),
                                    );
                                  }
                                }}
                              >
                                Selesaikan Lowongan Ini
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {/* LIST HISTORY */}
                      <div className="divide-y">
                        {(showAll[job]
                          ? filteredHistory[job]
                          : filteredHistory[job].slice(0, 1)
                        ).map((d) => (
                          <div key={d.id} className="p-4 bg-base-100">
                            <div className="flex flex-col gap-1">
                              {/* ATAS (warning) */}
                              {/* BARIS ATAS (WARNING DI KANAN) */}
                              <div className="flex justify-end">
                                {d.result === "pending" && (
                                  <span className="text-warning">
                                    Silakan ubah hasil interview ini pada menu
                                    lihat detail.
                                  </span>
                                )}

                                {(d.status === "cancelled" ||
                                  d.status === "canceled_by_company") && (
                                  <p className="text-error">
                                    Lowongan ini dibatalkan oleh perusahaan
                                  </p>
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                {/* KIRI: NAMA */}
                                <h2 className="font-semibold">
                                  {d.candidate_name}
                                </h2>

                                {/* KANAN: BADGE + BUTTON */}
                                <div className="flex gap-2 items-center">
                                  {d.result === "pending" && (
                                    <span className="badge badge-warning mr-1">
                                      Belum Dinilai
                                    </span>
                                  )}
                                  {d.result === "no_show" && (
                                    <span className="badge badge-warning mr-1">
                                      Tidak Ditampilkan
                                    </span>
                                  )}
                                  {d.status === "completed" ? (
                                    <span className="badge badge-success">
                                      Selesai
                                    </span>
                                  ) : d.status === "cancelled" ||
                                    d.status === "canceled_by_company" ? (
                                    <span className="badge badge-error">
                                      Dibatalkan
                                    </span>
                                  ) : null}
                                  <button
                                    className="btn btn-info btn-xs"
                                    onClick={() => {
                                      setSelectedCandidate(d);
                                      setIsDetailOpen(true);
                                    }}
                                  >
                                    Lihat Detail
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-sm space-y-1">
                              <p>📆 {formatDate(d.scheduled_date)}</p>
                              <p>📍 {d.interview_type || "-"}</p>
                              <p>
                                🎯 Interviewer : {d.interviewer_name || "-"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* BUTTON SHOW MORE */}
                      {Array.isArray(filteredHistory[job]) &&
                        filteredHistory[job].length > 1 && (
                          <div className="p-4 text-center">
                            <button
                              className="btn-sm"
                              onClick={() => {
                                setShowAll((prev) => ({
                                  ...prev,
                                  [job]: !prev[job],
                                }));
                              }}
                            >
                              {showAll[job]
                                ? "Tampilkan Sedikit Data"
                                : `Tampilkan Semua (${filteredHistory[job].length})`}
                            </button>
                          </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        {/* Modal Form Jadwal/Cancel */}
        <HRModalInterview
          isFormOpen={isModalOpen}
          isCancelOpen={isCancelModalOpen}
          isDetailOpen={false}
          onCloseForm={() => {
            setIsModalOpen(false);
            setIsDetailOpen(false);
          }}
          onCloseCancel={() => setIsCancelModalOpen(false)}
          selectedCandidate={selectedCandidate}
          form={form}
          setForm={setForm}
          mode={mode}
          cancelNotes={cancelNotes}
          setCancelNotes={setCancelNotes}
          onSubmit={async () => {
            if (!selectedCandidate?.application_id) {
              alert("Data aplikasi kandidat tidak ditemukan!");
              return;
            }
            // Validasi sederhana
            if (!form.scheduled_date) {
              alert("Tanggal wajib diisi!");
              return;
            }
            // Validasi bentrok interviewer (waktu overlap)
            if (form.scheduled_date && form.interviewer_id) {
              const newStart = new Date(form.scheduled_date);
              const newEnd = new Date(
                newStart.getTime() +
                  (parseInt(form.duration_minutes || 0) || 0) * 60000,
              );
              const conflict = data.some((d) => {
                // Jangan cek bentrok dengan interview yang sedang diupdate (mode update)
                if (
                  d.interviewer_id === form.interviewer_id &&
                  ["scheduled", "rescheduled"].includes(d.status) &&
                  (mode !== "update" || d.id !== selectedCandidate.id)
                ) {
                  const existStart = new Date(d.scheduled_date);
                  const existEnd = new Date(
                    existStart.getTime() +
                      (parseInt(d.duration_minutes || 0) || 0) * 60000,
                  );
                  // Cek overlap
                  return newStart < existEnd && existStart < newEnd;
                }
                return false;
              });
              if (conflict) {
                alert(
                  "Interviewer sudah memiliki jadwal wawancara yang bentrok di waktu tersebut. Silakan pilih waktu lain.",
                );
                return;
              }
            }
            try {
              if (mode === "update" && selectedCandidate?.id) {
                // Update interview (reschedule)
                await axios.put(
                  `/api/hr/interviews/${selectedCandidate.id}`,
                  {
                    interview_type: form.interview_type,
                    scheduled_date: form.scheduled_date,
                    duration_minutes: form.duration_minutes,
                    meeting_link: form.meeting_link,
                    location: form.location,
                    interviewer_id: form.interviewer_id,
                  },
                );
                alert("Jadwal interview berhasil diupdate");
                // Fetch data interview terbaru agar langsung update di UI
                const res = await axios.get("/api/hr/interviews");
                setData(
                  (res.data.interviews || []).map((i) => ({
                    ...i,
                    status: i.status || i.interview_status || "scheduled",
                    job_title:
                      i.job_title ||
                      i.position_name ||
                      i.base_position ||
                      "Lainnya",
                    id: i.id || i.interview_id,
                    candidate_name: i.candidate_name || i.name || "-",
                    scheduled_date: i.scheduled_date || i.date,
                    interview_type: i.interview_type || i.type || "-",
                    interviewer_name:
                      i.interviewer_name || i.interviewer || i.full_name || "-",
                  })),
                );
              } else {
                // Buat interview baru
                const res = await axios.post(
                  `/api/hr/applications/${selectedCandidate.application_id}/schedule-interview`,
                  {
                    interview_type: form.interview_type,
                    scheduled_date: form.scheduled_date,
                    duration_minutes: form.duration_minutes,
                    meeting_link: form.meeting_link,
                    location: form.location,
                    interviewer_id: form.interviewer_id,
                    interview_stage: form.interview_stage,
                  },
                );
                // Update status aplikasi ke 'wawancara'
                await axios.put(
                  `/api/hr/applications/${selectedCandidate.application_id}/status`,
                  { status: "wawancara" },
                );
                alert("Jadwal interview berhasil dibuat");
                // Ambil data interview yang baru dibuat (dari response atau fetch ulang)
                let newInterview = null;
                if (res.data && res.data.interview) {
                  newInterview = res.data.interview;
                } else {
                  // fallback: fetch interview terbaru dari API
                  const resp = await axios.get("/api/hr/interviews");
                  if (
                    resp.data &&
                    resp.data.interviews &&
                    resp.data.interviews.length > 0
                  ) {
                    // Cari interview dengan application_id yang sama
                    newInterview = resp.data.interviews.find(
                      (i) =>
                        i.application_id === selectedCandidate.application_id,
                    );
                  }
                }
                setActiveMenu("list");
                // Filter otomatis ke posisi interview baru agar langsung terlihat
                if (
                  newInterview &&
                  (newInterview.job_title ||
                    newInterview.position_name ||
                    newInterview.base_position)
                ) {
                  const jobTitle =
                    newInterview.job_title ||
                    newInterview.position_name ||
                    newInterview.base_position ||
                    "Lainnya";
                  setForm((prev) => ({
                    ...prev,
                    positionFilterList: jobTitle,
                  }));
                }
                if (newInterview) {
                  setTimeout(() => {
                    const el = document.getElementById(
                      `interview-row-${newInterview.id}`,
                    );
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      el.classList.add("ring", "ring-primary", "ring-offset-2");
                      setTimeout(() => {
                        el.classList.remove(
                          "ring",
                          "ring-primary",
                          "ring-offset-2",
                        );
                      }, 2000);
                    }
                  }, 500);
                }
                // Fetch data interview terbaru agar langsung update di UI
                const resList = await axios.get("/api/hr/interviews");
                setData(
                  (resList.data.interviews || []).map((i) => ({
                    ...i,
                    status: i.status || i.interview_status || "scheduled",
                    job_title:
                      i.job_title ||
                      i.position_name ||
                      i.base_position ||
                      "Lainnya",
                    id: i.id || i.interview_id,
                    candidate_name: i.candidate_name || i.name || "-",
                    scheduled_date: i.scheduled_date || i.date,
                    interview_type: i.interview_type || i.type || "-",
                    interviewer_name:
                      i.interviewer_name || i.interviewer || i.full_name || "-",
                  })),
                );
              }
              setIsModalOpen(false);
              // Data interview sudah di-refresh otomatis
            } catch (err) {
              alert(
                err?.response?.data?.message ||
                  (mode === "update"
                    ? "Gagal mengupdate jadwal interview"
                    : "Gagal membuat jadwal interview"),
              );
            }
          }}
          onCancelSubmit={() => {
            if (!cancelNotes) return alert("Notes wajib diisi!");
            console.log("CANCEL:", cancelNotes);
            setIsCancelModalOpen(false);
          }}
        />

        {/* Modal Detail Interview */}
        <HRInterviewDetailLowongan
          isFormOpen={false}
          isCancelOpen={false}
          isDetailOpen={isDetailOpen}
          onCloseForm={() => {
            setIsDetailOpen(false);
          }}
          selectedCandidate={selectedCandidate}
          readOnly={activeMenu === "history"}
        />
      </div>
    </TitleCard>
  );
}
