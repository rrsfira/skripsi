const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const COMPANY_NAME = "PT OTAK KANAN";
const COMPANY_ADDRESS =
    "Graha Pena, Ruang 1503, Jl. Ahmad Yani No.88, Ketintang, Kec. Gayungan, Surabaya, Jawa Timur 60234";

const VALID_SP_LEVELS = ["sp1", "sp2", "sp3"];
const WARNING_LETTER_UPLOAD_SUBDIR = "warning_letters";

const isAdminContext = (req) => {
    const activeRole = String(req.headers["x-active-role"] || "").toLowerCase();
    return (req.user.roles || []).includes("admin") && activeRole === "admin";
};

const isHrContext = (req) => {
    const activeRole = String(req.headers["x-active-role"] || "").toLowerCase();
    return (req.user.roles || []).includes("hr") && activeRole === "hr";
};

const normalizeSpLevel = (value) => {
    const normalized = String(value || "").toLowerCase().trim();
    if (VALID_SP_LEVELS.includes(normalized)) {
        return normalized;
    }
    return null;
};

const toReadableSpLabel = (spLevel) => {
    const normalized = normalizeSpLevel(spLevel) || "sp1";
    if (normalized === "sp1") return "SURAT PERINGATAN PERTAMA (SP1)";
    if (normalized === "sp2") return "SURAT PERINGATAN KEDUA (SP2)";
    return "SURAT PERINGATAN KETIGA (SP3)";
};

const monthRoman = (monthNumber) => {
    const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return map[Math.max(1, Math.min(12, Number(monthNumber || 1))) - 1];
};

const formatDateForLetter = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
};

const buildWarningLetterContent = ({
    letterNumber,
    spLevel,
    employee,
    violationDate,
    violationDateEnd,
    consecutiveAlphaDays,
    reason,
    issuedDate,
    signedTitle,
    signedName,
}) => {
    const spTitle = toReadableSpLabel(spLevel);
    const employeeName = employee.employee_name || "-";
    const departmentName = employee.department_name || "-";
    const positionName = employee.position_name || "-";
    const npwp = employee.npwp || "-";
    const violationDateText = formatDateForLetter(violationDate);
    const violationDateEndText = formatDateForLetter(violationDateEnd);
    const isConsecutiveRange =
        Number(consecutiveAlphaDays || 0) > 1 &&
        violationDate &&
        violationDateEnd &&
        violationDate !== violationDateEnd;
    const issuedDateText = formatDateForLetter(issuedDate);
    const violationReason =
        reason ||
        (isConsecutiveRange
            ? `Berdasarkan catatan kehadiran, Saudara tidak masuk kerja tanpa\nketerangan (alpha) secara berturut-turut pada tanggal\n${violationDateText} s.d. ${violationDateEndText}.`
            : `Berdasarkan catatan kehadiran, Saudara tidak masuk kerja tanpa\nketerangan (alpha) pada tanggal ${violationDateText}.`);

    return `${COMPANY_NAME}\n${COMPANY_ADDRESS}\n\n${spTitle}\nNo: ${letterNumber}\n\nDiberikan kepada:\nNama       : ${employeeName}\nDepartemen : ${departmentName}\nPosisi     : ${positionName}\nNPWP       : ${npwp}\n\n${violationReason}\n\nSehubungan dengan hal tersebut, perusahaan memberikan ${spTitle}.\nDiharapkan Saudara tidak mengulangi pelanggaran tersebut dan meningkatkan\nkedisiplinan kerja.\n\nSurat peringatan ini berlaku selama 6 bulan sejak tanggal diterbitkan.\n\nSurabaya, ${issuedDateText}\n\n${signedTitle}\n(${signedName || "...................."})`;
};

const buildEvaluasiHRContent = ({
    letterNumber,
    employee,
    evaluationDate,
    evaluationTime,
    evaluationPlace,
    issuedDate,
    signedTitle,
    signedName,
}) => {
    const employeeName = employee.employee_name || "-";
    const departmentName = employee.department_name || "-";
    const positionName = employee.position_name || "-";
    const issuedDateText = formatDateForLetter(issuedDate);
    const evalDay = evaluationDate
        ? new Date(evaluationDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long" })
        : "-";
    const evalDateText = evaluationDate
        ? `${evalDay}, ${formatDateForLetter(evaluationDate)}`
        : "-";
    const evalTimeText = evaluationTime || "-";
    const evalPlaceText = evaluationPlace || "Ruang HR / Kantor HRD";

    return `${COMPANY_NAME}\n${COMPANY_ADDRESS}\n\nUNDANGAN EVALUASI HR\nNo: ${letterNumber}\n\nDiberikan kepada:\nNama       : ${employeeName}\nDepartemen : ${departmentName}\nPosisi     : ${positionName}\n\nDengan hormat,\n\nSehubungan dengan catatan pelanggaran kedisiplinan kehadiran yang telah\nmencapai tahap Surat Peringatan III (SP3), dengan ini Saudara diminta\nuntuk menghadiri sesi Evaluasi HR.\n\nEvaluasi ini bertujuan untuk melakukan peninjauan terhadap riwayat\nkehadiran serta memberikan kesempatan kepada Saudara untuk menyampaikan\nklarifikasi terkait pelanggaran yang terjadi.\n\nAdapun pelaksanaan evaluasi akan dilakukan pada:\n\nHari/Tanggal : ${evalDateText}\nWaktu        : ${evalTimeText}\nTempat       : ${evalPlaceText}\n\nDiharapkan Saudara dapat hadir sesuai jadwal yang telah ditentukan.\n\nSurabaya, ${issuedDateText}\n\n${signedTitle}\n(${signedName || "...................."})`;
};

const getEmployeeBaseData = async (employeeId) => {
    const [rows] = await db.promise().query(
        `SELECT
            e.id AS employee_id,
            e.employee_code,
            COALESCE(e.full_name, u.name) AS employee_name,
            e.npwp,
            e.alpha_sanction_level,
            e.alpha_consecutive_days,
            e.alpha_accumulated_days,
            p.name AS position_name,
            LOWER(COALESCE(p.level, '')) AS position_level,
            d.name AS department_name,
            LOWER(COALESCE(u.status, 'active')) AS user_status,
            GROUP_CONCAT(DISTINCT LOWER(r.name)) AS roles_csv
         FROM employees e
         JOIN users u ON e.user_id = u.id
         LEFT JOIN positions p ON e.position_id = p.id
         LEFT JOIN departments d ON p.department_id = d.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE e.id = ?
         GROUP BY
            e.id,
            e.employee_code,
            employee_name,
            e.npwp,
            e.alpha_sanction_level,
            e.alpha_consecutive_days,
            e.alpha_accumulated_days,
            p.name,
            p.level,
            d.name,
            u.status`,
        [employeeId]
    );

    return rows[0] || null;
};

const canAdminIssueForTarget = (employeeData) => {
    const roles = String(employeeData?.roles_csv || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const isHrRole = roles.includes("hr");
    const level = String(employeeData?.position_level || "").toLowerCase();
    const isManagerOrAtasan = level === "manager" || level === "atasan";
    return isHrRole && isManagerOrAtasan;
};

const assertIssuerScope = (req, employeeData) => {
    const hrContext = isHrContext(req);
    const adminContext = isAdminContext(req);

    if (!hrContext && !adminContext) {
        const error = new Error("Role aktif tidak valid untuk membuat surat peringatan");
        error.statusCode = 403;
        throw error;
    }

    if (adminContext && !canAdminIssueForTarget(employeeData)) {
        const error = new Error(
            "Direktur hanya dapat membuat SP untuk pegawai HR dengan level atasan/manager"
        );
        error.statusCode = 403;
        throw error;
    }
};

const generateLetterNumber = async (issuedDate) => {
    const issued = new Date(issuedDate);
    const year = issued.getFullYear();
    const month = issued.getMonth() + 1;

    const [rows] = await db.promise().query(
        `SELECT COUNT(*) AS total
         FROM warning_letters
         WHERE YEAR(issued_date) = ? AND MONTH(issued_date) = ?`,
        [year, month]
    );

    const nextNumber = Number(rows[0]?.total || 0) + 1;
    const serial = String(nextNumber).padStart(3, "0");

    return `${serial}/SP-HRD/${monthRoman(month)}/${year}`;
};

const generateEvaluasiLetterNumber = async (issuedDate) => {
    const issued = new Date(issuedDate);
    const year = issued.getFullYear();
    const month = issued.getMonth() + 1;

    const [rows] = await db.promise().query(
        `SELECT COUNT(*) AS total
         FROM warning_letters
         WHERE sp_level = 'evaluasi_hr' AND YEAR(issued_date) = ? AND MONTH(issued_date) = ?`,
        [year, month]
    );

    const nextNumber = Number(rows[0]?.total || 0) + 1;
    const serial = String(nextNumber).padStart(3, "0");

    return `${serial}/EVAL-HRD/${monthRoman(month)}/${year}`;
};

const toDateOnly = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getAlphaViolationContext = async (employeeId) => {
    const [rows] = await db.promise().query(
        `SELECT date, status
         FROM attendance
         WHERE employee_id = ?
         ORDER BY date DESC`,
        [employeeId]
    );

    if (!rows.length) {
        return null;
    }

    let latestAlphaDate = null;
    let streakStartDate = null;
    let consecutiveAlphaDays = 0;
    let streakStarted = false;

    for (const row of rows) {
        const status = String(row.status || "").toLowerCase();

        if (!latestAlphaDate && status === "alpha") {
            latestAlphaDate = toDateOnly(row.date);
        }

        if (status === "libur") {
            continue;
        }

        if (status === "alpha") {
            streakStarted = true;
            consecutiveAlphaDays += 1;
            streakStartDate = toDateOnly(row.date);
            continue;
        }

        if (streakStarted) {
            break;
        }

        break;
    }

    if (!latestAlphaDate) {
        return null;
    }

    return {
        latestAlphaDate,
        streakStartDate: streakStartDate || latestAlphaDate,
        streakEndDate: latestAlphaDate,
        consecutiveAlphaDays,
    };
};

const getIssuerSignatureInfo = async (userId, issuerRole) => {
    const [rows] = await db.promise().query(
        `SELECT
            u.name AS user_name,
            e.full_name AS employee_full_name,
            p.name AS position_name
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.id
         LEFT JOIN positions p ON p.id = e.position_id
         WHERE u.id = ?
         LIMIT 1`,
        [userId]
    );

    if (!rows.length) {
        return {
            signedTitle: issuerRole === "admin" ? "Direktur" : "HRD Manager",
            signedName: "....................",
        };
    }

    const issuerRow = rows[0];
    const signedName =
        String(issuerRow.employee_full_name || "").trim() ||
        String(issuerRow.user_name || "").trim() ||
        "....................";
    const signedTitle =
        String(issuerRow.position_name || "").trim() ||
        (issuerRole === "admin" ? "Direktur" : "HRD Manager");

    return {
        signedTitle,
        signedName,
    };
};

const saveWarningLetterToUploadFolder = async ({
    letterNumber,
    employeeId,
    issuedDate,
    letterContent,
}) => {
    const uploadDirectory = path.join(
        __dirname,
        `../uploads/${WARNING_LETTER_UPLOAD_SUBDIR}`
    );

    fs.mkdirSync(uploadDirectory, { recursive: true });

    const safeLetterNumber = String(letterNumber || "SP")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const safeIssuedDate = String(issuedDate || "").replace(/[^0-9-]/g, "");

    const fileName = `sp-${safeLetterNumber}-${employeeId}-${safeIssuedDate}.pdf`;
    const absoluteFilePath = path.join(uploadDirectory, fileName);
    const relativeFilePath = `uploads/${WARNING_LETTER_UPLOAD_SUBDIR}/${fileName}`;

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 56 });
        const writeStream = fs.createWriteStream(absoluteFilePath);

        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        doc.on("error", reject);

        doc.pipe(writeStream);
        doc.font("Helvetica").fontSize(11).text(String(letterContent || ""), {
            align: "left",
            lineGap: 4,
        });
        doc.end();
    });

    return relativeFilePath;
};

router.get(
    "/eligible-employees",
    verifyToken,
    verifyRole(["hr", "admin"]),
    async (req, res) => {
        try {
            const [rows] = await db.promise().query(
                `SELECT
                    e.id AS employee_id,
                    e.user_id AS employee_user_id,
                    e.employee_code,
                    COALESCE(e.full_name, u.name) AS employee_name,
                    e.npwp,
                    p.name AS position_name,
                    LOWER(COALESCE(p.level, '')) AS position_level,
                    d.name AS department_name,
                    e.alpha_sanction_level,
                    e.alpha_consecutive_days,
                    e.alpha_accumulated_days,
                          MAX(CASE WHEN a.status = 'alpha' THEN a.date END) AS latest_alpha_date,
                    GROUP_CONCAT(DISTINCT LOWER(r.name)) AS roles_csv
                 FROM employees e
                 JOIN users u ON e.user_id = u.id
                 LEFT JOIN positions p ON e.position_id = p.id
                 LEFT JOIN departments d ON p.department_id = d.id
                      LEFT JOIN attendance a ON a.employee_id = e.id
                 LEFT JOIN user_roles ur ON ur.user_id = u.id
                 LEFT JOIN roles r ON r.id = ur.role_id
                 GROUP BY
                    e.id,
                    e.user_id,
                    e.employee_code,
                    employee_name,
                    e.npwp,
                    p.name,
                    p.level,
                    d.name,
                    e.alpha_sanction_level,
                    e.alpha_consecutive_days,
                    e.alpha_accumulated_days
                 ORDER BY employee_name ASC`
            );

            const adminContext = isAdminContext(req);
            const filtered = adminContext
                ? rows.filter((row) => canAdminIssueForTarget(row))
                : rows;

            const enrichedRows = await Promise.all(
                filtered.map(async (row) => {
                    const violationContext = await getAlphaViolationContext(
                        row.employee_id
                    );

                    const violationDateStart =
                        violationContext?.streakStartDate || null;
                    const violationDateEnd =
                        violationContext?.streakEndDate || null;
                    const isRange =
                        !!violationDateStart &&
                        !!violationDateEnd &&
                        violationDateStart !== violationDateEnd;

                    return {
                        ...row,
                        latest_alpha_date:
                            violationContext?.latestAlphaDate || row.latest_alpha_date,
                        violation_date_start: violationDateStart,
                        violation_date_end: violationDateEnd,
                        violation_date_label: isRange
                            ? `${violationDateStart} s.d. ${violationDateEnd}`
                            : violationDateStart || "",
                        consecutive_alpha_days:
                            violationContext?.consecutiveAlphaDays || 0,
                    };
                })
            );

            res.json({
                message: "Eligible employees fetched successfully",
                total: enrichedRows.length,
                data: enrichedRows,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.get("/", verifyToken, verifyRole(["hr", "admin"]), async (req, res) => {
    try {
        const { employee_id } = req.query;

        let query = `SELECT
                wl.id,
                wl.letter_number,
                wl.sp_level,
                wl.employee_id,
                wl.issued_by_user_id,
                wl.issued_by_role,
                wl.violation_date,
                wl.issued_date,
                wl.valid_until,
                wl.status,
                wl.reason,
                wl.signed_title,
                wl.signed_name,
                wl.letter_content,
                wl.file_path,
                COALESCE(e.full_name, u.name) AS employee_name,
                e.employee_code,
                e.npwp,
                p.name AS position_name,
                LOWER(COALESCE(p.level, '')) AS position_level,
                d.name AS department_name,
                GROUP_CONCAT(DISTINCT LOWER(r.name)) AS recipient_roles_csv,
                issuer.name AS issued_by_name
            FROM warning_letters wl
            JOIN employees e ON wl.employee_id = e.id
            JOIN users u ON e.user_id = u.id
            LEFT JOIN positions p ON e.position_id = p.id
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            LEFT JOIN users issuer ON issuer.id = wl.issued_by_user_id
            WHERE 1=1`;

        const params = [];

        if (employee_id) {
            query += " AND wl.employee_id = ?";
            params.push(employee_id);
        }

        query += `
            GROUP BY
                wl.id,
                wl.letter_number,
                wl.sp_level,
                wl.employee_id,
                wl.issued_by_user_id,
                wl.issued_by_role,
                wl.violation_date,
                wl.issued_date,
                wl.valid_until,
                wl.status,
                wl.reason,
                wl.signed_title,
                wl.signed_name,
                wl.letter_content,
                wl.file_path,
                employee_name,
                e.employee_code,
                e.npwp,
                p.name,
                p.level,
                d.name,
                issuer.name
            ORDER BY wl.issued_date DESC, wl.id DESC`;

        const [rows] = await db.promise().query(query, params);

        const adminContext = isAdminContext(req);
        const filtered = adminContext
            ? rows.filter((row) => canAdminIssueForTarget({
                  roles_csv: row.recipient_roles_csv,
                  position_level: row.position_level,
              }))
            : rows;

        res.json({
            message: "Warning letters fetched successfully",
            total: filtered.length,
            data: filtered,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/my", verifyToken, verifyRole(["pegawai"]), async (req, res) => {
    try {
        const userId = req.user.id;
        const [employeeRows] = await db
            .promise()
            .query("SELECT id FROM employees WHERE user_id = ? LIMIT 1", [userId]);

        if (!employeeRows.length) {
            return res.status(404).json({
                message: "Data pegawai tidak ditemukan",
            });
        }

        const employeeId = employeeRows[0].id;
        const [rows] = await db.promise().query(
            `SELECT
                wl.id,
                wl.letter_number,
                wl.sp_level,
                wl.employee_id,
                wl.violation_date,
                wl.issued_date,
                wl.valid_until,
                wl.status,
                wl.reason,
                wl.signed_title,
                wl.signed_name,
                wl.letter_content,
                wl.created_at,
                COALESCE(e.full_name, u.name) AS employee_name,
                e.employee_code,
                p.name AS position_name,
                d.name AS department_name
             FROM warning_letters wl
             JOIN employees e ON wl.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             LEFT JOIN positions p ON e.position_id = p.id
             LEFT JOIN departments d ON p.department_id = d.id
             WHERE wl.employee_id = ?
             ORDER BY wl.issued_date DESC, wl.id DESC`,
            [employeeId]
        );

        return res.json({
            message: "My warning letters fetched successfully",
            total: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
});

router.get(
    "/:id",
    verifyToken,
    verifyRole(["hr", "admin"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await db.promise().query(
                `SELECT
                    wl.*,
                    COALESCE(e.full_name, u.name) AS employee_name,
                    e.employee_code,
                    e.npwp,
                    p.name AS position_name,
                    LOWER(COALESCE(p.level, '')) AS position_level,
                    d.name AS department_name,
                    GROUP_CONCAT(DISTINCT LOWER(r.name)) AS recipient_roles_csv,
                    issuer.name AS issued_by_name
                FROM warning_letters wl
                JOIN employees e ON wl.employee_id = e.id
                JOIN users u ON e.user_id = u.id
                LEFT JOIN positions p ON e.position_id = p.id
                LEFT JOIN departments d ON p.department_id = d.id
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                LEFT JOIN users issuer ON issuer.id = wl.issued_by_user_id
                WHERE wl.id = ?
                GROUP BY
                    wl.id,
                    employee_name,
                    e.employee_code,
                    e.npwp,
                    wl.file_path,
                    p.name,
                    p.level,
                    d.name,
                    issuer.name`,
                [id]
            );

            if (!rows.length) {
                return res.status(404).json({ message: "Surat peringatan tidak ditemukan" });
            }

            const letter = rows[0];
            const adminContext = isAdminContext(req);
            if (
                adminContext &&
                !canAdminIssueForTarget({
                    roles_csv: letter.recipient_roles_csv,
                    position_level: letter.position_level,
                })
            ) {
                return res.status(403).json({
                    message:
                        "Direktur hanya dapat melihat SP untuk pegawai HR dengan level atasan/manager",
                });
            }

            return res.json({ data: letter });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Server error" });
        }
    }
);

router.post("/", verifyToken, verifyRole(["hr", "admin"]), async (req, res) => {
    try {
        const {
            employee_id,
            sp_level,
            reason,
            issued_date,
            evaluation_date,
            evaluation_time,
            evaluation_place,
        } = req.body;

        if (!employee_id) {
            return res.status(400).json({ message: "employee_id wajib diisi" });
        }

        const employeeData = await getEmployeeBaseData(employee_id);
        if (!employeeData) {
            return res.status(404).json({ message: "Pegawai tidak ditemukan" });
        }

        assertIssuerScope(req, employeeData);

        const normalizedIssuedDate = toDateOnly(issued_date || new Date());
        if (!normalizedIssuedDate) {
            return res.status(400).json({
                message: "Format issued_date tidak valid. Gunakan YYYY-MM-DD",
            });
        }

        const issuerRole = isAdminContext(req) ? "admin" : "hr";
        const issuerSignature = await getIssuerSignatureInfo(req.user.id, issuerRole);

        const isEvaluasiHR = String(sp_level || "").toLowerCase().trim() === "evaluasi_hr";

        if (isEvaluasiHR) {
            const violationContextEval = await getAlphaViolationContext(employee_id);
            const evalViolationDate = violationContextEval?.latestAlphaDate || normalizedIssuedDate;

            const evalLetterNumber = await generateEvaluasiLetterNumber(normalizedIssuedDate);
            const evalLetterContent = buildEvaluasiHRContent({
                letterNumber: evalLetterNumber,
                employee: employeeData,
                evaluationDate: evaluation_date,
                evaluationTime: evaluation_time,
                evaluationPlace: evaluation_place || "Ruang HR / Kantor HRD",
                issuedDate: normalizedIssuedDate,
                signedTitle: issuerSignature.signedTitle,
                signedName: issuerSignature.signedName,
            });

            const evalFilePath = await saveWarningLetterToUploadFolder({
                letterNumber: evalLetterNumber,
                employeeId: employee_id,
                issuedDate: normalizedIssuedDate,
                letterContent: evalLetterContent,
            });

            const [evalResult] = await db.promise().query(
                `INSERT INTO warning_letters (
                    letter_number, sp_level, employee_id, issued_by_user_id, issued_by_role,
                    company_name, company_address, violation_date, issued_date, valid_until,
                    status, reason, signed_title, signed_name, letter_content, file_path,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    evalLetterNumber, "evaluasi_hr", employee_id, req.user.id, issuerRole,
                    COMPANY_NAME, COMPANY_ADDRESS, evalViolationDate, normalizedIssuedDate, normalizedIssuedDate,
                    issuerSignature.signedTitle, issuerSignature.signedName, evalLetterContent, evalFilePath,
                ]
            );

            const [evalCreatedRows] = await db.promise().query(
                `SELECT wl.*,
                        COALESCE(e.full_name, u.name) AS employee_name,
                        e.employee_code,
                        e.npwp,
                        p.name AS position_name,
                        d.name AS department_name,
                        wl.file_path
                 FROM warning_letters wl
                 JOIN employees e ON wl.employee_id = e.id
                 JOIN users u ON e.user_id = u.id
                 LEFT JOIN positions p ON e.position_id = p.id
                 LEFT JOIN departments d ON p.department_id = d.id
                 WHERE wl.id = ?
                 LIMIT 1`,
                [evalResult.insertId]
            );

            return res.status(201).json({
                message: "Undangan evaluasi HR berhasil dibuat",
                data: evalCreatedRows[0] || null,
            });
        }

        const violationContext = await getAlphaViolationContext(employee_id);
        if (!violationContext?.latestAlphaDate) {
            return res.status(400).json({
                message:
                    "Tanggal pelanggaran alpha tidak ditemukan. Pastikan pegawai memiliki data alpha terlebih dahulu.",
            });
        }

        const normalizedViolationDate =
            Number(violationContext.consecutiveAlphaDays || 0) > 1
                ? violationContext.streakStartDate
                : violationContext.latestAlphaDate;

        const inferredLevel = normalizeSpLevel(employeeData.alpha_sanction_level) || "sp1";
        const normalizedSpLevel = normalizeSpLevel(sp_level) || inferredLevel;

        const letterNumber = await generateLetterNumber(normalizedIssuedDate);

        const validUntilDate = new Date(normalizedIssuedDate);
        validUntilDate.setMonth(validUntilDate.getMonth() + 6);
        const validUntil = toDateOnly(validUntilDate);

        const letterContent = buildWarningLetterContent({
            letterNumber,
            spLevel: normalizedSpLevel,
            employee: employeeData,
            violationDate: normalizedViolationDate,
            violationDateEnd: violationContext.streakEndDate,
            consecutiveAlphaDays: violationContext.consecutiveAlphaDays,
            reason,
            issuedDate: normalizedIssuedDate,
            signedTitle: issuerSignature.signedTitle,
            signedName: issuerSignature.signedName,
        });
        const filePath = await saveWarningLetterToUploadFolder({
            letterNumber,
            employeeId: employee_id,
            issuedDate: normalizedIssuedDate,
            letterContent,
        });

        const [result] = await db.promise().query(
            `INSERT INTO warning_letters (
                letter_number,
                sp_level,
                employee_id,
                issued_by_user_id,
                issued_by_role,
                company_name,
                company_address,
                violation_date,
                issued_date,
                valid_until,
                status,
                reason,
                signed_title,
                signed_name,
                letter_content,
                file_path,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                letterNumber,
                normalizedSpLevel,
                employee_id,
                req.user.id,
                issuerRole,
                COMPANY_NAME,
                COMPANY_ADDRESS,
                normalizedViolationDate,
                normalizedIssuedDate,
                validUntil,
                reason || null,
                issuerSignature.signedTitle,
                issuerSignature.signedName,
                letterContent,
                filePath,
            ]
        );

        const [createdRows] = await db.promise().query(
            `SELECT wl.*,
                    COALESCE(e.full_name, u.name) AS employee_name,
                    e.employee_code,
                    e.npwp,
                    p.name AS position_name,
                          d.name AS department_name,
                          wl.file_path
             FROM warning_letters wl
             JOIN employees e ON wl.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             LEFT JOIN positions p ON e.position_id = p.id
             LEFT JOIN departments d ON p.department_id = d.id
             WHERE wl.id = ?
             LIMIT 1`,
            [result.insertId]
        );

        return res.status(201).json({
            message: "Surat peringatan berhasil dibuat",
            data: createdRows[0] || null,
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Server error",
        });
    }
});

module.exports = router;
