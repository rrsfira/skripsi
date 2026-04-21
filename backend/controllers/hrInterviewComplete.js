// Express router for HR interview completion endpoints
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Accept all applications by job_opening_id
router.put('/admin/applications/accept-by-job', async (req, res) => {
  const { job_opening_id } = req.body;
  if (!job_opening_id) return res.status(400).json({ message: 'job_opening_id wajib diisi' });
  try {
    await db.query(
      `UPDATE applications SET status = 'diterima' WHERE job_opening_id = ? AND status != 'diterima'`,
      [job_opening_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Complete job opening (status: closed, hiring_status: completed)
router.put('/job-openings/:jobId/complete', async (req, res) => {
  const { jobId } = req.params;
  try {
    await db.query(
      `UPDATE job_openings SET status = 'closed', hiring_status = 'completed' WHERE id = ?`,
      [jobId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update interviews: completed & pending result -> passed
router.put('/admin/interviews/update-result-by-job', async (req, res) => {
  const { job_opening_id } = req.body;
  if (!job_opening_id) return res.status(400).json({ message: 'job_opening_id wajib diisi' });
  try {
    await db.query(
      `UPDATE interviews SET result = 'passed' WHERE job_opening_id = ? AND status = 'completed' AND (result IS NULL OR result = 'pending')`,
      [job_opening_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
