import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import { copyFileSync } from 'fs';

export default {
  input: 'src/apps-script/main.ts',
  output: {
    file: 'dist/Code.js',
    format: 'iife',
    name: 'Fire',
    // Expose essential functions to global scope for Apps Script
    // IMPORTANT: Must use function declarations, not var assignments
    // Apps Script only recognizes "function foo() {}" in the dropdown
    //
    // Only essential user-facing and trigger functions are exposed:
    // - Triggers: onEdit, scheduledNormalization, scheduledCategorization
    // - User actions: setupSheets, processNewTransactions, categorizeTransactions, recategorizeAll
    footer: `
// Trigger functions (must be global for Apps Script triggers)
function onEdit(e) { return Fire.onEdit(e); }
function scheduledNormalization() { return Fire.scheduledNormalization(); }
function scheduledCategorization() { return Fire.scheduledCategorization(); }

// User-facing entry points
function setupSheets() { return Fire.setupSheets(); }
function processNewTransactions() { return Fire.processNewTransactions(); }
function categorizeTransactions() { return Fire.categorizeTransactions(); }
function recategorizeAll() { return Fire.recategorizeAll(); }
`
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      outDir: undefined,
      // Override module setting for rollup compatibility
      module: 'ESNext'
    }),
    cleanup({
      comments: 'none',
      extensions: ['ts']
    }),
    // Copy appsscript.json to dist
    {
      name: 'copy-appsscript',
      writeBundle() {
        copyFileSync('src/apps-script/appsscript.json', 'dist/appsscript.json');
      }
    }
  ]
};
