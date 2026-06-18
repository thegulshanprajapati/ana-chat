ALTER TABLE messages
  ADD COLUMN client_message_id VARCHAR(64) NULL AFTER sender_id,
  ADD UNIQUE KEY uq_messages_client_id (sender_id, chat_id, client_message_id);
