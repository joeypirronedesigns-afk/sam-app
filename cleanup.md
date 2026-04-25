# Data Cleanup — Deferred

## Stale anon rows in sam_users (non-blocking)

Three rows in sam_users have `uid = anon-xxx` but `email = j.pirrone@yahoo.com` and `tier = free`.
These were created by trackUser() in api/sam.js during anonymous sessions where the email was
later captured but the uid was not yet the canonical email.

The canonical paid row is: uid = j.pirrone@yahoo.com, tier = creator.
The three stale rows are harmless — /api/me filters by uid = email so they are never returned.

When convenient (not urgent), delete them:

```sql
DELETE FROM sam_users
WHERE email = 'j.pirrone@yahoo.com'
AND uid != 'j.pirrone@yahoo.com';
```

Audit before deleting to confirm none have voice_profile or sam_context worth keeping:

```sql
SELECT uid, name, voice_profile, sam_context FROM sam_users
WHERE email = 'j.pirrone@yahoo.com' AND uid != 'j.pirrone@yahoo.com';
```
