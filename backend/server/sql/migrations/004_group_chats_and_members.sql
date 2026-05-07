ALTER TABLE chats
  ADD COLUMN chat_type VARCHAR(20) NOT NULL DEFAULT 'direct' AFTER id,
  ADD COLUMN group_name VARCHAR(140) NULL AFTER chat_type,
  ADD COLUMN group_avatar_url VARCHAR(255) NULL AFTER group_name,
  ADD COLUMN created_by_user_id INT NULL AFTER group_avatar_url,
  ADD INDEX idx_chats_type (chat_type),
  ADD CONSTRAINT fk_chats_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id, user_id),
  INDEX idx_chat_members_user (user_id),
  CONSTRAINT fk_chat_members_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

UPDATE chats
SET chat_type = 'direct'
WHERE chat_type IS NULL OR chat_type = '';

INSERT INTO chat_members (chat_id, user_id, role, joined_at, created_at)
SELECT c.id, c.user1_id, 'member', NOW(), NOW()
FROM chats c
WHERE c.user1_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  role = VALUES(role);

INSERT INTO chat_members (chat_id, user_id, role, joined_at, created_at)
SELECT c.id, c.user2_id, 'member', NOW(), NOW()
FROM chats c
WHERE c.user2_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  role = VALUES(role);
