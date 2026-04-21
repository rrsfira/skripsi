-- ============================================================
-- MIGRATION: Add payroll allowance & deduction breakdown
-- Date: January 14, 2026
-- ============================================================

ALTER TABLE `payrolls`
  ADD COLUMN `transport_allowance` decimal(12,2) DEFAULT 0.00 AFTER `allowance`,
  ADD COLUMN `meal_allowance` decimal(12,2) DEFAULT 0.00 AFTER `transport_allowance`,
  ADD COLUMN `health_allowance` decimal(12,2) DEFAULT 0.00 AFTER `meal_allowance`,
  ADD COLUMN `bonus` decimal(12,2) DEFAULT 0.00 AFTER `health_allowance`,
  ADD COLUMN `other_allowance` decimal(12,2) DEFAULT 0.00 AFTER `bonus`,
  ADD COLUMN `gross_salary` decimal(12,2) DEFAULT 0.00 AFTER `other_allowance`,
  ADD COLUMN `total_income` decimal(12,2) DEFAULT 0.00 AFTER `gross_salary`,
  ADD COLUMN `bpjs_deduction` decimal(12,2) DEFAULT 0.00 AFTER `absent_deduction`,
  ADD COLUMN `tax_deduction` decimal(12,2) DEFAULT 0.00 AFTER `bpjs_deduction`,
  ADD COLUMN `other_deduction` decimal(12,2) DEFAULT 0.00 AFTER `tax_deduction`,
  ADD COLUMN `present_days` int(11) DEFAULT 0 AFTER `total_absent_days`;
