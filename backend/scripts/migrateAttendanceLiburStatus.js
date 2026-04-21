require("dotenv").config();
const mysql = require("mysql2/promise");

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.query(
      "ALTER TABLE attendance MODIFY COLUMN status ENUM('hadir','izin','sakit','alpha','libur') DEFAULT NULL"
    );
    console.log("Migration applied: attendance.status includes libur");
  } finally {
    await connection.end();
  }
}

runMigration().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
