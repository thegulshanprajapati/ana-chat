ALTER TABLE admins
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin' AFTER email;

UPDATE admins
SET role = 'super_admin'
WHERE username = 'admin' OR email = 'admin@test.com';

SET @has_super_admin := (SELECT COUNT(*) FROM admins WHERE role='super_admin');

UPDATE admins
SET role = 'super_admin'
WHERE @has_super_admin = 0
ORDER BY id ASC
LIMIT 1;
