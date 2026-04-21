import React, { useEffect, useState } from "react";
import { NotificationManager } from "react-notifications";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";

export default function CandidateJobList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [locations, setLocations] = useState([]);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedJob, setSelectedJob] = useState(null);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Data Kandidat" }));
    fetchJobs();
  }, [dispatch]);

  useEffect(() => {
    filterJobs();
  }, [search, locationFilter, statusFilter, jobs]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/job-openings");
      const jobsData = res.data.jobs || [];
      // Tidak filter status, tampilkan semua (open & closed)
      setJobs(jobsData);
      setFilteredJobs(jobsData);
      // Extract unique locations
      const uniqueLocations = [
        ...new Set(jobsData.map((job) => job.location).filter(Boolean)),
      ].sort();
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

    if (statusFilter) {
      result = result.filter((job) => job.status === statusFilter);
    }

    setFilteredJobs(result);
  };

  // State untuk menyimpan daftar job yang sudah pernah dilamar
  const [appliedJobIds, setAppliedJobIds] = useState([]);

  // Ambil daftar aplikasi user saat mount
  useEffect(() => {
    const fetchAppliedJobs = async () => {
      try {
        const res = await api.get("/candidates/applications");
        if (res.data.applications) {
          const ids = res.data.applications
            .map(
              (app) =>
                app.job_opening_id ||
                app.job_openingId ||
                app.job_id ||
                app.jobId,
            )
            .filter(Boolean);
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
      <TitleCard title="Pilih Lowongan Pekerjaan" topMargin="mt-0">
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

          {/* STATUS FILTER */}
          <div className="w-full md:w-48">
            <label className="text-xs font-semibold opacity-60 mb-1 block">
              Status
            </label>
            <select
              className="select select-bordered w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
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
                    Pegawai {job.position_name}
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
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      navigate(`/app/candidate/${job.id}?job_id=${job.id}`, { state: { job } })
                    }
                  >
                    Lihat Lamaran
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TitleCard>
    </div>
  );
}
