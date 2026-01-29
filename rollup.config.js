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
    footer: `
// Expose trigger functions to global scope for Apps Script
var onEdit = Fire.onEdit;
var installOnEditTrigger = Fire.installOnEditTrigger;
var uninstallOnEditTrigger = Fire.uninstallOnEditTrigger;
var loadActiveCategories = Fire.loadActiveCategories;

// Scheduled triggers
var scheduledNormalization = Fire.scheduledNormalization;
var scheduledCategorization = Fire.scheduledCategorization;
var installScheduledTriggers = Fire.installScheduledTriggers;
var uninstallScheduledTriggers = Fire.uninstallScheduledTriggers;
var checkTriggerStatus = Fire.checkTriggerStatus;

// Controller entry points
var processNewTransactions = Fire.processNewTransactions;
var runNormalization = Fire.runNormalization;
var normalizeFromSheet = Fire.normalizeFromSheet;
var categorizeTransactions = Fire.categorizeTransactions;
var runCategorization = Fire.runCategorization;
var recategorizeAll = Fire.recategorizeAll;

// Setup functions
var setupSheets = Fire.setupSheets;
var setupCategoriesSheet = Fire.setupCategoriesSheet;
var setupResultSheet = Fire.setupResultSheet;
var setCategoryFormula = Fire.setCategoryFormula;
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
