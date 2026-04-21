const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./config/db");

// modul route (rute)
const authRoutes = require("./controllers/auth");
const attendanceRoutes = require("./controllers/attendance");
const payrollRoutes = require("./controllers/payroll");
const payrollSettingsRoutes = require("./controllers/payrollSettings");
const profileRoutes = require("./controllers/profile");
const employeeRoutes = require("./controllers/employee");
const workingHoursRoutes = require("./controllers/workingHours");
const reimbursementRoutes = require("./controllers/reimbursement");
const salaryAppealRoutes = require("./controllers/salaryAppeal");
const dashboardAdminRoutes = require("./controllers/dashboardAdmin");
const dashboardAtasanRoutes = require("./controllers/dashboardAtasan");
const dashboardHRRoutes = require("./controllers/dashboardHR");
const dashboardFinanceRoutes = require("./controllers/dashboardFinance");
const candidateRoutes = require("./controllers/candidate");
const jobOpeningsRoutes = require("./controllers/jobOpenings");
const activityLogsRoutes = require("./controllers/activityLogs");
const warningLettersRoutes = require("./controllers/warningLetters");
const hrInterviewCompleteRoutes = require("./controllers/hrInterviewComplete");
const interviewResultEditRoutes = require("./controllers/interviewResultEdit");
const hrInterviewRoutes = require("./controllers/hrInterview");
const candidateCallRoutes = require("./controllers/candidateCall");
const uploadInvitationRoutes = require("./controllers/uploadInvitation");
const hrcandidateRoutes = require("./controllers/candidateHR");

const app = express();
// Menggunakan middleware CORS untuk mengizinkan permintaan dari domain yang berbeda
app.use(cors());

// Menggunakan middleware untuk memparsing request body dalam format JSON dan URL-encoded
app.use(express.json()); // Middleware untuk menangani data dari form (application/x-www-form-urlencoded)
// 'extended: true' memungkinkan parsing data nested (bertingkat)
app.use(express.urlencoded({ extended: true }));

// Mengimpor modul 'path' bawaan Node.js untuk mengelola path file/folder
const path = require("path");

// Static files untuk akses lampiran (contoh: bukti cuti/izin)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/payroll-settings", payrollSettingsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/working-hours", workingHoursRoutes);
app.use("/api/reimbursements", reimbursementRoutes);
app.use("/api/salary-appeals", salaryAppealRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dashboard/admin", dashboardAdminRoutes);
app.use("/api/dashboard/atasan", dashboardAtasanRoutes);
app.use("/api/dashboard/hr", dashboardHRRoutes);
app.use("/api/dashboard/finance", dashboardFinanceRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/job-openings", jobOpeningsRoutes);
app.use("/api/activity-logs", activityLogsRoutes);
app.use("/api/candidate-calls", candidateCallRoutes);
app.use("/api", uploadInvitationRoutes);
app.use("/api/warning-letters", warningLettersRoutes);
app.use("/api", hrInterviewCompleteRoutes);
app.use("/api", interviewResultEditRoutes);
app.use("/api", hrInterviewRoutes);
app.use("/api/hr", hrcandidateRoutes);

app.get("/", (req, res) => {
    res.send("API is running...");
});

// Menentukan port server: ambil dari environment variable atau default ke 5000
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Bootstrap schema agar fitur soft delete tidak gagal di DB lama.
        if (typeof db.ensureSoftDeleteColumns === "function") {
            await db.ensureSoftDeleteColumns();
        }
    } catch (error) {
        console.error("[WARN] Soft delete bootstrap failed:", error.message);
    }

    // Menjalankan server dan menampilkan pesan saat berhasil dijalankan
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();
