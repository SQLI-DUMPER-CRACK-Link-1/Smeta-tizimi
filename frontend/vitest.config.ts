import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // These are standalone Node gate scripts.  `npm run tekshir` executes
    // them as child processes; loading them in Vitest makes their intentional
    // `process.exit()` calls look like failing test suites.
    exclude: [...configDefaults.exclude, 'testlar/**/*.test.{cjs,mjs}'],
    // Og'ir Excel kutubxonalari (exceljs, xlsx-js-style) birinchi dinamik
    // importda to'liq parallel yurishda 5–11 s oladi — standart 5 s chegara
    // mantiq xatosi bo'lmagan testlarni tasodifan yiqitardi (2026-09-24 o'lchandi).
    testTimeout: 20_000,
  },
});
