# TMHNU School Staffing & Timetable System — Requirements Specification (v0.1 Draft)

**Prepared for:** TMHNU Educational Institution Management (5 schools)
**Status:** Draft — pending decisions marked ❓ in Section 9
**Date:** 20 Nov 2026

---

## 1. Purpose

Build a web application that lets the institution's management:

1. See, for each of the 5 schools, how many **sections** and how many **teachers** are required for every standard from **Pre-KG to Class 12**, computed automatically from student strength.
2. Compare **required vs. available** teachers (shortage / surplus) per school, per standard and per subject.
3. Generate a **weekly class timetable** and a **per-teacher timetable** that respects each teacher's fixed weekly and daily period limits.
4. Apply **different rule sets per board** (CBSE, Matriculation, State Board) without changing code.

## 2. Users and roles

| Role | Access |
|---|---|
| Management (Super Admin) | All 5 schools; edit rule sets; view consolidated reports |
| School Principal / Academic Head | Own school only; enter strength, staff, generate timetable |
| Viewer (optional) | Read-only reports |

## 3. Inputs

### 3.1 School master
- School name, board (CBSE / Matric / State Board), medium, working days per week, day start/end time, period duration, breaks, lunch, prayer/assembly slot.

### 3.2 Student strength (per academic year)
- **Pre-KG, LKG, UKG, Classes 1–5:** total students per standard.
- **Classes 6–12:** **boys and girls entered separately** per standard.
- **Classes 11–12:** strength per **group/stream** (e.g., Maths-Biology, Maths-Computer Science, Commerce, Arts) — sections are formed per group.

### 3.3 Staff list
- Name, category (Montessori / SGT / TGT / PGT / Academic Head / Principal / PET / Special teacher), subject(s) qualified to teach, standards they can teach, max periods/week, max periods/day, unavailable slots, differently-abled flag (eligible to leave 15 minutes early per the G.O. cited in the source documents).

### 3.4 Rule set (configurable per board, overridable per school)
- Max students per section.
- Pupil–teacher ratio (for compliance check only).
- Subject-wise periods per week, per standard (and per group for 11–12).
- Teacher workload limits per category (min/max per week, max per day).
- Scheduling constraints (Section 6).

## 4. Calculations

### 4.1 Sections
- Pre-KG to 5: `sections = ceil(total ÷ max_per_section)`
- 6 to 12 (co-ed sections): `sections = ceil((boys + girls) ÷ max_per_section)`
- 6 to 12 (separate boys/girls sections, if chosen ❓): `ceil(boys ÷ cap) + ceil(girls ÷ cap)`
- 11–12: computed per group.
- Show the resulting average class size, and flag any section above the cap.

### 4.2 Teachers required — subject-wise method (primary)
For each school and subject:
```
periods_needed(subject) = Σ over standards [ periods_per_week(subject, standard) × sections(standard) ]
teachers_needed(subject) = ceil( periods_needed(subject) ÷ max_periods_per_week(category) )
```
- Pre-KG–UKG: 1 Montessori/class teacher per section (+ helper, optional).
- Classes 1–5: 1 SGT (class teacher) per section; specialist teachers (Tamil/English/Computer/PET) optional per rule set.
- Classes 6–10: TGTs by subject. Classes 11–12: PGTs by subject.
- Teachers are counted per subject because a Tamil teacher cannot cover Maths periods. A single total-periods ÷ capacity figure understates the need.

### 4.3 Compliance checks (secondary)
- Pupil–teacher ratio vs. the board's norm.
- CBSE: at least 1.5 teachers per section (excluding Principal, PET, counsellor) and PTR ≤ 30:1.
- Teacher load within category limits; buffer of 5–8 periods/week for substitution/remedial (TMHNU policy).

### 4.4 Gap report
Required vs. available per subject, per school → shortage / surplus, plus a consolidated view across all 5 schools (to identify teachers who could be shared or redeployed).

## 5. Default norms extracted from the source documents

### 5.1 TMHNU Staff Workload Policy (institution's own document)

| Category | Periods/day | Periods/week | Focus |
|---|---|---|---|
| Montessori / Pre-primary | 5–6 sessions | 25–30 | Activity-based |
| SGT (Classes 1–5) | 6–7 | 30–35 | Multi-subject + class teacher |
| TGT (Classes 6–10) | 6–7 | 32–36 | Subject teaching |
| PGT (Classes 11–12) | 5–6 | 30–36 | Board classes |
| Academic Head (HOD / Coordinator / VP) | 2–4 | 10–20 | Supervision |
| Principal | 0–5 | Minimal | Administration |

Final recommendation in the same document: base load 35/week; PGT 30–32; Academic Head 15–20; keep 5–8 periods buffer.

### 5.2 Tamil Nadu Government school norms (reference document)
- Standard load ≈ 28 periods/week (B.T. / P.G. Assistants); period = 45 min; 6–7 periods/day; 5 days.
- Pupil–teacher ratio: Primary 1:30, Middle 1:35, High 1:40, Higher Secondary 1:60 (revised in 2019 per DT Next).
- RTE: Classes 1–5 → 200 working days / 800 instructional hours; Classes 6–8 → 220 days / 1000 hours.
- Period structure: Classes 1–5 → 7–8 periods/day, 40 min; Classes 6–10 → 8–9 periods/day, 40–45 min; two 10-min breaks; 40–45 min lunch.

### 5.3 Mandatory scheduling rules (Tamil document)
1. Teacher load max **30–32 periods/week** (plus note correction and lesson planning).
2. No teacher gets **more than 3 consecutive periods**.
3. Morning 9:00–9:30 reserved for Illam Thedi Kalvi / Ennum Ezhuthum where applicable.
4. Differently-abled teachers may leave 15 minutes early; respect this in the timetable.
5. No non-academic events during instructional periods.

### 5.4 Subject placement (SCERT recommendation, Tamil document)
- First 3 periods: difficult subjects (Maths, Science, English).
- After lunch: languages, Social Science, Art, Physical Education.
- Last period: Library, games, club activity, skill development.

### 5.5 Model weekly allocation, Classes 6–8 (Tamil document)
Tamil 6, English 6, Maths 7, Science 6, Social Science 6, PE/Art 4, Club/Library 3.

## 6. Timetable generation

### 6.1 Hard constraints (must never be violated)
- A teacher is in only one class per slot; a class has only one subject per slot.
- Every subject gets exactly its weekly period count per section.
- Teacher's weekly and daily maximums are respected.
- No more than 3 consecutive periods for a teacher.
- Teacher unavailable slots and early-leave permissions are respected.
- Lab/practical periods (11–12) are placed as double periods where configured.

### 6.2 Soft constraints (optimised, reported if not met)
- Difficult subjects in the first 3 periods; activity subjects in the last period.
- Spread each subject across the week (avoid the same subject twice a day unless needed).
- Balance daily load for each teacher.
- Class teacher takes the first period of their own section.

### 6.3 Outputs
- Class-wise timetable (per section), teacher-wise timetable, free-period/substitution chart.
- Export to PDF and Excel; printable A4 layout.
- If a valid timetable is impossible, show the exact reason (e.g., "Maths needs 84 periods; 2 Maths TGTs × 36 = 72 → 1 more teacher required").

## 7. Reports
- School dashboard: sections, teachers required vs. available, shortage by subject.
- Consolidated 5-school dashboard.
- Standard-wise boys/girls strength (6–12).
- Teacher workload report (assigned vs. limit).

## 8. Non-functional requirements
- Works on desktop and mobile browsers; Tamil + English labels.
- Deployed from GitHub (`vigneshls`) with a public demo URL; real student/staff data kept private.
- Rule sets editable by management without code changes.
- Data export/backup (Excel/JSON).
- Student and staff data handled as personal data (India's DPDP Act 2023): minimal fields, access by role.

## 9. Open decisions ❓

1. Exact boards of the 5 schools and how many schools per board.
2. Purpose of separate boys/girls counts (separate sections, or reporting only).
3. Which workload limit governs when documents conflict (TMHNU 32–36 vs. TN doc 30–32 vs. Govt 28).
4. Shared online system for all 5 principals vs. single-user version.
5. Subject–period tables for each standard and board (only Classes 6–8 are given in the documents).

## 10. Issues found in the source documents

| # | Issue | Impact |
|---|---|---|
| 1 | Classes 6–8 allocation states "Total 48 periods", but the listed subjects add up to **38** (6+6+7+6+6+4+3). | Timetable slots/week must be confirmed (e.g., 5 days × 8 = 40). |
| 2 | TGT load 32–36 (TMHNU table) exceeds the 30–32 maximum in the Tamil rules page. | Must choose one limit; it changes teacher count. |
| 3 | Base load 35/week (TMHNU recommendation) vs. ~28/week Govt norm. | Same as above. |
| 4 | Higher Secondary PTR 1:60 is a government staffing norm, not a section size. | Use section cap (e.g., 40) for sections; PTR only as a check. |
| 5 | Section caps for Matric / State Board private schools are not in the documents. | Need the institution's chosen cap or the applicable recognition rule. |
