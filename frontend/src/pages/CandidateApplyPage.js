import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { setPageTitle } from "../features/common/headerSlice";
import TitleCard from "../components/Cards/TitleCard";
import { NotificationManager } from "react-notifications";
import axios from "axios";

function CandidateApplyPage() {
  // State untuk menyimpan daftar job yang sudah pernah dilamar
  const [appliedJobIds, setAppliedJobIds] = useState([]);
  const [isApplicationBlocked, setIsApplicationBlocked] = useState(false);
  const [blockReasons, setBlockReasons] = useState([]);

  // Ambil daftar aplikasi user saat mount
  useEffect(() => {
    const fetchAppliedJobs = async () => {
      try {
        const res = await axios.get("/api/candidates/applications");

        if (res.data.applications) {
          // Ambil semua job_opening_id dari aplikasi user
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

          let acceptedJobTitle = null;
          let hasOnboarding = false;

          // 🔹 Cek status accepted
          for (const app of res.data.applications) {
            const status = (app.status || "").toLowerCase();

            if (status === "accepted" || status === "diterima") {
              acceptedJobTitle =
                app.job_title || app.title || app.job_opening_id || "";
              break; // cukup ambil 1 saja
            }
          }

          // 🔹 Cek onboarding (opsional)
          try {
            const callRes = await axios.get("/api/candidate-calls/me");
            if (callRes && callRes.data) {
              hasOnboarding = true;
            }
          } catch (err) {
            // abaikan jika tidak ada onboarding
          }

          // 🔥 Gabungkan jadi 1 paragraf
          if (acceptedJobTitle) {
            setIsApplicationBlocked(true);

            let message = `Anda sudah diterima pada lowongan ${acceptedJobTitle}.`;

            if (hasOnboarding) {
              message += " Anda juga telah memiliki undangan untuk onboarding.";
            }

            setBlockReasons([message]); // tetap array biar kompatibel
          }
        }
      } catch (err) {
        setAppliedJobIds([]);
      }
    };

    fetchAppliedJobs();
  }, []);
  // Untuk menampilkan detail lowongan pada step Pilih Lowongan
  const [detailJobId, setDetailJobId] = useState(null);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const jobFromPage = location.state?.job || null;
  const comeFromJobListing = !!jobFromPage;

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [allSteps, setAllSteps] = useState([]);
  const [jobOpenings, setJobOpenings] = useState([]);
  const [selectedJob, setSelectedJob] = useState(jobFromPage || null);
  // State untuk filter lowongan
  const [jobFilter, setJobFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [candidateData, setCandidateData] = useState(() => {
    const saved = localStorage.getItem("candidateApplyData");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.log("Failed to parse saved candidate data");
      }
    }

    return {
      name: "",
      email: "",
      phone: "",
      gender: "",
      birth_place: "",
      date_of_birth: "",
      marital_status: "",
      nationality: "Indonesian",
      address: "",
      nik: "",
      npwp: "",
      education_level: "",
      university: "",
      major: "",
      graduation_year: "",
      linkedin: "",
      portfolio: "",
      expected_salary: "",
    };
  });

  // Form state - sesuai dengan applications table
  const [applicationData, setApplicationData] = useState(() => {
    const saved = localStorage.getItem("applicationApplyData");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.log("Failed to parse saved application data");
      }
    }
    return {
      job_opening_id: jobFromPage?.id || "",
      cover_letter: "",
    };
  });

  // File uploads - sesuai dengan applications table
  const [files, setFiles] = useState({
    cv_file: null,
    ktp_file: null,
    photo_file: null,
    ijazah_file: null,
    transcript_file: null,
    certificate_file: null,
    experience_letter_file: null,
    reference_letter_file: null,
    skck_file: null,
    portfolio_file: null,
    github_link: null,
    design_link: null,
    youtube_link: null,
    marketing_portfolio_link: null,
    campaign_link: null,
  });

  const [fileNames, setFileNames] = useState({
    cv_file: "",
    ktp_file: "",
    photo_file: "",
    ijazah_file: "",
    transcript_file: "",
    certificate_file: "",
    experience_letter_file: "",
    reference_letter_file: "",
    skck_file: "",
    portfolio_file: "",
    github_link: "",
    design_link: "",
    youtube_link: "",
    marketing_portfolio_link: "",
    campaign_link: "",
  });

  // Required documents state
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [optionalDocuments, setOptionalDocuments] = useState([]);

  // ========== AUTO-SAVE TO LOCALSTORAGE ==========
  useEffect(() => {
    localStorage.setItem("candidateApplyData", JSON.stringify(candidateData));
  }, [candidateData]);

  useEffect(() => {
    localStorage.setItem(
      "applicationApplyData",
      JSON.stringify(applicationData),
    );
  }, [applicationData]);

  useEffect(() => {
    localStorage.setItem("fileNamesApplyData", JSON.stringify(fileNames));
  }, [fileNames]);

  // ========== INITIALIZATION (Optimized: parallel fetch) ==========
  useEffect(() => {
    dispatch(setPageTitle({ title: "Ajukan Lamaran Pekerjaan" }));
    let candidateDataFromDB = null;
    let dbDataIsComplete = false;

    const initializeApplication = async () => {
      try {
        setLoading(true);

        // Fetch profile dan job openings secara paralel
        const [profileRes, jobsRes] = await Promise.all([
          axios.get("/api/candidates/profile").catch((e) => e),
          axios
            .get("/api/job-openings", { params: { status: "open" } })
            .catch((e) => e),
        ]);

        // Handle profile
        if (profileRes && profileRes.data && profileRes.data.candidate) {
          candidateDataFromDB = profileRes.data.candidate;
          dbDataIsComplete = !!(
            candidateDataFromDB.name &&
            candidateDataFromDB.email &&
            candidateDataFromDB.phone &&
            candidateDataFromDB.birth_place &&
            candidateDataFromDB.date_of_birth &&
            candidateDataFromDB.nik &&
            candidateDataFromDB.address
          );
        }

        // Data diri (candidateData) selalu diisi dari database jika ada
        if (candidateDataFromDB) {
          setCandidateData((prev) => ({
            ...prev,
            name: candidateDataFromDB.name || "",
            email: candidateDataFromDB.email || "",
            phone: candidateDataFromDB.phone || "",
            gender: candidateDataFromDB.gender || "",
            birth_place: candidateDataFromDB.birth_place || "",
            date_of_birth: candidateDataFromDB.date_of_birth
              ? candidateDataFromDB.date_of_birth.split("T")[0]
              : "",
            marital_status: candidateDataFromDB.marital_status || "",
            nationality: candidateDataFromDB.nationality || "Indonesian",
            address: candidateDataFromDB.address || "",
            nik: candidateDataFromDB.nik || "",
            npwp: candidateDataFromDB.npwp || "",
            education_level: candidateDataFromDB.education_level || "",
            university: candidateDataFromDB.university || "",
            major: candidateDataFromDB.major || "",
            graduation_year: candidateDataFromDB.graduation_year || "",
            linkedin: candidateDataFromDB.linkedin || "",
            portfolio: candidateDataFromDB.portfolio || "",
            expected_salary: candidateDataFromDB.expected_salary || "",
          }));
        }
        // Handle job openings
        if (jobsRes && jobsRes.data && jobsRes.data.jobs) {
          // Filter: hanya tampilkan yang status open dan deadline belum lewat
          const now = new Date();
          const filtered = jobsRes.data.jobs.filter((job) => {
            if (job.status !== "open") return false;
            if (!job.deadline) return true;
            return new Date(job.deadline) >= now;
          });
          setJobOpenings(filtered);

          // Jika datang dari halaman lamar (jobFromPage), set selectedJob dan applicationData.job_opening_id
          if (jobFromPage && jobFromPage.id) {
            // Cari job yang sesuai di filtered
            const foundJob = filtered.find((j) => j.id === jobFromPage.id);
            if (foundJob) {
              setSelectedJob(foundJob);
              setApplicationData((prev) => ({
                ...prev,
                job_opening_id: foundJob.id,
              }));
            }
          }
        }

        // Tentukan alur berdasarkan dari mana user datang
        let steps;
        let startStep;
        if (comeFromJobListing) {
          steps = [
            "Lowongan Terpilih",
            "Isi Data Diri",
            "Upload Dokumen",
            "Review",
            "Submit",
          ];
          startStep = 0;
        } else {
          steps = [
            "Isi Data Diri",
            "Pilih Lowongan",
            "Upload Dokumen",
            "Review",
            "Submit",
          ];
          startStep = 0;
        }
        setAllSteps(steps);
        setCurrentStep(startStep);

        // Load required documents jika job sudah dipilih dari awal
        if (jobFromPage?.id) {
          await loadRequiredDocuments(jobFromPage.id);
        }
      } catch (error) {
        console.error("Failed to initialize application:", error);
        NotificationManager.error("Gagal memuat data", "Gagal", 3000);
      } finally {
        setLoading(false);
      }
    };
    initializeApplication();
  }, [dispatch, comeFromJobListing, jobFromPage?.id]);

  // ========== REFRESH DOKUMEN SAAT PILIHAN LOWONGAN BERUBAH ==========
  useEffect(() => {
    if (selectedJob && selectedJob.id) {
      loadRequiredDocuments(selectedJob.id);
    }
  }, [selectedJob?.id]);

  // ========== FORM HANDLERS ==========
  const handleCandidateChange = (e) => {
    setCandidateData({
      ...candidateData,
      [e.target.name]: e.target.value,
    });
  };

  const handleApplicationChange = (e) => {
    setApplicationData({
      ...applicationData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    if (fileList.length > 0) {
      setFiles({
        ...files,
        [name]: fileList[0],
      });
      setFileNames({
        ...fileNames,
        [name]: fileList[0].name,
      });
    }
  };

  const handleUrlFieldChange = (e) => {
    const { name, value } = e.target;
    setFiles({
      ...files,
      [name]: value,
    });
    setFileNames({
      ...fileNames,
      [name]: value,
    });
  };

  // Fetch required documents ketika job dipilih
  const loadRequiredDocuments = async (jobId) => {
    try {
      let url = `/api/job-openings/${jobId}/documents`;
      // Jika selectedJob punya base_position, kirim sebagai query
      if (selectedJob && selectedJob.base_position) {
        url += `?base_position=${encodeURIComponent(selectedJob.base_position)}`;
      }
      const res = await axios.get(url);
      if (res.data) {
        setRequiredDocuments(res.data.requiredDocuments || []);
        setOptionalDocuments(res.data.optionalDocuments || []);
      }
    } catch (error) {
      console.error("Failed to load required documents:", error);
      // Set default if fetch fails
      setRequiredDocuments([
        { fieldName: "cv_file", label: "CV / Resume", required: true },
        { fieldName: "ijazah_file", label: "Ijazah", required: true },
        { fieldName: "ktp_file", label: "KTP", required: true },
        { fieldName: "photo_file", label: "Foto Diri", required: true },
      ]);
      setOptionalDocuments([]);
    }
  };

  const handleNext = () => {
    if (currentStep < allSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ========== VALIDATION ==========
  const validateCurrentStep = () => {
    const stepName = allSteps[currentStep];

    if (stepName === "Lowongan Terpilih") {
      if (!applicationData.job_opening_id) {
        NotificationManager.error(
          "Lowongan belum dipilih",
          "Validasi Gagal",
          3000,
        );
        return false;
      }
    } else if (stepName === "Isi Data Diri") {
      if (
        !candidateData.name ||
        !candidateData.email ||
        !candidateData.phone ||
        !candidateData.birth_place ||
        !candidateData.date_of_birth ||
        !candidateData.nik ||
        !candidateData.address
      ) {
        NotificationManager.error(
          "Mohon isi semua field wajib",
          "Validasi Gagal",
          3000,
        );
        return false;
      }
    } else if (stepName === "Pilih Lowongan") {
      if (!applicationData.job_opening_id) {
        NotificationManager.error(
          "Mohon pilih lowongan pekerjaan",
          "Validasi Gagal",
          3000,
        );
        return false;
      }
    }

    return true;
  };

  // ========== SAVE CANDIDATE DATA ==========
  const saveCandidateData = async () => {
    try {
      console.log("Saving candidate data:", candidateData);
      const response = await axios.put(
        "/api/candidates/profile",
        candidateData,
      );
      console.log("Data saved successfully:", response.data);
      NotificationManager.success(
        "Data diri berhasil disimpan",
        "Sukses",
        2000,
      );
    } catch (error) {
      console.error("Failed to save candidate data:", error);
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Gagal menyimpan data diri";
      console.error("Error details:", {
        status: error.response?.status,
        message: error.response?.data?.message,
        data: error.response?.data,
      });
      NotificationManager.error(errorMsg, "Gagal", 3000);
      throw error;
    }
  };

  // ========== SUBMIT APPLICATION ==========
  const handleSubmitApplication = async () => {
    if (isApplicationBlocked) {
      NotificationManager.error(
        blockReasons.join(" \n"),
        "Tidak Bisa Mengajukan",
        5000,
      );
      return;
    }
    if (!applicationData.job_opening_id) {
      NotificationManager.error("Lowongan belum dipilih", "Gagal", 3000);
      return;
    }

    // Validasi dokumen wajib: harus ada File object (untuk file) atau string (untuk URL)
    const missingRequiredDocs = [];
    if (requiredDocuments && requiredDocuments.length > 0) {
      requiredDocuments.forEach((doc) => {
        const val = files[doc.fieldName];
        const isUrlField =
          doc.isUrl ||
          doc.fieldName.includes("_link") ||
          doc.fieldName.includes("github") ||
          doc.fieldName.includes("youtube") ||
          doc.fieldName.includes("design") ||
          doc.fieldName.includes("marketing") ||
          doc.fieldName.includes("campaign");
        if (isUrlField) {
          if (!val || typeof val !== "string" || val.trim() === "") {
            missingRequiredDocs.push(doc.label);
          }
        } else {
          // Untuk file, harus benar-benar File object
          if (!val || typeof val !== "object" || !(val instanceof File)) {
            missingRequiredDocs.push(doc.label);
          }
        }
      });
    }

    if (missingRequiredDocs.length > 0) {
      NotificationManager.error(
        `Dokumen berikut masih diperlukan: ${missingRequiredDocs.join(", ")}`,
        "Dokumen Tidak Lengkap",
        4000,
      );
      return;
    }

    try {
      setSubmitting(true);

      // Prepare FormData for file uploads
      const formData = new FormData();
      formData.append("job_opening_id", applicationData.job_opening_id);
      formData.append("cover_letter", applicationData.cover_letter || "");

      // Add files - semua dokumen yang ada di requiredDocuments dan optionalDocuments
      [...requiredDocuments, ...optionalDocuments].forEach((doc) => {
        const val = files[doc.fieldName];
        const isUrlField =
          doc.isUrl ||
          doc.fieldName.includes("_link") ||
          doc.fieldName.includes("github") ||
          doc.fieldName.includes("youtube") ||
          doc.fieldName.includes("design") ||
          doc.fieldName.includes("marketing") ||
          doc.fieldName.includes("campaign");
        if (
          !isUrlField &&
          val &&
          typeof val === "object" &&
          val instanceof File
        ) {
          formData.append(doc.fieldName, val);
        }
        // Kirim URL/link ke backend jika ada
        if (isUrlField && val && typeof val === "string") {
          formData.append(doc.fieldName, val);
        }
      });

      await axios.post("/api/candidates/apply", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      NotificationManager.success(
        "Lamaran Anda berhasil diajukan!",
        "Sukses",
        3000,
      );

      // Clear localStorage setelah submit berhasil
      localStorage.removeItem("candidateApplyData");
      localStorage.removeItem("applicationApplyData");
      localStorage.removeItem("fileNamesApplyData");

      setTimeout(() => {
        navigate("/candidate/requests");
      }, 2000);
    } catch (error) {
      console.error("Failed to submit application:", error);
      // Log detail error dari backend
      if (error.response?.data) {
        console.error("Backend error detail:", error.response.data);
      }
      const errorMsg =
        error.response?.data?.message || "Gagal mengajukan lamaran";

      // Display missing documents error jika ada
      if (error.response?.data?.missingDocuments) {
        const missingDocs = error.response.data.missingDocuments
          .map((d) => d.label)
          .join(", ");
        NotificationManager.error(
          `Dokumen yang diperlukan: ${missingDocs}`,
          "Dokumen Tidak Lengkap",
          4000,
        );
      } else {
        NotificationManager.error(errorMsg, "Gagal", 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ========== RENDER STEP CONTENT ==========
  const renderStepContent = () => {
    const stepName = allSteps[currentStep];

    if (stepName === "Lowongan Terpilih") {
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Lowongan yang Anda Lamar</h2>
          <p className="text-gray-600 mb-6">
            Pastikan posisi ini sesuai dengan yang Anda inginkan
          </p>

          {selectedJob && (
            <div className="card bg-base-200">
              <div className="card-body">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="card-title text-lg mb-2">
                    {selectedJob.title || selectedJob.position_name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {selectedJob.created_at
                      ? new Date(selectedJob.created_at).toLocaleDateString(
                          "id-ID",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )
                      : "-"}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="font-semibold">Posisi:</span>{" "}
                    {selectedJob.position_name}
                  </div>
                  <div>
                    <span className="font-semibold">Departemen:</span>{" "}
                    {selectedJob.department_name}
                  </div>
                  <div>
                    <span className="font-semibold">Tipe Pekerjaan:</span>{" "}
                    {selectedJob.employment_type}
                  </div>
                  <div>
                    <span className="font-semibold">Kuota:</span>{" "}
                    {selectedJob.quota || 1} orang
                  </div>
                  <div>
                    <span className="font-semibold">Gaji:</span>{" "}
                    {selectedJob.salary_range_min &&
                    selectedJob.salary_range_max
                      ? `Rp ${(selectedJob.salary_range_min / 1000000).toFixed(1)}M - Rp ${(selectedJob.salary_range_max / 1000000).toFixed(1)}M`
                      : "Gaji dirahasiakan"}
                  </div>
                  <div>
                    <span className="font-semibold">Lokasi:</span>{" "}
                    {selectedJob.location}
                  </div>
                  <div>
                    <span className="font-semibold">Deadline:</span>{" "}
                    {selectedJob.deadline
                      ? new Date(selectedJob.deadline).toLocaleDateString(
                          "id-ID",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )
                      : "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Status:</span>{" "}
                    {selectedJob.status}
                  </div>
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Deskripsi Pekerjaan:</span>
                  <div className="whitespace-pre-line">
                    {selectedJob.description || "-"}
                  </div>
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Persyaratan:</span>
                  <div className="whitespace-pre-line">
                    {selectedJob.requirements || "-"}
                  </div>
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Tanggung Jawab:</span>
                  <div className="whitespace-pre-line">
                    {selectedJob.responsibilities || "-"}
                  </div>
                </div>
                <div className="alert alert-info mt-4">
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
                  <span>
                    Lowongan ini sudah dipilih. Lanjutkan dengan melengkapi data
                    diri Anda.
                  </span>
                </div>
              </div>
            </div>
          )}

          {!selectedJob && (
            <div className="alert alert-error">
              <span>
                Tidak ada lowongan yang dipilih. Silahkan kembali dan pilih
                lowongan terlebih dahulu.
              </span>
            </div>
          )}
        </div>
      );
    }

    if (stepName === "Isi Data Diri") {
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Lengkapi Data Diri Anda</h2>
          <p className="text-gray-600 mb-6">
            Informasi ini akan digunakan untuk lamaran pekerjaan Anda
          </p>

          <div className="space-y-6">
            {/* Row 1: Nama & Email */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Nama Lengkap *
                  </span>
                </label>
                <input
                  type="text"
                  name="name"
                  className="input input-bordered"
                  placeholder="Masukkan nama lengkap"
                  value={candidateData.name}
                  onChange={handleCandidateChange}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Email *</span>
                </label>
                <input
                  type="email"
                  name="email"
                  className="input input-bordered"
                  placeholder="Masukkan email"
                  value={candidateData.email}
                  onChange={handleCandidateChange}
                  required
                />
              </div>
            </div>

            {/* Row 2: No HP & Gender */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Nomor HP *</span>
                </label>
                <input
                  type="text"
                  name="phone"
                  className="input input-bordered"
                  placeholder="Masukkan nomor HP"
                  value={candidateData.phone}
                  onChange={handleCandidateChange}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Jenis Kelamin
                  </span>
                </label>
                <select
                  name="gender"
                  className="select select-bordered"
                  value={candidateData.gender}
                  onChange={handleCandidateChange}
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </div>
            </div>

            {/* Row 3: Tempat & Tanggal Lahir */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Tempat Lahir *
                  </span>
                </label>
                <input
                  type="text"
                  name="birth_place"
                  className="input input-bordered"
                  placeholder="Masukkan tempat lahir"
                  value={candidateData.birth_place}
                  onChange={handleCandidateChange}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Tanggal Lahir *
                  </span>
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  className="input input-bordered"
                  value={candidateData.date_of_birth}
                  onChange={handleCandidateChange}
                  required
                />
              </div>
            </div>

            {/* Row 4: Status Pernikahan & Kebangsaan */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Status Pernikahan
                  </span>
                </label>
                <select
                  name="marital_status"
                  className="select select-bordered"
                  value={candidateData.marital_status}
                  onChange={handleCandidateChange}
                >
                  <option value="">Pilih Status Pernikahan</option>
                  <option value="single">Belum Menikah</option>
                  <option value="married">Menikah</option>
                  <option value="divorced">Cerai</option>
                  <option value="widowed">Janda/Duda</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Kebangsaan</span>
                </label>
                <input
                  type="text"
                  name="nationality"
                  className="input input-bordered"
                  placeholder="Masukkan kebangsaan"
                  value={candidateData.nationality}
                  onChange={handleCandidateChange}
                />
              </div>
            </div>

            {/* Row 5: Alamat */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Alamat Lengkap *
                </span>
              </label>
              <textarea
                name="address"
                className="textarea textarea-bordered"
                placeholder="Masukkan alamat lengkap"
                value={candidateData.address}
                onChange={handleCandidateChange}
                rows="3"
                required
              />
            </div>

            {/* Row 6: NIK & NPWP */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">NIK *</span>
                </label>
                <input
                  type="text"
                  name="nik"
                  className="input input-bordered"
                  placeholder="Masukkan NIK (16 digit)"
                  value={candidateData.nik}
                  onChange={handleCandidateChange}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    NPWP (Opsional)
                  </span>
                </label>
                <input
                  type="text"
                  name="npwp"
                  className="input input-bordered"
                  placeholder="Masukkan NPWP"
                  value={candidateData.npwp}
                  onChange={handleCandidateChange}
                />
              </div>
            </div>

            {/* Row 7: Pendidikan */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Tingkat Pendidikan
                  </span>
                </label>
                <select
                  name="education_level"
                  className="select select-bordered"
                  value={candidateData.education_level}
                  onChange={handleCandidateChange}
                >
                  <option value="">Pilih Tingkat Pendidikan</option>
                  <option value="SMA">SMA/SMK</option>
                  <option value="D3">D3 (Diploma)</option>
                  <option value="S1">S1 (Sarjana)</option>
                  <option value="S2">S2 (Master)</option>
                  <option value="S3">S3 (Doktor)</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Sekolah / Universitas
                  </span>
                </label>
                <input
                  type="text"
                  name="university"
                  className="input input-bordered"
                  placeholder="Masukkan nama sekolah atau universitas"
                  value={candidateData.university}
                  onChange={handleCandidateChange}
                />
              </div>
            </div>

            {/* Row 8: Jurusan & Tahun Lulus */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Jurusan/Program Studi
                  </span>
                </label>
                <input
                  type="text"
                  name="major"
                  className="input input-bordered"
                  placeholder="Masukkan jurusan"
                  value={candidateData.major}
                  onChange={handleCandidateChange}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Tahun Lulus</span>
                </label>
                <input
                  type="number"
                  name="graduation_year"
                  className="input input-bordered"
                  placeholder="YYYY"
                  value={candidateData.graduation_year}
                  onChange={handleCandidateChange}
                  min="1990"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>

            {/* Row 9: LinkedIn & Portfolio */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    LinkedIn Profile{" "}
                    <span className="text-gray-500 text-xs">(Opsional)</span>
                  </span>
                </label>
                <input
                  type="url"
                  name="linkedin"
                  className="input input-bordered"
                  placeholder="https://linkedin.com/in/..."
                  value={candidateData.linkedin}
                  onChange={handleCandidateChange}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Portfolio Website{" "}
                    <span className="text-gray-500 text-xs">(Opsional)</span>
                  </span>
                </label>
                <input
                  type="url"
                  name="portfolio"
                  className="input input-bordered"
                  placeholder="https://portfolio.com"
                  value={candidateData.portfolio}
                  onChange={handleCandidateChange}
                />
              </div>
            </div>

            {/* Row 10: Expected Salary */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Ekspektasi Gaji (Rp)
                </span>
              </label>
              <input
                type="number"
                name="expected_salary"
                className="input input-bordered"
                placeholder="Masukkan ekspektasi gaji"
                value={candidateData.expected_salary}
                onChange={handleCandidateChange}
              />
            </div>
          </div>
        </div>
      );
    }

    if (stepName === "Pilih Lowongan") {
      // Terapkan filter pada jobOpenings berdasarkan jobFilter dan jobTypeFilter
      const filteredJobs = jobOpenings.filter((job) => {
        const search = jobFilter.toLowerCase();
        const matchesSearch =
          (job.title?.toLowerCase() || "").includes(search) ||
          (job.position_name?.toLowerCase() || "").includes(search) ||
          (job.location?.toLowerCase() || "").includes(search);
        // Perbaiki: gunakan employment_type, bukan type
        const matchesType =
          jobTypeFilter === "" ||
          job.employment_type?.toLowerCase() === jobTypeFilter.toLowerCase();
        return matchesSearch && matchesType;
      });

      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Pilih Lowongan Pekerjaan</h2>
          <p className="text-gray-600 mb-6">
            Cari dan pilih lowongan yang Anda minati
          </p>

          {/* Filter input */}
          <div className="bg-base-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Cari Lowongan
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="input input-bordered w-full pl-10"
                    placeholder="Judul, posisi, atau lokasi..."
                    value={jobFilter}
                    onChange={(e) => setJobFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Filter Tipe */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Tipe Pekerjaan
                  </span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={jobTypeFilter}
                  onChange={(e) => setJobTypeFilter(e.target.value)}
                >
                  <option value="">Semua Tipe</option>
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredJobs.length === 0 ? (
              <div className="alert alert-warning">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4v2m0 -6a4 4 0 00-4 4v2a4 4 0 008 0v-2a4 4 0 00-4-4z"
                  />
                </svg>
                <span>Tidak ada lowongan yang sesuai filter</span>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const alreadyApplied = appliedJobIds.includes(job.id);
                return (
                  <div
                    key={job.id}
                    className="card bg-base-200 hover:bg-base-300 cursor-pointer transition"
                  >
                    <div className="card-body">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h3 className="card-title text-lg mb-1">
                            {job.title || job.position_name}
                          </h3>
                          <div className="text-xs text-gray-500">
                            {job.created_at
                              ? new Date(job.created_at).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "-"}
                          </div>
                        </div>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() =>
                            setDetailJobId(
                              detailJobId === job.id ? null : job.id,
                            )
                          }
                        >
                          {detailJobId === job.id
                            ? "Tutup"
                            : "Lihat Selengkapnya"}
                        </button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 text-sm mb-2">
                        <div>
                          <span className="font-semibold">Posisi:</span>{" "}
                          {job.position_name}
                        </div>
                        <div>
                          <span className="font-semibold">Departemen:</span>{" "}
                          {job.department_name}
                        </div>
                        <div>
                          <span className="font-semibold">Tipe:</span>{" "}
                          {job.employment_type}
                        </div>
                        <div>
                          <span className="font-semibold">Kuota:</span>{" "}
                          {job.quota || 1} orang
                        </div>
                        <div>
                          <span className="font-semibold">Gaji:</span>{" "}
                          {job.salary_range_min && job.salary_range_max
                            ? `Rp ${(job.salary_range_min / 1000000).toFixed(1)}M - Rp ${(job.salary_range_max / 1000000).toFixed(1)}M`
                            : "Gaji dirahasiakan"}
                        </div>
                        <div>
                          <span className="font-semibold">Lokasi:</span>{" "}
                          {job.location}
                        </div>
                        <div>
                          <span className="font-semibold">Deadline:</span>{" "}
                          {job.deadline
                            ? new Date(job.deadline).toLocaleDateString(
                                "id-ID",
                                {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )
                            : "-"}
                        </div>
                        <div>
                          <span className="font-semibold">Status:</span>{" "}
                          {job.status}
                        </div>
                      </div>
                      <div className="card-actions justify-end">
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={alreadyApplied || isApplicationBlocked}
                          onClick={() => {
                            if (isApplicationBlocked) {
                              NotificationManager.info(
                                blockReasons.join(" \n"),
                                "Tidak Bisa Melamar",
                                6000,
                              );
                              return;
                            }
                            if (alreadyApplied) {
                              NotificationManager.info(
                                "Anda sudah pernah melamar posisi ini. Tidak bisa melamar dua kali.",
                                "Sudah Melamar",
                                4000,
                              );
                              return;
                            }
                            setSelectedJob(job);
                            setApplicationData({
                              ...applicationData,
                              job_opening_id: job.id,
                            });
                            loadRequiredDocuments(job.id);
                            // Otomatis lanjut ke step berikutnya setelah memilih lowongan
                            const idx = allSteps.indexOf("Pilih Lowongan");
                            if (idx !== -1 && idx < allSteps.length - 1) {
                              setCurrentStep(idx + 1);
                            }
                          }}
                        >
                          {alreadyApplied ? "Sudah Dilamar" : "Pilih"}
                        </button>
                      </div>
                      {/* Detail lengkap tampil di bawah card jika tombol lihat selengkapnya diklik */}
                      {detailJobId === job.id && (
                        <div className="mt-4 border-t pt-4">
                          <div className="mb-2">
                            <span className="font-semibold">
                              Deskripsi Pekerjaan:
                            </span>
                            <div className="whitespace-pre-line">
                              {job.description || "-"}
                            </div>
                          </div>
                          <div className="mb-2">
                            <span className="font-semibold">Persyaratan:</span>
                            <div className="whitespace-pre-line">
                              {job.requirements || "-"}
                            </div>
                          </div>
                          <div className="mb-2">
                            <span className="font-semibold">
                              Tanggung Jawab:
                            </span>
                            <div className="whitespace-pre-line">
                              {job.responsibilities || "-"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    if (stepName === "Upload Dokumen") {
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Upload Dokumen</h2>
          <p className="text-gray-600 mb-6">
            Unggah dokumen pendukung lamaran Anda sesuai dengan posisi yang
            dilamar
          </p>

          {selectedJob && (
            <div className="alert alert-info mb-6">
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
              <span>
                Posisi:{" "}
                <strong>
                  {selectedJob.position_name || selectedJob.title}
                </strong>
              </span>
            </div>
          )}

          <div className="space-y-6">
            {/* Required Documents */}
            {requiredDocuments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">📋 Dokumen Wajib</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {requiredDocuments.map((doc) => {
                    const isUrlField =
                      doc.isUrl ||
                      doc.fieldName.includes("_link") ||
                      doc.fieldName.includes("github") ||
                      doc.fieldName.includes("youtube") ||
                      doc.fieldName.includes("design") ||
                      doc.fieldName.includes("marketing") ||
                      doc.fieldName.includes("campaign");
                    const fileObj = files[doc.fieldName];
                    const fileName = fileNames[doc.fieldName];
                    const isImage =
                      fileObj &&
                      fileObj.type &&
                      fileObj.type.startsWith("image/");
                    // File type allowed by backend
                    const allowedTypes = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip";
                    return (
                      <div key={doc.fieldName} className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold">
                            {doc.label} {doc.required && "*"}
                          </span>
                        </label>
                        {isUrlField ? (
                          <>
                            <input
                              type="url"
                              name={doc.fieldName}
                              className="input input-bordered"
                              placeholder={`Masukkan URL ${doc.label.toLowerCase()}`}
                              value={files[doc.fieldName] || ""}
                              onChange={handleUrlFieldChange}
                            />
                            {fileName && (
                              <p className="text-sm text-success mt-2">
                                ✓ {fileName}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {fileObj && (
                              <div className="mb-2 flex items-center gap-3">
                                {isImage ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline"
                                      onClick={() =>
                                        window.open(
                                          URL.createObjectURL(fileObj),
                                          "_blank",
                                        )
                                      }
                                    >
                                      Lihat Gambar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline"
                                    onClick={() =>
                                      window.open(
                                        URL.createObjectURL(fileObj),
                                        "_blank",
                                      )
                                    }
                                  >
                                    Download / Lihat Dokumen
                                  </button>
                                )}
                                <span className="text-xs text-success">
                                  {fileName}
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              name={doc.fieldName}
                              accept={allowedTypes}
                              className="file-input file-input-bordered"
                              onChange={handleFileChange}
                              required={doc.required}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Jenis file yang diperbolehkan: pdf, doc, docx,
                              jpg, jpeg, png, zip
                            </p>
                          </>
                        )}
                        <label className="label">
                          <span className="label-text-alt text-xs">
                            {doc.description}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Documents */}
            {optionalDocuments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  ✨ Dokumen Opsional (Dapat Meningkatkan Peluang)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {optionalDocuments.map((doc) => {
                    const isUrlField =
                      doc.isUrl ||
                      doc.fieldName.includes("_link") ||
                      doc.fieldName.includes("github") ||
                      doc.fieldName.includes("youtube") ||
                      doc.fieldName.includes("design") ||
                      doc.fieldName.includes("marketing") ||
                      doc.fieldName.includes("campaign");
                    const fileObj = files[doc.fieldName];
                    const fileName = fileNames[doc.fieldName];
                    const isImage =
                      fileObj &&
                      fileObj.type &&
                      fileObj.type.startsWith("image/");
                    return (
                      <div key={doc.fieldName} className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold">
                            {doc.label}
                          </span>
                        </label>
                        {isUrlField ? (
                          <>
                            <input
                              type="url"
                              name={doc.fieldName}
                              className="input input-bordered"
                              placeholder={`Masukkan URL ${doc.label.toLowerCase()}`}
                              value={files[doc.fieldName] || ""}
                              onChange={handleUrlFieldChange}
                            />
                            {fileName && (
                              <p className="text-sm text-success mt-2">
                                ✓ {fileName}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {fileObj && (
                              <div className="mb-2 flex items-center gap-3">
                                {isImage ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline"
                                      onClick={() =>
                                        window.open(
                                          URL.createObjectURL(fileObj),
                                          "_blank",
                                        )
                                      }
                                    >
                                      Lihat Gambar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline"
                                    onClick={() =>
                                      window.open(
                                        URL.createObjectURL(fileObj),
                                        "_blank",
                                      )
                                    }
                                  >
                                    Download / Lihat Dokumen
                                  </button>
                                )}
                                <span className="text-xs text-success">
                                  {fileName}
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              name={doc.fieldName}
                              accept={doc.accept}
                              className="file-input file-input-bordered"
                              onChange={handleFileChange}
                            />
                          </>
                        )}
                        <label className="label">
                          <span className="label-text-alt text-xs">
                            {doc.description}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cover Letter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Surat Lamaran / Cover Letter (Opsional)
                </span>
              </label>
              <textarea
                name="cover_letter"
                className="textarea textarea-bordered"
                placeholder="Ceritakan mengapa Anda tertarik dengan posisi ini..."
                value={applicationData.cover_letter}
                onChange={handleApplicationChange}
                rows="6"
              />
              <label className="label">
                <span className="label-text-alt">
                  Jika kosong akan menggunakan template default
                </span>
              </label>
            </div>
          </div>
        </div>
      );
    }

    if (stepName === "Review") {
      // Helper untuk label field data diri
      const biodataFields = [
        { key: "name", label: "Nama Lengkap" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Nomor HP" },
        { key: "gender", label: "Jenis Kelamin" },
        { key: "birth_place", label: "Tempat Lahir" },
        { key: "date_of_birth", label: "Tanggal Lahir" },
        { key: "marital_status", label: "Status Pernikahan" },
        { key: "nationality", label: "Kebangsaan" },
        { key: "address", label: "Alamat" },
        { key: "nik", label: "NIK" },
        { key: "npwp", label: "NPWP" },
        { key: "education_level", label: "Tingkat Pendidikan" },
        { key: "university", label: "Sekolah/Universitas" },
        { key: "major", label: "Jurusan" },
        { key: "graduation_year", label: "Tahun Lulus" },
        { key: "linkedin", label: "LinkedIn" },
        { key: "portfolio", label: "Portfolio Website" },
        { key: "expected_salary", label: "Ekspektasi Gaji" },
      ];

      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Review Lamaran Anda</h2>
          <p className="text-gray-600 mb-6">
            Pastikan semua informasi sudah benar sebelum mengirim
          </p>

          <div className="space-y-4">
            {/* Data Diri Lengkap */}
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg">Data Diri Lengkap</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {biodataFields.map((f) => (
                    <div key={f.key}>
                      <p className="text-xs text-gray-600 font-semibold">
                        {f.label}
                      </p>
                      <p className="font-semibold break-words">
                        {candidateData[f.key] || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lowongan */}
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg">Lowongan yang Dipilih</h3>
                {selectedJob ? (
                  <div className="space-y-2">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Posisi
                        </p>
                        <p className="font-semibold text-lg">
                          {selectedJob.title}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Lokasi
                        </p>
                        <p className="font-semibold">{selectedJob.location}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Tipe Pekerjaan
                        </p>
                        <p className="font-semibold capitalize">
                          {selectedJob.employment_type}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Kuota
                        </p>
                        <p className="font-semibold">{selectedJob.quota}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Gaji
                        </p>
                        <p className="font-semibold">
                          {selectedJob.salary_range_min &&
                          selectedJob.salary_range_max
                            ? `Rp ${(selectedJob.salary_range_min / 1000000).toFixed(1)}M - Rp ${(selectedJob.salary_range_max / 1000000).toFixed(1)}M`
                            : "Gaji dirahasiakan"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">
                          Deadline
                        </p>
                        <p className="font-semibold text-warning">
                          {selectedJob.deadline
                            ? new Date(selectedJob.deadline).toLocaleDateString(
                                "id-ID",
                                {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mt-4">
                        Deskripsi
                      </p>
                      <p className="text-sm whitespace-pre-line">
                        {selectedJob.description || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mt-4">
                        Persyaratan
                      </p>
                      <p className="text-sm whitespace-pre-line">
                        {selectedJob.requirements || "-"}
                      </p>
                    </div>
                    {selectedJob.responsibilities && (
                      <div>
                        <p className="text-xs text-gray-600 font-semibold mt-4">
                          Tanggung Jawab
                        </p>
                        <p className="text-sm whitespace-pre-line">
                          {selectedJob.responsibilities}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-error">
                    Tidak ada lowongan yang dipilih.
                  </div>
                )}
              </div>
            </div>

            {/* Dokumen Wajib */}
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">📄 Dokumen Wajib</h3>
                <div className="divide-y divide-gray-200 border rounded-lg overflow-hidden">
                  {requiredDocuments.map((doc, idx) => {
                    const fileObj = files[doc.fieldName];
                    const fileName = fileNames[doc.fieldName];
                    if (!fileName) return null;
                    const isUrlField =
                      doc.isUrl ||
                      doc.fieldName.includes("_link") ||
                      doc.fieldName.includes("github") ||
                      doc.fieldName.includes("youtube") ||
                      doc.fieldName.includes("design") ||
                      doc.fieldName.includes("marketing") ||
                      doc.fieldName.includes("campaign");
                    const isImage =
                      fileObj &&
                      fileObj.type &&
                      fileObj.type.startsWith("image/");
                    return (
                      <div
                        key={doc.fieldName}
                        className={`flex flex-col md:flex-row md:items-center gap-2 px-4 py-3 ${idx % 2 === 0 ? "bg-base-100" : ""}`}
                      >
                        <div className="flex-1">
                          <span className="text-xs text-gray-600 font-semibold block">
                            {doc.label}
                          </span>
                          {isUrlField ? (
                            <a
                              href={fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-blue-600 hover:underline break-all"
                            >
                              {fileName}
                            </a>
                          ) : (
                            <span className="font-semibold break-all">
                              {fileName}
                            </span>
                          )}
                        </div>
                        {!isUrlField && fileObj && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() =>
                              window.open(
                                URL.createObjectURL(fileObj),
                                "_blank",
                              )
                            }
                          >
                            {isImage ? "Lihat Gambar" : "Lihat File"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dokumen Opsional */}
            {optionalDocuments.length > 0 && (
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg mb-4">
                    ✨ Dokumen Opsional
                  </h3>
                  <div className="divide-y divide-gray-200 border rounded-lg overflow-hidden">
                    {optionalDocuments.map((doc, idx) => {
                      const fileObj = files[doc.fieldName];
                      const fileName = fileNames[doc.fieldName];
                      if (!fileName) return null;
                      const isUrlField =
                        doc.isUrl ||
                        doc.fieldName.includes("_link") ||
                        doc.fieldName.includes("github") ||
                        doc.fieldName.includes("youtube") ||
                        doc.fieldName.includes("design") ||
                        doc.fieldName.includes("marketing") ||
                        doc.fieldName.includes("campaign");
                      const isImage =
                        fileObj &&
                        fileObj.type &&
                        fileObj.type.startsWith("image/");
                      return (
                        <div
                          key={doc.fieldName}
                          className={`flex flex-col md:flex-row md:items-center gap-2 px-4 py-3 ${idx % 2 === 0 ? "bg-base-100" : ""}`}
                        >
                          <div className="flex-1">
                            <span className="text-xs text-gray-600 font-semibold block">
                              {doc.label}
                            </span>
                            {isUrlField ? (
                              <a
                                href={fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-blue-600 hover:underline break-all"
                              >
                                {fileName}
                              </a>
                            ) : (
                              <span className="font-semibold break-all">
                                {fileName}
                              </span>
                            )}
                          </div>
                          {!isUrlField && fileObj && (
                            <button
                              type="button"
                              className="btn btn-xs btn-outline"
                              onClick={() =>
                                window.open(
                                  URL.createObjectURL(fileObj),
                                  "_blank",
                                )
                              }
                            >
                              {isImage ? "Lihat Gambar" : "Lihat File"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Cover Letter */}
            {applicationData.cover_letter && (
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg">💌 Surat Lamaran</h3>
                  <div className="bg-white p-4 rounded border border-gray-300 text-sm whitespace-pre-wrap">
                    {applicationData.cover_letter}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (stepName === "Submit") {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Siap Mengirim Lamaran?</h2>
          <p className="text-gray-600 mb-8">
            Klik tombol "Kirim Lamaran" di bawah untuk mengirimkan lamaran Anda
          </p>

          <div className="space-y-4">
            <div className="alert alert-success">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>Semua data sudah diverifikasi dan siap dikirim</span>
            </div>

            <div className="alert">
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
              <span>
                Anda akan menerima notifikasi untuk setiap update status lamaran
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Fallback
    return (
      <div className="alert alert-error">
        <span>Step tidak dikenali. Silahkan refresh halaman.</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <TitleCard title="Ajukan Lamaran Pekerjaan">
      {isApplicationBlocked && (
        <div className="alert alert-warning mb-4">
          <div className="mt-2">
            {blockReasons.map((r, idx) => (
              <p key={idx}>{r}</p>
            ))}
          </div>
        </div>
      )}
      {/* Stepper */}
      {allSteps.length > 0 && (
        <ul className="steps steps-horizontal w-full mb-8 overflow-x-auto">
          {allSteps.map((s, i) => (
            <li
              key={i}
              className={`step ${currentStep >= i ? "step-primary" : ""}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      {/* Content */}
      <div className="my-8">{renderStepContent()}</div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          className="btn btn-outline"
          onClick={handlePrev}
          disabled={currentStep === 0 || submitting}
        >
          ← Sebelumnya
        </button>

        <div className="flex gap-3">
          {currentStep === allSteps.length - 1 ? (
            <button
              className="btn btn-success"
              onClick={handleSubmitApplication}
              disabled={submitting}
            >
              {submitting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : null}
              Kirim Lamaran
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (isApplicationBlocked) {
                  NotificationManager.error(
                    blockReasons.join("\n"),
                    "Tidak Bisa Melamar",
                    5000,
                  );
                  return;
                }
                if (validateCurrentStep()) {
                  // Simpan data diri jika step sekarang adalah "Isi Data Diri"
                  if (allSteps[currentStep] === "Isi Data Diri") {
                    try {
                      setSubmitting(true);
                      await saveCandidateData();
                      handleNext();
                    } catch (error) {
                      NotificationManager.error(
                        "Gagal menyimpan data diri",
                        "Gagal",
                        3000,
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  } else {
                    handleNext();
                  }
                }
              }}
              disabled={submitting}
            >
              Selanjutnya →
            </button>
          )}
        </div>
      </div>
    </TitleCard>
  );
}

export default CandidateApplyPage;
