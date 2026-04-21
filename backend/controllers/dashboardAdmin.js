const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

// ============================
// Admin Dashboard
// ============================
router.get("/", verifyToken, verifyRole(["admin"]), async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // 1. Employee Statistics
        const [employeeStats] = await db.promise().query(`
            SELECT 
                COUNT(*) as total_employees,
                SUM(CASE WHEN employment_status = 'permanent' THEN 1 ELSE 0 END) as permanent,
                SUM(CASE WHEN employment_status = 'contract' THEN 1 ELSE 0 END) as contract,
                SUM(CASE WHEN employment_status = 'intern' THEN 1 ELSE 0 END) as intern
            FROM employees
        `);

        // 2. User Statistics
        const [userStats] = await db.promise().query(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_users
            FROM users
        `);

        // 3. Attendance Today
        const [attendanceToday] = await db.promise().query(
            `SELECT 
                COUNT(DISTINCT employee_id) as total_present,
                SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as total_late,
                SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as total_alpha
            FROM attendance 
            WHERE date = ?`,
            [today]
        );

        // 4. All Pending Items
        const [pendingLeave] = await db
            .promise()
            .query(
                "SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'"
            );

        const [pendingReimbursements] = await db
            .promise()
            .query(
                "SELECT COUNT(*) as count FROM reimbursements WHERE status = 'pending'"
            );

        const [pendingSalaryAppeals] = await db
            .promise()
            .query(
                "SELECT COUNT(*) as count FROM salary_appeals WHERE status = 'pending'"
            );

        // 5. Payroll Status
        const [payrollStats] = await db.promise().query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
                SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed,
                SUM(net_salary) as total_salary,
                SUM(CASE WHEN final_amount IS NOT NULL THEN final_amount ELSE net_salary END) as total_with_appeals
            FROM payrolls 
            WHERE period_month = ? AND period_year = ?`,
            [currentMonth, currentYear]
        );

        // 6. Department Distribution
        const [departmentStats] = await db.promise().query(`
            SELECT d.name, d.code, COUNT(e.id) as employee_count,
                   AVG(e.basic_salary) as avg_salary
            FROM departments d
            LEFT JOIN positions p ON d.id = p.department_id
            LEFT JOIN employees e ON p.id = e.position_id
            WHERE d.status = 'active'
            GROUP BY d.id, d.name, d.code
            ORDER BY employee_count DESC
        `);

        // 7. Working Hours/Shifts
        const [shiftsStats] = await db.promise().query(`
            SELECT wh.shift_name, wh.check_in_time, wh.check_out_time,
                   COUNT(e.id) as employee_count
            FROM working_hours wh
            LEFT JOIN employees e ON wh.id = e.working_hours_id
            GROUP BY wh.id, wh.shift_name, wh.check_in_time, wh.check_out_time
            ORDER BY employee_count DESC
        `);

        // 8. Monthly Attendance Summary
        const [monthlyAttendance] = await db.promise().query(
            `SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) as hadir,
                SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) as sakit,
                SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END) as izin,
                SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as alpha,
                SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as total_late
            FROM attendance 
            WHERE MONTH(date) = ? AND YEAR(date) = ?`,
            [currentMonth, currentYear]
        );

        // 9. System Activity (recent actions)
        const [recentUsers] = await db.promise().query(
            `SELECT id, name, email, status, created_at 
             FROM users 
             ORDER BY created_at DESC 
             LIMIT 5`
        );

        const [recentEmployees] = await db.promise().query(
            `SELECT e.employee_code, u.name, e.employment_status, e.created_at
             FROM employees e
             JOIN users u ON e.user_id = u.id
             ORDER BY e.created_at DESC
             LIMIT 5`
        );

        res.json({
            overview: {
                employees: employeeStats[0],
                users: userStats[0],
                attendance_today: {
                    present: attendanceToday[0]?.total_present || 0,
                    late: attendanceToday[0]?.total_late || 0,
                    alpha: attendanceToday[0]?.total_alpha || 0,
                    absent:
                        employeeStats[0].total_employees -
                        (attendanceToday[0]?.total_present || 0),
                },
                pending_approvals: {
                    leave_requests: pendingLeave[0].count,
                    reimbursements: pendingReimbursements[0].count,
                    salary_appeals: pendingSalaryAppeals[0].count,
                    total:
                        pendingLeave[0].count +
                        pendingReimbursements[0].count +
                        pendingSalaryAppeals[0].count,
                },
            },
            payroll: {
                current_month: payrollStats[0]?.total || 0,
                draft: payrollStats[0]?.draft || 0,
                published: payrollStats[0]?.published || 0,
                claimed: payrollStats[0]?.claimed || 0,
                total_salary: parseFloat(payrollStats[0]?.total_salary || 0),
                total_with_appeals: parseFloat(
                    payrollStats[0]?.total_with_appeals || 0
                ),
            },
            departments: departmentStats,
            shifts: shiftsStats,
            attendance_summary: monthlyAttendance[0],
            recent_activity: {
                new_users: recentUsers,
                new_employees: recentEmployees,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
