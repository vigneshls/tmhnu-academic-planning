# TMHNU Schools — Academic Planning

**Live app:** https://vigneshls.github.io/tmhnu-staffing/ (after the first deploy; see below)

This app plans staffing and timetables and checks compliance for:

- NS Vidyalaya Matriculation Higher Secondary School
- TMHNU Matriculation Higher Secondary School, Muthuthevanpatti
- NS Matriculation Higher Secondary School, Vadapudupatti

Two boards are supported: **CBSE** and **Matriculation (Tamil Nadu)**. Each school's board can be changed by management.

## Roles

| | Management | Principal |
|---|---|---|
| Schools | All | Own school only |
| Faculty list | Uploads the Excel file and replaces the list | Views the full list (read-only) |
| Student strength, timetable, compliance checklist | Edit | Edit |
| Board rules (caps, workload, subject periods) | Edit | — |

In live mode these permissions are enforced by Postgres Row Level Security. The faculty list is stored in a separate admin-only table.

## Faculty upload (Excel)

1. Go to Faculty → **Download template**. The template has drop-down lists for Designation, Qualification, Professional Qualification, TET, Appointment and Subject, plus an Instructions sheet.
2. The school fills one row per staff member.
3. Management uploads the file. Each row is checked:
   - **Rejected:** missing name, unknown designation, or duplicate Employee ID.
   - **Warning:** an unrecognised value, a bad date, or a number out of range.
4. After reviewing, confirm **Replace faculty list**.

The template deliberately collects no phone, Aadhaar, bank or salary data.

## Recommendation engine

`src/engine/recommend.ts` checks the school's data against cited rules. Every recommendation shows its source.

| Area | CBSE | Matriculation |
|---|---|---|
| Class size | ≤ 40 per section (Bye-Laws cl. 4.8); never > 45 (Circular 11/2025) | Institution cap (TN norms 30/35/40) |
| Ratios | PTR ≤ 30:1; 1.5 teachers per section (cl. 5.4) | — |
| RTE (Classes 1–8) | PTR 30:1 (Classes 1–5); subject teachers for Classes 6–8; Art, PE and Work Education instructors when Classes 6–8 have more than 100 students; head teacher | same |
| Student support | Full-time Special Educator (cl. 2.4.11); 1 counsellor per 500 students and a Career Counsellor (cl. 2.4.12, amended Jan 2026); PE teachers at 1:500 per stage | Counsellor on the Anti-bullying Committee (Rule 41) |
| Qualifications | D.El.Ed for Classes 1–5 (Supreme Court, 2023); degree + B.Ed (TGT); PG + B.Ed (PGT); TET for Classes 1–8; regular appointment | same (TN Rules 2023, Annexure IV-A) |
| Training | 50 hours a year, 25 of them via CBSE/Government (TRG-2/3, 2025) | 50 hours a year, as an advisory (NEP 2020) |
| Curriculum | Tamil in Classes 1–10 (TN Tamil Learning Act 2006); three languages from Class 6 (R3, 2026-27) | Tamil in Classes 1–10 |
| Planning | Subject-wise shortage or surplus, single-teacher subjects, under-2-year-only subjects, vacancies, workload buffer, rule conflicts | same |

There is also a **compliance checklist** of items that can't be verified from staffing data, such as ECS salary, the website disclosure, recognition renewal, fire NOC, the school committee, bus safety and registers. Schools tick these off, and the date and person are recorded.

Notes on the sources:
- Some sources are news summaries of circulars; the app labels these.
- The 1:500 PE-teacher ratio comes from a 2015-16 amendment and should be checked against the current clause 2.4.10.
- The recommendations support the school's own reading of the current official notifications. They do not replace it.

## Deploy (GitHub Pages)

```bash
gh repo create vigneshls/tmhnu-staffing --public --source=. --push
gh api -X POST repos/vigneshls/tmhnu-staffing/pages -f build_type=workflow
```
Or set it manually: Repo → Settings → Pages → Source: **GitHub Actions**. Every push to `main` then runs the tests, builds and publishes the site.

Without a database the site runs in **demo mode**: sample figures and fictional staff, stored per browser.

## Real logins (Supabase, free tier)

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql).
2. Create the management user and the 3 principals in Authentication → Users. Then insert the schools and profiles; there are SQL examples at the end of `schema.sql`.
3. In GitHub, go to Settings → Secrets and variables → Actions → **Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Re-run the deploy workflow.

Use only the anon key. RLS protects the data. Never put the service_role key in the app. Free Supabase projects pause when inactive.

## Run locally / offline

```bash
npm ci
npm run dev                # http://localhost:5173
npm test                   # 17 tests: engine, timetable, recommendations, Excel parsing
npm run build:standalone   # dist-standalone/index.html: one file, opens by double-click (demo mode)
python3 scripts/make_template.py   # regenerate the Excel template
```

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Supabase (Postgres, Auth, RLS), read-excel-file and Vitest.

MIT License.
