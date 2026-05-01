const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

const normalizePercent = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 1 ? parsed / 100 : parsed;
};

// Get current payroll settings (Finance/HR/Admin)
router.get(
  "/",
  verifyToken,
  verifyRole(["finance", "hr", "admin"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        "SELECT id, transport_per_day, meal_per_day, health_percentage, bpjs_percentage, tax, updated_by, updated_at, created_at FROM payroll_settings ORDER BY created_at DESC LIMIT 1"
      );
      // Exclude Commissioner positions from validation counts
      const [positionValidationRows] = await db.promise().query(
        `SELECT
            COUNT(*) AS total_positions,
            SUM(CASE WHEN base_salary IS NULL THEN 1 ELSE 0 END) AS missing_base_salary,
            SUM(CASE WHEN position_allowance IS NULL THEN 1 ELSE 0 END) AS missing_position_allowance
         FROM positions
         WHERE NOT (
           LOWER(COALESCE(name, '')) LIKE '%commissioner%'
           OR LOWER(COALESCE(level, '')) = 'commissioner'
         )`
      );
      const positionValidation = positionValidationRows[0] || {};
      const validation = {
        has_missing_payroll_settings: rows.length === 0,
        has_missing_position_components:
          Number(positionValidation.missing_base_salary || 0) > 0 ||
          Number(positionValidation.missing_position_allowance || 0) > 0,
        total_positions: Number(positionValidation.total_positions || 0),
        missing_base_salary_count: Number(positionValidation.missing_base_salary || 0),
        missing_position_allowance_count: Number(positionValidation.missing_position_allowance || 0),
      };

      if (rows.length === 0) {
        return res.status(200).json({
          transport_per_day: 50000,
          meal_per_day: 25000,
          health_percentage: 0.01,
          bpjs_percentage: 0.01,
          tax: 0.03,
          note: "Using defaults; no settings row found",
          validation,
        });
      }
      res.status(200).json({
        ...rows[0],
        validation,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update payroll settings (Finance/HR/Admin) - Creates a new record
router.put(
  "/",
  verifyToken,
  verifyRole(["finance", "hr", "admin"]),
  async (req, res) => {
    try {
      const { transport_per_day, meal_per_day, health_percentage, bpjs_percentage, tax } = req.body;
      const normalizedHealthPercentage = normalizePercent(health_percentage, 0.01);
      const normalizedBpjsPercentage = normalizePercent(bpjs_percentage, 0.01);
      const normalizedTax = normalizePercent(tax, 0.03);

      const updaterId = req.user.id;

      // Always INSERT new record instead of updating
      const [result] = await db.promise().query(
        `INSERT INTO payroll_settings (transport_per_day, meal_per_day, health_percentage, bpjs_percentage, tax, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          transport_per_day ?? 50000,
          meal_per_day ?? 25000,
          normalizedHealthPercentage,
          normalizedBpjsPercentage,
          normalizedTax,
          updaterId,
        ]
      );

      const [inserted] = await db
        .promise()
        .query(
          "SELECT id, transport_per_day, meal_per_day, health_percentage, bpjs_percentage, tax, updated_by, updated_at, created_at FROM payroll_settings WHERE id = ?",
          [result.insertId]
        );

      res.status(200).json({ message: "Settings saved as new version", settings: inserted[0] });
    } catch (err) {
      console.error("Error in PUT /api/payroll-settings:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
