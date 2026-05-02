const nodemailer = require('nodemailer')
require('dotenv').config()

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465
const smtpUser = (process.env.SMTP_USER || '').trim()
const smtpPass = (process.env.SMTP_PASS || '').trim()

const hasPlaceholderCredentials =
    smtpUser === 'your_email@gmail.com' ||
    smtpPass === 'your_app_password' ||
    !smtpUser ||
    !smtpPass

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
})

// Verify transporter configuration
transporter.verify((error) => {
    if (hasPlaceholderCredentials) {
        console.error(
            '❌ Mailer configuration error: SMTP_USER/SMTP_PASS masih placeholder. Gunakan email Gmail asli dan 16-digit App Password.'
        )
        return
    }

    if (error) {
        if (error.code === 'EAUTH') {
            console.error(
                '❌ Mailer configuration error: Gmail menolak login. Pastikan SMTP_USER adalah alamat Gmail dan SMTP_PASS adalah App Password 16 digit (bukan password akun Gmail).'
            )
        }
        console.error('❌ Mailer configuration error:', error.message)
    } else {
    }
})

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Reset token
 * @param {string} userName - User name
 */
const sendPasswordResetEmail = async (email, resetToken, userName) => {
    try {
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`

        if (hasPlaceholderCredentials) {
            const devMode = process.env.NODE_ENV !== 'production'
            const msg = 'SMTP credentials belum dikonfigurasi. Untuk pengujian lokal, menggunakan link yang dicetak di console (dev mode).'
            console.warn('⚠️', msg)
            if (devMode) {
                console.log('🔗 Development reset link:', resetLink)
                return { success: true, devLink: resetLink }
            }

            return {
                success: false,
                error: 'SMTP credentials belum dikonfigurasi. Isi SMTP_USER dan SMTP_PASS (App Password Gmail) di backend/.env.',
            }
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Password Reset Request - APK Pegawai',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>Halo <strong>${userName}</strong>,</p>
                    <p>Kami menerima permintaan untuk mengatur ulang password akun Anda. Jika ini bukan permintaan Anda, silahkan abaikan email ini.</p>
                    <p style="margin: 20px 0;">
                        <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Password
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">Link ini akan kadaluarsa dalam 1 jam.</p>
                    <p style="color: #666; font-size: 12px;">Atau copy link ini ke browser: <br/>${resetLink}</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #999; font-size: 12px;">© APK Pegawai 2025 - Sistem Manajemen Kepegawaian</p>
                </div>
            `,
        }

        const info = await transporter.sendMail(mailOptions)
        return { success: true, messageId: info.messageId }
    } catch (error) {
        if (error.code === 'EAUTH') {
            const gmailAuthMessage =
                'Gagal autentikasi Gmail. Gunakan App Password 16 digit dari Google Account > Security > 2-Step Verification > App passwords.'
            console.error('❌ Failed to send password reset email:', gmailAuthMessage)
            return { success: false, error: gmailAuthMessage }
        }

        console.error('❌ Failed to send password reset email:', error.message)
        return { success: false, error: error.message }
    }
}

module.exports = {
    sendPasswordResetEmail,
    transporter,
}
