import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 40000,
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npx tsx server.ts',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: { ...process.env, PORT: '3100' },
  },
  workers: 1,
});