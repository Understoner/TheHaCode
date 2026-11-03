// Onlinekurse (V1.2) sind nur im Testsystem sichtbar, bis das Team sie fuer
// das Livesystem freigibt (Entscheidung 03.11.2026: jeder Schritt einzeln
// nach develop). Ein Livegang anderer Aenderungen nimmt sie so nicht
// halbfertig mit. Zur Freigabe: diesen Schalter auf true setzen.
export const ONLINE_COURSES_ENABLED = process.env.EXPO_PUBLIC_APP_ENV !== 'production';
