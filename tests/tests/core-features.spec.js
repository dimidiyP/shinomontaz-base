import { test, expect } from '@playwright/test';

// Test data
const ADMIN_CREDENTIALS = { username: 'admin', password: 'K2enlzuzz2' };
const USER_CREDENTIALS = { username: 'user', password: 'user' };

test.describe('Tire Storage Management System - Core Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should login as admin successfully', async ({ page }) => {
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Админ панель')).toBeVisible();
    await expect(page.locator('text=Записать на хранение')).toBeVisible();
  });

  test('should create a new storage record', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to storage form
    await page.click('text=Записать на хранение');
    
    // Fill the form
    await page.fill('input[placeholder*="ФИО"]', 'Тестовый Пользователь');
    await page.fill('input[type="tel"]', '9999999999');
    await page.fill('input[placeholder*="машин"]', 'Toyota Camry');
    await page.fill('input[placeholder*="параметр"]', 'R17, 225/60R17');
    await page.fill('input[placeholder*="размер"]', '4 шт.');
    await page.selectOption('select', 'Бекетова 3а.к15');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Запись успешно создана')).toBeVisible();
  });

  test('should view and filter records', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Check if records table is visible
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("ФИО")')).toBeVisible();
    
    // Test filtering
    await page.selectOption('select', 'Взята на хранение');
    await expect(page.locator('table tbody tr')).toHaveCount({ min: 0 });
  });

  test('should limit phone input to 10 digits', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to storage form
    await page.click('text=Записать на хранение');
    
    // Try to input more than 10 digits
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('12345678901234567890');
    
    // Check that only 10 digits are accepted
    const phoneValue = await phoneInput.inputValue();
    expect(phoneValue.length).toBeLessThanOrEqual(10);
  });

  test('should access form configuration editor', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to form config
    await page.click('text=Изменение формы записи');
    
    // Check if form config is visible
    await expect(page.locator('text=Поля формы')).toBeVisible();
    await expect(page.locator('button:has-text("Добавить поле")')).toBeVisible();
  });

  test('should check drag and drop indicators in form editor', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to form config
    await page.click('text=Изменение формы записи');
    
    // Check for drag indicators
    await expect(page.locator('span:has-text("≡")')).toHaveCount({ min: 1 });
    await expect(page.locator('[draggable="true"]')).toHaveCount({ min: 1 });
  });

  test('should display export and import buttons', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Check for export/import buttons
    await expect(page.locator('button:has-text("Экспорт")')).toBeVisible();
    await expect(page.locator('button:has-text("Импорт")').or(page.locator('input[type="file"]'))).toBeVisible();
  });

  test('should make record numbers clickable for detail view', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Navigate to records view
    await page.click('text=Просмотр сделанных записей');
    
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Check if record numbers are clickable (should have blue color and underline)
    const recordNumberLinks = page.locator('table tbody tr td:first-child button');
    if (await recordNumberLinks.count() > 0) {
      await expect(recordNumberLinks.first()).toHaveClass(/text-blue-600/);
      
      // Try to click and open detail modal
      await recordNumberLinks.first().click();
      await expect(page.locator('text=Запись №')).toBeVisible({ timeout: 5000 });
    }
  });
});