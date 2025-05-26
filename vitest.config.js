import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [], // Can add setup files later if needed e.g. for polyfills
    include: ['src/tests/unit/**/*.test.js', 'src/tests/integration/**/*.test.js'],
    hookTimeout: 30000,
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        'src/tests/**',
        'src/**/index.js', // Often just exports, adjust if needed
        'src/pdfagogo.js', // Main entry, test through E2E or integration
        'src/**/htmlDownloadHandler.js', // May need specific E2E setup
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.js',
        '**/*.d.ts'
      ],
    },
  },
}); 