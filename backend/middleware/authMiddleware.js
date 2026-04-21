const jwt = require("jsonwebtoken");
require("dotenv").config();
const tokenBlacklist = require("./tokenBlacklist");
const db = require("../config/db");

const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token required" });

    if (tokenBlacklist.includes(token)) {
        return res
            .status(403)
            .json({ message: "Token has been revoked (blacklisted)" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token expired" });
            }
            return res.status(403).json({ message: "Token invalid" });
        }

        try {
            const [userRows] = await db
                .promise()
                .query("SELECT status FROM users WHERE id = ? LIMIT 1", [
                    user.id,
                ]);

            if (userRows.length === 0) {
                return res.status(401).json({ message: "User not found" });
            }

            if (String(userRows[0].status || "").toLowerCase() === "inactive") {
                return res.status(403).json({
                    message: "Akun Anda sedang tidak aktif. Hubungi HR/Admin.",
                    code: "ACCOUNT_INACTIVE",
                });
            }
        } catch (dbError) {
            return res.status(500).json({ message: "Server error" });
        }

        req.user = user;
        next();
    });
};

// Middleware untuk verifikasi peran (roles)
const verifyRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: "User not authenticated" });
        }

        const userRoles = req.user.roles || [];
        const hasRole = allowedRoles.some((role) => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ message: "Access denied" });
        }

        next();
    };
};

module.exports = { verifyToken, verifyRole };
