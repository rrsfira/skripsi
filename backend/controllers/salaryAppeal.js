const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { logActivity, getIpAddress, getUserAgent } = require("../middleware/activityLogger");

// ============================
// MULTER SETUP - Supporting Documents
// ============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDir = path.join(__dirname, "../uploads/banding_gaji");
        fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `appeal-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Only PDF/JPG/PNG are allowed"));
};

const upload = multer({ storage, fileFilter });

const APPEAL_REASON_OPTION_MAP = {
    basic_salary: {
        label: "Pendapatan - Gaji Pokok",
        payrollField: "basic_salary",
    },
    allowance: {
        label: "Pendapatan - Total Tunjangan",
        payrollField: "allowance",
    },
    transport_allowance: {
        label: "Pendapatan - Tunjangan Transport",
        payrollField: "transport_allowance",
    },
    meal_allowance: {
        label: "Pendapatan - Tunjangan Makan",
        payrollField: "meal_allowance",
    },
    health_allowance: {
        label: "Pendapatan - Tunjangan Kesehatan",
        payrollField: "health_allowance",
    },
    bonus: {
        label: "Pendapatan - Bonus",
        payrollField: "bonus",
    },
    other_allowance: {
        label: "Pendapatan - Tunjangan Lainnya",
        payrollField: "other_allowance",
    },
    reimbursement_total: {
        label: "Pendapatan - Reimbursement",
        payrollField: "reimbursement_total",
    },
    gross_salary: {
        label: "Pendapatan - Gaji Kotor",
        payrollField: "gross_salary",
    },
    total_income: {
        label: "Pendapatan - Total Pendapatan",
        payrollField: "total_income",
    },
    late_deduction: {
        label: "Potongan - Keterlambatan",
        payrollField: "late_deduction",
    },
    absent_deduction: {
        label: "Potongan - Alpha",
        payrollField: "absent_deduction",
    },
    bpjs_deduction: {
        label: "Potongan - BPJS",
        payrollField: "bpjs_deduction",
    },
    tax_deduction: {
        label: "Potongan - Pajak",
        payrollField: "tax_deduction",
    },
    other_deduction: {
        label: "Potongan - Lainnya",
        payrollField: "other_deduction",
    },
    deduction: {
        label: "Potongan - Total Potongan",
        payrollField: "deduction",
    },
};

const APPEAL_REASON_PREFIX = "[appeal_option:";
const REIMBURSEMENT_APPEAL_KEY = "reimbursement_total";

const getAppealReasonKeyByLabel = (label) => {
    const normalizedLabel = String(label || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedLabel) return null;

    const exactMatch = Object.entries(APPEAL_REASON_OPTION_MAP).find(
        ([, config]) =>
            String(config?.label || "")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim() === normalizedLabel
    );

    if (exactMatch) {
        return exactMatch[0];
    }

    const partialMatch = Object.entries(APPEAL_REASON_OPTION_MAP).find(
        ([, config]) => {
            const optionLabel = String(config?.label || "")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();
            return (
                optionLabel.includes(normalizedLabel) ||
                normalizedLabel.includes(optionLabel)
            );
        }
    );

    return partialMatch ? partialMatch[0] : null;
};

const serializeAppealReason = (appealReasonItem, reasonText) => {
    const cleanedReason = String(reasonText || "").trim();
    return `${APPEAL_REASON_PREFIX}${appealReasonItem}] ${cleanedReason}`;
};

const deserializeAppealReason = (storedReason) => {
    const raw = String(storedReason || "");
    const match = raw.match(/^\[appeal_option:([a-z_]+)\]\s*(.*)$/s);

    if (!match) {
        return {
            appeal_reason_item: null,
            appeal_reason_label: null,
            reason_text: raw,
        };
    }

    const appealReasonItem = match[1];
    return {
        appeal_reason_item: appealReasonItem,
        appeal_reason_label:
            APPEAL_REASON_OPTION_MAP[appealReasonItem]?.label || appealReasonItem,
        reason_text: match[2] || "",
    };
};

const parseAppealReasonEntries = (storedReason) => {
    const raw = String(storedReason || "").trim();
    if (!raw) return [];

    const lines = raw.split(/\r?\n/).filter((line) => line.trim());
    const parsedLines = lines
        .map((line) => {
            const parsed = deserializeAppealReason(line);
            if (!parsed.appeal_reason_item) {
                return null;
            }

            return {
                appeal_reason_item: parsed.appeal_reason_item,
                appeal_reason_label: parsed.appeal_reason_label,
                reason: parsed.reason_text,
            };
        })
        .filter(Boolean);

    if (parsedLines.length === lines.length && parsedLines.length > 0) {
        return parsedLines;
    }

    const singleParsed = deserializeAppealReason(raw);
    return [
        {
            appeal_reason_item: singleParsed.appeal_reason_item,
            appeal_reason_label: singleParsed.appeal_reason_label,
            reason: singleParsed.reason_text,
        },
    ];
};

const serializeAppealReasonItems = (items) => {
    return items
        .map((item) =>
            serializeAppealReason(item.appeal_reason_item, item.reason)
        )
        .join("\n");
};

const parseReviewNotesEntries = (reviewNotes) => {
    const raw = String(reviewNotes || "").trim();
    if (!raw) return [];

    const lines = raw.split(/\r?\n/).filter((line) => line.trim());

    return lines.map((line) => {
        const approvedMatch = line.match(/^\[(.+?)\]\s*disetujui,\s*nominal perbaikan:\s*([0-9.,]+)/i);
        if (approvedMatch) {
            const reasonKey = getAppealReasonKeyByLabel(approvedMatch[1]);
            return {
                label: approvedMatch[1],
                reason_key: reasonKey,
                appeal_reason_item: reasonKey,
                decision: "approve",
                adjustment_amount:
                    Number(String(approvedMatch[2] || "0").replace(/\./g, "").replace(/,/g, ".")) ||
                    0,
                rejection_note: "",
            };
        }

        const rejectedMatch = line.match(/^\[(.+?)\]\s*ditolak,\s*alasan:\s*(.+)$/i);
        if (rejectedMatch) {
            const reasonKey = getAppealReasonKeyByLabel(rejectedMatch[1]);
            return {
                label: rejectedMatch[1],
                reason_key: reasonKey,
                appeal_reason_item: reasonKey,
                decision: "reject",
                adjustment_amount: null,
                rejection_note: rejectedMatch[2] || "",
            };
        }

        return {
            label: "",
            reason_key: null,
            appeal_reason_item: null,
            decision: "",
            adjustment_amount: null,
            rejection_note: line,
        };
    });
};

const getPublicFileUrl = (req, filePath) => {
    if (!filePath) return null;
    const normalizedPath = String(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
    return `${req.protocol}://${req.get("host")}/${normalizedPath}`;
};

const removeUploadedFile = (relativePath) => {
    if (!relativePath) return;

    const normalizedRelativePath = String(relativePath).replace(/^\/+/, "");
    const absolutePath = path.join(__dirname, "..", normalizedRelativePath);

    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};

const getActiveRole = (req) =>
    String(req.headers["x-active-role"] || "")
        .toLowerCase()
        .trim();

const hasRoleInToken = (req, roleName) => {
    const tokenRoles = req.user?.roles || [];
    return tokenRoles.includes(roleName) || req.user?.role === roleName;
};

const isRoleContextActive = (req, roleName) => {
    const activeRole = getActiveRole(req);
    if (activeRole) {
        return activeRole === roleName;
    }

    return hasRoleInToken(req, roleName);
};

// ============================
// HELPERS
// ============================
const getEmployeeIdByUser = async (userId) => {
    const [rows] = await db
        .promise()
        .query("SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL", [userId]);
    return rows.length ? rows[0].id : null;
};

const hasPendingAppeal = async (payrollId) => {
    const [rows] = await db.promise().query(
        `SELECT COUNT(*) AS pending_count
         FROM salary_appeals
         WHERE payroll_id = ? AND status = 'pending' AND deleted_at IS NULL`,
        [payrollId]
    );

    return Number(rows[0]?.pending_count || 0) > 0;
};

const syncPayrollAppealStatus = async (payrollId) => {
    const [statusRows] = await db.promise().query(
        `SELECT status, COUNT(*) AS total
         FROM salary_appeals
         WHERE payroll_id = ? AND deleted_at IS NULL
         GROUP BY status`,
        [payrollId]
    );

    const statusMap = statusRows.reduce((accumulator, row) => {
        accumulator[row.status] = Number(row.total || 0);
        return accumulator;
    }, {});

    let targetStatus = null;
    if (statusMap.pending > 0) {
        targetStatus = "pending";
    } else if (statusMap.approved > 0) {
        targetStatus = "approved";
    } else if (statusMap.rejected > 0) {
        targetStatus = "rejected";
    }

    await db.promise().query(
        `UPDATE payrolls
         SET appeal_status = ?, updated_at = NOW()
         WHERE id = ?`,
        [targetStatus, payrollId]
    );

    return targetStatus;
};

const parseAppealItemsPayload = (reqBody = {}) => {
    if (reqBody.appeal_items) {
        if (Array.isArray(reqBody.appeal_items)) {
            return reqBody.appeal_items;
        }

        if (typeof reqBody.appeal_items === "string") {
            try {
                const parsed = JSON.parse(reqBody.appeal_items);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }
    }

    if (reqBody.appeal_reason_item || reqBody.reason) {
        return [
            {
                appeal_reason_item: reqBody.appeal_reason_item,
                reason: reqBody.reason,
            },
        ];
    }

    return [];
};

// ============================
// Pegawai submit salary appeal (banding gaji)
// ============================
router.post(
    "/",
    verifyToken,
    verifyRole(["pegawai"]),
    upload.single("supporting_documents"),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const employeeId = await getEmployeeIdByUser(userId);

            if (!employeeId) {
                return res
                    .status(404)
                    .json({ message: "Employee record not found" });
            }

            const { payroll_id } = req.body;
            const appealItems = parseAppealItemsPayload(req.body)
                .map((item) => ({
                    appeal_reason_item: String(item.appeal_reason_item || "").trim(),
                    reason: String(item.reason || "").trim(),
                }))
                .filter((item) => item.appeal_reason_item || item.reason);

            if (!payroll_id || appealItems.length === 0) {
                return res.status(400).json({
                    message: "payroll_id and appeal_items are required",
                });
            }

            const hasInvalidItem = appealItems.some(
                (item) =>
                    !item.appeal_reason_item ||
                    !item.reason ||
                    !APPEAL_REASON_OPTION_MAP[item.appeal_reason_item]
            );
            if (hasInvalidItem) {
                return res.status(400).json({
                    message: "All appeal_items must contain valid appeal_reason_item and reason",
                });
            }

            const selectedKeys = appealItems.map((item) => item.appeal_reason_item);
            if (new Set(selectedKeys).size !== selectedKeys.length) {
                return res.status(400).json({
                    message: "Duplicate appeal_reason_item in appeal_items is not allowed",
                });
            }

            // Validasi payroll exists dan published
            const [payrollCheck] = await db
                .promise()
                .query(
                    `SELECT id, employee_id, status, appeal_status,
                            basic_salary, allowance, transport_allowance, meal_allowance, health_allowance, bonus, other_allowance, reimbursement_total,
                            gross_salary, total_income,
                            late_deduction, absent_deduction, bpjs_deduction, tax_deduction, other_deduction, deduction
                     FROM payrolls
                     WHERE id = ? AND deleted_at IS NULL`,
                    [payroll_id]
                );

            if (payrollCheck.length === 0) {
                return res.status(404).json({ message: "Payroll not found" });
            }

            const payroll = payrollCheck[0];

            // Validasi: hanya employee yang punya payroll yang bisa banding
            if (payroll.employee_id !== employeeId) {
                return res
                    .status(403)
                    .json({ message: "You can only appeal your own payroll" });
            }

            // Validasi: payroll harus sudah published
            if (payroll.status !== "published") {
                return res.status(400).json({
                    message: "You can only appeal published payroll",
                });
            }

            const [existingAppealRows] = await db.promise().query(
                `SELECT COUNT(*) AS total
                 FROM salary_appeals
                 WHERE employee_id = ? AND payroll_id = ? AND deleted_at IS NULL`,
                [employeeId, payroll_id]
            );

            if (Number(existingAppealRows[0]?.total || 0) > 0) {
                return res.status(400).json({
                    message: "Banding gaji hanya bisa diajukan 1 kali untuk setiap slip gaji",
                });
            }

            for (const appealItem of appealItems) {
                const pendingAppealPrefix = `${APPEAL_REASON_PREFIX}${appealItem.appeal_reason_item}]%`;
                const [pendingSameComponentRows] = await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM salary_appeals
                     WHERE payroll_id = ?
                       AND status = 'pending'
                                             AND deleted_at IS NULL
                       AND reason LIKE ?`,
                    [payroll_id, pendingAppealPrefix]
                );

                if (Number(pendingSameComponentRows[0]?.total || 0) > 0) {
                    return res.status(400).json({
                        message: `Komponen ${appealItem.appeal_reason_item} sudah diajukan banding dan masih pending`,
                    });
                }

                const selectedOption =
                    APPEAL_REASON_OPTION_MAP[appealItem.appeal_reason_item];
                if (!(selectedOption.payrollField in payroll)) {
                    return res.status(400).json({
                        message:
                            "Komponen alasan banding tidak ditemukan pada slip gaji",
                    });
                }
            }

            const supportingDoc = req.file
                ? `uploads/banding_gaji/${req.file.filename}`
                : null;

            const serializedReason = serializeAppealReasonItems(appealItems);

            // Insert salary appeal
            await db.promise().query(
                `INSERT INTO salary_appeals 
                (employee_id, payroll_id, reason, expected_amount, supporting_documents, status, created_at) 
                VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
                [
                    employeeId,
                    payroll_id,
                    serializedReason,
                    null,
                    supportingDoc,
                ]
            );

            await syncPayrollAppealStatus(payroll_id);

            // Log salary appeal submission
            await logActivity({
                userId: req.user.id,
                username: req.user.username || req.user.name || null,
                role: req.user.roles?.[0] || req.user.role || null,
                action: "CREATE",
                module: "salary_appeals",
                description: `Submitted salary appeal for payroll_id ${payroll_id}`,
                newValues: { payroll_id, appeal_items_count: Array.isArray(appealItems) ? appealItems.length : 0, status: 'pending' },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.status(201).json({
                message: "Salary appeal submitted successfully",
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// Pegawai lihat salary appeals miliknya
// ============================
router.get("/my", verifyToken, verifyRole(["pegawai"]), async (req, res) => {
    try {
        const employeeId = await getEmployeeIdByUser(req.user.id);
        if (!employeeId) {
            return res
                .status(404)
                .json({ message: "Employee record not found" });
        }

        const [rows] = await db.promise().query(
            `SELECT sa.*, p.period_month, p.period_year, p.status as payroll_status,
                    p.final_amount, p.net_salary,
                    p.basic_salary, p.allowance,
                    p.transport_allowance, p.meal_allowance, p.health_allowance,
                    p.bonus, p.other_allowance,
                    p.reimbursement_total, p.gross_salary, p.total_income,
                    p.late_deduction, p.absent_deduction,
                    p.bpjs_deduction, p.tax_deduction, p.other_deduction, p.deduction,
                    p.appeal_status
             FROM salary_appeals sa
             JOIN payrolls p ON sa.payroll_id = p.id
             WHERE sa.employee_id = ? AND sa.deleted_at IS NULL AND p.deleted_at IS NULL
             ORDER BY sa.created_at DESC`,
            [employeeId]
        );

        const mappedRows = rows.map((item) => {
            const parsedEntries = parseAppealReasonEntries(item.reason);
            const parsedReviewEntries = parseReviewNotesEntries(item.review_notes);
            return {
                ...item,
                reason: parsedEntries.map((entry) => entry.reason).join("\n"),
                appeal_reason_item:
                    parsedEntries.length === 1
                        ? parsedEntries[0].appeal_reason_item
                        : null,
                appeal_reason_label:
                    parsedEntries.length === 1
                        ? parsedEntries[0].appeal_reason_label
                        : parsedEntries
                              .map((entry) => entry.appeal_reason_label)
                              .filter(Boolean)
                              .join(", "),
                appeal_reason_items: parsedEntries,
                review_result_items: parsedReviewEntries,
                supporting_documents_url: getPublicFileUrl(
                    req,
                    item.supporting_documents
                ),
                payroll_pdf_url: `${req.protocol}://${req.get("host")}/api/payroll/${item.payroll_id}/pdf`,
            };
        });

        res.json({ data: mappedRows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// Pegawai update salary appeal miliknya
// ============================
router.put(
    "/:id",
    verifyToken,
    verifyRole(["pegawai"]),
    upload.single("supporting_documents"),
    async (req, res) => {
        try {
            const employeeId = await getEmployeeIdByUser(req.user.id);
            if (!employeeId) {
                return res
                    .status(404)
                    .json({ message: "Employee record not found" });
            }

            const { id } = req.params;
            const appealItems = parseAppealItemsPayload(req.body)
                .map((item) => ({
                    appeal_reason_item: String(item.appeal_reason_item || "").trim(),
                    reason: String(item.reason || "").trim(),
                }))
                .filter((item) => item.appeal_reason_item || item.reason);

            if (appealItems.length === 0) {
                return res.status(400).json({
                    message: "appeal_items are required",
                });
            }

            const hasInvalidItem = appealItems.some(
                (item) =>
                    !item.appeal_reason_item ||
                    !item.reason ||
                    !APPEAL_REASON_OPTION_MAP[item.appeal_reason_item]
            );

            if (hasInvalidItem) {
                return res.status(400).json({
                    message: "All appeal_items must contain valid appeal_reason_item and reason",
                });
            }

            const selectedKeys = appealItems.map((item) => item.appeal_reason_item);
            if (new Set(selectedKeys).size !== selectedKeys.length) {
                return res.status(400).json({
                    message: "Duplicate appeal_reason_item in appeal_items is not allowed",
                });
            }

            const [appealRows] = await db.promise().query(
                `SELECT sa.id, sa.employee_id, sa.payroll_id, sa.status, sa.supporting_documents,
                        p.status as payroll_status,
                        p.basic_salary, p.allowance, p.transport_allowance, p.meal_allowance, p.health_allowance, p.bonus, p.other_allowance,
                        p.reimbursement_total, p.gross_salary, p.total_income,
                        p.late_deduction, p.absent_deduction, p.bpjs_deduction, p.tax_deduction, p.other_deduction, p.deduction
                 FROM salary_appeals sa
                 JOIN payrolls p ON sa.payroll_id = p.id
                 WHERE sa.id = ? AND sa.deleted_at IS NULL AND p.deleted_at IS NULL`,
                [id]
            );

            if (!appealRows.length) {
                return res.status(404).json({ message: "Salary appeal not found" });
            }

            const appeal = appealRows[0];

            if (Number(appeal.employee_id) !== Number(employeeId)) {
                return res
                    .status(403)
                    .json({ message: "You can only edit your own salary appeal" });
            }

            if (appeal.status !== "pending") {
                return res.status(400).json({
                    message: "Only pending salary appeal can be edited",
                });
            }

            for (const appealItem of appealItems) {
                const selectedOption =
                    APPEAL_REASON_OPTION_MAP[appealItem.appeal_reason_item];
                if (!(selectedOption.payrollField in appeal)) {
                    return res.status(400).json({
                        message: "Komponen alasan banding tidak ditemukan pada slip gaji",
                    });
                }

                const pendingAppealPrefix = `${APPEAL_REASON_PREFIX}${appealItem.appeal_reason_item}]%`;
                const [pendingSameComponentRows] = await db.promise().query(
                    `SELECT COUNT(*) AS total
                     FROM salary_appeals
                     WHERE payroll_id = ?
                       AND status = 'pending'
                                             AND deleted_at IS NULL
                       AND id <> ?
                       AND reason LIKE ?`,
                    [appeal.payroll_id, id, pendingAppealPrefix]
                );

                if (Number(pendingSameComponentRows[0]?.total || 0) > 0) {
                    return res.status(400).json({
                        message: `Komponen ${appealItem.appeal_reason_item} sudah diajukan banding dan masih pending`,
                    });
                }
            }

            const serializedReason = serializeAppealReasonItems(appealItems);

            const newSupportingDocument = req.file
                ? `uploads/banding_gaji/${req.file.filename}`
                : appeal.supporting_documents;

            await db.promise().query(
                `UPDATE salary_appeals
                 SET reason = ?, supporting_documents = ?, updated_at = NOW()
                 WHERE id = ? AND deleted_at IS NULL`,
                [serializedReason, newSupportingDocument, id]
            );

            if (req.file && appeal.supporting_documents) {
                try {
                    removeUploadedFile(appeal.supporting_documents);
                } catch (fileError) {
                    console.error(fileError);
                }
            }

            // Log salary appeal update
            await logActivity({
                userId: req.user.id,
                username: req.user.username || req.user.name || null,
                role: req.user.roles?.[0] || req.user.role || null,
                action: "UPDATE",
                module: "salary_appeals",
                description: `Updated salary appeal id ${id}`,
                oldValues: { id: appeal.id, status: appeal.status },
                newValues: { id: id, status: 'pending' },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.json({ message: "Salary appeal updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// Pegawai delete salary appeal miliknya
// ============================
router.delete(
    "/:id",
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

            const { id } = req.params;

            const [appealRows] = await db.promise().query(
                `SELECT id, employee_id, payroll_id, status, supporting_documents
                 FROM salary_appeals
                 WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );

            if (!appealRows.length) {
                return res.status(404).json({ message: "Salary appeal not found" });
            }

            const appeal = appealRows[0];

            if (Number(appeal.employee_id) !== Number(employeeId)) {
                return res
                    .status(403)
                    .json({ message: "You can only delete your own salary appeal" });
            }

            if (appeal.status !== "pending") {
                return res.status(400).json({
                    message: "Only pending salary appeal can be deleted",
                });
            }

            await db.promise().query(
                `UPDATE salary_appeals
                 SET deleted_at = NOW(),
                     status = 'rejected',
                     review_notes = COALESCE(review_notes, 'Deleted by employee'),
                     updated_at = NOW()
                 WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            await syncPayrollAppealStatus(appeal.payroll_id);

            // Log salary appeal deletion
            await logActivity({
                userId: req.user.id,
                username: req.user.username || req.user.name || null,
                role: req.user.roles?.[0] || req.user.role || null,
                action: "DELETE",
                module: "salary_appeals",
                description: `Deleted salary appeal id ${id}`,
                oldValues: { id: appeal.id, status: appeal.status },
                newValues: { id: id, status: 'rejected', deleted_at: new Date().toISOString() },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.json({ message: "Salary appeal deleted successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ============================
// HR/Admin lihat semua salary appeals
// ============================
router.get(
    "/",
    verifyToken,
    verifyRole(["hr", "admin", "finance"]),
    async (req, res) => {
    try {
        const { status, search, month, year } = req.query;
        const isFinanceRequester = isRoleContextActive(req, "finance");
        const isAdminRequester = isRoleContextActive(req, "admin");
        const isHrRequester = isRoleContextActive(req, "hr");

        let query = `SELECT sa.*,
                            e.employee_code,
                            u.name as employee_name,
                            COALESCE(NULLIF(e.full_name, ''), u.name) as full_name,
                            u.photo as employee_photo,
                            d.name as department_name,
                            pos.name as position_name,
                            p.period_month,
                            p.period_year,
                            p.status as payroll_status,
                            p.net_salary,
                            p.final_amount,
                            p.basic_salary,
                            p.allowance as total_allowances,
                            p.deduction as total_deductions,
                            p.total_income,
                            reviewer_user.name as reviewer_name
                     FROM salary_appeals sa
                     JOIN employees e ON sa.employee_id = e.id
                     JOIN users u ON e.user_id = u.id
                     LEFT JOIN positions pos ON e.position_id = pos.id
                     LEFT JOIN departments d ON pos.department_id = d.id
                     JOIN payrolls p ON sa.payroll_id = p.id
                     LEFT JOIN employees reviewer_emp ON sa.reviewed_by = reviewer_emp.id
                     LEFT JOIN users reviewer_user ON reviewer_emp.user_id = reviewer_user.id
                                         WHERE 1=1
                                             AND sa.deleted_at IS NULL
                                             AND p.deleted_at IS NULL`;
        const params = [];

        if (isFinanceRequester) {
            query += " AND sa.status = 'approved'";
        } else {
            if (status) {
                query += " AND sa.status = ?";
                params.push(status);
            }
        }

        if (month && year) {
            query += " AND p.period_month = ? AND p.period_year = ?";
            params.push(Number(month), Number(year));
        }

        if (search) {
            query += ` AND (
                u.name LIKE ?
                OR e.employee_code LIKE ?
                OR COALESCE(NULLIF(e.full_name, ''), u.name) LIKE ?
                OR d.name LIKE ?
                OR pos.name LIKE ?
            )`;
            const searchValue = `%${search}%`;
            params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
        }

        query += " ORDER BY sa.created_at DESC";

        const [rows] = await db.promise().query(query, params);

        const mappedRows = rows.map((item) => {
            const parsedEntries = parseAppealReasonEntries(item.reason);
            const parsedReviewEntries = parseReviewNotesEntries(item.review_notes);
            return {
                ...item,
                reason: parsedEntries.map((entry) => entry.reason).join("\n"),
                appeal_reason_item:
                    parsedEntries.length === 1
                        ? parsedEntries[0].appeal_reason_item
                        : null,
                appeal_reason_label:
                    parsedEntries.length === 1
                        ? parsedEntries[0].appeal_reason_label
                        : parsedEntries
                              .map((entry) => entry.appeal_reason_label)
                              .filter(Boolean)
                              .join(", "),
                appeal_reason_items: parsedEntries,
                review_result_items: parsedReviewEntries,
                supporting_documents_url: getPublicFileUrl(
                    req,
                    item.supporting_documents
                ),
                payroll_pdf_url: `${req.protocol}://${req.get("host")}/api/payroll/${item.payroll_id}/pdf`,
            };
        });

        res.json({ data: mappedRows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}
);

// ============================
// HR approve/reject salary appeal
// ============================
router.put("/:id/review", verifyToken, verifyRole(["hr", "admin"]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            action,
            review_notes,
            adjustment_amount,
            review_items,
            status,
            notes,
        } = req.body;

        let normalizedReviewItems = [];
        if (Array.isArray(review_items)) {
            normalizedReviewItems = review_items;
        } else if (typeof review_items === "string") {
            try {
                const parsedItems = JSON.parse(review_items);
                normalizedReviewItems = Array.isArray(parsedItems)
                    ? parsedItems
                    : [];
            } catch (error) {
                normalizedReviewItems = [];
            }
        }
        const hasDetailedReviewItems = normalizedReviewItems.length > 0;

        const normalizedAction =
            action ||
            (status === "approved"
                ? "approve"
                : status === "rejected"
                  ? "reject"
                  : null);
        const normalizedReviewNotes =
            review_notes !== undefined ? review_notes : notes;

        if (!normalizedAction || !["approve", "reject"].includes(normalizedAction)) {
            return res
                .status(400)
                .json({ message: "Action must be approve or reject" });
        }

        let parsedAdjustmentAmount = null;
        if (!hasDetailedReviewItems && normalizedAction === "approve") {
            parsedAdjustmentAmount = Number(adjustment_amount);
            if (!Number.isFinite(parsedAdjustmentAmount) || parsedAdjustmentAmount < 0) {
                return res.status(400).json({
                    message: "Nominal perbaikan wajib diisi saat menyetujui banding",
                });
            }
        }

        if (
            !hasDetailedReviewItems &&
            normalizedAction === "reject" &&
            !String(normalizedReviewNotes || "").trim()
        ) {
            return res.status(400).json({
                message: "Catatan alasan penolakan wajib diisi",
            });
        }

        const requesterIsHr = isRoleContextActive(req, "hr");
        const requesterIsAdmin = isRoleContextActive(req, "admin");
        const userId = req.user.id;
        const reviewerId = await getEmployeeIdByUser(userId);

        if (!reviewerId) {
            return res
                .status(404)
                .json({ message: "Reviewer employee record not found" });
        }

        // Get appeal info
        const [appealRows] = await db
            .promise()
            .query(
                `SELECT sa.id,
                        sa.payroll_id,
                        sa.status,
                        sa.reason,
                        sa.employee_id
                 FROM salary_appeals sa
                 WHERE sa.id = ? AND sa.deleted_at IS NULL`,
                [id]
            );

        if (appealRows.length === 0) {
            return res.status(404).json({ message: "Salary appeal not found" });
        }

        const appeal = appealRows[0];

        if (appeal.status !== "pending") {
            return res.status(400).json({
                message: "Only pending appeals can be reviewed",
            });
        }

        let cachedAutoReimbursementAmount = null;
        const resolveAutoReimbursementAmount = async () => {
            if (cachedAutoReimbursementAmount !== null) {
                return cachedAutoReimbursementAmount;
            }

            const [rows] = await db.promise().query(
                `SELECT SUM(r.amount) AS total_reimbursement
                 FROM payrolls p
                 LEFT JOIN reimbursements r
                   ON r.employee_id = p.employee_id
                  AND r.status IN ('approved', 'included_in_payroll')
                  AND DATE_FORMAT(r.created_at, '%Y-%m') = CONCAT(p.period_year, '-', LPAD(p.period_month, 2, '0'))
                                 WHERE p.id = ? AND p.deleted_at IS NULL`,
                [appeal.payroll_id]
            );

            cachedAutoReimbursementAmount = Number(
                rows?.[0]?.total_reimbursement || 0
            );
            return cachedAutoReimbursementAmount;
        };

        if (normalizedReviewItems.length > 0) {
            const existingAppealItems = parseAppealReasonEntries(appeal.reason)
                .map((item) => item.appeal_reason_item)
                .filter(Boolean);

            if (!existingAppealItems.length) {
                return res.status(400).json({
                    message: "Data alasan banding tidak valid untuk direview",
                });
            }

            const normalizedItems = normalizedReviewItems.map((item) => ({
                appeal_reason_item: String(item.appeal_reason_item || "").trim(),
                decision: String(item.decision || "").trim(),
                adjustment_amount:
                    item.adjustment_amount !== undefined &&
                    item.adjustment_amount !== null &&
                    item.adjustment_amount !== ""
                        ? Number(item.adjustment_amount)
                        : null,
                rejection_note: String(item.rejection_note || "").trim(),
            }));

            const payloadKeys = normalizedItems
                .map((item) => item.appeal_reason_item)
                .filter(Boolean);
            const uniquePayloadKeys = new Set(payloadKeys);
            const existingKeySet = new Set(existingAppealItems);

            if (
                !normalizedItems.length ||
                payloadKeys.length !== normalizedItems.length ||
                payloadKeys.length !== uniquePayloadKeys.size ||
                payloadKeys.length !== existingAppealItems.length ||
                payloadKeys.some((key) => !existingKeySet.has(key))
            ) {
                return res.status(400).json({
                    message:
                        "review_items harus lengkap dan sesuai semua komponen alasan banding",
                });
            }

            let approvedCount = 0;
            let rejectedCount = 0;
            let totalAdjustmentAmount = 0;

            for (const reviewItem of normalizedItems) {
                if (!["approve", "reject"].includes(reviewItem.decision)) {
                    return res.status(400).json({
                        message:
                            "Setiap review item harus memiliki decision approve atau reject",
                    });
                }

                if (reviewItem.decision === "approve") {
                    if (
                        reviewItem.appeal_reason_item ===
                            REIMBURSEMENT_APPEAL_KEY &&
                        !Number.isFinite(reviewItem.adjustment_amount)
                    ) {
                        reviewItem.adjustment_amount =
                            await resolveAutoReimbursementAmount();
                    }

                    if (
                        !Number.isFinite(reviewItem.adjustment_amount) ||
                        reviewItem.adjustment_amount < 0
                    ) {
                        return res.status(400).json({
                            message:
                                "Nominal perbaikan wajib diisi untuk item yang disetujui",
                        });
                    }

                    approvedCount += 1;
                    totalAdjustmentAmount += reviewItem.adjustment_amount;
                }

                if (reviewItem.decision === "reject") {
                    if (!reviewItem.rejection_note) {
                        return res.status(400).json({
                            message:
                                "Catatan alasan penolakan wajib diisi untuk item yang ditolak",
                        });
                    }

                    rejectedCount += 1;
                }
            }

            const newStatus = approvedCount > 0 ? "approved" : "rejected";

            const serializedReviewNotes = normalizedItems
                .map((reviewItem) => {
                    const label =
                        APPEAL_REASON_OPTION_MAP[reviewItem.appeal_reason_item]
                            ?.label || reviewItem.appeal_reason_item;

                    if (reviewItem.decision === "approve") {
                        return `[${label}] disetujui, nominal perbaikan: ${reviewItem.adjustment_amount}`;
                    }

                    return `[${label}] ditolak, alasan: ${reviewItem.rejection_note}`;
                })
                .join("\n");

            await db.promise().query(
                `UPDATE salary_appeals 
                 SET status = ?, reviewed_by = ?, review_notes = ?, expected_amount = ?, reviewed_at = NOW(), updated_at = NOW()
                 WHERE id = ?`,
                [
                    newStatus,
                    reviewerId,
                    serializedReviewNotes,
                    approvedCount > 0 ? totalAdjustmentAmount : null,
                    id,
                ]
            );

            const payrollAppealStatus = await syncPayrollAppealStatus(
                appeal.payroll_id
            );

            // Log salary appeal review (detailed items)
            await logActivity({
                userId: req.user.id,
                username: req.user.username || req.user.name || null,
                role: req.user.roles?.[0] || req.user.role || null,
                action: "UPDATE",
                module: "salary_appeals",
                description: `Reviewed salary appeal id ${id}: ${newStatus}`,
                oldValues: { id: appeal.id, status: appeal.status },
                newValues: { id: appeal.id, status: newStatus, approved_items: approvedCount, rejected_items: rejectedCount },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            return res.json({
                message: `Salary appeal ${newStatus}`,
                payroll_appeal_status: payrollAppealStatus,
                review_summary: {
                    approved_items: approvedCount,
                    rejected_items: rejectedCount,
                    total_adjustment_amount: totalAdjustmentAmount,
                },
                next_step:
                    newStatus === "approved"
                        ? "Finance should create new payroll slip"
                        : "Employee can claim the original payroll",
            });
        }

        const newStatus = normalizedAction === "approve" ? "approved" : "rejected";

        // Update salary appeal
        await db.promise().query(
            `UPDATE salary_appeals 
                 SET status = ?, reviewed_by = ?, review_notes = ?, expected_amount = ?, reviewed_at = NOW(), updated_at = NOW()
                 WHERE id = ?`,
            [
                newStatus,
                reviewerId,
                String(normalizedReviewNotes || "").trim() || null,
                parsedAdjustmentAmount,
                id,
            ]
        );

        const payrollAppealStatus = await syncPayrollAppealStatus(appeal.payroll_id);

        // Log salary appeal review (simple path)
        await logActivity({
            userId: req.user.id,
            username: req.user.username || req.user.name || null,
            role: req.user.roles?.[0] || req.user.role || null,
            action: "UPDATE",
            module: "salary_appeals",
            description: `Reviewed salary appeal id ${id}: ${newStatus}`,
            oldValues: { id: appeal.id, status: appeal.status },
            newValues: { id: appeal.id, status: newStatus, review_notes: normalizedReviewNotes || null },
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
        });

        res.json({
            message: `Salary appeal ${newStatus}`,
            payroll_appeal_status: payrollAppealStatus,
            next_step:
                normalizedAction === "approve"
                    ? "Finance should create new payroll slip"
                    : "Employee can claim the original payroll",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// Finance create new payroll slip after appeal approved
// ============================
router.post(
    "/:appeal_id/create-revised-payroll",
    verifyToken,
    verifyRole(["finance", "admin"]),
    async (req, res) => {
        try {
            const { appeal_id } = req.params;
            const {
                final_amount,
                basic_salary,
                transport_allowance,
                meal_allowance,
                health_allowance,
                bonus,
                other_allowance,
                other_deduction,
                allowance,
                gross_salary,
                reimbursement_total,
                total_income,
                deduction,
                late_deduction,
                absent_deduction,
                bpjs_deduction,
                tax_deduction,
                total_late_days,
                total_absent_days,
                total_sakit_days,
                total_izin_days,
                present_days,
                notes,
            } = req.body;

            if (!final_amount) {
                return res
                    .status(400)
                    .json({ message: "final_amount is required" });
            }

            // Get appeal info
            const [appealRows] = await db.promise().query(
                `SELECT sa.id, sa.payroll_id, sa.status, sa.expected_amount,
                        p.employee_id, p.period_month, p.period_year
                 FROM salary_appeals sa
                 JOIN payrolls p ON sa.payroll_id = p.id
                 WHERE sa.id = ? AND sa.deleted_at IS NULL AND p.deleted_at IS NULL`,
                [appeal_id]
            );

            if (appealRows.length === 0) {
                return res
                    .status(404)
                    .json({ message: "Salary appeal not found" });
            }

            const appeal = appealRows[0];

            if (appeal.status !== "approved") {
                return res.status(400).json({
                    message: "Only approved appeals can have revised payroll",
                });
            }

            const [reimbursementRows] = await db.promise().query(
                `SELECT SUM(amount) AS total_reimbursement
                 FROM reimbursements
                 WHERE employee_id = ?
                                     AND status IN ('approved', 'included_in_payroll')
                   AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [
                    appeal.employee_id,
                    `${appeal.period_year}-${String(appeal.period_month).padStart(2, "0")}`,
                ]
            );

            const latestReimbursementTotal = Number(
                reimbursementRows[0]?.total_reimbursement || 0
            );

            const [payrollRows] = await db.promise().query(
                `SELECT period_month, period_year,
                        basic_salary,
                        transport_allowance, meal_allowance, health_allowance,
                        bonus, other_allowance, other_deduction,
                        allowance,
                        gross_salary,
                        deduction,
                        total_late_days, total_absent_days, total_sakit_days, total_izin_days, present_days,
                        late_deduction, absent_deduction, bpjs_deduction, tax_deduction
                 FROM payrolls
                 WHERE id = ? AND deleted_at IS NULL
                 LIMIT 1`,
                [appeal.payroll_id]
            );

            const payrollRow = payrollRows[0] || {};
            const nextBasicSalary = Number(
                basic_salary !== undefined
                    ? basic_salary
                    : payrollRow.basic_salary || 0
            );
            const nextTransportAllowance = Number(
                transport_allowance !== undefined
                    ? transport_allowance
                    : payrollRow.transport_allowance || 0
            );
            const nextMealAllowance = Number(
                meal_allowance !== undefined
                    ? meal_allowance
                    : payrollRow.meal_allowance || 0
            );
            const nextHealthAllowance = Number(
                health_allowance !== undefined
                    ? health_allowance
                    : payrollRow.health_allowance || 0
            );
            const nextBonus = Number(
                bonus !== undefined ? bonus : payrollRow.bonus || 0
            );
            const nextOtherAllowance = Number(
                other_allowance !== undefined
                    ? other_allowance
                    : payrollRow.other_allowance || 0
            );
            const nextOtherDeduction = Number(
                other_deduction !== undefined
                    ? other_deduction
                    : payrollRow.other_deduction || 0
            );
            const nextAllowance = Number(
                allowance !== undefined ? allowance : payrollRow.allowance || 0
            );
            const nextGrossSalary = Number(
                gross_salary !== undefined
                    ? gross_salary
                    : payrollRow.gross_salary || 0
            );
            const nextLateDeduction = Number(
                late_deduction !== undefined
                    ? late_deduction
                    : payrollRow.late_deduction || 0
            );
            const nextAbsentDeduction = Number(
                absent_deduction !== undefined
                    ? absent_deduction
                    : payrollRow.absent_deduction || 0
            );
            const nextBpjsDeduction = Number(
                bpjs_deduction !== undefined
                    ? bpjs_deduction
                    : payrollRow.bpjs_deduction || 0
            );
            const nextTaxDeduction = Number(
                tax_deduction !== undefined
                    ? tax_deduction
                    : payrollRow.tax_deduction || 0
            );
            const nextTotalLateDays = Number(
                total_late_days !== undefined
                    ? total_late_days
                    : payrollRow.total_late_days || 0
            );
            const nextTotalAbsentDays = Number(
                total_absent_days !== undefined
                    ? total_absent_days
                    : payrollRow.total_absent_days || 0
            );
            const nextTotalSakitDays = Number(
                total_sakit_days !== undefined
                    ? total_sakit_days
                    : payrollRow.total_sakit_days || 0
            );
            const nextTotalIzinDays = Number(
                total_izin_days !== undefined
                    ? total_izin_days
                    : payrollRow.total_izin_days || 0
            );
            const nextPresentDays = Number(
                present_days !== undefined
                    ? present_days
                    : payrollRow.present_days || 0
            );
            const nextDeduction = Number(
                deduction !== undefined ? deduction : payrollRow.deduction || 0
            );
            const latestTotalIncome = Number(
                (
                    (total_income !== undefined
                        ? Number(total_income)
                        : nextGrossSalary +
                          (reimbursement_total !== undefined
                              ? Number(reimbursement_total)
                              : latestReimbursementTotal))
                ).toFixed(2)
            );
            const nextReimbursementTotal = Number(
                reimbursement_total !== undefined
                    ? reimbursement_total
                    : latestReimbursementTotal
            );

            const slipsDir = path.join(__dirname, "..", "uploads", "payroll_slips");
            const oldPdfPath = path.join(
                slipsDir,
                `payroll-${appeal.payroll_id}-${appeal.period_month}-${appeal.period_year}.pdf`
            );

            if (fs.existsSync(oldPdfPath)) {
                try {
                    fs.unlinkSync(oldPdfPath);
                } catch (fileError) {
                    console.error(fileError);
                }
            }

            // Update payroll final_amount
            await db.promise().query(
                `UPDATE payrolls 
                 SET final_amount = ?,
                     net_salary = ?,
                     basic_salary = ?,
                     transport_allowance = ?,
                     meal_allowance = ?,
                     health_allowance = ?,
                     bonus = ?,
                     other_allowance = ?,
                     other_deduction = ?,
                     allowance = ?,
                     gross_salary = ?,
                     total_late_days = ?,
                     total_absent_days = ?,
                     total_sakit_days = ?,
                     total_izin_days = ?,
                     present_days = ?,
                     late_deduction = ?,
                     absent_deduction = ?,
                     bpjs_deduction = ?,
                     tax_deduction = ?,
                     deduction = ?,
                     reimbursement_total = ?,
                     total_income = ?,
                     status = 'draft',
                     claimed_at = NULL,
                     published_at = NULL,
                     updated_at = NOW()
                 WHERE id = ?`,
                [
                    final_amount,
                    final_amount,
                    nextBasicSalary,
                    nextTransportAllowance,
                    nextMealAllowance,
                    nextHealthAllowance,
                    nextBonus,
                    nextOtherAllowance,
                    nextOtherDeduction,
                    nextAllowance,
                    nextGrossSalary,
                    nextTotalLateDays,
                    nextTotalAbsentDays,
                    nextTotalSakitDays,
                    nextTotalIzinDays,
                    nextPresentDays,
                    nextLateDeduction,
                    nextAbsentDeduction,
                    nextBpjsDeduction,
                    nextTaxDeduction,
                    nextDeduction,
                    nextReimbursementTotal,
                    latestTotalIncome,
                    appeal.payroll_id,
                ]
            );

            await db.promise().query(
                `UPDATE reimbursements
                 SET payroll_id = ?
                 WHERE employee_id = ?
                   AND status = 'included_in_payroll'
                   AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [
                    appeal.payroll_id,
                    appeal.employee_id,
                    `${appeal.period_year}-${String(appeal.period_month).padStart(2, "0")}`,
                ]
            );

            // Log revised payroll creation for appeal
            await logActivity({
                userId: req.user.id,
                username: req.user.username || req.user.name || null,
                role: req.user.roles?.[0] || req.user.role || null,
                action: "CREATE",
                module: "salary_appeals",
                description: `Created revised payroll for appeal id ${appeal_id}, payroll id ${appeal.payroll_id}`,
                newValues: { appeal_id, payroll_id: appeal.payroll_id, final_amount: parseFloat(final_amount) },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.json({
                message: "Revised payroll created successfully",
                payroll_id: appeal.payroll_id,
                final_amount: parseFloat(final_amount),
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
