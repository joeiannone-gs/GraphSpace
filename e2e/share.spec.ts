import { expect, test } from '@playwright/test';
import { editorReady, signUp } from './helpers';

test('share a project read-only and fork it from the link', async ({ page, browser }) => {
  await signUp(page, 'Sharer');
  await page.getByRole('button', { name: /XOR/ }).click();
  await page.waitForURL(/\/p\//);
  await editorReady(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = await page.getByLabel('Share link').first().inputValue();
  expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/);

  // A visitor without an account can open and run it, and is asked to sign in to fork.
  const visitor = await browser.newPage();
  await visitor.goto(link);
  await editorReady(visitor);
  await expect(visitor.getByText('Shared by Sharer')).toBeVisible();
  await visitor.getByRole('button', { name: 'Fork to my GraphSpace' }).click();
  await visitor.waitForURL(/\/login\?next=%2Fs%2F/);
  await visitor.close();

  // The owner can fork their own link.
  await page.goto(link);
  await editorReady(page);
  await page.getByRole('button', { name: 'Fork to my GraphSpace' }).click();
  await page.waitForURL(/\/p\//);
  await expect(page.getByLabel('Project title')).toHaveValue(/\(copy\)/);
});
