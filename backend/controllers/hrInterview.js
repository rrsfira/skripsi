// Endpoint untuk update hasil wawancara (edit, bukan tambah baru)
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Ambil semua kandidat yang lolos interview (result: 'passed')
router.get("/interviews", async (req, res) => {
  // Tampilkan hanya kandidat yang lolos (i.result = 'passed')
  // dan job_openings status = 'closed' dan hiring_status = 'completed'
  try {
    let query = `SELECT i.*, c.name AS name, c.email, j.title, j.base_position, j.position_id, p.name AS position_name, a.photo_file
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN candidates c ON a.candidate_id = c.id
      JOIN job_openings j ON a.job_opening_id = j.id
      JOIN positions p ON j.position_id = p.id
      WHERE i.result = 'passed' AND j.status = 'closed' AND j.hiring_status = 'completed'`;
    const [rows] = await db.promise().query(query);
    res.json(rows);
  } catch (err) {
    console.error("[ERROR GET /api/interviews]", err);
    res.status(500).json({ message: err.message });
  }
});

// Endpoint detail kandidat lolos interview berdasarkan id interview
router.get("/interviews/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let query = `SELECT i.*, c.name AS name, c.email, c.phone, c.gender, c.birth_place, c.date_of_birth, c.marital_status, c.nationality, c.address, c.nik, c.npwp, c.education_level, c.university, c.major, c.graduation_year, c.gpa, j.title, j.base_position, j.position_id, p.name AS position_name, a.photo_file, a.status AS application_status, j.status AS job_status, j.hiring_status, i.result AS interview_result, i.rating, i.recommendation, i.interviewer_notes, i.scheduled_date
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN candidates c ON a.candidate_id = c.id
      JOIN job_openings j ON a.job_opening_id = j.id
      JOIN positions p ON j.position_id = p.id
      WHERE i.id = ?`;
    const [rows] = await db.promise().query(query, [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Data kandidat tidak ditemukan" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[ERROR GET /api/interviews/:id]", err);
    res.status(500).json({ message: err.message });
  }
});

// Accept all applications by job_opening_id
router.put("/admin/applications/accept-by-job", async (req, res) => {
  const { job_opening_id } = req.body;
  if (!job_opening_id)
    return res.status(400).json({ message: "job_opening_id wajib diisi" });
  try {
    await db.query(
      `UPDATE applications SET status = 'diterima' WHERE job_opening_id = ? AND status != 'diterima'`,
      [job_opening_id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Complete job opening (status: closed, hiring_status: completed)
router.put("/job-openings/:jobId/complete", async (req, res) => {
  const { jobId } = req.params;
  try {
    await db.query(
      `UPDATE job_openings SET status = 'closed', hiring_status = 'completed' WHERE id = ?`,
      [jobId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update interviews: completed & pending result -> passed
router.put("/admin/interviews/update-result-by-job", async (req, res) => {
  const { job_opening_id } = req.body;
  if (!job_opening_id)
    return res.status(400).json({ message: "job_opening_id wajib diisi" });
  try {
    await db.query(
      `UPDATE interviews SET result = 'passed' WHERE job_opening_id = ? AND status = 'completed' AND (result IS NULL OR result = 'pending')`,
      [job_opening_id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update hasil interview (edit data lama)
router.put("/admin/interviews/:id/result", async (req, res) => {
  const { id } = req.params;
  const { rating, recommendation, interviewer_notes, result, status } =
    req.body;
  try {
    const [rows] = await db.query(
      `UPDATE interviews SET rating = ?, recommendation = ?, interviewer_notes = ?, result = ?, status = ? WHERE id = ?`,
      [rating, recommendation, interviewer_notes, result, status, id],
    );
    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Interview tidak ditemukan" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
