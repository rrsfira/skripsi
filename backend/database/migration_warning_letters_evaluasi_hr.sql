-- ============================================================
-- MIGRATION: Add evaluasi_hr to sp_level ENUM in warning_letters
-- Date: March 13, 2026
-- ============================================================

ALTER TABLE `warning_letters`
  MODIFY COLUMN `sp_level` ENUM('sp1','sp2','sp3','evaluasi_hr') NOT NULL;
