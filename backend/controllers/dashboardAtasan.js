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

      const { managerEmployeeId, departmentId, isDirector } = await resolveManagerScope(
        db,
        req.user.id,
      );

      const teamConditionSql = isDirector
        ? "p.level = 'manager'"
        : "p.department_id = ?";
      const teamConditionParams = isDirector ? [] : [departmentId];

      // Ambil semua anggota tim (bawahan atasan, 1 departemen)
      // Ambil semua anggota tim (termasuk atasan/diri sendiri)
      const [teamMembers] = await db.promise().query(
        `SELECT e.id as employee_id, e.employee_code, u.name as employee_name, p.name as position_name
         FROM employees e
         JOIN positions p ON e.position_id = p.id
         JOIN users u ON e.user_id = u.id
        WHERE ${teamConditionSql}
         ORDER BY u.name ASC`,
        teamConditionParams
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
             WHERE ${teamConditionSql}
               AND e.id <> ?
               AND MONTH(a.date) = ?
               AND YEAR(a.date) = ?`,
        [...teamConditionParams, managerEmployeeId, selectedMonth, selectedYear],
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
    const { managerEmployeeId, departmentId, departmentName, positionName, isDirector: isDirectorScope } =
      await resolveManagerScope(db, req.user.id);
    const teamConditionSql2 = isDirectorScope
      ? "p.level = 'manager'"
      : "p.department_id = ?";
    const teamConditionParams2 = isDirectorScope ? [] : [departmentId];

    // 1. Team Members (bawahan atasan, 1 departemen)
      const [teamStats] = await db.promise().query(
      `
            SELECT 
                COUNT(*) as total_team_members,
                SUM(CASE WHEN employment_status = 'permanent' THEN 1 ELSE 0 END) as permanent,
                SUM(CASE WHEN employment_status = 'contract' THEN 1 ELSE 0 END) as contract
            FROM employees e
            JOIN positions p ON e.position_id = p.id
            WHERE ${teamConditionSql2}
              AND e.id <> ?
        `,
      [...teamConditionParams2, managerEmployeeId],
    );

    const [teamMembers] = await db.promise().query(
      `SELECT e.id, e.employee_code, u.name as employee_name, p.name as position_name, 1 as is_self
                         FROM employees e
                         JOIN positions p ON e.position_id = p.id
                         JOIN users u ON e.user_id = u.id
                         WHERE e.id = ?
                         UNION ALL
                         SELECT e.id, e.employee_code, u.name as employee_name, p.name as position_name, 0 as is_self
                         FROM employees e
                         JOIN positions p ON e.position_id = p.id
                         JOIN users u ON e.user_id = u.id
                         WHERE ${teamConditionSql2}
                             AND e.id <> ?
                         ORDER BY is_self DESC, employee_name ASC`,
      [managerEmployeeId, ...teamConditionParams2, managerEmployeeId],
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
            WHERE a.date = CURDATE()
                    AND ${teamConditionSql2}
              AND e.id <> ?`,
                  [...teamConditionParams2, managerEmployeeId],
    );

    // 3. Pending Leave Requests (yang perlu diapprove atasan)
    const [pendingLeaves] = await db.promise().query(
      `SELECT lr.*, e.employee_code, u.name as employee_name
             FROM leave_requests lr
             JOIN employees e ON lr.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE lr.status = 'pending'
                             AND ${teamConditionSql2}
                             AND e.id <> ?
                             AND MONTH(lr.created_at) = ?
                             AND YEAR(lr.created_at) = ?
             ORDER BY lr.created_at DESC
                         LIMIT 10`,
      [...teamConditionParams2, managerEmployeeId, selectedMonth, selectedYear],
    );

    // 4. Pending Reimbursements (yang perlu diapprove atasan)
    const [pendingReimbursements] = await db.promise().query(
      `SELECT r.*, e.employee_code, u.name as employee_name
             FROM reimbursements r
             JOIN employees e ON r.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE r.status = 'pending'
                             AND ${teamConditionSql2}
                             AND e.id <> ?
                             AND MONTH(r.created_at) = ?
                             AND YEAR(r.created_at) = ?
             ORDER BY r.created_at DESC
                         LIMIT 10`,
      [...teamConditionParams2, managerEmployeeId, selectedMonth, selectedYear],
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
                            AND ${teamConditionSql2}
                            AND e.id <> ?`,
      [...teamConditionParams2, selectedMonth, selectedYear, managerEmployeeId],
    );

    // 6. Employees late today (structured for frontend late_per_day table)
    const [lateTodayRows] = await db.promise().query(
      `SELECT 
            e.id,
            e.employee_code,
            u.name,
            a.date,
            a.late_minutes
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
         JOIN positions p ON e.position_id = p.id
         JOIN users u ON e.user_id = u.id
         WHERE a.is_late = 1
           AND a.date = CURDATE()
           AND ${teamConditionSql2}
           AND e.id <> ?
         ORDER BY a.late_minutes DESC, u.name ASC
         LIMIT 25`,
      [...teamConditionParams2, managerEmployeeId],
    );

    const topLateEmployeesMap = new Map();
    for (const row of lateTodayRows) {
      if (!topLateEmployeesMap.has(row.id)) {
        topLateEmployeesMap.set(row.id, {
          id: row.id,
          employee_code: row.employee_code,
          name: row.name,
          late_per_day: [],
          late_count: 0,
          total_late_minutes: 0,
        });
      }

      const employee = topLateEmployeesMap.get(row.id);
      const minutes = Number(row.late_minutes) || 0;
      employee.late_per_day.push({
        date: row.date,
        minutes,
      });
      employee.late_count += 1;
      employee.total_late_minutes += minutes;
    }

    const topLateEmployees = Array.from(topLateEmployeesMap.values())
      .sort((a, b) => b.total_late_minutes - a.total_late_minutes)
      .slice(0, 10);

    // 7. Recent Approved/Rejected Actions
    const [recentActions] = await db.promise().query(
      `SELECT 'leave' as type, lr.id, e.employee_code, u.name as employee_name,
                    lr.leave_type as detail, lr.status, lr.approved_at as action_date
             FROM leave_requests lr
             JOIN employees e ON lr.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
             JOIN users u ON e.user_id = u.id
             WHERE lr.status IN ('approved', 'rejected')
                             AND ${teamConditionSql2}
                             AND e.id <> ?
                             AND MONTH(lr.approved_at) = ?
                             AND YEAR(lr.approved_at) = ?
             ORDER BY lr.approved_at DESC
                         LIMIT 5`,
      [...teamConditionParams2, managerEmployeeId, selectedMonth, selectedYear],
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
