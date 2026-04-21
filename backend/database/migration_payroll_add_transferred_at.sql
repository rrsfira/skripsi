-- Tambah penanda waktu transfer payroll ke rekening (aman dijalankan berulang)
SET @column_exists := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'payrolls'
	  AND COLUMN_NAME = 'transferred_at'
);

SET @sql := IF(
	@column_exists = 0,
	'ALTER TABLE `payrolls` ADD COLUMN `transferred_at` DATETIME NULL AFTER `claimed_at`',
	'SELECT ''Column transferred_at already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
