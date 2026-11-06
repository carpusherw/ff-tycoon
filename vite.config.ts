/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ff-tycoon/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Vitest empties CSS by default; the stylesheet keeps its text so tokens.test.ts can check its colors.
    css: { include: [/styles\.css/] },
  },
});
