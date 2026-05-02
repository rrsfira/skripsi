import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import jobService, { hrApi } from "../../features/hr/api";
import TitleCard from "../../components/Cards/TitleCard";

const defaultJobOpening = {
  position_id: "",
  title: "",
  description: "",
  requirements: "",
  responsibilities: "",
  quota: 1,
  employment_type: "permanent",
  salary_range_min: "",
  salary_range_max: "",
  location: "",
  deadline: "",
  status: "open",
};

export default function HRJobOpenings() {
  // Bidang/spesialisasi untuk mentor/project manager (hanya 5 bidang utama)
  const BASE_POSITIONS = [
    "Frontend Web Developer",
    "Backend Web Developer",
    "Frontend Mobile Developer",
    "Backend Mobile Developer",
    "Fullstack Mobile Developer",
    "Fullstack Web Developer",
    "UI/UX Designer",
    "Content Creator",
    "Graphic Designer",
    "Videographer / Video Editor",
  ];
  const DEVELOPER_SPECIALIZATIONS = [
    { value: "frontend_web", label: "Frontend Web" },
    { value: "backend_web", label: "Backend Web" },
    { value: "frontend_mobile", label: "Frontend Mobile" },
    { value: "backend_mobile", label: "Backend Mobile" },
  ];
  const [jobOpenings, setJobOpenings] = useState([]);
  const [historyOpenings, setHistoryOpenings] = useState([]);
  const [form, setForm] = useState(defaultJobOpening);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const dispatch = useDispatch();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchJobOpenings();
    fetchPositions();
    dispatch(setPageTitle({ title: "Lowongan Pekerjaan" }));
  }, [dispatch]);

  async function fetchJobOpenings() {
    setLoading(true);
    setError("");
    try {
      // Ambil data dari API
      const data = await jobService.getJobOpenings();
      let jobs = Array.isArray(data) ? data : data.jobs || [];
      const now = new Date();
      const active = [];
      const history = [];
      // Pisahkan dan update status jika perlu
      for (const job of jobs) {
        // Pastikan hiring_status tetap ikut di state
        if (job.deadline && new Date(job.deadline) < now) {
          if (job.status !== "closed") {
            try {
              await jobService.updateJobOpening(job.id, {
                ...job,
                status: "closed",
                hiring_status: job.hiring_status || "ongoing",
              });
              history.push({ ...job, status: "closed" });
            } catch (e) {
              history.push({ ...job, status: "closed" });
            }
          } else {
            history.push(job);
          }
        } else {
          active.push(job);
        }
      }
      setJobOpenings(active);
      setHistoryOpenings(history);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function fetchPositions() {
    try {
      const meta = await hrApi.getMeta();
      setPositions(meta.positions || []);
    } catch (e) {
      // abaikan error
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "position_id") {
      const selected =
        positions
          .find((p) => String(p.id) === String(value))
          ?.name?.toLowerCase() || "";
      if (
        !selected.includes("mentor") &&
        !selected.includes("project manager") &&
        selected !== "developer"
      ) {
        setForm((f) => ({ ...f, [name]: value, base_position: "", developer_specialization: "" }));
        return;
      }
    }
    if (name === "developer_specialization") {
      setForm((f) => ({ ...f, developer_specialization: value }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let payload = { ...form };
      // Pastikan base_position dan developer_specialization tetap dikirim walau kosong
      if (!payload.base_position) payload.base_position = "";
      if (!payload.developer_specialization) payload.developer_specialization = "";
      if (editMode && editId) {
        await jobService.updateJobOpening(editId, payload);
      } else {
        await jobService.createJobOpening(payload);
      }
      setForm(defaultJobOpening);
      setEditMode(false);
      setEditId(null);
      fetchJobOpenings();
      setShowForm(false);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleView(id) {
    const data = jobOpenings.find((j) => j.id === id);
    setDetailData(data);
    setShowDetail(true);
  }

  function handleEdit(id) {
    // Cari di jobOpenings, jika tidak ada cari di historyOpenings
    let data = jobOpenings.find((j) => j.id === id);
    if (!data) {
      data = historyOpenings.find((j) => j.id === id);
    }
    if (data) {
      // Pastikan hiring_status tetap ada di form, walau null/undefined
        setForm((f) => ({ 
          ...f, 
          ...data, 
          base_position: data.base_position !== undefined ? data.base_position : "", 
          hiring_status: data.hiring_status !== undefined ? data.hiring_status : "" 
        }));
      setEditMode(true);
      setEditId(id);
      setShowForm(true); // ⬅️ ini penting
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleCancelJob(id) {
    // Konfirmasi sebelum cancel
    const confirm = window.confirm("Apakah Anda yakin ingin membatalkan lowongan ini? Lowongan akan dipindahkan ke riwayat dan tidak bisa diaktifkan kembali.");
    if (!confirm) return;
    setLoading(true);
    setError("");
    try {
      // Ambil data lowongan yang akan di-cancel
      const data = jobOpenings.find((j) => j.id === id);
      if (data) {
        await jobService.updateJobOpening(id, { ...data, status: "closed" });
        await fetchJobOpenings();
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleCloseDetail() {
    setShowDetail(false);
    setDetailData(null);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setEditId(null);
    setForm(defaultJobOpening);
    setShowForm(false); // ⬅️ tutup lagi
  }

  return (
    <>
      <TitleCard
        title={
          <div className="flex justify-between items-center">
            <span>
              {editMode ? "Edit Lowongan Pekerjaan" : "Input Lowongan"}
            </span>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowForm((prev) => !prev)}
            >
              {showForm ? "Tutup" : "Tambah"}
            </button>
          </div>
        }
        topMargin="mt-0"
      >
        {(showForm || editMode) && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
          >
            <div>
              <label className="label label-text text-base-content">
                Posisi
              </label>
              <select
                name="position_id"
                value={form.position_id}
                onChange={handleChange}
                required
                className="select select-bordered w-full"
              >
                <option value="">Pilih Posisi</option>
                {positions
                  .filter((pos) => pos.name.toLowerCase() !== "commissioner")
                  .map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))}
              </select>
              {/* Jika posisi mentor/project manager, tampilkan dropdown bidang */}
              {(() => {
                const selected =
                  positions
                    .find((p) => String(p.id) === String(form.position_id))
                    ?.name?.toLowerCase() || "";
                if (
                  selected.includes("mentor") ||
                  selected.includes("project manager")
                ) {
                  return (
                    <div className="mt-2">
                      <label className="label label-text text-base-content">
                        Bidang/Spesialisasi
                      </label>
                      <select
                        name="base_position"
                        value={form.base_position || ""}
                        onChange={handleChange}
                        className="select select-bordered w-full"
                        required
                      >
                        <option value="">Pilih Bidang</option>
                        {BASE_POSITIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                if (selected === "developer") {
                  return (
                    <div className="mt-2">
                      <label className="label label-text text-base-content">
                        Bidang Developer
                      </label>
                      <select
                        name="developer_specialization"
                        value={form.developer_specialization || ""}
                        onChange={handleChange}
                        className="select select-bordered w-full"
                        required
                      >
                        <option value="">Pilih Bidang Developer</option>
                        {DEVELOPER_SPECIALIZATIONS.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div>
              <label className="label label-text text-base-content">
                Judul
              </label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className="input input-bordered w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label label-text text-base-content">
                Deskripsi
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className="textarea textarea-bordered w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label label-text text-base-content">
                Persyaratan
              </label>
              <textarea
                name="requirements"
                value={form.requirements}
                onChange={handleChange}
                className="textarea textarea-bordered w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label label-text text-base-content">
                Tanggung Jawab
              </label>
              <textarea
                name="responsibilities"
                value={form.responsibilities}
                onChange={handleChange}
                className="textarea textarea-bordered w-full"
              />
            </div>
            <div>
              <label className="label label-text text-base-content">
                Kuota
              </label>
              <input
                type="number"
                name="quota"
                value={form.quota}
                onChange={handleChange}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label label-text text-base-content">
                Jenis
              </label>
              <select
                name="employment_type"
                value={form.employment_type}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="permanent">Tetap</option>
                <option value="contract">Kontrak</option>
                <option value="intern">Magang</option>
              </select>
            </div>
            <div>
              <label className="label label-text text-base-content">
                Gaji Minimum
              </label>
              <input
                type="number"
                name="salary_range_min"
                value={form.salary_range_min}
                onChange={handleChange}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label label-text text-base-content">
                Gaji Maksimum
              </label>
              <input
                type="number"
                name="salary_range_max"
                value={form.salary_range_max}
                onChange={handleChange}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label label-text text-base-content">
                Lokasi
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label label-text text-base-content">
                Deadline
              </label>
              <input
                type="date"
                name="deadline"
                value={form.deadline ? form.deadline.substring(0, 10) : ""}
                onChange={handleChange}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label label-text text-base-content">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="open">Buka</option>
                <option value="closed">Tutup</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className="label label-text text-base-content">
                Hiring Status
              </label>
              <select
                name="hiring_status"
                value={form.hiring_status || ""}
                onChange={handleChange}
                className="select select-bordered w-full"
                required
              >
                <option value="">Pilih Status</option>
                <option value="ongoing">Ongoing</option>
                <option value="shortlisting">Shortlisting</option>
                <option value="interview">Interview</option>
                <option value="offering">Offering</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {editMode ? "Update" : "Simpan"}
              </button>
              {editMode && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Batal
                </button>
              )}
            </div>
            {error && <div className="text-error md:col-span-2">{error}</div>}
          </form>
        )}
      </TitleCard>

      {/* Modal Detail */}
      {showDetail && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative border border-base-300">
            {/* HEADER */}
            <div className="border-b border-base-300 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-base-content">
                Detail Lowongan
              </h2>

              <button
                className="text-base-content hover:text-primary text-xl"
                onClick={handleCloseDetail}
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* INFORMASI UTAMA */}
              <div>
                <h3 className="font-semibold text-base-content mb-3">
                  Informasi Pekerjaan
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-base-content/70">Judul</p>
                    <p className="font-semibold text-base-content">
                      {detailData.title}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Posisi</p>
                    <p className="font-semibold text-base-content">
                      {positions.find((p) => p.id === detailData.position_id)
                        ?.name || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Kuota</p>
                    <p className="font-semibold text-base-content">
                      {detailData.quota}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Jenis</p>
                    <p className="font-semibold capitalize text-base-content">
                      {detailData.employment_type}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Lokasi</p>
                    <p className="font-semibold text-base-content">
                      {detailData.location}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Deadline</p>
                    <p className="font-semibold text-base-content">
                      {detailData.deadline
                        ? new Date(detailData.deadline).toLocaleDateString(
                            "id-ID",
                          )
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Gaji</p>
                    <p className="font-semibold text-base-content">
                      {detailData.salary_range_min &&
                      detailData.salary_range_max
                        ? `Rp ${parseInt(
                            detailData.salary_range_min,
                          ).toLocaleString("id-ID")} - Rp ${parseInt(
                            detailData.salary_range_max,
                          ).toLocaleString("id-ID")}`
                        : "Dirahasiakan"}
                    </p>
                  </div>

                  <div>
                    <p className="text-base-content/70">Status</p>
                    <span
                      className={`badge ${
                        detailData.status === "open"
                          ? "badge-success"
                          : detailData.status === "closed"
                            ? "badge-error"
                            : "badge-warning"
                      }`}
                    >
                      {detailData.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* DESKRIPSI */}
              <div>
                <h3 className="font-semibold text-base-content mb-2">
                  Deskripsi Pekerjaan
                </h3>

                <p className="text-sm text-base-content leading-relaxed whitespace-pre-line">
                  {detailData.description || "-"}
                </p>
              </div>

              {/* PERSYARATAN */}
              <div>
                <h3 className="font-semibold text-base-content mb-2">
                  Persyaratan
                </h3>

                <p className="text-sm text-base-content leading-relaxed whitespace-pre-line">
                  {detailData.requirements || "-"}
                </p>
              </div>

              {/* TANGGUNG JAWAB */}
              <div>
                <h3 className="font-semibold text-base-content mb-2">
                  Tanggung Jawab
                </h3>

                <p className="text-sm text-base-content leading-relaxed whitespace-pre-line">
                  {detailData.responsibilities || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <TitleCard title="Daftar Lowongan Pekerjaan Aktif" topMargin="mt-4">
        {loading ? (
          <div className="text-center py-6">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Posisi</th>
                  <th>Kuota</th>
                  <th>Gaji</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jobOpenings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      Tidak ada lowongan aktif.
                    </td>
                  </tr>
                ) : (
                  jobOpenings.map((j) => (
                    <tr key={j.id} className="hover">
                      <td className="font-semibold">{j.title}</td>
                      <td>
                        {positions.find((p) => p.id === j.position_id)?.name ||
                          "-"}
                      </td>
                      <td>{j.quota}</td>
                      <td>
                        {j.salary_range_min && j.salary_range_max
                          ? `Rp ${parseInt(j.salary_range_min).toLocaleString("id-ID")} - Rp ${parseInt(j.salary_range_max).toLocaleString("id-ID")}`
                          : "Dirahasiakan"}
                      </td>
                      <td>
                        {j.deadline
                          ? new Date(j.deadline).toLocaleDateString("id-ID")
                          : "-"}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            j.status === "open"
                              ? "badge-success"
                              : j.status === "closed"
                                ? "badge-error"
                                : "badge-warning"
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="btn btn-xs btn-info text-white"
                            type="button"
                            onClick={() => handleView(j.id)}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-xs btn-warning"
                            type="button"
                            onClick={() => handleEdit(j.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-xs btn-error text-white"
                            type="button"
                            onClick={() => handleCancelJob(j.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </TitleCard>

      {/* Tabel Riwayat Lowongan */}
      <TitleCard title="Riwayat Lowongan Pekerjaan" topMargin="mt-4">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Posisi</th>
                <th>Kuota</th>
                <th>Gaji</th>
                <th>Deadline</th>
                <th>Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {historyOpenings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    Tidak ada riwayat lowongan.
                  </td>
                </tr>
              ) : (
                historyOpenings.map((j) => (
                  <tr key={j.id} className="hover">
                    <td className="font-semibold">{j.title}</td>
                    <td>
                      {positions.find((p) => p.id === j.position_id)?.name ||
                        "-"}
                    </td>
                    <td>{j.quota}</td>
                    <td>
                      {j.salary_range_min && j.salary_range_max
                        ? `Rp ${parseInt(j.salary_range_min).toLocaleString("id-ID")} - Rp ${parseInt(j.salary_range_max).toLocaleString("id-ID")}`
                        : "Dirahasiakan"}
                    </td>
                    <td>
                      {j.deadline
                        ? new Date(j.deadline).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          j.status === "open"
                            ? "badge-success"
                            : j.status === "closed"
                              ? "badge-error"
                              : "badge-warning"
                        }`}
                        >
                        {j.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="btn btn-xs btn-info text-white"
                          type="button"
                          onClick={() => {
                            setDetailData(j);
                            setShowDetail(true);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-xs btn-warning"
                          type="button"
                          onClick={() => handleEdit(j.id)}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TitleCard>
    </>
  );
}
