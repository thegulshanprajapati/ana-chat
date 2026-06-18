CREATE TABLE IF NOT EXISTS user_chat_pin_settings (
  user_id INT NOT NULL PRIMARY KEY,
  pin_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_chat_pin_settings_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_hidden_chats (
  user_id INT NOT NULL,
  chat_id INT NOT NULL,
  hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chat_id),
  INDEX idx_user_hidden_chats_user_hidden (user_id, hidden_at),
  CONSTRAINT fk_user_hidden_chats_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_hidden_chats_chat
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
