require("dotenv").config();
const mysql = require("mysql2/promise");

async function recalculateLeaveQuota() {
  const goLiveDate = process.env.LEAVE_GO_LIVE_DATE || "2026-02-01";
  const includeAlphaDeduction = Number(process.env.INCLUDE_ALPHA_DEDUCTION || 0) ? 1 : 0;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE employees e
      LEFT JOIN (
        SELECT
          lr.employee_id,
          COALESCE(SUM(lr.total_days), 0) AS used_leave_days
        FROM leave_requests lr
        WHERE lr.status = 'approved'
          AND lr.leave_type IN ('cuti_tahunan', 'izin')
        GROUP BY lr.employee_id
      ) lu ON lu.employee_id = e.id
      LEFT JOIN (
        SELECT
          a.employee_id,
          COALESCE(COUNT(*), 0) AS used_alpha_days
        FROM attendance a
        WHERE a.status = 'alpha'
          AND a.date >= ?
        GROUP BY a.employee_id
      ) au ON au.employee_id = e.id
      SET e.remaining_leave_quota = GREATEST(
        COALESCE(e.annual_leave_quota, 12)
        - COALESCE(lu.used_leave_days, 0)
        - (COALESCE(au.used_alpha_days, 0) * ?),
        0
      )
      `,
      [goLiveDate, includeAlphaDeduction]
    );

    const [rows] = await connection.query(
      `
      SELECT id, employee_code, annual_leave_quota, remaining_leave_quota
      FROM employees
      ORDER BY id
      `
    );

    await connection.commit();

    console.log("Recalculate kuota selesai");
    console.table(rows);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

recalculateLeaveQuota().catch((error) => {
  console.error("Gagal recalculate kuota:", error.message);
  process.exit(1);
});
