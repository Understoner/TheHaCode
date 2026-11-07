// Geraete-Anbindung Oura und Garmin (0053, 07.11.2026) - nur im Testsystem,
// bis das Team sie fuer das Livesystem freigibt. Ein Livegang anderer
// Aenderungen nimmt sie so nicht mit. Zusaetzlich antwortet die Edge Function
// nur mit WEARABLES_ENABLED=true (Function Secret, nur Staging).
//
// Ruecknahme: diesen Schalter auf false setzen (docs/WEARABLES.md).
export const WEARABLES_ENABLED = process.env.EXPO_PUBLIC_APP_ENV !== 'production';
