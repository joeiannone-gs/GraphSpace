import { expect, test } from '@playwright/test';
import { editorReady } from './helpers';

test('the pretrained transformer writes text in the browser', async ({ page }) => {
  await page.goto('/gallery/char-transformer');
  await editorReady(page);
  await page.getByRole('button', { name: 'Generate' }).click();
  const out = page.getByTestId('text-output');
  await expect(out).toContainText('Shall I');
  await expect.poll(async () => (await out.locator('pre').innerText()).length, { timeout: 30_000 }).toBeGreaterThan(150);
});
