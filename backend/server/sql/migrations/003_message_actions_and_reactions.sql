ALTER TABLE messages
  ADD COLUMN updated_at DATETIME NULL AFTER created_at,
  ADD COLUMN deleted_for_everyone TINYINT(1) NOT NULL DEFAULT 0 AFTER updated_at,
  ADD COLUMN deleted_by_user_id INT NULL AFTER deleted_for_everyone,
  ADD COLUMN deleted_at DATETIME NULL AFTER deleted_by_user_id,
  ADD INDEX idx_messages_deleted (deleted_for_everyone),
  ADD CONSTRAINT fk_messages_deleted_by_user FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS message_user_state (
  user_id INT NOT NULL,
  message_id INT NOT NULL,
  is_starred TINYINT(1) NOT NULL DEFAULT 0,
  hidden_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, message_id),
  INDEX idx_message_user_state_message (message_id),
  INDEX idx_message_user_state_hidden (user_id, hidden_at),
  CONSTRAINT fk_message_user_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_user_state_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  reaction VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_message_reaction (message_id, user_id),
  INDEX idx_message_reaction_message (message_id),
  CONSTRAINT fk_message_reactions_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
