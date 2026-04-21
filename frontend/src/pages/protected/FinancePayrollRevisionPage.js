import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { financeApi } from "../../features/finance/api";
import { resolveFixedPositionAllowance } from "../../utils/fixedPositionAllowance";

const getCurrentPeriod = () => {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
};

const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const formatLateDuration = (value) => {
  const minutes = Number(value || 0);
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const remainingAfterHours = totalSeconds % 3600;
  const displayMinutes = Math.floor(remainingAfterHours / 60);
  const seconds = remainingAfterHours % 60;

  return `${hours} jam ${displayMinutes} menit ${seconds} detik`;
};

const monthOptions = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const statusBadgeClass = {
  draft: "badge-warning",
  published: "badge-info",
  claimed: "badge-success",
};

const AUTO_TAX_RATE = 0.03;
const LATE_DEDUCTION_HOURLY_PERCENTAGE = 0.02;
const DEFAULT_WORKING_HOURS_PER_DAY = 8;

const defaultPayrollSettings = {
  transport_per_day: 50000,
  meal_per_day: 25000,
  health_percentage: 0.01,
  bpjs_percentage: 0.01,
};

const resolvePhotoUrl = (photoPath) => {
  if (!photoPath) return null;

  if (/^https?:\/\//i.test(photoPath)) {
    return photoPath;
  }

  const baseUrl = (
    process.env.REACT_APP_BASE_URL || "http://localhost:5000"
  ).replace(/\/$/, "");
  return `${baseUrl}/${String(photoPath).replace(/^\/+/, "")}`;
};

const toSafeArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item) => item !== null && item !== undefined)
        : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const getApprovedReviewItemsFromAppeal = (appealDetail) => {
  const appealReasonItems = toSafeArray(appealDetail?.appeal_reason_items)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      reason_key: String(item.appeal_reason_item || "").trim(),
      label: String(item.appeal_reason_label || item.appeal_reason_item || "").trim(),
    }));

  const normalizeLabel = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const findReasonKeyByLabel = (label) => {
    const normalizedTarget = normalizeLabel(label);
    if (!normalizedTarget) return "";

    const exactMatch = appealReasonItems.find(
      (item) => normalizeLabel(item.label) === normalizedTarget,
    );
    if (exactMatch?.reason_key) return exactMatch.reason_key;

    const partialMatch = appealReasonItems.find((item) =>
      normalizeLabel(item.label).includes(normalizedTarget) ||
      normalizedTarget.includes(normalizeLabel(item.label)),
    );
    return partialMatch?.reason_key || "";
  };

  const approvedFromItems = toSafeArray(appealDetail?.review_result_items)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      label: String(
        item.label || item.appeal_reason_label || item.appeal_reason_item || "",
      ).trim(),
      reason_key: String(item.reason_key || item.appeal_reason_item || "").trim(),
      decision: String(item.decision || item.status || "").toLowerCase(),
      adjustment_amount: Number(item.adjustment_amount || 0),
    }))
    .map((item) => ({
      ...item,
      reason_key: item.reason_key || findReasonKeyByLabel(item.label),
    }))
    .filter((item) => ["approve", "approved", "disetujui"].includes(item.decision));

  if (approvedFromItems.length > 0) {
    return approvedFromItems;
  }

  const rawNotes = String(appealDetail?.review_notes || "").trim();
  if (!rawNotes) return [];

  const approvedMatches = Array.from(
    rawNotes.matchAll(
      /\[(.+?)\]\s*disetujui,\s*nominal\s*perbaikan\s*:\s*([0-9.,]+)/gi,
    ),
  );

  if (approvedMatches.length > 0) {
    return approvedMatches.map((match) => {
      const label = String(match?.[1] || "Komponen Revisi").trim();
      const amountRaw = String(match?.[2] || "0");
      return {
        label,
        reason_key: findReasonKeyByLabel(label),
        decision: "approve",
        adjustment_amount:
          Number(amountRaw.replace(/\./g, "").replace(/,/g, ".")) || 0,
      };
    });
  }

  return rawNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && /disetujui/i.test(line))
    .map((line) => {
      const labelMatch = line.match(/^\[(.*?)\]/);
      const amountMatch = line.match(
        /(?:nominal\s*perbaikan\s*:?\s*)(\d+[\d.,]*)/i,
      );

      const label = String(labelMatch?.[1] || "Komponen Revisi").trim();
      return {
        label,
        reason_key: findReasonKeyByLabel(label),
        decision: "approve",
        adjustment_amount: amountMatch
          ? Number(String(amountMatch[1]).replace(/\./g, "").replace(/,/g, ".")) ||
            0
          : 0,
      };
    });
};

const resolveCorrectedValueByLabel = (
  label,
  reasonKey,
  payrollPreview,
  fallbackAmount,
) => {
  const normalizedReasonKey = String(reasonKey || "").toLowerCase();

  if (normalizedReasonKey === "bonus") return Number(payrollPreview?.bonus || 0);
  if (normalizedReasonKey === "other_allowance") {
    return Number(payrollPreview?.otherAllowance || 0);
  }
  if (normalizedReasonKey === "other_deduction") {
    return Number(payrollPreview?.otherDeduction || 0);
  }

  return Number(fallbackAmount || 0);
};

const resolveManualFieldByLabel = (label, reasonKey) => {
  const normalizedReasonKey = String(reasonKey || "").toLowerCase();
  if (normalizedReasonKey === "bonus") return "bonus";
  if (normalizedReasonKey === "other_allowance") return "other_allowance";
  if (normalizedReasonKey === "other_deduction") return "other_deduction";

  return null;
};

function FinancePayroll({ isRevisionPage = false }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const period = getCurrentPeriod();
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingPublishAll, setLoadingPublishAll] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [loadingMonthlyRows, setLoadingMonthlyRows] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(period.month);
  const [periodYear, setPeriodYear] = useState(period.year);
  const [recapMonth, setRecapMonth] = useState(period.month);
  const [manualInput, setManualInput] = useState({
    bonus: "",
    other_allowance: "",
    other_deduction: "",
  });

  const [currentEmployeePayrollRows, setCurrentEmployeePayrollRows] = useState(
    [],
  );
  const [latestGenerated, setLatestGenerated] = useState(null);
  const [monthlyPayrollRows, setMonthlyPayrollRows] = useState([]);
  const [employeeReferenceData, setEmployeeReferenceData] = useState([]);
  const [attendanceSummaryData, setAttendanceSummaryData] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [managerAdjustments, setManagerAdjustments] = useState([]);
  const [payrollSettings, setPayrollSettings] = useState(
    defaultPayrollSettings,
  );
  const [isAppealRevisionMode, setIsAppealRevisionMode] = useState(false);
  const [appealRevisionId, setAppealRevisionId] = useState("");
  const [revisionAppealDetail, setRevisionAppealDetail] = useState(null);
  const [hasAppliedRevisionAutofill, setHasAppliedRevisionAutofill] =
    useState(false);

  const selectedEmployeeReferenceForAllowance =
    employeeReferenceData.find(
      (item) => String(item.employee_id) === String(selectedEmployeeId),
    ) || null;
  const fixedOtherAllowance = Number(
    resolveFixedPositionAllowance(selectedEmployeeReferenceForAllowance) || 0,
  );

  const mapPayrollRowToPreview = (row) => {
    if (!row) return null;

    const totalAbsentDays = Number(row.total_absent_days || 0);
    const permissionDays = Number(row.total_izin_days || 0);
    const sickDays = Number(row.total_sakit_days || 0);
    const alphaDays = totalAbsentDays;

    return {
      mode: "actual",
      basicSalary: Number(row.basic_salary || 0),
      transportAllowance: Number(row.transport_allowance || 0),
      mealAllowance: Number(row.meal_allowance || 0),
      healthAllowance: Number(row.health_allowance || 0),
      bonus: Number(row.bonus || 0),
      otherAllowance: Number(row.other_allowance || 0),
      allowanceTotal: Number(row.allowance || 0),
      grossSalary: Number(row.gross_salary || 0),
      reimbursement: Number(row.reimbursement_total || 0),
      totalIncome: Number(row.total_income || 0),
      lateDeduction: Number(row.late_deduction || 0),
      absentDeduction: Number(row.absent_deduction || 0),
      bpjsDeduction: Number(row.bpjs_deduction || 0),
      taxDeduction: Number(row.tax_deduction || 0),
      otherDeduction: Number(row.other_deduction || 0),
      totalDeduction: Number(row.deduction || 0),
      netSalary: Number(row.final_amount || row.net_salary || 0),
      presentDays: Number(row.present_days || 0),
      alphaDays,
      permissionDays,
      sickDays,
      deductibleAbsentDays: totalAbsentDays,
      totalLateMinutes: 0,
    };
  };

  useEffect(() => {
    dispatch(
      setPageTitle({
        title: isRevisionPage ? "Revisi Payroll Finance" : "Payroll Finance",
      }),
    );
  }, [dispatch, isRevisionPage]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const source = searchParams.get("source");
    const employeeIdFromQuery = searchParams.get("employee_id");
    const monthFromQuery = searchParams.get("month");
    const yearFromQuery = searchParams.get("year");
    const appealIdFromQuery = searchParams.get("appeal_id");

    if (source !== "salary-appeal") {
      setIsAppealRevisionMode(false);
      setAppealRevisionId("");
      setRevisionAppealDetail(null);
      setHasAppliedRevisionAutofill(false);

      if (monthFromQuery) {
        setPeriodMonth(monthFromQuery);
        setRecapMonth(monthFromQuery);
      }

      if (yearFromQuery) {
        setPeriodYear(yearFromQuery);
      }

      return;
    }

    setIsAppealRevisionMode(true);
    setAppealRevisionId(appealIdFromQuery || "");
    setRevisionAppealDetail(location.state?.appeal || null);
    setHasAppliedRevisionAutofill(false);

    if (employeeIdFromQuery) {
      setSelectedEmployeeId(employeeIdFromQuery);
    }

    if (monthFromQuery) {
      setPeriodMonth(monthFromQuery);
      setRecapMonth(monthFromQuery);
    }

    if (yearFromQuery) {
      setPeriodYear(yearFromQuery);
    }

    setError("");
    setSuccessMessage(
      `Mode revisi banding gaji aktif. Silakan ubah nominal lalu klik ${isRevisionPage ? "Kirim" : "Buat Slip Gaji"}.`,
    );
  }, [location.search, location.state, isRevisionPage]);

  useEffect(() => {
    const loadRevisionAppealDetail = async () => {
      if (!isAppealRevisionMode || revisionAppealDetail || !appealRevisionId) {
        return;
      }

      try {
        const result = await financeApi.getSalaryAppeals({ status: "approved" });
        const target = (result?.data || []).find(
          (item) => String(item.id) === String(appealRevisionId),
        );

        if (target) {
          setRevisionAppealDetail(target);
          if (target.employee_id) {
            setSelectedEmployeeId(String(target.employee_id));
          }
        }
      } catch (err) {
        // no-op, existing UI already has error handling on primary actions
      }
    };

    loadRevisionAppealDetail();
  }, [isAppealRevisionMode, revisionAppealDetail, appealRevisionId]);

  useEffect(() => {
    const loadRevisionPayrollById = async () => {
      if (!isAppealRevisionMode || !revisionAppealDetail?.payroll_id) {
        return;
      }

      try {
        const payrollById = await financeApi.getPayrollById(
          revisionAppealDetail.payroll_id,
        );

        if (payrollById?.id) {
          setSelectedEmployeeId(String(payrollById.employee_id || ""));
          setPeriodMonth(String(payrollById.period_month || periodMonth));
          setPeriodYear(String(payrollById.period_year || periodYear));
          setCurrentEmployeePayrollRows([payrollById]);
        }
      } catch (err) {
        // no-op
      }
    };

    loadRevisionPayrollById();
  }, [
    isAppealRevisionMode,
    revisionAppealDetail,
    periodMonth,
    periodYear,
  ]);

  useEffect(() => {
    const payrollForAutofill =
      latestGenerated?.payroll_id &&
      String(latestGenerated?.employee?.id) === String(selectedEmployeeId)
        ? null
        : currentEmployeePayrollRows[0] || null;

    // Wait until reference data is loaded so manager adjustment fallback is reliable.
    if (loadingReferenceData) {
      return;
    }

    if (
      !isAppealRevisionMode ||
      hasAppliedRevisionAutofill ||
      !revisionAppealDetail ||
      !payrollForAutofill
    ) {
      return;
    }

    const approvedItemsForAutofill = getApprovedReviewItemsFromAppeal(
      revisionAppealDetail,
    );

    const approvedFieldAmountMap = approvedItemsForAutofill.reduce(
      (accumulator, item) => {
        const fieldName = resolveManualFieldByLabel(item.label, item.reason_key);
        if (!fieldName) {
          return accumulator;
        }

        const amount = Number(item.adjustment_amount || 0);
        accumulator[fieldName] = Number.isFinite(amount)
          ? amount
          : Number(accumulator[fieldName] || 0);
        return accumulator;
      },
      {},
    );

    const currentEmployeeId = String(selectedEmployeeId || "");
    const adjustmentCandidates = managerAdjustments.filter(
      (item) => String(item.employee_id) === currentEmployeeId,
    );
    const priority = {
      submitted: 1,
      approved: 2,
      draft: 3,
      rejected: 4,
    };
    const selectedAdjustment = [...adjustmentCandidates].sort((a, b) => {
      const scoreA = priority[String(a.status || "").toLowerCase()] || 99;
      const scoreB = priority[String(b.status || "").toLowerCase()] || 99;
      if (scoreA !== scoreB) return scoreA - scoreB;

      const dateA = new Date(a.submitted_at || a.updated_at || 0).getTime();
      const dateB = new Date(b.submitted_at || b.updated_at || 0).getTime();
      return dateB - dateA;
    })[0] || null;

    const fallbackBonus = Number(
      selectedAdjustment?.bonus ?? payrollForAutofill.bonus ?? 0,
    );
    const fallbackOtherDeduction = Number(
      selectedAdjustment?.other_deduction ??
        payrollForAutofill.other_deduction ??
        0,
    );
    const fallbackOtherAllowance = Number(
      selectedAdjustment?.other_allowance ??
        payrollForAutofill.other_allowance ??
        fixedOtherAllowance ??
        0,
    );

    setManualInput({
      bonus: String(
        approvedFieldAmountMap.bonus ?? fallbackBonus,
      ),
      other_allowance: String(fallbackOtherAllowance),
      other_deduction: String(
        approvedFieldAmountMap.other_deduction ?? fallbackOtherDeduction,
      ),
    });

    if (Object.keys(approvedFieldAmountMap).length > 0) {
      setSuccessMessage(
        "Nominal komponen yang disetujui reviewer sudah otomatis dimasukkan ke field revisi terkait.",
      );
    } else if (approvedItemsForAutofill.length > 0) {
      setSuccessMessage(
        "Ada komponen banding yang tidak terkait field editable (bonus/tunjangan lainnya/potongan lainnya), jadi tidak diisikan otomatis ke field manual.",
      );
    }

    setHasAppliedRevisionAutofill(true);
  }, [
    isAppealRevisionMode,
    hasAppliedRevisionAutofill,
    revisionAppealDetail,
    latestGenerated,
    selectedEmployeeId,
    currentEmployeePayrollRows,
    managerAdjustments,
    fixedOtherAllowance,
    loadingReferenceData,
  ]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timeoutId = setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        setLoadingReferenceData(true);
        const [
          attendanceSummaryResult,
          reimbursementsResult,
          payrollSettingsResult,
          employeeReferenceResult,
          managerAdjustmentsResult,
        ] = await Promise.allSettled([
          financeApi.getAttendanceSummaryAll({
            month: Number(periodMonth),
            year: Number(periodYear),
          }),
          financeApi.getReimbursements(),
          financeApi.getPayrollSettings(),
          financeApi.getEmployeeReferences(),
          financeApi.getPayrollManagerAdjustments({
            month: Number(periodMonth),
            year: Number(periodYear),
          }),
        ]);

        const attendanceRows =
          attendanceSummaryResult.status === "fulfilled"
            ? attendanceSummaryResult.value
            : [];
        const reimbursementRows =
          reimbursementsResult.status === "fulfilled"
            ? reimbursementsResult.value
            : [];
        const payrollSettingsRow =
          payrollSettingsResult.status === "fulfilled"
            ? payrollSettingsResult.value
            : defaultPayrollSettings;
        const employeeRows =
          employeeReferenceResult.status === "fulfilled"
            ? employeeReferenceResult.value
            : [];
        const managerAdjustmentRows =
          managerAdjustmentsResult.status === "fulfilled"
            ? managerAdjustmentsResult.value?.data || []
            : [];

        setAttendanceSummaryData(attendanceRows);
        setReimbursements(reimbursementRows);
        setEmployeeReferenceData(employeeRows);
        setManagerAdjustments(managerAdjustmentRows);
        setPayrollSettings({
          transport_per_day: Number(
            payrollSettingsRow?.transport_per_day ??
              defaultPayrollSettings.transport_per_day,
          ),
          meal_per_day: Number(
            payrollSettingsRow?.meal_per_day ??
              defaultPayrollSettings.meal_per_day,
          ),
          health_percentage: Number(
            payrollSettingsRow?.health_percentage ??
              defaultPayrollSettings.health_percentage,
          ),
          bpjs_percentage: Number(
            payrollSettingsRow?.bpjs_percentage ??
              defaultPayrollSettings.bpjs_percentage,
          ),
        });

        if (!isAppealRevisionMode && employeeRows.length > 0) {
          setSelectedEmployeeId((prev) =>
            prev || String(employeeRows[0].employee_id),
          );
        }

        const failedMessages = [
          attendanceSummaryResult,
          reimbursementsResult,
          payrollSettingsResult,
          employeeReferenceResult,
          managerAdjustmentsResult,
        ]
          .filter((item) => item.status === "rejected")
          .map((item) => item.reason?.message)
          .filter(Boolean);

        if (failedMessages.length) {
          setError(failedMessages[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingReferenceData(false);
      }
    };

    loadReferenceData();
  }, [periodMonth, periodYear, isAppealRevisionMode]);

  const selectedManagerAdjustment = useMemo(() => {
    const currentEmployeeId = String(selectedEmployeeId || "");
    if (!currentEmployeeId) return null;

    const rows = managerAdjustments.filter(
      (item) => String(item.employee_id) === currentEmployeeId,
    );
    if (!rows.length) return null;

    const priority = {
      submitted: 1,
      approved: 2,
      draft: 3,
      rejected: 4,
    };

    const sortedRows = [...rows].sort((a, b) => {
      const scoreA = priority[String(a.status || "").toLowerCase()] || 99;
      const scoreB = priority[String(b.status || "").toLowerCase()] || 99;
      if (scoreA !== scoreB) return scoreA - scoreB;

      const dateA = new Date(a.submitted_at || a.updated_at || 0).getTime();
      const dateB = new Date(b.submitted_at || b.updated_at || 0).getTime();
      return dateB - dateA;
    });

    return sortedRows[0] || null;
  }, [managerAdjustments, selectedEmployeeId]);

  useEffect(() => {
    const loadCurrentEmployeePayrollRows = async () => {
      if (!selectedEmployeeId) {
        setCurrentEmployeePayrollRows([]);
        return;
      }

      try {
        const rows = await financeApi.getPayrollByEmployee(selectedEmployeeId, {
          month: Number(periodMonth),
          year: Number(periodYear),
        });
        setCurrentEmployeePayrollRows(rows);
      } catch (err) {
        setCurrentEmployeePayrollRows([]);
      }
    };

    loadCurrentEmployeePayrollRows();
  }, [selectedEmployeeId, periodMonth, periodYear, latestGenerated]);

  useEffect(() => {
    const loadMonthlyRows = async () => {
      try {
        setLoadingMonthlyRows(true);
        const rows = await financeApi.getPayrollList({
          month: Number(recapMonth),
          year: Number(periodYear),
        });

        setMonthlyPayrollRows(rows || []);
      } catch (err) {
        setMonthlyPayrollRows([]);
      } finally {
        setLoadingMonthlyRows(false);
      }
    };

    loadMonthlyRows();
  }, [recapMonth, periodYear, latestGenerated]);

  const selectedEmployeeSummary = useMemo(() => {
    return (
      attendanceSummaryData.find(
        (item) => String(item.employee_id) === String(selectedEmployeeId),
      ) || null
    );
  }, [attendanceSummaryData, selectedEmployeeId]);

  const selectedEmployeeReference = useMemo(() => {
    return (
      employeeReferenceData.find(
        (item) => String(item.employee_id) === String(selectedEmployeeId),
      ) || null
    );
  }, [employeeReferenceData, selectedEmployeeId]);

  const selectedEmployeeCurrentPayroll = useMemo(() => {
    if (
      latestGenerated?.payroll_id &&
      String(latestGenerated?.employee?.id) === String(selectedEmployeeId)
    ) {
      return null;
    }

    return currentEmployeePayrollRows[0] || null;
  }, [currentEmployeePayrollRows, latestGenerated, selectedEmployeeId]);

  const selectedBasicSalary = useMemo(() => {
    if (
      latestGenerated?.details?.basic_salary &&
      String(latestGenerated?.employee?.id) === String(selectedEmployeeId)
    ) {
      return Number(latestGenerated.details.basic_salary);
    }

    return Number(
      selectedEmployeeReference?.basic_salary ||
        selectedEmployeeCurrentPayroll?.basic_salary ||
        0,
    );
  }, [
    latestGenerated,
    selectedEmployeeReference,
    selectedEmployeeCurrentPayroll,
    selectedEmployeeId,
  ]);

  const autoTaxDeduction = useMemo(() => {
    return Number((selectedBasicSalary * AUTO_TAX_RATE).toFixed(2));
  }, [selectedBasicSalary]);

  const autoPayrollId = useMemo(() => {
    if (
      latestGenerated?.payroll_id &&
      String(latestGenerated?.employee?.id) === String(selectedEmployeeId)
    ) {
      return String(latestGenerated.payroll_id);
    }

    return selectedEmployeeCurrentPayroll?.id
      ? String(selectedEmployeeCurrentPayroll.id)
      : "";
  }, [latestGenerated, selectedEmployeeCurrentPayroll, selectedEmployeeId]);

  const selectedEmployeeAvatarUrl = useMemo(() => {
    const dbPhoto = resolvePhotoUrl(selectedEmployeeReference?.photo);
    if (dbPhoto) {
      return dbPhoto;
    }

    const name =
      selectedEmployeeReference?.employee_name ||
      selectedEmployeeSummary?.employee_name ||
      "Pegawai";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
  }, [selectedEmployeeReference, selectedEmployeeSummary]);

  const filteredEmployeeReimbursements = useMemo(() => {
    const targetMonth = Number(periodMonth);
    const targetYear = Number(periodYear);
    const employeeId = Number(selectedEmployeeId);

    return reimbursements.filter((item) => {
      const createdDate = item.created_at ? new Date(item.created_at) : null;
      if (!createdDate) return false;

      return (
        Number(item.employee_id) === employeeId &&
        createdDate.getMonth() + 1 === targetMonth &&
        createdDate.getFullYear() === targetYear
      );
    });
  }, [reimbursements, selectedEmployeeId, periodMonth, periodYear]);

  const reimbursementOverview = useMemo(() => {
    return filteredEmployeeReimbursements.reduce(
      (accumulator, item) => {
        const amount = Number(item.amount || 0);
        if (item.status === "approved" || item.status === "included_in_payroll") {
          accumulator.total += amount;
          accumulator.included += amount;
        }

        if (item.status === "pending") {
          accumulator.pending += amount;
        }

        return accumulator;
      },
      { total: 0, included: 0, pending: 0 },
    );
  }, [filteredEmployeeReimbursements]);

  const manualBonus = useMemo(
    () => Number(manualInput.bonus || 0),
    [manualInput.bonus],
  );

  const manualOtherAllowance = useMemo(
    () => Number(manualInput.other_allowance || 0),
    [manualInput.other_allowance],
  );

  const manualOtherDeduction = useMemo(
    () => Number(manualInput.other_deduction || 0),
    [manualInput.other_deduction],
  );

  useEffect(() => {
    if (isAppealRevisionMode) return;

    if (selectedManagerAdjustment) {
      setManualInput({
        bonus: String(Number(selectedManagerAdjustment.bonus || 0)),
        other_allowance: String(
          Number(selectedManagerAdjustment.other_allowance ?? fixedOtherAllowance ?? 0),
        ),
        other_deduction: String(
          Number(selectedManagerAdjustment.other_deduction || 0),
        ),
      });
      return;
    }

    if (selectedEmployeeCurrentPayroll) {
      setManualInput({
        bonus: String(Number(selectedEmployeeCurrentPayroll.bonus || 0)),
        other_allowance: String(fixedOtherAllowance || 0),
        other_deduction: String(
          Number(selectedEmployeeCurrentPayroll.other_deduction || 0),
        ),
      });
      return;
    }

    setManualInput({
      bonus: "0",
      other_allowance: String(fixedOtherAllowance || 0),
      other_deduction: "0",
    });
  }, [
    isAppealRevisionMode,
    selectedManagerAdjustment,
    selectedEmployeeCurrentPayroll,
    selectedEmployeeId,
    periodMonth,
    periodYear,
    fixedOtherAllowance,
  ]);

  const totalApprovedAdjustment = useMemo(() => {
    return getApprovedReviewItemsFromAppeal(revisionAppealDetail).reduce(
      (total, item) => total + Number(item.adjustment_amount || 0),
      0,
    );
  }, [revisionAppealDetail]);

  const payrollPreview = useMemo(() => {
    const resolveInputValue = (inputValue, fallbackValue) => {
      if (inputValue === "" || inputValue === null || inputValue === undefined) {
        return Number(fallbackValue || 0);
      }

      const parsed = Number(inputValue);
      return Number.isFinite(parsed) ? parsed : Number(fallbackValue || 0);
    };

    const latestGeneratedForSelected =
      latestGenerated?.payroll_id &&
      String(latestGenerated?.employee?.id) === String(selectedEmployeeId)
        ? latestGenerated
        : null;

    if (!latestGeneratedForSelected && selectedEmployeeCurrentPayroll) {
      const dbPreview = mapPayrollRowToPreview(selectedEmployeeCurrentPayroll);
      if (dbPreview) {
        const latestLateMinutes = Number(
          selectedEmployeeSummary?.total_late_minutes ??
            dbPreview.totalLateMinutes ??
            0,
        );
        const latestReimbursement = Number(
          reimbursementOverview.included || dbPreview.reimbursement || 0,
        );
        const editedBonus = resolveInputValue(
          manualInput.bonus,
          selectedEmployeeCurrentPayroll.bonus,
        );
        const editedOtherAllowance = resolveInputValue(
          manualInput.other_allowance,
          selectedEmployeeCurrentPayroll.other_allowance,
        );
        const editedOtherDeduction = resolveInputValue(
          manualInput.other_deduction,
          selectedEmployeeCurrentPayroll.other_deduction,
        );

        const allowanceWithoutEditable =
          Number(dbPreview.allowanceTotal || 0) -
          Number(dbPreview.bonus || 0) -
          Number(dbPreview.otherAllowance || 0);
        const allowanceTotal = Number(
          (allowanceWithoutEditable + editedBonus + editedOtherAllowance).toFixed(
            2,
          ),
        );
        const grossSalary = Number(
          (Number(dbPreview.basicSalary || 0) + allowanceTotal).toFixed(2),
        );
        const totalIncome = Number(
          (grossSalary + latestReimbursement).toFixed(2),
        );

        const deductionWithoutEditable =
          Number(dbPreview.totalDeduction || 0) -
          Number(dbPreview.otherDeduction || 0);
        const totalDeduction = Number(
          (deductionWithoutEditable + editedOtherDeduction).toFixed(2),
        );
        const netSalary = Number((totalIncome - totalDeduction).toFixed(2));
        return {
          ...dbPreview,
          totalLateMinutes: latestLateMinutes,
          reimbursement: latestReimbursement,
          bonus: editedBonus,
          otherAllowance: editedOtherAllowance,
          allowanceTotal,
          grossSalary,
          totalIncome,
          otherDeduction: editedOtherDeduction,
          totalDeduction,
          netSalary,
        };
      }
    }

    if (latestGeneratedForSelected?.details) {
      return {
        mode: "actual",
        basicSalary: Number(latestGeneratedForSelected.details.basic_salary || 0),
        transportAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.transport || 0,
        ),
        mealAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.meal || 0,
        ),
        healthAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.health || 0,
        ),
        bonus: Number(latestGeneratedForSelected.details?.allowances?.bonus || 0),
        otherAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.other || 0,
        ),
        allowanceTotal: Number(
          latestGeneratedForSelected.details?.allowances?.total || 0,
        ),
        grossSalary: Number(
          latestGeneratedForSelected.details?.income?.gross_salary || 0,
        ),
        reimbursement: Number(
          latestGeneratedForSelected.details?.reimbursement_total || 0,
        ),
        totalIncome: Number(
          latestGeneratedForSelected.details?.income?.total_income || 0,
        ),
        lateDeduction: Number(
          latestGeneratedForSelected.details?.late_deduction || 0,
        ),
        absentDeduction: Number(
          latestGeneratedForSelected.details?.absent_deduction || 0,
        ),
        bpjsDeduction: Number(
          latestGeneratedForSelected.details?.bpjs_deduction || 0,
        ),
        taxDeduction: Number(
          latestGeneratedForSelected.details?.tax_deduction || 0,
        ),
        otherDeduction: Number(
          latestGeneratedForSelected.details?.other_deduction || 0,
        ),
        totalDeduction: Number(
          latestGeneratedForSelected.details?.total_deduction || 0,
        ),
        netSalary: Number(latestGeneratedForSelected.details?.net_salary || 0),
        presentDays: Number(latestGeneratedForSelected.details?.present_days || 0),
        alphaDays: Number(
          latestGeneratedForSelected.details?.attendance_summary
            ?.total_alpha_days || 0,
        ),
        permissionDays: Number(
          latestGeneratedForSelected.details?.attendance_summary
            ?.total_izin_days || 0,
        ),
        sickDays: Number(
          latestGeneratedForSelected.details?.attendance_summary
            ?.total_sakit_days || 0,
        ),
        deductibleAbsentDays: Number(
          latestGeneratedForSelected.details?.attendance_summary
            ?.total_deductible_absent_days ||
            (Number(
              latestGeneratedForSelected.details?.attendance_summary
                ?.total_alpha_days || 0,
            ) +
              Number(
                latestGeneratedForSelected.details?.attendance_summary
                  ?.total_izin_days || 0,
              ) +
              Number(
                latestGeneratedForSelected.details?.attendance_summary
                  ?.total_sakit_days || 0,
              )),
        ),
        totalLateMinutes: Number(
          latestGeneratedForSelected.details?.attendance_summary
            ?.total_late_minutes || 0,
        ),
      };
    }

    const presentDays = Number(selectedEmployeeSummary?.present_days || 0);
    const alphaDays = Number(selectedEmployeeSummary?.alpha_days || 0);
    const permissionDays = Number(selectedEmployeeSummary?.permission_days || 0);
    const sickDays = Number(selectedEmployeeSummary?.sick_days || 0);
    const deductibleAbsentDays = alphaDays;
    const totalLateMinutes = Number(
      selectedEmployeeSummary?.total_late_minutes || 0,
    );
    const basicSalary = Number(selectedBasicSalary || 0);

    const transportAllowance = Number(
      (presentDays * Number(payrollSettings.transport_per_day || 0)).toFixed(2),
    );
    const mealAllowance = Number(
      (presentDays * Number(payrollSettings.meal_per_day || 0)).toFixed(2),
    );
    const healthAllowance = Number(
      (
        basicSalary * Number(payrollSettings.health_percentage || 0)
      ).toFixed(2),
    );
    const allowanceTotal = Number(
      (
        transportAllowance +
        mealAllowance +
        healthAllowance +
        manualBonus +
        manualOtherAllowance
      ).toFixed(2),
    );
    const grossSalary = Number((basicSalary + allowanceTotal).toFixed(2));
    const reimbursement = Number(reimbursementOverview.included || 0);
    const totalIncome = Number((grossSalary + reimbursement).toFixed(2));

    const dailySalary = basicSalary / 30;
    const hourlyRate = dailySalary / DEFAULT_WORKING_HOURS_PER_DAY;
    const lateDeduction = Math.round(
      (totalLateMinutes / 60) * hourlyRate * LATE_DEDUCTION_HOURLY_PERCENTAGE,
    );
    const absentDeduction = Math.round(deductibleAbsentDays * dailySalary);
    const bpjsDeduction = Number(
      (basicSalary * Number(payrollSettings.bpjs_percentage || 0)).toFixed(2),
    );
    const taxDeduction = Number(autoTaxDeduction || 0);
    const otherDeduction = Number(manualOtherDeduction || 0);
    const totalDeduction = Number(
      (
        lateDeduction +
        absentDeduction +
        bpjsDeduction +
        taxDeduction +
        otherDeduction
      ).toFixed(2),
    );
    const netSalary = Number((totalIncome - totalDeduction).toFixed(2));
    return {
      mode: "estimated",
      basicSalary,
      transportAllowance,
      mealAllowance,
      healthAllowance,
      bonus: manualBonus,
      otherAllowance: manualOtherAllowance,
      allowanceTotal,
      grossSalary,
      reimbursement,
      totalIncome,
      lateDeduction,
      absentDeduction,
      bpjsDeduction,
      taxDeduction,
      otherDeduction,
      totalDeduction,
      netSalary,
      presentDays,
      alphaDays,
      permissionDays,
      sickDays,
      deductibleAbsentDays,
      totalLateMinutes,
    };
  }, [
    latestGenerated,
    selectedEmployeeCurrentPayroll,
    selectedEmployeeId,
    isAppealRevisionMode,
    totalApprovedAdjustment,
    selectedEmployeeSummary,
    selectedBasicSalary,
    payrollSettings,
    manualInput.bonus,
    manualInput.other_allowance,
    manualInput.other_deduction,
    manualBonus,
    manualOtherAllowance,
    manualOtherDeduction,
    reimbursementOverview,
    autoTaxDeduction,
  ]);

  const approvedRevisionItems = useMemo(() => {
    return getApprovedReviewItemsFromAppeal(revisionAppealDetail).map((item) => ({
      ...item,
      payroll_value: Number(item.adjustment_amount || 0),
    }));
  }, [revisionAppealDetail]);

  const isManualFieldDisabled = () => {
    return true;
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedEmployeeId || !periodMonth || !periodYear) {
      setError("Pegawai, bulan, dan tahun wajib dipilih");
      return;
    }

    try {
      setLoadingGenerate(true);

      if (isAppealRevisionMode && appealRevisionId) {
        const revisedFinalAmount = Number(
          Number(payrollPreview?.netSalary || 0).toFixed(2),
        );

        await financeApi.createRevisedPayroll(appealRevisionId, {
          final_amount: revisedFinalAmount,
          basic_salary: Number(payrollPreview?.basicSalary || 0),
          transport_allowance: Number(payrollPreview?.transportAllowance || 0),
          meal_allowance: Number(payrollPreview?.mealAllowance || 0),
          health_allowance: Number(payrollPreview?.healthAllowance || 0),
          bonus: Number(manualInput.bonus || 0),
          other_allowance: Number(manualInput.other_allowance || 0),
          other_deduction: Number(manualInput.other_deduction || 0),
          allowance: Number(payrollPreview?.allowanceTotal || 0),
          gross_salary: Number(payrollPreview?.grossSalary || 0),
          reimbursement_total: Number(payrollPreview?.reimbursement || 0),
          total_income: Number(payrollPreview?.totalIncome || 0),
          deduction: Number(payrollPreview?.totalDeduction || 0),
          late_deduction: Number(payrollPreview?.lateDeduction || 0),
          absent_deduction: Number(payrollPreview?.absentDeduction || 0),
          bpjs_deduction: Number(payrollPreview?.bpjsDeduction || 0),
          tax_deduction: Number(payrollPreview?.taxDeduction || 0),
          total_late_days: Number(
            selectedEmployeeCurrentPayroll?.total_late_days || 0,
          ),
          total_absent_days: Number(payrollPreview?.deductibleAbsentDays || 0),
          total_sakit_days: Number(payrollPreview?.sickDays || 0),
          total_izin_days: Number(payrollPreview?.permissionDays || 0),
          present_days: Number(payrollPreview?.presentDays || 0),
          notes: "Revisi payroll dari banding gaji disetujui HR",
        });

        const refreshedRows = await financeApi.getPayrollByEmployee(
          selectedEmployeeId,
          {
            month: Number(periodMonth),
            year: Number(periodYear),
          },
        );
        const refreshedMonthlyRows = await financeApi.getPayrollList({
          month: Number(periodMonth),
          year: Number(periodYear),
        });
        setMonthlyPayrollRows(refreshedMonthlyRows || []);
        setCurrentEmployeePayrollRows(refreshedRows || []);
        setLatestGenerated(null);
        setSuccessMessage(
          "Slip revisi berhasil diperbarui (ID tetap) dan masuk ke rekap draft siap dikirim",
        );
        navigate(
          `/app/payroll?month=${Number(periodMonth)}&year=${Number(periodYear)}`,
          { replace: true },
        );
        return;
      }

      const payload = {
        employee_id: Number(selectedEmployeeId),
        period_month: Number(periodMonth),
        period_year: Number(periodYear),
        bonus: Number(manualInput.bonus || 0),
        other_allowance: Number(fixedOtherAllowance || 0),
        tax_deduction: autoTaxDeduction,
        other_deduction: Number(manualInput.other_deduction || 0),
      };

      const result = await financeApi.generatePayroll(payload);
      setLatestGenerated(result);
      setSuccessMessage("Slip gaji berhasil dibuat, perhitungan payroll tampil di bawah");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handlePublishAll = async () => {
    setError("");
    setSuccessMessage("");

    const draftRows = monthlyPayrollRows.filter(
      (item) => item.status === "draft",
    );

    if (!draftRows.length) {
      setError("Tidak ada slip draft yang perlu dipublish");
      return;
    }

    try {
      setLoadingPublishAll(true);
      await Promise.all(
        draftRows.map((item) => financeApi.publishPayroll(item.id)),
      );
      setSuccessMessage(
        "Semua slip bulan ini berhasil dipublish ke akun masing-masing pegawai",
      );

      const refreshedRows = await financeApi.getPayrollList({
        month: Number(recapMonth),
        year: Number(periodYear),
      });
      setMonthlyPayrollRows(refreshedRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPublishAll(false);
    }
  };

  const openPayrollPdf = async (payrollId) => {
    const previewWindow = window.open("about:blank", "_blank");

    try {
      setError("");
      const blob = await financeApi.getPayrollPdfBlob(payrollId);
      const url = window.URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }
      setError(err.message);
    }
  };

  const handleViewRow = (row) => {
    openPayrollPdf(row.id);
  };

  const handleEditRow = (row) => {
    setSelectedEmployeeId(String(row.employee_id));
    setPeriodMonth(String(row.period_month));
    setPeriodYear(String(row.period_year));
    setManualInput({
      bonus: String(row.bonus || ""),
      other_allowance: String(fixedOtherAllowance || 0),
      other_deduction: String(row.other_deduction || ""),
    });
    setLatestGenerated(null);
    setError("");
    setSuccessMessage(
      "Data slip dimuat ke form. Silakan ubah nilai lalu klik Buat Slip Gaji",
    );
  };

  const handleDeleteRow = async (row) => {
    if (row.status !== "draft") {
      setError("Hanya slip berstatus draft yang bisa dihapus");
      return;
    }

    const confirmed = window.confirm(
      `Hapus slip payroll ID ${row.id} untuk ${row.employee_name}?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      await financeApi.deletePayroll(row.id);
      setSuccessMessage("Slip draft berhasil dihapus");

      const updatedRows = monthlyPayrollRows.filter((item) => item.id !== row.id);
      setMonthlyPayrollRows(updatedRows);

      if (String(selectedEmployeeId) === String(row.employee_id)) {
        const employeeRows = await financeApi.getPayrollByEmployee(row.employee_id, {
          month: Number(periodMonth),
          year: Number(periodYear),
        });
        setCurrentEmployeePayrollRows(employeeRows || []);
      }

      if (String(latestGenerated?.payroll_id) === String(row.id)) {
        setLatestGenerated(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const doneEmployeeIds = new Set(
    monthlyPayrollRows.map((item) => String(item.employee_id)),
  );
  const recapPayrollRows = monthlyPayrollRows.filter(
    (item) => String(item.status || "").toLowerCase() !== "claimed",
  );
  const hasDraftToPublish = monthlyPayrollRows.some(
    (item) => item.status === "draft",
  );

  return (
    <>
      {(error || successMessage) && (
        <div className="mb-4">
          {error && (
            <div className="alert alert-error mb-2">
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {successMessage && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success">
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <TitleCard title={isRevisionPage ? "Revisi Slip Gaji" : "Payroll"} topMargin="mt-0">
          <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-4">
            {isAppealRevisionMode ? (
              <div className="alert alert-info">
                <span>
                  Revisi banding gaji (Appeal ID: {appealRevisionId || "-"}) untuk periode {periodMonth}/{periodYear}.
                </span>
              </div>
            ) : (
              <>
                <label className="form-control">
                  <span className="label-text mb-1">Pegawai</span>
                  <select
                    className="select select-bordered w-full"
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                    disabled={loadingReferenceData}
                  >
                    {!employeeReferenceData.length && (
                      <option value="">Data pegawai belum tersedia</option>
                    )}
                    {employeeReferenceData.map((item) => (
                      <option key={item.employee_id} value={item.employee_id}>
                        {item.employee_name} ({item.employee_code})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="form-control">
                    <span className="label-text mb-1">Bulan</span>
                    <select
                      className="select select-bordered w-full"
                      value={periodMonth}
                      onChange={(event) => setPeriodMonth(event.target.value)}
                    >
                      {monthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1">Tahun</span>
                    <input
                      className="input input-bordered w-full"
                      value={periodYear}
                      onChange={(event) => setPeriodYear(event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              {isAppealRevisionMode && (
                <>
                  <input
                    className="input input-bordered w-full"
                    value={`Pegawai: ${selectedEmployeeReference?.employee_name || "-"} (${selectedEmployeeReference?.employee_code || "-"})`}
                    disabled
                  />
                  <input
                    className="input input-bordered w-full"
                    value={`Periode: ${periodMonth}/${periodYear}`}
                    disabled
                  />
                </>
              )}
            </div>

            {isAppealRevisionMode && revisionAppealDetail && (
              <div className="rounded-lg border border-base-300 p-4 text-sm space-y-2">
                <p className="font-semibold">Detail yang Direvisi</p>
                <p>
                  <span className="font-semibold">Nominal Perbaikan HR:</span>{" "}
                  {formatCurrency(revisionAppealDetail.expected_amount || 0)}
                </p>
                <p>
                  <span className="font-semibold">Dasar Slip Payroll:</span>{" "}
                  {selectedEmployeeCurrentPayroll
                    ? `Payroll ID ${selectedEmployeeCurrentPayroll.id || "-"} (${periodMonth}/${periodYear})`
                    : "Data payroll periode ini belum ditemukan"}
                </p>
                <div className="overflow-x-auto">
                  <table className="table table-zebra table-xs">
                    <thead>
                      <tr>
                        <th>Komponen</th>
                        <th>Payroll Perbaikan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedRevisionItems.map((item, index) => (
                        <tr key={`${item.label || "approved"}-${index}`}>
                          <td>{item.label || "Komponen Revisi"}</td>
                          <td>{formatCurrency(item.payroll_value || 0)}</td>
                        </tr>
                      ))}
                      {approvedRevisionItems.length === 0 && (
                        <tr>
                          <td colSpan={2} className="text-center opacity-70">
                            Belum ada komponen yang disetujui HR
                          </td>
                        </tr>
                      )}
                      {!selectedEmployeeCurrentPayroll && approvedRevisionItems.length > 0 && (
                        <tr>
                          <td colSpan={2} className="text-center opacity-70">Data slip payroll belum tersedia untuk periode ini</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {selectedEmployeeSummary && (
              <div className="rounded-lg border border-base-300 p-4">
                <div className="flex items-start gap-4">
                  <div className="avatar">
                    <div className="w-14 rounded-lg">
                      <img
                        src={selectedEmployeeAvatarUrl}
                        alt={selectedEmployeeSummary.employee_name}
                      />
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-semibold">Nama:</span>{" "}
                      {selectedEmployeeReference?.employee_name ||
                        selectedEmployeeSummary?.employee_name ||
                        "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Kode:</span>{" "}
                      {selectedEmployeeReference?.employee_code ||
                        selectedEmployeeSummary?.employee_code ||
                        "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Departemen:</span>{" "}
                      {selectedEmployeeReference?.department_name || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Posisi:</span>{" "}
                      {selectedEmployeeReference?.position_name || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Level:</span>{" "}
                      {selectedEmployeeReference?.position_level || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Role:</span>{" "}
                      {selectedEmployeeReference?.roles || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Status Kepegawaian:</span>{" "}
                      {selectedEmployeeReference?.employment_status || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Status User:</span>{" "}
                      {selectedEmployeeReference?.user_status || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Gaji Dasar Tersimpan:
                      </span>{" "}
                      {selectedBasicSalary
                        ? formatCurrency(selectedBasicSalary)
                        : "Belum tersedia"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <input
                className="input input-bordered w-full"
                value={`Hadir: ${payrollPreview.presentDays || 0} hari`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Alpha: ${payrollPreview.alphaDays || 0} hari`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Telat: ${formatLateDuration(payrollPreview.totalLateMinutes)}`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Izin/Cuti: ${payrollPreview.permissionDays || 0} hari`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Sakit: ${payrollPreview.sickDays || 0} hari`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Reimb Dihitung Payroll: ${formatCurrency(payrollPreview.reimbursement)}`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Pajak 3%: ${formatCurrency(autoTaxDeduction)}`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Transport/Hari: ${formatCurrency(payrollSettings.transport_per_day)}`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Makan/Hari: ${formatCurrency(payrollSettings.meal_per_day)}`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Tunjangan Kesehatan: ${(Number(payrollSettings.health_percentage || 0) * 100).toFixed(2)}%`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Potongan BPJS: ${(Number(payrollSettings.bpjs_percentage || 0) * 100).toFixed(2)}%`}
                disabled
              />
              <input
                className="input input-bordered w-full"
                value={`Bonus: ${manualInput.bonus || 0}`}
                disabled={isManualFieldDisabled("bonus")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                className="input input-bordered w-full"
                value={`Tunjangan Lainnya: ${manualInput.other_allowance || 0}`}
                disabled={isManualFieldDisabled("other_allowance")}
              />
              <input
                className="input input-bordered w-full"
                value={`Potongan Lainnya: ${manualInput.other_deduction || 0}`}
                disabled={isManualFieldDisabled("other_deduction")}
              />
            </div>

            {!isAppealRevisionMode && (
              <div className="alert alert-info text-sm">
                <span>
                  Nilai bonus dan potongan lain terisi otomatis dari adjustment atasan (atau slip terakhir jika belum ada adjustment). Nilai tunjangan lain dipatok otomatis sesuai jabatan dan bersifat read-only.
                </span>
              </div>
            )}

            <div className="rounded-lg border border-base-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold">Preview Perhitungan Payroll</p>
              </div>
              <div className="grid md:grid-cols-2 grid-cols-1 gap-3 text-sm">
                <div className="rounded-lg bg-base-200 p-3">
                  <p className="text-lg font-bold">
                    <span className="font-semibold">Net Salary:</span>{" "}
                    {formatCurrency(payrollPreview.netSalary)}
                  </p>
                  <p>
                    <span className="font-semibold">Total Income:</span>{" "}
                    {formatCurrency(payrollPreview.totalIncome)}
                  </p>
                  <p>
                    <span className="font-semibold">Total Deduction:</span>{" "}
                    {formatCurrency(payrollPreview.totalDeduction)}
                  </p>
                </div>
                <div className="rounded-lg bg-base-200 p-3">
                  <p>
                    <span className="font-semibold">Gaji Pokok:</span>{" "}
                    {formatCurrency(payrollPreview.basicSalary)}
                  </p>
                  <p>
                    <span className="font-semibold">Total Tunjangan:</span>{" "}
                    {formatCurrency(payrollPreview.allowanceTotal)}
                  </p>
                  <p>
                    <span className="font-semibold">Reimbursement:</span>{" "}
                    {formatCurrency(payrollPreview.reimbursement)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="table table-zebra table-sm">
                  <tbody>
                    <tr>
                      <td>Transport</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.transportAllowance)}
                      </td>
                    </tr>
                    <tr>
                      <td>Makan</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.mealAllowance)}
                      </td>
                    </tr>
                    <tr>
                      <td>Tunjangan Kesehatan</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.healthAllowance)}
                      </td>
                    </tr>
                    <tr>
                      <td>Bonus</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.bonus)}
                      </td>
                    </tr>
                    <tr>
                      <td>Tunjangan Lain</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.otherAllowance)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td>Total Tunjangan</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.allowanceTotal)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td>Gross Salary</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.grossSalary)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td>Total Income</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.totalIncome)}
                      </td>
                    </tr>
                    <tr>
                      <td>Potongan Telat</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.lateDeduction)}
                      </td>
                    </tr>
                    <tr>
                      <td>Potongan Alpha</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.absentDeduction)}
                      </td>
                    </tr>
                    <tr>
                      <td>Potongan BPJS</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.bpjsDeduction)}
                      </td>
                    </tr>
                    <tr>
                      <td>Potongan Pajak</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.taxDeduction)}
                      </td>
                    </tr>
                    <tr>
                      <td>Potongan Lain</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.otherDeduction)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td>Total Potongan</td>
                      <td className="text-right">
                        {formatCurrency(payrollPreview.totalDeduction)}
                      </td>
                    </tr>
                    <tr className="font-semibold text-lg">
                      <td>Take Home Pay</td>
                      <td className="text-right font-bold">
                        {formatCurrency(payrollPreview.netSalary)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <input
              className="input input-bordered w-full"
              value={
                autoPayrollId
                  ? `Payroll ID: ${autoPayrollId}`
                  : ""
              }
              disabled
            />

            <button
              className={`btn btn-primary w-full ${loadingGenerate ? "loading" : ""}`}
              type="submit"
            >
              {isAppealRevisionMode ? "Kirim" : "Buat Slip Gaji"}
            </button>
          </form>

          {latestGenerated?.payroll_id &&
            String(latestGenerated?.employee?.id) ===
              String(selectedEmployeeId) && (
              <div className="mt-5 border-t border-base-300 pt-4">
                <p className="font-semibold mb-3">Detail Slip Gaji</p>
                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => openPayrollPdf(latestGenerated.payroll_id)}
                  >
                    Lihat PDF Slip
                  </button>
                </div>
                <div className="grid md:grid-cols-2 grid-cols-1 gap-4 text-sm">
                  <div className="rounded-lg bg-base-200 p-4">
                    <p>
                      <span className="font-semibold">Payroll ID:</span>{" "}
                      {latestGenerated.payroll_id}
                    </p>
                    <p>
                      <span className="font-semibold">Pegawai:</span>{" "}
                      {latestGenerated?.employee?.name}
                    </p>
                    <p>
                      <span className="font-semibold">Periode:</span>{" "}
                      {latestGenerated?.period}
                    </p>
                  </div>
                  <div className="rounded-lg bg-base-200 p-4">
                    <p className="text-lg font-bold">
                      <span className="font-semibold">Net Salary:</span>{" "}
                      {formatCurrency(latestGenerated?.details?.net_salary)}
                    </p>
                    <p>
                      <span className="font-semibold">Total Income:</span>{" "}
                      {formatCurrency(
                        latestGenerated?.details?.income?.total_income,
                      )}
                    </p>
                    <p>
                      <span className="font-semibold">Total Deduction:</span>{" "}
                      {formatCurrency(
                        latestGenerated?.details?.total_deduction,
                      )}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto mt-3">
                  <table className="table table-zebra table-sm">
                    <tbody>
                      <tr>
                        <td>Gaji Pokok</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.basic_salary,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Transport + Makan + Kesehatan + Bonus + Lain</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.allowances?.total,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Reimbursement</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.reimbursement_total,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Potongan Telat</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.late_deduction,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Potongan Alpha</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.absent_deduction,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Potongan BPJS</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.bpjs_deduction,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Potongan Pajak</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.tax_deduction,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Potongan Lain</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.other_deduction,
                          )}
                        </td>
                      </tr>
                      <tr className="font-semibold text-lg">
                        <td>Take Home Pay</td>
                        <td className="text-right font-bold">
                          {formatCurrency(latestGenerated?.details?.net_salary)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </TitleCard>

        {!isAppealRevisionMode && !isRevisionPage && (
        <TitleCard title="Rekap Slip Gaji Bulan Ini & Publish" topMargin="mt-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="badge badge-outline">
              Pegawai aktif: {employeeReferenceData.length}
            </span>
            <span
              className={`badge ${
                employeeReferenceData.length > 0 &&
                doneEmployeeIds.size === employeeReferenceData.length
                  ? "badge-success"
                  : "badge-warning"
              }`}
            >
              Slip dibuat: {doneEmployeeIds.size}/{employeeReferenceData.length}
            </span>
            <span className="badge badge-info">
              Draft:{" "}
              {
                monthlyPayrollRows.filter((item) => item.status === "draft")
                  .length
              }
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="form-control">
              <span className="label-text mb-1">Filter Bulan Rekap</span>
              <select
                className="select select-bordered w-full"
                value={recapMonth}
                onChange={(event) => setRecapMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Tahun Rekap</span>
              <input
                className="input input-bordered w-full"
                value={periodYear}
                onChange={(event) => setPeriodYear(event.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Payroll ID</th>
                  <th>Pegawai</th>
                  <th>Gaji Pokok</th>
                  <th>Reimbursement</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recapPayrollRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.employee_name}</td>
                    <td>{formatCurrency(item.basic_salary)}</td>
                    <td>{formatCurrency(item.reimbursement_total)}</td>
                    <td>
                      {formatCurrency(item.final_amount || item.net_salary)}
                    </td>
                    <td>
                      <span
                        className={`badge ${statusBadgeClass[item.status] || "badge-outline"}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => handleViewRow(item)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline btn-info"
                          onClick={() => handleEditRow(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline btn-error"
                          onClick={() => handleDeleteRow(item)}
                          disabled={item.status !== "draft"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!recapPayrollRows.length && !loadingMonthlyRows && (
                  <tr>
                    <td colSpan={7} className="text-center opacity-70">
                      Belum ada slip gaji bulan ini
                    </td>
                  </tr>
                )}
                {loadingMonthlyRows && (
                  <tr>
                    <td colSpan={7} className="text-center opacity-70">
                      Memuat rekap payroll bulan ini...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            className={`btn btn-secondary w-full mt-4 ${loadingPublishAll ? "loading" : ""}`}
            onClick={handlePublishAll}
            disabled={!hasDraftToPublish || loadingPublishAll}
          >
            Publish Semua Slip Bulan Ini
          </button>
        </TitleCard>
        )}
      </div>

      {latestGenerated?.payroll_id && false && (
        <TitleCard
          title="Ringkasan Slip Gaji (Preview Pemula)"
          topMargin="mt-6"
        >
          <div className="grid md:grid-cols-2 grid-cols-1 gap-4 text-sm">
            <div className="rounded-lg bg-base-200 p-4">
              <p>
                <span className="font-semibold">Payroll ID:</span>{" "}
                {latestGenerated.payroll_id}
              </p>
              <p>
                <span className="font-semibold">Pegawai:</span>{" "}
                {latestGenerated?.employee?.name}
              </p>
              <p>
                <span className="font-semibold">Periode:</span>{" "}
                {latestGenerated?.period}
              </p>
            </div>
            <div className="rounded-lg bg-base-200 p-4">
              <p>
                <span className="font-semibold">Net Salary:</span>{" "}
                {formatCurrency(latestGenerated?.details?.net_salary)}
              </p>
              <p>
                <span className="font-semibold">Total Income:</span>{" "}
                {formatCurrency(latestGenerated?.details?.income?.total_income)}
              </p>
              <p>
                <span className="font-semibold">Total Deduction:</span>{" "}
                {formatCurrency(latestGenerated?.details?.total_deduction)}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="table table-zebra table-sm">
              <tbody>
                <tr>
                  <td>Gaji Pokok</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.basic_salary)}
                  </td>
                </tr>
                <tr>
                  <td>Tunjangan Total</td>
                  <td className="text-right">
                    {formatCurrency(
                      latestGenerated?.details?.allowances?.total,
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Reimbursement</td>
                  <td className="text-right">
                    {formatCurrency(
                      latestGenerated?.details?.reimbursement_total,
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Total Potongan</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.total_deduction)}
                  </td>
                </tr>
                <tr>
                  <td>Potongan Telat</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.late_deduction)}
                  </td>
                </tr>
                <tr>
                  <td>Potongan Alpha</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.absent_deduction)}
                  </td>
                </tr>
                <tr>
                  <td>Potongan BPJS</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.bpjs_deduction)}
                  </td>
                </tr>
                <tr>
                  <td>Potongan Pajak</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.tax_deduction)}
                  </td>
                </tr>
                <tr>
                  <td>Potongan Lain</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.other_deduction)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td>Take Home Pay</td>
                  <td className="text-right">
                    {formatCurrency(latestGenerated?.details?.net_salary)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TitleCard>
      )}
    </>
  );
}

export default FinancePayroll;
