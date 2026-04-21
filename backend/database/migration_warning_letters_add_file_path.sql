-- ============================================================
-- MIGRATION: Add file_path to warning_letters
-- Date: March 07, 2026
-- ============================================================

ALTER TABLE `warning_letters`
  ADD COLUMN `file_path` VARCHAR(255) DEFAULT NULL AFTER `letter_content`;
