-- ========================================
-- Migration: Add Missing Document Columns to Applications Table
-- Date: March 18, 2026
-- Description: Add new document fields for comprehensive application management
-- ========================================

-- Safely add columns if they don't already exist
SET @dbname = DATABASE();
SET @tablename = "applications";

-- Add ktp_file if not exists
SET @columnname = "ktp_file";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER `certificate_file`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add photo_file if not exists
SET @columnname = "photo_file";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER `ktp_file`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add experience_letter_file if not exists
SET @columnname = "experience_letter_file";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER `photo_file`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add reference_letter_file if not exists
SET @columnname = "reference_letter_file";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER `experience_letter_file`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add skck_file if not exists
SET @columnname = "skck_file";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER `reference_letter_file`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add github_link if not exists
SET @columnname = "github_link";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(500) DEFAULT NULL AFTER `skck_file`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add design_link if not exists
SET @columnname = "design_link";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(500) DEFAULT NULL AFTER `github_link`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add youtube_link if not exists
SET @columnname = "youtube_link";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(500) DEFAULT NULL AFTER `design_link`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add marketing_portfolio_link if not exists
SET @columnname = "marketing_portfolio_link";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(500) DEFAULT NULL AFTER `youtube_link`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add campaign_link if not exists
SET @columnname = "campaign_link";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(500) DEFAULT NULL AFTER `marketing_portfolio_link`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add documents_uploaded_at if not exists
SET @columnname = "documents_uploaded_at";
SET @preparedstatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname) AND (TABLE_SCHEMA = @dbname)) > 0,
    "SELECT 1",
    CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`")
));
PREPARE stmt FROM @preparedstatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========================================
-- Summary of Document Structure:
-- ========================================
-- REQUIRED FOR ALL POSITIONS:
-- - cv_file (3 MB max)
-- - ktp_file (3 MB max)
-- - photo_file (3 MB max)
-- - ijazah_file (5 MB max)
-- - transcript_file (5 MB max)
-- - certificate_file (5 MB max)
-- - experience_letter_file (5 MB max)
-- - reference_letter_file (5 MB max)
-- - skck_file (5 MB max)

-- POSITION-SPECIFIC DOCUMENTS:
-- - portfolio_file (10 MB max) - Required for: Developer, UI/UX, Content Creator, Designer, Video Editor, Marketing roles
-- - github_link - Required for: Developer | Optional for: UI/UX
-- - design_link - Required for: UI/UX, Graphic Designer | Optional for: Content Creator, Video Editor
-- - youtube_link - Required for: Content Creator, Video Editor | Optional for: Designer, Marketing roles
-- - marketing_portfolio_link - Required for: Marketing/BD | Optional for: Director, Ops, Content Creator
-- - campaign_link - Required for: Marketing/BD | Optional for: Director, Ops, Content Creator
