const express = require("express");
const router = express.Router();
const db = require("../config/db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { logActivity, getIpAddress, getUserAgent } = require("../middleware/activityLogger");

// ============================
// CONFIGURATION
// ============================
// Konfigurasi deduction untuk keterlambatan
const LATE_DEDUCTION_CONFIG = {
    per_minute: 5000, // Rp 5.000 per menit terlambat
    // Atau bisa menggunakan persentase dari salary harian
    per_hour_percentage: 0.02, // 2% dari gaji per jam
};

// Default nilai (fallback) bila settings di DB tidak tersedia
const DEFAULT_ALLOWANCE_CONFIG = {
    transport_per_day: 50000,
    meal_per_day: 25000,
    health_percentage: 0.01,
    bpjs_percentage: 0.01,
};

const getAllowanceSettings = async () => {
    try {
        const [rows] = await db
            .promise()
            .query(
                "SELECT transport_per_day, meal_per_day, health_percentage, bpjs_percentage FROM payroll_settings ORDER BY id ASC LIMIT 1"
            );
        if (rows.length === 0) return DEFAULT_ALLOWANCE_CONFIG;
        return {
            transport_per_day: Number(rows[0].transport_per_day),
            meal_per_day: Number(rows[0].meal_per_day),
            health_percentage: Number(rows[0].health_percentage),
            bpjs_percentage: Number(rows[0].bpjs_percentage),
        };
    } catch (e) {
        return DEFAULT_ALLOWANCE_CONFIG;
    }
};

// ============================
// HELPER FUNCTIONS
// ============================

// Calculate late deduction berdasarkan total late minutes dan working hours
const calculateLateDeduction = (
    totalLateMinutes,
    baseSalary,
    workingHoursPerDay = 8
) => {
    if (!totalLateMinutes || totalLateMinutes === 0) return 0;

    // Kalkulasi dengan percentage dari gaji harian
    const dailySalary = baseSalary / 30; // Asumsi 30 hari kerja per bulan
    const hourlyRate = dailySalary / workingHoursPerDay; // Working hours bisa berbeda per shift
    const deduction =
        (totalLateMinutes / 60) *
        hourlyRate *
        LATE_DEDUCTION_CONFIG.per_hour_percentage;

    return Math.round(deduction);
};

// Calculate absent deduction
const calculateAbsentDeduction = (absentDays, baseSalary) => {
    if (!absentDays || absentDays === 0) return 0;

    const dailySalary = baseSalary / 30; // Asumsi 30 hari kerja per bulan
    const deduction = absentDays * dailySalary;

    return Math.round(deduction);
};

const toNumber = (value) => Number(value || 0);

const formatCurrency = (value) =>
    `Rp ${toNumber(value).toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

const hasPendingAppeal = async (payrollId) => {
    const [rows] = await db.promise().query(
        `SELECT COUNT(*) AS pending_count
         FROM salary_appeals
         WHERE payroll_id = ? AND status = 'pending' AND deleted_at IS NULL`,
        [payrollId]
    );

    return Number(rows[0]?.pending_count || 0) > 0;
};

const syncPayrollAppealStatus = async (payrollId) => {
    const pendingExists = await hasPendingAppeal(payrollId);
    const targetStatus = pendingExists ? "pending" : null;

    await db.promise().query(
        `UPDATE payrolls
         SET appeal_status = ?, updated_at = NOW()
         WHERE id = ?`,
        [targetStatus, payrollId]
    );

    return pendingExists;
};

let hasCheckedTransferredAtColumn = false;
let hasTransferredAtColumn = false;

const ensureTransferredAtColumn = async () => {
    if (hasCheckedTransferredAtColumn) {
        return hasTransferredAtColumn;
    }

    try {
        const [columnRows] = await db.promise().query(
            `SELECT COUNT(*) AS total
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'payrolls'
               AND COLUMN_NAME = 'transferred_at'`
        );

        hasTransferredAtColumn = Number(columnRows[0]?.total || 0) > 0;
    } catch (error) {
        hasTransferredAtColumn = false;
    }

    hasCheckedTransferredAtColumn = true;
    return hasTransferredAtColumn;
};

const parsePeriodValue = (value) => Number.parseInt(value, 10);

const getEffectiveManagerAdjustment = async (
    employeeId,
    periodMonth,
    periodYear
) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT id, employee_id, period_month, period_year, bonus, other_allowance, other_deduction,
                    notes, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes
             FROM allowance
                         WHERE employee_id = ? AND period_month = ? AND period_year = ?
                             AND status IN ('submitted', 'approved')
                         ORDER BY submitted_at DESC, reviewed_at DESC, updated_at DESC
             LIMIT 1`,
            [employeeId, periodMonth, periodYear]
        );

        return rows[0] || null;
    } catch (error) {
        return null;
    }
};

const getEmployeePositionContext = async (employeeId) => {
    const [rows] = await db.promise().query(
        `SELECT e.id, e.user_id, e.position_id, p.level, p.name AS position_name, p.department_id, p.position_allowance
         FROM employees e
         JOIN positions p ON e.position_id = p.id
         WHERE e.id = ?
         LIMIT 1`,
        [employeeId]
    );

    return rows[0] || null;
};

const isManagerLevelEmployee = (employeeContext) => {
    const level = String(employeeContext?.level || "").toLowerCase().trim();
    const positionName = String(employeeContext?.position_name || "")
        .toLowerCase()
        .trim();

    return level === "manager" || level === "director" || positionName.includes("manager") || positionName.includes("director");
};

// Get position allowance from database instead of hardcoded mappings
const resolveFixedOtherAllowance = (employeeContext = {}) => {
    // Return position_allowance dari database positions table
    const positionAllowance = Number(employeeContext.position_allowance || 0);
    return positionAllowance;
};

// ============================
// MANAGER ADJUSTMENTS
// ============================
router.get(
    "/manager-adjustments",
    verifyToken,
    verifyRole(["finance", "admin", "hr"]),
    async (req, res) => {
        try {
            const month = parsePeriodValue(req.query.month);
            const year = parsePeriodValue(req.query.year);
            const status = String(req.query.status || "").toLowerCase();
            const employeeId = parsePeriodValue(req.query.employee_id);

            const allowedStatuses = ["draft", "submitted", "approved", "rejected"];
            const params = [];
            let whereClause = "WHERE 1=1";

            if (Number.isInteger(month) && month >= 1 && month <= 12) {
                whereClause += " AND alw.period_month = ?";
                params.push(month);
            }

            if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
                whereClause += " AND alw.period_year = ?";
                params.push(year);
            }

            if (allowedStatuses.includes(status)) {
                whereClause += " AND alw.status = ?";
                params.push(status);
            }

            if (Number.isInteger(employeeId) && employeeId > 0) {
                whereClause += " AND alw.employee_id = ?";
                params.push(employeeId);
            }

            const [rows] = await db.promise().query(
                `SELECT alw.id, alw.employee_id, alw.bonus, alw.other_allowance, alw.other_deduction, 
                        alw.notes, alw.status, alw.period_month, alw.period_year, 
                        alw.submitted_at, alw.updated_at, alw.payroll_id,
                        e.employee_code, u.name AS employee_name,
                        submitter.name AS submitted_by_name,
                        pos.name AS position_name, dept.name AS department_name
                 FROM allowance alw
                 JOIN employees e ON alw.employee_id = e.id
                 JOIN users u ON e.user_id = u.id
                 LEFT JOIN positions pos ON e.position_id = pos.id
                 LEFT JOIN departments dept ON pos.department_id = dept.id
                 LEFT JOIN users submitter ON alw.submitted_by = submitter.id
                 ${whereClause}
                 ORDER BY alw.period_year DESC, alw.period_month DESC, u.name ASC`,
                params
            );

            res.status(200).json({
                message: "Manager allowance retrieved successfully",
                total: rows.length,
                data: rows,
            });
        } catch (error) {
            console.error(error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

router.post(
    "/manager-adjustments/upsert",
    verifyToken,
    verifyRole(["admin", "hr"]),
    async (req, res) => {
        try {
            const userRoles = req.user.roles || [];
            const isAdminRequest = userRoles.includes("admin");
            const isHrRequest = userRoles.includes("hr");

            const {
                employee_id,
                period_month,
                period_year,
                bonus = 0,
                other_deduction = 0,
                notes = "",
            } = req.body;

            const employeeId = parsePeriodValue(employee_id);
            const periodMonth = parsePeriodValue(period_month);
            const periodYear = parsePeriodValue(period_year);

            if (!employeeId || !periodMonth || !periodYear) {
                return res.status(400).json({
                    message: "employee_id, period_month, and period_year are required",
                });
            }

            if (periodMonth < 1 || periodMonth > 12 || periodYear < 2000 || periodYear > 2100) {
                return res.status(400).json({
                    message: "Invalid period_month or period_year",
                });
            }

            const parsedBonus = Math.round(Number(bonus) || 0);
            const parsedOtherDeduction = Math.round(Number(other_deduction) || 0);

            const employeeContext = await getEmployeePositionContext(employeeId);
            if (!employeeContext) {
                return res.status(404).json({ message: "Employee not found" });
            }

            const parsedOtherAllowance = resolveFixedOtherAllowance(employeeContext);

            if (parsedBonus < 0 || parsedOtherAllowance < 0 || parsedOtherDeduction < 0) {
                return res.status(400).json({
                    message: "Nominal bonus/tunjangan/potongan tidak boleh negatif",
                });
            }



            const [existing] = await db.promise().query(
                `SELECT id, status
                 FROM allowance
                 WHERE employee_id = ? AND period_month = ? AND period_year = ?
                 LIMIT 1`,
                [employeeId, periodMonth, periodYear]
            );

            let adjustmentId = null;
            if (existing.length > 0) {
                adjustmentId = existing[0].id;
                await db.promise().query(
                    `UPDATE allowance
                     SET bonus = ?, other_allowance = ?, other_deduction = ?, notes = ?,
                         status = 'submitted', submitted_by = ?, submitted_at = NOW(),
                         reviewed_by = NULL, reviewed_at = NULL, review_notes = NULL
                     WHERE id = ?`,
                    [
                        parsedBonus,
                        parsedOtherAllowance,
                        parsedOtherDeduction,
                        String(notes || "").trim() || null,
                        req.user.id,
                        adjustmentId,
                    ]
                );
            } else {
                const [insertResult] = await db.promise().query(
                    `INSERT INTO allowance
                     (employee_id, period_month, period_year, bonus, other_allowance, other_deduction, notes, status, submitted_by, submitted_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, NOW())`,
                    [
                        employeeId,
                        periodMonth,
                        periodYear,
                        parsedBonus,
                        parsedOtherAllowance,
                        parsedOtherDeduction,
                        String(notes || "").trim() || null,
                        req.user.id,
                    ]
                );
                adjustmentId = insertResult.insertId;
            }

            res.status(200).json({
                message: "Manager adjustment saved and applied for payroll generation",
                id: adjustmentId,
                status: "submitted",
            });
        } catch (error) {
            console.error(error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// Admin approve manager adjustments
router.put(
    "/manager-adjustments/:id/approve",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const adjustmentId = Number(id);
            const reviewerId = Number(req.user.id);

            if (!adjustmentId || adjustmentId <= 0) {
                return res.status(400).json({ message: "ID adjustment tidak valid" });
            }

            // Update status menjadi approved dengan reviewer info
            await db.promise().query(
                "UPDATE allowance SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
                [reviewerId, adjustmentId]
            );

            res.json({
                message: "Adjustment berhasil disetujui",
                adjustmentId: adjustmentId,
                status: "approved",
            });
        } catch (error) {
            console.error(error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// Admin reject manager adjustments
router.put(
    "/manager-adjustments/:id/reject",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body || {};
            const adjustmentId = Number(id);
            const reviewerId = Number(req.user.id);

            if (!adjustmentId || adjustmentId <= 0) {
                return res.status(400).json({ message: "ID adjustment tidak valid" });
            }

            // Update status menjadi rejected dengan reviewer info dan alasan
            await db.promise().query(
                "UPDATE allowance SET status = 'rejected', review_notes = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
                [reason || "", reviewerId, adjustmentId]
            );

            res.json({
                message: "Adjustment berhasil ditolak",
                adjustmentId: adjustmentId,
                status: "rejected",
            });
        } catch (error) {
            console.error(error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// ============================
// CREATE/GENERATE PAYROLL
// ============================
// HR/Admin membuat payroll untuk employee tertentu di periode tertentu
router.post(
    "/generate",
    verifyToken,
    verifyRole(["hr", "admin", "finance"]),
    async (req, res) => {
        try {
            const {
                employee_id,
                period_month,
                period_year,
                bonus = 0,
                tax_deduction = 0,
                other_deduction = 0,
            } = req.body;

            if (!employee_id || !period_month || !period_year) {
                return res.status(400).json({
                    message:
                        "employee_id, period_month, and period_year are required",
                });
            }

            // Get employee data dengan working hours info dan position allowance
            const [employeeData] = await db.promise().query(
                `SELECT e.id, e.position_id, p.name AS position_name, p.position_allowance, e.basic_salary, u.name, wh.check_in_time, wh.check_out_time
                     FROM employees e 
                     JOIN users u ON e.user_id = u.id
                     LEFT JOIN positions p ON e.position_id = p.id
                     LEFT JOIN working_hours wh ON e.working_hours_id = wh.id
                     WHERE e.id = ?`,
                [employee_id]
            );

            if (employeeData.length === 0) {
                return res.status(404).json({ message: "Employee not found" });
            }

            const employee = employeeData[0];
            const baseSalary = parseFloat(employee.basic_salary);

            // Calculate working hours per day dari shift employee
            let workingHoursPerDay = 8; // default 8 jam
            if (employee.check_in_time && employee.check_out_time) {
                const [inHour, inMin, inSec] = employee.check_in_time
                    .toString()
                    .split(":")
                    .map(Number);
                const [outHour, outMin, outSec] = employee.check_out_time
                    .toString()
                    .split(":")
                    .map(Number);

                const inTotalMin = inHour * 60 + inMin;
                const outTotalMin = outHour * 60 + outMin;
                workingHoursPerDay = (outTotalMin - inTotalMin) / 60; // Konversi ke jam
            }

                        // Ambil settings tunjangan dari DB
                        const SETTINGS = await getAllowanceSettings();

                        // Hitung hari hadir (check-in) untuk tunjangan harian
            const [presenceResult] = await db.promise().query(
                `SELECT COUNT(DISTINCT date) AS present_days
                 FROM attendance
                 WHERE employee_id = ?
                   AND MONTH(date) = ?
                   AND YEAR(date) = ?
                                     AND status = 'hadir'`,
                [employee_id, period_month, period_year]
            );

            const presentDays = presenceResult[0].present_days || 0;

            // Get attendance summary untuk periode tersebut
            // Potongan ketidakhadiran dihitung dari ALPHA saja
            const [attendanceSummary] = await db.promise().query(
                `
                    SELECT 
                        SUM(CASE WHEN late_minutes > 0 THEN late_minutes ELSE 0 END) as total_late_minutes,
                        COUNT(DISTINCT CASE WHEN status = 'alpha' THEN date END) as total_alpha_days,
                        COUNT(DISTINCT CASE WHEN status = 'sakit' THEN date END) as total_sakit_days,
                        COUNT(DISTINCT CASE WHEN status IN ('izin', 'cuti') THEN date END) as total_izin_days
                    FROM attendance 
                    WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
                    `,
                [employee_id, period_month, period_year]
            );

            const totalLateMinutes =
                attendanceSummary[0].total_late_minutes || 0;
            const totalAlphaDays = attendanceSummary[0].total_alpha_days || 0;
            const totalSakitDays = attendanceSummary[0].total_sakit_days || 0;
            const totalIzinDays = attendanceSummary[0].total_izin_days || 0;
            const totalDeductibleAbsentDays = Number(totalAlphaDays || 0);

            // Hitung tunjangan & potongan tetap
            const transportAllowance = presentDays * SETTINGS.transport_per_day;
            const mealAllowance = presentDays * SETTINGS.meal_per_day;
            const healthAllowance = Number(
                (baseSalary * SETTINGS.health_percentage).toFixed(2)
            );

            const approvedManagerAdjustment = await getEffectiveManagerAdjustment(
                employee_id,
                period_month,
                period_year
            );

            const payloadBonus = Math.round(Number(bonus) || 0);
            const fixedOtherAllowance = resolveFixedOtherAllowance(employee);
            const payloadOtherDeduction = Math.round(Number(other_deduction) || 0);

            const parsedBonus = approvedManagerAdjustment
                ? Number(approvedManagerAdjustment.bonus || 0)
                : payloadBonus;
            const parsedOtherAllowance = fixedOtherAllowance;
            const allowanceTotal =
                transportAllowance +
                mealAllowance +
                healthAllowance +
                parsedBonus +
                parsedOtherAllowance;

            const bpjsDeduction = Number(
                (baseSalary * SETTINGS.bpjs_percentage).toFixed(2)
            );
            const parsedTaxDeduction = Number(tax_deduction) || 0;
            const parsedOtherDeduction = approvedManagerAdjustment
                ? Number(approvedManagerAdjustment.other_deduction || 0)
                : payloadOtherDeduction;

            // Calculate deductions dengan working hours yang sesuai shift
            const lateDeduction = calculateLateDeduction(
                totalLateMinutes,
                baseSalary,
                workingHoursPerDay
            );
            const absentDeduction = calculateAbsentDeduction(
                totalDeductibleAbsentDays,
                baseSalary
            );

                        // Get reimbursements yang siap dimasukkan payroll untuk periode ini
            const [reimbursements] = await db.promise().query(
                `
                    SELECT SUM(amount) as total_reimbursement 
                    FROM reimbursements 
                    WHERE employee_id = ? 
                                            AND status IN ('approved', 'included_in_payroll')
                      AND DATE_FORMAT(created_at, '%Y-%m') = ?
                    `,
                [
                    employee_id,
                    `${period_year}-${String(period_month).padStart(2, "0")}`,
                ]
            );

            const totalReimbursement =
                Number(reimbursements[0]?.total_reimbursement || 0);

            // Hitung komponen gaji
            const grossSalary = baseSalary + allowanceTotal;
            const totalIncome = Number(
                (grossSalary + totalReimbursement).toFixed(2)
            );

            const totalDeduction =
                lateDeduction +
                absentDeduction +
                bpjsDeduction +
                parsedTaxDeduction +
                parsedOtherDeduction;

            const netSalary = totalIncome - totalDeduction;

            // Check if payroll already exists for this employee & period
            const [existingPayroll] = await db
                .promise()
                .query(
                    "SELECT id FROM payrolls WHERE employee_id = ? AND period_month = ? AND period_year = ? AND deleted_at IS NULL",
                    [employee_id, period_month, period_year]
                );

            let payrollId;

            if (existingPayroll.length > 0) {
                // Update existing payroll
                payrollId = existingPayroll[0].id;
                await db.promise().query(
                    `UPDATE payrolls 
                     SET basic_salary = ?, allowance = ?, reimbursement_total = ?, 
                         transport_allowance = ?, meal_allowance = ?, health_allowance = ?, bonus = ?, other_allowance = ?, gross_salary = ?,
                         late_deduction = ?, absent_deduction = ?, bpjs_deduction = ?, tax_deduction = ?, other_deduction = ?, deduction = ?, total_income = ?,
                         total_late_days = 0, total_absent_days = ?, total_sakit_days = ?, total_izin_days = ?, present_days = ?, net_salary = ?
                     WHERE id = ?`,
                    [
                        baseSalary,
                        allowanceTotal,
                        totalReimbursement,
                        transportAllowance,
                        mealAllowance,
                        healthAllowance,
                        parsedBonus,
                        parsedOtherAllowance,
                        grossSalary,
                        lateDeduction,
                        absentDeduction,
                        bpjsDeduction,
                        parsedTaxDeduction,
                        parsedOtherDeduction,
                        totalDeduction,
                        totalIncome,
                        totalDeductibleAbsentDays,
                        totalSakitDays,
                        totalIzinDays,
                        presentDays,
                        netSalary,
                        payrollId,
                    ]
                );
            } else {
                // Create new payroll
                const [result] = await db.promise().query(
                    `INSERT INTO payrolls 
                     (employee_id, period_month, period_year, basic_salary, allowance, transport_allowance, meal_allowance, health_allowance, bonus, other_allowance, gross_salary,
                      reimbursement_total, late_deduction, absent_deduction, bpjs_deduction, tax_deduction, other_deduction, deduction, total_income,
                      total_late_days, total_absent_days, total_sakit_days, total_izin_days, present_days, net_salary, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
                    [
                        employee_id,
                        period_month,
                        period_year,
                        baseSalary,
                        allowanceTotal,
                        transportAllowance,
                        mealAllowance,
                        healthAllowance,
                        parsedBonus,
                        parsedOtherAllowance,
                        grossSalary,
                        totalReimbursement,
                        lateDeduction,
                        absentDeduction,
                        bpjsDeduction,
                        parsedTaxDeduction,
                        parsedOtherDeduction,
                        totalDeduction,
                        totalIncome,
                        0,
                        totalDeductibleAbsentDays,
                        totalSakitDays,
                        totalIzinDays,
                        presentDays,
                        netSalary,
                    ]
                );
                payrollId = result.insertId;
            }

            // Tandai reimbursements sudah dimasukkan ke payroll ini
            await db.promise().query(
                `UPDATE reimbursements 
                 SET status = 'included_in_payroll', payroll_id = ? 
                 WHERE employee_id = ? 
                                     AND status IN ('approved', 'included_in_payroll')
                   AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [
                    payrollId,
                    employee_id,
                    `${period_year}-${String(period_month).padStart(2, "0")}`,
                ]
            );

            // Log payroll generation
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.roles?.[0] || req.user.role,
                action: "CREATE",
                module: "payroll",
                description: `Generated payroll for employee ID: ${employee_id}, Period: ${period_month}/${period_year}`,
                newValues: {
                    employee_id,
                    period_month,
                    period_year,
                    net_salary: netSalary,
                    status: existingPayroll.length > 0 ? "updated" : "created",
                },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.status(200).json({
                message: "Payroll generated successfully",
                payroll_id: payrollId,
                employee: {
                    id: employee.id,
                    name: employee.name,
                },
                period: `${period_month}/${period_year}`,
                details: {
                    basic_salary: baseSalary,
                    present_days: presentDays,
                    allowances: {
                        transport: transportAllowance,
                        meal: mealAllowance,
                        health: healthAllowance,
                        bonus: parsedBonus,
                        other: parsedOtherAllowance,
                        total: allowanceTotal,
                    },
                    manager_adjustment: approvedManagerAdjustment
                        ? {
                              id: approvedManagerAdjustment.id,
                              status: approvedManagerAdjustment.status,
                              notes: approvedManagerAdjustment.notes,
                              applied: true,
                          }
                        : {
                              applied: false,
                          },
                    reimbursement_total: totalReimbursement,
                    income: {
                        gross_salary: grossSalary,
                        total_income: totalIncome,
                    },
                    late_deduction: lateDeduction,
                    absent_deduction: absentDeduction,
                    bpjs_deduction: bpjsDeduction,
                    tax_deduction: parsedTaxDeduction,
                    other_deduction: parsedOtherDeduction,
                    total_deduction: totalDeduction,
                    net_salary: netSalary,
                    attendance_summary: {
                        total_late_minutes: totalLateMinutes,
                        total_alpha_days: totalAlphaDays,
                        total_sakit_days: totalSakitDays,
                        total_izin_days: totalIzinDays,
                        total_deductible_absent_days:
                            totalDeductibleAbsentDays,
                    },
                },
            });
        } catch (error) {
            console.error(error);
            // Log payroll generation error
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.roles?.[0] || req.user.role,
                action: "CREATE",
                module: "payroll",
                description: `Failed to generate payroll for employee ID: ${req.body.employee_id}`,
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
                status: "failed",
                errorMessage: error.message,
            });
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// GET PAYROLL
// ============================
// Daftar payroll (opsional filter bulan/tahun)
router.get(
    "/",
    verifyToken,
    verifyRole(["hr", "admin", "finance"]),
    async (req, res) => {
        try {
            const supportsTransferredAt = await ensureTransferredAtColumn();
            const { month, year } = req.query;

            let query = `
                SELECT p.*,
                       ${supportsTransferredAt
                           ? "CASE WHEN p.transferred_at IS NOT NULL THEN 'transferred' ELSE p.status END"
                           : "p.status"} as payment_status,
                       e.employee_code, u.name as employee_name,
                       wh.shift_name, wh.check_in_time, wh.check_out_time
                FROM payrolls p
                JOIN employees e ON p.employee_id = e.id
                JOIN users u ON e.user_id = u.id
                LEFT JOIN working_hours wh ON e.working_hours_id = wh.id
                WHERE 1=1
                                    AND p.deleted_at IS NULL
            `;
            const params = [];

            if (month && year) {
                query += " AND p.period_month = ? AND p.period_year = ?";
                params.push(month, year);
            }

            query += " ORDER BY p.period_year DESC, p.period_month DESC, u.name ASC";

            const [payrollData] = await db.promise().query(query, params);

            res.status(200).json({
                message: "Payroll list retrieved successfully",
                total: payrollData.length,
                data: payrollData,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// MONTHLY PAYROLL REPORTS (PDF / CSV)
// ============================
router.get(
    "/reports/monthly/pdf",
    verifyToken,
    verifyRole(["finance", "hr", "admin"]),
    async (req, res) => {
        try {
            const month = Number(req.query.month);
            const year = Number(req.query.year);
            if (!month || !year) {
                return res.status(400).json({ message: "month and year are required" });
            }

            const [rows] = await db.promise().query(
                `SELECT p.*, e.employee_code, COALESCE(NULLIF(e.full_name, ''), u.name) as employee_name,
                                pos.name as position_name
                 FROM payrolls p
                 JOIN employees e ON p.employee_id = e.id
                 JOIN users u ON e.user_id = u.id
                 LEFT JOIN positions pos ON e.position_id = pos.id
                 WHERE p.period_month = ? AND p.period_year = ? AND p.deleted_at IS NULL
                 ORDER BY e.employee_code ASC`,
                [month, year]
            );

            const doc = new PDFDocument({ size: "A4", margin: 36 });
            const filename = `laporan-payroll-${month}-${year}.pdf`;
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

            doc.fontSize(16).text("Laporan Payroll Bulanan", { align: "center" });
            doc.moveDown(0.2);
            doc.fontSize(10).text(`Periode: ${month}/${year}`, { align: "center" });
            doc.moveDown(0.6);

            const tableTop = doc.y;
            const itemHeight = 18;

            doc.fontSize(9).fillColor("#000");
            doc.text("No", 36, tableTop, { width: 24, align: "left" });
            doc.text("Kode", 64, tableTop, { width: 72, align: "left" });
            doc.text("Nama", 140, tableTop, { width: 160, align: "left" });
            doc.text("Jabatan", 304, tableTop, { width: 120, align: "left" });
            doc.text("Gaji Pokok", 428, tableTop, { width: 80, align: "right" });
            doc.text("Tunjangan", 512, tableTop, { width: 80, align: "right" });
            doc.text("Total Pot", 596, tableTop, { width: 80, align: "right" });
            doc.text("Net", 680, tableTop, { width: 80, align: "right" });

            let y = tableTop + 16;
            const fmt = (v) => `Rp ${Number(v || 0).toLocaleString("id-ID")}`;

            rows.forEach((r, idx) => {
                if (y > doc.page.height - 72) {
                    doc.addPage();
                    y = 48;
                }

                doc.fontSize(9).fillColor("#222");
                doc.text(String(idx + 1), 36, y, { width: 24, align: "left" });
                doc.text(String(r.employee_code || "-"), 64, y, { width: 72, align: "left" });
                doc.text(String(r.employee_name || "-"), 140, y, { width: 160, align: "left" });
                doc.text(String(r.position_name || "-"), 304, y, { width: 120, align: "left" });
                doc.text(fmt(r.basic_salary), 428, y, { width: 80, align: "right" });
                doc.text(fmt(r.allowance), 512, y, { width: 80, align: "right" });
                doc.text(fmt(r.deduction), 596, y, { width: 80, align: "right" });
                doc.text(fmt(r.final_amount || r.net_salary), 680, y, { width: 80, align: "right" });

                y += itemHeight;
            });

            doc.pipe(res);
            doc.end();
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message || "Server error" });
        }
    }
);

router.get(
    "/reports/monthly/excel",
    verifyToken,
    verifyRole(["finance", "hr", "admin"]),
    async (req, res) => {
        try {
            const month = Number(req.query.month);
            const year = Number(req.query.year);
            if (!month || !year) {
                return res.status(400).json({ message: "month and year are required" });
            }

            const [rows] = await db.promise().query(
                `SELECT p.*, e.employee_code, COALESCE(NULLIF(e.full_name, ''), u.name) as employee_name,
                                pos.name as position_name
                 FROM payrolls p
                 JOIN employees e ON p.employee_id = e.id
                 JOIN users u ON e.user_id = u.id
                 LEFT JOIN positions pos ON e.position_id = pos.id
                 WHERE p.period_month = ? AND p.period_year = ? AND p.deleted_at IS NULL
                 ORDER BY e.employee_code ASC`,
                [month, year]
            );

            const headers = [
                "employee_code",
                "employee_name",
                "position_name",
                "basic_salary",
                "allowance",
                "deduction",
                "net_salary",
            ];

            const csvRows = [];
            csvRows.push(headers.join(","));
            rows.forEach((r) => {
                const vals = [
                    `"${String(r.employee_code || "").replace(/"/g, '""')}"`,
                    `"${String(r.employee_name || "").replace(/"/g, '""')}"`,
                    `"${String(r.position_name || "").replace(/"/g, '""')}"`,
                    Number(r.basic_salary || 0),
                    Number(r.allowance || 0),
                    Number(r.deduction || 0),
                    Number(r.final_amount || r.net_salary || 0),
                ];
                csvRows.push(vals.join(","));
            });

            const csvContent = csvRows.join("\n");
            const filename = `laporan-payroll-${month}-${year}.csv`;
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.send(csvContent);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message || "Server error" });
        }
    }
);

// ============================
// GET PAYROLL PDF
// ============================
// Lihat / unduh slip gaji dalam format PDF
router.get(
    "/:id/pdf",
    verifyToken,
    verifyRole(["hr", "admin", "finance", "pegawai"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const [payrollData] = await db.promise().query(
                `
                    SELECT p.*, e.id as employee_id, e.employee_code,
                           COALESCE(NULLIF(e.full_name, ''), u.name) as full_name,
                           e.nik,
                           d.name as department_name,
                           pos.name as position_name,
                           u.name as employee_name
                    FROM payrolls p
                    JOIN employees e ON p.employee_id = e.id
                    JOIN users u ON e.user_id = u.id
                    LEFT JOIN positions pos ON e.position_id = pos.id
                    LEFT JOIN departments d ON pos.department_id = d.id
                    WHERE p.id = ? AND p.deleted_at IS NULL
                `,
                [id]
            );

            if (payrollData.length === 0) {
                return res.status(404).json({ message: "Payroll not found" });
            }

            const payroll = payrollData[0];
            const userRoles = req.user.roles || [];
            const hasPrivilegedRole =
                userRoles.includes("finance") ||
                userRoles.includes("hr") ||
                userRoles.includes("admin") ||
                ["finance", "hr", "admin"].includes(req.user.role);

            const isPegawaiOnly =
                !hasPrivilegedRole &&
                (userRoles.includes("pegawai") || req.user.role === "pegawai");

            if (isPegawaiOnly) {
                const [userEmployee] = await db
                    .promise()
                    .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

                if (
                    userEmployee.length === 0 ||
                    Number(userEmployee[0].id) !== Number(payroll.employee_id)
                ) {
                    return res.status(403).json({
                        message: "You can only view your own payroll",
                    });
                }
            }

            const filename = `slip-gaji-${payroll.employee_code || payroll.employee_id}-${payroll.period_month}-${payroll.period_year}.pdf`;
            const slipsDir = path.join(__dirname, "..", "uploads", "payroll_slips");
            fs.mkdirSync(slipsDir, { recursive: true });
            const savedPdfPath = path.join(
                slipsDir,
                `payroll-${payroll.id}-${payroll.period_month}-${payroll.period_year}.pdf`
            );

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

            const doc = new PDFDocument({ size: "A4", margin: 48 });
            const fileStream = fs.createWriteStream(savedPdfPath);
            doc.pipe(res);
            doc.pipe(fileStream);

            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const startX = doc.page.margins.left;

            const COLOR_PRIMARY = "#F58220";
            const COLOR_PRIMARY_HOVER = "#FF9F40";
            const COLOR_PRIMARY_SOFT = "#FFB066";
            const COLOR_BACKGROUND = "#FFFFFF";
            const COLOR_SECTION_BG = "#F5F5F5";
            const COLOR_SURFACE = "#FAFAFA";
            const COLOR_BORDER = "#E0E0E0";

            doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR_BACKGROUND);

            doc
                .roundedRect(startX, 40, pageWidth, 76, 10)
                .fill(COLOR_PRIMARY);

            doc
                .fillColor("#ffffff")
                .fontSize(20)
                .text("SLIP GAJI PEGAWAI", startX, 58, {
                    width: pageWidth,
                    align: "center",
                })
                .fontSize(11)
                .text(
                    `Periode ${payroll.period_month}/${payroll.period_year}`,
                    startX,
                    86,
                    {
                        width: pageWidth,
                        align: "center",
                    }
                );

            let y = 132;

            doc
                .roundedRect(startX, y, pageWidth, 122, 8)
                .fill(COLOR_SURFACE);
            doc
                .roundedRect(startX, y, pageWidth, 122, 8)
                .strokeColor(COLOR_BORDER)
                .lineWidth(1)
                .stroke();

            y += 14;
            doc.fillColor(COLOR_PRIMARY).fontSize(12).text("Identitas Pegawai", startX + 14, y);
            y += 22;

            const identityRows = [
                ["Nama Lengkap", payroll.full_name || payroll.employee_name || "-"],
                ["Nomor Pegawai", payroll.employee_code || "-"],
                ["NIK", payroll.nik || "-"],
                ["Departement", payroll.department_name || "-"],
                ["Jabatan", payroll.position_name || "-"],
            ];

            identityRows.forEach(([label, value]) => {
                doc.fillColor("#222222").fontSize(10).text(`${label}`, startX + 14, y, {
                    width: 140,
                    align: "left",
                });
                doc.fillColor("#444444").fontSize(10).text(`: ${value}`, startX + 152, y, {
                    width: pageWidth - 166,
                    align: "left",
                });
                y += 18;
            });

            y = 274;

            doc
                .moveTo(startX, y)
                .lineTo(startX + pageWidth, y)
                .strokeColor(COLOR_BORDER)
                .stroke();
            y += 14;

            doc
                .roundedRect(startX, y - 6, pageWidth, 26, 6)
                .fill(COLOR_SECTION_BG);
            doc.fillColor(COLOR_PRIMARY).fontSize(12).text("Rincian Pendapatan", startX + 10, y);
            y += 18;

            const incomeRows = [
                ["Gaji Pokok", formatCurrency(payroll.basic_salary)],
                ["Transport", formatCurrency(payroll.transport_allowance)],
                ["Makan", formatCurrency(payroll.meal_allowance)],
                ["Tunjangan Kesehatan", formatCurrency(payroll.health_allowance)],
                ["Bonus", formatCurrency(payroll.bonus)],
                ["Tunjangan Lain", formatCurrency(payroll.other_allowance)],
                ["Total Tunjangan", formatCurrency(payroll.allowance)],
                ["Gross Salary", formatCurrency(payroll.gross_salary)],
                ["Reimbursement", formatCurrency(payroll.reimbursement_total)],
                ["Total Income", formatCurrency(payroll.total_income)],
            ];

            incomeRows.forEach(([label, value]) => {
                doc.fontSize(10).fillColor("#333333").text(label, startX + 2, y);
                doc.fontSize(10).fillColor("#111111").text(value, startX + 260, y, {
                    width: pageWidth - 260,
                    align: "right",
                });
                y += 16;
            });

            y += 6;
            doc
                .moveTo(startX, y)
                .lineTo(startX + pageWidth, y)
                .strokeColor(COLOR_BORDER)
                .stroke();
            y += 14;

            doc
                .roundedRect(startX, y - 6, pageWidth, 26, 6)
                .fill(COLOR_SECTION_BG);
            doc.fillColor(COLOR_PRIMARY_HOVER).fontSize(12).text("Rincian Potongan", startX + 10, y);
            y += 18;

            const deductionRows = [
                ["Potongan Telat", formatCurrency(payroll.late_deduction)],
                ["Potongan Alpha", formatCurrency(payroll.absent_deduction)],
                ["Potongan BPJS", formatCurrency(payroll.bpjs_deduction)],
                ["Potongan Pajak", formatCurrency(payroll.tax_deduction)],
                ["Potongan Lain", formatCurrency(payroll.other_deduction)],
                ["Total Potongan", formatCurrency(payroll.deduction)],
            ];

            deductionRows.forEach(([label, value]) => {
                doc.fontSize(10).fillColor("#333333").text(label, startX + 2, y);
                doc.fontSize(10).fillColor("#111111").text(value, startX + 260, y, {
                    width: pageWidth - 260,
                    align: "right",
                });
                y += 16;
            });

            y += 10;
            doc
                .roundedRect(startX, y, pageWidth, 36, 6)
                .fill(COLOR_PRIMARY_SOFT);
            doc
                .roundedRect(startX, y, pageWidth, 36, 6)
                .strokeColor(COLOR_PRIMARY)
                .lineWidth(1)
                .stroke();
            doc
                .fillColor("#1f1f1f")
                .fontSize(12)
                .text("TOTAL GAJI", startX + 12, y + 11);
            doc
                .fillColor("#1f1f1f")
                .fontSize(12)
                .text(formatCurrency(payroll.final_amount || payroll.net_salary), startX + 200, y + 11, {
                    width: pageWidth - 212,
                    align: "right",
                });

            doc.end();
        } catch (error) {
            console.error(error);
            if (!res.headersSent) {
                res.status(500).json({ message: "Server error" });
            }
        }
    }
);

// Lihat detail payroll
router.get(
    "/:id",
    verifyToken,
    verifyRole(["hr", "admin", "finance", "pegawai"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Get payroll data
            const [payrollData] = await db.promise().query(
                `
                    SELECT p.*, e.id as employee_id, e.employee_code, u.name as employee_name,
                           wh.shift_name, wh.check_in_time, wh.check_out_time
                    FROM payrolls p
                    JOIN employees e ON p.employee_id = e.id
                    JOIN users u ON e.user_id = u.id
                    LEFT JOIN working_hours wh ON e.working_hours_id = wh.id
                    WHERE p.id = ? AND p.deleted_at IS NULL
                    `,
                [id]
            );

            if (payrollData.length === 0) {
                return res.status(404).json({ message: "Payroll not found" });
            }

            const payroll = payrollData[0];

            // Jika pegawai, hanya bisa lihat payroll sendiri
            if (req.user.role === "pegawai") {
                const [userEmployee] = await db
                    .promise()
                    .query("SELECT id FROM employees WHERE user_id = ?", [
                        userId,
                    ]);

                if (
                    userEmployee.length === 0 ||
                    userEmployee[0].id !== payroll.employee_id
                ) {
                    return res.status(403).json({
                        message: "You can only view your own payroll",
                    });
                }
            }

            res.status(200).json({
                message: "Payroll data retrieved successfully",
                data: payroll,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// GET PAYROLL BY EMPLOYEE & PERIOD
// ============================
router.get(
    "/employee/:employee_id",
    verifyToken,
    verifyRole(["hr", "admin", "finance", "pegawai"]),
    async (req, res) => {
        try {
            const supportsTransferredAt = await ensureTransferredAtColumn();
            const { employee_id } = req.params;
            const { month, year } = req.query;

            const userRoles = req.user.roles || [];
            const hasPrivilegedRole =
                userRoles.includes("finance") ||
                userRoles.includes("hr") ||
                userRoles.includes("admin") ||
                ["finance", "hr", "admin"].includes(req.user.role);

            if (!hasPrivilegedRole) {
                const [employeeRows] = await db
                    .promise()
                    .query("SELECT id FROM employees WHERE user_id = ?", [req.user.id]);

                if (
                    employeeRows.length === 0 ||
                    Number(employeeRows[0].id) !== Number(employee_id)
                ) {
                    return res.status(403).json({
                        message: "You can only view your own payroll",
                    });
                }
            }

            let query = `
                SELECT p.*, 
                       ${supportsTransferredAt
                           ? "CASE WHEN p.transferred_at IS NOT NULL THEN 'transferred' ELSE p.status END"
                           : "p.status"} as payment_status,
                       COALESCE(p.final_amount, p.net_salary) as take_home_pay,
                       (
                           SELECT COALESCE(SUM(CASE WHEN sa.status = 'approved' THEN sa.expected_amount ELSE 0 END), 0)
                           FROM salary_appeals sa
                           WHERE sa.payroll_id = p.id AND sa.deleted_at IS NULL
                       ) as approved_adjustment_total,
                       (
                           SELECT CASE
                               WHEN SUM(CASE WHEN sa.status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 'pending'
                               WHEN SUM(CASE WHEN sa.status = 'approved' THEN 1 ELSE 0 END) > 0 THEN 'approved'
                               WHEN SUM(CASE WHEN sa.status = 'rejected' THEN 1 ELSE 0 END) > 0 THEN 'rejected'
                               ELSE NULL
                           END
                           FROM salary_appeals sa
                           WHERE sa.payroll_id = p.id AND sa.deleted_at IS NULL
                       ) as computed_appeal_status,
                       e.employee_code, u.name as employee_name,
                       wh.shift_name, wh.check_in_time, wh.check_out_time
                FROM payrolls p
                JOIN employees e ON p.employee_id = e.id
                JOIN users u ON e.user_id = u.id
                LEFT JOIN working_hours wh ON e.working_hours_id = wh.id
                WHERE p.employee_id = ? AND p.deleted_at IS NULL
            `;
            const params = [employee_id];

            if (month && year) {
                query += " AND p.period_month = ? AND p.period_year = ?";
                params.push(month, year);
            }

            query += " ORDER BY p.period_year DESC, p.period_month DESC";

            const [payrollData] = await db.promise().query(query, params);

            const normalizedPayrollData = payrollData.map((item) => {
                const normalizedAppealStatus = item.computed_appeal_status;
                const approvedAdjustmentTotal = Number(
                    item.approved_adjustment_total || 0
                );
                const hasApprovedAppeal = normalizedAppealStatus === "approved";

                const currentFinalAmount = Number(
                    item.final_amount ?? item.net_salary ?? 0
                );
                const previousFinalAmount = Number(
                    (currentFinalAmount - approvedAdjustmentTotal).toFixed(2)
                );

                if (
                    !hasPrivilegedRole &&
                    item.status === "draft" &&
                    hasApprovedAppeal
                ) {
                    return {
                        ...item,
                        final_amount: previousFinalAmount,
                        net_salary: previousFinalAmount,
                        take_home_pay: previousFinalAmount,
                        appeal_status: normalizedAppealStatus,
                        is_revised_appeal: true,
                        comparison_old_amount: previousFinalAmount,
                        comparison_new_amount: currentFinalAmount,
                    };
                }

                if (
                    !hasPrivilegedRole &&
                    hasApprovedAppeal &&
                    ["published", "claimed", "transferred"].includes(String(item.payment_status || item.status || "").toLowerCase())
                ) {
                    return {
                        ...item,
                        take_home_pay: previousFinalAmount,
                        appeal_status: normalizedAppealStatus,
                        is_revised_appeal: true,
                        comparison_old_amount: previousFinalAmount,
                        comparison_new_amount: currentFinalAmount,
                    };
                }

                return {
                    ...item,
                    appeal_status: normalizedAppealStatus,
                    is_revised_appeal: hasApprovedAppeal,
                    comparison_old_amount: hasApprovedAppeal
                        ? previousFinalAmount
                        : Number(item.take_home_pay ?? item.final_amount ?? item.net_salary ?? 0),
                    comparison_new_amount: hasApprovedAppeal
                        ? currentFinalAmount
                        : Number(item.final_amount ?? item.net_salary ?? 0),
                };
            });

            const visiblePayrollData = !hasPrivilegedRole
                ? normalizedPayrollData.filter((item) => {
                      const payrollStatus = String(item.status || "").toLowerCase();
                      const isDraft = payrollStatus === "draft";
                      if (!isDraft) return true;

                      return String(item.appeal_status || "").toLowerCase() === "approved";
                  })
                : normalizedPayrollData;

            res.status(200).json({
                message: "Payroll data retrieved successfully",
                total: visiblePayrollData.length,
                data: visiblePayrollData,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// PUBLISH PAYROLL
// ============================
// HR/Finance mempublikasikan payroll
router.put(
    "/:id/publish",
    verifyToken,
    verifyRole(["hr", "admin", "finance"]),
    async (req, res) => {
        try {
            const supportsTransferredAt = await ensureTransferredAtColumn();
            const { id } = req.params;

            // Check payroll exists
            const [payroll] = await db
                .promise()
                .query("SELECT * FROM payrolls WHERE id = ? AND deleted_at IS NULL", [id]);

            if (payroll.length === 0) {
                return res.status(404).json({ message: "Payroll not found" });
            }

            // Update status to published
            await db
                .promise()
                .query(
                    supportsTransferredAt
                        ? "UPDATE payrolls SET status = 'published', published_at = NOW(), transferred_at = NULL WHERE id = ?"
                        : "UPDATE payrolls SET status = 'published', published_at = NOW() WHERE id = ?",
                    [id]
                );

            res.status(200).json({
                message: "Payroll published successfully",
                id: id,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// TRANSFER PAYROLL
// ============================
// Finance/Admin menandai payroll claimed sudah ditransfer ke rekening pegawai
router.put(
    "/:id/transfer",
    verifyToken,
    verifyRole(["admin", "finance"]),
    async (req, res) => {
        try {
            const supportsTransferredAt = await ensureTransferredAtColumn();
            const { id } = req.params;

            if (!supportsTransferredAt) {
                return res.status(400).json({
                    message:
                        "Kolom transferred_at belum tersedia. Jalankan migration manual: backend/database/migration_payroll_add_transferred_at.sql",
                });
            }

            const [payroll] = await db
                .promise()
                .query("SELECT id, status FROM payrolls WHERE id = ? AND deleted_at IS NULL", [id]);

            if (payroll.length === 0) {
                return res.status(404).json({ message: "Payroll not found" });
            }

            if (payroll[0].status !== "claimed") {
                return res.status(400).json({
                    message: "Payroll harus berstatus claimed sebelum dikirim ke rekening",
                });
            }

            await db
                .promise()
                .query(
                    "UPDATE payrolls SET transferred_at = NOW(), updated_at = NOW() WHERE id = ?",
                    [id]
                );

            res.status(200).json({
                message: "Payroll berhasil ditandai telah dikirim ke rekening",
                id,
                status: "transferred",
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// CLAIM PAYROLL
// ============================
// Pegawai mengklaim payroll yang sudah di-publish
router.put(
    "/:id/claim",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        try {
            const supportsTransferredAt = await ensureTransferredAtColumn();
            const { id } = req.params;
            const userId = req.user.id;

            // Get payroll and check ownership
            const [payroll] = await db.promise().query(
                `
                    SELECT p.*, e.id as employee_id FROM payrolls p
                    JOIN employees e ON p.employee_id = e.id
                    WHERE p.id = ? AND e.user_id = ? AND p.deleted_at IS NULL
                    `,
                [id, userId]
            );

            if (payroll.length === 0) {
                return res.status(404).json({
                    message: "Payroll not found or not yours",
                });
            }

            if (payroll[0].status !== "published") {
                return res.status(400).json({
                    message: "Payroll must be published before claiming",
                });
            }

            // Validasi appeal status real dari tabel salary_appeals (hindari false pending karena data stale)
            const pendingAppealExists = await syncPayrollAppealStatus(id);
            if (pendingAppealExists) {
                return res.status(400).json({
                    message: "Cannot claim payroll with pending salary appeal. Wait for HR review.",
                });
            }

            // Update status to claimed
            await db
                .promise()
                .query(
                    supportsTransferredAt
                        ? "UPDATE payrolls SET status = 'claimed', claimed_at = NOW(), transferred_at = NULL WHERE id = ?"
                        : "UPDATE payrolls SET status = 'claimed', claimed_at = NOW() WHERE id = ?",
                    [id]
                );

            res.status(200).json({
                message: "Payroll claimed successfully",
                id: id,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// DELETE PAYROLL
// ============================
// HR/Admin/Finance menghapus payroll draft
router.delete(
    "/:id",
    verifyToken,
    verifyRole(["hr", "admin", "finance"]),
    async (req, res) => {
        try {
            const { id } = req.params;

            const [payroll] = await db
                .promise()
                .query("SELECT id, status FROM payrolls WHERE id = ? AND deleted_at IS NULL", [id]);

            if (payroll.length === 0) {
                return res.status(404).json({ message: "Payroll not found" });
            }

            if (payroll[0].status !== "draft") {
                return res.status(400).json({
                    message:
                        "Hanya slip berstatus draft yang dapat dihapus",
                });
            }

            await db
                .promise()
                .query(
                    `UPDATE reimbursements
                     SET status = 'approved', payroll_id = NULL
                     WHERE payroll_id = ? AND status = 'included_in_payroll'`,
                    [id]
                );

            await db
                .promise()
                .query(
                    "UPDATE payrolls SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?",
                    [id]
                );

            res.status(200).json({
                message: "Payroll draft berhasil dihapus",
                id,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
