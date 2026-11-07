import { defineConfig } from 'vitest/config';

// Database tests need DATABASE_URL pointing at a migrated + seeded database.
export default defineConfig({
  test: {
    include: ['test/db/**/*.db.test.ts'],
    fileParallelism: false,
  },
});
