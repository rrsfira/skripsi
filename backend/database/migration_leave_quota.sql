-- ============================================================
-- MIGRATION: Add leave quota tracking to employees
-- Date: January 14, 2026
-- ============================================================

ALTER TABLE `employees`
  ADD COLUMN `annual_leave_quota` int(11) DEFAULT 12 AFTER `working_hours_id`,
  ADD COLUMN `remaining_leave_quota` int(11) DEFAULT 12 AFTER `annual_leave_quota`,
  ADD COLUMN `quota_reset_date` date DEFAULT NULL AFTER `remaining_leave_quota`;

-- Set initial quota for existing employees (if any)
UPDATE `employees` 
SET `annual_leave_quota` = 12, 
    `remaining_leave_quota` = 12,
    `quota_reset_date` = DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
WHERE `annual_leave_quota` IS NULL;
