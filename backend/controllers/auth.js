// Import library yang dibutuhkan
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // keamanan bash
const jwt = require("jsonwebtoken"); // token
const db = require("../config/db"); // config database
require("dotenv").config(); // Load variabel lingkungan dari .env
const tokenBlacklist = require("../middleware/tokenBlacklist");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const uploadProfilePhoto = require("../middleware/profilePhotoUpload");
const {
    logActivity,
    getIpAddress,
    getUserAgent,
} = require("../middleware/activityLogger");

const uploadSinglePhoto = (req, res, next) => {
    uploadProfilePhoto.single("photo")(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        return next();
    });
};

const getPhotoPathFromRequest = (req) => {
    if (req.file?.filename) {
        return `uploads/profile_photos/${req.file.filename}`;
    }
    return req.body?.photo;
};

// ============================
// REGISTER STAFF (admin/hr)
// ============================
// Admin dan HR boleh membuat akun pegawai
router.post(
    "/register/staff",
    verifyToken,
    verifyRole(["admin", "hr"]),
    uploadSinglePhoto,
    async (req, res) => {
        // Ambil data dari body request (user + employee data)
        const {
            name,
            email,
            username,
            password,
            roles,
            phone,
            photo,
            status,
            // Employee data
            full_name,
            gender,
            birth_place,
            date_of_birth,
            marital_status,
            nationality,
            address,
            phone: emp_phone,
            email: emp_email,
            nik,
            npwp,
            bank_account,
            account_holder_name,
            bank_name,
            bpjs_number,
            position_id,
            join_date,
            basic_salary,
            employment_status,
        } = req.body;

        // Validasi input dasar untuk user
        if (
            !name ||
            !email ||
            !username ||
            !password ||
            !roles ||
            !Array.isArray(roles) ||
            roles.length === 0
        ) {
            return res.status(400).json({
                message:
                    "Name, email, username, password, and roles (array) are required",
            });
        }

        // Validasi input untuk employee
        if (!position_id || !join_date) {
            return res.status(400).json({
                message:
                    "position_id and join_date are required for employee data",
            });
        }

        // Validasi role hanya untuk role pegawai (bukan kandidat)
        const validRoles = [
            "admin",
            "atasan",
            "pegawai",
            "hr",
            "finance",
            "commissioner",
            "director",
        ];
        if (!roles.every((r) => validRoles.includes(r))) {
            return res.status(400).json({ message: "Invalid role" });
        }

        // Normalisasi peran: semua role (admin, atasan, hr, finance) harus juga memiliki 'pegawai'
        const hierarchicalRoles = [
            "admin",
            "atasan",
            "hr",
            "finance",
            "commissioner",
            "director",
        ];
        const normalizedRolesSet = new Set(roles);
        const hasHierarchyRole = Array.from(normalizedRolesSet).some((r) =>
            hierarchicalRoles.includes(r),
        );
        if (hasHierarchyRole) {
            normalizedRolesSet.add("pegawai");
        }
        const finalRoles = Array.from(normalizedRolesSet);

        try {
            // Cek apakah email sudah terdaftar
            const [existingUser] = await db
                .promise()
                .query("SELECT * FROM users WHERE email = ?", [email]);

            if (existingUser.length > 0) {
                return res
                    .status(409)
                    .json({ message: "Email already registered" });
            }

            // Cek apakah username sudah terdaftar
            const [existingUsername] = await db
                .promise()
                .query("SELECT * FROM users WHERE username = ?", [username]);

            if (existingUsername.length > 0) {
                return res
                    .status(409)
                    .json({ message: "Username already registered" });
            }

            // Validasi position_id exists
            const [positionCheck] = await db
                .promise()
                .query("SELECT id, base_salary FROM positions WHERE id = ?", [
                    position_id,
                ]);

            if (positionCheck.length === 0) {
                return res.status(400).json({ message: "Invalid position_id" });
            }

            // Gunakan base_salary dari position jika basic_salary tidak diberikan
            const finalBasicSalary =
                basic_salary || positionCheck[0].base_salary;

            // Generate employee_code otomatis (format: EMP001, EMP002, dst)
            const [lastEmployee] = await db
                .promise()
                .query(
                    "SELECT employee_code FROM employees ORDER BY id DESC LIMIT 1",
                );

            let newEmployeeCode = "EMP001";
            if (lastEmployee.length > 0 && lastEmployee[0].employee_code) {
                const lastCode = lastEmployee[0].employee_code;
                const numPart = parseInt(lastCode.replace("EMP", "")) || 0;
                newEmployeeCode = `EMP${String(numPart + 1).padStart(3, "0")}`;
            }

            // Enkripsi password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Query untuk insert user baru
            const userSql = `
      INSERT INTO users (
        name, email, username, password, phone, photo, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

            const photoPath = getPhotoPathFromRequest(req);

            const userValues = [
                name,
                email,
                username,
                hashedPassword,
                phone || '-',
                photoPath || '',
                status || "active",
            ];

            // Simpan user ke database
            const [userResult] = await db.promise().query(userSql, userValues);
            const userId = userResult.insertId;

            // Simpan roles ke tabel user_roles (sudah dinormalisasi)
            for (const role of finalRoles) {
                const [roleData] = await db
                    .promise()
                    .query("SELECT id FROM roles WHERE name = ?", [role]);

                if (roleData.length > 0) {
                    const roleId = roleData[0].id;
                    await db
                        .promise()
                        .query(
                            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                            [userId, roleId],
                        );
                }
            }

            // Simpan employee ke database
            const employeeSql = `
      INSERT INTO employees (
        user_id, employee_code, full_name, gender, birth_place, date_of_birth, 
        marital_status, nationality, address, phone, email, 
        nik, npwp, bank_account, account_holder_name, bank_name, bpjs_number,
        position_id, join_date, basic_salary, employment_status, working_hours_id, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

            const employeeValues = [
                userId,
                newEmployeeCode,
                full_name || name,
                gender || null,
                birth_place || null,
                date_of_birth || null,
                marital_status || null,
                nationality || "Indonesian",
                address || null,
                emp_phone || phone || null,
                emp_email || email || null,
                nik || null,
                npwp || null,
                bank_account || null,
                account_holder_name || null,
                bank_name || null,
                bpjs_number || null,
                position_id,
                join_date,
                finalBasicSalary,
                employment_status || "permanent",
                1, // Default working_hours_id (shift standard 08:00-16:00)
            ];

            const [employeeResult] = await db
                .promise()
                .query(employeeSql, employeeValues);
            const employeeId = employeeResult.insertId;

            // Generate JWT token dengan roles final
            const token = jwt.sign(
                { id: userId, roles: finalRoles },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h",
                },
            );

            // Log successful staff registration
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                action: "CREATE",
                module: "auth",
                description: `Created new staff account: ${full_name || name} (${username})`,
                newValues: {
                    username: username,
                    email: email,
                    full_name: full_name || name,
                    position_id: position_id,
                    employment_status: employment_status || "permanent",
                    roles: finalRoles,
                },
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            // Kirim response sukses dengan data lengkap
            res.status(201).json({
                message: "Staff registered successfully",
                token,
                user_id: userId,
                employee_id: employeeId,
                employee_code: newEmployeeCode,
            });
        } catch (error) {
            console.error(error);
            // Log failed staff registration
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                action: "CREATE",
                module: "auth",
                description: `Failed to create new staff account`,
                newValues: req.body,
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
                status: "failed",
                errorMessage: error.message,
            });
            res.status(500).json({ message: "Server error" });
        }
    },
);


// REGISTER KANDIDAT
router.post("/register/candidate", uploadSinglePhoto, async (req, res) => {
    const { name, email, username, password, phone } = req.body;

    if (!name || !email || !username || !password) {
        return res.status(400).json({
            message: "Name, email, username, and password are required",
        });
    }

    try {
        const [existingUser] = await db
            .promise()
            .query("SELECT * FROM users WHERE email = ?", [email]);

        if (existingUser.length > 0) {
            return res
                .status(409)
                .json({ message: "Email already registered" });
        }

        // Cek apakah username sudah terdaftar
        const [existingUsername] = await db
            .promise()
            .query("SELECT * FROM users WHERE username = ?", [username]);

        if (existingUsername.length > 0) {
            return res
                .status(409)
                .json({ message: "Username already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userSql = `
      INSERT INTO users (
        name, email, username, password, phone, photo, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

        const photoPath = getPhotoPathFromRequest(req);

        const userValues = [
            name,
            email,
            username,
            hashedPassword,
            phone || "-",
            photoPath || "-",
            "active",
        ];

        const [userResult] = await db.promise().query(userSql, userValues);
        const userId = userResult.insertId;

        // Assign kandidat role
        const [roleData] = await db
            .promise()
            .query("SELECT id FROM roles WHERE name = ?", ["kandidat"]);

        if (roleData.length > 0) {
            const roleId = roleData[0].id;
            await db
                .promise()
                .query(
                    "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                    [userId, roleId],
                );
        }

        // Create candidate profile linked to user
        await db.promise().query(
            `INSERT INTO candidates (user_id, name, email, phone, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            [userId, name, email, phone || null],
        );

        const token = jwt.sign(
            { id: userId, roles: ["kandidat"] },
            process.env.JWT_SECRET,
            { expiresIn: "1h" },
        );

        res.status(201).json({
            message: "Candidate registered successfully",
            token,
            user_id: userId,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// LOGIN
// ============================
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res
            .status(400)
            .json({ message: "Email and password are required" });
    }

    try {
        // Cek user berdasarkan email
        const [userResults] = await db
            .promise()
            .query("SELECT * FROM users WHERE email = ?", [email]);

        // Jika user tidak ditemukan
        if (userResults.length === 0) {
            // Log failed login attempt
            await logActivity({
                userId: 0,
                username: email,
                role: "unknown",
                action: "LOGIN",
                module: "auth",
                description: `Failed login attempt - user not found`,
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
                status: "failed",
                errorMessage: "User not found",
            });
            return res.status(404).json({ message: "User not found" });
        }

        const user = userResults[0];

        if (String(user.status || "").toLowerCase() === "inactive") {
            await logActivity({
                userId: user.id,
                username: user.username,
                role: "unknown",
                action: "LOGIN",
                module: "auth",
                description: "Blocked login - account inactive",
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
                status: "failed",
                errorMessage: "Account inactive",
            });

            return res.status(403).json({
                message: "Akun Anda sedang tidak aktif. Hubungi HR/Admin.",
                code: "ACCOUNT_INACTIVE",
            });
        }

        // Bandingkan password input dengan password hash di database
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            // Log failed login attempt - wrong password
            await logActivity({
                userId: user.id,
                username: user.username,
                role: "unknown",
                action: "LOGIN",
                module: "auth",
                description: `Failed login attempt - invalid password`,
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
                status: "failed",
                errorMessage: "Invalid password",
            });
            return res.status(401).json({ message: "Invalid password" });
        }

        // Ambil roles dari tabel user_roles
        const [userRolesResults] = await db.promise().query(
            `SELECT r.name FROM roles r 
                 JOIN user_roles ur ON r.id = ur.role_id 
                 WHERE ur.user_id = ?`,
            [user.id],
        );

        let roles = userRolesResults.map((row) => row.name);

        // Normalisasi peran saat login: pastikan 'pegawai' selalu ada
        const hierarchicalRoles = [
            "admin",
            "atasan",
            "hr",
            "finance",
            "commissioner",
        ];
        const normalizedRolesSet = new Set(roles);
        const hasHierarchyRole = Array.from(normalizedRolesSet).some((r) =>
            hierarchicalRoles.includes(r),
        );
        if (hasHierarchyRole) {
            normalizedRolesSet.add("pegawai");
        }
        const finalRoles = Array.from(normalizedRolesSet);

        // Buat token JWT
        const token = jwt.sign(
            { id: user.id, roles: finalRoles },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h",
            },
        );

        // Log successful login
        await logActivity({
            userId: user.id,
            username: user.username,
            role: finalRoles[0] || "pegawai",
            action: "LOGIN",
            module: "auth",
            description: `Successful login`,
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            status: "success",
        });

        // Kirim data user beserta token
        res.json({
            token,
            roles: finalRoles,
            name: user.name,
            email: user.email,
            username: user.username,
            user_id: user.id,
            phone: user.phone,
            photo: user.photo,
            status: user.status,
        });
    } catch (error) {
        console.error(error);
        // Log login error
        await logActivity({
            userId: 0,
            username: req.body.email || "unknown",
            role: "unknown",
            action: "LOGIN",
            module: "auth",
            description: `Login error`,
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            status: "failed",
            errorMessage: error.message,
        });
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// LOGOUT
// ============================
router.post("/logout", verifyToken, async (req, res) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
        return res.status(400).json({ message: "No token provided" });
    }

    try {
        // Log logout
        await logActivity({
            userId: req.user.id,
            username: req.user.username || "unknown",
            role: req.user.roles?.[0] || "unknown",
            action: "LOGOUT",
            module: "auth",
            description: `User logged out`,
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
        });

        tokenBlacklist.push(token); // Tambahkan token ke blacklist
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error during logout" });
    }
});

// ============================
// ADMIN RESET PASSWORD (jika pegawai lupa password)
// ============================
router.put(
    "/reset-password/:userId",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res
                .status(400)
                .json({ message: "New password is required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        try {
            // Cek apakah user exists
            const [userCheck] = await db
                .promise()
                .query("SELECT id, name FROM users WHERE id = ?", [userId]);

            if (userCheck.length === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            // Hash password baru
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password (admin tidak perlu tahu password lama)
            await db
                .promise()
                .query(
                    "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
                    [hashedPassword, userId],
                );

            res.json({
                message: "Password reset successfully",
                user: userCheck[0].name,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
);

// ============================
// ADMIN - LIST USERS + ROLES
// ============================
router.get(
    "/admin/users",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        try {
            const [users] = await db.promise().query(`
                SELECT 
                    u.id,
                    u.name,
                    u.email,
                    u.username,
                    u.phone,
                    u.status,
                    u.created_at,
                    e.id as employee_id,
                    e.employee_code,
                    e.employment_status,
                    p.name as position_name,
                    GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id AND e.deleted_at IS NULL
                LEFT JOIN positions p ON e.position_id = p.id
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `);

            const normalized = users.map((user) => ({
                ...user,
                roles: user.roles ? user.roles.split(",") : [],
            }));

            res.json({ users: normalized });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
);

// ============================
// ADMIN/HR - META OPTIONS (roles + positions)
// ============================
router.get(
    "/admin/meta",
    verifyToken,
    verifyRole(["admin", "hr"]),
    async (req, res) => {
        try {
            const [roles] = await db
                .promise()
                .query("SELECT id, name FROM roles ORDER BY name ASC");

            const [positions] = await db.promise().query(`
                SELECT p.id, p.name, p.base_salary, d.name as department_name
                FROM positions p
                LEFT JOIN departments d ON p.department_id = d.id
                ORDER BY p.name ASC
            `);

            res.json({ roles, positions });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
);

// ============================
// ADMIN - UPDATE USER + ROLES
// ============================
router.put(
    "/admin/users/:userId",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        const { userId } = req.params;
        const { name, email, username, phone, status, roles } = req.body;

        try {
            const [existing] = await db
                .promise()
                .query("SELECT id FROM users WHERE id = ?", [userId]);

            if (existing.length === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            const updates = [];
            const values = [];

            if (name) {
                updates.push("name = ?");
                values.push(name);
            }
            if (email) {
                updates.push("email = ?");
                values.push(email);
            }
            if (username) {
                updates.push("username = ?");
                values.push(username);
            }
            if (phone !== undefined) {
                updates.push("phone = ?");
                values.push(phone || null);
            }
            if (status) {
                updates.push("status = ?");
                values.push(status);
            }

            if (updates.length > 0) {
                updates.push("updated_at = NOW()");
                values.push(userId);
                await db
                    .promise()
                    .query(
                        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
                        values,
                    );
            }

            if (Array.isArray(roles) && roles.length > 0) {
                const validRoles = [
                    "admin",
                    "atasan",
                    "pegawai",
                    "hr",
                    "finance",
                    "commissioner",
                    "director",
                    "kandidat",
                ];
                const rolesFiltered = roles.filter((role) => validRoles.includes(role));

                const hierarchicalRoles = [
                    "admin",
                    "atasan",
                    "hr",
                    "finance",
                    "commissioner",
                    "director",
                ];
                const rolesSet = new Set(rolesFiltered);
                if (Array.from(rolesSet).some((role) => hierarchicalRoles.includes(role))) {
                    rolesSet.add("pegawai");
                }

                const finalRoles = Array.from(rolesSet);

                await db
                    .promise()
                    .query("DELETE FROM user_roles WHERE user_id = ?", [userId]);

                for (const roleName of finalRoles) {
                    const [roleRows] = await db
                        .promise()
                        .query("SELECT id FROM roles WHERE name = ?", [roleName]);

                    if (roleRows.length > 0) {
                        await db
                            .promise()
                            .query(
                                "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                                [userId, roleRows[0].id],
                            );
                    }
                }
            }

            await logActivity({
                userId: req.user.id,
                username: req.user.username || "admin",
                role: req.user.roles?.[0] || "admin",
                action: "UPDATE",
                module: "users",
                description: `Updated user ID: ${userId}`,
                newValues: req.body,
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.json({ message: "User updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
);

// ============================
// ADMIN - DELETE USER
// ============================
router.delete(
    "/admin/users/:userId",
    verifyToken,
    verifyRole(["admin"]),
    async (req, res) => {
        const { userId } = req.params;

        try {
            const [existing] = await db
                .promise()
                .query("SELECT id FROM users WHERE id = ?", [userId]);

            if (existing.length === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            await db
                .promise()
                .query(
                    "UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = ?",
                    [userId]
                );
            await db
                .promise()
                .query(
                    "UPDATE employees SET deleted_at = NOW(), updated_at = NOW() WHERE user_id = ? AND deleted_at IS NULL",
                    [userId]
                );

            await logActivity({
                userId: req.user.id,
                username: req.user.username || "admin",
                role: req.user.roles?.[0] || "admin",
                action: "DELETE",
                module: "users",
                description: `Soft deleted user ID: ${userId}`,
                ipAddress: getIpAddress(req),
                userAgent: getUserAgent(req),
            });

            res.json({ message: "User deleted successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },
);

module.exports = router;
