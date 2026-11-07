import { describe, expect, it } from 'vitest';

import {
  authorizeUrl,
  dedupeDays,
  garminDailiesToDays,
  garminSleepsToDays,
  garminStressToDays,
  importKey,
  isGarminCallback,
  openState,
  ouraToDays,
  pkcePair,
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
