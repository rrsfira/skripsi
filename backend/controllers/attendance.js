// Helper: konversi "HH:mm:ss" ke detik
function timeStringToSeconds(timeStr) {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(":").map(Number);
    return h * 3600 + m * 60 + (s || 0);
}

// Helper: konversi detik ke jam desimal (2 digit)
function secondsToHoursDecimal(seconds) {
    return Math.round((seconds / 3600) * 100) / 100;
}

// Helper: format Date ke yyyy-mm-dd
function formatDateOnly(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// Konstanta jam pulang standar

const STANDARD_CHECK_OUT_TIME = "17:00:00";
const express = require("express");
const router = express.Router();
const db = require("../config/db");
require("dotenv").config();

// ============================
// CRON: AUTO CHECKOUT PEGAWAI YANG BELUM CHECKOUT
// ============================
// Endpoint untuk scheduler harian agar pegawai yang belum checkout otomatis diisi jam 23:59
router.post("/cron/auto-checkout", async (req, res) => {
    module.exports = router;
    try {
        const cronKey = req.headers["x-cron-key"];
        const expectedCronKey = process.env.CRON_SECRET;

        if (!expectedCronKey || cronKey !== expectedCronKey) {
            return res.status(401).json({ message: "Unauthorized cron request" });
        }

        // Default: proses hari kemarin
        const targetDate = req.body?.date
            ? new Date(req.body.date)
            : new Date(Date.now() - 24 * 60 * 60 * 1000);
        targetDate.setHours(0, 0, 0, 0);

        // Hari Minggu diskip
        if (targetDate.getDay() === 0) {
            return res.status(200).json({
                message: "Skipped. Target date is Sunday",
                date: formatDateOnly(targetDate),
                auto_checkout: 0,
            });
        }

        // Ambil semua attendance yang belum checkout
        const dateStr = formatDateOnly(targetDate);
        const [rows] = await db.promise().query(
            `SELECT * FROM attendance WHERE date = ? AND check_in IS NOT NULL AND check_out IS NULL`,
            [dateStr]
        );

        let updatedCount = 0;
        for (const att of rows) {
            // Hitung working_hours dan overtime_hours
            const checkInSeconds = timeStringToSeconds(att.check_in);
            const checkOutSeconds = 23 * 3600 + 59 * 60; // 23:59:00
            const standardWorkingDurationSeconds = 8 * 3600;

            let workingDurationSeconds = checkOutSeconds - checkInSeconds;
            if (workingDurationSeconds < 0) workingDurationSeconds += 24 * 3600;

            let overtimeDurationSeconds =
                workingDurationSeconds - standardWorkingDurationSeconds;
            if (overtimeDurationSeconds < 0) overtimeDurationSeconds = 0;

            const workingHoursDecimal = secondsToHoursDecimal(workingDurationSeconds);
            const overtimeHoursDecimal = secondsToHoursDecimal(overtimeDurationSeconds);

            await db.promise().query(
                `UPDATE attendance SET check_out = ?, working_hours = ?, overtime_hours = ? WHERE id = ?`,
                ["23:59:00", workingHoursDecimal, overtimeHoursDecimal, att.id]
            );
            updatedCount++;
        }

        res.status(200).json({
            message: "Auto-checkout completed",
            date: dateStr,
            auto_checkout: updatedCount,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { resolveManagerScope } = require("../utils/managerScope");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Holidays = require("date-holidays");
const { logActivity, getIpAddress, getUserAgent } = require("../middleware/activityLogger");

const STANDARD_CHECK_IN_TIME = "08:00:00";
// const STANDARD_CHECK_OUT_TIME = "16:00:00"; // Hapus duplikat, gunakan yang di atas
const LATE_TOLERANCE_MINUTES = 60;
const CHECK_IN_START_TIME = "07:00:00";
const CHECK_IN_CUTOFF_TIME = "12:00:00";
const CHECK_OUT_START_TIME = "12:01:00";
const holidayCalendar = new Holidays("ID");
const MANAGER_POSITION_NAMES = [
    "operations manager",
    "marketing & sales manager",
    "finance, accounting & tax manager",
    "hr&ga manager",
    "hr & ga manager",
];

const ALPHA_SANCTION_LEVEL = {
    NONE: "none",
    SP1: "sp1",
    SP2: "sp2",
    SP3: "sp3",
    EVALUASI_HR: "evaluasi_hr",
};

// ============================
// HELPER FUNCTIONS
// ============================

// Function untuk calculate late minutes
const calculateLateMinutes = (checkInTime, standardCheckInTime) => {
    const [checkInHour, checkInMin, checkInSec] = checkInTime
        .split(":")
        .map(Number);
    const [standardHour, standardMin, standardSec] = standardCheckInTime
        .split(":")
        .map(Number);

    const checkInTotalSeconds =
        checkInHour * 3600 + checkInMin * 60 + checkInSec;
    const standardTotalSeconds =
        standardHour * 3600 + standardMin * 60 + standardSec;

    const diffSeconds = checkInTotalSeconds - standardTotalSeconds;

    if (diffSeconds <= 0) return 0;
    return Math.ceil(diffSeconds / 60);
};

const getLatePolicy = (lateMinutes) => {
    const normalizedLateMinutes = Math.max(0, Number(lateMinutes) || 0);
    const isPenalizedLate = normalizedLateMinutes > LATE_TOLERANCE_MINUTES;
    const isToleratedLate =
        normalizedLateMinutes > 0 && normalizedLateMinutes <= LATE_TOLERANCE_MINUTES;

    return {
        late_minutes: normalizedLateMinutes,
        is_tolerated_late: isToleratedLate,
        is_penalized_late: isPenalizedLate,
        late_penalty_days: isPenalizedLate ? 0.5 : 0,
    };
};

const isAtasanRoleActive = (req) =>
    String(req.headers["x-active-role"] || "").toLowerCase() === "atasan";

const shouldScopeAsAtasan = (req) =>
    (req.user.roles || []).includes("atasan") && isAtasanRoleActive(req);

const normalizeText = (value = "") =>
    String(value).toLowerCase().replace(/\s+/g, " ").trim();

const isManagerLevelPosition = (positionName = "") => {
    const normalized = normalizeText(positionName);
    return MANAGER_POSITION_NAMES.includes(normalized);
};

const isDirectorLevelPosition = (positionName = "") => {
    const normalized = normalizeText(positionName);
    return (
        normalized.includes("direktur") ||
        normalized.includes("director") ||
        normalized.includes("direksi") ||
        normalized.includes("ceo") ||
        normalized.includes("owner")
    );
};


// Hapus duplikat deklarasi, gunakan fungsi di bagian atas file

const getHolidayInfo = (dateValue) => {
    const result = holidayCalendar.isHoliday(new Date(dateValue));
    if (!result) return null;
    if (Array.isArray(result)) return result[0] || null;
    return result;
};

const isPublicHoliday = (dateValue) => {
    return !!getHolidayInfo(dateValue);
};

const getHolidayName = (dateValue) => {
    return getHolidayInfo(dateValue)?.name || "Tanggal merah";
};

const mapLeaveTypeToAttendanceStatus = (leaveType) => {
    if (leaveType === "cuti_sakit") return "sakit";
    return "izin";
};

const getCalculatedRemainingLeaveQuota = async (employeeId) => {
    const [quotaResult] = await db
        .promise()
        .query(
            `SELECT
                COALESCE(e.annual_leave_quota, 12) AS annual_leave_quota,
                GREATEST(
                    COALESCE(e.annual_leave_quota, 12)
                    - COALESCE(
                        (
                            SELECT SUM(COALESCE(lr.total_days, 0))
                            FROM leave_requests lr
                            WHERE lr.employee_id = e.id
                              AND lr.status = 'approved'
                              AND lr.leave_type IN ('cuti_tahunan', 'izin')
                        ),
                        0
                    ),
                    0
                ) AS calculated_remaining_leave_quota
             FROM employees e
             WHERE e.id = ?
             LIMIT 1`,
            [employeeId]
        );

    if (!quotaResult.length) {
        return {
            annual_leave_quota: 12,
            calculated_remaining_leave_quota: 0,
        };
    }

    return quotaResult[0];
};

const applyApprovedLeaveEffects = async (leaveRequest) => {
    const startDate = new Date(leaveRequest.start_date);
    const endDate = new Date(leaveRequest.end_date);
    const attendanceStatus = mapLeaveTypeToAttendanceStatus(
        leaveRequest.leave_type
    );

    for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
    ) {
        const dateStr = formatDateOnly(date);
        await db.promise().query(
            `INSERT INTO attendance 
            (employee_id, date, status, notes, created_at) 
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                notes = VALUES(notes)`,
            [
                leaveRequest.employee_id,
                dateStr,
                attendanceStatus,
                `${leaveRequest.leave_type}: ${leaveRequest.reason}`,
            ]
        );
    }

    if (["cuti_tahunan", "izin"].includes(leaveRequest.leave_type)) {
        await db.promise().query(
            `UPDATE employees 
            SET remaining_leave_quota = GREATEST(COALESCE(remaining_leave_quota, 0) - ?, 0) 
            WHERE id = ?`,
            [leaveRequest.total_days, leaveRequest.employee_id]
        );
    }

    await evaluateAlphaDisciplineForEmployee(leaveRequest.employee_id);
};

const ensureAlphaAttendanceRecords = async (employeeId, month, year) => {
    const now = new Date();
    const targetMonth = Number(month) || now.getMonth() + 1;
    const targetYear = Number(year) || now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const lastDateOfMonth = new Date(targetYear, targetMonth, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let endDate = new Date(lastDateOfMonth);
    if (
        targetYear === today.getFullYear() &&
        targetMonth === today.getMonth() + 1
    ) {
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
    }

    if (endDate < startDate) {
        return 0;
    }

    let createdAlphaCount = 0;

    for (
        let cursor = new Date(startDate);
        cursor <= endDate;
        cursor.setDate(cursor.getDate() + 1)
    ) {
        // Hari kerja: Senin-Sabtu (Minggu tidak dihitung)
        if (cursor.getDay() === 0) {
            continue;
        }

        const dateStr = formatDateOnly(cursor);
        const [existingAttendance] = await db
            .promise()
            .query(
                "SELECT id FROM attendance WHERE employee_id = ? AND date = ?",
                [employeeId, dateStr]
            );

        if (existingAttendance.length === 0) {
            if (isPublicHoliday(cursor)) {
                await db.promise().query(
                    `INSERT INTO attendance 
                    (employee_id, date, status, notes, is_late, late_minutes, created_at) 
                    VALUES (?, ?, 'libur', ?, 0, 0, NOW())
                    ON DUPLICATE KEY UPDATE employee_id = employee_id`,
                    [employeeId, dateStr, `Libur: ${getHolidayName(cursor)}`]
                );
                continue;
            }

            const [insertResult] = await db.promise().query(
                `INSERT INTO attendance 
                (employee_id, date, status, is_late, late_minutes, created_at) 
                VALUES (?, ?, 'alpha', 0, 0, NOW())
                ON DUPLICATE KEY UPDATE employee_id = employee_id`,
                [employeeId, dateStr]
            );

            if (insertResult.affectedRows === 1) {
                createdAlphaCount += 1;
            }
        }
    }

    if (createdAlphaCount > 0) {
        await evaluateAlphaDisciplineForEmployee(employeeId);
    }

    return createdAlphaCount;
};

const ensureAlphaAttendanceByDate = async (employeeId, dateObj) => {
    // Hari kerja: Senin-Sabtu (Minggu tidak dihitung)
    if (dateObj.getDay() === 0) {
        return false;
    }

    const dateStr = formatDateOnly(dateObj);
    const [existingAttendance] = await db
        .promise()
        .query("SELECT id FROM attendance WHERE employee_id = ? AND date = ?", [
            employeeId,
            dateStr,
        ]);

    if (existingAttendance.length > 0) {
        return false;
    }

    if (isPublicHoliday(dateObj)) {
        const [insertResult] = await db.promise().query(
            `INSERT INTO attendance 
            (employee_id, date, status, notes, is_late, late_minutes, created_at) 
            VALUES (?, ?, 'libur', ?, 0, 0, NOW())
            ON DUPLICATE KEY UPDATE employee_id = employee_id`,
            [employeeId, dateStr, `Libur: ${getHolidayName(dateObj)}`]
        );
        return insertResult.affectedRows === 1;
    }

    const [insertResult] = await db.promise().query(
        `INSERT INTO attendance 
        (employee_id, date, status, is_late, late_minutes, created_at) 
        VALUES (?, ?, 'alpha', 0, 0, NOW())
        ON DUPLICATE KEY UPDATE employee_id = employee_id`,
        [employeeId, dateStr]
    );

    if (insertResult.affectedRows === 1) {
        await evaluateAlphaDisciplineForEmployee(employeeId);
        return true;
    }

    return false;
};

const getSanctionLevelFromAlphaCounts = ({
    alphaConsecutiveDays,
    alphaAccumulatedDays,
}) => {
    const consecutive = Number(alphaConsecutiveDays || 0);
    const accumulated = Number(alphaAccumulatedDays || 0);

    if (consecutive >= 7) {
        return ALPHA_SANCTION_LEVEL.EVALUASI_HR;
    }

    if (accumulated >= 7) {
        return ALPHA_SANCTION_LEVEL.EVALUASI_HR;
    }

    if (consecutive >= 6 || accumulated >= 6) {
        return ALPHA_SANCTION_LEVEL.SP3;
    }

    if (consecutive >= 5 || accumulated >= 5) {
        return ALPHA_SANCTION_LEVEL.SP2;
    }

    if (consecutive >= 3 || accumulated >= 3) {
        return ALPHA_SANCTION_LEVEL.SP1;
    }

    return ALPHA_SANCTION_LEVEL.NONE;
};

const evaluateAlphaDisciplineForEmployee = async (employeeId) => {
    const [attendanceRows] = await db.promise().query(
        `SELECT status, date
         FROM attendance
         WHERE employee_id = ?
           AND date <= CURDATE()
         ORDER BY date DESC`,
        [employeeId]
    );

    const alphaAccumulatedDays = attendanceRows.reduce((total, row) => {
        return total + (row.status === "alpha" ? 1 : 0);
    }, 0);

    let alphaConsecutiveDays = 0;
    for (const row of attendanceRows) {
        if (row.status === "libur") {
            continue;
        }

        if (row.status === "alpha") {
            alphaConsecutiveDays += 1;
            continue;
        }

        break;
    }

    const sanctionLevel = getSanctionLevelFromAlphaCounts({
        alphaConsecutiveDays,
        alphaAccumulatedDays,
    });

    await db.promise().query(
        `UPDATE employees
         SET alpha_consecutive_days = ?,
             alpha_accumulated_days = ?,
             alpha_sanction_level = ?,
             alpha_last_evaluated_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [
            alphaConsecutiveDays,
            alphaAccumulatedDays,
            sanctionLevel,
            employeeId,
        ]
    );

    return {
        alpha_consecutive_days: alphaConsecutiveDays,
        alpha_accumulated_days: alphaAccumulatedDays,
        alpha_sanction_level: sanctionLevel,
        account_locked: false,
    };
};

// ============================
// MULTER CONFIG (Leave attachment: bukti)
// ============================
const getLeaveUploadSubFolder = (leaveType) => {
    if (leaveType === "izin") {
        return "izin";
    }

    return "cuti";
};

const leaveStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subFolder = getLeaveUploadSubFolder(req.body?.leave_type);
        const targetDir = path.join(__dirname, `../uploads/${subFolder}`);

        fs.mkdirSync(targetDir, { recursive: true });

        req.leaveUploadSubFolder = subFolder;
        req.leaveUploadDir = null;

        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `leave-${uniqueSuffix}${ext}`);
    },
});

const leaveFileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Only PDF/JPG/PNG are allowed for bukti"));
};

const uploadLeave = multer({ storage: leaveStorage, fileFilter: leaveFileFilter });

// Function untuk get working hours berdasarkan employee
const getWorkingHoursByEmployee = async (employeeId) => {
    const [result] = await db
        .promise()
        .query(
            `SELECT wh.* FROM working_hours wh 
             INNER JOIN employees e ON e.working_hours_id = wh.id 
             WHERE e.id = ? LIMIT 1`,
            [employeeId]
        );
    return (
        result[0] || {
            check_in_time: "08:00:00",
            check_out_time: "16:00:00",
            grace_period_minutes: 0,
        }
    );
};

// ============================
// CHECK IN
// ============================
// Pegawai melakukan check in
router.post(
    "/checkin",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const today = formatDateOnly(new Date()); // Format: YYYY-MM-DD (local date)
            const checkInTime = new Date().toTimeString().split(" ")[0]; // Format: HH:MM:SS

            // Cari employee_id berdasarkan user_id
            const [employeeResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            if (employeeResult.length === 0) {
                return res.status(404).json({
                    message: "Employee record not found. Please contact HR.",
                });
            }

            const employeeId = employeeResult[0].id;

            // Cek apakah sudah ada record attendance hari ini
            const [existingAttendance] = await db
                .promise()
                .query(
                    "SELECT * FROM attendance WHERE employee_id = ? AND date = ?",
                    [employeeId, today]
                );

            if (existingAttendance.length > 0) {
                // Jika status hari ini sudah cuti/izin/sakit, check-in tidak diperbolehkan
                if (["izin", "sakit", "libur"].includes(existingAttendance[0].status)) {
                    return res.status(400).json({
                        message:
                            "Status absensi hari ini sudah cuti/izin/sakit/libur. Check-in tidak diperlukan.",
                        status: existingAttendance[0].status,
                        date: today,
                    });
                }

                // Jika sudah check-in hari ini
                if (existingAttendance[0].check_in) {
                    return res.status(400).json({
                        message: "You have already checked in today",
                        check_in: existingAttendance[0].check_in,
                        is_late: existingAttendance[0].is_late,
                        late_minutes: existingAttendance[0].late_minutes,
                    });
                }
            }

            const checkInCutoffSeconds = timeStringToSeconds(CHECK_IN_CUTOFF_TIME);
            const checkInStartSeconds = timeStringToSeconds(CHECK_IN_START_TIME);
            const currentCheckInSeconds = timeStringToSeconds(checkInTime);

            if (isPublicHoliday(new Date())) {
                return res.status(400).json({
                    message: "Hari ini tanggal merah/libur. Check-in tidak diperlukan.",
                    status: "libur",
                    date: today,
                });
            }

            if (currentCheckInSeconds < checkInStartSeconds) {
                return res.status(400).json({
                    message:
                        "Check-in hanya bisa dilakukan mulai pukul 07:00.",
                    start_time: CHECK_IN_START_TIME,
                    check_in_time: checkInTime,
                });
            }

            if (currentCheckInSeconds > checkInCutoffSeconds) {
                return res.status(400).json({
                    message:
                        "Sudah lewat pukul 12:00, check-in tidak diperbolehkan karena sudah terlalu telat.",
                    cutoff_time: CHECK_IN_CUTOFF_TIME,
                    check_in_time: checkInTime,
                });
            }

            // Aturan telat berdasarkan jam kerja tetap: 08:00
            const lateMinutes = calculateLateMinutes(
                checkInTime,
                STANDARD_CHECK_IN_TIME
            );
            const latePolicy = getLatePolicy(lateMinutes);
            const isLate = latePolicy.is_penalized_late;

            // Insert atau update attendance record
            if (existingAttendance.length === 0) {
                // Buat record baru
                await db.promise().query(
                    `INSERT INTO attendance (employee_id, date, check_in, status, is_late, late_minutes, created_at) 
                 VALUES (?, ?, ?, 'hadir', ?, ?, NOW())`,
                    [
                        employeeId,
                        today,
                        checkInTime,
                        isLate ? 1 : 0,
                        lateMinutes,
                    ]
                );
            } else {
                // Update record yang sudah ada
                await db.promise().query(
                    `UPDATE attendance SET check_in = ?, status = 'hadir', is_late = ?, late_minutes = ?
                 WHERE employee_id = ? AND date = ?`,
                    [
                        checkInTime,
                        isLate ? 1 : 0,
                        lateMinutes,
                        employeeId,
                        today,
                    ]
                );
            }

            await evaluateAlphaDisciplineForEmployee(employeeId);
            // Log activity: check-in
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles)
                    ? req.user.roles[0]
                    : req.user.role || null;
                const action = existingAttendance.length === 0 ? "CREATE" : "UPDATE";

                await logActivity({
                    userId,
                    username,
                    role,
                    action,
                    module: "attendance",
                    description: action === "CREATE" ? "Check-in" : "Check-in (update)",
                    oldValues: existingAttendance.length === 0 ? null : existingAttendance[0],
                    newValues: { date: today, check_in: checkInTime, employee_id: employeeId },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log check-in activity:", e);
            }

            res.status(200).json({
                message: isLate
                    ? "Check-in successful but LATE"
                    : "Check-in successful",
                employee_id: employeeId,
                date: today,
                check_in: checkInTime,
                is_late: isLate,
                late_minutes: lateMinutes,
                standard_check_in: STANDARD_CHECK_IN_TIME,
                is_tolerated_late: latePolicy.is_tolerated_late,
                is_penalized_late: latePolicy.is_penalized_late,
                late_penalty_days: latePolicy.late_penalty_days,
            });
        } catch (error) {
            console.error(error);
            try {
                await logActivity({
                    userId: req.user?.id || null,
                    username: req.user?.username || req.user?.name || null,
                    role: Array.isArray(req.user?.roles) ? req.user.roles[0] : req.user?.role || null,
                    action: "CREATE",
                    module: "attendance",
                    description: "Check-in failed",
                    errorMessage: error.message,
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "failed",
                });
            } catch (e) {
                console.error("Failed to log failed check-in activity:", e);
            }

            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// ============================
// CHECK OUT
// ============================
// Pegawai melakukan check out
router.post(
    "/checkout",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const today = formatDateOnly(new Date());
            const checkOutTime = new Date().toTimeString().split(" ")[0];

            // Cari employee_id berdasarkan user_id
            const [employeeResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            if (employeeResult.length === 0) {
                return res.status(404).json({
                    message: "Employee record not found. Please contact HR.",
                });
            }

            const employeeId = employeeResult[0].id;
            // Cek apakah sudah ada record attendance hari ini
            const [existingAttendance] = await db
                .promise()
                .query(
                    "SELECT * FROM attendance WHERE employee_id = ? AND date = ?",
                    [employeeId, today]
                );

            if (existingAttendance.length === 0) {
                if (isPublicHoliday(new Date())) {
                    return res.status(400).json({
                        message:
                            "Hari ini tanggal merah/libur. Check-out tidak diperlukan.",
                        status: "libur",
                        date: today,
                    });
                }

                return res.status(400).json({
                    message:
                        "No check-in record found for today. Please check in first.",
                });
            }

            // Cek apakah sudah check-in
            if (!existingAttendance[0].check_in) {
                if (["izin", "sakit", "libur"].includes(existingAttendance[0].status)) {
                    return res.status(400).json({
                        message:
                            "Status absensi hari ini sudah cuti/izin/sakit/libur. Check-out tidak diperlukan.",
                        status: existingAttendance[0].status,
                        date: today,
                    });
                }

                return res.status(400).json({
                    message: "Please check in first before checking out.",
                });
            }

            // Cek apakah sudah check-out
            if (existingAttendance[0].check_out) {
                return res.status(400).json({
                    message: "You have already checked out today",
                    check_out: existingAttendance[0].check_out,
                });
            }


            const checkOutStartSeconds = timeStringToSeconds(CHECK_OUT_START_TIME);
            const currentCheckOutSeconds = timeStringToSeconds(checkOutTime);
            const checkOutLimitSeconds = 23 * 3600 + 59 * 60 + 59; // 23:59:59
            if (currentCheckOutSeconds < checkOutStartSeconds) {
                return res.status(400).json({
                    message:
                        "Check-out hanya bisa dilakukan setelah pukul 12:01.",
                    start_time: CHECK_OUT_START_TIME,
                    check_out_time: checkOutTime,
                });
            }
            if (currentCheckOutSeconds > checkOutLimitSeconds) {
                return res.status(400).json({
                    message: "Check-out hanya bisa dilakukan maksimal sampai pukul 23:59.",
                    limit_time: "23:59:59",
                    check_out_time: checkOutTime,
                });
            }

            // Calculate working hours & overtime hours
            const checkInSeconds = timeStringToSeconds(
                existingAttendance[0].check_in
            );
            const checkOutSeconds = timeStringToSeconds(checkOutTime);
            const standardWorkingDurationSeconds = 8 * 3600;

            let workingDurationSeconds = checkOutSeconds - checkInSeconds;
            if (workingDurationSeconds < 0) {
                workingDurationSeconds += 24 * 3600;
            }

            let overtimeDurationSeconds =
                workingDurationSeconds - standardWorkingDurationSeconds;
            if (overtimeDurationSeconds < 0) {
                overtimeDurationSeconds = 0;
            }

            const workingHoursDecimal = secondsToHoursDecimal(
                workingDurationSeconds
            );
            const overtimeHoursDecimal = secondsToHoursDecimal(
                overtimeDurationSeconds
            );

            // Update check_out, working_hours, overtime_hours
            await db
                .promise()
                .query(
                    "UPDATE attendance SET check_out = ?, working_hours = ?, overtime_hours = ? WHERE employee_id = ? AND date = ?",
                    [
                        checkOutTime,
                        workingHoursDecimal,
                        overtimeHoursDecimal,
                        employeeId,
                        today,
                    ]
                );
            // Log activity: check-out
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles)
                    ? req.user.roles[0]
                    : req.user.role || null;

                await logActivity({
                    userId,
                    username,
                    role,
                    action: "UPDATE",
                    module: "attendance",
                    description: "Check-out",
                    oldValues: existingAttendance[0],
                    newValues: {
                        date: today,
                        check_out: checkOutTime,
                        working_hours: workingHoursDecimal,
                        overtime_hours: overtimeHoursDecimal,
                    },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log check-out activity:", e);
            }

            res.status(200).json({
                message: "Check-out successful",
                employee_id: employeeId,
                date: today,
                check_in: existingAttendance[0].check_in,
                check_out: checkOutTime,
                is_late: existingAttendance[0].is_late,
                late_minutes: existingAttendance[0].late_minutes,
                working_hours: workingHoursDecimal,
                overtime_hours: overtimeHoursDecimal,
                standard_check_out: STANDARD_CHECK_OUT_TIME,
            });
        } catch (error) {
            console.error(error);
            try {
                await logActivity({
                    userId: req.user?.id || null,
                    username: req.user?.username || req.user?.name || null,
                    role: Array.isArray(req.user?.roles) ? req.user.roles[0] : req.user?.role || null,
                    action: "UPDATE",
                    module: "attendance",
                    description: "Check-out failed",
                    errorMessage: error.message,
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "failed",
                });
            } catch (e) {
                console.error("Failed to log failed check-out activity:", e);
            }

            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// ============================
// GET TODAY'S ATTENDANCE STATUS
// ============================
// Cek status absensi hari ini
router.get("/today", verifyToken, verifyRole(["pegawai"]), async (req, res) => {
    try {
        const userId = req.user.id;
        const today = formatDateOnly(new Date());

        // Cari employee_id berdasarkan user_id
        const [employeeResult] = await db
            .promise()
            .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

        if (employeeResult.length === 0) {
            return res.status(404).json({
                message: "Employee record not found. Please contact HR.",
            });
        }

        const employeeId = employeeResult[0].id;

        // Ambil data attendance hari ini
        const [attendanceResult] = await db
            .promise()
            .query(
                "SELECT * FROM attendance WHERE employee_id = ? AND date = ?",
                [employeeId, today]
            );

        if (attendanceResult.length === 0) {
            if (isPublicHoliday(new Date())) {
                return res.status(200).json({
                    message: "Attendance status for today from holiday",
                    date: today,
                    check_in: null,
                    check_out: null,
                    status: "libur",
                    is_late: false,
                    late_minutes: 0,
                    working_hours: null,
                    overtime_hours: null,
                    is_tolerated_late: false,
                    is_penalized_late: false,
                    late_penalty_days: 0,
                    standard_check_in: STANDARD_CHECK_IN_TIME,
                    standard_check_out: STANDARD_CHECK_OUT_TIME,
                });
            }

            const [activeLeaveResult] = await db
                .promise()
                .query(
                    `SELECT leave_type
                     FROM leave_requests
                     WHERE employee_id = ?
                       AND status = 'approved'
                       AND ? BETWEEN start_date AND end_date
                     ORDER BY approved_at DESC, created_at DESC
                     LIMIT 1`,
                    [employeeId, today]
                );

            if (activeLeaveResult.length > 0) {
                const leaveStatus = mapLeaveTypeToAttendanceStatus(
                    activeLeaveResult[0].leave_type
                );

                return res.status(200).json({
                    message: "Attendance status for today from approved leave",
                    date: today,
                    check_in: null,
                    check_out: null,
                    status: leaveStatus,
                    is_late: false,
                    late_minutes: 0,
                    working_hours: null,
                    overtime_hours: null,
                    is_tolerated_late: false,
                    is_penalized_late: false,
                    late_penalty_days: 0,
                    standard_check_in: STANDARD_CHECK_IN_TIME,
                    standard_check_out: STANDARD_CHECK_OUT_TIME,
                });
            }

            return res.status(200).json({
                message: "No attendance record for today",
                date: today,
                check_in: null,
                check_out: null,
                status: null,
                is_late: false,
                late_minutes: 0,
                working_hours: null,
                overtime_hours: null,
            });
        }

        const attendance = attendanceResult[0];
        const latePolicy = getLatePolicy(attendance.late_minutes);
        res.status(200).json({
            message: "Attendance status for today",
            date: attendance.date,
            check_in: attendance.check_in,
            check_out: attendance.check_out,
            status: attendance.status,
            is_late: attendance.is_late,
            late_minutes: attendance.late_minutes,
            working_hours: attendance.working_hours,
            overtime_hours: attendance.overtime_hours,
            is_tolerated_late: latePolicy.is_tolerated_late,
            is_penalized_late: latePolicy.is_penalized_late,
            late_penalty_days: latePolicy.late_penalty_days,
            standard_check_in: STANDARD_CHECK_IN_TIME,
            standard_check_out: STANDARD_CHECK_OUT_TIME,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// GET MY ATTENDANCE HISTORY
// ============================
// Pegawai melihat riwayat absensi sendiri
router.get(
    "/my-history",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { month, year, status, limit = 30 } = req.query;

            // Cari employee_id berdasarkan user_id
            const [employeeResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            if (employeeResult.length === 0) {
                return res.status(404).json({
                    message: "Employee record not found. Please contact HR.",
                });
            }

            const employeeId = employeeResult[0].id;

            // Auto-generate alpha untuk hari kerja yang belum punya record
            await ensureAlphaAttendanceRecords(employeeId, month, year);

            // Build query dengan filter optional
            let query = "SELECT * FROM attendance WHERE employee_id = ?";
            const params = [employeeId];

            if (month && year) {
                query += " AND MONTH(date) = ? AND YEAR(date) = ?";
                params.push(month, year);
            }

            const validStatuses = ["hadir", "izin", "sakit", "alpha", "libur"];
            if (status && validStatuses.includes(String(status).toLowerCase())) {
                query += " AND status = ?";
                params.push(String(status).toLowerCase());
            }

            query += " ORDER BY date DESC LIMIT ?";
            params.push(parseInt(limit));

            const [attendanceHistory] = await db.promise().query(query, params);

            res.status(200).json({
                message: "Attendance history retrieved successfully",
                total: attendanceHistory.length,
                data: attendanceHistory,
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
// GET ATTENDANCE SUMMARY (Late & Absent Days)
// ============================
// Ringkasan absensi - hari terlambat, tidak hadir, dll
router.get(
    "/my-summary",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { month, year } = req.query;

            // Cari employee_id berdasarkan user_id
            const [employeeResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            if (employeeResult.length === 0) {
                return res.status(404).json({
                    message: "Employee record not found. Please contact HR.",
                });
            }

            const employeeId = employeeResult[0].id;

            // Pastikan alpha otomatis tercatat sebelum summary dihitung
            await ensureAlphaAttendanceRecords(employeeId, month, year);

            // Build query dengan filter optional
            let query = `
                SELECT 
                    COUNT(DISTINCT date) as total_days,
                    COUNT(DISTINCT CASE WHEN late_minutes > 0 AND late_minutes <= 60 THEN date END) as tolerated_late_days,
                    COUNT(DISTINCT CASE WHEN late_minutes > 60 THEN date END) as late_days,
                    (COUNT(DISTINCT CASE WHEN late_minutes > 60 THEN date END) * 0.5) as late_penalty_days,
                    COUNT(DISTINCT CASE WHEN status = 'alpha' THEN date END) as absent_days,
                    COUNT(DISTINCT CASE WHEN status = 'hadir' THEN date END) as present_days,
                    COUNT(DISTINCT CASE WHEN status IN ('izin', 'cuti') THEN date END) as permission_days,
                    COUNT(DISTINCT CASE WHEN status = 'sakit' THEN date END) as sick_days,
                    COUNT(DISTINCT CASE WHEN status = 'libur' THEN date END) as holiday_days,
                    SUM(late_minutes) as total_late_minutes,
                    AVG(working_hours) as avg_working_hours,
                    SUM(COALESCE(overtime_hours, 0)) as total_overtime_hours,
                    AVG(COALESCE(overtime_hours, 0)) as avg_overtime_hours
                FROM attendance 
                WHERE employee_id = ?`;
            const params = [employeeId];

            if (month && year) {
                query += " AND MONTH(date) = ? AND YEAR(date) = ?";
                params.push(month, year);
            }

            const [summary] = await db.promise().query(query, params);

            const summaryData = summary[0] || {};
            const alphaDays = Number(summaryData.absent_days || 0);
            const latePenaltyDays = Number(summaryData.late_penalty_days || 0);
            const disciplineSnapshot = await evaluateAlphaDisciplineForEmployee(
                employeeId
            );

            res.status(200).json({
                message: "Attendance summary retrieved successfully",
                period: month && year ? `${month}/${year}` : "all",
                data: {
                    ...summaryData,
                    alpha_days: alphaDays,
                    effective_absent_days: Number(
                        (alphaDays + latePenaltyDays).toFixed(1)
                    ),
                    alpha_discipline: disciplineSnapshot,
                },
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
// GET ALL EMPLOYEES ATTENDANCE (HR/Atasan/Finance)
// ============================
// HR, Atasan, atau Finance melihat absensi semua pegawai
router.get(
    "/all",
    verifyToken,
    verifyRole(["hr", "atasan", "finance"]),
    async (req, res) => {
        try {
            const { date, month, year, employee_id } = req.query;
            let managerScope = null;

            if (shouldScopeAsAtasan(req)) {
                managerScope = await resolveManagerScope(db, req.user.id);
            }

            let query = `
            SELECT a.*, e.employee_code, u.name as employee_name, p.department_id
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            JOIN positions p ON e.position_id = p.id
            JOIN users u ON e.user_id = u.id
            WHERE 1=1
        `;
            const params = [];

            if (date) {
                query += " AND a.date = ?";
                params.push(date);
            }

            if (month && year) {
                query += " AND MONTH(a.date) = ? AND YEAR(a.date) = ?";
                params.push(month, year);
            }

            if (employee_id) {
                query += " AND a.employee_id = ?";
                params.push(employee_id);
            }

            if (managerScope) {
                if (managerScope.isDirector) {
                    query += " AND p.level = 'manager' AND e.id <> ?";
                    params.push(managerScope.managerEmployeeId);
                } else {
                    query += " AND p.department_id = ? AND e.id <> ?";
                    params.push(
                        managerScope.departmentId,
                        managerScope.managerEmployeeId
                    );
                }
            }

            query += " ORDER BY a.date DESC, u.name ASC";

            const [attendanceData] = await db.promise().query(query, params);

            res.status(200).json({
                message: "Attendance data retrieved successfully",
                total: attendanceData.length,
                data: attendanceData,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// GET TEAM MEMBERS (HR/Atasan/Finance)
// ============================
router.get(
    "/team-members",
    verifyToken,
    verifyRole(["hr", "atasan", "finance"]),
    async (req, res) => {
        try {
            let managerScope = null;

            if (shouldScopeAsAtasan(req)) {
                managerScope = await resolveManagerScope(db, req.user.id);
            }

            let query = `
                SELECT e.id as employee_id, e.employee_code, u.name as employee_name, p.department_id
                FROM employees e
                JOIN positions p ON e.position_id = p.id
                JOIN users u ON e.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (managerScope) {
                if (managerScope.isDirector) {
                    query += " AND p.level = 'manager' AND e.id <> ?";
                    params.push(managerScope.managerEmployeeId);
                } else {
                    query += " AND p.department_id = ? AND e.id <> ?";
                    params.push(
                        managerScope.departmentId,
                        managerScope.managerEmployeeId
                    );
                }
            }

            query += " ORDER BY u.name ASC";

            const [teamMembers] = await db.promise().query(query, params);

            res.status(200).json({
                message: "Team members retrieved successfully",
                total: teamMembers.length,
                data: teamMembers,
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
// GET ATTENDANCE SUMMARY FOR ALL EMPLOYEES (HR/Finance)
// ============================
// Ringkasan absensi semua pegawai per bulan
router.get(
    "/summary/all",
    verifyToken,
    verifyRole(["hr", "finance"]),
    async (req, res) => {
        try {
            const { month, year } = req.query;

            // Pastikan hari kerja yang belum memiliki absensi ditandai alpha
            // agar ringkasan payroll finance akurat (terutama untuk alpha/present).
            if (month && year) {
                const [employees] = await db
                    .promise()
                    .query("SELECT id FROM employees");

                for (const employee of employees) {
                    await ensureAlphaAttendanceRecords(
                        employee.id,
                        Number(month),
                        Number(year)
                    );
                }
            }

            let query = `
                SELECT 
                    e.id as employee_id,
                    e.employee_code,
                    u.name as employee_name,
                    e.alpha_consecutive_days,
                    e.alpha_accumulated_days,
                    e.alpha_sanction_level,
                    e.alpha_last_evaluated_at,
                    COUNT(DISTINCT a.date) as total_days,
                    COUNT(DISTINCT CASE WHEN a.late_minutes > 0 AND a.late_minutes <= 60 THEN a.date END) as tolerated_late_days,
                    COUNT(DISTINCT CASE WHEN a.late_minutes > 60 THEN a.date END) as late_days,
                    (COUNT(DISTINCT CASE WHEN a.late_minutes > 60 THEN a.date END) * 0.5) as late_penalty_days,
                    COUNT(DISTINCT CASE WHEN a.status = 'alpha' THEN a.date END) as absent_days,
                    COUNT(DISTINCT CASE WHEN a.status = 'hadir' THEN a.date END) as present_days,
                    COUNT(DISTINCT CASE WHEN a.status IN ('izin', 'cuti') THEN a.date END) as permission_days,
                    COUNT(DISTINCT CASE WHEN a.status = 'sakit' THEN a.date END) as sick_days,
                    COUNT(DISTINCT CASE WHEN a.status = 'libur' THEN a.date END) as holiday_days,
                    SUM(COALESCE(a.late_minutes, 0)) as total_late_minutes,
                    AVG(a.working_hours) as avg_working_hours,
                    SUM(COALESCE(a.overtime_hours, 0)) as total_overtime_hours,
                    AVG(COALESCE(a.overtime_hours, 0)) as avg_overtime_hours
                FROM employees e
                JOIN users u ON e.user_id = u.id
                LEFT JOIN attendance a ON a.employee_id = e.id`;

            const params = [];

            if (month && year) {
                query += " AND MONTH(a.date) = ? AND YEAR(a.date) = ?";
                params.push(month, year);
            }

            query +=
                " GROUP BY e.id, e.employee_code, u.name ORDER BY u.name ASC";

            const [summaryData] = await db.promise().query(query, params);

            const mappedSummaryData = summaryData.map((row) => {
                const alphaDays = Number(row.absent_days || 0);
                const latePenaltyDays = Number(row.late_penalty_days || 0);
                return {
                    ...row,
                    alpha_days: alphaDays,
                    effective_absent_days: Number(
                        (alphaDays + latePenaltyDays).toFixed(1)
                    ),
                };
            });

            res.status(200).json({
                message:
                    "Attendance summary for all employees retrieved successfully",
                period: month && year ? `${month}/${year}` : "all",
                total_employees: mappedSummaryData.length,
                data: mappedSummaryData,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// UPDATE ATTENDANCE STATUS (HR/Atasan/Finance)
// ============================
// HR, Atasan, atau Finance mengubah status absensi (misal: izin, sakit, alpha)
router.put(
    "/:id/status",
    verifyToken,
    verifyRole(["hr", "atasan", "finance"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            let managerScope = null;

            if (shouldScopeAsAtasan(req)) {
                managerScope = await resolveManagerScope(db, req.user.id);
            }

            const validStatuses = ["hadir", "izin", "sakit", "alpha", "libur"];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                    message:
                        "Invalid status. Valid statuses: hadir, izin, sakit, alpha, libur",
                });
            }

            // Cek apakah attendance record ada
            const [existingAttendance] = await db
                .promise()
                .query("SELECT * FROM attendance WHERE id = ?", [id]);

            if (existingAttendance.length === 0) {
                return res
                    .status(404)
                    .json({ message: "Attendance record not found" });
            }

            if (managerScope) {
                let attendanceDeptClause = 'p.department_id = ? AND e.id <> ?';
                const attendanceParams = [managerScope.departmentId, managerScope.managerEmployeeId];
                if (managerScope.isDirector) {
                    attendanceDeptClause = "p.level = 'manager' AND e.id <> ?";
                    attendanceParams.splice(0, attendanceParams.length, managerScope.managerEmployeeId);
                }

                const [attendanceScope] = await db.promise().query(
                    `SELECT a.id
                     FROM attendance a
                     JOIN employees e ON a.employee_id = e.id
                     JOIN positions p ON e.position_id = p.id
                     WHERE a.id = ?
                       AND ${attendanceDeptClause}`,
                    [id, ...attendanceParams]
                );

                if (!attendanceScope.length) {
                    return res.status(403).json({
                        message:
                            managerScope.isDirector
                                ? "Direktur dapat mengubah status absensi tim manajer."
                                : "Atasan hanya dapat mengubah status absensi tim dalam departemen yang dipimpin",
                    });
                }
            }

            if (status === "alpha" && !existingAttendance[0].check_in) {
                return res.status(400).json({
                    message:
                        "Status alpha tidak bisa diberikan karena belum ada check-in.",
                });
            }

            const isAdminOrAtasanUpdatingHadir =
                (shouldScopeAsAtasan(req) || (req.user.roles || []).includes("admin")) && status === "hadir";

            if (isAdminOrAtasanUpdatingHadir) {
                const recordDate = new Date(existingAttendance[0].date);
                recordDate.setHours(0, 0, 0, 0);

                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);

                const isTodayRecord =
                    recordDate.getTime() === todayDate.getTime();
                const isPastRecord =
                    recordDate.getTime() < todayDate.getTime();

                if (isPastRecord) {
                    await db.promise().query(
                        `UPDATE attendance
                         SET status = ?,
                             check_in = ?,
                             check_out = ?,
                             working_hours = ?,
                             overtime_hours = ?,
                             is_late = ?,
                             late_minutes = ?
                         WHERE id = ?`,
                        [
                            status,
                            STANDARD_CHECK_IN_TIME,
                            STANDARD_CHECK_OUT_TIME,
                            8,
                            0,
                            0,
                            0,
                            id,
                        ]
                    );
                } else if (isTodayRecord) {
                    await db.promise().query(
                        `UPDATE attendance
                         SET status = ?,
                             check_in = ?,
                             check_out = NULL,
                             working_hours = NULL,
                             overtime_hours = NULL,
                             is_late = ?,
                             late_minutes = ?
                         WHERE id = ?`,
                        [status, STANDARD_CHECK_IN_TIME, 0, 0, id]
                    );
                } else {
                    await db
                        .promise()
                        .query("UPDATE attendance SET status = ? WHERE id = ?", [
                            status,
                            id,
                        ]);
                }
            } else {
                await db
                    .promise()
                    .query("UPDATE attendance SET status = ? WHERE id = ?", [
                        status,
                        id,
                    ]);
            }

            await evaluateAlphaDisciplineForEmployee(
                existingAttendance[0].employee_id
            );

            // Log activity: update attendance status by admin/atasan/hr/finance
            try {
                console.log('[DEBUG] Attempting activity log for attendance status update', {
                    reqUser: req.user,
                    attendanceId: id,
                    newStatus: status,
                })
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles)
                    ? req.user.roles[0]
                    : req.user.role || null;

                await logActivity({
                    userId: req.user.id,
                    username,
                    role,
                    action: "UPDATE",
                    module: "attendance",
                    description: `Attendance status updated to ${status}`,
                    oldValues: existingAttendance[0],
                    newValues: { id, status },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log attendance status update:", e);
            }

            res.status(200).json({
                message: "Attendance status updated successfully",
                id: id,
                status: status,
            });
        } catch (error) {
            console.error(error);
            try {
                await logActivity({
                    userId: req.user?.id || null,
                    username: req.user?.username || req.user?.name || null,
                    role: Array.isArray(req.user?.roles) ? req.user.roles[0] : req.user?.role || null,
                    action: "UPDATE",
                    module: "attendance",
                    description: "Attendance status update failed",
                    errorMessage: error.message,
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "failed",
                });
            } catch (e) {
                console.error("Failed to log failed attendance status update:", e);
            }
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// CRON: GENERATE DAILY ALPHA (ALL EMPLOYEES)
// ============================
// Endpoint untuk scheduler harian agar alpha tercatat tanpa menunggu user buka halaman
router.post("/cron/generate-alpha", async (req, res) => {
    try {
        const cronKey = req.headers["x-cron-key"];
        const expectedCronKey = process.env.CRON_SECRET;

        if (!expectedCronKey || cronKey !== expectedCronKey) {
            return res.status(401).json({ message: "Unauthorized cron request" });
        }

        const targetDate = req.body?.date
            ? new Date(req.body.date)
            : new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (Number.isNaN(targetDate.getTime())) {
            return res.status(400).json({
                message: "Invalid date format. Use YYYY-MM-DD",
            });
        }

        targetDate.setHours(0, 0, 0, 0);

        // Hari Minggu diskip
        if (targetDate.getDay() === 0) {
            return res.status(200).json({
                message: "Skipped. Target date is Sunday",
                date: formatDateOnly(targetDate),
                generated_alpha: 0,
            });
        }

        const [employees] = await db
            .promise()
            .query("SELECT id FROM employees");

        let generatedAlphaCount = 0;
        for (const employee of employees) {
            const inserted = await ensureAlphaAttendanceByDate(
                employee.id,
                targetDate
            );
            if (inserted) {
                generatedAlphaCount += 1;
            }
        }

        return res.status(200).json({
            message: "Daily alpha generation completed",
            date: formatDateOnly(targetDate),
            total_employees: employees.length,
            generated_alpha: generatedAlphaCount,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
});

// ============================
// SUBMIT LEAVE REQUEST (Pegawai)
// ============================
// Pegawai/Admin/Direktur submit cuti/izin/sakit
router.post(
    "/leave-request",
    verifyToken,
    verifyRole(["pegawai", "admin", "direktur"]),
    uploadLeave.single("bukti"),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { leave_type, start_date, end_date, reason } = req.body;

            // Validasi input
            if (!leave_type || !start_date || !end_date || !reason) {
                return res.status(400).json({
                    message:
                        "leave_type, start_date, end_date, and reason are required",
                });
            }
                // Path bukti (optional) jika diupload
                const buktiPath = req.file
                    ? `uploads/${req.leaveUploadSubFolder || "cuti"}/${req.file.filename}`
                    : null;


            // Validasi leave_type
            const validLeaveTypes = [
                "cuti_tahunan",
                "cuti_sakit",
                "cuti_melahirkan",
                "izin",
            ];
            if (!validLeaveTypes.includes(leave_type)) {
                return res.status(400).json({
                    message:
                        "Invalid leave_type. Valid types: cuti_tahunan, cuti_sakit, cuti_melahirkan, izin",
                });
            }

            // Cari employee_id berdasarkan user_id
            const [employeeResult] = await db.promise().query(
                `SELECT e.id, e.annual_leave_quota, e.remaining_leave_quota, p.name AS position_name
                 FROM employees e
                 LEFT JOIN positions p ON e.position_id = p.id
                 WHERE e.user_id = ?`,
                [userId]
            );

            if (employeeResult.length === 0) {
                return res.status(404).json({
                    message: "Employee record not found. Please contact HR.",
                });
            }

            const employeeId = employeeResult[0].id;
            const quotaSummary = await getCalculatedRemainingLeaveQuota(employeeId);
            const remainingQuota = Number(
                quotaSummary.calculated_remaining_leave_quota || 0
            );
            const requesterPositionName = employeeResult[0].position_name || "";
            const requesterRoles = req.user.roles || [];
            const requesterIsDirector =
                requesterRoles.includes("direktur") ||
                isDirectorLevelPosition(requesterPositionName);
            const shouldAutoApprove =
                requesterRoles.includes("admin") || requesterIsDirector;

            // Hitung total hari
            const startDateObj = new Date(start_date);
            const endDateObj = new Date(end_date);
            const diffTime = Math.abs(endDateObj - startDateObj);
            const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Validasi kuota cuti untuk cuti_tahunan
            if (["cuti_tahunan"].includes(leave_type)) {
                if (totalDays > remainingQuota) {
                    return res.status(400).json({
                        message: `Insufficient leave quota. You have ${remainingQuota} days remaining, but requested ${totalDays} days.`,
                        remaining_quota: remainingQuota,
                        requested_days: totalDays,
                    });
                }
            }

            let result;
            let status = "pending";

            if (shouldAutoApprove) {
                status = "approved";
                const autoApprovedBy = requesterIsDirector
                    ? null
                    : employeeId;
                [result] = await db.promise().query(
                    `INSERT INTO leave_requests 
                    (employee_id, leave_type, start_date, end_date, total_days, reason, bukti, status, approved_by, approved_at, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW(), NOW())`,
                    [
                        employeeId,
                        leave_type,
                        start_date,
                        end_date,
                        totalDays,
                        reason,
                        buktiPath,
                        autoApprovedBy,
                    ]
                );

                await applyApprovedLeaveEffects({
                    employee_id: employeeId,
                    leave_type,
                    start_date,
                    end_date,
                    total_days: totalDays,
                    reason,
                });
                // Log activity: auto-approved leave request
                try {
                    const username = req.user.username || req.user.name || null;
                    const role = Array.isArray(req.user.roles)
                        ? req.user.roles[0]
                        : req.user.role || null;
                    await logActivity({
                        userId,
                        username,
                        role,
                        action: "CREATE",
                        module: "leave_requests",
                        description: "Leave request auto-approved",
                        oldValues: null,
                        newValues: {
                            request_id: result.insertId,
                            employee_id: employeeId,
                            leave_type,
                            start_date,
                            end_date,
                            total_days: totalDays,
                            status: "approved",
                        },
                        ipAddress: getIpAddress(req),
                        userAgent: getUserAgent(req),
                        status: "success",
                    });
                } catch (e) {
                    console.error("Failed to log auto-approved leave request:", e);
                }
            } else {
                [result] = await db.promise().query(
                    `INSERT INTO leave_requests 
                    (employee_id, leave_type, start_date, end_date, total_days, reason, bukti, status, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
                    [
                        employeeId,
                        leave_type,
                        start_date,
                        end_date,
                        totalDays,
                        reason,
                        buktiPath,
                    ]
                );
            }

            res.status(201).json({
                message: shouldAutoApprove
                    ? "Leave request auto-approved successfully"
                    : "Leave request submitted successfully",
                request_id: result.insertId,
                leave_type,
                start_date,
                end_date,
                total_days: totalDays,
                status,
            });
            // Log activity: leave request submitted (pending)
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles)
                    ? req.user.roles[0]
                    : req.user.role || null;
                await logActivity({
                    userId,
                    username,
                    role,
                    action: "CREATE",
                    module: "leave_requests",
                    description: shouldAutoApprove ? "Leave request auto-approved" : "Leave request submitted",
                    oldValues: null,
                    newValues: {
                        request_id: result.insertId,
                        employee_id: employeeId,
                        leave_type,
                        start_date,
                        end_date,
                        total_days: totalDays,
                        status,
                    },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log leave request submission:", e);
            }
        } catch (error) {
            console.error(error);
            try {
                await logActivity({
                    userId: req.user?.id || null,
                    username: req.user?.username || req.user?.name || null,
                    role: Array.isArray(req.user?.roles) ? req.user.roles[0] : req.user?.role || null,
                    action: "CREATE",
                    module: "leave_requests",
                    description: "Leave request submission failed",
                    errorMessage: error.message,
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "failed",
                });
            } catch (e) {
                console.error("Failed to log failed leave request submission:", e);
            }

            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// GET MY LEAVE REQUESTS (Pegawai)
// ============================
// Pegawai/Admin/Direktur melihat leave request sendiri
router.get(
    "/my-leave-requests",
    verifyToken,
    verifyRole(["pegawai", "admin", "direktur"]),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { status } = req.query;

            // Cari employee_id berdasarkan user_id
            const [employeeResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            if (employeeResult.length === 0) {
                return res.status(404).json({
                    message: "Employee record not found. Please contact HR.",
                });
            }

            const employeeId = employeeResult[0].id;

            // Build query
            let query = `
                SELECT lr.*, 
                       u_approver.name as approved_by_name
                FROM leave_requests lr
                LEFT JOIN employees e_approver ON lr.approved_by = e_approver.id
                LEFT JOIN users u_approver ON e_approver.user_id = u_approver.id
                WHERE lr.employee_id = ?
            `;
            const params = [employeeId];

            if (status) {
                query += " AND lr.status = ?";
                params.push(status);
            }

            query += " ORDER BY lr.created_at DESC";

            const [leaveRequests] = await db.promise().query(query, params);

            res.status(200).json({
                message: "Leave requests retrieved successfully",
                total: leaveRequests.length,
                data: leaveRequests,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// GET ALL LEAVE REQUESTS (HR/Atasan/Admin)
// ============================
// HR/Atasan melihat semua leave request
router.get(
    "/leave-requests",
    verifyToken,
    verifyRole(["hr", "atasan", "admin", "commissioner"]),
    async (req, res) => {
        try {
            const { status, employee_id, leave_type } = req.query;
            const forceHrAllScope = req.query.scope === "hr_all";
            const requesterRoles = req.user.roles || [];
            const adminDirecturScopeToAtasan =
                !forceHrAllScope &&
                requesterRoles.includes("admin") &&
                !requesterRoles.includes("hr");
            let managerScope = null;

            if (!forceHrAllScope && shouldScopeAsAtasan(req)) {
                managerScope = await resolveManagerScope(db, req.user.id);
            }

            // Build query
            let query = `
                SELECT lr.*, 
                       e.employee_code,
                       p.department_id,
                       u.name as employee_name,
                       u_approver.name as approved_by_name
                FROM leave_requests lr
                JOIN employees e ON lr.employee_id = e.id
                LEFT JOIN positions p ON e.position_id = p.id
                JOIN users u ON e.user_id = u.id
                LEFT JOIN employees e_approver ON lr.approved_by = e_approver.id
                LEFT JOIN users u_approver ON e_approver.user_id = u_approver.id
                WHERE 1=1
            `;
            const params = [];

            if (status) {
                query += " AND lr.status = ?";
                params.push(status);
            }

            if (employee_id) {
                query += " AND lr.employee_id = ?";
                params.push(employee_id);
            }

            if (leave_type) {
                query += " AND lr.leave_type = ?";
                params.push(leave_type);
            }

            if (adminDirecturScopeToAtasan) {
                query += `
                    AND EXISTS (
                        SELECT 1
                        FROM user_roles ur_req
                        JOIN roles r_req ON r_req.id = ur_req.role_id
                        WHERE ur_req.user_id = e.user_id
                          AND r_req.name = 'atasan'
                    )
                `;
            }

            if (managerScope) {
                if (managerScope.isDirector) {
                    query += " AND p.level = 'manager' AND e.id <> ?";
                    params.push(managerScope.managerEmployeeId);
                } else {
                    query += " AND p.department_id = ? AND e.id <> ?";
                    params.push(
                        managerScope.departmentId,
                        managerScope.managerEmployeeId
                    );
                }
            }

            query += " ORDER BY lr.created_at DESC";

            const [leaveRequests] = await db.promise().query(query, params);

            res.status(200).json({
                message: "Leave requests retrieved successfully",
                total: leaveRequests.length,
                data: leaveRequests,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// APPROVE/REJECT LEAVE REQUEST (HR/Atasan)
// ============================
// HR/Atasan approve atau reject leave request
router.put(
    "/leave-request/:id",
    verifyToken,
    verifyRole(["hr", "atasan", "admin", "commissioner"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const userId = req.user.id;
            const requesterRoles = req.user.roles || [];
            const adminDirecturScopeToAtasan =
                requesterRoles.includes("admin") &&
                !requesterRoles.includes("hr");
            let managerScope = null;

            if (shouldScopeAsAtasan(req)) {
                managerScope = await resolveManagerScope(db, userId);
            }

            // Validasi status
            if (!status || !["approved", "rejected"].includes(status)) {
                return res.status(400).json({
                    message:
                        "Invalid status. Valid statuses: approved, rejected",
                });
            }

            // Cek apakah leave request ada
            const [leaveRequestResult] = await db
                .promise()
                .query("SELECT * FROM leave_requests WHERE id = ?", [id]);

            if (leaveRequestResult.length === 0) {
                return res.status(404).json({
                    message: "Leave request not found",
                });
            }

            const leaveRequest = leaveRequestResult[0];

            if (adminDirecturScopeToAtasan) {
                const [atasanRoleResult] = await db.promise().query(
                    `SELECT e.id
                     FROM employees e
                     JOIN user_roles ur ON ur.user_id = e.user_id
                     JOIN roles r ON r.id = ur.role_id
                     WHERE e.id = ?
                       AND r.name = 'atasan'
                     LIMIT 1`,
                    [leaveRequest.employee_id]
                );

                if (!atasanRoleResult.length) {
                    return res.status(403).json({
                        message:
                            "Direktur/Admin hanya dapat memproses pengajuan cuti/izin milik atasan.",
                    });
                }
            }

            const [requesterPositionResult] = await db.promise().query(
                `SELECT p.name AS position_name
                 FROM employees e
                 LEFT JOIN positions p ON e.position_id = p.id
                 WHERE e.id = ?
                 LIMIT 1`,
                [leaveRequest.employee_id]
            );

            const requesterPositionName =
                requesterPositionResult[0]?.position_name || "";
            const requesterIsDirector =
                isDirectorLevelPosition(requesterPositionName);
            const requesterIsManager =
                isManagerLevelPosition(requesterPositionName);
            const approverIsDirector = (req.user.roles || []).includes("admin");

            if (requesterIsManager && !requesterIsDirector && !approverIsDirector) {
                return res.status(403).json({
                    message:
                        "Pengajuan cuti/izin untuk level manajer hanya dapat diproses oleh Direktur.",
                });
            }

            if (managerScope) {
                let leaveDeptClause = 'p.department_id = ? AND e.id <> ?';
                const leaveParams = [managerScope.departmentId, managerScope.managerEmployeeId];
                if (managerScope.isDirector) {
                    leaveDeptClause = "p.level = 'manager' AND e.id <> ?";
                    leaveParams.splice(0, leaveParams.length, managerScope.managerEmployeeId);
                }

                const [leaveScope] = await db.promise().query(
                    `SELECT lr.id
                     FROM leave_requests lr
                     JOIN employees e ON lr.employee_id = e.id
                     JOIN positions p ON e.position_id = p.id
                     WHERE lr.id = ?
                       AND ${leaveDeptClause}`,
                    [id, ...leaveParams]
                );

                if (!leaveScope.length) {
                    return res.status(403).json({
                        message:
                            managerScope.isDirector
                                ? "Direktur dapat memproses cuti/izin untuk pegawai level manager di departemen mana pun"
                                : "Atasan hanya dapat memproses cuti/izin tim dalam departemen yang dipimpin",
                    });
                }
            }

            // Cek jika sudah di-approve/reject
            if (leaveRequest.status !== "pending") {
                return res.status(400).json({
                    message: `Leave request already ${leaveRequest.status}`,
                });
            }

            // Cari employee_id dari user yang approve
            const [approverResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            const approverId =
                approverResult.length > 0 ? approverResult[0].id : null;

            // Update status leave request
            await db.promise().query(
                `UPDATE leave_requests 
                SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() 
                WHERE id = ?`,
                [status, approverId, id]
            );

            // Jika approved, create attendance records untuk setiap hari
            if (status === "approved") {
                await applyApprovedLeaveEffects(leaveRequest);
            }

            // Log activity: approve/reject leave request
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles)
                    ? req.user.roles[0]
                    : req.user.role || null;

                await logActivity({
                    userId,
                    username,
                    role,
                    action: "UPDATE",
                    module: "leave_requests",
                    description: status === "approved" ? "Leave request approved" : "Leave request rejected",
                    oldValues: leaveRequest,
                    newValues: { request_id: id, status, approved_by: approverId },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log leave request approval/rejection:", e);
            }

            res.status(200).json({
                message: `Leave request ${status} successfully`,
                request_id: id,
                status: status,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
