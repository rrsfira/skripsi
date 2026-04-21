const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Ambil status onboarding kandidat berdasarkan candidate_id
router.get("/:candidate_id", async (req, res) => {
  const { candidate_id } = req.params;
  try {
    // Ambil status onboarding terbaru dari candidate_calls
    const [rows] = await db.promise().query(
      `SELECT status FROM candidate_calls WHERE candidate_id = ? ORDER BY id DESC LIMIT 1`,
      [candidate_id]
    );
    if (!rows || rows.length === 0) {
      return res.json({ status: "Belum dibuat" });
    }
    res.json({ status: rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil status onboarding." });
  }
});

module.exports = router;
