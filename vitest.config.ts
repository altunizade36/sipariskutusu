import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['address-module/**', 'node_modules/**', 'dist/**', 'src/context/AuthContext.test.tsx'],
  },
});
