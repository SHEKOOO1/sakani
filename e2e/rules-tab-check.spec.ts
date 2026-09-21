import { test, expect } from '@playwright/test';

async function loginAs(page, email: string) {
  const api = await page.request.post('/api/auth/login', { data: { email, password: '123456' } });
  const body = await api.json();
  expect(body.success).toBe(true);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('nav', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

test('[RulesTab] supervisor sees and edits event rules tab', async ({ page }) => {
  test.setTimeout(60000);
  await loginAs(page, 'sheko@dorm.app');
  await page.goto('/admin/activities');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const card = page.locator('h3').first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();
  await page.waitForTimeout(1500);

  const rulesBtn = page.locator('button:has-text("قواعد الحضور والغياب")');
  await expect(rulesBtn).toBeVisible({ timeout: 10000 });
  await rulesBtn.click();
  await page.waitForTimeout(1000);

  await expect(page.locator('text=قواعد الفعالية الذكية').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('button:has-text("حفظ قواعد الفعالية")')).toBeVisible();
});