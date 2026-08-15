// Welche Anbieter die App ueberhaupt kennt.
//
// Bewusst eine eigene, winzige Datei ohne jeden Import: oauth.ts zieht den
// Supabase-Client mit, und der wirft beim Laden, wenn die Umgebung nicht
// gesetzt ist (src/lib/supabase.ts). Die reine Liste soll ohne dieses Gepaeck
// benutzbar bleiben - von useAuthProviders.ts genauso wie aus einem Test.
export const OAUTH_PROVIDERS = ['google', 'apple'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
