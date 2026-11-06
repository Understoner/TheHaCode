import type { Session } from '@supabase/supabase-js';

/**
 * Ist die Sitzung als Admin gekennzeichnet (app_metadata.role, Migration 0050)?
 * Nur fuer die Anzeige. Geschrieben wird ausschliesslich, was RLS ueber
 * is_admin() zulaesst. user_metadata zaehlt nicht: das kann der Client aendern.
 */
export function isAdminSession(session: Session | null): boolean {
  return session?.user.app_metadata?.role === 'admin';
}
