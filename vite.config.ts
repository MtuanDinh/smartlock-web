import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    environment: 'node',
    include: ['src/lib/__tests__/**/*.test.ts'],
  },
});
