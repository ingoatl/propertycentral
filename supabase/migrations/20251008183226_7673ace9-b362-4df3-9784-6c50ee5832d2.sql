-- Add unique constraint to user_id in gmail_oauth_tokens table
ALTER TABLE gmail_oauth_tokens ADD CONSTRAINT gmail_oauth_tokens_user_id_key UNIQUE (user_id);