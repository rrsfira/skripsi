-- ============================================================
-- MIGRATION: Warning letters (SP1/SP2/SP3)
-- Date: March 06, 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS `warning_letters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `letter_number` VARCHAR(100) NOT NULL,
  `sp_level` ENUM('sp1','sp2','sp3') NOT NULL,
  `employee_id` INT NOT NULL,
  `issued_by_user_id` INT NOT NULL,
  `issued_by_role` ENUM('hr','admin') NOT NULL,
  `company_name` VARCHAR(150) NOT NULL DEFAULT 'PT OTAK KANAN',
  `company_address` VARCHAR(255) NOT NULL DEFAULT 'Graha Pena, Ruang 1503, Jl. Ahmad Yani No.88, Ketintang, Kec. Gayungan, Surabaya, Jawa Timur 60234',
  `violation_date` DATE NOT NULL,
  `issued_date` DATE NOT NULL,
  `valid_until` DATE NOT NULL,
  `status` ENUM('active','expired','revoked') NOT NULL DEFAULT 'active',
  `reason` TEXT DEFAULT NULL,
  `signed_title` VARCHAR(150) DEFAULT NULL,
  `signed_name` VARCHAR(150) DEFAULT NULL,
  `letter_content` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_warning_letter_number` (`letter_number`),
  KEY `idx_warning_letters_employee_id` (`employee_id`),
  KEY `idx_warning_letters_sp_level` (`sp_level`),
  KEY `idx_warning_letters_issued_date` (`issued_date`),
  CONSTRAINT `fk_warning_letters_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_warning_letters_issued_by_user` FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
);
