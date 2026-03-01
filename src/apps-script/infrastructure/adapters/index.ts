/**
 * Infrastructure Adapters
 *
 * Exports all adapter implementations for hexagonal architecture.
 * These adapters implement domain ports, isolating external dependencies.
 *
 * @module infrastructure/adapters
 */

export { SheetDataAdapter } from './SheetDataAdapter';
export { HistoricalExchangeRateAdapter } from './HistoricalExchangeRateAdapter';
export { AICategorizationAdapter } from './AICategorizationAdapter';
