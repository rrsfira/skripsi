const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadDir = path.join(__dirname, "../uploads/profile_photos");
        if (file.fieldname === "ktp_document" || file.fieldname === "diploma_document") {
            uploadDir = path.join(__dirname, "../uploads/employee_documents");
        }
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

const profileFileFilter = (req, file, cb) => {
    const fileExtension = path.extname(file.originalname || "").toLowerCase();

    if (file.fieldname === "photo") {
        const allowedPhotoTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/jpg",
            "application/octet-stream",
        ];
        const allowedPhotoExtensions = [".jpg", ".jpeg", ".png", ".webp"];

        if (
            !allowedPhotoTypes.includes(file.mimetype) &&
            !allowedPhotoExtensions.includes(fileExtension)
        ) {
            return cb(new Error("Foto profil hanya boleh JPG/PNG/WEBP"));
        }
        return cb(null, true);
    }

    if (file.fieldname === "ktp_document" || file.fieldname === "diploma_document") {
        const allowedDocumentTypes = [
            "image/jpeg",
            "image/png",
            "image/jpg",
            "application/pdf",
            "application/x-pdf",
            "application/octet-stream",
        ];
        const allowedDocumentExtensions = [".pdf", ".jpg", ".jpeg", ".png"];

        if (
            !allowedDocumentTypes.includes(file.mimetype) &&
            !allowedDocumentExtensions.includes(fileExtension)
        ) {
            return cb(new Error("Dokumen KTP/Ijazah hanya boleh PDF/JPG/PNG"));
        }
        return cb(null, true);
    }

    return cb(new Error("File field tidak dikenali"));
};

const uploadProfileAssets = multer({
    storage: profileStorage,
    fileFilter: profileFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

const uploadProfileFiles = (req, res, next) => {
    uploadProfileAssets.fields([
        { name: "photo", maxCount: 1 },
        { name: "ktp_document", maxCount: 1 },
        { name: "diploma_document", maxCount: 1 },
    ])(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res
                    .status(400)
                    .json({ message: "Ukuran file maksimal 10MB" });
            }
            return res.status(400).json({ message: err.message });
        }
        return next();
    });
};

const isLocalUploadPath = (value) => {
    return typeof value === "string" && value.startsWith("uploads/");
};

const areFilesIdentical = async (filePathA, filePathB) => {
    if (!fs.existsSync(filePathA) || !fs.existsSync(filePathB)) {
        return false;
    }

    const [bufferA, bufferB] = await Promise.all([
        fsp.readFile(filePathA),
        fsp.readFile(filePathB),
    ]);

    return bufferA.length === bufferB.length && bufferA.equals(bufferB);
};

const normalizeMaritalStatus = (value) => {
    if (!value) return value;

    const normalized = String(value).trim().toLowerCase();
    const mapping = {
        "belum menikah": "single",
        "sudah menikah": "married",
        cerai: "divorced",
        "cerai mati": "widowed",
        single: "single",
        married: "married",
        divorced: "divorced",
        widowed: "widowed",
    };

    return mapping[normalized] || value;
};

// ============================
// GET user profile (lengkap dengan data employee)
// ============================
router.get("/", verifyToken, async (req, res) => {
    const userId = req.user.id;

    try {
        // Ambil data user
        const [userResults] = await db
            .promise()
            .query(
                "SELECT id, name, email, username, phone, photo, status, created_at FROM users WHERE id = ?",
                [userId]
            );

        if (userResults.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userResults[0];

        // Ambil data employee jika ada
        const [employeeResults] = await db.promise().query(
            `SELECT e.*, p.name as position_name, p.level, d.name as department_name
       FROM employees e
       LEFT JOIN positions p ON e.position_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE e.user_id = ?`,
            [userId]
        );

        let employee = employeeResults[0] || null;

        if (employee) {
            const [quotaRows] = await db.promise().query(
                `SELECT
                    GREATEST(
                        COALESCE(e.annual_leave_quota, 12)
                        - COALESCE(
                            (
                                SELECT SUM(COALESCE(lr.total_days, 0))
                                FROM leave_requests lr
                                WHERE lr.employee_id = e.id
                                  AND lr.status = 'approved'
                                  AND lr.leave_type IN ('cuti_tahunan', 'izin')
                            ),
                            0
                        ),
                        0
                    ) AS calculated_remaining_leave_quota
                 FROM employees e
                 WHERE e.id = ?
                 LIMIT 1`,
                [employee.id]
            );

            const calculatedRemaining = Number(
                quotaRows[0]?.calculated_remaining_leave_quota ??
                    employee.remaining_leave_quota ??
                    0
            );

            if (Number(employee.remaining_leave_quota ?? 0) !== calculatedRemaining) {
                await db.promise().query(
                    `UPDATE employees
                     SET remaining_leave_quota = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [calculatedRemaining, employee.id]
                );
            }

            employee = {
                ...employee,
                remaining_leave_quota: calculatedRemaining,
            };
        }

        // Ambil roles
        const [rolesResults] = await db.promise().query(
            `SELECT r.name FROM roles r 
       JOIN user_roles ur ON r.id = ur.role_id 
       WHERE ur.user_id = ?`,
            [userId]
        );

        const roles = rolesResults.map((r) => r.name);

        res.json({
            user,
            employee,
            roles,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// PUT update user profile (pegawai update profil sendiri)
// ============================
router.put("/", verifyToken, uploadProfileFiles, async (req, res) => {
    const userId = req.user.id;
    const {
        name,
        email,
        phone,
        username,
        gender,
        birth_place,
        date_of_birth,
        marital_status,
        nationality,
        address,
        nik,
        bank_account,
        account_holder_name,
        bank_name,
    } = req.body;

    const normalizedMaritalStatus = normalizeMaritalStatus(marital_status);

    // Validasi input
    if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
    }

    try {
        const [currentUserRows] = await db
            .promise()
            .query("SELECT photo FROM users WHERE id = ?", [userId]);

        if (currentUserRows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const currentPhotoPath = currentUserRows[0].photo;

        // Cek apakah email sudah dipakai user lain
        const [existingUser] = await db
            .promise()
            .query("SELECT id FROM users WHERE email = ? AND id != ?", [
                email,
                userId,
            ]);

        if (existingUser.length > 0) {
            return res
                .status(409)
                .json({ message: "Email already used by another user" });
        }

        if (username) {
            const [existingUsername] = await db
                .promise()
                .query("SELECT id FROM users WHERE username = ? AND id != ?", [
                    username,
                    userId,
                ]);

            if (existingUsername.length > 0) {
                return res
                    .status(409)
                    .json({ message: "Username already used by another user" });
            }
        }

                const uploadedPhotoFilename = req.files?.photo?.[0]?.filename;
                let uploadedPhotoPath = uploadedPhotoFilename
                    ? `uploads/profile_photos/${uploadedPhotoFilename}`
                    : undefined;

                if (uploadedPhotoPath && isLocalUploadPath(currentPhotoPath)) {
                    const currentPhotoAbsolutePath = path.join(
                        __dirname,
                        "../",
                        currentPhotoPath
                    );
                    const newPhotoAbsolutePath = path.join(
                        __dirname,
                        "../",
                        uploadedPhotoPath
                    );

                    const isSamePhoto = await areFilesIdentical(
                        currentPhotoAbsolutePath,
                        newPhotoAbsolutePath
                    );

                    if (isSamePhoto) {
                        await fsp.unlink(newPhotoAbsolutePath).catch(() => null);
                        uploadedPhotoPath = undefined;
                    } else {
                        await fsp.unlink(currentPhotoAbsolutePath).catch(() => null);
                    }
                }


                                // Selalu urut: name, email, phone, username (opsional), photo (opsional), updated_at
                                const updates = ["name = ?", "email = ?", "phone = ?"];
                                const values = [name, email, phone || null];
                                if (username) {
                                    updates.push("username = ?");
                                    values.push(username);
                                }
                                if (uploadedPhotoPath) {
                                    updates.push("photo = ?");
                                    values.push(uploadedPhotoPath);
                                }
                                updates.push("updated_at = NOW()");
                                values.push(userId);

                                const updateUserQuery = `
                                    UPDATE users 
                                    SET ${updates.join(", ")}
                                    WHERE id = ?
                                `;

                                await db.promise().query(updateUserQuery, values);

        // Update data employee jika ada
        const [employeeRows] = await db
            .promise()
            .query("SELECT id, ktp_document, diploma_document FROM employees WHERE user_id = ?", [userId]);

        if (employeeRows.length > 0) {
            if (nik) {
                const [nikCheck] = await db
                    .promise()
                    .query(
                        "SELECT id FROM employees WHERE nik = ? AND user_id != ?",
                        [nik, userId],
                    );

                if (nikCheck.length > 0) {
                    return res.status(409).json({ message: "NIK already used by another employee" });
                }
            }

            const employeeCurrent = employeeRows[0];
            const employeeUpdates = [];
            const employeeValues = [];

            const appendEmployeeField = (column, value) => {
                if (value !== undefined) {
                    employeeUpdates.push(`${column} = ?`);
                    employeeValues.push(value || null);
                }
            };

            appendEmployeeField("full_name", name);
            appendEmployeeField("gender", gender);
            appendEmployeeField("birth_place", birth_place);
            appendEmployeeField("date_of_birth", date_of_birth);
            appendEmployeeField("marital_status", normalizedMaritalStatus);
            appendEmployeeField("nationality", nationality);
            appendEmployeeField("address", address);
            appendEmployeeField("phone", phone);
            appendEmployeeField("email", email);
            appendEmployeeField("nik", nik);
            appendEmployeeField("bank_account", bank_account);
            appendEmployeeField("account_holder_name", account_holder_name);
            appendEmployeeField("bank_name", bank_name);

            const uploadedKtpFilename = req.files?.ktp_document?.[0]?.filename;
            const uploadedDiplomaFilename = req.files?.diploma_document?.[0]?.filename;

            if (uploadedKtpFilename) {
                const newKtpPath = `uploads/employee_documents/${uploadedKtpFilename}`;

                if (isLocalUploadPath(employeeCurrent.ktp_document)) {
                    const currentKtpAbsolutePath = path.join(
                        __dirname,
                        "../",
                        employeeCurrent.ktp_document,
                    );
                    const newKtpAbsolutePath = path.join(__dirname, "../", newKtpPath);

                    const isSameKtp = await areFilesIdentical(
                        currentKtpAbsolutePath,
                        newKtpAbsolutePath,
                    );

                    if (isSameKtp) {
                        await fsp.unlink(newKtpAbsolutePath).catch(() => null);
                    } else {
                        appendEmployeeField("ktp_document", newKtpPath);
                        await fsp.unlink(currentKtpAbsolutePath).catch(() => null);
                    }
                } else {
                    appendEmployeeField("ktp_document", newKtpPath);
                }
            }

            if (uploadedDiplomaFilename) {
                const newDiplomaPath = `uploads/employee_documents/${uploadedDiplomaFilename}`;

                if (isLocalUploadPath(employeeCurrent.diploma_document)) {
                    const currentDiplomaAbsolutePath = path.join(
                        __dirname,
                        "../",
                        employeeCurrent.diploma_document,
                    );
                    const newDiplomaAbsolutePath = path.join(
                        __dirname,
                        "../",
                        newDiplomaPath,
                    );

                    const isSameDiploma = await areFilesIdentical(
                        currentDiplomaAbsolutePath,
                        newDiplomaAbsolutePath,
                    );

                    if (isSameDiploma) {
                        await fsp.unlink(newDiplomaAbsolutePath).catch(() => null);
                    } else {
                        appendEmployeeField("diploma_document", newDiplomaPath);
                        await fsp.unlink(currentDiplomaAbsolutePath).catch(() => null);
                    }
                } else {
                    appendEmployeeField("diploma_document", newDiplomaPath);
                }
            }

            if (employeeUpdates.length > 0) {
                employeeUpdates.push("updated_at = NOW()");
                employeeValues.push(userId);

                await db
                    .promise()
                    .query(
                        `UPDATE employees SET ${employeeUpdates.join(", ")} WHERE user_id = ?`,
                        employeeValues
                    );
            }
        }

        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// PUT update password (pegawai ganti password sendiri)
// ============================
router.put("/password", verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res
            .status(400)
            .json({ message: "Old and new password are required" });
    }

    if (newPassword.length < 6) {
        return res
            .status(400)
            .json({ message: "New password must be at least 6 characters" });
    }

    if (oldPassword === newPassword) {
        return res
            .status(400)
            .json({ message: "New password must be different from old password" });
    }

    try {
        // Ambil password lama dari database
        const [userResults] = await db
            .promise()
            .query("SELECT password FROM users WHERE id = ?", [userId]);

        if (userResults.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userResults[0];

        // Cek password lama cocok (dukung hash bcrypt + data legacy plaintext)
        let isMatch = false;
        if (typeof user.password === "string") {
            try {
                isMatch = await bcrypt.compare(oldPassword, user.password);
            } catch (compareError) {
                isMatch = false;
            }

            if (!isMatch) {
                isMatch = oldPassword === user.password;
            }
        }

        if (!isMatch) {
            return res
                .status(400)
                .json({ message: "Old password is incorrect" });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password di database
        await db
            .promise()
            .query(
                "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
                [hashedPassword, userId]
            );

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// GET Dashboard/Status Summary (Pegawai)
// ============================
// Pegawai melihat semua status: gaji, reimbursement, banding gaji, izin/cuti
router.get(
    "/dashboard",
    verifyToken,
    verifyRole(["pegawai"]),
    async (req, res) => {
        const userId = req.user.id;

        try {
            // Get employee_id
            const [employeeResult] = await db
                .promise()
                .query("SELECT id FROM employees WHERE user_id = ?", [userId]);

            if (employeeResult.length === 0) {
                return res
                    .status(404)
                    .json({ message: "Employee record not found" });
            }

            const employeeId = employeeResult[0].id;

            // 1. Payroll Status (3 terakhir)
            const [payrolls] = await db.promise().query(
                `SELECT id, period_month, period_year, net_salary, final_amount, 
                    status, appeal_status, published_at, claimed_at
             FROM payrolls 
             WHERE employee_id = ? 
             ORDER BY period_year DESC, period_month DESC 
             LIMIT 3`,
                [employeeId]
            );

            const visiblePayrolls = payrolls.filter((item) => {
                const payrollStatus = String(item.status || "").toLowerCase();
                if (payrollStatus !== "draft") return true;

                return String(item.appeal_status || "").toLowerCase() === "approved";
            });

            // 2. Reimbursement Status (pending & approved yang belum masuk payroll)
            const [reimbursements] = await db.promise().query(
                `SELECT id, reimbursement_type, amount, description, status, 
                    created_at, approved_at, payroll_id
             FROM reimbursements 
             WHERE employee_id = ? 
               AND status IN ('pending', 'approved', 'included_in_payroll')
             ORDER BY created_at DESC 
             LIMIT 5`,
                [employeeId]
            );

            // 3. Salary Appeals Status
            const [salaryAppeals] = await db.promise().query(
                `SELECT sa.id, sa.payroll_id, sa.reason, sa.expected_amount, 
                    sa.status, sa.review_notes, sa.created_at, sa.reviewed_at,
                    p.period_month, p.period_year, p.net_salary
             FROM salary_appeals sa
             JOIN payrolls p ON sa.payroll_id = p.id
             WHERE sa.employee_id = ?
             ORDER BY sa.created_at DESC 
             LIMIT 5`,
                [employeeId]
            );

            // 4. Leave Requests Status
            const [leaveRequests] = await db.promise().query(
                `SELECT id, leave_type, start_date, end_date, total_days, 
                    reason, status, created_at, approved_at
             FROM leave_requests 
             WHERE employee_id = ?
             ORDER BY created_at DESC 
             LIMIT 5`,
                [employeeId]
            );

            // Summary counts
            const summary = {
                pending_reimbursements: reimbursements.filter(
                    (r) => r.status === "pending"
                ).length,
                pending_leave_requests: leaveRequests.filter(
                    (l) => l.status === "pending"
                ).length,
                pending_salary_appeals: salaryAppeals.filter(
                    (s) => s.status === "pending"
                ).length,
                unpublished_payrolls: visiblePayrolls.filter(
                    (p) => p.status === "draft"
                ).length,
                unclaimed_payrolls: visiblePayrolls.filter(
                    (p) => p.status === "published"
                ).length,
            };

            res.json({
                summary,
                payrolls: visiblePayrolls,
                reimbursements,
                salary_appeals: salaryAppeals,
                leave_requests: leaveRequests,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
