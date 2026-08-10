import { expect, test } from '@playwright/test';

test('Startseite laedt und zeigt den Titel', async ({ page }) => {
  await page.goto('/');
  // exact: true, sonst matcht es case-insensitiv auch das "thehacode"-
  // Wortzeichen in der NavBar (zwei Treffer, strict-mode violation).
  await expect(page.getByText('TheHaCode', { exact: true })).toBeVisible();
});

test('build-info.json ist erreichbar', async ({ request }) => {
  const response = await request.get('/build-info.json');
  expect(response.ok()).toBe(true);

  const body = await response.json();
  expect(body.commit).toBeTruthy();
  expect(body.builtAt).toBeTruthy();
});
