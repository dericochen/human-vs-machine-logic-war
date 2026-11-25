-- ============================================================================
-- HUMAN VS MACHINE: LOGIC WAR — schema, indexes, RLS, triggers
-- Supabase (PostgreSQL). Run 0001 first, then 0002 (seed bank).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types / constraints are enforced via CHECK constraints below.
-- ---------------------------------------------------------------------------

-- Players (guest players; no login required to play).
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text not null default '',
  total_score integer not null default 0,
  matches_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  best_score integer not null default 0,
  best_streak integer not null default 0,
  best_time_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Active match state. `session_id` is the anti-replay token handed to the
-- browser; all answer validation is done server-side against this row.
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  player_id uuid not null references public.players(id) on delete cascade,
  player_name text not null,
  avatar text not null default '',
  max_mode text not null default 'normal'
    check (max_mode in ('easy', 'normal', 'hard', 'expert')),
  status text not null default 'starting'
    check (status in ('starting', 'active', 'finished', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  current_index integer not null default 0,
  player_score integer not null default 0,
  max_score integer not null default 0,
  max_confidence integer not null default 50,
  player_answers jsonb not null default '[]'::jsonb,
  max_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Question / round bank. `odd_index` is the answer and must never be served to
-- the browser before the player answers (RLS blocks anon reads entirely).
create table if not exists public.question_bank (
  id text primary key,
  category text not null default 'odd_emoji',
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard', 'expert')),
  kind text not null default 'grid',
  prompt text not null,
  grid_size integer not null,
  cells jsonb not null,
  base_emoji text not null,
  odd_emoji text not null,
  odd_index integer not null,
  explanation text not null,
  time_limit_sec integer not null,
  base_points integer not null,
  params jsonb not null default '{}'::jsonb,
  source text not null default 'seeded',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ordered round references for a match (the public questions come from here).
create table if not exists public.match_questions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  question_id text not null references public.question_bank(id),
  index integer not null,
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard', 'expert')),
  grid_size integer not null,
  time_limit_sec integer not null,
  unique (match_id, index)
);

-- Generator templates (admin-editable seeds for future question types).
create table if not exists public.puzzle_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'odd_emoji',
  difficulty text check (difficulty in ('easy', 'normal', 'hard', 'expert')),
  definition jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- M.A.X. personality / dialogue audit log.
create table if not exists public.machine_personality_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  trigger text not null,
  line text not null,
  emotion text not null,
  confidence integer not null,
  player_score integer,
  max_score integer,
  created_at timestamptz not null default now()
);

-- Daily rollup maintained by trigger on match_results insert.
create table if not exists public.daily_statistics (
  day date primary key,
  total_matches integer not null default 0,
  human_wins integer not null default 0,
  machine_wins integer not null default 0,
  draws integer not null default 0,
  total_correct integer not null default 0,
  total_answers integer not null default 0,
  avg_accuracy numeric(5, 2) not null default 0,
  best_score integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Final match result (one per match). Inserted only at match end.
create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  player_name text not null,
  avatar text not null default '',
  winner text not null check (winner in ('human', 'machine', 'draw')),
  player_score integer not null,
  max_score integer not null,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  blank_count integer not null default 0,
  accuracy numeric(5, 2) not null default 0,
  avg_answer_ms integer not null default 0,
  best_streak integer not null default 0,
  hardest_solved text,
  max_mode text not null,
  duration_ms integer not null default 0,
  breakdown jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Admin users (paired with Supabase Auth email).
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_question_bank_difficulty_active on public.question_bank (difficulty, active);
create index if not exists idx_matches_session on public.matches (session_id);
create index if not exists idx_matches_player on public.matches (player_id, created_at desc);
create index if not exists idx_matches_status on public.matches (status, created_at);
create index if not exists idx_match_questions_match on public.match_questions (match_id, index);
create index if not exists idx_match_results_created on public.match_results (created_at desc);
create index if not exists idx_match_results_player on public.match_results (player_id);
create index if not exists idx_players_score on public.players (total_score desc);
create index if not exists idx_admin_users_email on public.admin_users (email);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Admin check from the current Supabase Auth JWT email.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Keep updated_at fresh on question_bank edits.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_question_bank_touch on public.question_bank;
create trigger trg_question_bank_touch before update on public.question_bank
  for each row execute function public.touch_updated_at();

-- Roll up player aggregates after each finished match.
create or replace function public.update_player_after_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.players set
    matches_played = matches_played + 1,
    total_score = total_score + new.player_score,
    wins = wins + case when new.winner = 'human' then 1 else 0 end,
    losses = losses + case when new.winner = 'machine' then 1 else 0 end,
    draws = draws + case when new.winner = 'draw' then 1 else 0 end,
    best_score = greatest(best_score, new.player_score),
    best_streak = greatest(best_streak, new.best_streak),
    best_time_ms = case
      when best_time_ms is null then new.duration_ms
      else least(best_time_ms, new.duration_ms)
    end,
    updated_at = now()
  where id = new.player_id;
  return new;
end $$;
drop trigger if exists trg_player_after_match on public.match_results;
create trigger trg_player_after_match after insert on public.match_results
  for each row execute function public.update_player_after_match();

-- Maintain the daily statistics rollup.
create or replace function public.update_daily_stats() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d date := new.created_at::date;
  n integer;
begin
  insert into public.daily_statistics
    (day, total_matches, human_wins, machine_wins, draws, total_correct,
     total_answers, avg_accuracy, best_score, best_streak, updated_at)
  values
    (d, 1,
     case when new.winner = 'human' then 1 else 0 end,
     case when new.winner = 'machine' then 1 else 0 end,
     case when new.winner = 'draw' then 1 else 0 end,
     new.correct_count,
     new.correct_count + new.wrong_count + new.blank_count,
     new.accuracy, new.player_score, new.best_streak, now())
  on conflict (day) do update set
    total_matches = public.daily_statistics.total_matches + 1,
    human_wins = public.daily_statistics.human_wins + case when new.winner = 'human' then 1 else 0 end,
    machine_wins = public.daily_statistics.machine_wins + case when new.winner = 'machine' then 1 else 0 end,
    draws = public.daily_statistics.draws + case when new.winner = 'draw' then 1 else 0 end,
    total_correct = public.daily_statistics.total_correct + new.correct_count,
    total_answers = public.daily_statistics.total_answers
                    + new.correct_count + new.wrong_count + new.blank_count,
    avg_accuracy = round(
      ((public.daily_statistics.avg_accuracy * public.daily_statistics.total_matches) + new.accuracy)
      / (public.daily_statistics.total_matches + 1), 2),
    best_score = greatest(public.daily_statistics.best_score, new.player_score),
    best_streak = greatest(public.daily_statistics.best_streak, new.best_streak),
    updated_at = now();
  return new;
end $$;
drop trigger if exists trg_daily_stats on public.match_results;
create trigger trg_daily_stats after insert on public.match_results
  for each row execute function public.update_daily_stats();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_questions enable row level security;
alter table public.question_bank enable row level security;
alter table public.puzzle_templates enable row level security;
alter table public.machine_personality_logs enable row level security;
alter table public.daily_statistics enable row level security;
alter table public.match_results enable row level security;
alter table public.admin_users enable row level security;

-- Public (anon) read-only surfaces used by the landing / leaderboard pages.
-- No answers are exposed here: match_results is written only after a match ends.
drop policy if exists "anon_read_players" on public.players;
create policy "anon_read_players" on public.players for select to anon using (true);

drop policy if exists "anon_read_match_results" on public.match_results;
create policy "anon_read_match_results" on public.match_results for select to anon using (true);

drop policy if exists "anon_read_daily_stats" on public.daily_statistics;
create policy "anon_read_daily_stats" on public.daily_statistics for select to anon using (true);

-- question_bank and live match state are service-role / admin only (no anon).
drop policy if exists "admin_all_question_bank" on public.question_bank;
create policy "admin_all_question_bank" on public.question_bank
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_puzzle_templates" on public.puzzle_templates;
create policy "admin_all_puzzle_templates" on public.puzzle_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_personality_logs" on public.machine_personality_logs;
create policy "admin_all_personality_logs" on public.machine_personality_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "admin_all_matches" on public.matches;
create policy "admin_all_matches" on public.matches
  for select to authenticated using (public.is_admin());

drop policy if exists "admin_all_match_results" on public.match_results;
create policy "admin_all_match_results" on public.match_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_admin_users" on public.admin_users;
create policy "admin_all_admin_users" on public.admin_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime: broadcast new results + refreshed daily stats so the leaderboard
-- and global stats update without a page refresh.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.match_results;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.daily_statistics;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- Admin bootstrap.
-- After an admin signs up with Supabase Auth (email/password), add their email
-- here (or run once in the SQL editor):
--   insert into public.admin_users (email) values ('admin@example.com');
-- ---------------------------------------------------------------------------
