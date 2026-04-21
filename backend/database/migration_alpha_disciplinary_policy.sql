-- ============================================================
-- MIGRATION: Alpha disciplinary policy (SP1/SP2/SP3/evaluasi/nonaktif)
-- Date: March 06, 2026
-- ============================================================

ALTER TABLE `employees`
  ADD COLUMN `alpha_consecutive_days` INT NOT NULL DEFAULT 0 AFTER `remaining_leave_quota`,
  ADD COLUMN `alpha_accumulated_days` INT NOT NULL DEFAULT 0 AFTER `alpha_consecutive_days`,
  ADD COLUMN `alpha_sanction_level` ENUM('none','sp1','sp2','sp3','evaluasi_hr') NOT NULL DEFAULT 'none' AFTER `alpha_accumulated_days`,
  ADD COLUMN `alpha_last_evaluated_at` DATETIME DEFAULT NULL AFTER `alpha_sanction_level`,
  ADD INDEX `idx_employees_alpha_sanction` (`alpha_sanction_level`),
  ADD INDEX `idx_employees_alpha_consecutive` (`alpha_consecutive_days`),
  ADD INDEX `idx_employees_alpha_accumulated` (`alpha_accumulated_days`);
