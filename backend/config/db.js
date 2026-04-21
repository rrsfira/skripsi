// Mengimpor library mysql2 untuk koneksi ke database MySQL
const mysql = require("mysql2");

// Memuat variabel lingkungan dari file .env
require("dotenv").config();

// Membuat pool koneksi untuk menghindari error "connection closed"
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const SOFT_DELETE_TABLES = [
  "employees",
  "job_openings",
  "payrolls",
  "salary_appeals",
  "working_hours",
];

const ensureSoftDeleteColumns = async () => {
  for (const tableName of SOFT_DELETE_TABLES) {
    const [rows] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = 'deleted_at'`,
      [tableName]
    );

    const exists = Number(rows?.[0]?.total || 0) > 0;
    if (exists) continue;

    await db.promise().query(
      `ALTER TABLE ${tableName} ADD COLUMN deleted_at DATETIME NULL AFTER updated_at`
    );

    await db.promise().query(
      `CREATE INDEX idx_${tableName}_deleted_at ON ${tableName} (deleted_at)`
    );
  }
};

db.ensureSoftDeleteColumns = ensureSoftDeleteColumns;

module.exports = db;
