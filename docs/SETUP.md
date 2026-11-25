# Setup guide

## 1. Local development (no Supabase)

The app runs out of the box with an **in-memory store**, so you can develop and demo the full game without any database.

```bash
pnpm install
pnpm run dev
```

Open http://localhost:3000. Matches, leaderboard and stats are kept in memory for the process (reset on restart). Admin sign-in uses `ADMIN_PASSWORD` (default `admin123`, set via env).

## 2. Production (Supabase + Vercel)

### 2.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Copy your **Project URL**, **anon/public key**, and **service_role/secret key** (Project Settings → API). Newer projects show these as `sb_publishable_...` and `sb_secret_...` — both formats work.

### 2.2 Apply the schema + seed

Run these two files in the Supabase SQL editor, in order:

1. `supabase/migrations/0001_init.sql` — tables, indexes, RLS, triggers, realtime, grants.
2. `supabase/migrations/0002_seed_bank.sql` — 100 validated rounds (auto-generated).

> The seed file is regenerated idempotently with `pnpm run seed:bank`. It uses `ON CONFLICT (id) DO NOTHING`.

> **Automated option:** with a Supabase personal access token (starts with `sbp_`) you can apply both files from the terminal:
>
> ```bash
> SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-migrations.mjs
> ```
>
> (Optionally set `SUPABASE_PROJECT_REF`; it defaults to the bundled project.)

### 2.3 Configure environment variables

Copy `.env.example` to `.env.local` (local) or add these to Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `NEXT_PUBLIC_` — it is server-only.
- The service-role key is used only inside API routes (server-side) for match validation and admin operations.

### 2.4 Create an admin account

1. In Supabase → Authentication → Users, create a user with email/password (or enable sign-up and sign up).
2. Add the email to the admin table (SQL editor):

```sql
insert into public.admin_users (email) values ('admin@example.com');
```

3. Sign in at `/admin` with that email/password.

### 2.5 Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (Next.js preset is auto-detected).
3. Add the environment variables above.
4. Deploy.

## 3. Enabling Realtime

The migration adds `match_results` and `daily_statistics` to the `supabase_realtime` publication. On Supabase, also confirm the `supabase_realtime` publication is enabled (it is by default). No further setup is needed — the leaderboard and global stats refetch automatically when a new match result is inserted.

## 4. Troubleshooting

- **Game works but data doesn't persist** → Supabase env vars are missing; the in-memory fallback is active.
- **Admin sign-in fails** → ensure the email exists in both Supabase Auth and `admin_users`.
- **Realtime doesn't update** → check the publication includes `match_results`.
- **Emoji look wrong in the database** → re-run `pnpm run seed:bank` and re-apply `0002_seed_bank.sql` (the seed is generated as proper UTF-8).
