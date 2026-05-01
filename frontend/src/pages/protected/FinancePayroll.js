import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { formatLateDuration } from "../../components/Typography/LateDurationText";
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

const formatPercent = (value) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value || 0) * 100)}%`;

const normalizePercentValue = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed >= 1 ? parsed / 100 : parsed;
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

const statusLabelMap = {
  draft: "draf",
  published: "dipublikasikan",
  claimed: "diklaim",
};

const getStatusLabel = (status) =>
  statusLabelMap[String(status || "").toLowerCase()] || status || "-";

const LATE_DEDUCTION_HOURLY_PERCENTAGE = 0.02;
const DEFAULT_WORKING_HOURS_PER_DAY = 8;

const defaultPayrollSettings = {
  transport_per_day: 50000,
  meal_per_day: 25000,
  health_percentage: 0.01,
  bpjs_percentage: 0.01,
  tax: 0.03,
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

function FinancePayroll() {
  const dispatch = useDispatch();

  const period = getCurrentPeriod();
  const [error, setError] = useState("");
  const [setupWarning, setSetupWarning] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingPublishAll, setLoadingPublishAll] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [loadingMonthlyRows, setLoadingMonthlyRows] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [recapMonth, setRecapMonth] = useState(period.month);
  const [recapYear, setRecapYear] = useState(period.year);
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
        title: "Payroll Keuangan",
      }),
    );
  }, [dispatch]);

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
        const hasSelectedPeriod = Boolean(periodMonth && periodYear);
        const [
          attendanceSummaryResult,
          reimbursementsResult,
          payrollSettingsResult,
          employeeReferenceResult,
          managerAdjustmentsResult,
        ] = await Promise.allSettled([
          hasSelectedPeriod
            ? financeApi.getAttendanceSummaryAll({
                month: Number(periodMonth),
                year: Number(periodYear),
              })
            : Promise.resolve([]),
          financeApi.getReimbursements(),
          financeApi.getPayrollSettings(),
          financeApi.getEmployeeReferences(),
          hasSelectedPeriod
            ? financeApi.getPayrollManagerAdjustments({
                month: Number(periodMonth),
                year: Number(periodYear),
              })
            : Promise.resolve({ data: [] }),
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
        const payrollSetupValidation = payrollSettingsRow?.validation || {};
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
          health_percentage: normalizePercentValue(
            payrollSettingsRow?.health_percentage ??
              defaultPayrollSettings.health_percentage,
          ),
          bpjs_percentage: normalizePercentValue(
            payrollSettingsRow?.bpjs_percentage ??
              defaultPayrollSettings.bpjs_percentage,
          ),
          tax: normalizePercentValue(
            payrollSettingsRow?.tax ?? defaultPayrollSettings.tax,
          ),
        });

        const missingPayrollSettings =
          Boolean(payrollSetupValidation.has_missing_payroll_settings) ||
          !payrollSettingsResult?.value?.id;

        // Hitung jumlah posisi commissioner dari data referensi employee (unique position ids)
        const commissionerPositionIds = new Set(
          (employeeRows || [])
            .filter((r) =>
              String(r.position_name || "").toLowerCase().includes("commissioner"),
            )
            .map((r) => String(r.position_id || r.position_id)),
        );

        const rawMissingBase = Number(payrollSetupValidation.missing_base_salary_count || 0);
        const rawMissingAllowance = Number(payrollSetupValidation.missing_position_allowance_count || 0);

        const adjustedMissingBaseCount = Math.max(0, rawMissingBase - commissionerPositionIds.size);
        const adjustedMissingAllowanceCount = Math.max(0, rawMissingAllowance - commissionerPositionIds.size);

        const missingPositionBaseSalary = adjustedMissingBaseCount > 0;
        const missingPositionAllowance = adjustedMissingAllowanceCount > 0;

        if (missingPayrollSettings || missingPositionBaseSalary || missingPositionAllowance) {
          const warningParts = [];

          if (missingPayrollSettings) {
            warningParts.push("pengaturan payroll belum lengkap");
          }

          if (missingPositionBaseSalary) {
            warningParts.push(
              `${adjustedMissingBaseCount} posisi masih belum punya gaji pokok`,
            );
          }

          if (missingPositionAllowance) {
            warningParts.push(
              `${adjustedMissingAllowanceCount} posisi masih belum punya tunjangan jabatan`,
            );
          }

          setSetupWarning(
            `Komponen gaji belum lengkap. ${warningParts.join(
              "; ",
            )}. Silakan lengkapi komponen payroll terlebih dahulu sebelum membuat payroll.`,
          );
        } else {
          setSetupWarning("");
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
  }, [periodMonth, periodYear]);

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
      if (!selectedEmployeeId || !periodMonth || !periodYear) {
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
          year: Number(recapYear),
        });

        setMonthlyPayrollRows(rows || []);
      } catch (err) {
        setMonthlyPayrollRows([]);
      } finally {
        setLoadingMonthlyRows(false);
      }
    };

    loadMonthlyRows();
  }, [recapMonth, recapYear, latestGenerated]);

  const hasPayrollFiltersSelected = Boolean(
    selectedEmployeeId && periodMonth && String(periodYear).trim(),
  );

  const sortedEmployeeReferenceData = useMemo(() => {
    const rows = [...employeeReferenceData];
    rows.sort((a, b) => {
      const codeA = String(a.employee_code || "").trim();
      const codeB = String(b.employee_code || "").trim();
      return codeA.localeCompare(codeB, "id", {
        numeric: true,
        sensitivity: "base",
      });
    });
    return rows;
  }, [employeeReferenceData]);

  const availableYearOptions = useMemo(() => {
    const currentYear = Number(getCurrentPeriod().year);
    return Array.from({ length: 6 }, (_, index) => String(currentYear + index));
  }, []);

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

  const existingPayrollForSelectedPeriod = useMemo(() => {
    return currentEmployeePayrollRows[0] || null;
  }, [currentEmployeePayrollRows]);

  const hasExistingPayrollForPeriod = Boolean(existingPayrollForSelectedPeriod);

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
    return Number((selectedBasicSalary * Number(payrollSettings.tax || 0.03)).toFixed(2));
  }, [selectedBasicSalary, payrollSettings.tax]);

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
        if (
          item.status === "approved" ||
          item.status === "included_in_payroll"
        ) {
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
    if (selectedManagerAdjustment) {
      setManualInput({
        bonus: String(Number(selectedManagerAdjustment.bonus || 0)),
        other_allowance: String(fixedOtherAllowance || 0),
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
    selectedManagerAdjustment,
    selectedEmployeeCurrentPayroll,
    selectedEmployeeId,
    periodMonth,
    periodYear,
    fixedOtherAllowance,
  ]);

  const payrollPreview = useMemo(() => {
    const resolveInputValue = (inputValue, fallbackValue) => {
      if (
        inputValue === "" ||
        inputValue === null ||
        inputValue === undefined
      ) {
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
          (
            allowanceWithoutEditable +
            editedBonus +
            editedOtherAllowance
          ).toFixed(2),
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
        basicSalary: Number(
          latestGeneratedForSelected.details.basic_salary || 0,
        ),
        transportAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.transport || 0,
        ),
        mealAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.meal || 0,
        ),
        healthAllowance: Number(
          latestGeneratedForSelected.details?.allowances?.health || 0,
        ),
        bonus: Number(
          latestGeneratedForSelected.details?.allowances?.bonus || 0,
        ),
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
        presentDays: Number(
          latestGeneratedForSelected.details?.present_days || 0,
        ),
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
            Number(
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
              ),
        ),
        totalLateMinutes: Number(
          latestGeneratedForSelected.details?.attendance_summary
            ?.total_late_minutes || 0,
        ),
      };
    }

    const presentDays = Number(selectedEmployeeSummary?.present_days || 0);
    const alphaDays = Number(selectedEmployeeSummary?.alpha_days || 0);
    const permissionDays = Number(
      selectedEmployeeSummary?.permission_days || 0,
    );
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
      (basicSalary * Number(payrollSettings.health_percentage || 0)).toFixed(2),
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

  const isManualFieldDisabled = () => {
    return true;
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (setupWarning) {
      setError(setupWarning);
      return;
    }

    if (!selectedEmployeeId || !periodMonth || !periodYear) {
      setError("Pegawai, bulan, dan tahun wajib dipilih");
      return;
    }

    if (hasExistingPayrollForPeriod) {
      setError(
        "Slip gaji untuk pegawai dan periode ini sudah ada. Gunakan slip yang sudah tersedia.",
      );
      return;
    }

    try {
      setLoadingGenerate(true);

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
      setSuccessMessage(
        "Slip gaji berhasil dibuat, perhitungan payroll tampil pada tabel di bawah",
      );
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
        year: Number(recapYear),
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

      const updatedRows = monthlyPayrollRows.filter(
        (item) => item.id !== row.id,
      );
      setMonthlyPayrollRows(updatedRows);

      if (String(selectedEmployeeId) === String(row.employee_id)) {
        const employeeRows = await financeApi.getPayrollByEmployee(
          row.employee_id,
          {
            month: Number(periodMonth),
            year: Number(periodYear),
          },
        );
        setCurrentEmployeePayrollRows(employeeRows || []);
      }

      if (String(latestGenerated?.payroll_id) === String(row.id)) {
        setLatestGenerated(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancelSelection = () => {
    setSelectedEmployeeId("");
    setPeriodMonth("");
    setPeriodYear("");
    setLatestGenerated(null);
    setError("");
    setSuccessMessage("");
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
      {(error || setupWarning || successMessage) && (
        <div className="mb-4">
          {error && (
            <div className="alert alert-error mb-2">
              <span>{error}</span>
            </div>
          )}
          {!error && setupWarning && (
            <div className="alert alert-warning mb-2">
              <span>{setupWarning}</span>
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
        <TitleCard title="Membuat Payroll" topMargin="mt-0">
          <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-4">
            <label className="form-control">
              <span className="label-text mb-1">Pegawai</span>
              <select
                className="select select-bordered w-full"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                disabled={loadingReferenceData}
              >
                <option value="">Pilih pegawai</option>
                {!employeeReferenceData.length && (
                  <option value="">Data pegawai belum tersedia</option>
                )}
                {sortedEmployeeReferenceData.map((item) => (
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
                  <option value="">Pilih bulan</option>
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
                  list="payroll-year-options"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Contoh: 2026"
                  onChange={(event) => setPeriodYear(event.target.value)}
                />
              </label>
            </div>

            <datalist id="payroll-year-options">
              {availableYearOptions.map((yearOption) => (
                <option key={yearOption} value={yearOption} />
              ))}
            </datalist>

            {!hasPayrollFiltersSelected && (
              <div className="alert alert-info text-sm">
                <span>
                  Pilih pegawai, bulan, dan tahun terlebih dahulu untuk
                  menampilkan detail perhitungan payroll.
                </span>
              </div>
            )}

            {hasPayrollFiltersSelected && selectedEmployeeSummary && (
              <div className="rounded-xl border border-base-300 p-6 bg-base-100">
                {/* HEADER PROFILE */}
                <div className="flex flex-col items-center mb-6">
                  <div className="avatar mb-3">
                    <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                      <img
                        src={selectedEmployeeAvatarUrl}
                        alt={selectedEmployeeSummary.employee_name}
                      />
                    </div>
                  </div>

                  <h2 className="text-lg font-bold">
                    {selectedEmployeeReference?.employee_name ||
                      selectedEmployeeSummary?.employee_name ||
                      "-"}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {selectedEmployeeReference?.position_name || "-"}
                  </p>
                </div>

                {/* DATA GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 text-sm max-w-3xl mx-auto">
                  <p>
                    <span className="font-semibold">Kode:</span>{" "}
                    {selectedEmployeeReference?.employee_code || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Departemen:</span>{" "}
                    {selectedEmployeeReference?.department_name || "-"}
                  </p>

                  <p>
                    <span className="font-semibold">Level:</span>{" "}
                    {selectedEmployeeReference?.position_level || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Peran:</span>{" "}
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

                  <p className="md:col-span-2">
                    <span className="font-semibold">Gaji Pokok:</span>{" "}
                    {selectedBasicSalary
                      ? formatCurrency(selectedBasicSalary)
                      : "Belum tersedia"}
                  </p>
                </div>
              </div>
            )}
            {hasPayrollFiltersSelected && (
              <>
                {hasExistingPayrollForPeriod && (
                  <div className="alert alert-warning text-sm">
                    <span>
                      Slip gaji untuk pegawai dan periode ini sudah pernah
                      dibuat (ID: {existingPayrollForSelectedPeriod?.id}).
                      Pembuatan slip baru dinonaktifkan.
                    </span>
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
                    value={`Terlambat: ${formatLateDuration(payrollPreview.totalLateMinutes)}`}
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
                    value={`Penggantian Dana: ${formatCurrency(payrollPreview.reimbursement)}`}
                    disabled
                  />
                  <input
                    className="input input-bordered w-full"
                    value={`Pajak ${formatPercent(payrollSettings.tax || 0.03)}: ${formatCurrency(autoTaxDeduction)}`}
                    disabled
                  />
                  <input
                    className="input input-bordered w-full"
                    value={`Tunjangan Transport per-hari: ${formatCurrency(payrollSettings.transport_per_day)}`}
                    disabled
                  />
                  <input
                    className="input input-bordered w-full"
                    value={`Tunjangan Makan per-hari: ${formatCurrency(payrollSettings.meal_per_day)}`}
                    disabled
                  />
                  <input
                    className="input input-bordered w-full"
                    value={`Tunjangan Kesehatan: ${formatPercent(payrollSettings.health_percentage || 0)}`}
                    disabled
                  />
                  <input
                    className="input input-bordered w-full"
                    value={`Potongan BPJS: ${formatPercent(payrollSettings.bpjs_percentage || 0)}`}
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

                <div className="alert alert-info text-sm">
                  <span>
                    Nilai bonus dan potongan lain terisi otomatis dari
                    penyesuaian manajer (atau slip terakhir jika belum ada
                    penyesuaian).
                    Nilai tunjangan lain dipatok otomatis sesuai jabatan dan
                    bersifat hanya-baca.
                  </span>
                </div>

                <div className="rounded-lg border border-base-300 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold">Pratinjau Perhitungan Payroll</p>
                  </div>
                  <div className="grid md:grid-cols-2 grid-cols-1 gap-3 text-sm">
                    <div className="rounded-lg bg-base-200 p-3">
                      <p className="text-lg font-bold">
                        <span className="font-semibold">Gaji Bersih:</span>{" "}
                        {formatCurrency(payrollPreview.netSalary)}
                      </p>
                      <p>
                        <span className="font-semibold">Total Pendapatan:</span>{" "}
                        {formatCurrency(payrollPreview.totalIncome)}
                      </p>
                      <p>
                        <span className="font-semibold">Total Potongan:</span>{" "}
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
                        <span className="font-semibold">Total Reimbursement:</span>{" "}
                        {formatCurrency(payrollPreview.reimbursement)}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto mt-3">
                    <table className="table table-zebra table-sm">
                      <tbody>
                        <tr>
                          <td>Tunjangan Transport</td>
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
                          <td>Gaji Kotor</td>
                          <td className="text-right">
                            {formatCurrency(payrollPreview.grossSalary)}
                          </td>
                        </tr>
                        <tr className="font-semibold">
                          <td>Total Pendapatan</td>
                          <td className="text-right">
                            {formatCurrency(payrollPreview.totalIncome)}
                          </td>
                        </tr>
                        <tr>
                          <td>Potongan Keterlambatan</td>
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
                          <td>Gaji yang Diterima</td>
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
                  value={autoPayrollId ? `ID Payroll: ${autoPayrollId}` : ""}
                  disabled
                />

                <button
                  className={`btn btn-primary w-full ${loadingGenerate ? "loading" : ""}`}
                  type="submit"
                  disabled={loadingGenerate || hasExistingPayrollForPeriod || Boolean(setupWarning)}
                >
                  {hasExistingPayrollForPeriod
                    ? "Slip Sudah Dibuat"
                    : setupWarning
                      ? "Lengkapi Komponen Gaji"
                    : "Buat Slip Gaji"}
                </button>

                <button
                  className="btn btn-outline w-full"
                  type="button"
                  onClick={handleCancelSelection}
                >
                  Batal
                </button>
              </>
            )}
          </form>

          {hasPayrollFiltersSelected &&
            latestGenerated?.payroll_id &&
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
                      <span className="font-semibold">ID Payroll:</span>{" "}
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
                      <span className="font-semibold">Gaji Bersih:</span>{" "}
                      {formatCurrency(latestGenerated?.details?.net_salary)}
                    </p>
                    <p>
                      <span className="font-semibold">Total Pendapatan:</span>{" "}
                      {formatCurrency(
                        latestGenerated?.details?.income?.total_income,
                      )}
                    </p>
                    <p>
                      <span className="font-semibold">Total Potongan:</span>{" "}
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
                        <td>Penggantian Dana</td>
                        <td className="text-right">
                          {formatCurrency(
                            latestGenerated?.details?.reimbursement_total,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Potongan Keterlambatan</td>
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
                        <td>Gaji Diterima</td>
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

        <TitleCard title="Rekap Slip Gaji & Publikasi" topMargin="mt-0">
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
              Draf:{" "}
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
                value={recapYear}
                list="recap-year-options"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => setRecapYear(event.target.value)}
              />
            </label>
          </div>

          <datalist id="recap-year-options">
            {availableYearOptions.map((yearOption) => (
              <option key={`recap-${yearOption}`} value={yearOption} />
            ))}
          </datalist>

          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>ID Payroll</th>
                  <th>Pegawai</th>
                  <th>Gaji Pokok</th>
                  <th>Penggantian Dana</th>
                  <th>Gaji Bersih</th>
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
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => handleViewRow(item)}
                        >
                          Lihat
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline btn-info"
                          onClick={() => handleEditRow(item)}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline btn-error"
                          onClick={() => handleDeleteRow(item)}
                          disabled={item.status !== "draft"}
                        >
                          Hapus
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
            Publikasikan Semua Slip Bulan Ini
          </button>
        </TitleCard>
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
                  <td>Potongan Keterlambatan</td>
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
