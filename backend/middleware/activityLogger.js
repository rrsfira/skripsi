const db = require("../config/db");

async function resolveUserIdentity(userId, username, role) {
    let resolvedUsername = username;
    let resolvedRole = role;

    if (!userId || userId <= 0) {
        return {
            username: resolvedUsername || "system",
            role: resolvedRole || "system",
        };
    }

    if (resolvedUsername && resolvedRole) {
        return {
            username: resolvedUsername,
            role: resolvedRole,
        };
    }

    const [users] = await db
        .promise()
        .query("SELECT id, username FROM users WHERE id = ? LIMIT 1", [userId]);

    if (!users.length) {
        return {
            username: resolvedUsername || "unknown",
            role: resolvedRole || "unknown",
        };
    }

    const user = users[0];
    const [roles] = await db.promise().query(
        `SELECT r.name
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ?
         ORDER BY r.name ASC
         LIMIT 1`,
        [userId],
    );

    return {
        username: resolvedUsername || user.username || "unknown",
        role: resolvedRole || roles?.[0]?.name || "unknown",
    };
}

/**
 * Log aktivitas ke database
 */
async function logActivity({
    userId,
    username,
    role,
    action,
    module,
    description = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    status = "success",
    errorMessage = null,
}) {
    try {
        if (!userId || userId <= 0) {
            console.warn('[LOGGING] Skipping activity log because userId is missing or invalid', {
                userId,
                username,
                role,
                action,
                module,
            })
            return;
        }

        const identity = await resolveUserIdentity(userId, username, role);

        const query = `
            INSERT INTO activity_logs (
                user_id, 
                username, 
                role, 
                action, 
                module, 
                description, 
                old_values, 
                new_values, 
                ip_address, 
                user_agent, 
                status, 
                error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            userId,
            identity.username,
            identity.role,
            action,
            module,
            description,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress,
            userAgent,
            status,
            errorMessage,
        ];

        await db.promise().query(query, values);
        console.log(`[LOG] ${action} by ${identity.username} on ${module}`);
    } catch (error) {
        console.error("[ERROR] Failed to log activity:", {
            error: error && error.message ? error.message : error,
            userId,
            username,
            role,
            action,
            module,
        });
    }
}

function getIpAddress(req) {
    return (
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown"
    );
}

function getUserAgent(req) {
    return req.headers["user-agent"] || "unknown";
}

function getDataChanges(oldData, newData) {
    const oldValues = {};
    const newValues = {};
    let hasChanges = false;

    for (const key in newData) {
        if (oldData[key] !== newData[key]) {
            oldValues[key] = oldData[key];
            newValues[key] = newData[key];
            hasChanges = true;
        }
    }

    return hasChanges ? { oldValues, newValues } : null;
}

module.exports = {
    logActivity,
    getIpAddress,
    getUserAgent,
    getDataChanges,
};
