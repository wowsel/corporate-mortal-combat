import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', assetsDir: 'bundle' },
  test: { include: ['test/**/*.test.ts'] },
});
