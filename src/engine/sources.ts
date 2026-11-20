/** Every recommendation cites one of these. Keep URLs to official or primary reporting sources. */
export interface Source {
  id: string
  title: string
  ref?: string
  url: string
  note?: string
}

export const SOURCES: Record<string, Source> = {
  CBSE_BYELAWS_48: {
    id: 'CBSE_BYELAWS_48',
    title: 'CBSE Affiliation Bye-Laws 2018',
    ref: 'Clause 4.8 — optimum 40 students per section',
    url: 'https://cbse.gov.in/cbsenew/infra.html',
  },
  CBSE_CIRC_11_2025: {
    id: 'CBSE_CIRC_11_2025',
    title: 'CBSE Circular No. 11/2025 (21.07.2025)',
    ref: 'Up to 45 per section only in documented exceptional cases; never above 45',
    url: 'https://news.careers360.com/cbse-issues-fresh-guidelines-on-class-strength-allows-up-45-students-section-in-special-cases-classes-1-to-12/amp',
  },
  CBSE_54: {
    id: 'CBSE_54',
    title: 'CBSE Mandatory Directions on Teacher Qualification & Number of Teachers',
    ref: 'Clause 5.4 — PTR ≤ 30:1; 1.5 teachers per section excl. Principal, PET, counsellor',
    url: 'https://cbse.gov.in/cbsenew/documents/Mandatory Directions of The Board With Regard To Teacher Qualification.pdf',
  },
  CBSE_51: {
    id: 'CBSE_51',
    title: 'CBSE Affiliation Bye-Laws 2018',
    ref: 'Clause 5.1 — teacher qualifications per NCTE regulations (5.1.1), state/KVS rules (5.1.2), Appendix VII (5.1.3)',
    url: 'https://www.cbse.gov.in/cbsenew/staff.html',
  },
  CBSE_2411: {
    id: 'CBSE_2411',
    title: 'CBSE Affiliation Bye-Laws 2018 ("Being in CBSE" manual)',
    ref: 'Clause 2.4.11 — full-time Special Educator in every Secondary / Sr. Secondary school',
    url: 'https://cbseacademic.nic.in/web_material/Manuals/Being_in%20CBSE_V-7pptx.pdf',
  },
  CBSE_2412_2026: {
    id: 'CBSE_2412_2026',
    title: 'CBSE amendment to Clause 2.4.12 (circular 19.01.2026)',
    ref: '2.4.12.1 — one regular Counselling & Wellness Teacher per 500 students; 2.4.12.2 — Career Counsellor compulsory (1:500, Classes 9–12)',
    url: 'https://news.careers360.com/cbse-mandates-socio-emotional-career-counsellors-affiliated-schools-rajasthan-hc-pil-student-mental-health-guidance-classes-9-12',
    note: 'News summary of the circular; confirm wording against the CBSE notification.',
  },
  CBSE_PE: {
    id: 'CBSE_PE',
    title: 'CBSE amendment to Affiliation Bye-Laws (Circular No. 7, 2015-16)',
    ref: 'PE teachers at each stage (PRT/TGT/PGT-PE) at a ratio of 1:500',
    url: 'https://saras.cbse.gov.in/saras/Circulars/\\2015-16Circular\\Circular\\Circular No.7.pdf',
    note: 'Pre-2018 amendment; carried into 2018 Bye-Laws cl. 2.4.10 — confirm the current ratio.',
  },
  CBSE_CPD: {
    id: 'CBSE_CPD',
    title: 'CBSE Notifications TRG-2/2025 & TRG-3/2025 (01.04.2025)',
    ref: 'Minimum 50 hours training per teacher per year; 25 hours through CBSE / Government institutes',
    url: 'https://cbse.gov.in/cbsenew/documents/PRESS_RELEASE_STEM_17042025.pdf',
  },
  CBSE_EXPECT: {
    id: 'CBSE_EXPECT',
    title: "CBSE — Board's Expectation from Schools",
    ref: 'Trained & qualified teaching staff on regular basis; salary per State norms; teacher training',
    url: 'https://www.cbse.gov.in/cbsenew/board.html',
  },
  CBSE_POST_AFF: {
    id: 'CBSE_POST_AFF',
    title: 'Being in CBSE — post-affiliation requirements',
    ref: 'Cl. 2.4.4 salary via ECS; 2.4.7 book list on website; 2.4.9 school website; safety guidelines; training nodal coordinator',
    url: 'https://cbseacademic.nic.in/web_material/Manuals/Being_in%20CBSE_V-7pptx.pdf',
  },
  CBSE_R3: {
    id: 'CBSE_R3',
    title: 'CBSE scheme of studies 2026-27 (circulars of 09.04.2026 and 05.05.2026)',
    ref: 'Third language (R3) compulsory from Class 6; at least two of R1/R2/R3 must be Indian languages',
    url: 'https://www.dtnext.in/news/national/cbse-plan-for-2026-27-three-language-formula-from-class-6-two-levels-of-maths-science-for-class-9',
  },
  TN_TAMIL_ACT: {
    id: 'TN_TAMIL_ACT',
    title: 'Tamil Nadu Tamil Learning Act, 2006 (Act 13 of 2006)',
    ref: 'Tamil as a compulsory subject in Classes 1–10 in all schools; private schools of all boards by 2024-25',
    url: 'https://www.dtnext.in/tamilnadu/2023/05/23/tn-private-schools-told-to-teach-tamil-for-students-till-class-10',
  },
  RTE_SCHEDULE: {
    id: 'RTE_SCHEDULE',
    title: 'Right of Children to Free and Compulsory Education Act, 2009 — Schedule',
    ref: 'PTR 30:1 (Classes 1–5), 35:1 (6–8); subject teachers for Science & Maths, Social Studies, Languages; head teacher and part-time Art, Health & PE, Work Education instructors when upper-primary admission > 100',
    url: 'https://eparlib.nic.in/bitstream/123456789/650149/1/149368.pdf',
  },
  RTE_DAYS: {
    id: 'RTE_DAYS',
    title: 'RTE Act 2009 — Schedule (working days / instructional hours)',
    ref: '200 days & 800 hours (Classes 1–5); 220 days & 1000 hours (Classes 6–8); 25% seats for disadvantaged groups in private schools',
    url: 'https://www.mcrhrdi.gov.in/ASO/week-4/RTE Entitilements 24-06-2015.pdf',
  },
  RTE_TET: {
    id: 'RTE_TET',
    title: 'RTE Act s.23 / NCTE minimum qualifications; Supreme Court judgment of 01.09.2025',
    ref: 'TET required for teachers of Classes 1–8; SC made TET mandatory for in-service teachers (Tamil Nadu has filed a review petition)',
    url: 'https://www.deccanherald.com/amp/story/india%2Ftamil-nadu%2Ftamil-nadu-files-review-plea-against-supreme-court-judgment-mandating-tet-for-in-service-teachers-3748672',
  },
  SC_DELED: {
    id: 'SC_DELED',
    title: 'Supreme Court — Devesh Sharma v. Union of India (11.08.2023)',
    ref: 'D.El.Ed. is the qualification for primary (Classes 1–5) teachers; B.Ed. holders ineligible (applied prospectively)',
    url: 'https://www.livelaw.in/top-stories/supreme-court-holds-bed-graduates-ineligible-for-primary-school-teachers-235082',
  },
  TN_RULES_2023: {
    id: 'TN_RULES_2023',
    title: 'Tamil Nadu Private Schools (Regulation) Rules, 2023',
    ref: 'Rules 8, 9, 17, 24, 26, 28, 32, 38, 41, 42',
    url: 'https://www.legitquest.com/act/tamil-nadu-private-schools-regulation-rules-2023/CB24',
  },
  TN_PTR: {
    id: 'TN_PTR',
    title: 'TN School Education Department PTR norms (2019 revision)',
    ref: 'Primary 1:30, Middle 1:35, High 1:40, Higher Secondary 1:60',
    url: 'https://www.dtnext.in/news/tamilnadu/excess-teachers-in-tamil-nadu-but-not-enough-to-teach-students',
  },
  NEP_CPD: {
    id: 'NEP_CPD',
    title: 'National Education Policy 2020 (as cited by CBSE)',
    ref: 'Each teacher to take part in at least 50 hours of CPD per year',
    url: 'https://news.careers360.com/cbse-starts-special-drive-teacher-training-government-schools-affiliated-in-line-nep-2020',
  },
  TMHNU_POLICY: {
    id: 'TMHNU_POLICY',
    title: 'TMHNU Staff Workload Policy & Period Distribution Guidelines',
    ref: 'Category workload ranges; keep 5–8 periods buffer for substitution/remedial',
    url: '#/rules',
  },
  PLANNING: {
    id: 'PLANNING',
    title: 'Institutional planning practice',
    ref: 'Derived from this school’s data — not a statutory requirement',
    url: '#/rules',
  },
}
