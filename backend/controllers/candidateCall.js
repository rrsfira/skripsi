
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

// POST /api/candidate-calls
router.post("/", verifyToken, verifyRole(["hr"]), async (req, res) => {
  try {
    const { candidate_id, call_date, call_time, call_location, call_notes, status, invitation_letter_file } = req.body;
    if (!candidate_id || !call_date || !call_time || !call_location) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
    }
    await db.promise().query(
      `INSERT INTO candidate_calls (candidate_id, call_date, call_time, call_location, call_notes, status, invitation_letter_file) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candidate_id, call_date, call_time, call_location, call_notes || null, status || "sent", invitation_letter_file || null]
    );
    res.status(201).json({ message: "Undangan berhasil dibuat." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal membuat undangan." });
  }
});


// GET /api/candidate-calls/me
router.get("/me", verifyToken, verifyRole(["kandidat"]), async (req, res) => {
  try {
    const userId = req.user.id;
    // Cari candidate_id dari tabel candidates berdasarkan user_id
    const [candidateRows] = await db.promise().query(
      `SELECT id FROM candidates WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!candidateRows || candidateRows.length === 0) {
      return res.status(404).json({ message: "Data kandidat tidak ditemukan." });
    }
    const candidateId = candidateRows[0].id;
    // Ambil undangan onboarding milik kandidat ini (ambil satu yang terbaru)
    const [rows] = await db.promise().query(
      `SELECT * FROM candidate_calls WHERE candidate_id = ? ORDER BY id DESC LIMIT 1`,
      [candidateId]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ message: "Tidak ada undangan onboarding." });
    // Sertakan url pdf jika ada kolom pdf_url
    const call = rows[0];
    if (call.pdf_url) call.pdf_url = call.pdf_url;
    res.json(call);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data undangan." });
  }
});
// GET /api/candidate-calls/last/:candidate_id
router.get("/last/:candidate_id", async (req, res) => {
  const { candidate_id } = req.params;
  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM candidate_calls WHERE candidate_id = ? ORDER BY id DESC LIMIT 1`,
      [candidate_id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Tidak ada undangan onboarding." });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data undangan." });
  }
});
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

