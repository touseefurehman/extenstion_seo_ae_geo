import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globalSetup: ['tests/unit/globalSetup.mjs'],
    testTimeout: 60_000,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
