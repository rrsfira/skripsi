-- Backfill 'pegawai' role for users with admin/atasan/hr/finance who lack 'pegawai'
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, rPegawai.id
FROM user_roles ur
JOIN roles rHierarchy ON rHierarchy.id = ur.role_id AND rHierarchy.name IN ('admin','atasan','hr','finance')
JOIN roles rPegawai ON rPegawai.name = 'pegawai'
LEFT JOIN user_roles urPegawai ON urPegawai.user_id = ur.user_id AND urPegawai.role_id = rPegawai.id
WHERE urPegawai.user_id IS NULL;