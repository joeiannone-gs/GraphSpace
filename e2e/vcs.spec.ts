import { expect, test } from '@playwright/test';
import { editorReady, nodeCount, signUp } from './helpers';

test('commit, branch from an old commit, compare and restore', async ({ page }) => {
  await signUp(page);
  await page.getByRole('button', { name: /Fit a line/ }).click();
  await page.waitForURL(/\/p\//);
  await editorReady(page);
  const history = page.getByTestId('commit-history');
  const base = await nodeCount(page);

  await history.getByLabel('Commit message').fill('starting point');
  await history.getByRole('button', { name: '✓ Commit' }).click();
  await expect(history.locator('[data-testid^="commit-"]')).toHaveCount(1);
  await expect(history.getByText('no changes since')).toBeVisible();

  await page.getByTestId('palette-relu').click();
  await expect.poll(() => nodeCount(page)).toBe(base + 1);
  await history.getByLabel('Commit message').fill('added a ReLU');
  await history.getByRole('button', { name: '✓ Commit' }).click();
  await expect(history.locator('[data-testid^="commit-"]')).toHaveCount(2);

  // Compare the first commit with now: one node added.
  await history.locator('[data-testid^="commit-"]').last().click();
  await history.getByRole('button', { name: 'Compare with now' }).click();
  await expect(history.getByText('1 added')).toBeVisible();

  // Branch from the first commit: the new branch starts without the ReLU.
  page.once('dialog', (d) => d.accept('experiment'));
  await history.getByRole('button', { name: 'New branch here' }).click();
  await page.waitForURL(/branch=/);
  await editorReady(page);
  await expect.poll(() => nodeCount(page)).toBe(base);
  await expect(page.getByTestId('commit-history').getByText('Branch: experiment')).toBeVisible();

  // Restore the second commit into this branch's working copy, then undo.
  const h2 = page.getByTestId('commit-history');
  await h2.locator('[data-testid^="commit-"]').first().click();
  await h2.getByRole('button', { name: 'Restore' }).click();
  await expect.poll(() => nodeCount(page)).toBe(base + 1);
  await page.locator('body').press('Control+z');
  await expect.poll(() => nodeCount(page)).toBe(base);
});
