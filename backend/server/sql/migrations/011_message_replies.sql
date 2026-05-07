ALTER TABLE messages
  ADD COLUMN reply_to_message_id INT NULL AFTER client_message_id,
  ADD INDEX idx_messages_reply_to (reply_to_message_id),
  ADD CONSTRAINT fk_messages_reply_to
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;
