require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.query(`
      SELECT
        e.id,
        e.employee_code,
        COALESCE(e.annual_leave_quota, 12) AS annual_leave_quota,
        COALESCE(e.remaining_leave_quota, 0) AS remaining_leave_quota,
        COALESCE(
          SUM(
            CASE
              WHEN lr.status = 'approved' AND lr.leave_type IN ('cuti_tahunan', 'izin')
                THEN COALESCE(lr.total_days, 0)
              ELSE 0
            END
          ),
          0
        ) AS used_days,
        GREATEST(
          COALESCE(e.annual_leave_quota, 12) - COALESCE(
            SUM(
              CASE
                WHEN lr.status = 'approved' AND lr.leave_type IN ('cuti_tahunan', 'izin')
                  THEN COALESCE(lr.total_days, 0)
                ELSE 0
              END
            ),
            0
          ),
          0
        ) AS expected_remaining
      FROM employees e
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
      GROUP BY
        e.id,
        e.employee_code,
        e.annual_leave_quota,
        e.remaining_leave_quota
      ORDER BY e.id
    `);

    console.table(rows);

    const mismatches = rows.filter(
      (row) => Number(row.remaining_leave_quota) !== Number(row.expected_remaining)
    );

    console.log(`Mismatch count: ${mismatches.length}`);
    if (mismatches.length > 0) {
      console.table(mismatches);
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Gagal diagnose kuota:", error.message);
  process.exit(1);
});
