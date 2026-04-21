const buildError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const resolveManagerScope = async (db, userId) => {
    const [rows] = await db
        .promise()
        .query(
            `SELECT 
                e.id AS employee_id,
                p.department_id,
                p.level,
                p.name AS position_name,
                d.name AS department_name
             FROM employees e
             JOIN positions p ON e.position_id = p.id
             LEFT JOIN departments d ON p.department_id = d.id
             WHERE e.user_id = ?
             LIMIT 1`,
            [userId]
        );

    if (!rows.length) {
        throw buildError("Atasan tidak terhubung dengan data pegawai", 404);
    }

    const scope = rows[0];

    if (!scope.department_id) {
        throw buildError("Atasan belum memiliki departemen", 400);
    }

    const level = String(scope.level || "").toLowerCase();
    if (level !== "manager") {
        throw buildError("Akses atasan hanya untuk jabatan level manager", 403);
    }

    return {
        managerEmployeeId: scope.employee_id,
        departmentId: scope.department_id,
        positionName: scope.position_name,
        departmentName: scope.department_name,
    };
};

module.exports = {
    resolveManagerScope,
};
