const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");

// ============================
// Finance Dashboard
// ============================
router.get("/", verifyToken, verifyRole(["finance"]), async (req, res) => {
    try {
        const fallbackMonth = new Date().getMonth() + 1;
        const fallbackYear = new Date().getFullYear();

        let currentMonth, currentYear;

        if (req.query.month && req.query.year) {
            currentMonth = Number(req.query.month);
            currentYear = Number(req.query.year);
        } else {
            const [latestPayrollPeriodRows] = await db.promise().query(
                `SELECT period_month, period_year
                 FROM payrolls
                 GROUP BY period_year, period_month
                 ORDER BY period_year DESC, period_month DESC
                 LIMIT 1`
            );
            const latestPayrollPeriod = latestPayrollPeriodRows[0] || {};
            currentMonth = Number(latestPayrollPeriod.period_month || fallbackMonth);
            currentYear = Number(latestPayrollPeriod.period_year || fallbackYear);
        }

        // 1. Payroll Overview (Current Month)
        const [payrollStats] = await db.promise().query(
            `SELECT 
                COUNT(*) as total_payrolls,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
                SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed,
                SUM(basic_salary) as total_basic_salary,
                SUM(COALESCE(allowance,0) + COALESCE(transport_allowance,0) + COALESCE(meal_allowance,0) + COALESCE(health_allowance,0) + COALESCE(bonus,0) + COALESCE(other_allowance,0)) as total_allowances,
                SUM(reimbursement_total) as total_reimbursement,
                SUM(deduction) as total_deduction,
                SUM(net_salary) as total_net_salary,
                SUM(basic_salary + COALESCE(allowance,0) + COALESCE(transport_allowance,0) + COALESCE(meal_allowance,0) + COALESCE(health_allowance,0) + COALESCE(bonus,0) + COALESCE(other_allowance,0) + reimbursement_total) as total_income,
                SUM(CASE WHEN final_amount IS NOT NULL THEN final_amount ELSE net_salary END) as total_payout
            FROM payrolls 
            WHERE period_month = ? AND period_year = ?`,
            [currentMonth, currentYear]
        );

        // 2. Reimbursement Financial Summary
        const [reimbursementFinance] = await db.promise().query(
            `SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount,
                SUM(CASE WHEN status = 'included_in_payroll' THEN amount ELSE 0 END) as included_amount,
                SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_amount
            FROM reimbursements
            WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?`,
            [currentMonth, currentYear]
        );

        // 3. Reimbursement by Type
        const [reimbursementByType] = await db.promise().query(
            `SELECT 
                reimbursement_type,
                COUNT(*) as count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount
            FROM reimbursements
            WHERE status = 'included_in_payroll'
              AND MONTH(created_at) = ? AND YEAR(created_at) = ?
            GROUP BY reimbursement_type
            ORDER BY total_amount DESC`,
            [currentMonth, currentYear]
        );

        // 4. Salary Appeals Financial Impact
        const [appealFinance] = await db.promise().query(
            `SELECT 
                COUNT(*) as total_appeals,
                SUM(CASE WHEN sa.status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN sa.status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN sa.status = 'approved' THEN 
                    COALESCE(p.final_amount, sa.expected_amount, 0) - p.net_salary 
                ELSE 0 END) as additional_cost
            FROM salary_appeals sa
            JOIN payrolls p ON sa.payroll_id = p.id
            WHERE MONTH(sa.created_at) = ? AND YEAR(sa.created_at) = ?`,
            [currentMonth, currentYear]
        );

        // 5. Payrolls Ready for Payment (Published but not claimed)
        const [readyForPayment] = await db.promise().query(
            `SELECT p.id, p.employee_id, e.employee_code, u.name as employee_name,
                    p.period_month, p.period_year,
                    p.net_salary, p.final_amount,
                    COALESCE(p.final_amount, p.net_salary) as amount_to_pay,
                    p.published_at
             FROM payrolls p
             JOIN employees e ON p.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             WHERE p.status = 'published'
               AND p.period_month = ? AND p.period_year = ?
             ORDER BY p.published_at ASC`,
            [currentMonth, currentYear]
        );

        // 6. Already Claimed (for tracking)
        const [claimedPayrolls] = await db.promise().query(
            `SELECT p.id, e.employee_code, u.name as employee_name,
                    COALESCE(p.final_amount, p.net_salary) as paid_amount,
                    p.claimed_at
             FROM payrolls p
             JOIN employees e ON p.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             WHERE p.status = 'claimed'
               AND p.period_month = ? AND p.period_year = ?
             ORDER BY p.claimed_at DESC`,
            [currentMonth, currentYear]
        );

        // 7. Monthly Salary Trends (January to December in active year)
        const [salaryTrends] = await db.promise().query(
            `
            SELECT 
                period_month, period_year,
                COUNT(*) as employee_count,
                SUM(net_salary) as total_salary,
                SUM(reimbursement_total) as total_reimbursement,
                SUM(deduction) as total_deduction,
                AVG(net_salary) as avg_salary
            FROM payrolls
            WHERE period_year = ?
            GROUP BY period_year, period_month
            ORDER BY period_month ASC
            LIMIT 12
        `,
            [currentYear]
        );

        const trendLookup = new Map(
            salaryTrends.map((row) => [
                `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
                row,
            ])
        );

        const normalizedTrends = Array.from({ length: 12 }, (_, index) => {
            const periodYear = currentYear;
            const periodMonth = index + 1;
            const trendKey = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
            const existingTrend = trendLookup.get(trendKey) || {};

            return {
                period_month: periodMonth,
                period_year: periodYear,
                employee_count: Number(existingTrend.employee_count || 0),
                total_salary: Number(existingTrend.total_salary || 0),
                total_reimbursement: Number(existingTrend.total_reimbursement || 0),
                total_deduction: Number(existingTrend.total_deduction || 0),
                avg_salary: Number(existingTrend.avg_salary || 0),
            };
        });

        // 8. Top Salary Earners (current month)
        const [topEarners] = await db.promise().query(
            `SELECT e.employee_code,
                    u.name,
                    d.name as department_name,
                    p.net_salary,
                    p.final_amount,
                    COALESCE(p.final_amount, p.net_salary) as total_pay,
                    p.reimbursement_total, p.deduction
             FROM payrolls p
             JOIN employees e ON p.employee_id = e.id
             JOIN users u ON e.user_id = u.id
             LEFT JOIN positions pos ON e.position_id = pos.id
             LEFT JOIN departments d ON pos.department_id = d.id
             WHERE p.period_month = ? AND p.period_year = ?
             ORDER BY total_pay DESC
             LIMIT 10`,
            [currentMonth, currentYear]
        );

        // 9. Total Basic Salary from Employees table (fixed, not period-dependent)
        const [employeeBasicSalaryRows] = await db.promise().query(
            `SELECT SUM(basic_salary) as total_basic_salary_employees
             FROM employees`
        );
        const totalBasicSalaryFromEmployees = parseFloat(employeeBasicSalaryRows[0]?.total_basic_salary_employees || 0);

        // 10. Deduction Summary
        const [deductionSummary] = await db.promise().query(
            `SELECT 
                SUM(late_deduction) as total_late_deduction,
                SUM(absent_deduction) as total_absent_deduction,
                SUM(deduction) as total_all_deductions,
                AVG(late_deduction) as avg_late_deduction,
                AVG(absent_deduction) as avg_absent_deduction
            FROM payrolls
            WHERE period_month = ? AND period_year = ?`,
            [currentMonth, currentYear]
        );

        res.json({
            period: {
                month: currentMonth,
                year: currentYear,
            },
            payroll_overview: {
                current_month: payrollStats[0],
                ready_for_payment: readyForPayment.length,
                claimed_count: claimedPayrolls.length,
            },
            financial_summary: {
                total_payout: parseFloat(payrollStats[0]?.total_payout || 0),
                total_income: parseFloat(payrollStats[0]?.total_income || 0),
                total_basic_salary: totalBasicSalaryFromEmployees,
                total_allowance: parseFloat(payrollStats[0]?.total_allowances || 0),
                total_reimbursement: parseFloat(payrollStats[0]?.total_reimbursement || 0),
                total_deduction: parseFloat(payrollStats[0]?.total_deduction || 0),
            },
            reimbursements: {
                summary: reimbursementFinance[0],
                by_type: reimbursementByType,
            },
            salary_appeals: appealFinance[0],
            deductions: deductionSummary[0],
            payment_queue: {
                ready: readyForPayment,
                already_paid: claimedPayrolls,
            },
            trends: normalizedTrends,
            top_earners: topEarners,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================
// Finance Employee References
// ============================
router.get(
    "/employees-reference",
    verifyToken,
    verifyRole(["finance"]),
    async (req, res) => {
        try {
            const [rows] = await db.promise().query(
                `SELECT
                    e.id as employee_id,
                    e.employee_code,
                    e.basic_salary,
                    e.employment_status,
                    u.name as employee_name,
                    u.photo,
                    u.status as user_status,
                    p.id as position_id,
                    p.name as position_name,
                    p.level as position_level,
                    d.name as department_name,
                    GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') as roles
                 FROM employees e
                 JOIN users u ON e.user_id = u.id
                 LEFT JOIN positions p ON e.position_id = p.id
                 LEFT JOIN departments d ON p.department_id = d.id
                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                 LEFT JOIN roles r ON ur.role_id = r.id
                 GROUP BY
                    e.id,
                    e.employee_code,
                    e.basic_salary,
                    e.employment_status,
                    u.name,
                    u.photo,
                    u.status,
                    p.id,
                    p.name,
                    p.level,
                    d.name
                 ORDER BY u.name ASC`
            );

            res.status(200).json({ data: rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
