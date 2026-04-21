const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const {
  getRequiredDocuments,
  DOCUMENT_FIELD_METADATA,
} = require("../utils/documentRequirements");

// ============================
// CANCEL JOB OPENING (HR/Admin)
// ============================
router.put(
  "/:id/cancel",
  verifyToken,
  verifyRole(["hr", "admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [job] = await db
        .promise()
        .query("SELECT * FROM job_openings WHERE id = ?", [id]);
      if (job.length === 0) {
        return res.status(404).json({ message: "Job opening not found" });
      }
      await db
        .promise()
        .query(
          `UPDATE job_openings SET status = 'closed', hiring_status = 'canceled' WHERE id = ?`,
          [id],
        );
      // Update status interviews menjadi 'canceled_by_company' untuk semua aplikasi pada job_opening ini
      await db.promise().query(
        `UPDATE interviews i
                 JOIN applications a ON i.application_id = a.id
                 SET i.status = 'canceled_by_company'
                 WHERE a.job_opening_id = ? AND i.status IN ('scheduled', 'rescheduled')`,
        [id],
      );
      res.json({
        message:
          "Lowongan berhasil dibatalkan, status interview juga diupdate.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ============================
// GET ALL JOB OPENINGS (Public)
// ============================
router.get("/", async (req, res) => {
  try {
    const { status, position_id } = req.query;

    // Update otomatis status menjadi 'closed' jika deadline sudah lewat dan status masih 'open'
    await db
      .promise()
      .query(
        `UPDATE job_openings SET status = 'closed' WHERE status = 'open' AND deadline IS NOT NULL AND deadline < CURDATE()`,
      );

    let query = `
            SELECT 
                jo.id,
                jo.position_id,
                jo.base_position,
                jo.title,
                jo.description,
                jo.requirements,
                jo.responsibilities,
                jo.quota,
                jo.employment_type,
                jo.salary_range_min,
                jo.salary_range_max,
                jo.location,
                jo.deadline,
                jo.status,
                jo.hiring_status,
                jo.created_by,
                jo.created_at,
                p.name AS position_name,
                p.level,
                d.name AS department_name
            FROM job_openings jo
            JOIN positions p ON jo.position_id = p.id
            JOIN departments d ON p.department_id = d.id
        `;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("jo.status = ?");
      params.push(status);
    }
    if (position_id) {
      conditions.push("jo.position_id = ?");
      params.push(position_id);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY jo.created_at DESC";

    const [jobs] = await db.promise().query(query, params);

    res.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// GET SINGLE JOB OPENING (Public)
// ============================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
            SELECT 
    jo.id,
    jo.position_id,
    jo.base_position,
    jo.title,
    jo.description,
    jo.requirements,
    jo.responsibilities,
    jo.quota,
    jo.employment_type,
    jo.salary_range_min,
    jo.salary_range_max,
    jo.location,
    jo.deadline,
    jo.status,
    jo.hiring_status,        
    jo.created_by,
    jo.created_at,
    p.name AS position_name,
    p.level,
    p.base_salary,
    d.name AS department_name,
    d.description AS department_description
FROM job_openings jo
JOIN positions p ON jo.position_id = p.id
JOIN departments d ON p.department_id = d.id
WHERE jo.id = ?
        `;

    const [jobs] = await db.promise().query(query, [id]);

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job opening not found" });
    }

    res.json({ job: jobs[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// GET JOB OPENING WITH DOCUMENT REQUIREMENTS (Public)
// ============================
router.get("/:id/documents", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
            SELECT 
                jo.id,
                jo.position_id,
                   jo.base_position,
                jo.title,
                p.name AS position_name,
                p.level,
                d.name AS department_name
            FROM job_openings jo
            JOIN positions p ON jo.position_id = p.id
            JOIN departments d ON p.department_id = d.id
            WHERE jo.id = ? AND jo.status = 'open'
        `;

    const [jobs] = await db.promise().query(query, [id]);

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job opening not found" });
    }

    const job = jobs[0];
    // Jika ada base_position di query, gabungkan dengan posisi utama
    let requiredDocs;
    if (
      req.query.base_position &&
      (job.position_name.toLowerCase().includes("mentor") ||
        job.position_name.toLowerCase().includes("project manager"))
    ) {
      // Gabungkan: "mentor/project manager base_position"
      const combined = `${job.position_name} ${req.query.base_position}`;
      requiredDocs = getRequiredDocuments(combined);
    } else {
      requiredDocs = getRequiredDocuments(job.position_name);
    }

    // Map required dan mandatory_optional documents dengan metadata
    const requiredDocuments = (requiredDocs.required || []).map((docType) => ({
      fieldName: docType,
      label: DOCUMENT_FIELD_METADATA[docType]?.label || docType,
      description: DOCUMENT_FIELD_METADATA[docType]?.description || "",
      accept: DOCUMENT_FIELD_METADATA[docType]?.accept || "",
      maxSize: DOCUMENT_FIELD_METADATA[docType]?.maxSize || 5 * 1024 * 1024,
      isUrl: DOCUMENT_FIELD_METADATA[docType]?.isUrl || false,
      required: true,
    }));

    // Mandatory optional documents (diperlukan tetapi bersifat optional dari perspektif general)
    const mandatoryOptionalDocuments = (
      requiredDocs.mandatory_optional || []
    ).map((docType) => ({
      fieldName: docType,
      label: DOCUMENT_FIELD_METADATA[docType]?.label || docType,
      description: DOCUMENT_FIELD_METADATA[docType]?.description || "",
      accept: DOCUMENT_FIELD_METADATA[docType]?.accept || "",
      maxSize: DOCUMENT_FIELD_METADATA[docType]?.maxSize || 5 * 1024 * 1024,
      isUrl: DOCUMENT_FIELD_METADATA[docType]?.isUrl || false,
      required: true, // Diperlukan untuk posisi ini
    }));

    // Optional documents
    const optionalDocuments = (requiredDocs.optional || []).map((docType) => ({
      fieldName: docType,
      label: DOCUMENT_FIELD_METADATA[docType]?.label || docType,
      description: DOCUMENT_FIELD_METADATA[docType]?.description || "",
      accept: DOCUMENT_FIELD_METADATA[docType]?.accept || "",
      maxSize: DOCUMENT_FIELD_METADATA[docType]?.maxSize || 5 * 1024 * 1024,
      isUrl: DOCUMENT_FIELD_METADATA[docType]?.isUrl || false,
      required: false,
    }));

    res.json({
      job: {
        id: job.id,
        title: job.title,
        position_name: job.position_name,
        level: job.level,
      },
      requiredDocuments: requiredDocuments.concat(mandatoryOptionalDocuments),
      optionalDocuments: optionalDocuments,
      summary: {
        totalRequired:
          requiredDocuments.length + mandatoryOptionalDocuments.length,
        totalOptional: optionalDocuments.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// CREATE JOB OPENING (HR/Admin)
// ============================
router.post("/", verifyToken, verifyRole(["hr", "admin"]), async (req, res) => {
  try {
    const {
      position_id,
      base_position,
      title,
      description,
      requirements,
      responsibilities,
      quota,
      employment_type,
      salary_range_min,
      salary_range_max,
      location,
      deadline,
      status,
      hiring_status,
    } = req.body;

    if (!position_id || !title) {
      return res.status(400).json({
        message: "position_id and title are required",
      });
    }

    // Validate position exists
    const [position] = await db
      .promise()
      .query("SELECT id FROM positions WHERE id = ?", [position_id]);

    if (position.length === 0) {
      return res.status(404).json({ message: "Position not found" });
    }

    // Get employee_id of creator
    const [employee] = await db
      .promise()
      .query("SELECT id FROM employees WHERE user_id = ?", [req.user.id]);

    const createdBy = employee.length > 0 ? employee[0].id : null;

    const [result] = await db.promise().query(
      `INSERT INTO job_openings (
                position_id, base_position, title, description, requirements, responsibilities, 
                quota, employment_type, salary_range_min, salary_range_max, 
                location, deadline, status, hiring_status, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        position_id,
        base_position,
        title,
        description,
        requirements,
        responsibilities,
        quota || 1,
        employment_type || "permanent",
        salary_range_min,
        salary_range_max,
        location,
        deadline,
        status || "open",
        hiring_status || "ongoing",
        createdBy,
      ],
    );

    res.status(201).json({
      message: "Job opening created successfully",
      job_id: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================
// UPDATE JOB OPENING (HR/Admin)
// ============================
router.put(
  "/:id",
  verifyToken,
  verifyRole(["hr", "admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        position_id,
        base_position,
        title,
        description,
        requirements,
        responsibilities,
        quota,
        employment_type,
        salary_range_min,
        salary_range_max,
        location,
        deadline,
        status,
        hiring_status,
      } = req.body;

      const [job] = await db
        .promise()
        .query("SELECT * FROM job_openings WHERE id = ?", [id]);

      if (job.length === 0) {
        return res.status(404).json({ message: "Job opening not found" });
      }

      await db.promise().query(
        `UPDATE job_openings SET
                position_id = COALESCE(?, position_id),
                base_position = COALESCE(?, base_position),
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                requirements = COALESCE(?, requirements),
                responsibilities = COALESCE(?, responsibilities),
                quota = COALESCE(?, quota),
                employment_type = COALESCE(?, employment_type),
                salary_range_min = COALESCE(?, salary_range_min),
                salary_range_max = COALESCE(?, salary_range_max),
                location = COALESCE(?, location),
                deadline = COALESCE(?, deadline),
                status = COALESCE(?, status),
                hiring_status = COALESCE(?, hiring_status)
            WHERE id = ?`,
        [
          position_id,
          base_position,
          title,
          description,
          requirements,
          responsibilities,
          quota,
          employment_type,
          salary_range_min,
          salary_range_max,
          location,
          deadline,
          status,
          hiring_status,
          id,
        ],
      );

      res.json({ message: "Job opening updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ============================
// DELETE JOB OPENING (HR/Admin)
// ============================
router.delete(
  "/:id",
  verifyToken,
  verifyRole(["hr", "admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const [job] = await db
        .promise()
        .query("SELECT * FROM job_openings WHERE id = ?", [id]);

      if (job.length === 0) {
        return res.status(404).json({ message: "Job opening not found" });
      }

      await db.promise().query("DELETE FROM job_openings WHERE id = ?", [id]);

      res.json({ message: "Job opening deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
