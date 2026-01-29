/**
 * Main Entry Point
 *
 * Exports Apps Script functions for the bundled Code.js.
 * This is the single entry point for rollup bundling.
 *
 * Only essential user-facing and trigger functions are exported.
 * Internal helpers and redundant aliases are kept private.
 *
 * @module main
 */

// Trigger functions (must be global for Apps Script)
export { onEdit } from './triggers/onEditTrigger';
export {
  scheduledNormalization,
  scheduledCategorization
} from './triggers/scheduledTriggers';

// User-facing entry points
export { processNewTransactions } from './controllers/NormalizationController';
export {
  categorizeTransactions,
  recategorizeAll
} from './controllers/CategorizationController';

// One-time setup (includes trigger installation)
export { setupSheets } from './setup/setupSheets';
