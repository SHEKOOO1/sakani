import { test, expect } from '@playwright/test';

test.describe('Priest Dashboard & Student Edit', () => {

  test('priest can login, view dashboard, and edit student profile', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'youhana@sakani.app');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=لوحة الأب المسؤول')).toBeVisible({ timeout: 10000 });

    // Navigate to shared profiles
    await page.goto('/shared-profiles');
    await page.waitForTimeout(2000);

    const profileLink = page.locator('a:has-text("عرض الملف")').first();
    if (await profileLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileLink.click();
      await page.waitForTimeout(2000);

      const editBtn = page.locator('button:has-text("تعديل البيانات")');
      await expect(editBtn).toBeVisible();

      await editBtn.click();
      await page.waitForTimeout(500);

      const churchLabel = page.locator('text=الكنيسة');
      if (await churchLabel.isVisible()) {
        const churchInputField = churchLabel.locator('..').locator('input');
        if (await churchInputField.isVisible()) {
          await churchInputField.fill('كنيسة القديسين');
        }
      }

      await page.click('button:has-text("حفظ التعديلات")');
      await page.waitForTimeout(2000);

      await expect(page.locator('text=تم حفظ التعديلات بنجاح')).toBeVisible({ timeout: 5000 });
    }
  });

  test('priest dashboard tabs work correctly', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'youhana@sakani.app');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=لوحة الأب المسؤول')).toBeVisible({ timeout: 10000 });

    const tabs = ['نظرة عامة', 'الانضباط', 'الإنذارات', 'مقترحات الفصل', 'الخريجين', 'البلاغات'];
    for (const tab of tabs) {
      await expect(page.locator(`text=${tab}`).first()).toBeVisible({ timeout: 5000 });
    }

    await page.locator('text=الانضباط').first().click();
    await page.waitForTimeout(1000);

    await page.locator('text=الإنذارات').first().click();
    await page.waitForTimeout(1000);
  });

  test('bishop dashboard loads correctly', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'bemwa@drom.app');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=لوحة الإيبارشية')).toBeVisible({ timeout: 10000 });

    const tabs = ['نظرة عامة', 'السكنات', 'الكهنة', 'التقارير الواردة'];
    for (const tab of tabs) {
      await expect(page.locator(`text=${tab}`).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
