import { describe, expect, it } from 'vitest';

import { diaryErrorKey, ownHabitErrorKey } from './diaryErrors';

describe('diaryErrorKey', () => {
  it('erkennt die Absage der Policy', () => {
    expect(diaryErrorKey({ code: '42501' })).toBe('errors:diary.forbidden');
  });

  it('unterscheidet Bereich und Zukunft', () => {
    expect(diaryErrorKey({ code: '23514', message: 'Wert ueber Maximum' })).toBe('errors:diary.range');
    expect(
      diaryErrorKey({ code: '23514', message: 'Eintraege fuer die Zukunft sind nicht moeglich' }),
    ).toBe('errors:diary.future');
  });

  it('faellt fuer alles andere auf die allgemeine Meldung zurueck', () => {
    expect(diaryErrorKey(new Error('Netz weg'))).toBe('errors:diary.save');
    expect(diaryErrorKey(null)).toBe('errors:diary.save');
  });
});

describe('ownHabitErrorKey', () => {
  it('erklaert, warum ein eigenes Habit nicht gespeichert wurde', () => {
    expect(ownHabitErrorKey({ code: '42501' })).toBe('errors:habits.forbidden');
    expect(ownHabitErrorKey({ code: '23514', message: 'Hoechstens 100 eigene Habits' })).toBe(
      'errors:habits.limit',
    );
    expect(ownHabitErrorKey(new Error('offline'))).toBe('errors:habits.save');
  });
});
