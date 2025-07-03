#!/usr/bin/env node

/**
 * Автоматический генератор тестов для новых функций
 * Использование: node generate-tests.js --feature "feature-name" --description "Feature description" --selectors "selector1,selector2"
 */

const fs = require('fs');
const path = require('path');

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.findIndex(arg => arg === `--${name}`);
  return index !== -1 ? args[index + 1] : null;
};

const featureName = getArg('feature');
const description = getArg('description');
const selectors = getArg('selectors')?.split(',') || [];

if (!featureName || !description) {
  console.error('Usage: node generate-tests.js --feature "feature-name" --description "Feature description" [--selectors "selector1,selector2"]');
  process.exit(1);
}

// Шаблон теста
const testTemplate = `import { test, expect } from '@playwright/test';

const ADMIN_CREDENTIALS = { username: 'admin', password: 'K2enlzuzz2' };
const USER_CREDENTIALS = { username: 'user', password: 'user' };

test.describe('${description}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login as admin
    await page.fill('input[type="text"]', ADMIN_CREDENTIALS.username);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Админ панель')).toBeVisible();
  });

  test('should test ${featureName} functionality', async ({ page }) => {
    // TODO: Implement test for ${featureName}
    // Description: ${description}
    
    ${selectors.map(selector => `
    // Check for selector: ${selector}
    await expect(page.locator('${selector}')).toBeVisible();`).join('')}
    
    // Add specific test logic here
    console.log('Testing ${featureName}: ${description}');
  });

  test('should handle ${featureName} error cases', async ({ page }) => {
    // TODO: Test error scenarios for ${featureName}
    console.log('Testing error cases for ${featureName}');
  });

  test('should verify ${featureName} permissions', async ({ page }) => {
    // Logout and login as regular user
    await page.click('button:has-text("Выйти")').catch(() => {});
    await page.fill('input[type="text"]', USER_CREDENTIALS.username);
    await page.fill('input[type="password"]', USER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // TODO: Verify permission restrictions for ${featureName}
    console.log('Testing permissions for ${featureName}');
  });
});
`;

// Создание файла теста
const fileName = `${featureName.toLowerCase().replace(/\s+/g, '-')}.spec.js`;
const filePath = path.join(__dirname, 'tests', fileName);

fs.writeFileSync(filePath, testTemplate);

console.log(`✅ Generated test file: ${filePath}`);
console.log(`📝 Test for feature: ${description}`);
console.log(`🔧 Please customize the generated test with specific logic for your feature.`);

// Обновление конфигурации тестирования
const configPath = path.join(__dirname, 'test-config.json');
let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  config = { features: [], lastGenerated: null };
}

config.features.push({
  name: featureName,
  description: description,
  testFile: fileName,
  selectors: selectors,
  createdAt: new Date().toISOString()
});

config.lastGenerated = new Date().toISOString();

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`📊 Updated test configuration with new feature.`);