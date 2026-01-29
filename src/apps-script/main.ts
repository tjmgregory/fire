/**
 * Main Entry Point
 *
 * Exports all Apps Script functions for the bundled Code.js.
 * This is the single entry point for rollup bundling.
 *
 * @module main
 */

// Re-export all trigger functions
export {
  onEdit,
  installOnEditTrigger,
  uninstallOnEditTrigger,
  loadActiveCategories
} from './triggers/onEditTrigger';

export {
  scheduledNormalization,
  scheduledCategorization,
  installScheduledTriggers,
  uninstallScheduledTriggers,
  checkTriggerStatus
} from './triggers/scheduledTriggers';

// Re-export controller entry points
export {
  processNewTransactions,
  runNormalization,
  normalizeFromSheet
} from './controllers/NormalizationController';

export {
  categorizeTransactions,
  runCategorization,
  recategorizeAll
} from './controllers/CategorizationController';

// Re-export setup functions
export {
  setupSheets,
  setupCategoriesSheet,
  setupResultSheet,
  setCategoryFormula
} from './setup/setupSheets';
