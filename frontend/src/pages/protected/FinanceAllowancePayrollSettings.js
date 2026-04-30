import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { financeApi } from "../../features/finance/api";

const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const formatPercent = (value) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value || 0) * 100)}%`;

const percentToInput = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return Number(value) * 100;
};

const normalizePercentInput = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed >= 1 ? parsed / 100 : parsed;
};

function FinancePayrollSettings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const activeRole = localStorage.getItem("activeRole") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    transport_per_day: "",
    meal_per_day: "",
    health_percentage: "",
    bpjs_percentage: "",
    tax: "",
  });

  const financeTaxOnlyMode = activeRole === "finance" && Boolean(data);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Pengaturan Payroll" }));

    const loadPayrollSettings = async () => {
      try {
        setLoading(true);
        setError("");
        const result = await financeApi.getPayrollSettings();
        setData(result);
        setForm({
          transport_per_day: result?.transport_per_day || "",
          meal_per_day: result?.meal_per_day || "",
          health_percentage: percentToInput(result?.health_percentage),
          bpjs_percentage: percentToInput(result?.bpjs_percentage),
          tax: percentToInput(result?.tax),
        });
      } catch (err) {
        console.error(err);
        setError("Gagal memuat data pengaturan payroll");
        setData(null);
        // Form kosong saat belum ada data
        setForm({
          transport_per_day: "",
          meal_per_day: "",
          health_percentage: "",
          bpjs_percentage: "",
          tax: "",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPayrollSettings();
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: value === "" ? "" : Number(value),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validasi field tidak boleh kosong
    if (
      !form.transport_per_day ||
      !form.meal_per_day ||
      !form.health_percentage ||
      !form.bpjs_percentage ||
      !form.tax
    ) {
      setError("Semua field wajib diisi");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        transport_per_day: Number(form.transport_per_day),
        meal_per_day: Number(form.meal_per_day),
        health_percentage: normalizePercentInput(form.health_percentage),
        bpjs_percentage: normalizePercentInput(form.bpjs_percentage),
        tax: normalizePercentInput(form.tax),
      };

      const result = await financeApi.updatePayrollSettings(payload);

      // Update data dengan settings terbaru yang baru disimpan
      setData(result.settings);
      setSuccess(
        data
          ? "Pengaturan payroll berhasil disimpan sebagai versi baru"
          : "Pengaturan payroll berhasil dibuat"
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal menyimpan pengaturan payroll");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    const loadingButtons = (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(-1)}
      >
        Kembali
      </button>
    );

    return (
      <TitleCard title="Pengaturan Payroll" topMargin="mt-0" TopSideButtons={loadingButtons}>
        <div className="flex justify-center p-6">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </TitleCard>
    );
  }

  return (
    <>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success">
            <span>{success}</span>
          </div>
        </div>
      )}

      {!data && !error && (
        <div className="alert alert-warning mb-4">
          <span>
            Pengaturan payroll belum ada. Silakan isi form di bawah untuk membuat
            pengaturan awal.
          </span>
        </div>
      )}

      <TitleCard 
        title={data ? "Edit Pengaturan Payroll" : "Buat Pengaturan Payroll"}
        topMargin="mt-0"
        TopSideButtons={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(-1)}
          >
            Kembali
          </button>
        }
      >
        {/* Preview Current Settings */}
        {data && (
          <>
            <div className="mb-6">
              <h3 className="font-semibold mb-4 text-base-content/70">
                Pengaturan Terbaru:{" "}{new Date(data.created_at).toLocaleDateString("id-ID")}
              </h3>
              <div className="grid md:grid-cols-4 grid-cols-1 gap-4">
                <div className="stat bg-base-100 shadow rounded-box">
                  <div className="stat-title">Transport / Hari</div>
                  <div className="stat-value text-primary text-lg">
                    {formatCurrency(data.transport_per_day)}
                  </div>
                </div>

                <div className="stat bg-base-100 shadow rounded-box">
                  <div className="stat-title">Makan / Hari</div>
                  <div className="stat-value text-secondary text-lg">
                    {formatCurrency(data.meal_per_day)}
                  </div>
                </div>

                <div className="stat bg-base-100 shadow rounded-box">
                  <div className="stat-title">Tunjangan Kesehatan</div>
                  <div className="stat-value text-accent text-lg">
                    {formatPercent(data.health_percentage)}
                  </div>
                </div>

                <div className="stat bg-base-100 shadow rounded-box">
                  <div className="stat-title">BPJS Ketenagakerjaan</div>
                  <div className="stat-value text-info text-lg">
                    {formatPercent(data.bpjs_percentage)}
                  </div>
                </div>

                <div className="stat bg-base-100 shadow rounded-box">
                  <div className="stat-title">Pajak</div>
                  <div className="stat-value text-warning text-lg">
                    {formatPercent(data.tax)}
                  </div>
                </div>
              </div>
            </div>

            <div className="divider"></div>

            <p className="text-sm text-base-content/60 mb-4">
              Ubah nilai di bawah untuk membuat versi pengaturan payroll baru.
            </p>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 grid-cols-1 gap-4 mb-4">
            <div>
              <label className="label">
                <span className="label-text font-semibold">Transport per Hari</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="transport_per_day"
                value={form.transport_per_day}
                onChange={handleChange}
                placeholder="Contoh: 50000"
                className="input input-bordered w-full"
                disabled={financeTaxOnlyMode}
                required
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-semibold">Makan per Hari</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="meal_per_day"
                value={form.meal_per_day}
                onChange={handleChange}
                placeholder="Contoh: 25000"
                className="input input-bordered w-full"
                disabled={financeTaxOnlyMode}
                required
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-semibold">BPJS Kesehatan (%)</span>
              </label>
              <input
                type="number"
                step="0.0001"
                name="health_percentage"
                value={form.health_percentage}
                onChange={handleChange}
                placeholder="Contoh: 3"
                min="0"
                max="100"
                className="input input-bordered w-full"
                disabled={financeTaxOnlyMode}
                required
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-semibold">
                  BPJS Ketenagakerjaan (%)
                </span>
              </label>
              <input
                type="number"
                step="0.0001"
                name="bpjs_percentage"
                value={form.bpjs_percentage}
                onChange={handleChange}
                placeholder="Contoh: 1"
                min="0"
                max="100"
                className="input input-bordered w-full"
                disabled={financeTaxOnlyMode}
                required
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-semibold">Pajak (%)</span>
                {activeRole !== "finance" && (
                  <span className="label-text-alt text-warning">Hanya Finance yang dapat mengubah</span>
                )}
              </label>
              <input
                type="number"
                step="0.0001"
                name="tax"
                value={form.tax}
                onChange={handleChange}
                placeholder="Contoh: 3"
                min="0"
                max="100"
                className="input input-bordered w-full"
                disabled={activeRole !== "finance" || submitting}
                required
              />
              {activeRole === "finance" && (
                <label className="label">
                  <span className="label-text-alt text-info">Anda hanya memiliki akses untuk mengubah nilai pajak</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setForm({
                  transport_per_day: data?.transport_per_day || "",
                  meal_per_day: data?.meal_per_day || "",
                  health_percentage: percentToInput(data?.health_percentage),
                  bpjs_percentage: percentToInput(data?.bpjs_percentage),
                  tax: percentToInput(data?.tax),
                });
                setError("");
              }}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${submitting ? "loading" : ""}`}
              disabled={submitting}
            >
              {data ? "Simpan Versi Baru" : "Buat Pengaturan"}
            </button>
          </div>
        </form>
      </TitleCard>
    </>
  );
}

export default FinancePayrollSettings;