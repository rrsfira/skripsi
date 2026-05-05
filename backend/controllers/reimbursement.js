const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { resolveManagerScope } = require("../utils/managerScope");
const { logActivity, getIpAddress, getUserAgent } = require("../middleware/activityLogger");

const isAtasanRoleActive = (req) =>
    String(req.headers["x-active-role"] || "").toLowerCase() === "atasan";

// ============================
// MULTER SETUP
// ============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDir = path.join(__dirname, "../uploads/reimbursements");
        fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `reimbursement-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"]; // pdf, jpg, png
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Only PDF/JPG/PNG are allowed"));
};

const upload = multer({ storage, fileFilter });

const normalizeReimbursementType = (rawType) => {
    const value = (rawType || "").toString().trim().toLowerCase();

    const mapping = {
        transport: "transport",
        makan: "makan",
        konsumsi: "makan",
        kesehatan: "kesehatan",
        medical: "kesehatan",
        operasional: "operasional",
        operasional_kantor: "operasional",
        perjalanan_dinas: "operasional",
        business: "operasional",
        lainnya: "lainnya",
        other: "lainnya",
        akomodasi: "lainnya",
    };

    return mapping[value] || "";
};

// ============================
// HELPERS
// ============================
const getEmployeeIdByUser = async (userId) => {
    const [rows] = await db
        .promise()
        .query("SELECT id FROM employees WHERE user_id = ?", [userId]);
    return rows.length ? rows[0].id : null;
};

const getRoleNamesByUserId = async (userId) => {
    const [rows] = await db.promise().query(
        `SELECT r.name
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ?`,
        [userId]
    );

    return rows.map((row) => row.name);
};

const HR_REJECTION_MARKER = "[HR_REJECTION_REASON]";

const stripHrRejectionReason = (text = "") => {
    return String(text || "")
        .replace(new RegExp(`(?:\\r?\\n)?\\${HR_REJECTION_MARKER}.*$`, "gm"), "")
        .trim();
};

const upsertHrRejectionReason = (description = "", reason = "") => {
    const cleanDescription = stripHrRejectionReason(description);
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) return cleanDescription;

    return cleanDescription
        ? `${cleanDescription}\n${HR_REJECTION_MARKER} ${trimmedReason}`
        : `${HR_REJECTION_MARKER} ${trimmedReason}`;
};

// ============================
// PEGawai submit reimbursement
// ============================
router.post(
    "/",
    verifyToken,
    verifyRole(["pegawai"]),
    upload.single("attachment"),
    async (req, res) => {
        try {
            const userId = req.user?.id || req.user?.user_id;
            if (!userId || Number(userId) <= 0) {
                return res.status(401).json({ message: "Invalid authenticated user" });
            }

            const employeeId = await getEmployeeIdByUser(userId);
            if (!employeeId) {
                return res
                    .status(404)
                    .json({ message: "Employee record not found" });
            }

            const reimbursementTypeRaw = (
                req.body?.reimbursement_type || req.body?.type || req.body?.reimbursementType || ""
            ).toString().trim();
            const reimbursementType = normalizeReimbursementType(reimbursementTypeRaw);
            const amount = req.body?.amount;
            const description = (req.body?.description || "").toString().trim();

            if (!reimbursementType || !amount || !description) {
                return res.status(400).json({
                    message:
                        "reimbursement_type, amount, and description are required",
                });
            }

            if (!req.file) {
                return res
                    .status(400)
                    .json({ message: "Attachment file is required" });
            }

            const attachmentPath = `uploads/reimbursements/${req.file.filename}`;

            const [idRow] = await db
                .promise()
                .query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM reimbursements");
            const nextId = idRow?.[0]?.next_id || 1;

            await db.promise().query(
                `INSERT INTO reimbursements (
                    id, employee_id, reimbursement_type, amount, description, attachment, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
                [nextId, employeeId, reimbursementType, amount, description, attachmentPath]
            );

            res.status(201).json({
                message: "Reimbursement submitted successfully",
            });

            // Log activity: reimbursement submission
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role || null;
                await logActivity({
                    userId: userId,
                    username,
                    role,
                    action: "CREATE",
                    module: "reimbursements",
                    description: "Reimbursement submitted",
                    oldValues: null,
                    newValues: { request_id: nextId, employee_id: employeeId, reimbursement_type: reimbursementType, amount, description },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log reimbursement submission:", e);
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// Pegawai melihat reimbursement miliknya
// ============================
router.get(
    "/my",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        try {
            const employeeId = await getEmployeeIdByUser(req.user.id);
            if (!employeeId) {
                return res
                    .status(404)
                    .json({ message: "Employee record not found" });
            }

            const [rows] = await db
                .promise()
                .query(
                    `SELECT * FROM reimbursements WHERE employee_id = ? ORDER BY created_at DESC`,
                    [employeeId]
                );

            res.json({ data: rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// Admin/HR/Finance/Atasan melihat semua reimbursement
// ============================
router.get(
    "/",
    verifyToken,
    verifyRole(["hr", "finance", "atasan"]),
    async (req, res) => {
        try {
            let managerScope = null;
            const submitterRole = (req.query.submitterRole || "").toString().toLowerCase() || null;
            const requesterUserId = req.user?.id || req.user?.user_id;
            if (!requesterUserId || Number(requesterUserId) <= 0) {
                return res.status(401).json({ message: "Invalid authenticated user" });
            }

            const userRoles = req.user.roles || [];
            const hasAtasanRole = userRoles.includes("atasan");
            const hasFinanceRole = userRoles.includes("finance");
            const activeRole = String(req.headers["x-active-role"] || "").toLowerCase();

            const shouldScopeAsAtasan = hasAtasanRole && isAtasanRoleActive(req);
            const shouldScopeAsFinance =
                hasFinanceRole && (activeRole === "finance" || (!activeRole && userRoles.length === 1));

            if (shouldScopeAsAtasan) {
                managerScope = await resolveManagerScope(db, requesterUserId);
            }

            // Build department scoping clause: if managerScope exists, restrict by department and exclude the manager him/herself.
            // If the manager is a director, further restrict to employees whose position level is 'manager'.
            let deptClause = '1=1';
            const deptParams = [];
            if (managerScope) {
                if (managerScope.isDirector) {
                    deptClause = "p.level = 'manager' AND e.id <> ?";
                    deptParams.push(managerScope.managerEmployeeId);
                } else {
                    deptClause = 'p.department_id = ? AND e.id <> ?';
                    deptParams.push(managerScope.departmentId, managerScope.managerEmployeeId);
                }
            }

            const baseQuery = `SELECT r.*, e.employee_code, u.name as employee_name, u.id as submitter_user_id, p.department_id
                 FROM reimbursements r
                 JOIN employees e ON r.employee_id = e.id
                 JOIN positions p ON e.position_id = p.id
                 JOIN users u ON e.user_id = u.id
                 WHERE ${deptClause}
                                     AND (
                                         ? IS NULL OR EXISTS (
                                             SELECT 1
                                             FROM user_roles ur
                                             JOIN roles sr ON ur.role_id = sr.id
                                             WHERE ur.user_id = u.id AND sr.name = ?
                                         )
                                     )
                                     AND (
                                         ? = 0
                                         OR r.status IN ('approved', 'included_in_payroll')
                                     )
                 ORDER BY r.created_at DESC`;

            const queryParams = [...deptParams, submitterRole, submitterRole, shouldScopeAsFinance ? 1 : 0];

            const [rows] = await db.promise().query(baseQuery, queryParams);

            res.json({ data: rows });
        } catch (error) {
            console.error(error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// ============================
// Atasan approve/reject reimbursement (level 1 approval)
// ============================
router.put(
    "/:id/approve",
    verifyToken,
    verifyRole(["atasan"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { action } = req.body; // action: approve | reject
            const requesterUserId = req.user?.id || req.user?.user_id;
            if (!requesterUserId || Number(requesterUserId) <= 0) {
                return res.status(401).json({ message: "Invalid authenticated user" });
            }

            if (!action || !["approve", "reject"].includes(action)) {
                return res
                    .status(400)
                    .json({ message: "Action must be approve or reject" });
            }

            const requesterRoles = req.user.roles || [];
            const isRequesterAdmin = requesterRoles.includes("admin");
            const isRequesterAtasan = requesterRoles.includes("atasan");

            let managerScope = null;
            if (isRequesterAtasan && !isRequesterAdmin) {
                managerScope = await resolveManagerScope(db, requesterUserId);
            }

            let deptClauseCheck = '1=1';
            const deptParamsCheck = [];
            if (managerScope) {
                if (managerScope.isDirector) {
                    deptClauseCheck = "p.level = 'manager' AND e.id <> ?";
                    deptParamsCheck.push(managerScope.managerEmployeeId);
                } else {
                    deptClauseCheck = 'p.department_id = ? AND e.id <> ?';
                    deptParamsCheck.push(managerScope.departmentId, managerScope.managerEmployeeId);
                }
            }

            const [rows] = await db
                .promise()
                .query(
                    `SELECT r.status, u.id as submitter_user_id
                         FROM reimbursements r
                         JOIN employees e ON r.employee_id = e.id
                         JOIN positions p ON e.position_id = p.id
                         JOIN users u ON e.user_id = u.id
                         WHERE r.id = ? AND (${deptClauseCheck})`,
                    [
                        id,
                        ...deptParamsCheck,
                    ]
                );

            if (!rows.length) {
                return res.status(404).json({
                    message: "Reimbursement tidak ditemukan atau tidak dalam scope approval",
                });
            }

            const submitterUserId = rows[0].submitter_user_id;
            const submitterRoles = await getRoleNamesByUserId(submitterUserId);
            const submitterIsAtasan = submitterRoles.includes("atasan");
            const submitterIsHr = submitterRoles.includes("hr");

            if (rows[0].status !== "pending") {
                return res.status(400).json({ message: "Only pending can be processed" });
            }

            if (submitterIsAtasan && !isRequesterAdmin) {
                return res.status(403).json({
                    message: "Pengajuan reimbursement dari atasan hanya dapat diproses oleh admin/direktur",
                });
            }

            if (isRequesterAdmin && !submitterIsAtasan) {
                return res.status(403).json({
                    message: "Admin/direktur hanya memproses reimbursement yang diajukan oleh atasan",
                });
            }

            if (!submitterIsAtasan && !isRequesterAtasan && !isRequesterAdmin) {
                return res.status(403).json({
                    message: "Pengajuan reimbursement pegawai diproses oleh atasan",
                });
            }

            // If the submitter is HR and the manager approves, skip HR validation
            // and mark the reimbursement as already included in payroll.
            const newStatus = action === "approve"
                ? (submitterIsHr ? "included_in_payroll" : "approved")
                : "rejected";

            await db.promise().query(
                `UPDATE reimbursements 
                 SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() 
                 WHERE id = ?`,
                [newStatus, requesterUserId, id]
            );

            // Log activity: level-1 approval/rejection
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role || null;
                await logActivity({
                    userId: requesterUserId,
                    username,
                    role,
                    action: "UPDATE",
                    module: "reimbursements",
                    description: newStatus === "approved" || newStatus === "included_in_payroll" ? "Reimbursement approved by manager" : "Reimbursement rejected by manager",
                    oldValues: rows[0] || null,
                    newValues: { request_id: id, status: newStatus, approved_by: requesterUserId },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log reimbursement approval/rejection:", e);
            }

            res.json({ message: `Reimbursement ${newStatus}` });
        } catch (error) {
            console.error(error);
            res.status(error.statusCode || 500).json({
                message: error.message || "Server error",
            });
        }
    }
);

// ============================
// HR validate administrasi (level 2) -> included_in_payroll
// ============================
router.put(
    "/:id/validate",
    verifyToken,
    verifyRole(["hr"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { action } = req.body; // approve | reject
            const rejectionReason = String(req.body?.reason || req.body?.notes || "").trim();
            const requesterUserId = req.user?.id || req.user?.user_id;
            if (!requesterUserId || Number(requesterUserId) <= 0) {
                return res.status(401).json({ message: "Invalid authenticated user" });
            }

            if (!action || !["approve", "reject"].includes(action)) {
                return res
                    .status(400)
                    .json({ message: "Action must be approve or reject" });
            }

            const [rows] = await db
                .promise()
                .query(
                    `SELECT r.status, r.description, u.id as submitter_user_id
                     FROM reimbursements r
                     JOIN employees e ON r.employee_id = e.id
                     JOIN users u ON e.user_id = u.id
                     WHERE r.id = ?`,
                    [id]
                );

            if (!rows.length) {
                return res.status(404).json({ message: "Reimbursement not found" });
            }

            if (rows[0].status !== "approved") {
                return res.status(400).json({ message: "Only approved items can be validated" });
            }

            if (Number(rows[0].submitter_user_id) === Number(requesterUserId)) {
                return res.status(403).json({
                    message: "Validator tidak boleh memvalidasi reimbursement miliknya sendiri",
                });
            }

            if (action === "reject" && !rejectionReason) {
                return res.status(400).json({
                    message: "Alasan penolakan wajib diisi",
                });
            }

            const newStatus = action === "approve" ? "included_in_payroll" : "rejected";

            if (action === "reject") {
                const nextDescription = upsertHrRejectionReason(rows[0].description, rejectionReason);
                await db.promise().query(
                    `UPDATE reimbursements SET status = ?, description = ?, updated_at = NOW() WHERE id = ?`,
                    [newStatus, nextDescription, id]
                );
            } else {
                await db.promise().query(
                    `UPDATE reimbursements SET status = ?, updated_at = NOW() WHERE id = ?`,
                    [newStatus, id]
                );
            }

            // Log activity: HR validation (level-2)
            try {
                const username = req.user.username || req.user.name || null;
                const role = Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.role || null;
                await logActivity({
                    userId: requesterUserId,
                    username,
                    role,
                    action: "UPDATE",
                    module: "reimbursements",
                    description: action === "approve" ? "Reimbursement validated and included in payroll" : "Reimbursement rejected by HR",
                    oldValues: rows[0] || null,
                    newValues: { request_id: id, status: newStatus, hr_rejection_reason: action === "reject" ? rejectionReason : null },
                    ipAddress: getIpAddress(req),
                    userAgent: getUserAgent(req),
                    status: "success",
                });
            } catch (e) {
                console.error("Failed to log reimbursement validation:", e);
            }

            res.json({ message: `Reimbursement ${newStatus}` });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;

