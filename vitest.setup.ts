import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react raeumt zwischen Tests nur automatisch auf, wenn
// Vitest-Globals aktiv sind (test.globals) - dieses Projekt nutzt bewusst
// explizite Imports statt Globals, deshalb hier von Hand.
afterEach(() => {
  cleanup();
});
