-- ============================================================
-- MIGRATION: Add Late Detection & Payroll Integration
-- Date: January 12, 2026
-- ============================================================

-- 1. CREATE TABLE working_hours (BARU)
-- ============================================================
CREATE TABLE IF NOT EXISTS `working_hours` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `check_in_time` time NOT NULL,
  `check_out_time` time NOT NULL,
  `grace_period_minutes` int(11) DEFAULT 0,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert default working hours
INSERT INTO `working_hours` (`name`, `check_in_time`, `check_out_time`, `grace_period_minutes`, `is_default`) 
VALUES ('Standard Working Hours', '08:00:00', '16:00:00', 0, 1);

-- 2. ALTER TABLE attendance - TAMBAH FIELD BARU
-- ============================================================
ALTER TABLE `attendance` 
ADD COLUMN `is_late` tinyint(1) DEFAULT 0 AFTER `status`,
ADD COLUMN `late_minutes` int(11) DEFAULT 0 AFTER `is_late`,
ADD COLUMN `working_hours` decimal(5,2) DEFAULT NULL AFTER `late_minutes`,
ADD COLUMN `overtime_hours` decimal(5,2) DEFAULT 0.00 AFTER `working_hours`,
ADD COLUMN `notes` text DEFAULT NULL AFTER `overtime_hours`,
ADD COLUMN `updated_at` timestamp DEFAULT current_timestamp() ON UPDATE current_timestamp() AFTER `created_at`;

-- Add index untuk performa
ALTER TABLE `attendance`
ADD KEY `date` (`date`);

-- 3. ALTER TABLE payrolls - TAMBAH FIELD UNTUK DEDUCTION
-- ============================================================
ALTER TABLE `payrolls`
ADD COLUMN `late_deduction` decimal(12,2) DEFAULT 0.00 AFTER `deduction`,
ADD COLUMN `absent_deduction` decimal(12,2) DEFAULT 0.00 AFTER `late_deduction`,
ADD COLUMN `total_late_days` int(11) DEFAULT 0 AFTER `absent_deduction`,
ADD COLUMN `total_absent_days` int(11) DEFAULT 0 AFTER `total_late_days`;

-- 4. NOTES
-- ============================================================
-- ✅ Attendance akan otomatis set is_late=1 jika check_in > 08:00:00
-- ✅ Late minutes akan dihitung otomatis
-- ✅ Working hours akan dihitung dari check_out - check_in
-- ✅ Payroll generation akan otomatis hitung late_deduction & absent_deduction
-- ✅ Formula: late_deduction = (late_minutes/60) × (salary/8/30) × 2%
