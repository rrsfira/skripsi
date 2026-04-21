-- ============================================================
-- MIGRATION: Payroll manager adjustments (atasan -> finance)
-- Date: March 6, 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS `payroll_manager_adjustments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `payroll_id` INT(11) NULL,
  `employee_id` INT(11) NOT NULL,
  `period_month` INT(11) NOT NULL,
  `period_year` INT(11) NOT NULL,
  `bonus` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `other_allowance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `other_deduction` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `status` ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  `submitted_by` INT(11) NOT NULL,
  `submitted_at` DATETIME NULL,
  `reviewed_by` INT(11) NULL,
  `reviewed_at` DATETIME NULL,
  `review_notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_employee_period` (`employee_id`, `period_month`, `period_year`),
  KEY `idx_status` (`status`),
  KEY `idx_payroll_id` (`payroll_id`),
  KEY `idx_submitted_by` (`submitted_by`),
  KEY `idx_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_pma_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pma_payroll` FOREIGN KEY (`payroll_id`) REFERENCES `payrolls` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pma_submitted_by` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pma_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_pma_period_month` CHECK (`period_month` BETWEEN 1 AND 12),
  CONSTRAINT `chk_pma_amount_non_negative_bonus` CHECK (`bonus` >= 0),
  CONSTRAINT `chk_pma_amount_non_negative_other_allowance` CHECK (`other_allowance` >= 0),
  CONSTRAINT `chk_pma_amount_non_negative_other_deduction` CHECK (`other_deduction` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
