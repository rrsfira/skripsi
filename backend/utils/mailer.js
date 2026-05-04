const nodemailer = require("nodemailer");
require("dotenv").config();

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : smtpPort === 465;
const smtpUser = (process.env.SMTP_USER || "").trim();
const smtpPass = (process.env.SMTP_PASS || "").trim();

const hasPlaceholderCredentials =
  smtpUser === "your_email@gmail.com" ||
  smtpPass === "your_app_password" ||
  !smtpUser ||
  !smtpPass;

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

// Verify transporter configuration
transporter.verify((error) => {
  if (hasPlaceholderCredentials) {
    console.error(
      "❌ Mailer configuration error: SMTP_USER/SMTP_PASS masih placeholder. Gunakan email Gmail asli dan 16-digit App Password.",
    );
    return;
  }

  if (error) {
    if (error.code === "EAUTH") {
      console.error(
        "❌ Mailer configuration error: Gmail menolak login. Pastikan SMTP_USER adalah alamat Gmail dan SMTP_PASS adalah App Password 16 digit (bukan password akun Gmail).",
      );
    }
    console.error("❌ Mailer configuration error:", error.message);
  } else {
  }
});

/**
 * Send password reset OTP email
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code (6 digits)
 * @param {string} userName - User name
 */
const sendPasswordResetOTP = async (email, otp, userName) => {
  try {
    if (hasPlaceholderCredentials) {
      const devMode = process.env.NODE_ENV !== "production";
      const msg =
        "SMTP credentials belum dikonfigurasi. Untuk pengujian lokal, menggunakan OTP yang dicetak di console (dev mode).";
      console.warn("⚠️", msg);
      if (devMode) {
        console.log("🔐 Development OTP:", otp);
        return { success: true, devOTP: otp };
      }

      return {
        success: false,
        error:
          "SMTP credentials belum dikonfigurasi. Isi SMTP_USER dan SMTP_PASS (App Password Gmail) di backend/.env.",
      };
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Kode OTP Reset Password - APK Pegawai",
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Kode OTP Reset Password</h2>
                    <p>Halo <strong>${userName}</strong>,</p>
                    <p>Kami menerima permintaan untuk mengatur ulang password akun Anda. Berikut adalah kode OTP Anda:</p>
                    <p style="margin: 20px 0; text-align: center;">
                        <span style="background-color: #f0f0f0; padding: 15px 25px; font-size: 24px; font-weight: bold; letter-spacing: 2px; border-radius: 5px;">
                            ${otp}
                        </span>
                    </p>
                    <p style="color: #666;">Kode OTP ini akan kadaluarsa dalam 10 menit.</p>
                    <p style="color: #666; font-size: 12px;">Jika ini bukan permintaan Anda, silahkan abaikan email ini.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #999; font-size: 12px;">© APK Pegawai 2025 - Sistem Manajemen Kepegawaian</p>
                </div>
            `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (error.code === "EAUTH") {
      const gmailAuthMessage =
        "Gagal autentikasi Gmail. Gunakan App Password 16 digit dari Google Account > Security > 2-Step Verification > App passwords.";
      console.error("❌ Failed to send OTP email:", gmailAuthMessage);
      return { success: false, error: gmailAuthMessage };
    }

    console.error("❌ Failed to send OTP email:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetOTP,
  transporter,
};
