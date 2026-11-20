"""Generates src/assets/faculty-template.xlsx (and a filled sample used by tests).
Run: python3 scripts/make_template.py"""
import datetime, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

DESIGNATIONS = [
    'Principal', 'Vice Principal / Academic Head', 'Post Graduate Teacher (PGT / PG Asst.)',
    'Graduate Teacher (TGT / BT Asst.)', 'Primary Teacher (PRT / SGT)', 'Pre-primary Teacher',
    'Specialist Teacher (PE, Art, Computer, Library, Hindi)', 'Special Educator',
    'Counsellor & Wellness Teacher', 'Career Counsellor', 'Librarian', 'Lab Assistant']
HIGHEST = ['Higher Secondary', 'Diploma', 'UG Degree', 'PG Degree', 'M.Phil', 'Ph.D']
PROF = ['D.El.Ed / D.T.Ed', 'B.El.Ed', 'B.Ed', 'M.Ed', 'NTT / Montessori', 'B.P.Ed / M.P.Ed', 'B.Ed (Special Education) / RCI', 'None']
TET = ['TNTET Paper I', 'TNTET Paper II', 'TNTET Both Papers', 'CTET Paper I', 'CTET Paper II', 'CTET Both Papers', 'Not passed', 'Not applicable']
APPT = ['Regular', 'Probation', 'Contract', 'Part-time']
SUBJECTS = ['All subjects', 'Tamil', 'English', 'Hindi', 'Maths', 'Science', 'Social Science', 'EVS', 'Physics', 'Chemistry',
            'Biology', 'Computer Science', 'Computer Applications', 'Accountancy', 'Commerce', 'Business Studies', 'Economics',
            'Applied Maths', 'PE / Art', 'Library / Value Ed', 'Language Activities', 'Counselling', 'Special Education']
HEADERS = [
    ('Employee ID', 14), ('Full Name *', 28), ('Designation *', 40), ('Main Subject', 20),
    ('Other Subjects (separate with ;)', 28), ('Highest Qualification', 20), ('Professional Qualification', 28),
    ('TET Status', 20), ('Appointment Type', 17), ('Date of Joining', 16), ('Total Experience (years)', 14),
    ('CPD Training Hours (this year)', 16), ('Max Periods per Week (optional)', 16)]
NAVY = '1F3A5F'
thin = Side(style='thin', color='C8CED6')

def build(path, rows=None):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Faculty'
    ws.append([h for h, _ in HEADERS])
    for i, (h, w) in enumerate(HEADERS, 1):
        c = ws.cell(row=1, column=i)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor=NAVY)
        c.alignment = Alignment(wrap_text=True, vertical='center')
        c.border = Border(bottom=thin, right=thin)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 34
    ws.freeze_panes = 'C2'

    lists = wb.create_sheet('Lists')
    for col, values in enumerate([DESIGNATIONS, HIGHEST, PROF, TET, APPT, SUBJECTS], 1):
        for r, v in enumerate(values, 1):
            lists.cell(row=r, column=col, value=v)
    lists.sheet_state = 'hidden'
    lists.protection.sheet = True

    def dv(col_letter, list_col, count, strict=True):
        ref = f"=Lists!${list_col}$1:${list_col}${count}"
        v = DataValidation(type='list', formula1=ref, allow_blank=True,
                           errorStyle='stop' if strict else 'warning',
                           error='Choose a value from the list.', errorTitle='Invalid value',
                           showErrorMessage=True)
        v.add(f'{col_letter}2:{col_letter}500')
        ws.add_data_validation(v)
    dv('C', 'A', len(DESIGNATIONS)); dv('F', 'B', len(HIGHEST)); dv('G', 'C', len(PROF))
    dv('H', 'D', len(TET)); dv('I', 'E', len(APPT)); dv('D', 'F', len(SUBJECTS), strict=False)
    date_dv = DataValidation(type='date', operator='between', formula1='DATE(1970,1,1)', formula2='DATE(2100,12,31)', allow_blank=True,
                             error='Enter a date (DD-MM-YYYY).', showErrorMessage=True)
    date_dv.add('J2:J500'); ws.add_data_validation(date_dv)
    for col, hi in (('K', 50), ('L', 500), ('M', 48)):
        nv = DataValidation(type='decimal', operator='between', formula1='0', formula2=str(hi), allow_blank=True,
                            error=f'Enter a number between 0 and {hi}.', showErrorMessage=True)
        nv.add(f'{col}2:{col}500'); ws.add_data_validation(nv)
    for r in range(2, 501):
        ws.cell(row=r, column=10).number_format = 'DD-MM-YYYY'

    for r, row in enumerate(rows or [], 2):
        for c, v in enumerate(row, 1):
            ws.cell(row=r, column=c, value=v)

    ins = wb.create_sheet('Instructions', 0)
    ins.column_dimensions['A'].width = 110
    lines = [
        ('Faculty Details — Upload Template', True),
        ('Fill one row per staff member in the "Faculty" sheet, then upload this file in the web application (Faculty → Upload Excel).', False),
        ('', False),
        ('Required columns: Full Name and Designation. All other columns are strongly recommended — they drive the compliance checks.', False),
        ('Designation, Highest Qualification, Professional Qualification, TET Status and Appointment Type must be chosen from the drop-down lists.', False),
        ('Main Subject: choose from the list or type the subject exactly as it appears in the school timetable (e.g. Maths, Physics, PE / Art).', False),
        ('Primary (PRT / SGT) and Pre-primary class teachers: enter "All subjects" as Main Subject.', False),
        ('Other Subjects: additional subjects the teacher can handle, separated by semicolons — e.g.  Science; Maths', False),
        ('Date of Joining: DD-MM-YYYY.   Experience: total years of teaching.   CPD hours: training hours completed in the current academic year.', False),
        ('Max Periods per Week: leave blank to use the institution policy for the designation.', False),
        ('', False),
        ('Do not rename the "Faculty" sheet or change the header row. Do not enter phone numbers, Aadhaar, bank or salary details — they are not needed.', True),
    ]
    for i, (text, bold) in enumerate(lines, 1):
        c = ins.cell(row=i, column=1, value=text)
        c.font = Font(bold=bold, size=14 if i == 1 else 11, color=NAVY if i == 1 else '222222')
        c.alignment = Alignment(wrap_text=True)
    wb.active = 1
    wb.save(path)

build(sys.argv[1] if len(sys.argv) > 1 else 'src/assets/faculty-template.xlsx')
d = datetime.datetime
build('src/lib/__fixtures__/sample-faculty.xlsx', [
    ['E001', 'R. Meenakshi', 'Principal', 'English', '', 'PG Degree', 'M.Ed', 'Not applicable', 'Regular', d(2010, 6, 1), 22, 30, None],
    ['E002', 'K. Arun', 'Post Graduate Teacher (PGT / PG Asst.)', 'Physics', 'Maths', 'PG Degree', 'B.Ed', 'Not applicable', 'Regular', d(2018, 6, 4), 8, 52, None],
    ['E003', 'S. Priya', 'Graduate Teacher (TGT / BT Asst.)', 'Maths', 'Science; Computer Science', 'UG Degree', 'B.Ed', 'TNTET Paper II', 'Contract', d(2024, 6, 3), 1.5, 12, 30],
    ['E004', 'A. Devi', 'Primary Teacher (PRT / SGT)', 'All subjects', '', 'UG Degree', 'B.Ed', 'Not passed', 'Regular', '15-06-2021', 4, None, None],
    ['E005', 'M. Kavitha', 'Counsellor & Wellness Teacher', 'Counselling', '', 'PG Degree', 'None', 'Not applicable', 'Regular', d(2022, 7, 1), 3, 20, None],
    ['', '', '', '', '', '', '', '', '', None, None, None, None],
    ['E006', 'Bad Row', 'Head Master of Everything', 'Maths', '', 'UG Degree', 'B.Ed', 'TNTET Paper II', 'Regular', None, 99, None, None],
    ['E003', 'Duplicate ID', 'Librarian', '', '', 'UG Degree', 'None', 'Not applicable', 'Regular', None, 2, None, None],
])
print('ok')
