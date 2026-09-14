import { test, expect } from '@playwright/test';

const ROLES = [
  { name: 'admin',     email: 'shoukry@dorm.App' },
  { name: 'supervisor',email: 'sheko@dorm.app' },
  { name: 'priest',    email: 'youhana@sakani.app' },
  { name: 'student',   email: 'mina@dorm.app' },
  { name: 'parent',    email: 'n@sakani.app' },
  { name: 'employee',  email: 'm@sakani.app' },
] as const;

async function loginAs(page, email: string) {
  // API login to set httpOnly cookie
  const api = await page.request.post('/api/auth/login', {
    data: { email, password: '123456', tenantId: undefined }
  });
  const body = await api.json();
  expect(body.success).toBe(true);

  // Navigate to the app — the cookie is sent automatically
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for Layout to appear
  await page.waitForSelector('nav', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

// ─── 1. All profiles render ───
for (const role of ROLES) {
  test(`[Profile] ${role.name} profile renders`, async ({ page }) => {
    test.setTimeout(30000);
    await loginAs(page, role.email);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);
    const spinners = await page.locator('.animate-spin').count();
    expect(spinners).toBeLessThan(4);
    // Should render user name in profile
    const userName = await page.locator('h1').filter({ hasText: /.+/ }).count();
    expect(userName).toBeGreaterThan(0);
  });
}

// ─── 2. PermissionsCard removed from non-admin ───
for (const role of ROLES.filter(r => r.name !== 'admin')) {
  test(`[Task1] ${role.name} has NO PermissionsCard`, async ({ page }) => {
    test.setTimeout(30000);
    await loginAs(page, role.email);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=الصلاحيات والخصوصية')).toHaveCount(0);
  });
}

test('[Task1] admin HAS PermissionsCard', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'shoukry@dorm.App');
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4000);
  await expect(page.locator('text=الصلاحيات والخصوصية').first()).toBeVisible({ timeout: 8000 });
});

// ─── 3. Admin badges page ───
test('[Task3] admin badges page', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'shoukry@dorm.App');
  await page.goto('/admin/badges');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await expect(page.locator('button:has-text("وسام جديد")')).toBeVisible({ timeout: 8000 });
});

test('[Task3] supervisor badges page', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'sheko@dorm.app');
  await page.goto('/admin/badges');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await expect(page.locator('button:has-text("وسام جديد")')).toBeVisible({ timeout: 8000 });
});

// ─── 4. Parent no awards ───
test('[Task4] parent sidebar NO rewards', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'n@sakani.app');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  const navLinks = page.locator('nav button, nav a');
  const allTexts = await navLinks.allInnerTexts();
  const hasRewards = allTexts.some(t => t.includes('الجوائز') || t.includes('الأوسمة'));
  expect(hasRewards).toBe(false);
});

// ─── 5. Admin events page ───
test('[Task5] admin events page', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'shoukry@dorm.App');
  await page.goto('/admin/activities');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await expect(page.locator('button:has-text("إنشاء فعالية")')).toBeVisible({ timeout: 8000 });
});

// ─── 6. Payment methods ───
test('[Payments] admin payment methods', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'shoukry@dorm.App');
  await page.goto('/admin/payments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await expect(page.locator('text=وسائل الدفع').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('button:has-text("إضافة وسيلة")')).toBeVisible();
});

test('[Payments] supervisor payment methods', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'sheko@dorm.app');
  await page.goto('/admin/payments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await expect(page.locator('text=وسائل الدفع').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('button:has-text("إضافة وسيلة")')).toBeVisible();
});

test('[Payments] student cannot manage', async ({ page }) => {
  test.setTimeout(30000);
  await loginAs(page, 'mina@dorm.app');
  await page.goto('/admin/payments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  const btnCount = await page.locator('button:has-text("إضافة وسيلة")').count();
  expect(btnCount).toBe(0);
});
