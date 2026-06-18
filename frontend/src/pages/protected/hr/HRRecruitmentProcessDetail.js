import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  GraduationCap,
  Mail,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  getRequiredDocuments,
  DOCUMENT_FIELD_METADATA,
} from "../../../utils/documentRequirements";
import { useDispatch } from "react-redux";
import Pagination from "../../../components/Pagination/Pagination";
import { setPageTitle } from "../../../features/common/headerSlice";
import api from "../../../lib/api";
import useAppPopup from "../../../hooks/useAppPopup";
import CheckBadgeIcon from "@heroicons/react/24/outline/UserPlusIcon";
import { getStatusLabel } from "../../../utils/statusLabels";
import {
  buildHiredCandidateLookup,
  findHiredCandidateInfo,
} from "../../../utils/hiredCandidateStatus";

const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const normalizeStatus = (value) => String(value || "").toLowerCase().trim();
const rejectedStatuses = new Set(["ditolak", "rejected"]);
const publishedHiringStatuses = new Set([
  "interview",
  "offering",
  "completed",
  "canceled",
  "cancelled",
]);
const submittedStatuses = new Set(["submitted", "pending"]);
const screeningStatuses = new Set(["screening"]);
const acceptedStatuses = new Set(["diterima", "accepted"]);
const autoRejectAlreadyHiredStatuses = new Set([
  ...submittedStatuses,
  ...screeningStatuses,
]);

const isRejectedBecauseAlreadyHired = (application) =>
  rejectedStatuses.has(normalizeStatus(application?.status)) &&
  String(application?.admin_notes || "")
    .toLowerCase()
    .includes("sudah lolos");

const gradientButtonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 shadow-sm";
const gradientBlueButtonClass =
  `${gradientButtonBase} border border-blue-600 bg-gradient-to-b from-blue-400 to-blue-600 text-white hover:from-blue-500 hover:to-blue-700`;
const gradientOrangeButtonClass =
  `${gradientButtonBase} border border-orange-600 bg-gradient-to-b from-orange-400 to-orange-600 text-white hover:from-orange-500 hover:to-orange-700`;
const gradientRedButtonClass =
  `${gradientButtonBase} border border-red-600 bg-gradient-to-b from-red-400 to-red-600 text-white hover:from-red-500 hover:to-red-700`;

// Komponen Modal sederhana
function Modal({
  open,
  onClose,
  onSubmit,
  children,
  title,
  submitLabel = "Tolak",
  submitButtonClassName = gradientRedButtonClass,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-base-content shadow-lg">
        <h3 className="mb-4 text-lg font-bold text-base-content">{title}</h3>
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-sm btn-ghost rounded-xl" onClick={onClose}>
            Batal
          </button>
          <button
            className={submitButtonClassName}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCoverLetterFileUrl(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (value.startsWith("http")) return value;
    if (value.startsWith("/")) {
      return `${baseUrl}${value}`;
    }
    return `${baseUrl}/${value}`;
  }

  if (typeof value === "number") {
    return `${baseUrl}/${value}`;
  }

  if (typeof value === "object") {
    if (value.type === "Buffer" && Array.isArray(value.data)) {
      const bufferText = String.fromCharCode(...value.data).replace(/\0/g, "").trim();
      return getCoverLetterFileUrl(bufferText);
    }

    const fileValue =
      value.url || value.path || value.file_url || value.filename || value.name;
    return getCoverLetterFileUrl(fileValue);
  }

  return String(value);
}

function getFileDisplayText(value) {
  if (!value) return "";
  const asString = (v) => {
    const s = String(v);
    try {
      const decoded = decodeURIComponent(s);
      const parts = decoded.split(/[/\\]/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : decoded;
    } catch (e) {
      const parts = s.split(/[/\\]/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : s;
    }
  };

  if (typeof value === "string" || typeof value === "number") {
    return asString(value);
  }

  if (typeof value === "object") {
    const prop =
      value.name || value.filename || value.file_name || value.file_url || value.url || value.path;
    if (prop) return asString(prop);
    return "File terlampir";
  }

  return asString(value);
}

function getFileTypeFromPath(filePath) {
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
}

function getAssetUrl(filePath) {
  if (!filePath) return "";
  if (/^https?:\/\//i.test(filePath)) return filePath;

  const baseUrl = (process.env.REACT_APP_BASE_URL || "http://localhost:5000").replace(
    /\/$/,
    "",
  );
  const normalizedPath = String(filePath).replace(/^\/+/, "");

  return `${baseUrl}/${normalizedPath}`;
}

function isExternalLink(value) {
  if (typeof value !== "string") return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return !/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value);
}

export default function HRRecruitmentProcessDetail() {
  const { popup, alertPopup } = useAppPopup();
  // Untuk popup Tolak
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showMassUpdatePopup, setShowMassUpdatePopup] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);
  const dispatch = useDispatch();
  const location = useLocation();

  const [job, setJob] = useState(location.state?.job || null);
  // Ambil jobId dari query string
  const params = new URLSearchParams(location.search);
  const jobId = params.get("job_id");

  // Ambil applicationId dari path jika ada /recruitment-process/:id
  const urlApplicationId = location.pathname.includes("/recruitment-process/")
    ? parseInt(location.pathname.split("/recruitment-process/").pop(), 10)
    : null;

  const [view, setView] = useState("list"); // list | detail
  const [activeTab, setActiveTab] = useState("submitted"); // submitted | screening | history
  const [selected, setSelected] = useState(null);
  const [tabFilters, setTabFilters] = useState({
    submitted: { name: "", education: "", year: "" },
    screening: { name: "", education: "", year: "" },
    history: { name: "", education: "", year: "" },
  });
  const [applications, setApplications] = useState([]);
  const [hiredCandidates, setHiredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittedPage, setSubmittedPage] = useState(1);
  const [screeningPage, setScreeningPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const autoRejectedApplicationIds = useRef(new Set());
  const submittedItemsPerPage = 10;
  const screeningItemsPerPage = 10;
  const historyItemsPerPage = 10;
  const hiredCandidateLookup = useMemo(
    () => buildHiredCandidateLookup(hiredCandidates),
    [hiredCandidates],
  );

  // ================= INIT =================
  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;

      try {
        const res = await api.get(`/job-openings/${jobId}`);
        setJob(res.data?.job || null);
      } catch (err) {
        console.error("Gagal mengambil data lowongan", err);
      }
    };

    fetchJob();
    fetchApplications();
    // eslint-disable-next-line
  }, [jobId]);

  useEffect(() => {
    dispatch(
      setPageTitle({
        title: job
          ? `Pelamar Posisi ${job.position_name || job.title || "-"}`
          : "Data Pelamar",
      }),
    );
  }, [dispatch, job]);

  // Jika ada id aplikasi di URL, set selected otomatis jika ada di hasil fetch
  useEffect(() => {
    if (applications.length === 0 || selected) return;

    // Hanya auto-buka detail jika ada id aplikasi di path
    if (urlApplicationId) {
      const found = applications.find(
        (app) => Number(app.application_id) === Number(urlApplicationId),
      );
      if (found) {
        setSelected(found);
        setView("detail");
      }
    }
    // Jika tidak ada id aplikasi di path, tetap di list
  }, [urlApplicationId, applications, selected]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      let res;
      // Jika ada jobId, filter aplikasi berdasarkan jobId
      if (jobId) {
        res = await api.get(
          `/candidates/admin/applications?job_opening_id=${jobId}`,
          { headers: getAuthHeaders() },
        );
      } else {
        // Jika tidak ada jobId, ambil semua aplikasi
        res = await api.get(`/candidates/admin/applications`, {
          headers: getAuthHeaders(),
        });
      }
      // Debug: pastikan id aplikasi benar
      if (res.data.applications && Array.isArray(res.data.applications)) {
        console.log(
          "[DEBUG] Applications fetched:",
          res.data.applications.map((a) => ({
            id: a.application_id,
            candidate_id: a.candidate_id,
          })),
        );
      }
      setApplications(res.data.applications || []);
      const hiredRes = await api
        .get("/interviews?status=passed")
        .catch(() => ({ data: [] }));
      setHiredCandidates(Array.isArray(hiredRes.data) ? hiredRes.data : []);
    } catch (err) {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!selected) return;
    const appId = selected?.application_id || selected?.id;

    try {
      await api.put(
        `/candidates/admin/applications/${appId}/status`,
        {
          status: "screening",
        },
        { headers: getAuthHeaders() },
      );

      setApplications((prev) =>
        prev.map((app) =>
          (app.application_id || app.id) === appId
            ? { ...app, status: "screening" }
            : app,
        ),
      );

      setActiveTab("screening");
      setView("list");
    } catch (err) {
      await alertPopup({
        title: "Gagal Menyimpan",
        subtitle: "Perubahan status pelamar belum tersimpan",
        badge: "Error",
        message: "Gagal menyimpan perubahan status pelamar",
        confirmLabel: "Mengerti",
        variant: "warning",
      });
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectNotes.trim() || !selected) return;

    try {
      const appId = selected?.application_id || selected?.id;

      await api.put(
        `/candidates/admin/applications/${appId}/status`,
        {
          status: "ditolak",
          admin_notes: rejectNotes,
        },
        { headers: getAuthHeaders() },
      );

      setApplications((prev) =>
        prev.map((app) =>
          (app.application_id || app.id) === appId
            ? { ...app, status: "ditolak", admin_notes: rejectNotes }
            : app,
        ),
      );

      setShowRejectPopup(false);
      setRejectNotes("");
      setActiveTab("screening");
      setView("list");
    } catch (err) {
      await alertPopup({
        title: "Gagal Menyimpan",
        subtitle: "Penolakan belum tersimpan",
        badge: "Error",
        message: "Gagal menyimpan penolakan",
        confirmLabel: "Mengerti",
        variant: "warning",
      });
    }
  };

  const rejectBecauseAlreadyHired = useCallback(async (candidate, hiredInfo) => {
    if (!candidate || !hiredInfo) return;

    const appId = candidate?.application_id || candidate?.id;
    if (!appId) {
      return;
    }

    const notes = `Tidak lolos karena kandidat sudah lolos pada lowongan ${
      hiredInfo.hiredJobLabel || "-"
    }.`;

    try {
      await api.put(
        `/candidates/admin/applications/${appId}/status`,
        {
          status: "ditolak",
          admin_notes: notes,
        },
        { headers: getAuthHeaders() },
      );

      setApplications((prev) =>
        prev.map((app) =>
          (app.application_id || app.id) === appId
            ? { ...app, status: "ditolak", admin_notes: notes }
            : app,
        ),
      );

      if ((selected?.application_id || selected?.id) === appId) {
        setSelected((prev) =>
          prev ? { ...prev, status: "ditolak", admin_notes: notes } : prev,
        );
      }

      setActiveTab("history");
      setView("list");
    } catch (err) {
      console.error("Gagal menggugurkan kandidat yang sudah lolos", err);
      autoRejectedApplicationIds.current.delete(String(appId));
    }
  }, [selected]);

  useEffect(() => {
    if (applications.length === 0 || hiredCandidateLookup.size === 0) return;

    applications.forEach((candidate) => {
      const appId = candidate?.application_id || candidate?.id;
      const status = normalizeStatus(candidate?.status);
      const hiredInfo = findHiredCandidateInfo(hiredCandidateLookup, candidate);

      if (
        !appId ||
        !hiredInfo ||
        !autoRejectAlreadyHiredStatuses.has(status)
      ) {
        return;
      }
      if (autoRejectedApplicationIds.current.has(String(appId))) return;

      autoRejectedApplicationIds.current.add(String(appId));
      rejectBecauseAlreadyHired(candidate, hiredInfo);
    });
  }, [applications, hiredCandidateLookup, rejectBecauseAlreadyHired]);

  const handleMassUpdateSubmit = async () => {
    const screeningIds = passedApplicants.map(
      (app) => app.application_id || app.id,
    );

    if (screeningIds.length === 0) return;

    try {
      await Promise.all(
        screeningIds.map((id) =>
          api.put(
            `/candidates/admin/applications/${id}/status`,
            { status: "lolos_dokumen" },
            { headers: getAuthHeaders() },
          ),
        ),
      );

      if (jobId) {
        await api.put(`/job-openings/${jobId}/advance-to-interview`);
      }

      setJob((prev) =>
        prev ? { ...prev, hiring_status: "interview" } : prev,
      );
      setActiveTab("history");

      setShowMassUpdatePopup(false);
      await fetchApplications();
    } catch (err) {
      await alertPopup({
        title: "Gagal Update",
        subtitle: "Status massal belum berhasil diperbarui",
        badge: "Error",
        message: "Gagal update status massal",
        confirmLabel: "Mengerti",
        variant: "warning",
      });
    }
  };

  const passedApplicants = useMemo(() => {
    return applications.filter((app) =>
      screeningStatuses.has(normalizeStatus(app.status)),
    );
  }, [applications]);

  const isResultPublished = publishedHiringStatuses.has(
    normalizeStatus(job?.hiring_status),
  );

  const shortlistedApplications = useMemo(() => {
    return applications.filter((app) => {
      const status = normalizeStatus(app.status);
      if (screeningStatuses.has(status)) return true;
      return false;
    });
  }, [applications]);

  // Untuk tabel riwayat, jika lowongan sudah closed & completed, tampilkan SEMUA aplikasi kecuali yang diterima
  // Jika belum completed, hanya tampilkan yang ditolak saja
  const historyApplications = useMemo(() => {
    const historyStatusesBeforePublish = new Set(["withdrawn", "ditolak", "rejected"]);

    const isClosedCompleted =
      job && job.status === "closed" && job.hiring_status === "completed";
    if (isClosedCompleted) {
      // Tampilkan semua aplikasi kecuali yang statusnya 'diterima'
      return applications.filter(
        (app) => !acceptedStatuses.has(normalizeStatus(app.status)),
      );
    }

    if (isResultPublished) {
      // Setelah publish, tampilkan semua status final/non-antrian agar data mengikuti database.
      return applications.filter((app) => {
        const status = normalizeStatus(app.status);
        return !submittedStatuses.has(status) && !screeningStatuses.has(status);
      });
    } else {
      // Sebelum publish, yang sudah final (ditolak/rejected/withdrawn) tetap muncul di riwayat.
      return applications.filter((app) =>
        historyStatusesBeforePublish.has(normalizeStatus(app.status)),
      );
    }
  }, [applications, job, isResultPublished]);

  // ================= FILTER =================
  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => submittedStatuses.has(normalizeStatus(app.status)))
      .filter(
        (app) =>
          (app.candidate_name || app.name || "")
            .toLowerCase()
            .includes(tabFilters.submitted.name.toLowerCase()) &&
          (tabFilters.submitted.education
            ? String(app.education_level || "")
                .toLowerCase()
                .includes(tabFilters.submitted.education.toLowerCase())
            : true) &&
          (tabFilters.submitted.year
            ? String(app.graduation_year || "").includes(
                tabFilters.submitted.year,
              )
            : true),
      );
  }, [applications, tabFilters.submitted]);

  const submittedTotalPages = Math.ceil(
    filteredApplications.length / submittedItemsPerPage,
  );

  const paginatedSubmittedApplications = useMemo(() => {
    const startIndex = (submittedPage - 1) * submittedItemsPerPage;
    return filteredApplications.slice(
      startIndex,
      startIndex + submittedItemsPerPage,
    );
  }, [filteredApplications, submittedPage]);

  const filteredShortlistedApplications = useMemo(() => {
    return shortlistedApplications.filter((app) => {
      const nameMatch = (app.candidate_name || app.name || "")
        .toLowerCase()
        .includes(tabFilters.screening.name.toLowerCase());
      const educationMatch = tabFilters.screening.education
        ? String(app.education_level || "")
            .toLowerCase()
            .includes(tabFilters.screening.education.toLowerCase())
        : true;
      const yearMatch = tabFilters.screening.year
        ? String(app.graduation_year || "").includes(tabFilters.screening.year)
        : true;

      return nameMatch && educationMatch && yearMatch;
    });
  }, [shortlistedApplications, tabFilters.screening]);

  const screeningTotalPages = Math.ceil(
    filteredShortlistedApplications.length / screeningItemsPerPage,
  );

  const paginatedShortlistedApplications = useMemo(() => {
    const startIndex = (screeningPage - 1) * screeningItemsPerPage;
    return filteredShortlistedApplications.slice(
      startIndex,
      startIndex + screeningItemsPerPage,
    );
  }, [filteredShortlistedApplications, screeningPage]);

  const filteredHistoryApplications = useMemo(() => {
    return historyApplications.filter((app) => {
      const nameMatch = (app.candidate_name || app.name || "")
        .toLowerCase()
        .includes(tabFilters.history.name.toLowerCase());
      const educationMatch = tabFilters.history.education
        ? String(app.education_level || "")
            .toLowerCase()
            .includes(tabFilters.history.education.toLowerCase())
        : true;
      const yearMatch = tabFilters.history.year
        ? String(app.graduation_year || "").includes(tabFilters.history.year)
        : true;

      return nameMatch && educationMatch && yearMatch;
    });
  }, [historyApplications, tabFilters.history]);

  const historyTotalPages = Math.ceil(
    filteredHistoryApplications.length / historyItemsPerPage,
  );

  const paginatedHistoryApplications = useMemo(() => {
    const startIndex = (historyPage - 1) * historyItemsPerPage;
    return filteredHistoryApplications.slice(startIndex, startIndex + historyItemsPerPage);
  }, [filteredHistoryApplications, historyPage]);

  const handleTabFilterChange = (tab, field, value) => {
    setTabFilters((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [field]: value,
      },
    }));
  };

  const resetTabFilters = (tab) => {
    setTabFilters((prev) => ({
      ...prev,
      [tab]: { name: "", education: "", year: "" },
    }));
  };

  useEffect(() => {
    setSubmittedPage(1);
  }, [tabFilters.submitted.name, tabFilters.submitted.education, tabFilters.submitted.year, applications.length]);

  useEffect(() => {
    setScreeningPage(1);
  }, [tabFilters.screening.name, tabFilters.screening.education, tabFilters.screening.year, applications.length]);

  useEffect(() => {
    setHistoryPage(1);
  }, [tabFilters.history.name, tabFilters.history.education, tabFilters.history.year, historyApplications.length]);

  const openPreviewModal = (filePath, title) => {
    if (!filePath) return;
    setSelectedPreview({
      path: filePath,
      title,
      type: getFileTypeFromPath(filePath),
    });
  };

  const closePreviewModal = () => {
    setSelectedPreview(null);
  };

  // Sudah digabung di atas

  const submittedCount = filteredApplications.length;
  const shortlistCount = filteredShortlistedApplications.length;
  const historyCount = filteredHistoryApplications.length;

  const activeFilterState = tabFilters[activeTab] || { name: "", education: "", year: "" };
  const currentPage =
    activeTab === "submitted"
      ? submittedPage
      : activeTab === "screening"
        ? screeningPage
        : historyPage;
  const currentTotalPages =
    activeTab === "submitted"
      ? submittedTotalPages
      : activeTab === "screening"
        ? screeningTotalPages
        : historyTotalPages;
  const setCurrentPage =
    activeTab === "submitted"
      ? setSubmittedPage
      : activeTab === "screening"
        ? setScreeningPage
        : setHistoryPage;
  const currentItemsPerPage =
    activeTab === "submitted"
      ? submittedItemsPerPage
      : activeTab === "screening"
        ? screeningItemsPerPage
        : historyItemsPerPage;

  const activeRows =
    activeTab === "submitted"
      ? paginatedSubmittedApplications
      : activeTab === "screening"
        ? paginatedShortlistedApplications
        : paginatedHistoryApplications;
  const activeTotal =
    activeTab === "submitted"
      ? filteredApplications.length
      : activeTab === "screening"
        ? filteredShortlistedApplications.length
        : filteredHistoryApplications.length;

  const menu = [
    {
      key: "submitted",
      label: "Data Pelamar",
      count: submittedCount,
      icon: Users,
      description: "Lamaran baru masuk",
    },
    {
      key: "screening",
      label: "Shortlisted Kandidat",
      count: shortlistCount,
      icon: UserCheck,
      description: "Kandidat tahap screening",
    },
    {
      key: "history",
      label: "Riwayat Pelamar",
      count: historyCount,
      icon: ClipboardCheck,
      description: "Hasil proses terdahulu",
    },
  ];

  const statusBadgeClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (["screening", "lolos_dokumen", "diterima"].includes(normalized)) {
      return "!bg-emerald-500 !text-white";
    }
    if (["ditolak", "rejected"].includes(normalized)) return "!bg-red-500 !text-white";
    if (["withdrawn"].includes(normalized)) return "!bg-slate-400 !text-white";
    return "!bg-orange-500 !text-white";
  };

  const getApplicationStatusLabel = (application) => {
    if (isRejectedBecauseAlreadyHired(application)) return "Digugurkan";
    return getStatusLabel(application?.status);
  };

  const renderFilterCard = () => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <label className="input input-bordered flex w-full items-center gap-2 rounded-xl bg-white text-slate-900 lg:col-span-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Cari nama kandidat..."
            className="grow bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={activeFilterState.name}
            onChange={(e) => handleTabFilterChange(activeTab, "name", e.target.value)}
          />
        </label>

        <input
          className="input input-bordered w-full rounded-xl bg-white text-slate-900 lg:col-span-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Cari pendidikan..."
          value={activeFilterState.education}
          onChange={(e) => handleTabFilterChange(activeTab, "education", e.target.value)}
        />

        <input
          className="input input-bordered w-full rounded-xl bg-white text-slate-900 lg:col-span-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Cari tahun lulus..."
          value={activeFilterState.year}
          onChange={(e) => handleTabFilterChange(activeTab, "year", e.target.value)}
        />

        <button
          type="button"
          className="btn btn-outline rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-content lg:col-span-2"
          onClick={() => resetTabFilters(activeTab)}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </div>
  );

  const renderCandidateTable = () => (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="table w-full">
          <thead className="bg-slate-50 text-center text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th className="text-left">Kandidat</th>
              <th>Email</th>
              <th>Pendidikan</th>
              <th>Tahun Lulus</th>
              <th>NPWP</th>
              {activeTab !== "submitted" && <th>Status/Hasil</th>}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTab !== "submitted" ? 7 : 6}
                  className="py-10 text-center text-slate-500 dark:text-slate-400"
                >
                  Tidak ada data kandidat pada tab ini.
                </td>
              </tr>
            ) : (
              activeRows.map((item) => {
                return (
                <tr
                  key={item?.application_id || item?.id}
                  className="hover:bg-orange-50/40 dark:hover:bg-slate-800/70"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-slate-50">
                          {item.candidate_name || item.name || "-"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center text-sm text-slate-600 dark:text-slate-300">
                    {item.candidate_email || item.email || "-"}
                  </td>
                  <td className="text-center text-sm text-slate-600 dark:text-slate-300">
                    {item.education_level ? `${item.education_level} - ${item.major || "-"}` : "-"}
                  </td>
                  <td className="text-center text-sm text-slate-600 dark:text-slate-300">
                    {item.graduation_year || "-"}
                  </td>
                  <td className="text-center text-sm text-slate-600 dark:text-slate-300">
                    {item.npwp || "-"}
                  </td>
                  {activeTab !== "submitted" && (
                    <td className="text-center">
                      <span className={`badge badge-sm rounded-full border-none px-3 py-3 font-bold ${statusBadgeClass(item.status)}`}>
                        {activeTab === "screening"
                          ? rejectedStatuses.has(normalizeStatus(item.status))
                            ? "Ditolak"
                            : "Lolos Dokumen"
                          : getApplicationStatusLabel(item)}
                      </span>
                    </td>
                  )}
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        className={`${gradientBlueButtonClass} px-3 py-1 text-xs`}
                        onClick={() => {
                          setSelected({
                            ...item,
                            isHistory: activeTab === "history",
                          });
                          setView("detail");
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          page={currentPage}
          totalPages={Math.max(1, currentTotalPages)}
          onChangePage={setCurrentPage}
          itemsPerPage={currentItemsPerPage}
        />
      </div>
    </>
  );

  return (
    <>
      {popup}
      {view === "list" && (
        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_20px_70px_rgba(2,6,23,0.45)] sm:p-7">
          <div className="space-y-6">
            <div className="relative flex flex-col gap-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-r from-white via-white to-orange-50/80 px-4 py-5 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:px-6 sm:py-6">
              <button
                type="button"
                className={`${gradientOrangeButtonClass} relative z-20 h-9 self-start px-3.5 py-0 text-xs sm:h-10 sm:self-end sm:px-4 sm:text-sm`}
                style={{
                  background: "#f97316",
                  borderColor: "#ea580c",
                  color: "#ffffff",
                }}
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </button>
              <div className="relative z-10 max-w-3xl">
                <div className="mb-4 flex items-start gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600 dark:border-orange-900/60 dark:bg-orange-950/70 dark:text-orange-300">
                    <BriefcaseBusiness className="h-4 w-4" />
                    Proses Rekrutmen
                  </div>
                </div>

                <h1 className="text-[28px] font-extrabold leading-tight text-slate-900 dark:text-slate-50">
                  {job ? `Data Pelamar - ${job.position_name || job.title || "-"}` : "Data Pelamar"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  Kelola kandidat berdasarkan status lamaran, screening dokumen,
                  dan riwayat proses rekrutmen secara lebih rapi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
  {menu.map((item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.key;

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => setActiveTab(item.key)}
        className={`relative overflow-hidden rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
          isActive
            ? "border-orange-200 bg-white text-orange-500 ring-1 ring-orange-100"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        }`}
      >
        {/* Garis bawah seperti HRJobOpenings */}
        {isActive && (
          <div className="absolute bottom-0 left-0 h-1 w-full bg-orange-500" />
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`text-sm font-semibold ${
                isActive
                  ? "text-orange-500"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {item.label}
            </p>

            <p
              className={`mt-2 text-3xl font-extrabold ${
                isActive
                  ? "text-orange-600"
                  : "text-slate-900 dark:text-slate-50"
              }`}
            >
              {item.count}
            </p>

            <p
              className={`mt-1 text-xs font-medium ${
                isActive
                  ? "text-orange-500/80"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {item.description}
            </p>
          </div>

          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isActive
                ? "bg-orange-100 text-orange-600"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </button>
    );
  })}
</div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
                    {menu.find((item) => item.key === activeTab)?.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Publikasikan hasil screening untuk kandidat yang lolos dokumen dan lanjut ke tahap interview.
                  </p>
                </div>

                {activeTab === "screening" && (
                  <button
                    type="button"
                    className={gradientBlueButtonClass}
                    onClick={() => setShowMassUpdatePopup(true)}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Publikasikan Hasil
                  </button>
                )}
              </div>

              <div className="space-y-5">
                {renderFilterCard()}

                {loading ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <span className="loading loading-spinner loading-lg text-orange-500" />
                    <p className="mt-3 text-sm font-medium">Memuat data kandidat...</p>
                  </div>
                ) : (
                  renderCandidateTable()
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "detail" && selected && (
        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_20px_70px_rgba(2,6,23,0.45)] sm:p-7">
          <div className="space-y-6">
            <div className="relative flex flex-col gap-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-r from-white via-white to-orange-50/80 p-5 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
              <button
                type="button"
                className={`${gradientOrangeButtonClass} relative z-20 self-start px-4 py-2 sm:self-end`}
                style={{
                  background: "#f97316",
                  borderColor: "#ea580c",
                  color: "#ffffff",
                }}
                onClick={() => setView("list")}
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </button>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="avatar">
                    <div className="h-20 w-20 rounded-3xl ring ring-orange-200 ring-offset-2 ring-offset-white dark:ring-orange-900 dark:ring-offset-slate-950">
                      <img
                        src={
                          selected.photo_file
                            ? selected.photo_file.startsWith("http")
                              ? selected.photo_file
                              : `${baseUrl}/${selected.photo_file.replace(/^\//, "")}`
                            : "https://ui-avatars.com/api/?name=" +
                              encodeURIComponent(selected.candidate_name || selected.name || "-") +
                              "&background=fb923c&color=fff"
                        }
                        alt="Foto Kandidat"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600 dark:border-orange-900/60 dark:bg-orange-950/70 dark:text-orange-300">
                      <UserCheck className="h-4 w-4" />
                      Detail Kandidat
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                      {selected.candidate_name || selected.name || "-"}
                    </h1>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Mail className="h-4 w-4" />
                      {selected.candidate_email || selected.email || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-50">Data Diri Lengkap</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Informasi profil dan pendidikan kandidat.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    { key: "candidate_name", label: "Nama Lengkap" },
                    { key: "candidate_email", label: "Email" },
                    { key: "phone", label: "Nomor HP" },
                    { key: "gender", label: "Jenis Kelamin" },
                    { key: "birth_place", label: "Tempat Lahir" },
                    { key: "date_of_birth", label: "Tanggal Lahir" },
                    { key: "marital_status", label: "Status Pernikahan" },
                    { key: "nationality", label: "Kebangsaan" },
                    { key: "address", label: "Alamat" },
                    { key: "nik", label: "NIK" },
                    { key: "npwp", label: "No. NPWP" },
                    { key: "education_level", label: "Tingkat Pendidikan" },
                    { key: "university", label: "Sekolah/Universitas" },
                    { key: "major", label: "Jurusan" },
                    { key: "graduation_year", label: "Tahun Lulus" },
                    { key: "linkedin", label: "LinkedIn" },
                    { key: "portfolio", label: "Portfolio Website" },
                    { key: "expected_salary", label: "Ekspektasi Gaji" },
                  ].map((f) => (
                    <div key={f.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{f.label}</p>
                      <p className="mt-1 break-words text-sm font-extrabold text-slate-900 dark:text-slate-50">
                        {f.key === "date_of_birth"
                          ? selected[f.key]
                            ? new Date(selected[f.key]).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                            : "-"
                          : f.key === "expected_salary"
                            ? selected[f.key]
                              ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(selected[f.key])
                              : "-"
                            : selected[f.key] || selected[f.key.replace("candidate_", "")] || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {!selected?.isHistory && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="mb-4 text-lg font-extrabold text-slate-900 dark:text-slate-50">Aksi Screening</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        className={`${gradientRedButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                        onClick={() => setShowRejectPopup(true)}
                        disabled={
                          rejectedStatuses.has(normalizeStatus(selected?.status))
                        }
                      >
                        <X className="h-4 w-4" />
                        Tolak
                      </button>
                      <button
                        className={`${gradientBlueButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                        onClick={handleAccept}
                        disabled={
                          passedApplicants.some((p) => p.application_id === selected?.application_id) ||
                          rejectedStatuses.has(normalizeStatus(selected?.status))
                        }
                      >
                        <UserCheck className="h-4 w-4" />
                        Shortlist
                      </button>
                    </div>
                  </div>
                )}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-50">Status Pelamar</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Ringkasan proses lamaran.</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
                      <span className="text-slate-500 dark:text-slate-400">Status</span>
                      <span className={`badge badge-sm rounded-full border-none px-3 py-3 font-bold ${statusBadgeClass(selected.status || "submitted")}`}>
                        {getApplicationStatusLabel(selected)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
                      <span className="text-slate-500 dark:text-slate-400">Apply</span>
                      <span className="font-bold text-slate-900 dark:text-slate-50">{selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString("id-ID") : "-"}</span>
                    </div>
                    {selected.reviewed_at && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
                        <span className="text-slate-500 dark:text-slate-400">Review</span>
                        <span className="font-bold text-slate-900 dark:text-slate-50">{new Date(selected.reviewed_at).toLocaleDateString("id-ID")}</span>
                      </div>
                    )}
                    {selected.scheduled_date && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
                        <span className="text-slate-500 dark:text-slate-400">Interview</span>
                        <span className="font-bold text-slate-900 dark:text-slate-50">{new Date(selected.scheduled_date).toLocaleDateString("id-ID")}</span>
                      </div>
                    )}
                  </div>
                </div>                
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-50">Dokumen Kandidat</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Preview dokumen persyaratan berdasarkan posisi.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {(() => {
                  const pos = selected.position_name || selected.position || "";
                  const basePos = selected.base_position || "";
                  const req = getRequiredDocuments(pos, basePos);
                  const meta = DOCUMENT_FIELD_METADATA;
                  const requiredFields = (req.required || []).map((key) => ({ key, required: true }));
                  const optionalFields = (req.optional || []).map((key) => ({ key, required: false }));
                  const groupedFields = [
                    { title: "Wajib", items: requiredFields },
                    { title: "Tidak Wajib", items: optionalFields },
                  ];

                  return groupedFields.map((group) => (
                    <div
                      key={group.title}
                      className={`space-y-3 rounded-3xl border px-4 py-4 shadow-sm dark:shadow-none ${
                        group.title === "Wajib"
                          ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/10"
                          : "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-50">
                            {group.title}
                          </h3>
                          <span className={`badge badge-sm rounded-full border-none px-3 py-2 font-bold ${group.title === "Wajib" ? "!bg-amber-500 !text-white" : "!bg-slate-500 !text-white"}`}>
                            {group.items.length}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {group.title === "Wajib" ? "Harus ada" : "Opsional"}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {group.items.map(({ key, required }) => {
                          const val = selected[key];
                          const label = meta[key]?.label || key;
                          const externalLink = isExternalLink(val);
                          let url = "";
                          if (val) {
                            if (val.startsWith("http")) url = val;
                            else if (val.startsWith("/uploads") || val.startsWith("uploads/")) {
                              url = `${baseUrl}/${val.replace(/^\//, "")}`;
                            } else {
                              url = `${baseUrl}/uploads/candidate_documents/${val}`;
                            }
                          }

                          return (
                            <div
                              key={key}
                              className={`rounded-2xl border p-4 ${required ? "border-amber-200 bg-white dark:border-amber-900/50 dark:bg-slate-950/40" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/40"}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-50">
                                    {label}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className={`badge badge-sm rounded-full border-none px-2 py-1 text-[11px] font-bold ${required ? "!bg-amber-500 !text-white" : "!bg-slate-500 !text-white"}`}>
                                      {required ? "Wajib" : "Opsional"}
                                    </span>
                                    <span className={`text-xs font-semibold ${val ? "text-emerald-600 dark:text-emerald-300" : "text-red-500 dark:text-red-300"}`}>
                                      {val ? "Ada" : "Tidak ada"}
                                    </span>
                                  </div>
                                </div>

                                {val ? externalLink ? (
                                  <a
                                    href={val}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-600 bg-gradient-to-b from-blue-400 to-blue-600 text-white transition-all duration-200 hover:from-blue-500 hover:to-blue-700"
                                    title={`Lihat ${label}`}
                                    aria-label={`Lihat ${label}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openPreviewModal(url, label)}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-600 bg-gradient-to-b from-blue-400 to-blue-600 text-white transition-all duration-200 hover:from-blue-500 hover:to-blue-700"
                                    title={`Preview ${label}`}
                                    aria-label={`Preview ${label}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                                    disabled
                                    title={`Tidak ada ${label}`}
                                    aria-label={`Tidak ada ${label}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-50">Cover Letter</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Dokumen atau file cover letter kandidat.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
                {selected.cover_letter_file ? (
                  (() => {
                    const coverLetterUrl = getCoverLetterFileUrl(selected.cover_letter_file);
                    const externalLink = isExternalLink(selected.cover_letter_file);
                    return (
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="font-semibold text-slate-700 dark:text-slate-200 break-all">
                          {getFileDisplayText(selected.cover_letter_file) || "Cover letter"}
                        </div>
                        {externalLink ? (
                          <a
                            href={selected.cover_letter_file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={gradientBlueButtonClass}
                          >
                            <Eye className="h-4 w-4" />
                            Lihat
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPreviewModal(coverLetterUrl, "Cover Letter")}
                            className={gradientBlueButtonClass}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </button>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada cover letter.</p>
                )}
              </div>
            </div>
          </div>

          <Modal
            open={showRejectPopup}
            onClose={() => {
              setShowRejectPopup(false);
              setRejectNotes("");
            }}
            onSubmit={handleRejectSubmit}
            title="Tolak Pelamar"
          >
            <label className="mb-2 block font-medium">Catatan Penolakan</label>
            <textarea
              className="textarea textarea-bordered w-full rounded-xl"
              rows={3}
              placeholder="Masukkan alasan penolakan..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
            />
          </Modal>
        </div>
      )}

      <Modal
        open={showMassUpdatePopup}
        onClose={() => setShowMassUpdatePopup(false)}
        onSubmit={handleMassUpdateSubmit}
        title="Konfirmasi Publikasi Hasil"
        submitLabel="Ya, Publikasikan"
        submitButtonClassName={gradientBlueButtonClass}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-slate-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-slate-200">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm">
              <CheckBadgeIcon className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-50">
                Publikasikan hasil screening kandidat?
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Semua kandidat pada tab Shortlisted akan dipublikasikan hasilnya,
                termasuk kandidat yang ditolak dan kandidat yang lolos dokumen.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
            Pastikan seluruh hasil screening sudah final sebelum dipublikasikan.
          </div>
        </div>
      </Modal>

      {selectedPreview ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              className="btn btn-sm btn-circle absolute right-2 top-2"
              onClick={closePreviewModal}
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-1 text-xl font-extrabold text-slate-900 dark:text-slate-50">
              {selectedPreview.title || "Preview File"}
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {getFileDisplayText(selectedPreview.path)}
            </p>

            <div className="flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950">
              {selectedPreview.type === "image" ? (
                <img
                  src={getAssetUrl(selectedPreview.path)}
                  alt={selectedPreview.title || "Preview file"}
                  className="max-h-[70vh] w-auto object-contain"
                />
              ) : selectedPreview.type === "pdf" ? (
                <iframe
                  title={selectedPreview.title || "Preview PDF"}
                  src={getAssetUrl(selectedPreview.path)}
                  className="h-[70vh] w-full border-0"
                />
              ) : selectedPreview.path ? (
                <div className="p-6 text-center">
                  <p className="mb-2 text-slate-600 dark:text-slate-300">
                    Preview tidak tersedia untuk tipe file ini.
                  </p>
                  <a
                    href={getAssetUrl(selectedPreview.path)}
                    target="_blank"
                    rel="noreferrer"
                    className={gradientBlueButtonClass}
                  >
                    Buka File
                  </a>
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">Tidak ada file.</p>
              )}
            </div>
          </div>
          <label className="modal-backdrop" onClick={closePreviewModal}>
            Close
          </label>
        </div>
      ) : null}
    </>
  );
}
