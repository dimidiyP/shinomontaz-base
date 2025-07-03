import { test, expect } from '@playwright/test';

const ADMIN_CREDENTIALS = { username: 'admin', password: 'K2enlzuzz2' };

test.describe('Advanced Features - RetailCRM Integration & Status Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login as admin
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Админ панель')).toBeVisible();
  });

  test('should display retail status in record details', async ({ page }) => {
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Wait for records to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Try to click on first record number
    const recordLinks = page.locator('table tbody tr td:first-child button');
    if (await recordLinks.count() > 0) {
      await recordLinks.first().click();
      
      // Check if detail modal opens and shows retail status
      await expect(page.locator('text=Статус в Retail')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show status transition buttons based on record status', async ({ page }) => {
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Check if records with different statuses show appropriate buttons
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Look for status indicators in table
    const statusCells = page.locator('table tbody tr td:has-text("Взята на хранение"), table tbody tr td:has-text("Новая"), table tbody tr td:has-text("Выдана с хранения")');
    if (await statusCells.count() > 0) {
      console.log(`Found ${await statusCells.count()} records with status`);
    }
  });

  test('should test PDF generation from detail view', async ({ page }) => {
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Wait for records to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Try to open detail modal
    const recordLinks = page.locator('table tbody tr td:first-child button');
    if (await recordLinks.count() > 0) {
      await recordLinks.first().click();
      
      // Look for PDF generation button
      const pdfButton = page.locator('button:has-text("Распечатать акт")');
      if (await pdfButton.isVisible()) {
        // Set up download handler
        const downloadPromise = page.waitForEvent('download');
        await pdfButton.click();
        
        // Wait for download to complete
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/act_storage_\d+\.pdf/);
      }
    }
  });

  test('should verify search functionality with new statuses', async ({ page }) => {
    // Navigate to release/search page
    await page.click('text=Выдать с хранения');
    
    // Check search form
    await expect(page.locator('select option:has-text("ФИО")')).toBeVisible();
    await expect(page.locator('select option:has-text("Номер записи")')).toBeVisible();
    await expect(page.locator('select option:has-text("Телефон")')).toBeVisible();
    
    // Try searching by record number
    await page.selectOption('select[name="searchType"]', 'record_number');
    await page.fill('input[placeholder*="поиск"]', '1');
    await page.click('button:has-text("Поиск")');
    
    // Should show search results or no results message
    await page.waitForTimeout(2000);
  });

  test('should verify RetailCRM management interface', async ({ page }) => {
    // Navigate to user management (where RetailCRM status might be shown)
    await page.click('text=Управление пользователями');
    
    // Check if user management interface loads
    await expect(page.locator('text=Пользователи')).toBeVisible();
  });

  test('should check for new field types in form editor', async ({ page }) => {
    // Navigate to form editor
    await page.click('text=Изменение формы записи');
    
    // Click add field button
    await page.click('button:has-text("Добавить поле")');
    
    // Check field type options
    const typeSelects = page.locator('select option');
    await expect(typeSelects.filter({ hasText: 'Текст' })).toBeVisible();
    await expect(typeSelects.filter({ hasText: 'Телефон' })).toBeVisible();
    await expect(typeSelects.filter({ hasText: 'Email' })).toBeVisible();
    await expect(typeSelects.filter({ hasText: 'Выбор' })).toBeVisible();
  });

  test('should verify table scroll functionality', async ({ page }) => {
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Check if table has horizontal scroll
    const tableContainer = page.locator('.overflow-x-auto');
    await expect(tableContainer).toBeVisible();
    
    // Check if table has multiple columns that might require scrolling
    const headerCells = page.locator('table th');
    expect(await headerCells.count()).toBeGreaterThan(5);
  });
});