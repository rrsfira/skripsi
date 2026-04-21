-- ============================================================
-- MIGRATION: Add soft delete columns
-- Date: 2026-03-10
-- ============================================================

SET @schema_name = DATABASE();

-- employees.deleted_at
SET @employees_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'employees'
      AND COLUMN_NAME = 'deleted_at'
);

SET @ddl_employees_deleted_at = IF(
    @employees_deleted_at_exists = 0,
    'ALTER TABLE employees ADD COLUMN deleted_at DATETIME NULL AFTER updated_at',
    'SELECT ''employees.deleted_at already exists'''
);

PREPARE stmt FROM @ddl_employees_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- job_openings.deleted_at
SET @job_openings_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'job_openings'
      AND COLUMN_NAME = 'deleted_at'
);

SET @ddl_job_openings_deleted_at = IF(
    @job_openings_deleted_at_exists = 0,
    'ALTER TABLE job_openings ADD COLUMN deleted_at DATETIME NULL AFTER updated_at',
    'SELECT ''job_openings.deleted_at already exists'''
);

PREPARE stmt FROM @ddl_job_openings_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- payrolls.deleted_at
SET @payrolls_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'payrolls'
      AND COLUMN_NAME = 'deleted_at'
);

SET @ddl_payrolls_deleted_at = IF(
    @payrolls_deleted_at_exists = 0,
    'ALTER TABLE payrolls ADD COLUMN deleted_at DATETIME NULL AFTER updated_at',
    'SELECT ''payrolls.deleted_at already exists'''
);

PREPARE stmt FROM @ddl_payrolls_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- salary_appeals.deleted_at
SET @salary_appeals_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'salary_appeals'
      AND COLUMN_NAME = 'deleted_at'
);

SET @ddl_salary_appeals_deleted_at = IF(
    @salary_appeals_deleted_at_exists = 0,
    'ALTER TABLE salary_appeals ADD COLUMN deleted_at DATETIME NULL AFTER updated_at',
    'SELECT ''salary_appeals.deleted_at already exists'''
);

PREPARE stmt FROM @ddl_salary_appeals_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- working_hours.deleted_at
SET @working_hours_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'working_hours'
      AND COLUMN_NAME = 'deleted_at'
);

SET @ddl_working_hours_deleted_at = IF(
    @working_hours_deleted_at_exists = 0,
    'ALTER TABLE working_hours ADD COLUMN deleted_at DATETIME NULL AFTER updated_at',
    'SELECT ''working_hours.deleted_at already exists'''
);

PREPARE stmt FROM @ddl_working_hours_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Optional indexes for filtering performance
SET @idx_employees_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'employees'
      AND index_name = 'idx_employees_deleted_at'
);

SET @ddl_idx_employees_deleted_at = IF(
    @idx_employees_deleted_at_exists = 0,
    'CREATE INDEX idx_employees_deleted_at ON employees (deleted_at)',
    'SELECT ''idx_employees_deleted_at already exists'''
);

PREPARE stmt FROM @ddl_idx_employees_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_job_openings_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'job_openings'
      AND index_name = 'idx_job_openings_deleted_at'
);

SET @ddl_idx_job_openings_deleted_at = IF(
    @idx_job_openings_deleted_at_exists = 0,
    'CREATE INDEX idx_job_openings_deleted_at ON job_openings (deleted_at)',
    'SELECT ''idx_job_openings_deleted_at already exists'''
);

PREPARE stmt FROM @ddl_idx_job_openings_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_payrolls_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'payrolls'
      AND index_name = 'idx_payrolls_deleted_at'
);

SET @ddl_idx_payrolls_deleted_at = IF(
    @idx_payrolls_deleted_at_exists = 0,
    'CREATE INDEX idx_payrolls_deleted_at ON payrolls (deleted_at)',
    'SELECT ''idx_payrolls_deleted_at already exists'''
);

PREPARE stmt FROM @ddl_idx_payrolls_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_salary_appeals_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'salary_appeals'
      AND index_name = 'idx_salary_appeals_deleted_at'
);

SET @ddl_idx_salary_appeals_deleted_at = IF(
    @idx_salary_appeals_deleted_at_exists = 0,
    'CREATE INDEX idx_salary_appeals_deleted_at ON salary_appeals (deleted_at)',
    'SELECT ''idx_salary_appeals_deleted_at already exists'''
);

PREPARE stmt FROM @ddl_idx_salary_appeals_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_working_hours_deleted_at_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'working_hours'
      AND index_name = 'idx_working_hours_deleted_at'
);

SET @ddl_idx_working_hours_deleted_at = IF(
    @idx_working_hours_deleted_at_exists = 0,
    'CREATE INDEX idx_working_hours_deleted_at ON working_hours (deleted_at)',
    'SELECT ''idx_working_hours_deleted_at already exists'''
);

PREPARE stmt FROM @ddl_idx_working_hours_deleted_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
