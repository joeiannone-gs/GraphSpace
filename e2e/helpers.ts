import { expect, type Page } from '@playwright/test';

export async function signUp(page: Page, name = 'Test Learner') {
  const email = `t-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a good password');
  await page.getByLabel('Invite code').fill('e2e-invite');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'My GraphSpace' })).toBeVisible();
  return email;
}

export async function editorReady(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { __graphspace?: unknown }).__graphspace));
}

type Hook = { store: { getState(): { doc: { present: { nodes: Record<string, { type: string }> } } } } };

export const nodeCount = (page: Page) =>
  page.evaluate(() => Object.keys((window as unknown as { __graphspace: Hook }).__graphspace.store.getState().doc.present.nodes).length);
