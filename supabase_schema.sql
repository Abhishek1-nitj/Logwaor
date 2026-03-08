create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  log_date date not null,
  minutes integer not null check (minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tasks_name_unique_lower
  on public.tasks ((lower(trim(name))))
  where is_archived = false;

create index if not exists tasks_name_idx on public.tasks using btree (name);
create index if not exists time_logs_date_idx on public.time_logs using btree (log_date);
create index if not exists time_logs_task_idx on public.time_logs using btree (task_id);
create index if not exists time_logs_task_date_idx on public.time_logs using btree (task_id, log_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists time_logs_set_updated_at on public.time_logs;
create trigger time_logs_set_updated_at
before update on public.time_logs
for each row execute function public.set_updated_at();

-- Enable RLS and add policies if needed for your setup.
