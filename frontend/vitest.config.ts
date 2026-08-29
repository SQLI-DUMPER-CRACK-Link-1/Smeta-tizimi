import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // These are standalone Node gate scripts.  `npm run tekshir` executes
    // them as child processes; loading them in Vitest makes their intentional
    // `process.exit()` calls look like failing test suites.
    exclude: [...configDefaults.exclude, 'testlar/**/*.test.{cjs,mjs}'],
  },
});
