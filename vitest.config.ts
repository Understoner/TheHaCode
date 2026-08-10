import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Komponententests laufen wie der Web-Build gegen react-native-web (Expo web.output: "static").
      'react-native': 'react-native-web',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
