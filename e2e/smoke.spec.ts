import { expect, test } from '@playwright/test';

test('home page and health check respond', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Try the sandbox' })).toBeVisible();
});
