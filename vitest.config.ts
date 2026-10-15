import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { 'visual-quantum-computing': fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // The simulator is pure math, so tests run in plain Node.
    environment: 'node',
  },
})
