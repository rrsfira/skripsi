const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const {
    logActivity,
    getIpAddress,
    getUserAgent,
} = require("../middleware/activityLogger");

const extractTargetIdFromLog = (logRow) => {
    if (logRow?.new_values && typeof logRow.new_values === "object") {
        const directTargetId =
            logRow.new_values.target_id ||
            logRow.new_values.targetId ||
            logRow.new_values.id;
        if (directTargetId) {
            const parsed = Number(directTargetId);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    const description = String(logRow?.description || "");
    const match = description.match(/ID\s*:\s*(\d+)/i);
    if (!match) {
        return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
};

const restoreByModule = async (moduleName, targetId) => {
    if (moduleName === "users") {
        await db
            .promise()
            .query(
                "UPDATE users SET status = 'active', updated_at = NOW() WHERE id = ?",
                [targetId]
            );
        await db
            .promise()
            .query(
                "UPDATE employees SET deleted_at = NULL, updated_at = NOW() WHERE user_id = ?",
                [targetId]
            );
        return;
    }

    if (moduleName === "employees") {
        await db
            .promise()
            .query(
                "UPDATE employees SET deleted_at = NULL, updated_at = NOW() WHERE id = ?",
                [targetId]
            );
        await db
            .promise()
            .query(
                `UPDATE users
                 SET status = 'active', updated_at = NOW()
                 WHERE id = (SELECT user_id FROM employees WHERE id = ? LIMIT 1)`,
                [targetId]
            );
        return;
    }

    if (moduleName === "job_openings") {
        await db
            .promise()
            .query(
                "UPDATE job_openings SET deleted_at = NULL, updated_at = NOW() WHERE id = ?",
                [targetId]
            );
        return;
    }

    if (moduleName === "payroll") {
        await db
            .promise()
            .query(
                "UPDATE payrolls SET deleted_at = NULL, updated_at = NOW() WHERE id = ?",
                [targetId]
            );
        return;
    }

    if (moduleName === "salary_appeals") {
        await db
            .promise()
            .query(
                `UPDATE salary_appeals
                 SET deleted_at = NULL,
                     status = 'pending',
                     updated_at = NOW()
                 WHERE id = ?`,
                [targetId]
            );
        return;
    }

    if (moduleName === "working_hours") {
        await db
            .promise()
            .query(
                "UPDATE working_hours SET deleted_at = NULL, updated_at = NOW() WHERE id = ?",
                [targetId]
            );
        return;
    }

    throw new Error(`Module ${moduleName} is not restorable`);
};

/**
 * GET /api/activity-logs
 * Mendapatkan daftar activity logs dengan filter dan pagination
 */
router.get("/", verifyToken, verifyRole(["admin"]), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit) || 20),
        );
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        if (req.query.module) {
            whereConditions.push("module = ?");
            params.push(req.query.module);
        }

        if (req.query.action) {
            whereConditions.push("action = ?");
            params.push(req.query.action);
        }

        if (req.query.role) {
            whereConditions.push("role = ?");
            params.push(req.query.role);
        }

        if (req.query.user_id) {
            whereConditions.push("user_id = ?");
            params.push(req.query.user_id);
        }

        if (
            req.query.status &&
            ["success", "failed"].includes(req.query.status)
        ) {
            whereConditions.push("status = ?");
            params.push(req.query.status);
        }

        if (req.query.startDate) {
            whereConditions.push("DATE(created_at) >= ?");
            params.push(req.query.startDate);
        }

        if (req.query.endDate) {
            whereConditions.push("DATE(created_at) <= ?");
            params.push(req.query.endDate);
        }

        if (req.query.search) {
            whereConditions.push("(username LIKE ? OR description LIKE ?)");
            const searchTerm = `%${req.query.search}%`;
            params.push(searchTerm, searchTerm);
        }

        const whereClause =
            whereConditions.length > 0
                ? "WHERE " + whereConditions.join(" AND ")
                : "";

        const countQuery = `SELECT COUNT(*) as total FROM activity_logs ${whereClause}`;
        const [[{ total }]] = await db.promise().query(countQuery, params);

        const dataQuery = `
            SELECT * FROM activity_logs
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limit, offset];
        const [logs] = await db.promise().query(dataQuery, dataParams);

        res.json({
            success: true,
            message: "Activity logs retrieved successfully",
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("[ERROR] Get activity logs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve activity logs",
            error: error.message,
        });
    }
});

/**
 * GET /api/activity-logs/summary
 * Mendapatkan ringkasan statistik activity logs
 */
router.get("/summary", verifyToken, verifyRole(["admin"]), async (req, res) => {
    try {
        const days = Math.max(1, parseInt(req.query.days) || 7);

        const [summary] = await db.promise().query(
            `
            SELECT 
                action,
                COUNT(*) as count,
                status
            FROM activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY action, status
            ORDER BY count DESC
        `,
            [days],
        );

        const [byModule] = await db.promise().query(
            `
            SELECT 
                module,
                COUNT(*) as count
            FROM activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY module
            ORDER BY count DESC
        `,
            [days],
        );

        const [byRole] = await db.promise().query(
            `
            SELECT 
                role,
                COUNT(*) as count
            FROM activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY role
            ORDER BY count DESC
        `,
            [days],
        );

        res.json({
            success: true,
            message: "Activity logs summary retrieved successfully",
            data: {
                byAction: summary,
                byModule,
                byRole,
                period: `Last ${days} days`,
            },
        });
    } catch (error) {
        console.error("[ERROR] Get activity logs summary:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve activity logs summary",
            error: error.message,
        });
    }
});

/**
 * GET /api/activity-logs/user/:userId
 * Mendapatkan activity logs untuk user tertentu
 */
router.get(
    "/user/:userId",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const userId = req.params.userId;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(
                100,
                Math.max(1, parseInt(req.query.limit) || 20),
            );
            const offset = (page - 1) * limit;

            const [[{ total }]] = await db
                .promise()
                .query(
                    "SELECT COUNT(*) as total FROM activity_logs WHERE user_id = ?",
                    [userId],
                );

            const [logs] = await db.promise().query(
                `
            SELECT * FROM activity_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
                [userId, limit, offset],
            );

            res.json({
                success: true,
                message: "User activity logs retrieved successfully",
                data: logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            });
        } catch (error) {
            console.error("[ERROR] Get user activity logs:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve user activity logs",
                error: error.message,
            });
        }
    },
);

/**
 * GET /api/activity-logs/:id
 * Mendapatkan detail log aktivitas tertentu
 */
router.get("/:id", verifyToken, verifyRole(["admin"]), async (req, res) => {
    try {
        const [log] = await db
            .promise()
            .query("SELECT * FROM activity_logs WHERE id = ?", [req.params.id]);

        if (log.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Activity log not found",
            });
        }

        res.json({
            success: true,
            message: "Activity log detail retrieved successfully",
            data: log[0],
        });
    } catch (error) {
        console.error("[ERROR] Get activity log detail:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve activity log detail",
            error: error.message,
        });
    }
});

/**
 * POST /api/activity-logs/:id/restore
 * Memulihkan data soft delete berdasarkan log aktivitas DELETE
 */
router.post(
    "/:id/restore",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const logId = Number(req.params.id);
            if (!Number.isFinite(logId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid activity log id",
                });
            }

            const [logRows] = await db
                .promise()
                .query("SELECT * FROM activity_logs WHERE id = ?", [logId]);

            if (logRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Activity log not found",
                });
            }

            const logRow = logRows[0];
            if (
                String(logRow.action || "").toUpperCase() !== "DELETE" ||
                String(logRow.status || "success") !== "success"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Only successful DELETE activity can be restored",
                });
            }

            const moduleName = String(logRow.module || "").toLowerCase();
            const targetId = extractTargetIdFromLog(logRow);

            if (!targetId) {
                return res.status(400).json({
                    success: false,
                    message: "Target id not found in activity log",
                });
            }

            await restoreByModule(moduleName, targetId);

            await logActivity({
                userId: req.user.id,
                username: req.user.username || "admin",
                role: req.user.roles?.[0] || "admin",
                action: "RESTORE",
                module: moduleName,
                description: `Restored ${moduleName} ID: ${targetId} from activity log ID: ${logId}`,
                newValues: {
                    activity_log_id: logId,
                    target_id: targetId,
                },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.json({
                success: true,
                message: "Data restored successfully",
                data: {
                    module: moduleName,
                    target_id: targetId,
                    activity_log_id: logId,
                },
            });
        } catch (error) {
            console.error("[ERROR] Restore from activity log:", error);
            res.status(500).json({
                success: false,
                message: "Failed to restore data",
                error: error.message,
            });
        }
    }
);

/**
 * DELETE /api/activity-logs/delete-old
 * Menghapus activity logs yang lebih tua dari N hari
 */
router.delete(
    "/delete-old",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const days = Math.max(1, parseInt(req.query.days) || 90);

            const result = await db
                .promise()
                .query(
                    `DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                    [days],
                );

            res.json({
                success: true,
                message: `Successfully deleted ${result[0].affectedRows} old activity logs`,
                deletedRows: result[0].affectedRows,
            });
        } catch (error) {
            console.error("[ERROR] Delete old activity logs:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete old activity logs",
                error: error.message,
            });
        }
    },
);

/**
 * GET /api/activity-logs/export/csv
 * Export activity logs ke format CSV
 */
router.get(
    "/export/csv",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const days = Math.max(1, parseInt(req.query.days) || 30);

            const [logs] = await db.promise().query(
                `
            SELECT 
                id,
                user_id,
                username,
                role,
                action,
                module,
                description,
                status,
                error_message,
                created_at
            FROM activity_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY created_at DESC
        `,
                [days],
            );

            const headers = [
                "ID",
                "User ID",
                "Username",
                "Role",
                "Action",
                "Module",
                "Description",
                "Status",
                "Error Message",
                "Created At",
            ];

            let csvContent = headers.join(",") + "\n";

            logs.forEach((log) => {
                const row = [
                    log.id,
                    log.user_id,
                    `"${log.username}"`,
                    log.role,
                    log.action,
                    log.module,
                    `"${(log.description || "").replace(/"/g, '""')}"`,
                    log.status,
                    `"${(log.error_message || "").replace(/"/g, '""')}"`,
                    log.created_at,
                ];
                csvContent += row.join(",") + "\n";
            });

            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="activity-logs-${new Date().toISOString().split("T")[0]}.csv"`,
            );
            res.send(csvContent);
        } catch (error) {
            console.error("[ERROR] Export activity logs:", error);
            res.status(500).json({
                success: false,
                message: "Failed to export activity logs",
                error: error.message,
            });
        }
    },
);

module.exports = router;
