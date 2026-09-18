# ClearCost

Read `HANDOFF.md` before anything else.

Never break these:

- **This repository is public.** Never commit secrets, credentials, customer
  names or anything from `.env.local`.
- The service-role Supabase client bypasses row-level security for every
  tenant. It belongs only behind `CRON_SECRET`. Data access follows
  `api/data.js`: the anon key plus the caller's JWT, with RLS doing the scoping.
- A push to `main` deploys production.

At the end of a session, update `HANDOFF.md` so the next one does not start
from stale notes.
