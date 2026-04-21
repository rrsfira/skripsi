require("dotenv").config();
const mysql = require("mysql2/promise");

async function syncPayrollAppealStatus() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.query(`
      UPDATE payrolls p
      LEFT JOIN (
        SELECT
          payroll_id,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count
        FROM salary_appeals
        GROUP BY payroll_id
      ) sa ON sa.payroll_id = p.id
      SET p.appeal_status = CASE
        WHEN COALESCE(sa.pending_count, 0) > 0 THEN 'pending'
        ELSE NULL
      END,
      p.updated_at = NOW()
    `);

    const [rows] = await connection.query(`
      SELECT id, employee_id, period_month, period_year, status, appeal_status
      FROM payrolls
      ORDER BY id DESC
      LIMIT 30
    `);

    console.log("Sync payroll appeal_status selesai");
    console.table(rows);
  } finally {
    await connection.end();
  }
}

syncPayrollAppealStatus().catch((error) => {
  console.error("Gagal sync payroll appeal_status:", error.message);
  process.exit(1);
});
