import { expect, test, type Page } from '@playwright/test';

type Hook = {
  store: { getState(): { doc: { present: { nodes: Record<string, { type: string; parent: string | null }>; edges: Record<string, unknown> } }; ui: { scope: string | null } } };
  canvas: { screenPoint(id: string, port?: { kind: 'in' | 'out'; name: string }): { x: number; y: number } | null };
};

async function state(page: Page) {
  return page.evaluate(() => {
    const h = (window as unknown as { __graphspace: Hook }).__graphspace;
    return { doc: h.store.getState().doc.present, scope: h.store.getState().ui.scope };
  });
}

async function point(page: Page, id: string, port?: { kind: 'in' | 'out'; name: string }) {
  const p = await page.evaluate(([i, pt]) => (window as unknown as { __graphspace: Hook }).__graphspace.canvas.screenPoint(i as string, pt as never), [id, port] as const);
  if (!p) throw new Error(`no point for ${id}`);
  return p;
}

const nodesOfType = async (page: Page, type: string) =>
  Object.entries((await state(page)).doc.nodes)
    .filter(([, n]) => n.type === type && n.parent === null)
    .map(([id]) => id);

test('the starter example trains in the browser', async ({ page }) => {
  await page.goto('/sandbox');
  await page.waitForFunction(() => Boolean((window as unknown as { __graphspace?: unknown }).__graphspace));
  await page.getByRole('button', { name: '▶ Train' }).click();
  await expect(page.getByTestId('runbar')).toContainText('step 300 / 300', { timeout: 30_000 });
  const text = await page.getByTestId('runbar').innerText();
  const loss = Number(/loss ([\d.e-]+)/.exec(text)?.[1]);
  expect(loss).toBeLessThan(0.15);
});

test('build a graph: add nodes, connect them, undo, and open a group', async ({ page }) => {
  await page.goto('/sandbox');
  await page.waitForFunction(() => Boolean((window as unknown as { __graphspace?: unknown }).__graphspace));
  await page.getByLabel('Open an example').selectOption('blank');
  await expect.poll(async () => Object.keys((await state(page)).doc.nodes).length).toBe(0);

  const canvas = page.getByTestId('canvas');
  const box = (await canvas.boundingBox())!;
  await page.getByTestId('palette-value').dragTo(canvas, { targetPosition: { x: box.width * 0.4, y: box.height * 0.7 } });
  await page.getByTestId('palette-square').dragTo(canvas, { targetPosition: { x: box.width * 0.6, y: box.height * 0.3 } });
  const [value] = await nodesOfType(page, 'value');
  const [square] = await nodesOfType(page, 'square');
  expect(value && square).toBeTruthy();

  const from = await point(page, value, { kind: 'out', name: 'out' });
  const to = await point(page, square, { kind: 'in', name: 'x' });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Object.keys((await state(page)).doc.edges).length).toBe(1);

  await page.mouse.click(box.x + 5, box.y + box.height - 5);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Object.keys((await state(page)).doc.edges).length).toBe(0);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => Object.keys((await state(page)).doc.edges).length).toBe(1);

  // Group both nodes, then open the group with a double-click.
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+g');
  const [group] = await nodesOfType(page, 'composite');
  expect(group).toBeTruthy();
  const c = await point(page, group);
  await page.mouse.dblclick(c.x, c.y);
  await expect.poll(async () => (await state(page)).scope).toBe(group);
  await expect(page.getByRole('navigation', { name: 'Group path' })).toContainText('Group');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).scope).toBe(null);
});
