import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'src/apps-script/infrastructure/adapters/**',  // Skip adapter layer (Apps Script specific)
        'src/apps-script/triggers/**',                 // Skip trigger handlers
        'tests/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/index.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  },
  resolve: {
    extensions: ['.ts', '.js', '.json']
  }
});
