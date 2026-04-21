const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { resolveManagerScope } = require("../utils/managerScope");
const { getWorkdaysUntilToday } = require("../utils/workdays");
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Endpoint: GET /api/dashboard/atasan/attendance-list
// Query: month, year
// Output: [{date, employee_id, employee_name, employee_code, status, check_in, check_out, is_late, late_minutes}]
router.get(
  "/attendance-list",
  verifyToken,
  verifyRole(["atasan"]),
  async (req, res) => {
    try {
      const now = new Date();
      const requestedMonth = Number(req.query.month);
      const requestedYear = Number(req.query.year);
      const selectedMonth =
        Number.isInteger(requestedMonth) &&
        requestedMonth >= 1 &&
        requestedMonth <= 12
          ? requestedMonth
          : now.getMonth() + 1;
      const selectedYear =
        Number.isInteger(requestedYear) &&
        requestedYear >= 2000 &&
        requestedYear <= 2100
          ? requestedYear
          : now.getFullYear();

      const { managerEmployeeId, departmentId } = await resolveManagerScope(
        db,
        req.user.id,
      );

      // Ambil semua anggota tim (bawahan atasan, 1 departemen)
      // Ambil semua anggota tim (termasuk atasan/diri sendiri)
      const [teamMembers] = await db.promise().query(
        `SELECT e.id as employee_id, e.employee_code, u.name as employee_name, p.name as position_name
         FROM employees e
         JOIN positions p ON e.position_id = p.id
         JOIN users u ON e.user_id = u.id
         WHERE p.department_id = ?
         ORDER BY u.name ASC`,
        [departmentId]
      );

      // Generate semua tanggal kerja (Senin-Sabtu) sampai hari ini
      const workdays = getWorkdaysUntilToday(selectedMonth, selectedYear);

      // Ambil data absensi seluruh tim untuk bulan & tahun tsb
      const [attendanceRows] = await db.promise().query(
        `SELECT a.*, e.employee_code, u.name as employee_name
             FROM attendance a
             JOIN employees e ON a.employee_id = e.id
             JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE p.department_id = ?
               AND e.id <> ?
               AND MONTH(a.date) = ?
               AND YEAR(a.date) = ?`,
        [departmentId, managerEmployeeId, selectedMonth, selectedYear],
      );

      // Buat map absensi: {date-employee_id: attendanceRow}
      const attendanceMap = {};
      for (const row of attendanceRows) {
        attendanceMap[`${row.date}-${row.employee_id}`] = row;
      }

      // Gabungkan: untuk setiap tanggal kerja dan setiap anggota tim, jika tidak ada data absensi, status alpha
      const result = [];
      for (const date of workdays) {
        for (const member of teamMembers) {
          const key = `${date}-${member.employee_id}`;
          const att = attendanceMap[key];
          result.push({
            date,
            employee_id: member.employee_id,
            employee_name: member.employee_name,
            employee_code: member.employee_code,
            status: att ? att.status : "alpha",
            check_in: att ? att.check_in : null,
            check_out: att ? att.check_out : null,
            is_late: att ? att.is_late : null,
            late_minutes: att ? att.late_minutes : null,
          });
        }
      }
      res.json({ data: result });
    } catch (error) {
      console.error(error);
      res
        .status(error.statusCode || 500)
        .json({ message: error.message || "Server error" });
    }
  },
);

// ============================
// Atasan Dashboard
// ============================
router.get("/", verifyToken, verifyRole(["atasan"]), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const requestedMonth = Number(req.query.month);
    const requestedYear = Number(req.query.year);
    const selectedMonth =
      Number.isInteger(requestedMonth) &&
      requestedMonth >= 1 &&
      requestedMonth <= 12
        ? requestedMonth
        : now.getMonth() + 1;
    const selectedYear =
      Number.isInteger(requestedYear) &&
      requestedYear >= 2000 &&
      requestedYear <= 2100
        ? requestedYear
        : now.getFullYear();
    const { managerEmployeeId, departmentId, departmentName, positionName } =
      await resolveManagerScope(db, req.user.id);

    // 1. Team Members (bawahan atasan, 1 departemen)
    const [teamStats] = await db.promise().query(
      `
            SELECT 
                COUNT(*) as total_team_members,
                SUM(CASE WHEN employment_status = 'permanent' THEN 1 ELSE 0 END) as permanent,
                SUM(CASE WHEN employment_status = 'contract' THEN 1 ELSE 0 END) as contract
            FROM employees e
            JOIN positions p ON e.position_id = p.id
            WHERE p.department_id = ?
              AND e.id <> ?
        `,
      [departmentId, managerEmployeeId],
    );

    const [teamMembers] = await db.promise().query(
      `SELECT e.id, e.employee_code, u.name as employee_name
                         FROM employees e
                         JOIN positions p ON e.position_id = p.id
                         JOIN users u ON e.user_id = u.id
                         WHERE p.department_id = ?
                             AND e.id <> ?
                         ORDER BY u.name ASC`,
      [departmentId, managerEmployeeId],
    );

    // 2. Team Attendance Today
    const [attendanceToday] = await db.promise().query(
      `SELECT 
                COUNT(DISTINCT employee_id) as present,
                SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late,
                SUM(CASE WHEN a.status = 'alpha' THEN 1 ELSE 0 END) as alpha
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            JOIN positions p ON e.position_id = p.id
            WHERE a.date = ?
              AND p.department_id = ?
              AND e.id <> ?`,
      [today, departmentId, managerEmployeeId],
    );

    // 3. Pending Leave Requests (yang perlu diapprove atasan)
    const [pendingLeaves] = await db.promise().query(
      `SELECT lr.*, e.employee_code, u.name as employee_name
             FROM leave_requests lr
             JOIN employees e ON lr.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE lr.status = 'pending'
                             AND p.department_id = ?
                             AND e.id <> ?
                             AND MONTH(lr.created_at) = ?
                             AND YEAR(lr.created_at) = ?
             ORDER BY lr.created_at DESC
                         LIMIT 10`,
      [departmentId, managerEmployeeId, selectedMonth, selectedYear],
    );

    // 4. Pending Reimbursements (yang perlu diapprove atasan)
    const [pendingReimbursements] = await db.promise().query(
      `SELECT r.*, e.employee_code, u.name as employee_name
             FROM reimbursements r
             JOIN employees e ON r.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE r.status = 'pending'
                             AND p.department_id = ?
                             AND e.id <> ?
                             AND MONTH(r.created_at) = ?
                             AND YEAR(r.created_at) = ?
             ORDER BY r.created_at DESC
                         LIMIT 10`,
      [departmentId, managerEmployeeId, selectedMonth, selectedYear],
    );

    // 5. Team Attendance Summary (bulan ini)
    const [monthlyAttendance] = await db.promise().query(
      `SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) as hadir,
                SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) as sakit,
                SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) as izin,
                SUM(CASE WHEN a.status = 'alpha' THEN 1 ELSE 0 END) as alpha,
                SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as total_late
                        FROM attendance a
                        JOIN employees e ON a.employee_id = e.id
                        JOIN positions p ON e.position_id = p.id
                        WHERE MONTH(a.date) = ? 
                            AND YEAR(a.date) = ?
                            AND p.department_id = ?
                            AND e.id <> ?`,
      [selectedMonth, selectedYear, departmentId, managerEmployeeId],
    );

    // 6. Top Late Employees (bulan ini)
    const [topLateEmployees] = await db.promise().query(
      `SELECT e.employee_code, u.name, 
                    COUNT(*) as late_count,
                    SUM(a.late_minutes) as total_late_minutes
             FROM attendance a
             JOIN employees e ON a.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE a.is_late = 1 
               AND MONTH(a.date) = ? AND YEAR(a.date) = ?
                             AND p.department_id = ?
                             AND e.id <> ?
             GROUP BY e.id, e.employee_code, u.name
             ORDER BY late_count DESC
             LIMIT 10`,
      [selectedMonth, selectedYear, departmentId, managerEmployeeId],
    );

    // 7. Recent Approved/Rejected Actions
    const [recentActions] = await db.promise().query(
      `SELECT 'leave' as type, lr.id, e.employee_code, u.name as employee_name,
                    lr.leave_type as detail, lr.status, lr.approved_at as action_date
             FROM leave_requests lr
             JOIN employees e ON lr.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE lr.status IN ('approved', 'rejected')
                             AND p.department_id = ?
                             AND e.id <> ?
                             AND MONTH(lr.approved_at) = ?
                             AND YEAR(lr.approved_at) = ?
             ORDER BY lr.approved_at DESC
                         LIMIT 5`,
      [departmentId, managerEmployeeId, selectedMonth, selectedYear],
    );

    res.json({
      period: {
        month: selectedMonth,
        year: selectedYear,
      },
      scope_info: {
        department_id: departmentId,
        department_name: departmentName || null,
        manager_position: positionName || null,
      },
      team_overview: {
        total_members: teamStats[0].total_team_members,
        permanent: teamStats[0].permanent,
        contract: teamStats[0].contract,
      },
      team_members: teamMembers,
      attendance_today: {
        present: attendanceToday[0]?.present || 0,
        late: attendanceToday[0]?.late || 0,
        alpha: attendanceToday[0]?.alpha || 0,
        absent:
          teamStats[0].total_team_members - (attendanceToday[0]?.present || 0),
      },
      pending_approvals: {
        leave_requests: pendingLeaves.length,
        reimbursements: pendingReimbursements.length,
        total: pendingLeaves.length + pendingReimbursements.length,
      },
      attendance_summary: monthlyAttendance[0],
      pending_items: {
        leaves: pendingLeaves,
        reimbursements: pendingReimbursements,
      },
      performance_alerts: {
        top_late_employees: topLateEmployees,
      },
      recent_actions: recentActions,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Server error",
    });
  }
});

module.exports = router;
