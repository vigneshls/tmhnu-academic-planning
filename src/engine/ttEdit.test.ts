import { describe, expect, it } from 'vitest'
import { busyAt, clearCell, lessonsFor, placeLesson, setTeacher, swapCells, swapClashes } from './ttEdit'
import type { Cell, TimetableResult } from './types'

const cell = (lessonId: string, subject: string, teacherId: string): Cell => ({ lessonId, subject, teacherId })
// 2 sections × 1 day × 3 periods
function tt(): TimetableResult {
  return {
    generatedAt: '', days: 1, periods: 3, softScore: 0, violations: [],
    sections: [{ id: 'S1', label: '6 A', standard: '6', stage: 'MIDDLE', gender: 'C', strength: 30, subjects: [] }, { id: 'S2', label: '7 A', standard: '7', stage: 'MIDDLE', gender: 'C', strength: 30, subjects: [] }] as TimetableResult['sections'],
    teachers: [{ id: 'T1', name: 'Maths', maxPerDay: 6, maxPerWeek: 30 }, { id: 'T2', name: 'Tamil', maxPerDay: 6, maxPerWeek: 30 }] as TimetableResult['teachers'],
    lessons: [
      { id: 'L1', sectionId: 'S1', subject: 'Maths', teacherId: 'T1', count: 1, pref: 'any' },
      { id: 'L2', sectionId: 'S1', subject: 'Tamil', teacherId: 'T2', count: 2, pref: 'any' },
      { id: 'L3', sectionId: 'S2', subject: 'Maths', teacherId: 'T1', count: 1, pref: 'any' },
    ],
    grid: {
      S1: [[cell('L1', 'Maths', 'T1'), cell('L2', 'Tamil', 'T2'), null]],
      S2: [[null, cell('L3', 'Maths', 'T1'), null]],
    },
    unplaced: [{ lessonId: 'L2', remaining: 1 }],
  }
}

describe('timetable editing', () => {
  it('swaps two periods and reports a clash for the moved teacher', () => {
    const t = tt()
    // moving Maths (T1) from P1 to P2 clashes with T1 in 7 A at P2
    expect(swapClashes(t, 'S1', [0, 0], [0, 1])).toEqual([{ teacherId: 'T1', section: '7 A' }])
    const n = swapCells(t, 'S1', [0, 0], [0, 1])
    expect(n.grid.S1[0].map((c) => c?.subject)).toEqual(['Tamil', 'Maths', undefined])
    expect(t.grid.S1[0][0]!.subject).toBe('Maths') // original untouched
    // moving into the empty P3 is clash-free
    expect(swapClashes(t, 'S1', [0, 0], [0, 2])).toEqual([])
  })

  it('changes a teacher, removes and places periods, keeping unplaced counts right', () => {
    let t = setTeacher(tt(), 'S1', 0, 1, 'T1')
    expect(t.grid.S1[0][1]).toMatchObject({ teacherId: 'T1', edited: true })
    expect(busyAt(t, ['T1'], 0, 1, 'S2')).toEqual([{ teacherId: 'T1', section: '6 A' }])
    t = clearCell(t, 'S1', 0, 0)
    expect(t.unplaced).toEqual([{ lessonId: 'L1', remaining: 1 }, { lessonId: 'L2', remaining: 1 }])
    const todo = lessonsFor(t, 'S1')
    expect(todo.map((x) => [x.lesson.id, x.missing])).toEqual([['L1', 1], ['L2', 1]])
    t = placeLesson(t, 'S1', 0, 2, todo.find((x) => x.lesson.id === 'L2')!.lesson)
    expect(t.unplaced).toEqual([{ lessonId: 'L1', remaining: 1 }])
  })
})
