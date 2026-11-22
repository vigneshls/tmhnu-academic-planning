# TMHNU Schools — Academic Planning

**Live:** https://vigneshls.github.io/tmhnu-academic-planning/

Each school fills **one Excel workbook**. Management uploads it, and the system automatically calculates:

- sections
- subject-wise teacher requirement
- a clash-free timetable
- **recommendations** ranked by severity, each linked to the CBSE, RTE or Tamil Nadu rule behind it

The app currently holds **NS Matriculation Higher Secondary School, Vadapudupatti**. More schools can be added from the admin panel.

## Workflow

1. **Admin → Data Import → "Blank workbook for this school"**. Send the downloaded file to the school.
2. The school fills the four sheets. The drop-down lists and value checks are built into the file.

   | Sheet | What it collects |
   |---|---|
   | School Profile | Name, board, UDISE+, recognition number and validity, minority status, days per week, periods per day, period length, lunch slot, working days in the year |
   | Students | Boys, girls and CWSN (children with special needs) per class; Classes 11–12 per group |
   | Faculty | One row per staff member: designation, subjects, qualification, professional qualification, TET, appointment, joining date, experience, training (CPD) hours |
   | Subject Periods | Periods per week per subject. Pre-filled with the board model, to be edited to match the school |

3. **Upload** the filled file. Every sheet, row and column is validated, and the page shows a before/after comparison. Then click **Apply import**.
4. The school dashboard updates immediately. Principals see their own school only.

The workbook deliberately collects no phone, Aadhaar, bank, salary or student-name data.

## Roles

| | Management | Principal |
|---|---|---|
| Schools, logins, data import, board rules, activity log | ✓ | — |
| School dashboard, recommendations, faculty list | All schools | Own school, read-only faculty list |
| Student numbers, timetable generation, compliance status | ✓ | ✓ |

## Recommendation engine

See `src/engine/recommend.ts` and `src/engine/sources.ts`. Every check shows the source it is based on.

- **Teacher strength:** subject-wise shortage and surplus; single-teacher subjects; RTE subject teachers and instructors; head of institution.
- **Class size and ratios:**
  - CBSE: 40 per section, never more than 45, PTR 30:1, 1.5 teachers per section.
  - RTE: 30:1 for Classes 1–5.
  - Matriculation: the institution's section caps.
- **Student support:**
  - CBSE: special educator, counsellor at 1:500, career counsellor, PE teachers.
  - Matriculation: a counsellor on the anti-bullying committee.
  - Both: provision for children with special needs (CWSN).
- **Qualifications:** D.El.Ed for Classes 1–5; degree + B.Ed (TGT); PG + B.Ed (PGT); TET for Classes 1–8; regular appointment.
- **Curriculum:**
  - Tamil in Classes 1–10.
  - CBSE: three languages (R3) from Class 6.
  - RTE minimum working days and instructional hours.
- **Compliance and records:**
  - Recognition validity (from the School Profile sheet), with an alert 3 months ahead.
  - In the app's Compliance tab: items marked "No", and certificates that have expired or expire within 60 days.
- **Professional development:** 50 hours of CPD per teacher; mentoring where a subject is taught only by teachers with less than 2 years' experience.
- **Timetable and workload:** vacancies, unscheduled periods, the 5-period buffer, and conflicts between rules.

## Modes

- **Live mode (the deployed site):** Supabase (Postgres + Auth + Row Level Security), project `jfmpjpkvziugslsduriy` (Mumbai). The public URL and anon key are in [`.env.production`](.env.production); all data is protected by RLS: management sees every school, a principal only their own. No real school data is stored in this repository.
  - Schema: [`supabase/schema.sql`](supabase/schema.sql) then [`supabase/admin_users.sql`](supabase/admin_users.sql).
  - Management creates logins and sets passwords in **Admin → Users & Logins** (database functions, no confirmation email).
- **Demo mode** (local builds without `.env.production`, and the standalone HTML): sample data with fictional teachers; logins stored in the browser with PBKDF2-hashed passwords.

## Development

```bash
npm ci
npm run dev                # http://localhost:5173
npm test                   # engine, timetable, recommendations, workbook round-trip
npm run build
npm run build:standalone   # single offline HTML file (demo mode)
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

React 19 · TypeScript · Vite · Tailwind CSS · Supabase · ExcelJS (template generation, loaded on demand) · read-excel-file · Vitest. MIT License.
