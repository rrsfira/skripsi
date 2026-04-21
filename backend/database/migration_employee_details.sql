-- ============================================================
-- MIGRATION: Add personal and financial details to employees
-- Date: January 14, 2026
-- ============================================================

ALTER TABLE `employees`
  ADD COLUMN `gender` ENUM('male', 'female', 'other') DEFAULT NULL AFTER `full_name`,
  ADD COLUMN `nationality` VARCHAR(100) DEFAULT 'Indonesian' AFTER `gender`,
  ADD COLUMN `address` TEXT DEFAULT NULL AFTER `nationality`,
  ADD COLUMN `phone` VARCHAR(20) DEFAULT NULL AFTER `address`,
  ADD COLUMN `email` VARCHAR(100) DEFAULT NULL AFTER `phone`,
  ADD COLUMN `nik` VARCHAR(20) UNIQUE DEFAULT NULL AFTER `email`,
  ADD COLUMN `npwp` VARCHAR(20) UNIQUE DEFAULT NULL AFTER `nik`,
  ADD COLUMN `bank_account` VARCHAR(30) DEFAULT NULL AFTER `npwp`,
  ADD COLUMN `bpjs_number` VARCHAR(20) UNIQUE DEFAULT NULL AFTER `bank_account`,
  ADD INDEX idx_nik (nik),
  ADD INDEX idx_npwp (npwp),
  ADD INDEX idx_bpjs_number (bpjs_number);
