const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

// ============================
// HR Dashboard
// ============================
router.get("/", verifyToken, verifyRole(["hr"]), async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const requesterUserId = Number(req.user?.id || req.user?.user_id || 0);

        // 1. Employee Overview
        const [employeeStats] = await db.promise().query(`
            SELECT 
                COUNT(*) as total_employees,
                SUM(CASE WHEN employment_status = 'permanent' THEN 1 ELSE 0 END) as permanent,
                SUM(CASE WHEN employment_status = 'contract' THEN 1 ELSE 0 END) as contract,
                SUM(CASE WHEN employment_status = 'intern' THEN 1 ELSE 0 END) as intern
            FROM employees
        `);

        // 2. Attendance Status Today
        const [attendanceToday] = await db.promise().query(
            `SELECT 
                COUNT(DISTINCT employee_id) as present,
                SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late,
                SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) as sakit,
                SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END) as izin,
                SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as alpha
            FROM attendance 
            WHERE date = ?`,
            [today]
        );

        // 3. Leave Requests Management
        const [leaveStats] = await db.promise().query(
            `
            SELECT 
                SUM(CASE WHEN YEAR(COALESCE(start_date, created_at)) = ? THEN 1 ELSE 0 END) as yearly_total,
                SUM(CASE WHEN MONTH(COALESCE(start_date, created_at)) = ? AND YEAR(COALESCE(start_date, created_at)) = ? THEN 1 ELSE 0 END) as monthly_total,
                SUM(CASE WHEN status = 'pending' AND MONTH(COALESCE(start_date, created_at)) = ? AND YEAR(COALESCE(start_date, created_at)) = ? THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' AND MONTH(COALESCE(start_date, created_at)) = ? AND YEAR(COALESCE(start_date, created_at)) = ? THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' AND MONTH(COALESCE(start_date, created_at)) = ? AND YEAR(COALESCE(start_date, created_at)) = ? THEN 1 ELSE 0 END) as rejected
            FROM leave_requests
        `,
            [
                currentYear,
                currentMonth,
                currentYear,
                currentMonth,
                currentYear,
                currentMonth,
                currentYear,
                currentMonth,
                currentYear,
            ]
        );

        const [pendingLeaves] = await db.promise().query(
            `SELECT lr.*, e.employee_code, u.name as employee_name
             FROM leave_requests lr
             JOIN employees e ON lr.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             WHERE lr.status = 'pending'
             ORDER BY lr.created_at DESC
             LIMIT 15`
        );

        // 4. Reimbursement Validation (HR validates after atasan approval)
        const [reimbursementStats] = await db.promise().query(
            `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_need_validation,
                SUM(CASE WHEN status = 'included_in_payroll' THEN 1 ELSE 0 END) as validated,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM reimbursements
            WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?
        `,
            [currentMonth, currentYear]
        );

        const [reimbursementPendingValidationCount] = await db.promise().query(
            `
            SELECT COUNT(*) as total
            FROM reimbursements r
            JOIN employees e ON r.employee_id = e.id
            JOIN users u ON e.user_id = u.id
            WHERE r.status = 'approved'
              AND (? = 0 OR u.id <> ?)
            `,
            [requesterUserId, requesterUserId]
        );

        const [reimbursementsNeedValidation] = await db.promise().query(
            `SELECT r.*, e.employee_code, u.name as employee_name
             FROM reimbursements r
             JOIN employees e ON r.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             WHERE r.status = 'approved'
               AND (? = 0 OR u.id <> ?)
             ORDER BY r.created_at DESC
             LIMIT 10`
            ,
            [requesterUserId, requesterUserId]
        );

        // 5. Salary Appeals (HR review)
        const [appealStats] = await db.promise().query(
            `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM salary_appeals
            WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?
        `,
            [currentMonth, currentYear]
        );

        const [pendingAppeals] = await db.promise().query(
            `SELECT sa.*, e.employee_code, u.name as employee_name,
                    p.period_month, p.period_year, p.net_salary
             FROM salary_appeals sa
             JOIN employees e ON sa.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             JOIN payrolls p ON sa.payroll_id = p.id
             WHERE sa.status = 'pending'
             ORDER BY sa.created_at DESC
             LIMIT 10`
        );

        // 6. Monthly Attendance Summary
        const [monthlyAttendance] = await db.promise().query(
            `SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) as hadir,
                SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) as sakit,
                SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END) as izin,
                SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as alpha,
                SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as total_late,
                AVG(late_minutes) as avg_late_minutes
            FROM attendance 
            WHERE MONTH(date) = ? AND YEAR(date) = ?`,
            [currentMonth, currentYear]
        );

        // 7. Department Overview
        const [departmentStats] = await db.promise().query(`
            SELECT d.name, d.code, COUNT(e.id) as employee_count
            FROM departments d
            LEFT JOIN positions p ON d.id = p.department_id
            LEFT JOIN employees e ON p.id = e.position_id
            WHERE d.status = 'active'
            GROUP BY d.id, d.name, d.code
            ORDER BY employee_count DESC
        `);

        // 8. Position Distribution
        const [positionStats] = await db.promise().query(`
            SELECT p.name, p.level, COUNT(e.id) as employee_count
            FROM positions p
            LEFT JOIN employees e ON p.id = e.position_id
            WHERE p.status = 'active'
            GROUP BY p.id, p.name, p.level
            ORDER BY employee_count DESC
            LIMIT 10
        `);

        res.json({
            employee_overview: employeeStats[0],
            attendance_today: {
                present: attendanceToday[0]?.present || 0,
                late: attendanceToday[0]?.late || 0,
                sakit: attendanceToday[0]?.sakit || 0,
                izin: attendanceToday[0]?.izin || 0,
                alpha: attendanceToday[0]?.alpha || 0,
                absent:
                    employeeStats[0].total_employees -
                    (attendanceToday[0]?.present || 0),
            },
            leave_management: {
                stats: leaveStats[0],
                pending_items: pendingLeaves,
            },
            reimbursement_validation: {
                stats: {
                    ...(reimbursementStats[0] || {}),
                    pending_validation_count: reimbursementPendingValidationCount[0]?.total || 0,
                },
                need_validation: reimbursementsNeedValidation,
            },
            salary_appeals: {
                stats: appealStats[0],
                pending_reviews: pendingAppeals,
            },
            attendance_summary: monthlyAttendance[0],
            organization: {
                departments: departmentStats,
                positions: positionStats,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
