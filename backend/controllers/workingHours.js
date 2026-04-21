const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

// ============================
// GET all working hours (admin only)
// ============================
router.get("/", verifyToken, verifyRole(["admin"]), async (req, res) => {
    try {
        const [workingHours] = await db
            .promise()
            .query(
                "SELECT * FROM working_hours WHERE deleted_at IS NULL ORDER BY shift_name ASC"
            );

        res.json({
            message: "Working hours retrieved successfully",
            total: workingHours.length,
            data: workingHours,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// GET single working hours (admin only)
// ============================
router.get("/:id", verifyToken, verifyRole(["admin"]), async (req, res) => {
    const { id } = req.params;

    try {
        const [workingHours] = await db
            .promise()
            .query(
                "SELECT * FROM working_hours WHERE id = ? AND deleted_at IS NULL",
                [id]
            );

        if (workingHours.length === 0) {
            return res.status(404).json({ message: "Working hours not found" });
        }

        res.json({
            message: "Working hours retrieved successfully",
            data: workingHours[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// POST create working hours (admin only)
// ============================
router.post("/", verifyToken, verifyRole(["admin"]), async (req, res) => {
    const {
        shift_name,
        check_in_time,
        check_out_time,
        grace_period_minutes,
        description,
        is_default,
    } = req.body;

    // Validasi input
    if (!shift_name || !check_in_time || !check_out_time) {
        return res.status(400).json({
            message:
                "shift_name, check_in_time, and check_out_time are required",
        });
    }

    try {
        // Validasi format time (HH:MM:SS)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        if (!timeRegex.test(check_in_time) || !timeRegex.test(check_out_time)) {
            return res.status(400).json({
                message:
                    "check_in_time and check_out_time must be in HH:MM:SS format",
            });
        }

        // Jika is_default = 1, disable is_default di record lain
        if (is_default === 1) {
            await db.promise().query("UPDATE working_hours SET is_default = 0");
        }

        // Insert working hours baru
        const [result] = await db.promise().query(
            `INSERT INTO working_hours (
                    shift_name, check_in_time, check_out_time, 
                    grace_period_minutes, description, is_default, 
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                shift_name,
                check_in_time,
                check_out_time,
                grace_period_minutes || 0,
                description || null,
                is_default || 0,
            ]
        );

        res.status(201).json({
            message: "Working hours created successfully",
            id: result.insertId,
            data: {
                id: result.insertId,
                shift_name,
                check_in_time,
                check_out_time,
                grace_period_minutes: grace_period_minutes || 0,
                description: description || null,
                is_default: is_default || 0,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// PUT update working hours (admin only)
// ============================
router.put("/:id", verifyToken, verifyRole(["admin"]), async (req, res) => {
    const { id } = req.params;
    const {
        shift_name,
        check_in_time,
        check_out_time,
        grace_period_minutes,
        description,
        is_default,
    } = req.body;

    try {
        // Cek apakah working hours exists
        const [existingHours] = await db
            .promise()
            .query(
                "SELECT * FROM working_hours WHERE id = ? AND deleted_at IS NULL",
                [id]
            );

        if (existingHours.length === 0) {
            return res.status(404).json({ message: "Working hours not found" });
        }

        // Validasi format time jika ada perubahan
        if (check_in_time || check_out_time) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
            if (
                (check_in_time && !timeRegex.test(check_in_time)) ||
                (check_out_time && !timeRegex.test(check_out_time))
            ) {
                return res.status(400).json({
                    message:
                        "check_in_time and check_out_time must be in HH:MM:SS format",
                });
            }
        }

        // Build dynamic update query
        const updates = [];
        const values = [];

        if (shift_name) {
            updates.push("shift_name = ?");
            values.push(shift_name);
        }
        if (check_in_time) {
            updates.push("check_in_time = ?");
            values.push(check_in_time);
        }
        if (check_out_time) {
            updates.push("check_out_time = ?");
            values.push(check_out_time);
        }
        if (grace_period_minutes !== undefined) {
            updates.push("grace_period_minutes = ?");
            values.push(grace_period_minutes);
        }
        if (description !== undefined) {
            updates.push("description = ?");
            values.push(description);
        }
        if (is_default !== undefined) {
            updates.push("is_default = ?");
            values.push(is_default);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }

        // Jika is_default = 1, disable is_default di record lain
        if (is_default === 1) {
            await db
                .promise()
                .query(
                    "UPDATE working_hours SET is_default = 0 WHERE id != ? AND deleted_at IS NULL",
                    [id]
                );
        }

        updates.push("updated_at = NOW()");
        values.push(id);

        const updateQuery = `UPDATE working_hours SET ${updates.join(
            ", "
        )} WHERE id = ?`;

        await db.promise().query(updateQuery, values);

        // Ambil data yang sudah diupdate
        const [updatedHours] = await db
            .promise()
            .query(
                "SELECT * FROM working_hours WHERE id = ? AND deleted_at IS NULL",
                [id]
            );

        res.json({
            message: "Working hours updated successfully",
            data: updatedHours[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// DELETE working hours (admin only)
// ============================
router.delete("/:id", verifyToken, verifyRole(["admin"]), async (req, res) => {
    const { id } = req.params;

    try {
        // Cek apakah working hours exists
        const [existingHours] = await db
            .promise()
            .query(
                "SELECT * FROM working_hours WHERE id = ? AND deleted_at IS NULL",
                [id]
            );

        if (existingHours.length === 0) {
            return res.status(404).json({ message: "Working hours not found" });
        }

        // Cek apakah ada employee yang menggunakan shift ini
        const [employeesUsingShift] = await db
            .promise()
            .query(
                "SELECT COUNT(*) as count FROM employees WHERE working_hours_id = ?",
                [id]
            );

        if (employeesUsingShift[0].count > 0) {
            return res.status(400).json({
                message: `Cannot delete shift. ${employeesUsingShift[0].count} employee(s) are using this shift`,
            });
        }

        // Soft delete working hours
        await db
            .promise()
            .query(
                "UPDATE working_hours SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?",
                [id]
            );

        res.json({
            message: "Working hours deleted successfully",
            deleted_id: id,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
