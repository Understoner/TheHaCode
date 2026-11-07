import { describe, expect, it } from 'vitest';

import {
  authorizeUrl,
  dedupeDays,
  garminBodyCompsToDays,
  garminPersonalPath,
  garminPersonalToDays,
  garminPersonalToken,
  listOf,
  shapeOf,
  garminDailiesToDays,
  garminSleepsToDays,
  garminStressToDays,
  importKey,
  isGarminCallback,
  openState,
  ouraToDays,
  pkcePair,
  splitGarminNotification,
  redirectUriFor,
  seal,
  sealState,
  STATE_TTL_MS,
  unseal,
  type DayValue,
} from '../wearables.ts';

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)));

function pick(values: DayValue[], metric: string, day = '2026-11-06') {
  return values.find((v) => v.metric === metric && v.day === day)?.value;
}

describe('ouraToDays', () => {
  const days = ouraToDays({
    activity: [{ day: '2026-11-06', steps: 8123, medium_activity_time: 1200, high_activity_time: 600 }],
    dailySleep: [{ day: '2026-11-06', score: 81 }],
    sleep: [
      { day: '2026-11-06', type: 'long_sleep', total_sleep_duration: 25200, average_breath: 14.25, lowest_heart_rate: 52 },
      { day: '2026-11-06', type: 'late_nap', total_sleep_duration: 1800, lowest_heart_rate: 40 },
      { day: '2026-11-06', type: 'rest', total_sleep_duration: 900 },
    ],
    stress: [{ day: '2026-11-06', stress_high: 3600 }],
  });

  it('uebernimmt Schritte und Schlafwert', () => {
    expect(pick(days, 'steps')).toBe(8123);
    expect(pick(days, 'sleep_score')).toBe(81);
  });

  it('zaehlt intensive Minuten doppelt wie Garmin', () => {
    // 20 min maessig + 2 x 10 min intensiv
    expect(pick(days, 'intensity_minutes')).toBe(40);
  });

  it('nimmt fuer den Schlaf nur den Hauptschlaf, ohne Nickerchen', () => {
    expect(pick(days, 'sleep_hours')).toBe(7);
    expect(pick(days, 'resting_hr')).toBe(52);
    expect(pick(days, 'respiration')).toBe(14.25);
  });

  it('rechnet Stress in Minuten', () => {
    expect(pick(days, 'stress_minutes')).toBe(60);
  });

  it('laesst fehlende Felder und kaputte Tage weg', () => {
    const empty = ouraToDays({
      activity: [{ day: 'gestern', steps: 10 }, { day: '2026-11-06' }],
      dailySleep: [{ day: '2026-11-06', score: null }],
      sleep: [],
      stress: [],
    });
    expect(empty).toEqual([]);
  });
});

describe('Garmin', () => {
  it('liest die Tageszusammenfassung', () => {
    const days = garminDailiesToDays([
      {
        calendarDate: '2026-11-06',
        steps: 9001,
        floorsClimbed: 12,
        moderateIntensityDurationInSeconds: 1800,
        vigorousIntensityDurationInSeconds: 300,
        restingHeartRateInBeatsPerMinute: 55,
        averageStressLevel: 31,
      },
    ]);
    expect(pick(days, 'steps')).toBe(9001);
    expect(pick(days, 'floors')).toBe(12);
    expect(pick(days, 'intensity_minutes')).toBe(40);
    expect(pick(days, 'resting_hr')).toBe(55);
    expect(pick(days, 'stress_level')).toBe(31);
  });

  it('nimmt -1 beim Stress als "nicht gemessen"', () => {
    const days = garminDailiesToDays([{ calendarDate: '2026-11-06', averageStressLevel: -1 }]);
    expect(pick(days, 'stress_level')).toBeUndefined();
  });

  it('rechnet die Schlafdauer aus den Phasen, ohne Wachzeit', () => {
    const days = garminSleepsToDays([
      {
        calendarDate: '2026-11-06',
        durationInSeconds: 28800,
        deepSleepDurationInSeconds: 5400,
        lightSleepDurationInSeconds: 14400,
        remSleepInSeconds: 5400,
        awakeDurationInSeconds: 3600,
        overallSleepScore: { value: 77 },
        timeOffsetSleepRespiration: { '0': 14, '60': 15, '120': -2 },
      },
    ]);
    expect(pick(days, 'sleep_hours')).toBe(7);
    expect(pick(days, 'sleep_score')).toBe(77);
    expect(pick(days, 'respiration')).toBe(14.5);
  });

  it('verdichtet Body Battery zum Tagesdurchschnitt', () => {
    const days = garminStressToDays([
      { calendarDate: '2026-11-06', timeOffsetBodyBatteryValues: { '0': 80, '180': 60, '360': 40 } },
    ]);
    expect(pick(days, 'body_battery')).toBe(60);
  });

  it('nimmt das Gewicht in kg, am Ortstag, die letzte Messung zaehlt', () => {
    // 05.11.2026 23:30 UTC = 06.11. 00:30 in Wien (+3600 s)
    const lateUtc = Date.UTC(2026, 10, 5, 23, 30) / 1000;
    const days = garminBodyCompsToDays([
      { measurementTimeInSeconds: lateUtc + 7200, measurementTimeOffsetInSeconds: 3600, weightInGrams: 72350 },
      { measurementTimeInSeconds: lateUtc, measurementTimeOffsetInSeconds: 3600, weightInGrams: 72800 },
      { measurementTimeInSeconds: lateUtc, weightInGrams: 0 },
    ]);
    expect(days).toEqual([{ metric: 'weight', day: '2026-11-06', value: 72.35 }]);
  });

  it('holt Daten nur bei Garmin ab', () => {
    expect(isGarminCallback('https://apis.garmin.com/wellness-api/rest/dailies?token=x')).toBe(true);
    expect(isGarminCallback('https://apis.garmin.com.evil.at/wellness-api/rest/dailies')).toBe(false);
    expect(isGarminCallback('http://apis.garmin.com/wellness-api/rest/dailies')).toBe(false);
    expect(isGarminCallback('https://apis.garmin.com/anderes')).toBe(false);
    expect(isGarminCallback(42)).toBe(false);
  });
});

describe('dedupeDays', () => {
  it('laesst den spaeteren Wert desselben Tages gewinnen', () => {
    expect(
      dedupeDays([
        { metric: 'steps', day: '2026-11-06', value: 1 },
        { metric: 'steps', day: '2026-11-06', value: 2 },
      ]),
    ).toEqual([{ metric: 'steps', day: '2026-11-06', value: 2 }]);
  });
});

describe('OAuth', () => {
  it('baut die Adressen der Anbieter', () => {
    const oura = new URL(authorizeUrl('oura', 'cid', 'https://staging.x.at/habit-tracker/geraete', 'st', 'ch'));
    expect(oura.host).toBe('cloud.ouraring.com');
    expect(oura.searchParams.get('scope')).toBe('daily');
    expect(oura.searchParams.get('code_challenge')).toBeNull();

    const garmin = new URL(authorizeUrl('garmin', 'cid', 'https://staging.x.at/habit-tracker/geraete', 'st', 'ch'));
    expect(garmin.host).toBe('connect.garmin.com');
    expect(garmin.searchParams.get('code_challenge')).toBe('ch');
    expect(garmin.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('springt in die App zurueck', () => {
    expect(redirectUriFor('https://staging.x.at/')).toBe('https://staging.x.at/habit-tracker/geraete');
  });

  it('erzeugt PKCE-Paare im erlaubten Format', async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('Verschluesselung', () => {
  it('entschluesselt, was sie verschluesselt hat', async () => {
    const key = await importKey(KEY);
    const sealed = await seal(key, 'token', 'geheim');
    expect(sealed).not.toContain('geheim');
    expect(await unseal(key, 'token', sealed)).toBe('geheim');
  });

  it('laesst einen Schluessel nicht als state durchgehen', async () => {
    const key = await importKey(KEY);
    const token = await seal(key, 'token', JSON.stringify({ userId: 'u', provider: 'oura', verifier: 'v', expiresAt: Date.now() + 1000 }));
    expect(await openState(key, token)).toBeNull();
  });

  it('verwirft abgelaufene oder veraenderte states', async () => {
    const key = await importKey(KEY);
    const now = Date.now();
    const state = await sealState(key, { userId: 'u', provider: 'garmin', verifier: 'v', expiresAt: now + STATE_TTL_MS });
    expect((await openState(key, state, now))?.userId).toBe('u');
    expect(await openState(key, state, now + STATE_TTL_MS + 1)).toBeNull();
    expect(await openState(key, `${state.slice(0, -2)}AA`, now)).toBeNull();
  });

  it('verlangt einen 32-Byte-Schluessel', async () => {
    await expect(importKey(btoa('kurz'))).rejects.toThrow();
  });
});

describe('splitGarminNotification', () => {
  it('trennt Push-Daten je Garmin-Nutzer von Pings', () => {
    const { pings, pushed } = splitGarminNotification([
      { userId: 'g1', calendarDate: '2026-11-06', steps: 9000 },
      { userId: 'g1', calendarDate: '2026-11-05', steps: 7000 },
      { userId: 'g2', calendarDate: '2026-11-06', steps: 100 },
      { userId: 'g3', callbackURL: 'https://apis.garmin.com/wellness-api/rest/dailies?x=1' },
    ]);
    expect(pushed.get('g1')).toHaveLength(2);
    expect(pushed.get('g2')).toHaveLength(1);
    expect(pings).toEqual([{ userId: 'g3', callbackURL: 'https://apis.garmin.com/wellness-api/rest/dailies?x=1' }]);
  });

  it('liest einen Eintrag mit fremder callbackURL nie als Daten', () => {
    const { pings, pushed } = splitGarminNotification([
      { userId: 'g1', callbackURL: 'https://evil.example/x', steps: 99999 },
    ]);
    expect(pushed.size).toBe(0);
    expect(pings).toHaveLength(1);
  });

  it('verwirft Eintraege ohne userId und Unsinn', () => {
    const { pings, pushed } = splitGarminNotification([null, 'x', { steps: 1 }, { userId: '' }]);
    expect(pings).toHaveLength(0);
    expect(pushed.size).toBe(0);
    expect(splitGarminNotification(undefined).pushed.size).toBe(0);
  });
});

describe('Garmin Personal API', () => {
  it('liest Tageszusammenfassung, Schlaf, Body Battery und Gewicht', () => {
    const days = garminPersonalToDays({
      summaries: [
        [
          {
            calendarDate: '2026-11-06',
            totalSteps: 9100,
            floorsAscended: 12,
            moderateIntensityMinutes: 20,
            vigorousIntensityMinutes: 10,
            restingHeartRate: 51,
            averageStressLevel: 28,
          },
          { calendarDate: '2026-11-05', averageStressLevel: -1 },
        ],
      ],
      sleeps: [
        [
          {
            dailySleepDTO: {
              calendarDate: '2026-11-06',
              sleepTimeSeconds: 27000,
              sleepScores: { overall: { value: 83 } },
              averageRespirationValue: 14.5,
            },
          },
        ],
      ],
      bodyBattery: [[{ date: '2026-11-06', bodyBatteryValuesArray: [[1, 40], [2, 60], [3, null]] }]],
      weight: [{ dailyWeightSummaries: [{ summaryDate: '2026-11-06', latestWeight: { weight: 72350 } }] }],
    });
    expect(pick(days, 'steps')).toBe(9100);
    expect(pick(days, 'floors')).toBe(12);
    expect(pick(days, 'intensity_minutes')).toBe(40);
    expect(pick(days, 'resting_hr')).toBe(51);
    expect(pick(days, 'stress_level')).toBe(28);
    expect(pick(days, 'stress_level', '2026-11-05')).toBeUndefined();
    expect(pick(days, 'sleep_hours')).toBe(7.5);
    expect(pick(days, 'sleep_score')).toBe(83);
    expect(pick(days, 'respiration')).toBe(14.5);
    expect(pick(days, 'body_battery')).toBe(50);
    expect(pick(days, 'weight')).toBe(72.35);
  });

  it('nimmt Health-API-Schreibweisen und die Statistik als Ersatz', () => {
    const days = garminPersonalToDays({
      steps: [[{ calendarDate: '2026-11-06', totalSteps: 500 }, { calendarDate: '2026-11-04', totalSteps: 4000 }]],
      summaries: [[{ calendarDate: '2026-11-06', steps: 9000, floorsClimbed: 3, moderateIntensityDurationInSeconds: 600 }]],
      sleeps: [[{ calendarDate: '2026-11-06', deepSleepSeconds: 3600, lightSleepSeconds: 7200, overallSleepScore: { value: 70 } }]],
      stress: [[{ calendarDate: '2026-11-04', values: { overallStressLevel: 33 } }]],
    });
    // Die Zusammenfassung gewinnt gegen die Statistik am selben Tag.
    expect(pick(days, 'steps')).toBe(9000);
    expect(pick(days, 'steps', '2026-11-04')).toBe(4000);
    expect(pick(days, 'floors')).toBe(3);
    expect(pick(days, 'intensity_minutes')).toBe(10);
    expect(pick(days, 'sleep_hours')).toBe(3);
    expect(pick(days, 'sleep_score')).toBe(70);
    expect(pick(days, 'stress_level', '2026-11-04')).toBe(33);
  });

  it('ignoriert Unsinn ohne Absturz', () => {
    expect(garminPersonalToDays({ summaries: [null, 'x', { calendarDate: 'gestern', totalSteps: 5 }] })).toEqual([]);
    expect(listOf(null)).toEqual([]);
  });

  it('findet das Token in verschiedenen Antworten', () => {
    expect(garminPersonalToken({ access_token: 'abc' })).toBe('abc');
    expect(garminPersonalToken({ accessToken: 'def' })).toBe('def');
    expect(garminPersonalToken('aaa.bbb.ccc')).toBe('aaa.bbb.ccc');
    expect(garminPersonalToken('kein token')).toBeNull();
    expect(garminPersonalToken({})).toBeNull();
  });

  it('baut die Adressen mit beiden Tagen', () => {
    expect(garminPersonalPath('summaries', '2026-10-08', '2026-10-17')).toBe(
      '/usersummary-service/v2/dailysummaries?startDate=2026-10-08&endDate=2026-10-17',
    );
    expect(garminPersonalPath('weight', '2026-10-08', '2026-10-17')).toBe(
      '/weight-service/weight/range/2026-10-08/2026-10-17?includeAll=true',
    );
  });

  it('gibt fuers Log nur Feldnamen weiter, keine Werte', () => {
    const shape = shapeOf([{ calendarDate: '2026-11-06', totalSteps: 9100, latestWeight: { weight: 72350 } }]);
    expect(shape).toEqual(['calendarDate', 'totalSteps', 'latestWeight', 'latestWeight.weight']);
    expect(JSON.stringify(shape)).not.toContain('9100');
  });
});
