-- ============================================================
-- PERSONA LAB v0 — Phase 1 plumbing migration
-- Branch: quietstudio
-- Author: Persona Lab v0 handoff (PERSONA_LAB_v0_HANDOFF.md §3)
-- Run BEFORE the seed insert (migrations/seed_codex_insert.sql).
-- ============================================================

-- 1. Allowlist flag on existing sam_users table
ALTER TABLE sam_users
  ADD COLUMN IF NOT EXISTS lab_access BOOLEAN DEFAULT FALSE;

-- 2. Codex storage (one row per user)
CREATE TABLE IF NOT EXISTS sam_persona_lab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT UNIQUE NOT NULL,
  persona_codex JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_profile_override JSONB,
  codex_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sam_persona_lab_email
  ON sam_persona_lab(user_email);

-- 3. Output / draft history (many rows per user)
CREATE TABLE IF NOT EXISTS sam_persona_lab_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  moment TEXT NOT NULL,
  channel TEXT NOT NULL,
  fidelity INTEGER NOT NULL,
  loop_type TEXT NOT NULL,
  intent TEXT,
  title TEXT,
  draft TEXT NOT NULL,
  used_fragments JSONB NOT NULL DEFAULT '[]'::jsonb,
  used_persona_traits JSONB NOT NULL DEFAULT '[]'::jsonb,
  selection_mode TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sam_persona_lab_outputs_email
  ON sam_persona_lab_outputs(user_email);
CREATE INDEX IF NOT EXISTS idx_sam_persona_lab_outputs_created
  ON sam_persona_lab_outputs(created_at DESC);

-- 4. Flip the lab_access flag for Joey
UPDATE sam_users
SET lab_access = TRUE
WHERE email = 'j.pirrone@yahoo.com';

-- ============================================================
-- VALIDATION
-- ============================================================

-- Confirm the new column landed and Joey is flagged.
SELECT email, lab_access
FROM sam_users
WHERE email = 'j.pirrone@yahoo.com';
-- Expected: lab_access = true

-- Confirm the lab tables exist and are empty.
SELECT 'sam_persona_lab' AS tbl, COUNT(*) AS rows FROM sam_persona_lab
UNION ALL
SELECT 'sam_persona_lab_outputs' AS tbl, COUNT(*) AS rows FROM sam_persona_lab_outputs;
-- Expected: 0 rows in both
