import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TitleCard from "../../components/Cards/TitleCard";
import axios from "axios";

export default function JobDetail() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Ambil id dari state (dari navigasi sebelumnya)
  const jobState = state?.job;
  const jobId = jobState?.id;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      setError("ID lowongan tidak ditemukan");
      return;
    }
    setLoading(true);
    axios
      .get(`/api/job-openings/${jobId}`)
      .then((res) => {
        setJob(res.data.job);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || "Gagal mengambil data lowongan");
        setLoading(false);
      });
  }, [jobId]);

  if (loading) {
    return (
      <TitleCard title="Detail Lowongan">
        <p>Memuat data lowongan...</p>
      </TitleCard>
    );
  }

  if (error || !job) {
    return (
      <TitleCard title="Detail Lowongan">
        <p>{error || "Data lowongan tidak ditemukan"}</p>
        <button className="btn btn-primary mt-3" onClick={() => navigate(-1)}>
          Kembali
        </button>
      </TitleCard>
    );
  }

  // Parsing requirements dan responsibilities jika bentuknya string JSON
  let requirements = job.requirements;
  if (typeof requirements === "string") {
    try {
      requirements = JSON.parse(requirements);
    } catch {
      requirements = [requirements];
    }
  }
  let responsibilities = job.responsibilities;
  if (typeof responsibilities === "string") {
    try {
      responsibilities = JSON.parse(responsibilities);
    } catch {
      responsibilities = [responsibilities];
    }
  }

  return (
    <TitleCard title="Detail Lowongan">
      <div className="p-6 space-y-6">
        {/* INFORMASI UTAMA */}
        <div>
          <h3 className="font-semibold text-base-content mb-3">
            Informasi Pekerjaan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-base-content/70">Judul</p>
              <p className="font-semibold text-base-content">{job.title}</p>
            </div>
            <div>
              <p className="text-base-content/70">Departemen</p>
              <p className="font-semibold text-base-content">{job.department_name || '-'}</p>
            </div>
            <div>
              <p className="text-base-content/70">Kuota</p>
              <p className="font-semibold text-base-content">{job.quota}</p>
            </div>
            <div>
              <p className="text-base-content/70">Jenis</p>
              <p className="font-semibold capitalize text-base-content">{job.employment_type}</p>
            </div>
            <div>
              <p className="text-base-content/70">Lokasi</p>
              <p className="font-semibold text-base-content">{job.location}</p>
            </div>
            <div>
              <p className="text-base-content/70">Deadline</p>
              <p className="font-semibold text-base-content">
                {job.deadline ? new Date(job.deadline).toLocaleDateString("id-ID") : "-"}
              </p>
            </div>
            <div>
              <p className="text-base-content/70">Gaji</p>
              <p className="font-semibold text-base-content">
                {job.salary_range_min && job.salary_range_max
                  ? `Rp ${parseInt(job.salary_range_min).toLocaleString("id-ID")} - Rp ${parseInt(job.salary_range_max).toLocaleString("id-ID")}`
                  : "Dirahasiakan"}
              </p>
            </div>
            <div>
              <p className="text-base-content/70">Status</p>
              <span
                className={`badge ${
                  job.status === "open"
                    ? "badge-success"
                    : job.status === "closed"
                    ? "badge-error"
                    : "badge-warning"
                }`}
              >
                {job.status}
              </span>
            </div>
          </div>
        </div>

        {/* DESKRIPSI */}
        <div>
          <h3 className="font-semibold text-base-content mb-2">Deskripsi Pekerjaan</h3>
          <p className="text-sm text-base-content leading-relaxed whitespace-pre-line">
            {job.description || "-"}
          </p>
        </div>

        {/* PERSYARATAN */}
        <div>
          <h3 className="font-semibold text-base-content mb-2">Persyaratan</h3>
          <p className="text-sm text-base-content leading-relaxed whitespace-pre-line">
            {requirements || "-"}
            </p>
        </div>

        {/* TANGGUNG JAWAB */}

        <div>
          <h3 className="font-semibold text-base-content mb-2">Tanggung Jawab</h3>
            <p className="text-sm text-base-content leading-relaxed whitespace-pre-line">
              {responsibilities || "-"}
            </p>
        </div>

        <button
          className="btn btn-primary mt-4"
          onClick={() => navigate(-1)}
        >
          Kembali
        </button>
      </div>
    </TitleCard>
  );
}