# Tax Filing Automation Portal
### Cloud MVP Blueprint — Engineering & Product Specification

> **Document Type:** System Design & Implementation Guide  
> **Scope:** MVP — 50–300 Employees  
> **Stack:** Next.js · Node.js/Supabase · PostgreSQL · AWS S3 · Role-Based Auth

---

## Problem Statement

Finance teams today operate a fragile, manual tax submission loop:

1. Search employee data across Excel workbooks
2. Screenshot or copy tax figures manually
3. Send data via Teams/email and wait for receipts
4. Track submission status in a spreadsheet

This process is **error-prone, unscalable, and opaque**. There's no audit trail, no real-time status visibility, and no secure, structured channel for employees to submit tax receipts.

**The solution:** A purpose-built Tax Filing Automation Portal that replaces every manual step with a structured, automated workflow — from payroll ingestion to receipt tracking — with role-specific UX for finance users and employees.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                        │
│  Next.js + Tailwind CSS · Role-based routing            │
│  Finance Portal ──────────────── Employee Magic-Link    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────────┐
│                    APPLICATION LAYER                    │
│  Node.js (Express) or Supabase Functions                │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ Auth Service │  │ PDF Generator │  │  Job Queue  │  │
│  │ (Magic Link) │  │  (Per Worker) │  │ (Bulk Send) │  │
│  └──────────────┘  └───────────────┘  └─────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                     DATA LAYER                          │
│  PostgreSQL (Relational Core)                           │
│  AWS S3 / Supabase Storage (PDFs, Receipts)             │
│  Signed URLs · Token Expiration · Per-User Scoping      │
└─────────────────────────────────────────────────────────┘
```

### Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Frontend | Next.js + Tailwind | App Router, SSR, rapid UI iteration |
| Backend | Node.js (Express) or Supabase | Supabase preferred for MVP speed; migrate to Express at scale |
| Database | PostgreSQL | Relational integrity, foreign keys, audit support |
| Storage | AWS S3 or Supabase Storage | Signed URLs, cost-effective, scales without code changes |
| Auth | Magic Link (employees) + Password (finance) | Zero-friction for employees; secure for privileged users |
| PDF | Headless generation service | Consistent rendering, async-safe |
| Bulk Jobs | Background queue | Non-blocking email dispatch for 300+ employees |

---

## Core Engines

The system is decomposed into three independently testable, independently deployable engines:

```
┌─────────────────────────────────┐
│   1. Employee Data Engine       │
│   CSV/Excel ingestion           │
│   Dedup + validation            │
│   Department grouping           │
└──────────────┬──────────────────┘
               │ Employee records + payroll rows
┌──────────────▼──────────────────┐
│   2. Tax Computation Engine     │
│   12-month aggregation          │
│   Chargeable income calc        │
│   PDF generation                │
│   Secure link generation        │
└──────────────┬──────────────────┘
               │ Summaries + tokens
┌──────────────▼──────────────────┐
│   3. Submission Tracking Engine │
│   Email dispatch (queued)       │
│   Receipt upload + storage      │
│   Status pipeline management    │
│   Finance dashboard sync        │
└─────────────────────────────────┘
```

---

## Database Schema

### Entity Relationship Overview

```
departments
  └──< employees
          └──< monthly_records    (12 rows per employee per year)
          └──  tax_summaries      (1 row per employee per year)
          └──< receipts           (1 per submission, replaceable)

users ──── activity_logs          (full audit trail)
```

### Table Definitions

**`departments`**
```sql
id          UUID PRIMARY KEY
name        TEXT NOT NULL
created_at  TIMESTAMPTZ DEFAULT now()
```

**`employees`**
```sql
id              UUID PRIMARY KEY
employee_id     TEXT UNIQUE NOT NULL     -- matches payroll system ID
name            TEXT NOT NULL
email           TEXT UNIQUE NOT NULL
department_id   UUID REFERENCES departments(id)
created_at      TIMESTAMPTZ DEFAULT now()
```

**`monthly_records`**
```sql
id           UUID PRIMARY KEY
employee_id  UUID REFERENCES employees(id)
month        INT NOT NULL                -- 1–12
year         INT NOT NULL
basic        NUMERIC(12,2)
allowance    NUMERIC(12,2)
ssnit        NUMERIC(12,2)
tax          NUMERIC(12,2)

UNIQUE(employee_id, month, year)        -- enforces no duplicates
```

**`tax_summaries`**
```sql
id                UUID PRIMARY KEY
employee_id       UUID REFERENCES employees(id)
year              INT NOT NULL
total_basic       NUMERIC(12,2)
total_allowance   NUMERIC(12,2)
total_ssnit       NUMERIC(12,2)
chargeable_income NUMERIC(12,2)
total_tax         NUMERIC(12,2)
pdf_url           TEXT                  -- S3 signed URL
magic_token       TEXT UNIQUE           -- time-limited access token
token_expires_at  TIMESTAMPTZ
generated_at      TIMESTAMPTZ DEFAULT now()

UNIQUE(employee_id, year)
```

**`receipts`**
```sql
id           UUID PRIMARY KEY
employee_id  UUID REFERENCES employees(id)
year         INT NOT NULL
file_url     TEXT NOT NULL
submitted_at TIMESTAMPTZ DEFAULT now()
replaced_at  TIMESTAMPTZ               -- set if employee re-uploads
```

**`activity_logs`**
```sql
id         UUID PRIMARY KEY
user_id    UUID REFERENCES users(id)
action     TEXT NOT NULL               -- e.g. 'email_sent', 'receipt_uploaded'
metadata   JSONB                       -- flexible payload
timestamp  TIMESTAMPTZ DEFAULT now()
```

---

## Tax Computation Logic

For each employee, the engine aggregates all 12 monthly records and derives the annual tax summary:

```
Total Basic Salary    = Σ monthly_records.basic       (Jan–Dec)
Total Allowances      = Σ monthly_records.allowance
Total SSNIT           = Σ monthly_records.ssnit
Chargeable Income     = Total Basic + Total Allowances − Total SSNIT
Total Tax Charged     = Σ monthly_records.tax
```

> **Implementation note:** Run computation server-side only. Never trust client-submitted tax figures. Recompute from raw `monthly_records` on every PDF generation request.

### Example

| Month | Basic | Allowance | SSNIT | Tax |
|---|---|---|---|---|
| January | 5,000 | 1,000 | 550 | 700 |
| February | 5,000 | 1,000 | 550 | 700 |
| … | … | … | … | … |
| **Annual Total** | **60,000** | **12,000** | **6,600** | **8,400** |

**Chargeable Income** = 60,000 + 12,000 − 6,600 = **65,400**

---

## User Flows

### Finance Portal Flow

```
[1] Login
     │
     ▼
[2] Finance Dashboard (department cards)
     │
     ├─► [3] Upload Employee Master (CSV/XLSX)
     │         │  Validate → deduplicate → create employee records
     │         │  Auto-generate department cards
     │         ▼
     ├─► [4] Upload Salary Workbook (CSV/XLSX)
     │         │  Parse → group by employee ID → validate months
     │         │  Preview before generate (edge case protection)
     │         ▼
     ├─► [5] Generate Tax Summaries
     │         │  Compute summaries → render PDFs → tokenize links
     │         │  Queue bulk email dispatch
     │         ▼
     └─► [6] Track Submissions
               │  Department cards with status indicators
               │  Per-employee status table
               └─► Receipt preview / download / ZIP export
```

### Employee Flow

```
[1] Receives email: "Your 2026 Tax Summary is Ready"
     │  Contains secure magic link (time-limited token)
     ▼
[2] Lands on Employee Summary Page
     │
     ├─► Section 1: Highlighted annual tax values (large cards)
     ├─► Section 2: Monthly breakdown (expandable accordion)
     ├─► Section 3: Download PDF
     └─► Section 4: Upload Tax Receipt
               │  Accepts: PDF, JPG, PNG
               │  On upload: timestamp recorded, confirmation shown
               └─► Can replace receipt if wrong file submitted
```

---

## Employee Page UX Specification

### Section 1 — Annual Summary Cards

Five prominent metric cards, designed for immediate legibility:

| Card | Field | Notes |
|---|---|---|
| 💰 Basic Salary | `total_basic` | Primary income |
| 🏦 Cash Allowance | `total_allowance` | All allowances combined |
| 🔒 Social Security | `total_ssnit` | SSNIT deductions |
| 📊 Chargeable Income | `chargeable_income` | What gets taxed |
| 🧾 Tax Charged | `total_tax` | Total tax liability |

**Copy guidance:** Each card includes a subtle instruction — *"Enter this value into the tax portal."* — to reduce employee friction and support questions.

### Section 2 — Monthly Breakdown

Expandable accordion: January through December. Each row shows:
- Basic Salary · Allowance · SSNIT · Tax

Default state: collapsed. Employee expands months if they want to verify figures.

### Section 3 — PDF Download

Single prominent CTA. Pre-generated PDF stored on S3, served via short-lived signed URL to prevent hotlinking.

### Section 4 — Receipt Upload

- Accepted formats: `PDF`, `JPG`, `PNG`
- Max file size: enforce server-side (recommend 10MB)
- On success: timestamp displayed, status updated to `Submitted`
- Re-upload: allowed, marks previous receipt as `replaced_at`

---

## Finance Dashboard UX Specification

### Department Cards

Each card shows real-time aggregate status:

```
┌──────────────────────────┐   ┌──────────────────────────┐
│ 🟠 UX Department         │   │ 🟢 Engineering           │
│ 18 Employees             │   │ 24 Employees             │
│ 12 Submitted             │   │ 24 Submitted             │
│ 6 Pending                │   │ All Complete ✓           │
└──────────────────────────┘   └──────────────────────────┘
```

**Color logic:**
- 🟢 Green — 100% submitted
- 🟠 Orange — Partially submitted
- 🔴 Red — 0 submitted

### Department Table View

Clicking a card reveals a per-employee table:

| Name | Email | Tax Sent | Viewed | Submitted | Receipt |
|---|---|---|---|---|---|
| Ama Owusu | ama@co.com | ✅ | ✅ | ✅ | [Preview] |
| Kojo Mensah | kojo@co.com | ✅ | ✅ | ⏳ | — |
| Abena Asare | abena@co.com | ✅ | — | — | — |

Finance actions per row:
- Regenerate magic link (if email lost or expired)
- Preview or download individual receipt
- Download all receipts as ZIP

---

## Status Pipeline

Every employee moves sequentially through these states:

```
Tax Summary Generated
       │
       ▼
  Email Sent
       │
       ▼
  Link Viewed          ← tracked via token redemption ping
       │
       ▼
Receipt Submitted      ← final terminal state (or Replaced)
```

States are mutually exclusive and forward-only except for receipt replacement. Dashboard filters by state.

---

## Security Architecture

| Surface | Control |
|---|---|
| Employee data access | Token-scoped: each magic link only reveals that employee's records |
| Token lifetime | Configurable expiration (recommend 14 days); finance can regenerate |
| File storage | Signed URLs with short TTL (15–60 min); never expose raw S3 paths |
| Finance portal | Authenticated session; all routes server-side protected |
| Receipt isolation | Employees cannot access, view, or overwrite other employees' receipts |
| Audit trail | All significant actions logged to `activity_logs` with actor + timestamp |

> **OWASP note:** Validate all uploaded files server-side. Check MIME type, not just extension. Scan for malformed PDFs. Store outside web root.

---

## Validation & Edge Cases

| Scenario | Handling |
|---|---|
| Duplicate `employee_id` in upload | Reject entire batch with row-level error report |
| Missing month in salary workbook | Flag employee; partial data blocks PDF generation |
| Duplicate employee-month record | Database constraint rejects; surface in upload UI |
| Wrong file format uploaded | Preview step before processing; validate on ingest |
| Employee loses magic link email | Finance regenerates link from dashboard; old token invalidated |
| Employee uploads wrong receipt | Re-upload allowed; previous receipt archived with `replaced_at` timestamp |
| Token expired | Employee sees expiry message; prompted to contact finance |

---

## Scalability Path

### MVP Tier (50–300 employees)

- Synchronous PDF generation at summary-generation time
- Direct bulk email dispatch (queued, not parallel)
- Single Supabase instance, single storage bucket

### Growth Tier (300–2,000 employees)

- Move PDF generation to async background workers
- Introduce a proper job queue (BullMQ / Supabase Edge Functions)
- Batch email via SendGrid / Resend with rate limiting
- CDN layer in front of S3 for PDF delivery

### Scale Tier (2,000+ / Multi-company SaaS)

- Multi-tenant schema with `company_id` on all tables
- Per-company storage buckets
- PDF generation microservice (independently scalable)
- Dedicated worker fleet for bulk operations

---

## Future Roadmap

| Feature | Impact | Complexity |
|---|---|---|
| Direct tax authority portal integration | 🔥 High | High |
| Automatic tax filing submission | 🔥 High | High |
| Employee reminder notifications (day 7, day 14) | Medium | Low |
| HR system integration (auto-sync employee roster) | Medium | Medium |
| Multi-company SaaS support | High | High |
| In-portal tax portal credential entry (no manual copy) | 🔥 High | Medium |
| Analytics dashboard (YoY tax trends by department) | Low | Low |

---

## Implementation Priorities for MVP

1. **Data ingestion pipeline** — get upload + parsing + validation airtight before building any UI. Bad data in = broken PDFs out.
2. **Tax computation engine** — unit-test exhaustively. This is the trust core of the product.
3. **PDF generation** — nail the template. Employees will print and reference this document.
4. **Magic link auth** — security-first. Tokenize properly, expire aggressively, regenerate gracefully.
5. **Finance dashboard** — ship the status table first; department cards are a polish layer.
6. **Employee page** — Section 1 (summary cards) + Section 4 (receipt upload) are the critical path. Sections 2 and 3 are table stakes but can follow.

---

*Blueprint derived from internal system specification. Intended for engineering and product teams implementing the Tax Filing Automation Portal.*
