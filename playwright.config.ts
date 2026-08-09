import { defineConfig, devices } from '@playwright/test';

// Smoke-Tests gegen ein bereits deploytes Environment (Staging oder
// Production), nicht gegen einen lokalen Devserver — deploy.yml setzt
// BASE_URL erst, nachdem scripts/wait-for-deploy.sh die neue Version
// bestaetigt hat (DEPLOYMENT.md §4).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
