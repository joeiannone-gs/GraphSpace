import { expect, test } from '@playwright/test';

test('sign up, create a project, have it saved, and sign out', async ({ page }) => {
  const email = `learner-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Ada Learner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a good password');
  await page.getByLabel('Invite code').fill('e2e-invite');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'My GraphSpace' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole('button', { name: /Fit a line/ }).click();
  await page.waitForURL(/\/p\//);
  const projectUrl = page.url();
  await page.waitForFunction(() => Boolean((window as unknown as { __graphspace?: unknown }).__graphspace));
  await expect(page.getByTestId('save-status')).toHaveText('All changes saved');

  // Rename the project and add a node; both should survive a reload.
  const title = page.getByLabel('Project title');
  await title.fill('My first model');
  await title.press('Enter');
  await page.getByTestId('palette-relu').click();
  await expect(page.getByTestId('save-status')).toHaveText('All changes saved', { timeout: 10_000 });
  const count = await page.evaluate(
    () => Object.keys((window as unknown as { __graphspace: { store: { getState(): { doc: { present: { nodes: object } } } } } }).__graphspace.store.getState().doc.present.nodes).length,
  );
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as { __graphspace?: unknown }).__graphspace));
  await expect(page.getByLabel('Project title')).toHaveValue('My first model');
  await expect
    .poll(() =>
      page.evaluate(
        () => Object.keys((window as unknown as { __graphspace: { store: { getState(): { doc: { present: { nodes: object } } } } } }).__graphspace.store.getState().doc.present.nodes).length,
      ),
    )
    .toBe(count);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
  await page.goto(projectUrl);
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('wrong passwords are refused', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByLabel('Password').fill('whatever123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Wrong email or password.')).toBeVisible();
});
