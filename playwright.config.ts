import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './src/tests',
  timeout: 30000,
  expect: {
    timeout: 15000
  },
  use: {
    baseURL: 'http://localhost:9000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
};

export default config;