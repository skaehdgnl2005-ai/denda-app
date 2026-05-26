import { defineConfig, devices } from '@playwright/test';

// web-guest Playwright config — TEST_PLAN.md Web guest E2E (Playwright + Vercel + Next.js).
//
// webServer는 `npm run dev` 자동 spawn. dummy supabase env로 `lib/supabase.ts` import-time
// throw 회피 (실제 fetch는 dummy URL → network fail → catch 분기로 UI 정상 mount).
// NEXT_PUBLIC_IS_E2E=true는 `app/g/[token]/page.tsx::getGroup`에서 mock 그룹 데이터 사용.

export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_IS_E2E: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'https://e2e-dummy.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-dummy-anon-key',
    },
  },
});
