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
    // Expose all functions to global scope for Apps Script
    // IMPORTANT: Must use function declarations, not var assignments
    // Apps Script only recognizes "function foo() {}" in the dropdown
    footer: `
// Expose trigger functions to global scope for Apps Script
function onEdit(e) { return Fire.onEdit(e); }
function installOnEditTrigger() { return Fire.installOnEditTrigger(); }
function uninstallOnEditTrigger() { return Fire.uninstallOnEditTrigger(); }
function loadActiveCategories() { return Fire.loadActiveCategories(); }

// Scheduled triggers
function scheduledNormalization() { return Fire.scheduledNormalization(); }
function scheduledCategorization() { return Fire.scheduledCategorization(); }
function installScheduledTriggers() { return Fire.installScheduledTriggers(); }
function uninstallScheduledTriggers() { return Fire.uninstallScheduledTriggers(); }
function checkTriggerStatus() { return Fire.checkTriggerStatus(); }

// Controller entry points
function processNewTransactions() { return Fire.processNewTransactions(); }
function runNormalization() { return Fire.runNormalization(); }
function normalizeFromSheet() { return Fire.normalizeFromSheet(); }
function categorizeTransactions() { return Fire.categorizeTransactions(); }
function runCategorization() { return Fire.runCategorization(); }
function recategorizeAll() { return Fire.recategorizeAll(); }

// Setup functions
function setupSheets() { return Fire.setupSheets(); }
function setupCategoriesSheet() { return Fire.setupCategoriesSheet(); }
function setupResultSheet() { return Fire.setupResultSheet(); }
function setCategoryFormula() { return Fire.setCategoryFormula(); }
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
