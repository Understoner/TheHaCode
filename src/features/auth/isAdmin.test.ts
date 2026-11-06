import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { isAdminSession } from './isAdmin';

const session = (user: object) => ({ user }) as unknown as Session;

describe('isAdminSession', () => {
  it('erkennt das Kennzeichen in app_metadata', () => {
    expect(isAdminSession(session({ app_metadata: { role: 'admin' } }))).toBe(true);
  });
  it('glaubt user_metadata nicht', () => {
    expect(isAdminSession(session({ app_metadata: {}, user_metadata: { role: 'admin' } }))).toBe(false);
  });
  it('kennt Gaeste', () => {
    expect(isAdminSession(null)).toBe(false);
  });
});
