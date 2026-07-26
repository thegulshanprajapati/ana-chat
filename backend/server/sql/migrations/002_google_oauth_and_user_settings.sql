ALTER TABLE users
  ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local' AFTER password_hash,
  ADD COLUMN google_sub VARCHAR(191) NULL AFTER auth_provider,
  ADD COLUMN generated_password_plain VARCHAR(120) NULL AFTER google_sub,
  ADD COLUMN settings_json TEXT NULL AFTER generated_password_plain;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_google_sub (google_sub);
