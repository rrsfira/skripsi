-- Deduplicate attendance rows by keeping the latest row (highest id) per employee per date.
DELETE a1
FROM attendance a1
JOIN attendance a2
  ON a1.employee_id = a2.employee_id
 AND a1.date = a2.date
 AND a1.id < a2.id;

-- Add a unique index to prevent future duplicates for the same employee and date.
SET @schema_name = DATABASE();
SET @index_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'attendance'
      AND index_name = 'uniq_attendance_employee_date'
);

SET @ddl = IF(
    @index_exists = 0,
    'ALTER TABLE attendance ADD UNIQUE KEY uniq_attendance_employee_date (employee_id, date)',
    'SELECT ''Index uniq_attendance_employee_date already exists'''
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
