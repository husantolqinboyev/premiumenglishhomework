-- =============================================
-- PREMIUM ENGLISH NAZORAT BOT
-- Supabase Database Schema
-- =============================================

-- Users jadvali (barcha foydalanuvchilar)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'student', -- admin | teacher | student
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guruhlar jadvali
CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  teacher_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  assistant_teacher_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- O'quvchilar jadvali
CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_id BIGINT REFERENCES groups(id) ON DELETE SET NULL,
  joined_date TIMESTAMPTZ DEFAULT NOW()
);

-- Vazifalar (Homeworks)
CREATE TABLE IF NOT EXISTS homeworks (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT,
  file_ids JSONB DEFAULT '[]',      -- array of {type, file_id}
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vazifa topshirishlar
CREATE TABLE IF NOT EXISTS homework_submissions (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
  homework_id BIGINT REFERENCES homeworks(id) ON DELETE CASCADE,
  file_ids JSONB DEFAULT '[]',      -- array of {type, file_id}
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  checked BOOLEAN DEFAULT FALSE,
  feedback TEXT,
  checked_at TIMESTAMPTZ
);

-- Coinlar jadvali
CREATE TABLE IF NOT EXISTS coins (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEKSLAR (Tezlashtirish uchun)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_students_telegram_id ON students(telegram_id);
CREATE INDEX IF NOT EXISTS idx_students_group_id ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_teacher_id ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_group_id ON homeworks(group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_homework_id ON homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_coins_student_id ON coins(student_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- O'quvchining jami coin miqdori
CREATE OR REPLACE FUNCTION get_student_total_coins(p_student_id BIGINT)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM coins
  WHERE student_id = p_student_id;
$$ LANGUAGE SQL;

-- O'quvchining 1 oylik coin miqdori
CREATE OR REPLACE FUNCTION get_student_monthly_coins(p_student_id BIGINT)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM coins
  WHERE student_id = p_student_id
    AND created_at >= NOW() - INTERVAL '30 days';
$$ LANGUAGE SQL;
