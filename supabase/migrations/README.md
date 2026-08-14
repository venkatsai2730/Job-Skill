# Migrations

Apply in filename order — every file is prefixed with a 14-digit
`YYYYMMDDHHMMSS` version, so lexical order *is* apply order.

| Version | File | What it does |
|---|---|---|
| `20260224174225` | `..._764ba159-….sql` | Initial Lovable-generated schema |
| `20260303000000` | `create_resumes_table` | `resumes` table |
| `20260311000000` | `create_jobs_table` | `job_listings`, `tracked_jobs` |
| `20260312000000` | `add_ai_features` | AI-feature columns |
| `20260313000000` | `profiles_chat_notifications` | `user_profiles`, `chat_conversations`, `chat_messages`, `user_notifications`; job_listings indexes |
| `20260503000000` | `user_activity` | `user_activity` table |
| `20260504000000` | `add_job_domain` | `job_listings.job_domain` + index |
| `20260505000000` | `resume_storage_policies` | `resumes` storage bucket (private) + owner-scoped RLS |

## Fresh environment

```sh
supabase db push          # applies everything in order
```

## Notes for existing projects

Four files were renamed to fix ordering, and two were moved here from
`supabase/` where the CLI never saw them:

| Was | Now |
|---|---|
| `supabase/migration.sql` | `20260313000000_profiles_chat_notifications.sql` |
| `supabase/storage_fix.sql` | `20260505000000_resume_storage_policies.sql` (**rewritten** — see below) |
| `migrations/20260503_user_activity.sql` | `20260503000000_user_activity.sql` |
| `migrations/add_job_domain.sql` | `20260504000000_add_job_domain.sql` |

A renamed file reads as un-applied against a database whose
`supabase_migrations.schema_migrations` still records the old version, so
`db push` will run it again. **Every statement in these files is
idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` before each
`CREATE POLICY`, `ON CONFLICT DO UPDATE`), so re-running them is safe.
Prefer that over hand-editing the history table.

`20260505000000_resume_storage_policies.sql` is **not** a rename — it
replaces the old `storage_fix.sql`, which made the `resumes` bucket
public and granted anon read/write/delete on every object in it. Résumé
PDFs are personal data, so apply this file to any environment that ever
ran `storage_fix.sql`, and treat the window it was live as an exposure to
assess.
