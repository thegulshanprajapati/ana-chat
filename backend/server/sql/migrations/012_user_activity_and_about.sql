ALTER TABLE users
  ADD COLUMN about_bio TEXT NULL AFTER mobile;

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  target_user_id INT NULL,
  activity_type VARCHAR(64) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_activity_actor_created (actor_user_id, created_at),
  INDEX idx_user_activity_target_created (target_user_id, created_at),
  INDEX idx_user_activity_type_created (activity_type, created_at),
  CONSTRAINT fk_user_activity_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_activity_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);
