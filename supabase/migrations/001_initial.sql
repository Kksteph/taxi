-- ============================================================
-- Tax Filing Automation Portal — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- DEPARTMENTS
-- ============================================================
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
create table if not exists employees (
  id             uuid primary key default gen_random_uuid(),
  employee_id    text unique not null,
  name           text not null,
  email          text unique not null,
  department_id  uuid references departments(id) on delete set null,
  created_at     timestamptz default now()
);

create index if not exists idx_employees_department_id on employees(department_id);
create index if not exists idx_employees_email on employees(email);

-- ============================================================
-- MONTHLY RECORDS
-- ============================================================
create table if not exists monthly_records (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  month        int not null check (month between 1 and 12),
  year         int not null,
  basic        numeric(12,2) not null default 0,
  allowance    numeric(12,2) not null default 0,
  ssnit        numeric(12,2) not null default 0,
  tax          numeric(12,2) not null default 0,
  created_at   timestamptz default now(),

  unique(employee_id, month, year)
);

create index if not exists idx_monthly_records_employee_year on monthly_records(employee_id, year);

-- ============================================================
-- TAX SUMMARIES
-- ============================================================
create table if not exists tax_summaries (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references employees(id) on delete cascade,
  year              int not null,
  total_basic       numeric(12,2) not null default 0,
  total_allowance   numeric(12,2) not null default 0,
  total_ssnit       numeric(12,2) not null default 0,
  chargeable_income numeric(12,2) not null default 0,
  total_tax         numeric(12,2) not null default 0,
  pdf_url           text,
  pdf_path          text,
  magic_token       text unique,
  token_expires_at  timestamptz,
  status            text not null default 'generated'
                    check (status in ('generated','email_sent','viewed','submitted')),
  email_sent_at     timestamptz,
  viewed_at         timestamptz,
  generated_at      timestamptz default now(),

  unique(employee_id, year)
);

create index if not exists idx_tax_summaries_token on tax_summaries(magic_token);
create index if not exists idx_tax_summaries_employee_year on tax_summaries(employee_id, year);

-- ============================================================
-- RECEIPTS
-- ============================================================
create table if not exists receipts (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  year         int not null,
  file_url     text not null,
  file_path    text not null,
  file_name    text,
  submitted_at timestamptz default now(),
  replaced_at  timestamptz
);

create index if not exists idx_receipts_employee_year on receipts(employee_id, year);

-- ============================================================
-- USERS (Finance staff accounts)
-- ============================================================
-- Note: Supabase auth.users handles actual auth.
-- This table extends auth.users for finance role tracking.
create table if not exists finance_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  role       text not null default 'finance'
             check (role in ('finance', 'admin')),
  created_at timestamptz default now()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
create table if not exists activity_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users(id) on delete set null,
  action    text not null,
  metadata  jsonb,
  timestamp timestamptz default now()
);

create index if not exists idx_activity_logs_user_id on activity_logs(user_id);
create index if not exists idx_activity_logs_action on activity_logs(action);
create index if not exists idx_activity_logs_timestamp on activity_logs(timestamp desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Finance users can read/write all data
alter table departments     enable row level security;
alter table employees       enable row level security;
alter table monthly_records enable row level security;
alter table tax_summaries   enable row level security;
alter table receipts        enable row level security;
alter table activity_logs   enable row level security;
alter table finance_users   enable row level security;

-- Finance users: full access (authenticated)
create policy "Finance: read all departments"
  on departments for select to authenticated using (true);
create policy "Finance: write departments"
  on departments for all to authenticated using (true);

create policy "Finance: read all employees"
  on employees for select to authenticated using (true);
create policy "Finance: write employees"
  on employees for all to authenticated using (true);

create policy "Finance: read all monthly_records"
  on monthly_records for select to authenticated using (true);
create policy "Finance: write monthly_records"
  on monthly_records for all to authenticated using (true);

create policy "Finance: read all tax_summaries"
  on tax_summaries for select to authenticated using (true);
create policy "Finance: write tax_summaries"
  on tax_summaries for all to authenticated using (true);

create policy "Finance: read all receipts"
  on receipts for select to authenticated using (true);
create policy "Finance: write receipts"
  on receipts for all to authenticated using (true);

create policy "Finance: read own logs"
  on activity_logs for select to authenticated using (true);
create policy "Finance: write logs"
  on activity_logs for insert to authenticated with check (true);

create policy "Finance: read finance_users"
  on finance_users for select to authenticated using (true);

-- Anon: read tax_summaries by magic token (for employee pages — handled in API)
-- We keep employee pages server-side only (no direct DB access from client)
-- So no anon RLS needed for tax_summaries

-- ============================================================
-- STORAGE BUCKETS (run after enabling Supabase Storage)
-- ============================================================
-- In Supabase dashboard, create two buckets:
--   1. "tax-pdfs"    — private, signed URLs only
--   2. "receipts"    — private, signed URLs only
--
-- Or via CLI:
-- supabase storage create tax-pdfs --private
-- supabase storage create receipts --private
