-- ============================================================
-- MIGRATION: Payroll settings (editable allowances)
-- Date: January 14, 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS `payroll_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `transport_per_day` DECIMAL(12,2) NOT NULL DEFAULT 50000.00,
  `meal_per_day` DECIMAL(12,2) NOT NULL DEFAULT 25000.00,
  `health_percentage` DECIMAL(5,4) NOT NULL DEFAULT 0.0100, -- 1% of basic salary
  `bpjs_percentage` DECIMAL(5,4) NOT NULL DEFAULT 0.0100,   -- 1% of basic salary
  `updated_by` INT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Ensure at least one settings row exists
INSERT INTO `payroll_settings` (`transport_per_day`, `meal_per_day`, `health_percentage`, `bpjs_percentage`)
SELECT 50000.00, 25000.00, 0.0100, 0.0100
WHERE NOT EXISTS (SELECT 1 FROM `payroll_settings` LIMIT 1);
