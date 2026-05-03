-- ============================================================
-- v9.117.8 — sam_ideas unique constraint on (user_id, idea_id)
-- ============================================================
--
-- Why: api/memory.js add_idea wants to be idempotent on retries (and on
-- the v9.117.7 dual-write path where the same idea_id might be re-POSTed
-- across devices). PostgREST's `?on_conflict=user_id,idea_id&Prefer:
-- resolution=merge-duplicates` requires a unique constraint or unique
-- index on those columns. Without it, the upsert silently does the
-- wrong thing — usually a plain INSERT that creates a duplicate.
--
-- This migration is idempotent: re-running it is a no-op once applied.
--
-- ROLLBACK:
--   ALTER TABLE sam_ideas DROP CONSTRAINT IF EXISTS sam_ideas_user_idea_unique;
-- ============================================================

-- Pre-flight: check for existing duplicate (user_id, idea_id) pairs.
-- If any exist, the constraint creation will fail. We surface them so an
-- operator can decide how to deduplicate before the constraint goes on.
SELECT user_id, idea_id, count(*) AS dup_count
FROM sam_ideas
GROUP BY user_id, idea_id
HAVING count(*) > 1
ORDER BY dup_count DESC
LIMIT 50;
-- Expected: 0 rows. If non-empty, run the dedupe block below before
-- the ALTER TABLE.

-- Dedupe (only run if the SELECT above returned rows). Keeps the
-- earliest created_at row per (user_id, idea_id), drops the rest.
-- Commented out by default — uncomment + run only if needed.
--
-- WITH ranked AS (
--   SELECT ctid,
--          row_number() OVER (PARTITION BY user_id, idea_id ORDER BY created_at ASC) AS rn
--   FROM sam_ideas
-- )
-- DELETE FROM sam_ideas
-- WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

-- The actual constraint. Idempotent via the DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sam_ideas_user_idea_unique'
  ) THEN
    ALTER TABLE sam_ideas
      ADD CONSTRAINT sam_ideas_user_idea_unique
      UNIQUE (user_id, idea_id);
  END IF;
END $$;

-- Verify the constraint landed.
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname = 'sam_ideas_user_idea_unique';
-- Expected: 1 row with contype='u' and def='UNIQUE (user_id, idea_id)'.
