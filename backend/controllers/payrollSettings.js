const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

// Get current payroll settings (Finance/HR/Admin)
router.get(
  "/",
  verifyToken,
  verifyRole(["finance", "hr", "admin"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        "SELECT id, transport_per_day, meal_per_day, health_percentage, bpjs_percentage, updated_by, updated_at, created_at FROM payroll_settings ORDER BY id ASC LIMIT 1"
      );
      if (rows.length === 0) {
        return res.status(200).json({
          transport_per_day: 50000,
          meal_per_day: 25000,
          health_percentage: 0.01,
          bpjs_percentage: 0.01,
          note: "Using defaults; no settings row found",
        });
      }
      res.status(200).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update payroll settings (Finance/Admin only)
router.put(
  "/",
  verifyToken,
  verifyRole(["finance", "admin"]),
  async (req, res) => {
    try {
      const { transport_per_day, meal_per_day, health_percentage, bpjs_percentage } = req.body;

      // fetch current or create default row id
      const [rows] = await db.promise().query(
        "SELECT id FROM payroll_settings ORDER BY id ASC LIMIT 1"
      );

      const updaterId = req.user.id;

      if (rows.length === 0) {
        // insert new row
        const [result] = await db.promise().query(
          `INSERT INTO payroll_settings (transport_per_day, meal_per_day, health_percentage, bpjs_percentage, updated_by)
           VALUES (?, ?, ?, ?, ?)`,
          [
            transport_per_day ?? 50000,
            meal_per_day ?? 25000,
            health_percentage ?? 0.01,
            bpjs_percentage ?? 0.01,
            updaterId,
          ]
        );
        return res.status(200).json({ message: "Settings created", id: result.insertId });
      }

      const id = rows[0].id;
      await db.promise().query(
        `UPDATE payroll_settings
         SET transport_per_day = COALESCE(?, transport_per_day),
             meal_per_day = COALESCE(?, meal_per_day),
             health_percentage = COALESCE(?, health_percentage),
             bpjs_percentage = COALESCE(?, bpjs_percentage),
             updated_by = ?
         WHERE id = ?`,
        [
          transport_per_day,
          meal_per_day,
          health_percentage,
          bpjs_percentage,
          updaterId,
          id,
        ]
      );

      const [updated] = await db
        .promise()
        .query(
          "SELECT id, transport_per_day, meal_per_day, health_percentage, bpjs_percentage, updated_by, updated_at FROM payroll_settings WHERE id = ?",
          [id]
        );

      res.status(200).json({ message: "Settings updated", settings: updated[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
