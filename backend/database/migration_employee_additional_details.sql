-- ============================================================
-- MIGRATION: Add personal details and document fields to employees
-- Date: January 15, 2026
-- ============================================================

ALTER TABLE `employees`
  ADD COLUMN `birth_place` VARCHAR(100) DEFAULT NULL AFTER `gender`,
  ADD COLUMN `date_of_birth` DATE DEFAULT NULL AFTER `birth_place`,
  ADD COLUMN `marital_status` ENUM('single','married','divorced','widowed') DEFAULT NULL AFTER `date_of_birth`,
  ADD COLUMN `account_holder_name` VARCHAR(150) DEFAULT NULL AFTER `bank_account`,
  ADD COLUMN `bank_name` VARCHAR(100) DEFAULT NULL AFTER `account_holder_name`,
  ADD COLUMN `ktp_document` VARCHAR(255) DEFAULT NULL AFTER `bank_name`,
  ADD COLUMN `diploma_document` VARCHAR(255) DEFAULT NULL AFTER `ktp_document`,
  ADD COLUMN `employment_contract_document` VARCHAR(255) DEFAULT NULL AFTER `diploma_document`,
  ADD INDEX idx_date_of_birth (date_of_birth);
