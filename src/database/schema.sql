-- ================================================================
--  EduFlow Bot — PostgreSQL Schema (Supabase)
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT      PRIMARY KEY,           -- Telegram User ID
  first_name  TEXT        NOT NULL,
  last_name   TEXT,
  username    TEXT,
  role        TEXT        NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  mentor_id   BIGINT,
  group_id    UUID,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. GROUPS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  teacher_id  BIGINT      NOT NULL,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. HOMEWORKS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homeworks (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id            BIGINT      NOT NULL REFERENCES users(id),
  student_id            BIGINT      NOT NULL REFERENCES users(id),
  group_id              UUID,

  -- Assignment content
  file_id               TEXT        NOT NULL,
  file_type             TEXT        NOT NULL CHECK (file_type IN ('document','photo','audio','video','voice')),
  caption               TEXT,
  deadline              TIMESTAMPTZ NOT NULL,

  -- Status
  status                TEXT        NOT NULL DEFAULT 'pending',

  -- Submission
  submission_file_id    TEXT,
  submission_file_type  TEXT,
  submission_caption    TEXT,
  submitted_at          TIMESTAMPTZ,
  teacher_comment      TEXT,

  -- Reminder flags (prevent duplicate sends)
  reminder_6h_sent      BOOLEAN     DEFAULT FALSE,
  reminder_1h_sent      BOOLEAN     DEFAULT FALSE,
  overdue_sent          BOOLEAN     DEFAULT FALSE,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. LOGS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  homework_id UUID        REFERENCES homeworks(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,  -- 'assigned','submitted','reminded_6h','reminded_1h','overdue'
  actor_id    BIGINT      REFERENCES users(id),
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_groups_teacher    ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_name       ON groups(name);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_mentor     ON users(mentor_id);
CREATE INDEX IF NOT EXISTS idx_users_group      ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_hw_student       ON homeworks(student_id);
CREATE INDEX IF NOT EXISTS idx_hw_teacher       ON homeworks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_hw_group        ON homeworks(group_id);
CREATE INDEX IF NOT EXISTS idx_hw_status        ON homeworks(status);
CREATE INDEX IF NOT EXISTS idx_hw_deadline      ON homeworks(deadline);
CREATE INDEX IF NOT EXISTS idx_logs_hw          ON logs(homework_id);

-- Add check constraint for homeworks status
ALTER TABLE homeworks 
ADD CONSTRAINT homeworks_status_check 
CHECK (status IN ('pending', 'submitted', 'overdue', 'accepted', 'rejected', 'commented'));

CREATE TABLE IF NOT EXISTS coins (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  teacher_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coins_student   ON coins(student_id);
CREATE INDEX IF NOT EXISTS idx_coins_teacher   ON coins(teacher_id);
CREATE INDEX IF NOT EXISTS idx_coins_created   ON coins(created_at);

-- ── AUTO-UPDATE updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER coins_updated_at
  BEFORE UPDATE ON coins FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER homeworks_updated_at
  BEFORE UPDATE ON homeworks FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── SEED: Add your Super Admin ──────────────────────────────────
-- Replace 123456789 with your real Telegram User ID, then uncomment:
INSERT INTO users (id, first_name, role) VALUES (8400579789, 'Super Admin', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ── FOREIGN KEY CONSTRAINTS (added after table creation) ────────
ALTER TABLE users 
  ADD CONSTRAINT fk_users_mentor 
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_group 
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

ALTER TABLE groups 
  ADD CONSTRAINT fk_groups_teacher 
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE homeworks 
  ADD CONSTRAINT fk_homeworks_group 
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
