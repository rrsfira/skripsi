-- ========================================
-- MIGRATION: Complete Recruitment System
-- ========================================

-- 1. Tabel job_openings (Lowongan Pekerjaan)
CREATE TABLE IF NOT EXISTS `job_openings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `position_id` INT(11) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `requirements` TEXT,
  `responsibilities` TEXT,
  `quota` INT(11) DEFAULT 1,
  `employment_type` ENUM('permanent', 'contract', 'intern') DEFAULT 'permanent',
  `salary_range_min` DECIMAL(15,2),
  `salary_range_max` DECIMAL(15,2),
  `location` VARCHAR(255),
  `deadline` DATE,
  `status` ENUM('open', 'closed', 'draft') DEFAULT 'open',
  `created_by` INT(11),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_position` (`position_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deadline` (`deadline`),
  CONSTRAINT `fk_job_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_job_creator` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Tabel applications (Lamaran Kandidat)
CREATE TABLE IF NOT EXISTS `applications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `job_opening_id` INT(11) NOT NULL,
  `candidate_id` INT(11) NOT NULL,
  `cover_letter` TEXT,
  `status` ENUM('submitted', 'reviewing', 'shortlisted', 'interview_scheduled', 'interviewed', 'accepted', 'rejected', 'withdrawn') DEFAULT 'submitted',
  `admin_notes` TEXT,
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL,
  `reviewed_by` INT(11),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_application` (`job_opening_id`, `candidate_id`),
  KEY `idx_candidate` (`candidate_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_app_job` FOREIGN KEY (`job_opening_id`) REFERENCES `job_openings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_app_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_app_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Tabel interviews (Jadwal Wawancara)
CREATE TABLE IF NOT EXISTS `interviews` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `application_id` INT(11) NOT NULL,
  `interview_type` ENUM('phone', 'video', 'onsite', 'technical', 'hr', 'final') DEFAULT 'video',
  `scheduled_date` DATETIME NOT NULL,
  `duration_minutes` INT(11) DEFAULT 60,
  `meeting_link` VARCHAR(500),
  `location` VARCHAR(255),
  `interviewer_id` INT(11),
  `interviewer_notes` TEXT,
  `candidate_notes` TEXT,
  `rating` ENUM('1', '2', '3', '4', '5') COMMENT '1=Poor, 5=Excellent',
  `result` ENUM('pending', 'passed', 'failed', 'no_show') DEFAULT 'pending',
  `status` ENUM('scheduled', 'completed', 'cancelled', 'rescheduled') DEFAULT 'scheduled',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_application` (`application_id`),
  KEY `idx_interviewer` (`interviewer_id`),
  KEY `idx_scheduled_date` (`scheduled_date`),
  CONSTRAINT `fk_interview_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_interview_interviewer` FOREIGN KEY (`interviewer_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Update candidates table - add user_id untuk login
ALTER TABLE `candidates` 
ADD COLUMN `user_id` INT(11) DEFAULT NULL AFTER `id`,
ADD KEY `idx_user_id` (`user_id`),
ADD CONSTRAINT `fk_candidate_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- 5. Update candidates table - remove old interview fields (moved to interviews table)
ALTER TABLE `candidates`
DROP COLUMN IF EXISTS `interviewed_by`,
DROP COLUMN IF EXISTS `interview_date`,
DROP COLUMN IF EXISTS `interview_notes`;

-- 6. Update candidates table - simplify status
ALTER TABLE `candidates`
MODIFY COLUMN `status` ENUM('registered', 'active', 'inactive') DEFAULT 'registered' COMMENT 'registered=just signed up, active=has applications, inactive=opted out';

-- 7. Add application_count to candidates for quick reference
ALTER TABLE `candidates`
ADD COLUMN `application_count` INT(11) DEFAULT 0 AFTER `status`;

-- 8. Add notification preferences
ALTER TABLE `candidates`
ADD COLUMN `email_notifications` TINYINT(1) DEFAULT 1 AFTER `application_count`,
ADD COLUMN `last_login` TIMESTAMP NULL AFTER `email_notifications`;

-- ========================================
-- Sample Data
-- ========================================

-- Sample job opening (jika ada position dengan id=4)
INSERT INTO `job_openings` (`position_id`, `title`, `description`, `requirements`, `responsibilities`, `quota`, `employment_type`, `salary_range_min`, `salary_range_max`, `location`, `deadline`, `status`, `created_by`)
SELECT 4, 'Operations Supervisor', 
'Kami membuka lowongan untuk posisi Operations Supervisor yang akan bertanggung jawab atas pengawasan operasional harian.',
'- Minimal S1 di bidang terkait\n- Pengalaman minimal 3 tahun di bidang operasional\n- Kepemimpinan yang baik\n- Komunikasi efektif',
'- Mengawasi tim operasional\n- Membuat laporan harian\n- Koordinasi dengan departemen lain\n- Mengelola inventory',
2, 'permanent', 7000000, 9000000, 'Jakarta', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'open', 
(SELECT id FROM employees WHERE position_id IN (SELECT id FROM positions WHERE level IN ('manager', 'director')) LIMIT 1)
WHERE EXISTS (SELECT 1 FROM positions WHERE id = 4)
AND EXISTS (SELECT 1 FROM employees WHERE position_id IN (SELECT id FROM positions WHERE level IN ('manager', 'director')) LIMIT 1);

-- ========================================
-- Indexes untuk Performance
-- ========================================
ALTER TABLE `applications` ADD INDEX `idx_submitted_at` (`submitted_at`);
ALTER TABLE `interviews` ADD INDEX `idx_result` (`result`);
ALTER TABLE `interviews` ADD INDEX `idx_status` (`status`);
