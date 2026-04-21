import React, { useEffect, useState } from "react";
import { NotificationManager } from 'react-notifications';
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import { setPageTitle } from "../features/common/headerSlice";
import TitleCard from "../components/Cards/TitleCard";

export default function CandidateJobList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [locations, setLocations] = useState([]);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedJob, setSelectedJob] = useState(null);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Lowongan Pekerjaan" }));
    fetchJobs();
  }, [dispatch]);

  useEffect(() => {
    filterJobs();
  }, [search, locationFilter, jobs]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/job-openings");
      const jobsData = res.data.jobs || [];
      // Filter: hanya tampilkan yang status open dan deadline belum lewat
      const now = new Date();
      const filtered = jobsData.filter(job => {
        if (job.status !== 'open') return false;
        if (!job.deadline) return true;
        return new Date(job.deadline) >= now;
      });
      setJobs(filtered);
      setFilteredJobs(filtered);
      // Extract unique locations
      const uniqueLocations = [...new Set(filtered.map(job => job.location).filter(Boolean))].sort();
      setLocations(uniqueLocations);
    } catch (err) {
      setError("Gagal mengambil data lowongan");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterJobs = () => {
    let result = jobs;

    if (search) {
      result = result.filter((job) =>
        job.position_name?.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (locationFilter) {
      result = result.filter(
        (job) => job.location?.toLowerCase() === locationFilter.toLowerCase(),
      );
    }

    setFilteredJobs(result);
  };

  // State untuk menyimpan daftar job yang sudah pernah dilamar
  const [appliedJobIds, setAppliedJobIds] = useState([]);

  // Ambil daftar aplikasi user saat mount
  useEffect(() => {
    const fetchAppliedJobs = async () => {
      try {
        const res = await api.get('/candidates/applications');
        if (res.data.applications) {
          const ids = res.data.applications.map(app => app.job_opening_id || app.job_openingId || app.job_id || app.jobId).filter(Boolean);
          setAppliedJobIds(ids);
        }
      } catch (err) {
        setAppliedJobIds([]);
      }
    };
    fetchAppliedJobs();
  }, []);

  const getEmploymentTypeLabel = (type) => {
    const typeMap = {
      permanent: "Tetap",
      contract: "Kontrak",
      temporary: "Sementara",
      internship: "Magang",
      part_time: "Part-time",
      freelance: "Freelance",
    };
    return typeMap[type?.toLowerCase()] || type || "-";
  };

  const openJobDetail = (job) => {
    setSelectedJob(job);
    setOpenModal(true);
  };

  return (
    <div>
      <TitleCard title="Lowongan Pekerjaan Tersedia" topMargin="mt-0">
        {/* SEARCH + FILTER */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            {/* SEARCH */}
            <div className="flex-1">
              <label className="text-xs font-semibold opacity-60 mb-1 block">
                Cari Posisi
              </label>
              <input
                type="text"
                placeholder="Contoh: Supervisor, Mentor..."
                className="input input-bordered w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* LOCATION FILTER */}
            <div className="w-full md:w-60">
              <label className="text-xs font-semibold opacity-60 mb-1 block">
                Lokasi
              </label>
              <select
                className="select select-bordered w-full"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">Semua Lokasi</option>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="text-center p-6">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* ERROR */}
        {error && <div className="text-center text-error p-4">{error}</div>}

        {/* JOB LIST */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="card bg-base-100 shadow-md border hover:shadow-xl transition"
              >
                <div className="card-body">
                  {/* TITLE */}
                  <h2 className="card-title text-primary">
                    {job.position_name}
                    {job.base_position ? ` ${job.base_position}` : ""}
                  </h2>

                  {/* LOCATION */}
                  <p className="text-sm opacity-70">
                    📍 {job.location || "Lokasi tidak disebutkan"}
                  </p>

                  {/* TYPE */}
                  <div className="badge badge-outline capitalize">
                    Pegawai {getEmploymentTypeLabel(job.employment_type)}
                  </div>

                  {/* SALARY */}
                  <p className="text-sm mt-2">
                    {job.salary_range_min && job.salary_range_max
                      ? `💰 Rp ${Number(job.salary_range_min).toLocaleString("id-ID")} - Rp ${Number(job.salary_range_max).toLocaleString("id-ID")}`
                      : "💰 Gaji dirahasiakan"}
                  </p>

                  {/* QUOTA */}
                  <p className="text-sm">👥 Kuota: {job.quota || 1}</p>

                  {/* DEADLINE */}
                  <p className="text-sm text-warning">
                    ⏳ Deadline:{" "}
                    {job.deadline
                      ? new Date(job.deadline).toLocaleDateString("id-ID")
                      : "-"}
                  </p>

                  {/* STATUS */}
                  <div className="mt-2">
                    {job.status === "open" && (
                      <span className="badge badge-success">
                        Open Recruitment
                      </span>
                    )}

                    {job.status === "closed" && (
                      <span className="badge badge-error">Closed</span>
                    )}
                  </div>

                  {/* BUTTON */}
                  <div className="card-actions justify-end mt-4">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openJobDetail(job)}
                    >
                      Lihat Detail
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      disabled={appliedJobIds.includes(job.id)}
                      onClick={() => {
                        if (appliedJobIds.includes(job.id)) {
                          NotificationManager.info('Anda sudah pernah melamar posisi ini. Tidak bisa melamar dua kali.', 'Sudah Melamar', 4000);
                          return;
                        }
                        navigate("/candidate/apply", { state: { job } });
                      }}
                    >
                      {appliedJobIds.includes(job.id) ? 'Sudah Dilamar' : 'Lamar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TitleCard>

      {/* JOB DETAIL MODAL */}
      {openModal && selectedJob && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl max-h-[85vh] overflow-y-auto p-0">
            {/* HEADER */}
            <div className="bg-base-200 p-6 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-bold text-primary">
                      {selectedJob.position_name}
                      {selectedJob.base_position ? ` ${selectedJob.base_position}` : ""}
                    </h3>

                    {selectedJob.status === "open" && (
                      <span className="badge badge-success">
                        Open Recruitment
                      </span>
                    )}

                    {selectedJob.status === "closed" && (
                      <span className="badge badge-error">Closed</span>
                    )}

                    <span className="badge badge-outline capitalize">
                      Pegawai
                      {getEmploymentTypeLabel(selectedJob.employment_type)}
                    </span>
                  </div>

                  <p className="text-sm opacity-70 mt-1">
                    📍 {selectedJob.location || "Lokasi tidak disebutkan"}
                  </p>
                </div>

                {/* CLOSE BUTTON */}
                <button
                  className="btn btn-sm btn-circle btn-ghost"
                  onClick={() => setOpenModal(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-6">
              {/* INFO PANEL */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-base-200 rounded-lg p-4">
                  <p className="text-xs opacity-60">Gaji</p>
                  <p className="font-semibold text-sm mt-1">
                    {selectedJob.salary_range_min &&
                    selectedJob.salary_range_max
                      ? `Rp ${Number(selectedJob.salary_range_min).toLocaleString("id-ID")} - Rp ${Number(selectedJob.salary_range_max).toLocaleString("id-ID")}`
                      : "Dirahasiakan"}
                  </p>
                </div>

                <div className="bg-base-200 rounded-lg p-4">
                  <p className="text-xs opacity-60">Kuota</p>
                  <p className="font-semibold text-sm mt-1">
                    👥 {selectedJob.quota || 1} orang
                  </p>
                </div>

                <div className="bg-base-200 rounded-lg p-4">
                  <p className="text-xs opacity-60">Deadline</p>
                  <p className="font-semibold text-sm mt-1 text-warning">
                    ⏳{" "}
                    {selectedJob.deadline
                      ? new Date(selectedJob.deadline).toLocaleDateString(
                          "id-ID",
                        )
                      : "-"}
                  </p>
                </div>
              </div>

              {/* DESKRIPSI */}
              <div>
                <h4 className="font-semibold text-lg mb-2">
                  📄 Deskripsi Pekerjaan
                </h4>

                <div className="bg-base-200 p-4 rounded-lg text-sm whitespace-pre-line">
                  {selectedJob.description || "Tidak ada deskripsi"}
                </div>
              </div>

              {/* REQUIREMENTS */}
              <div>
                <h4 className="font-semibold text-lg mb-2">✅ Persyaratan</h4>

                <div className="bg-base-200 p-4 rounded-lg text-sm whitespace-pre-line">
                  {selectedJob.requirements || "Tidak ada persyaratan"}
                </div>
              </div>

              {/* RESPONSIBILITIES */}
              <div>
                <h4 className="font-semibold text-lg mb-2">
                  📌 Tanggung Jawab
                </h4>

                <div className="bg-base-200 p-4 rounded-lg text-sm whitespace-pre-line">
                  {selectedJob.responsibilities || "Tidak ada data"}
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="modal-action p-6 border-t">
              <button
                className="btn btn-primary"
                disabled={appliedJobIds.includes(selectedJob.id)}
                onClick={() => {
                  if (appliedJobIds.includes(selectedJob.id)) {
                    NotificationManager.info('Anda sudah pernah melamar posisi ini. Tidak bisa melamar dua kali.', 'Sudah Melamar', 4000);
                    return;
                  }
                  navigate("/candidate/apply", { state: { job: selectedJob } });
                }}
              >
                {appliedJobIds.includes(selectedJob.id) ? 'Sudah Dilamar' : 'Lamar Sekarang'}
              </button>

              <button className="btn" onClick={() => setOpenModal(false)}>
                Tutup
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
