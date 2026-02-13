-- Skill Bartering Platform (PostgreSQL)
-- Run via: npm run db:init

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional registration allowlist: when enabled, only emails present here may create new accounts.
CREATE TABLE IF NOT EXISTS registration_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);

-- Exchange request between two users (requester -> owner)
CREATE TABLE IF NOT EXISTS exchanges (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_offered_id BIGINT REFERENCES skills(id) ON DELETE SET NULL,
  skill_requested_id BIGINT REFERENCES skills(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled','completed')),
  message TEXT NOT NULL DEFAULT '',
  completed_by_requester_at TIMESTAMPTZ,
  completed_by_owner_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure existing databases are upgraded
ALTER TABLE exchanges ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE exchanges ADD COLUMN IF NOT EXISTS completed_by_requester_at TIMESTAMPTZ;
ALTER TABLE exchanges ADD COLUMN IF NOT EXISTS completed_by_owner_at TIMESTAMPTZ;
ALTER TABLE exchanges DROP CONSTRAINT IF EXISTS exchanges_status_check;
ALTER TABLE exchanges
  ADD CONSTRAINT exchanges_status_check
  CHECK (status IN ('pending','accepted','rejected','cancelled','completed'));

CREATE INDEX IF NOT EXISTS idx_exchanges_requester_id ON exchanges(requester_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_owner_id ON exchanges(owner_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);
CREATE INDEX IF NOT EXISTS idx_exchanges_skill_requested_id ON exchanges(skill_requested_id);

-- Negotiation tables: request can include multiple offered skills (from requester)
-- and multiple interested skills (from receiver). Final pairing is stored on exchanges
-- when accepted (skill_offered_id + skill_requested_id).
CREATE TABLE IF NOT EXISTS exchange_offered_skills (
  exchange_id BIGINT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (exchange_id, skill_id)
);

CREATE TABLE IF NOT EXISTS exchange_interested_skills (
  exchange_id BIGINT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (exchange_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_offered_skills_exchange_id ON exchange_offered_skills(exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_offered_skills_skill_id ON exchange_offered_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_exchange_interested_skills_exchange_id ON exchange_interested_skills(exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_interested_skills_skill_id ON exchange_interested_skills(skill_id);

-- Chat/messages (allowed after accepted only).
CREATE TABLE IF NOT EXISTS exchange_messages (
  id BIGSERIAL PRIMARY KEY,
  exchange_id BIGINT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  from_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure existing databases are upgraded
ALTER TABLE exchange_messages ADD COLUMN IF NOT EXISTS to_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE exchange_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE exchange_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_exchange_messages_exchange_id ON exchange_messages(exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_messages_to_user_id ON exchange_messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_messages_read_at ON exchange_messages(read_at);
CREATE INDEX IF NOT EXISTS idx_exchange_messages_created_at ON exchange_messages(created_at);

-- Attachments (simple local uploads)
CREATE TABLE IF NOT EXISTS exchange_message_attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES exchange_messages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_message_attachments_message_id ON exchange_message_attachments(message_id);

-- Reactions (disabled once exchange is completed / read-only)
CREATE TABLE IF NOT EXISTS exchange_message_reactions (
  message_id BIGINT NOT NULL REFERENCES exchange_messages(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_exchange_message_reactions_message_id ON exchange_message_reactions(message_id);

-- Feedback/ratings after an exchange is completed.
CREATE TABLE IF NOT EXISTS exchange_feedback (
  id BIGSERIAL PRIMARY KEY,
  exchange_id BIGINT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  from_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exchange_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_feedback_exchange_id ON exchange_feedback(exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_feedback_to_user_id ON exchange_feedback(to_user_id);

COMMIT;
