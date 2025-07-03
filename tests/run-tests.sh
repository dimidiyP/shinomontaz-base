#!/bin/bash

# Скрипт автоматического тестирования frontend
# Использование: ./run-tests.sh [environment] [test-type]

ENVIRONMENT=${1:-"production"}
TEST_TYPE=${2:-"core"}
BASE_URL=""

# Определение URL в зависимости от окружения
case $ENVIRONMENT in
  "production")
    BASE_URL="https://baseshinomontaz.ru"
    ;;
  "staging")
    BASE_URL="http://staging.baseshinomontaz.ru"
    ;;
  "local")
    BASE_URL="http://localhost:3000"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "🚀 Starting frontend tests for $ENVIRONMENT environment"
echo "🌐 Base URL: $BASE_URL"

cd /app/tests

# Установка браузеров если нужно
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Установка браузеров Playwright
echo "🌐 Installing browsers..."
npx playwright install --with-deps

# Запуск тестов
echo "🧪 Running $TEST_TYPE tests..."

case $TEST_TYPE in
  "core")
    BASE_URL=$BASE_URL npx playwright test tests/core-features.spec.js --reporter=html
    ;;
  "advanced")
    BASE_URL=$BASE_URL npx playwright test tests/advanced-features.spec.js --reporter=html
    ;;
  "all")
    BASE_URL=$BASE_URL npx playwright test --reporter=html
    ;;
  "quick")
    BASE_URL=$BASE_URL npx playwright test --grep="should login|should create" --reporter=line
    ;;
  *)
    echo "Unknown test type: $TEST_TYPE"
    echo "Available types: core, advanced, all, quick"
    exit 1
    ;;
esac

TEST_RESULT=$?

# Генерация отчета
echo "📊 Test execution completed with exit code: $TEST_RESULT"

if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed. Check the HTML report for details."
fi

# Копирование отчетов в общую директорию
if [ -d "playwright-report" ]; then
  cp -r playwright-report /app/test-reports/frontend-$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
  echo "📋 HTML report saved to test-reports directory"
fi

exit $TEST_RESULT