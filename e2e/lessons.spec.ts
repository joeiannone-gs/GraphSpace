import { expect, test } from '@playwright/test';
import { editorReady, signUp } from './helpers';

test('a lesson checks your work and saves progress', async ({ page }) => {
  await signUp(page);
  await page.goto('/learn');
  await page.getByTestId('lesson-values-flow').getByRole('button', { name: 'Start' }).click();
  await page.waitForURL(/\/p\//);
  await editorReady(page);
  const panel = page.getByTestId('lesson-panel');
  await expect(panel.getByText('Add two numbers')).toBeVisible();
  // Only the lesson's nodes are offered.
  await expect(page.getByTestId('palette-add')).toBeVisible();
  await expect(page.getByTestId('palette-dataset')).toHaveCount(0);

  await panel.getByRole('button', { name: 'Check my work' }).click();
  await expect(panel.getByRole('list', { name: 'Checks' })).toContainText('✗');

  page.once('dialog', (d) => d.accept());
  await panel.getByRole('button', { name: 'Show me' }).click();
  await panel.getByRole('button', { name: 'Check my work' }).click();
  await expect(panel.getByRole('button', { name: 'Next step →' })).toBeVisible();
  await panel.getByRole('button', { name: 'Next step →' }).click();
  await expect(panel.getByText('Multiply the result')).toBeVisible();

  await page.goto('/learn');
  await expect(page.getByTestId('lesson-values-flow')).toContainText('Step 2 of 3');
});

test('lessons work without an account', async ({ page }) => {
  await page.goto('/learn/fit-a-line');
  await editorReady(page);
  await expect(page.getByTestId('lesson-panel').getByText('Make a prediction')).toBeVisible();
});
