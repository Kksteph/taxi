-- ============================================================
-- Salary Ingestion Feature — Migration 002
-- ============================================================

-- Add new columns to monthly_records
alter table monthly_records
  add column if not exists tier2       numeric(12,2) not null default 0,
  add column if not exists net_salary  numeric(12,2) not null default 0;

-- tax_paid_on_account alias (keep original 'tax' column, add new one)
alter table monthly_records
  add column if not exists tax_paid_on_account numeric(12,2) not null default 0;

-- Add new columns to tax_summaries
alter table tax_summaries
  add column if not exists excess_bonus     numeric(12,2) not null default 0,
  add column if not exists tax_paid         numeric(12,2) not null default 0,
  add column if not exists tax_outstanding  numeric(12,2) not null default 0,
  add column if not exists cash_allowances  numeric(12,2) not null default 0,
  add column if not exists total_tier2      numeric(12,2) not null default 0,
  add column if not exists total_net_salary numeric(12,2) not null default 0,
  add column if not exists tax_charged      numeric(12,2) not null default 0;

-- ============================================================
-- BONUS RECORDS
-- ============================================================
create table if not exists bonus_records (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references employees(id) on delete cascade,
  year             int not null,
  gross_bonus      numeric(12,2) not null default 0,
  bonus_15pct      numeric(12,2) not null default 0,
  excess_bonus     numeric(12,2) not null default 0,
  final_bonus_tax  numeric(12,2) not null default 0,
  excess_tax       numeric(12,2) not null default 0,
  net_bonus        numeric(12,2) not null default 0,
  created_at       timestamptz default now(),

  unique(employee_id, year)
);

create index if not exists idx_bonus_records_employee_year on bonus_records(employee_id, year);

-- ============================================================
-- SALARY UPLOADS (tracking table)
-- ============================================================
create table if not exists salary_uploads (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid references departments(id) on delete set null,
  year           int not null,
  filename       text not null,
  status         text not null default 'processing'
                 check (status in ('processing', 'completed', 'failed')),
  total_sheets   int not null default 0,
  processed      int not null default 0,
  errors         jsonb not null default '[]',
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now(),
  completed_at   timestamptz
);

create index if not exists idx_salary_uploads_department on salary_uploads(department_id);
create index if not exists idx_salary_uploads_status on salary_uploads(status);

-- RLS
alter table bonus_records  enable row level security;
alter table salary_uploads enable row level security;

create policy "Finance: all bonus_records"
  on bonus_records for all to authenticated using (true);

create policy "Finance: all salary_uploads"
  on salary_uploads for all to authenticated using (true);
