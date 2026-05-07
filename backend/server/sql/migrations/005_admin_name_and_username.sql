ALTER TABLE admins
  ADD COLUMN name VARCHAR(120) NULL AFTER id,
  ADD COLUMN username VARCHAR(50) NULL AFTER name;

UPDATE admins
SET name = COALESCE(NULLIF(name, ''), SUBSTRING_INDEX(email, '@', 1))
WHERE name IS NULL OR name = '';

UPDATE admins
SET username = LOWER(CONCAT('admin', id))
WHERE username IS NULL OR username = '';

UPDATE admins
SET username = LOWER(username);

ALTER TABLE admins
  MODIFY name VARCHAR(120) NOT NULL,
  MODIFY username VARCHAR(50) NOT NULL;

ALTER TABLE admins
  ADD UNIQUE KEY uq_admins_username (username);
